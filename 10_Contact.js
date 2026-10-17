(() => {
  if (document.querySelector('.sot-contact')) return;
  const header = document.querySelector('section.section-header');
  const template = document.createElement('template');
  template.innerHTML = "<section class=\"sot-contact\" aria-labelledby=\"sot-contact-title\">\n  <div class=\"sot-contact__inner\">\n    <header class=\"sot-contact__heading\">\n      <p class=\"sot-contact__eyebrow\">GET IN TOUCH</p>\n      <h1 id=\"sot-contact-title\">Contact us<span class=\"sot-contact__dot\">.</span></h1>\n      <p>문의 유형을 선택하고 필요한 내용을 입력해 주세요.</p>\n    </header>\n    <div class=\"sot-contact__content\">\n      <div class=\"sot-contact__form-wrap\">\n        <form class=\"sot-contact__form\">\n          <div class=\"sot-contact__trap\" aria-hidden=\"true\"><label for=\"sot-contact-website\">웹사이트</label><input id=\"sot-contact-website\" name=\"website\" type=\"text\" tabindex=\"-1\" autocomplete=\"off\"></div>\n          <div class=\"sot-contact__step\" data-step=\"kind\">\n            <fieldset class=\"sot-contact__kind\">\n              <legend>문의 유형 <span class=\"sot-contact__required\">*</span></legend>\n              <div class=\"sot-contact__choices\">\n                <label class=\"sot-contact__choice\"><input type=\"radio\" name=\"kind\" value=\"photo\" required><span>사진 문의</span></label>\n                <label class=\"sot-contact__choice\"><input type=\"radio\" name=\"kind\" value=\"partnership\" required><span>협업·제휴</span></label>\n              </div>\n            </fieldset>\n          </div>\n          <div class=\"sot-contact__step\" data-step=\"topic\" hidden>\n            <label for=\"sot-contact-topic\">사진 문의 항목 <span class=\"sot-contact__required\">*</span></label>\n            <select id=\"sot-contact-topic\" name=\"topic\" required disabled><option value=\"\" selected disabled>선택해 주세요</option><option value=\"사진 검색\">사진 검색</option><option value=\"구매·결제\">구매·결제</option><option value=\"다운로드\">다운로드</option><option value=\"사진 삭제 요청\">사진 삭제 요청</option><option value=\"기타 사진 문의\">기타 사진 문의</option></select>\n          </div>\n          <div class=\"sot-contact__step\" data-step=\"event\" hidden>\n            <label for=\"sot-contact-event\">문의할 대회 <span class=\"sot-contact__required\">*</span></label>\n            <select id=\"sot-contact-event\" name=\"eventCode\" required disabled><option value=\"\">문의할 대회를 선택해 주세요</option></select>\n            <p class=\"sot-contact__status\" data-event-status role=\"status\" aria-live=\"polite\"></p>\n            <button class=\"sot-contact__retry\" type=\"button\" data-event-retry hidden>다시 불러오기</button>\n          </div>\n          <div class=\"sot-contact__step\" data-step=\"identity\" hidden>\n            <div class=\"sot-contact__row\">\n              <div data-field=\"organization\" hidden><label for=\"sot-contact-organization\">소속·단체명 <span class=\"sot-contact__required\">*</span></label><input id=\"sot-contact-organization\" name=\"organization\" type=\"text\" maxlength=\"120\" autocomplete=\"organization\" placeholder=\"회사 또는 단체명\" disabled></div>\n              <div data-field=\"name\"><label for=\"sot-contact-name\">이름 <span class=\"sot-contact__required\">*</span></label><input id=\"sot-contact-name\" name=\"name\" type=\"text\" maxlength=\"80\" autocomplete=\"name\" placeholder=\"이름을 입력해 주세요\" required disabled></div>\n              <div data-field=\"bib\"><label for=\"sot-contact-bib\">배번호 <span class=\"sot-contact__required\">*</span></label><input id=\"sot-contact-bib\" name=\"bib\" type=\"text\" maxlength=\"20\" autocomplete=\"off\" placeholder=\"예: 1234\" disabled></div>\n            </div>\n          </div>\n          <div class=\"sot-contact__step\" data-step=\"payment\" hidden>\n            <label for=\"sot-contact-payment\">결제 일시 (한국시간) <span class=\"sot-contact__required\">*</span></label>\n            <input id=\"sot-contact-payment\" name=\"paymentAt\" type=\"datetime-local\" required disabled>\n          </div>\n          <div class=\"sot-contact__step\" data-step=\"contact\" hidden>\n            <div class=\"sot-contact__row\">\n              <div><label for=\"sot-contact-email\">이메일 <span class=\"sot-contact__required\">*</span></label><input id=\"sot-contact-email\" name=\"email\" type=\"email\" maxlength=\"254\" autocomplete=\"email\" placeholder=\"답변받을 이메일\" required disabled></div>\n              <div><label for=\"sot-contact-phone\">연락처 <span class=\"sot-contact__optional\">선택</span></label><input id=\"sot-contact-phone\" name=\"phone\" type=\"tel\" maxlength=\"30\" autocomplete=\"tel\" inputmode=\"tel\" placeholder=\"선택 입력\" disabled></div>\n            </div>\n          </div>\n          <div class=\"sot-contact__step\" data-step=\"message\" hidden>\n            <label for=\"sot-contact-message\">문의 내용 <span class=\"sot-contact__required\">*</span></label>\n            <textarea id=\"sot-contact-message\" name=\"message\" rows=\"7\" maxlength=\"3000\" required disabled placeholder=\"확인에 필요한 내용과 문의 사항을 적어주세요.\"></textarea>\n            <p class=\"sot-contact__privacy\">민감한 개인정보와 결제정보는 적지 말아주세요.</p>\n          </div>\n          <div class=\"sot-contact__step\" data-step=\"attachment\" hidden>\n            <label for=\"sot-contact-files\">파일 첨부 <span class=\"sot-contact__optional\">선택</span></label>\n            <input id=\"sot-contact-files\" name=\"attachments\" type=\"file\" multiple disabled>\n            <p class=\"sot-contact__status\">파일 최대 10개, 전체 크기 최대 18MB (메일 전송 용량 기준)</p>\n            <p class=\"sot-contact__status\" data-file-status role=\"status\" aria-live=\"polite\"></p>\n          </div>\n          <div class=\"sot-contact__step\" data-step=\"action\" hidden>\n            <div class=\"sot-contact__turnstile\" data-turnstile></div>\n            <input name=\"turnstileToken\" type=\"hidden\" disabled>\n            <button class=\"sot-contact__submit\" type=\"submit\" disabled>전송</button>\n            <p class=\"sot-contact__status\" data-submit-status role=\"status\" aria-live=\"polite\"></p>\n          </div>\n        </form>\n      </div>\n    </div>\n  </div>\n</section>";
  const root = template.content.firstElementChild;
  if (!root) return;
  if (header) header.after(root);
  else document.body.prepend(root);
  const old = document.querySelector('.contact-6');
  const oldSection = old && old.closest('section');
  if (oldSection && oldSection !== root && oldSection !== header) oldSection.remove();
(() => {
  const root = document.querySelector('.sot-contact');
  const form = root?.querySelector('.sot-contact__form');
  if (!form || form.dataset.ready) return;
  form.dataset.ready = 'true';
  const eventEndpoint = 'https://plp-62309.bubbleapps.io/api/1.1/obj/event';
  const submitEndpoint = document.currentScript?.getAttribute('data-contact-endpoint') || window.SOT_CONTACT_ENDPOINT || 'https://asia-northeast3-project-shoutout-480002.cloudfunctions.net/sot-contact-submit';
  const turnstileSiteKey = document.currentScript?.getAttribute('data-turnstile-sitekey') || window.SOT_CONTACT_TURNSTILE_SITEKEY || '';
  const maxAttachmentBytes = 18_000_000;
  const fields = Object.fromEntries(['kind','topic','eventCode','bib','name','organization','paymentAt','email','phone','message','attachments','turnstileToken'].map(name => [name, form.elements.namedItem(name)]));
  const steps = Object.fromEntries([...form.querySelectorAll('[data-step]')].map(step => [step.dataset.step, step]));
  const status = root.querySelector('[data-event-status]');
  const retry = root.querySelector('[data-event-retry]');
  const submit = root.querySelector('.sot-contact__submit');
  const fileStatus = root.querySelector('[data-file-status]');
  const submitStatus = root.querySelector('[data-submit-status]');
  if (!turnstileSiteKey) root.querySelector('[data-turnstile]').hidden = true;
  let eventLoaded = false;
  let eventLoading = false;
  let submitting = false;
  let sent = false;
  let turnstileWidgetId = null;
  let turnstileLoading = false;
  const renderTurnstile = () => {
    if (!turnstileSiteKey || !window.turnstile || turnstileWidgetId !== null) return;
    turnstileWidgetId = window.turnstile.render(root.querySelector('[data-turnstile]'), {
      sitekey: turnstileSiteKey,
      size: root.clientWidth < 340 ? 'compact' : 'flexible',
      callback: token => { fields.turnstileToken.value = token; reconcile(); },
      'expired-callback': () => { fields.turnstileToken.value = ''; reconcile(); },
      'error-callback': () => { fields.turnstileToken.value = ''; reconcile(); }
    });
  };
  const ensureTurnstile = () => {
    if (!turnstileSiteKey || turnstileWidgetId !== null) return;
    if (window.turnstile) return renderTurnstile();
    if (turnstileLoading) return;
    turnstileLoading = true;
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => { turnstileLoading = false; renderTurnstile(); };
    script.onerror = () => { turnstileLoading = false; submitStatus.textContent = '사람 확인을 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.'; submitStatus.dataset.state = 'error'; };
    document.head.append(script);
  };
  const setStep = (name, visible) => {
    const step = steps[name];
    step.hidden = !visible;
    step.querySelectorAll('input,select,textarea,button').forEach(control => { control.disabled = !visible; });
    if (name === 'event' && !eventLoaded) fields.eventCode.disabled = true;
  };
  const setField = (name, visible, required) => {
    const wrapper = root.querySelector(`[data-field="${name}"]`);
    wrapper.hidden = !visible;
    fields[name].disabled = !visible;
    fields[name].required = required;
  };
  const reconcile = () => {
    const kind = fields.kind.value;
    const photoInquiry = kind === 'photo';
    const partnership = kind === 'partnership';
    const topic = fields.topic.value;
    const hasTopic = photoInquiry && Boolean(topic);
    const paymentTopic = photoInquiry && topic === '구매·결제';
    setStep('topic', photoInquiry);
    setStep('event', hasTopic);
    const showDetails = partnership || (hasTopic && Boolean(fields.eventCode.value));
    setStep('identity', showDetails);
    setField('bib', showDetails && photoInquiry, photoInquiry);
    setField('organization', showDetails && partnership, partnership);
    setStep('payment', showDetails && paymentTopic);
    setStep('contact', showDetails);
    setStep('message', showDetails);
    setStep('attachment', showDetails);
    setStep('action', showDetails);
    if (showDetails) ensureTurnstile();
    const fileBytes = [...fields.attachments.files].reduce((sum, file) => sum + file.size, 0);
    const fileTooLarge = fileBytes > maxAttachmentBytes;
    const tooManyFiles = fields.attachments.files.length > 10;
    fileStatus.textContent = tooManyFiles ? '파일은 최대 10개까지 첨부할 수 있습니다.' : (fileTooLarge ? '첨부 파일의 전체 크기가 18MB를 초과했습니다.' : (fields.attachments.files.length ? `${fields.attachments.files.length}개 파일 · ${(fileBytes / 1000000).toFixed(1)}MB` : ''));
    fileStatus.dataset.state = fileTooLarge || tooManyFiles ? 'error' : '';
    submit.disabled = submitting || sent || !submitEndpoint || (turnstileSiteKey && !fields.turnstileToken.value) || !showDetails || fileTooLarge || tooManyFiles || !form.checkValidity();
  };
  async function loadEvents() {
    if (eventLoading) return;
    eventLoading = true;
    fields.eventCode.disabled = true;
    fields.eventCode.replaceChildren(new Option('대회 목록을 불러오는 중입니다', ''));
    status.textContent = '대회 목록을 불러오는 중입니다.';
    retry.hidden = true;
    try {
      const events = [];
      let cursor = 0;
      for (let page = 0; page < 10; page++) {
        const url = new URL(eventEndpoint);
        url.searchParams.set('limit', '200');
        if (cursor) url.searchParams.set('cursor', String(cursor));
        const response = await fetch(url.toString(), {headers: {'Accept':'application/json'}});
        if (!response.ok) throw new Error(`대회 조회 실패: ${response.status}`);
        const data = await response.json();
        const batch = data?.response?.results;
        if (!Array.isArray(batch)) throw new Error('대회 응답 형식이 올바르지 않습니다.');
        events.push(...batch);
        cursor += batch.length;
        if (batch.length < 200 || Number(data.response.remaining) === 0) break;
      }
      const now = Date.now();
      const allowed = [...new Map(events.filter(item => {
        if (item.is_public !== true || !item.event_code) return false;
        const publishAt = item.publish_at ? Date.parse(item.publish_at) : NaN;
        return !Number.isFinite(publishAt) || publishAt <= now;
      }).map(item => [String(item.event_code), item])).values()]
        .sort((a,b) => (Date.parse(b.event_date) || 0) - (Date.parse(a.event_date) || 0));
      if (!allowed.length) throw new Error('문의 가능한 대회가 없습니다.');
      fields.eventCode.replaceChildren(new Option('문의할 대회를 선택해 주세요', ''));
      allowed.forEach(item => fields.eventCode.add(new Option(String(item.event_display_name || item.name || item.event_code), String(item.event_code))));
      eventLoaded = true;
      fields.eventCode.disabled = false;
      status.textContent = '';
    } catch (error) {
      fields.eventCode.replaceChildren(new Option('대회 목록을 불러오지 못했습니다', ''));
      status.textContent = '대회 목록을 불러오지 못했습니다. 다시 시도해 주세요.';
      retry.hidden = false;
      console.warn('[SOT Contact] event load failed', error);
    }
    eventLoading = false;
    reconcile();
  }
  retry.addEventListener('click', loadEvents);
  const resetFollowing = names => {
    names.forEach(name => { fields[name].value = ''; });
    fields.attachments.value = '';
    fields.turnstileToken.value = '';
    if (turnstileWidgetId !== null) window.turnstile.reset(turnstileWidgetId);
    submitStatus.textContent = '';
    submitStatus.dataset.state = '';
    sent = false;
  };
  form.querySelectorAll('input[name="kind"]').forEach(input => input.addEventListener('change', () => {
    resetFollowing(['topic','eventCode','bib','name','organization','paymentAt','email','phone','message']);
    reconcile();
  }));
  fields.topic.addEventListener('change', () => {
    resetFollowing(['eventCode','bib','name','organization','paymentAt','email','phone','message']);
    reconcile();
    if (fields.kind.value === 'photo' && !eventLoaded) loadEvents();
  });
  fields.eventCode.addEventListener('change', () => {
    resetFollowing(['bib','name','organization','paymentAt','email','phone','message']);
    reconcile();
  });
  ['bib','name','organization','paymentAt','email','phone','message'].forEach(name => fields[name].addEventListener('input', reconcile));
  fields.attachments.addEventListener('change', reconcile);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    reconcile();
    if (submit.disabled || !form.reportValidity()) return;
    submitting = true;
    submitStatus.textContent = '전송 중입니다.';
    submitStatus.dataset.state = '';
    reconcile();
    try {
      const payload = new FormData(form);
      if (fields.kind.value === 'photo') payload.set('eventName', fields.eventCode.selectedOptions[0]?.textContent?.trim() || '');
      const response = await fetch(submitEndpoint, {method:'POST',body:payload,headers:{Accept:'application/json'}});
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok !== true) throw new Error(result.message || '전송에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      sent = true;
      submitStatus.textContent = '문의가 전송되었습니다.';
      submitStatus.dataset.state = 'success';
    } catch (error) {
      submitStatus.textContent = error.message || '전송에 실패했습니다. 잠시 후 다시 시도해 주세요.';
      submitStatus.dataset.state = 'error';
    } finally {
      submitting = false;
      if (!sent && turnstileWidgetId !== null) {
        fields.turnstileToken.value = '';
        window.turnstile.reset(turnstileWidgetId);
      }
      reconcile();
    }
  });
  if (!submitEndpoint) {
    submitStatus.textContent = '전송 서버가 연결되지 않았습니다.';
    submitStatus.dataset.state = 'error';
  }
  reconcile();
})();
})();
