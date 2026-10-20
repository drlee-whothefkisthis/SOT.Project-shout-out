(() => {
  const mountId = 'sot-general-shooting-log';
  const endpoint = 'https://photographer-report-api-a6mwhgji4q-du.a.run.app/api/v1/photographer-report';
  if (document.getElementById(mountId)) return;

  const countOptions = (startAtZero = true) => Array.from({ length: startAtZero ? 7 : 6 }, (_, index) => {
    const value = startAtZero ? index : index + 1;
    return `<option value="${value}">${value}개</option>`;
  }).join('');
  const letterOptions = '<option value="">선택</option><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>';
  const pairRow = (equipment, number) => `
    <div class="gsl-pair-row">
      <select aria-label="${equipment} 알파벳 ${number}" name="${equipment}_letter_${number}">${letterOptions}</select>
      <select aria-label="${equipment} 개수 ${number}" name="${equipment}_count_${number}">${countOptions(false)}</select>
      <button aria-label="선택 줄 추가" class="gsl-row-action gsl-add-inline" type="button">+</button>
    </div>`;
  const equipmentBlock = (equipment, key) => `
    <div class="gsl-field gsl-dynamic-equipment" data-equipment="${key}">
      <label class="gsl-label">${equipment}</label>
      <div class="gsl-equipment-card"><div class="gsl-pair-list">${pairRow(equipment, 1)}</div></div>
    </div>`;
  const lensRow = (label, key, rental = false) => `
    <div class="gsl-lens-row"><label class="gsl-choice gsl-lens-choice"><input ${rental ? 'data-role="rental-lens-toggle"' : ''} type="checkbox" name="lens_${key}"> ${label}</label><select ${rental ? 'data-role="rental-lens-count"' : ''} aria-label="${label} 개수" name="${rental ? 'rental_lens_count' : `lens_${key}_count`}">${countOptions()}</select></div>`;
  const bodyCodes = ['AM', 'AP', 'BM', 'BP', 'CM', 'DM'].map((code) => `<label class="gsl-choice"><input type="checkbox" name="camera_body" value="${code}"> ${code}</label>`).join('');

  const mount = document.createElement('main');
  mount.id = mountId;
  mount.className = 'gsl-page';
  mount.innerHTML = `
    <div class="gsl-icon">📷</div><div class="gsl-badge">일반 촬영용 · 모바일</div>
    <h1>일반 촬영 장비 일지</h1><p class="gsl-desc">일반 촬영에 사용한 장비와 대여 기간을 기록해 주세요.</p>
    <div class="gsl-notice">일반 촬영은 프로젝트, 담당자, 장비 사용 기간, 사용 장비와 장비 이상 여부를 작성합니다.</div>
    <form id="gsl-form" novalidate>
      <section class="gsl-section"><h2 class="gsl-section-title">1. 기본 정보</h2><p class="gsl-section-desc">프로젝트, 담당자와 일반 촬영일을 기록합니다.</p>
        <div class="gsl-two-column">
          <div class="gsl-field"><label class="gsl-label" for="gsl-manager">담당자 <span class="gsl-required">*</span></label><input id="gsl-manager" autocomplete="name" name="manager_name" placeholder="담당자 이름 직접 입력" type="text" required></div>
          <div class="gsl-field"><label class="gsl-label" for="gsl-project">프로젝트 <span class="gsl-required">*</span></label><input id="gsl-project" name="project_name" placeholder="예: 브랜드 룩북 촬영" type="text" required></div>
        </div>
        <div class="gsl-field"><label class="gsl-label" for="gsl-shooting-date">촬영일 <span class="gsl-required">*</span></label><input id="gsl-shooting-date" name="shooting_date" type="date" required></div>
        <div class="gsl-field"><label class="gsl-label">패킹 기간 <span class="gsl-required">*</span></label><div class="gsl-date-range"><div class="gsl-packing-point"><p class="gsl-mini-label">패킹</p><div class="gsl-date-time"><input aria-label="패킹일" name="packing_start_date" type="date" required><input aria-label="패킹시간" name="packing_start_time" type="time" required></div></div><div class="gsl-packing-point"><p class="gsl-mini-label">언패킹</p><div class="gsl-date-time"><input aria-label="언패킹일" name="packing_end_date" type="date" required><input aria-label="언패킹시간" name="packing_end_time" type="time" required></div></div></div></div>
      </section>
      <div class="gsl-divider"></div>
      <section class="gsl-section"><h2 class="gsl-section-title">2. 사용 장비</h2>
        <div class="gsl-field"><label class="gsl-label">카메라 바디</label><div class="gsl-choices gsl-body-grid">${bodyCodes}</div><div class="gsl-help">실제로 사용한 바디 코드를 모두 선택합니다.</div></div>
        <div class="gsl-field"><label class="gsl-label">렌즈</label><div class="gsl-lens-list">${lensRow('50-300', '50_300')}${lensRow('70-180', '70_180')}${lensRow('24-70', '24_70')}${lensRow('대여장비', 'rental', true)}</div><div class="gsl-rental-inputs" aria-live="polite"></div><div class="gsl-help">대여장비는 선택한 개수만큼 렌즈명을 각각 입력합니다.</div></div>
        <div class="gsl-field"><label class="gsl-label">장비</label><p class="gsl-section-desc">각 장비의 구분과 수량을 입력합니다.</p>
          <div class="gsl-two-column">
            ${equipmentBlock('카메라 배터리', 'camera_battery')}${equipmentBlock('보조배터리', 'power_bank')}
          </div>
          <div class="gsl-two-column">
            <div class="gsl-field"><label class="gsl-label">메모리카드</label><div class="gsl-equipment-card"><div class="gsl-memory-list"><div class="gsl-memory-row"><span class="gsl-quantity-label">SD</span><select aria-label="SD 카드 개수" name="sd_card_count">${countOptions()}</select></div><div class="gsl-memory-row"><span class="gsl-quantity-label">Micro SD</span><select aria-label="Micro SD 카드 개수" name="micro_sd_card_count">${countOptions()}</select></div></div></div></div>
            ${equipmentBlock('쿨러', 'cooler')}
          </div>
        </div>
        <div class="gsl-field"><label class="gsl-label" for="gsl-damage">장비 이상 또는 파손 여부 <span class="gsl-required">*</span></label><select id="gsl-damage" name="damage" required><option value="none" selected>이상 없음</option><option value="inspection">점검 필요</option><option value="lost_or_damaged">파손 또는 분실</option></select></div>
        <div class="gsl-field"><label class="gsl-label" for="gsl-damage-detail">장비 이상 상세</label><textarea id="gsl-damage-detail" name="damage_detail" placeholder="장비명, 증상, 발생 시점, 현재 상태를 기록해 주세요."></textarea></div>
      </section>
      <p class="gsl-form-message" data-role="form-message" aria-live="polite" hidden></p>
      <button class="gsl-submit" type="submit">제출</button>
    </form><div class="gsl-footer">일반 촬영 장비 기록용 모바일 Form 예시입니다.</div>`;
  document.body.prepend(mount);

  const shootingDate = mount.querySelector('[name="shooting_date"]');
  if (shootingDate) shootingDate.value = new Date().toISOString().slice(0, 10);
  mount.querySelectorAll('.gsl-dynamic-equipment').forEach((group) => {
    const list = group.querySelector('.gsl-pair-list');
    const appendRow = () => { const row = list.firstElementChild.cloneNode(true); const next = list.children.length + 1; row.querySelectorAll('select').forEach((select) => { select.selectedIndex = 0; select.name = select.name.replace(/_\d+$/, `_${next}`); }); list.appendChild(row); refresh(); };
    const refresh = () => { const rows = [...list.querySelectorAll('.gsl-pair-row')]; rows.forEach((row, index) => { const action = row.querySelector('.gsl-row-action'); const isAddButton = index === 0; action.className = `gsl-row-action ${isAddButton ? 'gsl-add-inline' : 'gsl-remove'}`; action.textContent = isAddButton ? '+' : '×'; action.setAttribute('aria-label', isAddButton ? '선택 줄 추가' : '선택 줄 삭제'); action.dataset.action = isAddButton ? 'add' : 'remove'; }); };
    list.addEventListener('click', (event) => { const action = event.target.closest('.gsl-row-action'); if (!action) return; if (action.dataset.action === 'add') { appendRow(); return; } if (list.children.length > 1) { action.closest('.gsl-pair-row').remove(); refresh(); } });
    refresh();
  });
  const rentalToggle = mount.querySelector('[data-role="rental-lens-toggle"]');
  const rentalCount = mount.querySelector('[data-role="rental-lens-count"]');
  const rentalInputs = mount.querySelector('.gsl-rental-inputs');
  const renderRentalInputs = () => { const enabled = rentalToggle.checked; rentalCount.disabled = !enabled; rentalCount.style.opacity = enabled ? '1' : '.45'; const count = enabled ? Number(rentalCount.value) : 0; const values = [...rentalInputs.querySelectorAll('input')].map((input) => input.value); rentalInputs.replaceChildren(); for (let index = 1; index <= count; index += 1) { const label = document.createElement('label'); label.className = 'gsl-mini-label'; label.textContent = `대여장비 ${index}`; const input = document.createElement('input'); input.type = 'text'; input.name = `rental_lens_name_${index}`; input.placeholder = `대여장비 ${index} 렌즈명 입력`; input.value = values[index - 1] || ''; const entry = document.createElement('div'); entry.className = 'gsl-field'; entry.append(label, input); rentalInputs.append(entry); } };
  rentalToggle.addEventListener('change', renderRentalInputs); rentalCount.addEventListener('change', renderRentalInputs); renderRentalInputs();
  const form = mount.querySelector('#gsl-form');
  const submitButton = form.querySelector('.gsl-submit');
  const formMessage = form.querySelector('[data-role="form-message"]');
  const showMessage = (message, type = 'error') => {
    formMessage.textContent = message;
    formMessage.className = `gsl-form-message is-${type}`;
    formMessage.hidden = false;
  };
  const clearMessage = () => { formMessage.hidden = true; formMessage.textContent = ''; };
  const createRequestId = () => {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const random = Math.floor(Math.random() * 16);
      return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
    });
  };
  const valueOf = (name) => String(form.elements[name]?.value || '').trim();
  const countOf = (name) => Number(valueOf(name) || 0);
  const seoulDateTime = (dateName, timeName) => `${valueOf(dateName)}T${valueOf(timeName)}:00+09:00`;
  const rowsFor = (key) => {
    const rows = [];
    const seen = new Set();
    mount.querySelectorAll(`.gsl-dynamic-equipment[data-equipment="${key}"] .gsl-pair-row`).forEach((row) => {
      const [letter, count] = row.querySelectorAll('select');
      if (!letter.value) return;
      if (seen.has(letter.value)) throw new Error(`${key}의 ${letter.value} 코드는 한 번만 입력할 수 있습니다.`);
      seen.add(letter.value);
      rows.push({ code: letter.value, count: Number(count.value) });
    });
    return rows;
  };
  const selectedLensCount = (key) => form.elements[`lens_${key}`].checked ? countOf(`lens_${key}_count`) : 0;
  const buildPayload = () => {
    const startAt = seoulDateTime('packing_start_date', 'packing_start_time');
    const endAt = seoulDateTime('packing_end_date', 'packing_end_time');
    if (startAt > endAt) throw new Error('패킹 시작은 언패킹 완료보다 늦을 수 없습니다.');
    const rental = rentalToggle.checked
      ? [...rentalInputs.querySelectorAll('input')].map((input) => input.value.trim())
      : [];
    if (rental.some((name) => !name)) throw new Error('대여 렌즈명을 모두 입력해 주세요.');
    const issueStatus = valueOf('damage');
    const issueDetail = valueOf('damage_detail');
    if (issueStatus === 'inspection' && !issueDetail) throw new Error('점검 필요 시 장비 이상 상세를 입력해 주세요.');
    return {
      schema_version: '1.0',
      request_id: form.dataset.requestId || (form.dataset.requestId = createRequestId()),
      report_type: 'general',
      event_code: null,
      photographer_name: valueOf('manager_name'),
      shooting: {
        shooting_date: valueOf('shooting_date'),
        project_name: valueOf('project_name'),
        packing: { start_at: startAt, end_at: endAt }
      },
      equipment: {
        camera_bodies: [...form.querySelectorAll('[name="camera_body"]:checked')].map((input) => input.value),
        lenses: {
          '50_300': selectedLensCount('50_300'),
          '70_180': selectedLensCount('70_180'),
          '24_70': selectedLensCount('24_70'),
          rental
        },
        memory_card: { sd: countOf('sd_card_count'), micro_sd: countOf('micro_sd_card_count') },
        camera_battery: rowsFor('camera_battery'),
        power_bank: rowsFor('power_bank'),
        cooler: rowsFor('cooler'),
        issue: { status: issueStatus, detail: issueDetail }
      }
    };
  };
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearMessage();
    if (!form.reportValidity()) {
      showMessage('필수 입력 항목을 모두 작성한 뒤 제출할 수 있습니다.');
      form.querySelector(':invalid')?.focus();
      return;
    }
    let payload;
    try {
      payload = buildPayload();
    } catch (error) {
      showMessage(error.message || '입력 내용을 확인해 주세요.');
      return;
    }
    submitButton.disabled = true;
    submitButton.textContent = '제출 중…';
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20000);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      window.clearTimeout(timeout);
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = result?.error?.details?.[0]?.message;
        throw new Error(detail || result?.error?.message || '제출에 실패했습니다. 다시 시도해 주세요.');
      }
      submitButton.textContent = '제출 완료';
      showMessage(response.status === 200 ? '이미 제출된 기록입니다. 기존 제출 결과를 불러왔습니다.' : '일반 촬영 장비 일지가 제출되었습니다.', 'success');
    } catch (error) {
      submitButton.disabled = false;
      submitButton.textContent = '제출';
      showMessage(error.name === 'AbortError' ? '응답 시간이 초과되었습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.' : (error.message || '제출에 실패했습니다. 다시 시도해 주세요.'));
    }
  });
})();
