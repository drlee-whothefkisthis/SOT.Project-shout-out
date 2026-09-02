<script>
(function () {
  var NOTICE_BANNER_ENABLED = false;

  function detectKakaoInApp() {
    return /KAKAOTALK/i.test(navigator.userAgent || "");
  }

  function initKakaoInAppFlag() {
    var isKakao = detectKakaoInApp() ? "1" : "0";
    sessionStorage.setItem("is_kakao_inapp", isKakao);
    return isKakao;
  }

  function createBanner() {
    if (document.getElementById("kakao-inapp-banner")) return;

    var banner = document.createElement("div");
    banner.id = "kakao-inapp-banner";
    banner.innerHTML =
      '<div id="kakao-inapp-banner-inner">' +
        '<div id="kakao-inapp-banner-text">' +
          '<p id="kakao-inapp-banner-title"></p>' +
          '<p id="kakao-inapp-banner-desc"></p>' +
        '</div>' +
        '<button id="kakao-inapp-banner-close" type="button" aria-label="배너 닫기">×</button>' +
      '</div>';

    document.body.appendChild(banner);

    var closeButton = document.getElementById("kakao-inapp-banner-close");
    if (closeButton) {
      closeButton.addEventListener("click", function () {
        banner.classList.remove("is-visible");
        document.body.classList.remove("has-kakao-inapp-banner");
        sessionStorage.setItem("kakao_inapp_notice_shown", "1");
      });
    }
  }

  function showBannerOnce() {
    var alreadyShown = sessionStorage.getItem("kakao_inapp_notice_shown");
    if (alreadyShown === "1") return;

    createBanner();

    var banner = document.getElementById("kakao-inapp-banner");
    if (!banner) return;

    banner.classList.add("is-visible");
    document.body.classList.add("has-kakao-inapp-banner");
    sessionStorage.setItem("kakao_inapp_notice_shown", "1");
  }

  function init() {
    initKakaoInAppFlag();

    if (!NOTICE_BANNER_ENABLED) {
      var existingBanner = document.getElementById("kakao-inapp-banner");
      if (existingBanner) existingBanner.remove();

      document.body.classList.remove("has-kakao-inapp-banner");
      return;
    }

    showBannerOnce();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
</script>
<script>
(function () {
function onReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
}

onReady(function () {
  const AUTH_LOGIN_URL = "/login";
  const AUTH_INTENT_KEY = "shout_auth_intent";
  const MYPAGE_URL = "/mypage";

  function isLoggedIn() {
    return !!localStorage.getItem("shout_users_id");
  }

  function setIntent(returnTo, after) {
    const payload = {
      return_to: returnTo,
      fallback_to: window.location.origin + "/",
      after: after || "none",
      created_at: Date.now()
    };
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

  const BUBBLE_BASE = "https://plp-62309.bubbleapps.io/api/1.1";
  const EVENTS_OBJ_ENDPOINT = `${BUBBLE_BASE}/obj/event`;

  let races = [];
  let racesAll = [];

  const eventInput = document.getElementById("app-event-id-input");
  const bibInput = document.getElementById("app-bib-input");
  const suggestionsBox = document.getElementById("app-event-suggestions");
  const searchForm = document.getElementById("app-search-photos-form");

  const bibActionBtn = document.getElementById("app-bib-action-btn");
  const bibActionIcon = document.getElementById("app-bib-action-icon");
    const bibActionImg = bibActionBtn ? (bibActionBtn.querySelector("img") || bibActionBtn.querySelector(".search-icon, .search-icon-img")) : null; // existing magnifier image (best-effort)

  if (!eventInput || !bibInput || !searchForm) {
    console.error("[System] Required DOM missing");
    return;
  }

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

  applyNoAutofillAttrs(eventInput, {
    autocomplete: "new-password",
    inputmode: "search",
    enterkeyhint: "next",
    name: "event_query"
  });

  applyNoAutofillAttrs(bibInput, {
    autocomplete: "new-password",
    inputmode: "search",
    enterkeyhint: "search",
    name: "bib_query"
  });

  searchForm.setAttribute("autocomplete", "off");
  searchForm.setAttribute("role", "search");

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

  if (suggestionsBox) suggestionsBox.style.display = "none";

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
    setBibActionUi();
  });

  eventInput.addEventListener("change", () => {
    const v = (eventInput.value || "").trim();
    const matched = races.find(r => r.name === v);
    hiddenEventId.value = matched ? matched.id : "";
    setBibActionUi();
    if (matched) focusBib();
  });

  function selectRaceByCode(eventCode) {
    const code = String(eventCode || "").trim();
    if (!code) return false;

    const matched = races.find(r => String(r.id || "").trim() === code);
    if (!matched) return false;

    eventInput.value = matched.name || "";
    hiddenEventId.value = matched.id || "";

    setBibActionUi();
    focusBib();
    return true;
  }

  /* ============================================================
   * Recent events
   * Webflow owns only .section-recent > .recent-wrapper.
   * Everything inside the wrapper is rendered from Bubble data.
   * ============================================================ */
  const RECENT_ROOT_ID = "sot-recent-events-root";
  const RECENT_HOT_COUNT = 4;
  const RECENT_PAST_PAGE_SIZE = 6;

  // Existing Webflow CDN assets are kept as a zero-migration fallback.
  // New events should set home_image_url (or card_image_url/image_url) in Bubble.
  const LEGACY_HOME_ASSETS = Object.freeze({
    "260628-sd": {
      priority: 100,
      src: "https://cdn.prod.website-files.com/691e5df3002228c301997066/6a3a1c3d3c924c12dd5d5b9a_songdo_lee_bongju_marathon_webflow_under_100kb.webp",
      srcset: "https://cdn.prod.website-files.com/691e5df3002228c301997066/6a3a1c3d3c924c12dd5d5b9a_songdo_lee_bongju_marathon_webflow_under_100kb-p-500.webp 500w, https://cdn.prod.website-files.com/691e5df3002228c301997066/6a3a1c3d3c924c12dd5d5b9a_songdo_lee_bongju_marathon_webflow_under_100kb-p-800.webp 800w, https://cdn.prod.website-files.com/691e5df3002228c301997066/6a3a1c3d3c924c12dd5d5b9a_songdo_lee_bongju_marathon_webflow_under_100kb.webp 900w"
    },
    "260620-cj": {
      priority: 90,
      src: "https://cdn.prod.website-files.com/691e5df3002228c301997066/6a35ad2b1cc38736b192d621_260620-cj.png"
    },
    "260614-dj": {
      priority: 80,
      src: "https://cdn.prod.website-files.com/691e5df3002228c301997066/6a2dcd4eb8ecd18fab597f13_260614-dj.png"
    },
    "260531-gs": {
      priority: 70,
      src: "https://cdn.prod.website-files.com/691e5df3002228c301997066/6a1b50fbdd92b1af68cd4297_260531-gs.webp",
      srcset: "https://cdn.prod.website-files.com/691e5df3002228c301997066/6a1b50fbdd92b1af68cd4297_260531-gs-p-500.webp 500w, https://cdn.prod.website-files.com/691e5df3002228c301997066/6a1b50fbdd92b1af68cd4297_260531-gs.webp 700w"
    },
    "260614-ic": {
      priority: 50,
      src: "https://cdn.prod.website-files.com/691e5df3002228c301997066/6a2dcd49de5c19bff72ca8d5_260614-ic.png"
    },
    "260607-yd": {
      priority: 40,
      src: "https://cdn.prod.website-files.com/691e5df3002228c301997066/6a28fe49de181744161b9bff_260607-yd.png"
    },
    "260517-ic": {
      priority: 30,
      src: "https://cdn.prod.website-files.com/691e5df3002228c301997066/6a08027d1ebdd44a620c33b0_260517-ic.webp",
      srcset: "https://cdn.prod.website-files.com/691e5df3002228c301997066/6a08027d1ebdd44a620c33b0_260517-ic-p-500.webp 500w, https://cdn.prod.website-files.com/691e5df3002228c301997066/6a08027d1ebdd44a620c33b0_260517-ic-p-800.webp 800w, https://cdn.prod.website-files.com/691e5df3002228c301997066/6a08027d1ebdd44a620c33b0_260517-ic-p-1080.webp 1080w, https://cdn.prod.website-files.com/691e5df3002228c301997066/6a08027d1ebdd44a620c33b0_260517-ic.webp 1254w"
    },
    "260502-bs": {
      priority: 20,
      src: "https://cdn.prod.website-files.com/691e5df3002228c301997066/69f4cc256dc57e5560750430_260502-bs.jpg",
      srcset: "https://cdn.prod.website-files.com/691e5df3002228c301997066/69f4cc256dc57e5560750430_260502-bs-p-500.jpg 500w, https://cdn.prod.website-files.com/691e5df3002228c301997066/69f4cc256dc57e5560750430_260502-bs.jpg 900w"
    },
    "260419-kk": {
      priority: 10,
      src: "https://cdn.prod.website-files.com/691e5df3002228c301997066/69de08e3f0bedc9175f1be47_260419-kk-b.png"
    }
  });

  let selectedPastMonth = "all";
  let visiblePastCount = RECENT_PAST_PAGE_SIZE;

  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function eventAsset(race) {
    const legacy = LEGACY_HOME_ASSETS[race.id] || {};
    return {
      src: race.home_image_url || legacy.src || "",
      srcset: race.home_image_srcset || legacy.srcset || ""
    };
  }

  function isHomeEvent(race) {
    if (!race || race.home_visible === false) return false;
    const hasImage = !!eventAsset(race).src;
    return race.home_visible === true || hasImage;
  }

  function hotRank(race) {
    const rank = finiteNumber(race.home_rank);
    return rank !== null && rank > 0 ? rank : Infinity;
  }

  function hotScore(race) {
    const legacy = LEGACY_HOME_ASSETS[race.id] || {};
    const candidates = [race.home_score, race.home_priority, legacy.priority];
    for (const value of candidates) {
      const number = finiteNumber(value);
      if (number !== null) return number;
    }
    return race.publish_at ? race.publish_at.getTime() : 0;
  }

  function compareHotEvents(a, b) {
    const aRank = hotRank(a);
    const bRank = hotRank(b);
    if (aRank !== bRank) return aRank - bRank;
    const scoreDiff = hotScore(b) - hotScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    const dateDiff = eventTimestamp(b) - eventTimestamp(a);
    if (dateDiff !== 0) return dateDiff;
    return (a.name || "").localeCompare(b.name || "", "ko");
  }

  function eventTimestamp(race) {
    const timestamp = race && race.event_date ? race.event_date.getTime() : NaN;
    return Number.isFinite(timestamp) ? timestamp : -Infinity;
  }

  function kstDateParts(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short"
    }).formatToParts(date).reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
    const weekdayMap = { Sun: "일", Mon: "월", Tue: "화", Wed: "수", Thu: "목", Fri: "금", Sat: "토" };
    return {
      year: parts.year,
      month: parts.month,
      day: parts.day,
      weekday: weekdayMap[parts.weekday] || parts.weekday || ""
    };
  }

  function eventMonthKey(race) {
    const parts = kstDateParts(race && race.event_date);
    return parts ? `${parts.year}-${parts.month}` : "";
  }

  function formatEventDate(race) {
    const parts = kstDateParts(race && race.event_date);
    return parts ? `${parts.year}.${parts.month}.${parts.day} (${parts.weekday})` : "날짜 준비 중";
  }

  function isPastOrToday(race) {
    const parts = kstDateParts(race && race.event_date);
    const today = kstDateParts(new Date());
    if (!parts || !today) return false;
    return `${parts.year}${parts.month}${parts.day}` <= `${today.year}${today.month}${today.day}`;
  }

  function createText(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text || "";
    return element;
  }

  function createEventImage(race, className, eager) {
    const asset = eventAsset(race);
    if (!asset.src) return null;
    const image = document.createElement("img");
    image.className = className;
    image.src = asset.src;
    if (asset.srcset) image.srcset = asset.srcset;
    image.sizes = "(max-width: 479px) 100vw, 430px";
    image.loading = eager ? "eager" : "lazy";
    image.decoding = "async";
    image.alt = `${race.name} 대회 이미지`;
    return image;
  }

  function createEventLink(race, className) {
    const link = document.createElement("a");
    link.href = "#main-search";
    link.className = `app-bib-input-move w-inline-block recent-event ${className}`;
    link.dataset.eventCode = race.id;
    link.setAttribute("aria-label", `${race.name} 선택`);
    return link;
  }

  function createFeatureCard(race) {
    const card = createEventLink(race, "sot-recent-feature");
    const image = createEventImage(race, "sot-recent-feature__image", true);
    if (image) card.appendChild(image);
    const overlay = document.createElement("span");
    overlay.className = "sot-recent-feature__overlay";
    overlay.appendChild(createText("span", "sot-recent-card__date", formatEventDate(race)));
    overlay.appendChild(createText("strong", "sot-recent-feature__title", race.name));
    card.appendChild(overlay);
    return card;
  }

  function createHotCard(race) {
    const card = createEventLink(race, "sot-recent-hot-card");
    const thumb = document.createElement("span");
    thumb.className = "sot-recent-hot-card__thumb";
    const image = createEventImage(race, "sot-recent-hot-card__image", false);
    if (image) thumb.appendChild(image);
    const copy = document.createElement("span");
    copy.className = "sot-recent-hot-card__copy";
    copy.appendChild(createText("strong", "sot-recent-hot-card__title", race.name));
    copy.appendChild(createText("span", "sot-recent-card__date", formatEventDate(race)));
    card.appendChild(thumb);
    card.appendChild(copy);
    card.appendChild(createText("span", "sot-recent-hot-card__chevron", "›"));
    return card;
  }

  function createPastCard(race) {
    const card = createEventLink(race, "sot-recent-past-card");
    card.dataset.month = eventMonthKey(race);
    const image = createEventImage(race, "sot-recent-past-card__image", false);
    if (image) card.appendChild(image);
    const overlay = document.createElement("span");
    overlay.className = "sot-recent-past-card__overlay";
    overlay.appendChild(createText("span", "sot-recent-card__date", formatEventDate(race)));
    overlay.appendChild(createText("strong", "sot-recent-past-card__title", race.name));
    card.appendChild(overlay);
    return card;
  }

  function ensureRecentRoot() {
    const wrapper = document.querySelector(".section-recent .recent-wrapper, .recent-wrapper");
    if (!wrapper) return null;
    let root = document.getElementById(RECENT_ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = RECENT_ROOT_ID;
      root.className = "sot-recent-events";
      wrapper.replaceChildren(root);
    }
    return root;
  }

  function renderRecentStatus(message, tone) {
    const root = ensureRecentRoot();
    if (!root) return;
    root.replaceChildren();
    const status = createText("p", `sot-recent-status${tone ? ` is-${tone}` : ""}`, message);
    status.setAttribute("role", tone === "error" ? "alert" : "status");
    root.appendChild(status);
  }

  function renderRecentEvents() {
    const root = ensureRecentRoot();
    if (!root) return;

    const homeEvents = races.filter(isHomeEvent).sort(compareHotEvents);
    if (!homeEvents.length) {
      renderRecentStatus("선택할 수 있는 대회를 준비 중입니다.", "empty");
      return;
    }

    const hotEvents = homeEvents.slice(0, RECENT_HOT_COUNT);
    const hotCodes = new Set(hotEvents.map(race => race.id));
    const pastEvents = homeEvents
      .filter(race => !hotCodes.has(race.id) && isPastOrToday(race))
      .sort((a, b) => eventTimestamp(b) - eventTimestamp(a));

    const monthKeys = Array.from(new Set(pastEvents.map(eventMonthKey).filter(Boolean))).sort().reverse();
    if (selectedPastMonth !== "all" && !monthKeys.includes(selectedPastMonth)) selectedPastMonth = "all";
    const filteredPast = selectedPastMonth === "all"
      ? pastEvents
      : pastEvents.filter(race => eventMonthKey(race) === selectedPastMonth);
    const visiblePast = filteredPast.slice(0, visiblePastCount);

    root.replaceChildren();

    const heading = document.createElement("header");
    heading.className = "sot-recent-heading";
    heading.appendChild(createText("h2", "sot-recent-title", "대회 선택"));
    heading.appendChild(createText("p", "sot-recent-subtitle", "핫한 대회는 위에, 지난 대회는 아래에 정리했습니다."));
    root.appendChild(heading);

    const hotSection = document.createElement("section");
    hotSection.className = "sot-recent-group";
    hotSection.setAttribute("aria-labelledby", "sot-recent-hot-title");
    const hotHead = document.createElement("div");
    hotHead.className = "sot-recent-group-head";
    const hotTitle = createText("h3", "sot-recent-group-title", "지금 많이 찾는 대회");
    hotTitle.id = "sot-recent-hot-title";
    hotHead.appendChild(hotTitle);
    hotHead.appendChild(createText("span", "sot-recent-hot-badge", "HOT"));
    hotSection.appendChild(hotHead);
    hotSection.appendChild(createFeatureCard(hotEvents[0]));
    if (hotEvents.length > 1) {
      const hotList = document.createElement("div");
      hotList.className = "sot-recent-hot-list";
      hotEvents.slice(1).forEach(race => hotList.appendChild(createHotCard(race)));
      hotSection.appendChild(hotList);
    }
    root.appendChild(hotSection);

    if (pastEvents.length) {
      const pastSection = document.createElement("section");
      pastSection.className = "sot-recent-past";
      pastSection.setAttribute("aria-labelledby", "sot-recent-past-title");
      const pastHead = document.createElement("div");
      pastHead.className = "sot-recent-group-head";
      const pastTitle = createText("h3", "sot-recent-group-title", "지난 대회");
      pastTitle.id = "sot-recent-past-title";
      pastHead.appendChild(pastTitle);

      const monthSelect = document.createElement("select");
      monthSelect.className = "sot-recent-month";
      monthSelect.setAttribute("aria-label", "지난 대회 월 선택");
      monthSelect.dataset.recentAction = "month";
      const allOption = document.createElement("option");
      allOption.value = "all";
      allOption.textContent = "전체 월";
      monthSelect.appendChild(allOption);
      monthKeys.forEach(key => {
        const option = document.createElement("option");
        option.value = key;
        const [year, month] = key.split("-");
        option.textContent = `${year}년 ${Number(month)}월`;
        monthSelect.appendChild(option);
      });
      monthSelect.value = selectedPastMonth;
      pastHead.appendChild(monthSelect);
      pastSection.appendChild(pastHead);

      const grid = document.createElement("div");
      grid.className = "sot-recent-past-grid";
      visiblePast.forEach(race => grid.appendChild(createPastCard(race)));
      pastSection.appendChild(grid);

      if (!visiblePast.length) {
        pastSection.appendChild(createText("p", "sot-recent-past-empty", "선택한 월의 지난 대회가 없습니다."));
      }

      if (filteredPast.length > visiblePast.length) {
        const more = createText("button", "sot-recent-more", "지난 대회 더보기");
        more.type = "button";
        more.dataset.recentAction = "more";
        pastSection.appendChild(more);
      }
      root.appendChild(pastSection);
    }

    const message = document.createElement("p");
    message.className = "sot-recent-message";
    message.setAttribute("aria-live", "polite");
    root.appendChild(message);
  }

  function bindRecentEventsRoot() {
    const root = ensureRecentRoot();
    if (!root || root.dataset.bound === "true") return;
    root.dataset.bound = "true";

    root.addEventListener("click", (event) => {
      const more = event.target.closest('[data-recent-action="more"]');
      if (more) {
        visiblePastCount += RECENT_PAST_PAGE_SIZE;
        renderRecentEvents();
        return;
      }

      const card = event.target.closest(".recent-event[data-event-code]");
      if (!card || !root.contains(card)) return;
      event.preventDefault();
      const selected = selectRaceByCode(card.dataset.eventCode);
      const message = root.querySelector(".sot-recent-message");
      if (message) {
        message.textContent = selected
          ? `${eventInput.value}을(를) 선택했습니다. 배번호 또는 이름을 입력해주세요.`
          : "현재 검색할 수 없는 대회입니다.";
      }
    });

    root.addEventListener("change", (event) => {
      if (!event.target.matches('[data-recent-action="month"]')) return;
      selectedPastMonth = event.target.value || "all";
      visiblePastCount = RECENT_PAST_PAGE_SIZE;
      renderRecentEvents();
    });
  }

  bindRecentEventsRoot();
  renderRecentStatus("대회 목록을 불러오고 있습니다.", "loading");

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
          const event_code = item.event_code || item.slug || "";
          const event_display_name = item.event_display_name || item.name || event_code;
          const is_public = (item.is_public === true);
          const publish_at = item.publish_at ? new Date(item.publish_at) : null;
          const event_date = item.event_date ? new Date(item.event_date) : null;

          if (!event_code) return null;

          return {
            name: event_display_name,
            id: event_code,
            is_public,
            publish_at,
            event_date,
            name_search_enabled: item.name_search_enabled === true,
            bib_min_digits: Number(item.bib_min_digits) === 3 ? 3 : 4,
            home_visible: item.home_visible === true ? true : (item.home_visible === false ? false : null),
            home_image_url: item.home_image_url || item.card_image_url || item.image_url || "",
            home_image_srcset: item.home_image_srcset || item.card_image_srcset || "",
            home_rank: item.home_rank ?? item.hot_rank ?? null,
            home_score: item.home_score ?? item.hot_score ?? item.popularity_score ?? null,
            home_priority: item.home_priority ?? null
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
      renderRecentEvents();

    } catch (err) {
      console.error("[System] loadRacesFromBubble error.", err);
      racesAll = [];
      races = [];
      rebuildEventDatalist();
      renderRecentStatus("대회 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.", "error");
    }
  }

  loadRacesFromBubble();

  function getRaceByCode(eventCode) {
    const code = String(eventCode || "").trim();
    if (!code) return null;

    return (
      races.find(r => String(r.id || "").trim() === code) ||
      racesAll.find(r => String(r.id || "").trim() === code) ||
      null
    );
  }

  function isNumericSearch(value) {
    return /^\d+$/.test(String(value || "").trim());
  }

  const BLOCKED_BIBS = new Set(["2026"]);

  function isBlockedSearchQuery(value) {
    return BLOCKED_BIBS.has(String(value || "").trim());
  }

  function showBlockedSearchAlert() {
    alert("2026번은 검색할 수 없습니다.\n문의가 필요하신 경우 관리자에게 문의해주세요.\n\ncontact@plp.im");
  }

  function isNameSearchQuery(value) {
    return /^[가-힣]{2,}$/.test(String(value || "").trim());
  }

  function isNameSearchEnabledForEvent(eventCode) {
    const race = getRaceByCode(eventCode);
    return !!(race && race.name_search_enabled === true);
  }

  function bibMinDigitsForEvent(eventCode) {
    const race = getRaceByCode(eventCode);
    return race && Number(race.bib_min_digits) === 3 ? 3 : 4;
  }

  function bibSearchHelpText(eventCode) {
    return `배번호는 ${bibMinDigitsForEvent(eventCode)}자리 이상, 이름은 한글 2글자 이상 입력해주세요.`;
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
      alert("배번호를 입력해주세요.");
      return;
    }

    if (isBlockedSearchQuery(bibVal)) {
      showBlockedSearchAlert();
      bibInput.focus();
      return;
    }

    if (!isValidBibQuery(bibVal, eventId)) {
      alert(bibSearchHelpText(eventId));
      return;
    }

    if (isNameSearchQuery(bibVal) && !isNameSearchEnabledForEvent(eventId)) {
      alert("예쁜 이름의 당신, 완주를 축하드립니다. \n아쉽게도 해당 대회는 이름 검색을 지원하지 않습니다.\n참가하신 배번호 숫자로 검색해주세요.");
      bibInput.focus();
      return;
    }

    let targetUrl = `/gallery?event_code=${encodeURIComponent(eventId)}&q=${encodeURIComponent(bibVal)}`;
    if (window.ShoutTracking && typeof window.ShoutTracking.appendTrackingParamsToUrl === "function") {
      try {
        targetUrl = window.ShoutTracking.appendTrackingParamsToUrl(
          targetUrl,
          typeof window.ShoutTracking.getTrackingContext === "function"
            ? window.ShoutTracking.getTrackingContext()
            : null
        );
      } catch (err) {
        console.warn("[Main] tracking URL append failed:", err);
      }
    }
    window.location.href = targetUrl;
  }

  const ICON_NEXT = `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"></circle>
      <path d="M11 9l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
  `;

  function isValidBibQuery(value, eventCode) {
    const v = String(value || "").trim();
    if (isNumericSearch(v) && v.length >= bibMinDigitsForEvent(eventCode)) return true;
    if (/^[가-힣]{2,}$/.test(v)) return true;
    return false;
  }

  function setBibActionUi() {
    if (!bibActionBtn || !bibActionIcon) return;

    const ready = isValidBibQuery(bibInput.value, hiddenEventId.value);

    bibActionBtn.classList.toggle("is-ready", ready);
    bibActionBtn.setAttribute("aria-disabled", ready ? "false" : "true");

    if (!ready) {
      if (bibActionImg) bibActionImg.style.display = "";
      bibActionIcon.innerHTML = "";
      return;
    }

    if (bibActionImg) bibActionImg.style.display = "none";
    bibActionIcon.innerHTML = ICON_NEXT;
  }

  bibInput.addEventListener("input", () => {
    setBibActionUi();
  });

  setBibActionUi();

  if (bibActionBtn) {
    bibActionBtn.addEventListener("click", (e) => {
      const bibVal = (bibInput.value || "").trim();

      if (!bibVal) {
        e.preventDefault();
        alert("배번호를 입력해주세요.");
        bibInput.focus();
        return;
      }

      const eventId = (hiddenEventId.value || "").trim();
      if (!isValidBibQuery(bibVal, eventId)) {
        e.preventDefault();
        alert(bibSearchHelpText(eventId));
        bibInput.focus();
        return;
      }

      goToGallery();
    });
  }

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

      if (!bibVal) {
        alert("배번호를 입력해주세요.");
        return;
      }

      const eventId = (hiddenEventId.value || "").trim();
      if (!isValidBibQuery(bibVal, eventId)) {
        alert(bibSearchHelpText(eventId));
        return;
      }

      goToGallery();
    }
  });

  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    goToGallery();
  });

});

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

    openers.forEach(btn=>{
      btn.addEventListener("click",(e)=>{
        e.preventDefault();
        openModal(btn.getAttribute("data-open-modal"));
      });
    });

    modalSection.addEventListener("click", (e) => {
      const closeBtn = e.target.closest(".hm-modal-close");
      if (closeBtn) {
        e.preventDefault();
        closeModal();
        return;
      }

      if (e.target === backdrop || e.target === modalBox) {
        closeModal();
      }
    });

    window.addEventListener("keydown",(e)=>{
      if(e.key === "Escape") closeModal();
    });

    setOpenUI(false);
  })();

})();
</script>
