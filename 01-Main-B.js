<script>
document.addEventListener("DOMContentLoaded", function () {
  console.log("[System] Main Page Logic Loaded");

  /* ============================================================
   0) Auth
  ============================================================ */
  const AUTH_LOGIN_URL = "/login";
  const AUTH_INTENT_KEY = "shout_auth_intent";
  const MYPAGE_URL = "/mypage";

  function isLoggedIn() {
    return !!localStorage.getItem("shout_users_id");
  }

  function setIntent(returnTo, after) {
    const payload = { return_to: returnTo, after: after || "none" };
    sessionStorage.setItem(AUTH_INTENT_KEY, JSON.stringify(payload));
  }

  const mypageBtn = document.getElementById("btn-mypage");
  if (mypageBtn) {
    mypageBtn.addEventListener("click", function (e) {
      e.preventDefault();
      if (isLoggedIn()) {
        window.location.href = MYPAGE_URL;
      } else {
        setIntent(MYPAGE_URL, "none");
        window.location.href = AUTH_LOGIN_URL;
      }
    });
  }

  /* ============================================================
   1) Race Data (Bubble에서 동적으로 로드)
  ============================================================ */
  const BUBBLE_BASE = "https://plp-62309.bubbleapps.io/version-test/api/1.1";
  const EVENTS_OBJ_ENDPOINT = `${BUBBLE_BASE}/obj/event`;

  let races = [];     // 선택 가능한(공개된) 대회만
  let racesAll = [];  // 전체 메타(공개전/비공개 포함) - 메시지 판단용

  /* ============================================================
   2) DOM
  ============================================================ */
  const eventInput = document.getElementById("app-event-id-input");
  const bibInput = document.getElementById("app-bib-input");
  const suggestionsBox = document.getElementById("app-event-suggestions");
  const searchForm = document.getElementById("app-search-photos-form");

  if (!eventInput || !bibInput || !suggestionsBox || !searchForm) {
    console.error("[System] Required DOM missing");
    return;
  }

  /* ============================================================
   2-1) iOS Autofill 억제 + 키보드 힌트
  ============================================================ */
  function applyNoAutofillAttrs(input, opts) {
    input.setAttribute("type", "text");
    input.setAttribute("autocomplete", (opts && opts.autocomplete) ? opts.autocomplete : "new-password");
    input.setAttribute("autocorrect", "off");
    input.setAttribute("autocapitalize", "none");
    input.setAttribute("spellcheck", "false");
    if (opts && opts.inputmode) input.setAttribute("inputmode", opts.inputmode);
    if (opts && opts.enterkeyhint) input.setAttribute("enterkeyhint", opts.enterkeyhint);
    if (opts && opts.name) input.setAttribute("name", opts.name);
    input.setAttribute("aria-autocomplete", "none");
    input.setAttribute("role", "textbox");
  }

  // 이벤트: Next
  applyNoAutofillAttrs(eventInput, {
    autocomplete: "new-password",
    inputmode: "search",
    enterkeyhint: "next",
    name: "event_query"
  });

  // 배번호: 기본 키보드 + 파란(검색)키 유도 (numeric 금지)
  applyNoAutofillAttrs(bibInput, {
    autocomplete: "new-password",
    inputmode: "search",
    enterkeyhint: "search",
    name: "bib_query"
  });

  searchForm.setAttribute("autocomplete", "off");
  searchForm.setAttribute("role", "search");

  /* ============================================================
   3) Hidden Event ID (기존 유지)
  ============================================================ */
  let hiddenEventId = document.getElementById("app-event-id-hidden");
  if (!hiddenEventId) {
    hiddenEventId = document.createElement("input");
    hiddenEventId.type = "hidden";
    hiddenEventId.id = "app-event-id-hidden";
    eventInput.parentNode.appendChild(hiddenEventId);
  }

  function focusBib() {
    setTimeout(() => {
      try { eventInput.blur(); } catch (_) {}
      bibInput.focus();
      if (typeof bibInput.select === "function") bibInput.select();
    }, 80);
  }

  /* ============================================================
   4) Autocomplete (Native UI via datalist)
  ============================================================ */
  // (커스텀 UI는 숨김 유지. 네이티브만 사용)
  suggestionsBox.style.display = "none";

  const DATALIST_ID = "app-event-datalist";
  let eventDatalist = document.getElementById(DATALIST_ID);
  if (!eventDatalist) {
    eventDatalist = document.createElement("datalist");
    eventDatalist.id = DATALIST_ID;
    document.body.appendChild(eventDatalist);
  }

  eventInput.setAttribute("list", DATALIST_ID);

  function rebuildEventDatalist() {
    eventDatalist.innerHTML = "";
    races.forEach(race => {
      const opt = document.createElement("option");
      opt.value = race.name;
      eventDatalist.appendChild(opt);
    });
  }

  eventInput.addEventListener("input", () => {
    hiddenEventId.value = "";
  });

  eventInput.addEventListener("change", () => {
    const v = (eventInput.value || "").trim();
    const matched = races.find(r => r.name === v);
    hiddenEventId.value = matched ? matched.id : "";
    if (matched) focusBib();
  });

  /* ============================================================
   5) Races Load (정렬: publish_at 최신 우선)
  ============================================================ */
  async function loadRacesFromBubble() {
    try {
      const url = `${EVENTS_OBJ_ENDPOINT}?limit=200`;
      const res = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });

      if (!res.ok) throw new Error(`Events fetch failed: ${res.status}`);

      const data = await res.json();
      const results = (data && data.response && Array.isArray(data.response.results))
        ? data.response.results
        : [];

      const mappedAll = results
        .map(item => {
          const event_code = item.event_code || item.event_id || item.slug || "";
          const event_display_name = item.event_display_name || item.name || event_code;
          const is_public = (item.is_public === true);
          const publish_at = item.publish_at ? new Date(item.publish_at) : null;

          if (!event_code) return null;

          return {
            name: event_display_name,
            id: event_code,
            is_public,
            publish_at
          };
        })
        .filter(Boolean);

      const now = new Date();

      const mappedAllowed = mappedAll.filter(ev => {
        if (!ev.is_public) return false;
        if (ev.publish_at && ev.publish_at > now) return false;
        return true;
      });

      const sortByPublishAtDesc = (a, b) => {
        const aTs = a.publish_at ? a.publish_at.getTime() : -Infinity;
        const bTs = b.publish_at ? b.publish_at.getTime() : -Infinity;
        if (bTs !== aTs) return bTs - aTs;
        return (a.name || "").localeCompare(b.name || "", "ko");
      };

      mappedAll.sort(sortByPublishAtDesc);
      mappedAllowed.sort(sortByPublishAtDesc);

      racesAll = mappedAll;
      races = mappedAllowed;

      rebuildEventDatalist();
    } catch (err) {
      console.error("[System] loadRacesFromBubble error.", err);
      racesAll = [];
      races = [];
      rebuildEventDatalist();
    }
  }

  loadRacesFromBubble();

  /* ============================================================
   6) Search gating (키보드 검색키 "활성화"를 동작으로만 제어)
  ============================================================ */
  function isSearchReady() {
    const eventId = (hiddenEventId.value || "").trim();
    const bibVal = (bibInput.value || "").trim();
    if (!eventId) return false;
    if (!bibVal) return false;

    const isDigitsOnly = /^\d+$/.test(bibVal);
    if (isDigitsOnly) return bibVal.length >= 4;

    return true;
  }

  function goToGallery(e) {
    if (e) e.preventDefault();

    const eventId = (hiddenEventId.value || "").trim();
    const bibVal = (bibInput.value || "").trim();

    if (!eventId) {
      alert("대회를 목록에서 선택해주세요.");
      return;
    }

    if (!bibVal) {
      alert("배번 또는 이름을 입력해주세요.");
      return;
    }

    const isDigitsOnly = /^\d+$/.test(bibVal);
    if (isDigitsOnly && bibVal.length < 4) {
      alert("배번호는 4자리부터 검색할 수 있습니다.");
      return;
    }

    const targetUrl = `/gallery?event_id=${encodeURIComponent(eventId)}&q=${encodeURIComponent(bibVal)}`;
    window.location.href = targetUrl;
  }

  /* ============================================================
   7) 엔터/검색키 동작
  ============================================================ */
  eventInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      focusBib();
    }
  });

  bibInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();

      const bibVal = (bibInput.value || "").trim();
      const isDigitsOnly = /^\d+$/.test(bibVal);

      if (isDigitsOnly && bibVal.length < 4) {
        alert("4자리 이상 입력해주세요.");
        return;
      }

      if (!isSearchReady()) return;

      goToGallery();
    }
  });

  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!isSearchReady()) return;
    goToGallery();
  });

});

  /* ============================================================
   [ADD] Modal Open / Close Logic (UX fixed)
  ============================================================ */
  (function(){
    const modalSection = document.querySelector("#hm-modal, .section-modal");
    const backdrop = document.querySelector(".hm-modal-backdrop");
    const modalBox = document.querySelector(".hm-modal-box");
    const openers = Array.from(document.querySelectorAll("[data-open-modal]"));
    const modalContents = Array.from(document.querySelectorAll("[data-modal-content]"));

    if(!modalSection || !backdrop || !modalBox) return;

    function setOpenUI(isOpen){
      modalSection.style.display = isOpen ? "block" : "none";
      modalSection.style.pointerEvents = isOpen ? "auto" : "none";

      backdrop.style.display = isOpen ? "block" : "none";
      modalBox.style.display = isOpen ? "flex" : "none";

      backdrop.style.pointerEvents = isOpen ? "auto" : "none";
      modalBox.style.pointerEvents = isOpen ? "auto" : "none";

      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }

    function showContent(key){
      modalContents.forEach(el=>{
        const hit = (el.getAttribute("data-modal-content") === key);
        el.style.display = hit ? "block" : "none";
      });
    }

    function openModal(key){
      if(key) showContent(key);
      setOpenUI(true);
    }

    function closeModal(){
      setOpenUI(false);
    }

    // [1] 모달 여는 버튼 이벤트
    openers.forEach(btn=>{
      btn.addEventListener("click",(e)=>{
        e.preventDefault();
        openModal(btn.getAttribute("data-open-modal"));
      });
    });

    // [2] 모달 닫기 완벽 제어 (이벤트 위임)
    // - 모달 섹션 전체에 클릭 이벤트를 걸어서 상황에 맞게 닫아줍니다.
    modalSection.addEventListener("click", (e) => {
      // 1. 닫기 버튼(.hm-modal-close)을 클릭한 경우 (프라이버시, 약관 모두 포함)
      const closeBtn = e.target.closest(".hm-modal-close");
      if (closeBtn) {
        e.preventDefault();
        closeModal();
        return;
      }

      // 2. 모달 바깥 배경을 클릭한 경우
      // backdrop 자체를 클릭했거나, 겉을 감싸는 투명한 flex 박스(modalBox)의 빈 공간을 클릭했을 때
      if (e.target === backdrop || e.target === modalBox) {
        closeModal();
      }
    });

    // ESC 키보드 누르면 닫기
    window.addEventListener("keydown",(e)=>{
      if(e.key === "Escape") closeModal();
    });

    // 초기 상태: 닫힘
    setOpenUI(false);
  })();

</script>