// 프라임에셋 188본부 홈 hero — 금가루 파티클 "188" v3 (2026-10)
// · main.js 가 동적 import 한다. null 을 돌려주거나 예외가 나면 main.js 가 .webgl-fallback(정적 금빛 188)으로 바꾼다.
// · 연출: 폭발 → 회오리 → 188 형성 → 번쩍·충격파 / 가산혼합 + 블룸 / 두께·금속 반사·기울기 / 커서 불꽃.
// · 성능: 기기 정보로 단계(TIERS)를 고르고, 실측 프레임이 계속 느리면 더 낮춘다(LEVELS). 탭이 숨거나 hero 가 화면 밖이면 멈춘다.
// · 배치(v4): slot(빈 자리 요소, 홈은 .hero-mark)을 넘기면 그 상자 안에 188을 맞춘다 → 레이아웃은 CSS 가 정하고 제목 글자와 겹치지 않는다.
//   slot 이 없으면 예전 고정 배치(PC 오른쪽 · 모바일 위쪽).
// · QA 강제 옵션: ?hero188=high|mid|mobile|lite|low|static|fallback
import * as THREE from 'three';

const TAU = Math.PI * 2;
const EM = 330 / 42;                 // 기존 연출과 같은 글자 크기(1em = 7.857 단위)
const DEPTH = 1.1;                   // 188 두께
const YAW = -.16;                    // 기본 비틀기 — 옆면 두께가 살짝 보이게
const T = { burst: .9, flash: 3.05, interact: 3.25, end: 4.9 };   // 등장 타임라인(초)
const BASE_SIZE = .1, BLOOM = .85, DIRECT_GAIN = .72;
const DENSITY = 278;                 // 밝기 기준: 화면 속 188 면적당 빛의 양을 단계와 상관없이 맞춘다(PC high 의 gain ≈ .78)
const PALETTE = [['#c4922a', .45], ['#e8c96a', .3], ['#f3e2b0', .15], ['#fff5df', .1]];   // 진한 금 · 금 · 샴페인 · 흰빛 하이라이트

// 기기 성능 단계 — count: 188 파티클, dust: 배경 먼지, maxPR·budget: 해상도 상한(배율·픽셀 수), bloom: 블룸 단계(0 = 블룸 없이 바로 그림)
const TIERS = {
  high:   { count: 14400, dust: 540, maxPR: 1.75, budget: 3.4e6, bloom: 5, size: 1 },
  mid:    { count: 9000, dust: 360, maxPR: 1.5,  budget: 2.2e6, bloom: 4, size: 1.08 },
  mobile: { count: 4800,  dust: 170, maxPR: 1.5,  budget: 1e6,   bloom: 3, size: 1.1 },
  lite:   { count: 2700,  dust: 100, maxPR: 1.25, budget: 6e5,   bloom: 0, size: 1.2 },
  low:    { count: 1800,  dust: 72, maxPR: 1,    budget: 5e5,   bloom: 0, size: 1.3 }
};
// 실측 프레임이 계속 느리면 한 단계씩 낮춘다(올리지는 않음, 낮춰도 안 빨라지면 원래대로 — govern() 참고).
const LEVELS = [
  { pr: 1,   bloomDrop: 0, count: 1,   dust: 1 },
  { pr: .82, bloomDrop: 1, count: 1,   dust: 1 },
  { pr: .7,  bloomDrop: 2, count: .62, dust: .6 },
  { pr: .62, bloomDrop: 9, count: .5,  dust: .5 }
];
const clamp = (v, a = -1, b = 1) => v < a ? a : v > b ? b : v;

/* ───────────── shaders ───────────── */

// HDR 버퍼에는 그대로, 블룸 없이 화면에 바로 그릴 때는 점마다 톤·감마를 적용한다. alpha = 최대 채널(올바른 premultiplied 합성).
const OUT_GLSL = `
uniform float uDirect;
vec4 hdrOut(vec3 c, float e) {
  vec3 o = uDirect > .5 ? pow(1. - exp(-c), vec3(.4545)) * e : c * e;
  return vec4(o, max(o.r, max(o.g, o.b)));
}`;

const PARTICLE_VS = `
uniform float uTime, uIntro, uIntroOn, uFlash, uWaveR, uWaveA, uPixel, uSize, uGain, uTwinkle, uIdle, uSheen, uMaxPoint, uHeatGain;
uniform vec3 uLight;
attribute vec3 aBurst;
attribute vec4 aSeed;   // x,y: 난수 · z: 위상 · w: 등장 지연(왼쪽→오른쪽)
attribute vec4 aDyn;    // xyz: 커서에 밀린 변위 · w: 열(불꽃 밝기)
attribute vec3 aColor;
attribute vec3 aNrm;
attribute vec2 aSz;     // x: 크기 배율 · y: 반짝임 세기
varying vec3 vColor;
varying float vGlint;
varying float vHalo;
const float TAU = 6.2831853;
const float PI = 3.1415927;
float sq(float x) { return x * x; }                // pow(음수, 2.)는 GLSL 에서 정의되지 않음(일부 모바일 GPU 에서 NaN)
float inOut(float x) { return x < .5 ? 4. * x * x * x : 1. - pow(2. - 2. * x, 3.) * .5; }
void main() {
  vec3 target = position;
  vec3 p = target;
  float hot = 0., settle = 1., arrive = 1.;
  if (uIntroOn > .5) {
    // ① 폭발: 중심의 작은 덩어리에서 사방으로
    float eb = 1. - pow(1. - clamp(uIntro / ${T.burst.toFixed(2)}, 0., 1.), 4.);
    vec3 pb = aBurst * mix(.05, 1., eb);
    // ② 회오리: 각도를 감으며 반지름을 좁혀 제자리로(정수 바퀴라 시작점이 끊기지 않음)
    float es = inOut(clamp((uIntro - .55 - aSeed.w * .75) / (1.45 + aSeed.x * .5), 0., 1.));
    float ab = atan(pb.y, pb.x), at = atan(target.y, target.x);
    float a = at + (mod(ab - at, TAU) + step(.62, aSeed.y) * TAU) * (1. - es);
    float r = mix(length(pb.xy), length(target.xy), es);
    p = vec3(cos(a) * r, sin(a) * r, mix(pb.z, target.z, es) + sin(es * PI) * (aSeed.y - .5) * 2.6);
    hot = (1. - eb) * 1.6 + sin(es * PI) * .25;
    settle = mix(1. - .6 * eb, 1., es);      // 흩어져 나는 동안은 어둡게(제목 글자를 덮지 않게), 모이면서 원래 밝기
    arrive = es;                             // 반짝임은 제자리에 도착하면서 켜진다
  }
  float ph = aSeed.z * TAU;
  p += uIdle * .016 * vec3(sin(uTime * .9 + ph), cos(uTime * .73 + ph * 1.3), sin(uTime * .61 + ph * .7));
  p += aDyn.xyz;
  // ③ 충격파: 형성 순간 중심에서 퍼지는 빛의 고리가 지나가며 살짝 밀고 밝힌다
  float dc = length(target.xy);
  float wv = uWaveA * exp(-sq((dc - uWaveR) * 1.1));
  p.xy += target.xy / max(dc, .001) * wv * .3;
  p.z += wv * .45;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  // ④ 금속 질감: 면·모서리 법선으로 명암, 거친 법선은 기울일 때마다 다른 금가루가 반짝인다
  vec3 N = normalize(normalMatrix * aNrm);
  vec3 H = normalize(uLight + normalize(-mv.xyz));
  float ndl = max(dot(N, uLight), 0.);
  float spec = pow(max(dot(N, H), 0.), 40.);
  float sheen = exp(-sq((dot(target.xy, vec2(.8, .6)) - uSheen) * .5));
  float shade = .38 + .62 * ndl + spec * 2.4 + sheen * .4;
  // ⑤ 반짝임 · 불꽃 · 번쩍
  float tw = uTwinkle * aSz.y * arrive * pow(max(.5 + .5 * sin(uTime * (.7 + aSeed.x * 1.7) + ph * 7.), 0.), 24.);
  float heat = aDyn.w;
  float boost = 1. + uFlash * 1.6 + wv * 1.8 + heat * uHeatGain + hot * 1.2;
  float white = clamp(tw * .75 + heat * .7 + hot * .45 + uFlash * .4 + spec * .35, 0., .92);
  vColor = mix(aColor, vec3(1., .92, .78), white) * shade * (1. + tw * 2.6) * boost * settle * uGain;
  vGlint = clamp(tw * 1.1 + heat * 1.2, 0., 1.);
  vHalo = 1. / (1. + length(aDyn.xyz) * 3.);   // 커서에 튕겨 나간 입자는 번짐을 걷어 또렷한 불꽃으로(어두운 배경에서 동그란 얼룩 방지)
  float size = uSize * aSz.x * (1. + tw * .9 + heat * .5 + uFlash * .35 + hot * .45 + wv * .6);
  gl_PointSize = clamp(size * uPixel / max(-mv.z, .1), 1., uMaxPoint);
}`;

const PARTICLE_FS = `
varying vec3 vColor;
varying float vGlint;
varying float vHalo;
${OUT_GLSL}
void main() {
  vec2 q = gl_PointCoord * 2. - 1.;
  float r2 = dot(q, q);
  if (r2 >= 1.) discard;
  float e = exp(-r2 * 14.) + exp(-r2 * 3.2) * .16 * vHalo;         // 밝은 심 + 은은한 번짐
  e += vGlint * (exp(-abs(q.x) * 18. - abs(q.y) * 2.2) + exp(-abs(q.y) * 18. - abs(q.x) * 2.2)) * .45;  // 십자 반짝임
  gl_FragColor = hdrOut(vColor, e * (1. - r2));
}`;

const DUST_VS = `
uniform float uTime, uPixel, uSize, uGain, uWaveR, uWaveA, uFade, uMotion, uMaxPoint;
uniform vec2 uWaveC;
attribute vec4 aSeed;
varying vec3 vColor;
void main() {
  float ph = aSeed.w * 6.2831853;
  vec3 p = position + uMotion * vec3(sin(uTime * .045 + ph) * .7, cos(uTime * .038 + ph * 1.7) * .45, 0.);
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  gl_Position = projectionMatrix * mv;
  float tw = mix(1., .45 + .55 * sin(uTime * (.35 + aSeed.x * .9) + ph * 3.), uMotion * .85);
  vec4 wp = modelMatrix * vec4(p, 1.);
  float dw = (length(wp.xy - uWaveC) - uWaveR) * .5;
  float wv = uWaveA * exp(-dw * dw);
  vColor = mix(vec3(.16, .1, .02), vec3(.72, .52, .18), aSeed.y * aSeed.y) * max(tw, 0.) * (1. + wv * 2.5) * uGain * uFade;
  gl_PointSize = clamp(uSize * (.5 + aSeed.z) * uPixel / max(-mv.z, .1), 1., uMaxPoint);
}`;

const DUST_FS = `
varying vec3 vColor;
${OUT_GLSL}
void main() {
  vec2 q = gl_PointCoord * 2. - 1.;
  float r2 = dot(q, q);
  if (r2 >= 1.) discard;
  gl_FragColor = hdrOut(vColor, exp(-r2 * 4.5) * (1. - r2));
}`;

const RING_VS = `
uniform float uR;
varying vec2 vP;
void main() {
  vP = position.xy * (uR + 3.);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(vP, .56, 1.);
}`;

const RING_FS = `
uniform float uR, uA;
varying vec2 vP;
${OUT_GLSL}
void main() {
  float d = length(vP), x = d - uR;
  float ring = exp(-x * x * 5.76) + exp(-x * x * .81) * .1;
  ring *= 1. - smoothstep(uR + 1.6, uR + 2.9, d);   // 사각 판 가장자리에서 정확히 0 (감마 보정 뒤 네모 테두리가 보이지 않게)
  gl_FragColor = hdrOut(vec3(1., .74, .32) * uA, ring);
}`;

const QUAD_VS = `
varying vec2 vUv;
void main() { vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, 0., 1.); }`;

// 블룸: 밝은 부분 추출 + 단계별 1/2 축소(5탭) → 확대(9탭 텐트)하며 합산 (dual filter 방식, 저해상도라 가볍다)
// 첫 단계는 "평균을 낸 뒤" 문턱을 적용한다 → 촘촘한 188 몸체만 크게 번지고, 홀로 떨어진 점은 동그란 얼룩(보케)이 생기지 않는다.
const DOWN_FS = `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uPre, uThreshold, uKnee;
varying vec2 vUv;
void main() {
  vec3 s = texture2D(tSrc, vUv).rgb * 4.;
  s += texture2D(tSrc, vUv - uTexel).rgb + texture2D(tSrc, vUv + uTexel).rgb;
  s += texture2D(tSrc, vUv + vec2(uTexel.x, -uTexel.y)).rgb + texture2D(tSrc, vUv + vec2(-uTexel.x, uTexel.y)).rgb;
  vec3 c = s * .125;
  if (uPre > .5) {
    float br = max(c.r, max(c.g, c.b));
    float soft = clamp(br - uThreshold + uKnee, 0., 2. * uKnee);
    soft = soft * soft / (4. * uKnee + 1e-4);
    c = min(c * max(soft, br - uThreshold) / max(br, 1e-4), vec3(4.));
  }
  gl_FragColor = vec4(c, 1.);
}`;

const UP_FS = `
uniform sampler2D tSrc, tAdd;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec2 o = uTexel;
  vec3 s = texture2D(tSrc, vUv).rgb * 4.;
  s += (texture2D(tSrc, vUv + vec2(o.x, 0.)).rgb + texture2D(tSrc, vUv - vec2(o.x, 0.)).rgb + texture2D(tSrc, vUv + vec2(0., o.y)).rgb + texture2D(tSrc, vUv - vec2(0., o.y)).rgb) * 2.;
  s += texture2D(tSrc, vUv + o).rgb + texture2D(tSrc, vUv - o).rgb + texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb + texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb;
  gl_FragColor = vec4(s / 16. + texture2D(tAdd, vUv).rgb, 1.);
}`;

// 합성: 장면 + 블룸 → 부드러운 톤(흰색 포화 방지) → sRGB, 투명 배경 유지
const COMP_FS = `
uniform sampler2D tScene, tBloom;
uniform float uBloom, uExposure;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tScene, vUv).rgb * uExposure + texture2D(tBloom, vUv).rgb * uBloom;
  c = pow(1. - exp(-c), vec3(.4545));
  float m = max(c.r, max(c.g, c.b));
  c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - .5) / 255. * step(.01, m);
  c = clamp(c, 0., 1.);
  gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)));
}`;

/* ───────────── 기기 판정 ───────────── */

function getGL(canvas) {
  const attrs = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
  try {
    let gl = canvas.getContext('webgl2', { ...attrs, failIfMajorPerformanceCaveat: true });
    if (gl) return { gl, software: false };
    gl = canvas.getContext('webgl2', attrs);          // 소프트웨어 렌더링(SwiftShader 등)일 때만 여기서 성공
    return gl ? { gl, software: true } : null;
  } catch (e) {
    return null;
  }
}

function gpuName(gl) {
  try {
    let name = String(gl.getParameter(gl.RENDERER) || '');
    if (/webkit webgl/i.test(name)) {               // Chrome 계열은 가려진 이름을 준다
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) name = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || name);
    }
    return name;
  } catch (e) {
    return '';
  }
}

function pickTier(force, mobile, software, gpu) {
  if (TIERS[force]) return force;
  if (software || /swiftshader|llvmpipe|softpipe|software|basic render/i.test(gpu)) return 'low';
  const nav = navigator, cores = nav.hardwareConcurrency || 4, mem = nav.deviceMemory;   // deviceMemory 는 Chrome 계열만
  const saveData = !!(nav.connection && nav.connection.saveData);
  const ios = /iP(hone|ad|od)/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
  if (mobile) {
    if (saveData) return 'lite';
    if (ios) return 'mobile';                       // iOS 는 코어 수를 낮춰 보고하므로 GPU 세대를 믿고 기본값
    return cores < 6 || (mem && mem < 4) ? 'lite' : 'mobile';
  }
  if (saveData || matchMedia('(pointer: coarse)').matches) return 'mid';   // 태블릿·데이터 절약
  return cores >= 8 && (!mem || mem >= 8) ? 'high' : 'mid';
}

async function fontReady() {
  if (!document.fonts || !document.fonts.load) return;
  await Promise.race([document.fonts.load('700 100px Marcellus').catch(() => {}), new Promise(r => setTimeout(r, 2500))]);
}

/* ───────────── 188 형태 샘플링 ───────────── */

function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let s = 0;
    for (let x = -r; x <= r; x++) s += src[row + clamp(x, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = s / n;
      s += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[clamp(y, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = s / n;
      s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

// 글자를 캔버스에 그려 안쪽 칸·가장자리 칸·흐린 마스크(베벨 법선용)를 만든다.
function sampleGlyph() {
  const FONT = 300, PAD = 24, STEP = 2, font = `700 ${FONT}px Marcellus, serif`;
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.font = font;
  const m = ctx.measureText('188');
  const L = Math.ceil(m.actualBoundingBoxLeft || 0), R = Math.ceil(m.actualBoundingBoxRight || m.width);
  const A = Math.ceil(m.actualBoundingBoxAscent || FONT * .75), D = Math.ceil(m.actualBoundingBoxDescent || FONT * .05);
  const W = L + R + PAD * 2, H = A + D + PAD * 2;
  cv.width = W; cv.height = H;                      // 크기를 바꾸면 컨텍스트 상태가 초기화된다
  ctx.font = font; ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  ctx.fillText('188', PAD + L, PAD + A);
  const px = ctx.getImageData(0, 0, W, H).data;
  const gw = Math.floor(W / STEP), gh = Math.floor(H / STEP), mask = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const o = (j * STEP * W + i * STEP) * 4;
    mask[j * gw + i] = (px[o + 3] + px[o + 7] + px[o + W * 4 + 3] + px[o + W * 4 + 7]) / 1020;
  }
  const blur = boxBlur(boxBlur(mask, gw, gh, 4), gw, gh, 4);
  const inside = [], edge = [];
  let minX = gw, maxX = 0, minY = gh, maxY = 0;
  for (let j = 1; j < gh - 1; j++) for (let i = 1; i < gw - 1; i++) {
    const k = j * gw + i;
    if (mask[k] < .5) continue;
    inside.push(k);
    if (mask[k - 1] < .5 || mask[k + 1] < .5 || mask[k - gw] < .5 || mask[k + gw] < .5) edge.push(k);
    if (i < minX) minX = i; if (i > maxX) maxX = i; if (j < minY) minY = j; if (j > maxY) maxY = j;
  }
  if (inside.length < 200 || !edge.length) return null;
  return { gw, blur, inside: Int32Array.from(inside), edge: Int32Array.from(edge), minX, maxX, minY, maxY, cx: (minX + maxX + 1) / 2, cy: (minY + maxY + 1) / 2, unit: STEP * EM / FONT };
}

function buildParticles(g, n) {
  const pos = new Float32Array(n * 3), burst = new Float32Array(n * 3), seed = new Float32Array(n * 4), col = new Float32Array(n * 3);
  const nrm = new Float32Array(n * 3), sz = new Float32Array(n * 2), rnd = new Float32Array(n);
  const colors = PALETTE.map(([hex]) => new THREE.Color(hex));   // 선형 색공간으로 변환됨
  const cum = []; let acc = 0; for (const [, w] of PALETTE) cum.push(acc += w);
  const { gw, blur, inside, edge, cx, cy, unit } = g, half = DEPTH / 2;
  const left = (g.minX - cx) * unit, span = (g.maxX + 1 - g.minX) * unit;
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const i2 = i * 2, i3 = i * 3, i4 = i * 4;
    // 앞면 50% · 뒷면 14% · 옆벽 22% · 내부 14% → 회전하면 두께가 보인다
    const r = Math.random(), kind = r < .5 ? 0 : r < .64 ? 1 : r < .86 ? 2 : 3;
    const list = kind === 2 ? edge : inside, k = list[(Math.random() * list.length) | 0];
    const ci = k % gw, cj = (k - ci) / gw;
    const jx = kind === 2 ? .5 + (Math.random() - .5) * .7 : Math.random(), jy = kind === 2 ? .5 + (Math.random() - .5) * .7 : Math.random();
    const x = (ci + jx - cx) * unit, y = -(cj + jy - cy) * unit;
    let gx = blur[k + 1] - blur[k - 1], gy = blur[k + gw] - blur[k - gw];
    const gl = Math.hypot(gx, gy) || 1;
    gx = -gx / gl; gy = gy / gl;                                   // 바깥쪽 방향(화면 y축 뒤집음)
    const e = clamp(1 - (blur[k] - .5) * 2.2, 0, 1);               // 가장자리일수록 1 → 베벨처럼 기운 법선
    let z;
    if (kind === 0) { z = half - Math.random() * .05; v.set(gx * e, gy * e, 1); }
    else if (kind === 1) { z = -half + Math.random() * .05; v.set(gx * e, gy * e, -1); }
    else if (kind === 2) { z = (Math.random() - .5) * DEPTH; v.set(gx, gy, (Math.random() - .5) * .4); }
    else { z = (Math.random() - .5) * DEPTH * .85; v.set(Math.random() - .5, Math.random() - .5, Math.random() - .2); }
    v.normalize();
    v.x += (Math.random() - .5) * .45; v.y += (Math.random() - .5) * .45; v.z += (Math.random() - .5) * .45;
    v.normalize();
    pos[i3] = x; pos[i3 + 1] = y; pos[i3 + 2] = z;
    nrm[i3] = v.x; nrm[i3 + 1] = v.y; nrm[i3 + 2] = v.z;
    // 색·크기·반짝임
    const c = Math.random();
    let pi = 0; while (pi < 3 && c > cum[pi]) pi++;
    const base = colors[pi], j = .88 + Math.random() * .24;
    col[i3] = base.r * j; col[i3 + 1] = base.g * j * (.97 + Math.random() * .06); col[i3 + 2] = base.b * j;
    const highlight = pi === 3;
    let s = .55 + Math.pow(Math.random(), 2.4) * .95;
    if (highlight) s *= 1.15 + Math.random() * .3;
    if (Math.random() < .02) s *= 1.35;
    sz[i2] = s;
    sz[i2 + 1] = highlight ? .65 + Math.random() * .35 : Math.random() < .1 ? .2 + Math.random() * .35 : 0;
    seed[i4] = Math.random(); seed[i4 + 1] = Math.random(); seed[i4 + 2] = Math.random();
    seed[i4 + 3] = clamp((x - left) / span, 0, 1) * .62 + Math.random() * .38;   // 1 → 8 → 8 순서로 모인다
    // 폭발 위치: 화면 밖까지 퍼지는 납작한 구
    const u = Math.random() * 2 - 1, a = Math.random() * TAU, sr = Math.sqrt(1 - u * u), R = 4 + Math.pow(Math.random(), .8) * 10;
    burst[i3] = Math.cos(a) * sr * R; burst[i3 + 1] = Math.sin(a) * sr * R * .8; burst[i3 + 2] = u * R * .45;
    rnd[i] = .65 + Math.random() * .7;
  }
  const box = [left, left + span, -(g.maxY + 1 - cy) * unit, -(g.minY - cy) * unit];   // minX, maxX, minY, maxY
  return { pos, burst, seed, col, nrm, sz, rnd, box, dyn: new Float32Array(n * 4), vel: new Float32Array(n * 3) };
}

function buildDust(n) {
  const pos = new Float32Array(n * 3), seed = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const front = Math.random() < .08;              // 일부는 카메라 앞쪽(흐릿한 큰 입자) → 깊이감
    pos[i * 3] = (Math.random() - .5) * 40;
    pos[i * 3 + 1] = (Math.random() - .5) * 24;
    pos[i * 3 + 2] = front ? 2 + Math.random() * 6 : -1.5 - Math.random() * 12;
    seed[i * 4] = Math.random();
    seed[i * 4 + 1] = front ? Math.random() * .35 : Math.random();
    seed[i * 4 + 2] = front ? 1 + Math.random() * 1.2 : Math.random();
    seed[i * 4 + 3] = Math.random();
  }
  return { pos, seed };
}

/* ───────────── 블룸 ───────────── */

function createBloom(renderer) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const quad = new THREE.Mesh(geo);
  quad.frustumCulled = false;
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const pass = (fragmentShader, uniforms) => new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader, uniforms, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
  const down = pass(DOWN_FS, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uPre: { value: 0 }, uThreshold: { value: .4 }, uKnee: { value: .3 } });
  const up = pass(UP_FS, { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new THREE.Vector2() } });
  const comp = pass(COMP_FS, { tScene: { value: null }, tBloom: { value: null }, uBloom: { value: 0 }, uExposure: { value: 1 } });
  const opts = { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const sceneRT = new THREE.WebGLRenderTarget(1, 1, opts);
  let downs = [], ups = [];
  function setSize(w, h, levels) {
    if (levels !== downs.length) {
      downs.concat(ups).forEach(rt => rt.dispose());
      downs = []; ups = [];
      for (let i = 0; i < levels; i++) {
        downs.push(new THREE.WebGLRenderTarget(1, 1, opts));
        if (i < levels - 1) ups.push(new THREE.WebGLRenderTarget(1, 1, opts));
      }
    }
    if (!levels) { sceneRT.setSize(1, 1); return; }  // 블룸을 끈 단계에서는 메모리 반납
    sceneRT.setSize(w, h);
    for (let i = 0; i < levels; i++) {
      w = Math.max(1, w >> 1); h = Math.max(1, h >> 1);
      downs[i].setSize(w, h);
      if (ups[i]) ups[i].setSize(w, h);
    }
  }
  function render(scene, camera, strength, exposure) {
    renderer.setRenderTarget(sceneRT);
    renderer.clear(true, false, false);
    renderer.render(scene, camera);
    let src = sceneRT;
    quad.material = down;
    for (let i = 0; i < downs.length; i++) {
      down.uniforms.tSrc.value = src.texture;
      down.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      down.uniforms.uPre.value = i ? 0 : 1;
      renderer.setRenderTarget(downs[i]);
      renderer.render(quad, cam);
      src = downs[i];
    }
    quad.material = up;
    for (let i = ups.length - 1; i >= 0; i--) {
      up.uniforms.tSrc.value = src.texture;
      up.uniforms.tAdd.value = downs[i].texture;
      up.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      renderer.setRenderTarget(ups[i]);
      renderer.render(quad, cam);
      src = ups[i];
    }
    quad.material = comp;
    comp.uniforms.tScene.value = sceneRT.texture;
    comp.uniforms.tBloom.value = src.texture;
    comp.uniforms.uBloom.value = downs.length ? strength / downs.length : 0;
    comp.uniforms.uExposure.value = exposure;
    renderer.setRenderTarget(null);
    renderer.render(quad, cam);
  }
  return { setSize, render };
}

/* ───────────── 본체 ───────────── */

export async function createHero188({ canvas, reduced = false, mobile = false, slot = null } = {}) {
  const force = (new URLSearchParams(location.search).get('hero188') || '').toLowerCase();
  if (force === 'fallback') return null;
  if (force === 'static') reduced = true;
  const ctx = getGL(canvas);
  if (!ctx) return null;
  const tierName = pickTier(force, mobile, ctx.software, gpuName(ctx.gl));
  const tier = TIERS[tierName];

  await fontReady();
  const glyph = sampleGlyph();
  if (!glyph) return null;

  const renderer = new THREE.WebGLRenderer({ canvas, context: ctx.gl, alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  let shaderError = false;
  renderer.debug.onShaderError = () => { shaderError = true; };
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 0);
  const hdr = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const range = ctx.gl.getParameter(ctx.gl.ALIASED_POINT_SIZE_RANGE);
  const maxPoint = Math.min(96, range && range[1] ? range[1] : 64);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
  camera.position.z = 18;
  const group = new THREE.Group();
  scene.add(group);
  const additive = { transparent: true, depthTest: false, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor };
  const direct = { value: 0 };

  // 188 금가루
  const P = buildParticles(glyph, tier.count);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P.pos, 3));
  geo.setAttribute('aBurst', new THREE.BufferAttribute(P.burst, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(P.seed, 4));
  geo.setAttribute('aColor', new THREE.BufferAttribute(P.col, 3));
  geo.setAttribute('aNrm', new THREE.BufferAttribute(P.nrm, 3));
  geo.setAttribute('aSz', new THREE.BufferAttribute(P.sz, 2));
  const dynAttr = new THREE.BufferAttribute(P.dyn, 4).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aDyn', dynAttr);
  const pU = {
    uTime: { value: 0 }, uIntro: { value: 0 }, uIntroOn: { value: 1 }, uFlash: { value: 0 }, uWaveR: { value: 0 }, uWaveA: { value: 0 },
    uPixel: { value: 1000 }, uSize: { value: BASE_SIZE }, uGain: { value: 1 }, uTwinkle: { value: 1 }, uIdle: { value: reduced ? 0 : 1 },
    uSheen: { value: -2.5 }, uMaxPoint: { value: maxPoint }, uHeatGain: { value: 2.2 }, uLight: { value: new THREE.Vector3(-.45, .55, .7).normalize() }, uDirect: direct
  };
  const points = new THREE.Points(geo, new THREE.ShaderMaterial({ uniforms: pU, vertexShader: PARTICLE_VS, fragmentShader: PARTICLE_FS, ...additive }));
  points.frustumCulled = false;
  group.add(points);

  // 형성 순간의 충격파 고리
  const rU = { uR: { value: 0 }, uA: { value: 0 }, uDirect: direct };
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: rU, vertexShader: RING_VS, fragmentShader: RING_FS, ...additive }));
  ring.frustumCulled = false;
  group.add(ring);

  // 배경 금먼지(깊이별로 시차가 생긴다)
  const D = buildDust(tier.dust);
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(D.pos, 3));
  dGeo.setAttribute('aSeed', new THREE.BufferAttribute(D.seed, 4));
  const dU = {
    uTime: { value: 0 }, uPixel: { value: 1000 }, uSize: { value: .07 }, uGain: { value: 1 }, uWaveR: { value: 0 }, uWaveA: { value: 0 },
    uWaveC: { value: new THREE.Vector2() }, uFade: { value: 1 }, uMotion: { value: reduced ? 0 : 1 }, uMaxPoint: { value: maxPoint }, uDirect: direct
  };
  const dust = new THREE.Points(dGeo, new THREE.ShaderMaterial({ uniforms: dU, vertexShader: DUST_VS, fragmentShader: DUST_FS, ...additive }));
  dust.frustumCulled = false;
  scene.add(dust);

  const bloom = hdr && tier.bloom ? createBloom(renderer) : null;

  /* 상태 */
  const q = { level: 0, bloom: 0, count: tier.count, pr: 1 };
  const place = { x: 4.4, y: .2, s: .82, narrow: false, glow: 1, glowSet: null };
  const tilt = new THREE.Vector2(), tiltGoal = new THREE.Vector2();   // x: 위아래(rotation.x), y: 좌우(rotation.y)
  const ptr = { x: 0, y: 0, on: false };
  const pl = new THREE.Vector2(), plVel = new THREE.Vector2(), ndc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster(), plane = new THREE.Plane(), planeN = new THREE.Vector3(), hit = new THREE.Vector3(), buf = new THREE.Vector2();
  let plOK = false, plHad = false, rect = canvas.getBoundingClientRect(), rectDirty = false, active = 0;
  let started = false, running = false, inView = true, lost = false, raf = 0, last = 0, time = 0, intro = 0, flash = 0;
  const gov = { warm: 1000, ema: 16, slow: 0, probe: null, locked: false };   // warm: 측정 전 대기(ms)
  const info = window.__HERO188__ = { tier: tierName, count: tier.count, drawCount: tier.count, bloom: 0, pixelRatio: 1, level: 0, reduced, hdr, frames: 0 };   // QA 확인용

  // 밝기 = 화면 속 188 면적당 빛의 양(입자 수 × 크기² ÷ 배치 크기²)이 단계와 무관하게 일정하도록 맞춘다.
  // 예전 배치의 모바일은 188이 제목 글자 바로 뒤에 깔리므로 PC의 절반 밝기. slot 배치면 slot 의 --h188-glow 값을 쓴다.
  function setGains() {
    const comp = tier.count / q.count, k = q.bloom ? 1 : DIRECT_GAIN, size = BASE_SIZE * tier.size * Math.pow(comp, .25);
    place.glow = place.glowSet != null ? place.glowSet : place.narrow ? .5 : 1;
    direct.value = q.bloom ? 0 : 1;
    pU.uSize.value = size;
    pU.uGain.value = DENSITY * place.glow * place.s * place.s / (q.count * size * size) * k;
    dU.uGain.value = k * (place.narrow ? .8 : 1);
  }

  function applyQuality() {
    const L = LEVELS[q.level];
    q.bloom = bloom && tier.bloom - L.bloomDrop >= 2 ? tier.bloom - L.bloomDrop : 0;
    q.count = Math.round(tier.count * L.count);
    geo.setDrawRange(0, q.count);                   // 입자 순서가 무작위라 앞에서 자르면 고르게 줄어든다
    dGeo.setDrawRange(0, Math.round(tier.dust * L.dust));
    resize();                                       // 밝기·크기 보정(setGains)도 여기서 함께
    Object.assign(info, { level: q.level, drawCount: q.count, bloom: q.bloom, locked: gov.locked });
  }

  // slot 상자에 188을 맞춘다: 화면 1px 이 z=0 평면에서 몇 단위인지 구해 위치·크기를 정한다.
  // FIT: 상자 대비 여백 — 기울기·커서 반응으로 살짝 커지거나 돌아가도 상자 밖(제목 쪽)으로 넘치지 않게.
  const FIT = .9;
  function fitSlot() {
    if (!slot || !slot.isConnected) return false;
    const c = canvas.getBoundingClientRect(), r = slot.getBoundingClientRect();
    if (r.width < 40 || c.height < 1) return false;
    const rh = r.height >= 24 ? r.height : r.width / 2;   // 높이를 못 잰 경우(구형 브라우저 등) 2:1 로 본다
    const unit = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / c.height;
    const bw = P.box[1] - P.box[0], bh = P.box[3] - P.box[2];
    place.x = (r.left + r.width / 2 - (c.left + c.width / 2)) * unit;
    place.y = (c.top + c.height / 2 - (r.top + rh / 2)) * unit;
    place.s = Math.min(r.width * unit / bw, rh * unit / bh) * FIT;
    const g = parseFloat(getComputedStyle(slot).getPropertyValue('--h188-glow'));
    place.glowSet = Number.isFinite(g) ? g : null;
    info.slot = { x: +place.x.toFixed(2), y: +place.y.toFixed(2), s: +place.s.toFixed(3), wPx: Math.round(bw * place.s / unit), hPx: Math.round(bh * place.s / unit) };   // QA: 화면 속 188 크기(px)
    return true;
  }

  let sizeW = 0, sizeH = 0, sizePR = 0;
  function resize() {
    if (lost) return;
    const w = Math.max(1, Math.round(canvas.clientWidth || innerWidth)), h = Math.max(1, Math.round(canvas.clientHeight || innerHeight));
    q.pr = Math.max(.5, Math.min(devicePixelRatio || 1, tier.maxPR, Math.sqrt(tier.budget / (w * h))) * LEVELS[q.level].pr);
    const sized = w !== sizeW || h !== sizeH || q.pr !== sizePR;
    if (sized) {                                    // 크기가 같으면 캔버스를 다시 만들지 않는다(배치만 다시 계산)
      sizeW = w; sizeH = h; sizePR = q.pr;
      renderer.setPixelRatio(q.pr);
      renderer.setSize(w, h, false);                // 캔버스 크기는 CSS(hero 영역)가 정한다
      renderer.getDrawingBufferSize(buf);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      const pix = buf.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
      pU.uPixel.value = pix; dU.uPixel.value = pix;
    }
    if (bloom) bloom.setSize(buf.x, buf.y, q.bloom);
    const narrow = place.narrow = w <= 800;
    if (!fitSlot()) {                               // slot 이 없으면 예전 배치: PC 오른쪽, 모바일 위쪽
      place.x = narrow ? 1.6 : 4.4; place.y = narrow ? 1.6 : .2; place.s = narrow ? .68 : .82; place.glowSet = null;
    }
    setGains();
    rectDirty = true;
    info.pixelRatio = +q.pr.toFixed(2);
    if (started && (sized || !running)) { update(0); draw(); }   // 캔버스 크기를 바꾸면 화면이 지워지므로 바로 다시 그린다(깜빡임 방지)
  }

  /* 입력: 마우스 기울기 · 커서/터치 위치 · 기기 기울기 */
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  function onPointer(e) {
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.on = true;
    if (e.pointerType === 'mouse' && !reduced) tiltGoal.set((e.clientY / innerHeight * 2 - 1) * .13, (e.clientX / innerWidth * 2 - 1) * .22);
  }
  const touchOff = e => { if (e.pointerType !== 'mouse') ptr.on = false; };
  const releaseAll = () => { ptr.on = false; tiltGoal.set(0, 0); };

  function pointerLocal(dt) {
    plOK = false;
    if (!ptr.on || reduced || intro < T.interact) { plHad = false; return; }
    if (rectDirty) { rect = canvas.getBoundingClientRect(); rectDirty = false; }
    const nx = (ptr.x - rect.left) / rect.width * 2 - 1, ny = 1 - (ptr.y - rect.top) / rect.height * 2;
    if (!(nx > -1 && nx < 1 && ny > -1 && ny < 1)) { plHad = false; return; }
    raycaster.setFromCamera(ndc.set(nx, ny), camera);
    planeN.set(0, 0, 1).applyQuaternion(group.quaternion);
    plane.setFromNormalAndCoplanarPoint(planeN, group.position);
    if (!raycaster.ray.intersectPlane(plane, hit)) { plHad = false; return; }
    group.worldToLocal(hit);
    if (plHad && dt > 0) {
      const k = 1 - Math.exp(-dt * 12);
      plVel.x += ((hit.x - pl.x) / dt - plVel.x) * k;
      plVel.y += ((hit.y - pl.y) / dt - plVel.y) * k;
      const sp = plVel.length();
      if (sp > 40) plVel.multiplyScalar(40 / sp);
    } else if (!plHad) plVel.set(0, 0);
    pl.set(hit.x, hit.y);
    plOK = plHad = true;
  }

  // 커서 근처 금가루를 흩뿌리며 달군다 → 스프링으로 부드럽게 제자리(살짝 출렁임)
  // 입자마다 튀는 각도·깊이를 달리해 한쪽 테두리에 뭉치지 않고 불꽃처럼 흩어지게 한다.
  const RAD = 1.75, RAD2 = RAD * RAD, K = 30, C = 7.4, PUSH = 105, DRAG = 1.2, LIFT = 40;
  function simulate(dt) {
    const b = P.box;
    const near = plOK && pl.x > b[0] - RAD && pl.x < b[1] + RAD && pl.y > b[2] - RAD && pl.y < b[3] + RAD;
    if (!near && !active) return false;
    const n = q.count, off = P.dyn, vel = P.vel, tgt = P.pos, rnd = P.rnd;
    const px = pl.x, py = pl.y, pvx = plVel.x, pvy = plVel.y, speed = Math.min(1.5, plVel.length() / 14), decay = Math.exp(-dt * 2.8);
    let count = 0, changed = false;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3, i4 = i * 4;
      let ox = off[i4], oy = off[i4 + 1], oz = off[i4 + 2], h = off[i4 + 3];
      let vx = vel[i3], vy = vel[i3 + 1], vz = vel[i3 + 2], fx = 0, fy = 0, fz = 0, touched = false;
      if (near) {
        const dx = tgt[i3] + ox - px, dy = tgt[i3 + 1] + oy - py;
        if (dx < RAD && dx > -RAD && dy < RAD && dy > -RAD) {
          const d2 = dx * dx + dy * dy;
          if (d2 < RAD2) {
            const d = Math.sqrt(d2) + 1e-4, f = 1 - d2 / RAD2, r = rnd[i], f2 = f * f * r;
            const ang = (r - 1) * 2.2, ca = Math.cos(ang), sa = Math.sin(ang), ux = dx / d, uy = dy / d;   // ±44° 비틀어 흩뿌림
            fx = (ux * ca - uy * sa) * PUSH * f2 + pvx * DRAG * f2;
            fy = (ux * sa + uy * ca) * PUSH * f2 + pvy * DRAG * f2;
            fz = LIFT * f2 * ((r * 7.31) % 1 - .3);   // 대부분 카메라 쪽으로 튀어 커지고 밝아진다
            const heat = f * (.35 + speed);
            if (heat > h) h = heat;
            touched = true;
          }
        }
      }
      if (!touched && h < .003 && ox * ox + oy * oy + oz * oz < 1e-6 && vx * vx + vy * vy + vz * vz < 1e-6) {
        if (ox || oy || oz || h) { off[i4] = off[i4 + 1] = off[i4 + 2] = off[i4 + 3] = 0; vel[i3] = vel[i3 + 1] = vel[i3 + 2] = 0; changed = true; }
        continue;
      }
      vx += (fx - K * ox - C * vx) * dt; vy += (fy - K * oy - C * vy) * dt; vz += (fz - K * oz - C * vz) * dt;
      ox += vx * dt; oy += vy * dt; oz += vz * dt;
      h = Math.max(h * decay, Math.min(1, (vx * vx + vy * vy + vz * vz) * .002));   // 빠르게 튈 때 불꽃처럼 밝다
      off[i4] = ox; off[i4 + 1] = oy; off[i4 + 2] = oz; off[i4 + 3] = h;
      vel[i3] = vx; vel[i3 + 1] = vy; vel[i3 + 2] = vz;
      count++; changed = true;
    }
    active = count;
    return changed;
  }

  /* 프레임 */
  function update(dt) {
    const k = 1 - Math.exp(-dt * 3.2);
    tilt.x += (tiltGoal.x - tilt.x) * k; tilt.y += (tiltGoal.y - tilt.y) * k;
    const t = time, m = reduced ? 0 : 1;
    group.position.set(place.x + Math.sin(t * .18) * .025 * m, place.y + Math.sin(t * .3) * .035 * m, 0);
    group.rotation.set(Math.sin(t * .17) * .025 * m + tilt.x, YAW + Math.sin(t * .22) * .075 * m + tilt.y, 0);
    group.scale.setScalar(place.s);
    group.updateMatrixWorld(true);
    dust.position.set(-tilt.y * 1.6, tilt.x * 1.1, 0);

    const it = reduced ? 99 : started ? intro : 0, tf = it - T.flash;
    flash = tf < -.1 ? 0 : tf < 0 ? 1 + tf / .1 : Math.exp(-tf * 4.5);
    const waveA = tf < 0 ? 0 : Math.exp(-tf * 2.4) * Math.min(1, tf / .06), waveR = Math.max(0, tf) * 11;
    pU.uIntroOn.value = it < T.end ? 1 : 0;
    pU.uIntro.value = it;
    pU.uFlash.value = flash; pU.uWaveA.value = waveA; pU.uWaveR.value = waveR;
    pU.uTime.value = dU.uTime.value = reduced ? 2.2 : t;   // 감속 모드: 반짝임 위치만 고정된 정지 화면
    pU.uSheen.value = reduced ? -2.5 : -15 + (t * 2.4) % 36 + tilt.y * 10 - tilt.x * 6;   // 금속 표면을 지나가는 반사광
    rU.uR.value = waveR; rU.uA.value = waveA * .38 * place.glow; ring.visible = waveA > .003;
    dU.uWaveA.value = waveA; dU.uWaveR.value = waveR * place.s; dU.uWaveC.value.set(group.position.x, group.position.y);
    dU.uFade.value = Math.min(1, .25 + it / 2.5);

    pointerLocal(dt);
    if (dt > 0 && !reduced) {
      const steps = Math.min(8, Math.ceil(dt / .02));   // 프레임이 길어도 스프링이 튀지 않게 잘게 나눠 계산
      let changed = false;
      for (let s = 0; s < steps; s++) changed = simulate(dt / steps) || changed;
      if (changed) dynAttr.needsUpdate = true;
    }
  }

  function draw() {
    if (q.bloom) bloom.render(scene, camera, BLOOM * (1 + flash * 1.4), 1 + flash * .2);
    else {
      renderer.setRenderTarget(null);
      renderer.clear(true, false, false);
      renderer.render(scene, camera);
    }
  }

  // 프레임이 2초 넘게 ~42fps 미만이면 한 단계 낮추고, 1.5초 뒤 실제로 빨라졌는지 확인한다.
  // 안 빨라졌으면(저전력 모드 30fps 고정 등 기기가 묶어 둔 경우) 원래 품질로 되돌리고 조정을 멈춘다.
  function govern(raw) {
    if (gov.locked) return;
    raw = Math.min(raw, 100);
    if (gov.warm > 0) { gov.warm -= raw; return; }
    if (gov.probe) {
      const pr = gov.probe;
      pr.sum += raw; pr.n++;
      if (pr.sum < 1500) return;
      const after = pr.sum / pr.n;
      gov.probe = null; gov.slow = 0; gov.ema = after;
      if (after > pr.before * .85) { q.level = pr.from; gov.locked = true; applyQuality(); }
      return;
    }
    gov.ema += (raw - gov.ema) * .05;
    gov.slow = gov.ema > 24 ? gov.slow + raw : Math.max(0, gov.slow - raw * .5);
    if (gov.slow > 2200 && q.level < LEVELS.length - 1) {
      gov.probe = { from: q.level, before: gov.ema, sum: 0, n: 0 };
      q.level++;
      gov.warm = 500;
      applyQuality();
    }
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const raw = Math.max(0, now - last);
    last = now;
    const dt = Math.min(.25, raw / 1000);           // 느린 기기에서도 등장 연출이 실제 시간대로 흐르게(멈칫한 프레임만 0.25초로 자름)
    time += dt; intro += dt;
    update(dt);
    draw();
    info.frames++;
    govern(raw);
  }

  function sync() {
    const can = started && !reduced && inView && !lost && !document.hidden;
    if (can && !running) {
      running = true;
      last = performance.now();
      gov.warm = Math.max(gov.warm, 400);
      raf = requestAnimationFrame(frame);
    } else if (!can && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  }

  /* 준비: 셰이더를 미리 컴파일(밝기 0으로 한 번 그림). 실패하면 정적 대체로. */
  applyQuality();
  pU.uGain.value = 0; dU.uGain.value = 0;
  update(0);
  ring.visible = true; rU.uA.value = 0;            // 충격파 셰이더도 함께(형성 순간 멈칫하지 않게)
  draw();
  ring.visible = false;
  setGains();
  if (shaderError) {
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch (e) { /* noop */ }
    return null;
  }

  if (!reduced) {
    addEventListener('pointermove', onPointer, { passive: true });
    addEventListener('pointerdown', onPointer, { passive: true });
    addEventListener('pointerup', touchOff, { passive: true });
    addEventListener('pointercancel', touchOff, { passive: true });
    addEventListener('touchmove', e => { const t = e.touches[0]; if (t) { ptr.x = t.clientX; ptr.y = t.clientY; ptr.on = true; } }, { passive: true });
    addEventListener('touchend', e => { if (!e.touches.length) ptr.on = false; }, { passive: true });
    addEventListener('touchcancel', releaseAll, { passive: true });
    document.documentElement.addEventListener('mouseleave', releaseAll);
    addEventListener('blur', releaseAll);
    addEventListener('scroll', () => { rectDirty = true; }, { passive: true });
    // 모바일 기기 기울기: 권한 팝업이 필요 없는 환경(Android 등)에서만. iOS 는 팝업을 띄우지 않고 자동 미세 회전만 쓴다.
    if (!fine && window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') {
      const base = { b: 0, g: 0, ok: false };
      addEventListener('deviceorientation', e => {
        if (e.beta == null || e.gamma == null) return;
        let b = e.beta, g = e.gamma;
        const ang = (screen.orientation && screen.orientation.angle) || 0;
        if (ang === 90) [b, g] = [-g, b]; else if (ang === 270 || ang === -90) [b, g] = [g, -b];
        if (!base.ok) { base.b = b; base.g = g; base.ok = true; }
        base.b += (b - base.b) * .006; base.g += (g - base.g) * .006;   // 쥐는 각도가 바뀌면 천천히 기준을 옮긴다
        tiltGoal.set(-clamp((b - base.b) / 30) * .14, -clamp((g - base.g) / 30) * .22);
      }, { passive: true });
    }
    document.addEventListener('visibilitychange', sync);
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => { inView = entries[entries.length - 1].isIntersecting; sync(); }).observe(canvas);
  }
  let rz = 0;
  const onResize = () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(resize); };
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(canvas);
  addEventListener('resize', onResize, { passive: true });
  if (slot) {
    // slot 위치는 옆 문구·아래 지표 줄 높이에 따라 달라진다(글꼴이 늦게 뜨는 경우 등) → hero 안 요소 크기가 바뀌면 다시 맞춘다
    const host = slot.closest('section') || slot.parentElement;
    if ('ResizeObserver' in window) {
      const ro = new ResizeObserver(onResize);
      ro.observe(slot);
      if (slot.parentElement) ro.observe(slot.parentElement);
      if (host) [...host.children].forEach(el => ro.observe(el));
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize).catch(() => {});
  }
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; sync(); document.body.classList.add('webgl-fallback'); });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    document.body.classList.remove('webgl-fallback');
    dynAttr.needsUpdate = true;
    resize();
    sync();
  });

  return {
    count: tier.count,
    tier: tierName,
    start() {
      if (started) return;
      started = true;
      intro = 0;
      if (reduced) { update(0); draw(); } else sync();
    }
  };
}
