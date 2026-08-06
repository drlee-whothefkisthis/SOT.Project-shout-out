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

  function sotDashDebugEnabled() {
    try {
      return window.localStorage && window.localStorage.getItem("SOT_DASH_DEBUG") === "1";
    } catch (e) {
      return false;
    }
  }
  window.sotDashDebugEnabled = window.sotDashDebugEnabled || sotDashDebugEnabled;

  function isSotDashDebugEnabled() {
    if (typeof sotDashDebugEnabled === "function") return sotDashDebugEnabled();
    return typeof window.sotDashDebugEnabled === "function" && window.sotDashDebugEnabled();
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

  function dashboardDataApiUrlForSource(apiBase, cursor, dataSource, eventCode) {
    const params = new URLSearchParams();
    params.set("limit", String(DASHBOARD_PAGE_LIMIT));
    params.set("cursor", String(cursor || 0));
    const constraints = [{ key:"data_source", constraint_type:"equals", value:dataSource || "legacy_backfill" }];
    if (eventCode) constraints.push({ key:"event_code", constraint_type:"equals", value:eventCode });
    params.set("constraints", JSON.stringify(constraints));
    return apiBase + dashboardDataApiPath(window.location.pathname) + "?" + params.toString();
  }

  async function fetchDashboardRowsForDataSource(apiBase, dataSource, eventCode) {
    const rows = [];
    let cursor = 0;
    let remaining = 1;

    while (remaining > 0) {
      const res = await fetch(dashboardDataApiUrlForSource(apiBase, cursor, dataSource, eventCode), { method:"GET" });
      const text = await res.text();
      if (!res.ok) {
        console.error("[SOT Legacy Analysis V2] API failed", { status: res.status, dataSource, body: text.slice(0, 500) });
        throw new Error("Legacy Analysis API failed: " + res.status);
      }

      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        console.error("[SOT Legacy Analysis V2] API JSON parse failed", { status: res.status, dataSource, body: text.slice(0, 500) });
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

  function formatKSTDate(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date).reduce((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function todayKSTDateKey() {
    return formatKSTDate(new Date());
  }

  function yesterdayKSTDateKey() {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return formatKSTDate(date);
  }

  async function fetchDashboardSnapshot({ dataSource, snapshotType, periodKey, eventCode, tab, manualRefresh }) {
    const payload = {
      data_source: dataSource || "current",
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

  const dashboardMetricFields = ["search_count", "cart_count", "cart_photo_count", "purchase_count", "purchase_photo_count", "revenue", "exposure_count", "exposure_sum", "zero_exposure_count", "visit_count", "session_count", "local_user_count", "search_user_count"];

  function normalizeDashboardRow(row) {
    const source = normalizeBubbleApiKeys(row);
    const metrics = normalizeBubbleApiKeys(source.metrics);
    return { ...source, ...metrics };
  }

  function aggregateDashboardMetricRows(rows, base) {
    const result = { ...(base || {}) };
    (Array.isArray(rows) ? rows : []).forEach(row => {
      dashboardMetricFields.forEach(field => {
        result[field] = Number(result[field] || 0) + numberValue(row, [field]);
      });
    });
    return result;
  }

  function hasDashboardMetricValue(row) {
    return dashboardMetricFields.some(field => numberValue(row, [field]) !== 0);
  }

  function groupDashboardMetricRows(rows, keyFn, baseFn) {
    const byKey = new Map();
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const key = keyFn(row);
      if (!key) return;
      if (!byKey.has(key)) byKey.set(key, baseFn ? baseFn(row, key) : { label: key });
      const aggregate = byKey.get(key);
      dashboardMetricFields.forEach(field => {
        aggregate[field] = Number(aggregate[field] || 0) + numberValue(row, [field]);
      });
    });
    return Array.from(byKey.values()).sort((a, b) => String(a.date_key || a.period_key || a.label || "").localeCompare(String(b.date_key || b.period_key || b.label || "")));
  }

  function dashboardRowDateKey(row) {
    const value = row && (row.date_key || row.period_key || row.event_date || row.created_date || row["Created Date"] || row.label);
    return value ? String(value).slice(0, 10) : "";
  }

  function buildDashboardDataFromRows(rows, eventCode) {
    const normalizedRows = (Array.isArray(rows) ? rows : []).map(normalizeDashboardRow);
    const selectedEventCode = eventCode || "";
    const visibleRows = selectedEventCode
      ? normalizedRows.filter(row => !row.event_code || row.event_code === selectedEventCode || row.event_code === "all")
      : normalizedRows;
    const byAgg = visibleRows.reduce((acc, row) => {
      const aggType = String(row && row.agg_type || "unknown").toLowerCase();
      if (!acc[aggType]) acc[aggType] = [];
      acc[aggType].push(row);
      return acc;
    }, {});
    const eventHourRows = byAgg.event_hour || [];
    const eventSummaryRows = (byAgg.event_summary && byAgg.event_summary.length)
      ? byAgg.event_summary.filter(row => row.event_code && row.event_code !== "all")
      : groupDashboardMetricRows(eventHourRows, row => row.event_code && row.event_code !== "all" ? row.event_code : "", (row, key) => ({
          event_code: key,
          event_name: row.event_name || row.event_display_name || row.display_name || key
        }));
    const stateRows = byAgg.state || [];
    const selectedState = selectedEventCode
      ? stateRows.find(row => row.event_code === selectedEventCode)
      : stateRows.find(row => row.event_code === "all") || stateRows[0];
    const stateSourceRows = selectedEventCode
      ? eventHourRows.filter(row => row.event_code === selectedEventCode)
      : (eventSummaryRows.length ? eventSummaryRows : eventHourRows);
    const state = selectedState && hasDashboardMetricValue(selectedState)
      ? selectedState
      : aggregateDashboardMetricRows(stateSourceRows, { ...(selectedState || {}), event_code: selectedEventCode || "all" });
    const daily = groupDashboardMetricRows(eventHourRows, dashboardRowDateKey, (row, key) => ({ date_key: key, period_key: key, label: key }));
    const hourly = eventHourRows.filter(row => row.hour_key !== undefined || row.hour !== undefined || row.event_hour !== undefined);
    const events = [{ event_code:"all", event_name:"전체 대회" }].concat(eventSummaryRows.map(row => ({
      ...row,
      event_name: row.event_name || row.event_display_name || row.display_name || row.event_code
    })));

    return {
      generated_at: "",
      state,
      events,
      hourly,
      daily,
      weekly: [],
      monthly: [],
      all: [],
      event_summaries: eventSummaryRows,
      ranges: byAgg.query_range || [],
      sales_amount_hour: byAgg.sales_amount_hour || [],
      sources: byAgg.source || [],
      campaigns: byAgg.campaign || [],
      devices: byAgg.device || [],
      photo_counts: byAgg.query_range || [],
      searchTypes: [],
      exposures: [],
      queries: [],
      carts: [],
      products: [],
      spots: byAgg.spot || [],
      course_ranges: [],
      quality: [],
      payment_failures: []
    };
  }

  function buildDashboardData(payload) {
    if (Array.isArray(payload)) {
      return buildDashboardDataFromRows(payload, arguments[2] || "");
    }
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
    const list = Array.isArray(rows) ? rows : [];
    const period = String(aggType || "all");
    if (period === "all") return list;
    const today = todayKSTDateKey();
    const month = today.slice(0, 7);
    if (period === "today") return list.filter(row => dashboardRowDateKey(normalizeDashboardRow(row)) === today);
    if (period === "this_month") return list.filter(row => dashboardRowDateKey(normalizeDashboardRow(row)).slice(0, 7) === month);
    if (period === "last_7_days") {
      const start = formatKSTDate(addDays(today, -6));
      return list.filter(row => {
        const key = dashboardRowDateKey(normalizeDashboardRow(row));
        return key && key >= start && key <= today;
      });
    }
    return list.filter(row => String(row && row.agg_type || "").toLowerCase() === period.toLowerCase());
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
    fetchDashboardRowsForDataSource,
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
  const SOT_LOADER_DEFAULT_MESSAGE = "데이터를 가져오는 중입니다!!";
  const SOT_LOADER_LOTTIE_SRC = "data:application/octet-stream;base64,UEsDBBQAAAAIAAAAAABcGXfZeQAAAJ4AAAANAAAAbWFuaWZlc3QuanNvbiXNOw7CMBAE0LtMHRDm0/gAVNwAUVjxChZiL1ovIBTl7ti4nNEbzYyQOQVjyQX+PIMjPNx2tz9gQJJINWbRFKaaIyuNzcK75TIgvOwmWsVJzJiOPFFpjMqo/OwQtbhSJg32p1Gs69W92Qd9P6Kxnjf4Ji195dYbLD9QSwMEFAAAAAgAAAAAAHDiDgLUCQAAqV8AABUAAABhbmltYXRpb25zLzEyMzQ1Lmpzb27tXNlu4zYU/ZVAzzIhbqKUt+6PLdDlJRgUbsZp0jgLbE8XDPLvPZeLRMnylsiO7VFmEpvbJXlFHt6N+pz8nVwmmmkmkjS5mSWXOkuTu+fkEh9P+BAmTf6hXKRv/efjA9p88/TwfEGNPn78aGuP5/PJYp5cXn1Ik+n4v8mMvn+uiu8e8cnTZPFfcqk8jZvx9QQUnsezyeMCxNNkjhGg0j3afk6e6M/Ytr5HNnV99y++8Jc0Qb2oLJRkKMGgbQmRsSO4owyUZizPMRv0TwQscZsrpbS51BijAC0auSgyZlBfSMlKpdMM01qg0VWWcpcAXSTw78NLunMvebuXst0LEX5rLxypDZPppZtyt9kQA6kbNBVLjAgjfEF9eqgCfeBxRk+7rqx41Y99/qhqV05dlVaN//WV8hciiFHRg74dP0/cOqV1mfw5w3K8w7C6MuwKRiNbML+lAuozrNaqT8u+qyvFsoJGRpO3fykDX0ZLBTaHf8D4iFc+O67mK4QWUYmliYbYxa5HnhqmeBkIREnOGTjFsowI+cJRKG0lUVeVpa8N8tfJ5WL2aQLGhSdi9+9P48XtBQcjHh6R+urbr7+7+G1yvXiaXfxMjL0YXfwwe/r0jAq3YN3NeDoHCc/Z+QLZoBs/rIxxmZf0ozTP0T0XIqMfLg3WDJI6xejtIGRYkMsAoVAEzIqKhCvQKJiiTzyz6V/242FK7dLkD0wnINvPi9nT/aR7Xj/Mxs+3d9eYmavVObUFLZoAQ9E6LHMmsQJWrWq3Rdav42jynQiYr+aKIaJ2ebYbEb/mzcH4EmKY5ckvs/Hj/OZp9pDQtrRZ9tFaLj3SOYGHaedV8dJvjg4WrloSXXxrbfXV3GszuIOHElXwe0Q8/OrX38XFj58W07vHyTxsl4qn4N6bedonogEUMtVALsrJLbjgi8XhGtRs7TaoxfV8jdAkpu7oBlwTLCtlKpjWeP5XI0qKOqlYrkw6qpDNFePDlbvGVbJRez/IdjPtQrZSAVHxIwr0T8nSIltWaky6mQwQR2tqxUKkReVEpRi5vr+bTjfhFtXZAbUEk0anJeRDcW7QRcLrfqHLsIJWqiyYKnCsroauDi6fMH4FxnbjF1LvhF8jCcFVRCgFGChFmUqWSZJ62sWuFK0ynCpNIKurehq+VkU5ohX1ERDNi1943jnBZzMF4YubCNG8bEbFJhLdqnSz/iExjWthMc1wScJinjvhTRuST1lRWOFNlFlhjgrTICioM8QzeRBRrACe6U141uLwCWNZYGo3lkELficsG7TLV+BVJjMLUJC2JLrXCosJP4UuKGm4cYVG12rmkeDVGWqOatAce0erwNNutILZdQue0iSb9l+YaihpKRHLGyZddBGbdLvHpd9o5V2y5WIzF1JiqOjaf48MlCSakGzkS+l7w7aL1RBbOV9JLGcwR1l6XPVBj0NHdfRGODn7IFgwaBWWYm1v9RnEgrDeY6t52DyCo62hRc8Eh8K6evtgm8EazLlmhdPfN2yiV5hiN5+NHcZ+cMnZqOlbw3oNDvkSfGssDH+4RjYMbUgkp4zmAUo2ikaZPSPBCwWbu2WGoMJCMIjmXEA4NniAVQUB6b0Q/vDz+65peN9p+PVSPNUZ1Iu/NYPwtz34KH/FwMNAcdBb08++Rl7vsi7mB51wmfm5FBvnwO3ewhSUocqbphBt8PddCBFc7MlTQBpm5o1m0EKhazPuTWwqg/PgVX6CgrU8BUge2lNQC3PnIunR6f9WSW9HqQT7d7NUku/N9xxO0RyWP6Nw6hmYaJzbeMWDhe2vzAS2W0FOr/c6RhsqpkMHjEdDO7IGeg0wgj1d6ghBFCuNNUNpxu0MGyjCAb5oBIWQkzWArGVKKDTySaiCGae9a5yvoIKQg3kaMwUXdO1phOua7PF9eRr3jB/dau620Pj+um1z1Z8Z7BG8EOwBiw4Fe8C7zbBnjksZG2mq3qM21gxh2YPuZEfcpTz1pIXARch0zlPsXVaiVhxGYwmujdh5peIQOpUZEL3VaaNDP4JeZP11M+1xltHD3LXH6LEvN10TosQzDv8MfLmQn42oj/4T04tXKpbbqmXEB6mKSI+ocirFrM45kE65szK0zSzKwmdATzqcetn3LLAImS7dNDIoqDuomIdbEoN2OWiXlZhF4syBtUus/1jM+vrpI6jtN3T5VXKERhSCUjYApeTWqRfOuj3JEKFDnbc77PU4r+WH1TPcl/yw5RSDiBTLD0uDXRfiHCqrup+jC3FG2BJvBgRSDhkHvZfZMJHVRgF7aNmszpMCMXptco3a6dUyOddfdbLg0CjyFEcX18G8IAsdZ+CqgwF8G0hwzm/tMkYlFFA3Bi0LhAuGFpRGdE+VbtVv0hsipXs4oUpsSV2mEKdsQNVZnVXFvn3eTdRYY27sYPIJ+70DX48tYjrAVBPGSHAHqAgEObtM2E6VRZeVQNjEVWgYksoDfnbhLAIOcx8fbfCkKQaiJrBMsNmhDaIGrDFVxTQGjJWEPAhn1DbQB5ow7Hf40M6e69Mcy1BbfEXMD9AS3mTnNIrwNrex3xEiq8JleBAPTZbSrQYh7eLNYK8WMCjb8R0ytKhwugLnJSn7le4gaWi17qALAZ3meMyvFQros7O+lgeDWuj9JjzTtVBbM/mEoTbw9diCuwdZ9BCy6Iq7LYjxJkMJ/tPdFu6jLGEqsb40H2YpcoFwgSMEv/OTM3k2CJr7uZoXGPuWePAdrU24Ib3Zqcdjrx4G1X8wQ3ec31sCAl9vuBgCAoeAwCEgcAgIbBrEjNC4RstL+GjJAsZ1XuQSVz28QcyVZabWwHayjGFBDu6bswgORHl8oD6Pr+8P+Raa3cDE3zCAACVgdyF5y+A65fZvo9mpt6LVmyZf9v7CMvAENkyuz+6EP9O3nV3HW2qWR7ouBKTqBweC7+foXDiwCyJKJT5BbU5sq2xXcFndavOG2hRE2t1fOGXcbWnoysbdJESazpyQRAROilhBWSVGlKoqkpLtavpb2VU6rlsTGRw2PZxJBoZsPDJEbGByZ3Y68X1fqm6BxGr2dXH5lBXp9Rer399l04Qti2N5RlrDSqSjnMjFQh6Q2EfTbkCvv6EMphTFz3dTWWoEss7G1g6qYjnZK+F+cU4UVmryu9A7GaI04DDn/iUSFg8hJNewmtmB+BdaVFVbybgqfUfovqQuJDQSukVNAxgcL1tAZkG7GX42s+ZNCqeJmfu+2e0wE6Z0XWIhrnG9dLL5lEFz/f3u93O+DFLk4Gr5UiXEPgwYg4TYAXaBsQd0tcD+sYWrhaKNgrWITBi9u1pWXR552z2TY3a3DPdMhnsmX+I9k8FpcZKH/gHunKD4YTy7d6/R//DyP1BLAQIAABQAAAAIAAAAAABcGXfZeQAAAJ4AAAANAAAAAAAAAAAAAAAAAAAAAABtYW5pZmVzdC5qc29uUEsBAgAAFAAAAAgAAAAAAHDiDgLUCQAAqV8AABUAAAAAAAAAAAAAAAAApAAAAGFuaW1hdGlvbnMvMTIzNDUuanNvblBLBQYAAAAAAgACAH4AAACrCgAAAAA=";
  const SOT_DOT_LOTTIE_PLAYER_SRC = "https://unpkg.com/@dotlottie/player-component@2.7.12/dist/dotlottie-player.mjs";
  let sotGlobalLoaderDepth = 0;
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
  let activeAdminGroup = "events";
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
  let currentDashReportPeriod = "total";
  let currentDashReportTotalChartPeriod = "daily";
  let currentDashReportSelectedWeekStart = "";
  let currentDashReportSelectedWeekKey = sotWeekKeyFromDateKey(yesterdayKSTDateKey());
  let currentDashReportSelectedDateKey = yesterdayKSTDateKey();
  let currentDashReportSelectedMonthKey = monthKeyFromDateKey(todayKSTDateKey());
  let currentDashEventPeriod = "total";
  let currentDashSelectedEvent = "";
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
  const FIELD_REPORT_TEST_TYPE = "SOT:FieldReportTest";
  const FIELD_REPORT_JSON_FIELD = "report_json";
  const FIELD_REPORT_STORAGE_KEY = "shout_field_report_v2_test_drafts";
  const FIELD_REPORT_API_URL = "https://photographer-report-api-a6mwhgji4q-du.a.run.app/v1/admin-field-reports";
  const FIELD_REPORT_SOURCES_API_URL = "https://photographer-report-api-a6mwhgji4q-du.a.run.app/v1/admin-field-report-sources";
  const PHOTOGRAPHER_REPORTS_API_URL = "https://photographer-report-api-a6mwhgji4q-du.a.run.app/api/v1/photographer-reports";
  const PHOTOGRAPHER_REPORT_HISTORY_EVENTS_API_URL = "https://photographer-report-api-a6mwhgji4q-du.a.run.app/api/v1/photographer-report-history-events";
  let fieldReportDrafts = [];
  let fieldReportSaving = false;
  let fieldReportSaveMessage = "";
  let fieldReportActiveId = "";
  let fieldReportShowJson = false;
  const fieldReportSourcesByEventCode = {};
  let fieldReportSourceRequestSequence = 0;
  const fieldReportHistoryByEventCode = {};
  let fieldReportHistoryEventCode = "";
  let fieldReportHistoryVersion = null;
  let fieldReportHistoryRequestSequence = 0;
  let fieldReportHistoryAbortController = null;
  const photographerReportHistoryByEventCode = {};
  let photographerReportHistoryEventCode = "";
  let photographerReportHistoryReportId = "";
  let photographerReportHistoryFilter = "all";
  let photographerReportHistorySort = "latest";
  let photographerReportHistoryRequestSequence = 0;
  let photographerReportHistoryAbortController = null;
  let photographerReportHistoryEventsState = { state:"idle", eventCodes:[], message:"" };
  let legacyAnalysisView = "report";
  let legacyAnalysisReportPeriod = "total";
  let legacyAnalysisReportSelectedWeekKey = sotWeekKeyFromDateKey(yesterdayKSTDateKey());
  let legacyAnalysisReportSelectedDateKey = yesterdayKSTDateKey();
  let legacyAnalysisReportSelectedMonthKey = monthKeyFromDateKey(todayKSTDateKey());
  let legacyAnalysisEventPeriod = "total";
  let legacyAnalysisSelectedEvent = "";
  let legacyAnalysisEventSelectedWeekKey = sotWeekKeyFromDateKey(yesterdayKSTDateKey());
  let legacyAnalysisEventSelectedDateKey = yesterdayKSTDateKey();
  let legacyAnalysisEventSelectedMonthKey = monthKeyFromDateKey(todayKSTDateKey());
  let legacyAnalysisResolvedDataSource = "";
  let legacyAnalysisRows = [];
  let legacyAnalysisByAggType = {};
  let legacyAnalysisSnapshotPayload = null;
  let legacyAnalysisStatusSnapshot = null;
  let legacyAnalysisInitialPeriodResolved = false;
  let legacyAnalysisEventListRows = [];
  let legacyAnalysisLoadState = "idle";
  let legacyAnalysisError = "";
  let legacyAnalysisFallbackReason = "";

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

  function eventDateKeyForOption(row) {
    const source = row && typeof row === "object" ? row : {};
    const ownDate = source.event_date || source.eventDate || source.event_start_at || source.event_start || source.start_at || source.start_date || source.publish_at || "";
    if (ownDate) return kstDateKeyFromValue(ownDate);
    const eventCode = String(source.event_code || "").trim();
    if (!eventCode) return null;
    const event = (allEvents || []).find(item => String(item.event_code || "") === eventCode);
    if (!event) return null;
    const eventDate = event.event_date || event.eventDate || event.event_start_at || event.event_start || event.start_at || event.start_date || event.publish_at || "";
    return eventDate ? kstDateKeyFromValue(eventDate) : null;
  }

  function isStartedEventOption(row) {
    const dateKey = eventDateKeyForOption(row);
    if (dateKey === null) return true;
    return dateKey <= getTodayKSTKey();
  }

  function sortEventOptionsByDateDesc(rows) {
    return [...(rows || [])]
      .filter(isStartedEventOption)
      .sort((a, b) => {
        const aDate = eventDateKeyForOption(a);
        const bDate = eventDateKeyForOption(b);
        if (aDate !== null || bDate !== null) {
          if (aDate === null) return 1;
          if (bDate === null) return -1;
          if (aDate !== bDate) return bDate - aDate;
        }
        return String(currentDashEventLabel(a) || a.event_name || a.event_code || "").localeCompare(String(currentDashEventLabel(b) || b.event_name || b.event_code || ""), "ko");
      });
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
    return sortEventOptionsByDateDesc(Array.from(byCode.values()));
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
      if (currentDashReportPeriod === "total") return "total";
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


  function ensureSotDotLottiePlayer() {
    if (document.getElementById("sot_dotlottie_player_script")) return;
    const script = document.createElement("script");
    script.id = "sot_dotlottie_player_script";
    script.type = "module";
    script.src = SOT_DOT_LOTTIE_PLAYER_SRC;
    document.head.appendChild(script);
  }

  function ensureSotGlobalLoader() {
    ensureSotDotLottiePlayer();

    let loader = document.getElementById("sotGlobalLoader");
    if (loader) return loader;

    loader = document.createElement("div");
    loader.id = "sotGlobalLoader";
    loader.className = "sot-loader-overlay";
    loader.hidden = true;
    loader.setAttribute("role", "status");
    loader.setAttribute("aria-live", "polite");
    loader.innerHTML = `
      <div class="sot-loader-card" role="dialog" aria-modal="true" aria-label="데이터 로딩 중">
        <dotlottie-player
          id="sotLoaderLottie"
          class="sot-loader-lottie"
          src="${SOT_LOADER_LOTTIE_SRC}"
          background="transparent"
          speed="1"
          loop
          autoplay>
        </dotlottie-player>
        <div id="sotLoaderTitle" class="sot-loader-title">${escapeHtml(SOT_LOADER_DEFAULT_MESSAGE)}</div>
        <div class="sot-loader-sub">잠시만 기다려주세요</div>
      </div>
    `;
    document.body.appendChild(loader);
    return loader;
  }

  function showSotLoader(message) {
    const loader = ensureSotGlobalLoader();
    const title = document.getElementById("sotLoaderTitle");
    const player = document.getElementById("sotLoaderLottie");

    sotGlobalLoaderDepth += 1;
    if (title) title.textContent = message || SOT_LOADER_DEFAULT_MESSAGE;
    loader.hidden = false;
    document.body.classList.add("sot-loader-active");

    if (player && typeof player.play === "function") {
      try { player.play(); } catch (error) { /* dotlottie-player may not be upgraded yet */ }
    }
  }

  function hideSotLoader(force) {
    const loader = document.getElementById("sotGlobalLoader");
    if (!loader) return;

    sotGlobalLoaderDepth = force ? 0 : Math.max(0, sotGlobalLoaderDepth - 1);
    if (sotGlobalLoaderDepth > 0) return;

    loader.hidden = true;
    document.body.classList.remove("sot-loader-active");

    const player = document.getElementById("sotLoaderLottie");
    if (player && typeof player.pause === "function") {
      try { player.pause(); } catch (error) { /* ignore */ }
    }
  }

  function initUI(){

    const mount = document.createElement("div");
    mount.className = "sh-admin-wrap shell";
    mount.innerHTML = `
      <header class="sh-admin-hero hero">
        <div class="sh-admin-hero-main hero-main card">
          <div class="sh-admin-eyebrow">SOT Data API Admin Console</div>
          <h1 class="sh-admin-title">Shout-out Admin Dashboard</h1>
          <p class="sh-admin-sub">대회 관리, 대회 운영, 결과 분석을 한 화면에서 확인합니다.</p>
        </div>
        <div class="sh-admin-status-card hero-side card">
          <div><b id="sh_hero_status">상태: 대기 중</b></div>
          <div>마지막 업데이트: <span id="sh_hero_updated">레거시데이터에서 조회</span></div>
          <div>Data API: <span id="sh_hero_snapshot_key">SOT:Dashboard</span></div>
          <button class="sh-btn-sm sh-admin-refresh" type="button" id="sot_current_test_refresh_btn">스냅샷 다시 불러오기</button>
        </div>
      </header>

      <div class="sh-admin-tabs main-tabs" role="tablist" aria-label="Admin sections">
        <button class="sh-admin-tab tab-btn is-active" type="button" data-admin-group="events" aria-selected="true">대회 관리</button>
        <button class="sh-admin-tab tab-btn" type="button" data-admin-group="operations" aria-selected="false">대회 운영</button>
        <button class="sh-admin-tab tab-btn" type="button" data-admin-group="analysis" aria-selected="false">결과 분석</button>
      </div>

      <div class="sh-admin-tabs main-tabs is-hidden" data-admin-subtabs="operations" role="tablist" aria-label="대회 운영 메뉴" hidden style="display:none">
        <button class="sh-admin-tab tab-btn" type="button" data-admin-view="diary" aria-selected="false">일지 작성</button>
        <button class="sh-admin-tab tab-btn" type="button" data-admin-view="diary-view" aria-selected="false">일지 조회</button>
        <button class="sh-admin-tab tab-btn" type="button" data-admin-view="photographer-view" aria-selected="false">포토그래퍼 일지 조회</button>
      </div>

      <div class="sh-admin-tabs main-tabs is-hidden" data-admin-subtabs="analysis" role="tablist" aria-label="결과 분석 메뉴" hidden style="display:none">
        <button class="sh-admin-tab tab-btn" type="button" data-admin-view="report" aria-selected="false">리포트</button>
        <button class="sh-admin-tab tab-btn" type="button" data-admin-view="event-analysis" aria-selected="false">대회별 분석</button>
        <button class="sh-admin-tab tab-btn" type="button" data-admin-view="legacy" aria-selected="false">레거시데이터</button>
        <button class="sh-admin-tab tab-btn" type="button" data-admin-view="legacy-analysis-v2" aria-selected="false">레거시 분석 v2</button>
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

      <section class="sh-admin-panel is-hidden" data-admin-panel="diary-view" hidden>
        <div class="sot-current-test-content" data-current-test-content="diary-view"></div>
      </section>

      <section class="sh-admin-panel is-hidden" data-admin-panel="photographer-view" hidden>
        <div class="sot-current-test-content" data-current-test-content="photographer-view"></div>
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

      <section class="sh-admin-panel is-hidden" data-admin-panel="legacy-analysis-v2" hidden>
        <div class="sot-current-test-content" id="legacy_analysis_v2_content"></div>
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
      syncFieldReportDraftsFromEvents(allEvents);
      syncMonthFilterOptions();
      applyEventFilters();
      if (refreshDashboard && sotDashLoaded) {
        rebuildSotDashboardData(selectedDashboardEventCode());
        syncSotDashboardFilters();
        if (activeAdminView === "legacy") renderSotDashboard();
      }
      if (activeAdminView === "diary") renderCurrentTestDashboard();
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
          <div style="height:8px"></div>
          <label class="sh-label" for="edit_spots_config_json_${ev._id}">스팟 설정 JSON</label>
          <textarea class="sh-input" id="edit_spots_config_json_${ev._id}" rows="6" placeholder="AM/BM/CM prefix별 spot_name, camera, location_memo, sort_order를 JSON 배열로 입력">${escapeHtml(ev.spots_config_json || "")}</textarea>
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
    document.querySelectorAll("[data-admin-group]").forEach(btn => {
      const isActive = btn.dataset.adminGroup === activeAdminGroup;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    document.querySelectorAll("[data-admin-subtabs]").forEach(tabset => {
      const isActive = tabset.dataset.adminSubtabs === activeAdminGroup;
      tabset.hidden = !isActive;
      tabset.classList.toggle("is-hidden", !isActive);
      tabset.style.display = isActive ? "flex" : "none";
    });

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
      if (currentDashReportPeriod === "total") return "report_total";
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
      if (currentDashReportPeriod === "total") {
        return "total";
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
    showSotLoader(SOT_LOADER_DEFAULT_MESSAGE);
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
        ensureCurrentDashEventListSnapshot().then(() => {
          syncCurrentDashSelections();
          if (currentDashSelectedEvent && currentDashSelectedEvent !== "all") {
            ensureCurrentDashEventDetail(currentDashSelectedEvent);
          } else {
            renderCurrentTestDashboard();
          }
        });
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
      hideSotLoader();
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
              ? `<button class="ctdash-chip ${currentDashEventPeriod === "total" ? "is-active" : ""}" type="button">전체</button><button class="ctdash-chip ${currentDashEventPeriod === "monthly" ? "is-active" : ""}" type="button">월별</button><button class="ctdash-chip ${currentDashEventPeriod === "weekly" ? "is-active" : ""}" type="button">주차별</button><button class="ctdash-chip ${currentDashEventPeriod === "daily" ? "is-active" : ""}" type="button">일별</button>`
              : `<button class="ctdash-chip ${currentDashReportPeriod === "total" ? "is-active" : ""}" type="button">전체</button><button class="ctdash-chip ${currentDashReportPeriod === "monthly" ? "is-active" : ""}" type="button">월별</button><button class="ctdash-chip ${currentDashReportPeriod === "weekly" ? "is-active" : ""}" type="button">주차별</button><button class="ctdash-chip ${currentDashReportPeriod === "daily" ? "is-active" : ""}" type="button">일별</button>`}</div>
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
    if (currentDashView === "diary-view") {
      target.innerHTML = currentTestDashboardFrame(renderCurrentDashDiaryReadView(), "조회");
      return;
    }
    if (currentDashView === "photographer-view") {
      target.innerHTML = currentTestDashboardFrame(renderPhotographerReportHistoryView(), "포토그래퍼 일지");
      return;
    }

    if (sotCurrentTestLoading) {
      return;
    }
    if (sotCurrentTestMissingSnapshot || sotCurrentTestLastError) {
      if (!sotCurrentTestLoaded) {
        const message = sotCurrentTestMissingSnapshot
          ? (sotCurrentTestMissingSnapshot.message || "해당 기간의 snapshot이 없습니다.")
          : (sotCurrentTestLastError || "snapshot API 연결 실패");
        target.innerHTML = currentTestDashboardFrame(renderCurrentDashFallbackView("Snapshot", message));
      }
      renderCurrentDashCharts();
      return;
    }
    if (!sotCurrentTestLoaded) {
      target.innerHTML = "";
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
    showSotLoader(SOT_LOADER_DEFAULT_MESSAGE);
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
      hideSotLoader();
      renderCurrentTestDashboard();
    }
  }

  function syncCurrentDashSelections() {
    const events = currentDashEventOptions();
    const defaultEventCode = events.length ? events[0].event_code : "all";
    if (!currentDashSelectedEvent || (currentDashSelectedEvent !== "all" && events.length && !events.some(row => row.event_code === currentDashSelectedEvent))) {
      currentDashSelectedEvent = defaultEventCode;
    }
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
    if (currentDashReportPeriod === "total") {
      return `<label><span>전체 기준</span><input class="ctdash-input" type="text" value="total" disabled></label>`;
    }
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
    if (period === "total") return "전체 그래프";
    return "시간대별 그래프";
  }

  function currentDashReportChartTitle() {
    if (currentDashReportPeriod !== "total") return currentDashChartTitle(currentDashReportPeriod);
    if (currentDashReportTotalChartPeriod === "weekly") return "주차별 그래프";
    if (currentDashReportTotalChartPeriod === "monthly") return "월별 그래프";
    return "일자별 그래프";
  }

  function renderReportTotalChartControls() {
    if (currentDashReportPeriod !== "total") return "";
    return `
      <div class="ctdash-period-tabs" aria-label="전체 그래프 단위">
        <button class="ctdash-chip ${currentDashReportTotalChartPeriod === "daily" ? "is-active" : ""}" type="button" data-ctdash-report-chart-period="daily">일자별</button>
        <button class="ctdash-chip ${currentDashReportTotalChartPeriod === "weekly" ? "is-active" : ""}" type="button" data-ctdash-report-chart-period="weekly">주차별</button>
        <button class="ctdash-chip ${currentDashReportTotalChartPeriod === "monthly" ? "is-active" : ""}" type="button" data-ctdash-report-chart-period="monthly">월별</button>
      </div>
    `;
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
    const reportEventRows = currentDashReportEventRows();
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
              <button class="ctdash-chip ${currentDashReportPeriod === "total" ? "is-active" : ""}" type="button" data-ctdash-report-period="total">전체</button>
              <button class="ctdash-chip ${currentDashReportPeriod === "monthly" ? "is-active" : ""}" type="button" data-ctdash-report-period="monthly">월별</button>
              <button class="ctdash-chip ${currentDashReportPeriod === "weekly" ? "is-active" : ""}" type="button" data-ctdash-report-period="weekly">주차별</button>
              <button class="ctdash-chip ${currentDashReportPeriod === "daily" ? "is-active" : ""}" type="button" data-ctdash-report-period="daily">일별</button>
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
          <div class="ctdash-section-head"><div><div class="ctdash-kicker">Sales</div><h3>매출 분석</h3></div><span class="ctdash-tag">Revenue</span></div>
          <div class="ctdash-sales-grid">
            ${renderRevenueCards(state, people, { labelPrefix: "기간", spots: sotCurrentTestData.spots || [] })}
          </div>
        </article>
        ${renderCurrentDashReportConversionSection(state, reportEventRows)}
        <article class="ctdash-card ctdash-section">
          <div class="ctdash-section-head">
            <div>
              <div class="ctdash-kicker">Hourly</div>
              <h3>${currentDashReportChartTitle()}</h3>
              <p>마우스를 올리면 선택 기간 기준 검색, 카트, 구매, 평균전환율을 확인할 수 있습니다.</p>
            </div>
            ${renderReportTotalChartControls() || `<span class="ctdash-tag">Hover</span>`}
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
        <article class="ctdash-card ctdash-section ctdash-wide-section">
          <div class="ctdash-section-head"><div><div class="ctdash-kicker">Summary</div><h3>대회별 구간 요약</h3><p>선택한 구간에 실제 기록이 있는 대회만 표시합니다.</p></div><span class="ctdash-tag">Period Events</span></div>
          ${reportEventSummaryTable(reportEventRows)}
        </article>
        <article class="ctdash-card ctdash-section">
          <div class="ctdash-section-head"><div><div class="ctdash-kicker">Traffic</div><h3>유입별</h3></div><span class="ctdash-tag">Campaign / Source</span></div>
          <div class="ctdash-sub-grid">
            ${rankSection("캠페인", topRankRows(sotCurrentTestData.campaigns || [], ["utm_campaign", "label"]))}
            ${rankSection("소스", topRankRows(sotCurrentTestData.sources || [], ["utm_source", "label"]))}
            ${rankSection("디바이스", topRankRows(sotCurrentTestData.devices || [], ["device_type", "label"]))}
            ${rankSection("OS", topRankRows(sotCurrentTestData.devices || [], ["os_type", "label"]))}
          </div>
        </article>
        ${photoCounts.length ? renderPhotoExposureSection(state, currentDashReportScopeLabel()) : renderPhotoExposurePendingSection()}
      </section>`;
  }

  function renderCurrentDashEventView() {
    const detail = currentDashEventDataset();
    const summary = currentDashSelectedEventSummary();
    const spots = (Array.isArray(detail.spots) ? [...detail.spots] : [])
      .sort((a, b) => numberValue(b, ["allocated_revenue", "revenue"]) - numberValue(a, ["allocated_revenue", "revenue"]));
    const photoCounts = Array.isArray(detail.photo_counts) ? detail.photo_counts : [];
    const eventName = currentDashSelectedEvent === "all"
      ? "전체 대회"
      : (currentDashEventLabel(currentDashEventOptions().find(row => row.event_code === currentDashSelectedEvent)) || currentDashSelectedEvent);
    const people = currentDashSelectedEvent === "all" ? currentDashboardPeopleForSelection("all") : currentDashboardPeopleForSelection(currentDashSelectedEvent);
    const rows = sortMetricRows(detail.daily || []);
    const detailTable = renderEventDetailTable(rows);
    const eventPurchaseCount = numberValue(summary, ["purchase_count"]);
    const eventPurchasePhotoCount = numberValue(summary, ["purchase_photo_count"]);
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
            <div class="ctdash-inline-fields">${currentDashEventScopeControls()}</div>
            <div class="ctdash-period-tabs">
              <button class="ctdash-chip ${currentDashEventPeriod === "total" ? "is-active" : ""}" type="button" data-ctdash-event-period="total">전체</button>
              <button class="ctdash-chip ${currentDashEventPeriod === "monthly" ? "is-active" : ""}" type="button" data-ctdash-event-period="monthly">월별</button>
              <button class="ctdash-chip ${currentDashEventPeriod === "weekly" ? "is-active" : ""}" type="button" data-ctdash-event-period="weekly">주차별</button>
              <button class="ctdash-chip ${currentDashEventPeriod === "daily" ? "is-active" : ""}" type="button" data-ctdash-event-period="daily">일별</button>
            </div>
          </div>
          ${currentDashEventDetailLoading ? `<div class="ctdash-callout">선택한 대회 상세를 불러오는 중입니다.</div>` : ""}
        </article>
        <div class="ctdash-two-col">
          <article class="ctdash-card ctdash-section">
            <div class="ctdash-section-head"><div><div class="ctdash-kicker">Overview</div><h3>기본 요약</h3></div><span class="ctdash-tag">Snapshot</span></div>
            <div class="ctdash-summary-grid">
              ${metricCard("대회명", escapeHtml(eventName), currentDashSelectedEvent === "all" ? "전체 합산" : currentDashSelectedEvent)}
              ${metricCard("참가자 수", formatNumber(people), "Bubble 이벤트 데이터")}
              ${metricCard("검색자", formatNumber(dashboardSearchUserCount(summary)), "로컬 개수")}
              ${metricCard("접속수", formatNumber(dashboardSessionCount(summary)), "session_count 우선")}
              ${metricCard("검색수", formatNumber(numberValue(summary, ["search_count"])), "세션 수")}
              ${metricCard("장바구니수", formatNumber(numberValue(summary, ["cart_count"])), "카트 진입")}
              ${metricCard("구매수", formatNumber(eventPurchaseCount), "결제 완료")}
            </div>
          </article>
          <article class="ctdash-card ctdash-section">
            <div class="ctdash-section-head"><div><div class="ctdash-kicker">Revenue</div><h3>매출 분석</h3></div><span class="ctdash-tag">Sales</span></div>
            <div class="ctdash-sales-grid">
              ${renderRevenueCards(summary, people, { labelPrefix: "대회", spots })}
            </div>
          </article>
          <article class="ctdash-card ctdash-section ctdash-spot-section">
            <div class="ctdash-section-head"><div><div class="ctdash-kicker">Spots</div><h3>스팟별 데이터</h3></div><span class="ctdash-tag">Pending Mapping</span></div>
            <div class="ctdash-spot-grid ctdash-balanced-grid is-count-${Math.min(spots.length || 1, 12)}">
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
        ${currentDashSelectedEvent === "all" ? `
        <article class="ctdash-card ctdash-section">
          <div class="ctdash-section-head"><div><div class="ctdash-kicker">Summary</div><h3>대회별 요약</h3></div><span class="ctdash-tag">Snapshot</span></div>
          ${summaryTable((sotCurrentTestData.event_summaries || []).slice(0, 12))}
        </article>` : ""}
      </section>`;
  }

  function fieldReportNowISO() {
    return new Date().toISOString();
  }

  function fieldReportId(seed) {
    const key = String(seed || "").trim() || `manual-${Date.now()}`;
    return `field-report-v2-${key}`.replace(/[^a-zA-Z0-9_-]+/g, "-");
  }

  function fieldReportWeekday(dateKey) {
    if (!dateKey) return "";
    const date = new Date(`${dateKey}T00:00:00+09:00`);
    if (Number.isNaN(date.getTime())) return "";
    return ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"][date.getDay()];
  }

  function fieldReportDateFromEvent(event) {
    const raw = event?.event_date || event?.date || event?.report_date || event?.start_date || "";
    if (!raw) return "";
    const match = String(raw).match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : "";
  }

  function fieldReportEventName(event) {
    return currentDashEventLabel(event) || event?.event_display_name || event?.display_name || event?.name || "";
  }

  function cloneFieldReport(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function fieldReportDefaultEquipment() {
    return {
      basic: [
        { item: "AUTO-A", owner: "이대로", spot: "START", status: "정상", note: "자동 카메라" },
        { item: "HAND-A", owner: "박찬희", spot: "5K", status: "정상", note: "핸드 촬영" },
        { item: "AUTO-B", owner: "규식", spot: "10K", status: "정상", note: "자동 카메라" },
        { item: "HAND-B", owner: "이인혁", spot: "HALF", status: "정상", note: "핸드 촬영" },
        { item: "본딩 라우터", owner: "이대로", spot: "운영본부", status: "확인 필요", note: "" }
      ],
      extra: [],
      summary: [
        { item: "DSLR-바디", count: 7 },
        { item: "DSLR-렌즈", count: 7 },
        { item: "DSLR-세로", count: 4 },
        { item: "DSLR-배터리", count: 11 },
        { item: "DSLR-스트랩", count: 4 },
        { item: "DSLR-SD", count: 7 },
        { item: "본딩 라우터", count: 1 },
        { item: "보조배터리", count: 5 },
        { item: "CtoC-케이블", count: 4 },
        { item: "DSLR-삼각대", count: 3 },
        { item: "라우터 스탠드", count: 1 }
      ]
    };
  }

  function fieldReportBaseDraft(event) {
    const eventCode = String(event?.event_code || "").trim();
    const reportDate = fieldReportDateFromEvent(event) || "2026-04-05";
    const now = fieldReportNowISO();
    return {
      id: fieldReportId(eventCode || "sample"),
      event_code: eventCode,
      event_name: fieldReportEventName(event) || "2026 영주 소백산 마라톤대회",
      source: eventCode ? "event" : "sample",
      saved_at: "",
      report_json: {
        schema_version: "field_report_v2_test",
        type: FIELD_REPORT_TEST_TYPE,
        meta: {
          event_code: eventCode,
          event_name: fieldReportEventName(event) || "2026 영주 소백산 마라톤대회",
          report_date: reportDate,
          weekday: fieldReportWeekday(reportDate) || "일요일",
          writer: "이대로",
          location: event?.location || event?.place || event?.venue || "영주시민운동장",
          weather: "",
          temperature: "",
          operation_result: "",
          operation_result_reason: "",
          upload_completion_status: "",
          upload_completion_reason: "",
          closing_checks: {
            upload_completed: false,
            equipment_returned: false,
            lost_and_found_checked: false,
            teardown_completed: false
          },
          participant_staff: ["이대로", "박찬희", "이인혁", "규식"],
          created_at: now,
          updated_at: now
        },
        staff: [
          { name: "이대로", role: "매니저", spot: "START", start_time: "", end_time: "" },
          { name: "박찬희", role: "포토그래퍼", spot: "5K", start_time: "", end_time: "" },
          { name: "규식", role: "포토그래퍼", spot: "10K", start_time: "", end_time: "" },
          { name: "이인혁", role: "포토그래퍼", spot: "HALF", start_time: "", end_time: "" }
        ],
        map: { image_url: "", description: "" },
        spots: [
          { location: "START", name: "시민운동장", concept: "준비,피니시", expected_people: "1", camera_count: "2", note: "" },
          { location: "5K", name: "삼거리", concept: "턴", expected_people: "1", camera_count: "2", note: "" },
          { location: "10K", name: "서천교", concept: "턴", expected_people: "1", camera_count: "2", note: "" },
          { location: "HALF", name: "사천교", concept: "주로", expected_people: "1", camera_count: "1", note: "" }
        ],
        equipment: fieldReportDefaultEquipment(),
        operation_logs: [
          { spot: "START", start_time: "", end_time: "", shoot_count: "", memo: "" },
          { spot: "5K", start_time: "", end_time: "", shoot_count: "", memo: "" }
        ],
        payments: { rows: [], total_amount: 0 },
        auto_issues: [],
        issues: [],
        daily_summary: { total_shoot_count: "", actual_count_check: "", actual_shoot_count: "", improvement_note: "", general_comment: "" },
        signatures: {
          writer: { name: "이대로", checked: false, note: "" },
          field_manager: { name: "", checked: false, note: "" },
          office_confirm: { name: "", checked: false, note: "" }
        }
      }
    };
  }

  function buildFieldReportDraftFromEvent(event) {
    const draft = fieldReportBaseDraft(event);
    const meta = draft.report_json.meta;
    meta.event_code = String(event?.event_code || meta.event_code || "").trim();
    meta.event_name = fieldReportEventName(event) || meta.event_name;
    meta.report_date = fieldReportDateFromEvent(event) || meta.report_date;
    meta.weekday = fieldReportWeekday(meta.report_date) || meta.weekday;
    meta.location = event?.location || event?.place || event?.venue || meta.location;
    draft.id = fieldReportId(meta.event_code || meta.event_name);
    draft.event_code = meta.event_code;
    draft.event_name = meta.event_name;
    return draft;
  }

  function readStoredFieldReports() {
    try {
      const parsed = JSON.parse(localStorage.getItem(FIELD_REPORT_STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn("[FieldReport v2] local draft read failed", error);
      return [];
    }
  }

  function writeStoredFieldReports() {
    localStorage.setItem(FIELD_REPORT_STORAGE_KEY, JSON.stringify(fieldReportDrafts));
  }

  function ensureFieldReportDraftForEvent(event) {
    const draft = buildFieldReportDraftFromEvent(event);
    const existingIndex = fieldReportDrafts.findIndex(item => item.id === draft.id || (draft.event_code && item.event_code === draft.event_code));
    if (existingIndex >= 0) {
      const existing = fieldReportDrafts[existingIndex];
      existing.event_code = existing.event_code || draft.event_code;
      existing.event_name = existing.event_name || draft.event_name;
      existing.report_json.meta.event_code = existing.report_json.meta.event_code || draft.report_json.meta.event_code;
      existing.report_json.meta.event_name = existing.report_json.meta.event_name || draft.report_json.meta.event_name;
      existing.report_json.meta.report_date = existing.report_json.meta.report_date || draft.report_json.meta.report_date;
      existing.report_json.meta.location = existing.report_json.meta.location || draft.report_json.meta.location;
      if (!Array.isArray(existing.report_json.meta.participant_staff)) {
        existing.report_json.meta.participant_staff = String(existing.report_json.meta.staff_text || "").split(",").map(name => name.trim()).filter(Boolean);
      }
      if (typeof existing.report_json.meta.operation_result !== "string") existing.report_json.meta.operation_result = "";
      if (typeof existing.report_json.meta.operation_result_reason !== "string") existing.report_json.meta.operation_result_reason = "";
      if (typeof existing.report_json.meta.upload_completion_status !== "string") existing.report_json.meta.upload_completion_status = "";
      if (typeof existing.report_json.meta.upload_completion_reason !== "string") existing.report_json.meta.upload_completion_reason = "";
      if (!existing.report_json.meta.closing_checks || typeof existing.report_json.meta.closing_checks !== "object") {
        existing.report_json.meta.closing_checks = {
          upload_completed: false,
          equipment_returned: false,
          lost_and_found_checked: false,
          teardown_completed: false
        };
      }
      if (!Array.isArray(existing.report_json.auto_issues)) existing.report_json.auto_issues = [];
      return existing;
    }
    fieldReportDrafts.push(draft);
    return draft;
  }

  function syncFieldReportDraftsFromEvents(events) {
    if (!fieldReportDrafts.length) fieldReportDrafts = readStoredFieldReports();
    (events || []).forEach(event => ensureFieldReportDraftForEvent(event));
    if (!fieldReportDrafts.length) fieldReportDrafts.push(fieldReportBaseDraft());
    if (!fieldReportActiveId || !fieldReportDrafts.some(draft => draft.id === fieldReportActiveId)) {
      fieldReportActiveId = fieldReportDrafts[0].id;
    }
  }

  function selectedFieldReportDraft() {
    syncFieldReportDraftsFromEvents(allEvents);
    return fieldReportDrafts.find(draft => draft.id === fieldReportActiveId) || fieldReportDrafts[0] || fieldReportBaseDraft();
  }

  function fieldReportValue(path) {
    const draft = selectedFieldReportDraft();
    return fieldReportValueFrom(draft.report_json, path);
  }

  function fieldReportValueFrom(report, path) {
    return String(path || "").split(".").reduce((acc, key) => acc && acc[key], report || {});
  }

  function setFieldReportValue(path, value) {
    const draft = selectedFieldReportDraft();
    const parts = String(path || "").split(".");
    let target = draft.report_json;
    parts.slice(0, -1).forEach(part => {
      if (target[part] === undefined || target[part] === null) target[part] = {};
      target = target[part];
    });
    target[parts[parts.length - 1]] = value;
    draft.report_json.meta.updated_at = fieldReportNowISO();
    updateFieldReportDerivedValues(draft);
  }

  function updateFieldReportDerivedValues(draft) {
    const report = draft.report_json;
    report.meta.weekday = fieldReportWeekday(report.meta.report_date) || report.meta.weekday;
    if (!Array.isArray(report.meta.participant_staff)) report.meta.participant_staff = [];
    report.payments.total_amount = (report.payments.rows || []).reduce((sum, row) => sum + numberValue(row, ["amount"]), 0);
    const shootTotal = (report.operation_logs || []).reduce((sum, row) => sum + numberValue(row, ["shoot_count"]), 0);
    if (shootTotal && !report.daily_summary.total_shoot_count) report.daily_summary.total_shoot_count = String(shootTotal);
    draft.event_code = report.meta.event_code;
    draft.event_name = report.meta.event_name;
  }

  function fieldReportOptions(values) {
    return values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  }

  function fieldReportField(path, label, type, placeholder, options) {
    const editable = options?.editable !== false;
    const value = options && Object.prototype.hasOwnProperty.call(options, "report") ? fieldReportValueFrom(options.report, path) : fieldReportValue(path);
    return `<label><span>${escapeHtml(label)}</span><input class="ctdash-input fr-input" ${editable ? `data-fr-path="${escapeHtml(path)}"` : "readonly aria-readonly=\"true\""} type="${type || "text"}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder || "")}"></label>`;
  }

  function fieldReportTextarea(path, label, rows, options) {
    const editable = options?.editable !== false;
    const value = options && Object.prototype.hasOwnProperty.call(options, "report") ? fieldReportValueFrom(options.report, path) : fieldReportValue(path);
    const sizeClass = rows === "tall" ? "tall" : rows === "compact" ? "compact" : "";
    return `<label><span>${escapeHtml(label)}</span><textarea class="ctdash-textarea ${sizeClass} fr-input" ${editable ? `data-fr-path="${escapeHtml(path)}"` : "readonly aria-readonly=\"true\""}>${escapeHtml(value)}</textarea></label>`;
  }

  function fieldReportSelect(path, label, values, options) {
    const editable = options?.editable !== false;
    const value = options && Object.prototype.hasOwnProperty.call(options, "report") ? fieldReportValueFrom(options.report, path) : fieldReportValue(path);
    return `<label><span>${escapeHtml(label)}</span><select class="ctdash-select fr-input" ${editable ? `data-fr-path="${escapeHtml(path)}"` : "disabled aria-readonly=\"true\""}><option value="">선택</option>${values.map(item => `<option value="${escapeHtml(item)}" ${String(value) === String(item) ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}<option value="기타" ${value === "기타" ? "selected" : ""}>기타</option></select></label>`;
  }

  function fieldReportStrictSelect(path, label, options, renderOptions) {
    const editable = renderOptions?.editable !== false;
    const value = renderOptions && Object.prototype.hasOwnProperty.call(renderOptions, "report") ? fieldReportValueFrom(renderOptions.report, path) : fieldReportValue(path);
    return `<label><span>${escapeHtml(label)}</span><select class="ctdash-select fr-input" ${editable ? `data-fr-path="${escapeHtml(path)}"` : "disabled aria-readonly=\"true\""}><option value="">선택</option>${options.map(option => `<option value="${escapeHtml(option.value)}" ${String(value) === String(option.value) ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></label>`;
  }

  function fieldReportReadOnlyField(label, value, type) {
    return `<label><span>${escapeHtml(label)}</span><input class="ctdash-input fr-readonly-input" type="${escapeHtml(type || "text")}" value="${escapeHtml(value || "")}" readonly></label>`;
  }

  function fieldReportAutoTable(title, rows, columns, options) {
    const headers = columns.map(col => `<th>${escapeHtml(col.label)}</th>`).join("");
    const body = (rows || []).length ? rows.map(row => `<tr>${columns.map(col => `<td class="fr-auto-cell">${escapeHtml(row[col.key] || "—")}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${columns.length}" class="ctdash-empty">자동 반영할 데이터가 없습니다.</td></tr>`;
    return `
      <article class="ctdash-card ctdash-section fr-section">
        <div class="ctdash-section-head"><div><div class="ctdash-kicker">${escapeHtml(options?.kicker || "Notion")}</div><h3>${escapeHtml(title)}</h3></div><span class="ctdash-tag">자동 반영</span></div>
        <div class="ctdash-table-wrap"><table class="ctdash-table fr-table"><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table></div>
      </article>`;
  }

  function fieldReportEquipmentSummaryLabel(item) {
    const raw = String(item || "").trim();
    const rules = [
      [/^라우터\b/, "라우터"], [/^메모리\s*카드\b|^메모리카드\b/, "메모리카드"], [/^(카메라\s*)?바디\b/, "카메라 바디"],
      [/^렌즈\b/, "렌즈"], [/^카메라\s*배터리\b/, "카메라 배터리"], [/^보조\s*배터리\b/, "보조배터리"],
      [/^잡화\s*가방\b/, "잡화가방"], [/^쿨러\b/, "쿨러"], [/^삼각대\b/, "삼각대"], [/^스트랩\b/, "스트랩"],
      [/^(?:c\s*to\s*c|ctoc).*케이블\b/i, "C to C 케이블"]
    ];
    const match = rules.find(([pattern]) => pattern.test(raw));
    return match ? match[1] : (raw.replace(/\s+[A-D](?=\s|$)/g, "").replace(/\s+/g, " ") || "품목 미정");
  }

  function fieldReportEquipmentSummaryTotals(rows) {
    const totals = new Map();
    (rows || []).forEach(row => {
      const item = fieldReportEquipmentSummaryLabel(row?.item_name);
      const parsed = Number(String(row?.count ?? "").replace(/[^\d.-]/g, ""));
      const count = Number.isFinite(parsed) ? parsed : 0;
      totals.set(item, (totals.get(item) || 0) + count);
    });
    return [...totals.entries()].map(([item_name, count]) => ({ item_name, count }));
  }

  function fieldReportEquipmentTotalTable(title, rows, options) {
    const totalRows = fieldReportEquipmentSummaryTotals(rows);
    const pairs = [];
    for (let index = 0; index < totalRows.length; index += 2) pairs.push([totalRows[index], totalRows[index + 1]]);
    const body = pairs.length ? pairs.map(([left, right]) => `<tr>
      <td class="fr-auto-cell">${escapeHtml(left?.item_name || "—")}</td><td class="fr-auto-cell fr-count-cell">${escapeHtml(left?.count || "—")}</td>
      <td class="fr-auto-cell">${escapeHtml(right?.item_name || "")}</td><td class="fr-auto-cell fr-count-cell">${escapeHtml(right?.count || "")}</td>
    </tr>`).join("") : `<tr><td colspan="4" class="ctdash-empty">자동 반영할 데이터가 없습니다.</td></tr>`;
    return `
      <article class="ctdash-card ctdash-section fr-section">
        <div class="ctdash-section-head"><div><div class="ctdash-kicker">${escapeHtml(options?.kicker || "Notion")}</div><h3>${escapeHtml(title)}</h3></div><span class="ctdash-tag">자동 반영</span></div>
        <div class="ctdash-table-wrap fr-compact-table-wrap"><table class="ctdash-table fr-table fr-equipment-total"><thead><tr><th>품목</th><th>개수</th><th>품목</th><th>개수</th></tr></thead><tbody>${body}</tbody></table></div>
      </article>`;
  }

  function fieldReportBasicEquipmentGroups(title, rows, options) {
    const groups = new Map();
    (rows || []).forEach(row => {
      const owner = String(row?.owner_name || "담당자 미정").trim() || "담당자 미정";
      const spot = String(row?.spot_name || "배치 스팟 미정").trim() || "배치 스팟 미정";
      const key = `${owner}\u0000${spot}`;
      if (!groups.has(key)) groups.set(key, { owner, spot, items:[], statuses:[] });
      const group = groups.get(key);
      group.items.push(String(row?.item_name || "장비명 미정").trim() || "장비명 미정");
      const status = String(row?.status || "").trim();
      if (status && !group.statuses.includes(status)) group.statuses.push(status);
    });
    const body = groups.size ? [...groups.values()].map(group => {
      const statusLabel = group.statuses.length ? group.statuses.join(" · ") : "상태 미정";
      return `<article class="fr-equipment-group">
        <div class="fr-equipment-assignment"><span class="fr-equipment-owner">${escapeHtml(group.owner)}</span><span class="fr-equipment-spot" title="${escapeHtml(group.spot)}">${escapeHtml(group.spot)}</span><span class="fr-equipment-status">${escapeHtml(statusLabel)}</span></div>
        <div class="fr-equipment-items">${group.items.map(item => `<span class="fr-equipment-item">${escapeHtml(item)}</span>`).join("")}</div>
      </article>`;
    }).join("") : `<div class="ctdash-empty">자동 반영할 데이터가 없습니다.</div>`;
    return `<article class="ctdash-card ctdash-section fr-section fr-basic-equipment">
      <div class="ctdash-section-head"><div><div class="ctdash-kicker">${escapeHtml(options?.kicker || "Notion")}</div><h3>${escapeHtml(title)}</h3></div><span class="ctdash-tag">자동 반영</span></div>
      <div class="fr-equipment-groups">${body}</div>
    </article>`;
  }

  function fieldReportIssueSection(autoIssues, manualIssues, staffOptions, options) {
    const editable = options?.editable !== false;
    const issueTypes = editable ? ["운영", "장비", "고객", "안전", "기타"] : ["운영", "장비", "고객", "안전", "기타", "operation", "equipment", "customer", "safety", "other"];
    const issueStatuses = editable ? ["접수", "처리 중", "완료", "보류"] : ["접수", "처리 중", "완료", "보류", "received", "in_progress", "resolved", "on_hold"];
    const autoColumns = [
      { key:"occurred_at", label:"시간" }, { key:"category", label:"유형" }, { key:"description", label:"내용" }, { key:"status", label:"처리 상태" }, { key:"owner_name", label:"담당자" }
    ];
    const autoBody = (autoIssues || []).length ? autoIssues.map(row => `<tr>${autoColumns.map(column => `<td class="fr-auto-cell" data-label="${escapeHtml(column.label)}">${escapeHtml(row[column.key] || "—")}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="5" class="ctdash-empty">자동 반영할 데이터가 없습니다.</td></tr>`;
    const manualColumns = [
      { key:"time", label:"시간", type:"time" }, { key:"type", label:"유형", type:"select", options:issueTypes },
      { key:"description", label:"내용" }, { key:"status", label:"처리 상태", type:"select", options:issueStatuses }, { key:"owner", label:"담당자", type:"select", options:staffOptions }
    ];
    const manualBody = (manualIssues || []).length ? manualIssues.map((row, index) => {
      const cells = manualColumns.map(column => {
        const path = `issues.${index}.${column.key}`;
        if (column.type === "select") return `<td data-label="${escapeHtml(column.label)}"><select class="ctdash-select fr-table-input" ${editable ? `data-fr-path="${escapeHtml(path)}"` : "disabled"}><option value="">선택</option>${column.options.map(value => `<option value="${escapeHtml(value)}" ${String(row[column.key] || "") === String(value) ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}</select></td>`;
        return `<td data-label="${escapeHtml(column.label)}"><input class="ctdash-input fr-table-input" ${editable ? `data-fr-path="${escapeHtml(path)}"` : "readonly"} type="${column.type || "text"}" value="${escapeHtml(row[column.key] || "")}"></td>`;
      }).join("");
      return `<tr>${cells}${editable ? `<td data-label="관리"><button class="sh-btn-sm" type="button" data-fr-delete="issues" data-fr-index="${index}">삭제</button></td>` : ""}</tr>`;
    }).join("") : `<tr><td colspan="${manualColumns.length + (editable ? 1 : 0)}" class="ctdash-empty">추가 기록이 없습니다.</td></tr>`;
    return `<article class="ctdash-card ctdash-section fr-section">
      <div class="ctdash-section-head"><div><div class="ctdash-kicker">Photographer Report</div><h3>6. 이슈 및 돌발 상황</h3></div><span class="ctdash-tag">자동 반영</span></div>
      <div class="ctdash-table-wrap fr-compact-table-wrap"><table class="ctdash-table fr-table fr-issue-auto-table"><thead><tr>${autoColumns.map(column => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead><tbody>${autoBody}</tbody></table></div>
      <div class="fr-section-divider"></div>
      <div class="ctdash-section-head fr-subsection-head"><div><div class="ctdash-kicker">Admin</div><h4>관리자 추가 기록</h4></div>${editable ? `<button class="sh-btn-sm" type="button" data-fr-add="issues">이슈 추가</button>` : ""}</div>
      <div class="ctdash-table-wrap fr-compact-table-wrap"><table class="ctdash-table fr-table fr-issue-manual-table"><thead><tr>${manualColumns.map(column => `<th>${escapeHtml(column.label)}</th>`).join("")}${editable ? "<th>관리</th>" : ""}</tr></thead><tbody>${manualBody}</tbody></table></div>
    </article>`;
  }

  function fieldReportTable(title, collectionPath, columns, options) {
    const editable = options?.editable !== false;
    const rows = options && Object.prototype.hasOwnProperty.call(options, "report") ? fieldReportValueFrom(options.report, collectionPath) || [] : fieldReportValue(collectionPath) || [];
    const headers = columns.map(col => `<th>${escapeHtml(col.label)}</th>`).join("") + (editable ? "<th>관리</th>" : "");
    const body = rows.length ? rows.map((row, index) => {
      const cells = columns.map(col => {
        const path = `${collectionPath}.${index}.${col.key}`;
        if (col.type === "select") return `<td><select class="ctdash-select fr-table-input" ${editable ? `data-fr-path="${escapeHtml(path)}"` : "disabled"}><option value="">선택</option>${(col.options || []).map(item => `<option value="${escapeHtml(item)}" ${String(row[col.key] || "") === String(item) ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}<option value="기타" ${row[col.key] === "기타" ? "selected" : ""}>기타</option></select></td>`;
        return `<td><input class="ctdash-input fr-table-input" ${editable ? `data-fr-path="${escapeHtml(path)}"` : "readonly"} type="${col.type || "text"}" value="${escapeHtml(row[col.key] || "")}"></td>`;
      }).join("");
      return `<tr>${cells}${editable ? `<td><button class="sh-btn-sm" type="button" data-fr-delete="${escapeHtml(collectionPath)}" data-fr-index="${index}">삭제</button></td>` : ""}</tr>`;
    }).join("") : `<tr><td colspan="${columns.length + (editable ? 1 : 0)}">데이터 없음</td></tr>`;
    return `
      <article class="ctdash-card ctdash-section fr-section">
        <div class="ctdash-section-head"><div><div class="ctdash-kicker">${escapeHtml(options?.kicker || "Field Report")}</div><h3>${escapeHtml(title)}</h3></div>${editable ? `<button class="sh-btn-sm" type="button" data-fr-add="${escapeHtml(collectionPath)}">행 추가</button>` : ""}</div>
        <div class="ctdash-table-wrap"><table class="ctdash-table fr-table"><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table></div>
      </article>`;
  }

  function fieldReportBlankRow(collectionPath) {
    const map = {
      staff: { name: "", role: "", spot: "", start_time: "", end_time: "" },
      spots: { location: "", name: "", concept: "", expected_people: "", camera_count: "", note: "" },
      "equipment.basic": { item: "", owner: "", spot: "", status: "", note: "" },
      "equipment.extra": { item: "", owner: "", spot: "", status: "", note: "" },
      "equipment.summary": { item: "", count: "" },
      operation_logs: { spot: "", start_time: "", end_time: "", shoot_count: "", memo: "" },
      "payments.rows": { payer: "", method: "", amount: "", note: "" },
      issues: { time: "", type: "", description: "", status: "", owner: "" }
    };
    return cloneFieldReport(map[collectionPath] || {});
  }

  function addFieldReportRow(collectionPath) {
    const rows = fieldReportValue(collectionPath);
    if (Array.isArray(rows)) rows.push(fieldReportBlankRow(collectionPath));
    updateFieldReportDerivedValues(selectedFieldReportDraft());
    renderCurrentTestDashboard();
  }

  function deleteFieldReportRow(collectionPath, index) {
    const rows = fieldReportValue(collectionPath);
    if (Array.isArray(rows)) rows.splice(Number(index), 1);
    updateFieldReportDerivedValues(selectedFieldReportDraft());
    renderCurrentTestDashboard();
  }

  function saveFieldReportTest() {
    updateFieldReportDerivedValues(selectedFieldReportDraft());
    selectedFieldReportDraft().saved_at = fieldReportNowISO();
    writeStoredFieldReports();
    renderCurrentTestDashboard();
  }

  function fieldReportUuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, char => {
      const value = Math.floor(Math.random() * 16);
      return (char === "x" ? value : (value & 0x3) | 0x8).toString(16);
    });
  }

  function fieldReportNullableText(value) {
    const text = String(value || "").trim();
    return text || null;
  }

  function fieldReportInteger(value) {
    const parsed = Number.parseInt(String(value || "").replace(/[^\d-]/g, ""), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function fieldReportEnum(value, map) {
    return map[String(value || "").trim()] || "";
  }

  function fieldReportCurrentVersion(draft) {
    const event = (allEvents || []).find(row => String(row?.event_code || "") === String(draft?.event_code || ""));
    let version = Number(draft?.server_version || 0);
    const history = Array.isArray(event?.work_report_json) ? event.work_report_json : [];
    history.forEach(raw => {
      try {
        const record = JSON.parse(raw);
        if (Number.isInteger(record?.version)) version = Math.max(version, record.version);
      } catch (error) {
        // 서버가 손상된 이력을 보호하며 저장을 중단하므로, 화면에서는 무시하지 않고 서버 응답을 보여줍니다.
      }
    });
    return version;
  }

  function fieldReportSubmitPayload(draft, requestId) {
    const report = draft.report_json;
    const meta = report.meta || {};
    const closing = meta.closing_checks || {};
    const operationResult = fieldReportEnum(meta.operation_result, { normal:"normal", partial:"partial", stopped:"stopped" });
    const uploadStatus = fieldReportEnum(meta.upload_completion_status, { complete:"complete", partial:"partial", not_uploaded:"not_uploaded" });
    const countCheck = fieldReportEnum(report.daily_summary?.actual_count_check, { matched:"matched", review:"review_required", review_required:"review_required", mismatch:"mismatch" });
    const temperature = fieldReportInteger(meta.temperature);
    const actualCount = fieldReportInteger(report.daily_summary?.actual_shoot_count);
    const extraStatus = { "정상":"normal", "확인 필요":"needs_review", "분실":"lost", "수리 필요":"needs_repair", normal:"normal", needs_review:"needs_review", lost:"lost", needs_repair:"needs_repair" };
    const issueCategory = { "운영":"operation", "장비":"equipment", "고객":"customer", "안전":"safety", "기타":"other", operation:"operation", equipment:"equipment", customer:"customer", safety:"safety", other:"other" };
    const issueStatus = { "접수":"received", "처리 중":"in_progress", "완료":"resolved", "보류":"on_hold", received:"received", in_progress:"in_progress", resolved:"resolved", on_hold:"on_hold" };
    const required = [];
    if (!String(draft.event_code || meta.event_code || "").trim()) required.push("대회 코드");
    if (!String(meta.writer || "").trim()) required.push("작성자");
    if (!fieldReportEnum(meta.weather, { "맑음":"sunny", "흐림":"cloudy", "비":"rain", "눈":"snow", sunny:"sunny", cloudy:"cloudy", rain:"rain", snow:"snow" })) required.push("날씨");
    if (temperature === null || temperature < -10 || temperature > 45) required.push("기온(-10~45)");
    if (!operationResult) required.push("운영 결과");
    if (["partial", "stopped"].includes(operationResult) && !fieldReportNullableText(meta.operation_result_reason)) required.push("운영 결과 사유");
    if (!uploadStatus) required.push("업로드 완료 여부");
    if (["partial", "not_uploaded"].includes(uploadStatus) && !fieldReportNullableText(meta.upload_completion_reason)) required.push("업로드 사유");
    if (uploadStatus === "complete" && !closing.upload_completed) required.push("현장 마감 체크의 업로드 완료");
    if (uploadStatus && uploadStatus !== "complete" && closing.upload_completed) required.push("업로드 완료 여부와 현장 마감 체크 일치");
    if (!countCheck) required.push("실제 개수 검증");
    if (countCheck === "mismatch" && (actualCount === null || actualCount < 0)) required.push("실제 촬영 건수");
    if (!String(report.signatures?.writer?.name || meta.writer || "").trim()) required.push("확인 서명 작성자");
    if (required.length) throw new Error(`필수 입력을 확인해 주세요: ${required.join(", ")}`);

    return {
      schema_version: "1.2",
      request_id: requestId || draft.pending_request_id || fieldReportUuid(),
      base_version: fieldReportCurrentVersion(draft),
      report_type: "event_field_report",
      event_code: String(draft.event_code || meta.event_code).trim(),
      admin_input: {
        basic_info: {
          writer_name: String(meta.writer).trim(),
          weather: fieldReportEnum(meta.weather, { "맑음":"sunny", "흐림":"cloudy", "비":"rain", "눈":"snow", sunny:"sunny", cloudy:"cloudy", rain:"rain", snow:"snow" }),
          temperature_c: temperature,
          participant_staff: [...new Set((meta.participant_staff || []).map(name => String(name || "").trim()).filter(Boolean))],
          operation_result: operationResult,
          operation_result_reason: operationResult === "normal" ? null : fieldReportNullableText(meta.operation_result_reason),
          upload_completion_status: uploadStatus,
          upload_completion_reason: uploadStatus === "complete" ? null : fieldReportNullableText(meta.upload_completion_reason),
          closing_checks: {
            upload_completed: Boolean(closing.upload_completed),
            equipment_returned: Boolean(closing.equipment_returned),
            lost_items_checked: Boolean(closing.lost_and_found_checked),
            withdrawal_completed: Boolean(closing.teardown_completed)
          }
        },
        additional_equipment: (report.equipment?.extra || []).map(row => ({
          item_name: String(row.item || "").trim(), owner_name: String(row.owner || "").trim(),
          spot_name: fieldReportNullableText(row.spot), status: fieldReportEnum(row.status, extraStatus), note: fieldReportNullableText(row.note)
        })),
        admin_issues: (report.issues || []).map(row => ({
          occurred_at: String(row.time || "").trim(), category: fieldReportEnum(row.type, issueCategory),
          description: String(row.description || "").trim(), status: fieldReportEnum(row.status, issueStatus), owner_name: String(row.owner || "").trim()
        })),
        daily_summary: {
          actual_count_check: countCheck,
          actual_photo_count: countCheck === "mismatch" ? actualCount : null,
          improvement_note: fieldReportNullableText(report.daily_summary?.improvement_note),
          general_comment: fieldReportNullableText(report.daily_summary?.general_comment)
        },
        signatures: {
          writer: { name: String(report.signatures?.writer?.name || meta.writer).trim(), note: fieldReportNullableText(report.signatures?.writer?.note) },
          field_manager: { name: fieldReportNullableText(report.signatures?.field_manager?.name), note: fieldReportNullableText(report.signatures?.field_manager?.note) },
          office_confirm: { name: fieldReportNullableText(report.signatures?.office_confirm?.name), note: fieldReportNullableText(report.signatures?.office_confirm?.note) }
        }
      }
    };
  }

  function resetFieldReportTestDraft() {
    const current = selectedFieldReportDraft();
    const event = allEvents.find(row => row.event_code === current.event_code) || {};
    const next = buildFieldReportDraftFromEvent(event);
    const index = fieldReportDrafts.findIndex(row => row.id === current.id);
    if (index >= 0) fieldReportDrafts[index] = next;
    fieldReportActiveId = next.id;
    renderCurrentTestDashboard();
  }

  async function realSaveFieldReportTest() {
    const draft = selectedFieldReportDraft();
    draft.pending_request_id = draft.pending_request_id || fieldReportUuid();
    writeStoredFieldReports();
    const payload = fieldReportSubmitPayload(draft, draft.pending_request_id);
    let response;
    try {
      response = await fetch(FIELD_REPORT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      throw new Error("네트워크 응답을 확인하지 못했습니다. 같은 저장 버튼을 다시 누르면 안전하게 재시도합니다.");
    }
    const raw = await response.text();
    let result = {};
    try { result = raw ? JSON.parse(raw) : {}; } catch (error) { result = {}; }
    if (!response.ok || !result.ok) {
      const apiError = result?.error || {};
      const detail = apiError.message || `저장 요청이 실패했습니다. (${response.status})`;
      const code = apiError.code ? ` [${apiError.code}]` : "";
      draft.pending_request_id = "";
      writeStoredFieldReports();
      throw new Error(`${detail}${code}`);
    }
    const saved = result.data || {};
    draft.server_version = Number(saved.version || payload.base_version);
    draft.saved_at = saved.created_at || fieldReportNowISO();
    draft.pending_request_id = "";
    writeStoredFieldReports();
    return saved;
  }

  function fieldReportSourceState(eventCode) {
    return fieldReportSourcesByEventCode[String(eventCode || "")] || { state: "idle", data: null, message: "" };
  }

  function fieldReportSourceStatusLabel(source) {
    if (source.state === "loading") return "Notion 데이터를 불러오는 중입니다.";
    if (source.state === "loaded") {
      const photoState = source.data?.photographer_source?.state || "empty";
      if (photoState === "loaded") return "Notion Event 및 포토그래퍼 일지가 자동 반영되었습니다.";
      if (photoState === "empty") return "Notion Event를 반영했습니다. 포토그래퍼 일지는 아직 없습니다.";
      if (photoState === "failed" || photoState === "stale") return "Notion Event를 반영했습니다. 포토그래퍼 일지는 현재 읽지 못했지만 수동 작성과 저장은 가능합니다.";
      return "Notion Event를 자동 반영했습니다.";
    }
    if (source.state === "error") return source.message || "Notion 데이터를 읽지 못했습니다. 수동 작성과 저장은 가능합니다.";
    return "대회를 선택하면 확정된 Notion Event와 현재 포토그래퍼 일지를 자동 반영합니다.";
  }

  async function loadFieldReportSourcesForActiveDraft() {
    const draft = selectedFieldReportDraft();
    const eventCode = String(draft?.event_code || "").trim();
    if (!eventCode) return;
    const accessToken = sessionStorage.getItem("shout_access_token") || "";
    const sequence = ++fieldReportSourceRequestSequence;
    fieldReportSourcesByEventCode[eventCode] = { state: "loading", data: null, message: "" };
    if (currentDashView === "diary") renderCurrentTestDashboard();
    try {
      const url = `${FIELD_REPORT_SOURCES_API_URL}?${new URLSearchParams({ event_code: eventCode }).toString()}`;
      const response = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        const apiError = result?.error || {};
        throw new Error(`${apiError.message || "Notion source API 요청이 실패했습니다."}${apiError.code ? ` [${apiError.code}]` : ""}`);
      }
      if (sequence !== fieldReportSourceRequestSequence) return;
      fieldReportSourcesByEventCode[eventCode] = { state: "loaded", data: result.data || {}, message: "" };
    } catch (error) {
      if (sequence !== fieldReportSourceRequestSequence) return;
      fieldReportSourcesByEventCode[eventCode] = {
        state: "error",
        data: null,
        message: error?.message || "Notion 데이터를 읽지 못했습니다. 수동 작성과 저장은 가능합니다."
      };
    }
    if (currentDashView === "diary") renderCurrentTestDashboard();
  }

  function fieldReportHistoryEventLabel(event) {
    const date = fieldReportDateFromEvent(event) || "날짜 미정";
    const name = fieldReportEventName(event) || event?.event_name || "대회명 미정";
    const code = String(event?.event_code || "").trim();
    return `${date} · ${name}${code ? ` · ${code}` : ""}`;
  }

  function fieldReportHistoryDisplayVersion(version) {
    return `v1.${Math.max(Number(version || 1) - 1, 0)}`;
  }

  function fieldReportHistoryDateTime(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "저장 시각 미정";
    return new Intl.DateTimeFormat("ko-KR", { timeZone:"Asia/Seoul", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hour12:false }).format(date).replace(/\. /g, "-").replace(/\.$/, "");
  }

  function fieldReportHistoryState(eventCode) {
    return fieldReportHistoryByEventCode[String(eventCode || "")] || { state:"idle", records:[], message:"" };
  }

  function normalizeFieldReportHistoryRecords(records) {
    const valid = [];
    const corrupted = [];
    (Array.isArray(records) ? records : []).forEach(record => {
      if (!record || !Number.isInteger(Number(record.version)) || Number(record.version) < 1 || !record.admin_input) {
        corrupted.push(record);
        return;
      }
      valid.push(record);
    });
    valid.sort((a, b) => Number(b.version) - Number(a.version));
    return { valid, corrupted };
  }

  async function loadFieldReportHistory(eventCode) {
    const code = String(eventCode || "").trim();
    if (!code) return;
    const sequence = ++fieldReportHistoryRequestSequence;
    if (fieldReportHistoryAbortController) fieldReportHistoryAbortController.abort();
    fieldReportHistoryAbortController = new AbortController();
    fieldReportHistoryByEventCode[code] = { state:"loading", records:[], corrupted:[], message:"" };
    showSotLoader(SOT_LOADER_DEFAULT_MESSAGE);
    renderCurrentTestDashboard();
    try {
      const accessToken = sessionStorage.getItem("shout_access_token") || "";
      const response = await fetch(`${FIELD_REPORT_API_URL}?event_code=${encodeURIComponent(code)}`, {
        headers: accessToken ? { Authorization:`Bearer ${accessToken}` } : {}, signal:fieldReportHistoryAbortController.signal
      });
      const raw = await response.text();
      let result = {};
      try { result = raw ? JSON.parse(raw) : {}; } catch (error) { result = {}; }
      if (!response.ok || !result.ok) throw new Error(result?.error?.message || "일지 조회에 실패했습니다.");
      if (sequence !== fieldReportHistoryRequestSequence || fieldReportHistoryEventCode !== code) return;
      const parsed = normalizeFieldReportHistoryRecords(result?.data?.records);
      fieldReportHistoryByEventCode[code] = { state:"loaded", records:parsed.valid, corrupted:parsed.corrupted, message:"" };
      fieldReportHistoryVersion = parsed.valid[0]?.version || null;
    } catch (error) {
      if (error?.name === "AbortError" || sequence !== fieldReportHistoryRequestSequence || fieldReportHistoryEventCode !== code) return;
      fieldReportHistoryByEventCode[code] = { state:"error", records:[], corrupted:[], message:error?.message || "일지 조회에 실패했습니다." };
      fieldReportHistoryVersion = null;
    } finally {
      hideSotLoader();
      if (sequence === fieldReportHistoryRequestSequence && fieldReportHistoryEventCode === code) renderCurrentTestDashboard();
    }
  }

  function fieldReportHistoryViewModel(record, event) {
    const input = record?.admin_input || {};
    const basic = input.basic_info || {};
    const daily = input.daily_summary || {};
    const signature = input.signatures || {};
    const snapshot = record?.resolved_sections_snapshot || {};
    const header = snapshot.event_header || {};
    const eventDate = header.event_date || fieldReportDateFromEvent(event) || "";
    const operationLabels = { normal:"정상 운영", partial:"부분 운영", stopped:"운영 중단" };
    const uploadLabels = { complete:"완료", partial:"일부 완료", not_uploaded:"미업로드" };
    const weatherLabels = { sunny:"맑음", cloudy:"흐림", rain:"비", snow:"눈" };
    const report = {
      meta: {
        event_code:record.event_code || event?.event_code || "", event_name:header.event_name || fieldReportEventName(event) || "",
        report_date:eventDate, weekday:fieldReportWeekday(eventDate), writer:basic.writer_name || record?.created_by?.admin_name || "",
        location:header.location || event?.location || event?.place || event?.venue || "", weather:weatherLabels[basic.weather] || basic.weather || "",
        temperature:basic.temperature_c === null || basic.temperature_c === undefined ? "" : `${basic.temperature_c}℃`,
        operation_result:operationLabels[basic.operation_result] || basic.operation_result || "", operation_result_reason:basic.operation_result_reason || "",
        upload_completion_status:uploadLabels[basic.upload_completion_status] || basic.upload_completion_status || "", upload_completion_reason:basic.upload_completion_reason || "",
        participant_staff:Array.isArray(basic.participant_staff) ? basic.participant_staff : [],
        closing_checks:{ upload_completed:Boolean(basic.closing_checks?.upload_completed), equipment_returned:Boolean(basic.closing_checks?.equipment_returned), lost_and_found_checked:Boolean(basic.closing_checks?.lost_items_checked), teardown_completed:Boolean(basic.closing_checks?.withdrawal_completed) }
      },
      equipment:{ extra:(input.additional_equipment || []).map(row => ({ item:row.item_name || "", owner:row.owner_name || "", spot:row.spot_name || "", status:row.status || "", note:row.note || "" })) },
      issues:(input.admin_issues || []).map(row => ({ time:row.occurred_at || "", type:row.category || "", description:row.description || "", status:row.status || "", owner:row.owner_name || "" })),
      daily_summary:{ actual_count_check:daily.actual_count_check === "review_required" ? "review" : daily.actual_count_check || "", actual_shoot_count:daily.actual_photo_count ?? "", improvement_note:daily.improvement_note || "", general_comment:daily.general_comment || "" },
      signatures:{ writer:signature.writer || {}, field_manager:signature.field_manager || {}, office_confirm:signature.office_confirm || {} }
    };
    return { report, resolvedSections:snapshot };
  }

  function renderWorkReport({ report, resolvedSections, editable }) {
    const autoRows = key => resolvedSections?.[key] || [];
    const participantStaff = Array.isArray(report.meta.participant_staff) ? report.meta.participant_staff : [];
    const checkValue = report.daily_summary.actual_count_check || "";
    const closingChecks = report.meta.closing_checks || {};
    const staffOptions = [...new Set(participantStaff.concat(autoRows("staff_assignments").map(row => row.name).filter(Boolean)))];
    const renderOptions = { report, editable };
    const readSelect = (label, value) => `<label><span>${escapeHtml(label)}</span><input class="ctdash-input fr-readonly-input" value="${escapeHtml(value || "")}" readonly></label>`;
    return `<div class="fr-history-readonly">
      <article class="ctdash-card ctdash-section fr-section"><div class="ctdash-section-head"><div><div class="ctdash-kicker">1</div><h3>기본 정보</h3></div><span class="ctdash-tag">${escapeHtml(report.meta.weekday || "요일 미정")}</span></div>
        <div class="ctdash-form-grid">${fieldReportReadOnlyField("대회명", report.meta.event_name)}${fieldReportReadOnlyField("대회 코드", report.meta.event_code)}${fieldReportReadOnlyField("날짜", report.meta.report_date, "date")}${fieldReportField("meta.writer", "작성자", "text", "", renderOptions)}${fieldReportReadOnlyField("장소", report.meta.location)}${readSelect("날씨", report.meta.weather)}${readSelect("기온", report.meta.temperature)}${readSelect("운영 결과", report.meta.operation_result)}${report.meta.operation_result_reason ? fieldReportField("meta.operation_result_reason", "운영 결과 사유", "text", "", renderOptions) : ""}${readSelect("업로드 완료 여부", report.meta.upload_completion_status)}${report.meta.upload_completion_reason ? fieldReportField("meta.upload_completion_reason", "업로드 사유", "text", "", renderOptions) : ""}</div>
        <div class="fr-participant-field"><span>참여 스탭</span><div class="fr-staff-picker"><div class="fr-staff-chips">${participantStaff.length ? participantStaff.map(name => `<span class="fr-staff-chip">${escapeHtml(name)}</span>`).join("") : `<span class="ctdash-empty">선택된 스탭이 없습니다.</span>`}</div></div></div>
        <div class="fr-closing-checks"><span>현장 마감 체크</span><div class="fr-check-grid"><label><input type="checkbox" disabled ${closingChecks.upload_completed ? "checked" : ""}><span>업로드 완료</span></label><label><input type="checkbox" disabled ${closingChecks.equipment_returned ? "checked" : ""}><span>장비 반납 완료</span></label><label><input type="checkbox" disabled ${closingChecks.lost_and_found_checked ? "checked" : ""}><span>분실물 확인</span></label><label><input type="checkbox" disabled ${closingChecks.teardown_completed ? "checked" : ""}><span>철수 완료</span></label></div></div></article>
      ${fieldReportAutoTable("2. 투입 인원", autoRows("staff_assignments"), [{key:"name",label:"이름"},{key:"role",label:"역할"},{key:"spot_name",label:"배치 스팟"},{key:"start_time",label:"출근"},{key:"end_time",label:"퇴근"}], {kicker:"Photographer Report"})}
      ${fieldReportAutoTable("3. 촬영 스팟", autoRows("shooting_spots"), [{key:"location",label:"위치"},{key:"spot_name",label:"명칭"},{key:"concept",label:"촬영 컨셉"},{key:"expected_people",label:"예상 인원"},{key:"camera_count",label:"카메라 수"},{key:"note",label:"비고"}], {kicker:"Photographer Report"})}
      <div class="fr-two-col">${fieldReportBasicEquipmentGroups("4-1. 기본 장비", autoRows("basic_equipment"), {kicker:"Photographer Report"})}${fieldReportEquipmentTotalTable("4-2. 장비 합계", autoRows("equipment_summary"), {kicker:"Photographer Report"})}</div>
      ${fieldReportTable("4-3. 추가 장비", "equipment.extra", [{key:"item",label:"장비명"},{key:"owner",label:"담당자",type:"select",options:staffOptions},{key:"spot",label:"배치 스팟"},{key:"status",label:"상태",type:"select",options:["정상","확인 필요","분실","수리 필요","normal","needs_review","lost","needs_repair"]},{key:"note",label:"비고"}], {kicker:"Extra", report, editable:false})}
      ${fieldReportAutoTable("5. 스팟별 운영 시간 일지", autoRows("spot_operations"), [{key:"spot_name",label:"스팟"},{key:"start_time",label:"시작"},{key:"end_time",label:"종료"},{key:"shoot_count",label:"촬영 건수"},{key:"memo",label:"메모"}], {kicker:"Photographer Report"})}
      ${fieldReportIssueSection(autoRows("automatic_issues"), report.issues || [], staffOptions, { editable:false })}
      <article class="ctdash-card ctdash-section fr-section"><div class="ctdash-section-head"><div><div class="ctdash-kicker">7</div><h3>데일리 서머리</h3></div><span class="ctdash-tag">저장 내용</span></div><div class="ctdash-form-grid">${fieldReportReadOnlyField("총 촬영 건수", resolvedSections?.total_photo_count, "number")}${readSelect("실제 개수 검증", {matched:"일치",review:"확인 필요",mismatch:"불일치"}[checkValue] || checkValue)}${checkValue === "mismatch" ? fieldReportField("daily_summary.actual_shoot_count", "실제 촬영 건수", "number", "", renderOptions) : ""}${fieldReportTextarea("daily_summary.improvement_note", "개선 사항", "compact", renderOptions)}${fieldReportTextarea("daily_summary.general_comment", "종합 메모", "compact", renderOptions)}</div></article>
      <article class="ctdash-card ctdash-section fr-section"><div class="ctdash-section-head"><div><div class="ctdash-kicker">8</div><h3>확인 서명</h3></div><span class="ctdash-tag">저장 내용</span></div><div class="ctdash-form-grid three">${fieldReportField("signatures.writer.name", "작성자", "text", "", renderOptions)}${fieldReportField("signatures.field_manager.name", "현장 책임자", "text", "", renderOptions)}${fieldReportField("signatures.office_confirm.name", "사무실 확인", "text", "", renderOptions)}</div><div class="ctdash-form-grid three">${fieldReportTextarea("signatures.writer.note", "작성자 메모", "", renderOptions)}${fieldReportTextarea("signatures.field_manager.note", "현장 책임자 메모", "", renderOptions)}${fieldReportTextarea("signatures.office_confirm.note", "사무실 확인 메모", "", renderOptions)}</div></article>
    </div>`;
  }

  function renderCurrentDashDiaryReadView() {
    const state = fieldReportHistoryState(fieldReportHistoryEventCode);
    const events = (allEvents || []).filter(event => {
      const eventCode = String(event?.event_code || "").trim();
      const history = Array.isArray(event?.work_report_json) ? event.work_report_json : [];
      return Boolean(eventCode) && history.some(item => String(item || "").trim());
    });
    const selectedEvent = events.find(event => String(event.event_code) === fieldReportHistoryEventCode) || {};
    const records = state.records || [];
    const activeRecord = records.find(record => Number(record.version) === Number(fieldReportHistoryVersion)) || records[0] || null;
    const eventOptions = events.map(event => `<option value="${escapeHtml(event.event_code)}" ${String(event.event_code) === fieldReportHistoryEventCode ? "selected" : ""}>${escapeHtml(fieldReportHistoryEventLabel(event))}</option>`).join("");
    const versionOptions = records.map((record, index) => `<option value="${escapeHtml(record.version)}" ${Number(record.version) === Number(activeRecord?.version) ? "selected" : ""}>${escapeHtml(`${fieldReportHistoryDisplayVersion(record.version)}${index === 0 ? " · 최신" : ""} · ${record.created_by?.admin_name || record.admin_input?.basic_info?.writer_name || "작성자 미정"} · ${fieldReportHistoryDateTime(record.created_at)}`)}</option>`).join("") + (state.corrupted?.length ? `<option disabled>데이터 오류 · ${state.corrupted.length}건</option>` : "");
    let detail = `<article class="ctdash-card ctdash-section fr-section"><div class="ctdash-empty">대회를 선택해주세요.</div></article>`;
    if (fieldReportHistoryEventCode && state.state === "loading") detail = `<article class="ctdash-card ctdash-section fr-section"><div class="ctdash-empty">일지를 불러오는 중입니다.</div></article>`;
    if (fieldReportHistoryEventCode && state.state === "loaded" && !records.length) detail = `<article class="ctdash-card ctdash-section fr-section"><div class="ctdash-empty">저장된 일지가 없습니다.</div></article>`;
    if (fieldReportHistoryEventCode && state.state === "error") detail = `<article class="ctdash-card ctdash-section fr-section"><div class="ctdash-callout warn">일지 조회에 실패했습니다. ${escapeHtml(state.message || "")}</div><button class="sh-btn-sm" type="button" data-fr-history-action="retry">다시 시도</button></article>`;
    if (activeRecord) { const model = fieldReportHistoryViewModel(activeRecord, selectedEvent); detail = renderWorkReport({ report:model.report, resolvedSections:model.resolvedSections, editable:false }); }
    return `<section class="ctdash-screen fr-shell"><article class="ctdash-card ctdash-section fr-hero"><div class="ctdash-section-head"><div><div class="ctdash-kicker">Field Report</div><h3>일지 조회</h3><p>대회별 저장 일지를 버전 기준으로 읽기 전용으로 확인합니다.</p></div><span class="ctdash-tag">읽기 전용</span></div><div class="fr-history-toolbar"><label><span>대회 선택</span><select class="ctdash-select" id="field_report_history_event_select"><option value="">대회를 선택해주세요</option>${eventOptions}</select></label><label><span>일지 버전 선택</span><select class="ctdash-select" id="field_report_history_version_select" ${!fieldReportHistoryEventCode || state.state !== "loaded" || !records.length ? "disabled" : ""}><option value="">${state.state === "loading" ? "불러오는 중..." : "버전을 선택해주세요"}</option>${versionOptions}</select></label></div></article>${detail}</section>`;
  }

  function photographerReportHistoryState(eventCode) {
    return photographerReportHistoryByEventCode[String(eventCode || "")] || { state:"idle", reports:[], invalid:[], message:"" };
  }

  async function loadPhotographerReportHistoryEvents(force) {
    if (photographerReportHistoryEventsState.state === "loading") return;
    if (!force && photographerReportHistoryEventsState.state === "loaded") return;
    photographerReportHistoryEventsState = { state:"loading", eventCodes:[], message:"" };
    showSotLoader(SOT_LOADER_DEFAULT_MESSAGE);
    renderCurrentTestDashboard();
    try {
      const token = sessionStorage.getItem("shout_access_token") || "";
      const response = await fetch(PHOTOGRAPHER_REPORT_HISTORY_EVENTS_API_URL, {
        headers: token ? { Authorization:`Bearer ${token}` } : {}
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result?.error?.message || "포토그래퍼 일지가 있는 대회 목록을 불러오지 못했습니다.");
      const eventCodes = [...new Set((Array.isArray(result?.data?.events) ? result.data.events : []).map(event => String(event?.event_code || "").trim()).filter(Boolean))];
      photographerReportHistoryEventsState = { state:"loaded", eventCodes, message:"" };
      if (photographerReportHistoryEventCode && !eventCodes.includes(photographerReportHistoryEventCode)) {
        photographerReportHistoryEventCode = "";
        photographerReportHistoryReportId = "";
      }
    } catch (error) {
      photographerReportHistoryEventsState = { state:"error", eventCodes:[], message:error?.message || "대회 목록 조회에 실패했습니다." };
      photographerReportHistoryEventCode = "";
      photographerReportHistoryReportId = "";
    } finally {
      hideSotLoader();
      renderCurrentTestDashboard();
    }
  }

  async function loadPhotographerReportHistory(eventCode) {
    const code = String(eventCode || "").trim();
    if (!code) return;
    const sequence = ++photographerReportHistoryRequestSequence;
    if (photographerReportHistoryAbortController) photographerReportHistoryAbortController.abort();
    photographerReportHistoryAbortController = new AbortController();
    photographerReportHistoryByEventCode[code] = { state:"loading", reports:[], invalid:[], message:"" };
    showSotLoader(SOT_LOADER_DEFAULT_MESSAGE);
    renderCurrentTestDashboard();
    try {
      const token = sessionStorage.getItem("shout_access_token") || "";
      const response = await fetch(`${PHOTOGRAPHER_REPORTS_API_URL}?event_code=${encodeURIComponent(code)}`, { headers:token ? { Authorization:`Bearer ${token}` } : {}, signal:photographerReportHistoryAbortController.signal });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success) throw new Error(result?.error?.message || "포토그래퍼 일지를 불러오지 못했습니다.");
      if (sequence !== photographerReportHistoryRequestSequence || photographerReportHistoryEventCode !== code) return;
      const reports = Array.isArray(result?.data?.reports) ? result.data.reports : [];
      photographerReportHistoryByEventCode[code] = { state:"loaded", reports, invalid:Array.isArray(result?.data?.invalid_reports) ? result.data.invalid_reports : [], message:"" };
      photographerReportHistoryReportId = reports[0]?.report_id || "";
    } catch (error) {
      if (error?.name === "AbortError" || sequence !== photographerReportHistoryRequestSequence || photographerReportHistoryEventCode !== code) return;
      photographerReportHistoryByEventCode[code] = { state:"error", reports:[], invalid:[], message:error?.message || "포토그래퍼 일지 조회에 실패했습니다." };
      photographerReportHistoryReportId = "";
    } finally {
      hideSotLoader();
      if (sequence === photographerReportHistoryRequestSequence && photographerReportHistoryEventCode === code) renderCurrentTestDashboard();
    }
  }

  function photographerReportStatus(report) {
    const shooting = report?.shooting || {}, upload = report?.upload || {};
    if (["partial", "stopped"].includes(shooting.result) || ["failed"].includes(upload.status) || ["unstable", "unavailable"].includes(upload.network_status)) return { label:"이슈 있음", tone:"issue" };
    if (["pending", "not_started"].includes(upload.status)) return { label:"업로드 확인", tone:"pending" };
    return { label:"정상", tone:"good" };
  }

  function renderPhotographerReportHistoryView() {
    const availableEventCodes = new Set(photographerReportHistoryEventsState.eventCodes || []);
    const events = (allEvents || []).filter(event => availableEventCodes.has(String(event?.event_code || "").trim()));
    const state = photographerReportHistoryState(photographerReportHistoryEventCode);
    const allReports = state.reports || [];
    const reports = allReports.filter(report => {
      if (photographerReportHistoryFilter === "all") return true;
      const shooting = report?.shooting || {}, upload = report?.upload || {};
      if (photographerReportHistoryFilter === "issue") return ["partial", "stopped"].includes(shooting.result) || upload.status === "failed" || ["unstable", "unavailable"].includes(upload.network_status);
      return ["pending", "not_started"].includes(upload.status);
    });
    reports.sort((a, b) => {
      if (photographerReportHistorySort === "name") return String(a.photographer_name || "").localeCompare(String(b.photographer_name || ""), "ko");
      if (photographerReportHistorySort === "issue") {
        const rank = report => ({ issue:0, pending:1, good:2 }[photographerReportStatus(report).tone] ?? 3);
        const rankDiff = rank(a) - rank(b);
        if (rankDiff) return rankDiff;
      }
      return new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime();
    });
    const active = reports.find(report => report.report_id === photographerReportHistoryReportId) || reports[0] || null;
    const eventOptions = events.map(event => `<option value="${escapeHtml(event.event_code)}" ${String(event.event_code) === photographerReportHistoryEventCode ? "selected" : ""}>${escapeHtml(fieldReportHistoryEventLabel(event))}</option>`).join("");
    let detail = `<div class="prh-empty">대회를 선택하면 제출된 포토그래퍼 일지가 표시됩니다.</div>`;
    if (photographerReportHistoryEventsState.state === "loading") detail = `<div class="prh-empty">일지가 있는 대회 목록을 불러오는 중입니다.</div>`;
    if (photographerReportHistoryEventsState.state === "loaded" && !events.length) detail = `<div class="prh-empty">저장된 포토그래퍼 일지가 있는 대회가 없습니다.</div>`;
    if (photographerReportHistoryEventsState.state === "error") detail = `<div class="prh-empty"><b>대회 목록 조회에 실패했습니다.</b><br>${escapeHtml(photographerReportHistoryEventsState.message || "")}</div>`;
    if (photographerReportHistoryEventCode && state.state === "loading") detail = `<div class="prh-empty">포토그래퍼 일지를 불러오는 중입니다.</div>`;
    if (photographerReportHistoryEventCode && state.state === "error") detail = `<div class="prh-empty"><b>일지 조회에 실패했습니다.</b><br>${escapeHtml(state.message || "")}</div>`;
    if (photographerReportHistoryEventCode && state.state === "loaded" && !allReports.length) detail = `<div class="prh-empty">저장된 포토그래퍼 일지가 없습니다.</div>`;
    if (active) {
      const shooting = active.shooting || {}, equipment = active.equipment || {}, upload = active.upload || {}, feedback = active.feedback || {};
      const status = photographerReportStatus(active);
      const photoCounts = Array.isArray(shooting.photo_counts) ? shooting.photo_counts : [];
      const spots = [shooting.actual_location, ...(Array.isArray(shooting.move_spots) ? shooting.move_spots : [])].filter(spot => spot?.name);
      const lensSource = equipment.lenses?.personal && typeof equipment.lenses.personal === "object" && !Array.isArray(equipment.lenses.personal) ? equipment.lenses.personal : (equipment.lenses || {});
      const lensItems = Object.entries(lensSource).filter(([key,value]) => !["personal","rental"].includes(key) && Number(value) > 0).map(([key,value]) => ({ label:`렌즈 ${String(key).replaceAll("_", "-")}`, value:`${Number(value).toLocaleString()}개` }));
      const personalEquipmentItems = [];
      const issuedEquipmentItems = [];
      const issuedBagCode = equipment.issued_bag && equipment.issued_bag !== "none" ? String(equipment.issued_bag) : "";
      (Array.isArray(equipment.camera_bodies) ? equipment.camera_bodies : []).forEach(value => personalEquipmentItems.push({ label:"카메라 바디", value:String(value) }));
      personalEquipmentItems.push(...lensItems);
      const sdCount = Number(equipment.memory_card?.sd || 0);
      const microSdCount = Number(equipment.memory_card?.micro_sd || 0);
      if (sdCount > 0) personalEquipmentItems.push({ label:"메모리카드 SD", value:`${sdCount.toLocaleString()}개` });
      if (microSdCount > 0) personalEquipmentItems.push({ label:"메모리카드 Micro SD", value:`${microSdCount.toLocaleString()}개` });
      [["카메라 배터리",equipment.camera_battery],["보조배터리",equipment.power_bank],["라우터",equipment.router],["잡화가방",equipment.accessory_bag],["쿨러",equipment.cooler]].forEach(([label,rows]) => (Array.isArray(rows) ? rows : []).forEach(row => {
        const count = Number(row?.count || 0);
        const rowCode = String(row?.code || "").trim();
        const displayCode = rowCode && rowCode !== issuedBagCode ? ` ${rowCode}` : "";
        if (count > 0) issuedEquipmentItems.push({ label:`${label}${displayCode}`, value:`${count.toLocaleString()}개` });
      }));
      const equipmentItems = [...personalEquipmentItems, ...(issuedBagCode ? [{ label:"지급 가방", value:issuedBagCode }] : []), ...issuedEquipmentItems];
      const totalPhotoCount = photoCounts.reduce((sum,row) => sum + Number(row.count || 0), 0);
      const shootingResultLabel = {complete:"정상 완료",partial:"일부 촬영",stopped:"촬영 중단"}[shooting.result] || shooting.result || "-";
      const uploadStatusLabel = {complete:"업로드 완료",pending:"진행 중",not_started:"미진행",failed:"실패"}[upload.status] || upload.status || "-";
      const networkStatusLabel = {good:"원활",normal:"보통",unstable:"불안정",unavailable:"사용 불가"}[upload.network_status] || upload.network_status || "-";
      const submittedLabel = active.submitted_at ? fieldReportHistoryDateTime(active.submitted_at) : "";
      const equipmentIssue = equipment.issue || {};
      const hasEquipmentIssue = Boolean(equipmentIssue.detail) || (equipmentIssue.status && equipmentIssue.status !== "none");
      const spotRows = spots.length ? spots.map((spot,index) => `<div class="prh-route-row"><span class="prh-time">${index === 0 ? `도착 ${escapeHtml(shooting.arrival_time || "-")}` : "이동"}</span><span class="prh-spot">${escapeHtml(spot.name)}${spot.distance_km === null || spot.distance_km === undefined ? "" : `<small>출발 기준 ${escapeHtml(spot.distance_km)}km</small>`}</span><i class="prh-dot"></i></div>`).join("") : `<p class="ctdash-empty">등록된 촬영 스팟이 없습니다.</p>`;
      const shootingTimeRow = shooting.start_time || shooting.end_time || shooting.leaving_time ? `<div class="prh-route-row"><span class="prh-time">촬영 ${escapeHtml(shooting.start_time || "-")}–${escapeHtml(shooting.end_time || "-")}</span><span class="prh-spot">촬영 종료${shooting.leaving_time ? ` · 퇴근 ${escapeHtml(shooting.leaving_time)}` : ""}</span><i class="prh-dot"></i></div>` : "";
      const bodyCard = photoCounts.length ? `<div class="prh-info"><span>카메라 바디별 장수</span>${photoCounts.map(row => `<b><em>${escapeHtml(row.camera_body || "-")}</em><strong>${Number(row.count || 0).toLocaleString()}장</strong></b>`).join("")}</div>` : "";
      const lensCard = lensItems.length ? `<div class="prh-info"><span>렌즈</span><div class="prh-lens-chips">${lensItems.map(item => `<i>${escapeHtml(item.label.replace(/^렌즈\s*/, ""))}</i>`).join("")}</div></div>` : "";
      const networkCard = upload.network_note ? `<div class="prh-info prh-info-wide"><span>업로드·네트워크 특이사항</span><b class="prh-info-note">${escapeHtml(upload.network_note)}</b></div>` : "";
      const equipmentRows = items => `<div class="prh-equipment-list">${items.map(item => `<div><span>${escapeHtml(item.label)}</span><b>${escapeHtml(item.value)}</b></div>`).join("")}</div>`;
      const personalEquipmentGroup = personalEquipmentItems.length ? `<div class="prh-equipment-group"><div class="prh-equipment-group-head"><b>촬영 장비</b><span>카메라 바디 · 렌즈 · 메모리카드</span></div>${equipmentRows(personalEquipmentItems)}</div>` : "";
      const issuedEquipmentTitle = issuedBagCode ? `지급 가방 ${issuedBagCode}` : "지급 장비";
      const issuedEquipmentGroup = issuedBagCode || issuedEquipmentItems.length ? `<div class="prh-equipment-group"><div class="prh-equipment-group-head"><b>${escapeHtml(issuedEquipmentTitle)}</b><span>${issuedBagCode ? `${escapeHtml(issuedBagCode)} 코드 기준 지급 장비` : "가방 미지급"}</span></div>${issuedEquipmentItems.length ? equipmentRows(issuedEquipmentItems) : `<p class="prh-equipment-empty">추가 지급 장비 내역이 없습니다.</p>`}</div>` : "";
      const equipmentCard = equipmentItems.length ? `<div class="prh-panel"><div class="prh-equipment-groups">${personalEquipmentGroup}${issuedEquipmentGroup}</div></div>` : `<div class="prh-panel"><p class="ctdash-empty">사용 장비 기록이 없습니다.</p></div>`;
      const equipmentIssueCard = hasEquipmentIssue ? `<div class="prh-issue-box"><strong>장비 이상</strong><p>${escapeHtml(equipmentIssue.detail || equipmentIssue.status)}</p></div>` : `<div class="prh-equipment-normal"><b>장비 이상 없음</b><p>제출된 장비 이상 또는 파손 기록이 없습니다.</p></div>`;
      detail = `<div class="prh-detail-head"><div><h3>${escapeHtml(active.photographer_name || "포토그래퍼 미정")} · ${escapeHtml(shooting.role || "역할 미정")}</h3><p>${escapeHtml(shooting.actual_location?.name || "촬영 위치 미정")}${shooting.actual_location?.distance_km === null || shooting.actual_location?.distance_km === undefined ? "" : ` · 출발 기준 ${escapeHtml(shooting.actual_location.distance_km)}km`} · 촬영일 ${escapeHtml(shooting.shooting_date || "")}</p><span class="prh-read-only">제출 원문 · 읽기 전용</span></div><div><small class="prh-report-id">${escapeHtml(active.report_id || "")}</small><span class="prh-status ${status.tone}">${status.label}</span></div></div><div class="prh-detail-body"><div class="prh-metrics"><div><span>촬영 결과</span><b>${escapeHtml(shootingResultLabel)}</b>${submittedLabel ? `<small>제출 ${escapeHtml(submittedLabel)}</small>` : ""}</div><div><span>총 촬영 장수</span><b>${totalPhotoCount.toLocaleString()}장</b>${photoCounts.length ? `<small>바디별 합계</small>` : ""}</div><div><span>업로드 상태</span><b class="prh-metric-compact">${escapeHtml(uploadStatusLabel)}</b>${upload.network_status ? `<small>네트워크 ${escapeHtml(networkStatusLabel)}</small>` : ""}</div><div><span>사용 장비</span><b>${equipmentItems.length.toLocaleString()}개</b><small>${equipment.issued_bag && equipment.issued_bag !== "none" ? "지급 가방 포함" : "실제 사용 내역"}</small></div></div><section class="prh-section"><div class="prh-section-title"><h4>촬영 기록</h4><span>시간·위치·바디별 결과</span></div><div class="prh-grid"><div class="prh-panel prh-route">${spotRows}${shootingTimeRow}</div><div class="prh-info-grid">${bodyCard}${lensCard}${networkCard}</div></div></section><section class="prh-section"><div class="prh-section-title"><h4>사용 장비</h4><span>작가별 실제 사용 내역</span></div><div class="prh-equipment-layout">${equipmentCard}${equipmentIssueCard}</div></section>${shooting.result_reason ? `<section class="prh-section"><div class="prh-section-title"><h4>촬영 결과 확인</h4><span>제출 사유</span></div><div class="prh-issue"><b>${escapeHtml(shootingResultLabel)} 사유</b><p>${escapeHtml(shooting.result_reason)}</p></div></section>` : ""}<section class="prh-section"><div class="prh-section-title"><h4>현장 피드백</h4><span>다음 운영을 위한 원문 메모</span></div><div class="prh-feedback"><div><span>현장 특이사항</span><p>${escapeHtml(feedback.field_note || "기록 없음")}</p></div><div><span>문제점</span><p>${escapeHtml(feedback.problem || "기록 없음")}</p></div><div><span>개선 의견</span><p>${escapeHtml(feedback.improvement || "기록 없음")}</p></div></div></section>${submittedLabel ? `<section class="prh-section"><div class="prh-section-title"><h4>제출 메타데이터</h4><span>변경 불가</span></div><div class="prh-metadata">이 일지는 ${escapeHtml(submittedLabel)}에 제출되었습니다. 조회 화면에서는 원본을 수정할 수 없습니다.</div></section>` : ""}</div>`;
    }
    const list = reports.length ? reports.map(report => { const shooting = report.shooting || {}, status = photographerReportStatus(report); const count = (shooting.photo_counts || []).reduce((sum,row) => sum + Number(row.count || 0), 0); const submitted = report.submitted_at ? fieldReportHistoryDateTime(report.submitted_at) : ""; return `<button class="prh-list-item ${report.report_id === active?.report_id ? "is-active" : ""}" type="button" data-prh-report="${escapeHtml(report.report_id || "")}"><span class="prh-list-top"><b>${escapeHtml(report.photographer_name || "포토그래퍼 미정")}</b><em class="prh-status ${status.tone}">${status.label}</em></span><span class="prh-list-sub"><span>${escapeHtml(shooting.role || "역할 미정")} · ${escapeHtml(shooting.actual_location?.name || "위치 미정")}</span><b>${count.toLocaleString()}장</b></span>${submitted ? `<small>제출 ${escapeHtml(submitted)}</small>` : ""}</button>`; }).join("") : `<p class="ctdash-empty">${state.state === "loaded" ? "조건에 맞는 일지가 없습니다." : "대회를 선택해주세요."}</p>`;
    const filterButtons = `<div class="prh-filters"><button type="button" data-prh-filter="all" class="${photographerReportHistoryFilter === "all" ? "is-active" : ""}">전체</button><button type="button" data-prh-filter="issue" class="${photographerReportHistoryFilter === "issue" ? "is-active" : ""}">이슈 있음</button><button type="button" data-prh-filter="pending" class="${photographerReportHistoryFilter === "pending" ? "is-active" : ""}">업로드 확인</button></div>`;
    const eventSelectPlaceholder = photographerReportHistoryEventsState.state === "loading" ? "일지가 있는 대회 불러오는 중..." : photographerReportHistoryEventsState.state === "error" ? "대회 목록 조회 실패" : events.length ? "대회를 선택해주세요" : "일지가 있는 대회가 없습니다";
    const eventSelectDisabled = photographerReportHistoryEventsState.state !== "loaded" || !events.length;
    const refreshLabel = photographerReportHistoryEventsState.state === "error" ? "목록 다시 시도" : state.state === "loading" ? "불러오는 중" : "새로고침";
    const refreshDisabled = photographerReportHistoryEventsState.state === "loading" || (photographerReportHistoryEventsState.state === "loaded" && (!photographerReportHistoryEventCode || state.state === "loading"));
    return `<section class="ctdash-screen fr-shell prh-shell"><article class="ctdash-card ctdash-section fr-hero prh-hero"><div><div class="ctdash-kicker">Photographer Reports</div><h3>포토그래퍼 일지 조회</h3><p>작가별 촬영 결과와 장비·업로드·현장 피드백을 한 화면에서 비교하고, 제출 원문을 읽기 전용으로 확인합니다.</p></div><div class="prh-hero-meta"><div><span>데이터 기준</span><b>Notion Photographer Log</b></div><div><span>열람 권한</span><b>관리자 전용</b></div></div></article><div class="prh-query-toolbar"><select class="ctdash-select" id="photographer_report_history_event_select" ${eventSelectDisabled ? "disabled" : ""}><option value="">${escapeHtml(eventSelectPlaceholder)}</option>${eventOptions}</select><select class="ctdash-select" id="photographer_report_history_sort"><option value="latest" ${photographerReportHistorySort === "latest" ? "selected" : ""}>최신 제출순</option><option value="name" ${photographerReportHistorySort === "name" ? "selected" : ""}>포토그래퍼 이름순</option><option value="issue" ${photographerReportHistorySort === "issue" ? "selected" : ""}>이슈 우선</option></select><button class="prh-refresh" type="button" data-prh-action="refresh" ${refreshDisabled ? "disabled" : ""}>${escapeHtml(refreshLabel)}</button></div><div class="prh-layout"><aside class="ctdash-card prh-list"><div class="prh-list-head"><h4>제출 일지 ${reports.length}건</h4><p>대회를 선택하면 해당 대회의 제출 일지만 표시합니다.</p>${filterButtons}</div><div class="prh-list-body">${list}</div></aside><article class="ctdash-card prh-detail">${detail}</article></div>${state.invalid?.length ? `<p class="ctdash-callout warn">손상되었거나 대회 코드가 맞지 않는 과거 일지 ${state.invalid.length}건은 목록에서 제외했습니다.</p>` : ""}</section>`;
  }

  function renderCurrentDashDiaryView() {
    syncFieldReportDraftsFromEvents(allEvents);
    const draft = selectedFieldReportDraft();
    updateFieldReportDerivedValues(draft);
    const report = draft.report_json;
    const source = fieldReportSourceState(draft.event_code);
    const sourceData = source.data || {};
    const resolvedSections = sourceData.resolved_sections || {};
    const sourceEvent = sourceData.event || {};
    const sourceLoaded = source.state === "loaded";
    const autoRows = key => sourceLoaded ? (resolvedSections[key] || []) : [];
    const sourceEventDate = sourceLoaded ? (sourceEvent.event_date || report.meta.report_date) : report.meta.report_date;
    const sourceEventLocation = sourceLoaded ? (resolvedSections.event_header?.location || report.meta.location) : report.meta.location;
    const participantStaff = Array.isArray(report.meta.participant_staff) ? report.meta.participant_staff : [];
    const staffOptions = [...new Set(["이대로", "박찬희", "규식", "이인혁", "민규재", ...participantStaff, ...autoRows("staff_assignments").map(row => row.name).filter(Boolean)])];
    const eventOptions = fieldReportDrafts.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === fieldReportActiveId ? "selected" : ""}>${escapeHtml(item.event_name || item.event_code || "무제 일지")}</option>`).join("");
    const participantOptions = staffOptions.filter(name => !participantStaff.includes(name)).map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    const participantChips = participantStaff.length ? participantStaff.map(name => `<span class="fr-staff-chip">${escapeHtml(name)}<button type="button" data-fr-participant-remove="${escapeHtml(name)}" aria-label="${escapeHtml(name)} 제거">×</button></span>`).join("") : `<span class="ctdash-empty">선택된 스탭이 없습니다.</span>`;
    const checkValue = report.daily_summary.actual_count_check || "";
    const operationResult = report.meta.operation_result || "";
    const uploadCompletionStatus = report.meta.upload_completion_status || "";
    const closingChecks = report.meta.closing_checks || {};
    return `
      <section class="ctdash-screen fr-shell">
        <article class="ctdash-card ctdash-section fr-hero">
          <div class="ctdash-section-head">
            <div>
              <div class="ctdash-kicker">Field Report</div>
              <h3>일지 작성</h3>
              <p>대회 운영 기록을 정리하는 관리자용 일지입니다. 확정된 Notion Event와 포토그래퍼 일지를 자동으로 읽어 표시하며, 수동 입력 내용만 저장합니다.</p>
            </div>
            <span class="ctdash-tag">작성 중</span>
          </div>
          <div class="fr-toolbar">
            <button class="ctdash-refresh" type="button" data-fr-action="save" ${fieldReportSaving ? "disabled" : ""}>${fieldReportSaving ? "저장 중..." : "저장"}</button>
            <button class="sh-btn-sm" type="button" data-fr-action="toggle-json">${fieldReportShowJson ? "JSON 숨기기" : "JSON 보기"}</button>
            <button class="sh-btn-sm" type="button" data-fr-action="reset">초기화</button>
          </div>
          ${fieldReportSaveMessage ? `<div class="ctdash-callout ${fieldReportSaveMessage.startsWith("저장 완료") ? "" : "warn"}">${escapeHtml(fieldReportSaveMessage)}</div>` : ""}
          <div class="ctdash-callout ${source.state === "error" ? "warn" : ""}">${escapeHtml(fieldReportSourceStatusLabel(source))}</div>
        </article>

        <article class="ctdash-card ctdash-section fr-section">
          <div class="ctdash-section-head"><div><div class="ctdash-kicker">1</div><h3>기본 정보</h3></div><span class="ctdash-tag">${escapeHtml(report.meta.weekday || "요일 미정")}</span></div>
          <div class="ctdash-form-grid">
            <label><span>대회명</span><select class="ctdash-select" id="field_report_event_select"><option value="">대회 선택</option>${eventOptions}</select></label>
            ${fieldReportReadOnlyField("대회 코드", sourceLoaded ? (sourceEvent.event_code || report.meta.event_code) : report.meta.event_code)}
            ${fieldReportReadOnlyField("날짜", sourceEventDate, "date")}
            ${fieldReportField("meta.writer", "작성자", "text")}
            ${fieldReportReadOnlyField("장소", sourceEventLocation)}
            ${fieldReportSelect("meta.weather", "날씨", ["맑음", "흐림", "비", "눈"])}
            ${fieldReportSelect("meta.temperature", "기온", Array.from({length:56}, (_, index) => `${index - 10}℃`))}
            ${fieldReportStrictSelect("meta.operation_result", "운영 결과", [{ value:"normal", label:"정상 운영" }, { value:"partial", label:"부분 운영" }, { value:"stopped", label:"운영 중단" }])}
            ${["partial", "stopped"].includes(operationResult) ? fieldReportField("meta.operation_result_reason", "운영 결과 사유", "text", "사유 입력") : ""}
            ${fieldReportStrictSelect("meta.upload_completion_status", "업로드 완료 여부", [{ value:"complete", label:"완료" }, { value:"partial", label:"일부 완료" }, { value:"not_uploaded", label:"미업로드" }])}
            ${["partial", "not_uploaded"].includes(uploadCompletionStatus) ? fieldReportField("meta.upload_completion_reason", "업로드 사유", "text", "사유 입력") : ""}
          </div>
          <div class="fr-participant-field">
            <span>참여 스탭</span>
            <div class="fr-staff-picker"><div class="fr-staff-chips">${participantChips}</div><div class="fr-staff-add"><select class="ctdash-select" id="field_report_participant_select"><option value="">스탭 선택</option>${participantOptions}</select><button class="sh-btn-sm" type="button" data-fr-participant-add>추가</button></div></div>
            <small>Notion 다중 선택처럼 스탭을 한 명씩 추가하거나 제거합니다.</small>
          </div>
          <div class="fr-closing-checks">
            <span>현장 마감 체크</span>
            <div class="fr-check-grid">
              <label><input class="fr-input" data-fr-path="meta.closing_checks.upload_completed" type="checkbox" ${closingChecks.upload_completed ? "checked" : ""}><span>업로드 완료</span></label>
              <label><input class="fr-input" data-fr-path="meta.closing_checks.equipment_returned" type="checkbox" ${closingChecks.equipment_returned ? "checked" : ""}><span>장비 반납 완료</span></label>
              <label><input class="fr-input" data-fr-path="meta.closing_checks.lost_and_found_checked" type="checkbox" ${closingChecks.lost_and_found_checked ? "checked" : ""}><span>분실물 확인</span></label>
              <label><input class="fr-input" data-fr-path="meta.closing_checks.teardown_completed" type="checkbox" ${closingChecks.teardown_completed ? "checked" : ""}><span>철수 완료</span></label>
            </div>
          </div>
        </article>

        ${fieldReportAutoTable("2. 투입 인원", autoRows("staff_assignments"), [
          { key:"name", label:"이름" },
          { key:"role", label:"역할" },
          { key:"spot_name", label:"배치 스팟" },
          { key:"start_time", label:"출근" },
          { key:"end_time", label:"퇴근" }
        ], { kicker:"Photographer Report" })}

        ${fieldReportAutoTable("3. 촬영 스팟", autoRows("shooting_spots"), [
          { key:"location", label:"위치" },
          { key:"spot_name", label:"명칭" },
          { key:"concept", label:"촬영 컨셉" },
          { key:"expected_people", label:"예상 인원" },
          { key:"camera_count", label:"카메라 수" },
          { key:"note", label:"비고" }
        ], { kicker:"Photographer Report" })}

        <div class="fr-two-col">
          ${fieldReportBasicEquipmentGroups("4-1. 기본 장비", autoRows("basic_equipment"), { kicker:"Photographer Report" })}
          ${fieldReportEquipmentTotalTable("4-2. 장비 합계", autoRows("equipment_summary"), { kicker:"Photographer Report" })}
        </div>
        ${fieldReportTable("4-3. 추가 장비", "equipment.extra", [
          { key:"item", label:"장비명" },
          { key:"owner", label:"담당자", type:"select", options:staffOptions },
          { key:"spot", label:"배치 스팟" },
          { key:"status", label:"상태", type:"select", options:["정상", "확인 필요", "분실", "수리 필요"] },
          { key:"note", label:"비고" }
        ], { kicker:"Extra" })}

        ${fieldReportAutoTable("5. 스팟별 운영 시간 일지", autoRows("spot_operations"), [
          { key:"spot_name", label:"스팟" },
          { key:"start_time", label:"시작" },
          { key:"end_time", label:"종료" },
          { key:"shoot_count", label:"촬영 건수" },
          { key:"memo", label:"메모" }
        ], { kicker:"Photographer Report" })}

        ${fieldReportIssueSection(autoRows("automatic_issues"), report.issues || [], staffOptions)}

        <article class="ctdash-card ctdash-section fr-section">
          <div class="ctdash-section-head"><div><div class="ctdash-kicker">7</div><h3>데일리 서머리</h3></div><span class="ctdash-tag">수동 메모 + 검증</span></div>
          <div class="ctdash-form-grid">
            ${fieldReportReadOnlyField("총 촬영 건수", sourceLoaded ? resolvedSections.total_photo_count : null, "number")}
            <label><span>실제 개수 검증</span><select class="ctdash-select fr-input" data-fr-path="daily_summary.actual_count_check" id="field_report_actual_count_check"><option value="">선택</option><option value="matched" ${checkValue === "matched" ? "selected" : ""}>일치</option><option value="review" ${checkValue === "review" ? "selected" : ""}>확인 필요</option><option value="mismatch" ${checkValue === "mismatch" ? "selected" : ""}>불일치</option></select></label>
            ${checkValue === "mismatch" ? fieldReportField("daily_summary.actual_shoot_count", "실제 촬영 건수", "number") : ""}
            ${fieldReportTextarea("daily_summary.improvement_note", "개선 사항", "compact")}
            ${fieldReportTextarea("daily_summary.general_comment", "종합 메모", "compact")}
          </div>
        </article>

        <article class="ctdash-card ctdash-section fr-section">
          <div class="ctdash-section-head"><div><div class="ctdash-kicker">8</div><h3>확인 서명</h3></div><span class="ctdash-tag">체크</span></div>
          <div class="ctdash-form-grid three">
            ${fieldReportField("signatures.writer.name", "작성자", "text")}
            ${fieldReportField("signatures.field_manager.name", "현장 책임자", "text")}
            ${fieldReportField("signatures.office_confirm.name", "사무실 확인", "text")}
          </div>
          <div class="ctdash-form-grid three">
            ${fieldReportTextarea("signatures.writer.note", "작성자 메모")}
            ${fieldReportTextarea("signatures.field_manager.note", "현장 책임자 메모")}
            ${fieldReportTextarea("signatures.office_confirm.note", "사무실 확인 메모")}
          </div>
        </article>

        ${fieldReportShowJson ? `<article class="ctdash-card ctdash-section fr-section"><div class="ctdash-section-head"><div><div class="ctdash-kicker">JSON</div><h3>${escapeHtml(FIELD_REPORT_JSON_FIELD)}</h3></div><span class="ctdash-tag">${escapeHtml(FIELD_REPORT_TEST_TYPE)}</span></div><pre class="fr-json">${escapeHtml(JSON.stringify(report, null, 2))}</pre></article>` : ""}
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
    const labelText = String(label || "");
    const classes = ["ctdash-metric-card"];
    if (labelText === "대회명") classes.push("is-wide", "is-event-name");
    if (labelText.includes("매출") || labelText === "객단가") classes.push("is-money");
    return `<article class="${classes.join(" ")}"><h4>${label}</h4><strong>${value}</strong><p>${note || ""}</p></article>`;
  }

  function conversionCard(label, numerator, denominator) {
    const rate = safeRate(numerator, denominator);
    return `<article class="ctdash-conv-card"><div class="ctdash-conv-top"><h4>${label}</h4><strong>${formatPercent(rate)}</strong></div><div class="ctdash-bar"><span style="width:${Math.min(100, rate)}%"></span></div><p>${formatNumber(numerator)} / ${formatNumber(denominator)}</p></article>`;
  }

  function currentDashCalculationText(value, formatter) {
    const num = Number(value);
    if (!Number.isFinite(num)) return "계산 불가";
    return formatter ? formatter(num) : formatNumber(num);
  }

  function currentDashRateText(numerator, denominator) {
    const den = Number(denominator || 0);
    if (!den) return "계산 불가";
    return formatPercent(safeRate(numerator, den));
  }

  function currentDashRatioMetricCard(label, numerator, denominator, note) {
    const den = Number(denominator || 0);
    const value = den ? formatPercent(safeRate(numerator, den)) : "계산 불가";
    const width = den ? Math.min(100, safeRate(numerator, den)) : 0;
    return `<article class="ctdash-conv-card"><div class="ctdash-conv-top"><h4>${escapeHtml(label)}</h4><strong>${escapeHtml(value)}</strong></div><div class="ctdash-bar"><span style="width:${width}%"></span></div><p>${formatNumber(numerator)} / ${formatNumber(denominator)} · ${escapeHtml(note || "선택 기간 기준")}</p></article>`;
  }

  function renderCurrentDashReportConversionSection(summary, eventRows) {
    const sessions = dashboardSessionCount(summary);
    const searchUsers = dashboardSearchUserCount(summary);
    const searches = numberValue(summary, ["search_count"]);
    const carts = numberValue(summary, ["cart_count"]);
    const purchases = numberValue(summary, ["purchase_count"]);
    const rows = Array.isArray(eventRows) ? eventRows : [];
    return `
      <article class="ctdash-card ctdash-section ctdash-wide-section">
        <div class="ctdash-section-head">
          <div>
            <div class="ctdash-kicker">Conversion</div>
            <h3>전환율 분석</h3>
            <p>${escapeHtml(currentDashReportScopeLabel())} snapshot 기준으로 프론트에서 계산합니다. 접속수는 현재 집계 계약상 일별 세션 합계 기준일 수 있습니다.</p>
          </div>
          <span class="ctdash-tag">Frontend Calc</span>
        </div>
        <div class="ctdash-conv-grid ctdash-wide-grid">
          ${currentDashRatioMetricCard("접속 → 검색자", searchUsers, sessions, "search_user_count / session_count")}
          ${currentDashRatioMetricCard("검색자 → 구매", purchases, searchUsers, "purchase_count / search_user_count")}
          ${currentDashRatioMetricCard("검색수 → 장바구니", carts, searches, "cart_count / search_count")}
          ${currentDashRatioMetricCard("장바구니 → 구매", purchases, carts, "purchase_count / cart_count")}
        </div>
        <div class="ctdash-table-wrap" style="margin-top:18px;">
          <table class="ctdash-table">
            <thead>
              <tr>
                <th>대회명</th>
                <th>접속→검색자</th>
                <th>검색자→구매</th>
                <th>검색수→장바구니</th>
                <th>장바구니→구매</th>
                <th>검색수→구매</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length ? rows.map(row => {
                const rowSessions = dashboardSessionCount(row);
                const rowSearchUsers = dashboardSearchUserCount(row);
                const rowSearches = numberValue(row, ["search_count"]);
                const rowCarts = numberValue(row, ["cart_count"]);
                const rowPurchases = numberValue(row, ["purchase_count"]);
                return `<tr>
                  <td>${escapeHtml(reportEventDisplayName(row))}</td>
                  <td>${escapeHtml(currentDashRateText(rowSearchUsers, rowSessions))}</td>
                  <td>${escapeHtml(currentDashRateText(rowPurchases, rowSearchUsers))}</td>
                  <td>${escapeHtml(currentDashRateText(rowCarts, rowSearches))}</td>
                  <td>${escapeHtml(currentDashRateText(rowPurchases, rowCarts))}</td>
                  <td>${escapeHtml(currentDashRateText(rowPurchases, rowSearches))}</td>
                </tr>`;
              }).join("") : `<tr><td colspan="6">선택한 구간에 전환율을 계산할 대회 데이터가 없습니다.</td></tr>`}
            </tbody>
          </table>
        </div>
      </article>
    `;
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

  function avgPurchasePhotoPerPurchase(row) {
    const purchases = numberValue(row, ["purchase_count"]);
    const photos = numberValue(row, ["purchase_photo_count"]);
    return purchases ? photos / purchases : 0;
  }

  function totalSellablePhotoCount(spots) {
    return (Array.isArray(spots) ? spots : []).reduce((sum, spot) => {
      return sum + numberValue(spot, ["valid_photo_count", "sellable_photo_count", "saleable_photo_count"]);
    }, 0);
  }

  function renderRevenueCards(summary, people, options) {
    const opts = options || {};
    const labelPrefix = opts.labelPrefix || "대회";
    const spots = Array.isArray(opts.spots) ? opts.spots : [];
    const purchaseCount = numberValue(summary, ["purchase_count"]);
    const purchasePhotoCount = numberValue(summary, ["purchase_photo_count"]);
    const sellablePhotoCount = totalSellablePhotoCount(spots);
    return `
      ${metricCard(`${labelPrefix}매출`, formatWon(numberValue(summary, ["revenue"])), "선택 기간 기준")}
      ${metricCard("객단가", formatWon(avgOrderValue(summary)), "구매 1건당")}
      ${metricCard("평균구매수", `${avgPurchasePhotoPerPurchase(summary).toFixed(1)}장`, "구매 1건당 사진")}
      ${metricCard("구매사진수", formatNumber(purchasePhotoCount), "purchase_photo_count")}
      ${metricCard("구매율(참가자대비)", formatPercent(safeRate(purchaseCount, people)), "purchase / participants")}
      ${metricCard("구매율(찍은사진대비)", formatPercent(safeRate(purchasePhotoCount, sellablePhotoCount)), `purchase_photo / ${formatNumber(sellablePhotoCount)}장`)}
    `;
  }

  function renderCurrentDashSpotCard(spot) {
    const label = firstText(spot, ["spot_label", "spot_name", "spot_key", "prefix", "spot_code", "label"]) || "스팟";
    const prefix = firstText(spot, ["prefix", "spot_key", "spot_code"]) || "-";
    const camera = firstText(spot, ["camera"]) || "";
    const locationMemo = firstText(spot, ["location_memo"]) || "";
    const mappingStatus = firstText(spot, ["mapping_status"]) || "unmapped";
    const orderCount = numberValue(spot, ["order_count", "purchase_count"]);
    const revenue = numberValue(spot, ["allocated_revenue", "revenue"]);
    const photoCount = numberValue(spot, ["sold_photo_count", "purchase_photo_count", "photo_count", "cart_photo_count"]);
    const revenueShare = numberValue(spot, ["revenue_share"]);
    const photoShare = numberValue(spot, ["photo_share"]);
    const storageStatus = firstText(spot, ["storage_inventory_status"]) || "missing";
    const storageNumber = field => {
      const value = spot && spot[field];
      if (value === undefined || value === null || value === "") return "미집계";
      const num = Number(value);
      return Number.isFinite(num) ? formatNumber(num) : "미집계";
    };
    const storagePercent = field => {
      const value = spot && spot[field];
      if (value === undefined || value === null || value === "") return "미집계";
      const num = Number(value);
      return Number.isFinite(num) ? formatPercent(num) : "미집계";
    };
    const singlePhotoCount = numberValue(spot, ["single_sold_photo_count"]);
    const packagePhotoCount = numberValue(spot, ["package_sold_photo_count"]);
    const singleOrderCount = numberValue(spot, ["single_order_count"]);
    const packageOrderCount = numberValue(spot, ["package_order_count"]);
    const singleRevenue = numberValue(spot, ["single_revenue"]);
    const packageRevenue = numberValue(spot, ["package_allocated_revenue"]);
    return `<article class="ctdash-spot-card">
      <h4>${escapeHtml(label)}</h4>
      <p>${escapeHtml(prefix)} · ${escapeHtml(mappingStatus)}</p>
      ${camera ? `<p>${escapeHtml(camera)}</p>` : ""}
      ${locationMemo ? `<p>${escapeHtml(locationMemo)}</p>` : ""}
      <strong>${formatNumber(photoCount)}장</strong>
      <div class="ctdash-spot-row"><span>원본 / 메타 / 판매가능</span><b>${storageNumber("uploaded_original_count")} / ${storageNumber("captured_photo_count")} / ${storageNumber("valid_photo_count")}</b></div>
      <div class="ctdash-spot-row"><span>유효율</span><b>${storagePercent("valid_photo_rate")}</b></div>
      <div class="ctdash-spot-row"><span>판매 사진 개수</span><b>${formatNumber(photoCount)}</b></div>
      <div class="ctdash-spot-row"><span>단품 / 패키지 사진</span><b>${formatNumber(singlePhotoCount)} / ${formatNumber(packagePhotoCount)}</b></div>
      <div class="ctdash-spot-row"><span>주문 수</span><b>${formatNumber(orderCount)}</b></div>
      <div class="ctdash-spot-row"><span>단품 / 패키지 주문</span><b>${formatNumber(singleOrderCount)} / ${formatNumber(packageOrderCount)}</b></div>
      <div class="ctdash-spot-row"><span>매출</span><b>${formatWon(revenue)}</b></div>
      <div class="ctdash-spot-row"><span>단품 매출</span><b>${formatWon(singleRevenue)}</b></div>
      <div class="ctdash-spot-row"><span>패키지 매출</span><b>${formatWon(packageRevenue)}</b></div>
      <div class="ctdash-spot-row"><span>매출 비중</span><b>${formatPercent(revenueShare)}</b></div>
    </article>`;
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
	          searchBibCount: 0,
	          cartCount: 0,
          purchaseCount: 0,
          purchaseBibCount: 0,
          orderCount: 0,
          soldPhotoCount: 0,
          revenue: 0
	        });
	      }
	      const aggregate = byLabel.get(label);
	      const rowPurchaseCount = numberValue(row, ["purchase_count", "purchase"]);
	      const rowPurchaseBibCount = numberValue(row, ["purchase_bib_count", "buyer_bib_count", "purchased_bib_count", "purchase_unique_bib_count"]);
	      const rowOrderCount = numberValue(row, ["order_count", "paid_order_count", "paid_purchase_count", "order_purchase_count", "purchase_count", "purchase"]);
	      aggregate.searchCount += numberValue(row, ["search_count", "count", "searches"]);
	      aggregate.searchBibCount += numberValue(row, ["unique_query_count", "bib_count", "bibs", "search_bib_count", "unique_bib_count"]);
      aggregate.cartCount += numberValue(row, ["cart_count", "cart"]);
      aggregate.purchaseCount += rowPurchaseCount;
      aggregate.purchaseBibCount += rowPurchaseBibCount || rowPurchaseCount;
      aggregate.orderCount += rowOrderCount;
      aggregate.soldPhotoCount += numberValue(row, ["sold_photo_count", "sold_photo", "purchase_photo_count"]);
	      aggregate.revenue += numberValue(row, ["revenue", "purchase_amount", "revenue_total"]);
	    });

	    const normalized = [...byLabel.values()]
	      .map(row => ({
	        ...row,
        purchaseRate: safeRate(row.orderCount, row.searchCount),
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
    if (typeof window.sotDashDebugEnabled === "function" && window.sotDashDebugEnabled()) {
	      console.table(normalized.map(row => ({
	        section: "photo_bucket",
	        label: row.label,
	        search_count: row.searchCount,
	        search_bib_count: row.searchBibCount,
	        purchase_bib_count: row.purchaseBibCount,
	        purchase_count: row.purchaseCount,
	        order_count: row.orderCount,
	        purchase_photo_count: row.soldPhotoCount,
	        purchase_rate: row.purchaseRate,
	        revenue: row.revenue
	      })));
	    }
	    return normalized;
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
		        ${metricCard("최고 구매율 구간", `${escapeHtml(topRate.label)} / ${formatPercent(topRate.purchaseRate)}`, "주문수 / 검색수")}
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
        <div class="ctdash-metrics-grid ctdash-balanced-grid is-count-6">
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
            <table class="ctdash-table ctdash-photo-bucket-table">
              <thead>
                <tr>
	                  <th>구간</th>
	                  <th>검색수</th>
		                  <th>구매 배번호수</th>
		                  <th>주문수</th>
	                  <th>판매된 사진개수</th>
	                  <th>구매율</th>
	                  <th>매출</th>
	                </tr>
	              </thead>
		              <tbody>
		                ${rows.length ? rows.map(row => `
		                  <tr>
		                    <td style="padding:13px 10px; font-weight:900; color:#c96b37;">${escapeHtml(row.label)}</td>
		                    <td align="right" style="padding:13px 10px;">${formatNumber(row.searchCount)}</td>
	                    <td align="right" style="padding:13px 10px;">${formatNumber(row.purchaseBibCount)}</td>
	                    <td align="right" style="padding:13px 10px;">${formatNumber(row.orderCount)}</td>
	                    <td align="right" style="padding:13px 10px;">${formatNumber(row.soldPhotoCount)}</td>
			                    <td align="right" style="padding:13px 8px; font-weight:900; ${row.purchaseRate >= 10 ? "color:#0c8b88;" : ""}">${formatPercent(row.purchaseRate)}</td>
	                    <td align="right" style="padding:13px 8px;">${formatWon(row.revenue)}</td>
		                  </tr>
			                `).join("") : `<tr><td colspan="7">사진 수 구간별 구매 분석 데이터가 없습니다.</td></tr>`}
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

  function currentDashReportEventRows() {
    const primaryRows = Array.isArray(sotCurrentTestData.event_summaries) && sotCurrentTestData.event_summaries.length
      ? sotCurrentTestData.event_summaries
      : (Array.isArray(sotCurrentTestData.events) ? sotCurrentTestData.events : []);
    const metricRows = primaryRows.filter(row => row && row.event_code && row.event_code !== "all");
    const rows = metricRows.some(reportEventHasActivity)
      ? metricRows
      : aggregateRowsByEventCode([...(sotCurrentTestData.daily || []), ...(sotCurrentTestData.hourly || [])]);

    return rows
      .map(row => enrichReportEventRow(row))
      .filter(row => row.event_code && row.event_code !== "all")
      .filter(isStartedEventOption)
      .filter(reportEventHasActivity)
      .sort((a, b) => {
        const revenueDiff = numberValue(b, ["revenue"]) - numberValue(a, ["revenue"]);
        if (revenueDiff) return revenueDiff;
        const purchaseDiff = numberValue(b, ["purchase_count"]) - numberValue(a, ["purchase_count"]);
        if (purchaseDiff) return purchaseDiff;
        const searchDiff = numberValue(b, ["search_count"]) - numberValue(a, ["search_count"]);
        if (searchDiff) return searchDiff;
        const aDate = eventDateKeyForOption(a);
        const bDate = eventDateKeyForOption(b);
        if (aDate !== null || bDate !== null) {
          if (aDate === null) return 1;
          if (bDate === null) return -1;
          if (aDate !== bDate) return bDate - aDate;
        }
        return String(currentDashEventLabel(a)).localeCompare(String(currentDashEventLabel(b)), "ko");
      });
  }

  function reportEventHasActivity(row) {
    return dashboardSessionCount(row) > 0
      || dashboardSearchUserCount(row) > 0
      || numberValue(row, ["search_count"]) > 0
      || numberValue(row, ["cart_count"]) > 0
      || numberValue(row, ["purchase_count"]) > 0
      || numberValue(row, ["revenue"]) > 0;
  }

  function reportEventMetaForCode(eventCode) {
    const code = String(eventCode || "").trim();
    if (!code) return {};
    const sources = [
      ...(allEvents || []),
      ...(currentDashEventListSnapshot?.events || []),
      ...(sotCurrentTestData.events || []),
      ...(sotCurrentTestData.event_summaries || [])
    ];
    return sources.find(item => String(item && item.event_code || "").trim() === code) || {};
  }

  function reportEventDisplayName(row) {
    const eventCode = String(row && row.event_code || "").trim();
    const meta = reportEventMetaForCode(eventCode);
    return currentDashEventLabel(meta)
      || firstText(row, ["display_name", "event_display_name", "name"])
      || firstText(row, ["event_name"])
      || eventCode
      || "-";
  }

  function enrichReportEventRow(row) {
    const eventCode = String(row && row.event_code || "").trim();
    const eventMeta = reportEventMetaForCode(eventCode);
    const displayName = reportEventDisplayName({ ...(row || {}), event_code: eventCode });
    return {
      ...eventMeta,
      ...(row || {}),
      event_code: eventCode,
      event_name: displayName,
      display_name: displayName,
      event_display_name: displayName
    };
  }

  function aggregateRowsByEventCode(rows) {
    const byCode = new Map();
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const eventCode = String(row && row.event_code || "").trim();
      if (!eventCode || eventCode === "all") return;
      const existing = byCode.get(eventCode) || { event_code: eventCode };
      Object.keys(row || {}).forEach(key => {
        const value = row[key];
        if (typeof value === "number") {
          existing[key] = (existing[key] || 0) + value;
        } else if (existing[key] === undefined && value !== undefined && value !== null && value !== "") {
          existing[key] = value;
        }
      });
      byCode.set(eventCode, existing);
    });
    return Array.from(byCode.values());
  }

  function reportEventSummaryTable(rows) {
    const list = Array.isArray(rows) ? rows : [];
    return `<div class="ctdash-table-wrap"><table class="ctdash-table ctdash-report-event-summary-table"><thead><tr><th>대회명</th><th>접속</th><th>검색자</th><th>검색수</th><th>장바구니수</th><th>구매수</th><th>매출액</th><th>검색→구매</th></tr></thead><tbody>${list.length ? list.map(row => `<tr><td>${escapeHtml(reportEventDisplayName(row))}</td><td>${formatNumber(dashboardSessionCount(row))}</td><td>${formatNumber(dashboardSearchUserCount(row))}</td><td>${formatNumber(numberValue(row, ["search_count"]))}</td><td>${formatNumber(numberValue(row, ["cart_count"]))}</td><td>${formatNumber(numberValue(row, ["purchase_count"]))}</td><td>${formatWon(numberValue(row, ["revenue"]))}</td><td>${formatPercent(safeRate(numberValue(row, ["purchase_count"]), numberValue(row, ["search_count"])))}</td></tr>`).join("") : `<tr><td colspan="8">선택한 구간에 기록이 있는 대회가 없습니다.</td></tr>`}</tbody></table></div>`;
  }

  function summaryTable(rows) {
    return `<div class="ctdash-table-wrap"><table class="ctdash-table"><thead><tr><th>대회명</th><th>참가자 수</th><th>매출</th><th>객단가</th><th>검색→구매</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escapeHtml(row.event_name || row.event_code || "-")}</td><td>${formatNumber(eventPeople(row.event_code))}</td><td>${formatWon(numberValue(row, ["revenue"]))}</td><td>${formatWon(avgOrderValue(row))}</td><td>${formatPercent(safeRate(numberValue(row, ["purchase_count"]), numberValue(row, ["search_count"])))}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function detailTableSection(title, headers, rows) {
    return `<article class="ctdash-card ctdash-section"><div class="ctdash-section-head"><div><div class="ctdash-kicker">Detail</div><h3>${title}</h3></div></div><div class="ctdash-table-wrap"><table class="ctdash-table"><thead><tr>${headers.map(header => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">데이터가 없습니다.</td></tr>`}</tbody></table></div></article>`;
  }

  const LEGACY_V2_DISPLAY_AGG_TYPES = ["event_hour", "query_range", "sales_amount_hour"];
  const LEGACY_V2_NUMERIC_FIELDS = [
    "search_count",
    "cart_count",
    "cart_photo_count",
    "purchase_count",
    "order_count",
    "purchase_photo_count",
    "sold_photo_count",
    "revenue",
    "purchase_amount",
    "sales_amount"
  ];

  function groupLegacyRowsByAggType(rows) {
    return (Array.isArray(rows) ? rows : []).reduce((grouped, row) => {
      const aggType = String(row && row.agg_type || "unknown").toLowerCase();
      if (!grouped[aggType]) grouped[aggType] = [];
      grouped[aggType].push(row);
      return grouped;
    }, {});
  }

  function legacyBackfillHasDisplayRows(grouped) {
    const byAgg = grouped || {};
    return LEGACY_V2_DISPLAY_AGG_TYPES.some(aggType => Array.isArray(byAgg[aggType]) && byAgg[aggType].length > 0);
  }

  function legacySnapshotTypeForView(viewName) {
    if (viewName === "event-analysis") {
      if (legacyAnalysisEventPeriod === "weekly") return "event_weekly";
      if (legacyAnalysisEventPeriod === "monthly") return "event_monthly";
      if (legacyAnalysisEventPeriod === "total") return "event_total";
      return "event_daily";
    }
    if (legacyAnalysisReportPeriod === "weekly") return "report_weekly";
    if (legacyAnalysisReportPeriod === "monthly") return "report_monthly";
    if (legacyAnalysisReportPeriod === "total") return "report_total";
    return "report_daily";
  }

  function legacySnapshotPeriodKeyForView(viewName) {
    if (viewName === "event-analysis") {
      if (legacyAnalysisEventPeriod === "weekly") return legacyAnalysisEventSelectedWeekKey || sotWeekKeyFromDateKey(legacyAnalysisEventSelectedDateKey || yesterdayKSTDateKey());
      if (legacyAnalysisEventPeriod === "monthly") return legacyAnalysisEventSelectedMonthKey || monthKeyFromDateKey(legacyAnalysisEventSelectedDateKey || todayKSTDateKey());
      if (legacyAnalysisEventPeriod === "total") return "total";
      return legacyAnalysisEventSelectedDateKey || yesterdayKSTDateKey();
    }
    if (legacyAnalysisReportPeriod === "weekly") return legacyAnalysisReportSelectedWeekKey || sotWeekKeyFromDateKey(legacyAnalysisReportSelectedDateKey || yesterdayKSTDateKey());
    if (legacyAnalysisReportPeriod === "monthly") return legacyAnalysisReportSelectedMonthKey || monthKeyFromDateKey(legacyAnalysisReportSelectedDateKey || todayKSTDateKey());
    if (legacyAnalysisReportPeriod === "total") return "total";
    return legacyAnalysisReportSelectedDateKey || yesterdayKSTDateKey();
  }

  function legacyRowsFromSnapshot(payload) {
    if (!payload || payload.ok === false) return [];
    const periodKey = payload.period_key || "";
    const base = {
      data_source: payload.data_source || "legacy_snapshot",
      period_key: periodKey,
      date_key: String(periodKey || "").slice(0, 10),
      event_code: payload.event_code || "all"
    };
    const rows = [];
    if (payload.summary && typeof payload.summary === "object") {
      rows.push({ ...base, ...payload.summary, agg_type: "state" });
    }
    (payload.daily || []).forEach(row => rows.push({ ...base, ...row, agg_type: "event_hour", date_key: row.date_key || row.period_key || base.date_key }));
    (payload.hourly || []).forEach(row => rows.push({ ...base, ...row, agg_type: "event_hour", hour_key: row.hour_key || row.period_key || "" }));
    (payload.events || []).forEach(row => rows.push({ ...base, ...row, agg_type: "event_summary", event_code: row.event_code || "" }));
    (payload.photo_counts || []).forEach(row => rows.push({ ...base, ...row, agg_type: "query_range", range_label: row.range_label || row.label || row.range || "" }));
    (payload.sources || []).forEach(row => rows.push({ ...base, ...row, agg_type: "source" }));
    (payload.campaigns || []).forEach(row => rows.push({ ...base, ...row, agg_type: "campaign" }));
    (payload.devices || []).forEach(row => rows.push({ ...base, ...row, agg_type: "device" }));
    const salesRows = payload.meta && Array.isArray(payload.meta.sales_amount_hour) ? payload.meta.sales_amount_hour : [];
    salesRows.forEach(row => rows.push({ ...base, ...row, agg_type: "sales_amount_hour" }));
    return rows;
  }

  function legacyFiniteNumber(row, keys) {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (let i = 0; i < keyList.length; i += 1) {
      const value = row && row[keyList[i]];
      if (value === undefined || value === null || value === "") continue;
      const num = Number(value);
      if (Number.isFinite(num)) return num;
    }
    return null;
  }

  function aggregateLegacyMetricRows(rows) {
    const result = { values: {}, has: {} };
    (Array.isArray(rows) ? rows : []).forEach(row => {
      LEGACY_V2_NUMERIC_FIELDS.forEach(field => {
        const value = legacyFiniteNumber(row, field);
        if (value === null) return;
        result.values[field] = (result.values[field] || 0) + value;
        result.has[field] = true;
      });
    });
    if (result.has.purchase_amount && !result.has.revenue) {
      result.values.revenue = result.values.purchase_amount;
      result.has.revenue = true;
    }
    if (result.has.sales_amount && !result.has.revenue) {
      result.values.revenue = result.values.sales_amount;
      result.has.revenue = true;
    }
    if (result.has.order_count && !result.has.purchase_count) {
      result.values.purchase_count = result.values.order_count;
      result.has.purchase_count = true;
    }
    if (result.has.sold_photo_count && !result.has.purchase_photo_count) {
      result.values.purchase_photo_count = result.values.sold_photo_count;
      result.has.purchase_photo_count = true;
    }
    return result;
  }

  function legacyMetricValue(aggregate, field, formatter, emptyText) {
    if (!aggregate || !aggregate.has || !aggregate.has[field]) return `<span class="legacy-v2-status">${escapeHtml(emptyText || "데이터 없음")}</span>`;
    const value = aggregate.values[field];
    if (!Number.isFinite(Number(value))) return `<span class="legacy-v2-status">데이터 없음</span>`;
    return formatter ? formatter(value) : formatNumber(value);
  }

  function legacyMetricCard(label, aggregate, field, note, formatter, emptyText) {
    return metricCard(label, legacyMetricValue(aggregate, field, formatter, emptyText), note || "레거시 기준");
  }

  function legacyUnsupportedCard(label, status, note) {
    return metricCard(label, `<span class="legacy-v2-status">${escapeHtml(status || "레거시 미지원")}</span>`, note || "0으로 대체하지 않음");
  }

  function legacyDateKey(row) {
    return firstText(row, ["date_key", "period_key", "event_date", "created_date", "Created Date"]).slice(0, 10);
  }

  function legacyHourKey(row) {
    const value = firstText(row, ["hour_key", "hour", "event_hour", "created_hour"]);
    if (value === "") return "";
    const num = Number(value);
    if (Number.isFinite(num)) return String(Math.max(0, Math.min(23, Math.floor(num)))).padStart(2, "0") + ":00";
    return String(value).slice(0, 5);
  }

  function aggregateLegacyRowsByKey(rows, keyFn) {
    const byKey = new Map();
    (Array.isArray(rows) ? rows : []).forEach(row => {
      const key = keyFn(row);
      if (!key) return;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(row);
    });
    return [...byKey.entries()]
      .map(([key, group]) => ({ key, aggregate: aggregateLegacyMetricRows(group) }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }

  function normalizeLegacySnapshotMetricRow(row, base) {
    const source = row && typeof row === "object" ? row : {};
    const metrics = source.metrics && typeof source.metrics === "object" ? source.metrics : {};
    return { ...(base || {}), ...source, ...metrics };
  }

  function legacySnapshotRows(payload, key) {
    const base = {
      data_source: payload && payload.data_source || "legacy_snapshot",
      period_key: payload && payload.period_key || "",
      event_code: payload && payload.event_code || "all"
    };
    return (Array.isArray(payload && payload[key]) ? payload[key] : []).map(row => normalizeLegacySnapshotMetricRow(row, base));
  }

  function legacySnapshotSummaryRow(payload) {
    return normalizeLegacySnapshotMetricRow(payload && payload.summary || {}, {
      data_source: payload && payload.data_source || "legacy_snapshot",
      period_key: payload && payload.period_key || "",
      date_key: payload && payload.period_key || "",
      event_code: payload && payload.event_code || "all"
    });
  }

  function legacySnapshotSummaryAggregate(payload) {
    const summary = legacySnapshotSummaryRow(payload);
    return aggregateLegacyMetricRows(Object.keys(summary).length ? [summary] : []);
  }

  function legacySnapshotAmountRows(payload) {
    const meta = payload && payload.meta && typeof payload.meta === "object" ? payload.meta : {};
    return Array.isArray(meta.sales_amount_hour) ? meta.sales_amount_hour.map(row => normalizeLegacySnapshotMetricRow(row, {
      data_source: payload && payload.data_source || "legacy_snapshot",
      period_key: payload && payload.period_key || ""
    })) : [];
  }

  function buildLegacyV2ReportSnapshotModel(payload, options) {
    const dailyRows = legacySnapshotRows(payload, "daily");
    const hourlyRows = legacySnapshotRows(payload, "hourly");
    const summaryRow = legacySnapshotSummaryRow(payload);
    const flowRows = dailyRows.length
      ? dailyRows
      : (hourlyRows.length ? hourlyRows : (Object.keys(summaryRow).length ? [summaryRow] : []));
    const amountRows = legacySnapshotAmountRows(payload);
    const hasAmountBucket = amountRows.some(row => firstText(row, ["amount_bucket", "amount_range", "bucket", "price_bucket", "label"]));
    return {
      mode: "legacy",
      dataSource: options && options.dataSource || "legacy_snapshot",
      aggregateSource: "dashboard_snapshot",
      summary: legacySnapshotSummaryAggregate(payload),
      daily: aggregateLegacyRowsByKey(flowRows, legacyDateKey),
      hourly: aggregateLegacyRowsByKey(hourlyRows, legacyHourKey),
      amountBuckets: hasAmountBucket
        ? aggregateLegacyRowsByKey(amountRows, row => firstText(row, ["amount_bucket", "amount_range", "bucket", "price_bucket", "label"]))
        : [],
      hasAmountBucket
    };
  }

  function buildLegacyV2EventAnalysisSnapshotModel(payload, options) {
    const selectedEvent = options && options.selectedEvent ? options.selectedEvent : "all";
    const eventRows = legacySnapshotRows(payload, "events").filter(row => row.event_code && row.event_code !== "all");
    const eventSummaries = eventRows.map(row => {
      const aggregate = aggregateLegacyMetricRows([row]);
      return {
        event_code: row.event_code,
        event_name: legacyEventName(row.event_code, [row]),
        aggregate,
        purchase_rate: aggregate.has.search_count && aggregate.has.purchase_count && aggregate.values.search_count
          ? safeRate(aggregate.values.purchase_count, aggregate.values.search_count)
          : null
      };
    }).sort((a, b) => Number(b.aggregate.values.revenue || 0) - Number(a.aggregate.values.revenue || 0));
    const dailyRows = legacySnapshotRows(payload, "daily").filter(row => selectedEvent === "all" || String(row.event_code || selectedEvent) === selectedEvent);
    const hourlyRows = legacySnapshotRows(payload, "hourly").filter(row => selectedEvent === "all" || String(row.event_code || selectedEvent) === selectedEvent);
    const summaryRow = legacySnapshotSummaryRow(payload);
    const flowRows = dailyRows.length
      ? dailyRows
      : (hourlyRows.length ? hourlyRows : (Object.keys(summaryRow).length ? [summaryRow] : []));
    return {
      mode: "legacy",
      dataSource: options && options.dataSource || "legacy_snapshot",
      aggregateSource: "dashboard_snapshot",
      selectedEvent,
      eventSummaries,
      selectedSummary: legacySnapshotSummaryAggregate(payload),
      daily: aggregateLegacyRowsByKey(flowRows, legacyDateKey),
      hourly: aggregateLegacyRowsByKey(hourlyRows, legacyHourKey)
    };
  }

  function legacyEventName(eventCode, rows) {
    const event = (allEvents || []).find(item => String(item.event_code || "") === String(eventCode || ""));
    if (event) return event.event_display_name || event.display_name || event.event_name || event.event_code || eventCode;
    const row = (rows || []).find(item => String(item.event_code || "") === String(eventCode || ""));
    return firstText(row, ["event_name", "event_display_name", "display_name"]) || eventCode || "-";
  }

  function legacyDefaultEventCode(rows) {
    const options = sortEventOptionsByDateDesc((rows || []).filter(row => row && row.event_code && row.event_code !== "all"));
    return options.length ? options[0].event_code : "all";
  }

  function buildLegacyV2ReportModel(rows, options) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const byAgg = groupLegacyRowsByAggType(sourceRows);
    const summaryRows = Array.isArray(byAgg.state) && byAgg.state.length ? byAgg.state : sourceRows;
    const flowRows = Array.isArray(byAgg.event_hour) && byAgg.event_hour.length ? byAgg.event_hour : sourceRows;
    const daily = aggregateLegacyRowsByKey(flowRows, legacyDateKey);
    const hourly = aggregateLegacyRowsByKey(Array.isArray(byAgg.event_hour) ? byAgg.event_hour : [], legacyHourKey);
    const amountRows = Array.isArray(byAgg.sales_amount_hour) ? byAgg.sales_amount_hour : [];
    const hasAmountBucket = amountRows.some(row => firstText(row, ["amount_bucket", "amount_range", "bucket", "price_bucket", "label"]));
    const amountBuckets = hasAmountBucket
      ? aggregateLegacyRowsByKey(amountRows, row => firstText(row, ["amount_bucket", "amount_range", "bucket", "price_bucket", "label"]))
      : [];
    return {
      mode: "legacy",
      dataSource: options && options.dataSource || "",
      aggregateSource: "dashboard",
      summary: aggregateLegacyMetricRows(summaryRows),
      daily,
      hourly,
      amountBuckets,
      hasAmountBucket
    };
  }

  function buildLegacyV2EventAnalysisModel(rows, options) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const byAgg = groupLegacyRowsByAggType(sourceRows);
    const byEvent = new Map();
    const summarySourceRows = Array.isArray(byAgg.event_summary) && byAgg.event_summary.length ? byAgg.event_summary : sourceRows;
    summarySourceRows.forEach(row => {
      const eventCode = firstText(row, ["event_code"]);
      if (!eventCode || eventCode === "all") return;
      if (!byEvent.has(eventCode)) byEvent.set(eventCode, []);
      byEvent.get(eventCode).push(row);
    });
    const eventSummaries = [...byEvent.entries()]
      .map(([eventCode, eventRows]) => {
        const aggregate = aggregateLegacyMetricRows(eventRows);
        return {
          event_code: eventCode,
          event_name: legacyEventName(eventCode, eventRows),
          aggregate,
          purchase_rate: aggregate.has.search_count && aggregate.has.purchase_count && aggregate.values.search_count
            ? safeRate(aggregate.values.purchase_count, aggregate.values.search_count)
            : null
        };
      })
      .sort((a, b) => Number(b.aggregate.values.revenue || 0) - Number(a.aggregate.values.revenue || 0));
    const selectedEvent = options && options.selectedEvent ? options.selectedEvent : "all";
    const selectedRows = Array.isArray(byAgg.state) && byAgg.state.length
      ? byAgg.state
      : (selectedEvent === "all" ? sourceRows.filter(row => String(row.agg_type || "") !== "event_summary") : sourceRows.filter(row => String(row.event_code || "") === selectedEvent && String(row.agg_type || "") !== "event_summary"));
    const selectedEventRows = Array.isArray(byAgg.event_hour) && byAgg.event_hour.length
      ? byAgg.event_hour.filter(row => selectedEvent === "all" || String(row.event_code || "") === selectedEvent)
      : selectedRows;
    return {
      mode: "legacy",
      dataSource: options && options.dataSource || "",
      aggregateSource: "dashboard",
      selectedEvent,
      eventSummaries,
      selectedSummary: aggregateLegacyMetricRows(selectedRows),
      daily: aggregateLegacyRowsByKey(selectedEventRows, legacyDateKey),
      hourly: aggregateLegacyRowsByKey(selectedEventRows, legacyHourKey)
    };
  }

  function legacyV2StatusBanner() {
    const source = legacyAnalysisResolvedDataSource || "legacy_backfill";
    const sourceLabel = source === "legacy_snapshot" ? "legacy_snapshot" : source === "legacy_backfill" ? "legacy_backfill" : "legacy";
    const fallback = legacyAnalysisFallbackReason
      ? `<div class="legacy-v2-banner is-warn">${escapeHtml(legacyAnalysisFallbackReason)}</div>`
      : "";
    return `
      <div class="legacy-v2-banner">
        <strong>레거시 분석 v2</strong>
        <span>Data Source: ${escapeHtml(sourceLabel)}</span>
        <span>Aggregate Source: ${source === "legacy_snapshot" ? "dashboard_snapshot" : "dashboard"}</span>
        <span>기존 로그 기반 집계라 일부 지표는 현재 집계 방식과 다를 수 있음</span>
      </div>
      ${fallback}
    `;
  }

  function legacyAggregateTableRow(label, aggregate) {
    return [
      escapeHtml(label),
      legacyMetricValue(aggregate, "search_count", formatNumber),
      legacyMetricValue(aggregate, "cart_count", formatNumber),
      legacyMetricValue(aggregate, "purchase_count", formatNumber),
      legacyMetricValue(aggregate, "purchase_photo_count", formatNumber),
      legacyMetricValue(aggregate, "revenue", formatWon)
    ];
  }

  function legacyFlowTableRows(rows) {
    return (Array.isArray(rows) ? rows : []).map(row => legacyAggregateTableRow(row.key, row.aggregate));
  }

  function legacyRowsForPeriod(rows, period, dateKey, monthKey, weekKey) {
    const list = Array.isArray(rows) ? rows : [];
    if (legacyAnalysisResolvedDataSource === "legacy_snapshot") return list;
    if (period === "total") return list;
    if (period === "monthly") {
      const selectedMonth = monthKey || monthKeyFromDateKey(todayKSTDateKey());
      return list.filter(row => legacyDateKey(row).slice(0, 7) === selectedMonth);
    }
    if (period === "weekly") {
      const selectedWeek = weekKey || sotWeekKeyFromDateKey(dateKey || yesterdayKSTDateKey());
      const week = buildWeeksForMonth(monthKey || monthKeyFromDateKey(dateKey || todayKSTDateKey())).find(row => row.week_key === selectedWeek);
      if (!week) return list;
      return list.filter(row => {
        const key = legacyDateKey(row);
        return key >= week.start_date_key && key <= week.end_date_key;
      });
    }
    const selectedDate = dateKey || yesterdayKSTDateKey();
    return list.filter(row => legacyDateKey(row) === selectedDate);
  }

  function legacyReportRowsForSelectedPeriod() {
    return legacyRowsForPeriod(
      legacyAnalysisRows,
      legacyAnalysisReportPeriod,
      legacyAnalysisReportSelectedDateKey,
      legacyAnalysisReportSelectedMonthKey,
      legacyAnalysisReportSelectedWeekKey
    );
  }

  function legacyEventRowsForSelectedPeriod() {
    return legacyRowsForPeriod(
      legacyAnalysisRows,
      legacyAnalysisEventPeriod,
      legacyAnalysisEventSelectedDateKey,
      legacyAnalysisEventSelectedMonthKey,
      legacyAnalysisEventSelectedWeekKey
    );
  }

  function legacyReportScopeControls() {
    if (legacyAnalysisReportPeriod === "total") {
      return `<label><span>전체 기준</span><input class="ctdash-input" type="text" value="total" disabled></label>`;
    }
    if (legacyAnalysisReportPeriod === "monthly") {
      return `<label><span>월 선택</span><input class="ctdash-input" type="month" id="legacy_report_month_input" value="${escapeHtml(legacyAnalysisReportSelectedMonthKey || monthKeyFromDateKey(todayKSTDateKey()))}"></label>`;
    }
    if (legacyAnalysisReportPeriod === "weekly") {
      const monthKey = legacyAnalysisReportSelectedMonthKey || monthKeyFromDateKey(todayKSTDateKey());
      const weeks = buildWeeksForMonth(monthKey);
      return `
        <label><span>기준월</span><input class="ctdash-input" type="month" id="legacy_report_week_month_input" value="${escapeHtml(monthKey)}"></label>
        <label><span>주차 선택</span><select class="ctdash-select" id="legacy_report_week_select">${weeks.map(row => `<option value="${escapeHtml(row.week_key)}" ${row.week_key === legacyAnalysisReportSelectedWeekKey ? "selected" : ""}>${escapeHtml(row.label)}</option>`).join("")}</select></label>
      `;
    }
    return `<label><span>일자 선택</span><input class="ctdash-input" type="date" id="legacy_report_date_input" value="${escapeHtml(legacyAnalysisReportSelectedDateKey || "")}"></label>`;
  }

  function legacyEventScopeControls(eventSummaries) {
    const monthlyValue = legacyAnalysisEventSelectedMonthKey || monthKeyFromDateKey(todayKSTDateKey());
    const weeklyOptions = buildWeeksForMonth(monthlyValue);
    const mergedByCode = new Map();
    (legacyAnalysisEventListRows || []).concat(eventSummaries || []).forEach(row => {
      const code = row && row.event_code;
      if (!code || code === "all") return;
      mergedByCode.set(code, { ...(mergedByCode.get(code) || {}), ...row });
    });
    const eventOptions = sortEventOptionsByDateDesc(Array.from(mergedByCode.values()));
    const options = [{ event_code:"all", event_name:"전체 대회" }].concat(eventOptions);
    return `
      <label><span>대회 선택</span><select class="ctdash-select" id="legacy_analysis_event_select">${options.map(row => `<option value="${escapeHtml(row.event_code)}" ${row.event_code === legacyAnalysisSelectedEvent ? "selected" : ""}>${escapeHtml(row.event_name || row.event_code)}</option>`).join("")}</select></label>
      ${legacyAnalysisEventPeriod === "total"
        ? `<label><span>전체 기준</span><input class="ctdash-input" type="text" value="total" disabled></label>`
        : legacyAnalysisEventPeriod === "monthly"
          ? `<label><span>월 선택</span><input class="ctdash-input" type="month" id="legacy_event_month_input" value="${escapeHtml(monthlyValue)}"></label>`
          : legacyAnalysisEventPeriod === "weekly"
            ? `<label><span>기준월</span><input class="ctdash-input" type="month" id="legacy_event_week_month_input" value="${escapeHtml(monthlyValue)}"></label><label><span>주차 선택</span><select class="ctdash-select" id="legacy_event_week_select">${weeklyOptions.map(row => `<option value="${escapeHtml(row.week_key)}" ${row.week_key === legacyAnalysisEventSelectedWeekKey ? "selected" : ""}>${escapeHtml(row.label)}</option>`).join("")}</select></label>`
            : `<label><span>일자 선택</span><input class="ctdash-input" type="date" id="legacy_event_date_input" value="${escapeHtml(legacyAnalysisEventSelectedDateKey || "")}"></label>`}
    `;
  }

  function legacyChartPlaceholder(title) {
    return `<div class="ctdash-chart-box"><div class="ctdash-chart-placeholder">${escapeHtml(title)} - 레거시 기준 집계 표시</div></div>`;
  }

  function legacyPhotoExposureUnsupportedSection() {
    return `
      <section class="ctdash-card ctdash-section">
        <div class="ctdash-section-head">
          <div>
            <div class="ctdash-kicker">Exposure</div>
            <h3>노출 사진 수 분석</h3>
            <p>현재 UI와 같은 위치에 유지하되, 레거시에서 정확 계산이 어려운 값은 상태로 표시합니다.</p>
          </div>
          <span class="ctdash-tag">Legacy Unsupported</span>
        </div>
        <div class="ctdash-metrics-grid">
          ${legacyUnsupportedCard("평균 노출", "레거시 미지원", "노출 원장 기준 불일치")}
          ${legacyUnsupportedCard("유효 평균 노출", "레거시 미지원", "노출 1건 이상 기준 계산 필요")}
          ${legacyUnsupportedCard("노출 0건", "레거시 미지원", "정확 계산 어려움")}
          ${legacyUnsupportedCard("사진 수 구간별 구매 분석", "레거시 미지원", "구조상 정확 계산 어려움")}
        </div>
      </section>
    `;
  }

  function renderLegacyV2ReportView() {
    const model = legacyAnalysisResolvedDataSource === "legacy_snapshot" && legacyAnalysisSnapshotPayload
      ? buildLegacyV2ReportSnapshotModel(legacyAnalysisSnapshotPayload, { dataSource: legacyAnalysisResolvedDataSource })
      : buildLegacyV2ReportModel(legacyReportRowsForSelectedPeriod(), { dataSource: legacyAnalysisResolvedDataSource });
    return `
      ${legacyV2StatusBanner()}
      <section class="ctdash-screen">
        <article class="ctdash-card ctdash-section">
          <div class="ctdash-section-head">
            <div>
              <div class="ctdash-kicker">Report</div>
              <h3>리포트</h3>
              <p>선택한 기간 기준 legacy dashboard row를 조회합니다.</p>
            </div>
            <div class="ctdash-period-tabs">
              <button class="ctdash-chip ${legacyAnalysisReportPeriod === "total" ? "is-active" : ""}" type="button" data-legacy-report-period="total">전체</button>
              <button class="ctdash-chip ${legacyAnalysisReportPeriod === "monthly" ? "is-active" : ""}" type="button" data-legacy-report-period="monthly">월별</button>
              <button class="ctdash-chip ${legacyAnalysisReportPeriod === "weekly" ? "is-active" : ""}" type="button" data-legacy-report-period="weekly">주차별</button>
              <button class="ctdash-chip ${legacyAnalysisReportPeriod === "daily" ? "is-active" : ""}" type="button" data-legacy-report-period="daily">일별</button>
            </div>
          </div>
          <div class="ctdash-inline-fields">${legacyReportScopeControls()}</div>
          <div class="ctdash-metrics-grid">
            ${legacyUnsupportedCard("접속수", "데이터 없음", "레거시 기준 세션 원장 없음")}
            ${legacyUnsupportedCard("검색자", "데이터 없음", "정확한 고유 사용자 계산 필요")}
            ${legacyMetricCard("검색수", model.summary, "search_count", "레거시 기준", formatNumber)}
            ${legacyMetricCard("장바구니수", model.summary, "cart_count", "레거시 기준", formatNumber)}
            ${legacyMetricCard("구매수", model.summary, "purchase_count", "레거시 기준", formatNumber)}
          </div>
        </article>
        <article class="ctdash-card ctdash-section">
          <div class="ctdash-section-head">
            <div>
              <div class="ctdash-kicker">Hourly</div>
              <h3>${currentDashChartTitle(legacyAnalysisReportPeriod)}</h3>
              <p>현재 리포트와 같은 위치에 시간/기간 흐름을 표시합니다.</p>
            </div>
            <span class="ctdash-tag">Legacy</span>
          </div>
          ${legacyChartPlaceholder("검색 / 카트 / 구매 / 매출")}
        </article>
        <div class="ctdash-two-col">
          <article class="ctdash-card ctdash-section">
            <div class="ctdash-section-head"><div><div class="ctdash-kicker">Conversion</div><h3>전환율</h3></div><span class="ctdash-tag">Percent</span></div>
            <div class="ctdash-conv-grid">
              ${metricCard("접속 → 검색", `<span class="legacy-v2-status">데이터 없음</span>`, "레거시 기준 세션 없음")}
              ${model.summary.has.search_count && model.summary.has.cart_count && model.summary.values.search_count ? conversionCard("검색 → 카트", model.summary.values.cart_count, model.summary.values.search_count) : legacyUnsupportedCard("검색 → 카트", "데이터 없음", "검색수와 장바구니수 필요")}
              ${model.summary.has.cart_count && model.summary.has.purchase_count && model.summary.values.cart_count ? conversionCard("카트 → 구매", model.summary.values.purchase_count, model.summary.values.cart_count) : legacyUnsupportedCard("카트 → 구매", "데이터 없음", "장바구니수와 구매수 필요")}
            </div>
          </article>
        </div>
        <div class="ctdash-two-col">
          <article class="ctdash-card ctdash-section">
            <div class="ctdash-section-head"><div><div class="ctdash-kicker">Traffic</div><h3>유입별</h3></div><span class="ctdash-tag">Campaign / Source</span></div>
            <div class="ctdash-sub-grid">
              ${rankSection("캠페인", [])}
              ${rankSection("소스", [])}
              ${rankSection("디바이스", [])}
              ${rankSection("OS", [])}
            </div>
          </article>
          <article class="ctdash-card ctdash-section">
            <div class="ctdash-section-head"><div><div class="ctdash-kicker">Sales</div><h3>매출</h3></div><span class="ctdash-tag">Revenue</span></div>
            <div class="ctdash-sales-grid">
              ${legacyUnsupportedCard("참가자 수", "데이터 없음", "legacy dashboard row 기준 없음")}
              ${model.summary.has.revenue && model.summary.has.purchase_count && model.summary.values.purchase_count ? metricCard("객단가", formatWon(model.summary.values.revenue / model.summary.values.purchase_count), "구매 1건당") : legacyUnsupportedCard("객단가", "데이터 없음", "매출과 구매수 필요")}
              ${legacyMetricCard("일매출", model.summary, "revenue", "선택 기간 합계", formatWon)}
              ${legacyUnsupportedCard("참가자 대비 사진 구매율", "데이터 없음", "참가자 수 기준 필요")}
            </div>
          </article>
        </div>
        ${legacyPhotoExposureUnsupportedSection()}
        ${detailTableSection("일자별 검색/구매/매출", ["일자", "검색수", "장바구니수", "구매수", "구매 사진 수", "매출"], legacyFlowTableRows(model.daily))}
        ${detailTableSection("시간대별 검색/구매", ["시간", "검색수", "장바구니수", "구매수", "구매 사진 수", "매출"], legacyFlowTableRows(model.hourly))}
        ${detailTableSection("결제 금액별 구매 분포", ["금액 구간", "검색수", "장바구니수", "구매수", "구매 사진 수", "매출"], model.hasAmountBucket ? legacyFlowTableRows(model.amountBuckets) : [["계산 필요", "계산 필요", "계산 필요", "계산 필요", "계산 필요", "sales_amount_hour 금액 구간 필드 필요"]])}
      </section>
    `;
  }

  function renderLegacyV2EventAnalysisView() {
    const model = legacyAnalysisResolvedDataSource === "legacy_snapshot" && legacyAnalysisSnapshotPayload
      ? buildLegacyV2EventAnalysisSnapshotModel(legacyAnalysisSnapshotPayload, {
          dataSource: legacyAnalysisResolvedDataSource,
          selectedEvent: legacyAnalysisSelectedEvent
        })
      : buildLegacyV2EventAnalysisModel(legacyEventRowsForSelectedPeriod(), {
          dataSource: legacyAnalysisResolvedDataSource,
          selectedEvent: legacyAnalysisSelectedEvent
        });
    const summaryRows = model.eventSummaries.map(row => [
      escapeHtml(row.event_code),
      escapeHtml(row.event_name || row.event_code),
      legacyMetricValue(row.aggregate, "search_count", formatNumber),
      legacyMetricValue(row.aggregate, "cart_count", formatNumber),
      legacyMetricValue(row.aggregate, "purchase_count", formatNumber),
      legacyMetricValue(row.aggregate, "revenue", formatWon),
      legacyMetricValue(row.aggregate, "purchase_photo_count", formatNumber),
      row.purchase_rate === null ? `<span class="legacy-v2-status">데이터 없음</span>` : formatPercent(row.purchase_rate)
    ]);
    const eventName = legacyAnalysisSelectedEvent === "all"
      ? "전체 대회"
      : legacyEventName(legacyAnalysisSelectedEvent, legacyAnalysisRows);
    return `
      ${legacyV2StatusBanner()}
      <section class="ctdash-screen">
        <article class="ctdash-card ctdash-section">
          <div class="ctdash-section-head">
            <div>
              <div class="ctdash-kicker">Event Analysis</div>
              <h3>대회별 분석</h3>
              <p>대회와 기간을 선택하면 해당 legacy dashboard row를 다시 집계합니다.</p>
            </div>
          </div>
          <div class="ctdash-event-toolbar">
            <div class="ctdash-inline-fields">${legacyEventScopeControls(model.eventSummaries)}</div>
            <div class="ctdash-period-tabs">
              <button class="ctdash-chip ${legacyAnalysisEventPeriod === "total" ? "is-active" : ""}" type="button" data-legacy-event-period="total">전체</button>
              <button class="ctdash-chip ${legacyAnalysisEventPeriod === "monthly" ? "is-active" : ""}" type="button" data-legacy-event-period="monthly">월별</button>
              <button class="ctdash-chip ${legacyAnalysisEventPeriod === "weekly" ? "is-active" : ""}" type="button" data-legacy-event-period="weekly">주차별</button>
              <button class="ctdash-chip ${legacyAnalysisEventPeriod === "daily" ? "is-active" : ""}" type="button" data-legacy-event-period="daily">일별</button>
            </div>
          </div>
        </article>
        <div class="ctdash-two-col">
          <article class="ctdash-card ctdash-section">
            <div class="ctdash-section-head"><div><div class="ctdash-kicker">Overview</div><h3>기본 요약</h3></div><span class="ctdash-tag">Legacy</span></div>
            <div class="ctdash-summary-grid">
              ${metricCard("대회명", escapeHtml(eventName), legacyAnalysisSelectedEvent === "all" ? "전체 합산" : legacyAnalysisSelectedEvent)}
              ${legacyUnsupportedCard("참가자 수", "데이터 없음", "legacy dashboard row 기준 없음")}
              ${legacyUnsupportedCard("검색자", "데이터 없음", "정확한 고유 사용자 계산 필요")}
              ${legacyUnsupportedCard("접속수", "데이터 없음", "레거시 기준 세션 원장 없음")}
              ${legacyMetricCard("검색수", model.selectedSummary, "search_count", "레거시 기준", formatNumber)}
              ${legacyMetricCard("장바구니수", model.selectedSummary, "cart_count", "레거시 기준", formatNumber)}
              ${legacyMetricCard("구매수", model.selectedSummary, "purchase_count", "레거시 기준", formatNumber)}
            </div>
          </article>
          <article class="ctdash-card ctdash-section">
            <div class="ctdash-section-head"><div><div class="ctdash-kicker">Revenue</div><h3>매출 분석</h3></div><span class="ctdash-tag">Sales</span></div>
            <div class="ctdash-sales-grid">
              ${legacyMetricCard("대회매출", model.selectedSummary, "revenue", "선택 기간 기준", formatWon)}
              ${model.selectedSummary.has.revenue && model.selectedSummary.has.purchase_count && model.selectedSummary.values.purchase_count ? metricCard("객단가", formatWon(model.selectedSummary.values.revenue / model.selectedSummary.values.purchase_count), "구매 1건당") : legacyUnsupportedCard("객단가", "데이터 없음", "매출과 구매수 필요")}
              ${legacyUnsupportedCard("참가자 대비 구매율", "데이터 없음", "참가자 수 기준 필요")}
              ${legacyMetricCard("구매사진수", model.selectedSummary, "purchase_photo_count", "purchase_photo_count", formatNumber)}
              ${legacyUnsupportedCard("참가자 대비 구매사진", "데이터 없음", "참가자 수 기준 필요")}
            </div>
          </article>
          <article class="ctdash-card ctdash-section">
            <div class="ctdash-section-head"><div><div class="ctdash-kicker">Spots</div><h3>스팟별 데이터</h3></div><span class="ctdash-tag">Legacy Unsupported</span></div>
            <div class="ctdash-spot-grid"><div class="ctdash-callout">스팟 분석은 레거시 미지원입니다.</div></div>
          </article>
        </div>
        <article class="ctdash-card ctdash-section">
          <div class="ctdash-section-head"><div><div class="ctdash-kicker">Graph</div><h3>${currentDashChartTitle(legacyAnalysisEventPeriod)}</h3></div><span class="ctdash-tag">Revenue + Search/Cart/Order</span></div>
          ${legacyChartPlaceholder("매출 / 검색 / 카트 / 오더")}
        </article>
        ${detailTableSection("대회별 event_code 요약", ["event_code", "대회명", "검색수", "장바구니수", "구매수", "매출", "구매 사진 수", "구매전환율"], summaryRows)}
        ${detailTableSection("선택 대회 일자별 흐름", ["일자", "검색수", "장바구니수", "구매수", "구매 사진 수", "매출"], legacyFlowTableRows(model.daily))}
        ${detailTableSection("선택 대회 시간대별 흐름", ["시간", "검색수", "장바구니수", "구매수", "구매 사진 수", "매출"], legacyFlowTableRows(model.hourly))}
        ${legacyPhotoExposureUnsupportedSection()}
      </section>
    `;
  }

  function renderLegacyAnalysisV2() {
    const mount = $("#legacy_analysis_v2_content");
    if (!mount) return;
    if (legacyAnalysisLoadState === "loading") {
      mount.innerHTML = `<div class="ctdash-fallback-screen"><div class="ctdash-card ctdash-section"><h3>레거시 분석 v2 로딩 중</h3><p>legacy_snapshot dashboard_snapshot을 확인하고 있습니다.</p></div></div>`;
      return;
    }
    if (legacyAnalysisLoadState === "error") {
      mount.innerHTML = `<div class="ctdash-fallback-screen"><div class="ctdash-card ctdash-section"><h3>레거시 분석 v2 로드 실패</h3><p>${escapeHtml(legacyAnalysisError || "알 수 없는 오류")}</p><button class="sh-btn-sm" type="button" id="legacy_analysis_refresh_btn">다시 불러오기</button></div></div>`;
      return;
    }
    const body = legacyAnalysisView === "event-analysis" ? renderLegacyV2EventAnalysisView() : renderLegacyV2ReportView();
    mount.innerHTML = `
      <div class="legacy-v2-shell">
        <div class="legacy-v2-subtabs" role="tablist" aria-label="Legacy analysis v2 views">
          <button class="sh-admin-tab tab-btn ${legacyAnalysisView === "report" ? "is-active" : ""}" type="button" data-legacy-analysis-view="report">리포트</button>
          <button class="sh-admin-tab tab-btn ${legacyAnalysisView === "event-analysis" ? "is-active" : ""}" type="button" data-legacy-analysis-view="event-analysis">대회별 분석</button>
          <button class="sh-btn-sm" type="button" id="legacy_analysis_refresh_btn">데이터 새로고침</button>
        </div>
        ${body}
      </div>
    `;
  }

  function legacyStatusArray(payload, key) {
    const sources = [payload, payload && payload.summary, payload && payload.meta, payload && payload.state];
    for (let i = 0; i < sources.length; i += 1) {
      const source = sources[i];
      if (source && Array.isArray(source[key])) return source[key];
    }
    return [];
  }

  function legacyAvailableDateKeys(statusPayload) {
    const explicit = legacyStatusArray(statusPayload, "date_keys")
      .map(value => String(value || "").slice(0, 10))
      .filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value));
    const keys = explicit.length ? explicit : legacyStatusArray(statusPayload, "snapshot_keys")
      .concat(legacyStatusArray(statusPayload, "agg_keys"))
      .map(value => String(value || "").match(/:(?:report_daily|event_daily):[^:]+:(\d{4}-\d{2}-\d{2})$/))
      .filter(Boolean)
      .map(match => match[1]);
    return Array.from(new Set(keys)).sort();
  }

  function legacyClosestAvailableDateKey(dateKey) {
    const dates = legacyAvailableDateKeys(legacyAnalysisStatusSnapshot);
    if (!dates.length) return dateKey || yesterdayKSTDateKey();
    const selected = String(dateKey || "");
    if (dates.includes(selected)) return selected;
    const previous = dates.filter(key => !selected || key <= selected).pop();
    return previous || dates[dates.length - 1];
  }

  function syncLegacyDailySelectionKeys(viewName) {
    if (viewName === "event-analysis") {
      if (legacyAnalysisEventPeriod !== "daily") return;
      legacyAnalysisEventSelectedDateKey = legacyClosestAvailableDateKey(legacyAnalysisEventSelectedDateKey);
      legacyAnalysisEventSelectedMonthKey = monthKeyFromDateKey(legacyAnalysisEventSelectedDateKey);
      legacyAnalysisEventSelectedWeekKey = sotWeekKeyFromDateKey(legacyAnalysisEventSelectedDateKey);
      return;
    }
    if (legacyAnalysisReportPeriod !== "daily") return;
    legacyAnalysisReportSelectedDateKey = legacyClosestAvailableDateKey(legacyAnalysisReportSelectedDateKey);
    legacyAnalysisReportSelectedMonthKey = monthKeyFromDateKey(legacyAnalysisReportSelectedDateKey);
    legacyAnalysisReportSelectedWeekKey = sotWeekKeyFromDateKey(legacyAnalysisReportSelectedDateKey);
  }

  function applyLegacySnapshotStatusDefaults(statusPayload) {
    if (legacyAnalysisInitialPeriodResolved) return;
    const dateKeys = legacyAvailableDateKeys(statusPayload);
    const latestDate = dateKeys[dateKeys.length - 1];
    if (!latestDate) {
      legacyAnalysisInitialPeriodResolved = true;
      return;
    }
    const latestMonth = latestDate.slice(0, 7);
    const latestWeek = sotWeekKeyFromDateKey(latestDate);
    legacyAnalysisReportSelectedDateKey = latestDate;
    legacyAnalysisReportSelectedMonthKey = latestMonth;
    legacyAnalysisReportSelectedWeekKey = latestWeek;
    legacyAnalysisEventSelectedDateKey = latestDate;
    legacyAnalysisEventSelectedMonthKey = latestMonth;
    legacyAnalysisEventSelectedWeekKey = latestWeek;
    legacyAnalysisInitialPeriodResolved = true;
  }

  async function ensureLegacySnapshotStatusDefaults() {
    if (legacyAnalysisInitialPeriodResolved) return;
    try {
      const status = await SOT_HEAD.fetchDashboardSnapshot({
        dataSource: "legacy_snapshot",
        snapshotType: "snapshot_status",
        periodKey: "latest",
        eventCode: "all",
        tab: "legacy-analysis-v2"
      });
      if (status && status.ok) {
        legacyAnalysisStatusSnapshot = status;
        applyLegacySnapshotStatusDefaults(status);
      } else {
        legacyAnalysisInitialPeriodResolved = true;
      }
    } catch (error) {
      console.warn("[SOT Legacy Analysis V2] snapshot_status default resolve failed", error);
      legacyAnalysisInitialPeriodResolved = true;
    }
  }

  async function loadLegacyAnalysisV2() {
    legacyAnalysisLoadState = "loading";
    legacyAnalysisError = "";
    renderLegacyAnalysisV2();
    try {
      await ensureLegacySnapshotStatusDefaults();
      syncLegacyDailySelectionKeys(legacyAnalysisView);
      if (legacyAnalysisView === "event-analysis" && !legacyAnalysisSelectedEvent) {
        try {
          const eventList = await SOT_HEAD.fetchDashboardSnapshot({
            dataSource: "legacy_snapshot",
            snapshotType: "event_list",
            periodKey: "latest",
            eventCode: "all",
            tab: "event-analysis"
          });
          legacyAnalysisEventListRows = eventList && eventList.ok ? legacyRowsFromSnapshot(eventList).filter(row => row.agg_type === "event_summary") : [];
          legacyAnalysisSelectedEvent = legacyDefaultEventCode(legacyAnalysisEventListRows);
        } catch (_) {
          legacyAnalysisSelectedEvent = "all";
        }
      }
      const snapshotType = legacySnapshotTypeForView(legacyAnalysisView);
      const periodKey = legacySnapshotPeriodKeyForView(legacyAnalysisView);
      const eventCode = legacyAnalysisView === "event-analysis" ? (legacyAnalysisSelectedEvent || "all") : "all";
      const snapshot = await SOT_HEAD.fetchDashboardSnapshot({
        dataSource: "legacy_snapshot",
        snapshotType,
        periodKey,
        eventCode,
        tab: legacyAnalysisView
      });
      if (snapshot && snapshot.ok) {
        legacyAnalysisSnapshotPayload = snapshot;
        legacyAnalysisRows = legacyRowsFromSnapshot(snapshot);
        legacyAnalysisByAggType = groupLegacyRowsByAggType(legacyAnalysisRows);
        legacyAnalysisResolvedDataSource = "legacy_snapshot";
        legacyAnalysisFallbackReason = "";
        if (legacyAnalysisView === "event-analysis") {
          try {
            const eventList = await SOT_HEAD.fetchDashboardSnapshot({
              dataSource: "legacy_snapshot",
              snapshotType: "event_list",
              periodKey: "latest",
              eventCode: "all",
              tab: "event-analysis"
            });
            legacyAnalysisEventListRows = eventList && eventList.ok ? legacyRowsFromSnapshot(eventList).filter(row => row.agg_type === "event_summary") : [];
          } catch (_) {
            legacyAnalysisEventListRows = [];
          }
        }
        legacyAnalysisLoadState = "ready";
        renderLegacyAnalysisV2();
        return;
      }
      const backfillRows = await SOT_HEAD.fetchDashboardRowsForDataSource(BUBBLE_API_BASE, "legacy_backfill");
      const backfillByAgg = groupLegacyRowsByAggType(backfillRows);
      if (legacyBackfillHasDisplayRows(backfillByAgg)) {
        legacyAnalysisRows = backfillRows;
        legacyAnalysisByAggType = backfillByAgg;
        legacyAnalysisResolvedDataSource = "legacy_backfill";
        legacyAnalysisSnapshotPayload = null;
        legacyAnalysisFallbackReason = "legacy_snapshot 미생성, legacy_backfill row 기준";
      } else {
        const legacyRows = await SOT_HEAD.fetchDashboardRowsForDataSource(BUBBLE_API_BASE, "legacy");
        legacyAnalysisRows = legacyRows;
        legacyAnalysisByAggType = groupLegacyRowsByAggType(legacyRows);
        legacyAnalysisResolvedDataSource = "legacy";
        legacyAnalysisSnapshotPayload = null;
        legacyAnalysisFallbackReason = "legacy_snapshot/legacy_backfill 미생성 또는 표시 가능한 집계 부족, legacy 집계 기준";
      }
      legacyAnalysisLoadState = "ready";
      renderLegacyAnalysisV2();
    } catch (e) {
      console.error("[SOT Legacy Analysis V2] load failed", e);
      legacyAnalysisLoadState = "error";
      legacyAnalysisError = e && e.message ? e.message : String(e || "로드 실패");
      renderLegacyAnalysisV2();
    }
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
    return normalizeCurrentDashDateKey(row?.date_key || row?.period_key || row?.label || "");
  }

  function shortDateLabel(value) {
    const dateKey = normalizeCurrentDashDateKey(value);
    const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return String(value || "");
    return `${Number(match[2])}/${Number(match[3])}`;
  }

  function shortMonthLabel(value) {
    const text = String(value || "");
    const match = text.match(/^(\d{4})-(\d{2})/);
    if (!match) return text;
    return `${Number(match[2])}월`;
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
    return `${shortDateLabel(startKey)}~${shortDateLabel(endKey)}`;
  }

  function dailyHourChartRowsFromDataset(dataset) {
    return aggregateMetricRows(dataset.hourly || [], currentDashHourBucket, (row, key) => key)
      .map(chartPointFromAggregate);
  }

  function dailyDateChartRowsFromDataset(dataset) {
    return aggregateMetricRows(dataset.daily || [], currentDashDateKey, (row, key) => shortDateLabel(key))
      .map(chartPointFromAggregate);
  }

  function weeklyChartRowsFromDataset(dataset) {
    return aggregateMetricRows(dataset.daily || [], row => saturdayStartDateKey(currentDashDateKey(row)), (row, key) => weekRangeLabelFromDateKey(key))
      .map(chartPointFromAggregate);
  }

  function monthlyChartRowsFromDataset(dataset) {
    return aggregateMetricRows(dataset.daily || [], row => String(currentDashDateKey(row)).slice(0, 7), (row, key) => shortMonthLabel(key))
      .map(chartPointFromAggregate);
  }

  function chartRowsForPeriod(dataset, period, totalChartPeriod) {
    if (period === "weekly") return dailyDateChartRowsFromDataset(dataset);
    if (period === "monthly") return weeklyChartRowsFromDataset(dataset);
    if (period === "total") {
      if (totalChartPeriod === "weekly") return weeklyChartRowsFromDataset(dataset);
      if (totalChartPeriod === "monthly") return monthlyChartRowsFromDataset(dataset);
      return dailyDateChartRowsFromDataset(dataset);
    }
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
    return chartRowsForPeriod(sotCurrentTestData, currentDashReportPeriod, currentDashReportTotalChartPeriod);
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
	        <div class="ctdash-tooltip-row"><span>구매 배번호수</span><b>${formatNumber(row.purchaseBibCount)}</b></div>
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
    const spotsConfig = document.getElementById(`edit_spots_config_json_${id}`);
    const spotsConfigText = spotsConfig && spotsConfig.value ? spotsConfig.value.trim() : "";
    if (spotsConfigText) {
      try {
        const parsed = JSON.parse(spotsConfigText);
        if (!Array.isArray(parsed)) {
          alert("스팟 설정 JSON은 배열 형태여야 합니다.");
          return;
        }
      } catch (error) {
        alert("스팟 설정 JSON 형식이 올바르지 않습니다.");
        return;
      }
    }

    const payload = {
      event_date: kstDateInputToISO(eventDate && eventDate.value),
      event_display_name: (displayName && displayName.value.trim()) || "",
      event_code: (eventCode && eventCode.value.trim()) || "",
      publish_at: kstDateTimeInputToISO(publishAt && publishAt.value),
      name_search_enabled: nameSearch && nameSearch.value === "true",
      is_public: isPublic && isPublic.value === "true",
      spots_config_json: spotsConfigText
    };
    applyPeoplePayload(payload, people && people.value);

    Object.keys(payload).forEach(key => {
      if (key === "spots_config_json") return;
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

  function activateAdminView(viewName) {
    const groupByView = {
      events: "events",
      diary: "operations",
      "diary-view": "operations",
      "photographer-view": "operations",
      report: "analysis",
      "event-analysis": "analysis",
      legacy: "analysis",
      "legacy-analysis-v2": "analysis"
    };
    activeAdminView = viewName;
    activeAdminGroup = groupByView[viewName] || "events";
    if (["report", "event-analysis", "diary", "diary-view", "photographer-view"].includes(activeAdminView)) currentDashView = activeAdminView;
    syncAdminView();
    if (activeAdminView === "legacy") renderSotDashboard();
    if (activeAdminView === "legacy-analysis-v2") {
          renderLegacyAnalysisV2();
          if (legacyAnalysisLoadState === "idle") loadLegacyAnalysisV2();
    }
    if (["report", "event-analysis"].includes(activeAdminView)) {
          renderCurrentTestDashboard();
          if (!sotCurrentTestLoading) loadCurrentTestDashboard();
    }
    if (activeAdminView === "diary") {
          renderCurrentTestDashboard();
          void loadFieldReportSourcesForActiveDraft();
    }
    if (activeAdminView === "diary-view") {
      renderCurrentTestDashboard();
    }
    if (activeAdminView === "photographer-view") {
      renderCurrentTestDashboard();
      if (photographerReportHistoryEventsState.state === "idle") {
        void loadPhotographerReportHistoryEvents(false);
      }
    }
  }

  function bindEvents(){
    document.querySelectorAll("[data-admin-group]").forEach(btn => {
      btn.addEventListener("click", () => {
        const defaultViewByGroup = { events: "events", operations: "diary", analysis: "report" };
        activateAdminView(defaultViewByGroup[btn.dataset.adminGroup] || "events");
      });
    });

    document.querySelectorAll("[data-admin-view]").forEach(btn => {
      btn.addEventListener("click", () => {
        activateAdminView(btn.dataset.adminView);
      });
    });

    document.addEventListener("click", async function(e) {
      const photographerActionButton = e.target.closest("[data-prh-action]");
      if (photographerActionButton?.dataset.prhAction === "refresh") {
        if (photographerReportHistoryEventsState.state === "error") {
          void loadPhotographerReportHistoryEvents(true);
        } else if (photographerReportHistoryEventCode) {
          void loadPhotographerReportHistory(photographerReportHistoryEventCode);
        }
        return;
      }
      const photographerFilterButton = e.target.closest("[data-prh-filter]");
      if (photographerFilterButton) {
        photographerReportHistoryFilter = photographerFilterButton.dataset.prhFilter || "all";
        renderCurrentTestDashboard();
        return;
      }
      const photographerReportButton = e.target.closest("[data-prh-report]");
      if (photographerReportButton) {
        photographerReportHistoryReportId = photographerReportButton.dataset.prhReport || "";
        renderCurrentTestDashboard();
        return;
      }
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

      const legacyAnalysisRefreshButton = e.target.closest("#legacy_analysis_refresh_btn");
      if (legacyAnalysisRefreshButton) {
        loadLegacyAnalysisV2();
        return;
      }

      const legacyAnalysisViewButton = e.target.closest("[data-legacy-analysis-view]");
      if (legacyAnalysisViewButton) {
        legacyAnalysisView = legacyAnalysisViewButton.dataset.legacyAnalysisView || "report";
        loadLegacyAnalysisV2();
        return;
      }

      const legacyReportPeriodButton = e.target.closest("[data-legacy-report-period]");
      if (legacyReportPeriodButton) {
        legacyAnalysisReportPeriod = legacyReportPeriodButton.dataset.legacyReportPeriod || "total";
        syncLegacyDailySelectionKeys("report");
        loadLegacyAnalysisV2();
        return;
      }

      const legacyEventPeriodButton = e.target.closest("[data-legacy-event-period]");
      if (legacyEventPeriodButton) {
        legacyAnalysisEventPeriod = legacyEventPeriodButton.dataset.legacyEventPeriod || "total";
        syncLegacyDailySelectionKeys("event-analysis");
        loadLegacyAnalysisV2();
        return;
      }

      const fieldReportAction = e.target.closest("[data-fr-action]");
      if (fieldReportAction) {
        const action = fieldReportAction.dataset.frAction;
        if (action === "save") {
          if (fieldReportSaving) return;
          fieldReportSaving = true;
          fieldReportSaveMessage = "저장 요청을 보내는 중입니다.";
          renderCurrentTestDashboard();
          try {
            saveFieldReportTest();
            const saved = await realSaveFieldReportTest();
            fieldReportSaveMessage = `저장 완료 · ${saved.display_version || `v1.${Math.max(Number(saved.version || 1) - 1, 0)}`} · Bubble에 기록되었습니다.`;
          } catch (error) {
            console.error("[Admin Field Report] save failed", error);
            fieldReportSaveMessage = `저장 실패 · ${error?.message || "잠시 후 다시 시도해 주세요."}`;
          } finally {
            fieldReportSaving = false;
            renderCurrentTestDashboard();
          }
        }
        if (action === "toggle-json") {
          fieldReportShowJson = !fieldReportShowJson;
          renderCurrentTestDashboard();
        }
        if (action === "reset") {
          resetFieldReportTestDraft();
        }
        return;
      }

      const fieldReportHistoryAction = e.target.closest("[data-fr-history-action]");
      if (fieldReportHistoryAction?.dataset.frHistoryAction === "retry" && fieldReportHistoryEventCode) {
        void loadFieldReportHistory(fieldReportHistoryEventCode);
        return;
      }

      const participantAdd = e.target.closest("[data-fr-participant-add]");
      if (participantAdd) {
        const select = document.querySelector("#field_report_participant_select");
        const name = String(select?.value || "").trim();
        const participants = selectedFieldReportDraft().report_json.meta.participant_staff || [];
        if (name && !participants.includes(name)) participants.push(name);
        selectedFieldReportDraft().report_json.meta.participant_staff = participants;
        updateFieldReportDerivedValues(selectedFieldReportDraft());
        renderCurrentTestDashboard();
        return;
      }

      const participantRemove = e.target.closest("[data-fr-participant-remove]");
      if (participantRemove) {
        const name = participantRemove.dataset.frParticipantRemove || "";
        const participants = selectedFieldReportDraft().report_json.meta.participant_staff || [];
        selectedFieldReportDraft().report_json.meta.participant_staff = participants.filter(item => item !== name);
        updateFieldReportDerivedValues(selectedFieldReportDraft());
        renderCurrentTestDashboard();
        return;
      }

      const fieldReportAdd = e.target.closest("[data-fr-add]");
      if (fieldReportAdd) {
        addFieldReportRow(fieldReportAdd.dataset.frAdd);
        return;
      }

      const fieldReportDelete = e.target.closest("[data-fr-delete]");
      if (fieldReportDelete) {
        deleteFieldReportRow(fieldReportDelete.dataset.frDelete, fieldReportDelete.dataset.frIndex);
        return;
      }

      const reportChartPeriodButton = e.target.closest("[data-ctdash-report-chart-period]");
      if (reportChartPeriodButton) {
        currentDashReportTotalChartPeriod = reportChartPeriodButton.dataset.ctdashReportChartPeriod || "daily";
        renderCurrentTestDashboard();
        return;
      }

      const reportPeriodButton = e.target.closest("[data-ctdash-report-period]");
      if (reportPeriodButton) {
        currentDashReportPeriod = reportPeriodButton.dataset.ctdashReportPeriod || "total";
        syncCurrentDashPeriodKeys();
        invalidateCurrentDashReportCache();
        loadCurrentTestDashboard();
        renderCurrentTestDashboard();
        return;
      }

      const eventPeriodButton = e.target.closest("[data-ctdash-event-period]");
      if (eventPeriodButton) {
        currentDashEventPeriod = eventPeriodButton.dataset.ctdashEventPeriod || "total";
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
	      if (e.target && e.target.id === "photographer_report_history_event_select") {
	        photographerReportHistoryEventCode = String(e.target.value || "").trim();
	        photographerReportHistoryReportId = "";
	        photographerReportHistoryFilter = "all";
	        photographerReportHistorySort = "latest";
	        renderCurrentTestDashboard();
	        if (photographerReportHistoryEventCode) void loadPhotographerReportHistory(photographerReportHistoryEventCode);
	        return;
	      }
	      if (e.target && e.target.id === "photographer_report_history_sort") {
	        photographerReportHistorySort = String(e.target.value || "latest");
	        renderCurrentTestDashboard();
	        return;
	      }
	      if (e.target && e.target.id === "field_report_history_event_select") {
	        fieldReportHistoryEventCode = String(e.target.value || "").trim();
	        fieldReportHistoryVersion = null;
	        renderCurrentTestDashboard();
	        if (fieldReportHistoryEventCode) void loadFieldReportHistory(fieldReportHistoryEventCode);
	        return;
	      }
	      if (e.target && e.target.id === "field_report_history_version_select") {
	        fieldReportHistoryVersion = Number(e.target.value) || null;
	        renderCurrentTestDashboard();
	        return;
	      }
	      if (e.target && e.target.id === "field_report_event_select") {
	        fieldReportActiveId = e.target.value || "";
	        renderCurrentTestDashboard();
	        void loadFieldReportSourcesForActiveDraft();
	        return;
	      }
	      if (e.target && e.target.id === "field_report_draft_select") {
	        fieldReportActiveId = e.target.value || "";
	        renderCurrentTestDashboard();
	        return;
	      }
	      if (e.target && e.target.matches(".fr-input,.fr-table-input")) {
	        setFieldReportValue(e.target.dataset.frPath, e.target.type === "checkbox" ? e.target.checked : e.target.value);
	        if (["daily_summary.actual_count_check", "meta.operation_result", "meta.upload_completion_status"].includes(e.target.dataset.frPath)) renderCurrentTestDashboard();
	        return;
	      }
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
      if (e.target && e.target.id === "legacy_analysis_event_select") {
        legacyAnalysisSelectedEvent = e.target.value || "all";
        loadLegacyAnalysisV2();
        return;
      }
      if (e.target && e.target.id === "legacy_report_date_input") {
        legacyAnalysisReportSelectedDateKey = e.target.value || yesterdayKSTDateKey();
        legacyAnalysisReportSelectedWeekKey = sotWeekKeyFromDateKey(legacyAnalysisReportSelectedDateKey);
        legacyAnalysisReportSelectedMonthKey = monthKeyFromDateKey(legacyAnalysisReportSelectedDateKey);
        loadLegacyAnalysisV2();
        return;
      }
      if (e.target && e.target.id === "legacy_report_week_month_input") {
        legacyAnalysisReportSelectedMonthKey = e.target.value || monthKeyFromDateKey(todayKSTDateKey());
        const picked = pickWeekForMonth(legacyAnalysisReportSelectedMonthKey, legacyAnalysisReportSelectedWeekKey, legacyAnalysisReportSelectedDateKey);
        legacyAnalysisReportSelectedWeekKey = picked.week_key;
        legacyAnalysisReportSelectedDateKey = picked.start_date_key;
        loadLegacyAnalysisV2();
        return;
      }
      if (e.target && e.target.id === "legacy_report_week_select") {
        legacyAnalysisReportSelectedWeekKey = e.target.value || "";
        const picked = pickWeekForMonth(legacyAnalysisReportSelectedMonthKey, legacyAnalysisReportSelectedWeekKey, legacyAnalysisReportSelectedDateKey);
        legacyAnalysisReportSelectedDateKey = picked.start_date_key;
        loadLegacyAnalysisV2();
        return;
      }
      if (e.target && e.target.id === "legacy_report_month_input") {
        legacyAnalysisReportSelectedMonthKey = e.target.value || monthKeyFromDateKey(todayKSTDateKey());
        legacyAnalysisReportSelectedDateKey = `${legacyAnalysisReportSelectedMonthKey}-01`;
        loadLegacyAnalysisV2();
        return;
      }
      if (e.target && e.target.id === "legacy_event_date_input") {
        legacyAnalysisEventSelectedDateKey = e.target.value || yesterdayKSTDateKey();
        legacyAnalysisEventSelectedWeekKey = sotWeekKeyFromDateKey(legacyAnalysisEventSelectedDateKey);
        legacyAnalysisEventSelectedMonthKey = monthKeyFromDateKey(legacyAnalysisEventSelectedDateKey);
        loadLegacyAnalysisV2();
        return;
      }
      if (e.target && e.target.id === "legacy_event_week_month_input") {
        legacyAnalysisEventSelectedMonthKey = e.target.value || monthKeyFromDateKey(todayKSTDateKey());
        const picked = pickWeekForMonth(legacyAnalysisEventSelectedMonthKey, legacyAnalysisEventSelectedWeekKey, legacyAnalysisEventSelectedDateKey);
        legacyAnalysisEventSelectedWeekKey = picked.week_key;
        legacyAnalysisEventSelectedDateKey = picked.start_date_key;
        loadLegacyAnalysisV2();
        return;
      }
      if (e.target && e.target.id === "legacy_event_week_select") {
        legacyAnalysisEventSelectedWeekKey = e.target.value || "";
        const picked = pickWeekForMonth(legacyAnalysisEventSelectedMonthKey, legacyAnalysisEventSelectedWeekKey, legacyAnalysisEventSelectedDateKey);
        legacyAnalysisEventSelectedDateKey = picked.start_date_key;
        loadLegacyAnalysisV2();
        return;
      }
      if (e.target && e.target.id === "legacy_event_month_input") {
        legacyAnalysisEventSelectedMonthKey = e.target.value || monthKeyFromDateKey(todayKSTDateKey());
        legacyAnalysisEventSelectedDateKey = `${legacyAnalysisEventSelectedMonthKey}-01`;
        loadLegacyAnalysisV2();
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
	    document.addEventListener("input", e => {
	      if (e.target && e.target.matches(".fr-input,.fr-table-input")) {
	        setFieldReportValue(e.target.dataset.frPath, e.target.type === "checkbox" ? e.target.checked : e.target.value);
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
          ensureFieldReportDraftForEvent({
            event_code: payload.event_code,
            event_display_name: payload.event_display_name,
            event_date: payload.event_date
          });
          writeStoredFieldReports();
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
