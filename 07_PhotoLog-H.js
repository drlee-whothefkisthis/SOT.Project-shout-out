<style>
  :root {
    --pl-ink: #111827;
    --pl-muted: #667085;
    --pl-line: #dfe3e8;
    --pl-soft: #f5f7fa;
    --pl-paper: #ffffff;
    --pl-blue: #075a98;
    --pl-blue-dark: #034d83;
    --pl-green: #067647;
    --pl-red: #b42318;
    --pl-radius: 18px;
    --pl-shadow: 0 18px 50px rgba(16, 24, 40, 0.08);
  }

  * { box-sizing: border-box; }

  body.sot-photo-log-active {
    margin: 0;
    background: #eef2f6;
    color: var(--pl-ink);
  }

  #sot-photo-log-app {
    width: 100%;
    min-height: 100vh;
    padding: 48px 20px 80px;
    font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    line-height: 1.5;
  }

  #sot-photo-log-app button,
  #sot-photo-log-app input,
  #sot-photo-log-app select,
  #sot-photo-log-app textarea { font: inherit; }

  .pl-shell { width: min(920px, 100%); margin: 0 auto; }
  .pl-brand { margin: 0 0 28px; font-size: 15px; font-weight: 900; letter-spacing: .04em; }
  .pl-card { padding: clamp(22px, 5vw, 44px); border: 1px solid var(--pl-line); border-radius: var(--pl-radius); background: var(--pl-paper); box-shadow: var(--pl-shadow); }
  .pl-card + .pl-card { margin-top: 18px; }
  .pl-heading { margin: 0; font-size: clamp(28px, 5vw, 42px); line-height: 1.15; letter-spacing: -.035em; }
  .pl-copy { margin: 12px 0 0; color: var(--pl-muted); }
  .pl-kicker { margin: 0 0 8px; color: var(--pl-blue); font-size: 13px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  .pl-stack { display: grid; gap: 18px; margin-top: 30px; }
  .pl-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .pl-grid--4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .pl-grid--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .pl-span-2 { grid-column: span 2; }

  .pl-field { display: grid; align-content: start; gap: 7px; min-width: 0; }
  .pl-label { font-size: 14px; font-weight: 750; }
  .pl-help { color: var(--pl-muted); font-size: 12px; }
  .pl-input,
  .pl-select,
  .pl-textarea {
    width: 100%;
    min-height: 48px;
    padding: 11px 13px;
    border: 1px solid #c9d0d8;
    border-radius: 11px;
    outline: none;
    background: #fff;
    color: var(--pl-ink);
    transition: border-color .15s, box-shadow .15s;
  }
  .pl-textarea { min-height: 118px; resize: vertical; }
  .pl-input:focus,
  .pl-select:focus,
  .pl-textarea:focus { border-color: var(--pl-blue); box-shadow: 0 0 0 3px rgba(7, 90, 152, .12); }
  .pl-input[readonly] { background: #f0f3f6; color: #344054; cursor: default; }

  .pl-button {
    display: inline-flex;
    min-height: 48px;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 20px;
    border: 0;
    border-radius: 11px;
    background: var(--pl-blue);
    color: #fff;
    font-weight: 800;
    cursor: pointer;
  }
  .pl-button:hover { background: var(--pl-blue-dark); }
  .pl-button:disabled { opacity: .48; cursor: not-allowed; }
  .pl-button--wide { width: 100%; }
  .pl-button--small { min-height: 40px; padding: 8px 14px; font-size: 14px; }
  .pl-button--ghost { border: 1px solid var(--pl-line); background: #fff; color: var(--pl-ink); }
  .pl-button--ghost:hover { background: var(--pl-soft); }
  .pl-link { padding: 2px; border: 0; background: transparent; color: var(--pl-blue); text-decoration: underline; cursor: pointer; }

  .pl-alert { min-height: 22px; margin: 12px 0 0; color: var(--pl-red); font-size: 14px; }
  .pl-alert[data-kind="success"] { color: var(--pl-green); }
  .pl-busy { display: grid; min-height: 280px; place-items: center; color: var(--pl-muted); }

  .pl-toolbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
  .pl-event-list { display: grid; gap: 12px; margin-top: 28px; }
  .pl-event {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 16px;
    padding: 18px;
    border: 1px solid var(--pl-line);
    border-radius: 14px;
  }
  .pl-event__name { font-size: 18px; font-weight: 850; }
  .pl-event__meta { margin-top: 4px; color: var(--pl-muted); font-size: 14px; }
  .pl-event--clickable { cursor: pointer; transition: border-color .15s, box-shadow .15s, transform .15s; }
  .pl-event--clickable:hover,
  .pl-event--clickable:focus { border-color: rgba(7, 90, 152, .45); box-shadow: 0 8px 24px rgba(16, 24, 40, .08); outline: none; transform: translateY(-1px); }
  .pl-event__chevron { color: var(--pl-muted); font-size: 30px; line-height: 1; }
  .pl-status { display: inline-flex; align-items: center; padding: 7px 10px; border-radius: 999px; background: #ecfdf3; color: var(--pl-green); font-size: 13px; font-weight: 800; }

  .pl-context { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 24px 0 0; }
  .pl-context--event-detail { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .pl-context__item { padding: 13px 15px; border-radius: 12px; background: var(--pl-soft); }
  .pl-context__label { color: var(--pl-muted); font-size: 12px; }
  .pl-context__value { margin-top: 3px; font-weight: 800; overflow-wrap: anywhere; }
  .pl-detail-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 26px; }

  .pl-section { margin-top: 20px; padding: clamp(20px, 4vw, 32px); border: 1px solid var(--pl-line); border-radius: var(--pl-radius); background: #fff; }
  .pl-section__head { margin-bottom: 22px; }
  .pl-section__title { margin: 0; font-size: 22px; letter-spacing: -.02em; }
  .pl-section__copy { margin: 5px 0 0; color: var(--pl-muted); font-size: 14px; }
  .pl-subtitle { margin: 28px 0 12px; font-size: 16px; }
  .pl-equipment-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
  .pl-disclosure { margin-top: 24px; padding: 16px 18px; border: 1px solid var(--pl-line); border-radius: 14px; background: var(--pl-soft); }
  .pl-disclosure summary { cursor: pointer; font-weight: 850; }
  .pl-disclosure summary span { display: grid; gap: 3px; }
  .pl-disclosure summary small { color: var(--pl-muted); font-size: 13px; font-weight: 500; }
  .pl-disclosure__body { margin-top: 18px; }

  .pl-checks { display: flex; flex-wrap: wrap; gap: 10px; }
  .pl-check { display: inline-flex; align-items: center; gap: 7px; padding: 9px 12px; border: 1px solid var(--pl-line); border-radius: 10px; background: #fff; }
  .pl-check input { width: 17px; height: 17px; accent-color: var(--pl-blue); }

  .pl-repeat { display: grid; gap: 10px; }
  .pl-repeat__row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(100px, .45fr) auto; align-items: end; gap: 10px; }
  .pl-repeat__row--equipment { grid-template-columns: minmax(110px, .5fr) minmax(100px, .5fr) auto; }
  .pl-repeat__row--choice { grid-template-columns: minmax(0, 1fr) minmax(90px, .55fr) minmax(0, 1fr) auto; }
  .pl-remove { width: 42px; min-height: 48px; padding: 0; border: 1px solid var(--pl-line); border-radius: 10px; background: #fff; color: var(--pl-red); font-weight: 900; cursor: pointer; }
  .pl-add { margin-top: 10px; }
  .pl-divider { height: 1px; margin: 28px 0; border: 0; background: var(--pl-line); }
  .pl-actions { position: sticky; bottom: 12px; display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; padding: 13px; border: 1px solid var(--pl-line); border-radius: 14px; background: rgba(255,255,255,.94); box-shadow: var(--pl-shadow); backdrop-filter: blur(12px); }
  .pl-submit-note { margin-right: auto; align-self: center; color: var(--pl-muted); font-size: 13px; }

  [data-pl-hidden] { display: none !important; }

  @media (max-width: 760px) {
    #sot-photo-log-app { padding: 24px 12px 64px; }
    .pl-card { padding: 24px 18px; }
    .pl-grid,
    .pl-grid--3,
    .pl-grid--4,
    .pl-context,
    .pl-equipment-columns { grid-template-columns: 1fr; }
    .pl-span-2 { grid-column: auto; }
    .pl-toolbar { display: grid; }
    .pl-event { grid-template-columns: 1fr; }
    .pl-event .pl-button { width: 100%; }
    .pl-repeat__row,
    .pl-repeat__row--equipment,
    .pl-repeat__row--choice { grid-template-columns: 1fr; }
    .pl-remove { width: 100%; }
    .pl-actions { position: static; display: grid; grid-template-columns: 1fr; }
    .pl-submit-note { margin: 0; }
  }
</style>
