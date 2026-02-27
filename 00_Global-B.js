<script>
document.addEventListener("DOMContentLoaded", function () {
  console.log("[Shout-out] Global UI & Cart Manager loaded.");

  // ==========================================
  // A) Shout-out Toast (global)
  // - 전역 알림(Toast) 메시지 UI 시스템
  // ==========================================
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

  // ==========================================
  // B) ShoutCart Manager (Single Source of Truth)
  // - 로컬스토리지를 다루는 유일한 창구
  // - 쓰레기 데이터 차단 및 배열 정규화 담당
  // ==========================================
  (function(){
    const CART_KEY = "shout_cart_data";

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
        if(!id) continue; // 빈 고유키 차단
        if(seen.has(id)) continue;
        seen.add(id);
        out.push(it);
      }
      return out;
    }

    function save(data){
      // 기존 루트 메타데이터를 지우고 순수 items 배열만 덮어씀
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
        return save({ items: cur.concat(addArr) }); // 합쳐서 저장
      },
      remove(id){
        const sid = String(id).trim();
        const cur = snapshot().items.filter(it => String(it && it._id).trim() !== sid);
        return save({ items: cur }); // 남은 것만 저장
      },
      clear(){ return save({ items: [] }); },
      subscribe(cb){
        if(typeof cb !== "function") return () => {};
        const handler = (e) => cb(e && e.detail ? e.detail : { count: api.count(), items: api.getItems() });
        window.addEventListener("shout_cart_changed", handler);
        return () => window.removeEventListener("shout_cart_changed", handler);
      },
      refresh(){ emit(snapshot().items); }
    };

    window.ShoutCart = api;

    // 초기 1회 발행
    api.refresh();

    // 탭 간 동기화 (다른 탭에서 장바구니 조작 시)
    window.addEventListener("storage", function(e){
      if(e && e.key === CART_KEY){
        api.refresh();
      }
    });
  })();

  // ==========================================
  // C) Global Cart Nav (Pub/Sub UI Sync)
  // - 로컬스토리지 후킹 제거, 순수 이벤트 구독 방식
  // ==========================================
  (function(){
    const elRight = document.getElementById("menu-nav-bar-right");
    const elLeft  = document.getElementById("menu-nav-bar-left");
    const elMid   = document.querySelector(".menu-nav-bar-mid");
    const elBadge = document.getElementById("menu-nav-bar-cartcount");

    // 초기 디폴트 비노출 (깜빡임 방지)
    if (elRight) elRight.style.display = "none";
    if (elLeft)  elLeft.style.display = "none";
    if (elBadge) elBadge.style.display = "none";

    function applyCartNav(){
      // 전역 창고(ShoutCart)에서 갯수만 가져옴
      const count = window.ShoutCart ? window.ShoutCart.count() : 0;
      const show = count > 0;

      // 좌우 메뉴 토글
      if (elRight) elRight.style.display = show ? "" : "none";
      if (elLeft)  elLeft.style.display  = show ? "" : "none";

      // ✅ (부활) 중앙 로고 위치/간격 제어용 클래스 토글
      if (elMid) elMid.classList.toggle("is-cart-empty", !show);

      // 장바구니 뱃지 숫자 갱신
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

    // 초기 적용 및 BFCache(뒤로가기) 대응
    applyCartNav();
    window.addEventListener("pageshow", applyCartNav);

    // ✅ 핵심: 스토리지 후킹 대신 ShoutCart의 이벤트를 구독하여 화면 갱신
    window.addEventListener("shout_cart_changed", applyCartNav);

    // 하위 호환성 및 수동 갱신용 노출
    window.shoutCartNavRefresh = applyCartNav;
  })();

});
</script>