document.addEventListener("DOMContentLoaded", function() {
  const AUTH_INTENT_KEY = "shout_auth_intent";
  const CHECKOUT_CONTEXT_KEY = "shout_checkout_context";
  const AUTH_LOGIN_URL = "/login";
  const UNIT_PRICE = 6000;
  const PACKAGE_THRESHOLD = 5;
  const PACKAGE_PRICE = 24900;
  const PACKAGE_LABEL_TEXT = "무제한 패키지";

  // Debug toggles: add ?debug_cart=1 to enable verbose warnings
  const DEBUG_CART = (new URLSearchParams(location.search).get("debug_cart") === "1");
  function warn(tag, err, extra) {
    if (!DEBUG_CART) return;
    try { console.warn(`[Cart Warning] ${tag}`, err, extra || ""); } catch (_) {}
  }
  function log(tag, extra) {
    if (!DEBUG_CART) return;
    try { console.log(`[Cart Debug] ${tag}`, extra || ""); } catch (_) {}
  }

  // Prevent double init (multiple DOMContentLoaded listeners / script duplicates)
  if (window.__SHOUT_CART_INIT_DONE__) return;
  window.__SHOUT_CART_INIT_DONE__ = true;

  let cartLoadingMaskEl = null;

  function ensureCartLoadingMask() {
    if (cartLoadingMaskEl && document.body && document.body.contains(cartLoadingMaskEl)) return cartLoadingMaskEl;
    cartLoadingMaskEl = document.getElementById("sh-cart-loading-mask");
    if (!cartLoadingMaskEl) {
      cartLoadingMaskEl = document.createElement("div");
      cartLoadingMaskEl.id = "sh-cart-loading-mask";
      cartLoadingMaskEl.setAttribute("aria-hidden", "true");
      cartLoadingMaskEl.innerHTML = [
        '<div class="sh-cart-loading-box" role="status" aria-live="polite" aria-label="장바구니 불러오는 중">',
        '  <div class="sh-cart-loading-spinner"></div>',
        '  <div class="sh-cart-loading-text">장바구니를 불러오는 중입니다.</div>',
        '</div>'
      ].join("");
      document.body.appendChild(cartLoadingMaskEl);
    }
    return cartLoadingMaskEl;
  }

  function setInitialCartLoadingState(isLoading) {
    if (!document.body) return;
    ensureCartLoadingMask();
    if (isLoading) {
      document.body.classList.add("sh-cart-loading");
      document.body.classList.remove("sh-cart-ready");
      return;
    }
    document.body.classList.remove("sh-cart-loading");
    document.body.classList.add("sh-cart-ready");
  }

  setInitialCartLoadingState(true);

  function calcAmountByCount(count) {
    const c = Number(count) || 0;
    if (c >= PACKAGE_THRESHOLD) return PACKAGE_PRICE;
    return c * UNIT_PRICE;
  }

  function formatKRW(n) {
    return Number(n).toLocaleString("ko-KR") + "원";
  }

  function buildCheckoutContext(items, extra) {
    const list = Array.isArray(items) ? items : [];
    const groupsMap = new Map();
    list.forEach((it) => {
      const eventId = String((it && (it.event_id || it.eventId || it.event_code)) || "").trim();
      const eventDisplayName = String((it && (it.event_display_name || it.eventName || it.event_name)) || "").trim();
      const bib = String((it && (it.bib ?? it.bib_no ?? it.bibNumber ?? it.bib_number)) || "").trim();
      const key = `${eventId}__${bib}`;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          event_id: eventId,
          event_display_name: eventDisplayName,
          bib: bib,
          count: 0
        });
      }
      groupsMap.get(key).count += 1;
    });
    return {
      saved_at: Date.now(),
      order_id: String((extra && (extra.order_id || extra.orderId)) || "").trim(),
      order_name: String((extra && (extra.order_name || extra.orderName)) || "").trim(),
      amount: Number((extra && extra.amount) || 0) || 0,
      users_id: String((extra && extra.users_id) || "").trim(),
      primary_bib: String((extra && extra.primary_bib) || "").trim(),
      selected_count: list.length,
      photo_ids: Array.isArray(extra && extra.photo_ids) ? extra.photo_ids : [],
      bib_meta: Array.isArray(extra && extra.bib_meta) ? extra.bib_meta : [],
      groups: Array.from(groupsMap.values())
    };
  }

  function persistCheckoutContext(ctx) {
    try {
      const raw = JSON.stringify(ctx || {});
      sessionStorage.setItem(CHECKOUT_CONTEXT_KEY, raw);
      localStorage.setItem(CHECKOUT_CONTEXT_KEY, raw);
    } catch (e) { warn("silent catch: checkout.context.persist", e); }
  }

  function getGroupKey(it) {
    const eventId = String(it && (it.event_id || it.event_code || it.eventId) || "").trim();
    const bib = String(it && it.bib || "").trim();
    return `${eventId}__${bib}`;
  }

  function groupItemsByEventBib(items) {
    const map = new Map();
    for (const it of (items || [])) {
      const k = getGroupKey(it);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(it);
    }
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

  function buildBibMeta(items) {
    const groups = groupItemsByEventBib(items);
    const out = [];
    for (const [k, arr] of groups.entries()) {
      const [eventId, bib] = k.split("__");
      out.push({
        event_id: eventId,
        bib: bib,
        count: arr.length
      });
    }
    return out;
  }

  function getPrimaryBib(items) {
    for (const it of (items || [])) {
      const b = (it && (it.bib ?? it.bib_no ?? it.bibNumber ?? it.bib_number)) ?? "";
      const s = String(b).trim();
      if (s) return s;
    }
    return "";
  }

  function updateFooterMeta(groups) {
    const selectedIds = getSelectedIds();
    const count = selectedIds.length;
    if (selectedCountText) selectedCountText.textContent = `${count}장`;
    const selectedSet = new Set(selectedIds);
    const hasPackage = Array.isArray(groups) ?
      groups.some(g => {
        const arr = Array.isArray(g.items) ? g.items : [];
        const c = arr.reduce((n, it) => n + (selectedSet.has(getItemId(it)) ? 1 : 0), 0);
        return c >= PACKAGE_THRESHOLD;
      }) :
      (count >= PACKAGE_THRESHOLD);
    if (packageLabelText) {
      packageLabelText.textContent = hasPackage ? PACKAGE_LABEL_TEXT : "";
    }
  }
  const TOSS_CLIENT_KEY = "test_gck_Z61JOxRQVEbNXYJv1q4grW0X9bAq";
  const SUCCESS_URL = window.location.origin + "/payments-results/success";
  const FAIL_URL = window.location.origin + "/payments-results/fail";
  const CHECKOUT_PAGE_URL = window.location.origin + "/checkout";
  const MOBILE_CHECKOUT_MAX_WIDTH = 767.98;
  const THUMB_SCROLL_STEP = 280;
  const BUBBLE_API_ORIGIN = "https://plp-62309.bubbleapps.io/version-test";
  const WF_CREATE_ORDER = "/api/1.1/wf/create-order";
  let container = document.getElementById("cart-list-container");
  let priceText = document.getElementById("cart-total-price");
  let checkoutBtn = document.getElementById("btn-checkout");
  let checkoutLocked = true;
  let agreeCheckbox = document.getElementById("checkout-agree");

  /* [CHECK 1] 결제위젯 상태 전역 관리 + mount point는 모달 내부에서만 사용 */
  let paymentMethodEl = document.getElementById("payment-method");
  let agreementEl = document.getElementById("agreement");
  let widgetSectionEl = document.getElementById("sh-payment-widget-section");
  let paymentModalEl = document.getElementById("sh-payment-modal");
  let paymentModalBackdropEl = null;
  let paymentModalPanelEl = null;
  let paymentModalCloseBtnEl = null;
  let paymentModalConfirmBtnEl = null;
  let paymentModalTitleEl = null;
  let paymentModalAmountEl = null;
  let paymentModalSelectedCountEl = null;
  let paymentModalBibListEl = null;
  let paymentModalPlannedAmountEl = null;
  let tossPaymentsInstance = null;
  let paymentWidgets = null;
  let paymentWidgetReady = false;
  let paymentWidgetRenderPending = false;
  let paymentWidgetCustomerKey = "";
  let paymentWidgetLastAmount = null;
  let paymentModalOpen = false;

  function getOrCreateAnonymousCustomerKey() {
    try {
      const KEY = "shout_toss_widget_customer_key";
      let v = sessionStorage.getItem(KEY);
      if (v) return String(v);
      v = "anon_" + Date.now() + "_" + Math.random().toString(16).slice(2, 10);
      sessionStorage.setItem(KEY, v);
      return String(v);
    } catch (e) {
      warn("silent catch: widget.customerKey.session", e);
      return "anon_" + Date.now() + "_" + Math.random().toString(16).slice(2, 10);
    }
  }

  function getPaymentWidgetCustomerKey() {
    const userId = String(localStorage.getItem("shout_users_id") || "").trim();
    if (userId) return "user_" + userId;
    return getOrCreateAnonymousCustomerKey();
  }

  function ensurePaymentWidgetDom() {
    if (paymentModalEl && paymentMethodEl && agreementEl && paymentModalConfirmBtnEl) {
      return paymentModalEl;
    }

    paymentModalEl = document.getElementById("sh-payment-modal");
    if (!paymentModalEl) {
      paymentModalEl = document.createElement("div");
      paymentModalEl.id = "sh-payment-modal";
      paymentModalEl.className = "sh-payment-modal";
      paymentModalEl.style.cssText = [
        "position:fixed",
        "inset:0",
        "z-index:999999",
        "display:none",
        "align-items:center",
        "justify-content:center",
        "padding:24px",
        "box-sizing:border-box"
      ].join(";");
      paymentModalEl.innerHTML = `
        <div class="sh-payment-modal-backdrop" style="position:absolute;inset:0;background:rgba(17,24,39,0.58);"></div>
        <div class="sh-payment-modal-panel" role="dialog" aria-modal="true" aria-labelledby="sh-payment-modal-title" style="position:relative;width:min(560px,calc(100vw - 48px));max-height:calc(100vh - 48px);background:#fff;border-radius:20px;box-shadow:0 24px 80px rgba(15,23,42,0.28);overflow:hidden;display:flex;flex-direction:column;">
          <div class="sh-payment-modal-head" style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px 14px;border-bottom:1px solid rgba(15,23,42,0.08);">
            <div>
              <div id="sh-payment-modal-title" style="font-size:18px;font-weight:700;line-height:1.3;color:#111827;">결제수단 선택</div>
              <div id="sh-payment-modal-amount" style="margin-top:4px;font-size:13px;line-height:1.4;color:#6b7280;">선택한 사진 기준 금액</div>
            </div>
            <button type="button" class="sh-payment-modal-close" aria-label="닫기" style="border:0;background:transparent;font-size:28px;line-height:1;color:#111827;cursor:pointer;padding:0 2px;">×</button>
          </div>
          <div class="sh-payment-modal-body" style="padding:16px 16px 0;overflow:auto;">
            <div class="sh-payment-modal-summary" style="margin-bottom:16px;padding:16px 18px;border-radius:16px;background:#f8fafc;border:1px solid rgba(15,23,42,0.08);">
              <div class="sh-payment-summary-row" style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
                <div style="font-size:15px;line-height:1.5;color:#374151;">선택 사진</div>
                <div id="sh-payment-modal-selected-count" style="font-size:15px;line-height:1.5;font-weight:700;color:#111827;">0장</div>
              </div>
              <div class="sh-payment-summary-row" style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:12px;">
                <div style="font-size:15px;line-height:1.5;color:#374151;">참가번호</div>
                <div id="sh-payment-modal-bib-list" style="font-size:15px;line-height:1.5;font-weight:700;color:#111827;text-align:right;word-break:break-word;">-</div>
              </div>
              <div class="sh-payment-summary-row" style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:12px;">
                <div style="font-size:15px;line-height:1.5;color:#374151;">결제 예정 금액</div>
                <div id="sh-payment-modal-planned-amount" style="font-size:15px;line-height:1.5;font-weight:700;color:#111827;">0원</div>
              </div>
            </div>
            <div id="sh-payment-widget-section" class="sh-payment-widget-section">
              <div id="payment-method" class="sh-payment-method"></div>
              <div id="agreement" class="sh-payment-agreement" style="margin-top:14px;"></div>
            </div>
          </div>
          <div class="sh-payment-modal-foot" style="padding:16px;border-top:1px solid rgba(15,23,42,0.08);background:#fff;">
            <button type="button" id="sh-payment-confirm-btn" class="sh-payment-confirm-btn" style="width:100%;height:52px;border:0;border-radius:14px;background:#0064ff;color:#fff;font-size:16px;font-weight:700;cursor:pointer;">결제 진행</button>
          </div>
        </div>
      `;
      document.body.appendChild(paymentModalEl);
    }

    paymentModalBackdropEl = paymentModalEl.querySelector('.sh-payment-modal-backdrop');
    paymentModalPanelEl = paymentModalEl.querySelector('.sh-payment-modal-panel');
    paymentModalCloseBtnEl = paymentModalEl.querySelector('.sh-payment-modal-close');
    paymentModalConfirmBtnEl = paymentModalEl.querySelector('#sh-payment-confirm-btn');
    paymentModalTitleEl = paymentModalEl.querySelector('#sh-payment-modal-title');
    paymentModalAmountEl = paymentModalEl.querySelector('#sh-payment-modal-amount');
    paymentModalSelectedCountEl = paymentModalEl.querySelector('#sh-payment-modal-selected-count');
    paymentModalBibListEl = paymentModalEl.querySelector('#sh-payment-modal-bib-list');
    paymentModalPlannedAmountEl = paymentModalEl.querySelector('#sh-payment-modal-planned-amount');
    widgetSectionEl = paymentModalEl.querySelector('#sh-payment-widget-section');
    paymentMethodEl = paymentModalEl.querySelector('#payment-method');
    agreementEl = paymentModalEl.querySelector('#agreement');

    if (paymentModalBackdropEl && !paymentModalBackdropEl.__boundClose) {
      paymentModalBackdropEl.__boundClose = true;
      paymentModalBackdropEl.addEventListener('click', closePaymentModal);
    }
    if (paymentModalCloseBtnEl && !paymentModalCloseBtnEl.__boundClose) {
      paymentModalCloseBtnEl.__boundClose = true;
      paymentModalCloseBtnEl.addEventListener('click', closePaymentModal);
    }
    if (paymentModalConfirmBtnEl && !paymentModalConfirmBtnEl.__boundConfirm) {
      paymentModalConfirmBtnEl.__boundConfirm = true;
      paymentModalConfirmBtnEl.addEventListener('click', callStartPayment);
    }
    if (!paymentModalEl.__boundEsc) {
      paymentModalEl.__boundEsc = true;
      document.addEventListener('keydown', function(ev) {
        if (!paymentModalOpen) return;
        if (ev.key === 'Escape') closePaymentModal();
      });
    }
    return paymentModalEl;
  }

  function getSelectedBibListForModalSummary() {
    const allItems = (window.ShoutCart && typeof window.ShoutCart.getItems === 'function') ? window.ShoutCart.getItems() : cartItems;
    const items = getSelectedItemsFrom(allItems);
    const seen = new Set();
    const out = [];
    (Array.isArray(items) ? items : []).forEach((it) => {
      const bib = String((it && (it.bib ?? it.bib_no ?? it.bibNumber ?? it.bib_number)) || "").trim();
      if (!bib) return;
      if (seen.has(bib)) return;
      seen.add(bib);
      out.push(bib);
    });
    return out;
  }

  function formatBibListForModalSummary(bibList) {
    const list = (Array.isArray(bibList) ? bibList : []).map((x) => String(x || "").trim()).filter(Boolean);
    if (!list.length) return "-";
    if (list.length <= 3) return list.join(", ");
    return `${list.slice(0, 3).join(", ")} 외 ${list.length - 3}개`;
  }

  function updatePaymentModalSummary(amountValue) {
    const count = getSelectedIds().length;
    const bibList = getSelectedBibListForModalSummary();
    if (paymentModalAmountEl) paymentModalAmountEl.textContent = `${count}장 선택 · ${formatKRW(amountValue)}`;
    if (paymentModalSelectedCountEl) paymentModalSelectedCountEl.textContent = `${count}장`;
    if (paymentModalBibListEl) paymentModalBibListEl.textContent = formatBibListForModalSummary(bibList);
    if (paymentModalPlannedAmountEl) paymentModalPlannedAmountEl.textContent = formatKRW(amountValue);
  }

  function canOpenPaymentModalWithPrecheck() {
    /* [CHECK 2] 장바구니 약관 체크는 모달 오픈 전에 선검사한다. */
    if (agreeCheckbox && !agreeCheckbox.checked) {
      nudgeAgreeCheckbox();
      return false;
    }
    return true;
  }

  function isMobileCheckoutMode() {
    try {
      const ua = String(navigator.userAgent || navigator.vendor || window.opera || "");
      const byUa = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
      const byWidth = window.matchMedia ? window.matchMedia(`(max-width: ${MOBILE_CHECKOUT_MAX_WIDTH}px)`).matches : (window.innerWidth <= MOBILE_CHECKOUT_MAX_WIDTH);
      return !!(byUa || byWidth);
    } catch (e) {
      warn("silent catch: mobile.checkout.detect", e);
      return window.innerWidth <= MOBILE_CHECKOUT_MAX_WIDTH;
    }
  }

  function buildPreCheckoutContext(items) {
    const list = Array.isArray(items) ? items : [];
    const amount = getSelectedCheckoutAmount();
    const userId = String(localStorage.getItem("shout_users_id") || "").trim();
    const photoIds = list.map(getItemId).filter(Boolean);
    const bibMeta = buildBibMeta(list);
    const primaryBib = String((cartData && cartData.bib) || getPrimaryBib(list) || "").trim();
    return buildCheckoutContext(list, {
      users_id: userId,
      amount: amount,
      primary_bib: primaryBib,
      photo_ids: photoIds,
      bib_meta: bibMeta
    });
  }

  function goToCheckoutPage() {
    const allItems = (window.ShoutCart && typeof window.ShoutCart.getItems === 'function') ? window.ShoutCart.getItems() : cartItems;
    const items = getSelectedItemsFrom(allItems);
    
    const amountValue = getSelectedCheckoutAmount();
    if (amountValue <= 0 || !Array.isArray(items) || items.length === 0) {
      alert("장바구니가 비어있습니다.");
      return;
    }
    const ctx = buildPreCheckoutContext(items);
    persistCheckoutContext(ctx);
    try {
      sessionStorage.setItem("shout_checkout_entry", JSON.stringify({
        from: "cart",
        at: Date.now(),
        mobile: true
      }));
    } catch (e) { warn("silent catch: mobile.checkout.entry", e); }
    
    window.location.href = CHECKOUT_PAGE_URL + "?from=cart&mobile=1";
  }

  function openPaymentModal() {
    /* [CHECK 2] 결제위젯은 장바구니 안 고정배치가 아니라 모달 내부에 선렌더 */
    const amountValue = getSelectedCheckoutAmount();
    if (amountValue <= 0) {
      alert("장바구니가 비어있습니다.");
      return;
    }
    const modal = ensurePaymentWidgetDom();
    if (!modal) {
      alert("결제 모달을 준비하지 못했습니다.");
      return;
    }
    updatePaymentModalSummary(amountValue);
    modal.style.display = "flex";
    paymentModalOpen = true;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    Promise.resolve().then(() => initPaymentWidget(false)).catch((e) => {
      warn("silent catch: widget.modalOpenInit", e);
    });
  }

  function closePaymentModal() {
    if (!paymentModalEl) return;
    paymentModalEl.style.display = "none";
    paymentModalOpen = false;
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
  }

  function getSelectedCheckoutAmount() {
    const localGroups = buildEventGroups(cartItems);
    const selectedIds = getSelectedIds();
    const selectedSet = new Set(selectedIds);
    const total = localGroups.length > 0 ?
      localGroups.reduce((sum, g) => {
        const arr = Array.isArray(g.items) ? g.items : [];
        const c = arr.reduce((n, it) => n + (selectedSet.has(getItemId(it)) ? 1 : 0), 0);
        return sum + calcEventAmountByCount(c);
      }, 0) :
      calcAmountByCount(selectedIds.length);
    return Number(total) || 0;
  }

  async function initPaymentWidget(forceRerender) {
    /* [CHECK 2] 장바구니 UI 렌더 완료 후 결제위젯을 1회만 렌더 */
    if (paymentWidgetRenderPending) return;
    const amountValue = getSelectedCheckoutAmount();
    const hasItems = amountValue > 0;
    const mount = ensurePaymentWidgetDom();
    if (!mount || !paymentMethodEl || !agreementEl) return;
    if (!hasItems) return;
    updatePaymentModalSummary(amountValue);

    if (typeof TossPayments !== "function") {
      warn("widget.sdkMissing", new Error("TossPayments SDK missing"));
      return;
    }

    const nextCustomerKey = getPaymentWidgetCustomerKey();
    const shouldRecreate = !!forceRerender || !paymentWidgets || paymentWidgetCustomerKey !== nextCustomerKey;

    paymentWidgetRenderPending = true;
    try {
      if (shouldRecreate) {
        paymentWidgetCustomerKey = nextCustomerKey;
        tossPaymentsInstance = TossPayments(TOSS_CLIENT_KEY);
        paymentWidgets = tossPaymentsInstance.widgets({
          customerKey: paymentWidgetCustomerKey
        });
        paymentWidgetReady = false;
        paymentWidgetLastAmount = null;
        paymentMethodEl.innerHTML = "";
        agreementEl.innerHTML = "";
      }

      if (paymentWidgetLastAmount !== amountValue) {
        await paymentWidgets.setAmount({
          currency: "KRW",
          value: amountValue
        });
        paymentWidgetLastAmount = amountValue;
      }

      if (!paymentWidgetReady) {
        await paymentWidgets.renderPaymentMethods({
          selector: "#payment-method"
        });
        await paymentWidgets.renderAgreement({
          selector: "#agreement"
        });
        paymentWidgetReady = true;
      }
    } catch (e) {
      warn("silent catch: widget.init", e);
    } finally {
      paymentWidgetRenderPending = false;
    }
  }

  function nudgeAgreeCheckbox() {
    if (!agreeCheckbox) return;
    try {
      agreeCheckbox.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest"
      });
    } catch (e) {
      try {
        agreeCheckbox.scrollIntoView(true);
      } catch (e2) {}
    }
    try {
      agreeCheckbox.focus({
        preventScroll: true
      });
    } catch (e) {
      try {
        agreeCheckbox.focus();
      } catch (e2) {}
    }
    try {
      agreeCheckbox.classList.add("is-attn");
    } catch (e) { warn("silent catch: agreeCheckbox.attn", e); }
  }
  async function startPayment() {
    try {
      if (agreeCheckbox && !agreeCheckbox.checked) {
        alert("약관에 동의해 주세요.");
        return;
      }
      const userId = localStorage.getItem("shout_users_id");
      if (!userId) {
        try {
          sessionStorage.setItem(AUTH_INTENT_KEY, JSON.stringify({
            after: "start_payment"
          }));
        } catch (e) { warn("silent catch: auth.intent.store", e); }
        window.location.href = AUTH_LOGIN_URL;
        return;
      }
      const allItems = (window.ShoutCart && typeof window.ShoutCart.getItems === 'function') ?
        window.ShoutCart.getItems() : cartItems;
      ensureSelectedIds({
        save: true
      });
      const items = getSelectedItemsFrom(allItems);
      if (!items || items.length === 0) {
        alert("장바구니가 비어있습니다.");
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
      const bibMeta = buildBibMeta(items);
      const __bibToSend = String((cartData && cartData.bib) || getPrimaryBib(items) || "").trim();
      if (!__bibToSend) {
        alert("참가번호(bib)가 없어 결제를 진행할 수 없습니다. 다시 담아주세요.");
        return;
      }
      let amount = calcTotalAmountByGroups(items);
      const orderName = `사진 ${photoIds.length}장`;
      let orderId = `shout_${Date.now()}_${Math.random().toString(16).slice(2,8)}`;
      try {
        const url = BUBBLE_API_ORIGIN.replace(/\/$/, "") + WF_CREATE_ORDER;
        const body = new URLSearchParams();
        body.set("users_id", userId);
        body.set("orderId", orderId);
        body.set("bib", __bibToSend);
        const bibMetaJson = JSON.stringify(bibMeta || []);
        body.set("bib_meta", bibMetaJson);
        body.set("bib_meta_json", bibMetaJson);
        // paymentKey is not available yet; Bubble parameter is required, so send a placeholder.
        body.set("paymentKey", "__PENDING__");
        /* [CHECK 5] 기존 Bubble 파라미터(users_id, bib, photo_ids_json 등) 유지 */
        // Bubble workflow historically used photo_ids_json (JSON string). Some versions use photo_ids.
        // For maximum backward-compatibility, send BOTH as the same JSON array string.
        const photoIdsJson = JSON.stringify(photoIds);
        body.set("photo_ids", photoIdsJson);
        body.set("photo_ids_json", photoIdsJson);

const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
          },
          body: body.toString()
        });

        // --- Debug visibility: Bubble often returns useful error text on 400 ---
        let rawText = "";
        let j = null;
        try { rawText = await res.text(); } catch (e) { warn("silent catch: createOrder.readText", e); }
        try { j = rawText ? JSON.parse(rawText) : null; } catch (e) { /* not JSON */ }

        if (!res.ok) {
          // Expose the real reason when debug_cart=1, and STOP the payment flow to prevent data mismatch.
          warn("createOrder.httpError", new Error(`HTTP ${res.status}`), {
            url,
            status: res.status,
            statusText: res.statusText,
            response: (j || rawText || "").toString().slice(0, 2000),
            payloadKeys: Array.from(body.keys()),
            users_id: userId,
            orderId,
            photo_count: photoIds.length,
            amount
          });
          alert("주문 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
          return;
        }

        const bubble = j && (j.response || j);
        if (bubble && (bubble.order_id || bubble.orderId)) {
          orderId = bubble.order_id || bubble.orderId;
        }
        if (bubble && Number.isFinite(Number(bubble.amount))) {
          amount = Number(bubble.amount);
        }
      } catch (e) { warn("silent catch: createOrder.parseResponse", e); }
      if (typeof TossPayments !== "function") {
        alert("결제 모듈을 불러오지 못했습니다. (TossPayments)");
        return;
      }
      /* [CHECK 3] 장바구니 버튼은 모달 오픈, 모달 내부 버튼만 실제 결제 실행 */
      await initPaymentWidget(false);
      if (!paymentWidgets || !paymentWidgetReady) {
        alert("결제 위젯을 준비하지 못했습니다. 새로고침 후 다시 시도해주세요.");
        return;
      }
      if (paymentWidgetLastAmount !== amount) {
        await paymentWidgets.setAmount({
          currency: "KRW",
          value: amount
        });
        paymentWidgetLastAmount = amount;
      }
      /* [CHECK 4] create-order 응답 amount/orderId를 최종 결제 기준값으로 사용 */
      if (paymentModalConfirmBtnEl) {
        paymentModalConfirmBtnEl.disabled = true;
        paymentModalConfirmBtnEl.textContent = "결제 요청 중...";
      }
      const checkoutContext = buildCheckoutContext(items, {
        users_id: userId,
        order_id: orderId,
        order_name: orderName,
        amount: amount,
        primary_bib: __bibToSend,
        photo_ids: photoIds,
        bib_meta: bibMeta
      });
      persistCheckoutContext(checkoutContext);
      const successUrlObj = new URL(SUCCESS_URL, window.location.origin);
      successUrlObj.searchParams.set("ctx", orderId);
      successUrlObj.searchParams.set("from", "cart");
      const failUrlObj = new URL(FAIL_URL, window.location.origin);
      failUrlObj.searchParams.set("ctx", orderId);
      failUrlObj.searchParams.set("from", "cart");
      await paymentWidgets.requestPayment({
        orderId: orderId,
        orderName: orderName,
        successUrl: successUrlObj.toString(),
        failUrl: failUrlObj.toString(),
        windowTarget: "self"
      });
    } catch (err) {
      console.error("[startPayment] error:", err);
      alert("결제 진행 중 오류가 발생했습니다.");
    } finally {
      if (paymentModalConfirmBtnEl) {
        paymentModalConfirmBtnEl.disabled = false;
        paymentModalConfirmBtnEl.textContent = "결제 진행";
      }
    }
  }

  function callStartPayment(e) {
    if (agreeCheckbox && !agreeCheckbox.checked) {
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      if (e && typeof e.stopPropagation === "function") e.stopPropagation();
      nudgeAgreeCheckbox();
      return;
    }
    return startPayment(e);
  }
  let packageLabelText = document.getElementById("cart-package-label");
  let selectedCountText = document.getElementById("cart-selected-count");
  let eventListEl = document.getElementById("cart-event-list");
  const __secPreviewIdxByGroupKey = new Map();
  const __secThumbScrollByGroupKey = new Map();
  const __openGroupKeySet = new Set();

  function snapshotOpenGroupKeys() {
    __openGroupKeySet.clear();
    const openSecs = document.querySelectorAll('.cart-event-section.is-open[data-group-key]');
    openSecs.forEach(sec => {
      const k = String(sec.getAttribute('data-group-key') || '').trim();
      if (k) __openGroupKeySet.add(k);
    });
  }

  let eventTemplateEl = document.getElementById("cart-event-template");
  let thumbLeftBtn = null;
  let thumbRightBtn = null;

  // ------------------------------------------
  // CartData normalization (root bib sync)
  // - legacy cart stored bib on each item: item.bib
  // - Bubble create-order currently requires root-level "bib"
  // ------------------------------------------
  function __shout_getUniqueBib(items) {
    const set = new Set();
    (items || []).forEach((it) => {
      const b = (it && (it.bib ?? it.bib_no ?? it.bibNumber ?? it.bib_number)) ?? "";
      const s = String(b).trim();
      if (s) set.add(s);
    });
    if (set.size === 1) return Array.from(set)[0];
    return "";
  }

  function __shout_getPrimaryBib(items) {
    for (const it of (items || [])) {
      const b = (it && (it.bib ?? it.bib_no ?? it.bibNumber ?? it.bib_number)) ?? "";
      const s = String(b).trim();
      if (s) return s;
    }
    return "";
  }

  function __shout_syncRootBib(data) {
    if (!data || typeof data !== "object") return data;
    if (!Array.isArray(data.items)) data.items = [];
    const root = String(data.bib ?? "").trim();
    if (!root) {
      const b = __shout_getPrimaryBib(data.items);
      if (b) data.bib = b;
    }
    return data;
  }

  let cartData = {
    items: []
  };
  let cartItems = [];

  function getItemId(it) {
    const id = (it && (it._id || it.photo_id || it.photoId || it.id)) || "";
    return String(id).trim();
  }

  function uniqueStrings(arr) {
    const out = [];
    const seen = new Set();
    (Array.isArray(arr) ? arr : []).forEach((v) => {
      const s = String(v || "").trim();
      if (!s || seen.has(s)) return;
      seen.add(s);
      out.push(s);
    });
    return out;
  }

  function getAllCartIds() {
    const ids = [];
    (Array.isArray(cartItems) ? cartItems : []).forEach((it) => {
      const id = getItemId(it);
      if (id) ids.push(id);
    });
    return uniqueStrings(ids);
  }

  function ensureSelectedIds({
    save
  } = {
    save: false
  }) {
    const allIds = getAllCartIds();
    const before = Array.isArray(cartData && cartData.selected_ids) ? cartData.selected_ids
      .slice() : null;
    if (!cartData || typeof cartData !== "object") cartData = {
      items: Array.isArray(cartItems) ? cartItems : []
    };
    if (!Array.isArray(cartData.selected_ids)) cartData.selected_ids = allIds.slice();
    const allSet = new Set(allIds);
    cartData.selected_ids = uniqueStrings(cartData.selected_ids).filter((id) => allSet.has(id));
    if (cartData.selected_ids.length === 0 && allIds.length > 0) cartData.selected_ids = allIds
      .slice();
    const after = cartData.selected_ids.slice();
    const changed = JSON.stringify(before || []) !== JSON.stringify(after);
    if (save && changed) {
      try {
        cartData = __shout_syncRootBib(cartData);
    localStorage.setItem("shout_cart_data", JSON.stringify(cartData));
      } catch (e) { warn("silent catch: storage.saveCart", e); }
    }
    return {
      changed,
      allIds,
      selectedIds: after
    };
  }

  function getSelectedIds() {
    if (!cartData || !Array.isArray(cartData.selected_ids)) return getAllCartIds();
    return uniqueStrings(cartData.selected_ids);
  }

  function getSelectedItemsFrom(items) {
    const selectedSet = new Set(getSelectedIds());
    const out = [];
    (Array.isArray(items) ? items : []).forEach((it) => {
      const id = getItemId(it);
      if (!id) return;
      if (selectedSet.has(id)) out.push(it);
    });
    return out;
  }

  function removeFromSelectedIds(photoId, {
    save
  } = {
    save: true
  }) {
    const pid = String(photoId || "").trim();
    if (!pid) return;
    if (!cartData || !Array.isArray(cartData.selected_ids)) return;
    const beforeLen = cartData.selected_ids.length;
    cartData.selected_ids = cartData.selected_ids.filter((x) => String(x || "").trim() !== pid);
    if (save && cartData.selected_ids.length !== beforeLen) {
      try {
        cartData = __shout_syncRootBib(cartData);
    localStorage.setItem("shout_cart_data", JSON.stringify(cartData));
      } catch (e) { warn("silent catch: storage.saveCart", e); }
    }
  }
  let __shout_cart_render_seq = 0;
  let __sectionPreviewSwipeResizeWindowBound = false;
  const __sectionPreviewSwipeResizeRegistry = new Set();

  function __bindSectionPreviewSwipeResizeWindow() {
    if (__sectionPreviewSwipeResizeWindowBound) return;
    __sectionPreviewSwipeResizeWindowBound = true;

    const run = () => {
      __sectionPreviewSwipeResizeRegistry.forEach((fn) => {
        try { fn(); } catch (e) {}
      });
    };

    window.addEventListener("resize", run);
    window.addEventListener("orientationchange", run);
  }

  function __registerSectionPreviewSwipeResize(fn) {
    if (typeof fn !== "function") return () => {};
    __bindSectionPreviewSwipeResizeWindow();
    __sectionPreviewSwipeResizeRegistry.add(fn);
    return () => {
      __sectionPreviewSwipeResizeRegistry.delete(fn);
    };
  }


  function loadCartFromStorage() {
    if (window.ShoutCart && typeof window.ShoutCart.getItems === "function") {
      try {
        cartItems = window.ShoutCart.getItems() || [];
        cartData = {
          items: cartItems
        };
        ensureSelectedIds({
          save: false
        });
        return;
      } catch (e) { warn("silent catch: ShoutCart.getItems", e); }
    }
    const savedData = localStorage.getItem("shout_cart_data");
    if (!savedData) {
      cartItems = [];
      return;
    }
    try {
      const parsed = JSON.parse(savedData);
      if (parsed && Array.isArray(parsed.items)) {
        cartData = parsed;
        cartData = __shout_syncRootBib(cartData);
        cartItems = cartData.items;
        try { localStorage.setItem("shout_cart_data", JSON.stringify(cartData)); } catch(e) {}
        cartItems = cartData.items;
        ensureSelectedIds({
          save: true
        });
      }
    } catch (e) {
      cartItems = [];
    }
  }

  function getUsersId() {
    return localStorage.getItem("shout_users_id") || "";
  }

  function ensureCartUi() {
    if (!container) {
      container = document.createElement("div");
      container.id = "cart-list-container";
      container.classList.add("sh-cart-list-container");
      document.body.appendChild(container);
    }
    if (!priceText || !checkoutBtn) {
      const bar = document.createElement("div");
      bar.id = "sh-cart-footer-bar";
      bar.classList.add("sh-cart-footer-bar");
      const inner = document.createElement("div");
      inner.className = "sh-cart-footer-inner";
      const priceWrap = document.createElement("div");
      priceWrap.className = "sh-cart-footer-price";
      const priceLabel = document.createElement("div");
      priceLabel.textContent = "총 결제금액";
      priceLabel.className = "sh-cart-footer-price-label";
      priceText = document.createElement("div");
      priceText.id = "cart-total-price";
      priceText.className = "sh-cart-footer-price-value";
      priceText.textContent = "0";
      priceWrap.appendChild(priceLabel);
      priceWrap.appendChild(priceText);
      inner.appendChild(priceWrap);
      const rightCol = document.createElement("div");
      rightCol.className = "sh-cart-footer-right";
      const agreeWrap = document.createElement("label");
      agreeWrap.className = "sh-cart-agree-wrap";
      if (!agreeCheckbox) {
        agreeCheckbox = document.createElement("input");
        agreeCheckbox.type = "checkbox";
        agreeCheckbox.id = "checkout-agree";
      }
      const agreeText = document.createElement("span");
      agreeText.textContent = "구매 조건 및 환불 규정에 동의합니다.";
      agreeText.className = "sh-cart-agree-text";
      agreeWrap.appendChild(agreeCheckbox);
      agreeWrap.appendChild(agreeText);
      /* [CHECK 1-1] 결제위젯 mount point는 모달 내부에서만 생성한다.
         - 장바구니 푸터에는 #payment-method / #agreement 를 만들지 않는다.
         - 중복 DOM ID 방지 목적 */
      widgetSectionEl = null;
      checkoutBtn = document.createElement("button");
      checkoutBtn.id = "btn-checkout";
      checkoutBtn.disabled = false;
      checkoutBtn.className = "sh-cart-checkout-btn";
      checkoutBtn.textContent = "결제하기";
      rightCol.appendChild(agreeWrap);
      rightCol.appendChild(checkoutBtn);
      inner.appendChild(rightCol);
      bar.appendChild(inner);
      document.body.appendChild(bar);
    }
    

  }


  function isPhotoSelected(photoId) {
    const pid = String(photoId || "").trim();
    if (!pid) return false;
    try {
      const set = new Set(getSelectedIds());
      return set.has(pid);
    } catch (e) {
      return false;
    }
  }

  function toggleSelectedId(photoId) {
    const pid = String(photoId || "").trim();
    if (!pid) return;
    if (!cartData) cartData = {
      items: Array.isArray(cartItems) ? cartItems : []
    };
    if (!Array.isArray(cartData.selected_ids)) ensureSelectedIds({
      save: false
    });
    const list = Array.isArray(cartData.selected_ids) ? cartData.selected_ids.map(x => String(
      x || "").trim()).filter(Boolean) : [];
    const has = list.includes(pid);
    const next = has ? list.filter(x => x !== pid) : list.concat([pid]);
    cartData.selected_ids = uniqueStrings(next);
    try {
      cartData = __shout_syncRootBib(cartData);
    localStorage.setItem("shout_cart_data", JSON.stringify(cartData));
    } catch (e) { warn("silent catch: storage.saveCart", e); }
  }


  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function getEventCodeFromItem(item) {
    if (item && item.event_code) return String(item.event_code);
    const fn = item && item.fileName ? String(item.fileName) : "";
    const parts = fn.split("/").filter(Boolean);
    if (parts.length >= 3) return parts[2];
    return "UNKNOWN";
  }

  function getBibFromItem(item) {
    if (item && (item.bib !== undefined && item.bib !== null)) return String(item.bib);
    if (item && (item.bib_number !== undefined && item.bib_number !== null)) return String(item
      .bib_number);
    return "UNKNOWN";
  }

  function getEventDisplayNameFromItem(item, eventCode) {
    if (item && item.event_display_name) return String(item.event_display_name);
    if (cartData && cartData.event_meta && cartData.event_meta.event_display_name)
    return String(cartData.event_meta.event_display_name);
    return eventCode || "UNKNOWN";
  }

  function calcEventAmountByCount(count) {
    return (count >= PACKAGE_THRESHOLD) ? PACKAGE_PRICE : (count * UNIT_PRICE);
  }

  function buildEventGroups(items) {
    const map = new Map();
    (items || []).forEach((it) => {
      const eventCode = getEventCodeFromItem(it);
      const eventId = String((it && (it.event_id || it.eventId || it.event_code)) ||
        eventCode || "UNKNOWN");
      const bib = String(getBibFromItem(it) || "UNKNOWN");
      const name = getEventDisplayNameFromItem(it, eventCode);
      const key = `${eventId}__${bib}`;
      if (!map.has(key)) map.set(key, {
        key,
        event_code: eventCode,
        event_id: eventId,
        bib,
        event_display_name: name,
        items: []
      });
      map.get(key).items.push(it);
    });
    return Array.from(map.values());
  }
  const BUBBLE_DATA_ORIGIN = (BUBBLE_API_ORIGIN || "").replace(/\/$/, "") + "/api/1.1/obj";
  async function hydrateGroupDisplayNames(groups) {
    if (!Array.isArray(groups) || groups.length === 0) return;
    if (!BUBBLE_DATA_ORIGIN || !BUBBLE_DATA_ORIGIN.includes("/api/1.1/obj")) return;
    const need = [];
    const seen = new Set();
    groups.forEach((g) => {
      const missing = !g.event_display_name || String(g.event_display_name).trim() ===
        "" || g.event_display_name === "UNKNOWN";
      const eventId = g.event_id || g.event_code;
      if (!missing) return;
      if (!eventId) return;
      if (seen.has(eventId)) return;
      seen.add(eventId);
      need.push({
        g,
        eventId
      });
    });
    if (need.length === 0) return;
    const fetchOne = async (eventId) => {
      const constraints = encodeURIComponent(JSON.stringify([{
        key: "event_code",
        constraint_type: "equals",
        value: String(eventId)
      }]));
      const url = `${BUBBLE_DATA_ORIGIN}/event?constraints=${constraints}`;
      const r = await fetch(url, {
        method: "GET"
      });
      if (!r.ok) return null;
      const j = await r.json().catch(() => null);
      const res = j && j.response && Array.isArray(j.response.results) ? j.response
        .results : [];
      return res[0] || null;
    };
    const results = await Promise.allSettled(need.map((x) => fetchOne(x.eventId)));
    results.forEach((r, idx) => {
      if (!r || r.status !== "fulfilled") return;
      const data = r.value;
      if (!data) return;
      const name = data.event_display_name || data.display_name || data.name;
      if (!name) return;
      const target = need[idx].g;
      target.event_display_name = String(name);
      try {
        const raw = localStorage.getItem("shout_cart_data");
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && Array.isArray(parsed.items)) {
          parsed.items.forEach((it) => {
            const itEventId = it.event_id || it.eventId || it.event_code;
            if (String(itEventId || "") === String(need[idx].eventId)) it
              .event_display_name = String(name);
          });
          if (parsed.event_meta) parsed.event_meta.event_display_name = parsed.event_meta
            .event_display_name || String(name);
          localStorage.setItem("shout_cart_data", JSON.stringify(parsed));
        }
      } catch (e) { warn("silent catch: storage.migrateMeta", e); }
    });
  }

  function hideLegacySingleEventUI() {
    const hideUp = (el) => {
      if (!el) return;
      el.style.display = "none";
      const wrap = el.closest && el.closest(
        ".preview-wrapper, .nav-wrapper, .cart-wrapper, .list-wrapper");
      if (wrap) wrap.style.display = "none";
    };

    hideUp(container);
  }

  function buildSectionPreviewDOM() {
    const wrap = document.createElement("div");
    wrap.className = "cart-preview";
    const current = document.createElement("div");
    current.className = "cart-preview-current";
    let prev = document.createElement("button");
    prev.type = "button";
    prev.className = "cart-preview-btn cart-preview-prev";
    prev.textContent = "이전";
    let next = document.createElement("button");
    next.type = "button";
    next.className = "cart-preview-btn cart-preview-next";
    next.textContent = "다음";
    wrap.classList.add("sh-cart-preview-host");
    injectArrowZones(wrap);
    const csWrap = window.getComputedStyle(wrap);
    if (csWrap.position === "static") wrap.style.position = "relative";
    const prevOverlay = document.createElement("button");
    prevOverlay.type = "button";
    prevOverlay.className = "sh-cart-nav-btn is-prev";
    prevOverlay.innerHTML = "‹";
    const nextOverlay = document.createElement("button");
    nextOverlay.type = "button";
    nextOverlay.className = "sh-cart-nav-btn is-next";
    nextOverlay.innerHTML = "›";
    prevOverlay.style.opacity = "1";
    prevOverlay.style.pointerEvents = "auto";
    nextOverlay.style.opacity = "1";
    nextOverlay.style.pointerEvents = "auto";
    wrap.appendChild(prevOverlay);
    wrap.appendChild(nextOverlay);
    prev = prevOverlay;
    next = nextOverlay;
    const thumbsWrap = document.createElement("div");
    thumbsWrap.className = "cart-preview-thumbs-wrap";
    const thumbs = document.createElement("div");
    thumbs.className = "cart-preview-thumbs";
    thumbsWrap.appendChild(thumbs);
    wrap.appendChild(current);
    wrap.appendChild(thumbsWrap);
    return {
      wrap,
      current,
      thumbsWrap,
      thumbs,
      prev,
      next
    };
  }

  function normalizeUrl(url) {
    if (!url) return "";
    const s = String(url);
    if (s.startsWith("http")) return s;
    if (s.startsWith("//")) return "https:" + s;
    return s;
  }

  function bindSectionPreview(mountEl, items) {
    if (!mountEl) return;
    const list = Array.isArray(items) ? items : [];
    const ui = buildSectionPreviewDOM();
    mountEl.innerHTML = "";
    mountEl.appendChild(ui.wrap);
    const __thumbWrap = ui.thumbsWrap;
    const __gk = (list && list[0]) ? getGroupKey(list[0]) : "";
    let idx = 0;
    if (__gk && list.length) {
      const saved = __secPreviewIdxByGroupKey.get(__gk);
      if (Number.isFinite(saved)) idx = Math.max(0, Math.min(list.length - 1, saved));
    }
    if (__gk && __thumbWrap) {
      const sLeft = __secThumbScrollByGroupKey.get(__gk);
      if (Number.isFinite(sLeft)) {
        try {
          __thumbWrap.scrollLeft = sLeft;
        } catch (e) { warn("silent catch: thumbScroll.restore", e); }
      }
      __thumbWrap.addEventListener('scroll', () => {
        try {
          __secThumbScrollByGroupKey.set(__gk, __thumbWrap.scrollLeft || 0);
        } catch (e) { warn("silent catch: thumbScroll.save", e); }
      }, {
        passive: true
      });
    }
    let __secDel = null;
    let __secSel = null;

    function getSecPid() {
      const it = list[idx];
      return it && it._id ? String(it._id) : "";
    }

    function mountSectionBadges() {
      if (__secDel && __secSel) return;
      try {
        ui.wrap.classList.add("sh-cart-preview-host");
      } catch (e) { warn("silent catch: previewHost.class", e); }
      __secDel = document.createElement("button");
      __secDel.type = "button";
      __secDel.className = "sh-pv-badge is-delete";
      __secDel.setAttribute("aria-label", "사진 삭제");
      __secDel.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      __secSel = document.createElement("button");
      __secSel.type = "button";
      __secSel.className = "sh-pv-badge is-select";
      __secSel.setAttribute("aria-label", "결제 대상 선택/해제");
      __secSel.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      __secDel.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pid = getSecPid();
        if (!pid) return;
        try {
          const gk = __gk;
          if (gk) {
            const groupIds = list.map(it => it && it._id ? String(it._id) : '').filter(
              Boolean);
            const pos = groupIds.indexOf(pid);
            if (pos >= 0) {
              const newLen = Math.max(0, groupIds.length - 1);
              if (newLen === 0) __secPreviewIdxByGroupKey.delete(gk);
              else __secPreviewIdxByGroupKey.set(gk, Math.max(0, Math.min(newLen - 1,
              pos)));
            }
          }
        } catch (e0) {}
        removeItemByPhotoId(pid);
      });
      __secSel.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pid = getSecPid();
        if (!pid) return;
        const __y = window.scrollY || 0;
        const __sl = (__thumbWrap && __thumbWrap.scrollLeft) ? __thumbWrap.scrollLeft : 0;
        toggleSelectedId(pid);
        try {
          snapshotOpenGroupKeys();
        } catch (e0) {}
        try {
          renderMultiEventAccordion();
        } catch (e2) {}
        try {
          updateSectionBadgesUI();
        } catch (e3) {}
        setTimeout(() => {
          try {
            window.scrollTo(0, __y);
          } catch (e4) {}
          try {
            if (__gk && __thumbWrap) __thumbWrap.scrollLeft = __sl;
          } catch (e5) {}
        }, 0);
      });
      ui.wrap.appendChild(__secDel);
      ui.wrap.appendChild(__secSel);
      updateSectionBadgesUI();
    }

    function updateSectionBadgesUI() {
      if (!__secSel) return;
      const pid = getSecPid();
      const selected = pid ? isPhotoSelected(pid) : true;
      __secSel.classList.toggle("is-selected", !!selected);
      __secSel.classList.toggle("is-unselected", !selected);
    }

    function ensureThumbVisible(scroller, childEl, pad) {
      if (!scroller || !childEl) return;
      const p = (typeof pad === "number") ? pad : 10;

      const left = childEl.offsetLeft;
      const right = left + childEl.offsetWidth;

      const viewLeft = scroller.scrollLeft;
      const viewRight = viewLeft + scroller.clientWidth;

      if (left < viewLeft + p) {
        scroller.scrollLeft = Math.max(0, left - p);
        return;
      }
      // If clipped on right
      if (right > viewRight - p) {
        scroller.scrollLeft = Math.max(0, right - scroller.clientWidth + p);
        return;
      }
    }

        function enableGrabScroll(scroller) {
      if (!scroller) return;
      if (scroller.dataset && scroller.dataset.grabScrollReady === "1") return;
      if (scroller.dataset) scroller.dataset.grabScrollReady = "1";
      try { scroller.dataset.grabDragged = "0"; } catch (e) { warn("silent catch: grabScroll.dataset", e); }

      const DRAG_THRESHOLD_PX = 6;
      const DRAG_SPEED = 1.2;

      let isDown = false;
      let startX = 0;
      let startScrollLeft = 0;
      let dragged = false;
      let activePointerId = null;

      function setDragging(on) {
        scroller.classList.toggle("is-dragging", !!on);
      }

      function onPointerDown(e) {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        isDown = true;
        dragged = false;
        activePointerId = e.pointerId;
        startX = e.clientX;
        startScrollLeft = scroller.scrollLeft;
        setDragging(true);
        try { scroller.setPointerCapture(activePointerId); } catch (_) {}
      }

      function onPointerMove(e) {
        if (!isDown) return;
        if (activePointerId != null && e.pointerId !== activePointerId) return;
        const dx = e.clientX - startX;
        if (Math.abs(dx) > DRAG_THRESHOLD_PX) { dragged = true; try { scroller.dataset.grabDragged = "1"; } catch (e) { warn("silent catch: grabScroll.dataset", e); } }
        e.preventDefault();
        scroller.scrollLeft = startScrollLeft - dx * DRAG_SPEED;
      }

      function endPointer(e) {
        if (!isDown) return;
        if (activePointerId != null && e.pointerId !== activePointerId) return;
        isDown = false;
        setDragging(false);
        try { scroller.releasePointerCapture(activePointerId); } catch (_) {}
        activePointerId = null;
        setTimeout(() => { dragged = false; }, 0);
      }

      scroller.addEventListener("pointerdown", onPointerDown, { passive: true });
      scroller.addEventListener("pointermove", onPointerMove, { passive: false });
      scroller.addEventListener("pointerup", endPointer, { passive: true });
      scroller.addEventListener("pointercancel", endPointer, { passive: true });
      scroller.addEventListener("pointerleave", endPointer, { passive: true });

      scroller.addEventListener("click", (e) => {
        if (!dragged) return;
        e.preventDefault();
        e.stopPropagation();
      }, true);
    }

function renderThumbs() {
      ui.thumbs.innerHTML = "";
      list.forEach((it, i) => {
        const t = document.createElement("div");
        t.className = "cart-thumb" + (i === idx ? " is-active" : "");
        const u = normalizeUrl(it && it.preview_url);
        if (u) t.style.backgroundImage = `url("${u}")`;
        const pid = it && it._id ? String(it._id) : "";
        t.setAttribute("data-thumb-idx", String(i));
        ui.thumbs.appendChild(t);
      });
    }

    try {
      const activeEl = ui.thumbs && ui.thumbs.children ? ui.thumbs.children[idx] : null;
      ensureThumbVisible(ui.thumbs, activeEl, 10);
    } catch (e3) {}

    function renderCurrent() {
      const it = list[idx];
      const u = normalizeUrl(it && it.preview_url);
      ui.current.style.backgroundImage = u ? `url("${u}")` : "none";
      Array.from(ui.thumbs.children).forEach((node, i) => {
        node.classList.toggle("is-active", i === idx);
      });
      try {
        const activeEl = ui.thumbs && ui.thumbs.children ? ui.thumbs.children[idx] : null;
        ensureThumbVisible(ui.thumbs, activeEl, 10);
      } catch (e3) {}
      if (__gk) __secPreviewIdxByGroupKey.set(__gk, idx);
      try {
        updateSectionBadgesUI();
      } catch (e) { warn("silent catch: sectionBadges.update", e); }
      ui.prev.disabled = (idx <= 0);
      ui.next.disabled = (idx >= list.length - 1);
    }


    function bindSectionPreviewSwipeIOS() {
      const host = ui.current;
      if (!host) return;
      if (host.dataset.sectionPreviewSwipeBound === "1") return;
      host.dataset.sectionPreviewSwipeBound = "1";

      let __HOST_BG_HIDDEN = false;

      function hideHostBg() {
        if (__HOST_BG_HIDDEN) return;
        __HOST_BG_HIDDEN = true;
        let bgColor = "#000";
        try {
          const cs = getComputedStyle(host);
          bgColor = cs.backgroundColor || bgColor;
        } catch (_) {}
        host.style.backgroundImage = "none";
        host.style.backgroundColor = bgColor;
      }

      function restoreHostBg() {
        if (!__HOST_BG_HIDDEN) return;
        __HOST_BG_HIDDEN = false;
        host.style.backgroundColor = "";
        host.style.backgroundImage = "";
        try {
          renderCurrent();
        } catch (e) { warn("silent catch: sectionSwipe.restore", e); }
      }

      try {
        const hostCS = getComputedStyle(host);
        if (hostCS.position === "static") host.style.position = "relative";
      } catch (e) {}

      const SWIPE_WRAP_ID = `sh-cart-swipe-wrap-${__gk || 'default'}`;
      const SWIPE_TRACK_ID = `sh-cart-swipe-track-${__gk || 'default'}`;
      const PANEL_PREV_ID = `sh-cart-swipe-prev-${__gk || 'default'}`;
      const PANEL_CUR_ID = `sh-cart-swipe-cur-${__gk || 'default'}`;
      const PANEL_NEXT_ID = `sh-cart-swipe-next-${__gk || 'default'}`;

      let wrap = null;
      let track = null;
      let pPrev = null;
      let pCur = null;
      let pNext = null;

      function ensureSwipeDom() {
        try {
          const csHost = getComputedStyle(host);
          if (csHost.position === "static") host.style.position = "relative";
        } catch (_) {}

        wrap = host.querySelector(`#${CSS.escape(SWIPE_WRAP_ID)}`);
        if (!wrap) {
          wrap = document.createElement("div");
          wrap.id = SWIPE_WRAP_ID;
          Object.assign(wrap.style, {
            position: "absolute",
            inset: "0",
            overflow: "hidden",
            background: "transparent",
            zIndex: "5",
            display: "none",
            touchAction: "pan-y",
            overscrollBehavior: "contain"
          });
          host.appendChild(wrap);
        }

        try {
          const cs = getComputedStyle(host);
          wrap.style.background = cs.backgroundColor || "transparent";
        } catch (_) {}

        track = wrap.querySelector(`#${CSS.escape(SWIPE_TRACK_ID)}`);
        if (!track) {
          track = document.createElement("div");
          track.id = SWIPE_TRACK_ID;
          Object.assign(track.style, {
            display: "flex",
            width: "0px",
            height: "100%",
            willChange: "transform",
            transition: "none",
            transform: "translate3d(0,0,0)"
          });
          wrap.appendChild(track);
        }

        pPrev = wrap.querySelector(`#${CSS.escape(PANEL_PREV_ID)}`);
        if (!pPrev) { pPrev = document.createElement("div"); pPrev.id = PANEL_PREV_ID; }
        pCur = wrap.querySelector(`#${CSS.escape(PANEL_CUR_ID)}`);
        if (!pCur) { pCur = document.createElement("div"); pCur.id = PANEL_CUR_ID; }
        pNext = wrap.querySelector(`#${CSS.escape(PANEL_NEXT_ID)}`);
        if (!pNext) { pNext = document.createElement("div"); pNext.id = PANEL_NEXT_ID; }

        [pPrev, pCur, pNext].forEach((el) => {
          Object.assign(el.style, {
            flex: "0 0 auto",
            width: "0px",
            minWidth: "0px",
            height: "100%",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundSize: "contain",
            backgroundColor: "transparent",
            boxSizing: "border-box",
            padding: "0px",
            backgroundClip: "border-box",
            backgroundOrigin: "border-box",
            userSelect: "none",
            WebkitUserDrag: "none",
            touchAction: "pan-y",
            overscrollBehavior: "contain"
          });
        });

        if (pPrev.parentElement !== track) track.appendChild(pPrev);
        if (pCur.parentElement !== track) track.appendChild(pCur);
        if (pNext.parentElement !== track) track.appendChild(pNext);
      }

      function getViewportW() {
        if (!wrap) return 0;
        const cs = getComputedStyle(wrap);
        const pl = parseFloat(cs.paddingLeft) || 0;
        const pr = parseFloat(cs.paddingRight) || 0;
        return Math.max(0, (wrap.clientWidth || 0) - pl - pr);
      }

      function setTrackPx(px, withAnim) {
        if (!track) return;
        if (withAnim) track.style.transition = `transform ${ANIM_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
        else track.style.transition = "none";
        track.style.transform = `translate3d(${px}px, 0, 0)`;
      }

      function snapToCenterIdle() {
        const w = getViewportW();
        setTrackPx(-w, false);
      }

      function applySwipeSizes() {
        if (!wrap || !track || !pPrev || !pCur || !pNext) return;
        const w = getViewportW();
        if (!w) return;
        track.style.width = (w * 3) + "px";
        [pPrev, pCur, pNext].forEach((el) => {
          el.style.width = w + "px";
          el.style.minWidth = w + "px";
          el.style.flex = "0 0 " + w + "px";
        });
        snapToCenterIdle();
      }

      function preloadPanels(curIdx) {
        if (!list || list.length === 0) return;
        const cur = Math.max(0, Math.min(list.length - 1, curIdx));
        const prev = Math.max(0, cur - 1);
        const next = Math.min(list.length - 1, cur + 1);
        const curSrc = normalizeUrl(list[cur] && list[cur].preview_url);
        const prevSrc = normalizeUrl(list[prev] && list[prev].preview_url);
        const nextSrc = normalizeUrl(list[next] && list[next].preview_url);
        pCur.style.backgroundImage = curSrc ? `url("${curSrc}")` : "none";
        pPrev.style.backgroundImage = prevSrc ? `url("${prevSrc}")` : "none";
        pNext.style.backgroundImage = nextSrc ? `url("${nextSrc}")` : "none";
      }

      function hideOverlay() {
        if (!wrap) return;
        wrap.style.display = "none";
        restoreHostBg();
        snapToCenterIdle();
      }

      const ANIM_MS = 220;
      const THRESHOLD_RATIO = 0.18;
      const TAP_SLOP = 8;
      const MAX_Y = 90;

      let startX = 0;
      let startY = 0;
      let dx = 0;
      let dy = 0;
      let dragging = false;
      let animating = false;
      let axisLocked = null;

      const detachResize = __registerSectionPreviewSwipeResize(() => {
        if (!document.documentElement.contains(host)) {
          detachResize();
          return;
        }
        if (wrap && wrap.style.display !== "none") applySwipeSizes();
      });

      host.addEventListener("touchstart", (ev) => {
        if (animating) return;
        if (!list || list.length === 0) return;
        const t = ev.touches && ev.touches[0];
        if (!t) return;

        ensureSwipeDom();
        preloadPanels(idx);
        hideHostBg();
        wrap.style.display = "block";
        applySwipeSizes();
        snapToCenterIdle();

        startX = t.clientX;
        startY = t.clientY;
        dx = 0;
        dy = 0;
        axisLocked = null;
        dragging = true;

        const w = getViewportW();
        setTrackPx(-w, false);
      }, { passive: true });

      host.addEventListener("touchmove", (ev) => {
        if (!dragging) return;
        const t = ev.touches && ev.touches[0];
        if (!t) return;

        dx = t.clientX - startX;
        dy = t.clientY - startY;

        if (!axisLocked) axisLocked = (Math.abs(dx) > Math.abs(dy)) ? "x" : "y";

        if (axisLocked === "y") {
          if (Math.abs(dy) > MAX_Y && Math.abs(dy) > Math.abs(dx)) {
            dragging = false;
            animating = true;
            hideOverlay();
            setTimeout(() => { animating = false; }, ANIM_MS + 40);
          }
          return;
        }

        ev.preventDefault();
        const w = getViewportW();
        setTrackPx(-w + dx, false);
      }, { passive: false });

      function finishSwipe(nextDir) {
        const w = getViewportW();
        animating = true;
        setTrackPx(-w + (nextDir * w), true);
        setTimeout(() => {
          animating = false;
          if (nextDir < 0 && idx < list.length - 1) idx += 1;
          else if (nextDir > 0 && idx > 0) idx -= 1;
          renderCurrent();
          hideOverlay();
        }, ANIM_MS + 40);
      }

      host.addEventListener("touchend", () => {
        if (!dragging) return;
        dragging = false;
        if (!list || list.length === 0) { hideOverlay(); return; }

        const w = getViewportW();
        const threshold = w * THRESHOLD_RATIO;

        if (Math.abs(dx) <= TAP_SLOP && Math.abs(dy) <= TAP_SLOP) {
          animating = true;
          setTrackPx(-w, true);
          setTimeout(() => {
            animating = false;
            hideOverlay();
          }, ANIM_MS + 30);
          return;
        }

        if (Math.abs(dx) < threshold) {
          animating = true;
          setTrackPx(-w, true);
          setTimeout(() => {
            animating = false;
            hideOverlay();
          }, ANIM_MS + 40);
          return;
        }

        if (dx < 0) {
          if (idx >= list.length - 1) {
            animating = true;
            setTrackPx(-w, true);
            setTimeout(() => {
              animating = false;
              hideOverlay();
            }, ANIM_MS + 40);
            return;
          }
          finishSwipe(-1);
        } else {
          if (idx <= 0) {
            animating = true;
            setTrackPx(-w, true);
            setTimeout(() => {
              animating = false;
              hideOverlay();
            }, ANIM_MS + 40);
            return;
          }
          finishSwipe(1);
        }
      }, { passive: true });

      host.addEventListener("touchcancel", () => {
        if (!dragging) return;
        dragging = false;
        animating = true;
        const w = getViewportW();
        setTrackPx(-w, true);
        setTimeout(() => {
          animating = false;
          hideOverlay();
        }, ANIM_MS + 40);
      }, { passive: true });
    }

    function setupPerEventThumbNav() {
      const thumbRowEl = ui.thumbs;
      if (!thumbRowEl) return;
      try { enableGrabScroll(thumbRowEl); } catch (e0) {}

      if (!thumbRowEl.dataset.thumbClickBound) {
        thumbRowEl.dataset.thumbClickBound = "1";
        let __lastDownIdx = -1;
        let __lastDownTs = 0;

        thumbRowEl.addEventListener("pointerdown", (e) => {
          const th = e.target && e.target.closest ? e.target.closest(".cart-thumb") : null;
          if (!th) return;
          const di = th.getAttribute("data-thumb-idx");
          const ni = Number(di);
          if (!Number.isFinite(ni)) return;
          __lastDownIdx = ni;
          __lastDownTs = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
        }, true);

        thumbRowEl.addEventListener("click", (e) => {
          // If grab-scroll marked this interaction as a drag, ignore
          if (thumbRowEl.dataset.grabDragged === "1") return;

          let ni = -1;
          const th = e.target && e.target.closest ? e.target.closest(".cart-thumb") : null;
          if (th) {
            const di = th.getAttribute("data-thumb-idx");
            ni = Number(di);
          } else {
            const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
            if (__lastDownIdx >= 0 && (now - __lastDownTs) < 500) ni = __lastDownIdx;
          }

          if (!Number.isFinite(ni) || ni < 0 || ni >= list.length) return;

          idx = ni;
          renderCurrent();
          if (__gk) __secPreviewIdxByGroupKey.set(__gk, idx);
          try { mountSectionBadges(); } catch (e1) {}
          try { updateSectionBadgesUI(); } catch (e2) {}
        }, false);
      }
      const thumbsWrap = ui.wrap && ui.wrap.querySelector(".cart-preview-thumbs-wrap");
      if (!thumbsWrap) return;
      let leftBtn = thumbsWrap.querySelector(".sh-thumb-nav-btn.is-left");
      let rightBtn = thumbsWrap.querySelector(".sh-thumb-nav-btn.is-right");
      const cs = window.getComputedStyle(thumbsWrap);
      if (cs.position === "static") thumbsWrap.style.position = "relative";
      if (!leftBtn) {
        leftBtn = document.createElement("button");
        leftBtn.type = "button";
        leftBtn.className = "sh-thumb-nav-btn is-left";
        leftBtn.textContent = "‹";
        thumbsWrap.appendChild(leftBtn);
      }
      if (!rightBtn) {
        rightBtn = document.createElement("button");
        rightBtn.type = "button";
        rightBtn.className = "sh-thumb-nav-btn is-right";
        rightBtn.textContent = "›";
        thumbsWrap.appendChild(rightBtn);
      }
      const update = () => {
        const max = thumbRowEl.scrollWidth - thumbRowEl.clientWidth;
        const hasOverflow = max > 2;
        thumbsWrap.classList.toggle("is-overflow", hasOverflow);
        if (!hasOverflow) {
          leftBtn.disabled = true;
          rightBtn.disabled = true;
          return;
        }
        const x = thumbRowEl.scrollLeft;
        leftBtn.disabled = x <= 1;
        rightBtn.disabled = x >= (max - 1);
      };
      const step = () => Math.max(140, Math.floor(thumbRowEl.clientWidth * 0.7));
      leftBtn.onclick = () => {
        thumbRowEl.scrollBy({
          left: -step(),
          behavior: "smooth"
        });
        setTimeout(update, 180);
      };
      rightBtn.onclick = () => {
        thumbRowEl.scrollBy({
          left: step(),
          behavior: "smooth"
        });
        setTimeout(update, 180);
      };
      if (!thumbRowEl.dataset.thumbNavBound) {
        thumbRowEl.dataset.thumbNavBound = "1";
        thumbRowEl.addEventListener("scroll", update, {
          passive: true
        });
        window.addEventListener("resize", update);
      }
      requestAnimationFrame(() => requestAnimationFrame(update));
      setTimeout(update, 120);
    }
    ui.prev.addEventListener("click", () => {
      if (idx <= 0) return;
      idx -= 1;
      renderCurrent();
      if (__gk) __secPreviewIdxByGroupKey.set(__gk, idx);
    });
    ui.next.addEventListener("click", () => {
      if (idx >= list.length - 1) return;
      idx += 1;
      renderCurrent();
      if (__gk) __secPreviewIdxByGroupKey.set(__gk, idx);
    });
    renderThumbs();
    renderCurrent();
    mountSectionBadges();
    setupPerEventThumbNav();
    bindSectionPreviewSwipeIOS();
  }
  async function renderMultiEventAccordion() {
    const __mySeq = ++__shout_cart_render_seq;
    try {
      snapshotOpenGroupKeys();
    } catch (e) { warn("silent catch: accordion.snapshotOpen", e); }
    eventListEl = document.getElementById("cart-event-list");
    eventTemplateEl = document.getElementById("cart-event-template");
    if (!eventListEl || !eventTemplateEl) return false;
    eventTemplateEl.style.display = "none";
    hideLegacySingleEventUI();
    Array.from(eventListEl.children).forEach((ch) => {
      if (ch === eventTemplateEl) return;
      ch.remove();
    });
    const groups = buildEventGroups(cartItems);
    await hydrateGroupDisplayNames(groups);
    if (__mySeq !== __shout_cart_render_seq) return false;
    Array.from(eventListEl.children).forEach((ch) => {
      if (ch === eventTemplateEl) return;
      ch.remove();
    });
    if (groups.length === 0) {
      if (priceText) priceText.innerText = formatKRW(0);
      updateFooterMeta(groups);
      return true;
    }
    const __selectedIds = getSelectedIds();
    const __selectedSet = new Set(__selectedIds);
    let grandTotal = 0;
    groups.forEach((g, i) => {
      const section = eventTemplateEl.cloneNode(true);
      section.classList.remove("cart-event-template");
      const idx2 = pad2(i + 1);
      section.id = `cart-event-section-${idx2}`;
      section.style.display = "";
      section.classList.add("cart-event-section");
      section.setAttribute("data-event-code", String(g.event_code || ""));
      section.setAttribute("data-group-key", String(g.key || ""));
      const header = section.querySelector(".cart-event-header");
      const body = section.querySelector(".cart-event-body");
      if (header) header.id = `cart-event-header-${idx2}`;
      if (body) body.id = `cart-event-body-${idx2}`;
      const idxEl = section.querySelector(".cart-event-index");
      const titleEl = section.querySelector(".cart-event-title");
      const bibEl = section.querySelector(".cart-list-bib");
      const subtotalEl = section.querySelector(".cart-event-subtotal");
      if (idxEl) {
        idxEl.id = `cart-event-index-${idx2}`;
        idxEl.textContent = `${idx2} / Marathon`;
      }
      if (titleEl) {
        titleEl.id = `cart-event-title-${idx2}`;
        titleEl.textContent = g.event_display_name || "UNKNOWN";
      }
      if (bibEl) {
        bibEl.id = `cart-list-bib-${idx2}`;
        bibEl.textContent = `${g.bib || "-"}`;
      }
      const __allItems = Array.isArray(g.items) ? g.items : [];
      const count = __allItems.reduce((n, it) => n + (__selectedSet.has(getItemId(it)) ?
        1 : 0), 0);
      const countEl = section.querySelector("#cart-event-count");
      if (countEl) countEl.textContent = `${count}장`;
      const pckEl = section.querySelector("#cart-event-pck-price");
      if (pckEl) pckEl.style.display = (count >= PACKAGE_THRESHOLD) ? "block" : "none";
      const subtotal = calcEventAmountByCount(count);
      grandTotal += subtotal;
      if (subtotalEl) {
        subtotalEl.id = `cart-event-subtotal-${idx2}`;
        subtotalEl.textContent = Number(subtotal).toLocaleString("ko-KR") + "원";
      }
      if (body) body.style.display = "none";
      const mount = section.querySelector(".cart-event-preview-mount");
      if (mount) {
        mount.id = `cart-event-preview-mount-${idx2}`;
        bindSectionPreview(mount, g.items);
      }

      function setOpen(open) {
        if (!body) return;
        const on = !!open;
        section.classList.toggle("is-open", on);
        body.style.display = on ? "block" : "none";
        const gk = String(g.key || "").trim();
        if (gk) {
          if (on) __openGroupKeySet.add(gk);
          else __openGroupKeySet.delete(gk);
        }
      }
      if (groups.length === 1 || __openGroupKeySet.has(String(g.key || '').trim()))
        setOpen(true);
      if (header) header.style.pointerEvents = "auto";
      section.addEventListener("click", (ev) => {
        const h = ev.target && ev.target.closest ? ev.target.closest(
          ".cart-event-header") : null;
        if (!h) return;
        if (ev.target && ev.target.closest) {
          if (ev.target.closest('.sh-pv-badge') || ev.target.closest(
            '.cart-preview') || ev.target.closest('.sh-thumb-remove-btn') || ev.target
            .closest('button') && !ev.target.closest('.cart-event-header')) {
            return;
          }
        }
        const isOpen = section.classList.contains("is-open");
        setOpen(!isOpen);
      }, true);
      eventListEl.appendChild(section);
    });
    if (priceText) priceText.innerText = formatKRW(grandTotal);
    updateFooterMeta(groups);
    return true;
  }

  function renderCartList() {
    if (!container) return;
    if (cartItems.length === 0) {
      container.innerHTML =
        "<div style='padding:40px; text-align:center; color:#888;'>장바구니가 비어있습니다.</div>";
      if (priceText) priceText.innerText = formatKRW(0);
      updateFooterMeta(null);
      return;
    }
    container.innerHTML = "";
    cartItems.forEach((item, index) => {
      const itemDiv = document.createElement("div");
      itemDiv.className = "sh-cart-event-row";
      const safeSrc = item.preview_url.startsWith("http") ? item.preview_url : "https:" +
        item.preview_url;
      itemDiv.innerHTML =
        `<div style="display:flex; alignItems:center; gap:15px;"><img src="${safeSrc}" style="width:80px; height:80px; object-fit:cover; border-radius:4px; background:#f0f0f0;"><div><div style="font-weight:bold; font-size:14px;">${item.fileName || "사진"}</div><div style="font-size:12px; color:#666;">5,000원</div></div></div><button class="remove-btn" data-index="${index}" style="background:none; border:1px solid #ddd; padding:5px 10px; border-radius:4px; font-size:12px; cursor:pointer; color:#555;">삭제</button>`;
      container.appendChild(itemDiv);
    });
    document.querySelectorAll(".remove-btn").forEach(btn => {
      btn.addEventListener("click", function() {
        removeItem(this.getAttribute("data-index"));
      });
    });
    const localGroups = buildEventGroups(cartItems);
    const __selectedIds2 = getSelectedIds();
    const __selectedSet2 = new Set(__selectedIds2);
    const total = localGroups.length > 0 ?
      localGroups.reduce((sum, g) => {
        const arr = Array.isArray(g.items) ? g.items : [];
        const c = arr.reduce((n, it) => n + (__selectedSet2.has(getItemId(it)) ? 1 : 0), 0);
        return sum + calcEventAmountByCount(c);
      }, 0) :
      calcAmountByCount(__selectedIds2.length);
    if (priceText) priceText.innerText = formatKRW(total);
    updateFooterMeta(localGroups);
    if (checkoutBtn) checkoutBtn.innerText = "결제하기";
  }

  function rerenderCartUI() {
    try {
      snapshotOpenGroupKeys();
    } catch (e) { warn("silent catch: accordion.snapshotOpen", e); }
    Promise.resolve(renderMultiEventAccordion()).then((didMulti) => {
      if (!didMulti) renderCartList();
      if (paymentModalOpen) return initPaymentWidget(false);
    }).catch((e) => {
      warn("silent catch: widget.rerender.afterCart", e);
    });
  }

  function removeItemByPhotoId(photoId) {
    const pid = String(photoId || "");
    if (!pid) return;
    const idx = cartItems.findIndex((it) => it && String(it._id || "") === pid);
    if (idx < 0) return;
    removeItem(idx);
  }

  function removeItem(index) {
    const removed = cartItems[index];
    const removedId = removed && removed._id ? String(removed._id) : "";
    if (removedId && window.ShoutCart && typeof window.ShoutCart.remove === "function") {
      try {
        window.ShoutCart.remove(removedId);
        cartItems = (window.ShoutCart.getItems && window.ShoutCart.getItems()) || [];
        cartData = {
          items: cartItems
        };
        ensureSelectedIds({
          save: false
        });
      } catch (e) { warn("silent catch: ShoutCart.getItems", e); }
    } else {
      cartItems.splice(index, 1);
      cartData.items = cartItems;
      removeFromSelectedIds(removedId, {
        save: false
      });
      ensureSelectedIds({
        save: false
      });
      cartData = __shout_syncRootBib(cartData);
    localStorage.setItem("shout_cart_data", JSON.stringify(cartData));
    }
rerenderCartUI();
  }

  function encourageTag(t) {
    return t || "";
  }
  async function init() {
    if (window.__shout_cart_init_ran) return;
    window.__shout_cart_init_ran = true;
    setInitialCartLoadingState(true);
    try {
      ensureCartUi();
      loadCartFromStorage();
      window.addEventListener("shout_cart_changed", function(e) {
        try {
          loadCartFromStorage();
          rerenderCartUI();
        } catch (err) {}
      });
      const __didMulti = await renderMultiEventAccordion();
      if (!__didMulti) {
        renderCartList();
      }
      if (!isMobileCheckoutMode()) ensurePaymentWidgetDom();
      if (checkoutBtn) checkoutBtn.onclick = function(e) {
        if (e && typeof e.preventDefault === "function") e.preventDefault();
        /* [CHECK 3] 결제 버튼은 공통으로 약관 선검사 후 진행한다. 모바일은 체크아웃 페이지로 이동, 데스크톱은 모달을 연다. */
        if (!canOpenPaymentModalWithPrecheck()) return;
        if (isMobileCheckoutMode()) {
          goToCheckoutPage();
          return;
        }
        openPaymentModal();
      };
      document.querySelectorAll(".cart-preview-nav").forEach(el => el.remove());
      const intent = sessionStorage.getItem(AUTH_INTENT_KEY);
      if (intent) {
        try {
          const data = JSON.parse(intent);
          if (data && data.after === "start_payment" && localStorage.getItem(
            "shout_users_id")) {
            sessionStorage.removeItem(AUTH_INTENT_KEY);
            setTimeout(function() {
              /* [CHECK 4] 로그인 복귀 후에도 동일하게 약관 선검사 후 진행한다. 모바일은 체크아웃 페이지로 이동, 데스크톱은 모달을 연다. */
              if (!canOpenPaymentModalWithPrecheck()) return;
              if (isMobileCheckoutMode()) {
                goToCheckoutPage();
                return;
              }
              openPaymentModal();
            }, 300);
          }
        } catch (e) {
          try {
            sessionStorage.removeItem(AUTH_INTENT_KEY);
          } catch (_) {}
        }
      }
    } finally {
      setInitialCartLoadingState(false);
    }
  }
  window.addEventListener("pageshow", init);
  init();
  if (agreeCheckbox && checkoutBtn) {
    agreeCheckbox.addEventListener("change", function() {
      checkoutLocked = !this.checked;
      if (this.checked) {
        this.classList.remove("is-attn");
      }
    });
  }
});


function injectArrowZones(root) {
  try {
    if (!root) return;

    let hosts = [];
    try {
      if (root.querySelectorAll) {
        hosts = Array.from(root.querySelectorAll(".sh-cart-preview-host"));
      }
    } catch (e) {}

    try {
      if (root.classList && root.classList.contains("sh-cart-preview-host")) {
        hosts.unshift(root);
      }
    } catch (e) {}

    // De-dupe
    try {
      hosts = Array.from(new Set(hosts));
    } catch (e) {}

    hosts.forEach((host) => {
      if (host.querySelector(".sh-arrow-zone")) return;

      const prevBtn = host.querySelector("#cart-prev-btn, .sh-cart-nav-btn.is-prev");
      const nextBtn = host.querySelector("#cart-next-btn, .sh-cart-nav-btn.is-next");

      const leftZone = document.createElement("div");
      leftZone.className = "sh-arrow-zone is-left";
      const rightZone = document.createElement("div");
      rightZone.className = "sh-arrow-zone is-right";

      host.appendChild(leftZone);
      host.appendChild(rightZone);

      function setHot(which, on) {
        if (which === "prev") host.classList.toggle("sh-arrow-hot-prev", !!on);
        if (which === "next") host.classList.toggle("sh-arrow-hot-next", !!on);
      }

      function prevEnabled() {
        return !!prevBtn && !prevBtn.disabled;
      }

      function nextEnabled() {
        return !!nextBtn && !nextBtn.disabled;
      }

      leftZone.addEventListener("mouseenter", () => setHot("prev", prevEnabled()));
      leftZone.addEventListener("mouseleave", () => setHot("prev", false));
      rightZone.addEventListener("mouseenter", () => setHot("next", nextEnabled()));
      rightZone.addEventListener("mouseleave", () => setHot("next", false));

      leftZone.addEventListener("click", (e) => {
        if (!prevEnabled()) return;
        try { prevBtn && prevBtn.click(); } catch (err) {}
      });

      rightZone.addEventListener("click", (e) => {
        if (!nextEnabled()) return;
        try { nextBtn && nextBtn.click(); } catch (err) {}
      });
    });
  } catch (e) {
    try { console.warn("[Cart Warning] injectArrowZones failed", e); } catch (_) {}
  }
}

document.addEventListener("DOMContentLoaded", function() {
  if (window.__SHOUT_CART_ZONES_DONE__) return;
  window.__SHOUT_CART_ZONES_DONE__ = true;

  injectArrowZones(document);
});
