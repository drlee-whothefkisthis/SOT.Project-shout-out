(function(){

  const $ = (s, root=document) => root.querySelector(s);
  const escapeHtml = (s) => String(s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const KST_TIME_ZONE = "Asia/Seoul";

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function getKSTParts(date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: KST_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).formatToParts(date);

    const map = {};
    parts.forEach(part => {
      if (part.type !== "literal") map[part.type] = part.value;
    });

    return map;
  }

  function nowISO() {
    const parts = getKSTParts(new Date());
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }

  function formatKSTDate(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const parts = getKSTParts(date);
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function kstDateKeyFromValue(value) {
    const kstDate = formatKSTDate(value);
    if (!kstDate) return null;

    const key = Number(kstDate.replaceAll("-", ""));
    return Number.isFinite(key) ? key : null;
  }

  function getTodayKSTKey() {
    const parts = getKSTParts(new Date());
    return Number(`${parts.year}${parts.month}${parts.day}`);
  }

  function kstDateInputToISO(value) {
    if (!value) return null;
    return new Date(`${value}T00:00:00+09:00`).toISOString();
  }

  function kstDateTimeInputToISO(value) {
    if (!value) return null;
    return new Date(`${value}:00+09:00`).toISOString();
  }

  function eventDateInputValue(value) {
    return formatKSTDate(value);
  }

  function eventDateTimeInputValue(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const parts = getKSTParts(date);
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }

  function parsePeopleInput(value) {
    const text = String(value || "").replace(/,/g, "").trim();
    if (!text) return null;
    const n = Number(text);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function applyPeoplePayload(payload, value) {
    const people = parsePeopleInput(value);
    if (people !== null) payload.people = people;
  }

  function sortEventsByDate(list) {
    const todayKey = getTodayKSTKey();

    const normalized = (list || []).map((ev, index) => ({
      ev,
      index,
      key: kstDateKeyFromValue(ev.event_date)
    }));

    const noDate = normalized.filter(item => item.key === null);

    const upcoming = normalized
      .filter(item => item.key !== null && item.key >= todayKey)
      .sort((a, b) => {
        if (a.key !== b.key) return a.key - b.key;
        return a.index - b.index;
      });

    const past = normalized
      .filter(item => item.key !== null && item.key < todayKey)
      .sort((a, b) => {
        if (a.key !== b.key) return b.key - a.key;
        return a.index - b.index;
      });

    return [
      ...upcoming,
      ...past,
      ...noDate
    ].map(item => item.ev);
  }

  const BUBBLE_API_BASE = "https://plp-62309.bubbleapps.io"; 
  const API_CREATE_EVENT = "/api/1.1/wf/auto-create-event";
  const API_DATA_EVENT = "/api/1.1/obj/event";
  const API_AUTH_LOGIN = "/api/1.1/wf/auth-kakao-login"; 
  const SOT_HEAD = window.SotAdminHead;
  if (!SOT_HEAD) {
    console.error("[SOT Dashboard] head helper not loaded");
    return;
  }

  let allEvents = [];
  let activeAdminView = "events";
  let activeEventMonth = getKSTMonthKey(new Date());
  let editingEventId = "";
  let sotDashActiveSection = "overview";
  let sotDashActiveTab = "summary";
  let sotDashDatasetFilter = "legacy";
  let sotDashEventFilter = "all";
  let sotDashPeriodFilter = "legacy_window";
  let sotDashSourceFilter = "all";
  let sotDashFetchCount = 0;
  let sotDashSelectedDateKey = "";
  let sotDashboardRawRows = [];
  let sotDashboardRows = [];
  let sotDashboardByAggType = {};
  let sotDashData = SOT_HEAD.emptyDashboardData();
  let sotDashLoading = false;
  let sotDashLoaded = false;
  let sotDashLastError = "";

  const SOT_DASH_SECTIONS = SOT_HEAD.dashboardSections;
  const numberValue = SOT_HEAD.numberValue;
  const averageExposure = SOT_HEAD.averageExposure;
  const rateValue = SOT_HEAD.rateValue;
  const safeRate = SOT_HEAD.safeRate;
  const rangeLabel = SOT_HEAD.rangeLabel;
  const formatNumber = SOT_HEAD.formatNumber;
  const formatWon = SOT_HEAD.formatWon;
  const formatPercent = SOT_HEAD.formatPercent;

  function initUI(){

    const mount = document.createElement("div");
    mount.className = "sh-admin-wrap";
    mount.innerHTML = `
      <header class="sh-admin-hero">
        <div>
          <div class="sh-admin-eyebrow">SOT Data API Admin Console</div>
          <h1 class="sh-admin-title">Shout-out Admin Dashboard</h1>
          <p class="sh-admin-sub">대회 관리, 검색, 구매, 스팟, 코스, 노출 품질을 한 화면에서 확인합니다.</p>
        </div>
        <div class="sh-admin-status-card">
          <div><b id="sh_hero_status">상태: 대기 중</b></div>
          <div>마지막 업데이트: <span id="sh_hero_updated">DB 탭에서 조회</span></div>
          <div>Data API: <span id="sh_hero_snapshot_key">SOT:Dashboard</span></div>
        </div>
      </header>

      <div class="sh-admin-tabs" role="tablist" aria-label="Admin views">
        <button class="sh-admin-tab is-active" type="button" data-admin-view="events" aria-selected="true">대회 관리</button>
        <button class="sh-admin-tab" type="button" data-admin-view="database" aria-selected="false">DB 분석</button>
      </div>

      <section class="sh-admin-panel" data-admin-panel="events">
        <div class="sh-card">
          <div class="sh-row">
            <div class="sh-col"><label class="sh-label">대회 날짜</label><input class="sh-input" type="date" id="sh_event_date"></div>
            <div class="sh-col"><label class="sh-label">디스플레이 네임</label><input class="sh-input" type="text" id="sh_display_name"></div>
            <div class="sh-col"><label class="sh-label">event_code</label><input class="sh-input" type="text" id="sh_event_code"></div>
          </div>
          <div class="sh-divider"></div>
          <div class="sh-row">
            <div class="sh-col"><label class="sh-label">노출 시작</label><input class="sh-input" type="datetime-local" id="sh_publish_at"></div>
            <div class="sh-col"><label class="sh-label">참가자 수</label><input class="sh-input" type="text" id="sh_people" inputmode="numeric" placeholder="예: 3800"></div>
            <div class="sh-col">
              <label class="sh-label">배번호 타입</label>
              <select class="sh-select" id="sh_name_search_enabled">
                <option value="false">넘버링</option>
                <option value="true">이름+넘버링</option>
              </select>
            </div>
          </div>
          <button class="sh-btn primary" id="sh_btn_create_event">신규 대회 생성</button>
        </div>

        <div class="sh-event-filter">
          <select class="sh-select" id="sh_month_filter"></select>
          <input class="sh-input" type="text" id="sh_search" placeholder="이름 또는 코드로 검색...">
          <button class="sh-btn-sm" id="sh_btn_refresh" type="button">새로고침</button>
          <span class="sh-chip" id="sh_count">0건</span>
        </div>

        <table class="sh-table">
          <thead>
            <tr>
              <th>날짜</th>
              <th>디스플레이 / 코드</th>
              <th>참가자 수</th>
              <th>배번호 타입</th>
              <th>공개여부</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody id="sh_tbody"></tbody>
        </table>
      </section>

      <section class="sh-admin-panel is-hidden" data-admin-panel="database" hidden>
        <div class="sot-admin-dashboard" id="sot_admin_dashboard">
          <aside class="sot-dash-sidebar" aria-label="SOT dashboard menu">
            <div class="sot-dash-logo">Shout-out Dashboard</div>
            <div class="sot-dash-side-note">Bubble Data API<br>SOT:Dashboard rows</div>
            <nav class="sot-dash-nav" id="sot_dash_nav"></nav>
          </aside>
          <main class="sot-dash-main">
            <div class="sot-dash-topbar">
              <div>
                <h2 class="sot-dash-title" id="sot_dash_title">전체 현황</h2>
                <p class="sot-dash-desc" id="sot_dash_desc">전체 KPI, 퍼널, 검색/노출과 주의 항목을 탭으로 확인합니다.</p>
              </div>
              <div class="sot-dash-filters">
                <div class="sot-dash-tabs compact" role="tablist" aria-label="dashboard source">
                  <button class="sot-dash-tab is-active" type="button" data-sot-dataset="legacy">레거시 집계</button>
                  <button class="sot-dash-tab" type="button" data-sot-dataset="operational">운영 집계</button>
                </div>
                <select class="sh-select" id="sot_dash_event_filter"></select>
                <select class="sh-select" id="sot_dash_period_filter">
                  <option value="legacy_window" selected>Legacy 6/7~6/13</option>
                  <option value="today">오늘</option>
                  <option value="last_7_days">최근 7일</option>
                  <option value="this_month">이번 달</option>
                  <option value="all">전체</option>
                </select>
                <select class="sh-select" id="sot_dash_source_filter"></select>
              </div>
            </div>
            <div class="sot-dash-content" id="sot_dash_content"></div>
          </main>
        </div>
      </section>
    `;
    
    document.body.prepend(mount);
    $("#sh_publish_at").value = nowISO();

    bindEvents();
    fetchData();
    initSotDashboard();
  }

  async function fetchData() {
    $("#sh_tbody").innerHTML = "<tr><td colspan='6' style='text-align:center;'>로드 중...</td></tr>";
    try {
      const res = await fetch(BUBBLE_API_BASE + API_DATA_EVENT);
      const data = await res.json();
      allEvents = data.response.results || [];
      syncMonthFilterOptions();
      applyEventFilters();
      if (sotDashLoaded) {
        rebuildSotDashboardData(selectedDashboardEventCode());
        syncSotDashboardFilters();
        renderSotDashboard();
      }
    } catch(e) { $("#sh_tbody").innerHTML = "<tr><td colspan='6' style='color:red;'>로드 실패</td></tr>"; }
  }

  function getKSTMonthKey(value) {
    const formatted = formatKSTDate(value);
    return formatted ? formatted.slice(0, 7) : "";
  }

  function monthLabel(monthKey) {
    if (!monthKey) return "월 미지정";
    const parts = monthKey.split("-");
    return parts[0] + "년 " + String(Number(parts[1])) + "월";
  }

  function syncMonthFilterOptions() {
    const select = $("#sh_month_filter");
    if (!select) return;

    const currentMonth = getKSTMonthKey(new Date());
    const monthKeys = Array.from(new Set(
      allEvents
        .map(ev => getKSTMonthKey(ev && ev.event_date))
        .filter(Boolean)
    )).sort().reverse();

    if (!monthKeys.includes(currentMonth)) monthKeys.unshift(currentMonth);
    if (activeEventMonth !== "all" && !monthKeys.includes(activeEventMonth)) activeEventMonth = currentMonth;

    select.innerHTML = [
      `<option value="all">전체 월</option>`,
      ...monthKeys.map(key => `<option value="${escapeHtml(key)}">${escapeHtml(monthLabel(key))}</option>`)
    ].join("");
    select.value = activeEventMonth;
  }

  function applyEventFilters() {
    const q = String(($("#sh_search") && $("#sh_search").value) || "").trim().toLowerCase();
    const month = activeEventMonth || "all";
    const filtered = allEvents.filter(ev => {
      const matchesQuery =
        !q ||
        (ev.event_display_name || "").toLowerCase().includes(q) ||
        (ev.event_code || "").toLowerCase().includes(q);
      const matchesMonth =
        month === "all" ||
        getKSTMonthKey(ev && ev.event_date) === month;
      return matchesQuery && matchesMonth;
    });
    render(filtered);
  }

  function isNameSearchEnabled(ev) {
    return ev && (
      ev.name_search_enabled === true ||
      ev.name_search_enabled === "true" ||
      ev.name_search_enabled === "yes"
    );
  }

  function render(list) {
    const sortedList = sortEventsByDate(list);

    $("#sh_count").textContent = sortedList.length + "건";
    $("#sh_tbody").innerHTML = sortedList.map(ev => editingEventId === ev._id ? eventEditRow(ev) : eventViewRow(ev)).join("");
  }

  function eventViewRow(ev) {
    return `
      <tr>
        <td>${escapeHtml(formatKSTDate(ev.event_date))}</td>
        <td>
          <strong>${escapeHtml(ev.event_display_name || ev.display_name)}</strong><br>
          <small style="color:#999">${escapeHtml(ev.event_code)}</small>
        </td>
        <td>${eventPeople(ev.event_code) ? formatNumber(eventPeople(ev.event_code)) : "미입력"}</td>
        <td>
          <button class="sh-btn-sm ${isNameSearchEnabled(ev) ? 'pub' : 'priv'}" onclick="toggleNameSearch('${ev._id}', ${isNameSearchEnabled(ev)})">
            ${isNameSearchEnabled(ev) ? "이름+넘버링" : "넘버링"}
          </button>
        </td>
        <td>
          <button class="sh-btn-sm ${ev.is_public ? 'pub' : 'priv'}" onclick="togglePublic('${ev._id}', ${ev.is_public})">
            ${ev.is_public ? "공개" : "비공개"}
          </button>
        </td>
        <td>
          <button class="sh-btn-sm" type="button" onclick="editEvent('${ev._id}')">수정</button>
          <button class="sh-btn-sm danger" onclick="deleteEvent('${ev._id}')">삭제</button>
        </td>
      </tr>
    `;
  }

  function eventEditRow(ev) {
    return `
      <tr>
        <td><input class="sh-input" type="date" id="edit_event_date_${ev._id}" value="${escapeHtml(eventDateInputValue(ev.event_date))}"></td>
        <td>
          <input class="sh-input" type="text" id="edit_display_name_${ev._id}" value="${escapeHtml(ev.event_display_name || ev.display_name || "")}" placeholder="디스플레이 네임">
          <div style="height:8px"></div>
          <input class="sh-input" type="text" id="edit_event_code_${ev._id}" value="${escapeHtml(ev.event_code || "")}" placeholder="event_code">
        </td>
        <td><input class="sh-input" type="text" inputmode="numeric" id="edit_people_${ev._id}" value="${escapeHtml(ev.people ?? "")}" placeholder="미입력"></td>
        <td>
          <select class="sh-select" id="edit_name_search_enabled_${ev._id}">
            <option value="false" ${isNameSearchEnabled(ev) ? "" : "selected"}>넘버링</option>
            <option value="true" ${isNameSearchEnabled(ev) ? "selected" : ""}>이름+넘버링</option>
          </select>
        </td>
        <td>
          <select class="sh-select" id="edit_is_public_${ev._id}">
            <option value="false" ${ev.is_public ? "" : "selected"}>비공개</option>
            <option value="true" ${ev.is_public ? "selected" : ""}>공개</option>
          </select>
          <div style="height:8px"></div>
          <input class="sh-input" type="datetime-local" id="edit_publish_at_${ev._id}" value="${escapeHtml(eventDateTimeInputValue(ev.publish_at))}">
        </td>
        <td>
          <button class="sh-btn-sm pub" type="button" onclick="saveEventEdit('${ev._id}')">저장</button>
          <button class="sh-btn-sm" type="button" onclick="cancelEventEdit()">취소</button>
        </td>
      </tr>
    `;
  }

  function syncAdminView() {
    document.querySelectorAll("[data-admin-view]").forEach(btn => {
      const isActive = btn.dataset.adminView === activeAdminView;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    document.querySelectorAll("[data-admin-panel]").forEach(panel => {
      const isActive = panel.dataset.adminPanel === activeAdminView;
      panel.classList.toggle("is-hidden", !isActive);
      panel.hidden = !isActive;
    });
  }

  function initSotDashboard() {
    renderSotDashNav();
    syncSotDashboardFilters();
    renderSotDashboard();
    loadDashboard();
  }

  async function loadDashboard() {
    if (sotDashLoading) return;

    sotDashLoading = true;
    sotDashLastError = "";
    setSotDashboardStatus("SOT:Dashboard 데이터를 불러오는 중입니다.");
    renderSotDashboard();

    try {
      sotDashFetchCount += 1;
      const rows = await SOT_HEAD.fetchAllDashboardRows(BUBBLE_API_BASE, "");
      sotDashboardRawRows = rows;
      const displayRows = rebuildSotDashboardData(selectedDashboardEventCode());
      sotDashLoaded = true;
      syncSotDashboardFilters();
      setSotDashboardStatus("SOT:Dashboard 로드 완료");

      const byAggType = Object.fromEntries(Object.entries(sotDashboardByAggType).map(([key, value]) => [key, value.length]));
      const selectedEventCode = selectedDashboardEventCode() || "all";
      const selectedEventHourRows = (sotDashboardByAggType.event_hour || []).filter(row => selectedEventCode === "all" || row.event_code === selectedEventCode);
      const selectedStateRow = (sotDashboardByAggType.state || []).find(row => selectedEventCode !== "all" && row.event_code === selectedEventCode) || (selectedEventCode === "all" ? sotDashData.state : null);
      console.log("[SOT Dashboard] fetch count", sotDashFetchCount);
      console.log("[SOT Dashboard] fetched raw rows", rows.length);
      console.log("[SOT Dashboard] cached raw rows count", sotDashboardRawRows.length);
      console.log("[SOT Dashboard] loaded total rows", displayRows.length);
      console.log("[SOT Dashboard] data_source row count", SOT_HEAD.countBy(displayRows, row => row.data_source || "empty"));
      console.log("[SOT Dashboard] agg_type row count", byAggType);
      console.log("[SOT Dashboard] selected event_code", selectedEventCode);
      console.log("[SOT Dashboard] selected period", sotDashPeriodFilter);
      console.log("[SOT Dashboard] filtered rows count", displayRows.length);
      console.log("[SOT Dashboard] event options count", (sotDashData.events || []).length);
      console.log("[SOT Dashboard] selected event_code event_hour sum", SOT_HEAD.aggregateRows(selectedEventHourRows));
      console.log("[SOT Dashboard] selected event_code state row", selectedStateRow || null);
      console.log("[SOT Dashboard] overview daily revenue rows", (sotDashData.daily || []).map(row => ({ date_key: row.date_key || row.period_key, revenue: row.revenue })));
      console.log("[SOT Dashboard] period hourly rows count", (sotDashData.hourly || []).length);
      console.log("[SOT Dashboard] cache mode", "initial fetch complete; event/period/tab changes reuse cached rows");
      if (!sotDashData.state || !Object.keys(sotDashData.state).length) console.warn("[SOT Dashboard] state row not found");
    } catch (e) {
      sotDashLastError = e && e.message ? e.message : "SOT:Dashboard 로드 실패";
      console.error("[SOT Dashboard] load failed", e);
      setSotDashboardStatus(sotDashLastError, true);
      sotDashData = SOT_HEAD.emptyDashboardData();
    } finally {
      sotDashLoading = false;
      renderSotDashboard();
    }
  }

  function setSotDashboardStatus(message, isError) {
    const hero = $("#sh_hero_status");
    const updated = $("#sh_hero_updated");
    const endpoint = $("#sh_hero_snapshot_key");
    if (hero && message) {
      hero.textContent = "상태: " + message;
      hero.classList.toggle("is-error", Boolean(isError));
    }
    if (updated && !isError) updated.textContent = new Date().toLocaleString("ko-KR", { timeZone: KST_TIME_ZONE });
    if (endpoint) endpoint.textContent = SOT_HEAD.dashboardDataApiPath(window.location.pathname);
  }

  function rebuildSotDashboardData(eventCode) {
    const displayRows = SOT_HEAD.filterDashboardRowsByPeriod(sotDashboardRawRows, sotDashPeriodFilter);
    sotDashboardRows = displayRows;
    sotDashboardByAggType = SOT_HEAD.groupByAggType(displayRows);
    sotDashData = SOT_HEAD.buildDashboardData(displayRows, sotDashboardByAggType, eventCode || selectedDashboardEventCode());
    ensureSelectedDateKey();
    return displayRows;
  }

  function logDashboardCacheRebuild(reason) {
    const selectedEventCode = selectedDashboardEventCode() || "all";
    console.log("[SOT Dashboard] cache rebuild", {
      reason,
      fetch_count: sotDashFetchCount,
      cached_raw_rows_count: sotDashboardRawRows.length,
      selected_event_code: selectedEventCode,
      selected_period: sotDashPeriodFilter,
      filtered_rows_count: sotDashboardRows.length,
      event_options_count: (sotDashData.events || []).length,
      api_refetch: false
    });
  }

  function selectedDashboardEventCode() {
    return sotDashEventFilter === "all" ? "" : sotDashEventFilter;
  }

  function renderSotDashNav() {
    const target = $("#sot_dash_nav");
    if (!target) return;
    let currentGroup = "";
    target.innerHTML = SOT_DASH_SECTIONS.map(section => {
      const group = section.group || "";
      const groupLabel = group && group !== currentGroup ? `<div class="sot-dash-nav-group">${escapeHtml(group)}</div>` : "";
      currentGroup = group || currentGroup;
      return `${groupLabel}
        <button class="sot-dash-nav-btn ${section.id === sotDashActiveSection ? 'is-active' : ''}" type="button" data-sot-section="${escapeHtml(section.id)}">
          ${escapeHtml(section.label)}
        </button>`;
    }).join("");
  }

  function syncSotDashboardFilters() {
    const eventSelect = $("#sot_dash_event_filter");
    if (eventSelect) {
      eventSelect.innerHTML = sotDashData.events.map(ev => `<option value="${escapeHtml(ev.event_code)}">${escapeHtml(ev.event_name)}</option>`).join("");
      if (!sotDashData.events.some(ev => ev.event_code === sotDashEventFilter)) sotDashEventFilter = "all";
      eventSelect.value = sotDashEventFilter;
    }

    const sourceSelect = $("#sot_dash_source_filter");
    if (sourceSelect) {
      const sources = Array.from(new Set(sotDashData.sources.map(row => row.utm_source || row.label))).filter(Boolean);
      sourceSelect.innerHTML = [`<option value="all">전체 유입</option>`].concat(sources.map(source => `<option value="${escapeHtml(source)}">${escapeHtml(sourceLabel(source))}</option>`)).join("");
      if (sotDashSourceFilter !== "all" && !sources.includes(sotDashSourceFilter)) sotDashSourceFilter = "all";
      sourceSelect.value = sotDashSourceFilter;
    }

    const periodSelect = $("#sot_dash_period_filter");
    if (periodSelect) periodSelect.value = sotDashPeriodFilter;

    document.querySelectorAll("[data-sot-dataset]").forEach(btn => {
      const active = btn.dataset.sotDataset === sotDashDatasetFilter;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function currentDashEvent() {
    const state = sotDashData.state || {};
    const selected = sotDashEventFilter === "all"
      ? state
      : (sotDashData.event_summaries || []).find(row => row.event_code === sotDashEventFilter) || state;
    if (sotDashEventFilter === "all") return {
      event_code: "all",
      event_name: "전체 대회",
      people: dashboardPeopleForSelection("all"),
      sessions: numberValue(state, ["visit_count", "session_count"]),
      searches: numberValue(state, ["search_count"]),
      carts: numberValue(state, ["cart_count"]),
      cart_photo_count: numberValue(state, ["cart_photo_count"]),
      purchases: numberValue(state, ["purchase_count"]),
      purchase_photo_count: numberValue(state, ["purchase_photo_count", "sold_photo_count", "sold_photo"]),
      exposure_sum: numberValue(state, ["exposure_sum"]),
      exposure_count: numberValue(state, ["exposure_count"]),
      zero_exposure_count: numberValue(state, ["zero_exposure_count"]),
      revenue: numberValue(state, ["revenue"])
    };
    const option = sotDashData.events.find(ev => ev.event_code === sotDashEventFilter) || {};
    return {
      ...option,
      ...selected,
      event_code: sotDashEventFilter,
      event_name: option.event_name || selected.event_name || sotDashEventFilter,
      people: dashboardPeopleForSelection(sotDashEventFilter),
      sessions: numberValue(selected, ["visit_count", "session_count"]),
      searches: numberValue(selected, ["search_count"]),
      carts: numberValue(selected, ["cart_count"]),
      cart_photo_count: numberValue(selected, ["cart_photo_count"]),
      purchases: numberValue(selected, ["purchase_count"]),
      purchase_photo_count: numberValue(selected, ["purchase_photo_count", "sold_photo_count", "sold_photo"]),
      exposure_sum: numberValue(selected, ["exposure_sum"]),
      exposure_count: numberValue(selected, ["exposure_count"]),
      zero_exposure_count: numberValue(selected, ["zero_exposure_count"]),
      revenue: numberValue(selected, ["revenue"])
    };
  }

  function dashboardPeopleForSelection(eventCode) {
    const codes = eventCode && eventCode !== "all"
      ? [eventCode]
      : (sotDashData.event_summaries || []).map(row => row.event_code).filter(Boolean);
    return codes.reduce((sum, code) => sum + eventPeople(code), 0);
  }

  function eventPeople(eventCode) {
    const ev = (allEvents || []).find(item => item && item.event_code === eventCode);
    return numberValue(ev, ["people", "participants", "participant_count", "runner_count"]);
  }

  function filteredSources() {
    return sotDashData.sources.filter(row => sotDashSourceFilter === "all" || row.utm_source === sotDashSourceFilter || row.label === sotDashSourceFilter);
  }

  function setSotDashHeader() {
    const section = SOT_DASH_SECTIONS.find(item => item.id === sotDashActiveSection) || SOT_DASH_SECTIONS[0];
    const title = $("#sot_dash_title");
    const desc = $("#sot_dash_desc");
    if (title) title.textContent = section.label.replace(/^\d+\.\s*/, "");
    if (desc) desc.textContent = section.desc;

    document.querySelectorAll("[data-sot-section]").forEach(btn => {
      const active = btn.dataset.sotSection === sotDashActiveSection;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-current", active ? "page" : "false");
    });

    document.querySelectorAll("[data-sot-dataset]").forEach(btn => {
      const active = btn.dataset.sotDataset === sotDashDatasetFilter;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });
  }

  function renderSotDashboard() {
    setSotDashHeader();
    const target = $("#sot_dash_content");
    if (!target) return;

    if (sotDashLoading) {
      target.innerHTML = `<div class="sot-dash-callout">SOT:Dashboard 데이터를 불러오는 중입니다.</div>${sotKpis([["검색", "-", "search_count"], ["장바구니", "-", "cart_count"], ["구매", "-", "purchase_count"], ["매출", "-", "revenue"]])}`;
      return;
    }

    if (sotDashLastError) {
      target.innerHTML = `<div class="sot-dash-callout warn">SOT:Dashboard API 데이터를 불러오지 못했습니다. 콘솔의 [SOT Dashboard] 로그를 확인하세요.</div>${sotKpis([["검색", "0", "fallback"], ["장바구니", "0", "fallback"], ["구매", "0", "fallback"], ["매출", "0원", "fallback"]])}`;
      return;
    }

    if (sotDashDatasetFilter !== "legacy") {
      target.innerHTML = renderSotOperationalPlaceholder();
      return;
    }

    if (sotDashActiveSection === "overview") target.innerHTML = renderSotOverview();
    else if (sotDashActiveSection === "period") target.innerHTML = renderSotPeriod();
    else if (sotDashActiveSection === "event") target.innerHTML = renderSotEvent();
    else if (sotDashActiveSection === "source") target.innerHTML = renderSotSource();
    else if (sotDashActiveSection === "cart") target.innerHTML = renderSotCart();
    else if (sotDashActiveSection === "purchase") target.innerHTML = renderSotPurchase();
    else if (sotDashActiveSection === "spot") target.innerHTML = renderSotSpot();
    else if (sotDashActiveSection === "course") target.innerHTML = renderSotCourse();
    else if (sotDashActiveSection === "quality") target.innerHTML = renderSotQuality();
    else target.innerHTML = renderSotPayment();
  }

  function renderSotOperationalPlaceholder() {
    return `
      <div class="sot-dash-callout">운영 집계는 후속 집계 연결이 필요합니다. 현재 화면은 레거시 집계 탭에서 검증된 data_source=legacy 데이터를 표시합니다.</div>
      ${sotKpis([["상태", "후속 집계 필요", "current / aggregator"], ["접속 수", "집계 데이터 없음", "visit_count"], ["유입/디바이스", "집계 데이터 없음", "source/device agg_type"], ["대상", "레거시 집계 탭", "data_source=legacy"]])}
    `;
  }

  function defaultSotDashboardTab(section) {
    if (section === "period") return "periodDay";
    return "summary";
  }

  function renderSotOverview() {
    const ev = currentDashEvent();
    const tabs = [
      ["summary", "요약"],
      ["funnel", "전환율 / 퍼널"],
      ["search", "검색 / 노출"],
      ["attention", "주의 항목"]
    ];
    return `
      ${sotTabs(tabs)}
      ${sotDashActiveTab === "summary" ? `
        ${sotKpis([
          ["접속 수", formatNumber(ev.sessions), "세션 기준"],
          ["검색 수", formatNumber(ev.searches), "배번호+이름 검색"],
          ["구매 수", formatNumber(ev.purchases), "purchase_count"],
          ["매출", formatWon(ev.revenue), "revenue"]
        ])}
        <div class="sot-dash-callout">접속 수/세션 수는 현재 legacy Dashboard에 visit_count/session_count 집계가 없어 0으로 표시됩니다. 유입/디바이스는 후속 source/device 집계 연결 후 표시됩니다.</div>
        <div class="sot-dash-grid two">
          ${sotPanel("일자별 매출 추이", sotChart((sotDashData.daily || []).map(row => [row.date_key || row.period_key || row.label, row.revenue / 1000])))}
          ${sotPanel("참가자 대비 성과", sotKpis([
            ["참가자 수", ev.people ? formatNumber(ev.people) : "미입력", "Event.people"],
            ["참가자당 매출", formatWon(Math.round(ev.revenue / Math.max(1, ev.people))), "revenue / participants"],
            ["참가자 대비 구매율", formatPercent(safeRate(ev.purchases, ev.people)), "purchase / participants"],
            ["참가자 대비 구매사진", formatPercent(safeRate(ev.purchase_photo_count, ev.people)), "purchase_photo_count / participants"]
          ], "mini"))}
        </div>
      ` : ""}
      ${sotDashActiveTab === "funnel" ? `
        ${sotPanel("전체 퍼널", sotFunnel(ev))}
        ${sotPanel("기준별 전환율", sotTable(["구분", "분자", "분모", "전환율"], [
          ["방문 → 검색", formatNumber(ev.searches), formatNumber(ev.sessions), formatPercent(safeRate(ev.searches, ev.sessions))],
          ["검색 → 장바구니", formatNumber(ev.carts), formatNumber(ev.searches), formatPercent(rateValue(sotDashData.state, ["cart_rate"], ev.carts, ev.searches))],
          ["장바구니 → 구매", formatNumber(ev.purchases), formatNumber(ev.carts), formatPercent(safeRate(ev.purchases, ev.carts))],
          ["검색 → 구매", formatNumber(ev.purchases), formatNumber(ev.searches), formatPercent(rateValue(sotDashData.state, ["conversion_rate", "purchase_rate"], ev.purchases, ev.searches))]
        ]))}
      ` : ""}
      ${sotDashActiveTab === "search" ? `
        <div class="sot-dash-grid two">
          ${sotPanel("검색 타입별 성과", sotTable(["검색 타입", "검색 수", "구매 수", "전환율", "평균노출"], searchTypeRows(ev)))}
          ${sotPanel("노출 상태", sotTable(["상태", "건수", "비율"], exposureRows(ev)))}
        </div>
        ${sotPanel("검색어 Top / 문제 검색어", sotTable(["검색어", "타입", "검색 수", "결과", "구매 연결"], []))}
      ` : ""}
      ${sotDashActiveTab === "attention" ? `
        <div class="sot-dash-callout warn">데이터 품질 항목은 클릭하면 실제 문제 row 목록을 여는 방식으로 설계합니다. 아래 목록은 더미 예시입니다.</div>
        ${sotPanel("품질 경고", qualityTable())}
      ` : ""}
    `;
  }

  function renderSotPeriod() {
    return `
      ${sotTabs([["periodDay", "일별"], ["periodWeek", "주간"], ["periodMonth", "월별"]])}
      ${sotDashActiveTab === "summary" || sotDashActiveTab === "periodDay" ? sotPanel("일별 핵심 지표", sotTable(["날짜", "검색", "장바구니", "카트사진", "구매", "구매사진", "매출", "노출", "노출 0건"], dailyRows())) : ""}
      ${sotDashActiveTab === "summary" || sotDashActiveTab === "periodDay" ? sotPanel(`${sotDashSelectedDateKey || "선택 날짜"} 시간대별 정보`, sotTable(["시간", "검색", "장바구니", "카트사진", "구매", "구매사진", "매출", "노출", "노출 0건"], selectedDayHourlyRows())) : ""}
      ${sotDashActiveTab === "periodWeek" ? sotPanel("주간 핵심 지표", `<div class="sot-dash-callout">주간 집계는 후속 집계 필요 항목입니다. 현재 레거시 탭은 일별/선택일 시간대별 검산을 우선 표시합니다.</div>`) : ""}
      ${sotDashActiveTab === "periodMonth" ? sotPanel("월별 핵심 지표", `<div class="sot-dash-callout">월별 집계는 후속 집계 필요 항목입니다. 현재 레거시 탭은 6/7~6/13 window 기준입니다.</div>`) : ""}
    `;
  }

  function ensureSelectedDateKey() {
    const dates = (sotDashData.daily || []).map(row => row.date_key || row.period_key).filter(Boolean);
    if (!dates.length) {
      sotDashSelectedDateKey = "";
      return;
    }
    if (!dates.includes(sotDashSelectedDateKey)) sotDashSelectedDateKey = dates[0];
  }

  function renderSotEvent() {
    return `
      ${sotKpis([["선택 대회", currentDashEvent().event_name || currentDashEvent().event_code || "전체 대회", currentDashEvent().event_code || "all"], ["참가자 수", currentDashEvent().people ? formatNumber(currentDashEvent().people) : "미입력", "Event.people"], ["대회 매출", formatWon(currentDashEvent().revenue), "선택 기간 기준"], ["참가자당 매출", formatWon(Math.round(currentDashEvent().revenue / Math.max(1, currentDashEvent().people))), "revenue / Event.people"]])}
      ${sotPanel("대회별 요약", sotTable(["event_code", "검색", "장바구니", "카트사진", "구매", "구매사진", "매출"], eventSummaryRows()))}
      ${sotPanel("대회별 참가자 대비 매출", sotTable(["대회", "참가자당 매출", "참가자 대비 구매율", "참가자 대비 구매사진"], [[currentDashEvent().event_name || currentDashEvent().event_code || "전체 대회", formatWon(Math.round(currentDashEvent().revenue / Math.max(1, currentDashEvent().people))), formatPercent(safeRate(currentDashEvent().purchases, currentDashEvent().people)), formatPercent(safeRate(currentDashEvent().purchase_photo_count, currentDashEvent().people))]]))}
      ${sotPanel("대회별 시간/유입/전환 요약", sotTable(["대회", "주요 유입", "최고 시간대", "검색→구매", "노출 0건"], []))}
    `;
  }

  function renderSotSource() {
    return `
      <div class="sot-dash-callout">source/device agg row가 아직 없어 유입/디바이스 분석은 후속 집계 연결이 필요합니다.</div>
      <div class="sot-dash-grid two">
        ${sotPanel("유입별 성과", sotTable(["유입", "접속", "검색", "장바구니", "구매", "매출", "판매사진", "방문→구매"], filteredSources().map(row => [sourceLabel(row.utm_source || row.label), formatNumber(row.visit_count || row.session_count), formatNumber(row.search_count), formatNumber(row.cart_count), formatNumber(row.purchase_count), formatWon(row.revenue), formatNumber(row.purchase_count), formatPercent(safeRate(row.purchase_count, row.visit_count || row.session_count))])))}
        ${sotPanel("디바이스 + 브라우저 성과", sotTable(["디바이스/브라우저", "접속", "구매", "매출", "방문→구매"], sotDashData.devices.map(row => [row.device || row.label, formatNumber(row.visit_count || row.session_count), formatNumber(row.purchase_count), formatWon(row.revenue), formatPercent(safeRate(row.purchase_count, row.visit_count || row.session_count))])))}
      </div>
      ${sotPanel("유입 × 디바이스 교차", sotTable(["유입", "1위 디바이스", "2위 디바이스", "구매율 메모"], []))}
    `;
  }

  function renderSotCart() {
    const ev = currentDashEvent();
    const cartPhotos = ev.cart_photo_count || ev.carts;
    const purchasedPhotos = ev.purchase_photo_count || ev.purchases;
    const unpurchasedPhotos = Math.max(0, cartPhotos - purchasedPhotos);
    return `
      ${sotKpis([
        ["장바구니 흔적 수", formatNumber(ev.carts), "legacy cart row presence"],
        ["장바구니 사진", formatNumber(cartPhotos), "cart_photo_count"],
        ["구매 전환 사진", formatNumber(purchasedPhotos), "purchase_photo_count"],
        ["미구매 사진", formatNumber(unpurchasedPhotos), "cart_photo_count - purchase_count"]
      ])}
      ${sotPanel("장바구니 분석", sotTable(["항목", "값", "메모"], sotDashData.carts.map(row => [row.label, formatValue(row.value), row.note])))}
      <div class="sot-dash-callout warn">장바구니 스팟은 현재 파일명 prefix로 계산 가능하지만, 장바구니 이벤트에 file_names가 안정적으로 있어야 합니다. 연결 구조가 애매하면 우선 보류하고, 판매 prefix 분석부터 확정하는 편이 안전합니다.</div>
    `;
  }

  function renderSotPurchase() {
    const ev = currentDashEvent();
    return `
      ${sotKpis([
        ["구매 주문", formatNumber(ev.purchases), "purchase_count"],
        ["매출", formatWon(ev.revenue), "revenue"],
        ["객단가", formatWon(Math.round(ev.revenue / Math.max(1, ev.purchases))), "revenue / purchase_count"],
        ["구매사진", formatNumber(ev.purchase_photo_count), "purchase_photo_count"]
      ])}
      <div class="sot-dash-grid two">
        ${sotPanel("상품 유형별", sotTable(["상품", "주문 수", "판매사진", "매출", "평균 사진 수"], []))}
        ${sotPanel("결제 금액대별", sotTable(["금액대", "구매 수", "매출", "비중"], []))}
      </div>
    `;
  }

  function renderSotSpot() {
    return `
      <div class="sot-dash-callout">사진별 1장 단위 성과보다, 파일명 앞자리(prefix: AM, BM, CM, DM...) 기준이 핵심입니다. 추후 prefix에 카메라 담당자/장비/촬영 위치를 매핑하면 대회 일지와 합칠 수 있습니다.</div>
      <div class="sot-dash-grid two">
        ${sotPanel("prefix별 판매 비중", sotTable(["prefix", "판매사진", "대회 총 판매 대비", "매출", "주문 수", "메모"], sotDashData.spots.map(row => [row.label || row.spot || "-", formatNumber(row.purchase_count), sotHtml(`<span class="sot-dash-barwrap"><span class="sot-dash-bar" style="width:${Math.min(100, Number(row.conversion_rate || 0))}%"></span></span>${formatPercent(row.conversion_rate)}`), formatWon(row.revenue), formatNumber(row.purchase_count), row.memo || "-"])))}
        ${sotPanel("prefix 매핑 / 대회 일지", sotTable(["prefix", "카메라/담당자", "촬영 위치", "상태"], sotDashData.spots.map(row => [row.label || row.spot || "-", row.photographer || row.camera_type || "미지정", row.spot_name || "-", sotHtml(sotPill(row.photographer || row.camera_type ? "매핑됨" : "입력 필요", row.photographer || row.camera_type ? "good" : "warn"))])))}
      </div>
      ${sotPanel("대회 일지 메모 영역", `<textarea class="sot-dash-input" style="min-height:120px;resize:vertical" placeholder="예: AM = 자동카메라, 피니시 우측 / BM = 포토그래퍼 김OO, 3km 지점..."></textarea>`)}
    `;
  }

  function renderSotCourse() {
    return `
      <div class="sot-dash-callout">대회별 배번호 구간을 직접 추가/삭제하는 화면입니다. 이 구간으로 코스별 검색, 구매, 매출, 노출을 분류합니다.</div>
      ${sotPanel("배번호 구간 추가", `
        <div class="sot-dash-course-form">
          <input class="sot-dash-input" id="sot_course_name" placeholder="코스명 예: 10K">
          <input class="sot-dash-input" id="sot_bib_start" type="number" placeholder="시작 배번호">
          <input class="sot-dash-input" id="sot_bib_end" type="number" placeholder="끝 배번호">
          <input class="sot-dash-input" id="sot_course_sort" type="number" placeholder="순서">
          <button class="sot-dash-btn" type="button" data-sot-course-add>추가</button>
        </div>
        ${sotTable(["대회", "코스", "시작", "끝", "순서", "관리"], visibleCourseRanges().map(row => [row.event_code, row.course || "-", formatNumber(row.range_start), formatNumber(row.range_end), row.sort || "-", sotHtml(`<button class="sot-dash-btn danger" type="button" data-sot-course-delete="${row.index}">삭제</button>`)]))}
      `)}
      ${sotPanel("코스별 성과", sotTable(["코스", "배번호 구간", "검색", "구매", "매출", "노출 0건"], coursePerformanceRows()))}
    `;
  }

  function activeCourseEventCode() {
    return sotDashEventFilter === "all" ? "260607-yd" : sotDashEventFilter;
  }

  function visibleCourseRanges() {
    return sotDashData.course_ranges
      .map((row, index) => ({ ...row, index }))
      .filter(row => sotDashEventFilter === "all" || row.event_code === sotDashEventFilter)
      .sort((a, b) => {
        if (a.event_code !== b.event_code) return String(a.event_code).localeCompare(String(b.event_code));
        if (Number(a.sort || 0) !== Number(b.sort || 0)) return Number(a.sort || 0) - Number(b.sort || 0);
        if (String(a.course) !== String(b.course)) return String(a.course).localeCompare(String(b.course));
        return Number(a.start ?? a.range_start ?? 0) - Number(b.start ?? b.range_start ?? 0);
      });
  }

  function courseRangeText(row) {
    const start = row.start ?? row.range_start;
    const end = row.end ?? row.range_end;
    return `${number(start)}~${number(end)}`;
  }

  function eventCourseRangeSummary(eventCode) {
    const grouped = new Map();
    sotDashData.course_ranges
      .filter(row => row.event_code === eventCode)
      .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0))
      .forEach(row => {
        if (!grouped.has(row.course)) grouped.set(row.course, []);
        grouped.get(row.course).push(courseRangeText(row));
      });

    const summary = Array.from(grouped.entries()).map(([course, ranges]) => `${course}:${ranges.join(", ")}`);
    return summary.length ? summary.join(" / ") : "-";
  }

  function courseRangeRows() {
    return visibleCourseRanges().map(row => [
      row.event_code,
      row.range_start ?? "-",
      row.range_end ?? "-",
      formatNumber(row.search_count),
      formatNumber(row.purchase_count),
      formatWon(row.revenue)
    ]);
  }

  function coursePerformanceRows() {
    const groups = new Map();
    visibleCourseRanges().forEach(row => {
      const key = `${row.event_code}__${row.course}`;
      if (!groups.has(key)) {
        groups.set(key, {
          event_code: row.event_code,
          course: row.course,
          ranges: [],
          search: 0,
          purchase: 0,
          revenue: 0,
          zero: 0
        });
      }
      const group = groups.get(key);
      const start = Number(row.start ?? row.range_start ?? 0);
      const end = Number(row.end ?? row.range_end ?? 0);
      const span = Math.max(1, end - start + 1);
      group.ranges.push(courseRangeText(row));
      group.search += Math.round(span / 8) + Number(row.sort || 0) * 11;
      group.purchase += Math.max(1, Math.round(span / 190));
      group.revenue += Math.max(80000, Math.round(span * 260));
      group.zero += Math.max(1, Math.round(span / 420));
    });

    return Array.from(groups.values()).map(group => [
      group.course,
      group.ranges.join(", "),
      number(group.search),
      number(group.purchase),
      money(group.revenue),
      number(group.zero)
    ]);
  }

  function addSotCourseRange() {
    const courseInput = $("#sot_course_name");
    const startInput = $("#sot_bib_start");
    const endInput = $("#sot_bib_end");
    const sortInput = $("#sot_course_sort");
    const course = (courseInput && courseInput.value.trim()) || "미지정";
    const start = Number(startInput && startInput.value);
    const end = Number(endInput && endInput.value);
    const sort = Number((sortInput && sortInput.value) || 99);

    if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= 0 || start > end) {
      alert("시작/끝 배번호를 확인하세요.");
      return;
    }

    sotDashData.course_ranges.push({
      event_code: activeCourseEventCode(),
      course,
      start,
      end,
      range_start:start,
      range_end:end,
      sort: Number.isFinite(sort) ? sort : 99
    });

    if (courseInput) courseInput.value = "";
    if (startInput) startInput.value = "";
    if (endInput) endInput.value = "";
    if (sortInput) sortInput.value = "";
    renderSotDashboard();
  }

  function deleteSotCourseRange(index) {
    const targetIndex = Number(index);
    if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= sotDashData.course_ranges.length) return;
    sotDashData.course_ranges.splice(targetIndex, 1);
    renderSotDashboard();
  }

  function renderSotQuality() {
    return `
      <div class="sot-dash-callout warn">데이터 품질 상세 드릴다운은 이번 V1에서 보류합니다. 실제 연결 시 원본 row 조회 키를 추가해야 합니다.</div>
      ${sotPanel("데이터 품질", qualityTable())}
    `;
  }

  function renderSotPayment() {
    const ev = currentDashEvent();
    const purchase = ev.purchases;
    const revenue = ev.revenue;
    return `
      <div class="sot-dash-callout warn"><b>결제 실패 정의:</b> 현재 SOT:Dashboard state row에는 실패 원장 agg_type이 없으면 성공 구매/매출 요약만 표시합니다.</div>
      ${sotKpis([["구매", formatNumber(purchase), "purchase_count"], ["구매사진", formatNumber(ev.purchase_photo_count), "purchase_photo_count"], ["매출", formatWon(revenue), "revenue"], ["객단가", formatWon(Math.round(revenue / Math.max(1, purchase))), "revenue / purchase_count"]])}
      ${sotPanel("구매 미완료 / 결제 실패 목록", sotTable(["임시 주문", "대회", "상태", "사유", "source", "검색어", "시각"], sotDashData.payment_failures.map(row => [row.order_id, row.event_code, row.state, row.reason, sourceLabel(row.source), row.query, row.time])))}
    `;
  }

  function sotTabs(tabs) {
    return `<div class="sot-dash-tabs" role="tablist">${tabs.map(tab => `<button class="sot-dash-tab ${sotDashActiveTab === tab[0] ? 'is-active' : ''}" type="button" data-sot-tab="${escapeHtml(tab[0])}">${escapeHtml(tab[1])}</button>`).join("")}</div>`;
  }

  function sotKpis(rows, mode) {
    return `<div class="sot-dash-kpis ${mode === 'mini' ? 'is-mini' : ''}">${rows.map(row => `<div class="sot-dash-card"><div class="sot-dash-label">${escapeHtml(row[0])}</div><div class="sot-dash-value">${escapeHtml(row[1])}</div><div class="sot-dash-note">${escapeHtml(row[2] || "")}</div></div>`).join("")}</div>`;
  }

  function sotPanel(title, content) {
    return `<section class="sot-dash-panel"><h3>${escapeHtml(title)}</h3>${content}</section>`;
  }

  function sotTable(headers, rows) {
    return `<div class="sot-dash-table-wrap"><table class="sot-dash-table"><thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map(cell => `<td>${sotCell(cell)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">데이터가 없습니다.</td></tr>`}</tbody></table></div>`;
  }

  function sotHtml(value) {
    return { __sotHtml: String(value || "") };
  }

  function sotCell(value) {
    if (value && typeof value === "object" && value.__sotHtml) return value.__sotHtml;
    return escapeHtml(value);
  }

  function formatValue(value) {
    return typeof value === "number" ? formatNumber(value) : value;
  }

  function metricTableRow(row) {
    return [
      row.period_key || row.date_key || row.label || "-",
      formatNumber(row.search_count),
      formatNumber(row.cart_count),
      formatNumber(row.cart_photo_count),
      formatNumber(row.purchase_count),
      formatNumber(row.purchase_photo_count),
      formatWon(row.revenue),
      formatNumber(row.exposure_count),
      formatNumber(row.zero_exposure_count)
    ];
  }

  function dailyTableRow(row) {
    const date = row.date_key || row.period_key || row.label || "-";
    return [
      sotHtml(`<button class="sot-dash-btn ${date === sotDashSelectedDateKey ? 'primary' : ''}" type="button" data-sot-day="${escapeHtml(date)}">${escapeHtml(date)}</button>`),
      formatNumber(row.search_count),
      formatNumber(row.cart_count),
      formatNumber(row.cart_photo_count),
      formatNumber(row.purchase_count),
      formatNumber(row.purchase_photo_count),
      formatWon(row.revenue),
      formatNumber(row.exposure_count),
      formatNumber(row.zero_exposure_count)
    ];
  }

  function searchTypeRows(ev) {
    return [[
      "전체",
      formatNumber(ev.searches),
      formatNumber(ev.purchases),
      formatPercent(safeRate(ev.purchases, ev.searches)),
      formatNumber(ev.exposure_count ? ev.exposure_sum / ev.exposure_count : 0) + "장"
    ]];
  }

  function exposureRows(ev) {
    const validExposure = Math.max(0, ev.exposure_count - ev.zero_exposure_count);
    return [
      ["유효 노출", formatNumber(validExposure), formatPercent(safeRate(validExposure, ev.exposure_count))],
      ["노출 0건", formatNumber(ev.zero_exposure_count), formatPercent(safeRate(ev.zero_exposure_count, ev.exposure_count))]
    ];
  }

  function dailyRows() {
    return (sotDashData.daily || []).map(dailyTableRow);
  }

  function selectedDayHourlyRows() {
    const byHour = new Map();
    for (let h = 0; h < 24; h += 1) {
      byHour.set(String(h).padStart(2, "0"), emptyHourRow(String(h).padStart(2, "0")));
    }
    (sotDashData.hourly || [])
      .filter(row => (row.date_key || "").slice(0, 10) === sotDashSelectedDateKey)
      .forEach(row => {
        const hour = String(row.hour_key || "").padStart(2, "0");
        const group = byHour.get(hour) || emptyHourRow(hour);
        ["search_count", "cart_count", "cart_photo_count", "purchase_count", "purchase_photo_count", "revenue", "exposure_count", "zero_exposure_count"].forEach(field => {
          group[field] += Number(row[field] || 0);
        });
        byHour.set(hour, group);
      });
    return Array.from(byHour.values()).map(row => [
      `${row.hour_key} (${row.hour_key}:00~${String(Number(row.hour_key) + 1).padStart(2, "0")}:00)`,
      formatNumber(row.search_count),
      formatNumber(row.cart_count),
      formatNumber(row.cart_photo_count),
      formatNumber(row.purchase_count),
      formatNumber(row.purchase_photo_count),
      formatWon(row.revenue),
      formatNumber(row.exposure_count),
      formatNumber(row.zero_exposure_count)
    ]);
  }

  function emptyHourRow(hour) {
    return {
      hour_key: hour,
      search_count: 0,
      cart_count: 0,
      cart_photo_count: 0,
      purchase_count: 0,
      purchase_photo_count: 0,
      revenue: 0,
      exposure_count: 0,
      zero_exposure_count: 0
    };
  }

  function oldHourlyRows() {
    return sotDashData.hourly.map(row => [
      row.period_key || row.label || "-",
      formatNumber(row.search_count),
      formatNumber(row.cart_count),
      formatNumber(row.purchase_count),
      formatWon(row.revenue)
    ]);
  }

  function salesAmountHourRows() {
    return sotDashData.sales_amount_hour.map(row => [
      row.period_key || row.label || "-",
      formatWon(row.revenue),
      formatNumber(row.purchase_count)
    ]);
  }

  function rangeRows() {
    return sotDashData.ranges.map(row => [
      rangeLabel(row),
      formatNumber(row.search_count),
      formatNumber(row.purchase_count),
      formatWon(row.revenue),
      formatPercent(row.conversion_rate)
    ]);
  }

  function eventSummaryRows() {
    return (sotDashData.event_summaries || []).map(row => [
      row.event_code || row.label || "-",
      formatNumber(row.search_count),
      formatNumber(row.cart_count),
      formatNumber(row.cart_photo_count),
      formatNumber(row.purchase_count),
      formatNumber(row.purchase_photo_count),
      formatWon(row.revenue)
    ]);
  }

  function number(value) {
    return formatNumber(value);
  }

  function money(value) {
    return formatWon(value);
  }

  function percent(value) {
    return formatPercent(value);
  }

  function sotChart(rows) {
    const max = Math.max(1, ...rows.map(row => Number(row[1]) || 0));
    return `<div class="sot-dash-chart">${rows.map(row => `<div class="sot-dash-chart-col"><b>${number(row[1])}</b><div class="sot-dash-stick" style="height:${Math.max(8, (Number(row[1]) || 0) / max * 145)}px"></div><span>${escapeHtml(row[0])}</span></div>`).join("")}</div>`;
  }

  function sotFunnel(ev) {
    const rows = [["세션", ev.sessions, "session_id"], ["검색", ev.searches, percent(ev.searches / Math.max(1, ev.sessions) * 100)], ["장바구니", ev.carts, percent(ev.carts / Math.max(1, ev.searches) * 100)], ["구매", ev.purchases, percent(ev.purchases / Math.max(1, ev.carts) * 100)]];
    return `<div class="sot-dash-funnel">${rows.map(row => `<div class="sot-dash-step"><div class="sot-dash-label">${escapeHtml(row[0])}</div><div class="sot-dash-value">${number(row[1])}</div><small>${escapeHtml(row[2])}</small></div>`).join("")}</div>`;
  }

  function qualityTable() {
    return sotTable(["항목", "건수", "상태", "조회 조건"], sotDashData.quality.map(row => [row.item, formatNumber(row.count), sotHtml(sotPill(row.status, row.level)), row.condition]));
  }

  function sotPill(label, type) {
    return `<span class="sot-dash-pill ${escapeHtml(type || 'gray')}">${escapeHtml(label)}</span>`;
  }

  function sotBar(value) {
    const width = Math.max(0, Math.min(100, Number(value) || 0));
    return `<div class="sot-dash-barwrap"><div class="sot-dash-bar" style="width:${width}%"></div></div> ${percent(width)}`;
  }

  function sourceLabel(value) {
    const map = { sms:"SMS", kakao:"카카오톡", qr:"현장 QR", instagram:"인스타그램", naver:"네이버", google:"구글", direct:"직접", unknown:"미분류" };
    return map[value] || value || "-";
  }

  window.deleteEvent = async function(id) {
    if(!confirm("정말 이 대회를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`${BUBBLE_API_BASE}${API_DATA_EVENT}/${id}`, { method: "DELETE" });
      if(res.ok) fetchData(); else alert("권한이 없습니다.");
    } catch(e) { alert("삭제 오류"); }
  };

  window.togglePublic = async function(id, current) {
    try {
      const res = await fetch(`${BUBBLE_API_BASE}${API_DATA_EVENT}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: !current })
      });
      if(res.ok) fetchData();
    } catch(e) { alert("수정 실패"); }
  };

  window.toggleNameSearch = async function(id, current) {
    try {
      const res = await fetch(`${BUBBLE_API_BASE}${API_DATA_EVENT}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name_search_enabled: !current })
      });
      if(res.ok) fetchData();
    } catch(e) { alert("수정 실패"); }
  };

  window.editEvent = function(id) {
    editingEventId = id;
    applyEventFilters();
  };

  window.cancelEventEdit = function() {
    editingEventId = "";
    applyEventFilters();
  };

  window.saveEventEdit = async function(id) {
    const eventDate = document.getElementById(`edit_event_date_${id}`);
    const displayName = document.getElementById(`edit_display_name_${id}`);
    const eventCode = document.getElementById(`edit_event_code_${id}`);
    const publishAt = document.getElementById(`edit_publish_at_${id}`);
    const people = document.getElementById(`edit_people_${id}`);
    const nameSearch = document.getElementById(`edit_name_search_enabled_${id}`);
    const isPublic = document.getElementById(`edit_is_public_${id}`);

    const payload = {
      event_date: kstDateInputToISO(eventDate && eventDate.value),
      event_display_name: (displayName && displayName.value.trim()) || "",
      event_code: (eventCode && eventCode.value.trim()) || "",
      publish_at: kstDateTimeInputToISO(publishAt && publishAt.value),
      name_search_enabled: nameSearch && nameSearch.value === "true",
      is_public: isPublic && isPublic.value === "true"
    };
    applyPeoplePayload(payload, people && people.value);

    Object.keys(payload).forEach(key => {
      if (payload[key] === null || payload[key] === undefined || payload[key] === "") delete payload[key];
    });

    try {
      const res = await fetch(`${BUBBLE_API_BASE}${API_DATA_EVENT}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[Admin] event update failed", { status: res.status, body: text.slice(0, 500), payload });
        alert("대회 수정 실패");
        return;
      }
      editingEventId = "";
      await fetchData();
    } catch(e) {
      console.error("[Admin] event update error", e);
      alert("대회 수정 오류");
    }
  };

  function bindEvents(){
    document.querySelectorAll("[data-admin-view]").forEach(btn => {
      btn.addEventListener("click", () => {
        activeAdminView = btn.dataset.adminView;
        syncAdminView();
        if (activeAdminView === "database") renderSotDashboard();
      });
    });

    document.addEventListener("click", function(e) {
      const sectionButton = e.target.closest("[data-sot-section]");
      if (sectionButton) {
        sotDashActiveSection = sectionButton.dataset.sotSection || "overview";
        sotDashActiveTab = defaultSotDashboardTab(sotDashActiveSection);
        renderSotDashboard();
        return;
      }

      const tabButton = e.target.closest("[data-sot-tab]");
      if (tabButton) {
        sotDashActiveTab = tabButton.dataset.sotTab || "summary";
        renderSotDashboard();
        return;
      }

      const datasetButton = e.target.closest("[data-sot-dataset]");
      if (datasetButton) {
        sotDashDatasetFilter = datasetButton.dataset.sotDataset || "legacy";
        syncSotDashboardFilters();
        renderSotDashboard();
        logDashboardCacheRebuild("dataset tab change");
        return;
      }

      const dayButton = e.target.closest("[data-sot-day]");
      if (dayButton) {
        sotDashSelectedDateKey = dayButton.dataset.sotDay || "";
        renderSotDashboard();
        return;
      }

      const addCourseButton = e.target.closest("[data-sot-course-add]");
      if (addCourseButton) {
        addSotCourseRange();
        return;
      }

      const deleteCourseButton = e.target.closest("[data-sot-course-delete]");
      if (deleteCourseButton) {
        deleteSotCourseRange(deleteCourseButton.dataset.sotCourseDelete);
      }
    });

    const dashEventFilter = $("#sot_dash_event_filter");
    if (dashEventFilter) dashEventFilter.addEventListener("change", e => {
      sotDashEventFilter = e.target.value || "all";
      rebuildSotDashboardData(selectedDashboardEventCode());
      syncSotDashboardFilters();
      renderSotDashboard();
      logDashboardCacheRebuild("event filter change");
    });
    const dashPeriodFilter = $("#sot_dash_period_filter");
    if (dashPeriodFilter) dashPeriodFilter.addEventListener("change", e => {
      sotDashPeriodFilter = e.target.value || "legacy_window";
      rebuildSotDashboardData(sotDashEventFilter === "all" ? "" : sotDashEventFilter);
      syncSotDashboardFilters();
      renderSotDashboard();
      logDashboardCacheRebuild("period filter change");
    });
    const dashSourceFilter = $("#sot_dash_source_filter");
    if (dashSourceFilter) dashSourceFilter.addEventListener("change", e => { sotDashSourceFilter = e.target.value || "all"; renderSotDashboard(); });
    $("#sh_month_filter").addEventListener("change", (e) => {
      activeEventMonth = e.target.value || "all";
      applyEventFilters();
    });
    $("#sh_search").addEventListener("input", applyEventFilters);
    $("#sh_btn_refresh").addEventListener("click", fetchData);

    $("#sh_btn_create_event").addEventListener("click", async function(){
      this.disabled = true;
      try {
        const payload = {
          event_display_name: $("#sh_display_name").value.trim(),
          event_code: $("#sh_event_code").value.trim(),
          event_date: kstDateInputToISO($("#sh_event_date").value),
          publish_at: kstDateTimeInputToISO($("#sh_publish_at").value),
          name_search_enabled: $("#sh_name_search_enabled").value === "true"
        };
        applyPeoplePayload(payload, $("#sh_people").value);
        const res = await fetch(BUBBLE_API_BASE + API_CREATE_EVENT, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if(res.ok) {
          alert("생성 성공");
          $("#sh_people").value = "";
          fetchData();
        }
      } catch(err){ alert("오류 발생"); }
      this.disabled = false;
    });
  }

  async function guardAdmin(){
    const accessToken = sessionStorage.getItem("shout_access_token");

    if (!accessToken) {
      alert("로그인이 필요합니다.");

      sessionStorage.setItem("shout_auth_intent", JSON.stringify({
        type: "admin",
        after: "admin",
        return_to: window.location.href,
        fallback_to: window.location.origin + "/admin",
        created_at: Date.now()
      }));

      location.href = "/login";
      return false;
    }

    try {
      const res = await fetch(BUBBLE_API_BASE + API_AUTH_LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken })
      });

      const data = await res.json().catch(() => ({}));
      const payload = data && (data.response || data);

      const isAdmin =
        payload &&
        (payload.is_admin === true || payload.is_admin === "true");

      const usersId = payload && (payload.users_id || payload.usersId || payload.user_id);
      if (usersId) localStorage.setItem("shout_users_id", usersId);

      if (!isAdmin) {
        localStorage.removeItem("shout_is_admin");
        sessionStorage.removeItem("shout_access_token");
        sessionStorage.removeItem("shout_auth_intent");

        alert("관리자 권한이 없습니다.");
        location.href = "/";
        return false;
      }

      localStorage.setItem("shout_is_admin", "true");
      try {
        const rawIntent = sessionStorage.getItem("shout_auth_intent");
        const intent = rawIntent ? JSON.parse(rawIntent) : null;
        if (intent && (intent.after === "admin" || intent.type === "admin")) {
          sessionStorage.removeItem("shout_auth_intent");
        }
      } catch (e) {
        sessionStorage.removeItem("shout_auth_intent");
      }
      return true;

    } catch (err) {
      console.error("[Admin] guardAdmin error:", err);
      alert("관리자 인증 중 오류가 발생했습니다.");
      location.href = "/";
      return false;
    }
  }

  async function bootAdmin(){
    const ok = await guardAdmin();
    if (ok) initUI();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootAdmin);
  else bootAdmin();

})();
