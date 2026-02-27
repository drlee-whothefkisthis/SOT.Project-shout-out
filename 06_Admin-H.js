<style>
  :root{
    --sh-border: rgba(0,0,0,.12);
    --sh-muted: rgba(0,0,0,.6);
    --sh-bg: rgba(0,0,0,.03);
  }

  /*
    [중요] 스타일 통합/정리 메모
    - 기존 HEAD 스타일 + 기존 BODY(스크립트에서 주입하던) 스타일을 HEAD로 통합함.
    - 충돌(동일 selector 중복)이 있었기 때문에, "실제 화면에서 최종 적용되던 값"을 유지하려고
      기존 BODY 주입 스타일(나중에 삽입되어 우선 적용되던 쪽)을 우선으로 채택함.
    - 즉, 아래의 selector들은 BODY 버전이 최종 승자였으므로 그 값을 살림:
      .sh-admin-wrap, .sh-admin-title, .sh-card, .sh-row, .sh-col, .sh-label,
      .sh-input, .sh-select, .sh-divider, .sh-btn, .sh-btn.primary, .sh-table, .sh-table th, .sh-table td, .sh-chip
  */

  /* ===============================
     Admin Layout (최종 적용: BODY 주입 버전 유지)
     =============================== */
  .sh-admin-wrap { 
    display: block;
    max-width:1100px; 
    margin:40px auto; 
    padding:20px; 
    background:#fff; 
    color:#333; 
    font-family:sans-serif; 
    border:1px solid #ddd;
    border-radius:8px;
    box-shadow:0 4px 12px rgba(0,0,0,0.05);
  }

  .sh-admin-title{ 
    font-size:24px; 
    font-weight:bold; 
    margin-bottom:20px; 
    color:#111; 
  }

  /* 기존 HEAD에만 있던 서브텍스트 클래스는 유지(현재 UI에서 안 써도 남겨둠) */
  .sh-admin-sub{ color:var(--sh-muted); font-size:13px; margin:0 0 18px; }

  .sh-card{ 
    padding:20px; 
    background:#fcfcfc; 
    border:1px solid #eee; 
    border-radius:8px; 
    margin-bottom:25px; 
  }

  .sh-row{ display:flex; gap:15px; margin-bottom:15px; }
  .sh-col{ flex:1; display:flex; flex-direction:column; }

  .sh-label{ 
    font-size:12px; 
    font-weight:bold; 
    margin-bottom:5px; 
    color:#555; 
  }

  .sh-input, .sh-select{ 
    padding:8px; 
    border:1px solid #ccc; 
    border-radius:4px; 
    font-size:14px; 
    background:#fff;
    width:100%;
    box-sizing:border-box;
  }

  .sh-divider{ height:1px; background:#eee; margin:15px 0; }

  .sh-btn{ 
    padding:10px 16px; 
    border-radius:4px; 
    border:none; 
    cursor:pointer; 
    font-weight:bold; 
  }
  .sh-btn.primary{ background:#007bff; color:#fff; }

  /* 기존 HEAD에만 있던 도움말/툴바/배지/닷/액션 등은 그대로 유지 */
  .sh-help{ font-size:12px; color:var(--sh-muted); margin-top:6px; line-height:1.35; }
  .sh-btn.danger{ background:#fff; color:#b00020; border:1px solid rgba(176,0,32,.35); }

  .sh-toolbar{ display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap; margin:16px 0 10px; }
  .sh-toolbar-left{ display:flex; gap:10px; flex-wrap:wrap; align-items:center; }

  /* ===============================
     Chip/Table (최종 적용: BODY 주입 버전 유지)
     =============================== */
  .sh-chip { 
    font-size:12px; 
    padding:4px 8px; 
    background:#eee; 
    border-radius:4px; 
    font-weight:bold; 
  }

  .sh-table{ 
    width:100%; 
    border-collapse:collapse; 
    margin-top:15px; 
  }
  .sh-table th{ 
    background:#f4f4f4; 
    padding:12px; 
    border-bottom:2px solid #ddd; 
    text-align:left; 
    font-size:13px; 
  }
  .sh-table td{ 
    padding:12px; 
    border-bottom:1px solid #eee; 
    font-size:14px; 
    vertical-align:middle;
  }

  /* ===============================
     Small Buttons (기존 BODY 주입에만 있던 것 → HEAD로 이동)
     =============================== */
  .sh-btn-sm{ 
    padding:4px 8px; 
    font-size:11px; 
    cursor:pointer; 
    border:1px solid #ccc; 
    border-radius:3px; 
    background:#fff; 
  }
  .sh-btn-sm.pub{ background:#e6fffa; color:#2c7a7b; border-color:#81e6d9; }
  .sh-btn-sm.priv{ background:#fff5f5; color:#c53030; border-color:#feb2b2; }
  .sh-btn-sm.danger{ background:#fff5f5; color:#c53030; border:none; }

  /* ===============================
     기존 HEAD에만 있던(현재 UI에선 안 쓰지만 자산으로 유지)
     =============================== */
  .sh-table--legacy{ width:100%; border-collapse:separate; border-spacing:0; overflow:hidden; border-radius:14px; border:1px solid var(--sh-border); }
  .sh-table--legacy th, .sh-table--legacy td{ padding:12px 10px; border-bottom:1px solid var(--sh-border); font-size:13px; vertical-align:middle; }
  .sh-table--legacy th{ background:var(--sh-bg); text-align:left; color:var(--sh-muted); font-weight:800; }
  .sh-table--legacy tr:last-child td{ border-bottom:none; }

  .sh-badge{
    display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border-radius:999px; font-size:12px;
    border:1px solid var(--sh-border); background:#fff;
  }
  .sh-dot{ width:8px; height:8px; border-radius:999px; background:#999; display:inline-block; }
  .sh-dot.ready{ background:#2e7d32; }
  .sh-dot.disabled{ background:#b00020; }
  .sh-dot.public{ background:#1565c0; }
  .sh-dot.private{ background:#616161; }

  .sh-actions{ display:flex; gap:8px; flex-wrap:wrap; }
  .sh-note{ font-size:12px; color:var(--sh-muted); margin-top:10px; }
</style>