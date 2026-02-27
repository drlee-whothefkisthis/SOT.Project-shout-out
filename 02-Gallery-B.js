<script>
/* =========================================================
   Shout-out Gallery Engine v2.3 (Modal Swipe Fix Pack v2)
   - FIX-A: iOS 탭 토글 "2번" 문제 해결 (touchend 후 click suppress)
   - FIX-B: 우측 패널 일부 노출(peek) 문제 해결 (idle은 -100% 고정, drag만 px)
   ========================================================= */

(function () {

  const USE_TEST_IMAGES = false;
  const TEST_COUNT = 75;

  const BUBBLE_SEARCH_API = "https://plp-62309.bubbleapps.io/version-test/api/1.1/wf/find-photos";
  const UNIT_PRICE = 5000;
  const PACKAGE_THRESHOLD = 6; // ✅ 패키지 기준 장수
  const PACKAGE_PRICE = 24900; // ✅ 무제한 패키지 가격
  const CART_PAGE_PATH = "/cart";

  // ✅ [추가] 이벤트 메타 조회 (event_code / event_display_name)
  const BUBBLE_EVENT_OBJ_API = "https://plp-62309.bubbleapps.io/version-test/api/1.1/obj/event/";

  // ✅ [추가] 현재 갤러리 이벤트 메타 (카트 저장용)
  let currentEventMeta = { event_id: null, event_code: null, event_display_name: null };

  let photos = [];
  let photosByKey = new Map();
  let orderKeys = [];
  let currentModalKey = null;
  // cart state now handled by window.ShoutCart
  let currentSearchBib = null; // ✅ 이번 검색에서 사용한 배번호(q)
  // ✅ 갤러리 로컬 선택 상태 (전역 카트와 별개)
  let localSelectedKeys = new Set();
  let mainSizePlan = [];
  let lastCols = null;

  function getColsForLayout() {
    return (window.innerWidth <= 840) ? 3 : 4;
  }

  function getIntroCount(cols) {
    return (cols === 4) ? 5 : 3;
  }

  function cellAreaOf(type) {
    if (type === "size-big") return 4;
    if (type === "size-wide") return 2;
    if (type === "size-tall") return 2;
    return 1;
  }

  function buildMainSizePlan(count, cols) {
    const plan = [];
    for (let i = 0; i < count; i++) {
      const r = Math.random();
      if (r < 0.62) plan.push("size-normal");
      else if (r < 0.80) plan.push("size-tall");
      else if (r < 0.95) plan.push("size-wide");
      else plan.push("size-big");
    }

    let total = plan.reduce((s, t) => s + cellAreaOf(t), 0);
    let guard = 0;

    while (total % cols !== 0 && guard < 500) {
      guard++;
      for (let i = plan.length - 1; i >= 0; i--) {
        const t = plan[i];
        if (t === "size-big") { plan[i] = "size-wide"; total -= 2; break; }
        if (t === "size-wide" || t === "size-tall") { plan[i] = "size-normal"; total -= 1; break; }
      }
    }
    return plan;
  }

  function toHttps(url) {
    if (!url) return "";
    if (url.startsWith("//")) return "https:" + url;
    return url;
  }
  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  // ✅ [수정됨] event_code를 검색(constraints)하여 event_display_name 조회
  async function fetchEventMeta(eventId) {
    if (!eventId) return null;
    try {
      const constraints = encodeURIComponent(JSON.stringify([
        { key: "event_code", constraint_type: "equals", value: String(eventId) }
      ]));
      
      const url = BUBBLE_EVENT_OBJ_API + "?constraints=" + constraints;
      
      const r = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
      
      const json = await r.json();
      
      const results = (json && json.response && json.response.results) ? json.response.results : [];
      const obj = results.length > 0 ? results[0] : null;

      const code = obj && (obj.event_code || obj.eventCode || obj.code);
      const name = obj && (obj.event_display_name || obj.eventDisplayName || obj.display_name || obj.name);

      return {
        event_id: eventId,
        event_code: code ? String(code) : null,
        event_display_name: name ? String(name) : null
      };
    } catch (e) {
      console.warn("[Gallery] fetchEventMeta failed:", e);
      return null;
    }
  }
  function getPhotoKey(photo) {
    return (photo && photo._id) ? photo._id : (photo && photo.fileName) ? photo.fileName : "";
  }
  function cssEscape(str) {
    if (window.CSS && CSS.escape) return CSS.escape(str);
    return String(str).replace(/["\\#.;?+*~':!^$[\]()=>|/@]/g, "\\$&");
  }
    /* =========================================================
     ✅ Deduplicate photos (same file appears multiple times)
     - Prefer items that have bib bbox data for current search
  ========================================================= */
  function extractFileNameFromUrl(url) {
    try {
      if (!url) return "";
      const u = String(url);
      // strip url("...") wrapper if present
      const cleaned = u.replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
      const noQuery = cleaned.split("?")[0];
      const last = noQuery.split("/").pop() || "";
      return decodeURIComponent(last);
    } catch (_) {
      return "";
    }
  }

  function getDedupeKey(p) {
    if (!p) return "";
    const file = (p.fileName || p.filename || p.file_name || "").toString().trim();
    if (file) return file.toLowerCase();
    const fromPreview = extractFileNameFromUrl(p.preview_url || p.previewUrl || p.preview);
    if (fromPreview) return fromPreview.toLowerCase();
    // fallback to photo key (may still be unique per row)
    const k = getPhotoKey(p);
    return (k || "").toString().toLowerCase();
  }

  function scoreForDedupe(p) {
    // higher score wins when same file duplicates exist
    let s = 0;

    // prefer having bbox map at all
    if (p && p.bib_bbox_map_json) s += 5;

    // prefer having bbox for the current searched bib
    if (p && p.bib_bbox_map_json && currentSearchBib) {
      try {
        const map = safeJsonParse(p.bib_bbox_map_json, {});
        if (map && map[currentSearchBib]) s += 20;
      } catch (_) {}
    }

    // slight preference if it has explicit bbox too (future-proof)
    if (p && (p.bbox || p.bib_bbox)) s += 1;

    // keep deterministic: prefer earlier "created" rows? (if exists)
    return s;
  }

  function dedupePhotoList(list) {
    const bestByKey = new Map();
    const order = [];

    (list || []).forEach((p) => {
      const k = getDedupeKey(p);
      if (!k) {
        // no key: keep it as-is (rare)
        order.push(p);
        return;
      }

      const prev = bestByKey.get(k);
      if (!prev) {
        bestByKey.set(k, p);
        order.push(p);
        return;
      }

      // choose the better one
      const a = scoreForDedupe(prev);
      const b = scoreForDedupe(p);
      if (b > a) {
        bestByKey.set(k, p);
        // also replace in order list (first occurrence position)
        const idx = order.indexOf(prev);
        if (idx >= 0) order[idx] = p;
      }
      // else: drop p
    });

    // also ensure no duplicates from the "no key" path
    const seen = new Set();
    const out = [];
    order.forEach((p) => {
      const k = getDedupeKey(p) || ("__nokey__" + Math.random());
      if (seen.has(k)) return;
      seen.add(k);
      out.push(p);
    });

    return out;
  }

/* =========================
     ✅ Bib Focus (bbox -> background-position)
     - photo.bib_bbox_map_json 안에서 currentSearchBib 키를 찾아
       가장 conf 높은 박스의 center를 %로 변환
     ========================= */

  function safeJsonParse(str) {
    if (!str || typeof str !== "string") return null;
    try { return JSON.parse(str); } catch { return null; }
  }

  function getBibFocusFromPhoto(photo, bibStr) {
    if (!photo || !bibStr) return null;

    // Bubble 응답 기준 필드명: bib_bbox_map_json
    const mapStr = photo.bib_bbox_map_json;
    const map = safeJsonParse(mapStr);
    if (!map) return null;

    const bibKey = String(bibStr).trim();
    const boxes = map[bibKey];
    if (!Array.isArray(boxes) || boxes.length === 0) return null;

    // conf 가장 높은 박스 선택
    let best = boxes[0];
    for (const b of boxes) {
      if ((b?.conf ?? 0) > (best?.conf ?? 0)) best = b;
    }

    const x = Number(best?.x);
    const y = Number(best?.y);
    const w = Number(best?.w);
    const h = Number(best?.h);
    if ([x, y, w, h].some(n => Number.isNaN(n))) return null;

    // bbox는 좌상단(x,y) + 크기(w,h), 모두 0~1 정규화
    const cx = x + (w / 2);
    const cy = y + (h / 2);

    // CSS background-position (%)
    const px = Math.max(0, Math.min(100, cx * 100));
    const py = Math.max(0, Math.min(100, cy * 100));

    return { x: px, y: py };
  }

  function normalizeGridRows(el) {
    if (!el) return;
    el.style.gridTemplateRows = "none";
    el.style.gridTemplateAreas = "none";
  }

  function applyGridInline(el, cols, isIntro) {
    if (!el) return;

    const isMobile = (cols === 3);
    const gapPx = isMobile ? 10 : 14;

    el.style.display = "grid";
    el.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    el.style.gridAutoRows = "var(--cell, 250px)";
    el.style.gridAutoFlow = isIntro ? "row" : "row dense";
    el.style.gap = `${gapPx}px`;

    if (isIntro) el.style.marginBottom = `${gapPx}px`;
    else el.style.marginTop = "0px";

    normalizeGridRows(el);
  }

  /* =========================
     ✅ Selection & Cart
     ========================= */
  function isSelectedByKey(key){
    if (!key) return false;
    if(!window.ShoutCart) return false;
    return window.ShoutCart.has(key);
  }

  function toggleSelectByKey(key) {
    if (!window.ShoutCart) return;
    const photo = photosByKey.get(key);
    if (!photo) return;

    const bibStr = String(currentSearchBib || "");
    const eventId = String(currentEventMeta.event_id || "");

    // 이미 전역에 담겨 있으면 → 제거
    if (window.ShoutCart.has(photo._id)) {
      window.ShoutCart.remove(photo._id);
      localSelectedKeys.delete(key); // ✅ 로컬 상태 제거
      syncUI(key);
      updateSelectedTray();
      return;
    }

    // 추가
    window.ShoutCart.add({
      _id: photo._id,
      fileName: photo.fileName,
      preview_url: photo.preview_url,
      price: UNIT_PRICE,
      bib: bibStr,
      event_id: eventId,
      event_display_name: currentEventMeta.event_display_name
    });

    localSelectedKeys.add(key); // ✅ 로컬 상태 추가

    syncUI(key);
    updateSelectedTray();
  }
  function hydrateLocalSelectedFromGlobal(){
    if(!window.ShoutCart) return;
    localSelectedKeys.clear();

    const globalItems = window.ShoutCart.getItems();
    for(const it of globalItems){
      const id = String(it && it._id || "").trim();
      if(!id) continue;
      if(photosByKey && photosByKey.has(id)){
        localSelectedKeys.add(id);
      }
    }
  }
  function syncUI(key) {
    const card = document.querySelector(`.gallery-card[data-photo-key="${cssEscape(key)}"]`);
    if (card) {
      if (isSelectedByKey(key)) card.classList.add("is-selected");
      else card.classList.remove("is-selected");
    }
    if (currentModalKey === key) syncModalCheckUI(key);
    updateSelectedTray();
  }

  /* =========================
     ✅ Card DOM
     ========================= */
  function createCardEl(photo, sizeClass) {
    const key = getPhotoKey(photo);

    const card = document.createElement("div");
    card.className = `gallery-card ${sizeClass}`;
    card.setAttribute("data-photo-key", key);

    const imgUrl = toHttps(photo.preview_url) || "https://via.placeholder.com/600?text=No+Preview";

    const media = document.createElement("div");
    media.className = "gallery-media";
    media.style.backgroundImage = `url("${imgUrl}")`;
    // ✅ 배번호 중심으로 crop 기준점 이동 (레이아웃은 그대로)
    const focus = getBibFocusFromPhoto(photo, currentSearchBib);
    if (focus) {
      media.style.backgroundPosition = `${focus.x}% ${focus.y}%`;
    }


    // (모달만 컨트롤) 갤러리 그리드는 여백 추가 없음
    media.addEventListener("contextmenu", (e) => e.preventDefault());
    media.setAttribute("draggable", "false");

    const badge = document.createElement("div");
    badge.className = "sel-badge";
    badge.setAttribute("role", "button");
    badge.setAttribute("aria-label", "선택/해제");
    badge.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>`;

    badge.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSelectByKey(key);
    });

    card.append(media, badge);

    card.addEventListener("click", () => { openModalByKey(key); });

    if (isSelectedByKey(key)) card.classList.add("is-selected");

    return card;
  }

  /* =========================
     Intro Hard-Pin
     ========================= */
  function getIntroPinnedPlacements(cols) {
    if (cols === 4) {
      return [
        { size: "size-big",    c: 1, cs: 2, r: 1, rs: 2 },
        { size: "size-normal", c: 3, cs: 1, r: 1, rs: 1 },
        { size: "size-normal", c: 4, cs: 1, r: 1, rs: 1 },
        { size: "size-normal", c: 3, cs: 1, r: 2, rs: 1 },
        { size: "size-normal", c: 4, cs: 1, r: 2, rs: 1 },
      ];
    }
    return [
      { size: "size-big",    c: 1, cs: 2, r: 1, rs: 2 },
      { size: "size-normal", c: 3, cs: 1, r: 1, rs: 1 },
      { size: "size-normal", c: 3, cs: 1, r: 2, rs: 1 },
    ];
  }

  function renderIntroGridPinned(introEl, introPhotos, cols) {
    introEl.innerHTML = "";
    const frag = document.createDocumentFragment();
    const placements = getIntroPinnedPlacements(cols);

    introPhotos.forEach((p, i) => {
      const pl = placements[i];
      const card = createCardEl(p, (pl && pl.size) ? pl.size : "size-normal");

      if (pl) {
        card.style.gridColumn = `${pl.c} / span ${pl.cs}`;
        card.style.gridRow = `${pl.r} / span ${pl.rs}`;
      }
      frag.appendChild(card);
    });

    introEl.appendChild(frag);
  }

  function renderMainGrid(gridEl, mainPhotos) {
    gridEl.innerHTML = "";
    const frag = document.createDocumentFragment();

    mainPhotos.forEach((p, i) => {
      const sizeClass = mainSizePlan[i] || "size-normal";
      frag.appendChild(createCardEl(p, sizeClass));
    });

    gridEl.appendChild(frag);
  }

  /* =========================
     Cell size sync
     ========================= */
  function updateCellSize() {
    const mainEl = document.getElementById("galleryGrid");
    if (!mainEl) return;

    const w = mainEl.clientWidth;
    if (!w || w <= 0) return;

    const cols = getColsForLayout();
    const gapStr = getComputedStyle(mainEl).gap;
    const gap = Number.isFinite(parseFloat(gapStr)) ? parseFloat(gapStr) : (cols === 3 ? 10 : 14);

    const cellWidth = Math.floor((w - (gap * (cols - 1))) / cols);
    if (!cellWidth || cellWidth <= 0) return;

    mainEl.style.setProperty("--cell", `${cellWidth}px`);
    const introEl = document.getElementById("galleryIntroGrid");
    if (introEl) introEl.style.setProperty("--cell", `${cellWidth}px`);
  }

  function syncCellSizeSoon() {
    updateCellSize();
    requestAnimationFrame(() => updateCellSize());
    requestAnimationFrame(() => requestAnimationFrame(() => updateCellSize()));
    setTimeout(updateCellSize, 120);
    setTimeout(updateCellSize, 420);
  }

  /* =========================
     ✅ Modal (iOS-style swipe)
     ========================= */

  let __modalScrollY = 0;
  let __isBodyLocked = false;

  function lockBodyScroll() {
    if (__isBodyLocked) return;
    __modalScrollY = window.scrollY || window.pageYOffset || 0;

    document.body.style.position = "fixed";
    document.body.style.top = `-${__modalScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    __isBodyLocked = true;
  }

  function unlockBodyScroll() {
    if (!__isBodyLocked) return;

    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    document.body.style.overflow = "";

    window.scrollTo(0, __modalScrollY);
    __isBodyLocked = false;
  }

  function isModalOpen() {
    const overlay = document.getElementById("shoutModalOverlay");
    return !!(overlay && overlay.classList.contains("is-open"));
  }

  // ✅ 탭 2번(터치+클릭) 방지용
  let __suppressClickUntil = 0;

  function suppressNextClick(ms) {
    __suppressClickUntil = Date.now() + ms;
  }
  function isClickSuppressed() {
    return Date.now() < __suppressClickUntil;
  }

  function preloadPanelsForKey(key) {
    const prevEl = document.getElementById("shoutModalPrev");
    const curEl  = document.getElementById("shoutModalCurrent");
    const nextEl = document.getElementById("shoutModalNext");

    const idx = orderKeys.indexOf(key);
    if (idx === -1) return;

    const prevKey = orderKeys[(idx <= 0) ? (orderKeys.length - 1) : (idx - 1)];
    const nextKey = orderKeys[(idx >= orderKeys.length - 1) ? 0 : (idx + 1)];

    const curPhoto  = photosByKey.get(key);
    const prevPhoto = photosByKey.get(prevKey);
    const nextPhoto = photosByKey.get(nextKey);

    if (curEl && curPhoto)  curEl.style.backgroundImage  = `url("${toHttps(curPhoto.preview_url)}")`;
    if (prevEl && prevPhoto) prevEl.style.backgroundImage = `url("${toHttps(prevPhoto.preview_url)}")`;
    if (nextEl && nextPhoto) nextEl.style.backgroundImage = `url("${toHttps(nextPhoto.preview_url)}")`;
  }

  // ✅ 정지(Idle) 상태는 %로 딱 고정 -> peek 방지
  function snapTrackToCenterIdle() {
    const track = document.getElementById("shoutModalTrack");
    if (!track) return;
    track.style.transition = "none";
    track.style.transform = "translateX(-100%)";
  }

  function ensureModalUI() {
    if (document.getElementById("shoutModalOverlay")) return;

    const html = `
      <div id="shoutModalOverlay">
        <div id="shoutModalContainer">
          <div id="shoutModalTopbar">
            <button id="shoutModalCloseBtn" class="shoutModalBtn">← 닫기</button>
            <div id="shoutModalCounter" style="color:#fff; font-weight:600;"></div>
            <button id="shoutModalCheckBtn" class="shoutModalBtn">선택</button>
          </div>

          <button id="shoutModalPrevBtn" class="shoutModalNavBtn is-left" aria-label="Previous">
            <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"></path></svg>
          </button>
          <button id="shoutModalNextBtn" class="shoutModalNavBtn is-right" aria-label="Next">
            <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"></path></svg>
          </button>

          <div id="shoutModalImageWrap">
            <div id="shoutModalTrack">
              <div class="shoutModalPanel" id="shoutModalPrev"></div>
              <div class="shoutModalPanel" id="shoutModalCurrent" role="img" aria-label=""></div>
              <div class="shoutModalPanel" id="shoutModalNext"></div>
            </div>
          </div>
        </div>
      </div>

      <div id="shoutSelectedTray">
        <div id="shoutSelectedTrayTop">
          <div id="shoutSelectedInfo">0장 선택</div>
          <button id="shoutGoCartBtn">장바구니 →</button>
        </div>
        <div id="shoutSelectedList"></div>
      </div>
    `;

    const div = document.createElement("div");
    div.innerHTML = html;
    while (div.firstChild) document.body.appendChild(div.firstChild);

    const prevEl = document.getElementById("shoutModalPrev");
    const curEl  = document.getElementById("shoutModalCurrent");
    const nextEl = document.getElementById("shoutModalNext");
    [prevEl, curEl, nextEl].forEach((el) => {
      if (!el) return;
      el.style.width = "100%";
      el.style.height = "100%";
      el.style.backgroundPosition = "center";
      el.style.backgroundRepeat = "no-repeat";
      el.style.backgroundSize = "contain";

      // ✅ 이미지(배경)만 안쪽으로 패딩: 테두리(엘리먼트)는 프레임에 붙고, 이미지가 안으로 들어감
      el.style.boxSizing = "border-box";
      el.style.padding = "clamp(6px, 1vw, 10px) clamp(10px, 2.2vw, 16px)";
      el.style.backgroundClip = "content-box";
      el.style.backgroundOrigin = "content-box";

      el.style.userSelect = "none";
      el.style.webkitUserDrag = "none";
      el.style.touchAction = "pan-x";
      el.style.overscrollBehavior = "contain";
    });

    const wrap  = document.getElementById("shoutModalImageWrap");
    const track = document.getElementById("shoutModalTrack");
    if (wrap && track) {
      wrap.style.overflow = "hidden";
      wrap.style.background = "#000";
            wrap.style.boxSizing = "border-box";
      wrap.style.padding = "14px 0px 18px 0px"; // ✅ 상하만 여백(코너 잘림 방지), 좌우는 프레임에 붙임

      track.style.display = "flex";
      track.style.width = "300%";
      track.style.height = "100%";
      track.style.willChange = "transform";
      track.style.transition = "none";
      track.style.transform = "translateX(-100%)"; // ✅ idle은 항상 -100%

      const panels = track.querySelectorAll(".shoutModalPanel");
      panels.forEach((p) => {
        p.style.flex = "0 0 100%";
        p.style.width = "100%";
        p.style.minWidth = "100%";
      });
    }

    document.getElementById("shoutModalCloseBtn").onclick = closeModal;
    document.getElementById("shoutModalOverlay").onclick = (e) => {
      if (e.target.id === "shoutModalOverlay") closeModal();
    };

    document.getElementById("shoutModalCheckBtn").onclick = () => {
      if (currentModalKey) toggleSelectByKey(currentModalKey);
    };

    // ✅ click은 유지하되, touch 직후엔 무시해서 "2번 토글" 차단
    document.getElementById("shoutModalCurrent").addEventListener("click", (e) => {
      if (isClickSuppressed()) return;
      e.preventDefault();
      if (currentModalKey) toggleSelectByKey(currentModalKey);
    });

    document.getElementById("shoutGoCartBtn").onclick = goToCartPage;
    document.getElementById("shoutModalPrevBtn").onclick = goPrevInModal;
    document.getElementById("shoutModalNextBtn").onclick = goNextInModal;

    (function attachModalSwipeIOSStyle() {
      const wrap  = document.getElementById("shoutModalImageWrap");
      const track = document.getElementById("shoutModalTrack");
      if (!wrap || !track) return;

      let startX = 0;
      let startY = 0;
      let dx = 0;
      let dy = 0;
      let dragging = false;
      let animating = false;
      let axisLocked = null;

      const THRESHOLD_RATIO = 0.18;
      const TAP_SLOP = 8;
      const MAX_Y = 90;
      const ANIM_MS = 220;


      function getViewportW() {
        const cs = getComputedStyle(wrap);
        const pl = parseFloat(cs.paddingLeft) || 0;
        const pr = parseFloat(cs.paddingRight) || 0;
        return Math.max(0, (wrap.clientWidth || 0) - pl - pr);
      }
      function setTrackPx(px, withAnim) {
        if (withAnim) track.style.transition = `transform ${ANIM_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
        else track.style.transition = "none";
        track.style.transform = `translate3d(${px}px, 0, 0)`;
      }

      wrap.addEventListener("touchstart", (ev) => {
        if (!isModalOpen()) return;
        if (animating) return;

        const t = ev.touches && ev.touches[0];
        if (!t) return;

        if (currentModalKey) preloadPanelsForKey(currentModalKey);
        snapTrackToCenterIdle(); // ✅ 시작 시점에 중앙 고정 상태로 정렬

        startX = t.clientX;
        startY = t.clientY;
        dx = 0;
        dy = 0;
        axisLocked = null;
        dragging = true;

        // ✅ 드래그는 px 기반으로 시작
        const w = getViewportW();
        setTrackPx(-w, false);
      }, { passive: true });

      wrap.addEventListener("touchmove", (ev) => {
        if (!dragging) return;
        if (!isModalOpen()) return;

        const t = ev.touches && ev.touches[0];
        if (!t) return;

        dx = t.clientX - startX;
        dy = t.clientY - startY;

        if (!axisLocked) axisLocked = (Math.abs(dx) > Math.abs(dy)) ? "x" : "y";

        if (axisLocked === "y") {
          if (Math.abs(dy) > MAX_Y && Math.abs(dy) > Math.abs(dx)) {
            dragging = false;
            animating = true;
            snapTrackToCenterIdle();
            setTimeout(() => { animating = false; }, ANIM_MS + 40);
          }
          return;
        }

        ev.preventDefault();

        const w = getViewportW();
        setTrackPx(-w + dx, false);
      }, { passive: false });

      wrap.addEventListener("touchend", () => {
        if (!dragging) return;
        dragging = false;
        if (!isModalOpen()) return;

        const w = getViewportW();
        const threshold = w * THRESHOLD_RATIO;

        // ✅ 탭 판정이면: 토글은 즉시(체감 빠름), click은 suppress 유지
        if (Math.abs(dx) <= TAP_SLOP && Math.abs(dy) <= TAP_SLOP) {
          suppressNextClick(450); // ✅ click이 뒤늦게 와도 무시

          // ✅ (핵심) 선택 반응을 버튼급으로 즉시 처리
          if (currentModalKey) toggleSelectByKey(currentModalKey);

          animating = true;
          setTrackPx(-w, true);
          setTimeout(() => {
            animating = false;
            snapTrackToCenterIdle(); // ✅ idle은 항상 -100%로 고정
          }, ANIM_MS + 30);
          return;
        }

        if (Math.abs(dx) < threshold) {
          animating = true;
          setTrackPx(-w, true);
          setTimeout(() => {
            animating = false;
            snapTrackToCenterIdle();
          }, ANIM_MS + 40);
          return;
        }

        if (dx < 0) {
          animating = true;
          setTrackPx(-w - w, true);
          setTimeout(() => {
            animating = false;
            goNextInModal();
          }, ANIM_MS + 40);
        } else {
          animating = true;
          setTrackPx(-w + w, true);
          setTimeout(() => {
            animating = false;
            goPrevInModal();
          }, ANIM_MS + 40);
        }
      }, { passive: true });

    })();

    document.addEventListener("keydown", onModalKeyDown, true);
  }

  function openModalByKey(key) {
    const photo = photosByKey.get(key);
    if (!photo) return;

    currentModalKey = key;

    const overlay = document.getElementById("shoutModalOverlay");
    const counter = document.getElementById("shoutModalCounter");

    const idx = orderKeys.indexOf(key);
    if (counter) counter.textContent = `${idx + 1} / ${orderKeys.length}`;

    lockBodyScroll();
    if (overlay) overlay.classList.add("is-open");

    requestAnimationFrame(() => {
      snapTrackToCenterIdle();
      preloadPanelsForKey(key);
      syncModalCheckUI(key);
    });
  }

  function closeModal() {
    const overlay = document.getElementById("shoutModalOverlay");
    if (overlay) overlay.classList.remove("is-open");
    unlockBodyScroll();
    currentModalKey = null;
  }

  function syncModalCheckUI(key) {
    const btn = document.getElementById("shoutModalCheckBtn");
    const media = document.getElementById("shoutModalCurrent");

    if (isSelectedByKey(key)) {
      if (btn) btn.classList.add("is-selected");
      if (media) {
        media.classList.add("is-selected");
        media.style.outline = "3px solid #2F80FF";
        media.style.outlineOffset = "-3px";
      }
    } else {
      if (btn) btn.classList.remove("is-selected");
      if (media) {
        media.classList.remove("is-selected");
        media.style.outline = "none";
        media.style.outlineOffset = "";
      }
    }
  }

  function goPrevInModal() {
    if (!currentModalKey) return;
    const idx = orderKeys.indexOf(currentModalKey);
    if (idx === -1) return;

    const nextIdx = (idx <= 0) ? (orderKeys.length - 1) : (idx - 1);
    openModalByKey(orderKeys[nextIdx]);
  }

  function goNextInModal() {
    if (!currentModalKey) return;
    const idx = orderKeys.indexOf(currentModalKey);
    if (idx === -1) return;

    const nextIdx = (idx >= orderKeys.length - 1) ? 0 : (idx + 1);
    openModalByKey(orderKeys[nextIdx]);
  }

  function onModalKeyDown(e) {
    if (!isModalOpen()) return;

    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
      return;
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrevInModal();
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      goNextInModal();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (currentModalKey) toggleSelectByKey(currentModalKey);
      return;
    }
  }

  function updateSelectedTray() {
    const tray = document.getElementById("shoutSelectedTray");
    const info = document.getElementById("shoutSelectedInfo");
    const list = document.getElementById("shoutSelectedList");

    if (!tray || !info || !list) return;
    if (!window.ShoutCart) return;

    const eventId = String(currentEventMeta.event_id || "");
    const bibStr = String(currentSearchBib);

    // ✅ 갤러리 가격/패키지 표시는 "현재 컨텍스트(event_id + bib)"만 기준
    // ✅ 갤러리 트레이는 '이번 갤러리에서 선택한 것'만 표시
    const selected = Array.from(localSelectedKeys).map(k => photosByKey.get(k)).filter(Boolean);

    if (selected.length === 0) {
      tray.classList.remove("is-open");
      list.innerHTML = "";
      info.textContent = "";
      return;
    }

    tray.classList.add("is-open");

    const count = selected.length;
    const totalPrice = (count >= PACKAGE_THRESHOLD) ? PACKAGE_PRICE : (count * UNIT_PRICE);
    const packageLabel = (count >= PACKAGE_THRESHOLD)
      ? `<span style="font-size:12px; color:#fff; background:#e11d48; padding:2px 6px; border-radius:4px; margin-left:6px;">패키지 적용</span>`
      : "";

    info.innerHTML = `${count}장 <span style="color:#60a5fa; margin-left:4px;">(${totalPrice.toLocaleString()}원)</span> ${packageLabel}`;

    list.innerHTML = "";
    selected.forEach(item => {
      const wrap = document.createElement("div");
      wrap.className = "shoutMiniThumb";
      wrap.innerHTML = `<img src="${toHttps(item.preview_url)}">`;
      list.appendChild(wrap);
    });
  }



  function goToCartPage() {
   if(!window.ShoutCart || window.ShoutCart.count() === 0){
     return alert("사진을 선택해주세요.");
   }
   window.location.href = CART_PAGE_PATH;
  }

  /* =========================
     Data fetch
     ========================= */
  async function fetchPhotos(eventId, bib) {
    if (!eventId) return [];
    try {
      const res = await fetch(BUBBLE_SEARCH_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, ocr_bib: bib ? bib.trim() : undefined })
      });
      const data = await res.json();

      let list = [];
      if (data && data.response) {
        for (const k in data.response) {
          if (Array.isArray(data.response[k])) { list = data.response[k]; break; }
        }
      }
      return list;
    } catch (e) {
      console.error("API Error:", e);
      return [];
    }
  }

  function buildTestPhotos(n) {
    return Array.from({ length: n }).map((_, i) => ({
      _id: "test_" + i,
      preview_url: `https://picsum.photos/600/600?random=${i}`,
      price: UNIT_PRICE
    }));
  }

  function ensureIntroGridBeforeMain() {
    const mainEl = document.getElementById("galleryGrid");
    if (!mainEl) return null;

    let introEl = document.getElementById("galleryIntroGrid");
    if (!introEl) {
      introEl = document.createElement("div");
      introEl.id = "galleryIntroGrid";
      mainEl.parentNode.insertBefore(introEl, mainEl);
    }
    return introEl;
  }

  async function initGallery() {
    hydrateLocalSelectedFromGlobal(); // ✅ 초기 동기화
    ensureModalUI();

    const mainEl = document.getElementById("galleryGrid");
    if (!mainEl) return;

    const introEl = ensureIntroGridBeforeMain();

    const cols = getColsForLayout();
    lastCols = cols;

    applyGridInline(introEl, cols, true);
    applyGridInline(mainEl, cols, false);

    let list = [];
    if (USE_TEST_IMAGES) {
      list = buildTestPhotos(TEST_COUNT);
    } else {
      const eventId = getQueryParam("event_id");
      const bib = getQueryParam("q");

      // ✅ [추가] 현재 이벤트 메타 확보 (카트 저장/표시용)
      currentEventMeta.event_id = eventId || null;
      const meta = await fetchEventMeta(eventId);
      if (meta) currentEventMeta = meta;

      // ✅ 이번 검색 bib 기억 (없으면 null)
      currentSearchBib = (bib && String(bib).trim()) ? String(bib).trim() : null;

      list = await fetchPhotos(eventId, bib);

      // ✅ 같은 파일 중복 제거 (Bubble 중복 데이터 방어)
      list = dedupePhotoList(list);

    }

    photos = list;
    photosByKey.clear();
    orderKeys = [];
    photos.forEach(p => {
      const k = getPhotoKey(p);
      if (k) { photosByKey.set(k, p); orderKeys.push(k); }
    });

    if (photos.length === 0) {
      if (introEl) introEl.innerHTML = "";
      mainEl.innerHTML = "<div style='color:white; text-align:center; padding:50px;'>사진이 없습니다.</div>";
      return;
    }

    const introCount = Math.min(getIntroCount(cols), photos.length);
    const introPhotos = photos.slice(0, introCount);
    const mainPhotos = photos.slice(introCount);

    mainSizePlan = buildMainSizePlan(mainPhotos.length, cols);

    renderIntroGridPinned(introEl, introPhotos, cols);
    renderMainGrid(mainEl, mainPhotos);

    applyGridInline(introEl, cols, true);
    applyGridInline(mainEl, cols, false);

    syncCellSizeSoon();
    window.addEventListener("load", () => {
      applyGridInline(introEl, lastCols, true);
      applyGridInline(mainEl, lastCols, false);
      updateCellSize();

      // ✅ [추가] 리스트가 렌더링된 이후에 동기화 & UI 갱신
      hydrateLocalSelectedFromGlobal();
      if (window.ShoutCart) window.ShoutCart.refresh(); // UI 싱크 맞추기
    }, { once: true });

    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        updateCellSize();
      });
      ro.observe(mainEl);
      if (introEl) ro.observe(introEl);
    }

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const newCols = getColsForLayout();

        if (newCols === lastCols) {
          syncCellSizeSoon();
          return;
        }

        lastCols = newCols;

        applyGridInline(introEl, newCols, true);
        applyGridInline(mainEl, newCols, false);

        const newIntroCount = Math.min(getIntroCount(newCols), photos.length);
        const newIntroPhotos = photos.slice(0, newIntroCount);
        const newMainPhotos  = photos.slice(newIntroCount);

        mainSizePlan = buildMainSizePlan(newMainPhotos.length, newCols);

        renderIntroGridPinned(introEl, newIntroPhotos, newCols);
        renderMainGrid(mainEl, newMainPhotos);

        applyGridInline(introEl, newCols, true);
        applyGridInline(mainEl, newCols, false);

        syncCellSizeSoon();
      }, 120);
    });
  }

  document.addEventListener("DOMContentLoaded", initGallery);

})();
</script>