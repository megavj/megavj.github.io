// 보험노트 첫 화면 3D 책 (시안)
// - three.js 는 CDN 모듈 1개만 사용 (import map 불필요 → 홈페이지에 <script> 한 줄로 붙일 수 있음)
// - 책 모델: book.glb (Blender 로 생성, blender/build_book.py). 아래의 작은 GLB 읽기 함수로 불러옴
// - 표지/페이지 그림: textures.js 가 캔버스로 직접 그림 (그림 파일 다운로드 없음)
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';
import * as TX from './textures.js';

const PI = Math.PI;
const D2R = PI / 180;
// 책 치수 — blender/build_book.py 와 같아야 함
const DIM = { W: 1.30, H: 1.80, O: 0.035, BT: 0.032, T: 0.085, DIP: 0.016, DIPW: 0.11 };
DIM.WC = DIM.W + DIM.O;
DIM.HC = DIM.H + 2 * DIM.O;
// 구도 — blender 포스터 렌더와 같아야 첫 화면이 자연스럽게 이어짐
const VIEW = {
  fov: 30, pos: [0, 4.55, 3.45], target: [0, 0.16, 0.02], closedTargetY: -0.08,
  closedZoom: 0.82, yaw: -14 * D2R, pitch: 4 * D2R, closedShift: -0.58,
};
const TIMING = {
  shimmerFirst: 0.5, shimmerEvery: 2.8, shimmerDur: 1.25,
  introOpenAt: 1.55, openDur: 1.6, closeDur: 1.4, flipDur: 1.15,
  autoFlip: 4.2, closedHold: 3.8, userIdle: 7.0,
};
const SHEET_Y = 0.0025;   // 넘어가는 종이가 종이 더미 위로 띄워지는 높이

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));
const dip = (x) => { const ax = Math.abs(x); if (ax >= DIM.DIPW) return 0; const k = 1 - ax / DIM.DIPW; return -DIM.DIP * k * k; };

function detectLowEnd() {
  const n = navigator;
  const cores = n.hardwareConcurrency || 8;
  const mem = n.deviceMemory || 8;
  const coarse = matchMedia('(pointer: coarse)').matches;
  return cores <= 4 || mem <= 4 || (coarse && Math.min(screen.width, screen.height) < 820);
}

// ------------------------------------------------------------------ 작은 GLB 읽기 (압축 없는 파일 전용)
async function loadGLB(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('book.glb ' + res.status);
  const buf = await res.arrayBuffer();
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a glb');
  let json, bin;
  for (let off = 12; off < buf.byteLength;) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, len)));
    else if (type === 0x004e4942) bin = buf.slice(off + 8, off + 8 + len);
    off += 8 + len;
  }
  const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const AT = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const attr = (i) => {
    const a = json.accessors[i], v = json.bufferViews[a.bufferView], n = NC[a.type], T = AT[a.componentType];
    if (v.byteStride && v.byteStride !== n * T.BYTES_PER_ELEMENT) throw new Error('interleaved glb not supported');
    const arr = new T(bin, (v.byteOffset || 0) + (a.byteOffset || 0), a.count * n);
    return new THREE.BufferAttribute(arr.slice(), n);
  };
  const out = {};
  for (const node of json.nodes) {
    if (node.mesh == null) continue;
    const g = new THREE.Group();
    g.name = node.name;
    for (const p of json.meshes[node.mesh].primitives) {
      if (p.extensions) throw new Error('compressed glb not supported (use book.glb)');
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', attr(p.attributes.POSITION));
      if (p.attributes.NORMAL != null) geo.setAttribute('normal', attr(p.attributes.NORMAL));
      if (p.attributes.TEXCOORD_0 != null) geo.setAttribute('uv', attr(p.attributes.TEXCOORD_0));
      if (p.indices != null) geo.setIndex(attr(p.indices));
      const mesh = new THREE.Mesh(geo);
      mesh.userData.mat = json.materials[p.material].name;
      g.add(mesh);
    }
    if (node.translation) g.position.fromArray(node.translation);
    if (node.rotation) g.quaternion.fromArray(node.rotation);
    if (node.scale) g.scale.fromArray(node.scale);
    out[node.name] = g;
  }
  return out;
}

// 반사용 가상 스튜디오 (HDR 파일 없이 금박이 빛나도록)
function makeStudio() {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x1c1c1e, side: THREE.BackSide })));
  const panel = (w, h, color, k, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  panel(6, 2.6, 0xffffff, 3.0, [0, 4.9, 0.4]);    // 위 소프트박스
  panel(5, 1.6, 0xfff4e4, 4.0, [0, 3.4, -4.9]);   // 뒤-위 (위를 보는 표지의 금박에 비침)
  panel(1.2, 6, 0xffeedd, 3.0, [-4.9, 1.6, 0.8]); // 왼쪽 띠 조명
  panel(1.0, 6, 0xf4f7ff, 2.2, [4.9, 1.2, -1.2]); // 오른쪽 띠 조명
  panel(5, 1.0, 0xffffff, 1.4, [0, 1.0, 4.9]);    // 앞쪽 낮은 조명
  return s;
}

// ------------------------------------------------------------------ 본체
export function mountHero3D(el, opts = {}) {
  if (el.__bhnHero) return el.__bhnHero;
  const q = new URLSearchParams(location.search);
  const reduced = opts.reducedMotion ?? (q.get('motion') === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches);
  const low = opts.low ?? (q.has('low') ? q.get('low') !== '0' : detectLowEnd());
  const modelUrl = opts.model || el.dataset.model || new URL('./book.glb', import.meta.url).href;

  const maxDpr = low ? 1.5 : 2;
  let dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  let renderer;
  try {
    if (q.has('fallback')) throw new Error('정지 이미지 확인용');
    if (!window.WebGL2RenderingContext) throw new Error('WebGL2 없음');
    // 안티에일리어싱: 픽셀비율이 2 미만일 때만 (얇은 금테가 끊겨 보이지 않게, 고해상도 화면에선 생략)
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: dpr < 2, premultipliedAlpha: true, powerPreference: low ? 'low-power' : 'default' });
  } catch (e) {
    el.classList.add('is-fallback');   // 정지 그림(포스터)이 그대로 보임
    return null;
  }
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  const canvas = renderer.domElement;
  canvas.className = 'bhn-hero3d__canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'button');
  canvas.setAttribute('aria-label', '보험노트 — 당신의 최고의 선택. 3D 책: 누르면 다음 장으로 넘어갑니다');
  el.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(VIEW.fov, 1, 0.1, 40);
  const camTarget = new THREE.Vector3(...VIEW.target);
  const camDir = new THREE.Vector3(...VIEW.pos).sub(camTarget);
  const camDist = camDir.length();
  camDir.normalize();
  let fit = 1;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(makeStudio(), 0.035);
  scene.environment = envRT.texture;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xfffaf2, 2.3);
  key.position.set(-2.5, 4.2, 2.6);
  const rim = new THREE.DirectionalLight(0xffe2b8, 0.9);
  rim.position.set(3.2, 2.0, -2.5);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x45464a, 1.5);   // 종이(램버트)용 은은한 바탕빛
  scene.add(key, rim, hemi);

  // ---------------- 텍스처
  const aniso = Math.min(low ? 2 : 8, renderer.capabilities.getMaxAnisotropy());
  const tex = (cv, { srgb = true, repeat } = {}) => {
    const t = new THREE.CanvasTexture(cv);
    t.flipY = false;                     // glTF 방식: 그림 위쪽 = v 0
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = aniso;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
    return t;
  };
  const PAGE_PX = low ? 512 : 768;
  const COVER_PX = low ? 768 : 1024;
  const grainCv = TX.drawGrain(256);
  const grain = tex(grainCv, { srgb: false, repeat: 2.6 });
  const cv = TX.drawCover(COVER_PX, grainCv);
  const coverMap = tex(cv.map), coverOrm = tex(cv.orm, { srgb: false }), coverBump = tex(cv.bump, { srgb: false });
  const coverMask = tex(cv.mask, { srgb: false });

  const pages = [];
  const pageTex = (i) => (pages[i] ||= { t: tex(TX.drawPage(i, PAGE_PX)) }).t;
  const pageTexMirror = (i) => {           // 넘어가는 종이 뒷면용 (좌우 뒤집기, 같은 그림 공유)
    pageTex(i);
    const e = pages[i];
    if (!e.m) { e.m = e.t.clone(); e.m.repeat.x = -1; e.m.offset.x = 1; e.m.needsUpdate = true; }
    return e.m;
  };

  const M = {
    Leather: new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.48, bumpMap: grain, bumpScale: 0.6, envMapIntensity: 0.8 }),
    CoverFront: new THREE.MeshStandardMaterial({ map: coverMap, roughnessMap: coverOrm, metalnessMap: coverOrm, roughness: 1, metalness: 1, bumpMap: coverBump, bumpScale: 0.9 }),
    Gold: new THREE.MeshStandardMaterial({ color: 0xd9a64a, metalness: 1, roughness: 0.3 }),
    // 종이는 반사 없는 램버트 재질: 글자·그래프 대비가 또렷하고 계산도 가벼움
    PaperEdge: new THREE.MeshLambertMaterial({ map: tex(TX.drawPaperEdge()) }),
    PageLeft: new THREE.MeshLambertMaterial({ map: pageTex(0) }),
    PageRight: new THREE.MeshLambertMaterial({ map: pageTex(1) }),
  };
  const sheetFrontMat = new THREE.MeshLambertMaterial({ map: pageTex(1) });
  const sheetBackMat = new THREE.MeshLambertMaterial({ map: pageTexMirror(2), side: THREE.BackSide });

  // ---------------- 장면 구성: stage(기울기·위치) > book(떠오름) > 모델
  const stage = new THREE.Group();
  stage.rotation.order = 'YXZ';
  const book = new THREE.Group();
  stage.add(book);
  scene.add(stage);

  // 바닥 그림자: 가운데만 진하고 가장자리는 완전히 투명 (사각 판 없음)
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex(TX.drawShadow(128)), transparent: true, depthWrite: false, toneMapped: false, color: 0x000000 }));
  shadow.rotation.x = -PI / 2;
  shadow.position.y = -(DIM.T + DIM.BT) - 0.24;
  shadow.renderOrder = -1;
  stage.add(shadow);

  // 넘어가는 종이 한 장 (앞/뒤 두 면이 같은 모양을 공유)
  const NX = low ? 22 : 36, NZ = low ? 4 : 8;
  const sheetGeo = new THREE.BufferGeometry();
  {
    const pos = new Float32Array((NX + 1) * (NZ + 1) * 3), uv = new Float32Array((NX + 1) * (NZ + 1) * 2), idx = [];
    for (let r = 0; r <= NZ; r++) for (let c = 0; c <= NX; c++) {
      const i = r * (NX + 1) + c;
      uv[i * 2] = c / NX; uv[i * 2 + 1] = r / NZ;    // r=0 이 먼 쪽(그림 위쪽)
    }
    for (let r = 0; r < NZ; r++) for (let c = 0; c < NX; c++) {
      const a = r * (NX + 1) + c, b = a + 1, d = a + NX + 1, e = d + 1;
      idx.push(a, d, b, b, d, e);                      // 위(+y)를 보는 면
    }
    sheetGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sheetGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    sheetGeo.setIndex(idx);
  }
  const sheetFront = new THREE.Mesh(sheetGeo, sheetFrontMat);
  const sheetBack = new THREE.Mesh(sheetGeo, sheetBackMat);
  sheetFront.visible = sheetBack.visible = false;
  sheetFront.frustumCulled = sheetBack.frustumCulled = false;
  book.add(sheetFront, sheetBack);

  function shapeSheet(p, dir) {
    const pos = sheetGeo.attributes.position.array;
    const pp = dir > 0 ? p : 1 - p;
    const aR = PI * Math.pow(pp, 1.6);               // 제본쪽: 늦게 따라옴
    const aT = PI * (1 - Math.pow(1 - pp, 1.6));     // 바깥쪽 끝: 먼저 넘어감 → 종이가 휘어짐
    const rest = 1 - Math.sin(PI * p);
    const ds = DIM.W / NX;
    for (let r = 0; r <= NZ; r++) {
      const zn = r / NZ, z = -DIM.H / 2 + DIM.H * zn;
      const aTr = Math.min(PI, aR + (aT - aR) * (0.72 + 0.5 * zn));  // 앞쪽 모서리가 더 먼저 들림
      let x = 0, y = SHEET_Y;
      for (let c = 0; c <= NX; c++) {
        if (c > 0) {
          let phi = aR + (aTr - aR) * Math.pow((c - 0.5) / NX, 2.2);
          if (dir < 0) phi = PI - phi;
          x += ds * Math.cos(phi);
          y += ds * Math.sin(phi);
        }
        const i = (r * (NX + 1) + c) * 3;
        pos[i] = x; pos[i + 1] = y + dip(x) * rest; pos[i + 2] = z;
      }
    }
    sheetGeo.attributes.position.needsUpdate = true;
    sheetGeo.computeVertexNormals();
  }

  // 표지 금박 위를 지나가는 빛줄기
  const shimmerMat = new THREE.ShaderMaterial({
    uniforms: { uMask: { value: coverMask }, uPos: { value: -9 }, uStrength: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D uMask; uniform float uPos; uniform float uStrength; varying vec2 vUv;
      void main(){
        float m = texture2D(uMask, vUv).a;
        float d = vUv.x * 0.75 + vUv.y * 0.5;
        float band = exp(-pow((d - uPos) / 0.09, 2.0));
        float core = exp(-pow((d - uPos) / 0.022, 2.0));
        float g = m * uStrength;
        gl_FragColor = vec4(vec3(1.0, 0.78, 0.40) * band * g * 1.35 + vec3(1.0, 0.97, 0.88) * core * g * 1.25, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const shimmerGeo = new THREE.BufferGeometry();
  {
    const y = -(DIM.T + DIM.BT) - 0.0036, x0 = -DIM.WC, z0 = -DIM.HC / 2, z1 = DIM.HC / 2;
    const P = [[x0, z0], [0, z0], [x0, z1], [0, z1]];
    shimmerGeo.setAttribute('position', new THREE.Float32BufferAttribute(P.flatMap(([x, z]) => [x, y, z]), 3));
    shimmerGeo.setAttribute('uv', new THREE.Float32BufferAttribute(P.flatMap(([x, z]) => [-x / DIM.WC, (z + DIM.HC / 2) / DIM.HC]), 2));
    shimmerGeo.setIndex([0, 1, 2, 1, 3, 2]);
  }
  const shimmer = new THREE.Mesh(shimmerGeo, shimmerMat);

  // 금빛 입자
  const NP = reduced ? 0 : (low ? 12 : 26);
  let sparks = null;
  if (NP) {
    const g = new THREE.BufferGeometry(), P = [], ph = [], sp = [];
    const R = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
    for (let i = 0; i < NP; i++) {
      P.push((R() * 2 - 1) * 1.9, R() * 1.6, (R() * 2 - 1) * 1.3);
      ph.push(R()); sp.push(0.03 + R() * 0.06);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(ph, 1));
    g.setAttribute('aSpeed', new THREE.Float32BufferAttribute(sp, 1));
    sparks = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 400 }, uFade: { value: 0 }, uMap: { value: tex(TX.drawSpark(64)) } },
      vertexShader: `uniform float uTime, uScale; attribute float aPhase, aSpeed; varying float vA;
        void main(){
          vec3 p = position;
          p.y = -0.25 + mod(p.y + uTime * aSpeed, 1.6);
          p.x += sin(uTime * 0.31 + aPhase * 6.2831) * 0.06;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float tw = 0.5 + 0.5 * sin(uTime * (0.7 + aSpeed * 9.0) + aPhase * 6.2831);
          vA = pow(tw, 2.5) * smoothstep(-0.25, 0.1, p.y) * (1.0 - smoothstep(1.0, 1.35, p.y));
          gl_PointSize = 0.042 * uScale / -mv.z * (0.5 + 0.7 * tw);
        }`,
      fragmentShader: `uniform sampler2D uMap; uniform float uFade; varying float vA;
        void main(){ vec4 c = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(c.rgb, c.a * vA * uFade); }`,
      transparent: true, depthWrite: false,
    }));
    sparks.frustumCulled = false;
    stage.add(sparks);
  }

  // ---------------- 상태
  const NS = TX.PAGE_COUNT / 2;
  const S = {
    ready: false, now: 0,
    spread: 0,
    hinge: 0, hingeTw: null, coverPeek: 0,       // hinge: 0=덮임, 1=펼침
    sheet: { active: false, leaf: -1, dir: 1, p: 0, tw: null, peekSide: 0, lastP: -1, lastDir: 0 },
    queue: null,
    // 첫 열림도 자동 넘김 시계로 처리 → 화면 밖에 있을 땐 연출이 기다렸다가 보일 때 시작
    lastAction: TIMING.introOpenAt - TIMING.closedHold, lastUser: -99, shimmerAt: TIMING.shimmerFirst,
    pointer: { inside: false, nx: 0, ny: 0, tiltX: 0, tiltY: 0, hit: null, side: 0, amt: 0, drag: null },
  };
  let spine = null, leftHalf = null;

  function setSpread(k) {
    S.spread = k;
    M.PageLeft.map = pageTex(2 * k);
    M.PageRight.map = pageTex(2 * k + 1);
    const sh = S.sheet;
    sh.active = false; sh.peekSide = 0; sh.leaf = -1; sh.tw = null;
    sheetFront.visible = sheetBack.visible = false;
    prefetch(k + 1); prefetch(k - 1);
  }
  function activateLeaf(j, dir, p) {
    const sh = S.sheet;
    sh.active = true; sh.leaf = j; sh.dir = dir; sh.p = p; sh.lastP = -1;
    sheetFrontMat.map = pageTex(2 * j + 1);
    sheetBackMat.map = pageTexMirror(2 * j + 2);
    M.PageLeft.map = pageTex(2 * j);
    M.PageRight.map = pageTex(2 * j + 3);
    sheetFront.visible = sheetBack.visible = true;
  }
  function prefetch(k) {
    if (k < 0 || k >= NS) return;
    const run = () => {
      for (const i of [2 * k, 2 * k + 1]) {
        if (!pages[i]) renderer.initTexture(pageTex(i));
      }
      if (2 * k < TX.PAGE_COUNT && !pages[2 * k].m) renderer.initTexture(pageTexMirror(2 * k));
    };
    (window.requestIdleCallback || ((f) => setTimeout(f, 120)))(run);
  }

  const busy = () => !!(S.hingeTw || S.sheet.tw);
  const dur = (d) => (reduced ? Math.min(d, 0.45) : d);

  function tweenHinge(to, d, done) {
    S.hingeTw = { from: S.hinge, to, t0: S.now, d: dur(d), done };
    S.sheet.active && setSpread(S.spread);
  }
  function flipTo(target) {   // target: 1 = 앞으로, 0 = 뒤로
    const sh = S.sheet;
    const j = target === 1 ? S.spread : S.spread - 1;
    if (!sh.active || sh.leaf !== j) activateLeaf(j, target === 1 ? 1 : -1, target === 1 ? 0 : 1);
    sh.dir = target === 1 ? 1 : -1;
    sh.peekSide = 0;
    const left = Math.abs(target - sh.p);
    sh.tw = { from: sh.p, to: target, t0: S.now, d: dur(TIMING.flipDur) * Math.max(0.35, left), done: () => setSpread(target === 1 ? j + 1 : j) };
  }
  function next(fromUser) {
    if (fromUser) S.lastUser = S.now;
    if (!S.ready) return;
    if (busy()) { S.queue = 'next'; return; }
    if (S.hinge < 0.5) tweenHinge(1, TIMING.openDur);
    else if (S.spread < NS - 1) flipTo(1);
    else tweenHinge(0, TIMING.closeDur, () => { setSpread(0); S.shimmerAt = S.now + 0.25; });
    S.lastAction = S.now;
  }
  function prev(fromUser) {
    if (fromUser) S.lastUser = S.now;
    if (!S.ready) return;
    if (busy()) { S.queue = 'prev'; return; }
    if (S.hinge < 0.5) tweenHinge(1, TIMING.openDur);
    else if (S.spread > 0) flipTo(0);
    else tweenHinge(0, TIMING.closeDur, () => { S.shimmerAt = S.now + 0.25; });
    S.lastAction = S.now;
  }

  // ---------------- 포인터 (마우스 들어올림 / 클릭 / 끌기·스와이프)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), tmpV = new THREE.Vector3(), tmpN = new THREE.Vector3();
  function hitBook(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    S.pointer.nx = ndc.x; S.pointer.ny = ndc.y;
    ray.setFromCamera(ndc, camera);
    book.updateMatrixWorld();
    tmpN.set(0, 1, 0).transformDirection(book.matrixWorld);
    plane.setFromNormalAndCoplanarPoint(tmpN, tmpV.setFromMatrixPosition(book.matrixWorld));
    if (!ray.ray.intersectPlane(plane, tmpV)) return null;
    const p = book.worldToLocal(tmpV);
    const open = S.hinge > 0.5;
    const x0 = open ? -DIM.WC - 0.05 : -0.15, x1 = DIM.WC + 0.05;
    return (p.x > x0 && p.x < x1 && Math.abs(p.z) < DIM.HC / 2 + 0.05) ? { x: p.x, z: p.z } : null;
  }
  function hoverPeek(h) {
    const P = S.pointer;
    P.side = 0; P.amt = 0;
    if (!h) return;
    if (S.hinge > 0.99) {
      if (h.x > DIM.W * 0.45) { P.side = 1; P.amt = 0.02 + 0.06 * smooth(DIM.W * 0.45, DIM.W * 0.95, h.x); }
      else if (h.x < -DIM.W * 0.45) { P.side = -1; P.amt = 0.02 + 0.06 * smooth(DIM.W * 0.45, DIM.W * 0.95, -h.x); }
    } else if (S.hinge < 0.01 && h.x > DIM.WC * 0.5) {
      P.side = 2; P.amt = 0.13 * smooth(DIM.WC * 0.5, DIM.WC * 0.95, h.x);
    }
  }
  canvas.addEventListener('pointermove', (ev) => {
    const P = S.pointer;
    const h = hitBook(ev);
    P.hit = h;
    canvas.style.cursor = h ? 'pointer' : '';
    if (P.drag && P.drag.id === ev.pointerId) {
      const dx = ev.clientX - P.drag.x, dy = ev.clientY - P.drag.y;
      if (!P.drag.moved && Math.hypot(dx, dy) > 8) P.drag.moved = true;
      if (P.drag.moved && Math.abs(dx) > Math.abs(dy) && S.hinge > 0.99 && !busy()) {
        const a = Math.min(0.85, Math.abs(dx) / (canvas.clientWidth * 0.55));
        P.side = dx < 0 ? 1 : -1; P.amt = a;   // 손가락/마우스로 종이를 직접 끌어 넘김
        if ((P.side === 1 && S.spread >= NS - 1) || (P.side === -1 && S.spread <= 0)) P.amt = Math.min(P.amt, 0.04);
      }
      wake();
      return;
    }
    if (ev.pointerType === 'mouse') {
      P.inside = true; hoverPeek(h);
      if (h) S.lastUser = S.now;       // 책 위에 마우스가 있으면 자동 넘김을 멈춤
      wake();
    }
  });
  canvas.addEventListener('pointerleave', () => { const P = S.pointer; P.inside = false; P.side = 0; P.amt = 0; P.hit = null; wake(); });
  canvas.addEventListener('pointerdown', (ev) => {
    S.pointer.drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, moved: false, hit: hitBook(ev) };
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* 일부 브라우저 */ }
  });
  const endDrag = (ev) => {
    const P = S.pointer, d = P.drag;
    if (!d || d.id !== ev.pointerId) return;
    P.drag = null;
    const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
    if (!d.moved) {                              // 클릭/탭
      if (!d.hit) return;
      (S.hinge > 0.5 && d.hit.x < -0.05) ? prev(true) : next(true);
    } else if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30) {  // 스와이프
      dx < 0 ? next(true) : prev(true);
    }
    if (ev.pointerType !== 'mouse') { P.side = 0; P.amt = 0; } else hoverPeek(hitBook(ev));
    wake();
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => { S.pointer.drag = null; S.pointer.side = 0; S.pointer.amt = 0; wake(); });
  canvas.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowRight' || ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); next(true); wake(); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); prev(true); wake(); }
  });

  // ---------------- 크기 / 화면 밖 정지
  function resize() {
    const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    fit = Math.max(1, Math.pow((4 / 3) / camera.aspect, 0.92));   // 세로로 긴 화면에서는 뒤로 물러나 책 전체가 보이게
    camera.updateProjectionMatrix();
    if (sparks) sparks.material.uniforms.uScale.value = (h * dpr) / (2 * Math.tan((VIEW.fov * D2R) / 2));
    wake();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  let onScreen = true;
  const io = new IntersectionObserver((ents) => { onScreen = ents[0].isIntersecting; wake(); }, { threshold: 0 });
  io.observe(el);
  const onVis = () => wake();
  document.addEventListener('visibilitychange', onVis);

  // ---------------- 매 프레임
  let raf = 0, last = 0, clock = 0, frames = 0, slowAcc = 0, lastRender = 0;
  function wake() { if (!raf && S.ready) { last = performance.now(); raf = requestAnimationFrame(loop); } }

  function updateSpine(theta) {
    spine.visible = theta < -0.01;
    if (!spine.visible) return;
    for (const s of spine.userData.parts) {
      const P = s.pos.array, N = s.nrm.array, { r, d, z, nx, ny } = s;
      for (let i = 0; i < r.length; i++) {
        const ang = -PI / 2 + theta * (d[i] / PI);
        const delta = ang - (-PI / 2 - d[i]);
        const c = Math.cos(delta), sn = Math.sin(delta);
        P[i * 3] = r[i] * Math.cos(ang); P[i * 3 + 1] = r[i] * Math.sin(ang); P[i * 3 + 2] = z[i];
        N[i * 3] = nx[i] * c - ny[i] * sn; N[i * 3 + 1] = nx[i] * sn + ny[i] * c;
      }
      s.pos.needsUpdate = true; s.nrm.needsUpdate = true;
    }
  }

  function update(dt) {
    const t = S.now;
    // 표지 열기/덮기
    if (S.hingeTw) {
      const tw = S.hingeTw, k = clamp01((t - tw.t0) / tw.d);
      S.hinge = lerp(tw.from, tw.to, easeInOut(k));
      if (k >= 1) { S.hingeTw = null; S.lastAction = t; tw.done && tw.done(); }
    }
    // 종이 넘김
    const sh = S.sheet, P = S.pointer;
    if (sh.tw) {
      const tw = sh.tw, k = clamp01((t - tw.t0) / tw.d);
      sh.p = lerp(tw.from, tw.to, easeInOut(k));
      if (k >= 1) { S.lastAction = t; tw.done(); }
    } else if (S.hingeTw) {
      if (sh.active) setSpread(S.spread);           // 표지가 움직이는 동안엔 낱장을 쓰지 않음
    } else if (S.hinge > 0.999) {
      // 마우스를 올리면 살짝 들림, 끌면 따라옴
      const want = P.side === 1 || P.side === -1 ? P.side : 0;
      if (sh.active && sh.peekSide) {
        const rest = sh.peekSide > 0 ? 0 : 1;
        const tgt = want === sh.peekSide ? (want > 0 ? P.amt : 1 - P.amt) : rest;
        sh.p = damp(sh.p, tgt, P.drag ? 18 : 9, dt);
        if (want !== sh.peekSide && Math.abs(sh.p - rest) < 0.002) setSpread(S.spread);
      } else if (!sh.active && want === 1 && S.spread < NS - 1) {
        activateLeaf(S.spread, 1, 0); sh.peekSide = 1;
      } else if (!sh.active && want === -1 && S.spread > 0) {
        activateLeaf(S.spread - 1, -1, 1); sh.peekSide = -1;
      }
    }
    if (sh.active && (sh.p !== sh.lastP || sh.dir !== sh.lastDir)) {
      shapeSheet(sh.p, sh.dir); sh.lastP = sh.p; sh.lastDir = sh.dir;
    }
    // 덮인 상태에서 오른쪽 가장자리에 마우스 → 표지가 살짝 들림
    S.coverPeek = damp(S.coverPeek, !busy() && P.side === 2 ? P.amt : 0, 8, dt);
    const theta = -PI * (1 - S.hinge) + S.coverPeek * (S.hinge < 0.01 ? 1 : 0);
    leftHalf.rotation.z = theta;
    updateSpine(theta);

    // 자동 넘김 (조작이 없을 때만)
    if (!reduced && !busy() && !P.drag && t - S.lastUser > TIMING.userIdle) {
      const wait = S.hinge < 0.5 ? TIMING.closedHold : TIMING.autoFlip;
      if (t - S.lastAction > wait && !(sh.active && sh.peekSide)) next(false);
    }
    if (!busy() && S.queue) { const qd = S.queue; S.queue = null; qd === 'next' ? next(false) : prev(false); }

    // 반짝임: 표지가 보일 때 주기적으로 빛줄기
    const closedness = 1 - S.hinge;
    shimmer.visible = closedness > 0.3;
    if (shimmer.visible && !reduced) {
      if (t >= S.shimmerAt + TIMING.shimmerDur) S.shimmerAt = t + TIMING.shimmerEvery - TIMING.shimmerDur;
      const k = (t - S.shimmerAt) / TIMING.shimmerDur;
      shimmerMat.uniforms.uPos.value = k >= 0 && k <= 1 ? lerp(-0.2, 1.45, k) : -9;
    } else shimmerMat.uniforms.uPos.value = -9;

    // 자세 / 구도
    const e = S.hinge;
    const f = smooth(0, 0.8, e);   // 구도 전환은 표지가 거의 덮였을 때 몰아서 (닫히는 중 잘리지 않게)
    const fine = !reduced && P.inside && !P.drag;   // 마우스 따라 살짝 기울기 (움직임 줄이기 모드에선 없음)
    P.tiltX = damp(P.tiltX, fine ? P.nx : 0, 3, dt);
    P.tiltY = damp(P.tiltY, fine ? P.ny : 0, 3, dt);
    const fl = reduced ? 0 : 1;
    stage.position.x = VIEW.closedShift * (1 - f);
    stage.rotation.y = VIEW.yaw + P.tiltX * 0.07 + fl * Math.sin(t * 0.35) * 0.025;
    stage.rotation.x = VIEW.pitch - P.tiltY * 0.04;
    book.position.y = fl * Math.sin(t * 0.9) * 0.035;
    book.rotation.z = fl * Math.sin(t * 0.6 + 1) * 0.012;
    shadow.position.x = -VIEW.closedShift * (1 - f);
    shadow.scale.set(lerp(1.75, 3.15, f), lerp(2.25, 2.35, f), 1);
    shadow.material.opacity = 0.75 - book.position.y * 3;
    // 표지가 세워지는 동안에는 카메라가 살짝 물러나 표지 끝이 화면 밖으로 잘리지 않게
    const swing = Math.pow(Math.sin(PI * e), 1.3);
    const zoom = (lerp(VIEW.closedZoom, 1, f) + 0.3 * swing) * fit;
    camTarget.y = lerp(VIEW.closedTargetY, VIEW.target[1], f) + 0.32 * swing;
    camTarget.x = -0.12 * swing;
    camera.position.copy(camTarget).addScaledVector(camDir, camDist * zoom);
    camera.lookAt(camTarget);
    if (sparks) {
      sparks.material.uniforms.uTime.value = t;
      sparks.material.uniforms.uFade.value = smooth(0.4, 2.5, t);
    }
  }

  function animating() {
    if (!reduced) return true;
    const sh = S.sheet, P = S.pointer;
    return busy() || Math.abs(S.coverPeek - (P.side === 2 ? P.amt : 0)) > 1e-3 ||
      (sh.active && sh.peekSide !== 0) || P.side !== 0;
  }

  function loop(ts) {
    raf = 0;
    if (!onScreen || document.hidden) return;    // 화면 밖·다른 탭이면 멈춤
    const dt = Math.min(0.05, (ts - last) / 1000);
    last = ts;
    // 저사양: 초당 30장 정도로 제한
    if (low && ts - lastRender < 30) { raf = requestAnimationFrame(loop); return; }
    const fdt = Math.min(0.1, (ts - (lastRender || ts)) / 1000) || dt;
    lastRender = ts;
    clock += fdt;
    S.now = clock;
    update(fdt);
    renderer.render(scene, camera);
    // 느리면 해상도를 조금씩 낮춤
    if (clock > 3.5) {
      frames++; slowAcc += fdt;
      if (frames >= 90) {
        const avg = slowAcc / frames;
        if (avg > (low ? 1 / 24 : 1 / 40) && dpr > 1) { dpr = Math.max(1, dpr - 0.25); renderer.setPixelRatio(dpr); resize(); }
        frames = 0; slowAcc = 0;
      }
    }
    if (animating()) raf = requestAnimationFrame(loop);
  }

  // ---------------- 시작
  const api = { next: () => { next(true); wake(); }, prev: () => { prev(true); wake(); }, destroy, info: { low, reduced } };
  el.__bhnHero = api;
  loadGLB(modelUrl).then((nodes) => {
    for (const g of Object.values(nodes)) g.traverse((o) => { if (o.isMesh) o.material = M[o.userData.mat] || M.Leather; });
    leftHalf = nodes.LeftHalf; spine = nodes.Spine;
    leftHalf.add(shimmer);
    book.add(nodes.RightHalf, leftHalf, spine);
    // 책등: 각 점의 반지름/각도를 기억해 두고 펼침 각도에 맞춰 접는다
    spine.userData.parts = spine.children.map((m) => {
      const pos = m.geometry.attributes.position, nrm = m.geometry.attributes.normal, n = pos.count;
      const r = new Float32Array(n), d = new Float32Array(n), z = new Float32Array(n), nx = new Float32Array(n), ny = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        r[i] = Math.hypot(x, y); z[i] = pos.getZ(i);
        let dd = (((-PI / 2 - Math.atan2(y, x)) % (2 * PI)) + 2 * PI) % (2 * PI);
        if (dd > 1.5 * PI) dd = 0;
        d[i] = Math.min(PI, dd);
        nx[i] = nrm.getX(i); ny[i] = nrm.getY(i);   // 덮인 상태의 법선 (updateSpine 에서 같은 각도만큼 돌림)
      }
      m.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      return { pos, nrm, r, d, z, nx, ny };
    });
    setSpread(0);
    S.ready = true;
    resize();
    S.now = 0;
    update(0);
    renderer.compile(scene, camera);
    renderer.render(scene, camera);
    // 첫 장면이 그려진 뒤 포스터와 교차 페이드
    requestAnimationFrame(() => {
      el.classList.add('is-live');
      prefetch(1);
      wake();
    });
  }).catch((err) => {
    console.warn('[bhn-hero3d] 3D 대신 정지 이미지를 사용합니다:', err);
    destroy();
    el.classList.add('is-fallback');
  });

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); el.classList.remove('is-live'); el.classList.add('is-fallback'); });

  function destroy() {
    cancelAnimationFrame(raf); raf = 0;
    ro.disconnect(); io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    envRT.dispose();
    for (const e of pages) { if (e) { e.t.dispose(); e.m && e.m.dispose(); } }
    renderer.dispose();
    canvas.remove();
    delete el.__bhnHero;
  }
  return api;
}

// data-bhn-hero3d 가 붙은 요소에 자동으로 붙임
function autoMount() { document.querySelectorAll('[data-bhn-hero3d]').forEach((el) => mountHero3D(el)); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount);
else autoMount();
