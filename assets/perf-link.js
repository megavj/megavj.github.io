/* 188 첫 화면 '사업부 실적'을 사업부 홈페이지(현재 test.primeasset.info) 실적보드 자료(#perf-data)와 연동한다.
   읽기 실패 시 HTML에 적힌 값을 그대로 둔다. (2026-11-05 이사님 지시) */
(function () {
  'use strict';
  var SRC = 'https://test.primeasset.info/performance/';
  var els = document.querySelectorAll('[data-pb-stat]');
  if (!els.length || !window.fetch || !window.DOMParser) return;
  fetch(SRC, { cache: 'no-cache', credentials: 'omit' })
    .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.text(); })
    .then(function (html) {
      var node = new DOMParser().parseFromString(html, 'text/html').getElementById('perf-data');
      if (!node) throw new Error('no data');
      var d = JSON.parse(node.textContent);
      var months = d.months, total = d.total;
      if (!Array.isArray(months) || !Array.isArray(total) || !months.length || months.length !== total.length) throw new Error('bad data');
      var sum = 0;
      for (var i = 0; i < total.length; i++) { if (typeof total[i] !== 'number') throw new Error('bad num'); sum += total[i]; }
      var eok1 = (sum / 100000).toFixed(1);              /* 단위 천원 → 억 */
      var first = parseInt(months[0], 10), last = parseInt(months[months.length - 1], 10);
      if (!(first > 0 && last >= first && last <= 12)) throw new Error('bad months');
      var bc = Array.isArray(d.branch_counts) && d.branch_counts.length === months.length ? d.branch_counts[months.length - 1] : null;
      var vals = {
        total_eok1: eok1,
        period: first + '~' + last + '월',
        period_from_to: first + '월부터 ' + last + '월까지'
      };
      if (Number.isInteger(bc) && bc > 0) vals.branches = String(bc);
      var apply = function () {
        els.forEach(function (el) {
          var k = el.getAttribute('data-pb-stat');
          if (!(k in vals)) return;
          if (el.hasAttribute('data-count')) el.setAttribute('data-count', vals[k]);
          el.textContent = vals[k];
        });
      };
      apply();
      /* 첫 화면 숫자 세기 효과가 끝난 뒤 이전 값으로 덮이지 않게 한 번 더 맞춘다. */
      setTimeout(apply, 2600);
      setTimeout(apply, 5200);
      setTimeout(apply, 8000);
    })
    .catch(function () { /* 연동 실패: 기존 표기를 유지 */ });
})();
