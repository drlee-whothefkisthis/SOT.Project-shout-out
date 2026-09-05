window.ShoutGallery = window.ShoutGallery || {};
window.__SHOUT_CART_ICON_URL__ = "https://cdn.prod.website-files.com/691e5df3002228c301997066/695220517923951d43b98518_Interface-%2F-Shopping_Cart_02.svg";
window.ShoutGallery.buildCartLockIconEl = (() => {
  let cartLockSvgTemplate = null;

  return function buildCartLockIconEl() {
    const iconUrl = String((window.__SHOUT_CART_ICON_URL__ || "")).trim();
    const wrap = document.createElement("div");
    wrap.className = "cart-lock-icon";
    wrap.setAttribute("aria-hidden", "true");

    if (iconUrl) {
      const img = document.createElement("img");
      img.src = iconUrl;
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      try { img.decoding = "async"; } catch (e) {}
      wrap.appendChild(img);
      return wrap;
    }

    if (!cartLockSvgTemplate) {
      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.setAttribute("stroke", "white");
      svg.setAttribute("stroke-width", "1.8");
      svg.setAttribute("stroke-linecap", "round");
      svg.setAttribute("stroke-linejoin", "round");

      const c1 = document.createElementNS(svgNS, "circle");
      c1.setAttribute("cx", "9");
      c1.setAttribute("cy", "20");
      c1.setAttribute("r", "1");

      const c2 = document.createElementNS(svgNS, "circle");
      c2.setAttribute("cx", "18");
      c2.setAttribute("cy", "20");
      c2.setAttribute("r", "1");

      const p = document.createElementNS(svgNS, "path");
      p.setAttribute("d", "M3 4h2l2.2 10.5a2 2 0 0 0 2 1.5h7.6a2 2 0 0 0 2-1.6L22 7H6");

      svg.appendChild(c1);
      svg.appendChild(c2);
      svg.appendChild(p);
      cartLockSvgTemplate = svg;
    }

    wrap.appendChild(cartLockSvgTemplate.cloneNode(true));
    return wrap;
  };
})();

function mountGalleryViewportBottomMask() {
  if (document.getElementById("galleryViewportBottomMask")) return;
  const mask = document.createElement("div");
  mask.id = "galleryViewportBottomMask";
  mask.className = "gallery-viewport-bottom-mask";
  mask.setAttribute("aria-hidden", "true");
  document.body.appendChild(mask);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountGalleryViewportBottomMask, { once: true });
} else {
  mountGalleryViewportBottomMask();
}

window.ShoutGallery.getGalleryGridCoveredBottom = function (gridEl) {
  const grid = gridEl.getBoundingClientRect();
  const match = String(gridEl.style.gridTemplateColumns).match(/repeat\((\d+)/);
  const cols = Number(match && match[1]) || 3;
  const cards = Array.from(gridEl.querySelectorAll(".gallery-card"), (card) => card.getBoundingClientRect());
  let shortestBottom = Infinity;

  for (let i = 0; i < cols; i += 1) {
    const x = grid.left + (grid.width * (i + .5) / cols);
    let columnBottom = -Infinity;

    cards.forEach((card) => {
      if (card.left <= x && card.right >= x) columnBottom = Math.max(columnBottom, card.bottom);
    });
    shortestBottom = Math.min(shortestBottom, columnBottom);
  }

  return Number.isFinite(shortestBottom) ? shortestBottom : grid.bottom;
};
(function () {

  const USE_TEST_IMAGES = false;
  const TEST_COUNT = 75;

  const BUBBLE_SEARCH_API = "https://plp-62309.bubbleapps.io/api/1.1/wf/find-photos";
  const SEARCH_PAGE_LIMIT = 50;
  const SEARCH_REQUEST_TIMEOUT_MS = 15000;
  const INITIAL_VISIBLE_PHOTOS = 12;
  const PHOTO_REVEAL_BATCH_SIZE = 12;
  const UNIT_PRICE = 6000;
  const PACKAGE_THRESHOLD = 5; 
  const PACKAGE_PRICE = 24900; 
  const CART_PAGE_PATH = "/cart";

  const BUBBLE_EVENT_OBJ_API = "https://plp-62309.bubbleapps.io/api/1.1/obj/event/";

  let currentEventMeta = { event_code: null, event_display_name: null };

  let photos = [];
  let photosByKey = new Map();
  let orderKeys = [];
  let modalKeys = [];
  let currentModalKey = null;
  let resetModalZoomState = () => {};
  let currentSearchBib = null; 
  let currentSearchName = null;
  let localSelectedKeys = new Set();
  let lastSelectedTrayCount = 0;
  let lastLocalSelectedTrayCount = 0;
  let hasRenderedSelectedTray = false;
  let packageTraySparkleTimer = null;
  let lockedCartKeys = new Set();
  let mainRenderCount = 0;
  let mainRevealObserver = null;
  let mainRevealSentinel = null;

  const SESSION_SELECTED_KEY_BASE = "shout_gallery_selected_keys";
  function getSessionSelectedKey() {
    const ev = (getQueryParam("event_code") || "").trim();
    const bib = (getQueryParam("q") || "").trim();
    return `${SESSION_SELECTED_KEY_BASE}:${ev || "noevent"}:${bib || "nobib"}`;
  }
  function saveLocalSelectedToSession() {
    try {
      sessionStorage.setItem(
        getSessionSelectedKey(),
        JSON.stringify(Array.from(localSelectedKeys))
      );
    } catch (e) {
      console.warn("[Gallery] saveLocalSelectedToSession failed:", e);
    }
  }
  function loadLocalSelectedFromSession() {
    localSelectedKeys = new Set();

    try {
      const raw = sessionStorage.getItem(getSessionSelectedKey());
      if (!raw) return;

      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        for (const k of arr) {
          if (photosByKey.has(k) && !isLockedByKey(k)) {
            localSelectedKeys.add(k);
          }
        }
      }
    } catch (e) {
      console.warn("[Gallery] loadLocalSelectedFromSession failed:", e);
    }
  }
  function clearLocalSelectedSession() {
    try {
      sessionStorage.removeItem(getSessionSelectedKey());
    } catch (e) {
      console.warn("[Gallery] sessionStorage.removeItem failed:", e);
    }
  }

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

  async function fetchEventMeta(eventCode) {
    if (!eventCode) return null;
    try {
      const constraints = encodeURIComponent(JSON.stringify([
        { key: "event_code", constraint_type: "equals", value: String(eventCode) }
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
        event_code: code ? String(code) : (eventCode ? String(eventCode) : null),
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
    
  function extractFileNameFromUrl(url) {
    try {
      if (!url) return "";
      const u = String(url);
      const cleaned = u.replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
      const noQuery = cleaned.split("?")[0];
      const last = noQuery.split("/").pop() || "";
      return decodeURIComponent(last);
    } catch (_) {
      return "";
    }
  }

  function getPhotoFileName(photo) {
    if (!photo) return "";

    const direct = (
      photo.fileName ||
      photo.filename ||
      photo.file_name ||
      photo.photo_name ||
      photo.photoName ||
      ""
    ).toString().trim();

    if (direct) return direct;

    return extractFileNameFromUrl(photo.preview_url || photo.previewUrl || photo.preview || "");
  }

  function getMpFileRank(photo) {
    const filename = getPhotoFileName(photo);
    if (!filename) return 1;

    const base = filename.split("?")[0].split("/").pop() || "";
    let upper = "";

    try {
      upper = decodeURIComponent(base).toUpperCase();
    } catch (_) {
      upper = String(base).toUpperCase();
    }

    if (/^[A-Z]M[_-]/.test(upper)) return 0;
    if (/^[A-Z]P[_-]/.test(upper)) return 2;

    return 1;
  }

  function getDedupeKey(p) {
    if (!p) return "";
    const file = (p.fileName || p.filename || p.file_name || "").toString().trim();
    if (file) return file.toLowerCase();
    const fromPreview = extractFileNameFromUrl(p.preview_url || p.previewUrl || p.preview);
    if (fromPreview) return fromPreview.toLowerCase();
    const k = getPhotoKey(p);
    return (k || "").toString().toLowerCase();
  }

  function scoreForDedupe(p) {
    let s = 0;
    const map = getParsedBboxMap(p);

    if (map) s += 5;

    if (map && currentSearchBib && map[currentSearchBib]) {
      s += 20;
    }

    if (p && (p.bbox || p.bib_bbox)) s += 1;

    return s;
  }

  function dedupePhotoList(list) {
    const bestByKey = new Map();
    const order = [];

    (list || []).forEach((p) => {
      const k = getDedupeKey(p);
      if (!k) {
        order.push(p);
      }

      const prev = bestByKey.get(k);
      if (!prev) {
        bestByKey.set(k, p);
        order.push(p);
        return;
      }

      const a = scoreForDedupe(prev);
      const b = scoreForDedupe(p);
      if (b > a) {
        bestByKey.set(k, p);
        const idx = order.indexOf(prev);
        if (idx >= 0) order[idx] = p;
      }
    });

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

  function splitOcrValues(raw) {
    if (!raw) return [];

    return String(raw)
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  function getOcrBibValues(photo) {
    return splitOcrValues(photo && photo.ocr_bib);
  }

  function getOcrNameValues(photo) {
    return splitOcrValues(photo && photo.ocr_name);
  }

  function getOcrMatchRank(values, query) {
    const target = query ? String(query).trim() : "";
    if (!target) return 2;

    const list = Array.isArray(values) ? values : [];
    if (list.some((v) => v === target)) return 0;
    if (list.some((v) => v.includes(target))) return 1;
    return 2;
  }

  function getBboxKeyMatchRank(photo, query) {
    const target = query ? String(query).trim() : "";
    if (!target || !photo) return 2;

    const map = getParsedBboxMap(photo);
    if (!map || typeof map !== "object") return 2;

    const keys = Object.keys(map);
    if (keys.some((key) => key === target)) return 0;
    if (keys.some((key) => key.includes(target))) return 1;
    return 2;
  }

  function sortPhotosByOcrSearchMatch(list, query, searchType) {
    const target = query ? String(query).trim() : "";
    if (!target || !Array.isArray(list) || list.length <= 1) return list || [];

    const isBibSearch = searchType === "bib";

    return list
      .map((photo, originalIndex) => {
        const values = isBibSearch ? getOcrBibValues(photo) : getOcrNameValues(photo);
        const matchRank = getOcrMatchRank(values, target);

        return {
          photo,
          originalIndex,
          matchRank,
          mpRank: getMpFileRank(photo)
        };
      })
      .sort((a, b) => {
        if (a.matchRank !== b.matchRank) return a.matchRank - b.matchRank;
        if (a.matchRank < 2 && b.matchRank < 2 && a.mpRank !== b.mpRank) {
          return a.mpRank - b.mpRank;
        }

        return a.originalIndex - b.originalIndex;
      })
      .map((item) => item.photo);
  }

  function safeJsonParse(value) {
    if (!value) return null;
    if (typeof value === "object") return value;
    if (typeof value !== "string") return null;
    try { return JSON.parse(value); } catch { return null; }
  }

  function getParsedBboxMap(photo) {
    if (!photo) return null;
    if (photo.parsed_bbox_map && typeof photo.parsed_bbox_map === "object") {
      return photo.parsed_bbox_map;
    }

    const mapStr = photo.bbox_map || photo.bib_bbox_map_json;
    const parsed = safeJsonParse(mapStr);
    if (parsed && typeof parsed === "object") {
      photo.parsed_bbox_map = parsed;
      return parsed;
    }

    return null;
  }

  function getBibFocusFromPhoto(photo, bibStr) {
    if (!photo || !bibStr) return null;

    const rawFocusX = photo.focus_x;
    const rawFocusY = photo.focus_y;
    const directX = Number(rawFocusX);
    const directY = Number(rawFocusY);
    if (
      rawFocusX != null && String(rawFocusX).trim() !== "" &&
      rawFocusY != null && String(rawFocusY).trim() !== "" &&
      Number.isFinite(directX) && Number.isFinite(directY)
    ) {
      return {
        x: Math.max(0, Math.min(100, directX)),
        y: Math.max(0, Math.min(100, directY))
      };
    }

    const map = getParsedBboxMap(photo);
    if (!map) return null;

    const bibKey = String(bibStr).trim();
    const boxes = map[bibKey];
    if (!Array.isArray(boxes) || boxes.length === 0) return null;

    let best = boxes[0];
    for (const b of boxes) {
      if ((b?.conf ?? 0) > (best?.conf ?? 0)) best = b;
    }

    const x = Number(best?.x);
    const y = Number(best?.y);
    const w = Number(best?.w);
    const h = Number(best?.h);
    if ([x, y, w, h].some(n => Number.isNaN(n))) return null;

    const cx = x + (w / 2);
    const cy = y + (h / 2);

    const px = Math.max(0, Math.min(100, cx * 100));
    const py = Math.max(0, Math.min(100, cy * 100));

    return { x: px, y: py };
  }

  function isNumericSearch(value) {
    return /^[0-9]+$/.test(String(value || "").trim());
  }

  function toPositivePrice(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : UNIT_PRICE;
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

  
  function isSelectedByKey(key){
    if (!key) return false;
    return localSelectedKeys.has(key);
  }

  function isLockedByKey(key){
    if (!key) return false;
    return lockedCartKeys.has(key);
  }

  
  function recomputeModalKeys() {
    try {
      modalKeys = (orderKeys || []).filter(k => !isLockedByKey(k));
    } catch (e) {
      modalKeys = (orderKeys || []).slice();
    }
  }
function toggleSelectByKey(key) {
    const photo = photosByKey.get(key);
    if (!photo) return;

    if (isLockedByKey(key)) {
      syncUI(key);
      return;
    }

    if (localSelectedKeys.has(key)) {
      localSelectedKeys.delete(key);
    } else {
      localSelectedKeys.add(key);
    }

    saveLocalSelectedToSession();
    syncUI(key);
  }

  function syncUI(key) {
    const card = document.querySelector(`.gallery-card[data-photo-key="${cssEscape(key)}"]`);
    if (card) {
      if (isLockedByKey(key)) {
        card.classList.add("is-in-cart");
        card.classList.remove("is-selected");
      } else {
        card.classList.remove("is-in-cart");
        if (isSelectedByKey(key)) card.classList.add("is-selected");
        else card.classList.remove("is-selected");
      }
    }
    if (currentModalKey === key) syncModalCheckUI(key);
    syncSelectedTrayUI();
  }


function createCardEl(photo, sizeClass) {
    const key = getPhotoKey(photo);

    const card = document.createElement("div");
    card.className = `gallery-card ${sizeClass}`;
    card.setAttribute("data-photo-key", key);

    const imgUrl = toHttps(photo.preview_url) || "https://via.placeholder.com/600?text=No+Preview";

    const media = document.createElement("div");
    media.className = "gallery-media";
    media.style.backgroundImage = `url("${imgUrl}")`;
    const focus = getBibFocusFromPhoto(photo, currentSearchBib);
    if (focus) {
      media.style.backgroundPosition = `${focus.x}% ${focus.y}%`;
    }


    media.addEventListener("contextmenu", (e) => e.preventDefault());

    media.setAttribute("draggable", "false");



    if (isLockedByKey(key)) {
      card.classList.add("is-in-cart");

      card.append(media, window.ShoutGallery.buildCartLockIconEl());


      return card;
    }

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

  function appendMainGridCards(gridEl, mainPhotos, startIndex, endIndex) {
    const frag = document.createDocumentFragment();

    mainPhotos.slice(startIndex, endIndex).forEach((p, offset) => {
      const i = startIndex + offset;
      const sizeClass = mainSizePlan[i] || "size-normal";
      const card = createCardEl(p, sizeClass);
      frag.appendChild(card);
    });

    gridEl.appendChild(frag);
  }

  function renderMainGrid(gridEl, mainPhotos, visibleCount) {
    gridEl.innerHTML = "";
    mainRenderCount = Math.min(visibleCount, mainPhotos.length);
    appendMainGridCards(gridEl, mainPhotos, 0, mainRenderCount);
  }

  function fillMainGridBelowViewport(g, p) {
    if (!g || mainRenderCount >= p.length) return;
    const h = Math.max(innerHeight * .34, 240);
    const row = parseFloat(getComputedStyle(g).getPropertyValue("--cell")) || 120;
    if (window.ShoutGallery.getGalleryGridCoveredBottom(g) >= innerHeight + h + Math.max(row, 120)) return;
    const n = Math.min(mainRenderCount + PHOTO_REVEAL_BATCH_SIZE, p.length);
    appendMainGridCards(g, p, mainRenderCount, n);
    mainRenderCount = n;
    syncCellSizeSoon();
    requestAnimationFrame(() => fillMainGridBelowViewport(g, p));
  }

  function clearMainRevealObserver() {
    if (mainRevealObserver) {
      mainRevealObserver.disconnect();
      mainRevealObserver = null;
    }
    if (mainRevealSentinel) {
      mainRevealSentinel.remove();
      mainRevealSentinel = null;
    }
  }

  function setupMainRevealObserver(gridEl, mainPhotos) {
    clearMainRevealObserver();
    if (mainRenderCount >= mainPhotos.length) return;

    mainRevealSentinel = document.createElement("div");
    mainRevealSentinel.className = "gallery-load-sentinel";
    mainRevealSentinel.setAttribute("aria-hidden", "true");
    mainRevealSentinel.style.height = "1px";
    mainRevealSentinel.style.width = "100%";
    gridEl.insertAdjacentElement("afterend", mainRevealSentinel);

    const revealMore = () => {
      const nextCount = Math.min(mainRenderCount + PHOTO_REVEAL_BATCH_SIZE, mainPhotos.length);
      appendMainGridCards(gridEl, mainPhotos, mainRenderCount, nextCount);
      mainRenderCount = nextCount;
      syncCellSizeSoon();

      if (mainRenderCount >= mainPhotos.length) clearMainRevealObserver();
    };

    if (!window.IntersectionObserver) {
      revealMore();
      return;
    }

    mainRevealObserver = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) revealMore();
    }, { rootMargin: "0px 0px 40% 0px" });
    mainRevealObserver.observe(mainRevealSentinel);
  }

  
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

    const idx = modalKeys.indexOf(key);
    if (idx === -1) return;

    const prevKey = modalKeys[(idx <= 0) ? (modalKeys.length - 1) : (idx - 1)];
    const nextKey = modalKeys[(idx >= modalKeys.length - 1) ? 0 : (idx + 1)];

    const curPhoto  = photosByKey.get(key);
    const prevPhoto = photosByKey.get(prevKey);
    const nextPhoto = photosByKey.get(nextKey);

    if (curEl && curPhoto)  curEl.style.backgroundImage  = `url("${toHttps(curPhoto.preview_url)}")`;
    if (prevEl && prevPhoto) prevEl.style.backgroundImage = `url("${toHttps(prevPhoto.preview_url)}")`;
    if (nextEl && nextPhoto) nextEl.style.backgroundImage = `url("${toHttps(nextPhoto.preview_url)}")`;
  }

  function snapTrackToCenterIdle() {
    const track = document.getElementById("shoutModalTrack");
    if (!track) return;
    track.style.transition = "none";
    track.style.transform = "translateX(-100%)";
  }

  function ensureModalUI() {
    if (document.getElementById("shoutModalOverlay")) return;

    const html = `
      <style id="shoutModalRuntimeOverrides">
        @media (max-width: 767px) {
          #shoutModalTopbar { height: 40px !important; padding: 0 12px !important; align-items: flex-start !important; border-bottom: 0 !important; }
          #shoutModalCounter { align-self: center !important; }
          #shoutModalTopbar .shoutModalBtn { height: 32px !important; padding: 0 11px !important; font-size: 13px !important; }
          #shoutModalOverlay.has-selected-tray { padding-bottom: 0 !important; background: #000 !important; }
          #shoutModalOverlay.has-selected-tray #shoutModalContainer { height: 100dvh !important; max-height: 100dvh !important; }
          #shoutModalOverlay.has-selected-tray #shoutModalImageWrap { flex: 0 0 auto !important; height: calc(100dvh - 40px - var(--shout-selected-tray-height, 0px)) !important; }
          .shoutModalNavBtn { top: calc(40px + (100dvh - 40px - var(--shout-selected-tray-height, 0px)) / 2) !important; }
          #shoutSelectedTray { background: transparent !important; }
          #shoutPackageCard { padding-top: 12px !important; }
        }
      </style>
      <div id="shoutModalOverlay">
        <div id="shoutModalContainer">
          <div id="shoutModalTopbar">
            <button id="shoutModalCloseBtn" class="shoutModalBtn">닫기</button>
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
        <div id="shoutPackageCard">
          <div class="shout-package-badge">✦&nbsp; ALL-IN PACKAGE</div>
          <div class="shout-package-price-row">
            <div id="shoutSelectedInfo" class="shout-package-price">0장 0원</div>
            <div id="shoutPackageOriginal" class="shout-package-original" hidden></div>
          </div>
          <div class="shout-package-progress-row">
            <div class="shout-package-progress-track"><div id="shoutPackageProgressFill" class="shout-package-progress-fill"></div></div>
            <div id="shoutPackageCount" class="shout-package-count">0 <span>/ 5</span></div>
          </div>
          <div class="shout-package-bottom-row">
            <div class="shout-package-benefit">
              <div class="shout-package-star">✦</div>
              <div class="shout-package-benefit-copy">
                <strong id="shoutPackageBenefitTitle">사진을 선택해 주세요</strong>
                <span id="shoutPackageBenefitSub">5장 이상이면 전부 24,900원이 적용됩니다</span>
              </div>
            </div>
            <button id="shoutGoCartBtn">장바구니</button>
          </div>
        </div>
        <div id="shoutSelectedList" aria-hidden="true"></div>
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

      el.style.boxSizing = "border-box";
      el.style.padding = "clamp(6px, 1vw, 10px) clamp(10px, 2.2vw, 16px)";
      el.style.backgroundClip = "content-box";
      el.style.backgroundOrigin = "content-box";

      el.style.userSelect = "none";
      el.style.webkitUserDrag = "none";
      el.style.touchAction = "none";
      el.style.overscrollBehavior = "contain";
    });

    const wrap  = document.getElementById("shoutModalImageWrap");
    const track = document.getElementById("shoutModalTrack");
    if (wrap && track) {
      wrap.style.overflow = "hidden";
      wrap.style.background = "#000";
      wrap.style.boxSizing = "border-box";
      wrap.style.padding = "14px 0px 10px 0px";
      wrap.style.touchAction = "none";
      wrap.style.overscrollBehavior = "contain";

      track.style.display = "flex";
      track.style.width = "300%";
      track.style.height = "100%";
      track.style.willChange = "transform";
      track.style.transition = "none";
      track.style.transform = "translateX(-100%)"; 

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
      const currentPanel = document.getElementById("shoutModalCurrent");
      if (!wrap || !track || !currentPanel) return;

      let startX = 0;
      let startY = 0;
      let dx = 0;
      let dy = 0;
      let dragging = false;
      let animating = false;
      let axisLocked = null;
      let pinching = false;
      let panning = false;
      let zoomScale = 1;
      let zoomX = 0;
      let zoomY = 0;
      let pinchStartDistance = 0;
      let pinchStartScale = 1;
      let pinchStartX = 0;
      let pinchStartY = 0;
      let pinchStartPanX = 0;
      let pinchStartPanY = 0;
      let panTouchStartX = 0;
      let panTouchStartY = 0;
      let panStartX = 0;
      let panStartY = 0;

      const THRESHOLD_RATIO = 0.18;
      const TAP_SLOP = 8;
      const MAX_Y = 90;
      const ANIM_MS = 220;
      const MIN_SCALE = 1;
      const MAX_SCALE = 4;

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

      function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
      }
      function getTouchDistance(touches) {
        const x = touches[1].clientX - touches[0].clientX;
        const y = touches[1].clientY - touches[0].clientY;
        return Math.hypot(x, y);
      }
      function getTouchCenter(touches) {
        const rect = wrap.getBoundingClientRect();
        return {
          x: ((touches[0].clientX + touches[1].clientX) / 2) - rect.left - (rect.width / 2),
          y: ((touches[0].clientY + touches[1].clientY) / 2) - rect.top - (rect.height / 2)
        };
      }
      function clampZoomPan() {
        const maxX = Math.max(0, (wrap.clientWidth * (zoomScale - 1)) / 2);
        const maxY = Math.max(0, (wrap.clientHeight * (zoomScale - 1)) / 2);
        zoomX = clamp(zoomX, -maxX, maxX);
        zoomY = clamp(zoomY, -maxY, maxY);
      }
      function applyZoom(withAnim) {
        clampZoomPan();
        currentPanel.style.transition = withAnim ? "transform 180ms ease-out" : "none";
        currentPanel.style.transformOrigin = "center center";
        currentPanel.style.transform = `translate3d(${zoomX}px, ${zoomY}px, 0) scale(${zoomScale})`;
        currentPanel.style.zIndex = zoomScale > 1 ? "2" : "";
        currentPanel.style.willChange = zoomScale > 1 ? "transform" : "";
      }
      resetModalZoomState = (withAnim = false) => {
        zoomScale = 1;
        zoomX = 0;
        zoomY = 0;
        pinching = false;
        panning = false;
        dragging = false;
        axisLocked = null;
        applyZoom(withAnim);
      };
      function beginPinch(touches) {
        if (!touches || touches.length < 2) return;
        pinching = true;
        panning = false;
        dragging = false;
        axisLocked = null;
        pinchStartDistance = Math.max(1, getTouchDistance(touches));
        pinchStartScale = zoomScale;
        const center = getTouchCenter(touches);
        pinchStartX = center.x;
        pinchStartY = center.y;
        pinchStartPanX = zoomX;
        pinchStartPanY = zoomY;
        snapTrackToCenterIdle();
        suppressNextClick(550);
      }

      wrap.addEventListener("touchstart", (ev) => {
        if (!isModalOpen()) return;
        if (animating) return;

        if (ev.touches && ev.touches.length >= 2) {
          ev.preventDefault();
          beginPinch(ev.touches);
          return;
        }

        const t = ev.touches && ev.touches[0];
        if (!t) return;

        if (zoomScale > 1) {
          ev.preventDefault();
          panning = true;
          dragging = false;
          panTouchStartX = t.clientX;
          panTouchStartY = t.clientY;
          panStartX = zoomX;
          panStartY = zoomY;
          suppressNextClick(450);
          return;
        }

        if (currentModalKey) preloadPanelsForKey(currentModalKey);
        snapTrackToCenterIdle(); 

        startX = t.clientX;
        startY = t.clientY;
        dx = 0;
        dy = 0;
        axisLocked = null;
        dragging = true;

        const w = getViewportW();
        setTrackPx(-w, false);
      }, { passive: false });

      wrap.addEventListener("touchmove", (ev) => {
        if (!isModalOpen()) return;

        if (ev.touches && ev.touches.length >= 2) {
          ev.preventDefault();
          if (!pinching) beginPinch(ev.touches);
          const distance = Math.max(1, getTouchDistance(ev.touches));
          const center = getTouchCenter(ev.touches);
          const nextScale = clamp(pinchStartScale * (distance / pinchStartDistance), MIN_SCALE, MAX_SCALE);
          const ratio = nextScale / Math.max(MIN_SCALE, pinchStartScale);
          zoomScale = nextScale;
          zoomX = center.x - ((pinchStartX - pinchStartPanX) * ratio);
          zoomY = center.y - ((pinchStartY - pinchStartPanY) * ratio);
          applyZoom(false);
          return;
        }

        const t = ev.touches && ev.touches[0];
        if (!t) return;

        if (pinching) {
          ev.preventDefault();
          return;
        }

        if (panning || zoomScale > 1) {
          ev.preventDefault();
          if (!panning) {
            panning = true;
            panTouchStartX = t.clientX;
            panTouchStartY = t.clientY;
            panStartX = zoomX;
            panStartY = zoomY;
          }
          zoomX = panStartX + (t.clientX - panTouchStartX);
          zoomY = panStartY + (t.clientY - panTouchStartY);
          applyZoom(false);
          return;
        }

        if (!dragging) return;

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

      wrap.addEventListener("touchend", (ev) => {
        if (pinching) {
          suppressNextClick(550);
          if (ev.touches && ev.touches.length === 1 && zoomScale > 1) {
            pinching = false;
            panning = true;
            const t = ev.touches[0];
            panTouchStartX = t.clientX;
            panTouchStartY = t.clientY;
            panStartX = zoomX;
            panStartY = zoomY;
            return;
          }
          pinching = false;
          panning = false;
          if (zoomScale <= 1.02) resetModalZoomState(true);
          else applyZoom(true);
          return;
        }

        if (panning || zoomScale > 1) {
          panning = false;
          suppressNextClick(450);
          applyZoom(true);
          return;
        }

        if (!dragging) return;
        dragging = false;
        if (!isModalOpen()) return;

        const w = getViewportW();
        const threshold = w * THRESHOLD_RATIO;

        if (Math.abs(dx) <= TAP_SLOP && Math.abs(dy) <= TAP_SLOP) {
          suppressNextClick(450); 

          if (currentModalKey) toggleSelectByKey(currentModalKey);

          animating = true;
          setTrackPx(-w, true);
          setTimeout(() => {
            animating = false;
            snapTrackToCenterIdle(); 
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

      wrap.addEventListener("touchcancel", () => {
        dragging = false;
        pinching = false;
        panning = false;
        axisLocked = null;
        snapTrackToCenterIdle();
      }, { passive: true });

      ["gesturestart", "gesturechange", "gestureend"].forEach((eventName) => {
        wrap.addEventListener(eventName, (ev) => {
          if (isModalOpen()) ev.preventDefault();
        }, { passive: false });
      });

    })();

    document.addEventListener("keydown", onModalKeyDown, true);
  }

  function openModalByKey(key) {
    const photo = photosByKey.get(key);
    if (!photo) return;

    if (isLockedByKey(key)) return;

    resetModalZoomState(false);
    currentModalKey = key;

    const overlay = document.getElementById("shoutModalOverlay");
    const counter = document.getElementById("shoutModalCounter");

    const idx = modalKeys.indexOf(key);
    if (counter) counter.textContent = `${idx + 1} / ${modalKeys.length}`;

    lockBodyScroll();
    if (overlay) overlay.classList.add("is-open");

    requestAnimationFrame(() => {
      snapTrackToCenterIdle();
      preloadPanelsForKey(key);
      syncModalCheckUI(key);
      syncModalSelectedTraySpace();
    });
  }

  function closeModal() {
    resetModalZoomState(false);
    const overlay = document.getElementById("shoutModalOverlay");
    if (overlay) {
      overlay.classList.remove("is-open", "has-selected-tray");
      overlay.style.removeProperty("--shout-selected-tray-height");
    }
    unlockBodyScroll();
    currentModalKey = null;
  }

  function syncModalCheckUI(key) {
    const btn = document.getElementById("shoutModalCheckBtn");
    const media = document.getElementById("shoutModalCurrent");
    const wrap = document.getElementById("shoutModalImageWrap");

    if (isLockedByKey(key)) {
      if (btn) btn.classList.remove("is-selected");
      if (media) {
        media.classList.remove("is-selected");
        media.style.outline = "none";
        media.style.outlineOffset = "";
      }
      if (wrap) {
        wrap.classList.remove("is-selected");
        wrap.style.boxShadow = "none";
      }
      return;
    }

    if (isSelectedByKey(key)) {
      if (btn) btn.classList.add("is-selected");
      if (media) {
        media.classList.remove("is-selected");
        media.style.outline = "none";
        media.style.outlineOffset = "";
      }
      if (wrap) {
        wrap.classList.add("is-selected");
        wrap.style.boxShadow = "inset 0 0 0 3px #2F80FF";
      }
    } else {
      if (btn) btn.classList.remove("is-selected");
      if (media) {
        media.classList.remove("is-selected");
        media.style.outline = "none";
        media.style.outlineOffset = "";
      }
      if (wrap) {
        wrap.classList.remove("is-selected");
        wrap.style.boxShadow = "none";
      }
    }
  }

  function goPrevInModal() {
    if (!currentModalKey) return;
    const idx = modalKeys.indexOf(currentModalKey);
    if (idx === -1) return;

    const nextIdx = (idx <= 0) ? (modalKeys.length - 1) : (idx - 1);
    openModalByKey(modalKeys[nextIdx]);
  }

  function goNextInModal() {
    if (!currentModalKey) return;
    const idx = modalKeys.indexOf(currentModalKey);
    if (idx === -1) return;

    const nextIdx = (idx >= modalKeys.length - 1) ? 0 : (idx + 1);
    openModalByKey(modalKeys[nextIdx]);
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

  function getCurrentPackageMatchedKeys(includeLocal = true) {
    const eventCode = String(currentEventMeta.event_code || "").trim();
    const searchType = currentSearchBib ? "bib" : (currentSearchName ? "name" : "");
    const searchValue = String(currentSearchBib || currentSearchName || "").trim();
    const matchedKeys = new Set();

    if (eventCode && searchType && searchValue) {
      try {
        if (window.ShoutCart && typeof window.ShoutCart.getItems === "function") {
          const cartItems = window.ShoutCart.getItems() || [];
          cartItems.forEach((it) => {
            const itemEventCode = String((it && it.event_code) || "").trim();
            const explicitType = String((it && (it.identifier_type || it.search_type)) || "").trim();
            const itemType = explicitType || (it && it.bib ? "bib" : (it && it.ocr_name ? "name" : ""));
            const itemValue = String((it && (
              it.identifier_value ||
              it.search_value ||
              it.bib ||
              it.ocr_name ||
              it.searched_query
            )) || "").trim();

            if (itemEventCode !== eventCode || itemType !== searchType || itemValue !== searchValue) return;

            const key = getPhotoKey(it);
            if (key) matchedKeys.add(key);
          });
        }
      } catch (e) {
        console.warn("[Gallery] package cart read failed:", e);
      }
    }

    if (includeLocal) {
      Array.from(localSelectedKeys).forEach((key) => {
        if (!isLockedByKey(key)) matchedKeys.add(key);
      });
    }

    return matchedKeys;
  }

  function syncModalSelectedTraySpace() {
    const overlay = document.getElementById("shoutModalOverlay");
    const tray = document.getElementById("shoutSelectedTray");
    if (!overlay || !tray) return;

    const shouldReserve =
      Boolean(currentModalKey) &&
      getCurrentPackageMatchedKeys().size > 0 &&
      tray.classList.contains("is-open");

    if (!shouldReserve) {
      overlay.classList.remove("has-selected-tray");
      overlay.style.removeProperty("--shout-selected-tray-height");
      return;
    }

    const trayHeight = Math.ceil(tray.getBoundingClientRect().height);
    overlay.style.setProperty("--shout-selected-tray-height", `${trayHeight}px`);
    overlay.classList.add("has-selected-tray");
  }

  function triggerPackageTraySparkle(card) {
    if (!card) return;
    if (packageTraySparkleTimer) window.clearTimeout(packageTraySparkleTimer);

    card.classList.remove("is-sparkling");
    void card.offsetWidth;
    card.classList.add("is-sparkling");

    packageTraySparkleTimer = window.setTimeout(() => {
      card.classList.remove("is-sparkling");
      packageTraySparkleTimer = null;
    }, 980);
  }

  function updateSelectedTray() {
    const tray = document.getElementById("shoutSelectedTray");
    const info = document.getElementById("shoutSelectedInfo");
    const list = document.getElementById("shoutSelectedList");
    const original = document.getElementById("shoutPackageOriginal");
    const progress = document.getElementById("shoutPackageProgressFill");
    const countEl = document.getElementById("shoutPackageCount");
    const benefitTitle = document.getElementById("shoutPackageBenefitTitle");
    const benefitSub = document.getElementById("shoutPackageBenefitSub");
    const packageCard = document.getElementById("shoutPackageCard");

    if (!tray || !info || !list || !original || !progress || !countEl || !benefitTitle || !benefitSub || !packageCard) return;

    const selected = Array.from(localSelectedKeys)
      .map((k) => photosByKey.get(k))
      .filter(Boolean);
    const packageMatchedKeys = getCurrentPackageMatchedKeys();
    const count = packageMatchedKeys.size;

    if (count === 0) {
      tray.classList.remove("is-open");
      list.innerHTML = "";
      info.textContent = "0장 0원";
      original.textContent = "";
      original.hidden = true;
      progress.style.width = "0%";
      countEl.innerHTML = `0 <span>/ ${PACKAGE_THRESHOLD}</span>`;
      benefitTitle.textContent = "사진을 선택해 주세요";
      benefitSub.textContent = `${PACKAGE_THRESHOLD}장 이상이면 전부 ${PACKAGE_PRICE.toLocaleString()}원이 적용됩니다`;
      packageCard.classList.remove("is-sparkling");
      lastSelectedTrayCount = 0;
      lastLocalSelectedTrayCount = 0;
      hasRenderedSelectedTray = true;
      syncModalSelectedTraySpace();
      return;
    }

    tray.classList.add("is-open");

    const regularPrice = count * UNIT_PRICE;
    const hasPackage = count >= PACKAGE_THRESHOLD;
    const totalPrice =
      hasPackage ? PACKAGE_PRICE : regularPrice;

    info.textContent = `${count}장 ${totalPrice.toLocaleString()}원`;
    original.textContent = hasPackage ? `${regularPrice.toLocaleString()}원` : "";
    original.hidden = !hasPackage;
    progress.style.width = `${Math.min(100, (count / PACKAGE_THRESHOLD) * 100)}%`;
    countEl.innerHTML = `${count} <span>/ ${PACKAGE_THRESHOLD}</span>`;

    if (hasPackage) {
      benefitTitle.textContent = "패키지 혜택이 적용됐어요";
      benefitSub.textContent = count === PACKAGE_THRESHOLD
        ? "이제 내 사진을 모두 담아 보세요"
        : `${regularPrice.toLocaleString()}원 대신 전부 ${PACKAGE_PRICE.toLocaleString()}원`;
    } else if (count === 4) {
      benefitTitle.textContent = "마지막 1장, 샤라웃이 900원에 쏠게요";
      benefitSub.textContent = "한 장만 더 담고 모든 사진을 간직하세요";
    } else if (count === 3) {
      benefitTitle.textContent = "2장 더 고르면 5,100원 할인";
      benefitSub.textContent = "결국 남는 건 사진뿐이다 — 어른들 말씀";
    } else if (count === 2) {
      benefitTitle.textContent = "추가 3장은 12,900원에 드려요";
      benefitSub.textContent = "50장을 담아도 전부 24,900원";
    } else {
      benefitTitle.textContent = "5장 이상은 24,900원 일괄 적용";
      benefitSub.textContent = "오늘의 추억을 빠짐없이 간직해 보세요";
    }

    const justReachedPackage =
      hasRenderedSelectedTray &&
      lastSelectedTrayCount < PACKAGE_THRESHOLD &&
      count >= PACKAGE_THRESHOLD &&
      selected.length > lastLocalSelectedTrayCount;
    lastSelectedTrayCount = count;
    lastLocalSelectedTrayCount = selected.length;
    hasRenderedSelectedTray = true;
    if (justReachedPackage) triggerPackageTraySparkle(packageCard);

    list.innerHTML = "";
    selected.forEach((item) => {
      const wrap = document.createElement("div");
      wrap.className = "shoutMiniThumb";
      wrap.innerHTML = `<img src="${toHttps(item.preview_url)}">`;
      list.appendChild(wrap);
    });

    requestAnimationFrame(syncModalSelectedTraySpace);
  }

  function updatePackageUI() {
    const fillEl = document.querySelector(".package-gauge-fill");
    const countWrapEl = document.querySelector(".package-gauge-count");
    const countTextEl = document.querySelector(".package-count-text");
    const lottieEl = document.querySelector(".success-badge-lottie");

    if (!fillEl || !countWrapEl || !countTextEl || !lottieEl) return;

    const eventCode = String(currentEventMeta.event_code || "").trim();
    const searchValue = String(currentSearchBib || currentSearchName || "").trim();

    if (!eventCode || !searchValue) {
      fillEl.style.width = "0%";
      countTextEl.textContent = "0/5";
      countWrapEl.style.display = "";
      lottieEl.style.display = "none";
      return;
    }

    const matchedKeys = getCurrentPackageMatchedKeys();
    const matchedCount = matchedKeys.size;
    const cappedCount = Math.min(matchedCount, 5);

    fillEl.style.width = `${cappedCount * 20}%`;

    if (matchedCount < 5) {
      countTextEl.textContent = `${matchedCount}/5`;
      countWrapEl.style.display = "";
      lottieEl.style.display = "none";
    } else {
      countWrapEl.style.display = "none";
      lottieEl.style.display = "";
    }
  }

  function syncSelectedTrayUI() {
    updateSelectedTray();
    updatePackageUI();
  }

  async function commitLocalSelectionToCart() {
    if (!window.ShoutCart || typeof window.ShoutCart.add !== "function") return 0;

    const searchType = currentSearchBib ? "bib" : (currentSearchName ? "name" : "");
    const searchValueForCart = currentSearchBib || currentSearchName || "";
    const eventCode = String(currentEventMeta.event_code || "");
    const itemsToAdd = [];

    for (const key of Array.from(localSelectedKeys)) {
      const p = photosByKey.get(key);
      if (!p) continue;

      if (isLockedByKey(key)) continue;
      if (window.ShoutCart.has && window.ShoutCart.has(getPhotoKey(p))) continue;

      itemsToAdd.push({
        _id: getPhotoKey(p),
        fileName: p.fileName,
        preview_url: p.preview_url,
        price: UNIT_PRICE,
        bib: currentSearchBib || "",
        searched_query: searchValueForCart,
        search_type: searchType,
        search_value: searchValueForCart,
        identifier_type: searchType,
        identifier_value: searchValueForCart,
        ocr_name: currentSearchName || p.ocr_name || "",
        event_code: eventCode,
        event_display_name: currentEventMeta.event_display_name
      });
    }

    if (itemsToAdd.length > 0) {
      window.ShoutCart.add(itemsToAdd);

      if (window.ShoutCart.logAddedToSot) {
        await window.ShoutCart.logAddedToSot(itemsToAdd);
      }
    }

    const added = itemsToAdd.length;

    localSelectedKeys.clear();
    clearLocalSelectedSession();
    updateSelectedTray();
    updatePackageUI();

    try { if (window.ShoutCart.refresh) window.ShoutCart.refresh(); } catch(e) {}

    return added;
  }

  async function goToCartPage() {
    await commitLocalSelectionToCart();

    const hasAnyInCart = !!(window.ShoutCart && typeof window.ShoutCart.count === "function" && window.ShoutCart.count() > 0);
    if (!hasAnyInCart) {
      return alert("사진을 선택해주세요.");
    }

    let cartUrl = CART_PAGE_PATH;
    if (window.ShoutTracking && typeof window.ShoutTracking.appendTrackingParamsToUrl === "function") {
      try {
        cartUrl = window.ShoutTracking.appendTrackingParamsToUrl(
          cartUrl,
          typeof window.ShoutTracking.getTrackingContext === "function"
            ? window.ShoutTracking.getTrackingContext()
            : null
        );
      } catch (e) {
        console.warn("[Gallery] tracking cart URL append failed:", e);
      }
    }
    window.location.href = cartUrl;
  }

  
  function extractPhotoListFromResponse(data) {
    const response = data && data.response ? data.response : data;
    if (!response || typeof response !== "object") return [];

    if (Array.isArray(response.Photo)) return response.Photo;

    const photoId = Array.isArray(response.photo_id) ? response.photo_id : [];
    const previewUrl = Array.isArray(response.preview_url) ? response.preview_url : [];
    const bboxMap = Array.isArray(response.bbox_map) ? response.bbox_map : [];
    const eventCode = Array.isArray(response.event_code) ? response.event_code : [];
    const price = Array.isArray(response.price) ? response.price : [];
    const ocrBib = Array.isArray(response.ocr_bib) ? response.ocr_bib : [];
    const ocrName = Array.isArray(response.ocr_name) ? response.ocr_name : [];
    const focusX = Array.isArray(response.focus_x) ? response.focus_x : [];
    const focusY = Array.isArray(response.focus_y) ? response.focus_y : [];

    if (!photoId.length && !previewUrl.length) return [];

    const count = Math.max(
      photoId.length,
      previewUrl.length,
      bboxMap.length,
      eventCode.length,
      price.length,
      ocrBib.length,
      ocrName.length,
      focusX.length,
      focusY.length
    );

    const out = [];

    for (let i = 0; i < count; i += 1) {
      const id = photoId[i] == null ? "" : String(photoId[i]).trim();
      const url = previewUrl[i] == null ? "" : String(previewUrl[i]).trim();

      if (!id && !url) continue;

      const rawBboxMap = bboxMap[i] || "";
      const parsedBboxMap = safeJsonParse(rawBboxMap) || {};

      out.push({
        _id: id,
        photo_id: id,
        preview_url: url,
        bbox_map: rawBboxMap,
        bib_bbox_map_json: rawBboxMap,
        parsed_bbox_map: parsedBboxMap,
        ocr_bib: ocrBib[i] || "",
        ocr_name: ocrName[i] || "",
        focus_x: focusX[i],
        focus_y: focusY[i],
        event_code: eventCode[i] || "",
        price: toPositivePrice(price[i])
      });
    }

    return out;
  }

  function extractTotalCountFromResponse(data, fallbackCount) {
    const raw = data && data.response
      ? (data.response.total_count ?? data.response.debug_count ?? data.response.debug_limited_count)
      : null;

    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : fallbackCount;
  }

  function createSearchRequestError(code, message, cause) {
    const error = new Error(message);
    error.code = code;
    error.cause = cause;
    return error;
  }

  function getSearchErrorCopy(error) {
    const code = error && error.code;
    if (code === "timeout") {
      return { title: "사진을 불러오는 데 시간이 걸리고 있어요", detail: "네트워크 상태를 확인한 뒤 다시 시도해 주세요." };
    }
    if (code === "network") {
      return { title: "인터넷 연결을 확인해 주세요", detail: "연결이 복구되면 사진을 다시 불러올 수 있어요." };
    }
    if (code === "rate_limit") {
      return { title: "요청이 잠시 많아요", detail: "잠시 후 다시 시도해 주세요." };
    }
    if (code === "bad_request") {
      return { title: "검색 정보를 확인해 주세요", detail: "대회 코드나 검색어를 다시 확인해 주세요." };
    }
    return { title: "사진을 불러오지 못했어요", detail: "잠시 후 다시 시도해 주세요." };
  }

  function renderGallerySearchError(introEl, mainEl, error) {
    if (introEl) introEl.replaceChildren();
    if (!mainEl) return;

    const copy = getSearchErrorCopy(error);
    const message = document.createElement("div");
    message.className = "gallery-search-error";
    message.style.cssText = "color:white;text-align:center;padding:50px 20px;display:grid;gap:12px;justify-items:center;";

    const title = document.createElement("strong");
    title.textContent = copy.title;
    const detail = document.createElement("span");
    detail.textContent = copy.detail;
    detail.style.color = "rgba(255,255,255,.7)";

    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "다시 시도";
    retry.style.cssText = "border:1px solid rgba(255,255,255,.45);border-radius:999px;background:transparent;color:#fff;padding:9px 14px;font:inherit;cursor:pointer;";
    retry.addEventListener("click", () => window.location.reload());

    message.append(title, detail, retry);
    mainEl.replaceChildren(message);
  }

  async function fetchPhotoPage(eventCode, query, index, limit) {
    const tracking = window.ShoutTracking && typeof window.ShoutTracking.getTrackingContext === "function"
      ? window.ShoutTracking.getTrackingContext()
      : null;
    const sessionId = tracking ? tracking.session_id : (sessionStorage.getItem("sot_session_id") || "");
    const searchValue = String(query || "").trim();

    const payload = {
      event_code: eventCode,
      index,
      limit,
      session_id: sessionId,
      local_user: tracking ? tracking.local_user : "",
      session_key: tracking ? tracking.ses_k : "",
      utm_source: tracking ? tracking.utm_s : "",
      utm_campaign: tracking ? tracking.utm_campaign : ""
    };

    if (searchValue) {
      if (isNumericSearch(searchValue)) {
        payload.ocr_bib = searchValue;
      } else {
        payload.ocr_name = searchValue;
      }
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), SEARCH_REQUEST_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(BUBBLE_SEARCH_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (e) {
      const code = e && e.name === "AbortError" ? "timeout" : "network";
      throw createSearchRequestError(code, "Gallery search request failed", e);
    } finally {
      window.clearTimeout(timeoutId);
    }

    if (!res.ok) {
      const code = res.status === 429
        ? "rate_limit"
        : (res.status >= 400 && res.status < 500 ? "bad_request" : "server");
      throw createSearchRequestError(code, `Gallery search responded with HTTP ${res.status}`);
    }

    let data;
    try {
      data = await res.json();
    } catch (e) {
      throw createSearchRequestError("server", "Gallery search returned invalid JSON", e);
    }
    const list = extractPhotoListFromResponse(data);
    const totalCount = extractTotalCountFromResponse(data, list.length);

    return { list, totalCount, raw: data };
  }

  async function fetchPhotos(eventCode, query) {
    if (!eventCode) return [];

    const limit = SEARCH_PAGE_LIMIT;
    const searchValue = String(query || "").trim();

    try {
      const firstPage = await fetchPhotoPage(eventCode, searchValue, 1, limit);
      const totalPages = Math.max(1, Math.ceil(firstPage.totalCount / limit));

      if (totalPages <= 1) return firstPage.list;

      const pageStartIndexes = [];
      for (let page = 2; page <= totalPages; page++) {
        pageStartIndexes.push(((page - 1) * limit) + 1);
      }

      const restPages = await Promise.all(
        pageStartIndexes.map((startIndex) => fetchPhotoPage(eventCode, searchValue, startIndex, limit))
      );

      return [
        ...firstPage.list,
        ...restPages.flatMap((page) => page.list)
      ];
    } catch (e) {
      console.error("API Error:", e);
      throw e;
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

  function hydrateLocalSelectedFromGlobal() {
    lockedCartKeys = new Set();

    try {
      if (window.ShoutCart && typeof window.ShoutCart.getItems === "function") {
        const items = window.ShoutCart.getItems() || [];
        for (const it of items) {
          const k = getPhotoKey(it);
          if (k) lockedCartKeys.add(k);
        }
      }
    } catch (e) {
      console.warn("[Gallery] hydrateLocalSelectedFromGlobal getItems failed:", e);
    }

    try {
      const raw = localStorage.getItem("shout_cart_data");
      if (raw) {
        const data = JSON.parse(raw);

        const out = [];
        const pushKey = (v) => {
          const s = v == null ? "" : String(v);
          if (s) out.push(s);
        };

        const walk = (node) => {
          if (!node) return;

          if (Array.isArray(node)) {
            for (const x of node) walk(x);
            return;
          }

          if (typeof node === "object") {
            if (node._id) pushKey(node._id);
            if (node.photo_id) pushKey(node.photo_id);
            if (node.photoId) pushKey(node.photoId);
            if (node.id) pushKey(node.id);
            if (node.fileName) pushKey(node.fileName);

            for (const k of Object.keys(node)) {
              walk(node[k]);
            }
          }
        };

        walk(data);
        for (const k of out) lockedCartKeys.add(k);
      }
    } catch (e) {
      console.warn("[Gallery] hydrateLocalSelectedFromGlobal localStorage parse failed:", e);
    }

    let selectionChanged = false;
    for (const key of lockedCartKeys) {
      if (localSelectedKeys.delete(key)) selectionChanged = true;
    }
    if (selectionChanged) saveLocalSelectedToSession();

    recomputeModalKeys();
  }
  
  function hydrateLocalSelectedFromGlobalWithRetry(retryCount = 0) {
    hydrateLocalSelectedFromGlobal();

    const ready =
      window.ShoutCart &&
      typeof window.ShoutCart.getItems === "function";

    if (ready) {
      syncSelectedTrayUI();
      return;
    }
    if (retryCount >= 20) {
      console.warn("[Gallery] ShoutCart not ready after retry limit");
      syncSelectedTrayUI();
      return;
    }

    setTimeout(() => {
      hydrateLocalSelectedFromGlobalWithRetry(retryCount + 1);
    }, 150);
  }

  async function initGallery() {
    hydrateLocalSelectedFromGlobal(); 
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
      const eventCode = getQueryParam("event_code");
      const query = getQueryParam("q");
      const searchValue = String(query || "").trim();

      currentEventMeta.event_code = eventCode || null;

      const meta = await fetchEventMeta(eventCode);
      if (meta) currentEventMeta = meta;

      currentSearchBib = isNumericSearch(searchValue) ? searchValue : null;
      currentSearchName = searchValue && !currentSearchBib ? searchValue : null;
      try {
        list = await fetchPhotos(eventCode, searchValue);
      } catch (e) {
        console.error("[Gallery] photo search failed:", e);
        renderGallerySearchError(introEl, mainEl, e);
        return;
      }
      list = dedupePhotoList(list);
      list = searchValue
        ? sortPhotosByOcrSearchMatch(list, searchValue, currentSearchBib ? "bib" : "name")
        : list;

    }

    photos = list;
    photosByKey.clear();
    orderKeys = [];
    photos.forEach(p => {
      const k = getPhotoKey(p);
      if (k) { photosByKey.set(k, p); orderKeys.push(k); }
    });
    loadLocalSelectedFromSession();
    recomputeModalKeys();

    if (photos.length === 0) {
      if (introEl) introEl.innerHTML = "";
      mainEl.innerHTML = "<div style='color:white; text-align:center; padding:50px;'>사진이 없습니다.</div>";
      updatePackageUI();
      return;
    }

    const introCount = Math.min(getIntroCount(cols), photos.length);
    const introPhotos = photos.slice(0, introCount);
    const mainPhotos = photos.slice(introCount);

    mainSizePlan = buildMainSizePlan(mainPhotos.length, cols);

    renderIntroGridPinned(introEl, introPhotos, cols);
    renderMainGrid(mainEl, mainPhotos, Math.max(0, INITIAL_VISIBLE_PHOTOS - introPhotos.length));
    setupMainRevealObserver(mainEl, mainPhotos);

    applyGridInline(introEl, cols, true);
    applyGridInline(mainEl, cols, false);

    syncCellSizeSoon();
    syncSelectedTrayUI();
    requestAnimationFrame(() => requestAnimationFrame(() => fillMainGridBelowViewport(mainEl, mainPhotos)));

    window.addEventListener("load", () => {
      applyGridInline(introEl, lastCols, true);
      applyGridInline(mainEl, lastCols, false);
      updateCellSize();
      fillMainGridBelowViewport(mainEl, mainPhotos);

      hydrateLocalSelectedFromGlobalWithRetry();
      if (window.ShoutCart && typeof window.ShoutCart.refresh === "function") {
        window.ShoutCart.refresh();
      }
      for (const k of lockedCartKeys) {
        syncUI(k);
      }
      updatePackageUI();
    }, { once: true });

    window.addEventListener("shout_cart_changed", () => {
      hydrateLocalSelectedFromGlobal();
      syncSelectedTrayUI();
    });

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
          fillMainGridBelowViewport(mainEl, mainPhotos);
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
        renderMainGrid(mainEl, newMainPhotos, Math.max(0, INITIAL_VISIBLE_PHOTOS - newIntroPhotos.length));
        setupMainRevealObserver(mainEl, newMainPhotos);

        applyGridInline(introEl, newCols, true);
        applyGridInline(mainEl, newCols, false);

        syncCellSizeSoon();
        syncSelectedTrayUI();
        requestAnimationFrame(() => fillMainGridBelowViewport(mainEl, newMainPhotos));
      }, 120);
    });
  }

  document.addEventListener("DOMContentLoaded", initGallery);
})();
