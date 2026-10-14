(() => {
  if (document.querySelector('.sot-contact')) return;
  const header = document.querySelector('section.section-header');
  const template = document.createElement('template');
  template.innerHTML = "<section class=\"sot-contact\" aria-labelledby=\"sot-contact-title\">\n  <div class=\"sot-contact__inner\">\n    <header class=\"sot-contact__heading\">\n      <p class=\"sot-contact__eyebrow\">GET IN TOUCH</p>\n      <h1 id=\"sot-contact-title\">Contact us<span class=\"sot-contact__dot\">.</span></h1>\n      <p>문의 주제를 선택하면 필요한 항목이 순서대로 열립니다.</p>\n    </header>\n    <div class=\"sot-contact__content\">\n      <div class=\"sot-contact__form-wrap\">\n        <form class=\"sot-contact__form\">\n          <div class=\"sot-contact__step\" data-step=\"topic\">\n            <label for=\"sot-contact-topic\">문의 주제 <span class=\"sot-contact__required\">*</span></label>\n            <select id=\"sot-contact-topic\" name=\"topic\" required><option value=\"\" selected disabled>선택해 주세요</option><option value=\"사진 검색\">사진 검색</option><option value=\"구매·결제\">구매·결제</option><option value=\"다운로드\">다운로드</option><option value=\"사진 삭제 요청\">사진 삭제 요청</option><option value=\"협업·제휴\">협업·제휴</option><option value=\"기타\">기타</option></select>\n          </div>\n          <div class=\"sot-contact__step\" data-step=\"event\" hidden>\n            <label for=\"sot-contact-event\">문의할 대회 <span class=\"sot-contact__required\">*</span></label>\n            <select id=\"sot-contact-event\" name=\"eventCode\" required disabled><option value=\"\">문의할 대회를 선택해 주세요</option></select>\n            <p class=\"sot-contact__status\" data-event-status role=\"status\" aria-live=\"polite\"></p>\n            <button class=\"sot-contact__retry\" type=\"button\" data-event-retry hidden>다시 불러오기</button>\n          </div>\n          <div class=\"sot-contact__step\" data-step=\"identity\" hidden>\n            <div class=\"sot-contact__row\">\n              <div data-field=\"bib\"><label for=\"sot-contact-bib\">배번호 <span class=\"sot-contact__required\">*</span></label><input id=\"sot-contact-bib\" name=\"bib\" type=\"text\" maxlength=\"20\" autocomplete=\"off\" placeholder=\"예: 1234\" disabled></div>\n              <div data-field=\"name\"><label for=\"sot-contact-name\">이름 <span class=\"sot-contact__required\">*</span></label><input id=\"sot-contact-name\" name=\"name\" type=\"text\" maxlength=\"80\" autocomplete=\"name\" placeholder=\"이름을 입력해 주세요\" required disabled></div>\n              <div data-field=\"organization\" hidden><label for=\"sot-contact-organization\">소속·단체명 <span class=\"sot-contact__optional\">선택</span></label><input id=\"sot-contact-organization\" name=\"organization\" type=\"text\" maxlength=\"120\" autocomplete=\"organization\" placeholder=\"회사 또는 단체명\" disabled></div>\n            </div>\n          </div>\n          <div class=\"sot-contact__step\" data-step=\"payment\" hidden>\n            <label for=\"sot-contact-payment\">결제 일시 (한국시간) <span class=\"sot-contact__required\">*</span></label>\n            <input id=\"sot-contact-payment\" name=\"paymentAt\" type=\"datetime-local\" required disabled>\n          </div>\n          <div class=\"sot-contact__step\" data-step=\"message\" hidden>\n            <label for=\"sot-contact-message\">문의 내용 <span class=\"sot-contact__required\">*</span></label>\n            <textarea id=\"sot-contact-message\" name=\"message\" rows=\"7\" maxlength=\"3000\" required disabled placeholder=\"확인에 필요한 내용과 문의 사항을 적어주세요.\"></textarea>\n            <p class=\"sot-contact__privacy\">문의 메일에는 작성하신 내용이 포함됩니다. 민감한 개인정보와 결제정보는 적지 말아주세요.</p>\n          </div>\n          <div class=\"sot-contact__step\" data-step=\"contact\" hidden>\n            <div class=\"sot-contact__row\">\n              <div><label for=\"sot-contact-email\">이메일 <span class=\"sot-contact__required\">*</span></label><input id=\"sot-contact-email\" name=\"email\" type=\"email\" maxlength=\"254\" autocomplete=\"email\" placeholder=\"답변받을 이메일\" required disabled></div>\n              <div><label for=\"sot-contact-phone\">연락처 <span class=\"sot-contact__optional\">선택</span></label><input id=\"sot-contact-phone\" name=\"phone\" type=\"tel\" maxlength=\"30\" autocomplete=\"tel\" inputmode=\"tel\" placeholder=\"선택 입력\" disabled></div>\n            </div>\n            <button class=\"sot-contact__submit\" type=\"submit\" disabled>이메일 앱에서 문의하기 <span aria-hidden=\"true\">↗</span></button>\n            <p class=\"sot-contact__after\">이메일 앱에서 ‘보내기’를 눌러야 접수됩니다. 앱이 열리지 않으면 <a href=\"mailto:contact@plp.im\">contact@plp.im</a>으로 직접 보내주세요.</p>\n          </div>\n        </form>\n      </div>\n    </div>\n  </div>\n</section>";
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
  const endpoint = 'https://plp-62309.bubbleapps.io/api/1.1/obj/event';
  const fields = Object.fromEntries(['topic','eventCode','bib','name','organization','paymentAt','message','email','phone'].map(name => [name, form.elements.namedItem(name)]));
  const steps = Object.fromEntries([...form.querySelectorAll('[data-step]')].map(step => [step.dataset.step, step]));
  const status = root.querySelector('[data-event-status]');
  const retry = root.querySelector('[data-event-retry]');
  const submit = root.querySelector('.sot-contact__submit');
  const raceTopics = new Set(['사진 검색','구매·결제','다운로드','사진 삭제 요청']);
  let eventLoaded = false;
  let eventLoading = false;
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
    const topic = fields.topic.value;
    const hasTopic = Boolean(topic);
    const raceTopic = raceTopics.has(topic);
    const paymentTopic = fields.topic.value === '구매·결제';
    setStep('event', hasTopic && raceTopic);
    const showIdentity = hasTopic && (!raceTopic || Boolean(fields.eventCode.value));
    setStep('identity', showIdentity);
    setField('bib', showIdentity && raceTopic, raceTopic);
    setField('organization', showIdentity && topic === '협업·제휴', false);
    const hasIdentity = showIdentity && Boolean(fields.name.value.trim()) && (!raceTopic || Boolean(fields.bib.value.trim()));
    setStep('payment', hasIdentity && paymentTopic);
    const showMessage = hasIdentity && (!paymentTopic || Boolean(fields.paymentAt.value));
    setStep('message', showMessage);
    const showContact = showMessage && Boolean(fields.message.value.trim());
    setStep('contact', showContact);
    submit.disabled = !(showContact && Boolean(fields.email.value.trim()) && fields.email.validity.valid);
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
        const url = new URL(endpoint);
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
  fields.topic.addEventListener('change', () => {
    ['eventCode','bib','name','organization','paymentAt','message','email','phone'].forEach(name => { fields[name].value = ''; });
    reconcile();
    if (raceTopics.has(fields.topic.value) && !eventLoaded) loadEvents();
  });
  fields.eventCode.addEventListener('change', () => {
    ['bib','name','organization','paymentAt','message','email','phone'].forEach(name => { fields[name].value = ''; });
    reconcile();
  });
  ['bib','name','organization','paymentAt','message','email','phone'].forEach(name => fields[name].addEventListener('input', reconcile));
  form.addEventListener('submit', event => {
    event.preventDefault();
    reconcile();
    if (steps.contact.hidden || submit.disabled || !form.reportValidity()) return;
    const value = name => fields[name].value.trim();
    const raceTopic = raceTopics.has(value('topic'));
    const selectedEvent = raceTopic ? (fields.eventCode.selectedOptions[0]?.textContent?.trim() || value('eventCode')) : '';
    const subject = `[샤라웃 문의] ${value('topic')}${raceTopic ? ` · ${selectedEvent}` : ''}`;
    const body = [
      `문의 주제: ${value('topic')}`,
      ...(raceTopic ? [`문의 대회: ${selectedEvent} (${value('eventCode')})`, `배번호: ${value('bib')}`] : []),
      `이름: ${value('name')}`,
      ...(value('topic') === '협업·제휴' && value('organization') ? [`소속·단체명: ${value('organization')}`] : []),
      ...(value('topic') === '구매·결제' ? [`결제 일시 (한국시간): ${value('paymentAt').replace('T', ' ')}`] : []),
      `문의 내용:`, value('message'),
      '',
      `이메일: ${value('email')}`,
      `연락처: ${value('phone') || '미입력'}`,
    ].join('\n');
    window.location.href = `mailto:contact@plp.im?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });
  reconcile();
})();
})();
