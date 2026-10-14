(() => {
  if (document.querySelector('.sot-contact')) return;
  const header = document.querySelector('section.section-header');
  const template = document.createElement('template');
  template.innerHTML = "<section class=\"sot-contact\" aria-labelledby=\"sot-contact-title\">\n  <div class=\"sot-contact__inner\">\n    <div class=\"sot-contact__info\">\n      <p class=\"sot-contact__eyebrow\">GET IN TOUCH</p>\n      <h1 id=\"sot-contact-title\">Contact us<span class=\"sot-contact__dot\">.</span></h1>\n      <p class=\"sot-contact__lead\">궁금한 점을 남겨주시면 확인 후 답변드리겠습니다.</p>\n      <div class=\"sot-contact__details\">\n        <a href=\"mailto:contact@plp.im\"><span class=\"sot-contact__icon\" aria-hidden=\"true\">✉</span><span>contact@plp.im</span></a>\n        <p><span class=\"sot-contact__icon\" aria-hidden=\"true\">⌖</span><span>경기도 안산시 단원구 선부광장1로 162, 435호</span></p>\n      </div>\n      <img class=\"sot-contact__map\" src=\"https://cdn.prod.website-files.com/691e5df3002228c301997066/697c4d37aca0ba7098604a50_ChatGPT%20Image%202026%E1%84%82%E1%85%A7%E1%86%AB%201%E1%84%8B%E1%85%AF%E1%86%AF%2030%E1%84%8B%E1%85%B5%E1%86%AF%20%E1%84%8B%E1%85%A9%E1%84%92%E1%85%AE%2003_18_17.png\" alt=\"\" loading=\"lazy\">\n    </div>\n\n    <div class=\"sot-contact__form-wrap\">\n      <h2>문의 내용</h2>\n      <p class=\"sot-contact__form-note\">아래 내용을 작성하면 이메일 앱에서 문의 메일을 열어드립니다.</p>\n      <form class=\"sot-contact__form\">\n        <div class=\"sot-contact__row\">\n          <label>성<span class=\"sot-contact__required\">*</span><input name=\"familyName\" type=\"text\" autocomplete=\"family-name\" required maxlength=\"40\"></label>\n          <label>이름<span class=\"sot-contact__required\">*</span><input name=\"givenName\" type=\"text\" autocomplete=\"given-name\" required maxlength=\"40\"></label>\n        </div>\n        <div class=\"sot-contact__row\">\n          <label>이메일<span class=\"sot-contact__required\">*</span><input name=\"email\" type=\"email\" autocomplete=\"email\" required maxlength=\"254\"></label>\n          <label>전화번호 <span class=\"sot-contact__optional\">선택</span><input name=\"phone\" type=\"tel\" autocomplete=\"tel\" inputmode=\"tel\" maxlength=\"30\"></label>\n        </div>\n        <label>문의 주제<span class=\"sot-contact__required\">*</span><select name=\"topic\" required><option value=\"\" selected disabled>선택해 주세요</option><option>사진 검색</option><option>구매·결제</option><option>다운로드</option><option>환불</option><option>기타</option></select></label>\n        <label>메시지<span class=\"sot-contact__required\">*</span><textarea name=\"message\" rows=\"7\" required maxlength=\"3000\" placeholder=\"대회명, 주문번호 등 확인에 필요한 정보와 문의 내용을 적어주세요.\"></textarea></label>\n        <p class=\"sot-contact__privacy\">문의 메일에는 작성하신 내용이 포함됩니다. 민감한 개인정보와 결제정보는 적지 말아주세요.</p>\n        <button type=\"submit\">이메일 앱에서 문의하기 <span aria-hidden=\"true\">↗</span></button>\n        <p class=\"sot-contact__after\">이메일 앱에서 ‘보내기’를 눌러야 접수됩니다. 앱이 열리지 않으면 <a href=\"mailto:contact@plp.im\">contact@plp.im</a>으로 직접 보내주세요.</p>\n      </form>\n    </div>\n  </div>\n</section>";
  const root = template.content.firstElementChild;
  if (!root) return;
  if (header) header.after(root);
  else document.body.prepend(root);
  [".contact-6"].forEach(selector => {
    const element = document.querySelector(selector);
    const section = element && element.closest('section');
    if (section && section !== root && section !== header) section.remove();
  });
  (() => {
    const form = document.querySelector('.sot-contact__form');
    if (!form || form.dataset.ready) return;
    form.dataset.ready = 'true';
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const fields = new FormData(form);
      const value = name => String(fields.get(name) || '').trim();
      const subject = `[샤라웃 문의] ${value('topic')}`;
      const body = [
        `이름: ${value('familyName')} ${value('givenName')}`,
        `이메일: ${value('email')}`,
        `전화번호: ${value('phone') || '미입력'}`,
        `문의 주제: ${value('topic')}`,
        '',
        value('message')
      ].join('\n');
      window.location.href = `mailto:contact@plp.im?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
  })();
})();
