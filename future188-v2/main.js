// 프라임에셋 188본부 홈(/) — 화면 연출 v4 (2026-10)
// · GSAP·Lenis 없이 IntersectionObserver + CSS(transform/opacity)로 등장·카운트업. 스크롤은 브라우저 기본(가장 부드럽고 가볍다).
// · 계속 도는 효과(커서 금가루·상담 영역 금가루·프리즘 글자)는 필요할 때만 돌고, 화면 밖이거나 탭이 숨으면 멈춘다.
// · hero "188" 금가루는 hero188.js(동적 import) — 빈 자리(.hero-mark)에 맞춰 놓인다. 실패하면 정적 금빛 188(.webgl-fallback).
// · 숫자는 HTML 에 적힌 값이 정답(perf188/perf_sync.py 가 관리). 여기서는 0부터 그 숫자까지 세어 올리기만 한다.
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const root = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width:800px)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const hasIO = 'IntersectionObserver' in window;
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const safe = (name, fn) => {
  try { return fn(); } catch (e) { console.warn(`[188] ${name} 건너뜀:`, e); return undefined; }
};

/* ───────────── 첫 방문 인트로 ─────────────
   세션당 한 번 0 → 188 을 세고 사라진다(약 2.4초). 다시 오면 <head> 인라인 스크립트가 .p188-seen 으로 처음부터 숨긴다. */
function preload() {
  return new Promise(resolve => {
    const wrap = $('.preloader'), num = wrap && $('span', wrap);
    if (!wrap || !num || root.classList.contains('p188-seen') || reduced) { if (wrap) wrap.remove(); resolve(); return; }
    const COUNT_MS = 1800, start = performance.now();
    const finish = () => {
      num.textContent = '188';
      num.classList.add('spark');
      try { sessionStorage.setItem('p188_seen', '1'); } catch (e) { /* 사생활 보호 모드 등 */ }
      setTimeout(() => {
        wrap.classList.add('is-done');
        setTimeout(() => wrap.remove(), 560);
        resolve();
      }, 640);
    };
    const tick = now => {
      const p = Math.min(1, (now - start) / COUNT_MS), k = 1 - Math.pow(1 - p, 3);
      num.textContent = String(Math.min(188, Math.floor(189 * k)));
      wrap.style.setProperty('--p', k.toFixed(3));
      if (p < 1) requestAnimationFrame(tick); else finish();
    };
    requestAnimationFrame(tick);
  });
}

/* ───────────── hero 188 금가루 ───────────── */
function initHero188() {
  const canvas = $('#hero-canvas');
  if (!canvas) return Promise.resolve(null);
  const fallback = () => { document.body.classList.add('webgl-fallback'); return null; };
  return import('./hero188.js?v=20261001-v4')
    .then(m => m.createHero188({ canvas, reduced, mobile, slot: $('[data-hero188-slot]') }))
    .then(h => h || fallback())
    .catch(e => { console.warn('[hero188] 정적 188로 대체:', e); return fallback(); });
}

/* ───────────── 등장 연출 ─────────────
   화면에 들어오면 .is-in → CSS 가 opacity·translate 로 떠오르게 한다. 같은 묶음 안에서는 0.07초씩 차례로. */
// late: 스크립트가 늦게 떠서 CSS 안전장치(3.5초)가 이미 다 보여 준 경우 → 다시 숨기지 않고 그대로 둔다.
function initReveal(late = false) {
  const items = $$('.reveal').filter(el => !el.closest('.hero'));
  const groups = new Map();
  items.forEach(el => {
    const n = groups.get(el.parentElement) || 0;
    groups.set(el.parentElement, n + 1);
    el.style.setProperty('--d', `${(Math.min(n, 5) * 0.07).toFixed(2)}s`);
  });
  const show = el => el.classList.add('is-in');
  if (late || reduced || !hasIO) { items.forEach(show); return; }
  const ob = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    ob.unobserve(e.target);
    show(e.target);
  }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  items.forEach(el => ob.observe(el));
}

// 0 → HTML 에 적힌 숫자까지 세어 올린 뒤, 마지막에는 원래 글자를 그대로 되돌려 놓는다.
function countUp(els, delay = 0) {
  if (reduced) return;
  els.forEach(el => {
    const raw = el.dataset.count || '', end = parseFloat(raw), final = el.textContent;
    if (!Number.isFinite(end) || el.dataset.counted) return;
    el.dataset.counted = '1';
    const dec = (raw.split('.')[1] || '').length;
    el.textContent = (0).toFixed(dec);
    setTimeout(() => {
      const t0 = performance.now(), dur = 1500;
      const step = now => {
        const p = Math.min(1, (now - t0) / dur), k = 1 - Math.pow(1 - p, 3);
        el.textContent = p < 1 ? (end * k).toFixed(dec) : final;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, delay);
  });
}

// hero 바깥의 [data-count] 는 화면에 들어올 때 센다(hero 안은 인트로가 끝날 때 heroIntro 가 센다).
function initCountUp() {
  const els = $$('[data-count]').filter(el => !el.closest('.hero'));
  if (!els.length || reduced) return;
  if (!hasIO) { countUp(els); return; }
  const ob = new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    ob.unobserve(e.target);
    countUp([e.target]);
  }), { threshold: 0.5 });
  els.forEach(el => ob.observe(el));
}

function heroIntro() {
  document.body.classList.add('hero-in');
  $$('.hero .reveal').forEach((el, i) => {
    el.style.setProperty('--d', `${(0.2 + i * 0.08).toFixed(2)}s`);
    el.classList.add('is-in');
  });
  countUp($$('.hero [data-count]'), 500);
}

/* ───────────── 상단 메뉴: 배경 · 스크롤 진행선 · 지금 보는 섹션 표시 ───────────── */
function initNav() {
  const nav = $('.nav'), bar = $('.scroll-progress i');
  let ticking = false, max = 1;
  const measure = () => { max = Math.max(1, root.scrollHeight - innerHeight); };
  const update = () => {
    ticking = false;
    const y = scrollY;
    if (nav) nav.classList.toggle('is-scrolled', y > 24);
    if (bar) bar.style.transform = `scaleX(${clamp01(y / max).toFixed(4)})`;
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { measure(); onScroll(); }, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(() => { measure(); onScroll(); }).observe(document.body);
  measure();
  update();

  const links = new Map($$('.nav nav a[href^="#"]').map(a => [a.getAttribute('href').slice(1), a]));
  if (!hasIO || !links.size) return;
  const ob = new IntersectionObserver(entries => entries.forEach(e => {
    const a = links.get(e.target.id);
    if (a) a.classList.toggle('is-current', e.isIntersecting);
  }), { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((a, id) => { const s = document.getElementById(id); if (s) ob.observe(s); });
}

/* ───────────── 마우스 반응: 자석 버튼 · 카드 조명/기울기 ─────────────
   한 프레임에 한 번만 계산하고, 버튼은 translate·카드는 CSS 변수만 바꾼다(레이아웃 재계산 없음). */
function initMagnetic() {
  if (!finePointer || reduced) return;
  $$('.magnetic').forEach(el => {
    let raf = 0, ev = null;
    const apply = () => {
      raf = 0;
      if (!ev) return;
      const r = el.getBoundingClientRect();
      const x = (ev.clientX - r.left - r.width / 2) * 0.12, y = (ev.clientY - r.top - r.height / 2) * 0.18;
      el.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    };
    el.addEventListener('pointermove', e => { ev = e; if (!raf) raf = requestAnimationFrame(apply); }, { passive: true });
    el.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); raf = 0; ev = null; el.style.translate = ''; });
  });
}

function bindCardLight(card, tilt = 6) {
  if (!finePointer || reduced) return;
  let raf = 0, ev = null;
  const apply = () => {
    raf = 0;
    if (!ev) return;
    const r = card.getBoundingClientRect();
    const x = clamp01((ev.clientX - r.left) / r.width), y = clamp01((ev.clientY - r.top) / r.height);
    card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
    card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    card.style.setProperty('--rx', `${((0.5 - y) * tilt).toFixed(2)}deg`);
    card.style.setProperty('--ry', `${((x - 0.5) * tilt).toFixed(2)}deg`);
  };
  card.addEventListener('pointermove', e => { ev = e; if (!raf) raf = requestAnimationFrame(apply); }, { passive: true });
  card.addEventListener('pointerleave', () => {
    cancelAnimationFrame(raf);
    raf = 0;
    ev = null;
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  });
}

/* ───────────── 커서 금가루(데스크톱 마우스만) ─────────────
   마우스를 움직일 때만 그리고, 금가루가 다 사라지면 그리기를 멈춘다(예전처럼 화면 전체를 매 프레임 지우지 않음).
   빛 번짐은 미리 한 번 그려 둔 작은 그림(sprite)을 찍어서 가볍게. */
function initGoldenCursor() {
  const canvas = $('#spark-cursor');
  if (!canvas) return;
  if (reduced || !finePointer) { canvas.remove(); return; }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const unit = $('.contact-unit'), button = $('.meeting-orbit');
  const makeSprite = hue => {
    const s = document.createElement('canvas');
    s.width = s.height = 64;
    const g = s.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, `hsla(${hue}, 100%, 92%, 1)`);
    r.addColorStop(0.2, `hsla(${hue}, 90%, 68%, .85)`);
    r.addColorStop(1, `hsla(${hue}, 90%, 54%, 0)`);
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
    return s;
  };
  const sprites = [makeSprite(46), makeSprite(38)];
  const sparks = [], MAX = 160;
  let w = 0, h = 0, raf = 0, mx = 0, my = 0, lx = -1, ly = -1, moved = false, unitOn = false;
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    w = innerWidth; h = innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const add = (x, y, force) => {
    const n = Math.max(1, Math.round(force * 1.6));
    for (let i = 0; i < n; i++) {
      const life = 28 + Math.random() * 26;
      sparks.push({ x, y, vx: (Math.random() - 0.5) * (1.2 + force), vy: (Math.random() - 0.5) * (1.2 + force) - 0.25, r: 3 + Math.random() * 10, life, max: life, s: Math.random() > 0.25 ? 0 : 1 });
    }
    if (sparks.length > MAX) sparks.splice(0, sparks.length - MAX);
  };
  const frame = () => {
    raf = 0;
    if (moved) {
      moved = false;
      const speed = lx < 0 ? 0 : Math.min(4, Math.hypot(mx - lx, my - ly) / 12);
      add(mx, my, 0.6 + speed);
      lx = mx; ly = my;
      if (unitOn && unit) {
        const r = unit.getBoundingClientRect();
        unit.style.setProperty('--px', `${(mx - r.left).toFixed(0)}px`);
        unit.style.setProperty('--py', `${(my - r.top).toFixed(0)}px`);
      }
    }
    ctx.clearRect(0, 0, w, h);
    if (!sparks.length) return;                       // 다 사라지면 멈춘다 — 다음 움직임 때 다시 시작
    ctx.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx; s.y += s.vy; s.vx *= 0.985; s.vy = s.vy * 0.985 + 0.006;
      if (--s.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.globalAlpha = Math.pow(s.life / s.max, 1.8);
      ctx.drawImage(sprites[s.s], s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    raf = requestAnimationFrame(frame);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY; moved = true;
    kick();
  }, { passive: true });
  if (button && unit) {
    let braf = 0, bev = null;
    button.addEventListener('pointerenter', () => {
      unit.classList.add('is-hot');
      const r = button.getBoundingClientRect();
      for (let i = 0; i < 60; i++) {
        const a = Math.random() * Math.PI * 2, rad = r.width * (0.42 + Math.random() * 0.18);
        add(r.left + r.width / 2 + Math.cos(a) * rad, r.top + r.height / 2 + Math.sin(a) * rad, 2.6);
      }
      kick();
    });
    button.addEventListener('pointermove', e => {
      bev = e;
      if (braf) return;
      braf = requestAnimationFrame(() => {
        braf = 0;
        if (!bev) return;
        const r = button.getBoundingClientRect(), x = bev.clientX - r.left - r.width / 2, y = bev.clientY - r.top - r.height / 2;
        button.style.transform = `translate3d(${(x * 0.075).toFixed(1)}px, ${(y * 0.075).toFixed(1)}px, 0)`;
      });
    }, { passive: true });
    button.addEventListener('pointerleave', () => {
      cancelAnimationFrame(braf);
      braf = 0; bev = null;
      unit.classList.remove('is-hot');
      button.style.transform = '';
    });
    if (hasIO) new IntersectionObserver(es => { unitOn = es[es.length - 1].isIntersecting; }).observe(unit);
  }
  resize();
  addEventListener('resize', resize, { passive: true });
}

/* ───────────── 프리즘 글자 ─────────────
   제목 위에 마우스(터치)를 올린 동안만 무지개빛이 따라온다. 떠나면 계산을 멈춘다. */
function initPrismText() {
  if (reduced) return;
  $$('.prism-text').forEach(el => {
    let px = 0, py = 0, tx = 0.5, ty = 0.5, cx = 0.5, cy = 0.5, raf = 0, on = false, fade = 0;
    const loop = () => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) { tx = clamp01((px - r.left) / r.width); ty = clamp01((py - r.top) / r.height); }
      cx += (tx - cx) * 0.15; cy += (ty - cy) * 0.15;
      el.style.setProperty('--prism-x', `${(cx * 100).toFixed(2)}%`);
      el.style.setProperty('--prism-y', `${(cy * 100).toFixed(2)}%`);
      raf = on ? requestAnimationFrame(loop) : 0;
    };
    const hide = () => { on = false; el.style.setProperty('--prism-opacity', '0'); };
    const show = (e, temporary) => {
      px = e.clientX; py = e.clientY;
      if (!on) {
        on = true;
        const r = el.getBoundingClientRect();
        if (r.width && r.height) { cx = tx = clamp01((px - r.left) / r.width); cy = ty = clamp01((py - r.top) / r.height); }
        el.style.setProperty('--prism-opacity', '.94');
      }
      if (!raf) raf = requestAnimationFrame(loop);
      clearTimeout(fade);
      if (temporary) fade = setTimeout(hide, 1000);
    };
    el.addEventListener('pointerenter', e => show(e, e.pointerType !== 'mouse'), { passive: true });
    el.addEventListener('pointermove', e => show(e, e.pointerType !== 'mouse'), { passive: true });
    el.addEventListener('pointerdown', e => show(e, e.pointerType !== 'mouse'), { passive: true });
    el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); }, { passive: true });
  });
}

/* ───────────── 업무 도구 허브 ─────────────
   16개 도구를 들어올 때마다 무작위 순서로 보여 준다(1·6·11번째는 큰 카드). 주소는 아래 목록 그대로. */
const TOOLS_CONFIG = [
  { name: '188본부 시스템 안내서', description: '188본부 시스템 종합 안내', type: 'copy', url: 'https://188.primeasset.info/system/', category: 'website' },
  { name: '프라임에셋 188본부 허브홈페이지', description: '188본부 공식 업무 허브', type: 'link', url: 'https://188.primeasset.info/', category: 'website' },
  { name: '프리미엄 최신보험뉴스', description: '최신 보험뉴스·마케팅 팁', type: 'link', url: 'https://188.primeasset.info/news/', category: 'website' },
  { name: '프리미엄사업부 실적보드', description: '사업부 실적 현황', type: 'link', url: 'https://188.primeasset.info/performance/', category: 'website' },
  { name: 'AI영업비서 — 프리미엄 실전상담 통합코치', description: '상담·화법·코칭 통합도구', type: 'link', url: 'https://script.google.com/macros/s/AKfycbyKIz_hvVDlcVscBdGbJ1VCZIHRSz6yrLqRxyAH8WzJfqfQwdVMC-emgg2mPTxVPIk/exec', category: 'ai tool' },
  { name: '프리미엄 보험보상 답변기', description: '보험금 청구·보상 답변', type: 'link', url: 'https://188.primeasset.info/claim/', category: 'ai tool' },
  { name: '프리미엄 상품통합분석기', description: '보험상품·소식지 통합분석', type: 'link', url: 'https://script.google.com/macros/s/AKfycbwxsEPxs_uq5H4gH43Ie_FH0mrKAtdkrnzP-30b52GKTBMXVzARfgggs6_klkyadIVl/exec', category: 'ai tool' },
  { name: 'AI영업비서 — NH종수술 답변기', description: 'NH종수술 실무 답변', type: 'locked', url: '', category: 'ai tool' },
  { name: '실전 질병정보·화법도우미(Gem)', description: '질병정보·상담화법 안내', type: 'locked', url: '', category: 'ai tool' },
  { name: '실손의료비 답변기', description: '실손의료비 실무 답변', type: 'locked', url: '', category: 'ai tool' },
  { name: '실전 DB영업 화법도우미(Gem)', description: 'DB영업 상담화법 안내', type: 'locked', url: '', category: 'ai tool' },
  { name: '프리미엄 전산답변기', description: '전산·IT 질문 답변', type: 'link', url: 'https://188.primeasset.info/itsys/', category: 'ai tool' },
  { name: '고지의무 판독기', description: '고지사항 판독·안내', type: 'locked', url: '', category: 'ai tool' },
  { name: '프리미엄 자료검색기', description: '보유자료 통합 검색', type: 'link', url: 'https://script.google.com/macros/s/AKfycbx2R0eWsh6J9MyUPZahLHJj1bDiSdh1Ei147OOVJ85fCVZv1R-RQCeYIYgrkLiy7eh_/exec', category: 'web app' },
  { name: '프리미엄 통합페이지', description: '웹앱·사이트·매뉴얼 모음', type: 'link', url: 'https://188.primeasset.info/ai_system/', category: 'web app' },
  { name: '프리미엄 수당계산기', description: '예상 수수료·수당 계산', type: 'link', url: 'https://script.google.com/macros/s/AKfycbz4ZR5EbyrzaIkOfhUR0Hqe0eTRokTf8Sa6ax9Q0paQlRPtJfmxG7AwC2RXIpUNq1XfYg/exec', category: 'web app' }
];
const SVG_OPEN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">';
const TOOL_KINDS = {
  website: { label: '웹사이트', icon: `${SVG_OPEN}<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.5 3.9 5.5 3.9 9s-1.3 6.5-3.9 9c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3z"/></svg>` },
  'ai tool': { label: 'AI 도구', icon: `${SVG_OPEN}<path d="M12 3.5l1.7 4.8 4.8 1.7-4.8 1.7L12 16.5l-1.7-4.8L5.5 10l4.8-1.7z"/><path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>` },
  'web app': { label: '웹앱', icon: `${SVG_OPEN}<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>` },
  internal: { label: '내부 전용', icon: `${SVG_OPEN}<rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>` }
};
const kindOf = item => (item.type === 'locked' ? 'internal' : item.category);

function initToolsHub() {
  const section = $('#tools'), grid = $('[data-tools-grid]'), toast = $('.tools-toast'), legend = $('[data-tools-legend]');
  if (!section || !grid) return;
  const items = [...TOOLS_CONFIG];
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  window.__TOOLS_ORDER__ = items.map(item => item.name);
  window.__TOOLS_CONFIG__ = TOOLS_CONFIG;

  if (legend) {
    const counts = {};
    TOOLS_CONFIG.forEach(item => { const k = kindOf(item); counts[k] = (counts[k] || 0) + 1; });
    legend.innerHTML = Object.keys(TOOL_KINDS).filter(k => counts[k]).map(k => `<li>${TOOL_KINDS[k].icon}${TOOL_KINDS[k].label} <b>${counts[k]}</b></li>`).join('');
  }

  const largeSlots = new Set([0, 5, 10]);
  let toastTimer = 0;
  const showToast = () => {
    if (!toast) return;
    toast.classList.add('is-active');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-active'), 1500);
  };
  const copyUrl = async url => {
    try { await navigator.clipboard.writeText(url); } catch (e) {
      const input = document.createElement('textarea');
      input.value = url;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    showToast();
  };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  items.forEach((item, index) => {
    const kind = TOOL_KINDS[kindOf(item)] || TOOL_KINDS.website;
    const large = largeSlots.has(index);
    const card = el(item.type === 'link' ? 'a' : 'article', `tools-card${large ? ' is-large' : ''}${item.type === 'locked' ? ' is-locked' : ''}`);
    card.style.setProperty('--delay', `${index * 0.06}s`);
    card.dataset.toolName = item.name;
    card.dataset.toolType = item.type;
    if (item.type === 'link') { card.href = item.url; card.target = '_blank'; card.rel = 'noopener noreferrer'; }

    const top = el('div', 'tools-card__top');
    const type = el('span', 'tools-card__type');
    type.innerHTML = kind.icon;
    type.append(item.type === 'locked' ? 'internal' : item.category);
    top.append(el('span', 'tools-card__number', String(index + 1).padStart(2, '0')), type);

    const body = el('div', 'tools-card__body');
    body.append(el('h3', '', item.name), el('p', '', item.description));

    const action = el('div', 'tools-card__action');
    if (item.type === 'locked') {
      const lock = el('span', 'tools-card__lock');
      lock.innerHTML = TOOL_KINDS.internal.icon;
      lock.append('내부 전용');
      action.append(lock);
    } else if (item.type === 'copy') {
      const button = el('button', 'tools-card__copy', '링크 복사');
      button.type = 'button';
      button.addEventListener('click', () => copyUrl(item.url));
      action.append(button);
    } else {
      const arrow = el('span', 'tools-card__arrow', '↗');
      arrow.setAttribute('aria-hidden', 'true');
      action.append(el('span', '', '새 탭 열기'), arrow);
      const copy = el('button', 'tools-card__copy', '링크 복사');
      copy.type = 'button';
      copy.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); copyUrl(item.url); });
      card.append(copy);
    }
    if (large) {
      const glyph = el('span', 'tools-card__glyph');
      glyph.innerHTML = kind.icon;
      card.append(glyph);
    }
    card.append(top, body, action);
    grid.append(card);
    bindCardLight(card, 10);
  });

  const reveal = () => {
    section.classList.add('tools-visible');
    $$('.tools-card', grid).forEach(card => {
      if (reduced) { card.classList.add('is-visible'); return; }
      setTimeout(() => card.classList.add('is-visible'), Number.parseFloat(card.style.getPropertyValue('--delay')) * 1000);
    });
  };
  if (reduced || !hasIO) { reveal(); return; }
  const ob = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting)) { reveal(); ob.disconnect(); }
  }, { threshold: 0.12 });
  ob.observe(grid);
}

/* ───────────── 상담 영역 금가루 ─────────────
   화면에 보일 때만 그린다. 가루는 상담 버튼(금빛 원) 쪽으로 천천히 모였다가 다시 흩어진다. */
function initCTA() {
  const c = $('#cta-canvas'), sec = c && c.closest('section');
  if (!c || !sec) return;
  const x = c.getContext('2d');
  if (!x) return;
  const N = mobile ? 70 : 160;
  let pts = [], W = 0, H = 0, tx = 0, ty = 0, raf = 0, on = false;
  const target = () => {
    const o = $('.meeting-orbit', sec), cr = c.getBoundingClientRect();
    if (o) { const r = o.getBoundingClientRect(); tx = r.left + r.width / 2 - cr.left; ty = r.top + r.height / 2 - cr.top; } else { tx = W / 2; ty = H * 0.68; }
  };
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = c.clientWidth; H = c.clientHeight;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    target();
    pts = Array.from({ length: N }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 0.2 + Math.random() * 0.45 }));
  };
  const paint = () => {
    x.clearRect(0, 0, W, H);
    x.fillStyle = 'rgba(201,162,39,.45)';
    for (const p of pts) x.fillRect(p.x, p.y, 1.2, 1.2);
  };
  const draw = () => {
    raf = 0;
    if (!on || document.hidden) return;
    for (const p of pts) {
      p.x += (tx - p.x) * 0.00045 * p.v;
      p.y += (ty - p.y) * 0.00045 * p.v;
      if (Math.hypot(p.x - tx, p.y - ty) < 35) { p.x = Math.random() * W; p.y = Math.random() * H; }
    }
    paint();
    raf = requestAnimationFrame(draw);
  };
  const sync = () => { if (on && !reduced && !raf && !document.hidden) raf = requestAnimationFrame(draw); };
  let rz = 0;
  const onResize = () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(() => { resize(); if (reduced || !on) paint(); }); };
  resize();
  paint();
  addEventListener('resize', onResize, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(sec);
  document.addEventListener('visibilitychange', sync);
  if (!hasIO) { on = true; sync(); return; }
  new IntersectionObserver(es => { on = es[es.length - 1].isIntersecting; if (on) target(); sync(); }, { rootMargin: '80px 0px' }).observe(sec);
}

/* ───────────── 따라오는 상담 버튼 ─────────────
   첫 화면의 상담 버튼이 위로 지나가면 나타나고, 마지막 상담 영역에 오면 겹치지 않게 숨는다. */
function initStickyCTA() {
  const bar = $('[data-sticky-cta]'), heroCta = $('.hero-actions'), contact = $('#contact');
  if (!bar || !heroCta || !hasIO) return;
  let past = false, atContact = false;
  const sync = () => bar.classList.toggle('is-on', past && !atContact);
  const ob = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.target === heroCta) past = !e.isIntersecting && e.boundingClientRect.top < 0;
      else atContact = e.isIntersecting;
    });
    sync();
  }, { threshold: 0 });
  ob.observe(heroCta);
  if (contact) ob.observe(contact);
}

/* ───────────── 화면 밖이면 CSS 반복 연출 멈춤 ───────────── */
function initPause() {
  if (!hasIO) return;
  const ob = new IntersectionObserver(entries => entries.forEach(e => e.target.classList.toggle('is-off', !e.isIntersecting)), { rootMargin: '120px 0px' });
  $$('[data-anim-zone]').forEach(el => ob.observe(el));
}

/* ───────────── 실적 섹션 뒤 큰 숫자: 스크롤에 따라 천천히 옆으로(보일 때만 계산) ───────────── */
function initParallax() {
  const num = $('.performance-number'), sec = $('#performance');
  if (!num || !sec || reduced || !hasIO) return;
  let on = false, ticking = false;
  const update = () => {
    ticking = false;
    const r = sec.getBoundingClientRect(), p = clamp01((innerHeight - r.top) / (innerHeight + r.height));
    num.style.transform = `translate3d(${(-12 * p).toFixed(2)}%, 0, 0)`;
  };
  addEventListener('scroll', () => { if (on && !ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  new IntersectionObserver(es => { on = es[es.length - 1].isIntersecting; if (on) update(); }).observe(sec);
}

/* ───────────── 시작 ───────────── */
async function boot() {
  safe('tools', initToolsHub);
  safe('nav', initNav);
  const late = performance.now() > 3300;
  if (safe('reveal', () => { initReveal(late); return true; })) root.classList.add('motion-ready');
  safe('magnetic', initMagnetic);
  safe('cards', () => $$('[data-light]').forEach(card => bindCardLight(card)));
  safe('cursor', initGoldenCursor);
  safe('prism', initPrismText);
  safe('cta', initCTA);
  safe('sticky', initStickyCTA);
  safe('pause', initPause);
  safe('parallax', initParallax);
  safe('count', initCountUp);
  const heroReady = initHero188();
  await preload().catch(() => {});
  safe('hero', heroIntro);
  document.body.classList.add('ready');
  const hero = await heroReady;
  if (hero) hero.start();
  window.__V11_READY__ = true;
  window.__PARTICLE_COUNT__ = hero ? hero.count : 0;
}
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot); else boot();
