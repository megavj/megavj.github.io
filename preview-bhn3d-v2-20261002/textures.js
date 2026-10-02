// 보험노트 3D 책 v2 — 캔버스로 그리는 텍스처 (내려받는 그림 파일 0개)
// 글자는 일부러 읽히지 않게: 회색 막대(가짜 글줄)와 블록으로만 표현한다.
// 숫자·회사명·개인정보·문구 없음. 표지의 "보험노트 / 당신의 최고의 선택"만 실제 글자.
//
// v2 에서 새로 그리는 것:
//   - 가죽 결 높이/노멀맵 (자갈 모양 보로노이 + 미세 노이즈, 이어 붙는 타일)
//   - 앞표지: 색 + 거칠기/금속성 + 노멀(결 + 도드라진 글자) + 발광(글자) + 반짝임 마스크(글자/후광/금테)
//   - 종이: 크림색 + 종이 결 패턴 + 미세 노멀
//   - 종이 단면: 겹겹의 종이 줄무늬 (색 + 노멀)
//   - 바닥 그림자: 책 바닥 모양(둥근 네모)이 넓게 번진 모양

export const PAGE_LW = 1000;            // 페이지 논리 좌표 (종이 비율 1.30 : 1.80)
export const PAGE_LH = 1385;
export const COVER_LW = 1000;           // 앞표지 논리 좌표 (표지 비율 1.34 : 1.88)
export const COVER_LH = 1403;

const C = {
  paper: '#f5efe3', paperDeep: '#e9e1cf',
  ink: '#1f2b38', ink2: '#3f5266', ink3: '#7d8c9b', ink4: '#b9c3cc', ink5: '#dcdfe0',
  gold: '#b8893a', gold2: '#d8b268', goldPale: '#eee0bd',
  line: '#c2b8a3', lineDark: '#958a76', head: '#3f382f',
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
const sm = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

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

// ---------------------------------------------------------------- 높이·노멀 도구
// 이어 붙는(타일) 여러 겹 노이즈. octaves = [[칸 크기(px), 가중치], ...]
function noiseField(size, octaves, seed) {
  const R = rng(seed), out = new Float32Array(size * size);
  let wsum = 0;
  for (const [period, w] of octaves) {
    const n = Math.max(2, Math.round(size / period));
    const L = new Float32Array(n * n);
    for (let i = 0; i < L.length; i++) L[i] = R();
    const sc = n / size;
    for (let y = 0; y < size; y++) {
      const fy = y * sc, iy = Math.floor(fy), ty = sm(fy - iy), ry = iy * n, ry1 = ((iy + 1) % n) * n;
      for (let x = 0; x < size; x++) {
        const fx = x * sc, ix = Math.floor(fx), tx = sm(fx - ix), ix1 = (ix + 1) % n;
        const a = L[ry + ix] + (L[ry + ix1] - L[ry + ix]) * tx;
        const b = L[ry1 + ix] + (L[ry1 + ix1] - L[ry1 + ix]) * tx;
        out[y * size + x] += (a + (b - a) * ty) * w;
      }
    }
    wsum += w;
  }
  for (let i = 0; i < out.length; i++) out[i] /= wsum;
  return out;
}

// 가죽의 자갈 모양 결: 흐트러진 격자 보로노이. 칸 가운데는 둥글게 솟고 경계는 골짜기.
function pebbleField(size, cells, seed) {
  const R = rng(seed), px = new Float32Array(cells * cells), py = new Float32Array(cells * cells);
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
    px[j * cells + i] = (i + 0.2 + 0.6 * R()) / cells;
    py[j * cells + i] = (j + 0.2 + 0.6 * R()) / cells;
  }
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size, cj = Math.floor(v * cells);
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size, ci = Math.floor(u * cells);
      let d1 = 9, d2 = 9;
      for (let dj = -1; dj <= 1; dj++) {
        const kj = cj + dj, wj = (kj + cells) % cells, oy = (kj - wj) / cells;
        for (let di = -1; di <= 1; di++) {
          const ki = ci + di, wi = (ki + cells) % cells, ox = (ki - wi) / cells;
          const dx = px[wj * cells + wi] + ox - u, dy = py[wj * cells + wi] + oy - v;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
      }
      const edge = sm(Math.min(1, (d2 - d1) * cells * 1.7));          // 경계(골짜기) → 0
      const dome = 1 - 0.4 * Math.min(1, Math.pow(d1 * cells * 1.5, 2)); // 가운데가 봉긋
      out[y * size + x] = edge * dome;
    }
  }
  return out;
}

// 높이(0~1) → 탱전트 공간 노멀맵 캔버스. strength 가 클수록 울퉁불퉁
function heightToNormal(field, w, h, strength, wrap = true) {
  const cv = makeCanvas(w, h), ctx = cv.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) {
    const ym = wrap ? (y - 1 + h) % h : Math.max(0, y - 1), yp = wrap ? (y + 1) % h : Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const xm = wrap ? (x - 1 + w) % w : Math.max(0, x - 1), xp = wrap ? (x + 1) % w : Math.min(w - 1, x + 1);
      const dx = (field[y * w + xp] - field[y * w + xm]) * strength;
      const dy = (field[yp * w + x] - field[ym * w + x]) * strength;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const o = (y * w + x) * 4;
      d[o] = 128 - dx * inv * 127; d[o + 1] = 128 - dy * inv * 127; d[o + 2] = 128 + inv * 127; d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

function grayCanvas(field, size) {
  const cv = makeCanvas(size, size), ctx = cv.getContext('2d'), img = ctx.createImageData(size, size), d = img.data;
  for (let i = 0; i < field.length; i++) { const v = Math.round(clamp01(field[i]) * 255); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// 알파(0~1 배열) 상자 블러 (가로·세로 번갈아, passes 번 → 가우시안 비슷)
function blurAlpha(src, w, h, radius, passes) {
  let a = Float32Array.from(src), b = new Float32Array(w * h);
  const r = Math.max(1, Math.round(radius)), norm = 1 / (2 * r + 1);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {            // 가로
      const row = y * w;
      let s = 0;
      for (let k = -r; k <= r; k++) s += a[row + Math.min(w - 1, Math.max(0, k))];
      for (let x = 0; x < w; x++) {
        b[row + x] = s * norm;
        s += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {            // 세로
      let s = 0;
      for (let k = -r; k <= r; k++) s += b[Math.min(h - 1, Math.max(0, k)) * w + x];
      for (let y = 0; y < h; y++) {
        a[y * w + x] = s * norm;
        s += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
      }
    }
  }
  return a;
}
function alphaOf(cv) {
  const { width: w, height: h } = cv, d = cv.getContext('2d').getImageData(0, 0, w, h).data, a = new Float32Array(w * h);
  for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] / 255;
  return a;
}
function alphaToCanvas(a, w, h, rgb) {
  const cv = makeCanvas(w, h), ctx = cv.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  for (let i = 0; i < a.length; i++) { d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2]; d[i * 4 + 3] = Math.round(clamp01(a[i]) * 255); }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// ---------------------------------------------------------------- 가죽 결 (이어 붙는 타일)
let _leather = null;
export function leatherHeight(size = 512) {
  if (_leather && _leather.width === size) return _leather;
  const peb = pebbleField(size, 22, 31), fine = noiseField(size, [[5, 0.5], [3, 0.3], [2, 0.2]], 32), coarse = noiseField(size, [[64, 1], [28, 0.6]], 33);
  const f = new Float32Array(size * size);
  for (let i = 0; i < f.length; i++) f[i] = 0.62 * peb[i] + 0.24 * fine[i] + 0.14 * coarse[i];
  _leather = grayCanvas(f, size);
  _leather.__field = f;
  return _leather;
}
export function drawLeatherNormal(size = 512) {
  const hc = leatherHeight(size);
  return heightToNormal(hc.__field, size, size, 3.6, true);
}

// ---------------------------------------------------------------- 종이 결 (아주 미세한 노멀, 타일)
export function drawPaperNormal(size = 256) {
  const f = noiseField(size, [[4, 0.45], [2, 0.35], [11, 0.2]], 41);
  return heightToNormal(f, size, size, 1.3, true);
}

let _paperGrain = null;
function paperGrain() {
  if (_paperGrain) return _paperGrain;
  const s = 160, cv = makeCanvas(s, s), ctx = cv.getContext('2d'), img = ctx.createImageData(s, s), d = img.data, R = rng(52);
  const fib = noiseField(s, [[3, 0.6], [7, 0.4]], 53);
  for (let i = 0; i < s * s; i++) {
    const v = 215 + (fib[i] - 0.5) * 70 + (R() - 0.5) * 24;   // 흰 바탕에 섞을 결 (multiply 로 사용)
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = Math.max(0, Math.min(255, v)); d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return (_paperGrain = cv);
}

// ---------------------------------------------------------------- 가짜 글줄
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
  // 종이 결: 섬유 무늬를 곱하기로 아주 옅게
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.085;
  const p = ctx.createPattern(paperGrain(), 'repeat');
  if (p.setTransform) p.setTransform(new DOMMatrix().scale(1.6));
  ctx.fillStyle = p; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // 아주 옅은 얼룩 + 가장자리 미세한 그늘
  const R = rng(9000 + idx);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(150,125,85,${0.006 + R() * 0.009})`;
    const r = 40 + R() * 120;
    ctx.beginPath(); ctx.arc(R() * W, R() * H, r, 0, Math.PI * 2); ctx.fill();
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.78);
  vg.addColorStop(0, 'rgba(90,70,40,0)'); vg.addColorStop(1, 'rgba(90,70,40,0.07)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
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
  // 두꺼운 책: 제본 쪽으로 종이가 깊게 말려 들어가므로 그늘을 넓고 진하게
  const g = side === 'R' ? ctx.createLinearGradient(0, 0, 210, 0) : ctx.createLinearGradient(W, 0, W - 210, 0);
  g.addColorStop(0, 'rgba(60,44,22,0.42)');
  g.addColorStop(0.3, 'rgba(60,44,22,0.16)');
  g.addColorStop(0.65, 'rgba(60,44,22,0.05)');
  g.addColorStop(1, 'rgba(60,44,22,0)');
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
  ctx.strokeStyle = C.gold; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
  ctx.beginPath(); ctx.moveTo(x, y + h * 0.82); ctx.lineTo(x + w, y + h * 0.12); ctx.stroke(); ctx.setLineDash([]);
  const cy = 760, cw = (L.w - 40) / 3;
  for (let i = 0; i < 3; i++) {
    const cx = L.x0 + i * (cw + 20);
    fillRR(ctx, cx, cy, cw, 170, 14, i === 0 ? C.ink : '#e9e1d0');
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
  const tx = L.x0 + 420, tw = L.x1 - tx;
  ctx.fillStyle = C.ink5; ctx.fillRect(tx, 270, tw, 2);
  vals.forEach((v, i) => {
    const y = 310 + i * 64;
    fillRR(ctx, tx, y - 11, 22, 22, 5, cols[i]);
    fakeLine(ctx, tx + 36, y, 120 + R() * 60, 9, C.lineDark);
    fakeLine(ctx, tx + tw - 70, y, 70, 9, C.ink3);
    ctx.fillStyle = C.ink5; ctx.fillRect(tx, y + 30, tw, 1.5);
  });
  const by = 700;
  fillRR(ctx, L.x0, by, 220, 14, 7, C.head);
  for (let i = 0; i < 6; i++) {
    const y = by + 60 + i * 62;
    fakeLine(ctx, L.x0, y, 150, 9, C.lineDark);
    fillRR(ctx, L.x0 + 180, y - 13, L.w - 180, 26, 13, '#e8e0cf');
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
    fillRR(ctx, x, top, cw, ch, 18, '#f9f4e9');
    rr(ctx, x, top, cw, ch, 18); ctx.strokeStyle = hi ? C.gold : C.ink5; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); rr(ctx, x, top, cw, 150, 18); ctx.clip();
    ctx.fillStyle = hi ? C.ink : '#e5ddcd'; ctx.fillRect(x, top, cw, 150); ctx.restore();
    if (hi) {
      ctx.fillStyle = C.gold;
      ctx.beginPath(); ctx.moveTo(x + cw - 64, top); ctx.lineTo(x + cw - 24, top); ctx.lineTo(x + cw - 24, top + 70);
      ctx.lineTo(x + cw - 44, top + 56); ctx.lineTo(x + cw - 64, top + 70); ctx.closePath(); ctx.fill();
    }
    fakeLine(ctx, x + 24, top + 50, cw * 0.45, 12, hi ? C.gold2 : C.head);
    fillRR(ctx, x + 24, top + 84, cw * 0.62, 30, 8, hi ? '#ffffff' : C.ink2);
    for (let k = 0; k < 9; k++) {
      const y = top + 200 + k * 62;
      fakeLine(ctx, x + 24, y, cw * 0.42, 8, C.lineDark);
      const level = (k + i * 2) % 4 === 0 ? 0 : Math.min(3, 1 + ((k * 7 + i * 3) % 3) + (hi ? 1 : 0));
      if (k % 3 === 2) {
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
  const hp = s1[7];
  ctx.strokeStyle = C.ink3; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
  ctx.beginPath(); ctx.moveTo(hp[0], hp[1]); ctx.lineTo(hp[0], y + h); ctx.stroke(); ctx.setLineDash([]);
  fillRR(ctx, hp[0] - 90, hp[1] - 110, 180, 80, 12, C.ink);
  fakeLine(ctx, hp[0] - 66, hp[1] - 84, 90, 8, '#8b9cad');
  fillRR(ctx, hp[0] - 66, hp[1] - 66, 120, 18, 9, C.gold2);
  const ty = 800;
  for (let r = 0; r < 5; r++) {
    const yy = ty + r * 58;
    if (r === 0) fillRR(ctx, L.x0, yy - 24, L.w, 48, 8, '#e7dfcd');
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
    if (r % 2 === 0) { ctx.fillStyle = '#ece4d3'; ctx.fillRect(L.x0, y, L.w, rh); }
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
    fillRR(ctx, x + 4, y, cw - 8, chh - 8, 8, i === 17 ? C.ink : (marks.has(i) ? '#e7dcc2' : '#ece5d6'));
    fillRR(ctx, x + 14, y + 12, 18, 8, 4, i === 17 ? '#7e90a2' : C.ink4);
    if (marks.has(i)) { ctx.beginPath(); ctx.arc(x + cw - 24, y + chh - 26, 8, 0, Math.PI * 2); ctx.fillStyle = C.gold; ctx.fill(); }
    if (i === 17) fillRR(ctx, x + 14, y + 36, cw - 36, 10, 5, C.gold2);
    if (i === 9 || i === 10) fillRR(ctx, x + (i === 9 ? 14 : 0), y + 40, cw - (i === 9 ? 14 : 22), 12, 6, C.ink2);
  }
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
    fillRR(ctx, x, y, tw, th, 16, i === 0 ? C.ink : '#ece5d5');
    fakeLine(ctx, x + 24, y + 36, tw * 0.45, 9, i === 0 ? '#7d8fa1' : C.lineDark);
    const mx = x + tw / 2, my = y + th / 2 + 30;
    if (i === 0) {
      ctx.lineCap = 'round'; ctx.lineWidth = 26;
      ctx.strokeStyle = '#33465a'; ctx.beginPath(); ctx.arc(mx, my + 30, 110, Math.PI, 0); ctx.stroke();
      ctx.strokeStyle = C.gold2; ctx.beginPath(); ctx.arc(mx, my + 30, 110, Math.PI, Math.PI * 1.72); ctx.stroke();
      ctx.lineCap = 'butt';
      fillRR(ctx, mx - 50, my + 4, 100, 26, 13, '#ffffff');
    } else if (i === 1) {
      ctx.lineWidth = 22; ctx.strokeStyle = C.ink5; ctx.beginPath(); ctx.arc(mx, my, 85, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = C.ink2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(mx, my, 85, -Math.PI / 2, Math.PI * 0.95); ctx.stroke(); ctx.lineCap = 'butt';
      fillRR(ctx, mx - 36, my - 11, 72, 22, 11, C.head);
    } else if (i === 2) {
      ctx.strokeStyle = C.ink; ctx.lineWidth = 5; ctx.beginPath();
      let v = 0.5;
      for (let k = 0; k <= 12; k++) {
        v = Math.max(0.1, Math.min(0.9, v + (R() - 0.45) * 0.3));
        const px = x + 30 + (k * (tw - 60)) / 12, py = y + th - 40 - v * 170;
        k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
      fillRR(ctx, x + tw - 110, y + 24, 86, 26, 13, C.gold);
    } else {
      for (let k = 0; k < 6; k++) {
        const bx = x + 34 + k * ((tw - 68) / 6), bw = (tw - 68) / 6 - 14;
        let by = y + th - 30;
        [[C.ink, 40 + R() * 50], [C.ink3, 20 + R() * 40], [C.gold2, 10 + R() * 30]].forEach(([col, hh]) => {
          by -= hh; ctx.fillStyle = col; ctx.fillRect(bx, by, bw, hh - 3);
        });
      }
    }
  });
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
    ctx.fillStyle = done ? C.ink : '#f9f4e9'; ctx.fill();
    ctx.strokeStyle = done ? C.ink : C.ink4; ctx.lineWidth = 3; ctx.stroke();
    if (done) { ctx.strokeStyle = C.gold2; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(L.x0 + 9, y); ctx.lineTo(L.x0 + 16, y + 8); ctx.lineTo(L.x0 + 28, y - 9); ctx.stroke(); }
    fakeWords(ctx, R, L.x0 + 60, y, 280 + R() * 300, 10, done ? C.lineDark : C.line);
  }
  const my = 860;
  fillRR(ctx, L.x0, my, L.w, 200, 12, '#eee3cb');
  ctx.fillStyle = C.gold; ctx.fillRect(L.x0, my, 10, 200);
  fakeLine(ctx, L.x0 + 36, my + 44, 200, 12, C.head);
  fakePara(ctx, R, L.x0 + 36, my + 90, L.w - 72, 3, 30, 9, '#cbbc9a');
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

// ---------------------------------------------------------------- 종이 단면: 겹겹의 종이 줄무늬
// u = 길이 방향(한 번만), v = 두께 방향. 한 줄이 종이 한 장. 묶음(접지)마다 밝기가 조금씩 다르고
// 가끔 한 장이 살짝 들어가거나(어두운 줄) 튀어나온다(밝은 줄). 노멀맵은 같은 줄무늬를 홈으로.
export function drawPaperEdge(w = 64, h = 512) {
  const map = makeCanvas(w, h), ctx = map.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  const R = rng(5), SHEET = 4;                      // 한 장 = 4px
  const nSheets = Math.ceil(h / SHEET);
  const sheetTone = new Float32Array(nSheets), sheetOff = new Float32Array(nSheets);
  let bundle = 1;
  for (let s = 0; s < nSheets; s++) {
    if (s % 10 === 0) bundle = 0.80 + R() * 0.20;    // 접지 묶음마다 다른 밝기 (겹겹이 보이게)
    const r = R();
    sheetTone[s] = bundle * (r < 0.09 ? 0.52 : r > 0.94 ? 1.10 : 0.94 + R() * 0.08);
    sheetOff[s] = (R() - 0.5) * 0.6;                 // 장마다 살짝 어긋남
  }
  const wob = noiseField(w, [[16, 1], [6, 0.5]], 7);    // 길이 방향 저주파 흔들림 (w×w 중 한 줄만 사용)
  const height = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const s = Math.floor(y / SHEET), ph = (y % SHEET) / SHEET;
    for (let x = 0; x < w; x++) {
      const along = 0.90 + 0.16 * wob[x];              // 가로 방향 밝기 변화
      const saw = 0.66 + 0.34 * (1 - ph);              // 장 윗부분이 밝고 아래 틈이 어두움
      let v = 232 * sheetTone[s] * saw * along;
      v += (R() - 0.5) * 12;
      v = Math.max(30, Math.min(255, v));
      const o = (y * w + x) * 4;
      d[o] = v; d[o + 1] = v * 0.95; d[o + 2] = v * 0.84; d[o + 3] = 255;
      height[y * w + x] = (1 - ph) * 0.7 + sheetOff[s] * 0.3 + (sheetTone[s] < 0.6 ? -0.35 : 0);
    }
  }
  ctx.putImageData(img, 0, 0);
  const normal = heightToNormal(height, w, h, 2.0, true);
  return { map, normal };
}

// ---------------------------------------------------------------- 앞표지
// 금테 위치 (blender/build_book.py 의 금테와 같은 자리, 표지 좌표 비율)
const WC = 1.34, HC = 1.88;
export const FRAME = { u0: 0.10 / WC, u1: 1 - 0.06 / WC, v0: 0.06 / HC, v1: 1 - 0.06 / HC };
const TILES_ACROSS = 4.02;   // 가죽 타일이 표지 가로에 몇 번 반복되는지 (Leather 재질 repeat 3/단위 × 1.34)

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

function drawCoverText(ctx, L, fill, { shadow = false, titleOnly = false } = {}) {
  const put = (text, y, size, weight, spacing) => {
    ctx.font = `${weight} ${size}px ${FONT_STACK}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
    if (shadow) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(text, L.cx + 2, y + 3);
    }
    ctx.fillStyle = typeof fill === 'function' ? fill(y, size) : fill;
    ctx.fillText(text, L.cx, y);
  };
  if (!titleOnly) put('당신의 최고의 선택', L.sub.y, L.sub.size, 700, 6);
  put('보험노트', L.title.y, L.title.size, 800, 8);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  if (titleOnly) return;
  // 제목 아래 작은 장식 (선 + 마름모)
  const y = L.title.y + L.title.size * 0.78, half = 150;
  ctx.fillStyle = typeof fill === 'function' ? fill(y, 20) : fill;
  ctx.fillRect(L.cx - half, y - 1.5, half - 22, 3);
  ctx.fillRect(L.cx + 22, y - 1.5, half - 22, 3);
  ctx.beginPath(); ctx.moveTo(L.cx, y - 11); ctx.lineTo(L.cx + 11, y); ctx.lineTo(L.cx, y + 11); ctx.lineTo(L.cx - 11, y); ctx.closePath(); ctx.fill();
}

function goldGrad(ctx, bright = false) {
  return (y, size) => {
    const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
    if (bright) { g.addColorStop(0, '#fff3c4'); g.addColorStop(0.42, '#f6cf6e'); g.addColorStop(0.72, '#dca546'); g.addColorStop(1, '#ffe59a'); }
    else { g.addColorStop(0, '#f6e2a4'); g.addColorStop(0.42, '#e0b14f'); g.addColorStop(0.72, '#c58f37'); g.addColorStop(1, '#eccb79'); }
    return g;
  };
}

// 모서리가 살짝 닳은 느낌: 가장자리로 갈수록 옅게 밝아지는 띠 + 네 귀퉁이
function wearRim(ctx, color, strength) {
  for (let k = 0; k < 9; k++) {
    ctx.strokeStyle = `rgba(${color},${(strength * (1 - k / 9)).toFixed(3)})`;
    ctx.lineWidth = 7;
    const inset = 3 + k * 5.5;
    ctx.strokeRect(inset, inset, COVER_LW - 2 * inset, COVER_LH - 2 * inset);
  }
  for (const [x, y] of [[0, 0], [COVER_LW, 0], [0, COVER_LH], [COVER_LW, COVER_LH]]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 110);
    g.addColorStop(0, `rgba(${color},${(strength * 2.2).toFixed(3)})`); g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - 110, y - 110, 220, 220);
  }
}

// 반환: map(색), orm(G=거칠기, B=금속성), normal(결+도드라진 글자), emissive(빛나는 글자), mask(R=글자, G=후광, B=금테)
export function drawCover(width, leather) {
  const h = Math.round((width * COVER_LH) / COVER_LW);
  const mk = () => { const cv = makeCanvas(width, h); const ctx = cv.getContext('2d'); ctx.scale(width / COVER_LW, h / COVER_LH); return [cv, ctx]; };
  const [map, m] = mk(), [orm, o] = mk(), [hgt, g] = mk(), [mask, k] = mk(), [emis, e] = mk();
  const L = coverLayout(m); coverLayout(o); coverLayout(g); coverLayout(k); coverLayout(e);
  const pat = (ctx) => {
    const p = ctx.createPattern(leather, 'repeat');
    if (p.setTransform) p.setTransform(new DOMMatrix().scale(COVER_LW / (TILES_ACROSS * leather.width)));
    return p;
  };

  // 색: 아주 어두운 따뜻한 검정 가죽 + 결의 윗부분이 살짝 밝음 + 가장자리 닳음 + 비네트
  m.fillStyle = '#100e0d'; m.fillRect(0, 0, COVER_LW, COVER_LH);
  m.globalAlpha = 0.17; m.fillStyle = pat(m); m.fillRect(0, 0, COVER_LW, COVER_LH); m.globalAlpha = 1;
  m.globalCompositeOperation = 'multiply'; m.fillStyle = 'rgb(255,232,214)'; m.fillRect(0, 0, COVER_LW, COVER_LH);
  m.globalCompositeOperation = 'source-over';
  const vg = m.createRadialGradient(COVER_LW * 0.55, COVER_LH * 0.40, 120, COVER_LW * 0.55, COVER_LH * 0.5, COVER_LH * 0.85);
  vg.addColorStop(0, 'rgba(70,62,56,0.14)'); vg.addColorStop(1, 'rgba(0,0,0,0.38)');
  m.fillStyle = vg; m.fillRect(0, 0, COVER_LW, COVER_LH);
  wearRim(m, '150,118,82', 0.05);
  m.fillStyle = 'rgba(0,0,0,0.55)'; m.fillRect(0.040 * COVER_LW, 0, 7, COVER_LH);      // 책등 홈
  m.fillStyle = 'rgba(255,240,210,0.05)'; m.fillRect(0.040 * COVER_LW + 8, 0, 3, COVER_LH);
  drawCoverText(m, L, goldGrad(m), { shadow: true });

  // 거칠기(G)/금속성(B): 결 골짜기는 조금 더 거칠게, 가장자리 닳은 곳은 더 거칠게, 글자는 매끈한 금속
  o.fillStyle = pat(o); o.fillRect(0, 0, COVER_LW, COVER_LH);
  o.globalCompositeOperation = 'multiply'; o.fillStyle = 'rgb(0,255,0)'; o.fillRect(0, 0, COVER_LW, COVER_LH);
  o.globalCompositeOperation = 'source-over';
  o.fillStyle = 'rgba(0,118,0,0.74)'; o.fillRect(0, 0, COVER_LW, COVER_LH);          // G ≈ 0.34 ~ 0.60
  wearRim(o, '0,255,0', 0.07);
  drawCoverText(o, L, 'rgb(0,62,255)');

  // 높이 → 노멀: 가죽 결 + 글자 자리는 평평하고 테두리가 도드라짐
  g.fillStyle = pat(g); g.fillRect(0, 0, COVER_LW, COVER_LH);
  {
    const [tl, tc] = mk();
    drawCoverText(tc, L, 'rgb(215,215,215)');
    const a = blurAlpha(alphaOf(tl), width, h, Math.max(1, Math.round(width / 480)), 2);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(alphaToCanvas(a, width, h, [215, 215, 215]), 0, 0);
  }
  const normal = (() => {
    const dd = g.getImageData(0, 0, width, h).data, f = new Float32Array(width * h);
    for (let i = 0; i < f.length; i++) f[i] = dd[i * 4] / 255;
    return heightToNormal(f, width, h, 2.3, false);
  })();

  // 발광(글자만 금빛으로 빛남)
  e.fillStyle = '#000'; e.fillRect(0, 0, COVER_LW, COVER_LH);
  drawCoverText(e, L, goldGrad(e, true));

  // 반짝임 마스크: R = 글자(선명), G = 글자 둘레 후광(넓게 번짐), B = 금테
  k.fillStyle = '#000'; k.fillRect(0, 0, COVER_LW, COVER_LH);
  k.globalCompositeOperation = 'lighter';
  drawCoverText(k, L, 'rgb(255,0,0)');
  {
    const q = 4, w4 = Math.round(width / q), h4 = Math.round(h / q);
    const sc = makeCanvas(w4, h4), sctx = sc.getContext('2d');
    sctx.scale(w4 / COVER_LW, h4 / COVER_LH);
    const L4 = coverLayout(sctx);
    drawCoverText(sctx, L4, 'rgb(0,255,0)', { titleOnly: true });
    const src = alphaOf(sc);
    const near = blurAlpha(src, w4, h4, w4 / 70, 2), far = blurAlpha(src, w4, h4, w4 / 22, 3);
    const out = new Float32Array(src.length);
    for (let i = 0; i < out.length; i++) out[i] = Math.min(1, near[i] * 0.75 + far[i] * 1.6);
    k.drawImage(alphaToCanvas(out, w4, h4, [0, 255, 0]), 0, 0, COVER_LW, COVER_LH);
  }
  k.strokeStyle = 'rgb(0,0,255)'; k.lineWidth = 9;
  k.strokeRect(FRAME.u0 * COVER_LW + 4, FRAME.v0 * COVER_LH + 4, (FRAME.u1 - FRAME.u0) * COVER_LW - 8, (FRAME.v1 - FRAME.v0) * COVER_LH - 8);
  k.globalCompositeOperation = 'source-over';
  return { map, orm, normal, emissive: emis, mask, layout: L };
}

// 제목 글자 위에서 반짝일 자리 고르기 (글자 획 위의 점들, UV 0~1). 글꼴이 달라도 실제 글자 위를 고른다.
export function pickSparkles(mask, layout, n = 6, seed = 9) {
  const w = mask.width, h = mask.height, ctx = mask.getContext('2d');
  const sx = w / COVER_LW, sy = h / COVER_LH;
  const x0 = Math.round((layout.cx - COVER_LW * 0.34) * sx), x1 = Math.round((layout.cx + COVER_LW * 0.34) * sx);
  const y0 = Math.round((layout.title.y - layout.title.size * 0.5) * sy), y1 = Math.round((layout.title.y + layout.title.size * 0.5) * sy);
  const d = ctx.getImageData(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0)).data, ww = Math.max(1, x1 - x0), hh = Math.max(1, y1 - y0);
  const R = rng(seed), picks = [];
  for (let tries = 0; tries < 4000 && picks.length < n; tries++) {
    const px = Math.floor(R() * ww), py = Math.floor(R() * hh);
    if (d[(py * ww + px) * 4] < 200) continue;
    const u = (x0 + px) / w, v = (y0 + py) / h;
    if (picks.some((p) => Math.hypot(p.u - u, (p.v - v) * (HC / WC)) < 0.085)) continue;
    picks.push({ u, v, phase: R() });
  }
  while (picks.length < n) picks.push({ u: -1, v: -1, phase: 0 });   // 글꼴이 없어 글자가 안 그려진 경우: 화면 밖
  return picks;
}

// 반사용 가상 조명판의 부드러운 가장자리
export function drawSoftBox(size = 64) {
  const cv = makeCanvas(size, size), ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return cv;
}

// 바닥 그림자: 책 바닥 모양(둥근 네모)이 넓게 번짐. 가장자리는 완전히 투명 (사각 판이 보이지 않음)
export function drawShadow(size = 256) {
  const cv = makeCanvas(size, size), ctx = cv.getContext('2d'), img = ctx.createImageData(size, size), d = img.data;
  const hx = 0.5, hy = 0.5, r = 0.09;
  const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = ((x + 0.5) / size) * 2 - 1, py = ((y + 0.5) / size) * 2 - 1;
    const qx = Math.abs(px) - (hx - r), qy = Math.abs(py) - (hy - r);
    const dist = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;   // 둥근 네모까지의 거리
    const soft = 1 - smoothstep(-0.12, 0.42, dist);        // 넓은 반그림자
    const core = 1 - smoothstep(-0.30, 0.10, dist);        // 바닥에 닿은 곳의 진한 그늘
    const a = 0.5 * soft * soft + 0.42 * core * core;
    const o = (y * size + x) * 4;
    d[o] = d[o + 1] = d[o + 2] = 0; d[o + 3] = Math.round(clamp01(a) * 255);
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
