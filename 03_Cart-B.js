document.addEventListener("DOMContentLoaded", function() {
  const AUTH_INTENT_KEY = "shout_auth_intent";
  const AUTH_LOGIN_URL = "/login";
  const UNIT_PRICE = 5000;
  const PACKAGE_THRESHOLD = 5;
  const PACKAGE_PRICE = 24900;
  const PACKAGE_LABEL_TEXT = "무제한 패키지";

  function calcAmountByCount(count) {
    const c = Number(count) || 0;
    if (c >= PACKAGE_THRESHOLD) return PACKAGE_PRICE;
    return c * UNIT_PRICE;
  }

  function formatKRW(n) {
    return Number(n).toLocaleString("ko-KR") + "원";
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
  const TOSS_CLIENT_KEY = "test_ck_0RnYX2w532qQQl9gBdJl8NeyqApQ";
  const SUCCESS_URL = window.location.origin + "/payments-results/success";
  const FAIL_URL = window.location.origin + "/payments-results/fail";
  const THUMB_SCROLL_STEP = 280;
  const BUBBLE_API_ORIGIN = "https://plp-62309.bubbleapps.io/version-test/api/1.1/wf";
  const WF_CREATE_ORDER = "/api/1.1/wf/create_order";
  let container = document.getElementById("cart-list-container");
  let priceText = document.getElementById("cart-total-price");
  let checkoutBtn = document.getElementById("btn-checkout");
  let checkoutLocked = true;
  let agreeCheckbox = document.getElementById("checkout-agree");

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
    } catch (e) {}
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
        } catch (e) {}
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
        const id = String(it && it._id || "").trim();
        if (!id) continue;
        if (seen.has(id)) continue;
        seen.add(id);
        photoIds.push(id);
      }
      const bibMeta = buildBibMeta(items);
      const amount = calcTotalAmountByGroups(items);
      const orderName = `사진 ${photoIds.length}장`;
      let orderId = `shout_${Date.now()}_${Math.random().toString(16).slice(2,8)}`;
      try {
        const url = BUBBLE_API_ORIGIN.replace(/\/$/, "") + WF_CREATE_ORDER;
        const body = new URLSearchParams();
        body.set("users_id", userId);
        body.set("amount", String(amount));
        body.set("photo_ids_json", JSON.stringify(photoIds));
        body.set("bib_meta_json", JSON.stringify(bibMeta));
        body.set("success_url", SUCCESS_URL);
        body.set("fail_url", FAIL_URL);
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
          },
          body: body.toString()
        });
        const j = await res.json().catch(() => null);
        const bubble = j && (j.response || j);
        if (bubble && (bubble.order_id || bubble.orderId)) {
          orderId = bubble.order_id || bubble.orderId;
        }
      } catch (e) {}
      if (typeof TossPayments !== "function") {
        alert("결제 모듈을 불러오지 못했습니다. (TossPayments)");
        return;
      }
      const tossPayments = TossPayments(TOSS_CLIENT_KEY);
      await tossPayments.requestPayment("카드", {
        amount: amount,
        orderId: orderId,
        orderName: orderName,
        successUrl: SUCCESS_URL,
        failUrl: FAIL_URL
      });
    } catch (err) {
      console.error("[startPayment] error:", err);
      alert("결제 진행 중 오류가 발생했습니다.");
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
        localStorage.setItem("shout_cart_data", JSON.stringify(cartData));
      } catch (e) {}
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
        localStorage.setItem("shout_cart_data", JSON.stringify(cartData));
      } catch (e) {}
    }
  }
  let __shout_cart_render_seq = 0;

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
      } catch (e) {}
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
        cartItems = parsed.items;
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
      localStorage.setItem("shout_cart_data", JSON.stringify(cartData));
    } catch (e) {}
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
  const BUBBLE_DATA_ORIGIN = (BUBBLE_API_ORIGIN || "").replace("/api/1.1/wf", "/api/1.1/obj");
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
      } catch (e) {}
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
        } catch (e) {}
      }
      __thumbWrap.addEventListener('scroll', () => {
        try {
          __secThumbScrollByGroupKey.set(__gk, __thumbWrap.scrollLeft || 0);
        } catch (e) {}
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
      } catch (e) {}
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

    function renderThumbs() {
      ui.thumbs.innerHTML = "";
      list.forEach((it, i) => {
        const t = document.createElement("div");
        t.className = "cart-thumb" + (i === idx ? " is-active" : "");
        const u = normalizeUrl(it && it.preview_url);
        if (u) t.style.backgroundImage = `url("${u}")`;
        const pid = it && it._id ? String(it._id) : "";
        t.addEventListener("click", () => {
          idx = i;
          renderCurrent();
          if (__gk) __secPreviewIdxByGroupKey.set(__gk, idx);
          try {
            mountSectionBadges();
          } catch (e) {}
          try {
            updateSectionBadgesUI();
          } catch (e2) {}
        });
        ui.thumbs.appendChild(t);
      });
    }

    function renderCurrent() {
      const it = list[idx];
      const u = normalizeUrl(it && it.preview_url);
      ui.current.style.backgroundImage = u ? `url("${u}")` : "none";
      Array.from(ui.thumbs.children).forEach((node, i) => {
        node.classList.toggle("is-active", i === idx);
      });
      if (__gk) __secPreviewIdxByGroupKey.set(__gk, idx);
      try {
        updateSectionBadgesUI();
      } catch (e) {}
      ui.prev.disabled = (idx <= 0);
      ui.next.disabled = (idx >= list.length - 1);
    }

    function setupPerEventThumbNav() {
      const thumbRowEl = ui.thumbs;
      if (!thumbRowEl) return;
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
  }
  async function renderMultiEventAccordion() {
    const __mySeq = ++__shout_cart_render_seq;
    try {
      snapshotOpenGroupKeys();
    } catch (e) {}
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
      const subtotalEl = section.querySelector(".cart-event-subtotal");
      if (idxEl) {
        idxEl.id = `cart-event-index-${idx2}`;
        idxEl.textContent = `${idx2} / Marathon`;
      }
      if (titleEl) {
        titleEl.id = `cart-event-title-${idx2}`;
        titleEl.textContent = g.event_display_name || "UNKNOWN";
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
        subtotalEl.textContent = "₩ " + Number(subtotal).toLocaleString("ko-KR");
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
    } catch (e) {}
    Promise.resolve(renderMultiEventAccordion()).then((didMulti) => {
      if (didMulti) return;
      renderCartList();
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
      } catch (e) {}
    } else {
      cartItems.splice(index, 1);
      cartData.items = cartItems;
      removeFromSelectedIds(removedId, {
        save: false
      });
      ensureSelectedIds({
        save: false
      });
      localStorage.setItem("shout_cart_data", JSON.stringify(cartData));
    }
rerenderCartUI();
  }

  // (swipe removed)




  function encourageTag(t) {
    return t || "";
  }
  async function init() {
    if (window.__shout_cart_init_ran) return;
    window.__shout_cart_init_ran = true;
    ensureCartUi();
    loadCartFromStorage();
    window.addEventListener("shout_cart_changed", function(e) {
      try {
        loadCartFromStorage();
        renderMultiEventAccordion();
        renderCartList();
      } catch (err) {}
    });
    const __didMulti = await renderMultiEventAccordion();
    if (!__didMulti) {
      renderCartList();
    }
    if (checkoutBtn) checkoutBtn.onclick = callStartPayment;
    document.querySelectorAll(".cart-preview-nav").forEach(el => el.remove());
    const intent = sessionStorage.getItem(AUTH_INTENT_KEY);
    if (intent) {
      try {
        const data = JSON.parse(intent);
        if (data && data.after === "start_payment" && localStorage.getItem(
          "shout_users_id")) {
          sessionStorage.removeItem(AUTH_INTENT_KEY);
          setTimeout(startPayment, 300);
        }
      } catch (e) {
        try {
          sessionStorage.removeItem(AUTH_INTENT_KEY);
        } catch (_) {}
      }
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

// === moved from HEAD ===
document.addEventListener("DOMContentLoaded", function() {
  // IG/iOS-style hover/click zones for cart preview arrows
  const hosts = document.querySelectorAll(".sh-cart-preview-host");
  hosts.forEach((host) => {
    // Avoid double-inject
    if (host.querySelector(".sh-arrow-zone")) return;

    const prevBtn = host.querySelector("#cart-prev-btn, .sh-cart-nav-btn.is-prev");
    const nextBtn = host.querySelector("#cart-next-btn, .sh-cart-nav-btn.is-next");

    // Create zones
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

    // Hover behavior: show only while cursor is inside zone
    leftZone.addEventListener("mouseenter", () => setHot("prev", prevEnabled()));
    leftZone.addEventListener("mouseleave", () => setHot("prev", false));
    rightZone.addEventListener("mouseenter", () => setHot("next", nextEnabled()));
    rightZone.addEventListener("mouseleave", () => setHot("next", false));

    // Click near arrow triggers navigation
    leftZone.addEventListener("click", (e) => {
      if (!prevEnabled()) return;
      e.preventDefault();
      prevBtn.click();
    });
    rightZone.addEventListener("click", (e) => {
      if (!nextEnabled()) return;
      e.preventDefault();
      nextBtn.click();
    });

    // Keep states in sync if buttons become disabled/enabled dynamically
    const obs = new MutationObserver(() => {
      if (!prevEnabled()) setHot("prev", false);
      if (!nextEnabled()) setHot("next", false);
      leftZone.style.pointerEvents = prevEnabled() ? "auto" : "none";
      rightZone.style.pointerEvents = nextEnabled() ? "auto" : "none";
    });
    if (prevBtn) obs.observe(prevBtn, {
      attributes: true,
      attributeFilter: ["disabled", "style", "class"]
    });
    if (nextBtn) obs.observe(nextBtn, {
      attributes: true,
      attributeFilter: ["disabled", "style", "class"]
    });

    // Initial
    leftZone.style.pointerEvents = prevEnabled() ? "auto" : "none";
    rightZone.style.pointerEvents = nextEnabled() ? "auto" : "none";
  });
});
