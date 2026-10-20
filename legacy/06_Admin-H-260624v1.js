<script>
(function(){
  if (window.SotAdminHead) return;

  const API_DASHBOARD_DATA_LIVE = "/api/1.1/obj/SOT:Dashboard";
  const API_DASHBOARD_DATA_TEST = "/version-test/api/1.1/obj/SOT:Dashboard";
  const DASHBOARD_PAGE_LIMIT = 500;
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
    const testPrefix = String(window.location.pathname || "").indexOf("/version-test") === 0 ? "/version-test" : "";
    return {
      url: opts.proxyUrl || testPrefix + SOT_ADMIN_DASHBOARD_PROXY_PATH,
      data_source: opts.data_source || "current_test"
    };
  }

  async function fetchDashboardProxy(mode, options) {
    const opts = options || {};
    const config = getDashboardApiConfig(opts);
    const payload = {
      mode,
      data_source: config.data_source
    };

    ["period", "start_date", "end_date", "agg_type"].forEach(key => {
      if (opts[key] !== undefined && opts[key] !== null && opts[key] !== "") payload[key] = opts[key];
    });
    // Cloud Run treats an omitted event_code as the all-events query.
    if (opts.event_code) payload.event_code = opts.event_code;

    const res = await fetch(config.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    let response = {};
    try {
      response = text ? JSON.parse(text) : {};
    } catch (error) {
      throw new Error("SOT Admin Dashboard proxy returned invalid JSON");
    }
    if (!res.ok || response.ok === false) {
      const message = response.error || response.message || "SOT Admin Dashboard proxy failed: " + res.status;
      throw new Error(message);
    }
    return response;
  }

  function fetchDashboardSummaryFromCloudRun(options) {
    return fetchDashboardProxy("dashboard_summary", options);
  }

  function fetchDashboardDetailFromCloudRun(options) {
    return fetchDashboardProxy("dashboard_detail", options);
  }

  function normalizeCloudRunDashboardPayload(payload) {
    const root = unwrapDashboardProxyPayload(payload);
    const data = emptyDashboardData();
    const summary = root.summary || {};
    const source = root.data_source || "current_test";

    data.generated_at = root.generated_at || "";
    data.state = normalizeMetricRow(Object.assign({
      agg_type: "state",
      data_source: source,
      event_code: root.event_code || "all"
    }, summary));
    data.events = [{ event_code:"all", event_name:"전체 대회" }].concat((root.events || []).map(row => Object.assign({}, row, {
      event_code: row.event_code || row.code || "unknown",
      event_name: row.event_name || row.event_display_name || row.event_code || row.code || "unknown"
    })));
    data.hourly = (root.hourly || []).map(normalizeMetricRow);
    data.daily = (root.daily || []).map(normalizeMetricRow);
    data.event_summaries = (root.events || []).map(normalizeMetricRow);
    data.sources = (root.sources || []).map(normalizeMetricRow);
    data.campaigns = (root.campaigns || []).map(normalizeMetricRow);
    data.devices = (root.devices || []).map(normalizeMetricRow);
    data.searchTypes = buildSearchTypes(data.state);
    data.exposures = buildExposures(data.state);
    data.carts = buildCartRows(data.state);
    data.quality = buildQualityRows(data.state);
    return data;
  }

  function unwrapDashboardProxyPayload(payload) {
    let value = payload || {};
    for (let depth = 0; depth < 3; depth += 1) {
      if (typeof value === "string") {
        try { value = JSON.parse(value); } catch (error) { return {}; }
        continue;
      }
      if (value && value.response !== undefined) {
        value = value.response;
        continue;
      }
      if (value && value.result !== undefined) {
        value = value.result;
        continue;
      }
      break;
    }
    return value;
  }

  function groupByAggType(rows) {
    return (rows || []).reduce((acc, row) => {
      const key = String((row && row.agg_type) || "unknown").trim() || "unknown";
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {});
  }

  function buildDashboardData(rows, byAggType, eventCode) {
    const data = emptyDashboardData();
    data.generated_at = newestRowDate(rows);
    data.events = buildEventOptions(rows, data.state);
    const allHourly = sortByPeriodKey(byAggType.event_hour || []).map(normalizeMetricRow);
    const selectedHourly = eventCode ? allHourly.filter(row => row.event_code === eventCode) : allHourly;
    const stateRow = findStateRow(byAggType.state || [], eventCode) || {};
    const stateMetrics = hasMetricValues(stateRow) ? normalizeMetricRow(stateRow) : null;
    data.state = stateMetrics || aggregateMetricRows(selectedHourly, {
      event_code: eventCode || "all",
      event_name: eventCode ? eventCode : "전체 대회",
      agg_type: "state",
      data_source: "legacy"
    });
    data.hourly = selectedHourly;
    data.daily = groupMetricRows(selectedHourly, row => dateKey(row), key => ({
      label: key,
      period_key: key,
      date_key: key,
      agg_type: "event_day",
      data_source: "legacy"
    }));
    data.event_summaries = groupMetricRows(allHourly, row => row.event_code || "unknown", key => ({
      label: key,
      event_code: key,
      event_name: key,
      agg_type: "event_summary",
      data_source: "legacy"
    })).sort((a, b) => b.search_count - a.search_count || b.revenue - a.revenue || String(a.event_code).localeCompare(String(b.event_code)));
    data.ranges = sortByRangeStart(byAggType.query_range || []).map(normalizeMetricRow).filter(row => !eventCode || row.event_code === eventCode);
    data.sales_amount_hour = sortByPeriodKey(byAggType.sales_amount_hour || []).map(normalizeMetricRow).filter(row => !eventCode || row.event_code === eventCode);
    data.sources = groupOpenAggRows(normalizeOpenAggRows(byAggType.source || byAggType.utm_source || [], ["utm_source", "source"]), row => row.utm_source || row.label || "unknown_source", key => ({ label:key, utm_source:key, agg_type:"source_summary" }));
    data.campaigns = groupOpenAggRows(normalizeOpenAggRows(byAggType.campaign || byAggType.utm_campaign || [], ["utm_campaign", "campaign"]), row => row.utm_campaign || row.label || "unknown_campaign", key => ({ label:key, utm_campaign:key, agg_type:"campaign_summary" }));
    data.devices = groupOpenAggRows(normalizeOpenAggRows(byAggType.device || [], ["device", "device_type"]), row => row.device_type || row.device || row.label || "unknown_device", key => ({ label:key, device:key, device_type:key, agg_type:"device_summary" }));
    data.searchTypes = buildSearchTypes(data.state);
    data.exposures = buildExposures(data.state);
    data.queries = data.ranges;
    data.carts = buildCartRows(data.state);
    data.products = [];
    data.spots = normalizeOpenAggRows(byAggType.spot || [], ["spot", "spot_code"]);
    data.course_ranges = data.ranges;
    data.quality = buildQualityRows(data.state);
    data.payment_failures = [];
    return data;
  }

  function findStateRow(rows, eventCode) {
    const candidates = (rows || []).filter(row => !eventCode || row.event_code === eventCode);
    return candidates.sort((a, b) => String(b["Modified Date"] || b.modified_date || b.created_date || b._id || "").localeCompare(String(a["Modified Date"] || a.modified_date || a.created_date || a._id || "")))[0] || null;
  }

  function newestRowDate(rows) {
    const dates = (rows || [])
      .map(row => row && (row["Modified Date"] || row.modified_date || row.created_date || row["Created Date"]))
      .filter(Boolean)
      .sort();
    return dates[dates.length - 1] || "";
  }

  function buildEventOptions(rows, state) {
    const eventRows = (rows || []).filter(row => row && row.agg_type === "event_hour");
    const sourceRows = eventRows.length ? eventRows : (rows || []);
    const codes = Array.from(new Set(sourceRows.map(row => row && row.event_code).filter(Boolean))).sort();
    const options = [{ event_code:"all", event_name:"전체 대회" }];
    codes.forEach(code => options.push({ event_code:code, event_name:code }));
    if (state && state.event_code && !codes.includes(state.event_code)) options.push({ event_code:state.event_code, event_name:state.event_code });
    return options;
  }

  function normalizeMetricRow(row) {
    const search = numberValue(row, ["search_count", "search", "searches"]);
    const cart = numberValue(row, ["cart_count", "cart", "carts"]);
    const cartPhoto = numberValue(row, ["cart_photo_count", "cart_photos"]);
    const purchase = numberValue(row, ["purchase_count", "purchase", "purchases"]);
    const purchasePhoto = numberValue(row, ["purchase_photo_count", "sold_photo_count", "sold_photo"]);
    const revenue = numberValue(row, ["revenue", "amount", "sales_amount"]);
    const rowDateKey = stringValue(row, ["date_key"]);
    const rowHourKey = stringValue(row, ["hour_key"]);
    const periodKey = stringValue(row, ["period_key"]) || (rowDateKey && rowHourKey ? rowDateKey + " " + String(rowHourKey).padStart(2, "0") + ":00" : "") || rowDateKey || rowHourKey || stringValue(row, ["agg_key"]);
    const rangeStart = numberOrNull(stringValue(row, ["range_start", "bib_start"]));
    const rangeEnd = numberOrNull(stringValue(row, ["range_end", "bib_end"]));
    const label = periodKey || rangeLabel({ range_start: rangeStart, range_end: rangeEnd }) || stringValue(row, ["label", "range_label", "spot_name", "prefix", "device_type", "utm_source", "agg_key"]) || "-";
    return {
      ...row,
      event_code: row.event_code || "",
      data_source: row.data_source || "",
      label,
      period_key: periodKey,
      date_key: rowDateKey || dateKey({ period_key: periodKey }),
      hour_key: rowHourKey,
      range_start: rangeStart,
      range_end: rangeEnd,
      search_count: search,
      cart_count: cart,
      cart_photo_count: cartPhoto,
      purchase_count: purchase,
      purchase_photo_count: purchasePhoto,
      revenue,
      exposure_sum: numberValue(row, ["exposure_sum"]),
      exposure_count: numberValue(row, ["exposure_count"]),
      zero_exposure_count: numberValue(row, ["zero_exposure_count"]),
      conversion_rate: rateValue(row, ["conversion_rate"], purchase, search),
      cart_rate: rateValue(row, ["cart_rate"], cart, search),
      purchase_rate: rateValue(row, ["purchase_rate"], purchase, search)
    };
  }

  function metricFieldNames() {
    return [
      "search_count",
      "cart_count",
      "cart_photo_count",
      "purchase_count",
      "purchase_photo_count",
      "revenue",
      "exposure_sum",
      "exposure_count",
      "zero_exposure_count"
    ];
  }

  function sessionFieldNames() {
    return [
      "visit_count",
      "session_count",
      "search_user_count",
      "search_session_count"
    ];
  }

  function hasMetricValues(row) {
    return metricFieldNames().some(field => numberValue(row, [field]) > 0);
  }

  function aggregateMetricRows(rows, base) {
    const out = { ...(base || {}) };
    metricFieldNames().forEach(field => { out[field] = 0; });
    sessionFieldNames().forEach(field => { out[field] = 0; });
    (rows || []).forEach(row => {
      const normalized = row && row.search_count !== undefined ? row : normalizeMetricRow(row);
      metricFieldNames().forEach(field => {
        out[field] += Number(normalized[field] || 0);
      });
      sessionFieldNames().forEach(field => {
        out[field] += numberValue(normalized, [field]);
      });
      out.session_ids_count = (out.session_ids_count || 0) + sessionIdsCount(normalized);
    });
    out.conversion_rate = safeRate(out.purchase_count, out.search_count);
    out.cart_rate = safeRate(out.cart_count, out.search_count);
    out.purchase_rate = safeRate(out.purchase_count, out.search_count);
    return out;
  }

  function groupMetricRows(rows, keyFn, baseFn) {
    const groups = new Map();
    (rows || []).forEach(row => {
      const key = keyFn(row);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    return Array.from(groups.entries())
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([key, groupRows]) => aggregateMetricRows(groupRows, baseFn(key, groupRows)));
  }

  function dateKey(row) {
    const explicit = stringValue(row, ["date_key"]);
    if (explicit) return explicit;
    const period = stringValue(row, ["period_key", "label"]);
    const match = period.match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : "";
  }

  function sessionIdsCount(row) {
    if (!row) return 0;
    const raw = row.session_ids || row.session_id_list || row.sessions;
    if (!raw) return 0;
    const parts = Array.isArray(raw) ? raw : String(raw).replace(/\n/g, ",").replace(/;/g, ",").split(",");
    const ids = parts.map(item => String(item || "").trim()).filter(Boolean);
    return new Set(ids).size;
  }

  function saturdayWeekStart(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ""))) return "";
    const date = new Date(`${dateKey}T00:00:00+09:00`);
    if (Number.isNaN(date.getTime())) return "";
    const day = date.getDay();
    const diff = (day - 6 + 7) % 7;
    date.setDate(date.getDate() - diff);
    return kstDateString(date);
  }

  function saturdayWeekEndExclusive(weekStart) {
    return weekStart ? addDays(weekStart, 7) : "";
  }

  function saturdayWeekLabel(weekStart) {
    if (!weekStart) return "주차 미지정";
    return `${weekStart} ~ ${addDays(weekStart, 6)}`;
  }

  function normalizeOpenAggRows(rows, labelFields) {
    return (rows || []).map(row => {
      const normalized = normalizeMetricRow(row);
      normalized.label = stringValue(row, labelFields) || normalized.label;
      normalized.utm_source = row.utm_source || row.source || "";
      normalized.utm_campaign = row.utm_campaign || row.campaign || "";
      normalized.device = row.device || row.device_type || "";
      normalized.device_type = row.device_type || row.device || "";
      normalized.os_type = row.os_type || row.os || "";
      normalized.spot = row.spot || row.spot_code || row.prefix || row.spot_name || "";
      return normalized;
    });
  }

  function groupOpenAggRows(rows, keyFn, baseFn) {
    const groups = new Map();
    (rows || []).forEach(row => {
      const key = keyFn(row);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    return Array.from(groups.entries())
      .map(([key, groupRows]) => aggregateMetricRows(groupRows, baseFn(key, groupRows)))
      .sort((a, b) => b.search_count - a.search_count || b.purchase_count - a.purchase_count || b.revenue - a.revenue || String(a.label || "").localeCompare(String(b.label || "")));
  }

  function buildSearchTypes(state) {
    const search = numberValue(state, ["search_count"]);
    const purchase = numberValue(state, ["purchase_count"]);
    return [[
      "전체",
      search,
      purchase,
      rateValue(state, ["conversion_rate"], purchase, search),
      averageExposure(state)
    ]].map(row => ({ type:row[0], searches:row[1], purchases:row[2], conversion_rate:row[3], avg_exposure:row[4] }));
  }

  function buildExposures(state) {
    const search = numberValue(state, ["search_count"]);
    const zero = numberValue(state, ["zero_exposure_count", "zero_exposure"]);
    const valid = Math.max(0, search - zero);
    return [
      { status:"유효 노출", count:valid, rate:safeRate(valid, search) },
      { status:"노출 0건", count:zero, rate:safeRate(zero, search) }
    ];
  }

  function buildCartRows(state) {
    const search = numberValue(state, ["search_count"]);
    const cart = numberValue(state, ["cart_count"]);
    const purchase = numberValue(state, ["purchase_count"]);
    return [
      { label:"검색", value:search, note:"search_count" },
      { label:"장바구니", value:cart, note:"cart_count" },
      { label:"구매", value:purchase, note:"purchase_count" },
      { label:"검색→장바구니", value:formatPercent(rateValue(state, ["cart_rate"], cart, search)), note:"cart_rate" }
    ];
  }

  function buildQualityRows(state) {
    return [
      { item:"노출 0건", count:numberValue(state, ["zero_exposure_count", "zero_exposure"]), level:"warn", condition:"zero_exposure_count / zero_exposure", status:"확인" },
      { item:"평균 노출", count:averageExposure(state), level:"good", condition:"avg_exposure or exposure_sum / exposure_count", status:"계산됨" }
    ];
  }

  function filterDashboardRowsByPeriod(rows, periodFilter) {
    const range = dashboardPeriodRange(periodFilter);
    if (!range) return rows || [];
    return (rows || []).filter(row => {
      if ((row.agg_type || "") === "state") return stateRowInDashboardPeriod(row, range);
      const key = rowDateKey(row);
      return key && key >= range.start && key < range.end;
    });
  }

  function stateRowInDashboardPeriod(row, range) {
    const value = row && row.processed_until_created_at;
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return kstDateString(date) === range.end;
  }

  function dashboardPeriodRange(periodFilter) {
    if (periodFilter === "all") return null;
    const today = kstDateString(new Date());
    if (periodFilter === "today") return { start:today, end:addDays(today, 1) };
    if (periodFilter === "last_7_days") return { start:addDays(today, -6), end:addDays(today, 1) };
    if (periodFilter === "this_month") return { start:today.slice(0, 8) + "01", end:addMonths(today.slice(0, 8) + "01", 1) };
    return null;
  }

  function rowDateKey(row) {
    const direct = row && row.date_key ? String(row.date_key).slice(0, 10) : "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;
    const text = String((row && (row.period_key || row.label || row.agg_key)) || "");
    const match = text.match(/\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : "";
  }

  function kstDateString(date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);
    const map = {};
    parts.forEach(part => {
      if (part.type !== "literal") map[part.type] = part.value;
    });
    return `${map.year}-${map.month}-${map.day}`;
  }

  function addDays(dateKey, days) {
    const date = new Date(`${dateKey}T00:00:00+09:00`);
    date.setUTCDate(date.getUTCDate() + Number(days || 0));
    return kstDateString(date);
  }

  function addMonths(dateKey, months) {
    const date = new Date(`${dateKey}T00:00:00+09:00`);
    date.setUTCMonth(date.getUTCMonth() + Number(months || 0));
    return kstDateString(date);
  }

  function countBy(rows, keyFn) {
    return (rows || []).reduce((acc, row) => {
      const key = keyFn(row);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  function aggregateRows(rows) {
    const fields = metricFieldNames();
    const out = {};
    fields.forEach(field => { out[field] = 0; });
    (rows || []).forEach(row => {
      fields.forEach(field => {
        out[field] += numberValue(row, [field]);
      });
    });
    return out;
  }

  function sortByPeriodKey(rows) {
    return [...(rows || [])].sort((a, b) => stringValue(a, ["period_key", "hour_key", "date_key", "agg_key"]).localeCompare(stringValue(b, ["period_key", "hour_key", "date_key", "agg_key"])));
  }

  function sortByRangeStart(rows) {
    return [...(rows || [])].sort((a, b) => numberValue(a, ["range_start", "bib_start"]) - numberValue(b, ["range_start", "bib_start"]));
  }

  function rangeLabel(row) {
    const start = row && (row.range_start ?? row.bib_start);
    const end = row && (row.range_end ?? row.bib_end);
    if ((start === undefined || start === null) && (end === undefined || end === null)) return "";
    return String(start || "0") + " ~ " + String(end || "");
  }

  function numberValue(row, fields) {
    if (!row) return 0;
    for (const field of fields) {
      const value = row[field];
      if (value !== null && value !== undefined && value !== "") {
        const n = Number(String(value).replace(/,/g, ""));
        if (Number.isFinite(n)) return n;
      }
    }
    return 0;
  }

  function numberOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function stringValue(row, fields) {
    if (!row) return "";
    for (const field of fields) {
      if (row[field] !== null && row[field] !== undefined && row[field] !== "") return String(row[field]);
    }
    return "";
  }

  function averageExposure(row) {
    const explicit = numberValue(row, ["avg_exposure", "average_exposure"]);
    if (explicit) return explicit;
    const sum = numberValue(row, ["exposure_sum"]);
    const count = numberValue(row, ["exposure_count"]);
    return count ? sum / count : 0;
  }

  function rateValue(row, fields, numerator, denominator) {
    const explicit = numberValue(row, fields);
    if (explicit) return explicit;
    return safeRate(numerator, denominator);
  }

  function safeRate(numerator, denominator) {
    return denominator ? Number(numerator || 0) / Number(denominator) * 100 : 0;
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("ko-KR");
  }

  function formatWon(value) {
    return Number(value || 0).toLocaleString("ko-KR") + "원";
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
</script>

<style>
  :root{
    --sh-page:#f1f5f9;
    --sh-panel:#ffffff;
    --sh-ink:#0f172a;
    --sh-muted:#64748b;
    --sh-line:#e2e8f0;
    --sh-dark:#020617;
    --sh-soft:#f8fafc;
    --sh-ok:#059669;
    --sh-warn:#d97706;
    --sh-bad:#dc2626;
    --sh-border:var(--sh-line);
    --sh-bg:var(--sh-soft);
    --sh-text:var(--sh-ink);
    --sh-text-soft:#334155;
    --sh-text-muted:var(--sh-muted);
    --sh-surface:var(--sh-panel);
    --sh-surface-soft:#f8fafc;
    --sh-surface-muted:#f1f5f9;
    --sh-surface-subtle:#f8fafc;
    --sh-line-strong:#cbd5e1;
    --sh-line-soft:#e2e8f0;
    --sh-primary:var(--sh-dark);
    --sh-danger:var(--sh-bad);
    --sh-danger-strong:var(--sh-bad);
    --sh-danger-bg:#fef2f2;
    --sh-success-bg:#ecfdf5;
    --sh-success-text:var(--sh-ok);
    --sh-success-border:#a7f3d0;
    --sh-shadow:0 8px 26px rgba(15,23,42,.06);
  }

  body{ background:var(--sh-page); }

  .sh-admin-wrap{
    display:block;
    max-width:1380px;
    margin:0 auto;
    padding:28px;
    color:var(--sh-ink);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR",Arial,sans-serif;
    line-height:1.45;
  }

  .sh-admin-hero{
    display:flex;
    justify-content:space-between;
    gap:24px;
    align-items:flex-end;
    padding:32px;
    color:#fff;
    background:linear-gradient(135deg,#020617,#111827);
    border-radius:8px;
    box-shadow:var(--sh-shadow);
  }

  .sh-admin-eyebrow{
    display:inline-flex;
    margin-bottom:12px;
    padding:7px 12px;
    border:1px solid rgba(255,255,255,.12);
    border-radius:999px;
    background:rgba(255,255,255,.10);
    color:#cbd5e1;
    font-size:12px;
    font-weight:800;
  }

  .sh-admin-title{
    margin:0;
    color:inherit;
    font-size:38px;
    line-height:1.05;
    font-weight:950;
    letter-spacing:0;
  }

  .sh-admin-sub{
    max-width:760px;
    margin:10px 0 0;
    color:#cbd5e1;
    font-size:14px;
  }

  .sh-admin-status-card{
    min-width:310px;
    padding:18px;
    border:1px solid rgba(255,255,255,.12);
    border-radius:8px;
    background:rgba(255,255,255,.06);
    color:#cbd5e1;
    font-size:14px;
  }

  .sh-admin-status-card b{
    display:block;
    margin-bottom:6px;
    color:#86efac;
  }

  .sh-admin-status-card b.is-error{ color:#fecaca; }
  .sh-admin-status-card div + div{ margin-top:6px; color:#94a3b8; }

  .sh-card,
  .sh-admin-tabs,
  .sh-db-tabs,
  .sh-db-section,
  .sh-table{
    background:var(--sh-panel);
    border:1px solid var(--sh-line);
    border-radius:8px;
    box-shadow:var(--sh-shadow);
  }

  .sh-card{
    padding:18px;
    margin-top:18px;
    margin-bottom:18px;
  }

  .sh-row{ display:flex; gap:12px; margin-bottom:12px; }
  .sh-col{ flex:1; display:flex; flex-direction:column; min-width:0; }

  .sh-label{
    display:block;
    margin-bottom:6px;
    color:var(--sh-muted);
    font-size:12px;
    font-weight:850;
  }

  .sh-input,
  .sh-select{
    width:100%;
    height:44px;
    border:1px solid var(--sh-line);
    border-radius:8px;
    padding:0 14px;
    background:#fff;
    color:var(--sh-ink);
    font-size:14px;
    font-weight:750;
    outline:none;
    box-sizing:border-box;
  }

  .sh-input:focus,
  .sh-select:focus{
    border-color:#94a3b8;
    box-shadow:0 0 0 3px rgba(148,163,184,.25);
  }

  .sh-divider{ height:1px; margin:15px 0; background:var(--sh-line); }

  .sh-btn,
  .sh-btn-sm,
  .sh-admin-tab,
  .sh-db-tab{
    border-radius:8px;
    font-weight:900;
    cursor:pointer;
    transition:.15s transform,.15s opacity,.15s background;
  }

  .sh-btn:active,
  .sh-btn-sm:active,
  .sh-admin-tab:active,
  .sh-db-tab:active{ transform:translateY(1px); }

  .sh-btn{
    height:44px;
    padding:0 18px;
    border:0;
    color:#fff;
    background:var(--sh-dark);
  }

  .sh-btn.primary{ background:var(--sh-dark); color:#fff; }
  .sh-btn[disabled]{ opacity:.55; cursor:not-allowed; }
  .sh-help{ margin-top:8px; color:var(--sh-muted); font-size:12px; line-height:1.35; }

  .sh-chip{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    min-height:32px;
    padding:5px 10px;
    border-radius:999px;
    background:#f1f5f9;
    color:#334155;
    font-size:12px;
    font-weight:900;
    white-space:nowrap;
  }

  .sh-admin-tabs,
  .sh-db-tabs{
    display:flex;
    gap:8px;
    overflow:auto;
    margin-top:18px;
    padding:8px;
  }

  .sh-admin-tab,
  .sh-db-tab{
    height:auto;
    min-height:44px;
    border:0;
    padding:13px 16px;
    background:transparent;
    color:#475569;
    font-size:13px;
    white-space:nowrap;
  }

  .sh-admin-tab.is-active,
  .sh-admin-tab[aria-selected="true"],
  .sh-db-tab.is-active,
  .sh-db-tab[aria-selected="true"]{
    background:var(--sh-dark);
    color:#fff;
  }

  .sh-admin-panel{ margin-top:18px; }
  .sh-admin-panel.is-hidden,
  .sh-admin-panel[hidden]{ display:none !important; }

  .sh-event-filter{
    display:grid;
    grid-template-columns:230px minmax(220px,1fr) auto auto;
    gap:12px;
    align-items:center;
    margin:18px 0;
    padding:18px;
    border:1px solid var(--sh-line);
    border-radius:8px;
    background:var(--sh-panel);
    box-shadow:var(--sh-shadow);
  }

  .sh-event-filter #sh_btn_refresh{
    min-height:44px;
    padding:0 18px;
    border:1px solid var(--sh-line);
    background:#fff;
    color:#334155;
  }

  .sh-table{
    width:100%;
    margin-top:18px;
    border-collapse:separate;
    border-spacing:0;
    overflow:hidden;
    font-size:14px;
  }

  .sh-table th{
    padding:15px 18px;
    background:#f8fafc;
    color:#64748b;
    text-align:left;
    text-transform:uppercase;
    letter-spacing:.03em;
    font-size:12px;
    font-weight:900;
  }

  .sh-table td{
    padding:15px 18px;
    border-top:1px solid #f1f5f9;
    font-size:14px;
    vertical-align:middle;
  }

  .sh-table tr:hover td{ background:#f8fafc; }

  .sh-btn-sm{
    min-height:32px;
    padding:5px 10px;
    border:1px solid var(--sh-line);
    background:#fff;
    color:#334155;
    font-size:11px;
  }

  .sh-btn-sm.pub{ background:var(--sh-success-bg); color:var(--sh-success-text); border-color:var(--sh-success-border); }
  .sh-btn-sm.priv{ background:var(--sh-danger-bg); color:var(--sh-danger-strong); border-color:#fecaca; }
  .sh-btn-sm.danger{ background:var(--sh-danger-bg); color:var(--sh-danger-strong); border-color:#fecaca; }

  .sh-table--legacy{ width:100%; border-collapse:separate; border-spacing:0; overflow:hidden; border-radius:8px; border:1px solid var(--sh-border); }
  .sh-table--legacy th, .sh-table--legacy td{ padding:12px 10px; border-bottom:1px solid var(--sh-border); font-size:13px; vertical-align:middle; }
  .sh-table--legacy th{ background:var(--sh-bg); text-align:left; color:var(--sh-muted); font-weight:800; }
  .sh-table--legacy tr:last-child td{ border-bottom:none; }

  .sh-badge{ display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border:1px solid var(--sh-border); border-radius:999px; background:#fff; font-size:12px; }
  .sh-dot{ width:8px; height:8px; border-radius:999px; background:#999; display:inline-block; }
  .sh-dot.ready{ background:#2e7d32; }
  .sh-dot.disabled{ background:var(--sh-bad); }
  .sh-dot.public{ background:#1565c0; }
  .sh-dot.private{ background:#616161; }
  .sh-actions{ display:flex; gap:8px; flex-wrap:wrap; }
  .sh-note{ margin-top:10px; color:var(--sh-muted); font-size:12px; }

  .sh-db-toolbar{
    display:grid;
    grid-template-columns:1.4fr 1fr 1fr auto auto;
    gap:12px;
    align-items:end;
  }

  .sh-db-toolbar #sh_db_date_to{ margin-top:6px; }

  .sh-db-status{
    min-height:20px;
    margin:12px 0;
    color:var(--sh-muted);
    font-size:13px;
  }

  .sh-db-status.is-error{ color:var(--sh-bad); }

  .sh-db-kpis{
    display:grid;
    grid-template-columns:repeat(5,minmax(0,1fr));
    gap:14px;
    margin-top:18px;
    margin-bottom:18px;
  }

  .sh-db-kpi{
    min-height:116px;
    padding:20px;
    border:1px solid var(--sh-line);
    border-radius:8px;
    background:#fff;
    box-shadow:var(--sh-shadow);
  }

  .sh-db-kpi-label{ color:var(--sh-muted); font-size:13px; font-weight:850; }
  .sh-db-kpi-value{ margin-top:10px; color:var(--sh-ink); font-size:26px; line-height:1.1; font-weight:950; letter-spacing:0; }
  .sh-db-kpi-note{ margin-top:4px; color:var(--sh-muted); font-size:12px; }

  .sh-db-grid{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:16px;
    margin-bottom:16px;
  }

  .sh-db-section{
    overflow:hidden;
    margin-bottom:16px;
  }

  .sh-db-section-head{
    display:flex;
    align-items:center;
    justify-content:space-between;
    min-height:58px;
    padding:0 18px;
  }

  .sh-db-section-title{
    margin:0;
    color:var(--sh-ink);
    font-size:18px;
    font-weight:950;
    letter-spacing:0;
  }

  .sh-db-table-wrap{
    overflow:auto;
    border-top:1px solid var(--sh-line);
  }

  .sh-db-table{
    width:100%;
    min-width:760px;
    border-collapse:collapse;
    font-size:14px;
  }

  .sh-db-table th{
    padding:15px 18px;
    background:#f8fafc;
    color:#64748b;
    text-align:left;
    text-transform:uppercase;
    letter-spacing:.03em;
    font-size:12px;
    font-weight:900;
  }

  .sh-db-table td{
    padding:15px 18px;
    border-top:1px solid #f1f5f9;
    white-space:nowrap;
  }

  .sh-db-table tr:hover td{ background:#f8fafc; }

  @media(max-width:1100px){
    .sh-admin-hero{ display:block; }
    .sh-admin-status-card{ min-width:0; margin-top:20px; }
    .sh-row{ flex-wrap:wrap; }
    .sh-row .sh-col{ flex:1 1 260px; }
    .sh-db-toolbar,
    .sh-event-filter{ grid-template-columns:1fr 1fr; }
    .sh-db-kpis{ grid-template-columns:repeat(2,minmax(0,1fr)); }
    .sh-db-grid{ grid-template-columns:1fr; }
  }

  @media(max-width:640px){
    .sh-admin-wrap{ padding:16px; }
    .sh-admin-hero{ padding:24px; }
    .sh-admin-title{ font-size:30px; }
    .sh-db-toolbar,
    .sh-event-filter{ grid-template-columns:1fr; }
    .sh-db-kpis{ grid-template-columns:1fr; }
    .sh-table{ display:block; overflow:auto; }
  }

  .sot-admin-dashboard{
    display:grid;
    grid-template-columns:280px minmax(0,1fr);
    min-height:calc(100vh - 48px);
    overflow:hidden;
    border:0;
    border-radius:0;
    background:#f6f7fb;
    box-shadow:none;
  }

  .sot-dash-sidebar{
    padding:22px 18px;
    background:#101828;
    color:#fff;
    overflow:auto;
  }

  .sot-dash-logo{
    font-size:21px;
    font-weight:950;
    letter-spacing:0;
  }

  .sot-dash-side-note{
    margin-top:6px;
    margin-bottom:22px;
    color:#aeb7c8;
    font-size:12px;
    line-height:1.45;
  }

  .sot-dash-nav{ display:grid; gap:4px; }

  .sot-dash-nav-group{
    margin:18px 10px 6px;
    color:#98a2b3;
    font-size:11px;
    font-weight:800;
    letter-spacing:.08em;
    line-height:1.2;
    text-transform:uppercase;
  }

  .sot-dash-nav-group:first-child{ margin-top:0; }

  .sot-dash-nav-btn{
    width:100%;
    min-height:40px;
    border:0;
    border-radius:12px;
    padding:12px;
    background:transparent;
    color:#d0d5dd;
    text-align:left;
    font-size:14px;
    font-weight:700;
    cursor:pointer;
  }

  .sot-dash-nav-btn:hover,
  .sot-dash-nav-btn.is-active{
    background:#1d2939;
    color:#fff;
  }

  .sot-dash-main{
    min-width:0;
    padding:24px 28px 64px;
    overflow:hidden;
  }

  .sot-dash-topbar{
    display:flex;
    justify-content:space-between;
    gap:16px;
    align-items:flex-start;
    margin-bottom:18px;
  }

  .sot-dash-title{
    margin:0 0 7px;
    color:#171923;
    font-size:28px;
    line-height:1.15;
    font-weight:950;
    letter-spacing:0;
  }

  .sot-dash-desc{
    max-width:720px;
    margin:0;
    color:#667085;
    font-size:14px;
    line-height:1.5;
  }

  .sot-dash-filters{
    display:flex;
    justify-content:flex-end;
    gap:8px;
    flex-wrap:wrap;
  }

  .sot-dash-filter-item{
    display:flex;
    align-items:center;
    gap:6px;
    color:#667085;
    font-size:12px;
    font-weight:900;
  }

  .sot-dash-filter-item.inline{
    justify-content:flex-start;
    margin-bottom:12px;
  }

  .sot-dash-tabs{
    display:flex;
    gap:8px;
    flex-wrap:wrap;
    margin:16px 0;
  }

  .sot-dash-tab{
    min-height:38px;
    border:1px solid #e5e7ef;
    border-radius:999px;
    padding:8px 14px;
    background:#fff;
    color:#344054;
    font-size:13px;
    font-weight:850;
    cursor:pointer;
  }

  .sot-dash-tab.is-active{
    border-color:#111827;
    background:#111827;
    color:#fff;
  }

  .sot-dash-kpis{
    display:grid;
    grid-template-columns:repeat(4,minmax(0,1fr));
    gap:14px;
    margin-bottom:16px;
  }

  .sot-dash-kpis.is-mini{ grid-template-columns:repeat(2,minmax(0,1fr)); margin:0; }

  .sot-dash-card,
  .sot-dash-panel{
    border:1px solid #e5e7ef;
    border-radius:18px;
    background:#fff;
    box-shadow:0 12px 28px rgba(17,24,39,.08);
  }

  .sot-dash-card{
    min-height:104px;
    padding:16px;
  }

  .sot-dash-label{
    color:#667085;
    font-size:12px;
    font-weight:850;
  }

  .sot-dash-value{
    margin-top:8px;
    color:#171923;
    font-size:28px;
    line-height:1.1;
    font-weight:950;
    letter-spacing:0;
  }

  .sot-dash-note{
    margin-top:8px;
    color:#667085;
    font-size:12px;
    line-height:1.45;
  }

  .sot-dash-grid{ display:grid; gap:16px; margin-bottom:16px; }
  .sot-dash-grid.two{ grid-template-columns:1.2fr .8fr; }

  .sot-dash-panel{
    overflow:hidden;
    margin-bottom:16px;
    padding:18px;
  }

  .sot-dash-panel h3{
    margin:0 0 12px;
    color:#171923;
    font-size:17px;
    font-weight:950;
    letter-spacing:0;
  }

  .sot-dash-table-wrap{ overflow:auto; margin:0 -18px -18px; border-top:1px solid #e5e7ef; }
  .sot-dash-table{ width:100%; min-width:760px; border-collapse:collapse; font-size:13px; }
  .sot-dash-table th,
  .sot-dash-table td{ padding:12px 14px; border-bottom:1px solid #e5e7ef; text-align:left; vertical-align:middle; }
  .sot-dash-table th{ background:#f9fafb; color:#667085; font-size:12px; font-weight:900; }
  .sot-dash-table tr:hover td{ background:#fbfcff; }

  .sot-dash-chart{
    display:flex;
    align-items:flex-end;
    gap:8px;
    height:190px;
    padding:12px 8px 4px;
    overflow:hidden;
    border:1px solid #e5e7ef;
    border-radius:14px;
    background:#fcfcfd;
  }

  .sot-dash-chart-col{ flex:1; display:flex; flex-direction:column; align-items:center; gap:7px; min-width:0; }
  .sot-dash-chart-col b{ font-size:11px; color:#344054; }
  .sot-dash-chart-col span{ font-size:11px; color:#667085; }
  .sot-dash-stick{ width:100%; max-width:34px; min-height:8px; border-radius:8px 8px 3px 3px; background:linear-gradient(180deg,#5271ff,#9aa8ff); }

  .sot-dash-funnel{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
  .sot-dash-step{ position:relative; min-height:112px; padding:16px; border:1px solid #e5e7ef; border-radius:16px; background:#fbfcff; }
  .sot-dash-step:after{ content:"→"; position:absolute; right:-14px; top:42%; color:#98a2b3; font-weight:900; }
  .sot-dash-step:last-child:after{ content:""; }
  .sot-dash-step small{ color:#667085; }

  .sot-dash-callout{
    margin-bottom:16px;
    border:1px solid #dbe4ff;
    border-radius:16px;
    padding:14px;
    background:#f3f6ff;
    color:#24315f;
    font-size:13px;
    line-height:1.55;
  }

  .sot-dash-callout.warn{ border-color:#fedf89; background:#fffbeb; color:#7a4b06; }
  .sot-dash-pill{ display:inline-flex; border-radius:999px; padding:4px 8px; font-size:12px; font-weight:850; background:#f2f4f7; color:#475467; }
  .sot-dash-pill.good{ background:#e7f8ef; color:#087443; }
  .sot-dash-pill.warn{ background:#fff7e6; color:#985f0d; }
  .sot-dash-pill.bad{ background:#ffebe9; color:#b42318; }

  .sot-dash-course-form{
    display:grid;
    grid-template-columns:1.2fr repeat(3,minmax(110px,.75fr)) auto;
    gap:10px;
    align-items:center;
  }

  .sot-dash-input{
    width:100%;
    min-height:40px;
    border:1px solid #d0d5dd;
    border-radius:12px;
    padding:9px 11px;
    background:#fff;
    color:#171923;
    font-size:13px;
    outline:none;
  }

  .sot-dash-input:focus{
    border-color:#5271ff;
    box-shadow:0 0 0 3px rgba(82,113,255,.14);
  }

  .sot-dash-btn{
    min-height:40px;
    border:0;
    border-radius:12px;
    padding:9px 14px;
    background:#111827;
    color:#fff;
    font-size:13px;
    font-weight:850;
    cursor:pointer;
    white-space:nowrap;
  }

  .sot-dash-btn:hover{ background:#263244; }
  .sot-dash-btn.danger{ background:#fff1f0; color:#b42318; }
  .sot-dash-btn.danger:hover{ background:#ffe4e1; }

  .sot-dash-barwrap{ display:inline-block; width:92px; height:10px; margin-right:8px; overflow:hidden; border-radius:999px; background:#eef1f6; vertical-align:middle; }
  .sot-dash-bar{ height:100%; border-radius:999px; background:linear-gradient(90deg,#2f5cff,#6d7cff); }

  .ctdash-shell{
    display:grid;
    gap:18px;
    color:var(--sh-ink);
    font-family:"SUIT","Pretendard","Apple SD Gothic Neo",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  }
  .ctdash-hero{ display:grid; grid-template-columns:1.25fr .75fr; gap:18px; }
  .ctdash-card{
    background:rgba(255,250,244,.92);
    border:1px solid rgba(255,255,255,.72);
    border-radius:30px;
    box-shadow:0 16px 42px rgba(73,49,31,.08);
  }
  .ctdash-hero-main,.ctdash-hero-side,.ctdash-section{ padding:24px; }
  .ctdash-hero-main{ background:radial-gradient(circle at top right, rgba(201,107,55,.18), transparent 32%), linear-gradient(180deg, rgba(255,250,244,.95), rgba(248,241,232,.9)); }
  .ctdash-eyebrow,.ctdash-kicker{
    display:inline-flex; padding:7px 12px; border-radius:999px; background:rgba(201,107,55,.14); color:#ab5426; font-size:12px; font-weight:900; letter-spacing:.08em; text-transform:uppercase;
  }
  .ctdash-kicker{ margin-bottom:8px; }
  .ctdash-hero-main h2,.ctdash-section h3{ margin:12px 0 8px; font-size:32px; line-height:1.05; font-weight:950; letter-spacing:-.04em; color:#211812; }
  .ctdash-section h3{ margin:0; font-size:28px; }
  .ctdash-hero-main p,.ctdash-section p{ margin:0; color:#6f6256; line-height:1.7; }
  .ctdash-hero-side{ display:grid; gap:12px; align-content:start; }
  .ctdash-hero-side h3{ margin:0 0 8px; font-size:18px; }
  .ctdash-status-row{ display:grid; grid-template-columns:1fr auto; gap:12px; color:#6f6256; font-size:14px; }
  .ctdash-status-row b{ color:#211812; }
  .ctdash-refresh,.ctdash-tab,.ctdash-chip{ border:0; border-radius:999px; font:inherit; font-weight:900; cursor:pointer; transition:.16s ease; }
  .ctdash-refresh{ min-height:44px; margin-top:8px; padding:0 18px; color:#fff; background:linear-gradient(135deg,#c96b37,#ab5426); box-shadow:0 14px 28px rgba(201,107,55,.24); }
  .ctdash-main-tabs,.ctdash-period-tabs,.ctdash-legend,.ctdash-inline-fields{ display:flex; flex-wrap:wrap; gap:10px; }
  .ctdash-main-tabs{ margin-top:18px; }
  .ctdash-tab,.ctdash-chip{ padding:11px 16px; background:rgba(33,24,18,.08); color:#6f6256; }
  .ctdash-tab.is-active,.ctdash-chip.is-active{ background:linear-gradient(135deg,#c96b37,#ab5426); color:#fff; box-shadow:0 12px 26px rgba(201,107,55,.22); }
  .ctdash-callout{ padding:16px 18px; border-radius:20px; background:rgba(255,255,255,.86); border:1px solid rgba(80,58,40,.08); color:#6f6256; }
  .ctdash-callout.warn{ background:rgba(183,79,73,.08); color:#b74f49; border-color:rgba(183,79,73,.16); }
  .ctdash-screen,.ctdash-two-col,.ctdash-sub-grid,.ctdash-summary-grid,.ctdash-metrics-grid,.ctdash-sales-grid,.ctdash-spot-grid,.ctdash-conv-grid,.ctdash-form-grid{ display:grid; gap:18px; }
  .ctdash-two-col,.ctdash-sub-grid{ grid-template-columns:1fr 1fr; }
  .ctdash-summary-grid{ grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
  .ctdash-metrics-grid{ grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; }
  .ctdash-sales-grid{ grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
  .ctdash-spot-grid{ grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
  .ctdash-conv-grid{ grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
  .ctdash-form-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); }
  .ctdash-form-grid.three{ grid-template-columns:repeat(3,minmax(0,1fr)); }
  .ctdash-metric-card,.ctdash-conv-card,.ctdash-sub-card,.ctdash-spot-card{ padding:18px; border-radius:20px; background:linear-gradient(180deg, rgba(255,255,255,.94), rgba(249,243,235,.88)); border:1px solid rgba(80,58,40,.08); }
  .ctdash-metric-card h4,.ctdash-conv-card h4,.ctdash-sub-card h4,.ctdash-spot-card h4{ margin:0 0 8px; color:#6f6256; font-size:13px; font-weight:800; }
  .ctdash-metric-card strong,.ctdash-spot-card strong{ display:block; font-size:28px; font-weight:950; letter-spacing:-.04em; color:#211812; }
  .ctdash-metric-card p,.ctdash-conv-card p,.ctdash-spot-card p{ margin:8px 0 0; color:#6f6256; font-size:12px; line-height:1.55; }
  .ctdash-section-head{ display:flex; justify-content:space-between; gap:14px; align-items:baseline; margin-bottom:18px; }
  .ctdash-tag{ padding:8px 12px; border-radius:999px; background:rgba(12,139,136,.12); color:#0c8b88; font-size:12px; font-weight:900; }
  .ctdash-chart-box{ position:relative; padding:18px; border-radius:24px; background:linear-gradient(180deg, rgba(255,255,255,.88), rgba(247,240,231,.72)); border:1px solid rgba(80,58,40,.08); overflow:hidden; }
  .ctdash-legend span{ display:inline-flex; align-items:center; gap:8px; color:#6f6256; font-size:13px; font-weight:800; }
  .ctdash-legend i{ width:12px; height:12px; border-radius:50%; display:inline-block; }
  .ctdash-chart-box svg{ display:block; width:100%; height:auto; }
  .ctdash-tooltip{ position:absolute; min-width:190px; padding:12px 14px; border-radius:16px; background:rgba(33,24,18,.94); color:#fff; pointer-events:none; opacity:0; transform:translateY(8px); transition:opacity 120ms ease, transform 120ms ease; box-shadow:0 18px 34px rgba(33,24,18,.22); }
  .ctdash-tooltip.is-visible{ opacity:1; transform:translateY(0); }
  .ctdash-tooltip-time{ margin:0 0 10px; font-size:12px; color:rgba(255,255,255,.76); letter-spacing:.04em; text-transform:uppercase; }
  .ctdash-tooltip-row{ display:flex; justify-content:space-between; gap:14px; margin-top:6px; font-size:13px; }
  .ctdash-tooltip-row b{ font-weight:800; }
  .ctdash-conv-top{ display:flex; justify-content:space-between; gap:10px; align-items:baseline; margin-bottom:10px; }
  .ctdash-conv-top strong{ font-size:24px; font-weight:950; color:#211812; }
  .ctdash-bar{ height:10px; border-radius:999px; background:rgba(33,24,18,.08); overflow:hidden; }
  .ctdash-bar span{ display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,#0c8b88,#c96b37); }
  .ctdash-rank-list{ display:grid; gap:10px; }
  .ctdash-rank-row{ display:grid; grid-template-columns:38px 1fr auto; gap:12px; align-items:center; padding:12px 14px; border-radius:16px; background:rgba(243,238,229,.84); }
  .ctdash-rank-row span{ width:38px; height:38px; display:grid; place-items:center; border-radius:50%; background:rgba(33,24,18,.08); color:#6f6256; font-weight:900; }
  .ctdash-rank-row strong{ color:#211812; }
  .ctdash-spot-row{ display:flex; justify-content:space-between; gap:10px; margin-top:8px; color:#6f6256; font-size:12px; }
  .ctdash-event-toolbar{ display:grid; gap:12px; }
  .ctdash-inline-fields label,.ctdash-form-grid label{ display:grid; gap:8px; color:#6f6256; font-size:13px; font-weight:800; }
  .ctdash-select,.ctdash-input,.ctdash-textarea{ width:100%; min-height:46px; padding:12px 14px; border-radius:14px; border:1px solid rgba(80,58,40,.12); background:#fffdfa; color:#211812; font:inherit; box-sizing:border-box; }
  .ctdash-textarea{ min-height:120px; resize:vertical; }
  .ctdash-textarea.tall{ min-height:180px; }
  .ctdash-table-wrap{ overflow:auto; }
  .ctdash-table{ width:100%; min-width:760px; border-collapse:collapse; }
  .ctdash-table th{ padding:14px 16px; background:rgba(243,238,229,.84); color:#6f6256; text-align:left; font-size:12px; font-weight:900; letter-spacing:.04em; text-transform:uppercase; }
  .ctdash-table td{ padding:14px 16px; border-top:1px solid rgba(80,58,40,.08); background:rgba(255,255,255,.24); }
  .ctdash-empty{ color:#6f6256; font-size:13px; }

  @media(max-width:1100px){
    .sot-admin-dashboard{ grid-template-columns:1fr; }
    .sot-dash-sidebar{ position:relative; }
    .sot-dash-nav{ grid-template-columns:repeat(2,minmax(0,1fr)); }
    .sot-dash-topbar{ display:block; }
    .sot-dash-filters{ justify-content:flex-start; margin-top:14px; }
    .sot-dash-kpis,
    .sot-dash-kpis.is-mini,
    .sot-dash-grid.two,
    .sot-dash-course-form,
    .sot-dash-funnel{ grid-template-columns:1fr 1fr; }
    .ctdash-hero,.ctdash-two-col,.ctdash-sub-grid{ grid-template-columns:1fr; }
    .ctdash-metrics-grid,.ctdash-summary-grid,.ctdash-sales-grid,.ctdash-spot-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); }
    .ctdash-conv-grid,.ctdash-form-grid.three{ grid-template-columns:1fr; }
  }

  @media(max-width:640px){
    .sot-dash-main{ padding:16px; }
    .sot-dash-nav{ grid-template-columns:1fr; }
    .sot-dash-kpis,
    .sot-dash-kpis.is-mini,
    .sot-dash-grid.two,
    .sot-dash-course-form,
    .sot-dash-funnel{ grid-template-columns:1fr; }
    .sot-dash-title{ font-size:24px; }
    .ctdash-metrics-grid,.ctdash-summary-grid,.ctdash-sales-grid,.ctdash-spot-grid,.ctdash-conv-grid,.ctdash-form-grid{ grid-template-columns:1fr; }
  }

</style>
