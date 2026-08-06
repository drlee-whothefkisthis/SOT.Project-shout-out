<style>
  :root{
    --sh-page:#f1f5f9;
    --sh-panel:#ffffff;
    --sh-ink:#0f172a;
    --sh-muted:#64748b;
    --sh-line:#e2e8f0;
    --sh-dark:#020617;
    --sh-soft:#f8fafc;
    --sh-ok:#059669;
    --sh-warn:#d97706;
    --sh-bad:#dc2626;
    --sh-border:var(--sh-line);
    --sh-bg:var(--sh-soft);
    --sh-text:var(--sh-ink);
    --sh-text-soft:#334155;
    --sh-text-muted:var(--sh-muted);
    --sh-surface:var(--sh-panel);
    --sh-surface-soft:#f8fafc;
    --sh-surface-muted:#f1f5f9;
    --sh-surface-subtle:#f8fafc;
    --sh-line-strong:#cbd5e1;
    --sh-line-soft:#e2e8f0;
    --sh-primary:var(--sh-dark);
    --sh-danger:var(--sh-bad);
    --sh-danger-strong:var(--sh-bad);
    --sh-danger-bg:#fef2f2;
    --sh-success-bg:#ecfdf5;
    --sh-success-text:var(--sh-ok);
    --sh-success-border:#a7f3d0;
    --sh-shadow:0 8px 26px rgba(15,23,42,.06);
  }

  body{ background:var(--sh-page); }

  .sh-admin-wrap{
    display:block;
    max-width:1380px;
    margin:0 auto;
    padding:28px;
    color:var(--sh-ink);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans KR",Arial,sans-serif;
    line-height:1.45;
  }

  .sh-admin-hero{
    display:flex;
    justify-content:space-between;
    gap:24px;
    align-items:flex-end;
    padding:32px;
    color:#fff;
    background:linear-gradient(135deg,#020617,#111827);
    border-radius:8px;
    box-shadow:var(--sh-shadow);
  }

  .sh-admin-eyebrow{
    display:inline-flex;
    margin-bottom:12px;
    padding:7px 12px;
    border:1px solid rgba(255,255,255,.12);
    border-radius:999px;
    background:rgba(255,255,255,.10);
    color:#cbd5e1;
    font-size:12px;
    font-weight:800;
  }

  .sh-admin-title{
    margin:0;
    color:inherit;
    font-size:38px;
    line-height:1.05;
    font-weight:950;
    letter-spacing:0;
  }

  .sh-admin-sub{
    max-width:760px;
    margin:10px 0 0;
    color:#cbd5e1;
    font-size:14px;
  }

  .sh-admin-status-card{
    min-width:310px;
    padding:18px;
    border:1px solid rgba(255,255,255,.12);
    border-radius:8px;
    background:rgba(255,255,255,.06);
    color:#cbd5e1;
    font-size:14px;
  }

  .sh-admin-status-card b{
    display:block;
    margin-bottom:6px;
    color:#86efac;
  }

  .sh-admin-status-card b.is-error{ color:#fecaca; }
  .sh-admin-status-card div + div{ margin-top:6px; color:#94a3b8; }

  .sh-card,
  .sh-admin-tabs,
  .sh-db-tabs,
  .sh-db-section,
  .sh-table{
    background:var(--sh-panel);
    border:1px solid var(--sh-line);
    border-radius:8px;
    box-shadow:var(--sh-shadow);
  }

  .sh-card{
    padding:18px;
    margin-top:18px;
    margin-bottom:18px;
  }

  .sh-row{ display:flex; gap:12px; margin-bottom:12px; }
  .sh-col{ flex:1; display:flex; flex-direction:column; min-width:0; }

  .sh-label{
    display:block;
    margin-bottom:6px;
    color:var(--sh-muted);
    font-size:12px;
    font-weight:850;
  }

  .sh-input,
  .sh-select{
    width:100%;
    height:44px;
    border:1px solid var(--sh-line);
    border-radius:8px;
    padding:0 14px;
    background:#fff;
    color:var(--sh-ink);
    font-size:14px;
    font-weight:750;
    outline:none;
    box-sizing:border-box;
  }

  .sh-input:focus,
  .sh-select:focus{
    border-color:#94a3b8;
    box-shadow:0 0 0 3px rgba(148,163,184,.25);
  }

  .sh-divider{ height:1px; margin:15px 0; background:var(--sh-line); }

  .sh-btn,
  .sh-btn-sm,
  .sh-admin-tab,
  .sh-db-tab{
    border-radius:8px;
    font-weight:900;
    cursor:pointer;
    transition:.15s transform,.15s opacity,.15s background;
  }

  .sh-btn:active,
  .sh-btn-sm:active,
  .sh-admin-tab:active,
  .sh-db-tab:active{ transform:translateY(1px); }

  .sh-btn{
    height:44px;
    padding:0 18px;
    border:0;
    color:#fff;
    background:var(--sh-dark);
  }

  .sh-btn.primary{ background:var(--sh-dark); color:#fff; }
  .sh-btn[disabled]{ opacity:.55; cursor:not-allowed; }
  .sh-help{ margin-top:8px; color:var(--sh-muted); font-size:12px; line-height:1.35; }

  .sh-chip{
    display:inline-flex;
    align-items:center;
    justify-content:center;
    min-height:32px;
    padding:5px 10px;
    border-radius:999px;
    background:#f1f5f9;
    color:#334155;
    font-size:12px;
    font-weight:900;
    white-space:nowrap;
  }

  .sh-admin-tabs,
  .sh-db-tabs{
    display:flex;
    gap:8px;
    overflow:auto;
    margin-top:18px;
    padding:8px;
  }

  .sh-admin-tab,
  .sh-db-tab{
    height:auto;
    min-height:44px;
    border:0;
    padding:13px 16px;
    background:transparent;
    color:#475569;
    font-size:13px;
    white-space:nowrap;
  }

  .sh-admin-tab.is-active,
  .sh-admin-tab[aria-selected="true"],
  .sh-db-tab.is-active,
  .sh-db-tab[aria-selected="true"]{
    background:var(--sh-dark);
    color:#fff;
  }

  .sh-admin-panel{ margin-top:18px; }

  /* Keep older runtime-created nodes in the same preview system as new aliases. */
  .sh-card{
    border:1px solid rgba(255,255,255,.74);
    border-radius:30px;
    background:var(--sh-panel);
    box-shadow:0 16px 42px rgba(73,49,31,.08);
  }
  .sh-admin-tabs{
    border:0;
    border-radius:0;
    background:transparent;
    box-shadow:none;
  }
  .sh-admin-panel.is-hidden,
  .sh-admin-panel[hidden]{ display:none !important; }

  .sh-event-filter{
    display:grid;
    grid-template-columns:230px minmax(220px,1fr) auto auto;
    gap:12px;
    align-items:center;
    margin:18px 0;
    padding:18px;
    border:1px solid var(--sh-line);
    border-radius:8px;
    background:var(--sh-panel);
    box-shadow:var(--sh-shadow);
  }

  .sh-event-filter #sh_btn_refresh{
    min-height:44px;
    padding:0 18px;
    border:1px solid var(--sh-line);
    background:#fff;
    color:#334155;
  }

  .sh-table{
    width:100%;
    margin-top:18px;
    border-collapse:separate;
    border-spacing:0;
    overflow:hidden;
    font-size:14px;
  }

  .sh-table th{
    padding:15px 18px;
    background:#f8fafc;
    color:#64748b;
    text-align:left;
    text-transform:uppercase;
    letter-spacing:.03em;
    font-size:12px;
    font-weight:900;
  }

  .sh-table td{
    padding:15px 18px;
    border-top:1px solid #f1f5f9;
    font-size:14px;
    vertical-align:middle;
  }

  .sh-table tr:hover td{ background:#f8fafc; }

  .sh-btn-sm{
    min-height:32px;
    padding:5px 10px;
    border:1px solid var(--sh-line);
    background:#fff;
    color:#334155;
    font-size:11px;
  }

  .sh-btn-sm.pub{ background:var(--sh-success-bg); color:var(--sh-success-text); border-color:var(--sh-success-border); }
  .sh-btn-sm.priv{ background:var(--sh-danger-bg); color:var(--sh-danger-strong); border-color:#fecaca; }
  .sh-btn-sm.danger{ background:var(--sh-danger-bg); color:var(--sh-danger-strong); border-color:#fecaca; }

  .sh-table--legacy{ width:100%; border-collapse:separate; border-spacing:0; overflow:hidden; border-radius:8px; border:1px solid var(--sh-border); }
  .sh-table--legacy th, .sh-table--legacy td{ padding:12px 10px; border-bottom:1px solid var(--sh-border); font-size:13px; vertical-align:middle; }
  .sh-table--legacy th{ background:var(--sh-bg); text-align:left; color:var(--sh-muted); font-weight:800; }
  .sh-table--legacy tr:last-child td{ border-bottom:none; }

  .sh-badge{ display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border:1px solid var(--sh-border); border-radius:999px; background:#fff; font-size:12px; }
  .sh-dot{ width:8px; height:8px; border-radius:999px; background:#999; display:inline-block; }
  .sh-dot.ready{ background:#2e7d32; }
  .sh-dot.disabled{ background:var(--sh-bad); }
  .sh-dot.public{ background:#1565c0; }
  .sh-dot.private{ background:#616161; }
  .sh-actions{ display:flex; gap:8px; flex-wrap:wrap; }
  .sh-note{ margin-top:10px; color:var(--sh-muted); font-size:12px; }

  .sh-db-toolbar{
    display:grid;
    grid-template-columns:1.4fr 1fr 1fr auto auto;
    gap:12px;
    align-items:end;
  }

  .sh-db-toolbar #sh_db_date_to{ margin-top:6px; }

  .sh-db-status{
    min-height:20px;
    margin:12px 0;
    color:var(--sh-muted);
    font-size:13px;
  }

  .sh-db-status.is-error{ color:var(--sh-bad); }

  .sh-db-kpis{
    display:grid;
    grid-template-columns:repeat(5,minmax(0,1fr));
    gap:14px;
    margin-top:18px;
    margin-bottom:18px;
  }

  .sh-db-kpi{
    min-height:116px;
    padding:20px;
    border:1px solid var(--sh-line);
    border-radius:8px;
    background:#fff;
    box-shadow:var(--sh-shadow);
  }

  .sh-db-kpi-label{ color:var(--sh-muted); font-size:13px; font-weight:850; }
  .sh-db-kpi-value{ margin-top:10px; color:var(--sh-ink); font-size:26px; line-height:1.1; font-weight:950; letter-spacing:0; }
  .sh-db-kpi-note{ margin-top:4px; color:var(--sh-muted); font-size:12px; }

  .sh-db-grid{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:16px;
    margin-bottom:16px;
  }

  .sh-db-section{
    overflow:hidden;
    margin-bottom:16px;
  }

  .sh-db-section-head{
    display:flex;
    align-items:center;
    justify-content:space-between;
    min-height:58px;
    padding:0 18px;
  }

  .sh-db-section-title{
    margin:0;
    color:var(--sh-ink);
    font-size:18px;
    font-weight:950;
    letter-spacing:0;
  }

  .sh-db-table-wrap{
    overflow:auto;
    border-top:1px solid var(--sh-line);
  }

  .sh-db-table{
    width:100%;
    min-width:760px;
    border-collapse:collapse;
    font-size:14px;
  }

  .sh-db-table th{
    padding:15px 18px;
    background:#f8fafc;
    color:#64748b;
    text-align:left;
    text-transform:uppercase;
    letter-spacing:.03em;
    font-size:12px;
    font-weight:900;
  }

  .sh-db-table td{
    padding:15px 18px;
    border-top:1px solid #f1f5f9;
    white-space:nowrap;
  }

  .sh-db-table tr:hover td{ background:#f8fafc; }

  @media(max-width:1100px){
    .sh-admin-hero{ display:block; }
    .sh-admin-status-card{ min-width:0; margin-top:20px; }
    .sh-row{ flex-wrap:wrap; }
    .sh-row .sh-col{ flex:1 1 260px; }
    .sh-db-toolbar,
    .sh-event-filter{ grid-template-columns:1fr 1fr; }
    .sh-db-kpis{ grid-template-columns:repeat(2,minmax(0,1fr)); }
    .sh-db-grid{ grid-template-columns:1fr; }
  }

  @media(max-width:640px){
    .sh-admin-wrap{ padding:16px; }
    .sh-admin-hero{ padding:24px; }
    .sh-admin-title{ font-size:30px; }
    .sh-db-toolbar,
    .sh-event-filter{ grid-template-columns:1fr; }
    .sh-db-kpis{ grid-template-columns:1fr; }
    .sh-table{ display:block; overflow:auto; }
  }

  .sot-admin-dashboard{
    display:grid;
    grid-template-columns:280px minmax(0,1fr);
    min-height:calc(100vh - 48px);
    overflow:hidden;
    border:0;
    border-radius:0;
    background:#f6f7fb;
    box-shadow:none;
  }

  .sot-dash-sidebar{
    padding:22px 18px;
    background:#101828;
    color:#fff;
    overflow:auto;
  }

  .sot-dash-logo{
    font-size:21px;
    font-weight:950;
    letter-spacing:0;
  }

  .sot-dash-side-note{
    margin-top:6px;
    margin-bottom:22px;
    color:#aeb7c8;
    font-size:12px;
    line-height:1.45;
  }

  .sot-dash-nav{ display:grid; gap:4px; }

  .sot-dash-nav-group{
    margin:18px 10px 6px;
    color:#98a2b3;
    font-size:11px;
    font-weight:800;
    letter-spacing:.08em;
    line-height:1.2;
    text-transform:uppercase;
  }

  .sot-dash-nav-group:first-child{ margin-top:0; }

  .sot-dash-nav-btn{
    width:100%;
    min-height:40px;
    border:0;
    border-radius:12px;
    padding:12px;
    background:transparent;
    color:#d0d5dd;
    text-align:left;
    font-size:14px;
    font-weight:700;
    cursor:pointer;
  }

  .sot-dash-nav-btn:hover,
  .sot-dash-nav-btn.is-active{
    background:#1d2939;
    color:#fff;
  }

  .sot-dash-main{
    min-width:0;
    padding:24px 28px 64px;
    overflow:hidden;
  }

  .sot-dash-topbar{
    display:flex;
    justify-content:space-between;
    gap:16px;
    align-items:flex-start;
    margin-bottom:18px;
  }

  .sot-dash-title{
    margin:0 0 7px;
    color:#171923;
    font-size:28px;
    line-height:1.15;
    font-weight:950;
    letter-spacing:0;
  }

  .sot-dash-desc{
    max-width:720px;
    margin:0;
    color:#667085;
    font-size:14px;
    line-height:1.5;
  }

  .sot-dash-filters{
    display:flex;
    justify-content:flex-end;
    gap:8px;
    flex-wrap:wrap;
  }

  .sot-dash-filter-item{
    display:flex;
    align-items:center;
    gap:6px;
    color:#667085;
    font-size:12px;
    font-weight:900;
  }

  .sot-dash-filter-item.inline{
    justify-content:flex-start;
    margin-bottom:12px;
  }

  .sot-dash-tabs{
    display:flex;
    gap:8px;
    flex-wrap:wrap;
    margin:16px 0;
  }

  .sot-dash-tab{
    min-height:38px;
    border:1px solid #e5e7ef;
    border-radius:999px;
    padding:8px 14px;
    background:#fff;
    color:#344054;
    font-size:13px;
    font-weight:850;
    cursor:pointer;
  }

  .sot-dash-tab.is-active{
    border-color:#111827;
    background:#111827;
    color:#fff;
  }

  .sot-dash-kpis{
    display:grid;
    grid-template-columns:repeat(4,minmax(0,1fr));
    gap:14px;
    margin-bottom:16px;
  }

  .sot-dash-kpis.is-mini{ grid-template-columns:repeat(2,minmax(0,1fr)); margin:0; }

  .sot-dash-card,
  .sot-dash-panel{
    border:1px solid #e5e7ef;
    border-radius:18px;
    background:#fff;
    box-shadow:0 12px 28px rgba(17,24,39,.08);
  }

  .sot-dash-card{
    min-height:104px;
    padding:16px;
  }

  .sot-dash-label{
    color:#667085;
    font-size:12px;
    font-weight:850;
  }

  .sot-dash-value{
    margin-top:8px;
    color:#171923;
    font-size:28px;
    line-height:1.1;
    font-weight:950;
    letter-spacing:0;
  }

  .sot-dash-note{
    margin-top:8px;
    color:#667085;
    font-size:12px;
    line-height:1.45;
  }

  .sot-dash-grid{ display:grid; gap:16px; margin-bottom:16px; }
  .sot-dash-grid.two{ grid-template-columns:1.2fr .8fr; }

  .sot-dash-panel{
    overflow:hidden;
    margin-bottom:16px;
    padding:18px;
  }

  .sot-dash-panel h3{
    margin:0 0 12px;
    color:#171923;
    font-size:17px;
    font-weight:950;
    letter-spacing:0;
  }

  .sot-dash-table-wrap{ overflow:auto; margin:0 -18px -18px; border-top:1px solid #e5e7ef; }
  .sot-dash-table{ width:100%; min-width:760px; border-collapse:collapse; font-size:13px; }
  .sot-dash-table th,
  .sot-dash-table td{ padding:12px 14px; border-bottom:1px solid #e5e7ef; text-align:left; vertical-align:middle; }
  .sot-dash-table th{ background:#f9fafb; color:#667085; font-size:12px; font-weight:900; }
  .sot-dash-table tr:hover td{ background:#fbfcff; }

  .sot-dash-chart{
    display:flex;
    align-items:flex-end;
    gap:8px;
    height:190px;
    padding:12px 8px 4px;
    overflow:hidden;
    border:1px solid #e5e7ef;
    border-radius:14px;
    background:#fcfcfd;
  }

  .sot-dash-chart-col{ flex:1; display:flex; flex-direction:column; align-items:center; gap:7px; min-width:0; }
  .sot-dash-chart-col b{ font-size:11px; color:#344054; }
  .sot-dash-chart-col span{ font-size:11px; color:#667085; }
  .sot-dash-stick{ width:100%; max-width:34px; min-height:8px; border-radius:8px 8px 3px 3px; background:linear-gradient(180deg,#5271ff,#9aa8ff); }

  .sot-dash-funnel{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
  .sot-dash-step{ position:relative; min-height:112px; padding:16px; border:1px solid #e5e7ef; border-radius:16px; background:#fbfcff; }
  .sot-dash-step:after{ content:"→"; position:absolute; right:-14px; top:42%; color:#98a2b3; font-weight:900; }
  .sot-dash-step:last-child:after{ content:""; }
  .sot-dash-step small{ color:#667085; }

  .sot-dash-callout{
    margin-bottom:16px;
    border:1px solid #dbe4ff;
    border-radius:16px;
    padding:14px;
    background:#f3f6ff;
    color:#24315f;
    font-size:13px;
    line-height:1.55;
  }

  .sot-dash-callout.warn{ border-color:#fedf89; background:#fffbeb; color:#7a4b06; }
  .sot-dash-pill{ display:inline-flex; border-radius:999px; padding:4px 8px; font-size:12px; font-weight:850; background:#f2f4f7; color:#475467; }
  .sot-dash-pill.good{ background:#e7f8ef; color:#087443; }
  .sot-dash-pill.warn{ background:#fff7e6; color:#985f0d; }
  .sot-dash-pill.bad{ background:#ffebe9; color:#b42318; }

  .sot-dash-course-form{
    display:grid;
    grid-template-columns:1.2fr repeat(3,minmax(110px,.75fr)) auto;
    gap:10px;
    align-items:center;
  }

  .sot-dash-input{
    width:100%;
    min-height:40px;
    border:1px solid #d0d5dd;
    border-radius:12px;
    padding:9px 11px;
    background:#fff;
    color:#171923;
    font-size:13px;
    outline:none;
  }

  .sot-dash-input:focus{
    border-color:#5271ff;
    box-shadow:0 0 0 3px rgba(82,113,255,.14);
  }

  .sot-dash-btn{
    min-height:40px;
    border:0;
    border-radius:12px;
    padding:9px 14px;
    background:#111827;
    color:#fff;
    font-size:13px;
    font-weight:850;
    cursor:pointer;
    white-space:nowrap;
  }

  .sot-dash-btn:hover{ background:#263244; }
  .sot-dash-btn.danger{ background:#fff1f0; color:#b42318; }
  .sot-dash-btn.danger:hover{ background:#ffe4e1; }

  .sot-dash-barwrap{ display:inline-block; width:92px; height:10px; margin-right:8px; overflow:hidden; border-radius:999px; background:#eef1f6; vertical-align:middle; }
  .sot-dash-bar{ height:100%; border-radius:999px; background:linear-gradient(90deg,#2f5cff,#6d7cff); }

  .ctdash-shell{
    display:grid;
    gap:18px;
    color:var(--sh-ink);
    font-family:"SUIT","Pretendard","Apple SD Gothic Neo",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  }
  .ctdash-hero{ display:grid; grid-template-columns:1.25fr .75fr; gap:18px; }
  .ctdash-card{
    background:rgba(255,250,244,.92);
    border:1px solid rgba(255,255,255,.72);
    border-radius:30px;
    box-shadow:0 16px 42px rgba(73,49,31,.08);
  }
  .ctdash-hero-main,.ctdash-hero-side,.ctdash-section{ padding:24px; }
  .ctdash-hero-main{ background:radial-gradient(circle at top right, rgba(201,107,55,.18), transparent 32%), linear-gradient(180deg, rgba(255,250,244,.95), rgba(248,241,232,.9)); }
  .ctdash-eyebrow,.ctdash-kicker{
    display:inline-flex; padding:7px 12px; border-radius:999px; background:rgba(201,107,55,.14); color:#ab5426; font-size:12px; font-weight:900; letter-spacing:.08em; text-transform:uppercase;
  }
  .ctdash-kicker{ margin-bottom:8px; }
  .ctdash-hero-main h2,.ctdash-section h3{ margin:12px 0 8px; font-size:32px; line-height:1.05; font-weight:950; letter-spacing:-.04em; color:#211812; }
  .ctdash-section h3{ margin:0; font-size:28px; }
  .ctdash-hero-main p,.ctdash-section p{ margin:0; color:#6f6256; line-height:1.7; }
  .ctdash-hero-side{ display:grid; gap:12px; align-content:start; }
  .ctdash-hero-side h3{ margin:0 0 8px; font-size:18px; }
  .ctdash-status-row{ display:grid; grid-template-columns:1fr auto; gap:12px; color:#6f6256; font-size:14px; }
  .ctdash-status-row b{ color:#211812; }
  .ctdash-refresh,.ctdash-tab,.ctdash-chip{ border:0; border-radius:999px; font:inherit; font-weight:900; cursor:pointer; transition:.16s ease; }
  .ctdash-refresh{ min-height:44px; margin-top:8px; padding:0 18px; color:#fff; background:linear-gradient(135deg,#c96b37,#ab5426); box-shadow:0 14px 28px rgba(201,107,55,.24); }
  .ctdash-main-tabs,.ctdash-period-tabs,.ctdash-legend,.ctdash-inline-fields{ display:flex; flex-wrap:wrap; gap:10px; }
  .ctdash-main-tabs{ margin-top:18px; }
  .ctdash-tab,.ctdash-chip{ padding:11px 16px; background:rgba(33,24,18,.08); color:#6f6256; }
  .ctdash-tab.is-active,.ctdash-chip.is-active{ background:linear-gradient(135deg,#c96b37,#ab5426); color:#fff; box-shadow:0 12px 26px rgba(201,107,55,.22); }
  .ctdash-callout{ padding:16px 18px; border-radius:20px; background:rgba(255,255,255,.86); border:1px solid rgba(80,58,40,.08); color:#6f6256; }
  .ctdash-callout.warn{ background:rgba(183,79,73,.08); color:#b74f49; border-color:rgba(183,79,73,.16); }
  .ctdash-screen,.ctdash-two-col,.ctdash-sub-grid,.ctdash-summary-grid,.ctdash-metrics-grid,.ctdash-sales-grid,.ctdash-spot-grid,.ctdash-conv-grid,.ctdash-form-grid{ display:grid; gap:18px; }
  .ctdash-two-col,.ctdash-sub-grid{ grid-template-columns:1fr 1fr; }
  .ctdash-summary-grid{ grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
  .ctdash-metrics-grid{ grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; }
  .ctdash-sales-grid{ grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
  .ctdash-spot-grid{ grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }

  .ctdash-two-col > .ctdash-spot-section{
    grid-column:1 / -1;
  }
  .ctdash-spot-section .ctdash-spot-grid{
    width:100%;
  }
  .ctdash-conv-grid{ grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
  .ctdash-form-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); }
  .ctdash-form-grid.three{ grid-template-columns:repeat(3,minmax(0,1fr)); }
  .ctdash-metric-card,.ctdash-conv-card,.ctdash-sub-card,.ctdash-spot-card{ padding:18px; border-radius:20px; background:linear-gradient(180deg, rgba(255,255,255,.94), rgba(249,243,235,.88)); border:1px solid rgba(80,58,40,.08); }
  .ctdash-metric-card h4,.ctdash-conv-card h4,.ctdash-sub-card h4,.ctdash-spot-card h4{ margin:0 0 8px; color:#6f6256; font-size:13px; font-weight:800; }
  .ctdash-metric-card strong,.ctdash-spot-card strong{ display:block; font-size:28px; font-weight:950; letter-spacing:-.04em; color:#211812; }
  .ctdash-metric-card p,.ctdash-conv-card p,.ctdash-spot-card p{ margin:8px 0 0; color:#6f6256; font-size:12px; line-height:1.55; }
  .ctdash-section-head{ display:flex; justify-content:space-between; gap:14px; align-items:baseline; margin-bottom:18px; }
  .ctdash-tag{ padding:8px 12px; border-radius:999px; background:rgba(12,139,136,.12); color:#0c8b88; font-size:12px; font-weight:900; }
  .ctdash-chart-box{ position:relative; padding:18px; border-radius:24px; background:linear-gradient(180deg, rgba(255,255,255,.88), rgba(247,240,231,.72)); border:1px solid rgba(80,58,40,.08); overflow:hidden; }
  .ctdash-legend span{ display:inline-flex; align-items:center; gap:8px; color:#6f6256; font-size:13px; font-weight:800; }
  .ctdash-legend i{ width:12px; height:12px; border-radius:50%; display:inline-block; }
  .ctdash-chart-box svg{ display:block; width:100%; height:auto; }
  .ctdash-tooltip{ position:absolute; min-width:190px; padding:12px 14px; border-radius:16px; background:rgba(33,24,18,.94); color:#fff; pointer-events:none; opacity:0; transform:translateY(8px); transition:opacity 120ms ease, transform 120ms ease; box-shadow:0 18px 34px rgba(33,24,18,.22); }
  .ctdash-tooltip.is-visible{ opacity:1; transform:translateY(0); }
  .ctdash-tooltip-time{ margin:0 0 10px; font-size:12px; color:rgba(255,255,255,.76); letter-spacing:.04em; text-transform:uppercase; }
  .ctdash-tooltip-row{ display:flex; justify-content:space-between; gap:14px; margin-top:6px; font-size:13px; }
  .ctdash-tooltip-row b{ font-weight:800; }
  .ctdash-conv-top{ display:flex; justify-content:space-between; gap:10px; align-items:baseline; margin-bottom:10px; }
  .ctdash-conv-top strong{ font-size:24px; font-weight:950; color:#211812; }
  .ctdash-bar{ height:10px; border-radius:999px; background:rgba(33,24,18,.08); overflow:hidden; }
  .ctdash-bar span{ display:block; height:100%; border-radius:inherit; background:linear-gradient(90deg,#0c8b88,#c96b37); }
  .ctdash-rank-list{ display:grid; gap:10px; }
  .ctdash-rank-row{ display:grid; grid-template-columns:38px 1fr auto; gap:12px; align-items:center; padding:12px 14px; border-radius:16px; background:rgba(243,238,229,.84); }
  .ctdash-rank-row span{ width:38px; height:38px; display:grid; place-items:center; border-radius:50%; background:rgba(33,24,18,.08); color:#6f6256; font-weight:900; }
  .ctdash-rank-row strong{ color:#211812; }
  .ctdash-spot-row{ display:flex; justify-content:space-between; gap:10px; margin-top:8px; color:#6f6256; font-size:12px; }
  .ctdash-event-toolbar{ display:grid; gap:12px; }
  .ctdash-inline-fields label,.ctdash-form-grid label{ display:grid; gap:8px; color:#6f6256; font-size:13px; font-weight:800; }
  .ctdash-inline-fields label{ flex:1 1 220px; min-width:220px; }
  .ctdash-select,.ctdash-input,.ctdash-textarea{ width:100%; min-height:46px; padding:12px 14px; border-radius:14px; border:1px solid rgba(80,58,40,.12); background:#fffdfa; color:#211812; font:inherit; box-sizing:border-box; }
  .ctdash-textarea{ min-height:120px; resize:vertical; }
  .ctdash-textarea.tall{ min-height:180px; }
  .ctdash-textarea.compact{ min-height:86px; }
  .ctdash-table-wrap{ overflow:auto; }
  .ctdash-table{ width:100%; min-width:760px; border-collapse:collapse; }
  .ctdash-table th{ padding:14px 16px; background:rgba(243,238,229,.84); color:#6f6256; text-align:left; font-size:12px; font-weight:900; letter-spacing:.04em; text-transform:uppercase; }
  .ctdash-table td{ padding:14px 16px; border-top:1px solid rgba(80,58,40,.08); background:rgba(255,255,255,.24); }
  .ctdash-empty{ color:#6f6256; font-size:13px; }

  @media(max-width:1100px){
    .sot-admin-dashboard{ grid-template-columns:1fr; }
    .sot-dash-sidebar{ position:relative; }
    .sot-dash-nav{ grid-template-columns:repeat(2,minmax(0,1fr)); }
    .sot-dash-topbar{ display:block; }
    .sot-dash-filters{ justify-content:flex-start; margin-top:14px; }
    .sot-dash-kpis,
    .sot-dash-kpis.is-mini,
    .sot-dash-grid.two,
    .sot-dash-course-form,
    .sot-dash-funnel{ grid-template-columns:1fr 1fr; }
    .ctdash-hero,.ctdash-two-col,.ctdash-sub-grid{ grid-template-columns:1fr; }
    .ctdash-metrics-grid,.ctdash-summary-grid,.ctdash-sales-grid,.ctdash-spot-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); }
    .ctdash-conv-grid,.ctdash-form-grid.three{ grid-template-columns:1fr; }
  }

  @media(max-width:640px){
    .sot-dash-main{ padding:16px; }
    .sot-dash-nav{ grid-template-columns:1fr; }
    .sot-dash-kpis,
    .sot-dash-kpis.is-mini,
    .sot-dash-grid.two,
    .sot-dash-course-form,
    .sot-dash-funnel{ grid-template-columns:1fr; }
    .sot-dash-title{ font-size:24px; }
    .ctdash-metrics-grid,.ctdash-summary-grid,.ctdash-sales-grid,.ctdash-spot-grid,.ctdash-conv-grid,.ctdash-form-grid{ grid-template-columns:1fr; }
  }

  /* Preview v2 visual system: runtime markup keeps its sh-/ctdash- contracts. */
  :root{
    --sh-page:#f4eee5;
    --sh-panel:rgba(255,250,244,.92);
    --sh-ink:#211812;
    --sh-muted:#6f6256;
    --sh-line:rgba(80,58,40,.12);
    --sh-dark:#211812;
    --sh-soft:#fbf7f1;
    --sh-ok:#2f8f54;
    --sh-warn:#c96b37;
    --sh-bad:#b74f49;
    --sh-border:var(--sh-line);
    --sh-bg:#f3eee5;
    --sh-text:var(--sh-ink);
    --sh-text-soft:#4f4035;
    --sh-text-muted:var(--sh-muted);
    --sh-surface:var(--sh-panel);
    --sh-surface-soft:#fbf7f1;
    --sh-surface-muted:#f3eee5;
    --sh-surface-subtle:#fffdfa;
    --sh-line-strong:rgba(80,58,40,.22);
    --sh-line-soft:rgba(80,58,40,.08);
    --sh-primary:#c96b37;
    --sh-danger:#b74f49;
    --sh-danger-strong:#9f3f3a;
    --sh-danger-bg:rgba(183,79,73,.08);
    --sh-success-bg:rgba(47,143,84,.10);
    --sh-success-text:#277845;
    --sh-success-border:rgba(47,143,84,.22);
    --sh-shadow:0 24px 70px rgba(75,50,30,.12);
  }

  body{
    min-height:100vh;
    background:
      radial-gradient(circle at top left, rgba(216,162,61,.18), transparent 24%),
      radial-gradient(circle at top right, rgba(12,139,136,.12), transparent 26%),
      linear-gradient(180deg,#faf5ee 0%,var(--sh-page) 100%);
  }

  .sh-admin-wrap.shell{
    width:min(1480px,calc(100vw - 28px));
    min-height:calc(100vh - 28px);
    margin:14px auto 72px;
    padding:24px;
    border:1px solid rgba(255,255,255,.72);
    border-radius:36px;
    background:rgba(255,248,240,.74);
    box-shadow:var(--sh-shadow);
    backdrop-filter:blur(18px);
    color:var(--sh-ink);
    font-family:"SUIT","Pretendard","Apple SD Gothic Neo",sans-serif;
  }

  .sh-admin-hero.hero{
    display:grid;
    grid-template-columns:1.3fr .7fr;
    gap:18px;
    align-items:stretch;
    padding:0;
    color:var(--sh-ink);
    background:transparent;
    border-radius:0;
    box-shadow:none;
  }
  .sh-admin-hero .card,
  .ctdash-card.card,
  .sh-card.card,
  .sh-event-filter.card{
    border:1px solid rgba(255,255,255,.74);
    border-radius:30px;
    background:var(--sh-panel);
    box-shadow:0 16px 42px rgba(73,49,31,.08);
  }
  .sh-admin-hero-main.hero-main{
    position:relative;
    overflow:hidden;
    padding:30px;
    background:radial-gradient(circle at top right, rgba(201,107,55,.22), transparent 56%),linear-gradient(180deg,rgba(255,250,244,.95),rgba(248,241,232,.9));
  }
  .sh-admin-eyebrow,
  .ctdash-eyebrow.eyebrow{
    margin:0 0 12px;
    padding:7px 12px;
    border:0;
    border-radius:999px;
    background:rgba(201,107,55,.14);
    color:#ab5426;
    font-size:12px;
    font-weight:900;
    letter-spacing:.08em;
  }
  .sh-admin-title{
    color:var(--sh-ink);
    font-family:"Cormorant Garamond","Times New Roman",serif;
    font-size:clamp(40px,5vw,60px);
    line-height:.92;
    letter-spacing:-.04em;
  }
  .sh-admin-sub{ margin-top:12px; color:var(--sh-muted); font-size:16px; line-height:1.7; }
  .sh-admin-status-card.hero-side{
    display:grid;
    min-width:0;
    align-content:start;
    gap:12px;
    padding:24px;
    color:var(--sh-muted);
    font-size:14px;
  }
  .sh-admin-status-card b{ margin:0; color:var(--sh-ink); }
  .sh-admin-status-card b.is-error{ color:var(--sh-bad); }
  .sh-admin-status-card div + div{ margin:0; color:var(--sh-muted); }
  .sh-admin-refresh{
    justify-self:start;
    margin-top:4px;
    padding:10px 16px;
    border:0;
    color:#fff;
    background:linear-gradient(135deg,#c96b37,#ab5426);
    box-shadow:0 12px 26px rgba(201,107,55,.22);
  }

  .sh-admin-tabs.main-tabs,
  .sh-db-tabs,
  .ctdash-main-tabs.main-tabs{
    display:flex;
    flex-wrap:wrap;
    gap:10px;
    margin-top:18px;
    padding:0;
    overflow:visible;
    border:0;
    border-radius:0;
    background:transparent;
    box-shadow:none;
  }
  .sh-admin-tab.tab-btn,
  .sh-db-tab,
  .ctdash-tab.tab-btn,
  .ctdash-chip,
  .sh-chip{
    min-height:0;
    padding:12px 18px;
    border:0;
    border-radius:999px;
    background:rgba(33,24,18,.08);
    color:var(--sh-muted);
    font-size:13px;
    font-weight:900;
  }
  .sh-admin-tab.tab-btn.is-active,
  .sh-admin-tab.tab-btn[aria-selected="true"],
  .sh-db-tab.is-active,
  .sh-db-tab[aria-selected="true"],
  .ctdash-tab.tab-btn.is-active,
  .ctdash-chip.is-active{
    color:#fff;
    background:linear-gradient(135deg,#c96b37,#ab5426);
    box-shadow:0 12px 26px rgba(201,107,55,.22);
  }
  .sh-admin-panel{ margin-top:18px; }

  .sh-card.card,
  .sh-event-filter.card{
    padding:24px;
    margin-top:0;
    margin-bottom:18px;
  }
  .sh-row{ gap:14px; margin-bottom:14px; }
  .sh-label{ color:var(--sh-muted); font-weight:800; }
  .sh-input,.sh-select{
    height:46px;
    border:1px solid rgba(80,58,40,.12);
    border-radius:14px;
    background:#fffdfa;
    color:var(--sh-ink);
    font-weight:700;
  }
  .sh-input:focus,.sh-select:focus{ border-color:rgba(201,107,55,.72); box-shadow:0 0 0 3px rgba(201,107,55,.16); }
  .sh-divider{ background:rgba(80,58,40,.10); }
  .sh-btn{
    border-radius:999px;
    background:linear-gradient(135deg,#c96b37,#ab5426);
    box-shadow:0 12px 26px rgba(201,107,55,.22);
  }
  .sh-btn.primary{ background:linear-gradient(135deg,#c96b37,#ab5426); }
  .sh-btn-sm{
    border:1px solid rgba(80,58,40,.12);
    border-radius:999px;
    background:#fffdfa;
    color:var(--sh-ink);
    font-weight:800;
  }
  .sh-event-filter{ grid-template-columns:230px minmax(220px,1fr) auto auto; }
  .sh-event-filter #sh_btn_refresh{ border-radius:999px; border-color:rgba(80,58,40,.12); background:#fffdfa; color:var(--sh-ink); }

  .sh-table,
  .sh-table--legacy{
    border:1px solid rgba(80,58,40,.08);
    border-radius:24px;
    background:rgba(255,250,244,.86);
    box-shadow:0 16px 42px rgba(73,49,31,.06);
  }
  .sh-table th,.sh-table--legacy th{ background:rgba(243,238,229,.84); color:var(--sh-muted); }
  .sh-table td,.sh-table--legacy td{ border-color:rgba(80,58,40,.08); color:var(--sh-ink); }
  .sh-table tr:hover td{ background:rgba(255,255,255,.60); }

  .sh-db-kpi,.sot-dash-card,
  .ctdash-metric-card,.ctdash-conv-card,.ctdash-sub-card,.ctdash-spot-card{
    border:1px solid rgba(80,58,40,.08);
    border-radius:20px;
    background:linear-gradient(180deg,rgba(255,255,255,.94),rgba(249,243,235,.88));
    box-shadow:none;
  }
  .sh-db-section,.sot-dash-panel{
    border:1px solid rgba(255,255,255,.74);
    border-radius:30px;
    background:var(--sh-panel);
    box-shadow:0 16px 42px rgba(73,49,31,.08);
  }
  .sh-db-section-title,.sot-dash-title{ color:var(--sh-ink); letter-spacing:-.04em; }
  .sh-db-table th,.sot-dash-table th{ background:rgba(243,238,229,.84); color:var(--sh-muted); }
  .sh-db-table td,.sot-dash-table td{ border-color:rgba(80,58,40,.08); }

  .sot-admin-dashboard{
    min-height:calc(100vh - 180px);
    border:1px solid rgba(255,255,255,.74);
    border-radius:30px;
    background:var(--sh-panel);
    box-shadow:0 16px 42px rgba(73,49,31,.08);
  }
  .sot-dash-sidebar{ background:linear-gradient(180deg,#3d2c21,#211812); }
  .sot-dash-main{ background:transparent; }
  .sot-dash-btn{ border-radius:999px; background:linear-gradient(135deg,#c96b37,#ab5426); }
  .sot-dash-btn:hover{ background:#ab5426; }

  .ctdash-shell.shell{
    min-height:calc(100vh - 300px);
    padding:0;
    color:var(--sh-ink);
  }
  .ctdash-hero.hero{ grid-template-columns:1.3fr .7fr; }
  .ctdash-hero-main.ctdash-card.hero-main{ padding:30px; }
  .ctdash-hero-side.ctdash-card.hero-side{ padding:24px; }
  .ctdash-hero-main h2{
    margin:14px 0 8px;
    color:var(--sh-ink);
    font-family:"Cormorant Garamond","Times New Roman",serif;
    font-size:clamp(40px,5vw,60px);
    line-height:.92;
  }
  .ctdash-section{ padding:24px; }
  .ctdash-section h3{ color:var(--sh-ink); }
  .ctdash-callout{ border-radius:20px; }
  .ctdash-table{ overflow:hidden; border-radius:20px; }
  .ctdash-chart-placeholder{
    display:grid;
    min-height:250px;
    place-items:center;
    border:1px dashed rgba(80,58,40,.20);
    border-radius:18px;
    background:rgba(255,255,255,.42);
    color:var(--sh-muted);
    font-size:13px;
    font-weight:800;
  }
  .ctdash-fallback-screen{ min-height:880px; }

  .sot-dash-callout.is-status{
    display:flex;
    align-items:baseline;
    flex-wrap:wrap;
    gap:8px 12px;
    margin-bottom:18px;
    border-radius:20px;
    background:rgba(255,255,255,.86);
    border:1px solid rgba(80,58,40,.08);
    color:var(--sh-muted);
  }
  .sot-dash-callout.is-status b{ color:var(--sh-ink); }
  .sot-dash-callout.warn.is-status{ background:rgba(183,79,73,.08); color:#9f3f3a; }
  .sot-dash-callout.warn.is-status b{ color:#9f3f3a; }
  .sot-dash-chart-placeholder{
    display:grid;
    min-height:180px;
    place-items:center;
    margin-top:12px;
    border:1px dashed rgba(80,58,40,.20);
    border-radius:18px;
    background:rgba(255,255,255,.42);
    color:var(--sh-muted);
    font-size:13px;
    font-weight:800;
  }

  @media(max-width:860px){
    .sh-admin-hero.hero,.ctdash-hero.hero{ grid-template-columns:1fr; }
    .sh-admin-status-card.hero-side{ margin-top:0; }
    .sh-event-filter{ grid-template-columns:1fr 1fr; }
  }
  @media(max-width:640px){
    .sh-admin-wrap.shell{ width:calc(100vw - 16px); margin:8px auto 48px; padding:16px; border-radius:24px; }
    .sh-admin-hero-main.hero-main,.ctdash-hero-main.ctdash-card.hero-main,.sh-admin-status-card.hero-side,.ctdash-hero-side.ctdash-card.hero-side,.sh-card.card,.sh-event-filter.card,.ctdash-section{ padding:20px; }
    .sh-event-filter{ grid-template-columns:1fr; }
    .sh-admin-title,.ctdash-hero-main h2{ font-size:40px; }
  }

  .fr-shell{ gap:20px; }
  .fr-hero{ border:1px solid rgba(12,139,136,.16); background:linear-gradient(180deg,rgba(255,255,255,.94),rgba(242,248,246,.82)); }
  .fr-toolbar{ display:flex; flex-wrap:wrap; gap:12px; align-items:end; margin-top:16px; }
  .fr-toolbar label{ display:grid; gap:8px; color:var(--sh-muted); font-size:13px; font-weight:800; }
  .fr-history-toolbar{ display:grid; grid-template-columns:minmax(0,1.55fr) minmax(260px,1fr); gap:12px; margin-top:16px; }
  .fr-history-toolbar label{ display:grid; gap:8px; color:var(--sh-muted); font-size:13px; font-weight:800; }
  .fr-history-readonly .ctdash-input[readonly],.fr-history-readonly .ctdash-textarea[readonly],.fr-history-readonly .ctdash-select:disabled,.fr-history-readonly .fr-table-input[readonly],.fr-history-readonly .fr-table-input:disabled{ opacity:1; color:#514236; -webkit-text-fill-color:#514236; background:rgba(243,238,229,.84); cursor:default; }
  .fr-history-readonly .fr-check-grid label{ cursor:default; }
  .fr-history-readonly .fr-check-grid input:disabled{ opacity:1; }
  .fr-section{ overflow:hidden; }
  .fr-two-col{ display:grid; grid-template-columns:1fr 1fr; gap:18px; align-items:start; }
  .fr-table .ctdash-input,.fr-table .ctdash-select{ min-width:150px; min-height:40px; padding:9px 10px; border-radius:10px; font-size:13px; }
  .fr-table td:last-child{ white-space:nowrap; }
  .fr-two-col .ctdash-table-wrap,.fr-compact-table-wrap{ overflow:visible; }
  .fr-two-col .fr-table,.fr-compact-table-wrap .fr-table{ min-width:0; table-layout:fixed; }
  .fr-two-col .fr-table th,.fr-two-col .fr-table td,.fr-compact-table-wrap .fr-table th,.fr-compact-table-wrap .fr-table td{ padding:12px 10px; overflow-wrap:anywhere; }
  .fr-two-col .fr-table .ctdash-input,.fr-two-col .fr-table .ctdash-select,.fr-compact-table-wrap .fr-table .ctdash-input,.fr-compact-table-wrap .fr-table .ctdash-select{ min-width:0; }
  .fr-issue-auto-table td:last-child,.fr-issue-manual-table td:last-child{ white-space:normal; }
  .fr-equipment-total th:nth-child(2),.fr-equipment-total th:nth-child(4),.fr-count-cell{ width:54px; text-align:center; }
  .fr-equipment-groups{ display:grid; gap:10px; }
  .fr-equipment-group{ overflow:hidden; border:1px solid rgba(80,58,40,.11); border-radius:14px; background:#fffdfa; }
  .fr-equipment-assignment{ display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:8px; padding:10px 12px; border-bottom:1px solid rgba(80,58,40,.09); background:rgba(243,238,229,.62); }
  .fr-equipment-owner{ color:#514236; font-size:13px; font-weight:900; white-space:nowrap; }
  .fr-equipment-spot{ min-width:0; overflow:hidden; color:#75685d; font-size:12px; font-weight:750; text-overflow:ellipsis; white-space:nowrap; }
  .fr-equipment-spot::before{ content:"· "; color:#c96b32; }
  .fr-equipment-status{ padding:4px 7px; border-radius:999px; background:#e8f4ef; color:#247455; font-size:10px; font-weight:900; white-space:nowrap; }
  .fr-equipment-items{ display:flex; flex-wrap:wrap; gap:7px; padding:11px 12px; }
  .fr-equipment-item{ display:inline-flex; max-width:100%; padding:7px 8px; border:1px solid rgba(80,58,40,.11); border-radius:9px; background:#fff; color:#5b4e44; font-size:12px; font-weight:750; line-height:1.25; }
  .fr-section-divider{ height:1px; margin:22px 0; background:rgba(80,58,40,.12); }
  .fr-subsection-head{ margin-bottom:12px; }
  .fr-json{ max-height:460px; overflow:auto; padding:18px; border-radius:18px; background:#211812; color:#fffdfa; font-size:12px; line-height:1.55; }
  .fr-input:focus,.fr-table-input:focus{ outline:2px solid rgba(12,139,136,.28); border-color:rgba(12,139,136,.45); }
  .fr-readonly-input{ color:#6f6256; background:rgba(243,238,229,.84); }
  .fr-auto-cell{ color:#6f6256; background:rgba(243,238,229,.38); }
  .fr-participant-field{ display:grid; gap:8px; margin-top:18px; color:#6f6256; font-size:13px; font-weight:800; }
  .fr-participant-field small{ font-size:12px; font-weight:600; line-height:1.5; }
  .fr-staff-picker{ display:grid; gap:10px; padding:12px; border:1px solid rgba(80,58,40,.12); border-radius:14px; background:#fffdfa; }
  .fr-staff-chips{ display:flex; flex-wrap:wrap; gap:8px; min-height:30px; }
  .fr-staff-chip{ display:inline-flex; align-items:center; gap:7px; padding:7px 8px 7px 11px; border-radius:999px; background:rgba(12,139,136,.12); color:#0c6865; font-size:13px; font-weight:900; }
  .fr-staff-chip button{ width:18px; height:18px; padding:0; border:0; border-radius:50%; background:rgba(12,139,136,.16); color:#0c6865; font:inherit; line-height:1; cursor:pointer; }
  .fr-staff-add{ display:flex; gap:8px; }
  .fr-staff-add .ctdash-select{ min-height:40px; padding:9px 10px; border-radius:10px; }
  .fr-closing-checks{ display:grid; gap:8px; margin-top:18px; color:#6f6256; font-size:13px; font-weight:800; }
  .fr-check-grid{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; }
  .fr-check-grid label{ display:flex; align-items:center; gap:8px; min-height:44px; padding:10px 12px; border:1px solid rgba(80,58,40,.12); border-radius:12px; background:#fffdfa; color:#514236; cursor:pointer; }
  .fr-check-grid input{ width:17px; height:17px; margin:0; accent-color:#0c8b88; }
  @media(max-width:980px){
    .fr-toolbar,.fr-two-col{ grid-template-columns:1fr; }
    .fr-history-toolbar{ grid-template-columns:1fr; }
    .fr-staff-add{ flex-direction:column; }
    .fr-check-grid{ grid-template-columns:repeat(2,minmax(0,1fr)); }
  }
  @media(max-width:640px){
    .fr-two-col .fr-table th,.fr-two-col .fr-table td{ padding:10px 7px; font-size:12px; }
    .fr-equipment-total th:nth-child(2),.fr-equipment-total th:nth-child(4),.fr-count-cell{ width:42px; }
    .fr-equipment-assignment{ grid-template-columns:auto minmax(0,1fr); }
    .fr-equipment-status{ grid-column:1 / -1; justify-self:start; }
    .fr-issue-auto-table,.fr-issue-auto-table tbody,.fr-issue-auto-table tr,.fr-issue-auto-table td,.fr-issue-manual-table,.fr-issue-manual-table tbody,.fr-issue-manual-table tr,.fr-issue-manual-table td{ display:block; width:100%; box-sizing:border-box; }
    .fr-issue-auto-table thead,.fr-issue-manual-table thead{ display:none; }
    .fr-issue-auto-table tr,.fr-issue-manual-table tr{ padding:8px 0; border-top:1px solid rgba(80,58,40,.1); }
    .fr-issue-auto-table td,.fr-issue-manual-table td{ display:grid; grid-template-columns:78px minmax(0,1fr); gap:10px; align-items:center; padding:7px 0; border:0; background:transparent; white-space:normal; }
    .fr-issue-auto-table td::before,.fr-issue-manual-table td::before{ content:attr(data-label); color:#6f6256; font-size:12px; font-weight:900; }
    .fr-issue-auto-table td.ctdash-empty,.fr-issue-manual-table td.ctdash-empty{ display:block; }
    .fr-issue-auto-table td.ctdash-empty::before,.fr-issue-manual-table td.ctdash-empty::before{ content:""; }
  }

  .legacy-v2-shell{ display:grid; gap:18px; }
  .legacy-v2-subtabs{
    display:flex;
    flex-wrap:wrap;
    gap:8px;
    padding:8px;
    border:1px solid rgba(80,58,40,.10);
    border-radius:18px;
    background:rgba(255,255,255,.58);
  }
  .legacy-v2-banner{
    display:flex;
    flex-wrap:wrap;
    align-items:center;
    gap:8px 12px;
    margin:0 0 14px;
    padding:12px 14px;
    border:1px solid rgba(12,139,136,.18);
    border-radius:16px;
    background:rgba(12,139,136,.08);
    color:#3d574f;
    font-size:13px;
    font-weight:800;
  }
  .legacy-v2-banner strong{ color:var(--sh-ink); }
  .legacy-v2-banner.is-warn{
    border-color:rgba(183,79,73,.22);
    background:rgba(183,79,73,.08);
    color:#9f3f3a;
  }
  .legacy-v2-status{
    display:inline-block;
    padding:3px 8px;
    border-radius:999px;
    background:rgba(80,58,40,.08);
    color:#6f6256;
    font-size:.72em;
    font-weight:900;
    white-space:nowrap;
  }
  .legacy-v2-status-grid{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
    gap:10px;
  }
  .legacy-v2-status-grid span{
    padding:12px 14px;
    border:1px solid rgba(80,58,40,.10);
    border-radius:14px;
    background:rgba(255,255,255,.54);
    color:#6f6256;
    font-size:13px;
  }
  .legacy-v2-status-grid b{ color:#9f3f3a; }
  .legacy-v2-select-label{
    display:grid;
    gap:8px;
    min-width:220px;
    color:var(--sh-muted);
    font-size:13px;
    font-weight:900;
  }
  .legacy-v2-section .ctdash-section-head{ align-items:end; }
  @media(max-width:640px){
    .legacy-v2-select-label{ min-width:0; width:100%; }
    .legacy-v2-banner{ align-items:flex-start; flex-direction:column; }
  }

  /* UI fit patch: keep long event names and revenue values inside metric cards. */
  .ctdash-summary-grid,
  .ctdash-sales-grid{
    align-items:stretch;
  }
  .ctdash-metric-card{
    min-width:0;
    overflow:hidden;
  }
  .ctdash-summary-grid .ctdash-metric-card.is-wide{
    grid-column:span 2;
  }
  .ctdash-sales-grid .ctdash-metric-card.is-money{
    grid-column:span 2;
  }
  .ctdash-metric-card.is-wide strong,
  .ctdash-metric-card.is-money strong{
    max-width:100%;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
    word-break:keep-all;
    line-height:1.08;
  }
  .ctdash-metric-card.is-event-name strong{
    font-size:clamp(22px,2.15vw,28px);
    letter-spacing:-.055em;
  }
  .ctdash-metric-card.is-money strong{
    font-size:clamp(22px,2.05vw,28px);
    letter-spacing:-.055em;
  }
  @media(max-width:640px){
    .ctdash-summary-grid .ctdash-metric-card.is-wide,
    .ctdash-sales-grid .ctdash-metric-card.is-money{
      grid-column:span 1;
    }
  }


  /* Balanced card grids: avoid 5+1 orphan rows in spot and photo bucket summaries. */
  .ctdash-balanced-grid{
    --ctdash-balanced-min:240px;
    grid-template-columns:repeat(auto-fit,minmax(var(--ctdash-balanced-min),1fr));
    align-items:stretch;
  }
  .ctdash-spot-grid.ctdash-balanced-grid{
    --ctdash-balanced-min:250px;
  }
  .ctdash-spot-grid.ctdash-balanced-grid.is-count-5,
  .ctdash-spot-grid.ctdash-balanced-grid.is-count-6,
  .ctdash-metrics-grid.ctdash-balanced-grid.is-count-6{
    grid-template-columns:repeat(3,minmax(0,1fr));
  }
  .ctdash-spot-card{
    min-width:0;
    overflow:hidden;
  }
  .ctdash-spot-card h4,
  .ctdash-spot-card p,
  .ctdash-spot-card strong{
    max-width:100%;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .ctdash-spot-row{
    align-items:center;
    min-width:0;
  }
  .ctdash-spot-row span,
  .ctdash-spot-row b{
    min-width:0;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .ctdash-spot-row span{
    flex:1 1 auto;
  }
  .ctdash-spot-row b{
    flex:0 1 auto;
    max-width:58%;
    text-align:right;
  }
  @media(max-width:980px){
    .ctdash-spot-grid.ctdash-balanced-grid.is-count-5,
    .ctdash-spot-grid.ctdash-balanced-grid.is-count-6,
    .ctdash-metrics-grid.ctdash-balanced-grid.is-count-6{
      grid-template-columns:repeat(2,minmax(0,1fr));
    }
  }
  @media(max-width:640px){
    .ctdash-spot-grid.ctdash-balanced-grid.is-count-5,
    .ctdash-spot-grid.ctdash-balanced-grid.is-count-6,
    .ctdash-metrics-grid.ctdash-balanced-grid.is-count-6{
      grid-template-columns:1fr;
    }
  }


  .sot-loader-overlay{
    position:fixed;
    inset:0;
    z-index:99999;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:24px;
    background:transparent;
    backdrop-filter:none;
    -webkit-backdrop-filter:none;
    pointer-events:auto;
  }

  .sot-loader-overlay[hidden]{
    display:none !important;
  }

  body.sot-loader-active{
    cursor:progress;
  }

  .sot-loader-card{
    width:min(330px, calc(100vw - 48px));
    min-height:286px;
    padding:22px 22px 20px;
    border-radius:28px;
    background:rgba(255,255,255,.34);
    border:1px solid rgba(255,255,255,.46);
    box-shadow:0 24px 70px rgba(15,23,42,.13),0 2px 8px rgba(15,23,42,.04);
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    text-align:center;
    animation:sotLoaderPop .18s ease-out;
  }

  .sot-loader-lottie{
    width:238px;
    height:238px;
  }

  .sot-loader-title{
    margin-top:-4px;
    color:#0f172a;
    font-size:17px;
    line-height:1.35;
    font-weight:900;
    letter-spacing:-.03em;
    text-align:center;
    text-shadow:0 1px 2px rgba(255,255,255,.72);
  }

  .sot-loader-sub{
    margin-top:6px;
    color:#334155;
    font-size:12px;
    line-height:1.35;
    font-weight:700;
    text-align:center;
    text-shadow:0 1px 2px rgba(255,255,255,.72);
  }

  @keyframes sotLoaderPop{
    from{
      opacity:0;
      transform:translateY(8px) scale(.98);
    }
    to{
      opacity:1;
      transform:translateY(0) scale(1);
    }
  }

  @media(max-width:640px){
    .sot-loader-card{
      width:min(300px, calc(100vw - 32px));
      min-height:260px;
      padding:20px 18px;
      border-radius:24px;
    }

    .sot-loader-lottie{
      width:214px;
      height:214px;
    }

    .sot-loader-title{
      font-size:16px;
    }
  }

</style>

<!-- UI fit patch v2: forced wide sections and balanced metric grids -->
<style id="sot-admin-ui-fit-v2-force">
  .ctdash-two-col > .ctdash-section.ctdash-spot-section,
  .ctdash-two-col > article.ctdash-card.ctdash-section.ctdash-spot-section{
    grid-column:1 / -1 !important;
    width:100% !important;
    max-width:none !important;
  }
  .ctdash-two-col > .ctdash-section.ctdash-wide-section,
  .ctdash-two-col > article.ctdash-card.ctdash-section.ctdash-wide-section{
    grid-column:1 / -1 !important;
    width:100% !important;
    max-width:none !important;
  }
  .ctdash-spot-section .ctdash-spot-grid{
    width:100% !important;
  }
  .ctdash-spot-grid.ctdash-balanced-grid.is-count-6,
  .ctdash-metrics-grid.ctdash-balanced-grid.is-count-6{
    grid-template-columns:repeat(3,minmax(0,1fr)) !important;
  }
  .ctdash-spot-grid.ctdash-balanced-grid.is-count-5{
    grid-template-columns:repeat(auto-fit,minmax(220px,1fr)) !important;
  }
  .ctdash-conv-grid.ctdash-wide-grid{
    grid-template-columns:repeat(4,minmax(0,1fr)) !important;
    width:100% !important;
  }
  @media(max-width:1280px){
    .ctdash-conv-grid.ctdash-wide-grid{
      grid-template-columns:repeat(2,minmax(0,1fr)) !important;
    }
  }
  @media(max-width:980px){
    .ctdash-spot-grid.ctdash-balanced-grid.is-count-6,
    .ctdash-metrics-grid.ctdash-balanced-grid.is-count-6{
      grid-template-columns:repeat(2,minmax(0,1fr)) !important;
    }
  }
  @media(max-width:640px){
    .ctdash-spot-grid.ctdash-balanced-grid.is-count-6,
    .ctdash-metrics-grid.ctdash-balanced-grid.is-count-6{
      grid-template-columns:1fr !important;
    }
    .ctdash-conv-grid.ctdash-wide-grid{
      grid-template-columns:repeat(2,minmax(0,1fr)) !important;
      gap:10px !important;
    }
    .ctdash-conv-grid.ctdash-wide-grid .ctdash-conv-card{
      padding:14px !important;
    }
    .ctdash-conv-grid.ctdash-wide-grid .ctdash-conv-top{
      align-items:flex-start !important;
      gap:8px !important;
    }
    .ctdash-conv-grid.ctdash-wide-grid .ctdash-conv-top strong{
      font-size:24px !important;
      line-height:1 !important;
    }
    .ctdash-conv-grid.ctdash-wide-grid .ctdash-conv-card p{
      word-break:break-word !important;
      overflow-wrap:anywhere !important;
    }
  }


  /* UI fit patch v4: table column alignment for report event summary and photo bucket analysis. */
  .ctdash-report-event-summary-table,
  .ctdash-photo-bucket-table{
    table-layout:fixed;
    min-width:760px;
  }
  .ctdash-report-event-summary-table th,
  .ctdash-report-event-summary-table td,
  .ctdash-photo-bucket-table th,
  .ctdash-photo-bucket-table td{
    box-sizing:border-box;
    vertical-align:middle;
    white-space:nowrap;
  }
  .ctdash-report-event-summary-table th:first-child,
  .ctdash-report-event-summary-table td:first-child{
    width:28%;
    text-align:left;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .ctdash-report-event-summary-table th:not(:first-child),
  .ctdash-report-event-summary-table td:not(:first-child),
  .ctdash-photo-bucket-table th:not(:first-child),
  .ctdash-photo-bucket-table td:not(:first-child){
    text-align:right !important;
  }
  .ctdash-photo-bucket-table th:first-child,
  .ctdash-photo-bucket-table td:first-child{
    width:18%;
    text-align:left !important;
  }
  .ctdash-photo-bucket-table th:nth-child(2),
  .ctdash-photo-bucket-table td:nth-child(2),
  .ctdash-photo-bucket-table th:nth-child(3),
  .ctdash-photo-bucket-table td:nth-child(3),
  .ctdash-photo-bucket-table th:nth-child(4),
  .ctdash-photo-bucket-table td:nth-child(4){
    width:15%;
  }
  .ctdash-photo-bucket-table th:nth-child(5),
  .ctdash-photo-bucket-table td:nth-child(5){
    width:14%;
  }
  .ctdash-photo-bucket-table th:nth-child(6),
  .ctdash-photo-bucket-table td:nth-child(6){
    width:23%;
  }
  .prh-shell{display:grid;gap:16px}.prh-toolbar{display:flex;align-items:end;justify-content:space-between;gap:14px;flex-wrap:wrap}.prh-toolbar label{display:grid;gap:6px;min-width:min(100%,420px);color:#776f68;font-size:12px;font-weight:800}.prh-filters{display:flex;gap:7px;flex-wrap:wrap}.prh-filters button{border:1px solid #e7ded4;border-radius:999px;background:#fffdfa;color:#766c63;padding:8px 11px;font-size:11px;font-weight:800;cursor:pointer}.prh-filters button.is-active{border-color:#168784;background:#168784;color:#fff}.prh-layout{display:grid;grid-template-columns:310px minmax(0,1fr);gap:15px}.prh-list{padding:8px;overflow:hidden}.prh-list-head{display:flex;justify-content:space-between;gap:8px;padding:12px 12px 14px;color:#564c45;font-size:13px}.prh-list-head span{color:#8b8178;font-size:11px}.prh-list-item{display:flex;width:100%;align-items:center;justify-content:space-between;gap:9px;border:0;border-radius:13px;background:transparent;padding:13px;text-align:left;color:#453c35;cursor:pointer}.prh-list-item:hover{background:#fbf6f0}.prh-list-item.is-active{background:#eaf7f4;box-shadow:inset 0 0 0 1px rgba(22,135,132,.16)}.prh-list-item b,.prh-list-item span,.prh-list-item small{display:block}.prh-list-item b{font-size:13px}.prh-list-item span{max-width:166px;margin-top:4px;overflow:hidden;color:#81776e;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.prh-list-item>div:last-child{text-align:right}.prh-list-item small{margin-top:5px;color:#81776e;font-size:11px}.prh-detail{min-height:660px;overflow:hidden}.prh-empty{display:grid;min-height:600px;place-items:center;padding:30px;color:#80756b;font-size:13px;text-align:center}.prh-detail-head{display:flex;justify-content:space-between;gap:16px;padding:22px 24px;border-bottom:1px solid #ece4da;background:linear-gradient(90deg,#fffaf5,#eff9f7)}.prh-detail-head h3{margin:5px 0 5px;color:#2f2925;font-size:19px}.prh-detail-head p{margin:0;color:#7e746b;font-size:12px}.prh-detail-head>div:last-child{text-align:right}.prh-detail-head small{display:block;margin-top:8px;color:#867b71;font-size:10px}.prh-status{display:inline-flex;border-radius:999px;padding:5px 8px;font-size:10px;font-style:normal;font-weight:850;white-space:nowrap}.prh-status.good{background:#e6f4f1;color:#11716e}.prh-status.issue{background:#fff0ed;color:#bd4b45}.prh-status.pending{background:#fff7df;color:#996e1a}.prh-detail-body{display:grid;gap:19px;padding:21px 24px 28px}.prh-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.prh-metrics>div{min-height:82px;padding:12px;border:1px solid #ebe3d9;border-radius:13px;background:#fffdfa}.prh-metrics span{display:block;color:#847970;font-size:10px;font-weight:800}.prh-metrics b{display:block;margin-top:8px;color:#352d28;font-size:15px}.prh-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:12px}.prh-detail h4{margin:0 0 8px;color:#5a4e45;font-size:12px}.prh-panel{padding:13px;border:1px solid #ebe3d9;border-radius:14px;background:#fffdfa}.prh-row{display:grid;grid-template-columns:70px 1fr auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px dashed #e7dfd6;font-size:12px}.prh-row:last-child{border-bottom:0}.prh-row span,.prh-row small{color:#83786e;font-size:10px;font-weight:700}.prh-row b{font-size:12px}.prh-equipment{display:flex;flex-wrap:wrap;gap:7px}.prh-equipment span{padding:7px 9px;border:1px solid #e8dfd5;border-radius:9px;background:#fffdfa;color:#584d45;font-size:11px;font-weight:750}.prh-issue{padding:13px 14px;border-radius:13px;background:#fff0ed;color:#763c37}.prh-issue b{display:block;font-size:11px}.prh-issue p{margin:4px 0 10px;font-size:12px;line-height:1.45}.prh-issue p:last-child{margin-bottom:0}.prh-feedback{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.prh-feedback>div{min-height:80px;padding:11px 12px;border:1px solid #ebe3d9;border-radius:12px;background:#fffdfa}.prh-feedback span{display:block;color:#887e75;font-size:10px;font-weight:850}.prh-feedback p{margin:6px 0 0;color:#5d524a;font-size:11px;line-height:1.45}@media(max-width:850px){.prh-layout{grid-template-columns:1fr}.prh-list{max-height:330px;overflow:auto}.prh-metrics{grid-template-columns:1fr 1fr}.prh-grid{grid-template-columns:1fr}.prh-feedback{grid-template-columns:1fr}.prh-detail{min-height:0}}@media(max-width:560px){.prh-detail-head,.prh-detail-body{padding-left:16px;padding-right:16px}.prh-detail-head{flex-direction:column}.prh-detail-head>div:last-child{text-align:left}.prh-metrics{grid-template-columns:1fr 1fr}.prh-toolbar label{min-width:100%}}
</style>
