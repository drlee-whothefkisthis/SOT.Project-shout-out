<style>
  :root{
    --muted: rgba(255,255,255,.65);
    --radius-xl: 26px;
  }

  /* (선택) 템플릿은 기본 숨김: 디자이너에서 is-template에 display:none을 줘도 OK */
  .is-template{ display: none !important; }

  /* (선택) 아이콘이 버튼 역할이면 커서만이라도 보장 */
  .icon-1x1-xsmall{ cursor: pointer; }
  
  :root{
    --section-pad-x: clamp(16px, 4vw, 40px);
  }

  :is(.mypage-wrapper, .nav-wrapper){
    padding-inline: var(--section-pad-x);
  }

  /* =========================================================
     [MyPage] Hover Download UI (CSS-only)
     - target: .purchased-image OR .purchased-img-wrapper (둘 중 하나 존재)
     - hover: translucent overlay + iOS-ish download glyph
  ========================================================= */

  .purchased-image,
  .purchased-img-wrapper{
    position: relative;
    border-radius: inherit;
    overflow: hidden;
    -webkit-tap-highlight-color: transparent;
  }

  /* overlay */
  .purchased-image::before,
  .purchased-img-wrapper::before{
    content: "";
    position: absolute;
    inset: 0;
    background: rgba(255,255,255,0.18);
    opacity: 0;
    transition: opacity 140ms ease;
    pointer-events: none;
    z-index: 2;
  }

  /* center icon (inline SVG) */
  .purchased-image::after,
  .purchased-img-wrapper::after{
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: clamp(28px, 3.2vw, 44px);
    height: clamp(28px, 3.2vw, 44px);
    transform: translate(-50%, -50%) scale(0.98);
    opacity: 0;
    transition: opacity 140ms ease, transform 140ms ease;
    pointer-events: none;
    z-index: 3;

    background-repeat: no-repeat;
    background-position: center;
    background-size: 100% 100%;

    /* iOS-style "square.and.arrow.down" 느낌 (간소화) */
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='white' fill-opacity='0.92' d='M12 2a1 1 0 0 1 1 1v9.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4.01 4.01a1 1 0 0 1-1.41 0L7.27 11.7a1 1 0 0 1 1.41-1.42L11 12.6V3a1 1 0 0 1 1-1z'/%3E%3Cpath fill='white' fill-opacity='0.92' d='M6 20a2 2 0 0 1-2-2v-4a1 1 0 1 1 2 0v4h12v-4a1 1 0 1 1 2 0v4a2 2 0 0 1-2 2H6z'/%3E%3C/svg%3E");
    filter: drop-shadow(0 8px 18px rgba(0,0,0,0.35));
  }

  /* hover: show */
  .purchased-card:hover .purchased-image::before,
  .purchased-card:hover .purchased-img-wrapper::before{ opacity: 1; }

  .purchased-card:hover .purchased-image::after,
  .purchased-card:hover .purchased-img-wrapper::after{
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.02);
  }

  /* touch devices: hover off (later: tap-to-show can be added in step2) */
  @media (hover: none){
    .purchased-image::before,
    .purchased-image::after,
    .purchased-img-wrapper::before,
    .purchased-img-wrapper::after{
      opacity: 0 !important;
    }
  }

  /* =========================================================
     [MyPage] Download Loading State
     - 카드에 .is-downloading 붙으면:
       1) 다운로드 아이콘 숨김
       2) 같은 위치에 스피너(로더) 표시
  ========================================================= */

  /* 아이콘 숨기기 */
  .purchased-card.is-downloading .purchased-image::after,
  .purchased-card.is-downloading .purchased-img-wrapper::after{
    opacity: 0 !important;
  }

  /* 로더(스피너) 표시: pseudo-element 하나로 심플하게 */
  .purchased-card.is-downloading .purchased-image::before,
  .purchased-card.is-downloading .purchased-img-wrapper::before{
    /* 기존 hover overlay(::before)와 충돌 방지: overlay는 유지하고,
       로더는 별도 pseudo로 만들어야 하는데 ::before를 이미 overlay로 쓰고 있어
       그래서 overlay는 그대로 두고 로더는 아래의 .sh-dl-spinner 엘리먼트로 생성할 수 없으니,
       overlay는 ::before 유지, 로더는 새로운 ::after 대신 ::after를 재활용해서 아이콘 대신 스피너로 바꾼다.
    */
  }

  /* 아이콘 자리(::after)를 로더로 재사용 */
  .purchased-card.is-downloading .purchased-image::after,
  .purchased-card.is-downloading .purchased-img-wrapper::after{
    opacity: 1 !important;
    background-image: none !important;
    width: clamp(28px, 3.2vw, 44px);
    height: clamp(28px, 3.2vw, 44px);
    border-radius: 999px;
    border: 2px solid rgba(255,255,255,0.35);
    border-top-color: rgba(255,255,255,0.95);
    box-sizing: border-box;
    animation: shSpin 0.9s linear infinite;
    filter: drop-shadow(0 8px 18px rgba(0,0,0,0.30));
  }

  @keyframes shSpin{
    from { transform: translate(-50%, -50%) rotate(0deg); }
    to   { transform: translate(-50%, -50%) rotate(360deg); }
  }

  /* hover가 아니어도 로딩 중이면 보여야 함 */
  .purchased-card.is-downloading .purchased-image::after,
  .purchased-card.is-downloading .purchased-img-wrapper::after{
    pointer-events: none;
  }
  /* -----------------------------
   MyPage ZIP Button Spinner
  ----------------------------- */
  #mp-download-all{
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  #mp-download-all .mp-zip-spinner{
    width: 14px;
    height: 14px;
    border-radius: 999px;
    border: 2px solid rgba(255,255,255,.35);
    border-top-color: rgba(255,255,255,1);
    opacity: 0;
    transform: translateZ(0);
    animation: mpZipSpin 0.8s linear infinite;
  }

  #mp-download-all.is-loading .mp-zip-spinner{
    opacity: 1;
  }

  @keyframes mpZipSpin{
    to{ transform: rotate(360deg); }
  }


/* ===== MyPage ZIP Spinner + FOUC Guard ===== */
.mp-purchased-event-title,
#mp-download-all{
  display:none !important;
}

html.mypage-ready .mp-purchased-event-title{
  display:block !important;
}

html.mypage-ready #mp-download-all{ display:none !important; }

html.mypage-ready.mp-zip-enabled #mp-download-all{ display:inline-flex !important; }
#mp-download-all .mp-zip-spinner{
  will-change: transform;
  transform-origin:50% 50%;
  animation: mpZipSpin 0.7s linear infinite;
}

@keyframes mpZipSpin{
  to{ transform:rotate(360deg); }
}
/* ========================================== */

</style>

<script>
/**
 * ✅ Event code → display_name 맵 1회 로드 후 window 캐싱
 * - Purchase에는 event_codes(list of text)만 저장
 * - 표시명은 Event 타입에서만 관리
 */
window.__SHOUT_EVENT_MAP__ = null;

async function shLoadEventMap() {
  if (window.__SHOUT_EVENT_MAP__) return window.__SHOUT_EVENT_MAP__;

  const EVENT_API = "https://plp-62309.bubbleapps.io/version-test/api/1.1/obj/event";
  const res = await fetch(EVENT_API, { method: "GET" });
  const json = await res.json();

  const map = {};
  const results = json?.response?.results || [];
  results.forEach(ev => {
    const code = ev.event_code;
    const name = ev.event_display_name;
    if (code) map[code] = (name || "").trim() || code;
  });

  window.__SHOUT_EVENT_MAP__ = map;
  return map;
}
</script>