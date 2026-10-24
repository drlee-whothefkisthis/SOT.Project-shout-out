try {
(function () {
  var UPLOAD_NOTICE_ENABLED = true;
  var SEARCH_GUIDE_ENABLED = true;
  var SEARCH_GUIDE_END_AT = Date.parse("2026-09-24T00:00:00+09:00");
  var UPLOAD_NOTICE_EVENTS_ENDPOINT = "https://plp-62309.bubbleapps.io/api/1.1/obj/event";
  var UPLOAD_NOTICE_REFRESH_MS = 5 * 60 * 1000;
  var HOUR_MS = 60 * 60 * 1000;
  var DAY_MS = 24 * HOUR_MS;
  var KST_OFFSET_MS = 9 * HOUR_MS;
  var UPLOAD_EXTRA_HOURS = 3;
  // Confirmed operational completion; shared by the banner and pre-gallery notice.
  var UPLOAD_NOTICE_COMPLETED_AT = {
    "261024-sa": Date.parse("2026-10-24T10:34:00+09:00")
  };
  var UPLOAD_NOTICE_EVENTS = [];
  var uploadNoticeTickTimer = null;
  var uploadNoticeFetchInFlight = false;
  var uploadNoticeTestOffsetMs = null;

  function getUploadNoticeNow() {
    var now = Date.now();
    // Opt-in browser-only clock for the Webflow staging host. Never changes Event data.
    if (window.location.hostname !== "shotout.webflow.io") return now;
    if (uploadNoticeTestOffsetMs === null) {
      var testAt = Date.parse(new URLSearchParams(window.location.search).get("sot_upload_test_at") || "");
      uploadNoticeTestOffsetMs = Number.isFinite(testAt) ? testAt - now : 0;
    }
    return now + uploadNoticeTestOffsetMs;
  }

  function notifyUploadNoticeUpdate(now) {
    document.dispatchEvent(new CustomEvent("shout:upload-notice-updated", { detail: { now: now } }));
  }

  function detectKakaoInApp() {
    return /KAKAOTALK/i.test(navigator.userAgent || "");
  }

  function initKakaoInAppFlag() {
    var isKakao = detectKakaoInApp() ? "1" : "0";
    sessionStorage.setItem("is_kakao_inapp", isKakao);
    return isKakao;
  }

  function getCourseDurationHours(courses) {
    var names = (Array.isArray(courses) ? courses : []).map(function (course) {
      return String(course || "").trim().toLowerCase().replace(/\s+/g, "");
    });
    if (names.some(function (name) { return /full|풀|42(?:\.195)?k?/.test(name); })) return 5;
    if (names.some(function (name) { return /half|하프|21(?:\.0975)?k?/.test(name); })) return 3;
    if (names.some(function (name) { return /(?:10|5)(?:k|km|킬로|키로)/.test(name); })) return 2;
    return null;
  }

  function nextKstMidnight(timestamp) {
    return (Math.floor((timestamp + KST_OFFSET_MS) / DAY_MS) + 1) * DAY_MS - KST_OFFSET_MS;
  }

  function buildUploadNoticeEvent(item, now) {
    if (!item || item.is_public !== true || item.home_visible === false) return null;
    var startAt = Date.parse(item.event_date || "");
    var publishAt = item.publish_at ? Date.parse(item.publish_at) : NaN;
    var courseHours = getCourseDurationHours(item.course);
    var name = String(item.event_display_name || item.name || "").trim();
    var id = String(item.event_code || item.slug || "").trim();
    if (!id || !name || !Number.isFinite(startAt) || !courseHours) return null;
    if (Number.isFinite(publishAt) && publishAt > now) return null;
    // A date-only Event value appears as midnight KST; it is not a verified race start time.
    if ((startAt + KST_OFFSET_MS) % DAY_MS === 0) return null;
    var completeAt = startAt + (courseHours + UPLOAD_EXTRA_HOURS) * HOUR_MS;
    var confirmedCompleteAt = UPLOAD_NOTICE_COMPLETED_AT[id];
    if (Number.isFinite(confirmedCompleteAt) && confirmedCompleteAt >= startAt) {
      completeAt = Math.min(completeAt, confirmedCompleteAt);
    }
    return {
      id: id,
      name: name,
      startAt: startAt,
      progressStartAt: startAt + HOUR_MS,
      completeAt: completeAt,
      endAt: Math.max(nextKstMidnight(startAt), completeAt + HOUR_MS)
    };
  }

  function isUploadNoticeActive(now) {
    return UPLOAD_NOTICE_ENABLED && UPLOAD_NOTICE_EVENTS.some(function (event) {
      return now >= event.startAt && now < event.endAt;
    });
  }

  function getUploadNoticePercent(event, now) {
    if (now < event.startAt) return 0;
    if (now <= event.progressStartAt) return 1;
    if (now >= event.completeAt) return 100;
    return Math.max(1, Math.min(99, 1 + Math.round(
      ((now - event.progressStartAt) / (event.completeAt - event.progressStartAt)) * 99
    )));
  }

  function getActiveUploadNoticeEvent(race, now) {
    var current = Number.isFinite(now) ? now : getUploadNoticeNow();
    if (!UPLOAD_NOTICE_ENABLED || !race) return null;
    var id = String(race.id || race.event_code || "").trim();
    var name = String(race.name || race.event_display_name || race || "").replace(/\s+/g, "");

    var event = UPLOAD_NOTICE_EVENTS.find(function (item) {
      var matches = id ? item.id === id : item.name.replace(/\s+/g, "") === name;
      return matches && current >= item.startAt && current < item.completeAt;
    });

    if (!event) return null;
    return {
      id: event.id,
      name: event.name,
      percent: getUploadNoticePercent(event, current),
      startAt: event.startAt,
      progressStartAt: event.progressStartAt,
      completeAt: event.completeAt,
      endAt: event.endAt
    };
  }

  function escapeUploadNoticeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function syncUploadNoticeSpacing() {
    var banner = document.getElementById("shout-upload-notice");
    if (!banner) return;
    document.body.style.setProperty("--shout-upload-notice-height", banner.offsetHeight + "px");
  }

  function hideUploadNotice() {
    var banner = document.getElementById("shout-upload-notice");
    if (banner) banner.remove();
    document.body.classList.remove("has-shout-upload-notice");
    document.body.style.removeProperty("--shout-upload-notice-height");
    window.removeEventListener("resize", syncUploadNoticeSpacing);
  }

  function scheduleNextUploadNoticeUpdate(now, activeEvents) {
    if (uploadNoticeTickTimer) window.clearTimeout(uploadNoticeTickTimer);
    var next = Infinity;
    UPLOAD_NOTICE_EVENTS.forEach(function (event) {
      [event.startAt, event.progressStartAt, event.completeAt, event.endAt].forEach(function (time) {
        if (time > now && time < next) next = time;
      });
    });
    if (activeEvents.some(function (event) { return now < event.completeAt; })) {
      next = Math.min(next, Math.floor(now / 60000) * 60000 + 60000);
    }
    if (Number.isFinite(next)) {
      uploadNoticeTickTimer = window.setTimeout(updateUploadNotice, Math.min(next - now, 2147483647));
    }
  }

  function updateUploadNotice(now) {
    now = Number.isFinite(now) ? now : getUploadNoticeNow();
    var activeEvents = UPLOAD_NOTICE_EVENTS.filter(function (event) {
      return now >= event.startAt && now < event.endAt;
    }).sort(function (left, right) {
      return left.startAt - right.startAt || left.name.localeCompare(right.name, "ko");
    });
    if (!isUploadNoticeActive(now) || !activeEvents.length) {
      hideUploadNotice();
      scheduleNextUploadNoticeUpdate(now, activeEvents);
      notifyUploadNoticeUpdate(now);
      return false;
    }

    createUploadNotice();
    var list = document.getElementById("shout-upload-notice-list");
    if (!list) return false;

    list.innerHTML = activeEvents.map(function (event) {
      var percent = getUploadNoticePercent(event, now);
      var status = percent >= 100 ? "100% · 업로드 완료" : percent + "% 업로드";
      var name = escapeUploadNoticeHtml(event.name);
      return '<div class="shout-upload-notice-event">' +
        '<div class="shout-upload-notice-event-head">' +
          '<span class="shout-upload-notice-event-name">' + name + '</span>' +
          '<span class="shout-upload-notice-event-status">' + status + '</span>' +
        '</div>' +
        '<div class="shout-upload-notice-track" aria-label="' + name + ' 사진 업로드 진행률">' +
          '<span class="shout-upload-notice-fill" style="width:' + percent + '%"></span>' +
        '</div>' +
      '</div>';
    }).join("");
    syncUploadNoticeSpacing();
    scheduleNextUploadNoticeUpdate(now, activeEvents);
    notifyUploadNoticeUpdate(now);
    return true;
  }

  function createUploadNotice() {
    if (document.getElementById("shout-upload-notice")) return;

    var banner = document.createElement("div");
    banner.id = "shout-upload-notice";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    banner.innerHTML =
      '<div id="shout-upload-notice-inner">' +
        '<div id="shout-upload-notice-copy">' +
          '<p id="shout-upload-notice-title">사진 업로드 진행 중</p>' +
          '<p id="shout-upload-notice-desc">오늘 촬영 사진을 순차적으로 업로드하고 있어요.</p>' +
        '</div>' +
        '<div id="shout-upload-notice-list"></div>' +
      '</div>';

    document.body.appendChild(banner);
    document.body.classList.add("has-shout-upload-notice");
    window.addEventListener("resize", syncUploadNoticeSpacing);
  }

  async function refreshUploadNoticeEvents() {
    if (uploadNoticeFetchInFlight) return;
    uploadNoticeFetchInFlight = true;
    try {
      var results = [];
      var cursor = 0;
      var remaining;
      do {
        var response = await fetch(UPLOAD_NOTICE_EVENTS_ENDPOINT + "?limit=100&cursor=" + cursor, {
          method: "GET",
          cache: "no-store"
        });
        if (!response.ok) throw new Error("Event fetch failed: " + response.status);
        var page = (await response.json()).response || {};
        var batch = Array.isArray(page.results) ? page.results : [];
        results = results.concat(batch);
        cursor += batch.length;
        remaining = Number(page.remaining) || 0;
        if (remaining > 0 && !batch.length) throw new Error("Event pagination did not advance");
      } while (remaining > 0);

      var now = getUploadNoticeNow();
      UPLOAD_NOTICE_EVENTS = results.map(function (item) {
        return buildUploadNoticeEvent(item, now);
      }).filter(Boolean);
      updateUploadNotice();
    } catch (error) {
      console.error("[main] upload notice event refresh failed", error);
    } finally {
      uploadNoticeFetchInFlight = false;
    }
  }

  function isSearchGuideActive() {
    return SEARCH_GUIDE_ENABLED && Date.now() < SEARCH_GUIDE_END_AT;
  }

  function showSearchGuide(validationMessage) {
    if (!isSearchGuideActive() || document.getElementById("shout-search-guide")) return;

    var subject = encodeURIComponent("제19회 가평 자라섬 전국 마라톤 사진 검색 등록 요청");
    var body = encodeURIComponent("팀명 :\n배번호 :");
    var modal = document.createElement("section");
    modal.id = "shout-search-guide";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "shout-search-guide-title");
    modal.innerHTML =
      '<div id="shout-search-guide-inner">' +
        '<button type="button" id="shout-search-guide-close" aria-label="사진 검색 안내 닫기">×</button>' +
        '<div id="shout-search-guide-copy">' +
          '<p id="shout-search-guide-title">[사진 검색 안내]</p>' +
          '<p id="shout-search-guide-validation"><strong>' + validationMessage + '</strong></p>' +
          '<p id="shout-search-guide-desc"><strong>제19회 가평 자라섬 전국 마라톤</strong> 참가자 중 <strong>팀명 또는 특수 형식의 배번호</strong>를 사용하신 분들은 <strong>팀명과 배번호</strong>를 보내주시면 사진 검색이 가능하도록 등록해 드리겠습니다.</p>' +
        '</div>' +
        '<div id="shout-search-guide-actions">' +
          '<button type="button" id="shout-search-guide-dismiss">닫기</button>' +
          '<a id="shout-search-guide-mail" href="mailto:contact@plp.im?subject=' + subject + '&body=' + body + '">메일 전송</a>' +
        '</div>' +
      '</div>';

    var closeGuide = function () {
      modal.remove();
      document.body.classList.remove("has-shout-search-guide");
      document.removeEventListener("keydown", onKeyDown);
    };
    var onKeyDown = function (event) {
      if (event.key === "Escape") closeGuide();
    };

    modal.addEventListener("click", function (event) {
      if (event.target === modal || event.target.closest("#shout-search-guide-close, #shout-search-guide-dismiss")) {
        closeGuide();
      }
    });
    document.body.appendChild(modal);
    document.body.classList.add("has-shout-search-guide");
    document.addEventListener("keydown", onKeyDown);
    var closeButton = document.getElementById("shout-search-guide-close");
    if (closeButton) closeButton.focus();
  }

  function init() {
    initKakaoInAppFlag();
    refreshUploadNoticeEvents();
    window.setInterval(refreshUploadNoticeEvents, UPLOAD_NOTICE_REFRESH_MS);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        updateUploadNotice();
        refreshUploadNoticeEvents();
      }
    });
  }

  window.ShoutSearchGuide = {
    isActive: isSearchGuideActive,
    show: showSearchGuide
  };

  window.ShoutUploadNotice = {
    getActiveEvent: getActiveUploadNoticeEvent,
    now: getUploadNoticeNow,
    refresh: updateUploadNotice
  };

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
      // Do not let focus finish the scroll before the selected-card animation
      // begins. The click handler controls the final scroll position instead.
      try {
        bibInput.focus({ preventScroll: true });
      } catch (_) {
        bibInput.focus();
      }
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
    const desktopSmoothScroll = window.matchMedia &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scrollToPageTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: desktopSmoothScroll ? "smooth" : "instant" });
    };

    // Desktop clicks animate to the top; mobile keeps the native keyboard flow.
    // iOS may move the page as the keyboard opens, so restore the top position
    // when the visual viewport changes.
    const frame = requestAnimationFrame(scrollToPageTop);
    if (viewport) viewport.addEventListener("resize", scrollToPageTop);
    const cleanup = () => {
      cancelAnimationFrame(frame);
      if (viewport) viewport.removeEventListener("resize", scrollToPageTop);
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
    eventMatches = query ? matchingRaces(query) : races.slice(0, 8);
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

  eventInput.addEventListener("focus", () => {
    renderEventSuggestions();
  });

  eventInput.addEventListener("click", () => {
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
  const RECENT_EARLY_EXPOSURE_MS = 2 * 24 * 60 * 60 * 1000;
  let selectedPastMonth = "all";
  let expandedHotEventCode = "";
  let visiblePastCount = RECENT_PAST_PAGE_SIZE;

  function isHomeEvent(race) {
    return !!race && race.home_visible !== false;
  }

  function isSearchReadyEvent(race) {
    return !!race && races.some(item => item.id === race.id);
  }

  function isEarlyHomeEvent(race, now) {
    if (!isHomeEvent(race)) return false;
    if (!race.publish_at) return race.is_public === true;
    return race.publish_at.getTime() <= now.getTime() + RECENT_EARLY_EXPOSURE_MS;
  }

  function recentEventDay(race) {
    const parts = kstDateParts(race && race.event_date);
    return parts ? Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / 86400000 : -Infinity;
  }

  function compareRecentEvents(a, b) {
    const aGroup = Number.isInteger(a.recent_group) ? a.recent_group : Infinity;
    const bGroup = Number.isInteger(b.recent_group) ? b.recent_group : Infinity;
    if (aGroup !== bGroup) return aGroup - bGroup;
    const aParticipants = Number.isFinite(a.participant_count) ? a.participant_count : -1;
    const bParticipants = Number.isFinite(b.participant_count) ? b.participant_count : -1;
    if (aParticipants !== bParticipants) return bParticipants - aParticipants;
    const aDate = eventTimestamp(a);
    const bDate = eventTimestamp(b);
    if (aDate !== bDate) return bDate - aDate;
    return (a.name || "").localeCompare(b.name || "", "ko");
  }

  function sortRecentEvents(events) {
    const dates = Array.from(new Set(events.map(recentEventDay).filter(Number.isFinite))).sort((a, b) => b - a);
    const groups = new Map();
    let group = -1;
    dates.forEach((day, index) => {
      if (index === 0 || dates[index - 1] - day > 1) group += 1;
      groups.set(day, group);
    });
    return events.map(race => ({ ...race, recent_group: groups.get(recentEventDay(race)) })).sort(compareRecentEvents);
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
    const courses = Array.isArray(race && race.course)
      ? race.course.map(value => String(value || "").trim()).filter(Boolean)
      : [];
    if (courses.length) return courses.join(", ");
    return String((race && race.course_info) || "").trim() || "코스 정보 준비 중";
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
    const searchReady = isSearchReadyEvent(race);
    if (displayRaceName(race).length >= 16) card.classList.add("has-long-title");
    card.dataset.searchReady = searchReady ? "true" : "false";
    if (!searchReady) {
      card.classList.add("is-search-pending");
      card.setAttribute("aria-label", `${race.name} 사진 검색 준비 중`);
    }
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
    card.appendChild(createText("span", "sot-recent-hot-card__cta", searchReady ? "사진 찾기 →" : "공개 예정"));
    return card;
  }

  function createPastCard(race) {
    const card = createEventLink(race, "sot-recent-past-card");
    card.dataset.month = eventMonthKey(race);
    const parts = kstDateParts(race.event_date);
    const thumb = document.createElement("span");
    thumb.className = "sot-recent-past-card__thumb";
    thumb.appendChild(createText("strong", "sot-recent-past-card__day", parts ? String(Number(parts.day)) : "--"));
    thumb.appendChild(createText("span", "sot-recent-past-card__month", parts ? `${Number(parts.month)}월` : ""));
    const copy = document.createElement("span");
    copy.className = "sot-recent-past-card__copy";
    copy.appendChild(createText("strong", "sot-recent-past-card__title", displayRaceName(race)));
    copy.appendChild(createText("span", "sot-recent-past-card__course", eventCourseInfo(race)));
    const arrow = createText("div", "arrow", "›");
    arrow.setAttribute("aria-hidden", "true");
    card.appendChild(thumb);
    card.appendChild(copy);
    card.appendChild(arrow);
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

    const now = new Date();
    const homeEvents = sortRecentEvents(racesAll.filter(race => isEarlyHomeEvent(race, now)));
    const searchableHomeEvents = races.filter(isHomeEvent);
    if (!homeEvents.length && !searchableHomeEvents.length) {
      renderRecentStatus("선택할 수 있는 대회를 준비 중입니다.", "empty");
      return;
    }

    const newestGroup = homeEvents.filter(race => race.recent_group === 0);
    const hotEvents = newestGroup.length >= RECENT_HOT_COUNT
      ? newestGroup
      : homeEvents.slice(0, RECENT_HOT_COUNT);
    const hotCodes = new Set(hotEvents.map(race => race.id));
    const pastEvents = searchableHomeEvents
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
    const hotTitle = createText("h3", "sot-recent-hot-heading", "인기 대회");
    hotTitle.id = "sot-recent-hot-title";
    hotHead.appendChild(hotTitle);
    hotHead.appendChild(createText("span", "sot-recent-hot-badge", "HOT"));
    hotSection.appendChild(hotHead);
    const hotList = document.createElement("div");
    hotList.className = "sot-recent-hot-list";
    if (!hotEvents.some(race => race.id === expandedHotEventCode)) {
      expandedHotEventCode = hotEvents[0].id;
    }
    hotEvents.forEach((race, index) => {
      const card = createHotCard(race, index);
      card.classList.toggle("is-expanded", race.id === expandedHotEventCode);
      hotList.appendChild(card);
    });
    hotSection.appendChild(hotList);
    panel.appendChild(hotSection);

    if (pastEvents.length) {
      const pastSection = document.createElement("section");
      pastSection.className = "sot-recent-past";
      pastSection.setAttribute("aria-labelledby", "sot-recent-past-title");
      const pastHead = document.createElement("div");
      pastHead.className = "sot-recent-group-head";
      const pastTitle = createText("h3", "sot-recent-past-heading", "지난 대회");
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

    const keepExpandedCard = event => {
      if (!window.matchMedia("(min-width:768px)").matches) return;
      if (event.type === "pointerover" && (event.pointerType !== "mouse" || !window.matchMedia("(hover:hover)").matches)) return;
      const card = event.target.closest(".sot-recent-hot-card");
      if (!card || !root.contains(card)) return;
      if (expandedHotEventCode === card.dataset.eventCode) return;
      expandedHotEventCode = card.dataset.eventCode;
      root.querySelectorAll(".sot-recent-hot-card").forEach(item => {
        item.classList.toggle("is-expanded", item === card);
      });
    };
    root.addEventListener("pointerover", keepExpandedCard);
    root.addEventListener("focusin", keepExpandedCard);

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
      if (card.dataset.searchReady === "false") {
        alert("아직 사진 검색 준비 중인 대회입니다. 공개 후 검색할 수 있습니다.");
        return;
      }
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
          const course = Array.isArray(item.course) ? item.course : [];

          if (!event_code) return null;

          return {
            name: event_display_name,
            id: event_code,
            is_public,
            publish_at,
            event_date,
            course,
            course_info: item.event_course_info ?? item.course_info ?? "",
            name_search_enabled: item.name_search_enabled === true,
            bib_min_digits: Number.isInteger(Number(item.bib_min_digits)) && Number(item.bib_min_digits) > 0
              ? Number(item.bib_min_digits)
              : 4,
            home_visible: item.home_visible === true ? true : (item.home_visible === false ? false : null),
            home_rank: item.home_rank ?? item.hot_rank ?? null,
            home_score: item.home_score ?? item.hot_score ?? item.popularity_score ?? null,
            home_priority: item.home_priority ?? null,
            participant_count: Number.isFinite(Number(item.people)) && item.people !== "" && item.people != null
              ? Number(item.people)
              : null
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

      if (document.activeElement === eventInput) renderEventSuggestions();
      else hideEventSuggestions();
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
    const name = String(value || "").trim();
    return /^[가-힣]+(?: [가-힣]+)*$/.test(name) && name.replace(/ /g, "").length >= 2;
  }

  function isEnglishNameSearchQuery(value) {
    const name = String(value || "").trim();
    return /^[A-Za-z]+(?:(?:\s*&\s*|\s+)[A-Za-z]+)*$/.test(name) && name.replace(/[^A-Za-z]/g, "").length >= 2;
  }

  function isMixedKoreanNumericSearchQuery(value) {
    const query = String(value || "").trim();
    return /^(?=.*[가-힣])(?=.*\d)[가-힣\d]+(?: [가-힣\d]+)*$/.test(query) &&
      query.replace(/[^가-힣]/g, "").length >= 2;
  }

  function isTextSearchQuery(value) {
    return isNameSearchQuery(value) || isEnglishNameSearchQuery(value) || isMixedKoreanNumericSearchQuery(value);
  }

  function isNameSearchEnabledForEvent(eventCode) {
    const race = getRaceByCode(eventCode);
    return !!(race && race.name_search_enabled === true);
  }

  function bibMinDigitsForEvent(eventCode) {
    const race = getRaceByCode(eventCode);
    const digits = Number(race && race.bib_min_digits);
    return Number.isInteger(digits) && digits > 0 ? digits : 4;
  }

  function bibSearchHelpText(eventCode) {
    return `배번호는 ${bibMinDigitsForEvent(eventCode)}자리 이상, 이름은 한글 또는 영문 2글자 이상 입력해주세요.`;
  }

  function showBibSearchHelp(eventCode) {
    const race = getRaceByCode(eventCode);
    const isGapyeongEvent = /가평\s*자라섬/.test(String(race && race.name || ""));
    const guide = window.ShoutSearchGuide;
    const message = bibSearchHelpText(eventCode);

    if (isGapyeongEvent && guide && guide.isActive()) {
      guide.show(message);
      return;
    }

    alert(message);
  }

  function showGalleryUploadNoticeBeforeNavigation(eventCode, targetUrl) {
    const race = getRaceByCode(eventCode);
    const notice = window.ShoutUploadNotice;
    const now = notice && typeof notice.now === "function" ? notice.now() : Date.now();
    const activeEvent = notice && typeof notice.getActiveEvent === "function"
      ? notice.getActiveEvent(race, now)
      : null;

    if (!activeEvent) return false;

    const existing = document.getElementById("main-gallery-upload-notice");
    if (existing) return true;
    if (typeof notice.refresh === "function") notice.refresh(now);

    const modal = document.createElement("section");
    modal.id = "main-gallery-upload-notice";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "main-gallery-upload-notice-title");
    modal.innerHTML =
      '<div class="main-gallery-upload-notice__panel">' +
        '<div class="main-gallery-upload-notice__status"><span class="main-gallery-upload-notice__dot" aria-hidden="true"></span>사진 업로드 진행 중<span class="main-gallery-upload-notice__percent" aria-live="polite">' + activeEvent.percent + '%</span></div>' +
        '<h2 id="main-gallery-upload-notice-title">더 멋진 사진들이<br>계속 업로드되고 있어요</h2>' +
        '<p class="main-gallery-upload-notice__desc">지금 올라온 사진을 먼저 둘러보세요.<br>곧 추가될 사진들도 기대해 주세요!</p>' +
        '<button type="button" class="main-gallery-upload-notice__confirm">갤러리 확인하기</button>' +
      '</div>';

    const closeNotice = function () {
      modal.remove();
      document.body.classList.remove("has-main-gallery-upload-notice");
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("shout:upload-notice-updated", onUploadUpdate);
    };
    const onKeyDown = function (event) {
      if (event.key === "Escape") closeNotice();
    };
    const onUploadUpdate = function (event) {
      const currentEvent = notice.getActiveEvent(race, event.detail.now);
      if (!currentEvent) {
        closeNotice();
        return;
      }
      const percent = modal.querySelector(".main-gallery-upload-notice__percent");
      if (percent) percent.textContent = currentEvent.percent + "%";
    };

    modal.addEventListener("click", function (event) {
      if (event.target === modal) {
        closeNotice();
        return;
      }
      if (event.target.closest(".main-gallery-upload-notice__confirm")) {
        closeNotice();
        window.location.href = targetUrl;
      }
    });

    document.body.appendChild(modal);
    document.body.classList.add("has-main-gallery-upload-notice");
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("shout:upload-notice-updated", onUploadUpdate);
    window.requestAnimationFrame(function () {
      const confirmButton = modal.querySelector(".main-gallery-upload-notice__confirm");
      if (confirmButton) confirmButton.focus();
    });
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
      alert("배번호를 입력해주세요.");
      return;
    }

    if (isBlockedSearchQuery(bibVal)) {
      showBlockedSearchAlert();
      bibInput.focus();
      return;
    }

    if (!isValidBibQuery(bibVal, eventId)) {
      showBibSearchHelp(eventId);
      return;
    }

    if (isTextSearchQuery(bibVal) && !isNameSearchEnabledForEvent(eventId)) {
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
    if (showGalleryUploadNoticeBeforeNavigation(eventId, targetUrl)) return;
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
    if (isTextSearchQuery(v)) return true;
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
        showBibSearchHelp(eventId);
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
        showBibSearchHelp(eventId);
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
