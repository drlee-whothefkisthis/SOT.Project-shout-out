(function(){
  if (window.SotAdminHead) return;

  const API_DASHBOARD_DATA_LIVE = "/api/1.1/obj/SOT:Dashboard";
  const API_DASHBOARD_DATA_TEST = "/version-test/api/1.1/obj/SOT:Dashboard";
  const DASHBOARD_PAGE_LIMIT = 500;
  const SOT_BUBBLE_APP_BASE = "https://plp-62309.bubbleapps.io";
  const SOT_ADMIN_DASHBOARD_PROXY_PATH = "/api/1.1/wf/sot-admin-dashboard";

  const dashboardSections = [
    { id:"overview", group:"Core", label:"1. 전체 현황", desc:"전체 KPI, 퍼널, 검색/노출을 한 화면 안에서 탭으로 확인합니다." },
    { id:"period", group:"Core", label:"2. 기간별 분석", desc:"토요일 시작 주차별 요약, 선택 주차의 일자별 상세, 선택 날짜의 00~23시 시간대별 정보를 확인합니다." },
    { id:"event", group:"Core", label:"3. 대회별 분석", desc:"대회 선택 후 구매자 객단가와 참가자 대비 구매 지표를 확인합니다." },
    { id:"source", group:"Core", label:"4. 유입 / 디바이스 분석", desc:"SMS, 카카오, QR, 인앱, 디바이스를 한 화면으로 합쳤습니다." },
    { id:"cart", group:"Commerce", label:"5. 장바구니 분석", desc:"장바구니는 현재 스팟 연결을 보류하고 기본 퍼널만 확인합니다." },
    { id:"purchase", group:"Commerce", label:"6. 구매 / 매출 / 상품", desc:"낱장, 패키지, 금액대, 객단가를 확인합니다." },
    { id:"spot", group:"Commerce", label:"7. 사진 prefix / 스팟", desc:"파일명 앞자리 AM/BM/CM 기준으로 판매 비중을 봅니다." },
    { id:"course", group:"Operations", label:"8. 코스 / 배번호 관리", desc:"배번호 구간을 직접 추가하고 코스별 성과를 봅니다." },
    { id:"quality", group:"Operations", label:"9. 데이터 품질", desc:"누락/중복/이상치 항목을 클릭해 실제 row를 확인합니다." },
    { id:"payment", group:"Operations", label:"10. 결제 실패", desc:"create_order 이후 confirm/payment 원장 생성 실패를 추적합니다." }
  ];

  function emptyDashboardData() {
    return {
      generated_at: "",
      state: {},
      events: [{ event_code:"all", event_name:"전체 대회" }],
      hourly: [],
      daily: [],
      event_summaries: [],
      ranges: [],
      sales_amount_hour: [],
      sources: [],
      campaigns: [],
      devices: [],
      searchTypes: [],
      exposures: [],
      queries: [],
      carts: [],
      products: [],
      spots: [],
      course_ranges: [],
      quality: [],
      payment_failures: []
    };
  }

  function dashboardDataApiPath(pathname) {
    return String(pathname || "").indexOf("/version-test") === 0 ? API_DASHBOARD_DATA_TEST : API_DASHBOARD_DATA_LIVE;
  }

  function dashboardDataApiUrl(apiBase, cursor, eventCode) {
    const params = new URLSearchParams();
    params.set("limit", String(DASHBOARD_PAGE_LIMIT));
    params.set("cursor", String(cursor || 0));
    const constraints = [{ key:"data_source", constraint_type:"equals", value:"legacy" }];
    if (eventCode) {
      constraints.push({ key:"event_code", constraint_type:"equals", value:eventCode });
    }
    params.set("constraints", JSON.stringify(constraints));
    return apiBase + dashboardDataApiPath(window.location.pathname) + "?" + params.toString();
  }

  async function fetchAllDashboardRows(apiBase, eventCode) {
    const rows = [];
    let cursor = 0;
    let remaining = 1;

    while (remaining > 0) {
      const res = await fetch(dashboardDataApiUrl(apiBase, cursor, eventCode), { method:"GET" });
      const text = await res.text();
      if (!res.ok) {
        console.error("[SOT Dashboard] API failed", { status: res.status, body: text.slice(0, 500) });
        throw new Error("SOT Dashboard API failed: " + res.status);
      }

      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        console.error("[SOT Dashboard] API JSON parse failed", { status: res.status, body: text.slice(0, 500) });
        throw e;
      }

      const response = data.response || data;
      const results = Array.isArray(response.results) ? response.results : [];
      rows.push(...results);
      remaining = numberValue(response, ["remaining"]);
      cursor += results.length || DASHBOARD_PAGE_LIMIT;
      if (!results.length && remaining > 0) break;
    }

    return rows;
  }

  function getDashboardApiConfig(options) {
    const opts = options || {};
    return {
      url: opts.proxyUrl || SOT_BUBBLE_APP_BASE + SOT_ADMIN_DASHBOARD_PROXY_PATH,
      data_source: opts.data_source || "current"
    };
  }

  async function fetchDashboardProxy(mode, options) {
    const opts = options || {};
    const config = getDashboardApiConfig(opts);
    // Browser-facing aliases are translated to the Cloud Run mode contract.
    const cloudRunMode = mode === "summary"
      ? "dashboard_summary"
      : mode === "detail"
        ? "dashboard_detail"
        : mode;
    const payload = {
      mode: cloudRunMode,
      data_source: config.data_source
    };
    const usersId = localStorage.getItem("shout_users_id") || sessionStorage.getItem("shout_users_id") || "";
    if (usersId) payload.users_id = usersId;

    ["period", "start_date", "end_date", "agg_type"].forEach(key => {
      if (opts[key] !== undefined && opts[key] !== null && opts[key] !== "") payload[key] = opts[key];
    });
    ["tab", "snapshot_type", "period_key", "target_date", "manual_refresh"].forEach(key => {
      if (opts[key] !== undefined && opts[key] !== null && opts[key] !== "") payload[key] = opts[key];
    });
    if (opts.event_code !== undefined && opts.event_code !== null && opts.event_code !== "") {
      payload.event_code = opts.event_code;
    }

    const res = await fetch(config.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("[SOT Dashboard] proxy failed", { status: res.status, body: text.slice(0, 500), payload });
      throw new Error("SOT Dashboard proxy failed: " + res.status);
    }

    try {
      const parsed = text ? JSON.parse(text) : {};
      const dashboardResponse = parseDashboardProxyPayload(parsed);
      const response = dashboardResponse && (dashboardResponse.response || dashboardResponse);
      if (response && response.ok === false) {
        if (response.error === "snapshot_not_found") return response;
        throw new Error(response.error || "SOT Dashboard proxy returned ok=false");
      }
      return dashboardResponse;
    } catch (e) {
      console.error("[SOT Dashboard] proxy JSON parse failed", { status: res.status, body: text.slice(0, 500), payload });
      throw e;
    }
  }

  function parseDashboardProxyPayload(bubbleData) {
    const raw =
      bubbleData?.response?.raw_body_text ||
      bubbleData?.raw_body_text ||
      bubbleData?.response?.body_raw_text ||
      bubbleData?.body_raw_text;

    if (raw && typeof raw === "string" && raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") return parsed;
      } catch (error) {
        console.warn("[SOT Dashboard] raw_body_text parse failed:", error);
      }
    }

    return bubbleData?.response || bubbleData || {};
  }

  async function fetchDashboardSummaryFromCloudRun(options) {
    return fetchDashboardProxy("summary", options);
  }

  async function fetchDashboardDetailFromCloudRun(options) {
    return fetchDashboardProxy("detail", options);
  }

  function todayKSTDateKey() {
    return formatKSTDate(new Date());
  }

  function yesterdayKSTDateKey() {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return formatKSTDate(date);
  }

  async function fetchDashboardSnapshot({ snapshotType, periodKey, eventCode, tab, manualRefresh }) {
    const payload = {
      data_source: "current",
      mode: "dashboard_snapshot",
      tab: tab || "",
      snapshot_type: snapshotType,
      period_key: periodKey || todayKSTDateKey(),
      event_code: eventCode || "all"
    };
    if (manualRefresh === true) payload.manual_refresh = true;
    console.log("[SOT Snapshot] request", payload);
    const data = await fetchDashboardProxy("dashboard_snapshot", payload);
    console.log("[SOT Snapshot] response", {
      ok: data?.ok,
      agg_key: data?.agg_key,
      snapshot_type: data?.snapshot_type,
      event_code: data?.event_code,
      period_key: data?.period_key,
      generated_at: data?.generated_at,
      summary: data?.summary,
      hourly_count: data?.hourly?.length
    });
    return data;
  }

  function normalizeBubbleApiKeys(value) {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return Object.entries(source).reduce((result, [key, item]) => {
      const isBubbleAlias = key.indexOf("_api_c2_") === 0;
      const normalizedKey = isBubbleAlias ? key.slice("_api_c2_".length) : key;
      if (normalizedKey === "body_raw_text") return result;
      if (!isBubbleAlias || result[normalizedKey] === undefined) result[normalizedKey] = item;
      return result;
    }, {});
  }

  function flattenDashboardMetricRows(rows) {
    return (Array.isArray(rows) ? rows : []).map(row => {
      const source = normalizeBubbleApiKeys(row);
      const metrics = normalizeBubbleApiKeys(source.metrics);
      return { ...source, ...metrics };
    });
  }

  function normalizeCloudRunDashboardPayload(payload) {
    const response = parseDashboardProxyPayload(payload);
    const summary = normalizeBubbleApiKeys(response.summary || response.state || {});
    const state = normalizeBubbleApiKeys(response.state || response.summary || {});
    const eventSummaries = flattenDashboardMetricRows(response.events || []);
    const events = [{ event_code:"all", event_name:"전체 대회" }];
    eventSummaries.forEach(row => {
      if (!row.event_code || row.event_code === "all") return;
      events.push({ ...row, event_name: row.event_name || row.event_code });
    });

    return {
      summary,
      state,
      rows: Array.isArray(response.rows) ? response.rows : [],
      events,
      event_summaries: eventSummaries,
      daily: flattenDashboardMetricRows(response.daily || []),
      hourly: flattenDashboardMetricRows(response.hourly || []),
      sources: flattenDashboardMetricRows(response.sources || []),
      campaigns: flattenDashboardMetricRows(response.campaigns || []),
      devices: flattenDashboardMetricRows(response.devices || []),
      spots: flattenDashboardMetricRows(response.spots || []),
      photo_counts: flattenDashboardMetricRows(response.photo_counts || []),
      meta: normalizeBubbleApiKeys(response.meta || {}),
      row_counts: normalizeBubbleApiKeys(response.row_counts),
      generated_at: response.generated_at || ""
    };
  }

  function groupByAggType(rows) {
    const grouped = { daily: [], weekly: [], monthly: [], all: [] };
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const aggType = String(row && row.agg_type || "").toLowerCase();
      if (grouped[aggType]) grouped[aggType].push(row);
    });
    return grouped;
  }

  function buildDashboardData(payload) {
    const normalized = normalizeCloudRunDashboardPayload(payload);
    const summary = normalized.summary || {};
    const grouped = groupByAggType(normalized.rows);
    return {
      generated_at: normalized.generated_at || "",
      state: summary.state || {},
      events: Array.isArray(summary.events) && summary.events.length ? summary.events : [{ event_code:"all", event_name:"전체 대회" }],
      hourly: Array.isArray(summary.hourly) ? summary.hourly : [],
      daily: grouped.daily || [],
      weekly: grouped.weekly || [],
      monthly: grouped.monthly || [],
      all: grouped.all || [],
      event_summaries: Array.isArray(summary.event_summaries) ? summary.event_summaries : [],
      ranges: Array.isArray(summary.ranges) ? summary.ranges : [],
      sales_amount_hour: Array.isArray(summary.sales_amount_hour) ? summary.sales_amount_hour : [],
      sources: Array.isArray(summary.sources) ? summary.sources : [],
      campaigns: Array.isArray(summary.campaigns) ? summary.campaigns : [],
      devices: Array.isArray(summary.devices) ? summary.devices : [],
      photo_counts: Array.isArray(summary.photo_counts) ? summary.photo_counts : Array.isArray(summary.photo_count_stats) ? summary.photo_count_stats : Array.isArray(summary.photo_count_buckets) ? summary.photo_count_buckets : [],
      searchTypes: Array.isArray(summary.search_types) ? summary.search_types : [],
      exposures: Array.isArray(summary.exposures) ? summary.exposures : [],
      queries: Array.isArray(summary.queries) ? summary.queries : [],
      carts: Array.isArray(summary.carts) ? summary.carts : [],
      products: Array.isArray(summary.products) ? summary.products : [],
      spots: Array.isArray(summary.spots) ? summary.spots : [],
      course_ranges: Array.isArray(summary.course_ranges) ? summary.course_ranges : [],
      quality: Array.isArray(summary.quality) ? summary.quality : [],
      payment_failures: Array.isArray(summary.payment_failures) ? summary.payment_failures : []
    };
  }

  function filterDashboardRowsByPeriod(rows, aggType) {
    return (Array.isArray(rows) ? rows : []).filter(row => String(row && row.agg_type || "").toLowerCase() === String(aggType || "").toLowerCase());
  }

  function countBy(rows, key) {
    return (Array.isArray(rows) ? rows : []).reduce((acc, row) => {
      const value = row && row[key];
      if (value === undefined || value === null || value === "") return acc;
      const bucket = String(value);
      acc[bucket] = (acc[bucket] || 0) + 1;
      return acc;
    }, {});
  }

  function aggregateRows(rows) {
    return (Array.isArray(rows) ? rows : []).reduce((acc, row) => {
      Object.keys(row || {}).forEach(key => {
        if (typeof row[key] === "number") acc[key] = (acc[key] || 0) + row[key];
      });
      return acc;
    }, {});
  }

  function sessionIdsCount(rows) {
    const ids = new Set();
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const value = row && (row.session_id || row.sid || row.search_session_id);
      if (value) ids.add(String(value));
    });
    return ids.size;
  }

  function saturdayWeekStart(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const result = new Date(date);
    while (result.getDay() !== 6) result.setDate(result.getDate() - 1);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  function saturdayWeekEndExclusive(value) {
    const start = saturdayWeekStart(value);
    if (!start) return null;
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return end;
  }

  function saturdayWeekLabel(value) {
    const start = saturdayWeekStart(value);
    const end = saturdayWeekEndExclusive(value);
    if (!start || !end) return "";
    return `${rangeLabel(start)} - ${rangeLabel(addDays(end, -1))}`;
  }

  function addDays(value, offset) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const next = new Date(date);
    next.setDate(next.getDate() + Number(offset || 0));
    return next;
  }

  function numberValue(source, keys) {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (let i = 0; i < keyList.length; i += 1) {
      const value = source && source[keyList[i]];
      const num = Number(value);
      if (Number.isFinite(num)) return num;
    }
    return 0;
  }

  function averageExposure(rows) {
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return 0;
    const total = list.reduce((sum, row) => sum + numberValue(row, ["exposure", "exposure_count"]), 0);
    return total / list.length;
  }

  function rateValue(numerator, denominator) {
    const num = Number(numerator || 0);
    const den = Number(denominator || 0);
    if (!den) return 0;
    return (num / den) * 100;
  }

  function safeRate(numerator, denominator) {
    return rateValue(numerator, denominator);
  }

  function rangeLabel(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("ko-KR");
  }

  function formatWon(value) {
    return `₩${formatNumber(Math.round(Number(value || 0)))}`;
  }

  function formatPercent(value) {
    return Number(value || 0).toFixed(1) + "%";
  }

  window.SotAdminHead = {
    dashboardSections,
    dashboardDataApiPath,
    DASHBOARD_PAGE_LIMIT,
    SOT_ADMIN_DASHBOARD_PROXY_PATH,
    emptyDashboardData,
    fetchAllDashboardRows,
    getDashboardApiConfig,
    fetchDashboardSummaryFromCloudRun,
    fetchDashboardDetailFromCloudRun,
    fetchDashboardSnapshot,
    normalizeCloudRunDashboardPayload,
    groupByAggType,
    buildDashboardData,
    filterDashboardRowsByPeriod,
    countBy,
    aggregateRows,
    sessionIdsCount,
    saturdayWeekStart,
    saturdayWeekEndExclusive,
    saturdayWeekLabel,
    addDays,
    numberValue,
    averageExposure,
    rateValue,
    safeRate,
    rangeLabel,
    formatNumber,
    formatWon,
    formatPercent
  };
})();

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
  const BIB_MIN_DIGITS_DEFAULT = 4;
  const SOT_HEAD = window.SotAdminHead;
  if (!SOT_HEAD) {
    console.error("[SOT Dashboard] head helper not loaded");
    return;
  }

  function todayKSTDateKey() {
    return formatKSTDate(new Date());
  }

  function yesterdayKSTDateKey() {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return formatKSTDate(date);
  }

  let allEvents = [];
  let activeAdminView = "events";
  let activeEventMonth = getKSTMonthKey(new Date());
  let editingEventId = "";
  let sotDashActiveSection = "overview";
  let sotDashActiveTab = "summary";
  let sotDashEventFilter = "all";
  let sotDashPeriodFilter = "all";
  let sotDashSourceFilter = "all";
  let sotDashFetchCount = 0;
  let sotDashSelectedWeekStart = "";
  let sotDashSelectedDateKey = "";
  let sotDashboardRawRows = [];
  let sotDashboardRows = [];
  let sotDashboardByAggType = {};
  let sotDashData = SOT_HEAD.emptyDashboardData();
  let sotDashLoading = false;
  let sotDashLoaded = false;
  let sotDashLastError = "";
  let sotCurrentTestData = SOT_HEAD.emptyDashboardData();
  let sotCurrentTestLoading = false;
  let sotCurrentTestLoaded = false;
  let sotCurrentTestLastError = "";
  let sotCurrentTestMissingSnapshot = null;
  let currentDashView = "report";
  let currentDashReportPeriod = "weekly";
  let currentDashReportSelectedWeekStart = "";
  let currentDashReportSelectedWeekKey = sotWeekKeyFromDateKey(yesterdayKSTDateKey());
  let currentDashReportSelectedDateKey = yesterdayKSTDateKey();
  let currentDashReportSelectedMonthKey = monthKeyFromDateKey(todayKSTDateKey());
  let currentDashEventPeriod = "weekly";
  let currentDashSelectedEvent = "all";
  let currentDashSelectedWeekStart = "";
  let currentDashSelectedWeekKey = sotWeekKeyFromDateKey(yesterdayKSTDateKey());
  let currentDashSelectedDateKey = yesterdayKSTDateKey();
  let currentDashSelectedMonthKey = monthKeyFromDateKey(todayKSTDateKey());
  let currentDashEventDetailCode = "";
  let currentDashEventDetailPeriodKey = "";
  let currentDashEventDetailData = SOT_HEAD.emptyDashboardData();
  let currentDashEventDetailLoading = false;
  let currentDashEventDetailError = "";
  let currentDashEventDetailMissingSnapshot = null;
  const currentDashEventDetailCache = {};
  let currentDashStatusSnapshot = null;
  let currentDashEventListSnapshot = null;
  let currentDashInitialDateResolved = false;

  function invalidateCurrentDashReportCache() {
    sotCurrentTestLoaded = false;
    sotCurrentTestData = SOT_HEAD.emptyDashboardData();
    sotCurrentTestMissingSnapshot = null;
  }

  function clearCurrentDashEventDetailCache() {
    Object.keys(currentDashEventDetailCache).forEach(key => { delete currentDashEventDetailCache[key]; });
    currentDashEventDetailCode = "";
    currentDashEventDetailPeriodKey = "";
    currentDashEventDetailData = SOT_HEAD.emptyDashboardData();
    currentDashEventDetailError = "";
    currentDashEventDetailMissingSnapshot = null;
  }

  function currentDashEventLabel(row) {
    if (!row) return "";
    return row.event_name || row.event_display_name || row.display_name || row.name || row.event_code || "";
  }

  function mergeCurrentDashEventOptions(...sources) {
    const byCode = new Map();
    sources.flat().forEach(row => {
      if (!row || typeof row !== "object") return;
      const eventCode = String(row.event_code || "").trim();
      if (!eventCode || eventCode === "all") return;
      const existing = byCode.get(eventCode) || { event_code: eventCode };
      const merged = { ...existing, ...row, event_code: eventCode };
      const existingLabel = currentDashEventLabel(existing);
      const nextLabel = currentDashEventLabel(row);
      if (!existingLabel || existingLabel === eventCode || (nextLabel && nextLabel !== eventCode)) {
        merged.event_name = nextLabel || eventCode;
      } else {
        merged.event_name = existingLabel;
      }
      byCode.set(eventCode, merged);
    });
    return Array.from(byCode.values()).sort((a, b) => {
      return String(currentDashEventLabel(a)).localeCompare(String(currentDashEventLabel(b)), "ko");
    });
  }

  function currentDashEventOptions() {
    return mergeCurrentDashEventOptions(
      currentDashEventListSnapshot?.events || [],
      sotCurrentTestData.events || [],
      sotCurrentTestData.event_summaries || [],
      sotCurrentTestData.daily || [],
      sotCurrentTestData.hourly || [],
      sotCurrentTestData.sources || [],
      sotCurrentTestData.campaigns || [],
      sotCurrentTestData.devices || [],
      sotCurrentTestData.photo_counts || [],
      sotCurrentTestData.spots || [],
      allEvents || []
    );
  }

  async function ensureCurrentDashStatusSnapshot() {
    if (currentDashStatusSnapshot) return currentDashStatusSnapshot;
    try {
      const payload = await SOT_HEAD.fetchDashboardSnapshot({
        snapshotType: "snapshot_status",
        periodKey: "latest",
        eventCode: "all",
        tab: "report"
      });
      if (payload && payload.ok) currentDashStatusSnapshot = SOT_HEAD.normalizeCloudRunDashboardPayload(payload);
    } catch (error) {
      console.warn("[SOT Snapshot] snapshot_status unavailable", error?.message || error);
    }
    return currentDashStatusSnapshot;
  }

  function currentDashAvailableDateKeys() {
    const keys = currentDashStatusSnapshot?.meta?.date_keys;
    return Array.isArray(keys) ? keys.filter(Boolean) : [];
  }

  function currentDashLatestAvailableDateKey() {
    const keys = currentDashAvailableDateKeys();
    return keys.length ? keys[keys.length - 1] : "";
  }

  function syncCurrentDashDateSelection(dateKey) {
    if (!dateKey) return;
    currentDashReportSelectedDateKey = dateKey;
    currentDashReportSelectedWeekKey = sotWeekKeyFromDateKey(dateKey);
    currentDashReportSelectedMonthKey = monthKeyFromDateKey(dateKey);
    currentDashSelectedDateKey = dateKey;
    currentDashSelectedWeekKey = sotWeekKeyFromDateKey(dateKey);
    currentDashSelectedMonthKey = monthKeyFromDateKey(dateKey);
  }

  async function ensureCurrentDashInitialSnapshotDate() {
    if (currentDashInitialDateResolved) return;
    await ensureCurrentDashStatusSnapshot();
    const todayDateKey = todayKSTDateKey();
    const yesterdayDateKey = yesterdayKSTDateKey();
    if (!currentDashReportSelectedMonthKey) currentDashReportSelectedMonthKey = monthKeyFromDateKey(todayDateKey);
    if (!currentDashSelectedMonthKey) currentDashSelectedMonthKey = monthKeyFromDateKey(todayDateKey);
    if (!currentDashReportSelectedDateKey) currentDashReportSelectedDateKey = yesterdayDateKey;
    if (!currentDashSelectedDateKey) currentDashSelectedDateKey = yesterdayDateKey;
    if (!currentDashReportSelectedWeekKey) currentDashReportSelectedWeekKey = saturdayFridayWeekKeyFromDateKey(currentDashReportSelectedDateKey);
    if (!currentDashSelectedWeekKey) currentDashSelectedWeekKey = saturdayFridayWeekKeyFromDateKey(currentDashSelectedDateKey);
    if (currentDashReportPeriod === "weekly") syncReportWeeklySelection(currentDashReportSelectedDateKey, currentDashReportSelectedWeekKey);
    if (currentDashEventPeriod === "weekly") syncEventWeeklySelection(currentDashSelectedDateKey, currentDashSelectedWeekKey);
    currentDashInitialDateResolved = true;
  }

  async function ensureCurrentDashEventListSnapshot() {
    if (currentDashEventListSnapshot) return currentDashEventListSnapshot;
    try {
      const payload = await SOT_HEAD.fetchDashboardSnapshot({
        snapshotType: "event_list",
        periodKey: "latest",
        eventCode: "all",
        tab: "event-analysis"
      });
      if (payload && payload.ok) currentDashEventListSnapshot = SOT_HEAD.normalizeCloudRunDashboardPayload(payload);
    } catch (error) {
      console.warn("[SOT Snapshot] event_list unavailable", error?.message || error);
    }
    return currentDashEventListSnapshot;
  }

  function syncCurrentDashHeroSnapshotInfo() {
    const updated = $("#sh_hero_updated");
    const endpoint = $("#sh_hero_snapshot_key");
    if (updated) {
      const generatedAt = currentDashStatusSnapshot?.meta?.generated_at || sotCurrentTestData?.generated_at || "";
      const rangeStart = currentDashStatusSnapshot?.meta?.date_keys?.[0] || "";
      const rangeEnd = (currentDashStatusSnapshot?.meta?.date_keys || []).slice(-1)[0] || "";
      updated.textContent = generatedAt
        ? `${generatedAt}${rangeStart && rangeEnd ? ` / 생성 범위 ${rangeStart} ~ ${rangeEnd}` : ""}`
        : "snapshot generated_at 없음";
    }
    if (endpoint) {
      endpoint.textContent = currentDashSnapshotTypeForView(currentDashView) + " / " + currentDashPeriodKeyForView(currentDashView);
    }
  }

  function warnSnapshotHourlyCount(data) {
    if ((data?.hourly || []).length !== 24) {
      console.warn("[SOT Snapshot] hourly row count is not 24", data?.hourly?.length);
    }
  }

  const SOT_DASH_SECTIONS = SOT_HEAD.dashboardSections;
  const numberValue = SOT_HEAD.numberValue;
  const averageExposure = SOT_HEAD.averageExposure;
  const rateValue = SOT_HEAD.rateValue;
  const safeRate = SOT_HEAD.safeRate;
  const rangeLabel = SOT_HEAD.rangeLabel;
  const formatNumber = SOT_HEAD.formatNumber;
  const formatWon = SOT_HEAD.formatWon;
  const formatPercent = SOT_HEAD.formatPercent;
  const sessionIdsCount = SOT_HEAD.sessionIdsCount;
  const saturdayWeekStart = SOT_HEAD.saturdayWeekStart;
  const saturdayWeekLabel = SOT_HEAD.saturdayWeekLabel;
  const addDays = typeof SOT_HEAD.addDays === "function"
    ? SOT_HEAD.addDays
    : function(dateKey, days){
        if (!dateKey) return "";
        const [y, m, d] = String(dateKey).split("-").map(Number);
        if (!y || !m || !d) return "";
        const base = new Date(Date.UTC(y, m - 1, d));
        base.setUTCDate(base.getUTCDate() + Number(days || 0));
        const yy = base.getUTCFullYear();
        const mm = String(base.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(base.getUTCDate()).padStart(2, "0");
        console.warn("[SOT Admin] SotAdminHead.addDays missing, using local fallback");
        return `${yy}-${mm}-${dd}`;
      };

  function monthKeyFromDateKey(dateKey) {
    return String(dateKey || "").slice(0, 7);
  }

  function parseDateKeyUtc(dateKey) {
    const [y, m, d] = String(dateKey || "").split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(Date.UTC(y, m - 1, d));
  }

  function toDateKeyUtc(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    const yy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  }

  function saturdayStartDateKey(dateKey) {
    const date = parseDateKeyUtc(dateKey);
    if (!date) return "";
    while (date.getUTCDay() !== 6) date.setUTCDate(date.getUTCDate() - 1);
    return toDateKeyUtc(date);
  }

  function saturdayFridayWeekKeyFromDateKey(dateKey) {
    return sotWeekKeyFromDateKey(dateKey);
  }

  function buildWeeksForMonth(monthKey) {
    const [year, month] = String(monthKey || "").split("-").map(Number);
    if (!year || !month) return [];
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0));
    const cursor = parseDateKeyUtc(saturdayStartDateKey(toDateKeyUtc(monthStart)));
    if (!cursor) return [];
    const weeks = [];
    let index = 1;
    while (cursor.getTime() <= monthEnd.getTime()) {
      const weekStart = new Date(cursor);
      const weekEnd = new Date(cursor);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      const startDateKey = toDateKeyUtc(weekStart);
      const endDateKey = toDateKeyUtc(weekEnd);
      const label = `${year}년 ${month}월 ${index}주차 (${startDateKey} ~ ${endDateKey})`;
      weeks.push({
        month_key: monthKey,
        week_key: saturdayFridayWeekKeyFromDateKey(startDateKey),
        index,
        start_date_key: startDateKey,
        end_date_key: endDateKey,
        label
      });
      cursor.setUTCDate(cursor.getUTCDate() + 7);
      index += 1;
    }
    return weeks;
  }

  function weekContainsDate(weekRow, dateKey) {
    if (!weekRow || !dateKey) return false;
    return weekRow.start_date_key <= dateKey && dateKey <= weekRow.end_date_key;
  }

  function pickWeekForMonth(monthKey, preferredWeekKey, preferredDateKey) {
    const weeks = buildWeeksForMonth(monthKey);
    if (!weeks.length) return null;
    return weeks.find(row => row.week_key === preferredWeekKey)
      || weeks.find(row => weekContainsDate(row, preferredDateKey))
      || weeks[weeks.length - 1];
  }

  function weekLabelForMonth(monthKey, weekKey) {
    const weeks = buildWeeksForMonth(monthKey);
    return weeks.find(row => row.week_key === weekKey)?.label || weekKey || "";
  }

  function syncReportWeeklySelection(preferredDateKey, preferredWeekKey) {
    const baseMonthKey = currentDashReportSelectedMonthKey || monthKeyFromDateKey(todayKSTDateKey());
    currentDashReportSelectedMonthKey = baseMonthKey;
    const picked = pickWeekForMonth(baseMonthKey, preferredWeekKey, preferredDateKey || currentDashReportSelectedDateKey);
    if (!picked) return;
    currentDashReportSelectedWeekKey = picked.week_key;
    currentDashReportSelectedDateKey = weekContainsDate(picked, preferredDateKey) ? preferredDateKey : picked.start_date_key;
  }

  function syncEventWeeklySelection(preferredDateKey, preferredWeekKey) {
    const baseMonthKey = currentDashSelectedMonthKey || monthKeyFromDateKey(todayKSTDateKey());
    currentDashSelectedMonthKey = baseMonthKey;
    const picked = pickWeekForMonth(baseMonthKey, preferredWeekKey, preferredDateKey || currentDashSelectedDateKey);
    if (!picked) return;
    currentDashSelectedWeekKey = picked.week_key;
    currentDashSelectedDateKey = weekContainsDate(picked, preferredDateKey) ? preferredDateKey : picked.start_date_key;
  }

  function sotWeekKeyFromDateKey(dateKey) {
    if (!dateKey) return "";
    const [y, m, d] = String(dateKey).split("-").map(Number);
    if (!y || !m || !d) return "";
    const date = new Date(Date.UTC(y, m - 1, d));
    while (date.getUTCDay() !== 6) {
      date.setUTCDate(date.getUTCDate() - 1);
    }
    const year = date.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const firstSaturday = new Date(yearStart);
    while (firstSaturday.getUTCDay() !== 6) {
      firstSaturday.setUTCDate(firstSaturday.getUTCDate() + 1);
    }
    if (date < firstSaturday) {
      return sotWeekKeyFromDateKey(`${year - 1}-12-31`);
    }
    const weekNo = Math.floor((date - firstSaturday) / (7 * 24 * 60 * 60 * 1000)) + 1;
    return `${year}-W${String(weekNo).padStart(2, "0")}`;
  }

  function syncCurrentDashPeriodKeys() {
    const reportDateKey = currentDashReportSelectedDateKey || yesterdayKSTDateKey();
    const eventDateKey = currentDashSelectedDateKey || yesterdayKSTDateKey();
    if (!currentDashReportSelectedWeekKey) currentDashReportSelectedWeekKey = sotWeekKeyFromDateKey(reportDateKey);
    if (!currentDashSelectedWeekKey) currentDashSelectedWeekKey = sotWeekKeyFromDateKey(eventDateKey);
    if (!currentDashReportSelectedMonthKey) currentDashReportSelectedMonthKey = monthKeyFromDateKey(todayKSTDateKey());
    if (!currentDashSelectedMonthKey) currentDashSelectedMonthKey = monthKeyFromDateKey(todayKSTDateKey());
    if (currentDashReportPeriod === "weekly") syncReportWeeklySelection(currentDashReportSelectedDateKey, currentDashReportSelectedWeekKey);
    if (currentDashEventPeriod === "weekly") syncEventWeeklySelection(currentDashSelectedDateKey, currentDashSelectedWeekKey);
  }

  function snapshotMissingMessage(snapshotType, periodKey) {
    return `해당 기간의 snapshot이 없습니다. 먼저 snapshot 생성을 실행하세요.`;
  }

  function currentDashScopeLabel(viewName) {
    if (viewName === "report") {
      if (currentDashReportPeriod === "weekly") return weekLabelForMonth(currentDashReportSelectedMonthKey, currentDashReportSelectedWeekKey) || currentDashPeriodKeyForView("report") || "주차별";
      if (currentDashReportPeriod === "monthly") return currentDashPeriodKeyForView("report") || "월별";
      return currentDashReportSelectedDateKey || "일별";
    }
    if (viewName === "event-analysis") {
      if (currentDashEventPeriod === "weekly") return weekLabelForMonth(currentDashSelectedMonthKey, currentDashSelectedWeekKey) || currentDashPeriodKeyForView("event-analysis") || "주차별";
      if (currentDashEventPeriod === "monthly") return currentDashPeriodKeyForView("event-analysis") || "월별";
      if (currentDashEventPeriod === "total") return "total";
      return currentDashSelectedDateKey || "일별";
    }
    return "";
  }

  function initUI(){

    const mount = document.createElement("div");
    mount.className = "sh-admin-wrap shell";
    mount.innerHTML = `
      <header class="sh-admin-hero hero">
        <div class="sh-admin-hero-main hero-main card">
          <div class="sh-admin-eyebrow">SOT Data API Admin Console</div>
          <h1 class="sh-admin-title">Shout-out Admin Dashboard</h1>
          <p class="sh-admin-sub">대회 관리, 리포트, 대회별 분석, 일지 작성, 레거시데이터를 한 화면에서 확인합니다.</p>
        </div>
        <div class="sh-admin-status-card hero-side card">
          <div><b id="sh_hero_status">상태: 대기 중</b></div>
          <div>마지막 업데이트: <span id="sh_hero_updated">레거시데이터에서 조회</span></div>
          <div>Data API: <span id="sh_hero_snapshot_key">SOT:Dashboard</span></div>
          <button class="sh-btn-sm sh-admin-refresh" type="button" id="sot_current_test_refresh_btn">스냅샷 다시 불러오기</button>
        </div>
      </header>

      <div class="sh-admin-tabs main-tabs" role="tablist" aria-label="Admin views">
        <button class="sh-admin-tab tab-btn is-active" type="button" data-admin-view="events" aria-selected="true">대회 관리</button>
        <button class="sh-admin-tab tab-btn" type="button" data-admin-view="report" aria-selected="false">리포트</button>
        <button class="sh-admin-tab tab-btn" type="button" data-admin-view="event-analysis" aria-selected="false">대회별 분석</button>
        <button class="sh-admin-tab tab-btn" type="button" data-admin-view="diary" aria-selected="false">일지 작성</button>
        <button class="sh-admin-tab tab-btn" type="button" data-admin-view="legacy" aria-selected="false">레거시데이터</button>
      </div>

      <section class="sh-admin-panel" data-admin-panel="events">
        <div class="sh-card card section">
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

        <div class="sh-event-filter card">
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

      <section class="sh-admin-panel is-hidden" data-admin-panel="report" hidden>
        <div class="sot-current-test-content" data-current-test-content="report"></div>
      </section>

      <section class="sh-admin-panel is-hidden" data-admin-panel="event-analysis" hidden>
        <div class="sot-current-test-content" data-current-test-content="event-analysis"></div>
      </section>

      <section class="sh-admin-panel is-hidden" data-admin-panel="diary" hidden>
        <div class="sot-current-test-content" data-current-test-content="diary"></div>
      </section>

      <section class="sh-admin-panel is-hidden" data-admin-panel="legacy" hidden>
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
                <p class="sot-dash-desc" id="sot_dash_desc">전체 KPI, 퍼널, 검색/노출을 탭으로 확인합니다.</p>
              </div>
              <div class="sot-dash-filters">
                <label class="sot-dash-filter-item"><span>대회</span><select class="sh-select" id="sot_dash_event_filter"></select></label>
                <label class="sot-dash-filter-item"><span>기간</span><select class="sh-select" id="sot_dash_period_filter">
                    <option value="all" selected>전체</option>
                    <option value="today">오늘</option>
                    <option value="last_7_days">최근 7일</option>
                    <option value="this_month">이번 달</option>
                  </select></label>
                <label class="sot-dash-filter-item"><span>유입</span><select class="sh-select" id="sot_dash_source_filter"></select></label>
                <button class="sot-dash-btn" type="button" id="sot_dash_refresh_btn">데이터 새로고침</button>
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

  async function fetchData(options) {
    const opts = options || {};
    const refreshDashboard = opts.refreshDashboard === true;
    $("#sh_tbody").innerHTML = "<tr><td colspan='6' style='text-align:center;'>로드 중...</td></tr>";
    try {
      const res = await fetch(BUBBLE_API_BASE + API_DATA_EVENT);
      const data = await res.json();
      allEvents = data.response.results || [];
      syncMonthFilterOptions();
      applyEventFilters();
      if (refreshDashboard && sotDashLoaded) {
        rebuildSotDashboardData(selectedDashboardEventCode());
        syncSotDashboardFilters();
        if (activeAdminView === "legacy") renderSotDashboard();
      }
    } catch(e) { $("#sh_tbody").innerHTML = "<tr><td colspan='6' style='color:red;'>로드 실패</td></tr>"; }
  }

  function getKSTMonthKey(value) {
    const formatted = formatKSTDate(value);
    return formatted ? formatted.slice(0, 7) : "";
  }

  function normalizeBibMinDigits(value) {
    return Number(value) === 3 ? 3 : BIB_MIN_DIGITS_DEFAULT;
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
          <button class="sh-btn-sm ${normalizeBibMinDigits(ev.bib_min_digits) === 3 ? 'pub' : 'priv'}" type="button" onclick="toggleBibMinDigits('${ev._id}', ${normalizeBibMinDigits(ev.bib_min_digits)})">
            ${normalizeBibMinDigits(ev.bib_min_digits)}자리
          </button>
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
    renderCurrentTestDashboard();
  }

  function currentDashSnapshotTypeForView(viewName) {
    if (viewName === "report") {
      if (currentDashReportPeriod === "weekly") return "report_weekly";
      if (currentDashReportPeriod === "monthly") return "report_monthly";
      return "report_daily";
    }
    if (viewName === "event-analysis") {
      if (currentDashEventPeriod === "weekly") return "event_weekly";
      if (currentDashEventPeriod === "monthly") return "event_monthly";
      if (currentDashEventPeriod === "total") return "event_total";
      return "event_daily";
    }
    return "report_daily";
  }

  function currentDashPeriodKeyForView(viewName) {
    syncCurrentDashPeriodKeys();
    if (viewName === "report") {
      const dateKey = currentDashReportSelectedDateKey || yesterdayKSTDateKey();
      if (currentDashReportPeriod === "weekly") {
        return currentDashReportSelectedWeekKey || sotWeekKeyFromDateKey(dateKey);
      }
      if (currentDashReportPeriod === "monthly") {
        return currentDashReportSelectedMonthKey || monthKeyFromDateKey(dateKey);
      }
      return dateKey;
    }
    if (viewName === "event-analysis") {
      const dateKey = currentDashSelectedDateKey || yesterdayKSTDateKey();
      if (currentDashEventPeriod === "weekly") {
        return currentDashSelectedWeekKey || sotWeekKeyFromDateKey(dateKey);
      }
      if (currentDashEventPeriod === "monthly") {
        return currentDashSelectedMonthKey || monthKeyFromDateKey(dateKey);
      }
      if (currentDashEventPeriod === "total") {
        return "total";
      }
      return dateKey;
    }
    return yesterdayKSTDateKey();
  }

  async function loadCurrentTestDashboard(options) {
    const opts = options || {};
    if (sotCurrentTestLoading) return;
    if (!["report", "event-analysis"].includes(currentDashView)) return;

    sotCurrentTestLoading = true;
    sotCurrentTestLastError = "";
    sotCurrentTestMissingSnapshot = null;
    renderCurrentTestDashboard();

    try {
      await ensureCurrentDashInitialSnapshotDate();
      if (currentDashView === "report" && !currentDashReportSelectedDateKey) currentDashReportSelectedDateKey = yesterdayKSTDateKey();
      if (currentDashView === "event-analysis" && !currentDashSelectedDateKey) currentDashSelectedDateKey = yesterdayKSTDateKey();
      syncCurrentDashPeriodKeys();
      const snapshotType = currentDashSnapshotTypeForView(currentDashView);
      const periodKey = currentDashPeriodKeyForView(currentDashView);
      const payload = await SOT_HEAD.fetchDashboardSnapshot({
        snapshotType,
        periodKey,
        eventCode: "all",
        tab: currentDashView,
        manualRefresh: opts.manualRefresh === true
      });
      if (payload && payload.ok === false && payload.error === "snapshot_not_found") {
        console.warn("[SOT Snapshot] not found", {
          agg_key: payload?.agg_key,
          snapshot_type: payload?.snapshot_type,
          event_code: payload?.event_code,
          period_key: payload?.period_key
        });
        sotCurrentTestLoaded = false;
        sotCurrentTestData = SOT_HEAD.emptyDashboardData();
        sotCurrentTestMissingSnapshot = {
          agg_key: payload.agg_key || "",
          message: snapshotMissingMessage(snapshotType, periodKey)
        };
        clearCurrentDashEventDetailCache();
        return;
      }
      sotCurrentTestData = SOT_HEAD.normalizeCloudRunDashboardPayload(payload);
      warnSnapshotHourlyCount(sotCurrentTestData);
      clearCurrentDashEventDetailCache();
      sotCurrentTestLoaded = true;
      ensureCurrentDashStatusSnapshot().then(() => {
        syncCurrentDashHeroSnapshotInfo();
        if (currentDashView === "event-analysis") renderCurrentTestDashboard();
      });
      if (currentDashView === "event-analysis") {
        ensureCurrentDashEventListSnapshot().then(() => renderCurrentTestDashboard());
      }
      if (currentDashView === "event-analysis" && currentDashSelectedEvent !== "all") {
        ensureCurrentDashEventDetail(currentDashSelectedEvent);
      }
    } catch (error) {
      sotCurrentTestLastError = error && error.message ? error.message : "snapshot API 연결 실패";
      console.error("[SOT Snapshot] failed", {
        message: error?.message,
        snapshot_type: currentDashSnapshotTypeForView(currentDashView),
        event_code: "all",
        period_key: currentDashPeriodKeyForView(currentDashView)
      });
    } finally {
      sotCurrentTestLoading = false;
      renderCurrentTestDashboard();
    }
  }

  function currentTestDashboardFrame(contentMarkup) {
    return contentMarkup || "";
  }

  function currentDashFallbackTable(headers) {
    return `<div class="ctdash-table-wrap"><table class="ctdash-table"><thead><tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody><tr><td colspan="${headers.length}">데이터가 없습니다.</td></tr></tbody></table></div>`;
  }

  function renderCurrentDashFallbackView(stateTitle, stateMessage) {
    const stateCard = `<article class="ctdash-card ctdash-section section"><div class="ctdash-kicker">${escapeHtml(stateTitle)}</div><h3>데이터를 불러오지 못했습니다</h3><div class="ctdash-callout warn">${escapeHtml(stateMessage)}</div></article>`;
    if (currentDashView === "diary") return `${stateCard}${renderCurrentDashDiaryView()}`;

    const eventMode = currentDashView === "event-analysis";
    const title = eventMode ? "대회별 분석" : "리포트";
    const kicker = eventMode ? "Event Analysis" : "Report";
    const metrics = eventMode
      ? [["대회명", "비어있음", "대회 데이터를 기다리는 중"], ["참가자 수", "0명", "Bubble 이벤트 데이터"], ["대회매출", "₩0", "선택 기간 기준"], ["객단가", "₩0", "구매 1건당"]]
      : [["접속수", "0회", "로컬 개수"], ["검색자", "0명", "로컬 개수"], ["검색수", "0건", "세션 수"], ["장바구니수", "0건", "카트 진입"], ["구매수", "0건", "결제 완료"]];
    const trafficHeaders = eventMode ? ["대회", "캠페인", "소스", "검색", "구매", "매출"] : ["캠페인", "소스", "접속", "검색", "구매", "매출"];
    return `
      ${stateCard}
      <section class="ctdash-screen ctdash-fallback-screen">
        <article class="ctdash-card ctdash-section section">
          <div class="ctdash-section-head">
            <div><div class="ctdash-kicker">${kicker}</div><h3>${title}</h3><p>데이터 연결 전에도 동일한 리포트 구조를 먼저 표시합니다.</p></div>
            <div class="ctdash-period-tabs">${eventMode
              ? `<button class="ctdash-chip ${currentDashEventPeriod === "daily" ? "is-active" : ""}" type="button">일별</button><button class="ctdash-chip ${currentDashEventPeriod === "weekly" ? "is-active" : ""}" type="button">주차별</button><button class="ctdash-chip ${currentDashEventPeriod === "monthly" ? "is-active" : ""}" type="button">월별</button><button class="ctdash-chip ${currentDashEventPeriod === "total" ? "is-active" : ""}" type="button">전체</button>`
              : `<button class="ctdash-chip ${currentDashReportPeriod === "daily" ? "is-active" : ""}" type="button">일별</button><button class="ctdash-chip ${currentDashReportPeriod === "weekly" ? "is-active" : ""}" type="button">주차별</button><button class="ctdash-chip ${currentDashReportPeriod === "monthly" ? "is-active" : ""}" type="button">월별</button>`}</div>
          </div>
          <div class="ctdash-inline-fields">${eventMode ? currentDashEventScopeControls() : currentDashReportScopeControls()}</div>
          <div class="${eventMode ? "ctdash-summary-grid" : "ctdash-metrics-grid"}">${metrics.map(row => metricCard(row[0], row[1], row[2])).join("")}</div>
        </article>
        <div class="ctdash-two-col">
          <article class="ctdash-card ctdash-section section">
            <div class="ctdash-section-head"><div><div class="ctdash-kicker">${eventMode ? "Graph" : "Hourly"}</div><h3>${eventMode ? "기간 그래프" : "시간대별 그래프"}</h3></div><span class="ctdash-tag">데이터 대기 중</span></div>
            <div class="ctdash-chart-box"><div class="ctdash-chart-placeholder">${sotCurrentTestLoading ? "데이터 대기 중" : "표시할 데이터가 없습니다"}</div></div>
          </article>
          <article class="ctdash-card ctdash-section section">
            <div class="ctdash-section-head"><div><div class="ctdash-kicker">Conversion</div><h3>${eventMode ? "스팟별 데이터" : "전환율"}</h3></div><span class="ctdash-tag">0%</span></div>
            <div class="ctdash-conv-grid">${["접속 → 검색", "검색 → 카트", "카트 → 구매"].map(label => `<div class="ctdash-conv-card"><div class="ctdash-conv-top"><h4>${label}</h4><strong>0%</strong></div><div class="ctdash-bar"><span style="width:0%"></span></div><p>데이터 없음</p></div>`).join("")}</div>
          </article>
        </div>
        <article class="ctdash-card ctdash-section section">
          <div class="ctdash-section-head"><div><div class="ctdash-kicker">Traffic</div><h3>${eventMode ? "유입경로별 분석" : "유입별"}</h3></div><span class="ctdash-tag">Campaign / Source</span></div>
          ${currentDashFallbackTable(trafficHeaders)}
        </article>
        <article class="ctdash-card ctdash-section section">
          <div class="ctdash-section-head"><div><div class="ctdash-kicker">Sales</div><h3>매출</h3></div><span class="ctdash-tag">₩0</span></div>
          <div class="ctdash-sales-grid">${[["참가자 수", "0명", "Bubble 이벤트 데이터"], ["객단가", "₩0", "구매 1건당"], ["일매출", "₩0", "선택 기간 합계"], ["참가자 대비 구매율", "0%", "로컬 기준"]].map(row => metricCard(row[0], row[1], row[2])).join("")}</div>
        </article>
      </section>`;
  }

  function renderCurrentDashShellState(message, tone) {
    syncCurrentDashSelections();
    const calloutClass = tone === "warn" ? "ctdash-callout warn" : "ctdash-callout";
    const reportMarkup = currentDashView === "report" ? renderCurrentDashReportView() : "";
    const eventMarkup = currentDashView === "event-analysis" ? renderCurrentDashEventView() : "";
    return `${message ? `<div class="${calloutClass}">${escapeHtml(message)}</div>` : ""}${reportMarkup}${eventMarkup}`;
  }

  function renderCurrentTestDashboard() {
    const target = document.querySelector(`[data-current-test-content="${currentDashView}"]`);
    if (!target) return;
    if (currentDashView === "diary") {
      target.innerHTML = currentTestDashboardFrame(renderCurrentDashDiaryView(), "일지");
      return;
    }

    if (sotCurrentTestLoading) {
      if (currentDashStatusSnapshot) {
        target.innerHTML = currentTestDashboardFrame(renderCurrentDashShellState("snapshot 데이터를 불러오는 중입니다.", "info"), "불러오는 중");
        renderCurrentDashCharts();
        return;
      }
      target.innerHTML = currentTestDashboardFrame(renderCurrentDashFallbackView("Loading", "Bubble Admin 프록시를 통해 snapshot 데이터를 불러오는 중입니다."), "불러오는 중");
      return;
    }
    if (sotCurrentTestMissingSnapshot) {
      target.innerHTML = currentTestDashboardFrame(renderCurrentDashShellState(sotCurrentTestMissingSnapshot.message, "warn"), "snapshot 없음");
      renderCurrentDashCharts();
      return;
    }
    if (sotCurrentTestLastError) {
      target.innerHTML = currentTestDashboardFrame(renderCurrentDashShellState(`snapshot API 연결 실패: ${sotCurrentTestLastError}`, "warn"), "연결 실패");
      renderCurrentDashCharts();
      return;
    }
    if (!sotCurrentTestLoaded) {
      if (currentDashStatusSnapshot) {
        target.innerHTML = currentTestDashboardFrame(renderCurrentDashShellState("snapshot 데이터를 아직 불러오지 않았습니다. 탭 진입 시 자동 조회됩니다.", "warn"), "대기 중");
        renderCurrentDashCharts();
        return;
      }
      target.innerHTML = currentTestDashboardFrame(renderCurrentDashFallbackView("Waiting", "snapshot 데이터를 아직 불러오지 않았습니다. 탭 진입 시 자동 조회됩니다."), "대기 중");
      return;
    }
    syncCurrentDashSelections();
    syncCurrentDashHeroSnapshotInfo();
    const reportMarkup = currentDashView === "report" ? renderCurrentDashReportView() : "";
    const eventMarkup = currentDashView === "event-analysis" ? renderCurrentDashEventView() : "";
    const eventDetailMissingMarkup = currentDashEventDetailMissingSnapshot && currentDashView === "event-analysis"
      ? `<div class="ctdash-callout warn">${escapeHtml(currentDashEventDetailMissingSnapshot.message)}</div>`
      : "";
    const eventDetailErrorMarkup = currentDashEventDetailError && currentDashView === "event-analysis"
      ? `<div class="ctdash-callout warn">${escapeHtml(currentDashEventDetailError)}</div>`
      : "";
    target.innerHTML = currentTestDashboardFrame(`${eventDetailMissingMarkup}${eventDetailErrorMarkup}${reportMarkup}${eventMarkup}`, "연결됨");
    renderCurrentDashCharts();
  }

  async function ensureCurrentDashEventDetail(eventCode, options) {
    const opts = options || {};
    if (!eventCode || eventCode === "all") {
      clearCurrentDashEventDetailCache();
      return;
    }
    const snapshotType = currentDashSnapshotTypeForView("event-analysis");
    const periodKey = currentDashPeriodKeyForView("event-analysis");
    const cacheKey = `${snapshotType}::${periodKey}::${eventCode}`;
    if (!opts.manualRefresh && currentDashEventDetailCache[cacheKey]) {
      currentDashEventDetailCode = eventCode;
      currentDashEventDetailPeriodKey = periodKey;
      currentDashEventDetailData = currentDashEventDetailCache[cacheKey];
      currentDashEventDetailLoading = false;
      currentDashEventDetailError = "";
      currentDashEventDetailMissingSnapshot = null;
      return;
    }
    currentDashEventDetailLoading = true;
    currentDashEventDetailData = SOT_HEAD.emptyDashboardData();
    currentDashEventDetailError = "";
    currentDashEventDetailMissingSnapshot = null;
    renderCurrentTestDashboard();
    try {
      const payload = await SOT_HEAD.fetchDashboardSnapshot({
        snapshotType,
        periodKey,
        eventCode,
        tab: "event-analysis",
        manualRefresh: opts.manualRefresh === true
      });
      if (payload && payload.ok === false && payload.error === "snapshot_not_found") {
        console.warn("[SOT Snapshot] not found", {
          agg_key: payload?.agg_key,
          snapshot_type: payload?.snapshot_type,
          event_code: payload?.event_code,
          period_key: payload?.period_key
        });
        currentDashEventDetailCode = eventCode;
        currentDashEventDetailPeriodKey = periodKey;
        currentDashEventDetailData = SOT_HEAD.emptyDashboardData();
        currentDashEventDetailMissingSnapshot = {
          agg_key: payload.agg_key || "",
          message: snapshotMissingMessage(snapshotType, periodKey)
        };
        return;
      }
      const normalized = SOT_HEAD.normalizeCloudRunDashboardPayload(payload);
      warnSnapshotHourlyCount(normalized);
      currentDashEventDetailCache[cacheKey] = normalized;
      currentDashEventDetailCode = eventCode;
      currentDashEventDetailPeriodKey = periodKey;
      currentDashEventDetailData = normalized;
      currentDashEventDetailMissingSnapshot = null;
    } catch (error) {
      currentDashEventDetailError = error && error.message ? error.message : "대회별 상세 데이터를 불러오지 못했습니다.";
      console.error("[SOT Snapshot] failed", {
        message: error?.message,
        snapshot_type: snapshotType,
        event_code: eventCode,
        period_key: periodKey
      });
    } finally {
      currentDashEventDetailLoading = false;
      renderCurrentTestDashboard();
    }
  }

  function syncCurrentDashSelections() {
    const events = currentDashEventOptions();
    if (currentDashSelectedEvent !== "all" && events.length && !events.some(row => row.event_code === currentDashSelectedEvent)) currentDashSelectedEvent = "all";
    if (!currentDashReportSelectedDateKey) currentDashReportSelectedDateKey = yesterdayKSTDateKey();
    if (!currentDashSelectedDateKey) currentDashSelectedDateKey = yesterdayKSTDateKey();
    if (!currentDashReportSelectedMonthKey) currentDashReportSelectedMonthKey = monthKeyFromDateKey(todayKSTDateKey());
    if (!currentDashSelectedMonthKey) currentDashSelectedMonthKey = monthKeyFromDateKey(todayKSTDateKey());
    syncCurrentDashPeriodKeys();
  }

  function currentDashEventDataset() {
    if (currentDashSelectedEvent !== "all" && currentDashEventDetailCode === currentDashSelectedEvent && currentDashEventDetailPeriodKey === currentDashPeriodKeyForView("event-analysis") && currentDashEventDetailData) {
      return currentDashEventDetailData;
    }
    if (currentDashSelectedEvent !== "all") return SOT_HEAD.emptyDashboardData();
    return sotCurrentTestData;
  }

  function currentDashSelectedEventSummary() {
    const detail = currentDashEventDataset();
    if (currentDashSelectedEvent !== "all") return detail.state || detail.summary || {};
    return sotCurrentTestData.state || sotCurrentTestData.summary || {};
  }

  function currentDashReportRowsForPeriod() {
    const daily = sortMetricRows(sotCurrentTestData.daily || []);
    return daily.filter(row => (row.date_key || row.period_key || row.label) === currentDashReportSelectedDateKey);
  }

  function currentDashReportState() {
    return sotCurrentTestData.state || sotCurrentTestData.summary || {};
  }

  function currentDashReportScopeLabel() {
    return currentDashScopeLabel("report");
  }

  function currentDashReportScopeControls() {
    if (currentDashReportPeriod === "monthly") {
      return `<label><span>월 선택</span><input class="ctdash-input" type="month" id="ctdash_report_month_input" value="${escapeHtml(currentDashReportSelectedMonthKey || monthKeyFromDateKey(currentDashReportSelectedDateKey || todayKSTDateKey()))}"></label>`;
    }
    if (currentDashReportPeriod === "weekly") {
      const monthKey = currentDashReportSelectedMonthKey || monthKeyFromDateKey(todayKSTDateKey());
      const weeks = buildWeeksForMonth(monthKey);
      return `
        <label><span>기준월</span><input class="ctdash-input" type="month" id="ctdash_report_week_month_input" value="${escapeHtml(monthKey)}"></label>
        <label><span>주차 선택</span><select class="ctdash-select" id="ctdash_report_week_select">${weeks.map(row => `<option value="${escapeHtml(row.week_key)}" ${row.week_key === currentDashReportSelectedWeekKey ? "selected" : ""}>${escapeHtml(row.label)}</option>`).join("")}</select></label>
      `;
    }
    return `<label><span>일자 선택</span><input class="ctdash-input" type="date" id="ctdash_report_date_input" value="${escapeHtml(currentDashReportSelectedDateKey || "")}"></label>`;
  }

  function currentDashEventScopeControls() {
    const monthlyValue = currentDashSelectedMonthKey || monthKeyFromDateKey(todayKSTDateKey());
    const weeklyOptions = buildWeeksForMonth(monthlyValue);
    const eventOptions = currentDashEventOptions();
    return `
      <label><span>대회 선택</span><select class="ctdash-select" id="ctdash_event_select">${[{ event_code:"all", event_name:"전체 대회" }].concat(eventOptions).map(row => `<option value="${escapeHtml(row.event_code)}" ${row.event_code === currentDashSelectedEvent ? "selected" : ""}>${escapeHtml(currentDashEventLabel(row))}</option>`).join("")}</select></label>
      ${currentDashEventPeriod === "total"
        ? `<label><span>전체 기준</span><input class="ctdash-input" type="text" value="total" disabled></label>`
        : currentDashEventPeriod === "monthly"
          ? `<label><span>월 선택</span><input class="ctdash-input" type="month" id="ctdash_event_month_input" value="${escapeHtml(monthlyValue)}"></label>`
          : currentDashEventPeriod === "weekly"
            ? `<label><span>기준월</span><input class="ctdash-input" type="month" id="ctdash_event_week_month_input" value="${escapeHtml(monthlyValue)}"></label><label><span>주차 선택</span><select class="ctdash-select" id="ctdash_event_week_select">${weeklyOptions.map(row => `<option value="${escapeHtml(row.week_key)}" ${row.week_key === currentDashSelectedWeekKey ? "selected" : ""}>${escapeHtml(row.label)}</option>`).join("")}</select></label>`
            : `<label><span>일자 선택</span><input class="ctdash-input" type="date" id="ctdash_date_input" value="${escapeHtml(currentDashSelectedDateKey || "")}"></label>`}
    `;
  }

  function currentDashEventRowsForPeriod(detail) {
    const daily = sortMetricRows((detail || {}).daily || []);
    return daily.filter(row => (row.date_key || row.period_key || row.label) === currentDashSelectedDateKey);
  }

  function currentDashChartTitle(period) {
    if (period === "weekly") return "일자별 그래프";
    if (period === "monthly") return "주차별 그래프";
    if (period === "total") return "일자별 그래프";
    return "시간대별 그래프";
  }

  async function refreshCurrentDashSelection() {
    if (currentDashView === "report") {
      invalidateCurrentDashReportCache();
      await loadCurrentTestDashboard({ manualRefresh: true });
      return;
    }
    if (currentDashView === "event-analysis") {
      if (currentDashSelectedEvent === "all") {
        clearCurrentDashEventDetailCache();
        await loadCurrentTestDashboard({ manualRefresh: true });
        return;
      }
      delete currentDashEventDetailCache[`${currentDashSnapshotTypeForView("event-analysis")}::${currentDashPeriodKeyForView("event-analysis")}::${currentDashSelectedEvent}`];
      await ensureCurrentDashEventDetail(currentDashSelectedEvent, { manualRefresh: true });
    }
  }

  function renderCurrentDashReportView() {
    const state = currentDashReportState();
    const people = currentDashboardPeopleForSelection("all");
    const photoCounts = Array.isArray(sotCurrentTestData.photo_counts) ? sotCurrentTestData.photo_counts : [];
    return `
      <section class="ctdash-screen">
        <article class="ctdash-card ctdash-section">
          <div class="ctdash-section-head">
            <div>
              <div class="ctdash-kicker">Report</div>
              <h3>리포트</h3>
              <p>선택한 기간 기준 snapshot을 조회합니다.</p>
            </div>
            <div class="ctdash-period-tabs">
              <button class="ctdash-chip ${currentDashReportPeriod === "daily" ? "is-active" : ""}" type="button" data-ctdash-report-period="daily">일별</button>
              <button class="ctdash-chip ${currentDashReportPeriod === "weekly" ? "is-active" : ""}" type="button" data-ctdash-report-period="weekly">주차별</button>
              <button class="ctdash-chip ${currentDashReportPeriod === "monthly" ? "is-active" : ""}" type="button" data-ctdash-report-period="monthly">월별</button>
            </div>
          </div>
          <div class="ctdash-inline-fields">${currentDashReportScopeControls()}</div>
          <div class="ctdash-metrics-grid">
            ${metricCard("접속수", formatNumber(dashboardSessionCount(state)), "session_count 우선")}
            ${metricCard("검색자", formatNumber(dashboardSearchUserCount(state)), "로컬 개수")}
            ${metricCard("검색수", formatNumber(numberValue(state, ["search_count"])), "세션 수")}
            ${metricCard("장바구니수", formatNumber(numberValue(state, ["cart_count"])), "카트 진입")}
            ${metricCard("구매수", formatNumber(numberValue(state, ["purchase_count"])), "결제 완료")}
          </div>
        </article>
        <article class="ctdash-card ctdash-section">
          <div class="ctdash-section-head">
            <div>
              <div class="ctdash-kicker">Hourly</div>
              <h3>${currentDashChartTitle(currentDashReportPeriod)}</h3>
              <p>마우스를 올리면 선택 기간 기준 검색, 카트, 구매, 평균전환율을 확인할 수 있습니다.</p>
            </div>
            <span class="ctdash-tag">Hover</span>
          </div>
          <div class="ctdash-chart-box">
            <div class="ctdash-legend">
              <span><i style="background:#c96b37"></i>검색</span>
              <span><i style="background:#0c8b88"></i>카트</span>
              <span><i style="background:#d8a23d"></i>구매</span>
              <span><i style="background:rgba(216,162,61,.55);border-radius:4px"></i>매출</span>
            </div>
            <svg id="ctdashReportChart" viewBox="0 0 1100 360" aria-label="리포트 그래프"></svg>
            <div class="ctdash-tooltip" id="ctdashReportTooltip"></div>
          </div>
        </article>
        <div class="ctdash-two-col">
          <article class="ctdash-card ctdash-section">
            <div class="ctdash-section-head">
              <div>
                <div class="ctdash-kicker">Conversion</div>
                <h3>전환율</h3>
              </div>
            <span class="ctdash-tag">Percent</span>
            </div>
            <div class="ctdash-conv-grid">
              ${conversionCard("접속 → 검색", dashboardSearchUserCount(state), dashboardSessionCount(state))}
              ${conversionCard("검색 → 카트", numberValue(state, ["cart_count"]), numberValue(state, ["search_count"]))}
              ${conversionCard("카트 → 구매", numberValue(state, ["purchase_count"]), numberValue(state, ["cart_count"]))}
            </div>
          </article>
        </div>
        <div class="ctdash-two-col">
          <article class="ctdash-card ctdash-section">
            <div class="ctdash-section-head"><div><div class="ctdash-kicker">Traffic</div><h3>유입별</h3></div><span class="ctdash-tag">Campaign / Source</span></div>
            <div class="ctdash-sub-grid">
              ${rankSection("캠페인", topRankRows(sotCurrentTestData.campaigns || [], ["utm_campaign", "label"]))}
              ${rankSection("소스", topRankRows(sotCurrentTestData.sources || [], ["utm_source", "label"]))}
              ${rankSection("디바이스", topRankRows(sotCurrentTestData.devices || [], ["device_type", "label"]))}
              ${rankSection("OS", topRankRows(sotCurrentTestData.devices || [], ["os_type", "label"]))}
            </div>
          </article>
          <article class="ctdash-card ctdash-section">
            <div class="ctdash-section-head"><div><div class="ctdash-kicker">Sales</div><h3>매출</h3></div><span class="ctdash-tag">Revenue</span></div>
            <div class="ctdash-sales-grid">
              ${metricCard("참가자 수", formatNumber(people), "Bubble 이벤트 데이터")}
              ${metricCard("객단가", formatWon(avgOrderValue(state)), "구매 1건당")}
              ${metricCard("일매출", formatWon(numberValue(state, ["revenue"])), "선택 기간 합계")}
              ${metricCard("참가자 대비 사진 구매율", formatPercent(safeRate(numberValue(state, ["purchase_count"]), people)), "로컬 기준")}
            </div>
          </article>
        </div>
        ${photoCounts.length ? renderPhotoExposureSection(state, currentDashReportScopeLabel()) : renderPhotoExposurePendingSection()}
      </section>`;
  }

  function renderCurrentDashEventView() {
    const detail = currentDashEventDataset();
    const summary = currentDashSelectedEventSummary();
    const spots = Array.isArray(detail.spots) ? detail.spots : [];
    const photoCounts = Array.isArray(detail.photo_counts) ? detail.photo_counts : [];
    const eventName = currentDashSelectedEvent === "all"
      ? "전체 대회"
      : (currentDashEventLabel(currentDashEventOptions().find(row => row.event_code === currentDashSelectedEvent)) || currentDashSelectedEvent);
    const people = currentDashSelectedEvent === "all" ? currentDashboardPeopleForSelection("all") : currentDashboardPeopleForSelection(currentDashSelectedEvent);
    const rows = sortMetricRows(detail.daily || []);
    const detailTable = renderEventDetailTable(rows);
    const eventPurchaseCount = numberValue(summary, ["purchase_count"]);
    return `
      <section class="ctdash-screen">
        <article class="ctdash-card ctdash-section">
          <div class="ctdash-section-head">
            <div>
              <div class="ctdash-kicker">Event Analysis</div>
              <h3>대회별 분석</h3>
              <p>대회와 기간을 선택하면 해당 snapshot을 다시 조회합니다.</p>
            </div>
          </div>
          <div class="ctdash-event-toolbar">
            <div class="ctdash-period-tabs">
              <button class="ctdash-chip ${currentDashEventPeriod === "daily" ? "is-active" : ""}" type="button" data-ctdash-event-period="daily">일별</button>
              <button class="ctdash-chip ${currentDashEventPeriod === "weekly" ? "is-active" : ""}" type="button" data-ctdash-event-period="weekly">주차별</button>
              <button class="ctdash-chip ${currentDashEventPeriod === "monthly" ? "is-active" : ""}" type="button" data-ctdash-event-period="monthly">월별</button>
              <button class="ctdash-chip ${currentDashEventPeriod === "total" ? "is-active" : ""}" type="button" data-ctdash-event-period="total">전체</button>
            </div>
            <div class="ctdash-inline-fields">${currentDashEventScopeControls()}</div>
          </div>
          ${currentDashEventDetailLoading ? `<div class="ctdash-callout">선택한 대회 상세를 불러오는 중입니다.</div>` : ""}
        </article>
        <div class="ctdash-two-col">
          <article class="ctdash-card ctdash-section">
            <div class="ctdash-section-head"><div><div class="ctdash-kicker">Overview</div><h3>기본 요약</h3></div><span class="ctdash-tag">Snapshot</span></div>
            <div class="ctdash-summary-grid">
              ${metricCard("대회명", escapeHtml(eventName), currentDashSelectedEvent === "all" ? "전체 합산" : currentDashSelectedEvent)}
              ${metricCard("접속수", formatNumber(dashboardSessionCount(summary)), "session_count 우선")}
              ${metricCard("검색자", formatNumber(dashboardSearchUserCount(summary)), "로컬 개수")}
              ${metricCard("검색수", formatNumber(numberValue(summary, ["search_count"])), "세션 수")}
              ${metricCard("장바구니수", formatNumber(numberValue(summary, ["cart_count"])), "카트 진입")}
              ${metricCard("구매수", formatNumber(eventPurchaseCount), "결제 완료")}
              ${metricCard("참가자 수", formatNumber(people), "Bubble 이벤트 데이터")}
              ${metricCard("대회매출", formatWon(numberValue(summary, ["revenue"])), "선택 기간 기준")}
              ${metricCard("객단가", formatWon(avgOrderValue(summary)), "구매 1건당")}
              ${metricCard("참가자 대비 구매율", formatPercent(safeRate(eventPurchaseCount, people)), "purchase / participants")}
            </div>
          </article>
          <article class="ctdash-card ctdash-section">
            <div class="ctdash-section-head"><div><div class="ctdash-kicker">Spots</div><h3>스팟별 데이터</h3></div><span class="ctdash-tag">Pending Mapping</span></div>
            <div class="ctdash-spot-grid">
              ${spots.length ? spots.map(spot => renderCurrentDashSpotCard(spot)).join("") : `<div class="ctdash-callout">스팟 데이터 준비 중</div>`}
            </div>
          </article>
        </div>
        <article class="ctdash-card ctdash-section">
          <div class="ctdash-section-head"><div><div class="ctdash-kicker">Graph</div><h3>${currentDashChartTitle(currentDashEventPeriod)}</h3></div><span class="ctdash-tag">Revenue + Search/Cart/Order</span></div>
          <div class="ctdash-chart-box">
            <div class="ctdash-legend">
              <span><i style="background:#d8a23d;border-radius:4px"></i>매출</span>
              <span><i style="background:#c96b37"></i>검색</span>
              <span><i style="background:#0c8b88"></i>카트</span>
              <span><i style="background:#ad4e67"></i>오더</span>
            </div>
            <svg id="ctdashEventChart" viewBox="0 0 1080 360" aria-label="대회별 분석 그래프"></svg>
            <div class="ctdash-tooltip" id="ctdashEventTooltip"></div>
          </div>
        </article>
        ${detailTable}
        ${photoCounts.length ? renderPhotoExposureSection(detail, currentDashScopeLabel("event-analysis")) : renderPhotoExposurePendingSection()}
        <article class="ctdash-card ctdash-section">
          <div class="ctdash-section-head"><div><div class="ctdash-kicker">Traffic</div><h3>유입경로별 분석</h3></div><span class="ctdash-tag">Wide Section</span></div>
          <div class="ctdash-sub-grid">
            ${rankSection("캠페인", topRankRows(detail.campaigns || [], ["utm_campaign", "label"]))}
            ${rankSection("소스", topRankRows(detail.sources || [], ["utm_source", "label"]))}
            ${rankSection("디바이스", topRankRows(detail.devices || [], ["device_type", "label"]))}
            ${rankSection("OS", topRankRows(detail.devices || [], ["os_type", "label"]))}
          </div>
        </article>
        <article class="ctdash-card ctdash-section">
          <div class="ctdash-section-head"><div><div class="ctdash-kicker">Summary</div><h3>대회별 요약</h3></div><span class="ctdash-tag">Daily Snapshot</span></div>
          ${summaryTable((sotCurrentTestData.event_summaries || []).slice(0, 8))}
        </article>
      </section>`;
  }

  function renderCurrentDashDiaryView() {
    return `
      <section class="ctdash-screen">
        <article class="ctdash-card ctdash-section">
          <div class="ctdash-section-head">
            <div>
              <div class="ctdash-kicker">Diary</div>
              <h3>일지 작성</h3>
              <p>현재는 샤라웃 현장운영일지 베이스의 입력 와꾸만 넣었고, 저장 연동은 아직 연결하지 않았습니다.</p>
            </div>
            <span class="ctdash-tag">Layout Only</span>
          </div>
          <div class="ctdash-form-grid">
            <label><span>대회명</span><input class="ctdash-input" type="text" placeholder="대회명"></label>
            <label><span>운영일자</span><input class="ctdash-input" type="date"></label>
            <label><span>현장 책임자</span><input class="ctdash-input" type="text" placeholder="이름"></label>
            <label><span>날씨 / 특이사항</span><input class="ctdash-input" type="text" placeholder="맑음, 우천 등"></label>
          </div>
          <div class="ctdash-form-grid three">
            <label><span>스탭 구성</span><textarea class="ctdash-textarea" placeholder="AM / BM / CM 담당자"></textarea></label>
            <label><span>장비 / 세팅</span><textarea class="ctdash-textarea" placeholder="카메라, 프린터, 네트워크"></textarea></label>
            <label><span>이슈 / 조치</span><textarea class="ctdash-textarea" placeholder="이슈 기록"></textarea></label>
          </div>
          <label><span>데일리 서머리</span><textarea class="ctdash-textarea tall" placeholder="운영 요약, 고객 반응, 개선 사항"></textarea></label>
        </article>
      </section>`;
  }

  function renderEventDetailTable(rows) {
    const title = currentDashEventPeriod === "weekly"
      ? `${currentDashScopeLabel("event-analysis")} 일자별 상세`
      : currentDashEventPeriod === "monthly"
        ? `${currentDashScopeLabel("event-analysis")} 주차별 상세`
        : currentDashEventPeriod === "total"
          ? "누적 일자별 상세"
          : `${currentDashScopeLabel("event-analysis")} 시간대별 상세`;
    const firstHeader = currentDashEventPeriod === "daily" ? "시간대" : currentDashEventPeriod === "monthly" ? "주차" : "일자";
    return detailTableSection(title, [firstHeader, "검색", "카트", "오더", "매출"], eventDailyRows(currentDashEventDataset()));
  }

  function renderCurrentDashCharts() {
    if (!sotCurrentTestLoaded) return;
    renderCurrentDashReportChart();
    renderCurrentDashEventChart();
    renderPhotoCountPurchaseCharts();
  }

  function renderCurrentDashReportChart() {
    const rows = reportChartRows();
    initializeLineChart({
      svgId: "ctdashReportChart",
      tooltipId: "ctdashReportTooltip",
      data: rows,
      maxY: maxMetricValue(rows, ["search", "cart", "purchase"]),
      maxRevenue: maxRevenueValue(rows)
    });
  }

  function renderCurrentDashEventChart() {
    const rows = eventChartRows();
    initializeComboChart({
      svgId: "ctdashEventChart",
      tooltipId: "ctdashEventTooltip",
      points: rows,
      maxMetric: maxMetricValue(rows, ["search", "cart", "order"]),
      maxRevenue: maxRevenueValue(rows)
    });
  }

  function renderPhotoCountPurchaseCharts() {
    const root = document.getElementById("sotCurrentTestDashboard") || document;
    const chart = root.querySelector(`[data-photo-bucket-chart="${currentDashView}"]`);
    const tooltip = root.querySelector(`[data-photo-bucket-tooltip="${currentDashView}"]`);
    if (!chart || !tooltip) return;

    const dataset = currentDashView === "event-analysis" ? currentDashEventDataset() : sotCurrentTestData;
    const rows = photoExposureRows(dataset, dataset.state || dataset.summary || dataset, {
      view: currentDashView,
      selectedEvent: currentDashSelectedEvent
    });
    console.log("[PhotoBuckets]", {
      view: currentDashView,
      selectedEvent: currentDashSelectedEvent,
      bucketCount: rows.length,
      labels: rows.map(row => row.label),
      rows
    });
    drawPhotoCountBucketChart({ chart, tooltip, rows });
  }

  function sortMetricRows(rows) {
    return [...(rows || [])].sort((a, b) => String(a.date_key || a.period_key || a.label || "").localeCompare(String(b.date_key || b.period_key || b.label || "")));
  }

  function normalizeCurrentDashDateKey(value) {
    if (!value) return "";

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return formatKSTDate(value);
    }

    const text = String(value);
    const isoDate = text.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoDate) return isoDate[1];

    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return formatKSTDate(date);
    }

    return text;
  }

  function buildWeekRows(rows) {
    const map = new Map();

    (rows || []).forEach(row => {
      const dateKey = row.date_key || row.period_key || row.label;
      if (!dateKey) return;

      const weekStartRaw = saturdayWeekStart(dateKey);
      const weekStart = normalizeCurrentDashDateKey(weekStartRaw);
      if (!weekStart) return;

      if (!map.has(weekStart)) {
        map.set(weekStart, []);
      }
      map.get(weekStart).push(row);
    });

    return [...map.entries()]
      .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
      .map(([weekStart, group]) => {
        const weekEnd = normalizeCurrentDashDateKey(addDays(weekStart, 6));
        return {
          week_start: weekStart,
          label: `${saturdayWeekLabel(weekStart)} (${String(weekStart).slice(5)} - ${String(weekEnd).slice(5)})`,
          rows: group
        };
      });
  }

  function buildMonthRows(rows) {
    const map = new Map();
    (rows || []).forEach(row => {
      const dateKey = row.date_key || row.period_key || row.label || "";
      const monthKey = String(dateKey).slice(0, 7);
      if (!monthKey) return;
      if (!map.has(monthKey)) map.set(monthKey, []);
      map.get(monthKey).push(row);
    });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([monthKey, group]) => ({
      month_key: monthKey,
      label: `${monthKey.replace("-", "년 ")}월`,
      rows: group
    }));
  }

  function metricCard(label, value, note) {
    return `<article class="ctdash-metric-card"><h4>${label}</h4><strong>${value}</strong><p>${note || ""}</p></article>`;
  }

  function conversionCard(label, numerator, denominator) {
    const rate = safeRate(numerator, denominator);
    return `<article class="ctdash-conv-card"><div class="ctdash-conv-top"><h4>${label}</h4><strong>${formatPercent(rate)}</strong></div><div class="ctdash-bar"><span style="width:${Math.min(100, rate)}%"></span></div><p>${formatNumber(numerator)} / ${formatNumber(denominator)}</p></article>`;
  }

  function topRankRows(rows, labelFields) {
    const byLabel = new Map();
    (rows || []).forEach(row => {
      const label = firstText(row, labelFields);
      if (!label) return;
      byLabel.set(label, (byLabel.get(label) || 0) + numberValue(row, ["search_count", "purchase_count", "count", "sessions", "value"]));
    });
    return [...byLabel.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }

  function rankSection(title, rows) {
    return `<article class="ctdash-sub-card"><h4>${title}</h4><div class="ctdash-rank-list">${rows.length ? rows.map((row, index) => `<div class="ctdash-rank-row"><span>${index + 1}</span><div>${escapeHtml(row.label)}</div><strong>${formatNumber(row.value)}</strong></div>`).join("") : `<div class="ctdash-empty">데이터가 없습니다.</div>`}</div></article>`;
  }

  function avgOrderValue(row) {
    const revenue = numberValue(row, ["revenue"]);
    const purchases = numberValue(row, ["purchase_count"]);
    return purchases ? Math.round(revenue / purchases) : 0;
  }

  function renderCurrentDashSpotCard(spot) {
    const label = firstText(spot, ["spot_label", "spot_name", "spot_key", "prefix", "spot_code", "label"]) || "스팟";
    const orderCount = numberValue(spot, ["order_count", "purchase_count"]);
    const revenue = numberValue(spot, ["allocated_revenue", "revenue"]);
    const photoCount = numberValue(spot, ["sold_photo_count", "purchase_photo_count", "photo_count", "cart_photo_count"]);
    const revenueShare = numberValue(spot, ["revenue_share"]);
    return `<article class="ctdash-spot-card"><h4>${escapeHtml(label)}</h4><strong>${formatNumber(photoCount)}장 판매</strong><div class="ctdash-spot-row"><span>매출</span><b>${formatWon(revenue)}</b></div><div class="ctdash-spot-row"><span>주문 수</span><b>${formatNumber(orderCount)}</b></div><div class="ctdash-spot-row"><span>매출 비중</span><b>${formatPercent(revenueShare)}</b></div></article>`;
  }

  function renderPhotoExposurePendingSection() {
    return `
      <section class="ctdash-card ctdash-section">
        <div class="ctdash-section-head">
          <div>
            <div class="ctdash-kicker">Exposure</div>
            <h3>노출 사진 수 분석</h3>
            <p>선택한 snapshot에 photo_counts가 아직 없습니다.</p>
          </div>
          <span class="ctdash-tag">Pending</span>
        </div>
	        <div class="ctdash-callout">사진 수 구간별 구매 분석 데이터가 없습니다.</div>
      </section>
    `;
  }

	  const PHOTO_BUCKET_ORDER = ["0장", "1장", "2~3장", "4~5장", "6~10장", "11~20장", "21장+"];

	  function normalizePhotoBucketLabel(row) {
	    return String(row?.bucket_label || row?.range || row?.bucket || row?.label || row?.photo_count_range || row?.photo_count || row?.photo_bucket || "-").trim();
	  }

	  function normalizePhotoBucketRows(rows, opts) {
	    const byLabel = new Map();
	    (rows || []).forEach(row => {
	      const rowEventCode = row?.event_code || row?.eventCode || "";
	      if (opts?.view === "event-analysis" && opts?.selectedEvent && opts.selectedEvent !== "all" && rowEventCode && rowEventCode !== opts.selectedEvent) return;

	      const label = normalizePhotoBucketLabel(row);
	      if (!label || label === "-") return;
	      if (!byLabel.has(label)) {
	        byLabel.set(label, {
	          label,
	          searchCount: 0,
	          uniqueBibCount: 0,
	          cartCount: 0,
          purchaseCount: 0,
          orderCount: 0,
          soldPhotoCount: 0,
          revenue: 0
	        });
	      }
	      const aggregate = byLabel.get(label);
	      aggregate.searchCount += numberValue(row, ["search_count", "count", "searches"]);
	      aggregate.uniqueBibCount += numberValue(row, ["unique_query_count", "bib_count", "bibs", "search_bib_count", "unique_bib_count"]);
      aggregate.cartCount += numberValue(row, ["cart_count", "cart"]);
      aggregate.purchaseCount += numberValue(row, ["purchase_count", "purchase"]);
      aggregate.orderCount += numberValue(row, ["order_count", "order_purchase_count"]);
      aggregate.soldPhotoCount += numberValue(row, ["sold_photo_count", "sold_photo", "purchase_photo_count"]);
	      aggregate.revenue += numberValue(row, ["revenue", "purchase_amount", "revenue_total"]);
	    });

	    return [...byLabel.values()]
	      .map(row => ({
	        ...row,
        purchaseRate: safeRate(row.purchaseCount, row.searchCount),
	        cartRate: safeRate(row.cartCount, row.searchCount),
	        cartToPurchaseRate: safeRate(row.purchaseCount, row.cartCount),
	        avgOrderValue: row.purchaseCount ? Math.round(row.revenue / row.purchaseCount) : 0
	      }))
	      .sort((a, b) => {
	        const ai = PHOTO_BUCKET_ORDER.indexOf(a.label);
	        const bi = PHOTO_BUCKET_ORDER.indexOf(b.label);
	        if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
	        return a.label.localeCompare(b.label, "ko");
	      });
	  }

	  function photoExposureRows(payload, summaryOverride, opts) {
	    const summaryRows = Array.isArray(summaryOverride?.photo_counts)
	      ? summaryOverride.photo_counts
	      : Array.isArray(summaryOverride?.photo_count_buckets)
        ? summaryOverride.photo_count_buckets
        : Array.isArray(summaryOverride?.photo_count_stats)
          ? summaryOverride.photo_count_stats
          : [];
	    const rows = summaryRows.length ? summaryRows : Array.isArray(payload.photo_counts) ? payload.photo_counts : [];
	    return normalizePhotoBucketRows(rows, opts);
	  }

	  function renderPhotoCountPurchaseChart(rows) {
	    if (!Array.isArray(rows) || !rows.length) {
	      return `<div class="ctdash-callout">사진 수 구간별 구매 분석 데이터가 없습니다.</div>`;
	    }
	    const topRate = photoCountTopRow(rows, "purchaseRate");
	    const topSearch = photoCountTopRow(rows, "searchCount");
	    const topRevenue = photoCountTopRow(rows, "revenue");
	    return `
	      <div class="ctdash-conv-grid" style="margin:0 0 14px;">
		        ${metricCard("최고 구매율 구간", `${escapeHtml(topRate.label)} / ${formatPercent(topRate.purchaseRate)}`, "구매 배번호수 / 검색수")}
	        ${metricCard("검색수 최다 구간", `${escapeHtml(topSearch.label)} / ${formatNumber(topSearch.searchCount)}회`, "표본 크기")}
	        ${metricCard("매출 최다 구간", `${escapeHtml(topRevenue.label)} / ${formatWon(topRevenue.revenue)}`, "구간별 revenue")}
	      </div>
	      <div class="ctdash-callout" style="margin-bottom:14px;">${escapeHtml(photoCountInsight(rows))}</div>
	      <div class="ctdash-chart-box" style="margin-top:10px;">
	        <div class="ctdash-legend">
	          <span><i style="background:rgba(12,139,136,.28);border-radius:4px"></i>검색수</span>
	          <span><i style="background:#c96b37"></i>구매율</span>
	        </div>
	        <svg data-photo-bucket-chart="${escapeHtml(currentDashView)}" viewBox="0 0 1080 360" aria-label="사진 수 구간별 구매율 차트"></svg>
	        <div class="ctdash-tooltip" data-photo-bucket-tooltip="${escapeHtml(currentDashView)}"></div>
	        <div class="ctdash-callout" style="margin-top:12px;">
	          <div style="display:grid; grid-template-columns:repeat(${rows.length}, minmax(72px,1fr)); gap:8px; font-size:12px; text-align:center; color:#6f6256;">
	            ${rows.map(row => `<div><b style="display:block; color:#211812;">${escapeHtml(row.label)}</b><span>${escapeHtml(formatCompactWon(row.revenue))}</span></div>`).join("")}
	          </div>
	        </div>
	      </div>
	    `;
	  }

	  function photoCountTopRow(rows, field) {
	    return [...(rows || [])].sort((a, b) => Number(b[field] || 0) - Number(a[field] || 0))[0] || { label: "-", purchaseRate: 0, searchCount: 0, revenue: 0 };
	  }

	  function photoCountInsight(rows) {
	    const topRate = photoCountTopRow(rows, "purchaseRate");
	    const topRevenue = photoCountTopRow(rows, "revenue");
	    if (topRate.label && topRate.label === topRevenue.label) {
	      return "사진 수가 많은 구간에서 구매율과 매출이 함께 높게 나타납니다.";
	    }
	    return "검색수는 많지만 구매율이 낮은 구간이 있어 추가 확인이 필요합니다.";
	  }

	  function formatCompactWon(value) {
	    const amount = Math.round(Number(value || 0));
	    if (amount >= 100000000) return `₩${(amount / 100000000).toFixed(1).replace(/\.0$/, "")}억`;
	    if (amount >= 10000) return `₩${(amount / 10000).toFixed(1).replace(/\.0$/, "")}만`;
	    if (amount >= 1000) return `₩${(amount / 1000).toFixed(1).replace(/\.0$/, "")}천`;
	    return formatWon(amount);
	  }

  function renderPhotoExposureSection(summaryOverride, scopeLabel) {
    const payload = summaryOverride && (Array.isArray(summaryOverride.photo_counts) || summaryOverride.state || summaryOverride.summary)
      ? summaryOverride
      : sotCurrentTestData;
    const summary = summaryOverride?.state || summaryOverride?.summary || summaryOverride || sotCurrentTestData.state || {};
    const rows = photoExposureRows(payload, summary, {
      view: currentDashView,
      selectedEvent: currentDashSelectedEvent
    });
    const totalSearch = numberValue(summary, ["search_count"]);
    const zeroExposureSearch = numberValue(summary, ["zero_exposure_count"]);
    const uniqueZeroExposure = numberValue(summary, ["zero_exposure_unique", "zero_exposure_unique_count"]);
    const overallAvg = totalSearch ? numberValue(summary, ["exposure_sum"]) / totalSearch : 0;
    const validSearchCount = Math.max(0, totalSearch - zeroExposureSearch);
    const validAvg = validSearchCount ? numberValue(summary, ["exposure_sum"]) / validSearchCount : 0;
    const validPurchaseRate = safeRate(numberValue(summary, ["purchase_count"]), validSearchCount);

    return `
      <section class="ctdash-card ctdash-section">
        <div class="ctdash-section-head">
          <div>
            <div class="ctdash-kicker">Exposure</div>
            <h3>노출 사진 수 분석</h3>
            <p>${escapeHtml(scopeLabel || "전체 기간")} 기준입니다. 검색 결과에 노출된 사진 수 구간별로 검색, 구매, 판매사진, 매출 흐름을 확인합니다.</p>
          </div>
          <span class="ctdash-tag">Photo Buckets</span>
        </div>
        <div class="ctdash-metrics-grid">
          ${metricCard("총 검색 횟수", formatNumber(totalSearch), "search_log row 기준")}
          ${metricCard("노출 0 검색", formatNumber(zeroExposureSearch), "사진 없음 검색 횟수")}
          ${metricCard("노출 0 고유 배번호", formatNumber(uniqueZeroExposure), "중복 검색 제거")}
          ${metricCard("전체 평균 노출", `${overallAvg.toFixed(2)}장`, "전체 검색 기준")}
          ${metricCard("유효 평균 노출", `${validAvg.toFixed(2)}장`, "노출 1장 이상 기준")}
          ${metricCard("유효 검색 구매율", formatPercent(validPurchaseRate), "사진 있는 검색 기준")}
        </div>
        <article class="ctdash-sub-card" style="margin-top:18px;">
          <h4>사진 수 구간별 구매 분석</h4>
          <div class="ctdash-table-wrap">
            <table class="ctdash-table">
              <thead>
                <tr>
	                  <th>구간</th>
	                  <th>검색수</th>
		                  <th>구매 배번호수</th>
		                  <th>주문수</th>
	                  <th>구매율</th>
	                  <th>매출</th>
	                </tr>
	              </thead>
		              <tbody>
		                ${rows.length ? rows.map(row => `
		                  <tr>
		                    <td style="padding:13px 10px; font-weight:900; color:#c96b37;">${escapeHtml(row.label)}</td>
		                    <td align="right" style="padding:13px 10px;">${formatNumber(row.searchCount)}</td>
	                    <td align="right" style="padding:13px 10px;">${formatNumber(row.purchaseCount)}</td>
	                    <td align="right" style="padding:13px 10px;">${formatNumber(row.orderCount)}</td>
			                    <td align="right" style="padding:13px 8px; font-weight:900; ${row.purchaseRate >= 10 ? "color:#0c8b88;" : ""}">${formatPercent(row.purchaseRate)}</td>
	                    <td align="right" style="padding:13px 8px;">${formatWon(row.revenue)}</td>
		                  </tr>
			                `).join("") : `<tr><td colspan="6">사진 수 구간별 구매 분석 데이터가 없습니다.</td></tr>`}
		              </tbody>
            </table>
          </div>
          <p style="margin:12px 0 0; font-size:13px; line-height:1.65; color:#6f6256;">
            판단: 사진 노출이 있는 구간에서 구매율과 매출이 어떻게 변하는지 확인하는 섹션입니다.
          </p>
        </article>
	        <article class="ctdash-sub-card" style="margin-top:18px;">
		          <div style="padding:4px 0 12px;">
		            <div class="ctdash-kicker">Bucket Flow</div>
		            <h4 style="margin-top:8px;">사진 수 구간별 구매율 분석</h4>
		            <p style="margin:8px 0 0; color:#6f6256;">검색 결과에 노출된 사진 수가 많을수록 구매 확률이 높아지는지 확인합니다. 검색수는 표본 크기, 매출은 보조 지표로 함께 확인합니다.</p>
		          </div>
	          ${renderPhotoCountPurchaseChart(rows)}
	        </article>
	      </section>
	    `;
	  }

  function summaryTable(rows) {
    return `<div class="ctdash-table-wrap"><table class="ctdash-table"><thead><tr><th>대회명</th><th>참가자 수</th><th>매출</th><th>객단가</th><th>검색→구매</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escapeHtml(row.event_name || row.event_code || "-")}</td><td>${formatNumber(eventPeople(row.event_code))}</td><td>${formatWon(numberValue(row, ["revenue"]))}</td><td>${formatWon(avgOrderValue(row))}</td><td>${formatPercent(safeRate(numberValue(row, ["purchase_count"]), numberValue(row, ["search_count"])))}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function detailTableSection(title, headers, rows) {
    return `<article class="ctdash-card ctdash-section"><div class="ctdash-section-head"><div><div class="ctdash-kicker">Detail</div><h3>${title}</h3></div></div><div class="ctdash-table-wrap"><table class="ctdash-table"><thead><tr>${headers.map(header => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">데이터가 없습니다.</td></tr>`}</tbody></table></div></article>`;
  }

  function eventDailyRows(detail) {
    return chartRowsForPeriod(detail, currentDashEventPeriod).map(row => [
      escapeHtml(row.time),
      formatNumber(row.search),
      formatNumber(row.cart),
      formatNumber(row.purchase || row.order),
      formatWon(row.revenue || 0)
    ]);
  }

  function weekDetailRows(rows) {
    const selectedWeek = buildWeekRows(rows).find(row => row.week_start === currentDashSelectedWeekStart);
    return (selectedWeek?.rows || []).map(row => [
      escapeHtml(row.date_key || row.period_key || row.label || "-"),
      formatNumber(numberValue(row, ["search_count"])),
      formatNumber(numberValue(row, ["cart_count"])),
      formatNumber(numberValue(row, ["purchase_count"])),
      formatWon(numberValue(row, ["revenue"])),
      formatWon(avgOrderValue(row))
    ]);
  }

  function monthDetailRows(rows) {
    const selectedMonth = buildMonthRows(rows).find(row => row.month_key === currentDashSelectedMonthKey);
    return buildWeekRows(selectedMonth?.rows || []).map(row => {
      const aggregate = (row.rows || []).reduce((acc, item) => {
        acc.search += numberValue(item, ["search_count"]);
        acc.cart += numberValue(item, ["cart_count"]);
        acc.order += numberValue(item, ["purchase_count"]);
        acc.revenue += numberValue(item, ["revenue"]);
        return acc;
      }, { search: 0, cart: 0, order: 0, revenue: 0 });
      return [
        escapeHtml(row.label),
        formatNumber(aggregate.search),
        formatNumber(aggregate.cart),
        formatNumber(aggregate.order),
        formatWon(aggregate.revenue),
        formatWon(aggregate.order ? Math.round(aggregate.revenue / aggregate.order) : 0)
      ];
    });
  }

  function normalizedHourKey(value) {
    if (value === undefined || value === null || value === "") return "";
    const hour = Number.parseInt(String(value), 10);
    return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? String(hour).padStart(2, "0") : "";
  }

  const currentDashMetricFields = ["search_count", "cart_count", "cart_photo_count", "purchase_count", "purchase_photo_count", "revenue", "exposure_sum", "exposure_count", "zero_exposure_count", "visit_count", "session_count", "local_user_count", "search_user_count"];

  function currentDashDateKey(row) {
    return row?.date_key || row?.period_key || row?.label || "";
  }

  function currentDashHourBucket(row) {
    const hourKey = normalizedHourKey(row.hour_key);
    if (!hourKey) return "";
    return Number(hourKey) < 6 ? "00" : hourKey;
  }

  function aggregateMetricRows(rows, keyFn, labelFn) {
    const byKey = new Map();
    (rows || []).forEach(row => {
      const key = keyFn(row);
      if (!key) return;
      if (!byKey.has(key)) byKey.set(key, { key, label: labelFn ? labelFn(row, key) : key });
      const aggregate = byKey.get(key);
      currentDashMetricFields.forEach(field => {
        aggregate[field] = Number(aggregate[field] || 0) + numberValue(row, [field]);
      });
    });
    return [...byKey.values()].sort((a, b) => String(a.key).localeCompare(String(b.key)));
  }

  function chartPointFromAggregate(row) {
    return {
      time: row.label || row.key,
      label: row.label || row.key,
      search: row.search_count || 0,
      cart: row.cart_count || 0,
      purchase: row.purchase_count || 0,
      order: row.purchase_count || 0,
      revenue: row.revenue || 0,
      revenueText: formatWon(row.revenue || 0),
      conversion: Number(safeRate(row.purchase_count, row.search_count)).toFixed(1)
    };
  }

  function weekRangeLabelFromDateKey(dateKey) {
    const startKey = saturdayStartDateKey(dateKey);
    const endKey = addDays(startKey, 6);
    return `${startKey} ~ ${endKey}`;
  }

  function dailyHourChartRowsFromDataset(dataset) {
    return aggregateMetricRows(dataset.hourly || [], currentDashHourBucket, (row, key) => key)
      .map(chartPointFromAggregate);
  }

  function dailyDateChartRowsFromDataset(dataset) {
    return aggregateMetricRows(dataset.daily || [], currentDashDateKey, (row, key) => key)
      .map(chartPointFromAggregate);
  }

  function weeklyChartRowsFromDataset(dataset) {
    return aggregateMetricRows(dataset.daily || [], row => saturdayStartDateKey(currentDashDateKey(row)), (row, key) => weekRangeLabelFromDateKey(key))
      .map(chartPointFromAggregate);
  }

  function chartRowsForPeriod(dataset, period) {
    if (period === "weekly") return dailyDateChartRowsFromDataset(dataset);
    if (period === "monthly") return weeklyChartRowsFromDataset(dataset);
    if (period === "total") return dailyDateChartRowsFromDataset(dataset);
    return dailyHourChartRowsFromDataset(dataset);
  }

  function detailHourlyChartRowsFromDataset(dataset, dateKey) {
    return [...(dataset.hourly || [])]
      .filter(row => normalizedHourKey(row.hour_key))
      .filter(row => !dateKey || (row.date_key || row.period_key || row.label) === dateKey)
      .sort((a, b) => String(a.date_key || a.period_key || "").localeCompare(String(b.date_key || b.period_key || "")) || normalizedHourKey(a.hour_key).localeCompare(normalizedHourKey(b.hour_key)))
      .map(row => ({
        time: normalizedHourKey(row.hour_key),
        search: numberValue(row, ["search_count"]),
        cart: numberValue(row, ["cart_count"]),
        purchase: numberValue(row, ["purchase_count"]),
        revenue: numberValue(row, ["revenue"]),
        conversion: Number(safeRate(numberValue(row, ["purchase_count"]), numberValue(row, ["search_count"]))).toFixed(1)
      }));
  }

  function reportChartRowsFromDataset(dataset, dateKey) {
    const fields = ["search_count", "cart_count", "cart_photo_count", "purchase_count", "purchase_photo_count", "revenue", "exposure_sum", "exposure_count", "zero_exposure_count", "visit_count", "session_count", "local_user_count", "search_user_count"];
    const byHour = new Map();
    (dataset.hourly || []).forEach(row => {
      if (dateKey && (row.date_key || row.period_key || row.label) !== dateKey) return;
      const hourKey = normalizedHourKey(row.hour_key);
      if (!hourKey) return;
      if (!byHour.has(hourKey)) byHour.set(hourKey, { hour_key: hourKey });
      const aggregate = byHour.get(hourKey);
      fields.forEach(field => {
        aggregate[field] = Number(aggregate[field] || 0) + numberValue(row, [field]);
      });
    });
    return [...byHour.values()]
      .sort((a, b) => a.hour_key.localeCompare(b.hour_key))
      .map(row => ({
        time: row.hour_key,
        search: row.search_count,
        cart: row.cart_count,
        purchase: row.purchase_count,
        revenue: row.revenue,
        visit_count: row.visit_count,
        session_count: row.session_count,
        local_user_count: row.local_user_count,
        search_user_count: row.search_user_count,
        exposure_sum: row.exposure_sum,
        exposure_count: row.exposure_count,
        zero_exposure_count: row.zero_exposure_count,
        conversion: Number(safeRate(row.purchase_count, row.search_count)).toFixed(1)
      }));
  }

  function reportChartRows() {
    return chartRowsForPeriod(sotCurrentTestData, currentDashReportPeriod);
  }

  function eventChartRows() {
    const detail = currentDashEventDataset();
    return chartRowsForPeriod(detail, currentDashEventPeriod);
  }

  function maxMetricValue(rows, keys) {
    const max = Math.max(10, ...(rows || []).map(row => Math.max(...keys.map(key => Number(row[key] || 0)))));
    return Math.ceil(max / 10) * 10;
  }

  function maxRevenueValue(rows) {
    const max = Math.max(1000, ...(rows || []).map(row => Number(row.revenue || 0)));
    return Math.ceil(max / 10) * 10;
  }

  function initializeLineChart({ svgId, tooltipId, data, maxY, maxRevenue }) {
    const chart = document.getElementById(svgId);
    const tooltip = document.getElementById(tooltipId);
    if (!chart || !tooltip || !data.length) return;
    drawSvgChart({ chart, tooltip, data, maxY, includeRevenue: true, maxRevenue });
  }

  function initializeComboChart({ svgId, tooltipId, points, maxMetric, maxRevenue }) {
    const chart = document.getElementById(svgId);
    const tooltip = document.getElementById(tooltipId);
    if (!chart || !tooltip || !points.length) return;
    drawSvgChart({ chart, tooltip, data: points, maxY: maxMetric, includeRevenue: true, maxRevenue });
  }

  function drawSvgChart({ chart, tooltip, data, maxY, includeRevenue, maxRevenue }) {
    const svgNS = "http://www.w3.org/2000/svg";
    const width = includeRevenue ? 1080 : 1100;
    const height = 360;
    const margin = includeRevenue ? { top: 36, right: 48, bottom: 48, left: 68 } : { top: 24, right: 28, bottom: 42, left: 68 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const colors = { search: "#c96b37", cart: "#0c8b88", purchase: "#d8a23d", order: "#ad4e67" };
    chart.innerHTML = "";
    chart.setAttribute("viewBox", `0 0 ${width} ${height}`);

    const createSvg = (tag, attrs) => {
      const el = document.createElementNS(svgNS, tag);
      Object.entries(attrs || {}).forEach(([key, value]) => el.setAttribute(key, value));
      return el;
    };
    const scaleX = index => margin.left + (innerWidth / Math.max(1, data.length - 1)) * index;
    const scaleY = value => margin.top + innerHeight - (Number(value || 0) / Math.max(1, maxY)) * innerHeight;
    const scaleRevenueY = value => margin.top + innerHeight - (Number(value || 0) / Math.max(1, maxRevenue || 1)) * innerHeight;

    for (let step = 0; step <= 4; step += 1) {
      const value = Math.round((maxY / 4) * step);
      const y = scaleY(value);
      chart.appendChild(createSvg("line", { x1: margin.left, y1: y, x2: width - margin.right, y2: y, stroke: "rgba(33,24,18,0.1)", "stroke-width": "1" }));
      const label = createSvg("text", { x: margin.left - 18, y: y + 4, fill: "#6f6256", "font-size": "12", "text-anchor": "end" });
      label.textContent = String(value);
      chart.appendChild(label);
    }
    chart.appendChild(createSvg("line", { x1: margin.left, y1: margin.top, x2: margin.left, y2: height - margin.bottom, stroke: "rgba(33,24,18,0.12)" }));
    chart.appendChild(createSvg("line", { x1: margin.left, y1: height - margin.bottom, x2: width - margin.right, y2: height - margin.bottom, stroke: "rgba(33,24,18,0.12)" }));

    data.forEach((point, index) => {
      const x = scaleX(index);
      if (includeRevenue) {
        const barY = scaleRevenueY(point.revenue);
        chart.appendChild(createSvg("rect", { x: x - 14, y: barY, width: 28, height: height - margin.bottom - barY, rx: "10", fill: "rgba(216,162,61,0.35)" }));
      }
      const tick = createSvg("text", { x, y: height - 14, fill: "#6f6256", "font-size": "12", "text-anchor": "middle" });
      tick.textContent = point.time || point.label || "";
      chart.appendChild(tick);
    });

    const usesOrder = includeRevenue && data.some(point => point.order !== undefined);
    const metricKeys = includeRevenue ? ["search", "cart", usesOrder ? "order" : "purchase"] : ["search", "cart", "purchase"];
    metricKeys.forEach(key => {
      const points = data.map((point, index) => `${scaleX(index)},${scaleY(point[key])}`).join(" ");
      chart.appendChild(createSvg("polyline", { points, fill: "none", stroke: colors[key], "stroke-width": "4", "stroke-linecap": "round", "stroke-linejoin": "round" }));
    });

    const focusLine = createSvg("line", { x1: scaleX(0), y1: margin.top, x2: scaleX(0), y2: height - margin.bottom, stroke: "rgba(33,24,18,0.18)", "stroke-width": "1.5", "stroke-dasharray": "4 4", opacity: "0" });
    chart.appendChild(focusLine);
    const focusDots = Object.fromEntries(metricKeys.map(key => [key, createSvg("circle", { r: "5", fill: colors[key], opacity: "0" })]));
    Object.values(focusDots).forEach(dot => chart.appendChild(dot));
    const overlay = createSvg("rect", { x: margin.left, y: margin.top, width: innerWidth, height: innerHeight, fill: "transparent", style: "cursor: crosshair;" });
    chart.appendChild(overlay);

    function setTooltip(index, clientX) {
      const point = data[index];
      const x = scaleX(index);
      focusLine.setAttribute("x1", x);
      focusLine.setAttribute("x2", x);
      focusLine.setAttribute("opacity", "1");
      metricKeys.forEach(key => {
        focusDots[key].setAttribute("cx", x);
        focusDots[key].setAttribute("cy", scaleY(point[key]));
        focusDots[key].setAttribute("opacity", "1");
      });
      tooltip.innerHTML = `
        <p class="ctdash-tooltip-time">${escapeHtml(point.label || point.time || "")}</p>
        ${includeRevenue ? `<div class="ctdash-tooltip-row"><span>매출</span><b>${escapeHtml(point.revenueText || formatWon(point.revenue || 0))}</b></div>` : ""}
        <div class="ctdash-tooltip-row"><span>검색</span><b>${formatNumber(point.search || 0)}</b></div>
        <div class="ctdash-tooltip-row"><span>카트</span><b>${formatNumber(point.cart || 0)}</b></div>
        <div class="ctdash-tooltip-row"><span>${usesOrder ? "오더" : "구매"}</span><b>${formatNumber((usesOrder ? point.order : point.purchase) || 0)}</b></div>
        <div class="ctdash-tooltip-row"><span>평균전환율</span><b>${escapeHtml(String(point.conversion || "0"))}%</b></div>
      `;
      tooltip.classList.add("is-visible");
      const box = chart.getBoundingClientRect();
      const localX = clientX - box.left;
      const preferredLeft = Math.min(Math.max(localX + 18, 14), box.width - 220);
      tooltip.style.left = `${preferredLeft}px`;
      tooltip.style.top = includeRevenue ? "52px" : "42px";
    }

    overlay.addEventListener("mousemove", event => {
      let svgX = margin.left;
      const matrix = chart.getScreenCTM && chart.getScreenCTM();
      if (matrix) {
        const point = chart.createSVGPoint();
        point.x = event.clientX;
        point.y = event.clientY;
        svgX = point.matrixTransform(matrix.inverse()).x;
      }
      const ratio = (svgX - margin.left) / innerWidth;
      const index = Math.min(data.length - 1, Math.max(0, Math.round(ratio * Math.max(1, data.length - 1))));
      setTooltip(index, event.clientX);
    });
	    overlay.addEventListener("mouseleave", () => {
	      tooltip.classList.remove("is-visible");
	      focusLine.setAttribute("opacity", "0");
	      Object.values(focusDots).forEach(dot => dot.setAttribute("opacity", "0"));
	    });
	  }

	  function drawPhotoCountBucketChart({ chart, tooltip, rows }) {
	    const data = Array.isArray(rows) ? rows : [];
	    const svgNS = "http://www.w3.org/2000/svg";
	    const width = 1080;
	    const height = 360;
	    const margin = { top: 34, right: 78, bottom: 58, left: 70 };
	    const innerWidth = width - margin.left - margin.right;
	    const innerHeight = height - margin.top - margin.bottom;
	    const finiteRateValues = data.map(row => Number(row.purchaseRate || 0)).filter(Number.isFinite);
	    const finiteSearchValues = data.map(row => Number(row.searchCount || 0)).filter(Number.isFinite);
	    const maxRate = Math.max(1, ...finiteRateValues);
	    const maxSearch = Math.max(1, ...finiteSearchValues);
	    chart.innerHTML = "";
	    chart.setAttribute("viewBox", `0 0 ${width} ${height}`);
	    if (!data.length) return;
	    if (!Number.isFinite(maxRate) || !Number.isFinite(maxSearch)) {
	      console.warn("[PhotoBuckets] invalid scale", { maxRate, maxSearch, rows: data });
	      return;
	    }

	    const createSvg = (tag, attrs) => {
	      const el = document.createElementNS(svgNS, tag);
	      Object.entries(attrs || {}).forEach(([key, value]) => el.setAttribute(key, value));
	      return el;
	    };
	    const stepWidth = innerWidth / Math.max(1, data.length);
	    const scaleX = index => margin.left + stepWidth * index + stepWidth / 2;
	    const scaleRateY = value => margin.top + innerHeight - (Number(value || 0) / maxRate) * innerHeight;
	    const scaleSearchY = value => margin.top + innerHeight - (Number(value || 0) / maxSearch) * innerHeight;

	    for (let step = 0; step <= 4; step += 1) {
	      const searchValue = Math.round((maxSearch / 4) * step);
	      const y = scaleSearchY(searchValue);
	      chart.appendChild(createSvg("line", { x1: margin.left, y1: y, x2: width - margin.right, y2: y, stroke: "rgba(33,24,18,0.1)", "stroke-width": "1" }));
	      const searchLabel = createSvg("text", { x: margin.left - 18, y: y + 4, fill: "#6f6256", "font-size": "12", "text-anchor": "end" });
	      searchLabel.textContent = formatNumber(searchValue);
	      chart.appendChild(searchLabel);

	      const rateValue = (maxRate / 4) * step;
	      const rateLabel = createSvg("text", { x: width - margin.right + 18, y: scaleRateY(rateValue) + 4, fill: "#c96b37", "font-size": "12" });
	      rateLabel.textContent = `${rateValue.toFixed(1)}%`;
	      chart.appendChild(rateLabel);
	    }
	    chart.appendChild(createSvg("line", { x1: margin.left, y1: margin.top, x2: margin.left, y2: height - margin.bottom, stroke: "rgba(33,24,18,0.12)" }));
	    chart.appendChild(createSvg("line", { x1: margin.left, y1: height - margin.bottom, x2: width - margin.right, y2: height - margin.bottom, stroke: "rgba(33,24,18,0.12)" }));
	    chart.appendChild(createSvg("line", { x1: width - margin.right, y1: margin.top, x2: width - margin.right, y2: height - margin.bottom, stroke: "rgba(201,107,55,0.28)" }));
	    const leftAxisTitle = createSvg("text", { x: margin.left, y: 18, fill: "#6f6256", "font-size": "12", "font-weight": "800" });
	    leftAxisTitle.textContent = "검색수";
	    chart.appendChild(leftAxisTitle);
	    const rightAxisTitle = createSvg("text", { x: width - margin.right, y: 18, fill: "#c96b37", "font-size": "12", "font-weight": "800", "text-anchor": "end" });
	    rightAxisTitle.textContent = "구매율(%)";
	    chart.appendChild(rightAxisTitle);

	    data.forEach((row, index) => {
	      const x = scaleX(index);
	      const barWidth = Math.min(74, Math.max(34, stepWidth * 0.48));
	      const barY = scaleSearchY(row.searchCount);
	      const barHeight = height - margin.bottom - barY;
	      chart.appendChild(createSvg("rect", {
	        x: x - barWidth / 2,
	        y: barY,
	        width: barWidth,
	        height: Math.max(2, barHeight),
	        rx: "12",
	        fill: "rgba(12,139,136,0.22)"
	      }));
	      const tick = createSvg("text", { x, y: height - 22, fill: "#6f6256", "font-size": "12", "text-anchor": "middle" });
	      tick.textContent = row.label || "-";
	      chart.appendChild(tick);
	    });

	    const ratePointValues = data.map((row, index) => {
	      const x = scaleX(index);
	      const y = scaleRateY(row.purchaseRate);
	      return { x, y };
	    });
	    if (ratePointValues.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
	      console.warn("[PhotoBuckets] invalid polyline points", { points: ratePointValues, rows: data });
	      return;
	    }
	    const ratePoints = ratePointValues.map(point => `${point.x},${point.y}`).join(" ");
	    chart.appendChild(createSvg("polyline", { points: ratePoints, fill: "none", stroke: "#c96b37", "stroke-width": "5", "stroke-linecap": "round", "stroke-linejoin": "round" }));
	    data.forEach((row, index) => {
	      chart.appendChild(createSvg("circle", { cx: scaleX(index), cy: scaleRateY(row.purchaseRate), r: "7", fill: "#c96b37", stroke: "#fffdf9", "stroke-width": "3" }));
	    });

	    const focusLine = createSvg("line", { x1: scaleX(0), y1: margin.top, x2: scaleX(0), y2: height - margin.bottom, stroke: "rgba(33,24,18,0.18)", "stroke-width": "1.5", "stroke-dasharray": "4 4", opacity: "0" });
	    const focusDot = createSvg("circle", { r: "6", fill: "#c96b37", opacity: "0" });
	    chart.appendChild(focusLine);
	    chart.appendChild(focusDot);
	    const overlay = createSvg("rect", { x: margin.left, y: margin.top, width: innerWidth, height: innerHeight, fill: "transparent", style: "cursor: crosshair;" });
	    chart.appendChild(overlay);

	    function setTooltip(index, clientX) {
	      const row = data[index];
	      const x = scaleX(index);
	      focusLine.setAttribute("x1", x);
	      focusLine.setAttribute("x2", x);
	      focusLine.setAttribute("opacity", "1");
	      focusDot.setAttribute("cx", x);
	      focusDot.setAttribute("cy", scaleRateY(row.purchaseRate));
	      focusDot.setAttribute("opacity", "1");
	      tooltip.innerHTML = `
	        <p class="ctdash-tooltip-time">구간: ${escapeHtml(row.label || "-")}</p>
	        <div class="ctdash-tooltip-row"><span>구매율</span><b>${formatPercent(row.purchaseRate)}</b></div>
	        <div class="ctdash-tooltip-row"><span>검색수</span><b>${formatNumber(row.searchCount)}</b></div>
	        <div class="ctdash-tooltip-row"><span>매출</span><b>${formatWon(row.revenue)}</b></div>
	        <div class="ctdash-tooltip-row"><span>구매 배번호수</span><b>${formatNumber(row.purchaseCount)}</b></div>
	        <div class="ctdash-tooltip-row"><span>주문수</span><b>${formatNumber(row.orderCount)}</b></div>
	      `;
	      tooltip.classList.add("is-visible");
	      const box = chart.getBoundingClientRect();
	      const localX = clientX - box.left;
	      const preferredLeft = Math.min(Math.max(localX + 18, 14), box.width - 240);
	      tooltip.style.left = `${preferredLeft}px`;
	      tooltip.style.top = "52px";
	    }

	    overlay.addEventListener("mousemove", event => {
	      let svgX = margin.left;
	      const matrix = chart.getScreenCTM && chart.getScreenCTM();
	      if (matrix) {
	        const point = chart.createSVGPoint();
	        point.x = event.clientX;
	        point.y = event.clientY;
	        svgX = point.matrixTransform(matrix.inverse()).x;
	      }
	      const ratio = (svgX - margin.left) / innerWidth;
	      const index = Math.min(data.length - 1, Math.max(0, Math.floor(ratio * data.length)));
	      setTooltip(index, event.clientX);
	    });
	    overlay.addEventListener("mouseleave", () => {
	      tooltip.classList.remove("is-visible");
	      focusLine.setAttribute("opacity", "0");
	      focusDot.setAttribute("opacity", "0");
	    });
	  }

	  function firstText(row, fields) {
    for (const field of fields || []) {
      if (row && row[field] !== null && row[field] !== undefined && row[field] !== "") return String(row[field]);
    }
    return "";
  }

  async function loadDashboard() {
    if (sotDashLoading) return;

    sotDashLoading = true;
    sotDashLastError = "";
    setSotDashboardStatus("SOT:Dashboard 데이터를 불러오는 중입니다.");
    syncSotDashboardFilters();
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
      console.log("[SOT Dashboard] api_refetch", true);
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
      syncSotDashboardFilters();
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

    const refreshButton = $("#sot_dash_refresh_btn");
    if (refreshButton) refreshButton.disabled = Boolean(sotDashLoading);

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
      sessions: dashboardSessionCount(state),
      search_users: dashboardSearchUserCount(state),
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
      sessions: dashboardSessionCount(selected),
      search_users: dashboardSearchUserCount(selected),
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

  function dashboardSessionCount(row) {
    return numberValue(row, ["session_count", "visit_count", "local_user_count"]);
  }

  function dashboardSearchUserCount(row) {
    return numberValue(row, ["search_user_count"]);
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

  function currentDashboardPeopleForSelection(eventCode) {
    if (eventCode && eventCode !== "all") return currentDashboardEventPeople(eventCode);
    const seen = new Set();
    const rows = []
      .concat(sotCurrentTestData.events || [])
      .concat(sotCurrentTestData.event_summaries || []);
    const total = rows.reduce((sum, row) => {
      const code = row && row.event_code;
      if (!code || code === "all" || seen.has(code)) return sum;
      seen.add(code);
      return sum + currentDashboardEventPeople(code);
    }, 0);
    return total || numberValue(sotCurrentTestData.state || {}, ["people", "participants", "participant_count", "runner_count"]) || dashboardPeopleForSelection("all");
  }

  function currentDashboardEventPeople(eventCode) {
    const rows = []
      .concat(sotCurrentTestData.events || [])
      .concat(sotCurrentTestData.event_summaries || [])
      .concat(allEvents || []);
    const row = rows.find(item => item && item.event_code === eventCode);
    return numberValue(row, ["people", "participants", "participant_count", "runner_count"]);
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

  }

  function renderSotDashboard() {
    setSotDashHeader();
    const target = $("#sot_dash_content");
    if (!target) return;
    const stateMarkup = renderSotDashboardState();
    let sectionMarkup = "";
    if (sotDashActiveSection === "overview") sectionMarkup = renderSotOverview();
    else if (sotDashActiveSection === "period") sectionMarkup = renderSotPeriod();
    else if (sotDashActiveSection === "event") sectionMarkup = renderSotEvent();
    else if (sotDashActiveSection === "source") sectionMarkup = renderSotSource();
    else if (sotDashActiveSection === "cart") sectionMarkup = renderSotCart();
    else if (sotDashActiveSection === "purchase") sectionMarkup = renderSotPurchase();
    else if (sotDashActiveSection === "spot") sectionMarkup = renderSotSpot();
    else if (sotDashActiveSection === "course") sectionMarkup = renderSotCourse();
    else if (sotDashActiveSection === "quality") sectionMarkup = renderSotQuality();
    else sectionMarkup = renderSotPayment();
    target.innerHTML = `${stateMarkup}${sectionMarkup}`;
  }

  function renderSotDashboardState() {
    if (sotDashLoading) {
      return `<div class="sot-dash-callout is-status"><b>불러오는 중</b><span>SOT:Dashboard 데이터를 불러오는 동안 기본값으로 화면을 표시합니다.</span></div>`;
    }
    if (sotDashLastError) {
      return `<div class="sot-dash-callout warn is-status"><b>데이터 없음</b><span>SOT:Dashboard API 데이터를 불러오지 못했습니다. 기본값과 빈 테이블을 표시합니다.</span></div>`;
    }
    if (!sotDashLoaded) {
      return `<div class="sot-dash-callout is-status"><b>대기 중</b><span>아직 데이터를 불러오지 않았습니다. 아래 화면은 데이터 수신 전 기본 레이아웃입니다.</span></div>`;
    }
    if (!sotDashboardRows.length) {
      return `<div class="sot-dash-callout is-status"><b>비어있음</b><span>선택한 조건에 표시할 데이터가 없습니다.</span></div>`;
    }
    return "";
  }

  function renderSotDashboardNotLoaded() {
    return `
      <div class="sot-dash-callout">SOT:Dashboard 데이터를 아직 불러오지 않았습니다. 데이터 새로고침 버튼을 눌러 조회하세요.</div>
      ${sotKpis([["상태", "대기 중", "manual refresh"], ["API 호출", "0회", "initial load disabled"], ["캐시", "비어 있음", "sotDashboardRawRows"], ["다음 동작", "데이터 새로고침", "button click"]])}
    `;
  }

  function defaultSotDashboardTab(section) {
    if (section === "period") return "periodWeek";
    return "summary";
  }

  function renderSotOverview() {
    const ev = currentDashEvent();
    ensureSelectedRevenueWeek();
    const tabs = [
      ["summary", "요약"],
      ["funnel", "전환율 / 퍼널"],
      ["search", "검색 / 노출"]
    ];
    return `
      ${sotTabs(tabs)}
      ${sotDashActiveTab === "summary" ? `
        ${sotKpis([
          ["접속 수", formatNumber(ev.sessions), "세션 기준"],
          ["검색자 수", formatNumber(ev.search_users), "검색 세션/사용자 기준"],
          ["검색 수", formatNumber(ev.searches), "실제 search_count"],
          ["구매 수", formatNumber(ev.purchases), "purchase_count"],
          ["매출", formatWon(ev.revenue), "revenue"]
        ])}
        <div class="sot-dash-callout">접속 수는 session_ids 파싱값을 우선 사용하고, 없으면 session_count/visit_count를 사용합니다. 검색자 수는 search_user_count/search_session_count가 없으면 0으로 표시됩니다. 유입/디바이스는 후속 source/device 집계 연결 후 표시됩니다.</div>
        <div class="sot-dash-grid two">
          ${sotPanel("주차별 매출 추이", renderWeeklyRevenuePanel())}
          ${sotPanel("참가자 대비 성과", sotKpis([
            ["참가자 수", ev.people ? formatNumber(ev.people) : "미입력", "Event.people"],
            ["객단가", formatWon(Math.round(ev.revenue / Math.max(1, ev.purchases))), "revenue / purchase_count"],
            ["참가자 대비 구매율", formatPercent(safeRate(ev.purchases, ev.people)), "purchase / participants"],
            ["참가자 대비 구매사진", formatPercent(safeRate(ev.purchase_photo_count, ev.people)), "purchase_photo_count / participants"]
          ], "mini"))}
        </div>
        ${sotPanel("일자별 집계", sotTable(["날짜", "검색", "장바구니", "구매", "매출"], dailyRows().map(row => [row[0], row[1], row[2], row[4], row[6]])))}
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
      ` : ""}
    `;
  }

  function renderSotPeriod() {
    ensureSelectedRevenueWeek();
    ensureSelectedDateKey();
    return `
      ${sotTabs([["periodWeek", "주차별"], ["periodMonth", "월별"]])}
      ${sotDashActiveTab === "summary" || sotDashActiveTab === "periodWeek" ? sotPanel("주차별 요약", sotTable(["주차", "검색", "장바구니", "카트사진", "구매", "구매사진", "매출", "노출", "노출 0건"], weeklyRows())) : ""}
      ${sotDashActiveTab === "summary" || sotDashActiveTab === "periodWeek" ? sotPanel(`${saturdayWeekLabel(sotDashSelectedWeekStart)} 일자별 상세`, sotTable(["날짜", "검색", "장바구니", "카트사진", "구매", "구매사진", "매출", "노출", "노출 0건"], selectedWeekDailyRows())) : ""}
      ${sotDashActiveTab === "summary" || sotDashActiveTab === "periodWeek" ? sotPanel(`${sotDashSelectedDateKey || "선택 날짜"} 시간대별 상세`, sotTable(["시간", "검색", "장바구니", "카트사진", "구매", "구매사진", "매출", "노출", "노출 0건"], selectedDayHourlyRows())) : ""}
      ${sotDashActiveTab === "periodMonth" ? sotPanel("월별 핵심 지표", sotTable(["월", "검색", "장바구니", "카트사진", "구매", "구매사진", "매출", "노출", "노출 0건"], monthlyRows())) : ""}
    `;
  }

  function ensureSelectedDateKey() {
    const weekRows = selectedWeekDailyMetricRows();
    const source = weekRows.length ? weekRows : (sotDashData.daily || []);
    const dates = source.map(row => row.date_key || row.period_key).filter(Boolean);
    if (!dates.length) {
      sotDashSelectedDateKey = "";
      return;
    }
    if (!dates.includes(sotDashSelectedDateKey)) sotDashSelectedDateKey = dates[0];
  }

  function ensureSelectedRevenueWeek() {
    const weeks = weeklyMetricRows();
    if (!weeks.length) {
      sotDashSelectedWeekStart = "";
      return;
    }
    if (!weeks.some(row => row.week_start === sotDashSelectedWeekStart)) {
      sotDashSelectedWeekStart = weeks[0].week_start;
    }
  }

  function weeklyMetricRows() {
    return groupDashboardRowsByKey(sotDashData.daily || [], row => saturdayWeekStart(row.date_key || row.period_key || row.label), key => ({
      week_start: key,
      label: saturdayWeekLabel(key),
      period_key: key,
      date_key: key
    }));
  }

  function monthlyMetricRows() {
    return groupDashboardRowsByKey(sotDashData.daily || [], row => String(row.date_key || row.period_key || "").slice(0, 7), key => ({
      label: key || "월 미지정",
      period_key: key,
      date_key: key
    }));
  }

  function selectedWeekDailyMetricRows() {
    if (!sotDashSelectedWeekStart) return sotDashData.daily || [];
    const byDate = new Map((sotDashData.daily || []).map(row => [row.date_key || row.period_key || row.label, row]));
    return Array.from({ length:7 }, (_, index) => {
      const date = addDays(sotDashSelectedWeekStart, index);
      return byDate.get(date) || {
        label: date,
        period_key: date,
        date_key: date,
        search_count: 0,
        cart_count: 0,
        cart_photo_count: 0,
        purchase_count: 0,
        purchase_photo_count: 0,
        revenue: 0,
        exposure_count: 0,
        exposure_sum: 0,
        zero_exposure_count: 0
      };
    });
  }

  function groupDashboardRowsByKey(rows, keyFn, baseFn) {
    const fields = ["search_count", "cart_count", "cart_photo_count", "purchase_count", "purchase_photo_count", "revenue", "exposure_count", "exposure_sum", "zero_exposure_count"];
    const groups = new Map();
    (rows || []).forEach(row => {
      const key = keyFn(row);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, { ...(baseFn ? baseFn(key) : { label:key }) });
      const group = groups.get(key);
      fields.forEach(field => {
        group[field] = Number(group[field] || 0) + Number(row[field] || 0);
      });
    });
    return Array.from(groups.values()).sort((a, b) => String(a.period_key || a.label).localeCompare(String(b.period_key || b.label)));
  }

  function renderWeeklyRevenuePanel() {
    const weeks = weeklyMetricRows();
    if (!weeks.length) return sotChart([]);
    const selected = sotDashSelectedWeekStart || weeks[0].week_start;
    const options = weeks.map(row => `<option value="${escapeHtml(row.week_start)}" ${row.week_start === selected ? "selected" : ""}>${escapeHtml(row.label)}</option>`).join("");
    const chartRows = selectedWeekDailyMetricRows().map(row => [row.date_key || row.period_key || row.label, row.revenue / 1000]);
    return `
      <label class="sot-dash-filter-item inline"><span>주차</span><select class="sh-select" id="sot_dash_revenue_week_filter">${options}</select></label>
      <div class="sot-dash-note">단위: 천원</div>
      ${sotChart(chartRows)}
    `;
  }

  function renderSotEvent() {
    return `
      ${sotKpis([["선택 대회", currentDashEvent().event_name || currentDashEvent().event_code || "전체 대회", currentDashEvent().event_code || "all"], ["참가자 수", currentDashEvent().people ? formatNumber(currentDashEvent().people) : "미입력", "Event.people"], ["대회 매출", formatWon(currentDashEvent().revenue), "선택 기간 기준"], ["구매자 객단가", formatWon(Math.round(currentDashEvent().revenue / Math.max(1, currentDashEvent().purchases))), "revenue / purchase_count"]])}
      ${sotPanel("대회별 요약", sotTable(["event_code", "검색", "장바구니", "카트사진", "구매", "구매사진", "매출", "구매자 객단가"], eventSummaryRows()))}
      ${sotPanel("대회별 참가자 대비 성과", sotTable(["대회", "구매자 객단가", "참가자 대비 구매율", "참가자 대비 구매사진"], [[currentDashEvent().event_name || currentDashEvent().event_code || "전체 대회", formatWon(Math.round(currentDashEvent().revenue / Math.max(1, currentDashEvent().purchases))), formatPercent(safeRate(currentDashEvent().purchases, currentDashEvent().people)), formatPercent(safeRate(currentDashEvent().purchase_photo_count, currentDashEvent().people))]]))}
      ${sotPanel("대회별 시간/유입/전환 요약", sotTable(["대회", "주요 유입", "최고 시간대", "검색→구매", "노출 0건"], []))}
    `;
  }

  function renderSotSource() {
    return `
      <div class="sot-dash-callout">유입/디바이스는 날짜·대회별 원본 agg row를 화면에서 다시 합산해 표시합니다. 구매 유입은 현재 Purchase row의 attribution 한계로 unknown에 몰릴 수 있습니다.</div>
      <div class="sot-dash-grid two">
        ${sotPanel("유입별 성과", sotTable(["유입", "접속", "검색", "장바구니", "구매", "매출", "구매사진", "검색→구매"], filteredSources().map(sourceSummaryRow)))}
        ${sotPanel("디바이스별 성과", sotTable(["디바이스", "접속", "검색", "장바구니", "구매", "매출", "구매사진", "검색→구매"], deviceSummaryRows()))}
      </div>
      ${sotPanel("캠페인별 성과", sotTable(["캠페인", "접속", "검색", "장바구니", "구매", "매출", "구매사진", "검색→구매"], campaignSummaryRows()))}
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

  function selectedWeekDailyRows() {
    return selectedWeekDailyMetricRows().map(dailyTableRow);
  }

  function weeklyRows() {
    return weeklyMetricRows().map(row => [
      sotHtml(`<button class="sot-dash-btn ${row.week_start === sotDashSelectedWeekStart ? 'primary' : ''}" type="button" data-sot-week="${escapeHtml(row.week_start)}">${escapeHtml(row.label)}</button>`),
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

  function monthlyRows() {
    return monthlyMetricRows().map(metricTableRow);
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
      formatWon(row.revenue),
      formatWon(Math.round(row.revenue / Math.max(1, row.purchase_count)))
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
    if (!rows || !rows.length) {
      return `<div class="sot-dash-chart-placeholder">${sotDashLoading ? "데이터 대기 중" : "표시할 데이터가 없습니다"}</div>`;
    }
    const max = Math.max(1, ...rows.map(row => Number(row[1]) || 0));
    return `<div class="sot-dash-chart">${rows.map(row => `<div class="sot-dash-chart-col"><b>${number(row[1])}</b><div class="sot-dash-stick" style="height:${Math.max(8, (Number(row[1]) || 0) / max * 116)}px"></div><span>${escapeHtml(row[0])}</span></div>`).join("")}</div>`;
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
    const key = String(value || "").trim();
    const map = { sms:"SMS", kakao:"카카오톡", qr:"현장 QR", instagram:"인스타그램", naver:"네이버", google:"구글", direct:"직접", d:"direct", n:"naver", i:"instagram", u:"unknown", unknown:"미분류", unknown_source:"미분류" };
    return map[key] || key || "-";
  }

  function deviceLabel(value) {
    const key = String(value || "").trim();
    const map = { mobile:"mobile", desktop:"desktop", tablet:"tablet", unknown_device:"미분류" };
    return map[key] || key || "-";
  }

  function campaignLabel(value) {
    const key = String(value || "").trim();
    return key === "unknown_campaign" ? "미분류" : key || "-";
  }

  function sourceSummaryRow(row) {
    return [
      sourceLabel(row.utm_source || row.label),
      formatNumber(row.visit_count || row.session_count),
      formatNumber(row.search_count),
      formatNumber(row.cart_count),
      formatNumber(row.purchase_count),
      formatWon(row.revenue),
      formatNumber(row.purchase_photo_count),
      formatPercent(safeRate(row.purchase_count, row.search_count))
    ];
  }

  function deviceSummaryRows() {
    return (sotDashData.devices || []).map(row => [
      deviceLabel(row.device_type || row.device || row.label),
      formatNumber(row.visit_count || row.session_count),
      formatNumber(row.search_count),
      formatNumber(row.cart_count),
      formatNumber(row.purchase_count),
      formatWon(row.revenue),
      formatNumber(row.purchase_photo_count),
      formatPercent(safeRate(row.purchase_count, row.search_count))
    ]);
  }

  function campaignSummaryRows() {
    return (sotDashData.campaigns || []).map(row => [
      campaignLabel(row.utm_campaign || row.label),
      formatNumber(row.visit_count || row.session_count),
      formatNumber(row.search_count),
      formatNumber(row.cart_count),
      formatNumber(row.purchase_count),
      formatWon(row.revenue),
      formatNumber(row.purchase_photo_count),
      formatPercent(safeRate(row.purchase_count, row.search_count))
    ]);
  }

  window.deleteEvent = async function(id) {
    if(!confirm("정말 이 대회를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`${BUBBLE_API_BASE}${API_DATA_EVENT}/${id}`, { method: "DELETE" });
      if(res.ok) fetchData({ refreshDashboard: true }); else alert("권한이 없습니다.");
    } catch(e) { alert("삭제 오류"); }
  };

  window.togglePublic = async function(id, current) {
    try {
      const res = await fetch(`${BUBBLE_API_BASE}${API_DATA_EVENT}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_public: !current })
      });
      if(res.ok) fetchData({ refreshDashboard: true });
    } catch(e) { alert("수정 실패"); }
  };

  window.toggleNameSearch = async function(id, current) {
    try {
      const res = await fetch(`${BUBBLE_API_BASE}${API_DATA_EVENT}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name_search_enabled: !current })
      });
      if(res.ok) fetchData({ refreshDashboard: true });
    } catch(e) { alert("수정 실패"); }
  };

  window.toggleBibMinDigits = async function(id, current) {
    const next = normalizeBibMinDigits(current) === 3 ? 4 : 3;
    try {
      const res = await fetch(`${BUBBLE_API_BASE}${API_DATA_EVENT}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bib_min_digits: next })
      });
      if (!res.ok) {
        alert("저장하지 못했습니다. Bubble event 데이터에 bib_min_digits(숫자) 필드가 있는지 확인해주세요.");
        return;
      }
      fetchData({ refreshDashboard: true });
    } catch(e) {
      console.error("[Admin] bib minimum update failed", e);
      alert("배번호 최소 자리 수정 실패");
    }
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
      await fetchData({ refreshDashboard: true });
    } catch(e) {
      console.error("[Admin] event update error", e);
      alert("대회 수정 오류");
    }
  };

  function bindEvents(){
    document.querySelectorAll("[data-admin-view]").forEach(btn => {
      btn.addEventListener("click", () => {
        activeAdminView = btn.dataset.adminView;
        if (["report", "event-analysis", "diary"].includes(activeAdminView)) currentDashView = activeAdminView;
        syncAdminView();
        if (activeAdminView === "legacy") renderSotDashboard();
        if (["report", "event-analysis"].includes(activeAdminView)) {
          renderCurrentTestDashboard();
          if (!sotCurrentTestLoading) loadCurrentTestDashboard();
        }
        if (activeAdminView === "diary") renderCurrentTestDashboard();
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

      const refreshButton = e.target.closest("#sot_dash_refresh_btn");
      if (refreshButton) {
        console.log("[SOT Dashboard] refresh button clicked");
        loadDashboard();
        return;
      }

      const currentTestRefreshButton = e.target.closest("#sot_current_test_refresh_btn");
      if (currentTestRefreshButton) {
        console.log("[SOT Current Test] refresh button clicked");
        refreshCurrentDashSelection();
        return;
      }

      const reportPeriodButton = e.target.closest("[data-ctdash-report-period]");
      if (reportPeriodButton) {
        currentDashReportPeriod = reportPeriodButton.dataset.ctdashReportPeriod || "weekly";
        syncCurrentDashPeriodKeys();
        invalidateCurrentDashReportCache();
        loadCurrentTestDashboard();
        renderCurrentTestDashboard();
        return;
      }

      const eventPeriodButton = e.target.closest("[data-ctdash-event-period]");
      if (eventPeriodButton) {
        currentDashEventPeriod = eventPeriodButton.dataset.ctdashEventPeriod || "weekly";
        syncCurrentDashPeriodKeys();
        clearCurrentDashEventDetailCache();
        loadCurrentTestDashboard();
        renderCurrentTestDashboard();
        return;
      }

      const dayButton = e.target.closest("[data-sot-day]");
      if (dayButton) {
        sotDashSelectedDateKey = dayButton.dataset.sotDay || "";
        renderSotDashboard();
        return;
      }

      const weekButton = e.target.closest("[data-sot-week]");
      if (weekButton) {
        sotDashSelectedWeekStart = weekButton.dataset.sotWeek || "";
        ensureSelectedDateKey();
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
      if (sotDashLoaded) {
        rebuildSotDashboardData(selectedDashboardEventCode());
        syncSotDashboardFilters();
      }
      renderSotDashboard();
      logDashboardCacheRebuild("event filter change");
    });
    const dashPeriodFilter = $("#sot_dash_period_filter");
    if (dashPeriodFilter) dashPeriodFilter.addEventListener("change", e => {
      sotDashPeriodFilter = e.target.value || "all";
      if (sotDashLoaded) {
        rebuildSotDashboardData(sotDashEventFilter === "all" ? "" : sotDashEventFilter);
        syncSotDashboardFilters();
      }
      renderSotDashboard();
      logDashboardCacheRebuild("period filter change");
    });
    const dashSourceFilter = $("#sot_dash_source_filter");
    if (dashSourceFilter) dashSourceFilter.addEventListener("change", e => {
      sotDashSourceFilter = e.target.value || "all";
      renderSotDashboard();
      logDashboardCacheRebuild("source filter change");
    });
    document.addEventListener("change", e => {
      if (e.target && e.target.id === "ctdash_report_date_input") {
        currentDashReportSelectedDateKey = e.target.value || yesterdayKSTDateKey();
        currentDashReportSelectedWeekKey = sotWeekKeyFromDateKey(currentDashReportSelectedDateKey);
        currentDashReportSelectedMonthKey = monthKeyFromDateKey(currentDashReportSelectedDateKey);
        invalidateCurrentDashReportCache();
        loadCurrentTestDashboard();
        return;
      }
      if (e.target && e.target.id === "ctdash_report_week_month_input") {
        currentDashReportSelectedMonthKey = e.target.value || monthKeyFromDateKey(todayKSTDateKey());
        syncReportWeeklySelection(currentDashReportSelectedDateKey, currentDashReportSelectedWeekKey);
        invalidateCurrentDashReportCache();
        loadCurrentTestDashboard();
        return;
      }
      if (e.target && e.target.id === "ctdash_report_week_select") {
        currentDashReportSelectedWeekKey = e.target.value || "";
        syncReportWeeklySelection("", currentDashReportSelectedWeekKey);
        invalidateCurrentDashReportCache();
        loadCurrentTestDashboard();
        return;
      }
      if (e.target && e.target.id === "ctdash_report_month_input") {
        currentDashReportSelectedMonthKey = e.target.value || monthKeyFromDateKey(todayKSTDateKey());
        currentDashReportSelectedDateKey = `${currentDashReportSelectedMonthKey}-01`;
        invalidateCurrentDashReportCache();
        loadCurrentTestDashboard();
        return;
      }
      if (e.target && e.target.id === "ctdash_event_select") {
        currentDashSelectedEvent = e.target.value || "all";
        currentDashEventDetailLoading = currentDashSelectedEvent !== "all";
        currentDashEventDetailData = SOT_HEAD.emptyDashboardData();
        currentDashEventDetailError = "";
        currentDashEventDetailMissingSnapshot = null;
        renderCurrentTestDashboard();
        if (currentDashSelectedEvent === "all") {
          clearCurrentDashEventDetailCache();
          loadCurrentTestDashboard();
        } else {
          ensureCurrentDashEventDetail(currentDashSelectedEvent);
        }
        return;
      }
      if (e.target && e.target.id === "ctdash_date_input") {
        currentDashSelectedDateKey = e.target.value || yesterdayKSTDateKey();
        currentDashSelectedWeekKey = sotWeekKeyFromDateKey(currentDashSelectedDateKey);
        currentDashSelectedMonthKey = monthKeyFromDateKey(currentDashSelectedDateKey);
        currentDashEventDetailLoading = currentDashSelectedEvent !== "all";
        currentDashEventDetailData = SOT_HEAD.emptyDashboardData();
        currentDashEventDetailError = "";
        currentDashEventDetailMissingSnapshot = null;
        renderCurrentTestDashboard();
        if (currentDashSelectedEvent === "all") {
          clearCurrentDashEventDetailCache();
          loadCurrentTestDashboard();
        } else {
          ensureCurrentDashEventDetail(currentDashSelectedEvent);
        }
        return;
      }
      if (e.target && e.target.id === "ctdash_event_week_month_input") {
        currentDashSelectedMonthKey = e.target.value || monthKeyFromDateKey(todayKSTDateKey());
        syncEventWeeklySelection(currentDashSelectedDateKey, currentDashSelectedWeekKey);
        currentDashEventDetailLoading = currentDashSelectedEvent !== "all";
        currentDashEventDetailData = SOT_HEAD.emptyDashboardData();
        currentDashEventDetailError = "";
        currentDashEventDetailMissingSnapshot = null;
        renderCurrentTestDashboard();
        if (currentDashSelectedEvent === "all") {
          clearCurrentDashEventDetailCache();
          loadCurrentTestDashboard();
        } else {
          ensureCurrentDashEventDetail(currentDashSelectedEvent);
        }
        return;
      }
      if (e.target && e.target.id === "ctdash_event_week_select") {
        currentDashSelectedWeekKey = e.target.value || "";
        syncEventWeeklySelection("", currentDashSelectedWeekKey);
        currentDashEventDetailLoading = currentDashSelectedEvent !== "all";
        currentDashEventDetailData = SOT_HEAD.emptyDashboardData();
        currentDashEventDetailError = "";
        currentDashEventDetailMissingSnapshot = null;
        renderCurrentTestDashboard();
        if (currentDashSelectedEvent === "all") {
          clearCurrentDashEventDetailCache();
          loadCurrentTestDashboard();
        } else {
          ensureCurrentDashEventDetail(currentDashSelectedEvent);
        }
        return;
      }
      if (e.target && e.target.id === "ctdash_event_month_input") {
        currentDashSelectedMonthKey = e.target.value || monthKeyFromDateKey(todayKSTDateKey());
        currentDashSelectedDateKey = `${currentDashSelectedMonthKey}-01`;
        currentDashEventDetailLoading = currentDashSelectedEvent !== "all";
        currentDashEventDetailData = SOT_HEAD.emptyDashboardData();
        currentDashEventDetailError = "";
        currentDashEventDetailMissingSnapshot = null;
        renderCurrentTestDashboard();
        if (currentDashSelectedEvent === "all") {
          clearCurrentDashEventDetailCache();
          loadCurrentTestDashboard();
        } else {
          ensureCurrentDashEventDetail(currentDashSelectedEvent);
        }
        return;
      }
      if (e.target && e.target.id === "sot_dash_revenue_week_filter") {
        sotDashSelectedWeekStart = e.target.value || "";
        ensureSelectedDateKey();
        renderSotDashboard();
        logDashboardCacheRebuild("revenue week filter change");
      }
    });
    $("#sh_month_filter").addEventListener("change", (e) => {
      activeEventMonth = e.target.value || "all";
      applyEventFilters();
    });
    $("#sh_search").addEventListener("input", applyEventFilters);
    $("#sh_btn_refresh").addEventListener("click", () => fetchData({ refreshDashboard: false }));

    $("#sh_btn_create_event").addEventListener("click", async function(){
      this.disabled = true;
      try {
        const payload = {
          event_display_name: $("#sh_display_name").value.trim(),
          event_code: $("#sh_event_code").value.trim(),
          event_date: kstDateInputToISO($("#sh_event_date").value),
          publish_at: kstDateTimeInputToISO($("#sh_publish_at").value),
          is_public: "no",
          name_search_enabled: $("#sh_name_search_enabled").value === "true",
          bib_min_digits: BIB_MIN_DIGITS_DEFAULT
        };
        applyPeoplePayload(payload, $("#sh_people").value);
        const res = await fetch(BUBBLE_API_BASE + API_CREATE_EVENT, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if(res.ok) {
          alert("생성 성공");
          $("#sh_people").value = "";
          fetchData({ refreshDashboard: true });
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

  function bootAdmin(){
    guardAdmin().then(function(ok){
      if (ok) initUI();
    }).catch(function(err){
      console.error("[Admin] bootAdmin error:", err);
      alert("관리자 초기화 중 오류가 발생했습니다.");
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootAdmin);
  else bootAdmin();

})();
