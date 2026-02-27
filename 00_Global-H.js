<script>
  document.addEventListener("DOMContentLoaded", function() {
    // 1. 마우스 우클릭 방지
    document.addEventListener("contextmenu", function(e) {
      e.preventDefault();
    });

    // 2. 개발자 도구 및 소스 보기 단축키 방지
    document.addEventListener("keydown", function(e) {
      // F12
      if (e.keyCode === 123) {
        e.preventDefault();
        e.returnValue = false;
      }
      // Ctrl + Shift + I (Chrome/Firefox 개발자 도구)
      if (e.ctrlKey && e.shiftKey && e.keyCode === 73) {
        e.preventDefault();
        e.returnValue = false;
      }
      // Ctrl + Shift + J (Chrome 콘솔)
      if (e.ctrlKey && e.shiftKey && e.keyCode === 74) {
        e.preventDefault();
        e.returnValue = false;
      }
      // Ctrl + Shift + C (요소 검사)
      if (e.ctrlKey && e.shiftKey && e.keyCode === 67) {
        e.preventDefault();
        e.returnValue = false;
      }
      // Ctrl + U (소스 보기)
      if (e.ctrlKey && e.keyCode === 85) {
        e.preventDefault();
        e.returnValue = false;
      }
    });
  });
</script>

<style>
  body {
    -webkit-user-select: none; /* Chrome, Safari */
    -moz-user-select: none;    /* Firefox */
    -ms-user-select: none;     /* IE/Edge */
    user-select: none;         /* Standard */
  }
  
  /* 입력창(input, textarea)에서는 드래그 허용 (사용성 보장) */
  input, textarea {
    -webkit-user-select: auto;
    -moz-user-select: auto;
    -ms-user-select: auto;
    user-select: auto;
  }
</style>
<style>
:root{
  /* ===== Toast tuning ===== */
  --toast-max-width: 360px;
  --toast-padding-y: 12px;
  --toast-padding-x: 14px;
  --toast-radius: 10px;
  --toast-gap: 10px;
  --toast-bottom: 18px;
  --toast-side: 14px;
  --toast-font-size: 14px;
  --toast-line-height: 1.35;
  --toast-shadow: 0 10px 30px rgba(0,0,0,.18);
  --toast-z: 99999;

  --toast-bg: rgba(20,20,20,.92);
  --toast-text: rgba(255,255,255,.95);
  --toast-success-bg: rgba(18,120,72,.95);
  --toast-error-bg: rgba(176,0,32,.95);
  --toast-info-bg: rgba(20,20,20,.92);
}

.sh-toast-wrap{
  position: fixed;
  left: var(--toast-side);
  right: var(--toast-side);
  bottom: var(--toast-bottom);
  z-index: var(--toast-z);
  display: flex;
  flex-direction: column;
  gap: var(--toast-gap);
  pointer-events: none;
}

.sh-toast{
  max-width: var(--toast-max-width);
  width: fit-content;
  margin: 0 auto;
  padding: var(--toast-padding-y) var(--toast-padding-x);
  border-radius: var(--toast-radius);
  box-shadow: var(--toast-shadow);
  background: var(--toast-bg);
  color: var(--toast-text);
  font-size: var(--toast-font-size);
  line-height: var(--toast-line-height);
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 10px;
  transform: translateY(8px);
  opacity: 0;
  transition: opacity .18s ease, transform .18s ease;
  -webkit-font-smoothing: antialiased;
}

.sh-toast.is-show{
  opacity: 1;
  transform: translateY(0);
}

.sh-toast--success{ background: var(--toast-success-bg); }
.sh-toast--error{ background: var(--toast-error-bg); }
.sh-toast--info{ background: var(--toast-info-bg); }

.sh-toast__msg{ white-space: pre-line; }

.sh-toast__x{
  margin-left: 6px;
  border: none;
  background: transparent;
  color: rgba(255,255,255,.9);
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
#menu-nav-bar-cartcount{
  position: absolute;
  top: -6px;
  right: -12px;

  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;

  display: none; 
  align-items: center;
  justify-content: center;

  font-size: 12px;
  line-height: 18px;
  font-weight: 700;

  background: #ff6b63ff;
  color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,.18);
}
</style>