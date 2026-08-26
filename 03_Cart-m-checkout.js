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
  const AUTH_INTENT_KEY = "shout_auth_intent";
  const AUTH_INTENT_TTL_MS = 60 * 60 * 1000;
  const AUTH_LOGIN_URL = "/login";

  const UNIT_PRICE = 6000;
  const PACKAGE_THRESHOLD = 5;
  const PACKAGE_PRICE = 24900;

  const TOSS_CLIENT_KEY = "live_gck_GePWvyJnrKJE7jdbB9L1VgLzN97E";
  const SUCCESS_URL = window.location.origin + "/payments-results/success";
  const FAIL_URL = window.location.origin + "/payments-results/fail";
  const CHECKOUT_CONTEXT_KEY = "shout_checkout_context";

  const BUBBLE_API_ORIGIN = "https://plp-62309.bubbleapps.io";
  const WF_CREATE_ORDER = "/api/1.1/wf/create-order";

  const DEBUG_CHECKOUT = (new URLSearchParams(location.search).get("debug_checkout") === "1");

  function warn(tag, err, extra) {
    if (!DEBUG_CHECKOUT) return;
    try { console.warn("[Checkout Warning] " + tag, err, extra || ""); } catch (_) {}
  }

  function log(tag, extra) {
    if (!DEBUG_CHECKOUT) return;
    try { console.log("[Checkout Debug] " + tag, extra || ""); } catch (_) {}
  }

  if (window.__SHOUT_CHECKOUT_INIT_DONE__) return;
  window.__SHOUT_CHECKOUT_INIT_DONE__ = true;

  function getStoredCheckoutContext() {
    try {
      const raw =
        sessionStorage.getItem(CHECKOUT_CONTEXT_KEY) ||
        localStorage.getItem(CHECKOUT_CONTEXT_KEY) ||
        "";
      return raw ? (JSON.parse(raw) || {}) : {};
    } catch (e) {
      warn("readStoredCheckoutContext", e);
      return {};
    }
  }

  function getShoutTrackingContext(extra) {
    if (!window.ShoutTracking || typeof window.ShoutTracking.getTrackingContext !== "function") return null;
    try {
      return window.ShoutTracking.getTrackingContext(extra || { local_user: getStoredCheckoutContext().local_user });
    } catch (e) {
      warn("tracking.context", e);
      return null;
    }
  }

  function getTrackingSessionId(tracking) {
    return String((tracking && tracking.session_id) || getSessionId() || "").trim();
  }

  function appendShoutTrackingToUrl(url) {
    if (!window.ShoutTracking || typeof window.ShoutTracking.appendTrackingParamsToUrl !== "function") return url;

    try {
      return window.ShoutTracking.appendTrackingParamsToUrl(url);
    } catch (e) {
      warn("tracking.url", e);
      return url;
    }
  }

  let rootEl = null;
  let paymentMethodEl = null;
  let agreementEl = null;
  let payBtnEl = null;
  let summaryCountEl = null;
  let summaryAmountEl = null;
  let summaryBibEl = null;

  let tossPaymentsInstance = null;
  let paymentWidgets = null;
  let paymentWidgetReady = false;
  let paymentWidgetRenderPending = false;
  let paymentWidgetCustomerKey = "";
  let paymentWidgetLastAmount = null;

  let cartData = { items: [] };
  let cartItems = [];

  function formatKRW(n) {
    return Number(n || 0).toLocaleString("ko-KR") + "원";
  }

  function getItemId(it) {
    const id = (it && (it._id || it.photo_id || it.photoId || it.id)) || "";
    return String(id).trim();
  }

  function uniqueStrings(arr) {
    const out = [];
    const seen = new Set();
    (arr || []).forEach((v) => {
      const s = String(v || "").trim();
      if (!s) return;
      if (seen.has(s)) return;
      seen.add(s);
      out.push(s);
    });
    return out;
  }

  function getSessionId() {
    try {
      const direct = String(sessionStorage.getItem("sot_session_id") || "").trim();
      if (direct) return direct;

      const rawCtx =
        sessionStorage.getItem(CHECKOUT_CONTEXT_KEY) ||
        localStorage.getItem(CHECKOUT_CONTEXT_KEY) ||
        "";

      if (rawCtx) {
        const parsed = JSON.parse(rawCtx);
        const fromCtx = String((parsed && parsed.session_id) || "").trim();
        if (fromCtx) return fromCtx;
      }
    } catch (e) {
      warn("getSessionId", e);
    }
    return "";
  }

  function getPrimaryBib(items) {
    for (const it of (items || [])) {
      const b = (it && (it.bib ?? it.bib_no ?? it.bibNumber ?? it.bib_number)) ?? "";
      const s = String(b).trim();
      if (s) return s;
    }
    return "";
  }

  function getCheckoutIdentifier(it) {
    const bib = String((it && (it.bib ?? it.bib_no ?? it.bibNumber ?? it.bib_number)) || "").trim();

    if (bib) {
      return {
        type: "bib",
        value: bib,
        bib: bib,
        ocr_name: ""
      };
    }

    const directType = String((it && (it.identifier_type || it.search_type)) || "").trim();
    const directValue = String((it && (it.identifier_value || it.search_value)) || "").trim();

    if (directValue) {
      const normalizedType = directType || "name";

      return {
        type: normalizedType,
        value: directValue,
        bib: normalizedType === "bib" ? directValue : "",
        ocr_name: normalizedType === "name" ? directValue : ""
      };
    }

    const name = String((it && (it.ocr_name || it.name || it.runner_name)) || "").trim();

    if (name) {
      return {
        type: "name",
        value: name,
        bib: "",
        ocr_name: name
      };
    }

    return {
      type: "",
      value: "",
      bib: "",
      ocr_name: ""
    };
  }

  function getPrimaryIdentifier(items) {
    const list = Array.isArray(items) ? items : [];

    for (const item of list) {
      const identifier = getCheckoutIdentifier(item);

      if (identifier.value) {
        return identifier;
      }
    }

    return {
      type: "",
      value: "",
      bib: "",
      ocr_name: ""
    };
  }

  function getEventCodeValue(it) {
    const direct = String((it && (it.event_code || it.eventCode)) || "").trim();
    if (direct) return direct;

    const fileName = String((it && (it.fileName || it.filename || it.file_name)) || "").trim();
    if (fileName) {
      const parts = fileName.split("/").filter(Boolean);
      if (parts.length >= 3) return String(parts[2] || "").trim();
    }

    return "";
  }

  function buildBibMeta(items) {
    const map = new Map();
    (items || []).forEach((it) => {
      const eventCode = getEventCodeValue(it);
      const eventDisplayName = String(it && (it.event_display_name || it.eventName || it.event_name) || "").trim();
      const identifier = getCheckoutIdentifier(it);
      if (!eventCode || !identifier.value) return;
      const key = eventCode + "__" + identifier.type + "__" + identifier.value;
      const ocrBib = identifier.type === "bib" ? (identifier.bib || identifier.value) : "";
      const ocrName = identifier.type === "name" ? (identifier.ocr_name || identifier.value) : "";
      if (!map.has(key)) {
        map.set(key, {
          event_code: eventCode,
          event_display_name: eventDisplayName,
          identifier_type: identifier.type,
          identifier_value: identifier.value,
          bib: identifier.bib,
          ocr_bib: ocrBib,
          ocr_name: ocrName,
          searched_query: identifier.value || identifier.bib || "",
          count: 0
        });
      }
      map.get(key).count += 1;
    });
    return Array.from(map.values());
  }

  function __shout_syncRootBib(data) {
    if (!data || typeof data !== "object") return data;
    if (!Array.isArray(data.items)) data.items = [];
    const root = String(data.bib ?? "").trim();
    if (!root) {
      const b = getPrimaryBib(data.items);
      if (b) data.bib = b;
    }
    return data;
  }

  function loadCartFromStorage() {
    try {
      const savedData = localStorage.getItem("shout_cart_data");
      if (!savedData) {
        cartData = { items: [] };
        cartItems = [];
        return;
      }
      const parsed = JSON.parse(savedData);
      cartData = __shout_syncRootBib(parsed || { items: [] }) || { items: [] };
      if (!Array.isArray(cartData.items)) cartData.items = [];
      cartItems = cartData.items.slice();
    } catch (e) {
      warn("loadCartFromStorage", e);
      cartData = { items: [] };
      cartItems = [];
    }
  }

  function getAllCartIds() {
    return uniqueStrings((cartItems || []).map(getItemId));
  }

  function ensureSelectedIds() {
    if (!cartData || typeof cartData !== "object") cartData = { items: [] };
    if (!Array.isArray(cartData.items)) cartData.items = [];

    const allIds = getAllCartIds();
    const allSet = new Set(allIds);

    if (!Array.isArray(cartData.selected_ids)) {
      cartData.selected_ids = allIds.slice();
    }

    cartData.selected_ids = uniqueStrings(cartData.selected_ids).filter((id) => allSet.has(id));

    if (cartData.selected_ids.length === 0 && allIds.length > 0) {
      cartData.selected_ids = allIds.slice();
    }

    try {
      localStorage.setItem("shout_cart_data", JSON.stringify(cartData));
    } catch (e) {
      warn("ensureSelectedIds.save", e);
    }
  }

  function getSelectedIds() {
    if (!cartData || !Array.isArray(cartData.selected_ids)) return getAllCartIds();
    return uniqueStrings(cartData.selected_ids);
  }

  function getSelectedItems() {
    const selectedSet = new Set(getSelectedIds());
    const out = [];
    (cartItems || []).forEach((it) => {
      const id = getItemId(it);
      if (selectedSet.has(id)) out.push(it);
    });
    return out;
  }

  function getGroupKey(it) {
    const eventCode = getEventCodeValue(it);
    const identifier = getCheckoutIdentifier(it);
    return eventCode + "__" + identifier.type + "__" + identifier.value;
  }

  function groupItemsByEventBib(items) {
    const map = new Map();
    (items || []).forEach((it) => {
      const k = getGroupKey(it);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(it);
    });
    return map;
  }

  function calcGroupAmountByCount(count) {
    const c = Number(count) || 0;
    if (c >= PACKAGE_THRESHOLD) return PACKAGE_PRICE;
    return c * UNIT_PRICE;
  }

  function calcTotalAmountByGroups(items) {
    const groups = groupItemsByEventBib(items);
    let total = 0;
    for (const arr of groups.values()) {
      total += calcGroupAmountByCount(arr.length);
    }
    return total;
  }

  function getCheckoutBib(items) {
    return String((cartData && cartData.bib) || getPrimaryBib(items) || "").trim();
  }

  function getOrCreateAnonymousCustomerKey() {
    try {
      const KEY = "shout_toss_widget_customer_key";
      let v = sessionStorage.getItem(KEY);
      if (v) return String(v);
      v = "anon_" + Date.now() + "_" + Math.random().toString(16).slice(2, 10);
      sessionStorage.setItem(KEY, v);
      return String(v);
    } catch (e) {
      warn("customerKey.session", e);
      return "anon_" + Date.now() + "_" + Math.random().toString(16).slice(2, 10);
    }
  }

  function getPaymentWidgetCustomerKey() {
    const userId = String(localStorage.getItem("shout_users_id") || "").trim();
    if (userId) return "user_" + userId;
    return getOrCreateAnonymousCustomerKey();
  }

  function getEstimatedAmount() {
    const items = getSelectedItems();
    return calcTotalAmountByGroups(items);
  }

  function buildCheckoutContext(items, extra) {
    const bibMeta = buildBibMeta(items);
    const tracking = (extra && extra.tracking) || getShoutTrackingContext();
    const groups = bibMeta.map((row) => ({
      event_code: String(row.event_code || "").trim(),
      event_display_name: String(row.event_display_name || "").trim(),
      identifier_type: String(row.identifier_type || "").trim(),
      identifier_value: String(row.identifier_value || "").trim(),
      bib: String(row.bib || "").trim(),
      ocr_bib: String(row.ocr_bib || "").trim(),
      ocr_name: String(row.ocr_name || "").trim(),
      searched_query: String(row.searched_query || row.identifier_value || row.bib || "").trim(),
      count: Number(row.count) || 0
    }));
    const primaryGroup = groups[0] || {};

    return {
      created_at: new Date().toISOString(),
      event_code: String(primaryGroup.event_code || "").trim(),
      identifier_type: String(primaryGroup.identifier_type || "").trim(),
      identifier_value: String(primaryGroup.identifier_value || "").trim(),
      ocr_bib: String(primaryGroup.ocr_bib || "").trim(),
      ocr_name: String(primaryGroup.ocr_name || "").trim(),
      searched_query: String(primaryGroup.searched_query || primaryGroup.identifier_value || primaryGroup.bib || "").trim(),
      session_id: String((extra && extra.session_id) || (tracking && tracking.session_id) || getSessionId() || "").trim(),
      local_user: String((extra && extra.local_user) || (tracking && tracking.local_user) || "").trim(),
      ses_k: String((extra && extra.ses_k) || (tracking && tracking.ses_k) || "").trim(),
      utm_s: String((extra && extra.utm_s) || (tracking && tracking.utm_s) || "").trim(),
      utm_c: String((extra && extra.utm_c) || (extra && extra.utm_campaign) || (tracking && tracking.utm_c) || "").trim(),
      utm_campaign: String((extra && extra.utm_campaign) || (extra && extra.utm_c) || (tracking && tracking.utm_campaign) || "").trim(),
      order_id: String(extra && extra.order_id || "").trim(),
      order_name: String(extra && extra.order_name || "").trim(),
      amount: Number(extra && extra.amount) || 0,
      users_id: String(extra && extra.users_id || "").trim(),
      primary_bib: String(extra && extra.primary_bib || "").trim(),
      primary_identifier_type: String(extra && extra.primary_identifier_type || "").trim(),
      primary_identifier_value: String(extra && extra.primary_identifier_value || "").trim(),
      photo_ids: Array.isArray(extra && extra.photo_ids) ? extra.photo_ids.slice() : [],
      bib_meta: bibMeta,
      groups: groups
    };
  }

  function persistCheckoutContext(ctx) {
    const raw = JSON.stringify(ctx || {});
    try { sessionStorage.setItem(CHECKOUT_CONTEXT_KEY, raw); } catch (e) { warn("persistCheckoutContext.session", e); }
    try { localStorage.setItem(CHECKOUT_CONTEXT_KEY, raw); } catch (e) { warn("persistCheckoutContext.local", e); }
  }

  function ensureCheckoutDom() {
    rootEl = document.getElementById("sh-checkout-root");
    if (!rootEl) {
      rootEl = document.createElement("div");
      rootEl.id = "sh-checkout-root";
      document.body.appendChild(rootEl);
    }

    if (!document.getElementById("sh-checkout-card")) {
      rootEl.innerHTML = `
        <div id="sh-checkout-card" class="sh-checkout-card">
          <div class="sh-checkout-head">
            <div class="sh-checkout-title">결제하기</div>
            <div class="sh-checkout-sub">모바일에서는 전용 결제 페이지에서 안전하게 진행됩니다.</div>
          </div>

          <div class="sh-checkout-summary">
            <div class="sh-summary-row">
              <span>선택 사진</span>
              <strong id="sh-checkout-count">0장</strong>
            </div>
            <div class="sh-summary-row">
              <span>참가번호</span>
              <strong id="sh-checkout-bib">-</strong>
            </div>
            <div class="sh-summary-row">
              <span>결제 예정 금액</span>
              <strong id="sh-checkout-amount">0원</strong>
            </div>
          </div>

          <div class="sh-checkout-body">
            <div id="payment-method"></div>
            <div id="agreement"></div>
          </div>

          <div class="sh-checkout-foot">
            <button type="button" id="sh-checkout-pay-btn" class="sh-checkout-pay-btn">결제 진행</button>
            <div class="sh-checkout-helper">결제수단을 선택한 뒤 결제를 진행하세요.</div>
          </div>
        </div>
      `;
    }

    paymentMethodEl = document.getElementById("payment-method");
    agreementEl = document.getElementById("agreement");
    payBtnEl = document.getElementById("sh-checkout-pay-btn");
    summaryCountEl = document.getElementById("sh-checkout-count");
    summaryAmountEl = document.getElementById("sh-checkout-amount");
    summaryBibEl = document.getElementById("sh-checkout-bib");
  }

  function renderEmptyState(message) {
    if (!rootEl) ensureCheckoutDom();
    rootEl.innerHTML = `
      <div class="sh-checkout-empty">
        <div style="font-size:18px;font-weight:800;line-height:1.4;">${message}</div>
        <button type="button" id="sh-checkout-back-btn" class="sh-checkout-back-btn">장바구니로 돌아가기</button>
      </div>
    `;
    const backBtn = document.getElementById("sh-checkout-back-btn");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        window.location.href = appendShoutTrackingToUrl("/cart");
      });
    }
  }

  function renderErrorState(message) {
    if (!rootEl) ensureCheckoutDom();
    rootEl.innerHTML = `
      <div class="sh-checkout-error">
        <div style="font-size:18px;font-weight:800;line-height:1.4;">${message}</div>
        <button type="button" id="sh-checkout-back-btn" class="sh-checkout-back-btn">장바구니로 돌아가기</button>
      </div>
    `;
    const backBtn = document.getElementById("sh-checkout-back-btn");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        window.location.href = appendShoutTrackingToUrl("/cart");
      });
    }
  }

  function formatBibListForSummary(bibMeta) {
    const list = uniqueStrings((bibMeta || []).map((row) => {
      if (!row) return "";
      return row.identifier_type === "name" ? row.identifier_value : (row.bib || row.identifier_value);
    }));
    if (!list.length) return "-";
    if (list.length <= 3) return list.join(", ");
    return list.slice(0, 3).join(", ") + " 외 " + String(list.length - 3) + "개";
  }

  function updateSummary() {
    const items = getSelectedItems();
    const bibMeta = buildBibMeta(items);
    const amount = calcTotalAmountByGroups(items);

    if (summaryCountEl) summaryCountEl.textContent = String(items.length) + "장";
    if (summaryBibEl) summaryBibEl.textContent = formatBibListForSummary(bibMeta);
    if (summaryAmountEl) summaryAmountEl.textContent = formatKRW(amount);
  }

  async function initPaymentWidget(forceRerender) {
    try {
      ensureCheckoutDom();

      if (!paymentMethodEl || !agreementEl) {
        throw new Error("payment widget mount point not found");
      }

      const amountValue = getEstimatedAmount();
      if (amountValue <= 0) {
        renderEmptyState("선택된 사진이 없습니다.");
        return;
      }

      const customerKey = getPaymentWidgetCustomerKey();

      if (!tossPaymentsInstance || paymentWidgetCustomerKey !== customerKey) {
        tossPaymentsInstance = TossPayments(TOSS_CLIENT_KEY);
        paymentWidgets = tossPaymentsInstance.widgets({ customerKey: customerKey });
        paymentWidgetCustomerKey = customerKey;
        paymentWidgetReady = false;
        paymentWidgetLastAmount = null;
      }

      if (!paymentWidgets) {
        throw new Error("widgets instance not created");
      }

      if (paymentWidgetRenderPending) return;
      paymentWidgetRenderPending = true;

      try {
        if (paymentWidgetLastAmount !== amountValue) {
          await paymentWidgets.setAmount({
            currency: "KRW",
            value: amountValue
          });
          paymentWidgetLastAmount = amountValue;
        }

        if (!paymentWidgetReady || forceRerender) {
          paymentMethodEl.innerHTML = "";
          agreementEl.innerHTML = "";

          await paymentWidgets.renderPaymentMethods({
            selector: "#payment-method"
          });

          await paymentWidgets.renderAgreement({
            selector: "#agreement"
          });

          paymentWidgetReady = true;
        }
      } finally {
        paymentWidgetRenderPending = false;
      }
    } catch (e) {
      warn("initPaymentWidget", e);
      renderErrorState("결제 위젯을 준비하지 못했습니다.");
    }
  }

  async function startPayment() {
    try {
      const tracking = getShoutTrackingContext();

      const userId = String(localStorage.getItem("shout_users_id") || "").trim();
      const accessToken = sessionStorage.getItem("shout_access_token") || "";
      if (!userId || !accessToken) {
        try {
          sessionStorage.setItem(AUTH_INTENT_KEY, JSON.stringify({
            after: "checkout_payment",
            return_to: appendShoutTrackingToUrl("/checkout"),
            fallback_to: appendShoutTrackingToUrl("/cart"),
            created_at: Date.now()
          }));
        } catch (e) {
          warn("auth.intent.store", e);
        }
        window.location.href = AUTH_LOGIN_URL;
        return;
      }

      const items = getSelectedItems();
      if (!items || items.length === 0) {
        alert("장바구니가 비어있습니다.");
        return;
      }

      const primaryIdentifier = getPrimaryIdentifier(items);
      const bibMeta = buildBibMeta(items);
      if (!primaryIdentifier.value) {
        alert("검색 식별자가 없어 결제를 진행할 수 없습니다. 다시 담아주세요.");
        return;
      }

      const seen = new Set();
      const photoIds = [];
      for (const it of items) {
        const id = String((it && (it._id || it.photo_id || it.photoId || it.id)) || "").trim();
        if (!id) continue;
        if (seen.has(id)) continue;
        seen.add(id);
        photoIds.push(id);
      }

      if (photoIds.length === 0) {
        alert("결제 가능한 사진이 없습니다.");
        return;
      }

      let amount = calcTotalAmountByGroups(items);
      let orderId = "shout_" + Date.now() + "_" + Math.random().toString(16).slice(2, 8);
      const orderName = "사진 " + photoIds.length + "장";

      if (payBtnEl) {
        payBtnEl.disabled = true;
        payBtnEl.textContent = "주문 생성 중...";
      }

      const url = BUBBLE_API_ORIGIN.replace(/\/$/, "") + WF_CREATE_ORDER;

      const groupMap = {};
      (items || []).forEach((it) => {
        const eventCode = getEventCodeValue(it);
        const identifier = getCheckoutIdentifier(it);
        const photoId = getItemId(it);
        if (!eventCode || !identifier.value || !photoId) return;
        const ocrBib = identifier.type === "bib" ? (identifier.bib || identifier.value) : "";
        const ocrName = identifier.type === "name" ? (identifier.ocr_name || identifier.value) : "";

        const key = `${eventCode}_${identifier.type}_${identifier.value}`;
        if (!groupMap[key]) {
          groupMap[key] = {
            event_code: eventCode,
            identifier_type: identifier.type,
            identifier_value: identifier.value,
            searched_query: identifier.value || identifier.bib || "",
            bib: identifier.bib,
            ocr_bib: ocrBib,
            ocr_name: ocrName,
            photo_ids: []
          };
        }
        groupMap[key].photo_ids.push(photoId);
      });
      const groups = Object.values(groupMap);

      let totalAmount = 0;

      for (const group of groups) {
        const body = new URLSearchParams();
        body.set("users_id", userId);
        body.set("access_token", accessToken);
        body.set("orderId", orderId);
        body.set("event_code", group.event_code || "");
        body.set("identifier_type", group.identifier_type || "");
        body.set("identifier_value", group.identifier_value || "");
        body.set("ocr_bib", group.ocr_bib || "");
        body.set("ocr_name", group.ocr_name || "");
        body.set("searched_query", group.searched_query || group.identifier_value || group.bib || "");
        body.set("bib", group.bib || "");
        body.set("paymentKey", "__PENDING__");

        const sessionId = getTrackingSessionId(tracking);
        body.set("session_id", sessionId);
        body.set("local_user", (tracking && tracking.local_user) || "");
        body.set("session_key", (tracking && tracking.ses_k) || "");
        body.set("utm_source", (tracking && tracking.utm_s) || "");
        body.set("utm_campaign", (tracking && tracking.utm_campaign) || "");

        (group.photo_ids || []).forEach((pid) => {
          body.append("photo_ids", pid);
        });

        const groupPhotoIdsJson = JSON.stringify(group.photo_ids || []);
        body.set("photo_ids_json", groupPhotoIdsJson);

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
          },
          body: body.toString()
        });

        let rawText = "";
        let j = null;

        try { rawText = await res.text(); } catch (e) { warn("createOrder.readText", e); }
        try { j = rawText ? JSON.parse(rawText) : null; } catch (e) {}

        if (!res.ok) {
          console.error("create-order 실패:", rawText);
          warn("createOrder.httpError", new Error(`HTTP ${res.status}`), {
            url,
            status: res.status,
            response: (j || rawText || "").toString().slice(0, 2000),
            group: group
          });
          throw new Error(rawText || `create-order failed for group ${group.event_code}_${group.identifier_type}_${group.identifier_value}`);
        }

        const bubble = j && (j.response || j);
        let amt = 0;
        if (bubble && bubble.amount != null) {
          amt = Number(bubble.amount);
          if (!Number.isFinite(amt)) amt = 0;
        }

        totalAmount += amt;
      }

      amount = totalAmount;

      if (paymentWidgetLastAmount !== amount) {
        await paymentWidgets.setAmount({
          currency: "KRW",
          value: amount
        });
        paymentWidgetLastAmount = amount;
      }

      if (payBtnEl) {
        payBtnEl.disabled = true;
        payBtnEl.textContent = "결제 요청 중...";
      }

      const checkoutContext = buildCheckoutContext(items, {
        users_id: userId,
        session_id: getTrackingSessionId(tracking),
        tracking: tracking,
        order_id: orderId,
        order_name: orderName,
        amount: amount,
        primary_bib: primaryIdentifier.bib,
        primary_identifier_type: primaryIdentifier.type,
        primary_identifier_value: primaryIdentifier.value,
        photo_ids: photoIds
      });

      persistCheckoutContext(checkoutContext);

      const successUrlObj = new URL(SUCCESS_URL, window.location.origin);
      successUrlObj.searchParams.set("ctx", orderId);
      successUrlObj.searchParams.set("from", "checkout");

      const sessionId = getTrackingSessionId(tracking);
      successUrlObj.searchParams.set("session_id", sessionId);

      const failUrlObj = new URL(FAIL_URL, window.location.origin);
      failUrlObj.searchParams.set("ctx", orderId);
      failUrlObj.searchParams.set("from", "checkout");
      failUrlObj.searchParams.set("session_id", getTrackingSessionId(tracking));
      const successUrlWithTracking = new URL(
        appendShoutTrackingToUrl(successUrlObj.toString()),
        window.location.origin
      ).toString();
      const failUrlWithTracking = new URL(
        appendShoutTrackingToUrl(failUrlObj.toString()),
        window.location.origin
      ).toString();

      await paymentWidgets.requestPayment({
        orderId: orderId,
        orderName: orderName,
        successUrl: successUrlWithTracking,
        failUrl: failUrlWithTracking,
        windowTarget: "self"
      });

    } catch (err) {
      console.error("[checkout.startPayment] error:", err);
      alert("결제 진행 중 오류가 발생했습니다.");
    } finally {
      if (payBtnEl) {
        payBtnEl.disabled = false;
        payBtnEl.textContent = "결제 진행";
      }
    }
  }

  function bindEvents() {
    if (!payBtnEl || payBtnEl.__boundCheckoutPay) return;
    payBtnEl.__boundCheckoutPay = true;
    payBtnEl.addEventListener("click", startPayment);
  }

  function consumeCheckoutAuthIntent() {
    try {
      const rawIntent = sessionStorage.getItem(AUTH_INTENT_KEY);
      if (!rawIntent) return;

      const intent = JSON.parse(rawIntent);
      if (!intent || intent.after !== "checkout_payment") return;

      const createdAt = Number(intent.created_at);
      const isFreshIntent = !createdAt || (Number.isFinite(createdAt) && Date.now() - createdAt <= AUTH_INTENT_TTL_MS);
      if (!isFreshIntent || String(localStorage.getItem("shout_users_id") || "").trim()) {
        sessionStorage.removeItem(AUTH_INTENT_KEY);
      }
    } catch (e) {
      try { sessionStorage.removeItem(AUTH_INTENT_KEY); } catch (_) {}
    }
  }

  function bootstrap() {
    if (typeof TossPayments !== "function") {
      renderErrorState("결제 모듈을 불러오지 못했습니다.");
      return;
    }

    consumeCheckoutAuthIntent();
    loadCartFromStorage();
    ensureSelectedIds();
    ensureCheckoutDom();

    const items = getSelectedItems();
    const primaryIdentifier = getPrimaryIdentifier(items);

    if (!items || items.length === 0) {
      renderEmptyState("선택된 사진이 없습니다.");
      return;
    }

    if (!primaryIdentifier.value) {
      renderErrorState("검색 식별자가 없어 결제를 진행할 수 없습니다.");
      return;
    }

    updateSummary();
    bindEvents();
    initPaymentWidget(false).catch((e) => {
      warn("bootstrap.initPaymentWidget", e);
      renderErrorState("결제 위젯을 준비하지 못했습니다.");
    });
  }

  bootstrap();
});
})();
</script>
