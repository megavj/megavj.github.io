/* 188 설계사 성장 시스템(#growth-system): 원본 자료 크게 보기 기능을 보존.
   · [data-g188-gr-open] 링크(자료 원본 크기 이미지, assets/img/growth/)를 누르면 기본 dialog(showModal)로 엶.
     스크립트가 없거나 dialog 를 못 쓰는 브라우저는 링크가 이미지를 그대로 엶
     포커스 가둠·Esc 닫기는 브라우저 기본. 바깥(어두운 면)을 눌러도 닫히고, 닫으면 누른 링크로 포커스가 돌아감
     ←/→ 키·이전/다음 버튼·좌우 밀기(터치)로 자료를 넘기고, 바뀐 자료는 화면 읽기 프로그램에 알림
   · 외부 요청 없음. HTML inline style 속성 없음(CSP) — 판 폭 비율만 CSSOM 변수(--g188-gr-ar)로 넣음 */
(() => {
  'use strict';
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  /* ---------- 실제 자료 크게 보기 ---------- */
  const root = $('#growth-system');
  const dlg = $('#g188-gr-dlg');
  if (!root) return;
  const triggers = $$('[data-g188-gr-open]', root);
  if (!dlg || typeof dlg.showModal !== 'function' || !triggers.length) return;

  const part = (k) => $(`[data-g188-gr-d="${k}"]`, dlg);
  const ui = { src: part('src'), title: part('title'), img: part('img'), note: part('note'), i: part('i'), n: part('n'), raw: part('raw'), live: part('live') };
  if (Object.values(ui).some((el) => !el)) return;
  const items = triggers.map((a) => ({
    a,
    href: a.getAttribute('href'),
    w: Number(a.dataset.g188GrW) || 0,
    h: Number(a.dataset.g188GrH) || 0,
    src: a.dataset.g188GrSrc || '',
    title: a.dataset.g188GrTitle || '',
    note: a.dataset.g188GrNote || '',
    alt: a.dataset.g188GrAlt || '',
  }));
  let cur = 0;
  let opener = null;

  const say = (msg) => {
    if (!ui.live) return;
    ui.live.textContent = '';
    setTimeout(() => { ui.live.textContent = msg; }, 60); // 같은 문장을 다시 알릴 때도 읽히게 비웠다가 넣음
  };

  const show = (i, announce) => {
    cur = (i + items.length) % items.length;
    const it = items[cur];
    ui.src.textContent = it.src;
    ui.title.textContent = it.title;
    ui.note.textContent = it.note;
    ui.img.alt = it.alt;
    if (it.w && it.h) {
      ui.img.width = it.w; ui.img.height = it.h; // 불러오기 전에도 비율대로 자리 잡게
      dlg.style.setProperty('--g188-gr-ar', (it.w / it.h).toFixed(4)); // 판 폭을 이미지 비율에 맞춤(CSSOM 이라 CSP 의 inline style 제한과 무관)
    }
    ui.img.src = it.href;
    ui.raw.href = it.href;
    ui.i.textContent = String(cur + 1);
    ui.n.textContent = String(items.length);
    if (announce) say(`${cur + 1} / ${items.length}. ${it.src}. ${it.title}. ${it.note}`);
  };

  triggers.forEach((a, i) => {
    a.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // 새 탭 열기 등은 그대로
      e.preventDefault();
      opener = a;
      show(i, false);
      dlg.showModal();
    });
  });

  // 닫기: 버튼 · Esc(브라우저 기본) · 바깥 누르기(누르기 시작도 바깥이었을 때만 — 안에서 끌다가 바깥에서 놓으면 닫지 않음)
  $('[data-g188-gr-close]', dlg).addEventListener('click', () => dlg.close());
  let downOnBackdrop = false;
  dlg.addEventListener('pointerdown', (e) => { downOnBackdrop = e.target === dlg; });
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg && downOnBackdrop) dlg.close();
    downOnBackdrop = false;
  });
  dlg.addEventListener('close', () => {
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    opener = null;
  });

  // 이전·다음
  $('[data-g188-gr-prev]', dlg).addEventListener('click', () => show(cur - 1, true));
  $('[data-g188-gr-next]', dlg).addEventListener('click', () => show(cur + 1, true));
  dlg.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); show(cur - 1, true); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); show(cur + 1, true); }
  });

  // 좌우 밀기(터치): 가로로 50px 넘게, 세로 움직임이 작을 때만
  const view = $('.g188-gr-dlg__view', dlg);
  let sx = 0, sy = 0, touching = false;
  view.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    touching = true; sx = e.clientX; sy = e.clientY;
  });
  view.addEventListener('pointerup', (e) => {
    if (!touching) return;
    touching = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dy) < 40) show(cur + (dx < 0 ? 1 : -1), true);
  });
  view.addEventListener('pointercancel', () => { touching = false; });
})();

/* 188 영업지원시스템(#sales-support): PC 탭·자동 넘김·예시 연출·모바일 펼치기.
   · PC(641px 이상): 단계 = tablist/tab, 예시 = tabpanel. 클릭·화살표(←→)·Home·End 로 바꿈
   · 휴대폰(640px 이하): 단계 = 펼치기 버튼(aria-expanded), 예시는 그 단계 바로 아래로 옮겨 펼침
   · 자동 넘김: PC 에서 예시 영역이 처음 보일 때 1→5 단계를 한 번만. 단계를 누르거나 '멈춤'을 누르면 끝.
     예시 위에 마우스를 올리거나 포커스가 들어가거나 화면 밖이면 잠시 멈춤
   · 예시 화면 연출: [data-g188-seq] 순서대로 나타남, .g188-m-typed 는 글자 타이핑. 움직임 줄이기면 연출·전환·자동 넘김 모두 없음
   · 외부 요청 없음. 스타일은 class 와 CSSOM(setProperty)만 쓴다(CSP: inline style 금지) */
(() => {
  'use strict';
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  const section = $('#sales-support');
  const root = section && $('[data-g188-ss]', section);
  if (!root) return;
  const list = $('[data-g188-ss-tabs]', root);
  const stage = $('[data-g188-ss-stage]', root);
  const autoBtn = $('[data-g188-ss-auto]', root);
  const caption = $('[data-g188-ss-caption]', root);
  const items = $$('[data-g188-ss-item]', root);
  const tabs = items.map((it) => $('[data-g188-ss-tab]', it));
  const heads = items.map((it) => $('.g188-ss-item__h', it));
  if (!list || !stage || !tabs.length || tabs.some((t) => !t) || heads.some((h) => !h)) return;
  const candidates = $$('[data-g188-ss-panel]', root);
  const panels = tabs.map((t) => candidates.find((p) => p.id === t.getAttribute('aria-controls')));
  if (panels.some((p) => !p)) return;

  const mqNarrow = matchMedia('(max-width: 640px)');
  const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const DWELL = 8000;               // 자동 넘김 한 단계 머무는 시간(ms). 타이핑이 긴 단계는 패널의 data-g188-dwell
  const TYPE_MS = { fast: 26, normal: 32 };
  const dwellOf = (i) => Number(panels[i].dataset.g188Dwell) || DWELL;
  tabs.forEach((t, i) => t.style.setProperty('--g188-ss-dwell', dwellOf(i) + 'ms')); // 금색 선이 차오르는 시간 = 머무는 시간

  let mode = '';      // 'tabs' | 'acc'
  let sel = 0;        // PC: 선택한 단계
  let openIdx = -1;   // 휴대폰: 펼친 단계(-1 = 없음)
  let seen = false;   // 예시 영역이 한 번이라도 보였는지

  /* ---------- 예시 화면 연출 ---------- */
  const runs = new Map();
  function finish(panel) {
    const run = runs.get(panel);
    if (run) { run.cancel(); runs.delete(panel); }
    $$('[data-g188-seq]', panel).forEach((el) => el.classList.remove('g188-is-pending', 'g188-is-typing', 'g188-is-active'));
    $$('.g188-m-typed__live', panel).forEach((el) => { el.textContent = ''; });
  }
  // 처음 보이기 전: 연출 전 상태로 두어, 화면에 들어올 때 완성본이 잠깐 보였다 사라지지 않게
  function prime(panel) {
    if (mqReduce.matches || !('IntersectionObserver' in window)) return;
    $$('[data-g188-seq]', panel).forEach((el) => el.classList.add(el.classList.contains('g188-m-typed') ? 'g188-is-typing' : 'g188-is-pending'));
  }
  // 경과 시간 기준 연출: 타이머가 늦게 와도(절전·부하) 정해진 시간 안에 끝난다. 글자 수는 시각으로 계산
  function play(panel) {
    finish(panel);
    if (mqReduce.matches) return;
    const els = $$('[data-g188-seq]', panel);
    if (!els.length) return;
    const order = [...new Set(els.map((el) => Number(el.dataset.g188Seq) || 0))].sort((a, b) => a - b);
    const steps = [];
    let at = 360;
    for (const n of order) {
      for (const el of els.filter((x) => (Number(x.dataset.g188Seq) || 0) === n)) {
        if (el.classList.contains('g188-m-typed')) {
          const ghost = $('.g188-m-typed__ghost', el);
          const text = ghost ? ghost.textContent : '';
          const ms = TYPE_MS[el.dataset.g188Speed] || TYPE_MS.normal;
          const times = [];            // times[i] = i+1 글자가 보이는 시각(시작 기준)
          let t = 0;
          for (const ch of text) { t += /[.,?!]/.test(ch) ? ms * 4 : ms; times.push(t); }
          steps.push({ el, at, type: true, text, times, live: $('.g188-m-typed__live', el), shown: 0 });
          at += t + 260;
        } else {
          steps.push({ el, at });
          at += Number(el.dataset.g188Gap) || 120;
        }
      }
      at += 220;
    }
    els.forEach((el) => el.classList.add(el.classList.contains('g188-m-typed') ? 'g188-is-typing' : 'g188-is-pending'));
    let raf = 0;
    let next = 0;
    const t0 = performance.now();
    const tick = () => {
      const now = performance.now() - t0;
      while (next < steps.length && steps[next].at <= now) {
        const st = steps[next];
        if (!st.type) { st.el.classList.remove('g188-is-pending'); next += 1; continue; }
        st.el.classList.add('g188-is-active');
        const local = now - st.at;
        let n = st.shown;
        while (n < st.times.length && st.times[n] <= local) n += 1;
        if (n !== st.shown) { st.shown = n; st.live.textContent = st.text.slice(0, n); }
        if (n < st.times.length) break; // 아직 타이핑 중
        st.el.classList.remove('g188-is-typing', 'g188-is-active');
        st.live.textContent = '';
        next += 1;
      }
      if (next < steps.length) raf = requestAnimationFrame(tick);
      else runs.delete(panel);
    };
    runs.set(panel, { cancel() { cancelAnimationFrame(raf); } });
    raf = requestAnimationFrame(tick);
  }
  function enter(panel) {
    if (mqReduce.matches) return;
    panel.classList.remove('g188-is-entering');
    void panel.offsetWidth; // 같은 패널을 다시 보여 줄 때도 전환이 처음부터 돌도록
    panel.classList.add('g188-is-entering');
  }
  panels.forEach((p) => p.addEventListener('animationend', (e) => { if (e.target === p) p.classList.remove('g188-is-entering'); }));

  /* ---------- PC: 탭 ---------- */
  function select(i, { focus = false, animate = true } = {}) {
    sel = i;
    tabs.forEach((t, k) => {
      t.setAttribute('aria-selected', String(k === i));
      t.tabIndex = k === i ? 0 : -1;
    });
    panels.forEach((p, k) => {
      if (k === i) return;
      if (!p.hidden) { p.hidden = true; finish(p); }
    });
    const p = panels[i];
    p.hidden = false;
    if (focus) tabs[i].focus();
    if (animate) { enter(p); play(p); } else finish(p);
  }
  function toTabs() {
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-label', '영업 단계');
    items.forEach((it) => it.setAttribute('role', 'none'));
    heads.forEach((h) => h.setAttribute('role', 'none'));
    tabs.forEach((t) => { t.setAttribute('role', 'tab'); t.removeAttribute('aria-expanded'); });
    panels.forEach((p) => {
      p.setAttribute('role', 'tabpanel');
      p.tabIndex = 0;
      stage.appendChild(p);
    });
    if (caption) stage.after(caption);
    if (openIdx >= 0) sel = openIdx;
    openIdx = -1;
    select(sel, { animate: false });
    if (!seen) prime(panels[sel]);
  }

  /* ---------- 휴대폰: 단계별 펼치기 ---------- */
  function toAcc() {
    autoStop();
    list.removeAttribute('role');
    list.removeAttribute('aria-label');
    items.forEach((it) => it.removeAttribute('role'));
    heads.forEach((h) => h.removeAttribute('role'));
    tabs.forEach((t) => {
      t.removeAttribute('role');
      t.removeAttribute('aria-selected');
      t.removeAttribute('tabindex');
      t.setAttribute('aria-expanded', 'false');
    });
    panels.forEach((p, k) => {
      p.setAttribute('role', 'region');
      p.removeAttribute('tabindex');
      p.hidden = true;
      p.classList.remove('g188-is-entering');
      finish(p);
      items[k].appendChild(p);
      items[k].classList.remove('g188-is-open');
    });
    openIdx = -1;
  }
  function toggle(i) {
    const btn = tabs[i];
    const before = btn.getBoundingClientRect().top;
    const opening = openIdx !== i;
    if (openIdx >= 0) {
      const k = openIdx;
      panels[k].hidden = true;
      finish(panels[k]);
      tabs[k].setAttribute('aria-expanded', 'false');
      items[k].classList.remove('g188-is-open');
      openIdx = -1;
    }
    if (opening) {
      openIdx = i;
      panels[i].hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      items[i].classList.add('g188-is-open');
      if (caption) panels[i].appendChild(caption); // '예시 화면' 안내는 펼친 예시 아래에
      enter(panels[i]);
      play(panels[i]);
    }
    // 위쪽 단계가 접히며 누른 단계가 위로 밀리면, 누른 단계가 같은 자리에 보이도록 스크롤을 맞춘다
    const shift = btn.getBoundingClientRect().top - before;
    if (Math.abs(shift) > 1) {
      const html = document.documentElement;
      const prev = html.style.scrollBehavior;
      html.style.scrollBehavior = 'auto'; // glass.css 의 부드러운 스크롤을 이 보정에서만 끔
      window.scrollBy(0, shift);
      html.style.scrollBehavior = prev;
    }
  }

  /* ---------- 자동 넘김(PC, 처음 1회) ---------- */
  const auto = { on: false, done: false, timer: 0, t0: 0, left: 0, holds: new Set() };
  function arm(ms) {
    clearTimeout(auto.timer);
    auto.t0 = performance.now();
    auto.left = ms;
    if (!auto.holds.size) auto.timer = setTimeout(autoNext, ms);
  }
  function autoStart() {
    if (auto.on || auto.done || mode !== 'tabs' || mqReduce.matches) return;
    auto.on = true;
    root.classList.add('g188-is-auto');
    root.classList.toggle('g188-is-auto-held', auto.holds.size > 0);
    if (autoBtn) autoBtn.hidden = false;
    arm(dwellOf(sel));
  }
  function autoNext() {
    if (!auto.on) return;
    if (sel >= tabs.length - 1) { autoStop(); return; }
    select(sel + 1);
    arm(dwellOf(sel));
  }
  function autoStop() {
    auto.done = true;
    if (!auto.on) return;
    auto.on = false;
    clearTimeout(auto.timer);
    root.classList.remove('g188-is-auto', 'g188-is-auto-held');
    if (autoBtn) {
      const had = document.activeElement === autoBtn;
      autoBtn.hidden = true;
      if (had) tabs[sel].focus();
    }
  }
  function hold(why) {
    if (auto.holds.has(why)) return;
    auto.holds.add(why);
    if (!auto.on || auto.holds.size > 1) return;
    clearTimeout(auto.timer);
    auto.left = Math.max(0, auto.left - (performance.now() - auto.t0));
    root.classList.add('g188-is-auto-held');
  }
  function release(why) {
    if (!auto.holds.delete(why) || auto.holds.size || !auto.on) return;
    root.classList.remove('g188-is-auto-held');
    auto.t0 = performance.now();
    auto.timer = setTimeout(autoNext, Math.max(300, auto.left));
  }
  if (autoBtn) autoBtn.addEventListener('click', autoStop);
  stage.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hold('hover'); });
  stage.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') release('hover'); });
  root.addEventListener('focusin', (e) => { if (e.target !== autoBtn) hold('focus'); });
  root.addEventListener('focusout', (e) => { if (!root.contains(e.relatedTarget)) release('focus'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) hold('page'); else release('page'); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      const vis = entries.some((en) => en.isIntersecting);
      if (!vis) { hold('view'); return; }
      release('view');
      if (!seen && mode === 'tabs') {
        seen = true;
        play(panels[sel]);
        autoStart();
      }
    }, { threshold: 0.35 }).observe(stage);
  }

  /* ---------- 입력 ---------- */
  tabs.forEach((t, i) => t.addEventListener('click', () => {
    if (mode === 'tabs') {
      autoStop();
      seen = true;
      if (i !== sel) select(i);
    } else {
      toggle(i);
    }
  }));
  list.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const last = tabs.length - 1;
    let n = -1;
    if (mode === 'tabs') {
      if (e.key === 'ArrowRight') n = i === last ? 0 : i + 1;
      else if (e.key === 'ArrowLeft') n = i === 0 ? last : i - 1;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = last;
      if (n < 0) return;
      e.preventDefault();
      autoStop();
      seen = true;
      select(n, { focus: true });
    } else {
      if (e.key === 'ArrowDown') n = i === last ? 0 : i + 1;
      else if (e.key === 'ArrowUp') n = i === 0 ? last : i - 1;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = last;
      if (n < 0) return;
      e.preventDefault();
      tabs[n].focus();
    }
  });

  /* ---------- 화면 폭·움직임 설정 ---------- */
  function applyMode() {
    const next = mqNarrow.matches ? 'acc' : 'tabs';
    if (next === mode) return;
    mode = next;
    root.dataset.g188Mode = mode;
    if (mode === 'tabs') toTabs(); else toAcc();
  }
  const onChange = (mq, fn) => (mq.addEventListener ? mq.addEventListener('change', fn) : mq.addListener(fn));
  onChange(mqNarrow, applyMode);
  onChange(mqReduce, () => { if (mqReduce.matches) { autoStop(); panels.forEach(finish); } });
  applyMode();
})();
