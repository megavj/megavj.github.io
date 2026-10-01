/* 188 공용 메뉴 — MY 버튼 + 전체 메뉴(오른쪽 서랍) v4 (2026-10)
 * · 모든 페이지 공통. 페이지 목록·주소는 아래 pages 그대로(링크 주소를 바꾸지 말 것).
 * · 열면 닫기 버튼으로 초점이 가고, 탭 키는 서랍 안에서만 돈다. Esc·바깥 클릭으로 닫으면 메뉴 버튼으로 초점이 돌아온다.
 * · 서랍 아래에 김상현 이사 1:1 상담(카카오톡)·전화 버튼.
 */
(function () {
  const pages = [
    { title: '188 허브', desc: '김상현 이사 188본부 메인페이지', href: '/preview-v4-20261001/' },
    { title: '프라임에셋 통합페이지', desc: 'AI 시스템 및 프라임에셋 업무 허브', href: '/preview-v4-20261001/ai_system/' },
    { title: '프리미엄 보험보상 답변기', desc: '문서 기반 보험보상 실무 답변', href: '/preview-v4-20261001/claim/' },
    { title: '사업부 실적보드', desc: '프리미엄사업부 2026년 실적 현황', href: '/preview-v4-20261001/performance/' },
    { title: '188본부 시스템안내서', desc: '입점 및 운영 시스템 안내', href: '/preview-v4-20261001/system/' },
    {
      title: '프리미엄 상품통합분석기',
      desc: '상품·비교자료와 월간 이슈·제안 통합 분석',
      href: 'https://script.google.com/macros/s/AKfycbwxsEPxs_uq5H4gH43Ie_FH0mrKAtdkrnzP-30b52GKTBMXVzARfgggs6_klkyadIVl/exec',
      external: true
    },
    {
      title: '수당계산기',
      desc: '수수료·수당·환산율 기준 계산',
      href: 'https://script.google.com/macros/s/AKfycbz4ZR5EbyrzaIkOfhUR0Hqe0eTRokTf8Sa6ax9Q0paQlRPtJfmxG7AwC2RXIpUNq1XfYg/exec',
      external: true
    },
    { title: '프리미엄 최신보험뉴스', desc: '보험뉴스와 최신 이슈 확인', href: '/preview-v4-20261001/news/' },
    { title: '프리미엄사업부 공식페이지', desc: '프라임에셋 프리미엄사업부 공식 홈페이지', href: 'https://www.primeasset.info', external: true },
    { title: '보험노트 홈페이지', desc: '보험노트 공식 홈페이지', href: 'https://bohumnote.com', external: true },
    {
      title: '프리미엄 자료검색기',
      desc: '프리미엄 자료·문서 통합 검색',
      href: 'https://script.google.com/macros/s/AKfycbx2R0eWsh6J9MyUPZahLHJj1bDiSdh1Ei147OOVJ85fCVZv1R-RQCeYIYgrkLiy7eh_/exec',
      external: true
    },
    {
      title: '프리미엄 전산답변기',
      desc: '프리미엄 전산·IT 자동 답변 도구',
      href: '/preview-v4-20261001/itsys/'
    }
  ];
  const contact = {
    kakao: 'https://open.kakao.com/o/sFMF26y',
    tel: 'tel:01087149262',
    telLabel: '010-8714-9262'
  };

  function normalizePath(path) {
    if (!path || path === '/preview-v4-20261001/index.html') return '/preview-v4-20261001/';
    return path.replace(/\/index\.html$/, '/preview-v4-20261001/');
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function init() {
    if (document.querySelector('.hub-menu-toggle')) return;

    document.body.classList.add('has-hub-menu');
    const current = normalizePath(window.location.pathname);
    const myLink = el('a', 'hub-my-link', 'MY');
    myLink.href = '/preview-v4-20261001/my/';
    myLink.setAttribute('aria-label', 'MY 페이지 바로가기');
    if (current === '/preview-v4-20261001/my/') myLink.setAttribute('aria-current', 'page');

    const toggle = el('button', 'hub-menu-toggle');
    toggle.type = 'button';
    toggle.setAttribute('aria-label', '하위페이지 메뉴 열기');
    toggle.setAttribute('aria-controls', 'hubMenuPanel');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<span></span><span></span><span></span>';

    const scrim = el('div', 'hub-menu-scrim');
    scrim.tabIndex = -1;

    const panel = el('aside', 'hub-menu-panel');
    panel.id = 'hubMenuPanel';
    panel.setAttribute('aria-label', '188 하위페이지 메뉴');
    panel.setAttribute('aria-hidden', 'true');

    const close = el('button', 'hub-menu-close');
    close.type = 'button';
    close.setAttribute('aria-label', '메뉴 닫기');
    close.innerHTML = '&times;';

    const head = el('div', 'hub-menu-head');
    const mark = el('span', 'hub-menu-mark', '188');
    mark.setAttribute('aria-hidden', 'true');
    const titles = el('div');
    titles.append(el('p', 'hub-menu-kicker', 'PRIME ASSET · 188'), el('h2', '', '188 페이지'));
    head.append(mark, titles);

    const list = el('nav', 'hub-menu-list');
    list.setAttribute('aria-label', '188 하위페이지');
    pages.forEach((page) => {
      const link = el('a', 'hub-menu-link');
      link.href = page.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      if (normalizePath(page.href) === current) link.setAttribute('aria-current', 'page');
      const go = el('span', 'hub-menu-go', page.external ? '↗' : '→');
      go.setAttribute('aria-hidden', 'true');
      link.append(el('strong', '', page.title), el('span', '', page.desc), go);
      list.appendChild(link);
    });

    const cta = el('div', 'hub-menu-cta');
    const kakao = el('a', 'hub-menu-cta__main', '김상현 이사 1:1 상담 ↗');
    kakao.href = contact.kakao;
    kakao.target = '_blank';
    kakao.rel = 'noopener noreferrer';
    const call = el('a', 'hub-menu-cta__call', contact.telLabel);
    call.href = contact.tel;
    call.setAttribute('aria-label', '전화 상담 ' + contact.telLabel);
    cta.append(kakao, call);

    panel.append(close, head, list, cta);
    document.body.append(myLink, toggle, scrim, panel);

    let lastFocus = null;
    const focusables = () => Array.prototype.slice.call(panel.querySelectorAll('a[href], button:not([disabled])'));

    function openMenu() {
      lastFocus = document.activeElement;
      document.body.classList.add('hub-menu-open');
      toggle.setAttribute('aria-expanded', 'true');
      panel.setAttribute('aria-hidden', 'false');
      window.setTimeout(() => close.focus({ preventScroll: true }), 60);
    }

    function closeMenu() {
      if (!document.body.classList.contains('hub-menu-open')) return;
      document.body.classList.remove('hub-menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      panel.setAttribute('aria-hidden', 'true');
      if (panel.contains(document.activeElement)) (lastFocus && lastFocus.focus ? lastFocus : toggle).focus({ preventScroll: true });
    }

    toggle.addEventListener('click', () => {
      document.body.classList.contains('hub-menu-open') ? closeMenu() : openMenu();
    });
    scrim.addEventListener('click', closeMenu);
    close.addEventListener('click', closeMenu);
    document.addEventListener('keydown', (event) => {
      if (!document.body.classList.contains('hub-menu-open')) return;
      if (event.key === 'Escape') { closeMenu(); return; }
      if (event.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
