(function () {
  const pages = [
    {
      title: '188 허브 홈',
      desc: '김상현 이사 188본부 메인페이지',
      href: '/'
    },
    {
      title: '프라임에셋 통합페이지',
      desc: 'AI 시스템 및 프라임에셋 업무 허브',
      href: '/ai_system/'
    },
    {
      title: '사업부 실적보드',
      desc: '프라임에셋사업부 2026년 실적 현황',
      href: '/performance/'
    },
    {
      title: '188본부 시스템안내서',
      desc: '입점 및 운영 시스템 안내',
      href: '/system/'
    },
    {
      title: '프리미엄 최신보험뉴스',
      desc: '보험뉴스와 최신 이슈 확인',
      href: '/news/'
    }
  ];

  function normalizePath(path) {
    if (!path || path === '/index.html') return '/';
    return path.replace(/\/index\.html$/, '/');
  }

  function closeMenu() {
    document.body.classList.remove('hub-menu-open');
    const toggle = document.querySelector('.hub-menu-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  function openMenu() {
    document.body.classList.add('hub-menu-open');
    const toggle = document.querySelector('.hub-menu-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
  }

  function init() {
    if (document.querySelector('.hub-menu-toggle')) return;

    document.body.classList.add('has-hub-menu');
    const current = normalizePath(window.location.pathname);
    const toggle = document.createElement('button');
    toggle.className = 'hub-menu-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', '하위페이지 메뉴 열기');
    toggle.setAttribute('aria-controls', 'hubMenuPanel');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<span></span><span></span><span></span>';

    const scrim = document.createElement('div');
    scrim.className = 'hub-menu-scrim';
    scrim.tabIndex = -1;

    const panel = document.createElement('aside');
    panel.className = 'hub-menu-panel';
    panel.id = 'hubMenuPanel';
    panel.setAttribute('aria-label', '188 하위페이지 메뉴');
    panel.innerHTML = [
      '<button class="hub-menu-close" type="button" aria-label="메뉴 닫기">&times;</button>',
      '<h2>188 페이지</h2>',
      '<nav class="hub-menu-list" aria-label="188 하위페이지">'
    ].join('');

    const list = panel.querySelector('.hub-menu-list');
    pages.forEach((page) => {
      const link = document.createElement('a');
      link.className = 'hub-menu-link';
      link.href = page.href;
      if (normalizePath(page.href) === current) {
        link.setAttribute('aria-current', 'page');
      }
      link.innerHTML = '<strong>' + page.title + '</strong><span>' + page.desc + '</span>';
      list.appendChild(link);
    });

    document.body.append(toggle, scrim, panel);
    toggle.addEventListener('click', () => {
      document.body.classList.contains('hub-menu-open') ? closeMenu() : openMenu();
    });
    scrim.addEventListener('click', closeMenu);
    panel.querySelector('.hub-menu-close').addEventListener('click', closeMenu);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
