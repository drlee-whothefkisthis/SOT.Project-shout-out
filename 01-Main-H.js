<style>
/* ─────────────────────────────
   1) 입력을 덮는 배경 레이어 클릭 차단 (기존 유지)
   ───────────────────────────── */
.search-input-bg,
#search-input-bg,
.search-bg-image {
  pointer-events: none !important;
}

/* ─────────────────────────────
   2) 섹션 공통 설정 (기존 유지)
   ───────────────────────────── */
.brand-title-text{
  font-size: clamp(36px, 3.2vw, 48px);
  line-height: clamp(42px, 4.5vw, 64px);
}

:root{
  --section-pad-x: clamp(16px, 4vw, 40px);
}

:is(.search-wrapper, .recent-wrapper, .nav-wrapper, .brand-wrapper, .features-grid){
  padding-inline: var(--section-pad-x);
}

/* ─────────────────────────────
   3) [NEW] 드롭다운(자동완성) 디자인 (기존 유지)
   ───────────────────────────── */

/* 드롭다운 전체 박스 */
#app-event-suggestions {
  pointer-events: auto;       /* 클릭 가능하도록 설정 */
  position: absolute;         /* 둥둥 뜨게 */
  width: 100%;                /* 입력창 너비에 맞춤 */
  max-height: 240px;          /* 너무 길면 스크롤 */
  overflow-y: auto;           /* 스크롤 허용 */
  background-color: #ffffff;  /* 흰색 배경 */
  border: 1px solid #e0e0e0;  /* 얇은 테두리 */
  border-radius: 0 0 8px 8px; /* 아래쪽 모서리만 둥글게 */
  box-shadow: 0 4px 12px rgba(0,0,0,0.1); /* 그림자 효과 */
  z-index: 9999;              /* 맨 앞으로 가져오기 */
  display: none;              /* 기본은 숨김 */
  margin-top: 2px;            /* 입력창과 살짝 간격 */
}

/* 검색된 리스트 아이템 (한 줄) */
.suggestion-item {
  padding: 14px 16px;         /* 터치하기 편한 간격 */
  font-size: 15px;
  color: #333;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0; /* 구분선 */
  transition: background-color 0.1s;
}

/* 마우스 올렸을 때 효과 */
.suggestion-item:hover {
  background-color: #f7f9fc;  /* 연한 배경색 변경 */
}

/* 마지막 줄은 구분선 제거 */
.suggestion-item:last-child {
  border-bottom: none;
}

/* 안내 메시지 (검색결과 없음 등) */
.suggestion-info {
  padding: 14px 16px;
  font-size: 14px;
  color: #999;
  text-align: center;
  pointer-events: none; /* 안내 문구는 클릭 안 되게 */
}


/* ─────────────────────────────
   [ADD] Modal Scrollbar Hide
   ───────────────────────────── */
.hm-modal-content{
  overflow: visile;
}
.hm-modal-scroll{
  height:100%;
  overflow:auto;
  -webkit-overflow-scrolling:touch;
  scrollbar-width:none;
  -ms-overflow-style:none;
  /* 👇 [추가된 핵심 코드] 스크롤이 끝에 닿아도 배경으로 안 넘어가게 가둠 */
  overscroll-behavior: contain; 
}
.hm-modal-scroll::-webkit-scrollbar{
  width:0;
  height:0;
}
/* 1) 기본은 완전 비활성(안 보임 + 클릭도 안 먹음) */
.hm-modal-backdrop,
.hm-modal-box{
  display: none;
  pointer-events: none;
}

/* 2) 레이어 고정(뷰포트 전체) + z-index */
.hm-modal-backdrop{
  position: fixed;
  inset: 0;
  z-index: 9998;
  background: rgba(0,0,0,0.45); /* 이거 없으면 투명 유리판 됨 */
}

.hm-modal-box{
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: none;
  align-items: center;
  justify-content: center;
}

/* 3) 실제 박스(컨텐츠 래퍼)는 클릭 가능 */
.hm-modal-box *{
  pointer-events: auto;
}
/* ===== Modal: always on top of everything ===== */
#hm-modal{
  position: fixed !important;
  inset: 0 !important;
  z-index: 2147483000 !important; /* footer 포함 전부 위로 */
  display: none;                  /* JS가 열 때만 block */
  pointer-events: none;           /* 닫힌 상태 유리막 방지 */
}

/* Backdrop: full-screen overlay */
#hm-modal .hm-modal-backdrop{
  position: fixed !important;
  inset: 0 !important;
  z-index: 0 !important;
  background: rgba(0,0,0,0.55);   /* 원하면 값 조정 */
  display: none;
  pointer-events: none;
}

/* Box: centers the modal card */
#hm-modal .hm-modal-box{
  position: fixed !important;
  inset: 0 !important;
  z-index: 1 !important;
  display: none;
  align-items: center;
  justify-content: center;

  /* 위치 조정하고 싶으면 여기서 */
  padding-top: 0;
  align-items: center;

  pointer-events: none; /* 카드만 클릭되게 */
}
</style>