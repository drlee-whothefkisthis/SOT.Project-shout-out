<script>
(() => {
  "use strict";

  const CONFIG = Object.freeze({
    apiBase: "https://photographer-report-api-a6mwhgji4q-du.a.run.app",
    tokenKey: "sot_photographer_access_v2",
    requestTimeoutMs: 25000,
  });

  const CAMERA_CODES = ["AM", "AP", "BM", "BP", "CM", "DM"];
  const EQUIPMENT_CODES = ["A", "B", "C", "D"];
  const state = {
    token: sessionStorage.getItem(CONFIG.tokenKey) || "",
    photographer: null,
    events: [],
    selectedEvent: null,
    requestId: null,
  };

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
    clearSession();
    root.innerHTML = `
      <div class="pl-shell">
        <div class="pl-brand">SHOUT-OUT</div>
        <section class="pl-card">
          <p class="pl-kicker">Photographer Log</p>
          <h1 class="pl-heading">포토그래퍼 일지</h1>
          <p class="pl-copy">이름과 등록된 전화번호 뒤 4자리를 입력해 주세요.</p>
          <form class="pl-stack" data-pl-login novalidate>
            <label class="pl-field">
              <span class="pl-label">이름</span>
              <input class="pl-input" name="name" autocomplete="name" maxlength="50" required>
            </label>
            <label class="pl-field">
              <span class="pl-label">전화번호 뒤 4자리</span>
              <input class="pl-input" name="phone_last4" type="text" inputmode="numeric" autocomplete="one-time-code" minlength="4" maxlength="4" pattern="[0-9]{4}" required>
            </label>
            <button class="pl-button pl-button--wide" type="submit">배정 대회 확인</button>
          </form>
          <p class="pl-alert" data-pl-login-message aria-live="assertive">${escapeHtml(message)}</p>
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
    const eventRows = state.events.length
      ? state.events.map((item) => `
          <article class="pl-event">
            <div>
              <div class="pl-event__name">${escapeHtml(item.event_name || item.event_code)}</div>
              <div class="pl-event__meta">${escapeHtml(item.event_date || "날짜 미정")} · ${escapeHtml(item.event_code)}</div>
            </div>
            ${item.submitted
              ? '<span class="pl-status">제출 완료</span>'
              : `<button class="pl-button pl-button--small" type="button" data-pl-open-event="${escapeHtml(item.event_code)}">일지 작성</button>`}
          </article>`).join("")
      : '<div class="pl-event"><div><div class="pl-event__name">배정된 확정 대회가 없습니다.</div><div class="pl-event__meta">관리자에게 배정 상태를 확인해 주세요.</div></div></div>';

    root.innerHTML = `
      <div class="pl-shell">
        <div class="pl-brand">SHOUT-OUT</div>
        <section class="pl-card">
          <div class="pl-toolbar">
            <div>
              <p class="pl-kicker">Assigned Events</p>
              <h1 class="pl-heading">${escapeHtml(state.photographer?.name)}님의 대회</h1>
              <p class="pl-copy">작성할 대회를 선택해 주세요.</p>
            </div>
            <button class="pl-button pl-button--ghost pl-button--small" type="button" data-pl-logout>다른 이름으로 확인</button>
          </div>
          <p class="pl-alert" aria-live="assertive">${escapeHtml(loadError)}</p>
          <div class="pl-event-list">${eventRows}</div>
        </section>
      </div>`;

    root.querySelector("[data-pl-logout]").addEventListener("click", () => renderLogin());
    root.querySelectorAll("[data-pl-open-event]").forEach((button) => {
      button.addEventListener("click", () => {
        const selected = state.events.find((item) => item.event_code === button.dataset.plOpenEvent);
        if (selected && !selected.submitted) renderReport(selected);
      });
    });
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
            <div class="pl-context__item"><div class="pl-context__label">촬영일</div><div class="pl-context__value">${escapeHtml(event.event_date || "날짜 미정")}</div></div>
          </div>
        </section>

        <form data-pl-report novalidate>
          <section class="pl-section">
            <div class="pl-section__head"><h2 class="pl-section__title">1. 촬영 정보</h2><p class="pl-section__copy">실제 촬영 위치와 시간을 기록해 주세요.</p></div>
            <div class="pl-grid">
              <label class="pl-field"><span class="pl-label">작성자</span><input class="pl-input" name="photographer_name" value="${escapeHtml(state.photographer.name)}" readonly></label>
              <label class="pl-field"><span class="pl-label">대회 코드</span><input class="pl-input" name="event_code" value="${escapeHtml(event.event_code)}" readonly></label>
              <label class="pl-field"><span class="pl-label">촬영일</span><input class="pl-input" type="date" name="shooting_date" value="${escapeHtml(event.event_date || "")}" readonly required></label>
              <label class="pl-field"><span class="pl-label">담당 역할</span><input class="pl-input" name="role" placeholder="예: 메인 구간 촬영" required></label>
              <label class="pl-field"><span class="pl-label">실제 촬영 위치</span><input class="pl-input" name="actual_location_name" placeholder="예: 10km 반환점" required></label>
              <label class="pl-field"><span class="pl-label">이동 거리(km)</span><input class="pl-input" type="number" name="actual_location_distance" min="0" step="0.1" placeholder="선택 입력"></label>
            </div>
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
            <div class="pl-section__head"><h2 class="pl-section__title">2. 바디별 촬영 장수</h2><p class="pl-section__copy">사용한 카메라 바디와 촬영 장수를 입력해 주세요.</p></div>
            <div class="pl-repeat" data-pl-list="photo_counts"></div>
            <button class="pl-button pl-button--ghost pl-button--small pl-add" type="button" data-pl-add="photo_counts">+ 바디 추가</button>
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
            <h3 class="pl-subtitle" style="margin-top:0">카메라 바디</h3>
            <div class="pl-checks">${CAMERA_CODES.map((code) => `<label class="pl-check"><input type="checkbox" name="camera_bodies" value="${code}">${code}</label>`).join("")}</div>
            <label class="pl-field" style="margin-top:14px"><span class="pl-label">개인 카메라</span><input class="pl-input" name="personal_camera" placeholder="여러 대면 쉼표로 구분"></label>

            <h3 class="pl-subtitle">렌즈</h3>
            <div class="pl-grid pl-grid--3">
              <label class="pl-field"><span class="pl-label">50-300 수량</span><input class="pl-input" type="number" name="lens_50_300" value="0" min="0" step="1" required></label>
              <label class="pl-field"><span class="pl-label">70-180 수량</span><input class="pl-input" type="number" name="lens_70_180" value="0" min="0" step="1" required></label>
              <label class="pl-field"><span class="pl-label">24-70 수량</span><input class="pl-input" type="number" name="lens_24_70" value="0" min="0" step="1" required></label>
            </div>
            <label class="pl-field" style="margin-top:14px"><span class="pl-label">개인 렌즈</span><input class="pl-input" name="personal_lenses" placeholder="여러 개면 쉼표로 구분"></label>

            <h3 class="pl-subtitle">지급품</h3>
            <div class="pl-grid">
              <label class="pl-field"><span class="pl-label">지급 가방</span><select class="pl-select" name="issued_bag" required><option value="none">없음</option>${EQUIPMENT_CODES.map((code) => `<option value="${code}">${code}</option>`).join("")}</select></label>
              <label class="pl-field"><span class="pl-label">SD 카드 수량</span><input class="pl-input" type="number" name="sd_count" value="0" min="0" step="1" required></label>
            </div>
            ${equipmentRows.map(([key, label]) => `
              <h3 class="pl-subtitle">${label}</h3>
              <div class="pl-repeat" data-pl-list="${key}"></div>
              <button class="pl-button pl-button--ghost pl-button--small pl-add" type="button" data-pl-add="${key}">+ ${label} 추가</button>`).join("")}

            <h3 class="pl-subtitle">장비 이상</h3>
            <div class="pl-grid">
              <label class="pl-field"><span class="pl-label">상태</span><select class="pl-select" name="issue_status" required><option value="none">이상 없음</option><option value="inspection">점검 필요</option><option value="lost_or_damaged">분실·파손</option></select></label>
              <label class="pl-field"><span class="pl-label">상세 내용</span><input class="pl-input" name="issue_detail" placeholder="이상이 있을 때 입력"></label>
            </div>
          </section>

          <section class="pl-section">
            <div class="pl-section__head"><h2 class="pl-section__title">5. 피드백</h2><p class="pl-section__copy">운영 개선에 필요한 내용을 자유롭게 남겨 주세요.</p></div>
            <div class="pl-grid">
              <label class="pl-field"><span class="pl-label">현장 메모</span><textarea class="pl-textarea" name="field_note"></textarea></label>
              <label class="pl-field"><span class="pl-label">문제점</span><textarea class="pl-textarea" name="problem"></textarea></label>
              <label class="pl-field"><span class="pl-label">개선 의견</span><textarea class="pl-textarea" name="improvement"></textarea></label>
              <label class="pl-field"><span class="pl-label">관리자 요청사항</span><textarea class="pl-textarea" name="manager_request"></textarea></label>
            </div>
          </section>

          <div class="pl-actions">
            <span class="pl-submit-note" data-pl-submit-message aria-live="assertive">제출 전 내용을 한 번 더 확인해 주세요.</span>
            <button class="pl-button pl-button--ghost" type="button" data-pl-back>목록으로</button>
            <button class="pl-button" type="submit">일지 제출</button>
          </div>
        </form>
      </div>`;

    bindReport();
    addRepeatRow("photo_counts", { camera_body: "AM", count: 0 });
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
        <label class="pl-field"><span class="pl-label">바디</span><select class="pl-select" data-key="camera_body" required>${CAMERA_CODES.map((code) => `<option value="${code}" ${code === values.camera_body ? "selected" : ""}>${code}</option>`).join("")}</select></label>
        <label class="pl-field"><span class="pl-label">촬영 장수</span><input class="pl-input" data-key="count" type="number" min="0" step="1" value="${escapeHtml(values.count ?? 0)}" required></label>
        <button class="pl-remove" type="button" aria-label="삭제" data-pl-remove>×</button>
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
    list.lastElementChild.querySelector("[data-pl-remove]").addEventListener("click", (event) => event.currentTarget.closest("[data-pl-row]").remove());
  }

  function bindReport() {
    root.querySelectorAll("[data-pl-back]").forEach((button) => button.addEventListener("click", loadEvents));
    root.querySelectorAll("[data-pl-add]").forEach((button) => button.addEventListener("click", () => addRepeatRow(button.dataset.plAdd)));
    root.querySelector("[data-pl-report]").addEventListener("submit", submitReport);
  }

  function rows(type) {
    return [...root.querySelectorAll(`[data-pl-list="${type}"] [data-pl-row]`)].map((row) => Object.fromEntries(
      [...row.querySelectorAll("[data-key]")].map((field) => [field.dataset.key, field.value])
    ));
  }

  const numberOrNull = (value) => value === "" ? null : Number(value);
  const integer = (value) => Number.parseInt(value || "0", 10);
  const csv = (value) => [...new Set(String(value || "").split(",").map((part) => part.trim()).filter(Boolean))];

  function buildPayload(form) {
    const selectedBodies = [...form.querySelectorAll("input[name='camera_bodies']:checked")].map((field) => field.value);
    const mapLocation = (row) => ({ name: row.name.trim(), distance_km: numberOrNull(row.distance_km) });
    const mapEquipment = (row) => ({ code: row.code, count: integer(row.count) });
    return {
      schema_version: "1.0",
      request_id: state.requestId,
      report_type: "event",
      event_code: state.selectedEvent.event_code,
      photographer_name: state.photographer.name,
      shooting: {
        shooting_date: state.selectedEvent.event_date,
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
        personal_camera: csv(form.elements.personal_camera.value),
        lenses: {
          "50_300": integer(form.elements.lens_50_300.value),
          "70_180": integer(form.elements.lens_70_180.value),
          "24_70": integer(form.elements.lens_24_70.value),
          personal: csv(form.elements.personal_lenses.value),
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
</script>
