// 보험노트 첫 화면 3D 책 v2 (시안)
// - three.js 는 CDN 모듈 1개만 사용 (import map 불필요 → 홈페이지에 <script> 한 줄로 붙일 수 있음)
// - 책 모델: book.glb (Blender 로 생성, blender/build_book.py). 아래의 작은 GLB 읽기 함수로 불러옴
// - 표지/페이지/가죽/종이 단면 그림: textures.js 가 캔버스로 직접 그림 (그림 파일 다운로드 없음)
// v2: 두꺼운 책, 가죽 노멀맵·금속 반사·겹겹 종이 단면, 파티클 삭제, 마우스를 따라 움직이지 않음(클릭/탭/스와이프만),
//     표지 글자 발광 + 맥박 호흡 + 빛줄기 + 금빛 후광 + 글자 위 작은 반짝임
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';
import * as TX from './textures.js';

const PI = Math.PI;
const D2R = PI / 180;
// 책 치수 — blender/build_book.py 와 같아야 함
const DIM = { W: 1.30, H: 1.80, O: 0.04, BT: 0.042, T: 0.175, DIP: 0.045, DIPW: 0.26 };
DIM.WC = DIM.W + DIM.O;
DIM.HC = DIM.H + 2 * DIM.O;
DIM.RS = DIM.T + DIM.BT + 0.004;     // 책등 바깥 반지름
// 구도 — blender 포스터 렌더(VIEW)와 같아야 첫 화면이 자연스럽게 이어짐
const VIEW = {
  fov: 30, pos: [0, 4.05, 4.05], target: [0, 0.12, 0.0], closedTargetY: 0.02,
  closedZoom: 0.81, yaw: -16 * D2R, pitch: 3 * D2R, closedShift: -0.60,
};
const TIMING = {
  sweepFirst: 0.6, sweepEvery: 3.4, sweepDur: 1.3, pulsePeriod: 5.6,
  introOpenAt: 1.8, openDur: 1.7, closeDur: 1.5, flipDur: 1.15,
  autoFlip: 4.8, closedHold: 4.4, userIdle: 7.0,
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

// 반사용 가상 스튜디오 (HDR 파일 없이 코드로 만든 환경맵): 위가 밝고 아래가 어두운 방 + 가장자리가 부드러운 조명판
function makeStudio() {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; void main(){ float h = normalize(vP).y;
      vec3 c = mix(vec3(0.028, 0.025, 0.023), vec3(0.20, 0.19, 0.18), smoothstep(-1.0, 0.05, h));
      c = mix(c, vec3(0.50, 0.48, 0.45), smoothstep(0.05, 0.9, h));
      gl_FragColor = vec4(c, 1.0); }`,
  })));
  const soft = new THREE.CanvasTexture(TX.drawSoftBox(64));
  const panel = (w, h, color, k, pos, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: soft, transparent: true, depthWrite: false, color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    m.rotateZ(ry);
    s.add(m);
  };
  panel(7, 3.2, 0xffffff, 3.2, [0, 5.0, 0.6]);          // 위 소프트박스 (넓고 부드럽게)
  panel(6, 2.0, 0xfff1dc, 5.0, [0, 3.6, -4.9]);         // 뒤-위 긴 창: 위를 보는 표지의 금박에 비침
  panel(1.4, 6, 0xffe9d2, 3.4, [-4.9, 1.8, 0.8]);       // 왼쪽 띠 조명 (따뜻함)
  panel(1.1, 6, 0xeaf0ff, 2.4, [4.9, 1.4, -1.0]);       // 오른쪽 띠 조명 (차가움)
  panel(5, 1.2, 0xffffff, 1.3, [0, 1.0, 4.9]);          // 앞쪽 낮은 조명
  panel(2.0, 0.5, 0xffffff, 7.0, [-2.2, 4.6, 2.6]);     // 작은 강한 점 하이라이트 (금속 글자에 또렷한 반사)
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
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: dpr < 2, premultipliedAlpha: true, powerPreference: low ? 'low-power' : 'default' });
  } catch (e) {
    el.classList.add('is-fallback');   // 정지 그림(포스터)이 그대로 보임
    return null;
  }
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
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
  const envRT = pmrem.fromScene(makeStudio(), 0.04);
  scene.environment = envRT.texture;
  pmrem.dispose();

  // 조명: 부드러운 키라이트 + 뒤에서 오는 림라이트 + 약한 필 (그림자 계산 없음, 환경맵이 바탕빛)
  const key = new THREE.DirectionalLight(0xfff9f2, 1.8);
  key.position.set(-2.4, 4.0, 2.8);
  const rim = new THREE.DirectionalLight(0xffdfb8, 1.2);
  rim.position.set(3.0, 2.2, -2.8);
  const fill = new THREE.DirectionalLight(0xe4ecff, 0.4);
  fill.position.set(2.8, 1.2, 3.0);
  const hemi = new THREE.HemisphereLight(0xfbf9f5, 0x3a3634, 0.55);
  scene.add(key, rim, fill, hemi);

  // ---------------- 텍스처
  const aniso = Math.min(low ? 4 : 8, renderer.capabilities.getMaxAnisotropy());
  const tex = (cv, { srgb = true, repeat } = {}) => {
    const t = new THREE.CanvasTexture(cv);
    t.flipY = false;                     // glTF 방식: 그림 위쪽 = v 0
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = aniso;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  };
  const PAGE_PX = low ? 512 : 768;
  const COVER_PX = low ? 768 : 1024;
  const leatherCv = TX.leatherHeight(512);
  const leatherN = tex(TX.drawLeatherNormal(512), { srgb: false, repeat: [3, 3] });
  const cv = TX.drawCover(COVER_PX, leatherCv);
  const coverMap = tex(cv.map), coverOrm = tex(cv.orm, { srgb: false }), coverN = tex(cv.normal, { srgb: false });
  const coverEmis = tex(cv.emissive), coverMask = tex(cv.mask, { srgb: false });
  const sparkPts = TX.pickSparkles(cv.mask, cv.layout, 6);
  const edge = TX.drawPaperEdge(64, 512);
  const edgeMap = tex(edge.map, { repeat: [1, 1] }), edgeN = tex(edge.normal, { srgb: false, repeat: [1, 1] });
  const paperN = low ? null : tex(TX.drawPaperNormal(256), { srgb: false, repeat: [3, 4] });

  const pages = [];
  const pageTex = (i) => (pages[i] ||= { t: tex(TX.drawPage(i, PAGE_PX)) }).t;
  const pageTexMirror = (i) => {           // 넘어가는 종이 뒷면용 (좌우 뒤집기, 같은 그림 공유)
    pageTex(i);
    const e = pages[i];
    if (!e.m) { e.m = e.t.clone(); e.m.repeat.x = -1; e.m.offset.x = 1; e.m.needsUpdate = true; }
    return e.m;
  };

  // 종이: 저사양은 램버트(가벼움), 일반은 미세 노멀이 있는 거친 표준 재질
  const paperMat = (map, extra = {}) => low
    ? new THREE.MeshLambertMaterial({ map, ...extra })
    : new THREE.MeshStandardMaterial({ map, roughness: 0.94, metalness: 0, normalMap: paperN, normalScale: new THREE.Vector2(0.25, 0.25), envMapIntensity: 0.55, ...extra });
  const M = {
    Leather: new THREE.MeshStandardMaterial({ color: 0x151211, roughness: 0.5, normalMap: leatherN, normalScale: new THREE.Vector2(0.75, 0.75), envMapIntensity: 0.9 }),
    CoverFront: new THREE.MeshStandardMaterial({
      map: coverMap, roughnessMap: coverOrm, metalnessMap: coverOrm, roughness: 1, metalness: 1,
      normalMap: coverN, normalScale: new THREE.Vector2(0.75, 0.75), envMapIntensity: 1.0,
      emissive: 0xffffff, emissiveMap: coverEmis, emissiveIntensity: 0.3,
    }),
    Gold: new THREE.MeshStandardMaterial({ color: 0xe6b55a, metalness: 1, roughness: 0.26, envMapIntensity: 1.1 }),
    PaperEdge: low
      ? new THREE.MeshLambertMaterial({ map: edgeMap })
      : new THREE.MeshStandardMaterial({ map: edgeMap, normalMap: edgeN, normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.9, metalness: 0, envMapIntensity: 0.6 }),
    PageLeft: paperMat(pageTex(0)),
    PageRight: paperMat(pageTex(1)),
  };
  const sheetFrontMat = paperMat(pageTex(1));
  const sheetBackMat = paperMat(pageTexMirror(2), { side: THREE.BackSide });

  // ---------------- 장면 구성: stage(고정 자세·위치) > book(아주 느린 숨쉬기) > 모델
  const stage = new THREE.Group();
  stage.rotation.order = 'YXZ';
  const book = new THREE.Group();
  stage.add(book);
  scene.add(stage);

  // 바닥 그림자: 책 바닥 모양으로 넓게 번지고 가장자리는 완전히 투명 (사각 판 없음)
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex(TX.drawShadow(256)), transparent: true, depthWrite: false, toneMapped: false, color: 0x000000 }));
  shadow.rotation.x = -PI / 2;
  shadow.position.y = -(DIM.T + DIM.BT) - 0.20;
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

  const dip0 = dip(0);
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
      let x = 0, y = SHEET_Y + dip0;                   // 종이 뿌리는 제본 골(두꺼운 책의 홈) 높이에서 시작
      for (let c = 0; c <= NX; c++) {
        if (c > 0) {
          let phi = aR + (aTr - aR) * Math.pow((c - 0.5) / NX, 2.2);
          if (dir < 0) phi = PI - phi;
          x += ds * Math.cos(phi);
          y += ds * Math.sin(phi);
        }
        const i = (r * (NX + 1) + c) * 3;
        pos[i] = x; pos[i + 1] = y + (dip(x) - dip0) * rest; pos[i + 2] = z;
      }
    }
    sheetGeo.attributes.position.needsUpdate = true;
    sheetGeo.computeVertexNormals();
  }

  // 표지 글자의 반짝임 (후광 호흡 + 지나가는 빛줄기 + 글자 위 작은 반짝임) — 표지 위에 겹치는 얇은 판 하나
  const NSP = 6;
  const glowMat = new THREE.ShaderMaterial({
    uniforms: {
      uMask: { value: coverMask }, uSweep: { value: -9 }, uPulse: { value: 0.5 }, uTime: { value: 0 },
      uStrength: { value: 1 }, uSparkle: { value: reduced ? 0 : 1 },
      uSp: { value: sparkPts.map((p) => new THREE.Vector3(p.u, p.v, p.phase)) },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D uMask; uniform float uSweep, uPulse, uTime, uStrength, uSparkle; uniform vec3 uSp[${NSP}]; varying vec2 vUv;
      void main(){
        vec3 m = texture2D(uMask, vUv).rgb;
        float text = m.r, halo = m.g, frame = m.b;
        // 1) 글자 둘레 금빛 후광: 맥박처럼 천천히 밝아졌다 어두워짐
        vec3 col = vec3(1.0, 0.74, 0.34) * halo * (0.30 + 0.70 * uPulse) * 0.62;
        col += vec3(1.0, 0.86, 0.55) * text * (0.10 + 0.22 * uPulse);
        // 2) 빛줄기: 글자(강)·금테(약) 위를 비스듬히 지나감
        float d = vUv.x * 0.75 + vUv.y * 0.5;
        float band = exp(-pow((d - uSweep) / 0.10, 2.0));
        float core = exp(-pow((d - uSweep) / 0.024, 2.0));
        col += (text + frame * 0.45 + halo * 0.30) * (vec3(1.0, 0.80, 0.42) * band * 1.05 + vec3(1.0, 0.97, 0.90) * core * 1.25);
        // 3) 글자 획 위의 작은 별 반짝임 (가끔 하나씩, 십자 광채)
        for (int i = 0; i < ${NSP}; i++) {
          vec2 dd = (vUv - uSp[i].xy) * vec2(1.0, 1.403);
          float r2 = dot(dd, dd);
          float tw = pow(0.5 + 0.5 * sin(uTime * (0.9 + 0.23 * float(i)) + uSp[i].z * 6.2831), 10.0);
          float s = exp(-r2 * 14000.0) * 1.3
                  + (exp(-abs(dd.x) * 70.0) * exp(-dd.y * dd.y * 90000.0) + exp(-abs(dd.y) * 70.0) * exp(-dd.x * dd.x * 90000.0)) * 0.55;
          col += vec3(1.0, 0.96, 0.86) * s * tw * uSparkle;
        }
        gl_FragColor = vec4(col * uStrength, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const glowGeo = new THREE.BufferGeometry();
  {
    const y = -(DIM.T + DIM.BT) - 0.0036, x0 = -DIM.WC, z0 = -DIM.HC / 2, z1 = DIM.HC / 2;
    const P = [[x0, z0], [0, z0], [x0, z1], [0, z1]];
    glowGeo.setAttribute('position', new THREE.Float32BufferAttribute(P.flatMap(([x, z]) => [x, y, z]), 3));
    glowGeo.setAttribute('uv', new THREE.Float32BufferAttribute(P.flatMap(([x, z]) => [-x / DIM.WC, (z + DIM.HC / 2) / DIM.HC]), 2));
    glowGeo.setIndex([0, 1, 2, 1, 3, 2]);
  }
  const glow = new THREE.Mesh(glowGeo, glowMat);

  // ---------------- 상태
  const NS = TX.PAGE_COUNT / 2;
  const S = {
    ready: false, now: 0,
    spread: 0,
    hinge: 0, hingeTw: null,                      // hinge: 0=덮임, 1=펼침
    sheet: { active: false, leaf: -1, dir: 1, p: 0, tw: null, peekSide: 0, lastP: -1, lastDir: 0 },
    queue: null,
    // 첫 열림도 자동 넘김 시계로 처리 → 화면 밖에 있을 땐 연출이 기다렸다가 보일 때 시작
    lastAction: TIMING.introOpenAt - TIMING.closedHold, lastUser: -99, sweepAt: TIMING.sweepFirst,
    pointer: { hit: null, side: 0, amt: 0, drag: null },
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
    else tweenHinge(0, TIMING.closeDur, () => { setSpread(0); S.sweepAt = S.now + 0.3; });
    S.lastAction = S.now;
  }
  function prev(fromUser) {
    if (fromUser) S.lastUser = S.now;
    if (!S.ready) return;
    if (busy()) { S.queue = 'prev'; return; }
    if (S.hinge < 0.5) tweenHinge(1, TIMING.openDur);
    else if (S.spread > 0) flipTo(0);
    else tweenHinge(0, TIMING.closeDur, () => { S.sweepAt = S.now + 0.3; });
    S.lastAction = S.now;
  }

  // ---------------- 포인터: 클릭/탭 = 넘김, 손가락 끌기(터치) = 종이가 따라옴. 마우스 이동만으로는 아무것도 움직이지 않음
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), tmpV = new THREE.Vector3(), tmpN = new THREE.Vector3();
  function hitBook(ev) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    book.updateMatrixWorld();
    tmpN.set(0, 1, 0).transformDirection(book.matrixWorld);
    plane.setFromNormalAndCoplanarPoint(tmpN, tmpV.setFromMatrixPosition(book.matrixWorld));
    if (!ray.ray.intersectPlane(plane, tmpV)) return null;
    const p = book.worldToLocal(tmpV);
    const open = S.hinge > 0.5;
    const x0 = open ? -DIM.WC - 0.05 : -DIM.RS - 0.05, x1 = DIM.WC + 0.05;
    return (p.x > x0 && p.x < x1 && Math.abs(p.z) < DIM.HC / 2 + 0.08) ? { x: p.x, z: p.z } : null;
  }
  canvas.addEventListener('pointermove', (ev) => {
    const P = S.pointer;
    const h = hitBook(ev);
    P.hit = h;
    canvas.style.cursor = h ? 'pointer' : '';
    if (P.drag && P.drag.id === ev.pointerId) {
      const dx = ev.clientX - P.drag.x, dy = ev.clientY - P.drag.y;
      if (!P.drag.moved && Math.hypot(dx, dy) > 8) P.drag.moved = true;
      // 손가락(터치/펜)으로 끌 때만 종이가 따라옴. 마우스는 끌어도 책이 움직이지 않음(클릭만)
      if (ev.pointerType !== 'mouse' && P.drag.moved && Math.abs(dx) > Math.abs(dy) && S.hinge > 0.99 && !busy()) {
        const a = Math.min(0.85, Math.abs(dx) / (canvas.clientWidth * 0.55));
        P.side = dx < 0 ? 1 : -1; P.amt = a;
        if ((P.side === 1 && S.spread >= NS - 1) || (P.side === -1 && S.spread <= 0)) P.amt = Math.min(P.amt, 0.04);
        wake();
      }
      return;
    }
    if (h && ev.pointerType === 'mouse') S.lastUser = S.now;   // 책 위에 마우스가 머물면 자동 넘김만 잠시 멈춤 (책은 그대로)
  });
  canvas.addEventListener('pointerleave', () => { const P = S.pointer; P.hit = null; if (!P.drag) { P.side = 0; P.amt = 0; } });
  canvas.addEventListener('pointerdown', (ev) => {
    S.pointer.drag = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, moved: false, hit: hitBook(ev) };
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) { /* 일부 브라우저 */ }
  });
  const endDrag = (ev) => {
    const P = S.pointer, d = P.drag;
    if (!d || d.id !== ev.pointerId) return;
    P.drag = null;
    const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
    const swipe = ev.pointerType !== 'mouse' && d.moved && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30;
    if (swipe) dx < 0 ? next(true) : prev(true);                  // 스와이프
    else if (d.hit && (!d.moved || ev.pointerType === 'mouse')) {  // 클릭/탭 (마우스는 조금 움직여도 클릭으로)
      (S.hinge > 0.5 && d.hit.x < -0.05) ? prev(true) : next(true);
    }
    P.side = 0; P.amt = 0;
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
      // 손가락으로 끌면 종이가 따라옴 (터치 전용)
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
    const theta = -PI * (1 - S.hinge);
    leftHalf.rotation.z = theta;
    updateSpine(theta);

    // 자동 넘김 (조작이 없을 때만, 천천히)
    if (!reduced && !busy() && !P.drag && t - S.lastUser > TIMING.userIdle) {
      const wait = S.hinge < 0.5 ? TIMING.closedHold : TIMING.autoFlip;
      if (t - S.lastAction > wait && !(sh.active && sh.peekSide)) next(false);
    }
    if (!busy() && S.queue) { const qd = S.queue; S.queue = null; qd === 'next' ? next(false) : prev(false); }

    // 표지 글자 반짝임: 맥박 호흡(발광 + 후광) + 주기적 빛줄기
    const closedness = 1 - S.hinge;
    glow.visible = closedness > 0.3;
    const pulse = reduced ? 0.6 : 0.5 - 0.5 * Math.cos((2 * PI * t) / TIMING.pulsePeriod);
    M.CoverFront.emissiveIntensity = 0.22 + 0.62 * pulse;
    if (glow.visible) {
      const u = glowMat.uniforms;
      u.uPulse.value = pulse; u.uTime.value = t;
      u.uStrength.value = smooth(0.3, 0.9, closedness);
      if (!reduced) {
        if (t >= S.sweepAt + TIMING.sweepDur) S.sweepAt = t + TIMING.sweepEvery - TIMING.sweepDur;
        const k = (t - S.sweepAt) / TIMING.sweepDur;
        u.uSweep.value = k >= 0 && k <= 1 ? lerp(-0.2, 1.45, k) : -9;
      } else u.uSweep.value = -9;
    }

    // 자세 / 구도: 책은 제자리에 고정. 마우스와 무관하게 아주 느린 숨쉬기만
    const e = S.hinge;
    const f = smooth(0, 0.8, e);   // 구도 전환은 표지가 거의 덮였을 때 몰아서 (닫히는 중 잘리지 않게)
    const fl = reduced ? 0 : 1;
    stage.position.x = VIEW.closedShift * (1 - f);
    stage.rotation.y = VIEW.yaw + fl * Math.sin(t * 0.21) * 0.010;
    stage.rotation.x = VIEW.pitch;
    book.position.y = fl * (0.012 + Math.sin(t * 0.75) * 0.022);
    book.rotation.z = fl * Math.sin(t * 0.47 + 1) * 0.006;
    // 그림자는 책 바닥(덮였을 땐 책등~앞단, 펼쳤을 땐 양쪽 표지) 바로 아래 가운데에
    shadow.position.x = lerp((DIM.WC - DIM.RS) / 2, 0, f);
    shadow.scale.set(lerp((DIM.WC + DIM.RS) / 0.5, (2 * DIM.WC) / 0.5, f) * 1.0, (DIM.HC / 0.5) * 1.0, 1);
    shadow.material.opacity = 0.72 - book.position.y * 2.5;
    // 표지가 세워지는 동안에는 카메라가 살짝 물러나 표지 끝이 화면 밖으로 잘리지 않게
    const swing = Math.pow(Math.sin(PI * e), 1.3);
    const zoom = (lerp(VIEW.closedZoom, 1, f) + 0.32 * swing) * fit;
    camTarget.y = lerp(VIEW.closedTargetY, VIEW.target[1], f) + 0.34 * swing;
    camTarget.x = -0.12 * swing;
    camera.position.copy(camTarget).addScaledVector(camDir, camDist * zoom);
    camera.lookAt(camTarget);
  }

  function animating() {
    if (!reduced) return true;
    const sh = S.sheet, P = S.pointer;
    return busy() || (sh.active && sh.peekSide !== 0) || P.side !== 0;
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
  const api = {
    next: () => { next(true); wake(); }, prev: () => { prev(true); wake(); }, destroy, info: { low, reduced },
    // 자체 점검용: 책의 자세(마우스를 움직여도 바뀌지 않아야 함)
    pose: () => ({ yaw: stage.rotation.y, pitch: stage.rotation.x, x: stage.position.x, y: book.position.y, roll: book.rotation.z, hinge: S.hinge, spread: S.spread }),
  };
  el.__bhnHero = api;
  loadGLB(modelUrl).then((nodes) => {
    for (const g of Object.values(nodes)) g.traverse((o) => { if (o.isMesh) o.material = M[o.userData.mat] || M.Leather; });
    leftHalf = nodes.LeftHalf; spine = nodes.Spine;
    leftHalf.add(glow);
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
