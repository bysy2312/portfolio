/* ─────────────────────────────────────────────
   Read, Fix, Save. — plastichuman.org 레이아웃 가이드를 그대로 따른 한 장짜리 WebGL 페이지
   · 장면 5개: 00 히어로(흉상) → 01 소개(입자 구름 + 회전 글자 고리) → 02 작업 목록(단어 클릭 = 상세페이지)
     → 03 연락(가운데 흉상 + 큰 글자) → 04 링크와 크레딧
   · 흉상: Poly Haven "Marble Bust 01"(CC0) 표면에서 뽑은 점 9,000개(points/bust.bin). 마우스 방향으로 고개를 돌림
   · 글자: 캔버스에 그린 선명한 글자 + 흐린 글자 → 낮고 고르지 않은 임계값 = 잉크 글자.
     마우스가 지나간 자리는 천천히 마르는 흔적이 남고, 그 자리 글자가 번지고 닳음
   · 색은 파랑/흰색 둘뿐. 장면마다 바탕이 뒤집히고, 글자·상단 바는 지나가는 곳의 색을 뒤집음(XOR)
   ───────────────────────────────────────────── */
(() => {
  'use strict';

  const BLUE = [0x1f / 255, 0x3c / 255, 1];
  const N = 9000, TAU = Math.PI * 2;
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // ?export=0..3 → 그 장면의 물체만 그림 (글자·상단 바 없음). 피그마용 이미지 뽑을 때 씀
  const EXPORT = new URLSearchParams(location.search).get('export');
  const EXP = EXPORT === null ? -1 : +EXPORT;

  /* ── 도우미 ─────────────────────────── */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeOut = (x) => 1 - Math.pow(1 - x, 3);
  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const R = rng(11);

  /* ── 레이아웃 (레퍼런스와 같은 규칙: 2.1:1 안전 영역, 1440×900 = ×1 ~ 큰 화면 ×1.5) ───── */
  let W = innerWidth, H = innerHeight, FX = 0, FW = W, U = 1, COMPACT = false, TABLET = false, GUT = 28, IN = 12, DPR = 1;
  function frameCalc() {
    W = innerWidth; H = innerHeight;
    COMPACT = W < 700 || W / H < 0.9;
    TABLET = COMPACT && W >= 700;
    FW = W / H > 2.1 ? Math.round(H * 2.1) : W;
    FX = Math.round((W - FW) / 2);
    U = COMPACT ? Math.min(1.6, Math.max(1, Math.min(W / 400, H / 860))) : Math.min(1.5, Math.max(1, Math.min(FW / 1440, H / 900)));
    GUT = W < 700 ? 16 : COMPACT ? 24 : 28 * U;
    IN = COMPACT ? 0 : 12;
    DPR = Math.min(devicePixelRatio || 1, 2);
    const ds = document.documentElement.style;
    ds.setProperty('--gut', GUT + 'px'); ds.setProperty('--fx', FX + 'px'); ds.setProperty('--u', U.toFixed(3));
  }
  frameCalc();

  /* ── 장면 ─────────────────────────────────
     zones = [물체, 큰 글자, 본문, 단위] — 화면 비율 [x, y, w, h] (레퍼런스와 같은 값) */
  const WORK = {
    y: 'https://bysy2312.github.io/portfolio/work-yeolnayo-v2.html',
    p: 'https://bysy2312.github.io/portfolio/work-piccha.html',
    b: 'https://bysy2312.github.io/portfolio/work-bebedepino.html',
  };
  const SCENES = [
    { route: 'Overview', ground: 0, shape: 'bust', face: 1, hold: 0.35, flush: true,
      zones: [[0.43, 0.08, 0.6, 1.6], [0.0, 0.41, 0.46, 0.52], [0.0, 0.14, 0.27, 0.12], null],
      mz: [null, [0.05, 0.09, 0.9, 0.21], [0.05, 0.315, 0.9, 0.14], null], hv: 0.52,
      title: ['Read, Fix,', 'Save.'], kicker: '(00) Profile',
      text: 'Fever logs, gacha trades, kidswear carts — researched first, then made simple.',
      fig: 'Designer bust, 9,000-point scan', tags: ['research', 'interview', 'interface'],
      foot: '열나요 (2026) · Piccha (2026) · 베베드피노 (2026)' },
    { route: 'About — designer', ground: 1, shape: 'cloud', hold: 1.3, kind: 'drum',
      zones: [[0.32, 0.18, 0.36, 0.66], [0.02, 0.66, 0.44, 0.3], [0.02, 0.13, 0.22, 0.2], [0.74, 0.82, 0.24, 0.1]],
      unit: '사람의 하루를 바꾸는 서비스', src: '열나요 · Piccha · 베베드피노',
      kicker: '(01) About',
      text: '사용자의 작은 불편에서 출발해, 리서치와 인터뷰로 이유를 찾고, 그 이유를 화면 하나하나에 담아내는 디자이너예요.',
      ringText: '보기 좋은 것보다 쓰기 좋은 것을 먼저 고민하려고 해요 — 작은 불편을 읽고, 고치고, 저장해요 — ',
      fig: 'Notes, interviews, screens', tags: ['리서치', '인터뷰', '화면'],
      foot: '¹ UX/UI designer · Based in Seoul · Since 2026' },
    { route: 'Index — 3 works, 9 screens', ground: 0, shape: 'shard', hold: 1.6, kind: 'list',
      zones: [[0.41, 0.24, 0.18, 0.52], null, [0.015, 0.14, 0.22, 0.2], null],
      mz: [[0.35, 0.3, 0.3, 0.4], null, null, null],
      kicker: '(02) Works',
      rows: [
        ['열나요', '체온 기록', 'y'], ['아이 발열', '야간 응급', 'y'], ['기록 앱', '커뮤니티', 'y'],
        ['Piccha', '상품 등록', 'p'], ['가챠', '키워드', 'p'], ['플랫폼 앱', '결제', 'p'],
        ['베베드피노', 'GNB', 'b'], ['브랜드', '히어로', 'b'], ['웹사이트', '룩북', 'b'],
      ],
      foot: 'Click a word to open its project — 열나요 · Piccha · 베베드피노' },
    { route: 'Contact', ground: 1, shape: 'bust', face: -1, hold: 0.9, kind: 'finale',
      zones: [[0.27, 0.05, 0.46, 1.5], [0.27, 0.27, 0.46, 0.46], [0.045, 0.4, 0.2, 0.3], null],
      mz: [null, [0.05, 0.08, 0.9, 0.27], [0.05, 0.37, 0.9, 0.2], null], hv: 0.48,
      title: ['Shall we', 'talk?'], align: 'center', kicker: '(03) Contact',
      text: '딸깍, 함께 일할 디자이너를 찾고 계신가요? 다음 불편은 같은 팀에서 고치고 싶어요.',
      contact: [['E-MAIL', 'bysy2312@gmail.com', 'mailto:bysy2312@gmail.com']],
      fig: 'You, next' },
    { route: 'Links & credits', ground: 0, shape: null, hold: 0.7, kind: 'outro', zones: [null, null, null, null],
      title: ['Save.'] },
  ];
  const LAST = SCENES.length - 1;
  const MOBILE_ZONES = [[0.1, 0.12, 0.8, 0.42], [0.05, 0.55, 0.9, 0.14], [0.05, 0.72, 0.9, 0.16], [0.05, 0.88, 0.9, 0.08]];

  let zoneCache = [];
  function zones(i) {
    if (zoneCache[i]) return zoneCache[i];
    const sc = SCENES[i];
    return (zoneCache[i] = sc.zones.map((r, k) => {
      if (COMPACT) {
        if (k === 0 && sc.shape === 'bust') {           // 폰: 흉상은 아래쪽, 화면 끝이 목을 자름
          const vis = (sc.hv ?? 0.5) * H;
          let h = vis / 0.6, w = h * 0.55;
          if (w > W * 0.8) { w = W * 0.8; h = w / 0.55; }
          return { x: (W - w) / 2, y: H - h * 0.6, w, h };
        }
        r = sc.mz && sc.mz[k] !== undefined && sc.mz[k] !== null ? sc.mz[k] : r && MOBILE_ZONES[k];
        if (!r) return null;
        if (k > 0) return { x: GUT, y: r[1] * H, w: W - GUT * 2, h: r[3] * H };
      }
      if (!r) return null;
      return { x: FX + r[0] * FW, y: r[1] * H, w: r[2] * FW, h: r[3] * H };
    }));
  }

  /* ── 모양 (단위 좌표, y는 아래로) ─────────────────────────── */
  const EXT = { bust: [0.55, 1], cloud: [1, 1], shard: [0.62, 0.9] };   // 반폭, 반높이
  const SHAPES = {};
  /* 흰 반점: 동그란 점 하나씩이 아니라, 표면에서 가까운 점들을 무리로 묶어 불규칙한 얼룩이 되게 함 */
  const SPECK = {};
  function makeSpecks(P, seeds, rMin, rMax, seed) {
    const k = new Uint8Array(N), r = rng(seed), S = [];
    for (let j = 0; j < seeds; j++) {
      const i = (r() * N) | 0, sr = lerp(rMin, rMax, r() * r());
      // 한 얼룩 = 크기가 다른 작은 덩어리 2~4개를 겹친 것 → 동그랗지 않고 찌그러진 모양
      const parts = 2 + ((r() * 3) | 0);
      for (let q = 0; q < parts; q++) {
        const a = r() * TAU, b = r() * TAU, d = q === 0 ? 0 : sr * (0.55 + r() * 0.5);
        S.push([P[i * 3] + Math.cos(a) * d, P[i * 3 + 1] + Math.sin(a) * d, P[i * 3 + 2] + Math.sin(b) * d * 0.5,
          sr * (q === 0 ? 1 : 0.45 + r() * 0.4), r() * 0.9 + 0.6, r() * 0.9 + 0.6]);
      }
    }
    for (let i = 0; i < N; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      for (const [sx, sy, sz, sr, ax, ay] of S) {      // 찌그러진 타원 → 모양이 제각각
        const dx = (x - sx) * ax, dy = (y - sy) * ay, dz = z - sz;
        if (dx * dx + dy * dy + dz * dz < sr * sr) { k[i] = 1; break; }
      }
    }
    return k;
  }
  const delay = new Float32Array(N), dirX = new Float32Array(N), dirY = new Float32Array(N), dirZ = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    delay[i] = R();
    const u = R() * 2 - 1, t = R() * TAU, s = Math.sqrt(1 - u * u);
    dirX[i] = s * Math.cos(t); dirY[i] = u; dirZ[i] = s * Math.sin(t);
  }
  function makeCloud() {                                // 먼지 덩어리: 가운데 빽빽, 가장자리 흩날림
    const a = new Float32Array(N * 3), r = rng(5);
    const C = 520, cx = [], cy = [], cz = [];
    for (let k = 0; k < C; k++) {
      const u = r() * 2 - 1, t = r() * TAU, s = Math.sqrt(1 - u * u), d = Math.pow(r(), 0.75) * 0.82;
      cx.push(s * Math.cos(t) * d); cy.push(u * d); cz.push(s * Math.sin(t) * d);
    }
    for (let i = 0; i < N; i++) {
      if (r() < 0.12) {                                 // 흩날리는 먼지
        const u = r() * 2 - 1, t = r() * TAU, s = Math.sqrt(1 - u * u), d = 0.55 + r() * 0.5;
        a.set([s * Math.cos(t) * d, u * d, s * Math.sin(t) * d], i * 3);
      } else {
        const k = (r() * C) | 0, g = () => (r() + r() + r() - 1.5) * 0.05;
        a.set([cx[k] + g(), cy[k] + g(), cz[k] + g()], i * 3);
      }
    }
    return a;
  }
  function makeShard() {                                // 매끈한 플라스틱 조각
    const a = new Float32Array(N * 3), r = rng(9);
    for (let i = 0; i < N; i++) {
      const u = r() * 2 - 1, t = r() * TAU, s = Math.sqrt(1 - u * u);
      const x = s * Math.cos(t), y = u, z = s * Math.sin(t);
      const n = 1 + 0.07 * Math.sin(x * 5.1 + y * 2.3) + 0.05 * Math.sin(y * 7.7 - z * 3.1) + 0.04 * Math.sin(z * 9.3 + x * 4.2);
      a.set([x * 0.58 * n, y * 0.86 * n, z * 0.4 * n], i * 3);
    }
    return a;
  }
  SHAPES.cloud = makeCloud();
  SHAPES.shard = makeShard();
  const RADF = { bust: 0.05, cloud: 0.04, shard: 0.05 };
  SPECK.cloud = new Uint8Array(N);
  SPECK.shard = new Uint8Array(N);

  /* 물체 자리: 장면의 물체 칸에 맞춰 크기·중심 */
  function place(i) {
    const sc = SCENES[i];
    if (!sc || !sc.shape) return null;
    const o = zones(i)[0], [ex, ey] = EXT[sc.shape];
    let S = Math.min(o.w / 2 / ex, o.h / 2 / ey);
    if (sc.shape === 'bust') S = o.h / 2;
    if (sc.shape === 'cloud') S *= 0.82;
    return { cx: o.x + o.w / 2, cy: o.y + o.h / 2, S, shape: sc.shape, face: sc.face || 0 };
  }

  /* ── WebGL ─────────────────────────── */
  const canvas = document.getElementById('gl');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
  if (!gl) { document.body.classList.add('no-gl'); return; }
  const DERIV = !!gl.getExtension('OES_standard_derivatives');

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const program = (vs, fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  };
  const makeTex = (repeat = false) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    return t;
  };
  const upload = (t, src) => { gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); };

  // 1) 점 → 밀도(field). r = 몸통, g = 흰 반점
  const pPoint = program(`
    attribute vec4 aP;
    uniform vec2 uView;
    uniform float uPx, uMax;
    varying float vK;
    void main() {
      vec2 c = aP.xy / uView * 2.0 - 1.0;
      gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
      gl_PointSize = min(aP.z * 2.0 * uPx, uMax);
      vK = aP.w;
    }`, `
    precision mediump float;
    varying float vK;
    void main() {
      vec2 q = gl_PointCoord * 2.0 - 1.0;
      float d = 1.0 - dot(q, q);
      if (d <= 0.0) discard;
      d *= d * 0.34;                                   // 점 하나로는 문턱(0.5)을 못 넘음 → 여럿이 모여야 잉크가 됨
      gl_FragColor = vK > 0.5 ? vec4(0.0, d, 0.0, 0.0) : vec4(d, 0.0, 0.0, 0.0);
    }`);

  // 2) 합성: 바탕 번짐 + 물체 + 잉크 글자 + 상단 바 (전부 XOR)
  const pComp = program(`
    attribute vec2 aQ;
    varying vec2 vUv;
    void main() { vUv = aQ * 0.5 + 0.5; gl_Position = vec4(aQ, 0.0, 1.0); }`, `
    ${DERIV ? '#extension GL_OES_standard_derivatives : enable' : ''}
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uF, uTB, uTBb, uTS, uTSb, uH, uUI, uGrain, uRing;
    uniform vec2 uRes, uO, uFbPx;
    uniform vec3 uBlue, uDrop;
    uniform vec4 uRingP;
    uniform float uGA, uGB, uR, uAsp, uTime, uMeltB, uMeltS, uOffB, uRingRot, uScuff, uObjA;
    float hs(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n2(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hs(i), hs(i + vec2(1.0, 0.0)), u.x), mix(hs(i + vec2(0.0, 1.0)), hs(i + vec2(1.0, 1.0)), u.x), u.y);
    }
    float aaw(float v, float th, float w) { w = max(w, 1e-4) * 0.9; return smoothstep(th - w, th + w, v); }
    void main() {
      vec2 px = vec2(vUv.x * uRes.x, (1.0 - vUv.y) * uRes.y);
      vec2 cuv = vec2(vUv.x, 1.0 - vUv.y);
      vec2 a = vec2(uAsp, 1.0);
      float h = clamp((texture2D(uH, cuv).a - 0.05) / 0.95, 0.0, 1.0);

      // 바탕: 다음 색이 물체가 있던 자리에서 액체처럼 번져 나감
      float inside = 0.0;
      if (uR > 0.0) {
        float n = n2(vUv * a * 2.2 + uTime * 0.04) * 0.6 + n2(vUv * a * 6.0 - uTime * 0.05) * 0.25 - 0.42;
        inside = 1.0 - smoothstep(uR - 0.004, uR + 0.004, length((vUv - uO) * a) + n * 0.22 * smoothstep(0.0, 0.45, uR));
      }
      float v = mix(uGA, uGB, inside);

      // 물체: 바탕과 반대 색. 커서 쪽으로 살짝 부풂, 안에 흰 반점
      if (uObjA > 0.0) {
        // 물결: 시간에 따라 흐르는 노이즈로 좌표를 살짝 비틀고, 주변을 섞어 가장자리를 부드럽게
        vec2 wq = vUv + vec2(n2(vUv * a * 3.0 + uTime * 0.22) - 0.5, n2(vUv * a * 3.0 + 17.0 - uTime * 0.19) - 0.5) * 0.014
                      + vec2(n2(vUv * a * 9.0 - uTime * 0.35) - 0.5, n2(vUv * a * 9.0 + 5.0 + uTime * 0.31) - 0.5) * 0.004;
        vec2 dx = vec2(uFbPx.x * 2.0, 0.0), dy = vec2(0.0, uFbPx.y * 2.0);
        vec4 fd = (texture2D(uF, wq) * 2.0 + texture2D(uF, wq + dx) + texture2D(uF, wq - dx) + texture2D(uF, wq + dy) + texture2D(uF, wq - dy)) / 6.0;
        float f = fd.r + h * 0.3 * smoothstep(0.05, 0.45, fd.r);
        float body = smoothstep(0.485, 0.515, f);
        // 흰 반점: 가장자리를 노이즈로 크게 비틀어 찌그러진 얼룩 모양 (천천히 꿈틀거림)
        vec2 hq = wq + vec2(n2(vUv * a * 26.0 + uTime * 0.15) - 0.5, n2(vUv * a * 26.0 + 9.0 - uTime * 0.13) - 0.5) * 0.02;
        float hg = texture2D(uF, hq).g + (n2(vUv * a * 30.0 - uTime * 0.1) - 0.5) * 0.24;
        float holes = smoothstep(0.54, 0.6, hg) * body;
        v = mix(v, 1.0 - v, body);
        v = mix(v, 1.0 - v, holes);
      }

      // 글자: 흐린 마스크 + 낮고 고르지 않은 임계값 = 잉크. 커서 아래와 녹을 때 더 번짐
      vec2 bc = vec2(cuv.x, cuv.y + uOffB / uRes.y);
      float tbS = texture2D(uTB, bc).a, tbB = texture2D(uTBb, bc).a;
      float tsS = texture2D(uTS, cuv).a, tsB = texture2D(uTSb, cuv).a;
      ${DERIV ? 'vec4 tw = fwidth(vec4(tbS, tbB, tsS, tsB));' : 'vec4 tw = vec4(0.02);'}
      float t = 0.0;
      if (max(max(tbS, tbB), max(tsS, tsB)) > 0.004) {
        vec2 gr = texture2D(uGrain, gl_FragCoord.xy / 256.0).rg - 0.5;
        // 쉬고 있을 때도 잉크가 깨짐: 거친 결의 세기가 천천히 흐르는 얼룩마다 다름
        float wear = smoothstep(0.45, 0.9, n2(vUv * a * 4.0 + vec2(uTime * 0.03, -uTime * 0.02)));
        float grain = (gr.x * 0.05 + gr.y * 0.06) * mix(0.6, 3.0, wear);
        float ord = clamp(1.0 - (vUv.x * 0.35 + (1.0 - vUv.y) * 0.65) + gr.y * 0.12, 0.0, 1.0);
        float mB = clamp(uMeltB * 1.5 - ord * 0.5, 0.0, 1.0);
        float mT = clamp(uMeltS * 1.9 - ord * 0.9, 0.0, 1.0);
        float patchN = h > 0.002 ? smoothstep(-0.1, 0.55, n2(vUv * a * 7.0 + vec2(uTime * 0.04, -uTime * 0.03)) * 2.0 - 1.0) : 0.0;
        float scuff = clamp(h * uScuff * max(patchN, 0.45), 0.0, 1.0);
        float speck = (hs(floor(gl_FragCoord.xy)) - 0.5) * 0.5 * scuff;
        float mb = clamp(0.7 + scuff * 0.3 + min(mB * 2.5, 1.0), 0.0, 1.0);
        float tb = aaw(mix(tbS, tbB, mb), max(0.4 - scuff * 0.24 + grain + speck, 0.12) + mB * 0.36 + smoothstep(0.45, 0.9, mB) * 0.9, mix(tw.x, tw.y, mb));
        float sScuff = clamp(h * uScuff * max(patchN, 0.55), 0.0, 1.0) * 1.2;
        float sSpeck = speck / max(scuff, 1e-3) * min(sScuff, 1.0);
        float ms = clamp(0.1 + sScuff * 0.3 + min(mT * 2.5, 1.0), 0.0, 1.0);
        float ts = aaw(mix(tsS, tsB, ms), max(0.42 - sScuff * 0.22 + grain * 0.35 + sSpeck, 0.1) + mT * 0.34 + smoothstep(0.45, 0.9, mT) * 0.9, mix(tw.z, tw.w, ms));
        t = max(tb, ts);
      }
      // 소개 장면의 글자 고리: 한 번 그려 두고 여기서 돌림
      if (uRingP.w > 0.0) {
        vec2 d = (px - uRingP.xy);
        float c = cos(uRingRot), s = sin(uRingRot);
        vec2 q = vec2(d.x * c + d.y * s, -d.x * s + d.y * c);
        vec2 ruv = q / (2.0 * uRingP.z) + 0.5;
        if (ruv.x > 0.0 && ruv.x < 1.0 && ruv.y > 0.0 && ruv.y < 1.0) t = max(t, smoothstep(0.35, 0.6, texture2D(uRing, ruv).a) * uRingP.w);
      }
      v = mix(v, 1.0 - v, t);

      // 상단 바·점 내비 (선명, XOR). 지금 장면 점은 액체 방울
      float ui = smoothstep(0.3, 0.7, texture2D(uUI, cuv).a);
      float drop = 1.0 - smoothstep(uDrop.z - 0.8, uDrop.z + 0.8, length(px - uDrop.xy));
      ui = max(ui, drop);
      v = mix(v, 1.0 - v, ui);
      gl_FragColor = vec4(mix(vec3(1.0), uBlue, v), 1.0);
    }`);

  const UC = {};
  ['uFbPx', 'uF', 'uTB', 'uTBb', 'uTS', 'uTSb', 'uH', 'uUI', 'uGrain', 'uRing', 'uRes', 'uO', 'uBlue', 'uDrop', 'uRingP',
    'uGA', 'uGB', 'uR', 'uAsp', 'uTime', 'uMeltB', 'uMeltS', 'uOffB', 'uRingRot', 'uScuff', 'uObjA']
    .forEach((n) => (UC[n] = gl.getUniformLocation(pComp, n)));
  const UP = { uView: gl.getUniformLocation(pPoint, 'uView'), uPx: gl.getUniformLocation(pPoint, 'uPx'), uMax: gl.getUniformLocation(pPoint, 'uMax') };
  const aP = gl.getAttribLocation(pPoint, 'aP'), aQ = gl.getAttribLocation(pComp, 'aQ');
  const bufQuad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bufQuad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const ptData = new Float32Array(N * 4);
  const bufPts = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, bufPts);
  gl.bufferData(gl.ARRAY_BUFFER, ptData.byteLength, gl.DYNAMIC_DRAW);
  const maxPoint = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] || 256;

  const fieldTex = makeTex(), fbo = gl.createFramebuffer();
  const texTB = makeTex(), texTBb = makeTex(), texTS = makeTex(), texTSb = makeTex(), texH = makeTex(), texUI = makeTex(), texRing = makeTex();
  const texGrain = makeTex(true);
  { // 미리 구운 결: 픽셀 단위 노이즈 두 겹 (글자 가장자리의 거친 잉크)
    const n = 256, d = new Uint8Array(n * n * 4), r = rng(3);
    const coarse = new Float32Array((n / 3 + 2) * (n / 3 + 2)).map(() => r());
    const cw = n / 3 + 2;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      d[i] = (r() * 0.6 + r() * 0.4) * 255;
      const gx = x / 3, gy = y / 3, x0 = gx | 0, y0 = gy | 0, fx = gx - x0, fy = gy - y0;
      const c = coarse[y0 * cw + x0] * (1 - fx) * (1 - fy) + coarse[y0 * cw + x0 + 1] * fx * (1 - fy) + coarse[(y0 + 1) * cw + x0] * (1 - fx) * fy + coarse[(y0 + 1) * cw + x0 + 1] * fx * fy;
      d[i + 1] = c * 255; d[i + 3] = 255;
    }
    gl.bindTexture(gl.TEXTURE_2D, texGrain);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, n, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
  }

  /* ── 2D 캔버스들 ─────────────────────────── */
  const mk = () => { const c = document.createElement('canvas'); return [c, c.getContext('2d')]; };
  const [cBig, gBig] = mk(), [cBigB, gBigB] = mk(), [cSm, gSm] = mk(), [cSmB, gSmB] = mk(), [cUI, gUI] = mk(), [cHov, gHov] = mk(), [cRing, gRing] = mk();
  const CAN_FILTER = 'filter' in gBigB;
  let fbW = 1, fbH = 1, HS = 0.2;

  const SANS = '"Inter Tight", "Pretendard Variable", Pretendard, sans-serif';
  const MONO = '"JetBrains Mono", "Pretendard Variable", monospace';
  function font(g, w, sz, mono = false, ls = null) {
    g.font = `${w} ${sz}px ${mono ? MONO : SANS}`;
    if ('letterSpacing' in g) g.letterSpacing = ls == null ? (mono ? '0.4px' : '0px') : ls;
  }
  function wrap(g, text, maxW) {
    const out = []; let line = '';
    for (const w of text.split(' ')) {
      const t = line ? line + ' ' + w : w;
      if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    if (line) out.push(line);
    return out;
  }
  const kickerText = (k) => k.replace(/^\(\d+\)\s*/, '').toUpperCase();
  function blurCopy(src, dst, gd, sigma, k) {        // 흐린 판: 낮은 해상도 + 블러
    const kk = CAN_FILTER ? k : 0.12;
    dst.width = Math.max(1, Math.round(W * kk)); dst.height = Math.max(1, Math.round(H * kk));
    gd.clearRect(0, 0, dst.width, dst.height);
    if (CAN_FILTER) gd.filter = `blur(${Math.max(0.3, sigma * kk).toFixed(2)}px)`;
    gd.drawImage(src, 0, 0, dst.width, dst.height);
    gd.filter = 'none';
  }
  function resetCanvas(c, g) {
    c.width = Math.round(W * DPR); c.height = Math.round(H * DPR);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineWidth = 1;
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  }

  /* ── 큰 글자 ─────────────────────────── */
  function fitSize(g, lines, w, h) {
    font(g, 500, 100, false, '-6px');
    const w100 = Math.max(...lines.map((l) => g.measureText(l).width));
    return Math.min(w * 0.96 / (w100 / 100), h / (lines.length * 0.82));
  }
  let listRects = [];                                   // 작업 단어 자리 (그린 시점 기준)
  let humanH = 0;
  const shard = { cx: 0, cy: 0, rx: 0, ry: 0 };
  function listGeo() {
    const sc = SCENES[2];
    const sz = COMPACT ? Math.min(W * 0.066, H * 0.05) : Math.min(H * 0.1, FW * 0.064);
    const pitch = sz * 1.0;
    // 폰: 목록이 짧아서 조각을 가운데 두고 위아래로 조금만 흐름
    const travel = COMPACT ? H * 0.12 : Math.max(H * 0.1, sc.rows.length * pitch - H * 0.62);
    const top = COMPACT ? shard.cy - sc.rows.length * pitch / 2 + sz * 0.8 + travel / 2 : H * 0.2 + sz * 0.8;
    return { sz, pitch, top, travel };
  }
  function drawBig(i, slide = 0) {
    const sc = SCENES[i], g = gBig;
    resetCanvas(cBig, g);
    listRects = [];
    let blur = 9;
    if (sc.kind === 'list') {
      const { sz, pitch, top } = listGeo();
      font(g, 500, sz, false, `${(-0.06 * sz).toFixed(2)}px`);
      const p = place(2), gap = 22 * U, minHalf = 26 * U;
      sc.rows.forEach(([l, r, key], k) => {
        const base = top + k * pitch - slide;
        if (base < -sz || base > H + sz * 1.2) return;
        // 줄이 지나는 높이에서 조각의 폭만큼 비켜 섬 (단어가 조각을 피해 갈라짐)
        let half = 0;
        if (p) for (const yy of [base - sz * 0.72, base - sz * 0.36, base]) {
          const q = (yy - shard.cy) / shard.ry;
          if (Math.abs(q) < 1) half = Math.max(half, shard.rx * Math.sqrt(1 - q * q));
        }
        const cx = p ? shard.cx : W / 2;
        const hl = Math.max(minHalf, half + gap);
        const ml = g.measureText(l), mr = g.measureText(r);
        const xl = cx - hl - ml.width, xr = cx + hl;
        g.fillText(l, xl, base); g.fillText(r, xr, base);
        const asc = sz * 0.74, dsc = sz * 0.2;
        listRects.push({ x: xl, y: base - asc, w: ml.width, h: asc + dsc, href: WORK[key], label: l });
        listRects.push({ x: xr, y: base - asc, w: mr.width, h: asc + dsc, href: WORK[key], label: r });
      });
      blur = sz * 0.03;
    } else if (sc.kind === 'outro') {
      const lines = sc.title;
      font(g, 500, 100, false, '-6px');
      const w100 = g.measureText(lines[0]).width;
      const sz = Math.min((FW - GUT * 2) * 0.62 / (w100 / 100), H * (COMPACT ? 0.22 : 0.38));
      font(g, 500, sz, false, `${(-0.06 * sz).toFixed(2)}px`);
      const m = g.measureText(lines[0]);
      const base = H * 0.075 + m.actualBoundingBoxAscent;
      g.fillText(lines[0], FX + GUT + m.actualBoundingBoxLeft, base);
      humanH = base + m.actualBoundingBoxDescent;
      blur = sz * 0.026;
    } else {
      const z = zones(i)[1];
      const lines = sc.title || (sc.num ? [sc.num] : null);
      if (z && lines) {
        const sz = fitSize(g, lines, z.w, z.h);
        font(g, 500, sz, false, `${(-0.06 * sz).toFixed(2)}px`);
        const lastM = g.measureText(lines[lines.length - 1]);
        const base = sc.flush && !COMPACT ? H - (FX + GUT) - lastM.actualBoundingBoxDescent : z.y + z.h - sz * 0.06;
        lines.forEach((l, k) => {
          const m = g.measureText(l);
          const x = COMPACT ? W / 2 - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2
            : sc.align === 'center' ? z.x + (z.w - m.width) / 2
            : sc.flush ? FX + GUT + m.actualBoundingBoxLeft : z.x + IN;
          g.fillText(l, x, base - (lines.length - 1 - k) * sz * 0.82);
        });
        blur = sz * 0.03;
      }
    }
    blurCopy(cBig, cBigB, gBigB, blur, 0.5);
    upload(texTB, cBig); upload(texTBb, cBigB);
  }

  /* ── 작은 글자 + 그림 표식 ─────────────────────────── */
  let contactRects = [];
  function drawSmall(i) {
    const sc = SCENES[i], g = gSm, z = zones(i);
    resetCanvas(cSm, g);
    contactRects = [];
    const RX = FX + FW;
    // 본문 (킥커 + 문장)
    if (sc.kind === 'list') {
      font(g, 400, 11 * U, true);
      g.fillText(kickerText(sc.kicker), FX + GUT, COMPACT ? H * 0.09 : H * 0.13);
      if (!COMPACT) {
        font(g, 400, 11 * U, true);
        const cx = place(2) ? shard.cx : W / 2;
        g.textAlign = 'right'; g.fillText('PROJECT ←', cx - 22 * U, H * 0.13);
        g.textAlign = 'left'; g.fillText('→ SCREENS', cx + 22 * U, H * 0.13);
      }
    } else if (z[2] && sc.text) {
      const c = z[2];
      let y = c.y + 11;
      const x = sc.flush && !COMPACT ? FX + GUT : c.x + IN;
      const fs = (COMPACT ? 15 : 17.5) * U;
      font(g, 400, 11 * U, true);
      g.fillText(kickerText(sc.kicker), x, y); y += 20 * U + fs * 0.78;
      font(g, 500, fs, false, '-0.2px');
      for (const l of wrap(g, sc.text, COMPACT ? c.w : c.w - IN)) { g.fillText(l, x, y); y += fs * 1.2; }
      if (sc.contact) {                                 // 왼쪽: 이메일·전화
        y += 22 * U;
        for (const [lab, val, href] of sc.contact) {
          g.fillRect(x, y - fs * 0.95, Math.min(c.w - IN, 300 * U), 1);
          font(g, 400, 10 * U, true);
          g.fillText(lab, x, y + 8 * U);
          font(g, 500, fs, false, '-0.2px');
          const vx = x + 64 * U, m = g.measureText(val + ' ↗');
          g.fillText(val + ' ↗', vx, y + 8 * U);
          contactRects.push({ x: vx - 4, y: y + 8 * U - fs * 0.9, w: m.width + 8, h: fs * 1.3, href, label: val });
          y += fs * 1.9;
        }
        g.fillRect(x, y - fs * 0.95, Math.min(c.w - IN, 300 * U), 1);
      }
    }
    // 단위 (오른쪽 아래)
    if (z[3] && sc.unit) {
      const c = z[3], fs = (COMPACT ? 22 : 30) * U;
      const ux = COMPACT ? GUT : c.x + IN;
      font(g, 500, fs, false, `${(-0.03 * fs).toFixed(2)}px`);
      g.fillText(sc.unit, ux, c.y + 28 * U);
      font(g, 400, 10 * U, true);
      g.fillText(sc.src.toUpperCase(), ux, c.y + 48 * U);
    }
    drawMicro(sc, i, z, RX);
    blurCopy(cSm, cSmB, gSmB, 2.2, 0.5);
    upload(texTS, cSm); upload(texTSb, cSmB);
  }
  function drawMicro(sc, si, z, RX) {
    const g = gSm;
    font(g, 400, 10 * U, true);
    g.lineWidth = 1;
    if (sc.kind === 'outro') return;
    if (sc.foot && !COMPACT) { g.textAlign = 'right'; g.fillText(sc.foot.toUpperCase(), RX - 40, H - 24 * U); g.textAlign = 'left'; }
    if (!COMPACT) {                                      // 축척 막대
      const sx = RX - 40, sy = H - 46 * U;
      g.fillRect(sx - 60, sy, 60, 1); for (const t of [0, 30, 60]) g.fillRect(sx - 60 + t, sy - 4, 1, 5);
      g.textAlign = 'right'; g.fillText('1 : 1', sx, sy - 8); g.textAlign = 'left';
    }
    if (!sc.shape || !z[0] || sc.kind === 'list') return;
    if (COMPACT && sc.shape === 'bust') return;
    const o = z[0];
    const X0 = Math.max(o.x, FX + 30), Y0 = Math.max(o.y, 60 * U), X1 = Math.min(o.x + o.w, RX - 50), Y1 = Math.min(o.y + o.h, H - 70 * U);
    for (const [px, py] of [[X0, Y0], [X1, Y0], [X0, Y1], [X1, Y1]]) { g.fillRect(px - 5, py, 11, 1); g.fillRect(px, py - 5, 1, 11); }
    const fig = `FIG. ${String(si).padStart(2, '0')} · ${sc.fig.toUpperCase()}`;
    g.fillRect(X0 + 12, Y0 + 10, 5, 5);
    g.fillText(fig, X0 + 22, Y0 + 16);
    if (COMPACT || !sc.tags) return;
    const p = place(si), [ex, ey] = EXT[sc.shape];
    const ow = p.S * ex * (sc.shape === 'bust' ? 0.9 : 1), oh = Math.min(p.S * ey, (Y1 - Y0) / 2);
    const cx = p.cx, cy = sc.shape === 'bust' ? Y0 + (Y1 - Y0) * 0.42 : p.cy;
    sc.tags.forEach((t, j) => {
      const label = `( ${t.toUpperCase()} )`, lw = g.measureText(label).width;
      if (j === 0) {                                     // 첫 표식은 물체 위 (잉크를 뚫고 읽힘)
        const ax = cx + ow * 0.15, ay = cy - oh * 0.2;
        g.beginPath(); g.arc(ax, ay, 4, 0, TAU); g.stroke();
        g.beginPath(); g.moveTo(ax + 3, ay - 3); g.lineTo(ax + 30, ay - 26); g.lineTo(ax + 44, ay - 26); g.stroke();
        g.fillText(label, ax + 48, ay - 22);
        return;
      }
      const side = j === 1 ? 1 : -1, ax = cx + side * ow * 0.55, ay = cy + (j === 1 ? -oh * 0.45 : oh * 0.3);
      let ex2 = cx + side * (ow + 40 * U);
      const ey2 = ay + (j === 1 ? -36 : 36) * U;
      ex2 = Math.min(Math.max(ex2, FX + 40 + lw), RX - 60 - lw);
      g.beginPath(); g.arc(ax, ay, 4, 0, TAU); g.stroke();
      const kx = ax + side * Math.abs(ey2 - ay);
      g.beginPath(); g.moveTo(ax + side * 3, ay + Math.sign(ey2 - ay) * 3); g.lineTo(kx, ey2); g.lineTo(ex2, ey2); g.stroke();
      g.textAlign = side > 0 ? 'left' : 'right'; g.fillText(label, ex2 + side * 4, ey2 + 4); g.textAlign = 'left';
    });
  }

  /* ── 소개 장면의 글자 고리 (한 번만 그림) ─────────────────────────── */
  let ring = { cx: 0, cy: 0, R: 0, half: 1 };
  function drawRing() {
    const sc = SCENES[1], o = zones(1)[0];
    ring.cx = o.x + o.w / 2; ring.cy = o.y + o.h / 2; ring.R = Math.min(o.w, o.h) * 0.5;
    const Rr = ring.R, half = Rr * 1.1 + 14;
    ring.half = half;
    cRing.width = cRing.height = Math.ceil(half * 2 * DPR);
    const g = gRing, c = half;
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.clearRect(0, 0, half * 2, half * 2);
    g.fillStyle = g.strokeStyle = '#fff'; g.lineWidth = 1;
    for (const k of [1.0, 1.06]) { g.beginPath(); g.arc(c, c, Rr * k, 0, TAU); g.stroke(); }
    for (let t = 0; t < 72; t++) {
      const a = t / 72 * TAU, l = t % 6 ? 4 : 9;
      g.beginPath(); g.moveTo(c + Math.cos(a) * Rr * 1.09, c + Math.sin(a) * Rr * 1.09); g.lineTo(c + Math.cos(a) * (Rr * 1.09 + l), c + Math.sin(a) * (Rr * 1.09 + l)); g.stroke();
    }
    font(g, 500, (COMPACT ? 13 : 15) * U);
    let a = -Math.PI * 0.95;
    for (const ch of sc.ringText) {
      const w = g.measureText(ch).width, da = w / (Rr * 0.86);
      g.save(); g.translate(c + Math.cos(a + da / 2) * Rr * 0.86, c + Math.sin(a + da / 2) * Rr * 0.86); g.rotate(a + da / 2 + Math.PI / 2);
      g.fillText(ch, -w / 2, 0); g.restore();
      a += da;
    }
    upload(texRing, cRing);
  }

  /* ── 상단 바 + 점 내비 (UI 판) ─────────────────────────── */
  const head = document.getElementById('head');
  const routeEl = document.getElementById('route');
  const soundBtn = document.getElementById('soundBtn');
  const dotsNav = document.getElementById('dots');
  const dotBtns = SCENES.map((sc, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = sc.route; b.setAttribute('aria-label', sc.route);
    b.addEventListener('click', () => goTo(i));
    dotsNav.appendChild(b);
    return b;
  });
  const dotGeo = () => {
    const gap = 16 * U, x = W - FX - (COMPACT ? 12 : 22 * U);
    const y0 = H / 2 - (SCENES.length - 1) * gap / 2;
    return { x, y0, gap };
  };
  const textRect = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
  function drawUI() {
    const g = gUI;
    resetCanvas(cUI, g);
    if (EXP >= 0) { upload(texUI, cUI); return; }
    font(g, 500, (W < 700 ? 12 : 13 * U), false, '-0.13px');
    g.textBaseline = 'middle';
    for (const el of head.querySelectorAll('#brand, #sep, #soundBtn, #tagline, #route')) {
      if (getComputedStyle(el).display === 'none') continue;
      const r = textRect(el);
      if (!r.width) continue;
      g.fillText(el.textContent, r.left, r.top + r.height / 2 + 0.5);
    }
    g.textBaseline = 'alphabetic';
    const { x, y0, gap } = dotGeo();
    dotBtns.forEach((b, i) => {
      g.beginPath(); g.arc(x, y0 + i * gap, 2 * U, 0, TAU); g.fill();
      b.style.top = `${y0 + i * gap}px`; b.style.left = `${x - 22}px`;
    });
    upload(texUI, cUI);
  }

  /* ── 마우스 흔적 (천천히 마름) ─────────────────────────── */
  let curPt = null, prevPt = null, hoverAwake = 0, moveAmt = 0;
  let mx = 0, my = 0, smx = 0, smy = 0;
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    curPt = { x: e.clientX, y: e.clientY };
    mx = e.clientX / W * 2 - 1; my = e.clientY / H * 2 - 1;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { curPt = prevPt = null; mx = my = 0; });
  function stepHover(dt) {
    let dirty = false;
    if (hoverAwake > 0) {
      hoverAwake -= dt;
      gHov.globalCompositeOperation = 'destination-out';
      gHov.fillStyle = `rgba(0,0,0,${(1 - Math.exp(-dt * 0.35)).toFixed(4)})`;
      gHov.fillRect(0, 0, cHov.width, cHov.height);
      if (hoverAwake <= 0) gHov.clearRect(0, 0, cHov.width, cHov.height);
      dirty = true;
    }
    if (curPt && prevPt) {
      const dx = curPt.x - prevPt.x, dy = curPt.y - prevPt.y, dist = Math.hypot(dx, dy);
      moveAmt = lerp(moveAmt, dist / Math.max(W, H), 0.3);
      if (dist > 0.5) {
        const steps = Math.min(16, Math.max(1, Math.ceil(dist / 9)));
        const r = Math.max(36, H * 0.065) * HS;
        const a = Math.min(0.14 + moveAmt * 9, 0.42) / Math.sqrt(steps);
        gHov.globalCompositeOperation = 'lighter';
        for (let i = 1; i <= steps; i++) {
          const x = (prevPt.x + dx * i / steps) * HS, y = (prevPt.y + dy * i / steps) * HS;
          const grd = gHov.createRadialGradient(x, y, 0, x, y, r);
          grd.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`);
          grd.addColorStop(1, 'rgba(255,255,255,0)');
          gHov.fillStyle = grd;
          gHov.fillRect(x - r, y - r, r * 2, r * 2);
        }
        hoverAwake = 14;
        dirty = true;
      }
    }
    if (curPt) prevPt = { ...curPt };
    gHov.globalCompositeOperation = 'source-over';
    if (dirty) upload(texH, cHov);
  }

  /* ── 효과음 (Web Audio로 직접 합성: 물소리 같은 앰비언트 + 물방울) ─────────────── */
  const Sound = (() => {
    let ctx = null, master = null, on = false;
    function init() {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      const len = ctx.sampleRate * 4, buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {                 // 갈색 잡음 = 멀리서 흐르는 물
        const d = buf.getChannelData(ch); let last = 0;
        for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
      }
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.6;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;
      const lg = ctx.createGain(); lg.gain.value = 220; lfo.connect(lg).connect(lp.frequency);
      const ag = ctx.createGain(); ag.gain.value = 0.22;
      src.connect(lp).connect(ag).connect(master);
      [110, 164.8, 220].forEach((f, i) => {            // 아주 낮게 깔리는 화음
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const gg = ctx.createGain(); gg.gain.value = [0.03, 0.018, 0.01][i];
        const t = ctx.createOscillator(); t.frequency.value = 0.05 + i * 0.03;
        const tg = ctx.createGain(); tg.gain.value = gg.gain.value * 0.6; t.connect(tg).connect(gg.gain);
        o.connect(gg).connect(master); o.start(); t.start();
      });
      src.start(); lfo.start();
    }
    function toggle() {
      if (!ctx) init();
      on = !on;
      if (on && ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setTargetAtTime(on ? 0.9 : 0, t, 0.35);
      return on;
    }
    function drop(f0 = 520, f1 = 180, dur = 0.35, vol = 0.12) {
      if (!on || !ctx) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
    }
    return { toggle, drop, get on() { return on; } };
  })();
  soundBtn.addEventListener('click', () => {
    const on = Sound.toggle();
    soundBtn.textContent = on ? 'Sound on' : 'Sound off';
    soundBtn.setAttribute('aria-pressed', String(on));
    Sound.drop(380, 760, 0.2, 0.09);
    drawUI();
  });
  document.addEventListener('click', (e) => { if (e.target.closest('a, button') && e.target !== soundBtn) Sound.drop(420, 900, 0.18, 0.08); });

  /* ── 글자 위 링크 ─────────────────────────── */
  const hitsEl = document.getElementById('hits');
  const pool = [];
  function setHits(rects) {
    while (pool.length < rects.length) {
      const a = document.createElement('a');
      a.className = 'hit';
      a.addEventListener('pointerenter', () => Sound.drop(900, 620, 0.12, 0.05));
      hitsEl.appendChild(a); pool.push(a);
    }
    pool.forEach((a, k) => {
      const r = rects[k];
      if (!r) { a.hidden = true; return; }
      a.hidden = false;
      a.href = r.href; a.textContent = r.label; a.setAttribute('aria-label', r.label);
      a.style.width = `${r.w}px`; a.style.height = `${r.h}px`;
      a.style.transform = `translate(${r.x}px, ${r.y}px)`;
      a.dataset.y = r.y;
    });
  }
  function shiftHits(dy) { for (const a of pool) if (!a.hidden) a.style.transform = a.style.transform.replace(/,\s*[-\d.]+px\)$/, `, ${(+a.dataset.y - dy).toFixed(1)}px)`); }

  /* ── 스크롤 (장면마다 머무는 길이 + 화면 하나 길이의 전환) ─────────────────────────── */
  // 새로고침해도 항상 첫 장면부터 (브라우저가 이전 스크롤 위치를 되살리지 않게)
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);
  let lenis = null;
  if (!REDUCED && window.Lenis) lenis = new window.Lenis({ duration: 1.2, smoothWheel: true });
  const scrollY = () => (lenis ? lenis.scroll : scrollY0());
  const scrollY0 = () => window.scrollY;
  let starts = [];
  const spacer = document.getElementById('spacer');
  function layoutScroll() {
    starts = []; let y = 0;
    SCENES.forEach((sc, i) => { starts.push(y); y += (sc.hold + (i < LAST ? 1 : 0)) * H; });
    spacer.style.height = `${y + H}px`;
  }
  function goTo(i) {
    const y = starts[i] ?? 0;
    if (lenis) lenis.scrollTo(y, { duration: 1.6 }); else scrollTo({ top: y, behavior: REDUCED ? 'auto' : 'smooth' });
  }
  document.querySelectorAll('[data-go]').forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); goTo(+el.dataset.go); }));

  /* ── 크기 ─────────────────────────── */
  const outro = document.getElementById('outro');
  const credit = document.getElementById('credit');
  let shown = -1, listQ = null;
  function resize() {
    frameCalc();
    zoneCache = [];
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    fbW = Math.max(1, Math.round(canvas.width * 0.5)); fbH = Math.max(1, Math.round(canvas.height * 0.5));
    gl.bindTexture(gl.TEXTURE_2D, fieldTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fbW, fbH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fieldTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    HS = 0.2;
    cHov.width = Math.max(1, Math.round(W * HS)); cHov.height = Math.max(1, Math.round(H * HS));
    gHov.clearRect(0, 0, cHov.width, cHov.height); upload(texH, cHov);
    const sp = place(2);
    if (sp) { shard.cx = sp.cx; shard.cy = sp.cy; shard.rx = sp.S * EXT.shard[0]; shard.ry = sp.S * EXT.shard[1]; }
    layoutScroll();
    drawRing();
    drawUI();
    if (shown >= 0) { drawBig(shown, listQ ?? 0); drawSmall(shown); refreshHits(); }
    placeCredit();
  }
  function placeCredit() {
    outro.style.setProperty('--human-h', `${humanH}px`);
    const last = outro.querySelector('.cols > div:last-child');
    if (W > 1000 && last) {
      const r = last.getBoundingClientRect();
      credit.style.left = `${r.left + parseFloat(getComputedStyle(last).paddingLeft)}px`;
      credit.style.top = `${H * 0.17}px`;
    } else { credit.style.left = ''; credit.style.top = ''; }
  }
  let rT = 0;
  addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(resize, 120); });

  /* ── 점 좌표 계산 ─────────────────────────── */
  const rotState = { y: 0, x: 0 };
  /* 레퍼런스와 같은 움직임 (단위 좌표 기준)
     · 점마다 ±0.01씩 계속 움찔거림
     · 흉상: 점 5%가 머리 뒤·위로 천천히 날아가며 작은 물방울로 떨어져 나갔다가 다시 돌아옴 (약 16초 주기)
     · 원근: 카메라 거리 4 → 고개를 돌릴 때 입체감 */
  /* 소개 장면 먼지 덩어리 같은 질감: 이웃한 점끼리 같은 방향으로 들쭉날쭉 밀려서 가장자리가 찢어진 레이스처럼,
     일부(12%)는 바깥으로 튀어 작은 물방울 무리가 됨 */
  const SPLASH = {};
  function splashOf(shape) {
    if (SPLASH[shape]) return SPLASH[shape];
    const P = SHAPES[shape], a = new Float32Array(N * 3), r = rng(77);
    if (shape === 'cloud') return (SPLASH[shape] = a);
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i < N; i++) { cx += P[i * 3]; cy += P[i * 3 + 1]; cz += P[i * 3 + 2]; }
    cx /= N; cy /= N; cz /= N;
    const B = shape === 'bust';                       // 사람은 윤곽이 읽히도록 훨씬 약하게
    const amp = B ? 0.014 : 0.085;
    const gap = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      // 덩어리 단위로 같이 움직이는 노이즈 (주파수 ~7)
      const nx = Math.sin(x * 7.3 + y * 3.1 + 1.7) * Math.sin(z * 6.1 - y * 4.3);
      const ny = Math.sin(y * 7.9 - z * 2.7 + 4.1) * Math.sin(x * 5.3 + z * 3.9);
      const nz = Math.sin(z * 7.1 + x * 3.7 + 2.9) * Math.sin(y * 6.7 - x * 2.1);
      let ox = nx * amp, oy = ny * amp, oz = nz * amp;
      // 군데군데 비어 있는 틈 (먼지 덩어리 속 구멍처럼)
      const g = Math.sin(x * 9.1 + z * 4.3 + 0.7) * Math.sin(y * 8.3 - x * 3.3 + 2.1) * Math.sin(z * 7.7 + y * 2.9);
      if (B ? (g > 0.7 && r() < 0.5) : (g > 0.22 || r() < 0.6)) gap[i] = 1;
      if (r() < (B ? 0.015 : 0.16)) {                                // 튀어 나간 물방울
        let dx = x - cx, dy = y - cy, dz = z - cz; const l = Math.hypot(dx, dy, dz) || 1;
        dx /= l; dy /= l; dz /= l;
        const m = 0.04 + Math.pow(r(), 2) * 0.26;
        ox += dx * m + (r() - 0.5) * 0.04; oy += dy * m + (r() - 0.5) * 0.04; oz += dz * m;
      }
      a[i * 3] = ox; a[i * 3 + 1] = oy; a[i * 3 + 2] = oz;
    }
    a.gap = gap;
    return (SPLASH[shape] = a);
  }
  function project(pl, time, out, rot, drift = 0) {
    const P = SHAPES[pl.shape], K = SPECK[pl.shape], SP = splashOf(pl.shape);
    const cy = Math.cos(rot.y), sy = Math.sin(rot.y), cx = Math.cos(rot.x), sx = Math.sin(rot.x);
    const rad = RADF[pl.shape] * pl.S;
    const t = REDUCED ? 0 : time, wob = REDUCED ? 0 : 0.01;
    for (let i = 0; i < N; i++) {
      const o = i * 3, r = delay[i];
      let x = P[o] + SP[o] + Math.sin(t * 0.9 + r * 40) * wob;
      let y = P[o + 1] + SP[o + 1] + Math.cos(t * 0.7 + r * 30) * wob;
      const z = P[o + 2] + SP[o + 2];
      if (drift > 0 && r > 0.95) {                       // 머리에서 날려 가는 먼지 물방울
        const ph = ((t * 0.06 + r * 37) % 1 + 1) % 1;
        x += ph * ph * 1.6 * drift;
        y -= (ph * 0.6 + Math.sin(ph * 6 + r * 90) * 0.1) * drift;
      }
      const x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
      const y2 = y * cx + z1 * sx, z2 = -y * sx + z1 * cx;
      const persp = 4 / (4 - z2);
      out[i * 4] = pl.cx + x1 * pl.S * persp;
      out[i * 4 + 1] = pl.cy + y2 * pl.S * persp;
      out[i * 4 + 2] = (SP.gap && SP.gap[i] ? 0 : K[i] ? rad * 1.15 : rad) * persp;
      out[i * 4 + 3] = K[i];
    }
  }
  /* 커서가 물체를 쓸고 지나가면: 닿은 자리 조각들이 커서 방향으로 끌려가며 찢어졌다가, 스프링처럼 천천히 제자리로 */
  const tearX = new Float32Array(N), tearY = new Float32Array(N), tvX = new Float32Array(N), tvY = new Float32Array(N);
  const PATCH = {};
  const patchOf = (shape) => PATCH[shape] || (PATCH[shape] = (() => {
    const P = SHAPES[shape], a = new Float32Array(N);
    for (let i = 0; i < N; i++) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; a[i] = Math.sin(x * 13.1 + Math.sin(y * 9.7) * 2) * Math.sin(z * 11.3 + y * 7.1); }
    return a;
  })());
  let tearAlive = false, tearShape = null, tPrev = null, cvx = 0, cvy = 0, tearSpeed = 0;
  function stepTear(pl, buf, dt, on) {
    if (pl.shape !== tearShape) { tearShape = pl.shape; tearX.fill(0); tearY.fill(0); tvX.fill(0); tvY.fill(0); tearAlive = false; }
    let vx = 0, vy = 0;
    if (curPt && tPrev) { vx = curPt.x - tPrev.x; vy = curPt.y - tPrev.y; }
    tPrev = curPt ? { ...curPt } : null;
    const sp = Math.hypot(vx, vy);
    tearSpeed = lerp(tearSpeed, sp, 0.35);
    if (sp > 0.5) { cvx = lerp(cvx, vx / sp, 0.3); cvy = lerp(cvy, vy / sp, 0.3); }
    const tearOn = !REDUCED && on && curPt && tearSpeed > 1.2;
    if (!tearOn && !tearAlive) return;
    const TR = H * 0.085, cl = Math.hypot(cvx, cvy) + 1e-4, dx0 = cvx / cl, dy0 = cvy / cl;
    const pow = Math.min(tearSpeed, 40) * 18;
    const damp = Math.exp(-dt * 1.3), k = 0.45 * dt * 1.6;
    const PT = patchOf(pl.shape);
    let energy = 0;
    for (let i = 0; i < N; i++) {
      const o = i * 4;
      if (tearOn) {
        const dx = buf[o] - curPt.x, dy = buf[o + 1] - curPt.y, d2 = dx * dx + dy * dy;
        if (d2 < TR * TR && PT[i] > 0) {
          const d = Math.sqrt(d2) + 1e-4, f = 1 - d / TR, kk = f * f * pow * Math.min(PT[i] * 4, 1);
          tvX[i] += ((dx / d) * 0.35 + dx0 * 0.9) * kk;
          tvY[i] += ((dy / d) * 0.35 + dy0 * 0.9) * kk;
        }
      }
      tvX[i] = tvX[i] * damp - tearX[i] * k; tearX[i] += tvX[i] * dt;
      tvY[i] = tvY[i] * damp - tearY[i] * k; tearY[i] += tvY[i] * dt;
      buf[o] += tearX[i]; buf[o + 1] += tearY[i];
      energy += Math.abs(tearX[i]) + Math.abs(tearY[i]);
    }
    tearAlive = tearOn || energy > N * 0.02;
    if (!tearAlive) { tearX.fill(0); tearY.fill(0); tvX.fill(0); tvY.fill(0); }
  }
  function rotFor(pl, time) {
    if (pl.shape === 'bust') return { y: -0.75 * pl.face + (REDUCED ? 0 : Math.sin(time * 0.2) * 0.15) + smx * 0.35, x: smy * 0.1 };
    return { y: time * 0.12 + smx * 0.35, x: smy * 0.1 + 0.25 };
  }
  const bufA = new Float32Array(N * 4), bufB = new Float32Array(N * 4);

  /* ── 루프 ─────────────────────────── */
  let t0 = -1, last = 0, ready = false, lastK = -1, navY = null;

  function frame(now) {
    requestAnimationFrame(frame);
    if (lenis) lenis.raf(now);
    if (!ready) return;
    const time = now / 1000;
    if (t0 < 0) { t0 = time; last = time; }
    const dt = Math.min(time - last, 0.05); last = time;
    smx = lerp(smx, mx, 0.06); smy = lerp(smy, my, 0.06);

    // 지금 장면 k, 다음 장면으로 넘어가는 정도 f
    const y = scrollY();
    let k = 0;
    for (let i = 0; i < starts.length; i++) if (y >= starts[i] - 0.5) k = i;
    const s = (y - starts[k]) / H;
    const hold = SCENES[k].hold;
    const f = k < LAST ? clamp(s - hold, 0, 1) : 0;
    const hp = clamp(s / Math.max(hold, 0.001));
    const show = f < 0.5 ? k : k + 1;

    // 처음 들어올 때: 물체가 모이고 글자가 맺힘
    const intro = REDUCED || EXP >= 0 ? 1 : clamp((time - t0 - 0.2) / 2.0);
    const introMelt = REDUCED ? 0 : 1 - ss(0.25, 0.95, intro);

    // 글자 녹기(나갈 때) / 맺히기(들어올 때)
    let melt = f < 0.5 ? ss(0, 0.3, f) : 1 - ss(0.6, 0.95, f);
    melt = Math.max(melt, introMelt);
    if (EXP >= 0) melt = 1;

    // 장면이 바뀌면 글자판 다시 그림
    const sc = SCENES[show];
    let listSlide = 0;
    if (sc.kind === 'list') listSlide = (show === k ? hp : 0) * listGeo().travel;
    if (show !== shown) {
      shown = show;
      routeEl.textContent = sc.route;
      listQ = null;
      drawBig(show, listSlide); drawSmall(show); drawUI();
      if (show === LAST) placeCredit();
      if (show === 2) listQ = listSlide;
      refreshHits();
      if (lastK >= 0) Sound.drop(300, 90, 0.6, 0.1);
      lastK = show;
    }
    // 작업 목록: 한 줄의 1/4씩 다시 그리고, 나머지는 셰이더가 밀어 올림
    let offB = 0;
    if (sc.kind === 'list') {
      const step = listGeo().pitch * 0.25;
      const q = Math.floor(listSlide / step) * step;
      if (listQ === null || Math.abs(q - listQ) > 0.5) { listQ = q; drawBig(show, q); refreshHits(); }
      offB = listSlide - listQ;
      shiftHits(offB);
    }
    // 링크 켜기/끄기
    const linkOn = melt < 0.3;
    if (linkOn !== hitsEl.classList.contains('on')) { hitsEl.classList.toggle('on', linkOn); hitsEl.style.visibility = linkOn ? '' : 'hidden'; }
    // 마지막 화면 DOM
    const oa = show === LAST ? clamp(1 - melt * 3) : 0;
    outro.style.opacity = oa.toFixed(3);
    outro.style.visibility = oa > 0.01 ? 'visible' : 'hidden';

    stepHover(dt);

    // 물체
    const pA = place(k), pB = k < LAST ? place(k + 1) : null;
    let objA = 0, count = N;
    if (pA) {
      const rA = rotFor(pA, time);
      const driftA = pA.shape === 'bust' ? 1 - ss(0, 0.4, f) : 0;
      project(pA, time, bufA, rA, intro < 1 ? 0 : driftA);
      stepTear(pA, bufA, dt, f < 0.15 && intro >= 1);
      objA = 1;
      if (f > 0) {
        const mT = ss(0.18, 0.88, f);
        if (pB) project(pB, time, bufB, rotFor(pB, time), 0);
        const spread = pA.S * 0.35;
        for (let i = 0; i < N; i++) {
          const e = ss(0, 1, mT * 1.5 - delay[i] * 0.5), o = i * 4, b = Math.sin(Math.PI * e) * spread;
          if (pB) {
            ptData[o] = lerp(bufA[o], bufB[o], e) + dirX[i] * b;
            ptData[o + 1] = lerp(bufA[o + 1], bufB[o + 1], e) + dirY[i] * b;
            ptData[o + 2] = lerp(bufA[o + 2], bufB[o + 2], e) * (1 + Math.sin(Math.PI * e) * 0.6);
          } else {                                        // 마지막: 바닥으로 녹아 사라짐
            ptData[o] = bufA[o] + dirX[i] * b * 0.6;
            ptData[o + 1] = bufA[o + 1] + e * H * 0.25 + dirY[i] * b * 0.4;
            ptData[o + 2] = bufA[o + 2] * (1 - e);
          }
          ptData[o + 3] = bufA[o + 3];
        }
      } else if (intro < 1) {                           // 첫 화면: 흩어진 물방울이 흉상으로 모임
        for (let i = 0; i < N; i++) {
          const e = easeOut(clamp(intro * 1.6 - delay[i] * 0.6)), o = i * 4, b = (1 - e) * pA.S * 0.9;
          ptData[o] = bufA[o] + dirX[i] * b; ptData[o + 1] = bufA[o + 1] + dirY[i] * b;
          ptData[o + 2] = bufA[o + 2] * (0.4 + 0.6 * e); ptData[o + 3] = bufA[o + 3];
        }
      } else ptData.set(bufA);
    } else count = 0;

    // 바탕 번짐
    const fl = ss(0.12, 0.62, f) * 2.4;
    const org = pA ? [pA.cx / W, 1 - clamp(pA.cy, 0, H) / H] : [0.5, 0.5];

    // 점 내비 방울
    const dg = dotGeo();
    const ny = dg.y0 + (k + ss(0.3, 0.7, f)) * dg.gap;
    navY = navY == null ? ny : lerp(navY, ny, 0.2);

    // 글자 고리
    const ringA = show === 1 ? (EXP >= 0 ? 1 : 1 - melt) : 0;
    const ringRot = (show === 1 && show === k ? s : 0) * 0.9 + time * 0.02;

    /* 그리기 */
    if (count) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, fbW, fbH);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(pPoint);
      gl.uniform2f(UP.uView, W, H); gl.uniform1f(UP.uPx, fbW / W); gl.uniform1f(UP.uMax, maxPoint);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufPts);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, ptData);
      gl.enableVertexAttribArray(aP);
      gl.vertexAttribPointer(aP, 4, gl.FLOAT, false, 0, 0);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, count);
      gl.disable(gl.BLEND);
      gl.disableVertexAttribArray(aP);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(pComp);
    const texs = [[fieldTex, 'uF'], [texTB, 'uTB'], [texTBb, 'uTBb'], [texTS, 'uTS'], [texTSb, 'uTSb'], [texH, 'uH'], [texUI, 'uUI'], [texGrain, 'uGrain'], [texRing, 'uRing']];
    texs.forEach(([t, n], u) => { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(UC[n], u); });
    gl.uniform2f(UC.uRes, W, H);
    gl.uniform2f(UC.uFbPx, 1 / fbW, 1 / fbH);
    gl.uniform2f(UC.uO, org[0], org[1]);
    gl.uniform3fv(UC.uBlue, BLUE);
    gl.uniform3f(UC.uDrop, dg.x, navY, EXP >= 0 ? 0 : 4.5 * U);
    gl.uniform4f(UC.uRingP, ring.cx, ring.cy, ring.half, ringA);
    gl.uniform1f(UC.uGA, SCENES[k].ground);
    gl.uniform1f(UC.uGB, k < LAST ? SCENES[k + 1].ground : SCENES[k].ground);
    gl.uniform1f(UC.uR, fl);
    gl.uniform1f(UC.uAsp, W / H);
    gl.uniform1f(UC.uTime, time);
    gl.uniform1f(UC.uMeltB, melt);
    gl.uniform1f(UC.uMeltS, melt);
    gl.uniform1f(UC.uOffB, offB);
    gl.uniform1f(UC.uRingRot, ringRot);
    gl.uniform1f(UC.uScuff, 2.0);
    gl.uniform1f(UC.uObjA, objA);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufQuad);
    gl.enableVertexAttribArray(aQ);
    gl.vertexAttribPointer(aQ, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disableVertexAttribArray(aQ);
  }

  function refreshHits() {
    const sc = SCENES[shown];
    if (!sc) return;
    if (sc.kind === 'list') setHits(listRects);
    else if (sc.contact) setHits(contactRects);
    else setHits([]);
  }

  /* ── 시작: 글꼴 + 흉상 점 데이터 ─────────────────────────── */
  const fontsReady = document.fonts && document.fonts.load
    ? Promise.all([
      document.fonts.load('500 100px "Inter Tight"'), document.fonts.load('400 11px "JetBrains Mono"'),
      document.fonts.load('500 100px "Pretendard Variable"', '가나다열나요'),
    ]).catch(() => {})
    : Promise.resolve();
  const bustReady = fetch('points/bust.bin').then((r) => r.arrayBuffer()).then((b) => { SHAPES.bust = new Float32Array(b).slice(0, N * 3); SPECK.bust = makeSpecks(SHAPES.bust, 7, 0.02, 0.05, 33); });
  Promise.all([fontsReady, bustReady]).then(() => {
    resize();
    if (EXP >= 0) { window.scrollTo(0, starts[EXP] || 0); lenis && lenis.scrollTo(starts[EXP] || 0, { immediate: true }); }
    ready = true;
  }).catch((err) => console.error('[plastic] load failed', err));
  requestAnimationFrame(frame);
})();
