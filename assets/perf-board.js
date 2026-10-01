/*! 프리미엄사업부 실적보드 — 홈(/#performance)·/performance/ 공용 연출 (외부 라이브러리 없음)
 *
 * 숫자와 차트 마크업은 HTML에 정적으로 들어 있다(perf188/perf_sync.py 가 data_raw.json 으로 생성).
 * 이 스크립트는 연출만 맡는다.
 *   [data-pb-play]    화면에 들어오면 .is-play → 막대·곡선·도넛·칩 애니메이션, 안쪽 [data-pb-count] 카운트업
 *   [data-pb-reveal]  화면에 들어오면 .is-in → 아래에서 떠오르며 등장
 *   [data-pb-combo]   월별 막대 툴팁(마우스·터치·키보드)
 *   [data-pb-donut]   생보/손보 강조
 *   [data-pb-race]    본부 순위 레이스(1월→마지막 달 누적, #perf-data 사용) — 끝나면 정적 최종값으로 복원
 * JS가 꺼져 있거나 prefers-reduced-motion 이면 처음부터 최종 상태가 그대로 보인다.
 */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var canAnimate = !reduceMotion && 'IntersectionObserver' in window && 'requestAnimationFrame' in window;

  if (canAnimate) root.classList.add('pb-anim');
  else root.classList.remove('pb-anim');
  root.classList.add('pb-ready');

  function each(selector, scope, fn) {
    var list = (scope || doc).querySelectorAll(selector);
    for (var i = 0; i < list.length; i += 1) fn(list[i], i);
  }

  /* ---------- 카운트업: 정적 텍스트(예: 32.0, 51,539, 3.55)를 목표값으로 삼는다 ---------- */
  function parseFigure(text) {
    var raw = String(text).replace(/^\s+|\s+$/g, '');
    if (!/^\d[\d,]*(\.\d+)?$/.test(raw)) return null;
    var dot = raw.indexOf('.');
    return {
      raw: raw,
      value: parseFloat(raw.replace(/,/g, '')),
      decimals: dot < 0 ? 0 : raw.length - dot - 1,
      grouped: raw.indexOf(',') >= 0
    };
  }

  function formatFigure(value, figure) {
    var out = value.toFixed(figure.decimals);
    if (figure.grouped) {
      var parts = out.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      out = parts.join('.');
    }
    return out;
  }

  function figureOf(el) {
    if (el.pbFigure === undefined) el.pbFigure = parseFigure(el.textContent);
    return el.pbFigure;
  }

  function easeOutExpo(t) {
    return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function countUp(el, onFrame) {
    var figure = figureOf(el);
    if (!figure) return;
    if (!canAnimate) {
      el.textContent = figure.raw;
      if (onFrame) onFrame(1);
      return;
    }
    var duration = parseInt(el.getAttribute('data-pb-count'), 10) || 1800;
    var started = null;
    function frame(now) {
      if (started === null) started = now;
      var t = Math.min(1, (now - started) / duration);
      var p = easeOutExpo(t);
      el.textContent = t < 1 ? formatFigure(figure.value * p, figure) : figure.raw;
      if (onFrame) onFrame(p);
      if (t < 1) window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  /* 히어로 누적 트랙: 카운트업과 같은 진행률로 채우고, 10억 단위 표식을 통과하면 켠다. */
  function trackUpdater(track) {
    if (!track) return null;
    var fill = track.querySelector('.pb-track__fill');
    var marks = track.querySelectorAll('[data-x]');
    return function (p) {
      var reached = p * 100;
      if (fill) fill.style.width = reached.toFixed(2) + '%';
      for (var i = 0; i < marks.length; i += 1) {
        if (reached + 0.01 >= parseFloat(marks[i].getAttribute('data-x'))) marks[i].classList.add('is-on');
      }
    };
  }

  function play(block) {
    if (block.classList.contains('is-play')) return;
    var onFrame = trackUpdater(block.querySelector('[data-pb-track]'));
    if (onFrame && canAnimate) onFrame(0);
    block.classList.add('is-play');
    each('[data-pb-count]', block, function (el, i) {
      countUp(el, i === 0 ? onFrame : null);
    });
    if (block.hasAttribute('data-pb-race')) {
      startRace(block); // 레이스는 끝날 때 스스로 .is-done 을 붙인다
    } else if (canAnimate) {
      window.setTimeout(function () { block.classList.add('is-done'); }, 3200);
    } else {
      block.classList.add('is-done');
    }
  }

  /* ---------- 월별 막대 툴팁 ---------- */
  function initCombo(figure) {
    var area = figure.querySelector('.pb-combo__area');
    if (!area) return;
    var tip = doc.createElement('div');
    tip.className = 'pb-tip';
    tip.setAttribute('aria-hidden', 'true');
    area.appendChild(tip);
    var active = null;

    function addRow(list, label, value, key) {
      if (!value) return;
      var dt = doc.createElement('dt');
      if (key) {
        var mark = doc.createElement('i');
        mark.className = 'pb-key pb-key--' + key;
        dt.appendChild(mark);
      }
      dt.appendChild(doc.createTextNode(label));
      var dd = doc.createElement('dd');
      dd.textContent = value;
      list.appendChild(dt);
      list.appendChild(dd);
    }

    function addLine(className, text) {
      var p = doc.createElement('p');
      p.className = className;
      p.textContent = text;
      tip.appendChild(p);
    }

    function show(col) {
      var hit = col.querySelector('.pb-col__hit');
      if (!hit) return;
      if (active !== col) {
        if (active) active.classList.remove('is-active');
        active = col;
        col.classList.add('is-active');
        figure.classList.add('is-hover');
        tip.textContent = '';
        addLine('pb-tip__head', hit.getAttribute('data-m') + ' 월보험료');
        addLine('pb-tip__value', hit.getAttribute('data-v'));
        addLine('pb-tip__sub', hit.getAttribute('data-k'));
        var list = doc.createElement('dl');
        addRow(list, '누적', hit.getAttribute('data-cum'));
        addRow(list, '계약건수', hit.getAttribute('data-cnt'));
        addRow(list, '생보', hit.getAttribute('data-life'), 'life');
        addRow(list, '손보', hit.getAttribute('data-non'), 'nonlife');
        tip.appendChild(list);
      }
      var width = area.clientWidth;
      var half = tip.offsetWidth / 2;
      var center = col.offsetLeft + col.offsetWidth / 2;
      tip.style.left = Math.max(half, Math.min(width - half, center)) + 'px';
      tip.style.bottom = 'calc(' + (col.style.getPropertyValue('--h') || '0%') + ' + 22px)';
      tip.classList.add('is-on');
    }

    function hide() {
      if (active) active.classList.remove('is-active');
      active = null;
      figure.classList.remove('is-hover');
      tip.classList.remove('is-on');
    }

    each('.pb-col', area, function (col) {
      var hit = col.querySelector('.pb-col__hit');
      if (!hit) return;
      hit.addEventListener('pointerenter', function () { show(col); });
      hit.addEventListener('focus', function () { show(col); });
      hit.addEventListener('click', function () { show(col); });
      hit.addEventListener('blur', function () { if (active === col) hide(); });
    });
    area.addEventListener('pointerleave', function (event) {
      if (event.pointerType === 'mouse') hide();
    });
    doc.addEventListener('pointerdown', function (event) {
      if (active && !area.contains(event.target)) hide();
    });
    doc.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && active) hide();
    });
  }

  /* ---------- 생보/손보 도넛: 조각·범례에 올리면 가운데 수치를 바꾼다 ---------- */
  function initDonut(box) {
    var pct = box.querySelector('[data-pb-donut-pct]');
    var label = box.querySelector('[data-pb-donut-label]');
    if (!pct || !label) return;
    var base = { pct: pct.textContent, label: label.textContent };
    var parts = box.querySelectorAll('[data-key]');

    function set(key) {
      var source = null;
      for (var i = 0; i < parts.length; i += 1) {
        var on = parts[i].getAttribute('data-key') === key;
        parts[i].classList.toggle('is-active', on);
        if (on && parts[i].hasAttribute('data-pct')) source = parts[i];
      }
      box.classList.toggle('is-hover', !!key);
      pct.textContent = source ? source.getAttribute('data-pct') : base.pct;
      label.textContent = source ? source.getAttribute('data-label') : base.label;
    }

    each('[data-key]', box, function (part) {
      part.addEventListener('pointerenter', function () { set(part.getAttribute('data-key')); });
      part.addEventListener('pointerleave', function () { set(null); });
    });
  }

  /* ---------- 본부 순위 레이스 ---------- */
  function readData() {
    var node = doc.getElementById('perf-data');
    if (!node) return null;
    try {
      return JSON.parse(node.textContent);
    } catch (err) {
      return null;
    }
  }

  function startRace(block) {
    var list = block.querySelector('[data-pb-race-list]');
    var data = readData();
    if (!canAnimate || !list || !data || !data.branches || !data.months) return;
    var months = data.months;
    var n = months.length;
    var rows = list.querySelectorAll('li[data-name]');
    if (n < 2 || !rows.length) return;

    var label = block.querySelector('[data-pb-race-month]');
    var progress = block.querySelector('[data-pb-race-progress]');
    var replay = block.querySelector('[data-pb-race-replay]');
    var items = [];
    var max = 0;

    for (var i = 0; i < rows.length; i += 1) {
      var row = rows[i];
      var series = data.branches[row.getAttribute('data-name')] || [];
      var rank = row.querySelector('.pb-race__rank b');
      var value = row.querySelector('.pb-race__val');
      if (!rank || !value) return;
      var cum = [];
      var sum = 0;
      for (var m = 0; m < n; m += 1) {
        sum += Number(series[m]) || 0;
        cum.push(sum);
      }
      max = Math.max(max, sum);
      items.push({
        row: row,
        order: i,
        cum: cum,
        shown: 0,
        rank: rank,
        value: value,
        finalR: row.style.getPropertyValue('--r'),
        finalW: row.style.getPropertyValue('--w'),
        finalRank: rank.textContent,
        finalValue: value.textContent
      });
    }
    if (!max) return;

    var finalLabel = label ? label.textContent : '';
    var timer = 0;
    var frame = 0;

    function text(v) {
      return v > 0 ? (v / 100000).toFixed(2) + '억' : '—';
    }

    function layout(step) {
      var sorted = items.slice().sort(function (a, b) {
        return (b.cum[step] - a.cum[step]) || (a.order - b.order);
      });
      sorted.forEach(function (item, pos) {
        item.row.style.setProperty('--r', String(pos));
        item.row.style.setProperty('--w', (item.cum[step] / max * 100).toFixed(2) + '%');
        item.rank.textContent = String(pos + 1);
      });
      if (label) label.textContent = months[step] + ' 누적';
      if (progress) progress.style.width = ((step + 1) / n * 100).toFixed(1) + '%';
    }

    function tween(step, duration) {
      var from = items.map(function (item) { return item.shown; });
      var started = null;
      window.cancelAnimationFrame(frame);
      function tick(now) {
        if (started === null) started = now;
        var t = Math.min(1, (now - started) / duration);
        items.forEach(function (item, k) {
          item.shown = from[k] + (item.cum[step] - from[k]) * t;
          item.value.textContent = text(item.shown);
        });
        if (t < 1) frame = window.requestAnimationFrame(tick);
      }
      frame = window.requestAnimationFrame(tick);
    }

    function finish() {
      window.cancelAnimationFrame(frame);
      items.forEach(function (item) {
        item.row.style.setProperty('--r', item.finalR);
        item.row.style.setProperty('--w', item.finalW);
        item.rank.textContent = item.finalRank;
        item.value.textContent = item.finalValue;
        item.shown = item.cum[n - 1];
      });
      if (label) label.textContent = finalLabel;
      if (progress) progress.style.width = '100%';
      block.classList.remove('is-racing');
      block.classList.add('is-done');
    }

    function run() {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
      block.classList.remove('is-done');
      block.classList.add('is-racing');
      block.classList.add('is-reset');
      layout(0);
      items.forEach(function (item) {
        item.shown = 0;
        item.row.style.setProperty('--w', '0%');
        item.value.textContent = text(0);
      });
      if (progress) progress.style.width = '0%';
      void list.offsetWidth; // 0 상태를 전환 효과 없이 먼저 확정
      block.classList.remove('is-reset');
      var step = 0;
      function advance() {
        layout(step);
        tween(step, 560);
        step += 1;
        timer = window.setTimeout(step < n ? advance : finish, step < n ? 760 : 900);
      }
      timer = window.setTimeout(advance, 120);
    }

    if (replay) replay.addEventListener('click', run);
    run();
  }

  /* ---------- 시작 ---------- */
  each('[data-pb-combo]', doc, initCombo);
  each('[data-pb-donut]', doc, initDonut);

  if (canAnimate) {
    each('[data-pb-play] [data-pb-count]', doc, function (el) {
      var figure = figureOf(el);
      if (figure) el.textContent = formatFigure(0, figure);
    });
    var playObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        playObserver.unobserve(entry.target);
        play(entry.target);
      });
    }, { threshold: 0.25 });
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        revealObserver.unobserve(entry.target);
        entry.target.classList.add('is-in');
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    each('[data-pb-play]', doc, function (el) { playObserver.observe(el); });
    each('[data-pb-reveal]', doc, function (el) { revealObserver.observe(el); });
  } else {
    each('[data-pb-play]', doc, play);
    each('[data-pb-reveal]', doc, function (el) { el.classList.add('is-in'); });
  }
})();
