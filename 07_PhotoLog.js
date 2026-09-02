(() => {
  "use strict";

  const CONFIG = Object.freeze({
    apiBase: "https://photographer-report-api-a6mwhgji4q-du.a.run.app",
    tokenKey: "sot_photographer_access_v2",
    draftPrefix: "sot_photographer_report_draft_v1",
    requestTimeoutMs: 25000,
  });

  const CAMERA_CODES = ["AM", "AP", "BM", "BP", "CM", "DM"];
  const LENS_CODES = [
    ["50_300", "50-300"],
    ["70_180", "70-180"],
    ["24_70", "24-70"],
  ];
  const EQUIPMENT_CODES = ["A", "B", "C", "D"];
  const state = {
    token: sessionStorage.getItem(CONFIG.tokenKey) || "",
    photographer: null,
    events: [],
    selectedEvent: null,
    requestId: null,
  };
  let draftTimer = null;

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character]);

  const uuid = () => {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (token) => {
      const random = Math.random() * 16 | 0;
      const value = token === "x" ? random : (random & 3 | 8);
      return value.toString(16);
    });
  };

  function ensureRoot() {
    let root = document.getElementById("sot-photo-log-app");
    if (!root) {
      root = document.createElement("main");
      root.id = "sot-photo-log-app";
      root.setAttribute("aria-live", "polite");
      document.body.appendChild(root);
    }
    document.body.classList.add("sot-photo-log-active");
    return root;
  }

  const root = ensureRoot();

  async function api(path, options = {}) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    if (options.body) headers.set("Content-Type", "application/json");
    if (state.token) headers.set("Authorization", `Bearer ${state.token}`);

    try {
      const response = await fetch(`${CONFIG.apiBase}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload?.error?.message || "요청을 처리하지 못했습니다.");
        error.code = payload?.error?.code || "REQUEST_FAILED";
        error.status = response.status;
        error.details = payload?.error?.details || [];
        throw error;
      }
      return payload.data ?? payload;
    } catch (error) {
      if (error.name === "AbortError") {
        const timeoutError = new Error("요청 시간이 초과되었습니다.");
        timeoutError.code = "REQUEST_TIMEOUT";
        throw timeoutError;
      }
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function genericError(error, fallback) {
    if (error?.code === "REQUEST_TIMEOUT") return "응답이 늦어지고 있습니다. 잠시 후 다시 시도해 주세요.";
    return fallback;
  }

  function formatEventDate(value) {
    const matched = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
    if (!matched) return "날짜 미정";
    return `${Number(matched[1])}년 ${Number(matched[2])}월 ${Number(matched[3])}일`;
  }

  function formatEventListDate(value) {
    const matched = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
    if (!matched) return "날짜 미정";
    const weekday = ["일", "월", "화", "수", "목", "금", "토"][
      new Date(Date.UTC(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]))).getUTCDay()
    ];
    return `${Number(matched[2])}월 ${Number(matched[3])}일 (${weekday})`;
  }

  function kstTodaySerial() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day));
  }

  function showEventInList(value) {
    const matched = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ""));
    if (!matched) return true;
    const eventSerial = Date.UTC(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
    return eventSerial >= kstTodaySerial() - 3 * 24 * 60 * 60 * 1000;
  }

  function eventMonthLabel(value) {
    const matched = /^\d{4}-(\d{2})-\d{2}/.exec(String(value || ""));
    return matched ? `${Number(matched[1])}월` : "일정 미정";
  }

  function formatEventListName(value) {
    return String(value || "").replace(/^2026(?:년)?\s*/, "").trim();
  }

  function formatEventDetailName(value) {
    const name = String(value || "").trim();
    const edition = /^(\d{4}(?:년)?\s+제\d+회)\s+(.+)$/.exec(name);
    return edition
      ? `<span class="pl-heading__line">${escapeHtml(edition[1])}</span><span class="pl-heading__line">${escapeHtml(edition[2])}</span>`
      : escapeHtml(name);
  }

  function formatGatheringTime(value) {
    const eventTime = new Date(String(value || ""));
    if (Number.isNaN(eventTime.getTime()) || !String(value || "").includes("T")) return "시간 미정";
    const gatheringTime = new Date(eventTime.getTime() - 60 * 60 * 1000);
    return new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(gatheringTime);
  }

  function eventDateValue(value) {
    const matched = /^(\d{4}-\d{2}-\d{2})/.exec(String(value || ""));
    return matched ? matched[1] : "";
  }

  function safeExternalUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (_error) {
      return "";
    }
  }

  function reportOpen(item) {
    return item.report_open === true || item.published === true;
  }

  function reportStatusText(item) {
    if (item.submitted) return "제출 완료";
    if (reportOpen(item)) return "작성 가능";
    return "대회 당일 00:00부터 작성 가능";
  }

  function draftKey() {
    const photographer = String(state.photographer?.name || "").trim();
    const eventCode = String(state.selectedEvent?.event_code || "").trim();
    return `${CONFIG.draftPrefix}:${encodeURIComponent(photographer)}:${encodeURIComponent(eventCode)}`;
  }

  function readDraft() {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey()) || "null");
      if (!draft || draft.version !== 1 || Date.now() - Number(draft.saved_at || 0) > 604800000) return null;
      return draft;
    } catch (_error) {
      return null;
    }
  }

  function removeDraft() {
    try { localStorage.removeItem(draftKey()); } catch (_error) {}
  }

  function clearSession() {
    state.token = "";
    state.photographer = null;
    state.events = [];
    state.selectedEvent = null;
    state.requestId = null;
    sessionStorage.removeItem(CONFIG.tokenKey);
  }

  function loading(message = "불러오는 중입니다…") {
    root.innerHTML = `<div class="pl-shell"><div class="pl-brand">SHOUT-OUT</div><div class="pl-card pl-busy">${escapeHtml(message)}</div></div>`;
  }

  function renderLogin(message = "") {
    const loginMessage = typeof message === "string" ? message : "";
    clearSession();
    root.innerHTML = `
      <div class="pl-shell">
        <div class="pl-brand">SHOUT-OUT</div>
        <section class="pl-card">
          <p class="pl-kicker">Photographer Log</p>
          <h1 class="pl-heading">포토그래퍼 일지</h1>
          <p class="pl-copy">이름과 비밀번호를 입력해 주세요.</p>
          <form class="pl-stack" data-pl-login novalidate>
            <label class="pl-field">
              <span class="pl-label">이름</span>
              <input class="pl-input" name="name" autocomplete="name" maxlength="50" required>
            </label>
            <label class="pl-field">
              <span class="pl-label">비밀번호</span>
              <input class="pl-input" name="phone_last4" type="text" inputmode="numeric" autocomplete="one-time-code" minlength="4" maxlength="4" pattern="[0-9]{4}" required>
            </label>
            <button class="pl-button pl-button--wide" type="submit">배정 대회 확인</button>
          </form>
          <p class="pl-alert" data-pl-login-message aria-live="assertive">${escapeHtml(loginMessage)}</p>
        </section>
      </div>`;

    const form = root.querySelector("[data-pl-login]");
    const last4 = form.elements.phone_last4;
    last4.addEventListener("input", () => { last4.value = last4.value.replace(/\D/g, "").slice(0, 4); });
    form.addEventListener("submit", submitLogin);
    form.elements.name.focus();
  }

  async function submitLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type='submit']");
    const message = root.querySelector("[data-pl-login-message]");
    if (!form.reportValidity()) return;

    button.disabled = true;
    button.textContent = "확인 중…";
    message.textContent = "";
    try {
      const data = await api("/api/v1/photographer-access/login", {
        method: "POST",
        body: JSON.stringify({
          name: form.elements.name.value.trim(),
          phone_last4: form.elements.phone_last4.value,
        }),
      });
      state.token = data.access_token;
      state.photographer = data.photographer;
      sessionStorage.setItem(CONFIG.tokenKey, state.token);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      await loadEvents();
    } catch (error) {
      message.textContent = error.code === "IDENTITY_NOT_VERIFIED"
        ? "입력한 정보와 등록 정보가 일치하지 않습니다."
        : genericError(error, "확인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      button.disabled = false;
      button.textContent = "배정 대회 확인";
    }
  }

  async function loadEvents() {
    loading("배정 대회를 확인하고 있습니다…");
    try {
      const data = await api("/api/v1/photographer-access/events");
      state.photographer = data.photographer;
      state.events = Array.isArray(data.events) ? data.events : [];
      state.selectedEvent = null;
      renderEvents();
    } catch (error) {
      if (error.status === 401 || error.code === "ACCESS_TOKEN_INVALID") {
        renderLogin("인증 시간이 만료되었습니다. 다시 확인해 주세요.");
        return;
      }
      renderEvents(genericError(error, "배정 대회를 불러오지 못했습니다. 다시 시도해 주세요."));
    }
  }

  function renderEvents(loadError = "") {
    const errorMessage = typeof loadError === "string" ? loadError : "";
    const visibleEvents = state.events.filter((item) => showEventInList(item.event_date));
    const eventRows = visibleEvents.length
      ? (() => {
          const groups = new Map();
          visibleEvents.forEach((item) => {
            const month = eventMonthLabel(item.event_date);
            if (!groups.has(month)) groups.set(month, []);
            groups.get(month).push(item);
          });
          return Array.from(groups.entries()).map(([month, items]) => `
            <section class="pl-event-group">
              <h2 class="pl-event-group__title">${escapeHtml(month)}</h2>
              <div class="pl-event-group__list">
                ${items.map((item) => `
                  <article class="pl-event pl-event--clickable" role="button" tabindex="0" data-pl-view-event="${escapeHtml(item.event_code)}">
                    <div class="pl-event__name">${escapeHtml(formatEventListName(item.event_name || item.event_code))}</div>
                    <div class="pl-event__meta">${escapeHtml(formatEventListDate(item.event_date))}</div>
                  </article>`).join("")}
              </div>
            </section>`).join("");
        })()
      : '<div class="pl-event"><div><div class="pl-event__name">배정된 확정 대회가 없습니다.</div><div class="pl-event__meta">관리자에게 배정 상태를 확인해 주세요.</div></div></div>';

    root.innerHTML = `
      <div class="pl-shell">
        <div class="pl-page-header">
          <div class="pl-brand">SHOUT-OUT</div>
          <button class="pl-link pl-logout" type="button" data-pl-logout>LOGOUT</button>
        </div>
        <section class="pl-card">
          <div class="pl-toolbar">
            <div>
              <p class="pl-kicker">Assigned Events</p>
              <h1 class="pl-heading">${escapeHtml(state.photographer?.name)}님의 대회</h1>
            </div>
          </div>
          ${errorMessage ? `<p class="pl-alert" aria-live="assertive">${escapeHtml(errorMessage)}</p>` : ""}
          <div class="pl-event-list">${eventRows}</div>
        </section>
      </div>`;

    root.querySelector("[data-pl-logout]").addEventListener("click", () => renderLogin());
    root.querySelectorAll("[data-pl-view-event]").forEach((card) => {
      const open = () => loadEventDetail(card.dataset.plViewEvent);
      card.addEventListener("click", open);
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    });
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  async function loadEventDetail(eventCode) {
    loading("대회 정보를 확인하고 있습니다…");
    try {
      const data = await api(`/api/v1/photographer-access/events/${encodeURIComponent(eventCode)}`);
      const event = data?.event;
      if (!event) throw new Error("대회 정보를 찾을 수 없습니다.");
      state.selectedEvent = event;
      renderEventDetail(event);
    } catch (error) {
      if (error.status === 401 || error.code === "ACCESS_TOKEN_INVALID") {
        renderLogin("인증 시간이 만료되었습니다. 다시 확인해 주세요.");
        return;
      }
      renderEvents(genericError(error, "대회 정보를 불러오지 못했습니다. 다시 시도해 주세요."));
    }
  }

  function renderEventDetail(event) {
    const mapUrl = safeExternalUrl(event.map_url);
    const courseMapUrl = safeExternalUrl(event.course_map_url);
    const canWrite = !event.submitted && reportOpen(event);
    root.innerHTML = `
      <div class="pl-shell">
        <div class="pl-brand">SHOUT-OUT</div>
        <section class="pl-card">
          <button class="pl-link" type="button" data-pl-back>← 대회 목록</button>
          <p class="pl-kicker" style="margin-top:24px">Event Detail</p>
          <h1 class="pl-heading pl-heading--event">${formatEventDetailName(event.event_name || event.event_code)}</h1>
          <div class="pl-context pl-context--event-detail">
            <div class="pl-context__item"><div class="pl-context__label">포토그래퍼</div><div class="pl-context__value">${escapeHtml(state.photographer.name)}</div></div>
            <div class="pl-context__item"><div class="pl-context__label">장소</div><div class="pl-context__value">${escapeHtml(event.location || "장소 미정")}</div></div>
            <div class="pl-context__item"><div class="pl-context__label">대회일</div><div class="pl-context__value">${escapeHtml(formatEventDate(event.event_date))}</div></div>
            <div class="pl-context__item"><div class="pl-context__label">집결 시각</div><div class="pl-context__value">${escapeHtml(formatGatheringTime(event.event_date))}</div></div>
          </div>
          <div class="pl-detail-actions">
            ${mapUrl
              ? `<a class="pl-button pl-button--ghost" href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer">촬영 스팟</a>`
              : ""}
            ${courseMapUrl
              ? `<a class="pl-button pl-button--ghost" href="${escapeHtml(courseMapUrl)}" target="_blank" rel="noopener noreferrer">코스 지도</a>`
              : ""}
            ${!mapUrl && !courseMapUrl
              ? '<span class="pl-help">등록된 대회 지도가 없습니다.</span>'
              : ""}
            ${event.submitted
              ? '<span class="pl-status">제출 완료</span>'
              : canWrite
                ? '<button class="pl-button" type="button" data-pl-start-report>일지 작성</button>'
                : '<button class="pl-button" type="button" data-pl-locked-report>일지 작성</button>'}
          </div>
          <p class="pl-alert" data-pl-detail-message aria-live="polite"></p>
        </section>
      </div>`;
    root.querySelector("[data-pl-back]").addEventListener("click", () => renderEvents());
    const start = root.querySelector("[data-pl-start-report]");
    if (start) start.addEventListener("click", () => renderReport(event));
    const locked = root.querySelector("[data-pl-locked-report]");
    if (locked) locked.addEventListener("click", () => {
      root.querySelector("[data-pl-detail-message]").textContent = "대회 당일 작성이 가능합니다";
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const timeField = (name, label) => `
    <label class="pl-field"><span class="pl-label">${label}</span><input class="pl-input" type="time" name="${name}" required></label>`;

  const equipmentRows = [
    ["camera_battery", "카메라 배터리"],
    ["power_bank", "보조배터리"],
    ["router", "라우터"],
    ["accessory_bag", "잡화가방"],
    ["cooler", "쿨러"],
  ];

  function renderReport(event) {
    state.selectedEvent = event;
    state.requestId = uuid();
    root.innerHTML = `
      <div class="pl-shell">
        <div class="pl-brand">SHOUT-OUT</div>
        <section class="pl-card">
          <button class="pl-link" type="button" data-pl-back>← 대회 목록</button>
          <p class="pl-kicker" style="margin-top:24px">Event Report</p>
          <h1 class="pl-heading">포토그래퍼 일지 작성</h1>
          <div class="pl-context">
            <div class="pl-context__item"><div class="pl-context__label">작성자</div><div class="pl-context__value">${escapeHtml(state.photographer.name)}</div></div>
            <div class="pl-context__item"><div class="pl-context__label">대회</div><div class="pl-context__value">${escapeHtml(event.event_name || event.event_code)}</div></div>
            <div class="pl-context__item"><div class="pl-context__label">촬영일</div><div class="pl-context__value">${escapeHtml(formatEventDate(event.event_date))}</div></div>
          </div>
        </section>

        <form data-pl-report novalidate>
          <section class="pl-section">
            <div class="pl-section__head"><h2 class="pl-section__title">1. 촬영 정보</h2><p class="pl-section__copy">실제 촬영 위치와 시간을 기록해 주세요.</p></div>
            <div class="pl-grid">
              <label class="pl-field"><span class="pl-label">담당 역할</span><input class="pl-input" name="role" placeholder="예: 메인 구간 촬영" required></label>
              <label class="pl-field"><span class="pl-label">실제 촬영 위치</span><input class="pl-input" name="actual_location_name" placeholder="예: 10km 반환점" required></label>
            </div>
            <label class="pl-field" style="margin-top:16px"><span class="pl-label">촬영 위치까지 이동 거리(km)</span><input class="pl-input" type="number" name="actual_location_distance" min="0" step="0.1" placeholder="선택 입력"></label>
            <h3 class="pl-subtitle">추가 이동 촬영 지점</h3>
            <div class="pl-repeat" data-pl-list="move_spots"></div>
            <button class="pl-button pl-button--ghost pl-button--small pl-add" type="button" data-pl-add="move_spots">+ 이동 지점 추가</button>
            <hr class="pl-divider">
            <div class="pl-grid pl-grid--4">
              ${timeField("arrival_time", "현장 도착")}
              ${timeField("start_time", "촬영 시작")}
              ${timeField("end_time", "촬영 종료")}
              ${timeField("leaving_time", "현장 출발")}
            </div>
            <div class="pl-grid" style="margin-top:18px">
              <label class="pl-field"><span class="pl-label">촬영 결과</span><select class="pl-select" name="result" required><option value="">선택</option><option value="complete">완료</option><option value="partial">부분 완료</option><option value="stopped">중단</option></select></label>
              <label class="pl-field"><span class="pl-label">부분 완료·중단 사유</span><input class="pl-input" name="result_reason" placeholder="완료한 경우 비워 두세요"></label>
              <label class="pl-field pl-span-2"><span class="pl-label">촬영 메모</span><textarea class="pl-textarea" name="shooting_memo" placeholder="현장 특이사항을 입력해 주세요."></textarea></label>
            </div>
          </section>

          <section class="pl-section">
            <div class="pl-section__head"><h2 class="pl-section__title">2. 바디별 촬영 장수</h2><p class="pl-section__copy">사용한 카메라 바디를 장비 영역에서 선택하면 자동으로 연결됩니다.</p></div>
            <div class="pl-repeat" data-pl-list="photo_counts"></div>
          </section>

          <section class="pl-section">
            <div class="pl-section__head"><h2 class="pl-section__title">3. 업로드 상태</h2><p class="pl-section__copy">사진 업로드 진행 상태와 네트워크 상황을 기록해 주세요.</p></div>
            <div class="pl-grid">
              <label class="pl-field"><span class="pl-label">업로드 상태</span><select class="pl-select" name="upload_status" required><option value="">선택</option><option value="complete">완료</option><option value="pending">진행 중</option><option value="not_started">미시작</option><option value="failed">실패</option></select></label>
              <label class="pl-field"><span class="pl-label">진행 번호</span><input class="pl-input" type="number" name="upload_progress" min="0" step="1" placeholder="진행 중일 때 필수"></label>
              <label class="pl-field"><span class="pl-label">네트워크 상태</span><select class="pl-select" name="network_status" required><option value="">선택</option><option value="good">좋음</option><option value="normal">보통</option><option value="unstable">불안정</option><option value="unavailable">사용 불가</option></select></label>
              <label class="pl-field"><span class="pl-label">네트워크 메모</span><input class="pl-input" name="network_note" placeholder="선택 입력"></label>
            </div>
          </section>

          <section class="pl-section">
            <div class="pl-section__head"><h2 class="pl-section__title">4. 사용 장비</h2><p class="pl-section__copy">실제로 사용하거나 지급받은 장비를 기록해 주세요.</p></div>
            <div class="pl-equipment-columns">
              <div>
                <h3 class="pl-subtitle" style="margin-top:0">카메라 바디</h3>
                <div class="pl-repeat" data-pl-list="camera_bodies"></div>
                <button class="pl-button pl-button--ghost pl-button--small pl-add" type="button" data-pl-add="camera_bodies">+ 카메라 추가</button>
              </div>
              <div>
                <h3 class="pl-subtitle" style="margin-top:0">렌즈</h3>
                <div class="pl-repeat" data-pl-list="lenses"></div>
                <button class="pl-button pl-button--ghost pl-button--small pl-add" type="button" data-pl-add="lenses">+ 렌즈 추가</button>
              </div>
            </div>

            <h3 class="pl-subtitle">지급품</h3>
            <div class="pl-grid">
              <label class="pl-field"><span class="pl-label">지급 가방</span><select class="pl-select" name="issued_bag" required><option value="none">없음</option>${EQUIPMENT_CODES.map((code) => `<option value="${code}">${code}</option>`).join("")}</select></label>
              <label class="pl-field"><span class="pl-label">메모리카드 수량</span><input class="pl-input" type="number" name="sd_count" value="1" min="0" step="1" required></label>
            </div>
            <details class="pl-disclosure" data-pl-components>
              <summary>구성품 확인</summary>
              <div class="pl-disclosure__body">
                ${equipmentRows.map(([key, label]) => `
                  <h3 class="pl-subtitle">${label}</h3>
                  <div class="pl-repeat" data-pl-list="${key}"></div>
                  <button class="pl-button pl-button--ghost pl-button--small pl-add" type="button" data-pl-add="${key}">+ ${label} 추가</button>`).join("")}
              </div>
            </details>

            <h3 class="pl-subtitle">장비 이상</h3>
            <div class="pl-grid">
              <label class="pl-field"><span class="pl-label">상태</span><select class="pl-select" name="issue_status" required><option value="none">이상 없음</option><option value="inspection">점검 필요</option><option value="lost_or_damaged">분실·파손</option></select></label>
              <label class="pl-field"><span class="pl-label">상세 내용</span><input class="pl-input" name="issue_detail" placeholder="이상이 있을 때 입력"></label>
            </div>
          </section>

          <section class="pl-section">
            <details class="pl-disclosure" data-pl-feedback>
              <summary><span><b>5. 현장 피드백</b><small>운영 개선에 필요한 내용이 있을 때 작성해 주세요.</small></span></summary>
              <div class="pl-disclosure__body pl-grid">
                <label class="pl-field"><span class="pl-label">현장 메모</span><textarea class="pl-textarea" name="field_note"></textarea></label>
                <label class="pl-field"><span class="pl-label">문제점</span><textarea class="pl-textarea" name="problem"></textarea></label>
                <label class="pl-field"><span class="pl-label">개선 의견</span><textarea class="pl-textarea" name="improvement"></textarea></label>
                <label class="pl-field"><span class="pl-label">관리자 요청사항</span><textarea class="pl-textarea" name="manager_request"></textarea></label>
              </div>
            </details>
          </section>

          <div class="pl-actions">
            <span class="pl-submit-note" data-pl-submit-message aria-live="assertive">입력 내용은 이 브라우저에 임시 저장됩니다.</span>
            <button class="pl-button pl-button--ghost" type="button" data-pl-back>목록으로</button>
            <button class="pl-button" type="submit">일지 제출</button>
          </div>
        </form>
      </div>`;

    bindReport();
    if (!restoreDraft()) {
      addRepeatRow("camera_bodies", { code: "", name: "" });
      addRepeatRow("lenses", { code: "", count: 1, name: "" });
      syncPhotoCountRows();
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function repeatRowHtml(type, values = {}) {
    if (type === "move_spots") {
      return `<div class="pl-repeat__row" data-pl-row>
        <label class="pl-field"><span class="pl-label">지점명</span><input class="pl-input" data-key="name" value="${escapeHtml(values.name || "")}" required></label>
        <label class="pl-field"><span class="pl-label">거리(km)</span><input class="pl-input" data-key="distance_km" type="number" min="0" step="0.1" value="${escapeHtml(values.distance_km ?? "")}"></label>
        <button class="pl-remove" type="button" aria-label="삭제" data-pl-remove>×</button>
      </div>`;
    }
    if (type === "photo_counts") {
      return `<div class="pl-repeat__row" data-pl-row>
        <label class="pl-field"><span class="pl-label">바디</span><input class="pl-input" data-key="camera_body" value="${escapeHtml(values.camera_body || "")}" readonly></label>
        <label class="pl-field"><span class="pl-label">촬영 장수</span><input class="pl-input" data-key="count" type="number" min="0" step="1" value="${escapeHtml(values.count ?? 0)}" required></label>
      </div>`;
    }
    if (type === "camera_bodies") {
      const personal = values.code === "personal";
      return `<div class="pl-repeat__row pl-repeat__row--choice" data-pl-row>
        <label class="pl-field"><span class="pl-label">카메라</span><select class="pl-select" data-key="code" data-pl-equipment-choice required><option value="">선택</option>${CAMERA_CODES.map((code) => `<option value="${code}" ${code === values.code ? "selected" : ""}>${code}</option>`).join("")}<option value="personal" ${personal ? "selected" : ""}>개인 카메라</option></select></label>
        <label class="pl-field" data-pl-personal-field ${personal ? "" : "data-pl-hidden"}><span class="pl-label">개인 카메라명</span><input class="pl-input" data-key="name" value="${escapeHtml(values.name || "")}" ${personal ? "required" : ""}></label>
        <button class="pl-remove" type="button" aria-label="카메라 삭제" data-pl-remove>×</button>
      </div>`;
    }
    if (type === "lenses") {
      const personal = values.code === "personal";
      return `<div class="pl-repeat__row pl-repeat__row--choice" data-pl-row>
        <label class="pl-field"><span class="pl-label">렌즈</span><select class="pl-select" data-key="code" data-pl-equipment-choice required><option value="">선택</option>${LENS_CODES.map(([code, label]) => `<option value="${code}" ${code === values.code ? "selected" : ""}>${label}</option>`).join("")}<option value="personal" ${personal ? "selected" : ""}>개인 렌즈</option></select></label>
        <label class="pl-field" data-pl-standard-field ${personal ? "data-pl-hidden" : ""}><span class="pl-label">수량</span><input class="pl-input" data-key="count" type="number" min="1" step="1" value="${escapeHtml(values.count ?? 1)}" ${personal ? "" : "required"}></label>
        <label class="pl-field" data-pl-personal-field ${personal ? "" : "data-pl-hidden"}><span class="pl-label">개인 렌즈명</span><input class="pl-input" data-key="name" value="${escapeHtml(values.name || "")}" ${personal ? "required" : ""}></label>
        <button class="pl-remove" type="button" aria-label="렌즈 삭제" data-pl-remove>×</button>
      </div>`;
    }
    return `<div class="pl-repeat__row pl-repeat__row--equipment" data-pl-row>
      <label class="pl-field"><span class="pl-label">코드</span><select class="pl-select" data-key="code" required>${EQUIPMENT_CODES.map((code) => `<option value="${code}" ${code === values.code ? "selected" : ""}>${code}</option>`).join("")}</select></label>
      <label class="pl-field"><span class="pl-label">수량</span><input class="pl-input" data-key="count" type="number" min="1" step="1" value="${escapeHtml(values.count ?? 1)}" required></label>
      <button class="pl-remove" type="button" aria-label="삭제" data-pl-remove>×</button>
    </div>`;
  }

  function addRepeatRow(type, values = {}) {
    const list = root.querySelector(`[data-pl-list="${type}"]`);
    if (!list) return;
    list.insertAdjacentHTML("beforeend", repeatRowHtml(type, values));
    const row = list.lastElementChild;
    const removeButton = row.querySelector("[data-pl-remove]");
    if (removeButton) removeButton.addEventListener("click", () => {
      row.remove();
      if (type === "camera_bodies") syncPhotoCountRows();
      scheduleDraft();
    });
    const choice = row.querySelector("[data-pl-equipment-choice]");
    if (choice) choice.addEventListener("change", () => {
      togglePersonalFields(row, choice.value === "personal");
      if (type === "camera_bodies") syncPhotoCountRows();
      scheduleDraft();
    });
    row.querySelectorAll("input, select, textarea").forEach((field) => {
      field.addEventListener("input", scheduleDraft);
      field.addEventListener("change", scheduleDraft);
    });
  }

  function togglePersonalFields(row, personal) {
    const personalField = row.querySelector("[data-pl-personal-field]");
    const personalInput = personalField?.querySelector("input");
    const standardField = row.querySelector("[data-pl-standard-field]");
    const standardInput = standardField?.querySelector("input");
    if (personalField) personalField.toggleAttribute("data-pl-hidden", !personal);
    if (personalInput) {
      personalInput.required = personal;
      if (!personal) personalInput.value = "";
    }
    if (standardField) standardField.toggleAttribute("data-pl-hidden", personal);
    if (standardInput) standardInput.required = !personal;
  }

  function syncPhotoCountRows(savedCounts = null) {
    const previous = new Map((savedCounts || rows("photo_counts")).map((row) => [row.camera_body, row.count]));
    const bodies = [...new Set(rows("camera_bodies")
      .map((row) => row.code)
      .filter((code) => CAMERA_CODES.includes(code)))];
    const list = root.querySelector('[data-pl-list="photo_counts"]');
    if (!list) return;
    list.innerHTML = "";
    bodies.forEach((cameraBody) => addRepeatRow("photo_counts", {
      camera_body: cameraBody,
      count: previous.has(cameraBody) ? previous.get(cameraBody) : 0,
    }));
  }

  function listSnapshot(type) {
    return rows(type).map((row) => Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, String(value ?? "")])
    ));
  }

  function saveDraft() {
    const form = root.querySelector("[data-pl-report]");
    if (!form || !state.selectedEvent) return;
    const fields = {};
    [...form.elements].forEach((field) => {
      if (field.name && !["submit", "button"].includes(field.type)) fields[field.name] = field.value;
    });
    const lists = Object.fromEntries([
      "move_spots", "photo_counts", "camera_bodies", "lenses",
      ...equipmentRows.map(([key]) => key),
    ].map((type) => [type, listSnapshot(type)]));
    try {
      localStorage.setItem(draftKey(), JSON.stringify({
        version: 1,
        saved_at: Date.now(),
        request_id: state.requestId,
        fields,
        lists,
        components_open: Boolean(root.querySelector("[data-pl-components]")?.open),
        feedback_open: Boolean(root.querySelector("[data-pl-feedback]")?.open),
      }));
      const message = root.querySelector("[data-pl-submit-message]");
      if (message && !message.dataset.kind) {
        message.textContent = "입력 내용이 임시 저장되었습니다.";
        message.style.color = "";
      }
    } catch (_error) {}
  }

  function scheduleDraft() {
    window.clearTimeout(draftTimer);
    draftTimer = window.setTimeout(saveDraft, 250);
  }

  function restoreDraft() {
    const draft = readDraft();
    const form = root.querySelector("[data-pl-report]");
    if (!draft || !form) return false;
    state.requestId = draft.request_id || uuid();
    Object.entries(draft.fields || {}).forEach(([name, value]) => {
      const field = form.elements.namedItem(name);
      if (field && typeof field.value !== "undefined") field.value = value;
    });
    const listTypes = ["move_spots", "photo_counts", "camera_bodies", "lenses", ...equipmentRows.map(([key]) => key)];
    listTypes.forEach((type) => {
      const list = root.querySelector(`[data-pl-list="${type}"]`);
      if (list) list.innerHTML = "";
    });
    const lists = draft.lists || {};
    (lists.camera_bodies || []).forEach((row) => addRepeatRow("camera_bodies", row));
    (lists.lenses || []).forEach((row) => addRepeatRow("lenses", row));
    (lists.move_spots || []).forEach((row) => addRepeatRow("move_spots", row));
    equipmentRows.forEach(([type]) => (lists[type] || []).forEach((row) => addRepeatRow(type, row)));
    if (!(lists.camera_bodies || []).length) addRepeatRow("camera_bodies", { code: "", name: "" });
    if (!(lists.lenses || []).length) addRepeatRow("lenses", { code: "", count: 1, name: "" });
    syncPhotoCountRows(lists.photo_counts || []);
    const components = root.querySelector("[data-pl-components]");
    const feedback = root.querySelector("[data-pl-feedback]");
    if (components) components.open = Boolean(draft.components_open);
    if (feedback) feedback.open = Boolean(draft.feedback_open);
    return true;
  }

  function applyIssuedBag() {
    const form = root.querySelector("[data-pl-report]");
    const bag = form?.elements.issued_bag.value;
    if (!EQUIPMENT_CODES.includes(bag)) {
      if (bag === "none") equipmentRows.forEach(([type]) => {
        const list = root.querySelector(`[data-pl-list="${type}"]`);
        if (list) list.innerHTML = "";
      });
      scheduleDraft();
      return;
    }
    if (integer(form.elements.sd_count.value) < 1) form.elements.sd_count.value = "1";
    equipmentRows.forEach(([type]) => {
      const list = root.querySelector(`[data-pl-list="${type}"]`);
      if (!list) return;
      if (!list.children.length) addRepeatRow(type, { code: bag, count: 1 });
      else {
        const firstCode = list.firstElementChild.querySelector('[data-key="code"]');
        if (firstCode) firstCode.value = bag;
      }
    });
    const details = root.querySelector("[data-pl-components]");
    if (details) details.open = true;
    scheduleDraft();
  }

  function bindReport() {
    root.querySelectorAll("[data-pl-back]").forEach((button) => button.addEventListener("click", loadEvents));
    root.querySelectorAll("[data-pl-add]").forEach((button) => button.addEventListener("click", () => {
      addRepeatRow(button.dataset.plAdd);
      scheduleDraft();
    }));
    const form = root.querySelector("[data-pl-report]");
    form.elements.issued_bag.addEventListener("change", applyIssuedBag);
    form.addEventListener("input", scheduleDraft);
    form.addEventListener("change", scheduleDraft);
    form.addEventListener("submit", submitReport);
  }

  function rows(type) {
    return [...root.querySelectorAll(`[data-pl-list="${type}"] [data-pl-row]`)].map((row) => Object.fromEntries(
      [...row.querySelectorAll("[data-key]")].map((field) => [field.dataset.key, field.value])
    ));
  }

  const numberOrNull = (value) => value === "" ? null : Number(value);
  const integer = (value) => Number.parseInt(value || "0", 10);

  function buildPayload(form) {
    const cameraRows = rows("camera_bodies");
    const lensRows = rows("lenses");
    const selectedBodies = [...new Set(cameraRows.filter((row) => CAMERA_CODES.includes(row.code)).map((row) => row.code))];
    const personalCameras = [...new Set(cameraRows.filter((row) => row.code === "personal").map((row) => row.name.trim()).filter(Boolean))];
    const lensCounts = Object.fromEntries(LENS_CODES.map(([code]) => [code, 0]));
    lensRows.filter((row) => Object.hasOwn(lensCounts, row.code)).forEach((row) => {
      lensCounts[row.code] += integer(row.count);
    });
    const personalLenses = [...new Set(lensRows.filter((row) => row.code === "personal").map((row) => row.name.trim()).filter(Boolean))];
    const mapLocation = (row) => ({ name: row.name.trim(), distance_km: numberOrNull(row.distance_km) });
    const mapEquipment = (row) => ({ code: row.code, count: integer(row.count) });
    return {
      schema_version: "1.0",
      request_id: state.requestId,
      report_type: "event",
      event_code: state.selectedEvent.event_code,
      photographer_name: state.photographer.name,
      shooting: {
        shooting_date: eventDateValue(state.selectedEvent.event_date),
        role: form.elements.role.value.trim(),
        actual_location: {
          name: form.elements.actual_location_name.value.trim(),
          distance_km: numberOrNull(form.elements.actual_location_distance.value),
        },
        move_spots: rows("move_spots").map(mapLocation),
        arrival_time: form.elements.arrival_time.value,
        start_time: form.elements.start_time.value,
        end_time: form.elements.end_time.value,
        leaving_time: form.elements.leaving_time.value,
        result: form.elements.result.value,
        result_reason: form.elements.result_reason.value.trim(),
        photo_counts: rows("photo_counts").map((row) => ({ camera_body: row.camera_body, count: integer(row.count) })),
        memo: form.elements.shooting_memo.value.trim(),
      },
      upload: {
        status: form.elements.upload_status.value,
        progress_number: numberOrNull(form.elements.upload_progress.value),
        network_status: form.elements.network_status.value,
        network_note: form.elements.network_note.value.trim(),
      },
      equipment: {
        camera_bodies: selectedBodies,
        personal_camera: personalCameras,
        lenses: {
          ...lensCounts,
          personal: personalLenses,
        },
        issued_bag: form.elements.issued_bag.value,
        memory_card: { sd: integer(form.elements.sd_count.value), micro_sd: 0 },
        camera_battery: rows("camera_battery").map(mapEquipment),
        power_bank: rows("power_bank").map(mapEquipment),
        router: rows("router").map(mapEquipment),
        accessory_bag: rows("accessory_bag").map(mapEquipment),
        cooler: rows("cooler").map(mapEquipment),
        issue: {
          status: form.elements.issue_status.value,
          detail: form.elements.issue_detail.value.trim(),
        },
      },
      feedback: {
        field_note: form.elements.field_note.value.trim(),
        problem: form.elements.problem.value.trim(),
        improvement: form.elements.improvement.value.trim(),
        manager_request: form.elements.manager_request.value.trim(),
      },
    };
  }

  function duplicateValues(values) {
    const seen = new Set();
    return values.filter((value) => seen.has(value) || !seen.add(value));
  }

  function validateReport(form, payload) {
    if (!state.selectedEvent.event_date) return "대회 촬영일이 등록되지 않아 제출할 수 없습니다. 관리자에게 확인해 주세요.";
    if (!form.reportValidity()) return "필수 입력값을 확인해 주세요.";
    if (!payload.shooting.photo_counts.length) return "바디별 촬영 장수를 1개 이상 입력해 주세요.";
    if (duplicateValues(payload.shooting.photo_counts.map((row) => row.camera_body)).length) return "같은 카메라 바디를 촬영 장수에 중복 입력할 수 없습니다.";
    if (["partial", "stopped"].includes(payload.shooting.result) && !payload.shooting.result_reason) return "부분 완료 또는 중단인 경우 사유를 입력해 주세요.";
    if (payload.upload.status === "pending" && payload.upload.progress_number === null) return "업로드 진행 중인 경우 진행 번호를 입력해 주세요.";
    const lenses = payload.equipment.lenses;
    if (!(lenses["50_300"] || lenses["70_180"] || lenses["24_70"] || lenses.personal.length)) return "사용한 렌즈를 1개 이상 입력해 주세요.";
    const cameraRows = rows("camera_bodies");
    const lensRows = rows("lenses");
    if (duplicateValues(cameraRows.filter((row) => CAMERA_CODES.includes(row.code)).map((row) => row.code)).length) return "같은 카메라 바디를 중복 선택할 수 없습니다.";
    if (duplicateValues(lensRows.filter((row) => LENS_CODES.some(([code]) => code === row.code)).map((row) => row.code)).length) return "같은 렌즈를 중복 선택할 수 없습니다. 수량을 조정해 주세요.";
    if (payload.equipment.issue.status !== "none" && !payload.equipment.issue.detail) return "장비 이상이 있는 경우 상세 내용을 입력해 주세요.";
    for (const [key, label] of equipmentRows) {
      if (duplicateValues(payload.equipment[key].map((row) => row.code)).length) return `${label}의 같은 코드를 중복 입력할 수 없습니다.`;
    }
    return "";
  }

  async function submitReport(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector("button[type='submit']");
    const message = root.querySelector("[data-pl-submit-message]");
    message.dataset.kind = "";
    const payload = buildPayload(form);
    const validationMessage = validateReport(form, payload);
    if (validationMessage) {
      message.textContent = validationMessage;
      message.style.color = "var(--pl-red)";
      return;
    }

    button.disabled = true;
    button.textContent = "제출 중…";
    message.textContent = "일지를 저장하고 있습니다.";
    message.style.color = "";
    try {
      const data = await api("/api/v1/photographer-report", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const submittedEvent = state.selectedEvent;
      const index = state.events.findIndex((item) => item.event_code === submittedEvent.event_code);
      if (index >= 0) state.events[index] = { ...state.events[index], submitted: true };
      removeDraft();
      renderSuccess(submittedEvent, data);
    } catch (error) {
      if (error.status === 401 || ["ACCESS_TOKEN_INVALID", "EVENT_NOT_ASSIGNED"].includes(error.code)) {
        renderLogin("인증이 만료되었거나 대회 배정이 변경되었습니다. 다시 확인해 주세요.");
        return;
      }
      message.textContent = error.code === "DUPLICATE_SUBMISSION"
        ? "이미 제출된 일지입니다. 대회 목록을 다시 확인해 주세요."
        : genericError(error, "제출하지 못했습니다. 입력 내용을 유지한 상태이니 잠시 후 다시 시도해 주세요.");
      message.style.color = "var(--pl-red)";
      button.disabled = false;
      button.textContent = "일지 제출";
    }
  }

  function renderSuccess(event, data) {
    state.requestId = null;
    root.innerHTML = `
      <div class="pl-shell">
        <div class="pl-brand">SHOUT-OUT</div>
        <section class="pl-card">
          <p class="pl-kicker">Submitted</p>
          <h1 class="pl-heading">일지가 제출되었습니다.</h1>
          <p class="pl-copy">${escapeHtml(event.event_name || event.event_code)} 촬영 일지를 정상적으로 저장했습니다.</p>
          ${data?.report_id ? `<p class="pl-help" style="margin-top:14px">기록 ID: ${escapeHtml(data.report_id)}</p>` : ""}
          <button class="pl-button" type="button" data-pl-finish style="margin-top:28px">대회 목록으로</button>
        </section>
      </div>`;
    root.querySelector("[data-pl-finish]").addEventListener("click", loadEvents);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (state.token) loadEvents();
  else renderLogin();
})();
