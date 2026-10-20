(() => {
function initShoutGlobal() {
  if (window.__shoutGlobalInitialized) return;
  window.__shoutGlobalInitialized = true;

  // Former Head guards run with the existing DOM-ready global initializer.
  document.addEventListener("contextmenu", function(e) {
      e.preventDefault();
    });

    document.addEventListener("keydown", function(e) {
      if (e.keyCode === 123) {
        e.preventDefault();
        e.returnValue = false;
      }
      if (e.ctrlKey && e.shiftKey && e.keyCode === 73) {
        e.preventDefault();
        e.returnValue = false;
      }
      if (e.ctrlKey && e.shiftKey && e.keyCode === 74) {
        e.preventDefault();
        e.returnValue = false;
      }
      if (e.ctrlKey && e.shiftKey && e.keyCode === 67) {
        e.preventDefault();
        e.returnValue = false;
      }
      if (e.ctrlKey && e.keyCode === 85) {
        e.preventDefault();
        e.returnValue = false;
      }
    });


  function getSotInitDoneKey(ctx) {
    if (!ctx || !ctx.local_user || !ctx.session_id) return "";
    return "sot_init_done:" + ctx.local_user + ":" + ctx.session_id;
  }

  function getSotLogMeta(ctx) {
    return {
      key: getSotInitDoneKey(ctx),
      local_user: ctx && ctx.local_user,
      session_id: ctx && ctx.session_id,
      ses_k: ctx && ctx.ses_k
    };
  }

  function isSotInitDone(ctx) {
    const key = getSotInitDoneKey(ctx);
    if (!key) return false;
    try {
      return sessionStorage.getItem(key) === "yes";
    } catch (e) {
      return false;
    }
  }

  function autoInitSotTracking(reason) {
    const api = window.ShoutTracking;
    if (
      !api ||
      typeof api.getTrackingContext !== "function" ||
      typeof api.callSotInitOnce !== "function"
    ) {
      console.warn("[SOT] auto init skipped: ShoutTracking API is not ready.");
      return;
    }

    let ctx = null;
    try {
      ctx = api.getTrackingContext();
    } catch (err) {
      console.warn("[SOT] auto init failed before fetch: getTrackingContext error", err);
      return;
    }

    if (isSotInitDone(ctx)) {
      return;
    }

    api.callSotInitOnce(ctx)
      .then(function(result) {
      })
      .catch(function(err) {
        console.warn("[SOT] auto init failed", err);
      });
  }

  (function(){
    const existingTrackingApi = window.ShoutTracking;
    const hasUsableTrackingApi =
      existingTrackingApi &&
      typeof existingTrackingApi.getTrackingContext === "function" &&
      typeof existingTrackingApi.callSotInitOnce === "function";

    if (hasUsableTrackingApi) {
      setTimeout(function() {
        autoInitSotTracking("existing-api");
      }, 0);
      return;
    }

    if (existingTrackingApi) {
      console.warn("[SOT] existing ShoutTracking is incomplete. Rebuilding tracking API.", {
        hasGetTrackingContext: typeof existingTrackingApi.getTrackingContext === "function",
        hasCallSotInitOnce: typeof existingTrackingApi.callSotInitOnce === "function"
      });
    }

    const LOCAL_USER_KEYS = ["shout_local_user", "shout_local_user_id"];
    const DEFAULT_LOCAL_USER_KEY = "shout_local_user";
    const SESSION_KEY = "sot_session_id";
    const SOT_INIT_URL = "https://plp-62309.bubbleapps.io/api/1.1/wf/sot-ss";
    let lastSessionWasCreated = false;

    function safeStorage(storage, method, key, value){
      try {
        if (!storage) return null;
        if (method === "get") return storage.getItem(key);
        if (method === "set") storage.setItem(key, value);
      } catch (e) {}
      return null;
    }

    function getParams(){
      return new URLSearchParams(window.location.search || "");
    }

    function getLocalUserKey(){
      for (const key of LOCAL_USER_KEYS) {
        if (safeStorage(localStorage, "get", key)) return key;
      }
      return DEFAULT_LOCAL_USER_KEY;
    }

    function makeLocalUser(){
      return "local_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
    }

    function getOrCreateLocalUser(preferred){
      const params = getParams();
      const fromUrl = String(params.get("lid") || "").trim();
      const incomingSid = String(params.get("sid") || "").trim();
      const incomingSk = String(params.get("sk") || params.get("ses_k") || "").trim();
      const key = getLocalUserKey();
      const fromPreferred = String(preferred || "").trim();
      const fromStorage = String(safeStorage(localStorage, "get", key) || "").trim();
      const mayRestoreFromUrl = fromUrl && incomingSid && incomingSk && !fromStorage;
      const localUser = mayRestoreFromUrl
        ? fromUrl
        : (fromPreferred || fromStorage || fromUrl || makeLocalUser());
      safeStorage(localStorage, "set", key, localUser);
      return localUser;
    }

    function getSessionId(){
      let sessionId = String(safeStorage(sessionStorage, "get", SESSION_KEY) || "").trim();
      lastSessionWasCreated = false;
      if (!sessionId) {
        sessionId = "sot_" + Date.now() + "_" + Math.random().toString(36).slice(2, 10);
        safeStorage(sessionStorage, "set", SESSION_KEY, sessionId);
        lastSessionWasCreated = true;
      }
      return sessionId;
    }

    function getStoredParam(name, aliases){
      const params = getParams();
      const names = [name].concat(Array.isArray(aliases) ? aliases : []);
      let direct = "";
      for (const paramName of names) {
        direct = String(params.get(paramName) || "").trim();
        if (direct) break;
      }

      const key = "sot_" + name;
      if (direct) safeStorage(sessionStorage, "set", key, direct);
      if (direct) return direct;

      const stored = String(safeStorage(sessionStorage, "get", key) || "").trim();
      if (stored) return stored;

      for (const alias of names.slice(1)) {
        const aliasStored = String(safeStorage(sessionStorage, "get", "sot_" + alias) || "").trim();
        if (aliasStored) {
          safeStorage(sessionStorage, "set", key, aliasStored);
          return aliasStored;
        }
      }

      return "";
    }

    function inferStrongUtmSourceFromReferrer(){
      const ref = String(document.referrer || "").toLowerCase().trim();
      const ua = String(navigator.userAgent || "").toLowerCase().trim();

      if (ref.includes("google") || ua.includes("googleapp") || /\bgsa\//.test(ua)) return "google";
      if (ref.includes("naver") || ua.includes("naver")) return "naver";
      if (ref.includes("kakao") || ua.includes("kakaotalk")) return "kakao";
      if (ref.includes("instagram") || ref.includes("l.instagram.com") || ua.includes("instagram")) return "instagram";
      if (ref.includes("sms") || ref.includes("message")) return "sms";

      const knownInAppSignals = [
        "fban", "fbav", "fb_iab", "line/", "twitter", "micromessenger",
        "linkedinapp", "pinterest", "snapchat", "tiktok", "whale", "daumapps"
      ];
      if (knownInAppSignals.some(function(signal) { return ua.includes(signal); })) return "unknown";

      return "";
    }

    function cleanTrackingParamsFromUrl(){
      try {
        const url = new URL(window.location.href);
        ["lid", "sid", "sk", "utm_s"].forEach((key) => {
          url.searchParams.delete(key);
        });

        const cleanUrl =
          url.pathname +
          (url.searchParams.toString() ? "?" + url.searchParams.toString() : "") +
          url.hash;

        if (cleanUrl !== window.location.pathname + window.location.search + window.location.hash) {
          window.history.replaceState({}, "", cleanUrl);
        }
      } catch (e) {}
    }

    function toUtmS(source){
      const s = String(source || "").toLowerCase().trim();
      if (!s || s === "d" || s === "direct") return "direct";
      if (s === "g" || s === "google" || s.includes("google")) return "google";
      if (s === "n" || s === "naver" || s.includes("naver")) return "naver";
      if (s === "k" || s === "kakao" || s.includes("kakao")) return "kakao";
      if (s === "s" || s === "m" || s === "sms" || s.includes("message") || s.includes("sms")) return "sms";
      if (s === "i" || s === "instagram" || s === "ig" || s.includes("instagram")) return "instagram";
      return "unknown";
    }

    function getIncomingTrackingHints(){
      const params = getParams();
      return {
        lid: String(params.get("lid") || "").trim(),
        sid: String(params.get("sid") || "").trim(),
        sk: String(params.get("sk") || params.get("ses_k") || "").trim()
      };
    }

    function nextSessionKey(sk) {
      return formatSesKNumber(parseSesKNumber(sk) + 1);
    }

    function getDeviceType(){
      const ua = navigator.userAgent || "";
      const width = window.innerWidth || 0;
      if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return "tablet";
      if (/Mobi|Android|iPhone|iPod/i.test(ua) || width <= 768) return "mobile";
      return "desktop";
    }

    function getOsType(){
      const ua = navigator.userAgent || "";
      if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
      if (/Android/i.test(ua)) return "Android";
      if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
      if (/Windows/i.test(ua)) return "Windows";
      return "unknown";
    }

    function getSesKMapKey(localUser){
      return "shout_ses_k_map:" + String(localUser || "unknown");
    }

    function getSesKValueKey(localUser, sessionId){
      return "shout_ses_k_value:" + String(localUser || "unknown") + ":" + String(sessionId || "");
    }

    function getSesKMaxKey(localUser){
      return "shout_ses_k_max:" + String(localUser || "unknown");
    }

    function parseSesKNumber(sk){
      const raw = String(sk || "").trim().toLowerCase();
      const match = raw.match(/^s(\d+)$/);
      if (!match) return 0;

      const n = parseInt(match[1], 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    }

    function formatSesKNumber(n){
      const num = Number.isFinite(n) && n > 0 ? n : 1;
      return "s" + String(num).padStart(2, "0");
    }

    function getStoredSesKMax(localUser){
      const raw = String(safeStorage(localStorage, "get", getSesKMaxKey(localUser)) || "").trim();
      const n = parseInt(raw, 10);
      return Number.isFinite(n) && n > 0 ? n : 0;
    }

    function setStoredSesKMax(localUser, n){
      const num = Number.isFinite(n) && n > 0 ? n : 0;
      if (num > 0) safeStorage(localStorage, "set", getSesKMaxKey(localUser), String(num));
    }

    function getSesKMapLength(localUser){
      const key = getSesKMapKey(localUser);
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(parsed)) return parsed.filter(Boolean).length;
      } catch (e) {}
      return 0;
    }

    function addSessionToSesKMap(localUser, sessionId){
      const sid = String(sessionId || "").trim();
      if (!sid) return;

      const key = getSesKMapKey(localUser);
      let map = [];

      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(parsed)) map = parsed.filter(Boolean).map(String);
      } catch (e) {}

      if (!map.includes(sid)) {
        map.push(sid);
        try { localStorage.setItem(key, JSON.stringify(map)); } catch (e) {}
      }
    }

    function saveSesKToLocalMap(localUser, sessionId, sesK){
      const normalized = String(sesK || "").trim().toLowerCase();
      if (!/^s\d+$/.test(normalized)) return;
      safeStorage(localStorage, "set", getSesKValueKey(localUser, sessionId), normalized);
      addSessionToSesKMap(localUser, sessionId);

      const n = parseSesKNumber(normalized);
      const currentMax = getStoredSesKMax(localUser);
      if (n > currentMax) setStoredSesKMax(localUser, n);
    }

    function getSesKFromLocalMap(localUser, sessionId){
      const sid = String(sessionId || "").trim();
      if (!sid) return "s01";

      const explicit = String(safeStorage(localStorage, "get", getSesKValueKey(localUser, sid)) || "").trim();
      if (/^s\d+$/i.test(explicit)) return explicit.toLowerCase();

      const key = getSesKMapKey(localUser);
      let map = [];
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "[]");
        if (Array.isArray(parsed)) map = parsed.filter(Boolean).map(String);
      } catch (e) {}

      if (map.includes(sid)) {
        const idx = Math.max(0, map.indexOf(sid));
        const fromIndex = idx + 1;
        const maxNow = getStoredSesKMax(localUser);
        if (maxNow < fromIndex) setStoredSesKMax(localUser, fromIndex);
        return formatSesKNumber(fromIndex);
      }

      const maxNow = Math.max(getStoredSesKMax(localUser), map.length);
      const nextNumber = maxNow + 1;
      const nextSk = formatSesKNumber(nextNumber);

      saveSesKToLocalMap(localUser, sid, nextSk);
      return nextSk;
    }

    function getSesK(localUser, sessionId, isNewSessionInThisBrowser){
      const incoming = getIncomingTrackingHints();
      const shouldUseNextIncomingSk =
        !!incoming.lid &&
        incoming.lid === localUser &&
        !!incoming.sid &&
        !!incoming.sk &&
        !!isNewSessionInThisBrowser &&
        incoming.sid !== sessionId;

      if (shouldUseNextIncomingSk) {
        const incomingNumber = parseSesKNumber(incoming.sk);
        const currentMax = Math.max(getStoredSesKMax(localUser), getSesKMapLength(localUser));
        const nextNumber = Math.max(currentMax, incomingNumber) + 1;
        const nextSk = formatSesKNumber(nextNumber);

        if (incoming.sid && incomingNumber > 0) {
          saveSesKToLocalMap(localUser, incoming.sid, formatSesKNumber(incomingNumber));
        }

        saveSesKToLocalMap(localUser, sessionId, nextSk);
        return nextSk;
      }

      return getSesKFromLocalMap(localUser, sessionId);
    }

    function getTrackingContext(extra){
      const localUser = getOrCreateLocalUser(extra && extra.local_user);
      const hadSessionBefore = !!String(safeStorage(sessionStorage, "get", SESSION_KEY) || "").trim();
      const sessionId = getSessionId();
      const isNewSessionInThisBrowser = !hadSessionBefore && lastSessionWasCreated;
      const utmSource = getStoredParam("utm_s", ["utm_source"]);
      const inferredUtmSource = utmSource ? "" : inferStrongUtmSourceFromReferrer();
      const normalizedUtmSource = utmSource ? toUtmS(utmSource) : (inferredUtmSource || "direct");
      const utmC = getStoredParam("utm_c", ["utm_campaign"]);
      return {
        local_user: localUser,
        session_id: sessionId,
        ses_k: getSesK(localUser, sessionId, isNewSessionInThisBrowser),
        utm_s: normalizedUtmSource,
        utm_source: utmSource || inferredUtmSource || "direct",
        utm_c: utmC,
        utm_campaign: utmC,
        landing_url: window.location.href,
        referrer: document.referrer || "",
        user_agent: navigator.userAgent || "",
        device_type: getDeviceType(),
        os_type: getOsType()
      };
    }

    function appendTrackingParamsToUrl(url, tracking){
      try {
        const original = String(url || "");
        const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(original);
        const u = new URL(url, window.location.origin);
        const ctx = tracking || getTrackingContext();

        if (ctx && ctx.local_user) u.searchParams.set("lid", ctx.local_user);
        if (ctx && ctx.session_id) u.searchParams.set("sid", ctx.session_id);
        if (ctx && ctx.ses_k) u.searchParams.set("sk", ctx.ses_k);
        if (ctx && ctx.utm_s) u.searchParams.set("utm_s", ctx.utm_s);
        if (ctx && ctx.utm_c) u.searchParams.set("utm_c", ctx.utm_c);

        if (isAbsolute && u.origin !== window.location.origin) return u.toString();
        return u.pathname + u.search + u.hash;
      } catch (e) {
        return url;
      }
    }

    function appendLidToUrl(url, localUser){
      const tracking = getTrackingContext({ local_user: localUser });
      return appendTrackingParamsToUrl(url, tracking);
    }

    async function callSotInitOnce(context){
      let ctx = context || getTrackingContext();
      if (!ctx || !ctx.local_user || !ctx.session_id) {
        ctx = getTrackingContext();
      }
      const key = "sot_init_done:" + ctx.local_user + ":" + ctx.session_id;
      if (safeStorage(sessionStorage, "get", key) === "yes") {
        cleanTrackingParamsFromUrl();
        return ctx;
      }

      try {
        const res = await fetch(SOT_INIT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            local_user: ctx.local_user,
            session_id: ctx.session_id,
            visit_time: new Date().toISOString(),
            utm_campaign: ctx.utm_campaign,
            utm_source: ctx.utm_source ? toUtmS(ctx.utm_source) : "",
            device_type: ctx.device_type,
            os_type: ctx.os_type,
            landing_url: ctx.landing_url,
            referrer: ctx.referrer,
            user_agent: ctx.user_agent
          })
        });

        if (!res.ok) {
          throw new Error("SOT init failed: " + res.status);
        }

        safeStorage(sessionStorage, "set", key, "yes");
        return ctx;
      } catch (err) {
        console.warn("[SOT] callSotInitOnce fetch failed", Object.assign({ error: err }, getSotLogMeta(ctx)));
        throw err;
      } finally {
        cleanTrackingParamsFromUrl();
      }
    }

    window.ShoutTracking = Object.assign({}, existingTrackingApi || {}, {
      getOrCreateLocalUser,
      getSessionId,
      toUtmS,
      nextSessionKey,
      getTrackingContext,
      appendTrackingParamsToUrl,
      appendLidToUrl,
      cleanTrackingParamsFromUrl,
      callSotInitOnce
    });

    setTimeout(function() {
      autoInitSotTracking("created-api");
    }, 0);
  })();

  (function(){
    const DEFAULT_DURATION = 1800;
    const MAX_STACK = 3;

    function ensureWrap(){
      let wrap = document.querySelector(".sh-toast-wrap");
      if(!wrap){
        wrap = document.createElement("div");
        wrap.className = "sh-toast-wrap";
        document.body.appendChild(wrap);
      }
      return wrap;
    }

    function normalizeType(type){
      const t = (type || "info").toLowerCase();
      if(t === "success" || t === "error" || t === "info") return t;
      return "info";
    }

    function escapeHtml(s){
      return String(s||"").replace(/[&<>"']/g, m => ({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#039;'
      }[m]));
    }

    function shToast(message, opts={}){
      const wrap = ensureWrap();
      const type = normalizeType(opts.type);
      const duration = Number.isFinite(opts.duration) ? opts.duration : DEFAULT_DURATION;
      const closable = opts.closable !== false;

      while(wrap.children.length >= MAX_STACK){
        wrap.removeChild(wrap.firstChild);
      }

      const el = document.createElement("div");
      el.className = `sh-toast sh-toast--${type}`;
      el.innerHTML = `
        <div class="sh-toast__msg">${escapeHtml(String(message || ""))}</div>
        ${closable ? `<button class="sh-toast__x" aria-label="Close">×</button>` : ``}
      `;
      wrap.appendChild(el);

      requestAnimationFrame(() => el.classList.add("is-show"));

      let timer = null;
      function close(){
        if(timer) clearTimeout(timer);
        el.classList.remove("is-show");
        setTimeout(() => {
          if(el && el.parentNode) el.parentNode.removeChild(el);
        }, 180);
      }

      const x = el.querySelector(".sh-toast__x");
      if(x) x.addEventListener("click", close);

      if(duration > 0){
        timer = setTimeout(close, duration);
      }

      return { close };
    }

    window.shToast = shToast;
  })();

  (function(){
    const CART_KEY = "shout_cart_data";
    const SOT_CT_URL = "https://plp-62309.bubbleapps.io/api/1.1/wf/sot-ct";

    function safeParse(raw){
      if(!raw) return null;
      try { return JSON.parse(raw); } catch(e) { return null; }
    }

    function load(){
      const v = safeParse(localStorage.getItem(CART_KEY)) || {};
      const items = Array.isArray(v.items) ? v.items : [];
      return { items };
    }

    function dedupe(items){
      const seen = new Set();
      const out = [];
      for(const it of (items || [])){
        const id = String(it && it._id || "").trim();
        if(!id) continue;
        if(seen.has(id)) continue;
        seen.add(id);
        out.push(it);
      }
      return out;
    }

    async function postAddedItemsToSot(items){
      try{
        const tracking = window.ShoutTracking ? window.ShoutTracking.getTrackingContext() : null;
        const sessionId = tracking ? tracking.session_id : (sessionStorage.getItem("sot_session_id") || "");
        if(!sessionId) return;

        const addArr = Array.isArray(items) ? items : [items];
        const photoIds = Array.from(
          new Set(
            addArr
              .map(it => String(it && it._id || "").trim())
              .filter(Boolean)
          )
        );

        if(photoIds.length === 0) return;

        const first = addArr[0] || {};
        const rawOcrBib = String(first.ocr_bib || first.bib_no || first.bibNumber || "").trim();
        const rawBib = String(first.bib || "").trim();
        const rawOcrName = String(first.ocr_name || first.name || "").trim();
        const ocrBib = rawOcrBib || (/^\d+$/.test(rawBib) ? rawBib : "");
        const ocrName = rawOcrName || (rawBib && !/^\d+$/.test(rawBib) ? rawBib : "");

        await fetch(SOT_CT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: sessionId,
            photo_ids: photoIds,
            local_user: tracking ? tracking.local_user : "",
            event_code: String(addArr[0] && (addArr[0].event_code || addArr[0].eventCode) || "").trim(),
            ocr_bib: ocrBib,
            ocr_name: ocrName,
            session_key: tracking ? tracking.ses_k : "",
            utm_source: tracking ? tracking.utm_s : "",
            utm_campaign: tracking ? tracking.utm_campaign : ""
          })
        });
      }catch(e){
        console.warn("[SOT] sot-ct add failed", e);
      }
    }

    function save(data){
      const payload = { items: dedupe(data.items || []) };
      localStorage.setItem(CART_KEY, JSON.stringify(payload));
      emit(payload.items);
      return payload;
    }

    function emit(items){
      try{
        window.dispatchEvent(new CustomEvent("shout_cart_changed", {
          detail: { count: items.length, items: items.slice() }
        }));
      }catch(e){}
    }

    function snapshot(){
      return load();
    }

    const api = {
      key: CART_KEY,
      getItems(){ return snapshot().items.slice(); },
      count(){ return snapshot().items.length; },
      has(id){
        const sid = String(id).trim();
        return snapshot().items.some(it => String(it && it._id).trim() === sid);
      },
      add(newItems){
        const cur = snapshot().items;
        const addArr = Array.isArray(newItems) ? newItems : [newItems];
        return save({ items: cur.concat(addArr) });
      },
      remove(id){
        const sid = String(id).trim();
        const cur = snapshot().items.filter(it => String(it && it._id).trim() !== sid);
        return save({ items: cur });
      },
      clear(){ return save({ items: [] }); },
      subscribe(cb){
        if(typeof cb !== "function") return () => {};
        const handler = (e) => cb(e && e.detail ? e.detail : { count: api.count(), items: api.getItems() });
        window.addEventListener("shout_cart_changed", handler);
        return () => window.removeEventListener("shout_cart_changed", handler);
      },
      refresh(){ emit(snapshot().items); },
      logAddedToSot(items){ return postAddedItemsToSot(items); }
    };

    window.ShoutCart = api;

    api.refresh();

    window.addEventListener("storage", function(e){
      if(e && e.key === CART_KEY){
        api.refresh();
      }
    });
  })();

  (function(){
    const elRight = document.getElementById("menu-nav-bar-right");
    const elLeft  = document.getElementById("menu-nav-bar-left");
    const elMid   = document.querySelector(".menu-nav-bar-mid");
    const elBadge = document.getElementById("menu-nav-bar-cartcount");

    if (elRight) elRight.style.display = "none";
    if (elLeft)  elLeft.style.display = "none";
    if (elBadge) elBadge.style.display = "none";

    function applyCartNav(){
      const count = window.ShoutCart ? window.ShoutCart.count() : 0;
      const show = count > 0;

      if (elRight) elRight.style.display = show ? "" : "none";
      if (elLeft)  elLeft.style.display  = show ? "" : "none";
      if (elMid) elMid.classList.toggle("is-cart-empty", !show);
      if (elBadge){
        if (show){
          elBadge.textContent = String(count);
          elBadge.style.display = "inline-flex";
        }else{
          elBadge.textContent = "";
          elBadge.style.display = "none";
        }
      }
    }

    applyCartNav();
    window.addEventListener("pageshow", applyCartNav);
    window.addEventListener("shout_cart_changed", applyCartNav);
    window.shoutCartNavRefresh = applyCartNav;
  })();

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

}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initShoutGlobal, { once: true });
} else {
  initShoutGlobal();
}
})();
