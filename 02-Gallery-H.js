<style>
  /* ===== Gallery Grid Base (Modern Dense Layout) ===== */
  #galleryGrid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    grid-auto-flow: dense;
    grid-auto-rows: var(--cell, 250px);
    gap: 14px;
    padding-bottom: 120px;
    width: 100%;
  }

  :root{
    --section-pad-x: clamp(16px, 4vw, 40px);
    --tray-height: 96px;
  }

  :is(.gallery-container){
    padding-inline: var(--section-pad-x);
  }

  @media (max-width: 840px) {
    #galleryGrid {
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
  }

  .gallery-card.size-normal { grid-column: span 1; grid-row: span 1; }
  .gallery-card.size-wide   { grid-column: span 2; grid-row: span 1; }
  .gallery-card.size-tall   { grid-column: span 1; grid-row: span 2; }
  .gallery-card.size-big    { grid-column: span 2; grid-row: span 2; }

  .gallery-card {
    position: relative;
    width: 100%; height: 100%;
    overflow: hidden;
    border-radius: 12px;
    background: #111;
    box-shadow: 0 1px 0 rgba(255,255,255,0.06), 0 8px 24px rgba(0,0,0,0.25);
    transform: translateY(0);
    transition: transform 160ms ease, box-shadow 160ms ease;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }

  .gallery-card::before {
    content: ""; position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.04) 70%, rgba(0,0,0,0.06) 100%);
    pointer-events: none; z-index: 2;
  }
  .gallery-card::after {
    content: ""; position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 35%, rgba(255,255,255,0.00) 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(255,255,255,0.07), inset 0 -2px 0 rgba(0,0,0,0.10);
    opacity: 0.9; pointer-events: none; z-index: 3;
  }

  @media (hover: hover) {
    .gallery-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 1px 0 rgba(255,255,255,0.08), 0 12px 36px rgba(0,0,0,0.35);
      z-index: 10;
    }
    .gallery-card:hover::after { opacity: 1; }
  }

  .gallery-card .gallery-media{
    width: 100%;
    height: 100%;
    display: block;
    position: relative;
    z-index: 1;

    background-size: cover;
    background-position: 50% 50%;
    background-repeat: no-repeat;

    transition: transform 0.4s ease;
  }

  /* 기존 hover 확대 효과 유지 */
  .gallery-card:hover .gallery-media{
    transform: scale(1.03);
  }


  /* ===== Selection Badge & State (업그레이드) ===== */
  .gallery-card .sel-badge {
    position: absolute; top: 10px; right: 10px;
    width: 28px; height: 28px; border-radius: 999px;
    display: grid; place-items: center;
    background: rgba(0,0,0,0.42);
    border: 1px solid rgba(255,255,255,0.22);
    box-shadow: 0 6px 18px rgba(0,0,0,0.28);
    z-index: 6;

    /* ✅ (핵심) 이제 클릭 가능 */
    pointer-events: auto;
    cursor: pointer;

    /* 기본은 숨김 */
    opacity: 0; transform: scale(0.96);
    transition: all 140ms ease;
  }

  /* ✅ (핵심) "선택 안된 상태"에서도 호버하면 빈 체크(색 없음)가 보이게 */
  @media (hover: hover) {
    .gallery-card:hover .sel-badge {
      opacity: 1;
      transform: scale(1);
      /* [EDIT-LINE H-1] 빈 체크 배지의 배경/테두리 강도 조절 */
      background: rgba(0,0,0,0.28);
      border-color: rgba(255,255,255,0.28);
    }
  }

  /* 선택 상태면 항상 보이게 + 파란색 채움 */
  .gallery-card.is-selected .sel-badge {
    opacity: 1; transform: scale(1);
    background: rgba(59,130,246,0.92);
    border-color: rgba(255,255,255,0.32);
  }

  .gallery-card.is-selected {
    box-shadow: 0 0 0 2px rgba(59,130,246,0.85), 0 12px 36px rgba(0,0,0,0.40);
  }

  .sel-badge svg {
    width: 16px; height: 16px; fill: none; stroke: #fff;
    stroke-width: 3; stroke-linecap: round; stroke-linejoin: round;
  }

  /* ===== Modal & Tray UI ===== */
  #shoutModalOverlay {
    position: fixed; inset: 0; z-index: 99999; display: none;
    align-items: center; justify-content: center; padding: 18px;

    /* [EDIT-LINE A] overlay opacity */
    background: rgba(0,0,0,0.72);
    backdrop-filter: blur(10px);
  }
  #shoutModalOverlay.is-open { display: flex; }

  #shoutModalContainer {
    position: relative; width: min(980px, 100%); min-width: 320px; height: min(85vh, 900px);
    border-radius: 18px; overflow: hidden; background: rgba(20,20,20,0.95);
    border: 1px solid rgba(255,255,255,0.10); display: flex; flex-direction: column;
  }
  #shoutModalTopbar {
    height: 60px; display: flex; align-items: center; justify-content: space-between;
    padding: 0 16px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.08);
  }
  .shoutModalBtn {
    height: 38px; padding: 0 14px; border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.16); background: rgba(255,255,255,0.06);
    color: #fff; font-weight: 700; font-size: 14px; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
  }
  #shoutModalCheckBtn.is-selected { background: #3b82f6; border-color: #60a5fa; }

  #shoutModalImageWrap {
    flex: 1; overflow: hidden; display: flex; align-items: center; justify-content: center;
    padding: clamp(12px, 4vw, 20px);
  }

  #shoutModalImg {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 16px;

    /* ✅ 이미지 클릭으로 선택 토글하니까 커서도 버튼처럼 */
    cursor: pointer;
  }

  #shoutModalImg.is-selected{
    /* [EDIT-LINE B] 테두리 두께/색/글로우 조절 */
    box-shadow:
      0 0 0 3px rgba(59,130,246,0.92),
      0 16px 40px rgba(0,0,0,0.45);
  }

  /* ===== iOS-style Modal Nav ===== */
  .shoutModalNavBtn{
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: clamp(22px, 4vw, 44px);
    height: clamp(22px, 4vw, 44px);
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.22);
    background: rgba(255,255,255,0.10);
    color: #fff;
    display: grid;
    place-items: center;
    cursor: pointer;
    backdrop-filter: blur(18px);
    box-shadow: 0 10px 30px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.22);
    z-index: 5;
    -webkit-tap-highlight-color: transparent;
    transition: transform 140ms ease, background 140ms ease, border-color 140ms ease, opacity 140ms ease;
    opacity: 0.98;
    padding: 0;      /* ✅ 버튼 기본 패딩 제거 */
    font-size: 0;    /* ✅ iOS Safari inline 렌더링 오프셋 차단 */
    line-height: 0;  /* ✅ line box 영향 제거 */
  }
  .shoutModalNavBtn:hover{
    background: rgba(255,255,255,0.14);
    border-color: rgba(255,255,255,0.30);
  }
  .shoutModalNavBtn:active{
    transform: translateY(-50%) scale(0.96);
  }
  .shoutModalNavBtn.is-left{ left: 14px; right: auto; }
  .shoutModalNavBtn.is-right{ right: 14px; left: auto; }
  .shoutModalNavBtn svg{
    width: 18px; height: 18px;
    display: block; /* ✅ 중요 */
    fill: none;
    stroke: #fff;
    stroke-width: 2.8;
    stroke-linecap: round;
    stroke-linejoin: round;
    opacity: 0.95;

    transform: translateX(-1.5px);
  }


    #shoutSelectedTray {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 100001; display: none;
    padding: 14px 16px 20px 16px; background: rgba(20,20,20,0.92);
    border-top: 1px solid rgba(255,255,255,0.12);
    backdrop-filter: blur(16px); transform: translateY(100%); transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  #shoutSelectedTray.is-open { display: block; transform: translateY(0); }
  #shoutSelectedTrayTop { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  #shoutSelectedInfo { color: #fff; font-weight: 700; font-size: 15px; }
  #shoutGoCartBtn { background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 700; cursor: pointer; }
  #shoutSelectedList { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
  #shoutSelectedList::-webkit-scrollbar { display: none; }
  .shoutMiniThumb { flex: 0 0 50px; height: 50px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.2); }
  .shoutMiniThumb img { width: 100%; height: 100%; object-fit: cover; }

  /* =========================================
   Gallery Selected Overlay (GLOBAL STYLE)
   - is-in-cart 클래스만 JS에서 토글
========================================= */

.gallery-card{
  position:relative;
  overflow:hidden;
  transition:
    transform .18s cubic-bezier(.25,.1,.25,1),
    filter .18s cubic-bezier(.25,.1,.25,1);
}

/* ------------------------------
   반투명 화이트 오버레이
------------------------------ */
.gallery-card::before{
  content:"";
  position:absolute;
  inset:0;
  background:rgba(255,255,255,.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  pointer-events:none;
  z-index:3;

  opacity:0;
  transform:translateY(6px) scale(.98);
  transition:
    opacity .18s cubic-bezier(.25,.1,.25,1),
    transform .22s cubic-bezier(.25,.1,.25,1);
}

/* ------------------------------
   선택 개수 표시 텍스트
   HTML 수정 없이 pseudo 사용
------------------------------ */
.gallery-card::after{
  content:attr(data-selected-label);
  position:absolute;
  left:50%;
  top:50%;
  transform:translate(-50%,-50%) scale(.98);
  color:#111;
  font-weight:600;
  font-size:14px;
  letter-spacing:-0.2px;
  white-space:nowrap;
  z-index:4;
  pointer-events:none;

  opacity:0;
  transition:
    opacity .18s cubic-bezier(.25,.1,.25,1),
    transform .22s cubic-bezier(.25,.1,.25,1);
}

/* ------------------------------
   선택 상태 (JS가 is-in-cart 붙임)
------------------------------ */
.gallery-card.is-in-cart::before,
.gallery-card.is-selected::before,
.gallery-card.is-selected::after,
.gallery-card.is-in-cart::after{
  opacity:1;
  transform:translate(-50%,-50%) scale(1);
}

.gallery-card.is-in-cart::before{
  transform:translateY(0) scale(1);
}

/* 카드 자체 살짝 눌림 (Apple 느낌) */
.gallery-card.is-in-cart{
  transform:scale(0.985);
  filter:saturate(.85);
}

/* ------------------------------
   기존 선택 테두리 유지
------------------------------ */
.gallery-card.is-in-cart,
.gallery-card.is-selected{
  outline:2px solid #2f80ed;
  outline-offset:-2px;
}
</style>
