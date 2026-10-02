// 보험노트 3D 책 — 캔버스로 그리는 텍스처 (내려받는 그림 파일 0개)
// 글자는 일부러 읽히지 않게: 회색 막대(가짜 글줄)와 블록으로만 표현한다.
// 숫자·회사명·개인정보·문구 없음. 표지의 "보험노트 / 당신의 최고의 선택"만 실제 글자.

export const PAGE_LW = 1000;            // 페이지 논리 좌표 (종이 비율 1.30 : 1.80)
export const PAGE_LH = 1385;
export const COVER_LW = 1000;           // 앞표지 논리 좌표 (표지 비율 1.335 : 1.87)
export const COVER_LH = 1400;

const C = {
  paper: '#f8f5ee', paperDeep: '#ece6da',
  ink: '#1f2b38', ink2: '#3f5266', ink3: '#7d8c9b', ink4: '#b9c3cc', ink5: '#dde2e6',
  gold: '#b8893a', gold2: '#d8b268', goldPale: '#efe0bd',
  line: '#c4baa6', lineDark: '#988d79', head: '#3f382f',
};

function rng(seed) {                    // 항상 같은 그림이 나오도록 고정 난수
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fillRR(ctx, x, y, w, h, r, color) { rr(ctx, x, y, w, h, r); ctx.fillStyle = color; ctx.fill(); }

// 가짜 글줄 한 개 / 문단
function fakeLine(ctx, x, y, w, h = 9, color = C.line) { fillRR(ctx, x, y - h / 2, Math.max(w, h), h, h / 2, color); }
function fakePara(ctx, R, x, y, w, lines, lh = 24, h = 9, color = C.line) {
  for (let i = 0; i < lines; i++) {
    const last = i === lines - 1;
    fakeLine(ctx, x, y + i * lh, w * (last ? 0.35 + R() * 0.3 : 0.86 + R() * 0.14), h, color);
  }
  return y + lines * lh;
}
function fakeWords(ctx, R, x, y, w, h = 9, color = C.line) { // 단어 사이 틈이 있는 글줄
  let cx = x;
  while (cx < x + w - 20) {
    const ww = Math.min(30 + R() * 70, x + w - cx);
    fakeLine(ctx, cx, y, ww, h, color);
    cx += ww + 10;
  }
}

function heading(ctx, R, x, y, w) {
  fillRR(ctx, x, y, 8, 34, 2, C.gold);
  fillRR(ctx, x + 22, y + 3, w * (0.45 + R() * 0.2), 16, 8, C.head);
  fakeLine(ctx, x + 22, y + 32, w * (0.3 + R() * 0.2), 8, C.lineDark);
}

function pageBase(ctx, side, idx, total) {
  const W = PAGE_LW, H = PAGE_LH;
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);
  // 종이 결 (아주 옅은 얼룩)
  const R = rng(9000 + idx);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(150,130,95,${0.006 + R() * 0.008})`;
    const r = 40 + R() * 120;
    ctx.beginPath(); ctx.arc(R() * W, R() * H, r, 0, Math.PI * 2); ctx.fill();
  }
  // 위쪽 머리말 / 아래 꼬리말 (숫자 대신 점으로 쪽 표시)
  const inner = side === 'R' ? 110 : 80;
  fillRR(ctx, inner, 70, 120, 6, 3, C.gold2);
  fakeLine(ctx, W - 80 - 160, 73, 160, 8, C.line);
  ctx.fillStyle = C.line; ctx.fillRect(inner, 1290, W - 190, 2);
  for (let i = 0; i < total; i++) {
    ctx.beginPath();
    ctx.arc(W / 2 - (total - 1) * 11 + i * 22, 1325, i === idx ? 6 : 4, 0, Math.PI * 2);
    ctx.fillStyle = i === idx ? C.gold : C.ink5; ctx.fill();
  }
}

function gutterShade(ctx, side) {
  const W = PAGE_LW, H = PAGE_LH;
  const g = side === 'R' ? ctx.createLinearGradient(0, 0, 120, 0) : ctx.createLinearGradient(W, 0, W - 120, 0);
  g.addColorStop(0, 'rgba(70,52,28,0.30)');
  g.addColorStop(0.35, 'rgba(70,52,28,0.10)');
  g.addColorStop(1, 'rgba(70,52,28,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const e = side === 'R' ? ctx.createLinearGradient(W, 0, W - 40, 0) : ctx.createLinearGradient(0, 0, 40, 0);
  e.addColorStop(0, 'rgba(90,70,40,0.10)'); e.addColorStop(1, 'rgba(90,70,40,0)');
  ctx.fillStyle = e; ctx.fillRect(0, 0, W, H);
}

function gridLines(ctx, x, y, w, h, n) {
  ctx.strokeStyle = C.ink5; ctx.lineWidth = 2;
  for (let i = 0; i <= n; i++) {
    const yy = y + (h * i) / n;
    ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
    fakeLine(ctx, x - 52, yy, 36, 7, C.ink4);   // 축 눈금 (숫자 대신 짧은 막대)
  }
}

function legend(ctx, x, y, items) {
  let cx = x;
  for (const [color, w] of items) {
    fillRR(ctx, cx, y - 9, 18, 18, 4, color);
    fakeLine(ctx, cx + 28, y, w, 8, C.lineDark);
    cx += 28 + w + 34;
  }
}

// ---------------------------------------------------------------- 각 페이지
function pIntro(ctx, R, L) {   // 첫 장: 엠블럼 + 목차
  const cx = (L.x0 + L.x1) / 2;
  ctx.save();
  ctx.translate(cx, 290);
  ctx.strokeStyle = C.gold; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(0, 0, 92, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 78, 0, Math.PI * 2); ctx.stroke();
  // 방패 모양
  ctx.beginPath();
  ctx.moveTo(0, -50); ctx.lineTo(42, -34); ctx.lineTo(38, 14);
  ctx.quadraticCurveTo(28, 44, 0, 58); ctx.quadraticCurveTo(-28, 44, -38, 14); ctx.lineTo(-42, -34);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -50, 0, 58);
  g.addColorStop(0, C.gold2); g.addColorStop(1, C.gold);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = C.paper; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-16, 4); ctx.lineTo(-3, 18); ctx.lineTo(20, -12); ctx.stroke();
  ctx.restore();
  fillRR(ctx, cx - 170, 430, 340, 22, 11, C.head);
  fakeLine(ctx, cx - 120, 480, 240, 9, C.lineDark);
  ctx.fillStyle = C.gold; ctx.fillRect(cx - 60, 520, 120, 3);
  let y = 610;
  for (let i = 0; i < 9; i++) {
    const indent = i % 3 === 0 ? 0 : 36;
    if (i % 3 === 0) fillRR(ctx, L.x0, y - 14, 28, 28, 6, C.ink);
    const w = (i % 3 === 0 ? 260 : 200) + R() * 120;
    fakeLine(ctx, L.x0 + 46 + indent, y, w, i % 3 === 0 ? 13 : 9, i % 3 === 0 ? C.head : C.lineDark);
    ctx.fillStyle = C.ink5;
    for (let d = L.x0 + 60 + indent + w; d < L.x1 - 60; d += 16) ctx.fillRect(d, y + 2, 5, 3);
    fakeLine(ctx, L.x1 - 40, y, 40, 9, C.ink4);
    y += i % 3 === 2 ? 76 : 56;
  }
}

function pBars(ctx, R, L) {    // 막대 그래프 + 지표 카드
  heading(ctx, R, L.x0, 130, L.w);
  legend(ctx, L.x0, 235, [[C.ink, 80], [C.ink4, 90], [C.gold, 60]]);
  const x = L.x0 + 60, y = 275, w = L.w - 60, h = 400;
  gridLines(ctx, x, y, w, h, 5);
  const n = 10, gw = w / n;
  let base = 0.25;
  for (let i = 0; i < n; i++) {
    base = Math.min(0.95, base + R() * 0.12 - 0.02);
    const a = base, b = base * (0.55 + R() * 0.3);
    const bx = x + i * gw + gw * 0.16;
    fillRR(ctx, bx, y + h - h * a, gw * 0.3, h * a, 4, i === n - 1 ? C.gold : C.ink);
    fillRR(ctx, bx + gw * 0.34, y + h - h * b, gw * 0.3, h * b, 4, C.ink4);
    fakeLine(ctx, bx + 2, y + h + 26, gw * 0.55, 7, C.ink4);
  }
  // 추세선
  ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
  ctx.beginPath(); ctx.moveTo(x, y + h * 0.82); ctx.lineTo(x + w, y + h * 0.12); ctx.stroke(); ctx.setLineDash([]);
  // 지표 카드 3개
  const cy = 760, cw = (L.w - 40) / 3;
  for (let i = 0; i < 3; i++) {
    const cx = L.x0 + i * (cw + 20);
    fillRR(ctx, cx, cy, cw, 170, 14, i === 0 ? C.ink : '#ece5d6');
    fakeLine(ctx, cx + 22, cy + 34, cw * 0.5, 8, i === 0 ? '#6f8193' : C.lineDark);
    fillRR(ctx, cx + 22, cy + 62, cw * (0.45 + R() * 0.2), 30, 8, i === 0 ? C.gold2 : C.ink2);
    ctx.strokeStyle = i === 0 ? C.gold2 : C.ink3; ctx.lineWidth = 3;
    ctx.beginPath();
    for (let k = 0; k <= 8; k++) {
      const px = cx + 22 + (k * (cw - 44)) / 8, py = cy + 140 - R() * 26 - k * 2;
      k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.stroke();
  }
  fakePara(ctx, R, L.x0, 990, L.w, 7, 30, 10);
  fakePara(ctx, R, L.x0, 1220, L.w * 0.7, 2, 30, 10);
}

function pDonut(ctx, R, L) {   // 원 그래프 + 범례 표 + 가로 막대
  heading(ctx, R, L.x0, 130, L.w);
  const cx = L.x0 + 190, cy = 430, r = 165;
  const vals = [0.34, 0.24, 0.18, 0.14, 0.10];
  const cols = [C.ink, C.ink2, C.ink3, C.ink4, C.gold];
  let a = -Math.PI / 2;
  vals.forEach((v, i) => {
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, i === 0 ? r + 10 : r, a, a + v * Math.PI * 2 - 0.02);
    ctx.closePath(); ctx.fillStyle = cols[i]; ctx.fill();
    a += v * Math.PI * 2;
  });
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.56, 0, Math.PI * 2); ctx.fillStyle = C.paper; ctx.fill();
  fillRR(ctx, cx - 50, cy - 16, 100, 22, 11, C.head);
  fakeLine(ctx, cx - 34, cy + 24, 68, 8, C.line);
  // 범례 표
  const tx = L.x0 + 420, tw = L.x1 - tx;
  ctx.fillStyle = C.ink5; ctx.fillRect(tx, 270, tw, 2);
  vals.forEach((v, i) => {
    const y = 310 + i * 64;
    fillRR(ctx, tx, y - 11, 22, 22, 5, cols[i]);
    fakeLine(ctx, tx + 36, y, 120 + R() * 60, 9, C.lineDark);
    fakeLine(ctx, tx + tw - 70, y, 70, 9, C.ink3);
    ctx.fillStyle = C.ink5; ctx.fillRect(tx, y + 30, tw, 1.5);
  });
  // 가로 막대 목록
  const by = 700;
  fillRR(ctx, L.x0, by, 220, 14, 7, C.head);
  for (let i = 0; i < 6; i++) {
    const y = by + 60 + i * 62;
    fakeLine(ctx, L.x0, y, 150, 9, C.lineDark);
    fillRR(ctx, L.x0 + 180, y - 13, L.w - 180, 26, 13, '#ebe4d5');
    fillRR(ctx, L.x0 + 180, y - 13, (L.w - 180) * (0.85 - i * 0.1 - R() * 0.06), 26, 13, i === 0 ? C.gold : C.ink2);
  }
  fakePara(ctx, R, L.x0, 1150, L.w, 4, 30, 10);
}

function pCards(ctx, R, L) {   // 보장 비교 카드 3장
  heading(ctx, R, L.x0, 130, L.w);
  const top = 240, cw = (L.w - 40) / 3, ch = 820;
  for (let i = 0; i < 3; i++) {
    const x = L.x0 + i * (cw + 20), hi = i === 1;
    if (hi) { fillRR(ctx, x - 6, top - 6, cw + 12, ch + 12, 22, C.gold); }
    fillRR(ctx, x, top, cw, ch, 18, '#fbf8f1');
    rr(ctx, x, top, cw, ch, 18); ctx.strokeStyle = hi ? C.gold : C.ink5; ctx.lineWidth = 2; ctx.stroke();
    // 카드 머리
    ctx.save(); rr(ctx, x, top, cw, 150, 18); ctx.clip();
    ctx.fillStyle = hi ? C.ink : '#e7e1d4'; ctx.fillRect(x, top, cw, 150); ctx.restore();
    if (hi) { // 추천 리본 (글자 없음)
      ctx.fillStyle = C.gold;
      ctx.beginPath(); ctx.moveTo(x + cw - 64, top); ctx.lineTo(x + cw - 24, top); ctx.lineTo(x + cw - 24, top + 70);
      ctx.lineTo(x + cw - 44, top + 56); ctx.lineTo(x + cw - 64, top + 70); ctx.closePath(); ctx.fill();
    }
    fakeLine(ctx, x + 24, top + 50, cw * 0.45, 12, hi ? C.gold2 : C.head);
    fillRR(ctx, x + 24, top + 84, cw * 0.62, 30, 8, hi ? '#ffffff' : C.ink2);
    // 항목들: 체크 / 대시 / 점 등급
    for (let k = 0; k < 9; k++) {
      const y = top + 200 + k * 62;
      fakeLine(ctx, x + 24, y, cw * 0.42, 8, C.lineDark);
      const level = (k + i * 2) % 4 === 0 ? 0 : Math.min(3, 1 + ((k * 7 + i * 3) % 3) + (hi ? 1 : 0));
      if (k % 3 === 2) { // 점 등급
        for (let d = 0; d < 3; d++) {
          ctx.beginPath(); ctx.arc(x + cw - 92 + d * 26, y, 8, 0, Math.PI * 2);
          ctx.fillStyle = d < level ? (hi ? C.gold : C.ink2) : C.ink5; ctx.fill();
        }
      } else if (level === 0) {
        ctx.fillStyle = C.ink4; ctx.fillRect(x + cw - 60, y - 2, 24, 4);
      } else {
        ctx.beginPath(); ctx.arc(x + cw - 48, y, 15, 0, Math.PI * 2);
        ctx.fillStyle = hi ? C.gold : C.ink2; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x + cw - 55, y); ctx.lineTo(x + cw - 49, y + 6); ctx.lineTo(x + cw - 40, y - 6); ctx.stroke();
      }
      ctx.fillStyle = C.ink5; ctx.fillRect(x + 20, y + 30, cw - 40, 1.5);
    }
    fillRR(ctx, x + 24, top + ch - 80, cw - 48, 48, 24, hi ? C.gold : C.ink);
    fakeLine(ctx, x + cw / 2 - 40, top + ch - 56, 80, 9, hi ? '#fff6e0' : '#8fa0b0');
  }
  fakePara(ctx, R, L.x0, 1120, L.w, 4, 30, 10);
}

function pLine(ctx, R, L) {    // 꺾은선 그래프 + 면적
  heading(ctx, R, L.x0, 130, L.w);
  legend(ctx, L.x0, 235, [[C.ink, 90], [C.gold, 70]]);
  const x = L.x0 + 60, y = 280, w = L.w - 60, h = 430, n = 11;
  gridLines(ctx, x, y, w, h, 5);
  const s1 = [], s2 = [];
  let v1 = 0.3, v2 = 0.18;
  for (let i = 0; i < n; i++) {
    v1 = Math.max(0.1, Math.min(0.92, v1 + (R() - 0.35) * 0.14));
    v2 = Math.max(0.06, Math.min(0.7, v2 + (R() - 0.4) * 0.1));
    s1.push([x + (w * i) / (n - 1), y + h - h * v1]);
    s2.push([x + (w * i) / (n - 1), y + h - h * v2]);
  }
  const ag = ctx.createLinearGradient(0, y, 0, y + h);
  ag.addColorStop(0, 'rgba(31,43,56,0.28)'); ag.addColorStop(1, 'rgba(31,43,56,0.02)');
  ctx.beginPath(); ctx.moveTo(s1[0][0], y + h);
  s1.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(s1[n - 1][0], y + h); ctx.closePath();
  ctx.fillStyle = ag; ctx.fill();
  for (const [s, col, lw] of [[s1, C.ink, 6], [s2, C.gold, 5]]) {
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'round';
    ctx.beginPath(); s.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
    s.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 8, 0, Math.PI * 2); ctx.fillStyle = C.paper; ctx.fill(); ctx.lineWidth = 4; ctx.stroke(); });
  }
  // 강조 말풍선
  const hp = s1[7];
  ctx.strokeStyle = C.ink3; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.moveTo(hp[0], hp[1]); ctx.lineTo(hp[0], y + h); ctx.stroke(); ctx.setLineDash([]);
  fillRR(ctx, hp[0] - 90, hp[1] - 110, 180, 80, 12, C.ink);
  fakeLine(ctx, hp[0] - 66, hp[1] - 84, 90, 8, '#8b9cad');
  fillRR(ctx, hp[0] - 66, hp[1] - 66, 120, 18, 9, C.gold2);
  // 아래 요약 표
  const ty = 800;
  for (let r = 0; r < 5; r++) {
    const yy = ty + r * 58;
    if (r === 0) fillRR(ctx, L.x0, yy - 24, L.w, 48, 8, '#e9e2d3');
    for (let c = 0; c < 4; c++) {
      const cx = L.x0 + 20 + c * (L.w / 4);
      fakeLine(ctx, cx, yy, (c === 0 ? 140 : 80) + R() * 30, r === 0 ? 10 : 8, r === 0 ? C.head : C.line);
    }
    if (r) { ctx.fillStyle = C.ink5; ctx.fillRect(L.x0, yy + 28, L.w, 1.5); }
  }
  fakePara(ctx, R, L.x0, 1130, L.w, 4, 30, 10);
}

function pTable(ctx, R, L) {   // 자료 표
  heading(ctx, R, L.x0, 130, L.w);
  fakePara(ctx, R, L.x0, 235, L.w, 2, 28, 9);
  const top = 320, rh = 66, cols = [0.30, 0.18, 0.18, 0.2, 0.14];
  fillRR(ctx, L.x0, top, L.w, rh, 10, C.ink);
  let cx = L.x0 + 20;
  cols.forEach(cw => { fakeLine(ctx, cx, top + rh / 2, L.w * cw * 0.55, 10, '#8a9bab'); cx += L.w * cw; });
  for (let r = 0; r < 11; r++) {
    const y = top + rh + r * rh;
    if (r % 2 === 0) { ctx.fillStyle = '#eee8db'; ctx.fillRect(L.x0, y, L.w, rh); }
    cx = L.x0 + 20;
    cols.forEach((cw, c) => {
      const yy = y + rh / 2;
      if (c === 0) { fillRR(ctx, cx, yy - 10, 20, 20, 4, [C.ink, C.ink2, C.ink3, C.gold][r % 4]); fakeLine(ctx, cx + 32, yy, 90 + R() * 70, 9, C.lineDark); }
      else if (c === 3) { fillRR(ctx, cx, yy - 9, L.w * cw * 0.85, 18, 9, C.ink5); fillRR(ctx, cx, yy - 9, L.w * cw * 0.85 * (0.2 + R() * 0.8), 18, 9, C.ink2); }
      else if (c === 4) { ctx.beginPath(); ctx.arc(cx + 20, yy, 9, 0, Math.PI * 2); ctx.fillStyle = R() > 0.3 ? C.gold : C.ink4; ctx.fill(); fakeLine(ctx, cx + 38, yy, 50, 8, C.line); }
      else fakeLine(ctx, cx + L.w * cw * 0.15, yy, L.w * cw * (0.4 + R() * 0.25), 9, C.ink3);
      cx += L.w * cw;
    });
  }
  const end = top + rh * 12;
  ctx.fillStyle = C.ink; ctx.fillRect(L.x0, end, L.w, 3);
  fillRR(ctx, L.x0, end + 30, L.w, 70, 10, C.goldPale);
  fakeLine(ctx, L.x0 + 24, end + 65, 180, 11, C.head);
  fillRR(ctx, L.x1 - 200, end + 54, 170, 22, 11, C.gold);
  fakePara(ctx, R, L.x0, end + 150, L.w, 3, 30, 9);
}

function pSchedule(ctx, R, L) { // 일정표: 달력 + 타임라인
  heading(ctx, R, L.x0, 130, L.w);
  const top = 240, cw = L.w / 7, chh = 76;
  for (let d = 0; d < 7; d++) fakeLine(ctx, L.x0 + d * cw + cw / 2 - 16, top, 32, 9, d === 0 ? C.gold : C.ink3);
  const marks = new Set([3, 9, 10, 16, 24, 30]);
  for (let r = 0; r < 5; r++) for (let d = 0; d < 7; d++) {
    const i = r * 7 + d, x = L.x0 + d * cw, y = top + 30 + r * chh;
    fillRR(ctx, x + 4, y, cw - 8, chh - 8, 8, i === 17 ? C.ink : (marks.has(i) ? '#e9dfc7' : '#efe9dd'));
    fillRR(ctx, x + 14, y + 12, 18, 8, 4, i === 17 ? '#7e90a2' : C.ink4);
    if (marks.has(i)) { ctx.beginPath(); ctx.arc(x + cw - 24, y + chh - 26, 8, 0, Math.PI * 2); ctx.fillStyle = C.gold; ctx.fill(); }
    if (i === 17) fillRR(ctx, x + 14, y + 36, cw - 36, 10, 5, C.gold2);
    if (i === 9 || i === 10) fillRR(ctx, x + (i === 9 ? 14 : 0), y + 40, cw - (i === 9 ? 14 : 22), 12, 6, C.ink2);
  }
  // 타임라인
  const ty = top + 30 + 5 * chh + 50;
  fillRR(ctx, L.x0, ty, 200, 14, 7, C.head);
  const lx = L.x0 + 30;
  ctx.fillStyle = C.ink4; ctx.fillRect(lx - 2, ty + 50, 4, 5 * 86);
  for (let k = 0; k < 6; k++) {
    const y = ty + 60 + k * 86;
    ctx.beginPath(); ctx.arc(lx, y, k === 2 ? 16 : 12, 0, Math.PI * 2);
    ctx.fillStyle = k < 2 ? C.ink : k === 2 ? C.gold : C.paper; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = k === 2 ? C.gold : C.ink2; ctx.stroke();
    fillRR(ctx, lx + 40, y - 18, 70, 16, 8, k === 2 ? C.gold2 : C.ink4);
    fakeLine(ctx, lx + 130, y - 10, 200 + R() * 160, 10, C.lineDark);
    fakeLine(ctx, lx + 40, y + 16, 300 + R() * 200, 8, C.line);
  }
}

function pDashboard(ctx, R, L) { // 지표 대시보드 4칸
  heading(ctx, R, L.x0, 130, L.w);
  const top = 240, tw = (L.w - 24) / 2, th = 300;
  const tiles = [[0, 0], [1, 0], [0, 1], [1, 1]];
  tiles.forEach(([c, r], i) => {
    const x = L.x0 + c * (tw + 24), y = top + r * (th + 24);
    fillRR(ctx, x, y, tw, th, 16, i === 0 ? C.ink : '#efe9dc');
    fakeLine(ctx, x + 24, y + 36, tw * 0.45, 9, i === 0 ? '#7d8fa1' : C.lineDark);
    const mx = x + tw / 2, my = y + th / 2 + 30;
    if (i === 0) { // 반원 게이지
      ctx.lineCap = 'round'; ctx.lineWidth = 26;
      ctx.strokeStyle = '#33465a'; ctx.beginPath(); ctx.arc(mx, my + 30, 110, Math.PI, 0); ctx.stroke();
      ctx.strokeStyle = C.gold2; ctx.beginPath(); ctx.arc(mx, my + 30, 110, Math.PI, Math.PI * 1.72); ctx.stroke();
      ctx.lineCap = 'butt';
      fillRR(ctx, mx - 50, my + 4, 100, 26, 13, '#ffffff');
    } else if (i === 1) { // 진행 원
      ctx.lineWidth = 22; ctx.strokeStyle = C.ink5; ctx.beginPath(); ctx.arc(mx, my, 85, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = C.ink2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(mx, my, 85, -Math.PI / 2, Math.PI * 0.95); ctx.stroke(); ctx.lineCap = 'butt';
      fillRR(ctx, mx - 36, my - 11, 72, 22, 11, C.head);
    } else if (i === 2) { // 작은 꺾은선
      ctx.strokeStyle = C.ink; ctx.lineWidth = 5; ctx.beginPath();
      let v = 0.5;
      for (let k = 0; k <= 12; k++) {
        v = Math.max(0.1, Math.min(0.9, v + (R() - 0.45) * 0.3));
        const px = x + 30 + (k * (tw - 60)) / 12, py = y + th - 40 - v * 170;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
      fillRR(ctx, x + tw - 110, y + 24, 86, 26, 13, C.gold);
    } else { // 세로 쌓은 막대
      for (let k = 0; k < 6; k++) {
        const bx = x + 34 + k * ((tw - 68) / 6), bw = (tw - 68) / 6 - 14;
        let by = y + th - 30;
        [[C.ink, 40 + R() * 50], [C.ink3, 20 + R() * 40], [C.gold2, 10 + R() * 30]].forEach(([col, hh]) => {
          by -= hh; ctx.fillStyle = col; ctx.fillRect(bx, by, bw, hh - 3);
        });
      }
    }
  });
  // 100% 가로 막대
  const by = top + 2 * th + 80;
  fillRR(ctx, L.x0, by, 240, 14, 7, C.head);
  for (let r = 0; r < 4; r++) {
    const y = by + 50 + r * 70;
    let x = L.x0;
    const parts = [0.2 + R() * 0.2, 0.15 + R() * 0.2, 0.1 + R() * 0.15];
    parts.push(1 - parts.reduce((a, b) => a + b, 0));
    parts.forEach((p, k) => { ctx.fillStyle = [C.ink, C.ink2, C.ink4, C.gold2][k]; ctx.fillRect(x, y, L.w * p - 4, 34); x += L.w * p; });
  }
  fakePara(ctx, R, L.x0, by + 360, L.w, 2, 30, 9);
}

function pRadar(ctx, R, L) {   // 육각 레이더 + 가로 막대
  heading(ctx, R, L.x0, 130, L.w);
  const cx = (L.x0 + L.x1) / 2, cy = 470, rad = 210, n = 6;
  const pt = (i, s) => [cx + Math.cos(-Math.PI / 2 + (i * 2 * Math.PI) / n) * rad * s, cy + Math.sin(-Math.PI / 2 + (i * 2 * Math.PI) / n) * rad * s];
  ctx.strokeStyle = C.ink4; ctx.lineWidth = 2;
  for (let s = 1; s <= 4; s++) {
    ctx.beginPath(); for (let i = 0; i <= n; i++) { const p = pt(i % n, s / 4); i ? ctx.lineTo(...p) : ctx.moveTo(...p); } ctx.stroke();
  }
  for (let i = 0; i < n; i++) {
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(...pt(i, 1)); ctx.stroke();
    const p = pt(i, 1.22); fakeLine(ctx, p[0] - 40, p[1], 80, 9, C.lineDark);
  }
  for (const [col, fill, vals] of [[C.ink2, 'rgba(63,82,102,0.22)', [0.48, 0.80, 0.42, 0.70, 0.38, 0.62]],
                                   [C.gold, 'rgba(184,137,58,0.30)', [0.85, 0.55, 0.92, 0.60, 0.78, 0.50]]]) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) { const p = pt(i % n, vals[i % n]); i ? ctx.lineTo(...p) : ctx.moveTo(...p); }
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.stroke();
  }
  const by = 800;
  for (let i = 0; i < 6; i++) {
    const y = by + i * 64;
    fillRR(ctx, L.x0, y - 14, 28, 28, 6, i < 2 ? C.gold : C.ink2);
    fakeLine(ctx, L.x0 + 44, y, 170, 9, C.lineDark);
    const bw = (L.w - 260) * (0.9 - i * 0.11);
    fillRR(ctx, L.x0 + 250, y - 10, bw, 20, 10, i < 2 ? C.gold2 : C.ink4);
  }
  fakePara(ctx, R, L.x0, by + 410, L.w, 2, 30, 9);
}

function pChecklist(ctx, R, L) { // 마무리: 체크리스트 + 메모 + 인장
  heading(ctx, R, L.x0, 130, L.w);
  for (let i = 0; i < 8; i++) {
    const y = 270 + i * 70, done = i < 5;
    rr(ctx, L.x0, y - 18, 36, 36, 8);
    ctx.fillStyle = done ? C.ink : '#fbf8f1'; ctx.fill();
    ctx.strokeStyle = done ? C.ink : C.ink4; ctx.lineWidth = 3; ctx.stroke();
    if (done) { ctx.strokeStyle = C.gold2; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(L.x0 + 9, y); ctx.lineTo(L.x0 + 16, y + 8); ctx.lineTo(L.x0 + 28, y - 9); ctx.stroke(); }
    fakeWords(ctx, R, L.x0 + 60, y, 280 + R() * 300, 10, done ? C.lineDark : C.line);
  }
  // 메모 상자
  const my = 860;
  fillRR(ctx, L.x0, my, L.w, 200, 12, '#f0e7d2');
  ctx.fillStyle = C.gold; ctx.fillRect(L.x0, my, 10, 200);
  fakeLine(ctx, L.x0 + 36, my + 44, 200, 12, C.head);
  fakePara(ctx, R, L.x0 + 36, my + 90, L.w - 72, 3, 30, 9, '#cdbf9f');
  // 인장 + 서명 곡선
  const sx = L.x1 - 120, sy = 1180;
  ctx.strokeStyle = C.gold; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(sx, sy, 72, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, 58, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = C.gold; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr2 = i % 2 ? 16 : 36; ctx.lineTo(sx + Math.cos(a) * rr2, sy + Math.sin(a) * rr2); }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = C.ink2; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(L.x0, 1200);
  for (let k = 0; k < 7; k++) ctx.bezierCurveTo(L.x0 + 30 + k * 50, 1150 + R() * 30, L.x0 + 50 + k * 50, 1240 - R() * 30, L.x0 + 60 + k * 50, 1195);
  ctx.stroke();
  ctx.fillStyle = C.ink4; ctx.fillRect(L.x0, 1225, 420, 2);
}

// 펼침면 순서: [왼쪽, 오른쪽] × 5 = 10면 (서로 다른 9가지 자료 + 첫 장)
const PAGES = [
  ['L', pIntro], ['R', pBars],
  ['L', pDonut], ['R', pCards],
  ['L', pLine], ['R', pTable],
  ['L', pSchedule], ['R', pDashboard],
  ['L', pRadar], ['R', pChecklist],
];
export const PAGE_COUNT = PAGES.length;

export function drawPage(i, width) {
  const h = Math.round((width * PAGE_LH) / PAGE_LW);
  const cv = makeCanvas(width, h);
  const ctx = cv.getContext('2d');
  ctx.scale(width / PAGE_LW, h / PAGE_LH);
  const [side, fn] = PAGES[i];
  const spread = Math.floor(i / 2);
  pageBase(ctx, side, spread, PAGE_COUNT / 2);
  const L = side === 'R' ? { x0: 110, x1: 920 } : { x0: 80, x1: 890 };
  L.w = L.x1 - L.x0;
  fn(ctx, rng(1234 + i * 77), L);
  gutterShade(ctx, side);
  return cv;
}

// ---------------------------------------------------------------- 가죽 결 (반복 무늬)
export function drawGrain(size = 256) {
  const cv = makeCanvas(size, size);
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const R = rng(77);
  const oct = [[32, 0.55], [16, 0.3], [8, 0.15]];
  const lat = oct.map(([p]) => { const n = size / p; return { n, v: Array.from({ length: n * n }, R) }; });
  const sm = t => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0;
    oct.forEach(([p, w], k) => {
      const { n, v: L } = lat[k];
      const fx = x / p, fy = y / p, ix = Math.floor(fx), iy = Math.floor(fy), tx = sm(fx - ix), ty = sm(fy - iy);
      const g = (a, b) => L[((b % n) * n) + (a % n)];
      const a = g(ix, iy) + (g(ix + 1, iy) - g(ix, iy)) * tx;
      const b = g(ix, iy + 1) + (g(ix + 1, iy + 1) - g(ix, iy + 1)) * tx;
      v += (a + (b - a) * ty) * w;
    });
    const pebble = Math.pow(Math.abs(Math.sin(v * 19.0)), 0.5);   // 자갈 모양 주름
    const c = Math.max(0, Math.min(255, 70 + pebble * 140 + (R() - 0.5) * 30));
    const o = (y * size + x) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = c; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

export function drawPaperEdge() {
  const cv = makeCanvas(8, 256);
  const ctx = cv.getContext('2d');
  const R = rng(5);
  for (let y = 0; y < 256; y++) {
    const s = 222 + Math.floor((R() - 0.5) * 26) - (y % 3 === 0 ? 14 : 0);
    ctx.fillStyle = `rgb(${s},${s - 10},${s - 30})`;
    ctx.fillRect(0, y, 8, 1);
  }
  return cv;
}

// ---------------------------------------------------------------- 앞표지
// 금테 위치 (blender/build_book.py 의 금테와 같은 자리, 표지 좌표 비율)
const WC = 1.335, HC = 1.87;
export const FRAME = { u0: 0.10 / WC, u1: 1 - 0.055 / WC, v0: 0.055 / HC, v1: 1 - 0.055 / HC };

const FONT_STACK = '"Apple SD Gothic Neo", "Malgun Gothic", "맑은 고딕", "Noto Sans KR", "Nanum Gothic", sans-serif';

function coverLayout(ctx) {
  const cx = ((FRAME.u0 + FRAME.u1) / 2) * COVER_LW;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 176px ${FONT_STACK}`;
  const tw = ctx.measureText('보험노트').width;
  const tScale = Math.min(1, (COVER_LW * 0.62) / tw);
  return { cx, title: { y: 0.43 * COVER_LH, size: Math.round(176 * tScale) }, sub: { y: 0.33 * COVER_LH, size: 58 } };
}

function drawCoverText(ctx, L, fill, { shadow = false } = {}) {
  const put = (text, y, size, weight, spacing) => {
    ctx.font = `${weight} ${size}px ${FONT_STACK}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
    if (shadow) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(text, L.cx + 2, y + 3);
    }
    ctx.fillStyle = typeof fill === 'function' ? fill(y, size) : fill;
    ctx.fillText(text, L.cx, y);
  };
  put('당신의 최고의 선택', L.sub.y, L.sub.size, 700, 6);
  put('보험노트', L.title.y, L.title.size, 800, 8);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  // 제목 아래 작은 장식 (선 + 마름모)
  const y = L.title.y + L.title.size * 0.78, half = 150;
  ctx.fillStyle = typeof fill === 'function' ? fill(y, 20) : fill;
  ctx.fillRect(L.cx - half, y - 1.5, half - 22, 3);
  ctx.fillRect(L.cx + 22, y - 1.5, half - 22, 3);
  ctx.beginPath(); ctx.moveTo(L.cx, y - 11); ctx.lineTo(L.cx + 11, y); ctx.lineTo(L.cx, y + 11); ctx.lineTo(L.cx - 11, y); ctx.closePath(); ctx.fill();
}

function goldGrad(ctx) {
  return (y, size) => {
    const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    g.addColorStop(0, '#f8e6a8'); g.addColorStop(0.4, '#e2b453');
    g.addColorStop(0.72, '#c8933a'); g.addColorStop(1, '#efcf7c');
    return g;
  };
}

// map(색), orm(G=거칠기, B=금속성), bump(높이), mask(반짝임 자리)
export function drawCover(width, grain) {
  const h = Math.round((width * COVER_LH) / COVER_LW);
  const mk = () => { const cv = makeCanvas(width, h); const ctx = cv.getContext('2d'); ctx.scale(width / COVER_LW, h / COVER_LH); return [cv, ctx]; };
  const [map, m] = mk(), [orm, o] = mk(), [bump, b] = mk(), [mask, k] = mk();
  const L = coverLayout(m); coverLayout(o); coverLayout(b); coverLayout(k);
  const pat = (ctx) => { const p = ctx.createPattern(grain, 'repeat'); p.setTransform && p.setTransform(new DOMMatrix().scale(1.4)); return p; };

  // 색
  m.fillStyle = '#0c0c0d'; m.fillRect(0, 0, COVER_LW, COVER_LH);
  m.globalAlpha = 0.10; m.fillStyle = pat(m); m.fillRect(0, 0, COVER_LW, COVER_LH); m.globalAlpha = 1;
  const vg = m.createRadialGradient(COVER_LW * 0.55, COVER_LH * 0.42, 100, COVER_LW * 0.55, COVER_LH * 0.5, COVER_LH * 0.8);
  vg.addColorStop(0, 'rgba(48,44,40,0.16)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  m.fillStyle = vg; m.fillRect(0, 0, COVER_LW, COVER_LH);
  m.fillStyle = 'rgba(0,0,0,0.55)'; m.fillRect(0.040 * COVER_LW, 0, 7, COVER_LH);      // 책등 홈
  m.fillStyle = 'rgba(255,240,210,0.05)'; m.fillRect(0.040 * COVER_LW + 8, 0, 3, COVER_LH);
  drawCoverText(m, L, goldGrad(m), { shadow: true });

  // 거칠기/금속성
  o.fillStyle = 'rgb(0,150,0)'; o.fillRect(0, 0, COVER_LW, COVER_LH);
  o.globalAlpha = 0.25; o.fillStyle = pat(o); o.fillRect(0, 0, COVER_LW, COVER_LH); o.globalAlpha = 1;
  o.globalCompositeOperation = 'source-over';
  drawCoverText(o, L, 'rgb(0,95,255)');

  // 높이 (가죽 결 + 도드라진 글자)
  b.fillStyle = pat(b); b.fillRect(0, 0, COVER_LW, COVER_LH);
  b.fillStyle = 'rgba(128,128,128,0.55)'; b.fillRect(0, 0, COVER_LW, COVER_LH);
  if ('filter' in b) b.filter = 'blur(2px)';
  drawCoverText(b, L, '#ffffff');
  b.filter = 'none';

  // 반짝임 마스크: 글자(강) + 금테(약)
  drawCoverText(k, L, '#ffffff');
  k.strokeStyle = 'rgba(255,255,255,0.5)'; k.lineWidth = 9;
  k.strokeRect(FRAME.u0 * COVER_LW + 4, FRAME.v0 * COVER_LH + 4, (FRAME.u1 - FRAME.u0) * COVER_LW - 8, (FRAME.v1 - FRAME.v0) * COVER_LH - 8);
  return { map, orm, bump, mask };
}

// 금빛 입자용 작은 동그라미
export function drawSpark(size = 64) {
  const cv = makeCanvas(size, size);
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,248,225,1)'); g.addColorStop(0.1, 'rgba(246,212,130,0.95)');
  g.addColorStop(0.28, 'rgba(214,160,60,0.28)'); g.addColorStop(1, 'rgba(214,160,60,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  // 십자 반짝임
  const s = size / 2;
  for (const [w, h] of [[size * 0.9, 2.2], [2.2, size * 0.9]]) {
    const lg = w > h ? ctx.createLinearGradient(s - w / 2, 0, s + w / 2, 0) : ctx.createLinearGradient(0, s - h / 2, 0, s + h / 2);
    lg.addColorStop(0, 'rgba(240,200,110,0)'); lg.addColorStop(0.5, 'rgba(255,240,200,0.9)'); lg.addColorStop(1, 'rgba(240,200,110,0)');
    ctx.fillStyle = lg; ctx.fillRect(s - w / 2, s - h / 2, w, h);
  }
  return cv;
}

// 바닥 그림자 (가장자리로 갈수록 완전히 투명 — 사각 판이 보이지 않음)
export function drawShadow(size = 128) {
  const cv = makeCanvas(size, size);
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.45, 'rgba(0,0,0,0.28)');
  g.addColorStop(0.8, 'rgba(0,0,0,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return cv;
}
