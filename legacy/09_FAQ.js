(() => {
  if (document.querySelector('.sot-faq')) return;
  const header = document.querySelector('section.section-header');
  const template = document.createElement('template');
  template.innerHTML = "<section class=\"sot-faq\" aria-labelledby=\"sot-faq-title\">\n  <div class=\"sot-faq__inner\">\n    <div class=\"sot-faq__intro\">\n      <p class=\"sot-faq__eyebrow\">HELP CENTER</p>\n      <h1 id=\"sot-faq-title\">자주 묻는 질문</h1>\n      <p>궁금한 내용을 빠르게 찾아보세요.</p>\n    </div>\n\n    <div class=\"sot-faq__categories\" aria-label=\"FAQ 카테고리\">\n      <button type=\"button\" class=\"is-active\" data-category=\"전체\" aria-pressed=\"true\">전체</button>\n      <button type=\"button\" data-category=\"가격\" aria-pressed=\"false\">가격</button>\n      <button type=\"button\" data-category=\"구매\" aria-pressed=\"false\">구매</button>\n      <button type=\"button\" data-category=\"환불\" aria-pressed=\"false\">환불</button>\n      <button type=\"button\" data-category=\"다운로드\" aria-pressed=\"false\">다운로드</button>\n      <button type=\"button\" data-category=\"검색\" aria-pressed=\"false\">검색</button>\n    </div>\n\n    <div class=\"sot-faq__list\">\n      <details class=\"sot-faq__item\" data-category=\"검색\">\n        <summary><span class=\"sot-faq__question\">참가 번호가 기억나지 않아요. 어떻게 확인하나요?</span><span class=\"sot-faq__toggle\" aria-hidden=\"true\"></span></summary>\n        <div class=\"sot-faq__answer\">현재 주최 측과 참가자의 개인정보를 공유하지 않아 샤라웃에서 참가 번호를 확인해 드리기는 어렵습니다. 참가 번호는 대회 주최 측의 안내 또는 신청 내역에서 확인해 주세요.</div>\n      </details>\n      <details class=\"sot-faq__item\" data-category=\"환불\">\n        <summary><span class=\"sot-faq__question\">사진이 마음에 들지 않으면 환불할 수 있나요?</span><span class=\"sot-faq__toggle\" aria-hidden=\"true\"></span></summary>\n        <div class=\"sot-faq__answer\">디지털 사진은 제공이 시작된 뒤 복제와 회수가 어려워 단순 변심에 따른 환불이 제한될 수 있습니다. 파일이 제공되지 않거나 이용에 문제가 있다면 <a href=\"/menu/contact\">문의 페이지</a>로 주문 정보와 함께 알려주세요.</div>\n      </details>\n    </div>\n\n    <p class=\"sot-faq__empty\" hidden>이 카테고리에 등록된 질문이 없습니다.</p>\n    <div class=\"sot-faq__help\"><div><strong>원하는 답변을 찾지 못하셨나요?</strong><p>문의 내용을 남겨주시면 확인 후 답변드리겠습니다.</p></div><a href=\"/menu/contact\">문의하기 <span aria-hidden=\"true\">↗</span></a></div>\n  </div>\n</section>";
  const root = template.content.firstElementChild;
  if (!root) return;
  if (header) header.after(root);
  else document.body.prepend(root);
  [".faq-tlte-wrapper", ".section-35"].forEach(selector => {
    const element = document.querySelector(selector);
    const section = element && element.closest('section');
    if (section && section !== root && section !== header) section.remove();
  });
  (() => {
    const root = document.querySelector('.sot-faq');
    if (!root || root.dataset.ready) return;
    root.dataset.ready = 'true';
    const buttons = [...root.querySelectorAll('.sot-faq__categories button[data-category]')];
    const items = [...root.querySelectorAll('.sot-faq__item')];
    const empty = root.querySelector('.sot-faq__empty');
    buttons.forEach(button => button.addEventListener('click', () => {
      const category = button.dataset.category;
      buttons.forEach(candidate => {
        const active = candidate === button;
        candidate.classList.toggle('is-active', active);
        candidate.setAttribute('aria-pressed', String(active));
      });
      let visible = 0;
      items.forEach(item => {
        item.hidden = category !== '전체' && item.dataset.category !== category;
        if (!item.hidden) visible++;
      });
      empty.hidden = visible > 0;
    }));
  })();
})();
