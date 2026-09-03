try {
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
} catch (error) {
  console.error("[main] notice banner initialization failed", error);
}

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
    const applyFocus = () => {
      try { eventInput.blur(); } catch (_) {}
      bibInput.focus();
      if (typeof bibInput.select === "function") bibInput.select();
    };

    // Keep focus inside the card click's native user gesture so mobile browsers
    // can open the keyboard without requiring a second tap.
    applyFocus();
    requestAnimationFrame(() => {
      if (document.activeElement !== bibInput) applyFocus();
    });
  }

  let stopSearchScrollAdjustment = null;

  function scrollSearchInputsIntoView() {
    if (stopSearchScrollAdjustment) stopSearchScrollAdjustment();
    const viewport = window.visualViewport;
    const alignInputs = () => {
      if (document.activeElement !== bibInput) return;
      const top = Math.min(eventInput.getBoundingClientRect().top, bibInput.getBoundingClientRect().top);
      const offset = (viewport ? viewport.offsetTop : 0) + 80;
      window.scrollTo({ top: Math.max(0, window.scrollY + top - offset), behavior: "instant" });
    };

    // Focus remains in the original click gesture. Scrolling never focuses
    // the section, and adjusts once the mobile keyboard changes the viewport.
    const frame = requestAnimationFrame(alignInputs);
    if (viewport) viewport.addEventListener("resize", alignInputs);
    const cleanup = () => {
      cancelAnimationFrame(frame);
      if (viewport) viewport.removeEventListener("resize", alignInputs);
      clearTimeout(timeout);
      stopSearchScrollAdjustment = null;
    };
    const timeout = setTimeout(cleanup, 1000);
    stopSearchScrollAdjustment = cleanup;
  }

  eventInput.removeAttribute("list");
  let eventMatches = [];

  function normalizeEventSearchText(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase("ko-KR")
      .replace(/[\s\-_/().,·]/g, "");
  }

  function editDistanceAtMostOne(a, b) {
    if (Math.abs(a.length - b.length) > 1) return false;
    let indexA = 0;
    let indexB = 0;
    let edits = 0;
    while (indexA < a.length && indexB < b.length) {
      if (a[indexA] === b[indexB]) { indexA += 1; indexB += 1; continue; }
      edits += 1;
      if (edits > 1) return false;
      if (a.length > b.length) indexA += 1;
      else if (b.length > a.length) indexB += 1;
      else { indexA += 1; indexB += 1; }
    }
    return true;
  }

  function fuzzyIncludesEventText(name, query) {
    if (name.includes(query)) return true;
    if (query.length < 3) return false;
    for (let start = 0; start < name.length; start += 1) {
      for (let length = query.length - 1; length <= query.length + 1; length += 1) {
        if (length < 1) continue;
        const candidate = name.slice(start, start + length);
        if (candidate.length === length && editDistanceAtMostOne(candidate, query)) return true;
      }
    }
    return false;
  }

  function matchingRaces(query) {
    const rawTokens = String(query || "").trim().split(/\s+/).filter(Boolean);
    const tokens = rawTokens.map(normalizeEventSearchText).filter(Boolean);
    if (!tokens.length) return [];
    return races
      .filter(race => {
        const name = normalizeEventSearchText(race.name);
        return tokens.every(token => fuzzyIncludesEventText(name, token));
      })
      .sort((a, b) => {
        const aName = normalizeEventSearchText(a.name);
        const bName = normalizeEventSearchText(b.name);
        const queryText = normalizeEventSearchText(query);
        const aRank = aName.startsWith(queryText) ? 0 : (aName.includes(queryText) ? 1 : 2);
        const bRank = bName.startsWith(queryText) ? 0 : (bName.includes(queryText) ? 1 : 2);
        if (aRank !== bRank) return aRank - bRank;
        return (a.name || "").localeCompare(b.name || "", "ko");
      })
      .slice(0, 8);
  }

  function hideEventSuggestions() {
    eventMatches = [];
    if (!suggestionsBox) return;
    suggestionsBox.replaceChildren();
    suggestionsBox.style.display = "none";
  }

  function renderEventSuggestions() {
    if (!suggestionsBox) return;
    const query = (eventInput.value || "").trim();
    if (!query) { hideEventSuggestions(); return; }
    eventMatches = matchingRaces(query);
    suggestionsBox.replaceChildren();
    if (!eventMatches.length) {
      const empty = createText("p", "suggestion-info", "일치하는 대회가 없습니다.");
      suggestionsBox.appendChild(empty);
    } else {
      eventMatches.forEach(race => {
        const item = createText("button", "suggestion-item", race.name);
        item.type = "button";
        item.dataset.eventCode = race.id;
        item.setAttribute("role", "option");
        item.addEventListener("mousedown", event => event.preventDefault());
        item.addEventListener("click", () => {
          selectRaceByCode(race.id);
          hideEventSuggestions();
        });
        suggestionsBox.appendChild(item);
      });
    }
    suggestionsBox.setAttribute("role", "listbox");
    suggestionsBox.style.display = "block";
  }

  eventInput.addEventListener("input", () => {
    hiddenEventId.value = "";
    setBibActionUi();
    renderEventSuggestions();
  });

  eventInput.addEventListener("change", () => {
    const v = (eventInput.value || "").trim();
    const matched = races.find(r => r.name === v);
    hiddenEventId.value = matched ? matched.id : "";
    setBibActionUi();
    if (matched) focusBib();
  });

  eventInput.addEventListener("blur", () => {
    window.setTimeout(hideEventSuggestions, 120);
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

  let selectedPastMonth = "all";
  let visiblePastCount = RECENT_PAST_PAGE_SIZE;

  function isHomeEvent(race) {
    return !!race && race.home_visible !== false;
  }

  function compareRecentEvents(a, b) {
    const aDate = eventTimestamp(a);
    const bDate = eventTimestamp(b);
    if (aDate !== bDate) return bDate - aDate;
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

  function displayRaceName(race) {
    return String((race && race.name) || "").replace(/^\s*20\d{2}\s+/, "").trim();
  }

  function eventCourseInfo(race) {
    return String((race && race.course_info) || "").trim() || "Full, Half, 10K, 5K";
  }

  function eventTag(race) {
    const name = displayRaceName(race);
    const ordinal = name.match(/^제\s*(\d+)\s*회/);
    if (ordinal) return ordinal[1].slice(-2);
    const suffix = String((race && race.id) || "").split("-").pop();
    return suffix ? suffix.slice(0, 2).toUpperCase() : "RUN";
  }

  function splitPastTitle(race) {
    const words = displayRaceName(race).split(/\s+/).filter(Boolean);
    if (words.length < 2) return [words.join(" ")];
    let bestIndex = 1;
    let bestGap = Infinity;
    for (let index = 1; index < words.length; index += 1) {
      const first = words.slice(0, index).join(" ");
      const second = words.slice(index).join(" ");
      if (first.length > second.length) continue;
      const gap = second.length - first.length;
      if (gap < bestGap) { bestGap = gap; bestIndex = index; }
    }
    return [words.slice(0, bestIndex).join(" "), words.slice(bestIndex).join(" ")];
  }

  function createPastTitle(race) {
    const title = document.createElement("strong");
    title.className = "sot-recent-past-card__title";
    splitPastTitle(race).forEach((line, index) => {
      if (index) title.appendChild(document.createElement("br"));
      title.appendChild(document.createTextNode(line));
    });
    return title;
  }

  function createEventLink(race, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `recent-event ${className}`;
    button.dataset.eventCode = race.id;
    button.setAttribute("aria-label", `${race.name} 선택`);
    return button;
  }

  function createHotCard(race, index) {
    const card = createEventLink(race, "sot-recent-hot-card");
    card.appendChild(createText("span", "sot-recent-hot-card__eyebrow", index === 0 ? "LATEST EVENT" : `EVENT ${String(index + 1).padStart(2, "0")}`));
    const parts = kstDateParts(race.event_date);
    const thumb = document.createElement("span");
    thumb.className = "sot-recent-hot-card__thumb";
    thumb.appendChild(createText("strong", "sot-recent-hot-card__day", parts ? String(Number(parts.day)) : "--"));
    thumb.appendChild(createText("span", "sot-recent-hot-card__month", parts ? `${Number(parts.month)}월` : ""));
    const copy = document.createElement("span");
    copy.className = "sot-recent-hot-card__copy";
    copy.appendChild(createText("strong", "sot-recent-hot-card__title", displayRaceName(race)));
    copy.appendChild(createText("span", "sot-recent-hot-card__mobile-date", formatEventDate(race)));
    copy.appendChild(createText("span", "sot-recent-hot-card__course", eventCourseInfo(race)));
    const arrow = document.createElement("div");
    arrow.className = "arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "›";
    card.appendChild(thumb);
    card.appendChild(copy);
    card.appendChild(arrow);
    card.appendChild(createText("span", "sot-recent-hot-card__cta", "사진 찾기 →"));
    return card;
  }

  function createPastCard(race) {
    const card = createEventLink(race, "sot-recent-past-card");
    card.dataset.month = eventMonthKey(race);
    const overlay = document.createElement("span");
    overlay.className = "sot-recent-past-card__overlay";
    overlay.appendChild(createText("span", "sot-recent-card__date", formatEventDate(race)));
    overlay.appendChild(createPastTitle(race));
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

    const homeEvents = races.filter(isHomeEvent).sort(compareRecentEvents);
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

    const panel = document.createElement("div");
    panel.className = "sot-recent-panel";

    const hotSection = document.createElement("section");
    hotSection.className = "sot-recent-group";
    hotSection.setAttribute("aria-labelledby", "sot-recent-hot-title");
    const hotHead = document.createElement("div");
    hotHead.className = "sot-recent-group-head";
    const hotTitle = createText("h3", "sot-recent-group-title", "인기 대회");
    hotTitle.id = "sot-recent-hot-title";
    hotHead.appendChild(hotTitle);
    hotHead.appendChild(createText("span", "sot-recent-hot-badge", "HOT"));
    hotSection.appendChild(hotHead);
    const hotList = document.createElement("div");
    hotList.className = "sot-recent-hot-list";
    hotEvents.forEach((race, index) => hotList.appendChild(createHotCard(race, index)));
    hotSection.appendChild(hotList);
    panel.appendChild(hotSection);

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
      panel.appendChild(pastSection);
    }

    root.appendChild(panel);

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
      if (selectRaceByCode(card.dataset.eventCode)) scrollSearchInputsIntoView();
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
            course_info: item.event_course_info ?? item.course_info ?? "",
            name_search_enabled: item.name_search_enabled === true,
            bib_min_digits: Number(item.bib_min_digits) === 3 ? 3 : 4,
            home_visible: item.home_visible === true ? true : (item.home_visible === false ? false : null),
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

      hideEventSuggestions();
      renderRecentEvents();

    } catch (err) {
      console.error("[System] loadRacesFromBubble error.", err);
      racesAll = [];
      races = [];
      hideEventSuggestions();
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
    if (e.key === "Escape") {
      hideEventSuggestions();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const exact = races.find(race => race.name === (eventInput.value || "").trim());
      const selected = exact || eventMatches[0];
      if (selected) selectRaceByCode(selected.id);
      else focusBib();
      hideEventSuggestions();
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
