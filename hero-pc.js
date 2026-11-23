/*
  히어로 3D 레트로 컴퓨터 (Three.js)
  - 마우스를 따라 몸체가 기울어짐 + 둥실 떠 있는 움직임
  - 키보드 버튼 3개: ◀ / OK / ▶  → 화면 넘기기, OK는 해당 섹션으로 이동
  - 옆 다이얼: 화면 색 바꾸기 / 몸체 클릭: 폴짝 뛰며 웃는 얼굴
  - 화면은 캔버스에 픽셀 글꼴(Galmuri11)로 그려 텍스처로 씌움
*/
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// 효과음 (sfx.js) — 없으면 조용히 넘어감
const sfx = (name) => window.sfx?.play(name);
const wrap = document.getElementById("heroPc");
const canvas = document.getElementById("heroPcCanvas");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
// 픽셀 글꼴을 먼저 받아 둬야 화면·이름표·버튼 글자가 제대로 그려짐
await Promise.all([document.fonts.load("12px Galmuri11"), document.fonts.load("24px Galmuri11")]);

/* ---------- 색 (사이트 팔레트) ---------- */
const C = {
  blue: "#350aff", lime: "#bcf015", ink: "#1e1e1e",
  cream: "#efece4", dark: "#2b2a3a", key: "#f4f4f1",
};

/* ---------- 렌더러 · 장면 · 카메라 ---------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (e) {
  wrap.classList.add("is-fallback"); // WebGL이 안 되면 숨김
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 100);
camera.position.set(0, 5.6, 13); // = CAM0 (아래 스크롤 연출에서 사용)
const LOOK = new THREE.Vector3(0, 1.3, 0.9);
camera.lookAt(LOOK);

scene.add(new THREE.HemisphereLight(0xffffff, 0xb9bdd0, 1.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.9);
sun.position.set(-4, 6, 7);
scene.add(sun);

/* 만화 느낌 음영: 3단계 그라데이션 */
const toonGrad = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
toonGrad.minFilter = toonGrad.magFilter = THREE.NearestFilter;
toonGrad.needsUpdate = true;
const toon = (hex) => new THREE.MeshToonMaterial({ color: hex, gradientMap: toonGrad });

/* 외곽선: 뒤집은 껍데기를 살짝 크게 */
const lineMat = new THREE.MeshBasicMaterial({ color: C.ink, side: THREE.BackSide });
function outline(mesh, t = 0.028) {
  mesh.geometry.computeBoundingBox();
  const s = new THREE.Vector3();
  mesh.geometry.boundingBox.getSize(s);
  const hull = new THREE.Mesh(mesh.geometry, lineMat);
  hull.scale.set(1 + (2 * t) / s.x, 1 + (2 * t) / s.y, 1 + (2 * t) / s.z);
  hull.raycast = () => {}; // 클릭 판정에서 제외
  mesh.add(hull);
  return mesh;
}
function box(w, h, d, r, color, pos) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), toon(color));
  m.position.set(...pos);
  return outline(m);
}

/* ---------- 구조: root(마우스 기울기·둥실) > bounce(눌림·점프) > 부품 ---------- */
const root = new THREE.Group();
const bounce = new THREE.Group();
root.add(bounce);
scene.add(root);
const BASE_YAW = -0.42; // 비스듬한 3/4 시점

// 바닥판 · 모니터 몸체 · 화면 테두리 · 키보드 받침
bounce.add(box(2.8, 0.18, 2.9, 0.06, C.dark, [0, 0.09, 0.3]));
const body = box(2.5, 2.3, 1.7, 0.16, C.cream, [0, 1.33, -0.25]);
bounce.add(body);
bounce.add(box(2.02, 1.54, 0.12, 0.05, C.dark, [0, 1.55, 0.62]));
bounce.add(box(2.5, 0.34, 1.0, 0.08, C.cream, [0, 0.35, 1.12]));

// 옆면 통풍구
for (let i = 0; i < 5; i++) {
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.95), toon(C.dark));
  v.position.set(1.255, 2.15 - i * 0.14, -0.25);
  bounce.add(v);
}

// 옆면 다이얼 (클릭 → 화면 색 바꾸기)
const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 8), toon(C.lime));
knob.rotation.z = Math.PI / 2;
knob.position.set(1.3, 1.0, 0.15);
outline(knob, 0.025);
bounce.add(knob);

// 전원 LED
const led = new THREE.Mesh(
  new THREE.BoxGeometry(0.1, 0.06, 0.03),
  new THREE.MeshBasicMaterial({ color: C.lime }),
);
led.position.set(1.0, 0.35, 1.635);
bounce.add(led);

// 디스크 넣는 칸
bounce.add(box(0.62, 0.07, 0.04, 0.02, C.dark, [0.5, 0.35, 1.625]));

// 이름표
function textTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}
const plate = new THREE.Mesh(
  new THREE.PlaneGeometry(0.96, 0.12),
  new THREE.MeshBasicMaterial({
    transparent: true,
    map: textTexture(192, 24, (ctx) => {
      ctx.fillStyle = C.ink;
      ctx.font = "12px Galmuri11";
      ctx.textBaseline = "middle";
      ctx.fillText("PORTFOLIO-95", 2, 12);
    }),
  }),
);
plate.position.set(-0.6, 0.35, 1.625);
bounce.add(plate);

/* ---------- 키보드 버튼 3개 ---------- */
function keyLabel(kind, fg) {
  return textTexture(64, 64, (ctx) => {
    ctx.fillStyle = fg;
    if (kind === "ok") {
      ctx.font = "24px Galmuri11";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("OK", 32, 33);
    } else {
      // 화살표 (←, →): 삼각형 머리 + 몸통
      if (kind === "next") { ctx.translate(64, 0); ctx.scale(-1, 1); }
      ctx.beginPath();
      ctx.moveTo(8, 32); ctx.lineTo(30, 12); ctx.lineTo(30, 52); ctx.closePath();
      ctx.fill();
      ctx.fillRect(28, 25, 28, 14);
    }
  });
}
const KEYS = [
  { kind: "prev", color: C.blue, fg: "#ffffff", x: -0.8, label: "이전 화면" },
  { kind: "ok", color: C.lime, fg: C.ink, x: 0, label: "선택" },
  { kind: "next", color: C.key, fg: C.ink, x: 0.8, label: "다음 화면" },
];
const KEY_Y = 0.63;
const keyMeshes = KEYS.map((k) => {
  const m = box(0.64, 0.2, 0.56, 0.06, k.color, [k.x, KEY_Y, 1.12]);
  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.42),
    new THREE.MeshBasicMaterial({ map: keyLabel(k.kind, k.fg), transparent: true }),
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.101;
  top.raycast = () => {};
  m.add(top);
  m.userData = { ...k, y0: KEY_Y };
  bounce.add(m);
  return m;
});

/* ---------- 화면 (캔버스 → 텍스처) ---------- */
const SW = 240, SH = 180; // 4:3, 픽셀 글꼴 실제 크기로 그린 뒤 확대
const scr = document.createElement("canvas");
scr.width = SW; scr.height = SH;
const g = scr.getContext("2d");
const scrTex = new THREE.CanvasTexture(scr);
scrTex.colorSpace = THREE.SRGBColorSpace;
scrTex.magFilter = THREE.NearestFilter;
scrTex.minFilter = THREE.LinearFilter;
scrTex.generateMipmaps = false;
const screen = new THREE.Mesh(
  new THREE.PlaneGeometry(1.78, 1.335),
  new THREE.MeshBasicMaterial({ map: scrTex }),
);
screen.position.set(0, 1.55, 0.685);
bounce.add(screen);

const THEMES = [
  { bg: "#0d0b26", fg: C.lime, sub: "#9a8cff", dim: "#6d6a8c", txt: "#e9e8f2" },
  { bg: C.blue, fg: "#ffffff", sub: C.lime, dim: "#a99bff", txt: "#f0f0f0" },
];
let theme = 0;

const PAGES = [
  { title: "HELLO", lines: ["열나요, Piccha,", "베베드피노를", "설계했어요"], ok: "smile" },
  { title: "ABOUT", lines: ["작은 불편에서", "출발해, 쓰기 좋은", "화면을 만들어요."], ok: "#intro" },
  { title: "WORKS", lines: ["앞에 놓인 디스크를", "눌러서 꽂아 보세요.", "작업이 화면에 떠요."], ok: "#works" },
  { title: "CONTACT", lines: ["같이 이야기", "나눠 볼까요?", "OK → 연락하기"], ok: "#contact" },
];
let page = 0;
let mode = "page"; // page | smile | noise | go
let blink = true;

const SMILE = [
  "..XXXXXX..",
  ".X......X.",
  "X..X..X..X",
  "X..X..X..X",
  "X........X",
  "X.X....X.X",
  "X..XXXX..X",
  ".X......X.",
  "..XXXXXX..",
];

function drawScreen() {
  const T = THEMES[theme];
  g.fillStyle = T.bg;
  g.fillRect(0, 0, SW, SH);
  g.textBaseline = "top";

  // 스크롤로 화면에 다가가는 마지막 구간: 다음 섹션과 같은 파란 단색 (이음새 없이 넘어가도록)
  if (mode === "blank") { scrTex.needsUpdate = true; return; }

  if (mode === "noise") {
    for (let y = 0; y < SH; y += 3)
      for (let x = 0; x < SW; x += 3) {
        if (Math.random() < 0.45) {
          g.fillStyle = Math.random() < 0.5 ? T.fg : T.dim;
          g.fillRect(x, y, 3, 3);
        }
      }
  } else if (mode === "smile") {
    g.fillStyle = T.fg;
    SMILE.forEach((row, r) =>
      [...row].forEach((ch, c) => ch === "X" && g.fillRect(90 + c * 6, 34 + r * 6, 6, 6)),
    );
    g.font = "12px Galmuri11";
    g.textAlign = "center";
    g.fillStyle = T.txt;
    g.fillText("반가워요!", SW / 2, 106);
    g.textAlign = "left";
  } else if (mode === "load") {
    g.font = "12px Galmuri11";
    g.fillStyle = T.sub;
    g.fillText("A:\\>", 12, 12);
    g.fillStyle = T.txt;
    g.fillText("디스크 읽는 중...", 12, 70);
    g.strokeStyle = T.fg;
    g.strokeRect(12.5, 92.5, 215, 15);
    g.fillStyle = T.fg;
    const n = Math.min(1, loadP) * 26 | 0; // 칸칸이 차오르는 막대
    for (let i = 0; i < n; i++) g.fillRect(16 + i * 8, 96, 6, 9);
  } else if (mode === "disk") {
    drawDisk(T);
  } else if (mode === "go") {
    g.font = "12px Galmuri11";
    g.fillStyle = T.sub;
    g.fillText("C:\\PORTFOLIO>", 12, 12);
    g.font = "24px Galmuri11";
    g.fillStyle = T.fg;
    g.fillText("이동 중" + ".".repeat((Date.now() / 250) % 4 | 0), 12, 70);
  } else {
    const P = PAGES[page];
    g.font = "12px Galmuri11";
    g.fillStyle = T.sub;
    g.fillText("C:\\PORTFOLIO>", 12, 12);
    g.font = "24px Galmuri11";
    g.fillStyle = T.fg;
    g.fillText(P.title, 12, 34);
    g.font = "12px Galmuri11";
    g.fillStyle = T.txt;
    P.lines.forEach((l, i) => g.fillText(l, 12, 72 + i * 18));
    if (blink) {
      g.fillStyle = T.fg;
      g.fillRect(12, 128, 8, 12);
    }
    // 아래: 쪽 표시 + 도움말
    g.fillStyle = T.dim;
    g.fillText("◀ ▶ 넘기기 · OK 선택", 12, 156);
    PAGES.forEach((_, i) => {
      g.fillStyle = i === page ? T.fg : T.dim;
      g.fillRect(SW - 12 - (PAGES.length - i) * 10, 160, 6, 6);
    });
  }
  // 주사선
  g.fillStyle = "rgba(0,0,0,0.22)";
  for (let y = 0; y < SH; y += 3) g.fillRect(0, y, SW, 1);
  scrTex.needsUpdate = true;
}

let noiseTimer, smileTimer;
function glitchTo(fn) {
  clearTimeout(noiseTimer);
  const prev = mode === "noise" ? "page" : mode; // 지지직 뒤엔 원래 화면으로 (fn이 바꾸면 그걸로)
  mode = "noise";
  drawScreen();
  noiseTimer = setTimeout(() => { mode = prev; fn(); drawScreen(); }, reduce ? 0 : 140);
}

/* ---------- 동작 ---------- */
function pressKey(m) {
  gsap.killTweensOf(m.position);
  m.position.y = m.userData.y0;
  gsap.to(m.position, { y: m.userData.y0 - 0.08, duration: 0.07, yoyo: true, repeat: 1, ease: "power1.inOut" });
  sfx("key");
  gsap.fromTo(bounce.position, { y: -0.03 }, { y: 0, duration: 0.5, ease: "elastic.out(1, 0.4)" });

  const k = m.userData.kind;
  // 디스크 화면에서 OK → 상세페이지로 / 준비 중이면 화면만 흔들기
  if (k === "ok" && (mode === "disk" || mode === "load")) {
    if (mode === "load") return;
    if (!diskNow.href) {
      sfx("error");
      gsap.fromTo(screen.position, { x: -0.03 }, { x: 0, duration: 0.4, ease: "elastic.out(1, 0.3)" });
      return;
    }
    glitchTo(() => { mode = "go"; });
    setTimeout(() => { location.href = diskNow.href; }, 500);
    return;
  }
  if (k === "prev" || k === "next") {
    clearTimeout(smileTimer);
    clearInterval(loadTimer);
    if (inserted) ejectCurrent(); // 디스크가 꽂혀 있으면 빼고 기본 화면으로
    glitchTo(() => {
      mode = "page";
      page = (page + (k === "next" ? 1 : -1) + PAGES.length) % PAGES.length;
    });
  } else {
    const target = PAGES[page].ok;
    if (target === "smile") return smile();
    glitchTo(() => { mode = "go"; });
    setTimeout(() => {
      const el = document.querySelector(target);
      if (el && typeof lenis !== "undefined") lenis.scrollTo(el, { duration: 1.4 });
      else el?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => { mode = "page"; drawScreen(); }, 900);
    }, 450);
  }
}

function smile() {
  clearTimeout(smileTimer);
  glitchTo(() => { mode = "smile"; });
  smileTimer = setTimeout(() => glitchTo(() => { mode = "page"; }), 1600);
}

function hop() {
  sfx("hop");
  if (reduce) return smile();
  gsap.killTweensOf(bounce.position);
  gsap.killTweensOf(bounce.scale);
  gsap.timeline()
    .to(bounce.scale, { x: 1.05, y: 0.92, z: 1.05, duration: 0.1, ease: "power2.out" })
    .to(bounce.scale, { x: 0.97, y: 1.06, z: 0.97, duration: 0.14 })
    .to(bounce.position, { y: 0.45, duration: 0.22, ease: "power2.out" }, "<")
    .to(bounce.position, { y: 0, duration: 0.3, ease: "bounce.out" })
    .to(bounce.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: "elastic.out(1, 0.5)" }, "<");
  smile();
}

function turnKnob() {
  sfx("click");
  gsap.to(knob.rotation, { x: knob.rotation.x + Math.PI / 2, duration: 0.35, ease: "back.out(2)" });
  glitchTo(() => { theme = (theme + 1) % THEMES.length; });
}

/* ---------- 플로피디스크 3장: 누르면 컴퓨터 디스크 칸에 꽂히고, 화면에 작업이 뜸 ---------- */
const SLOT = { x: 0.5, y: 0.35, zOut: 2.05, zIn: 1.44 }; // 디스크 칸(키보드 받침 앞면) 위치
const DISKS = [
  { id: "yeolnayo", name: "열나요", sub: "아이 발열 기록 앱", tag: "UX/UI · APP", color: "#ff554a",
    href: "work-yeolnayo-v2.html", thumb: "images/work-thumb-yeolnayo.jpg", home: [-0.9, 2.4, 0.3] },
  { id: "piccha", name: "Piccha", sub: "가챠 플랫폼 앱", tag: "UX/UI · APP", color: "#f32e7c",
    href: "work-piccha.html", thumb: "images/work-thumb-piccha.jpg", home: [0.02, 2.55, -0.1] },
  { id: "bebedepino", name: "베베드피노", sub: "브랜드 웹사이트", tag: "UX/UI · WEB", color: C.blue,
    href: "work-bebedepino.html", thumb: "images/work-thumb-bebedepino.jpg", home: [0.92, 2.38, 0.24] },
];
// 썸네일 미리 불러오기 (화면에 픽셀처럼 줄여서 그림)
DISKS.forEach((d) => {
  if (!d.thumb) return;
  d.img = new Image();
  d.img.src = d.thumb;
});

function diskLabel(d) {
  return textTexture(96, 64, (ctx) => {
    ctx.fillStyle = "#fbfaf6";
    ctx.fillRect(0, 0, 96, 64);
    ctx.fillStyle = d.color;
    ctx.fillRect(0, 0, 96, 8); // 라벨 윗줄 색 띠
    ctx.fillStyle = C.ink;
    ctx.font = "12px Galmuri11";
    ctx.textBaseline = "top";
    ctx.fillText(d.name, 6, 16);
    ctx.fillStyle = "#8a8a8a";
    ctx.fillText(d.tag.split(" ")[0], 6, 36);
  });
}

const diskMeshes = DISKS.map((d) => {
  const m = box(0.56, 0.05, 0.58, 0.02, d.color, [0, 0, 0]);
  // 금속 덮개 (컴퓨터 쪽으로 들어가는 앞부분)
  const shutter = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.056, 0.2), toon("#c9ccd6"));
  shutter.position.set(0.04, 0, -0.18);
  shutter.raycast = () => {};
  m.add(shutter);
  // 라벨
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.28),
    new THREE.MeshBasicMaterial({ map: diskLabel(d) }),
  );
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, 0.027, 0.1);
  label.raycast = () => {};
  m.add(label);
  const [x, z, ry] = d.home;
  m.position.set(x, 0.05, z);
  m.rotation.y = ry;
  m.userData = { disk: d, home: { x, y: 0.05, z, ry } };
  root.add(m);
  return m;
});

let inserted = null; // 지금 꽂혀 있는 디스크
let busy = false;    // 꽂는/빼는 중에는 새 동작 막기

function ejectTl(m) {
  const h = m.userData.home;
  root.attach(m);
  sfx("eject");
  return gsap.timeline()
    .to(m.position, { z: SLOT.zOut, duration: 0.25, ease: "power2.out" })
    .to(m.position, { y: 0.9, duration: 0.25, ease: "power2.out" })
    .to(m.position, { x: h.x, z: h.z, duration: 0.4, ease: "power2.inOut" }, "<0.1")
    .to(m.rotation, { y: h.ry, duration: 0.4, ease: "power2.inOut" }, "<")
    .to(m.position, { y: h.y, duration: 0.3, ease: "bounce.out" });
}

function insertTl(m) {
  return gsap.timeline()
    .to(m.position, { y: 0.9, duration: 0.25, ease: "power2.out" })
    .to(m.position, { x: SLOT.x, z: SLOT.zOut + 0.3, duration: 0.4, ease: "power2.inOut" }, "<0.05")
    .to(m.rotation, { y: 0, duration: 0.4, ease: "power2.inOut" }, "<")
    .to(m.position, { y: SLOT.y, z: SLOT.zOut, duration: 0.25, ease: "power2.in" })
    .add(() => { bounce.attach(m); sfx("insert"); }) // 꽂힌 뒤로는 컴퓨터와 함께 움직임
    .to(m.position, { z: SLOT.zIn, duration: 0.3, ease: "power3.in" })
    .add(() => {
      gsap.fromTo(bounce.position, { z: -0.04 }, { z: 0, duration: 0.5, ease: "elastic.out(1, 0.4)" });
    });
}

function insertDisk(m) {
  if (busy) return;
  busy = true;
  clearTimeout(smileTimer);
  const tl = gsap.timeline({ onComplete: () => { busy = false; } });
  if (inserted && inserted !== m) {
    const old = inserted;
    tl.add(ejectTl(old));
  }
  if (inserted === m) { // 같은 디스크를 다시 누르면 꺼내기
    tl.add(ejectTl(m)).add(() => glitchTo(() => { mode = "page"; }));
    inserted = null;
    return;
  }
  inserted = m;
  tl.add(insertTl(m));
  tl.add(() => loadDisk(m.userData.disk));
  if (reduce) tl.progress(1);
}

function ejectCurrent(after) {
  if (!inserted || busy) return after?.();
  busy = true;
  const m = inserted;
  inserted = null;
  gsap.timeline({ onComplete: () => { busy = false; } }).add(ejectTl(m));
  after?.();
}

// 읽는 중 → 작업 화면
let loadTimer;
let diskNow = null;
let loadP = 0;
function loadDisk(d) {
  diskNow = d;
  mode = "load";
  loadP = 0;
  clearInterval(loadTimer);
  loadTimer = setInterval(() => {
    loadP += 0.12;
    drawScreen();
    if (loadP >= 1) {
      clearInterval(loadTimer);
      glitchTo(() => { mode = "disk"; });
      sfx("ready");
    }
  }, reduce ? 1 : 60);
}

function drawDisk(T) {
  const d = diskNow;
  g.font = "12px Galmuri11";
  g.fillStyle = T.sub;
  g.fillText("A:\\" + d.id.toUpperCase() + ">", 12, 10);
  // 썸네일 (작게 줄였다가 키워서 도트처럼)
  const bx = 12, by = 28, bw = 216, bh = 96;
  if (d.img && d.img.complete && d.img.naturalWidth) {
    const tmp = drawDisk.tmp || (drawDisk.tmp = document.createElement("canvas"));
    tmp.width = bw / 2; tmp.height = bh / 2;
    const tc = tmp.getContext("2d");
    const ir = d.img.naturalWidth / d.img.naturalHeight, br = bw / bh;
    let sw = d.img.naturalWidth, sh = d.img.naturalHeight, sx = 0, sy = 0;
    if (ir > br) { sw = sh * br; sx = (d.img.naturalWidth - sw) / 2; } else { sh = sw / br; sy = (d.img.naturalHeight - sh) / 2; }
    tc.drawImage(d.img, sx, sy, sw, sh, 0, 0, tmp.width, tmp.height);
    g.imageSmoothingEnabled = false;
    g.drawImage(tmp, bx, by, bw, bh);
  } else {
    // 준비 중: 줄무늬 상자
    g.fillStyle = T.dim;
    for (let i = -bh; i < bw; i += 12) {
      g.beginPath();
      g.moveTo(bx + i, by + bh); g.lineTo(bx + i + bh, by); g.lineTo(bx + i + bh + 4, by); g.lineTo(bx + i + 4, by + bh);
      g.fill();
    }
    g.fillStyle = T.bg;
    g.fillRect(bx + 64, by + 36, 88, 24);
    g.fillStyle = T.fg;
    g.textAlign = "center";
    g.fillText("준비 중", bx + bw / 2, by + 42);
    g.textAlign = "left";
  }
  g.strokeStyle = T.fg;
  g.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
  g.fillStyle = T.fg;
  g.font = "12px Galmuri11";
  g.fillText(d.name + " — " + d.sub, 12, 132);
  g.fillStyle = T.dim;
  g.fillText(d.href ? "OK 상세 보기 · 디스크 눌러 꺼내기" : "곧 열려요 · 디스크 눌러 꺼내기", 12, 156);
}

/* ---------- 포인터: 기울기 · 올려두기 · 클릭 ---------- */
const ray = new THREE.Raycaster();
const ptr = new THREE.Vector2();
const tilt = { x: 0, y: 0 }; // -1 ~ 1
const clickables = [...keyMeshes, knob, body, screen, ...diskMeshes];
const cursorLabel = document.getElementById("cursorLabel");
const cursorEl = document.getElementById("cursor");
let hovered = null;
let hoverDisk = null;

function pick(e) {
  const r = canvas.getBoundingClientRect();
  ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObjects(clickables, false)[0];
  return hit ? hit.object : null;
}

window.addEventListener("pointermove", (e) => {
  const r = wrap.getBoundingClientRect();
  tilt.x = gsap.utils.clamp(-1, 1, (e.clientX - (r.left + r.width / 2)) / (innerWidth / 2));
  tilt.y = gsap.utils.clamp(-1, 1, (e.clientY - (r.top + r.height / 2)) / (innerHeight / 2));
});

canvas.addEventListener("pointermove", (e) => {
  const obj = pick(e);
  const key = keyMeshes.includes(obj) || obj === knob ? obj : null;
  if (key !== hovered) {
    if (hovered && hovered !== knob) gsap.to(hovered.position, { y: hovered.userData.y0, duration: 0.15 });
    if (key && key !== knob) gsap.to(key.position, { y: key.userData.y0 + 0.03, duration: 0.15 });
    hovered = key;
  }
  // 바닥에 놓인 디스크: 살짝 들리고, 커서에 안내 문구
  const disk = diskMeshes.includes(obj) ? obj : null;
  if (disk !== hoverDisk && !busy) {
    [hoverDisk, disk].forEach((m) => {
      if (!m || m === inserted) return;
      gsap.to(m.position, { y: m.userData.home.y + (m === disk ? 0.12 : 0), duration: 0.18, overwrite: true });
    });
    hoverDisk = disk;
  }
  const text = disk ? (disk === inserted ? "[ 디스크 꺼내기 ]" : "[ 디스크 넣기 ]") : "";
  cursorEl?.classList.toggle("has-label", !!text);
  if (text && cursorLabel) cursorLabel.textContent = text;
  cursorEl?.classList.toggle("is-link", !!obj && !disk);
});
canvas.addEventListener("pointerleave", () => {
  if (hovered && hovered !== knob) gsap.to(hovered.position, { y: hovered.userData.y0, duration: 0.15 });
  hovered = null;
  if (hoverDisk && hoverDisk !== inserted && !busy)
    gsap.to(hoverDisk.position, { y: hoverDisk.userData.home.y, duration: 0.18, overwrite: true });
  hoverDisk = null;
  cursorEl?.classList.remove("is-link", "has-label");
});
canvas.addEventListener("click", (e) => {
  const obj = pick(e);
  if (!obj) return;
  if (diskMeshes.includes(obj)) insertDisk(obj);
  else if (keyMeshes.includes(obj)) pressKey(obj);
  else if (obj === knob) turnKnob();
  else hop();
});

// 키보드·스크린리더용 진짜 버튼 (눈에는 안 보임)
wrap.querySelectorAll("[data-pc]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const a = btn.dataset.pc;
    if (a === "knob") return turnKnob();
    if (a.startsWith("disk:")) return insertDisk(diskMeshes.find((m) => m.userData.disk.id === a.slice(5)));
    pressKey(keyMeshes.find((m) => m.userData.kind === a));
  });
});

/* ---------- 바닥 그림자 ---------- */
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(5, 4),
  new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false,
    map: textTexture(128, 128, (ctx) => {
      const gr = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
      gr.addColorStop(0, "rgba(30,30,60,0.32)");
      gr.addColorStop(1, "rgba(30,30,60,0)");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, 128, 128);
    }),
  }),
);
shadow.rotation.x = -Math.PI / 2;
shadow.position.set(0, -0.02, 0.3);
scene.add(shadow);

/* ---------- 크기 맞추기 · 그리기 ---------- */
function resize() {
  const { width, height } = wrap.getBoundingClientRect();
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  fitView(width, height);
}

/*
  화면 맞춤: 컴퓨터+디스크 전체의 화면상 크기를 재서
  ① 칸 안에 여유 있게 들어가도록 확대/축소하고
  ② 넓은 화면(나란히 배치)에서는 무게중심을 왼쪽 제목의 세로 가운데에 맞춤
*/
const _box = new THREE.Box3();
const _v = new THREE.Vector3();
function screenBox(w, h) {
  const rx = root.rotation.x, ry = root.rotation.y, py = root.position.y;
  root.rotation.set(0, BASE_YAW, 0);
  root.position.y = 0;
  root.updateMatrixWorld(true);
  _box.setFromObject(root);
  root.rotation.set(rx, ry, 0);
  root.position.y = py;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 8; i++) {
    _v.set(i & 1 ? _box.max.x : _box.min.x, i & 2 ? _box.max.y : _box.min.y, i & 4 ? _box.max.z : _box.min.z);
    _v.project(camera);
    const sx = ((_v.x + 1) / 2) * w, sy = ((1 - _v.y) / 2) * h;
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  return { x0, x1, y0, y1 };
}
// 처음 구도: 컴퓨터+디스크 전체가 화면 가운데(살짝 위)에 화면의 약 60% 크기로 (레퍼런스 odama.io 구도)
// FIT = 기본 확대 배율(z0) + 1배율 기준 무게중심 위치(qx, qy) + 놓을 자리(ay)
const FIT = { z0: 1, qx: 0, qy: 0, ay: 0, w: 1, h: 1 };
function fitView(w, h) {
  camera.position.copy(CAM0);
  camera.lookAt(LOOK);
  camera.clearViewOffset();
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const b = screenBox(w, h);
  const fill = w < 768 ? 0.82 : 0.6;
  FIT.z0 = Math.min(2.4, fill / Math.max((b.x1 - b.x0) / w, (b.y1 - b.y0) / h));
  FIT.qx = (b.x0 + b.x1) / 2 - w / 2;
  FIT.qy = (b.y0 + b.y1) / 2 - h / 2;
  FIT.ay = -h * 0.04;
  // 좁은 화면(모바일): 양옆 단어 · 컴퓨터 · 문장을 한 덩어리로 묶어 화면 세로 가운데에 놓고,
  // 단어→컴퓨터 24px, 컴퓨터→문장 32px로 좁게 붙임 (스테이지에 위치 값을 넘기고 CSS가 배치)
  const st = document.querySelector(".hero__statement");
  const stage = wrap.closest(".hero__stage");
  if (w < 768 && st && stage) {
    const boxH = (b.y1 - b.y0) * FIT.z0;
    const sideH = 16, stH = st.offsetHeight, nav = 96;
    const total = sideH + 24 + boxH + 32 + stH;
    const start = Math.max(nav, (h - total) / 2);
    FIT.ay = start + sideH + 24 + boxH / 2 - h / 2;
    stage.classList.add("is-stacked");
    stage.style.setProperty("--side-top", Math.round(start) + "px");
    stage.style.setProperty("--st-top", Math.round(start + sideH + 24 + boxH + 32) + "px");
  } else if (stage) {
    stage.classList.remove("is-stacked");
    stage.style.removeProperty("--side-top");
    stage.style.removeProperty("--st-top");
  }
  FIT.w = w; FIT.h = h;
  applyView(0);
}

/* ---------- 스크롤 연출: 한 바퀴 돌며 모니터로 다가가 화면을 꽉 채움 ----------
   진행도(0~1)는 #top(히어로) 구간 스크롤 위치. 글자 연출은 script.js heroScroll()이 같은 구간으로 처리 */
const CAM0 = new THREE.Vector3(0, 5.6, 13);
const _sc = new THREE.Vector3(), _cam = new THREE.Vector3(), _look = new THREE.Vector3();
const _corner = new THREE.Vector3();
const scroll = { p: 0, s: 0 };
if (!reduce && window.ScrollTrigger) {
  ScrollTrigger.create({
    trigger: "#top", start: "top top", end: "bottom bottom",
    onUpdate: (st) => { scroll.p = st.progress; },
  });
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
let zoomE = 0; // 0 = 처음 구도, 1 = 모니터가 화면을 꽉 채움

// e(0~1)에 따라 카메라 위치·시선·확대·화면 내 위치를 처음 구도 ↔ 모니터 정면 꽉 채움 사이로
function applyView(e) {
  const { w, h } = FIT;
  screen.getWorldPosition(_sc);
  _cam.set(_sc.x, _sc.y + 0.05, _sc.z + 7.5);
  camera.position.lerpVectors(CAM0, _cam, e);
  _look.lerpVectors(LOOK, _sc, e);
  camera.lookAt(_look);
  camera.clearViewOffset();
  camera.zoom = 1;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  // 모니터 화면 네 모서리를 화면 좌표로 → 화면을 덮는(cover) 배율과 중심
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 4; i++) {
    _corner.set(i & 1 ? 0.89 : -0.89, i & 2 ? 0.6675 : -0.6675, 0);
    screen.localToWorld(_corner);
    _corner.project(camera);
    const sx = ((_corner.x + 1) / 2) * w, sy = ((1 - _corner.y) / 2) * h;
    x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
  }
  const zCover = 1.06 / Math.min((x1 - x0) / w, (y1 - y0) / h);
  const z = FIT.z0 * Math.pow(Math.max(zCover, FIT.z0) / FIT.z0, e);
  const qx = FIT.qx + ((x0 + x1) / 2 - w / 2 - FIT.qx) * e;
  const qy = FIT.qy + ((y0 + y1) / 2 - h / 2 - FIT.qy) * e;
  const ay = FIT.ay * (1 - e);
  camera.zoom = z;
  camera.updateProjectionMatrix();
  camera.setViewOffset(w, h, qx * z, qy * z - ay, w, h);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(wrap);

const clock = new THREE.Clock();
let blinkT = 0;
let screenBlue = false, savedTheme = 0, savedPage = 0;
function frame() {
  const t = clock.getElapsedTime();
  scroll.s += (scroll.p - scroll.s) * 0.14; // 스크롤을 살짝 부드럽게 따라감
  const spin = inOut(clamp01(scroll.s / 0.78));         // 회전: 히어로 구간의 앞 78%
  zoomE = inOut(clamp01((scroll.s - 0.3) / 0.6));        // 다가가기: 30% ~ 90%
  const free = 1 - spin;                                 // 마우스 기울기·둥실은 돌기 시작하면 줄어듦
  const k = reduce ? 1 : 0.12;
  const ty = (BASE_YAW + (reduce ? 0 : tilt.x * 0.5 * free)) * (1 - spin) + Math.PI * 2 * spin;
  const tx = reduce ? 0 : tilt.y * 0.16 * free;
  root.rotation.y += (ty - root.rotation.y) * k;
  root.rotation.x += (tx - root.rotation.x) * k;
  root.position.y = 0; // 둥실 떠다니는 반복 움직임은 뺌 (마우스 기울기·스크롤 회전만)
  shadow.scale.setScalar(1 - root.position.y * 0.6 - bounce.position.y * 0.4);
  root.updateMatrixWorld(true);
  applyView(zoomE);

  // 다가가는 동안 모니터를 다음 섹션과 같은 파란 화면(ABOUT)으로
  if (zoomE > 0.25 && !screenBlue) {
    screenBlue = true; savedTheme = theme; savedPage = page;
    theme = 1; page = 1; mode = "page"; drawScreen();
  } else if (zoomE < 0.2 && screenBlue) {
    screenBlue = false; theme = savedTheme; page = savedPage; mode = "page"; drawScreen();
  }
  if (screenBlue) {
    const want = zoomE > 0.6 ? "blank" : "page";
    if (mode !== want) { mode = want; drawScreen(); }
  }

  // 커서 깜빡임 · 이동 중 점 애니메이션 · LED
  if (t - blinkT > 0.5) {
    blinkT = t;
    blink = !blink;
    led.material.color.set(blink ? C.lime : "#5d7a10");
    if (mode === "page" || mode === "go") drawScreen();
  }
  renderer.render(scene, camera);
}

// 히어로가 화면에 보일 때만 그림
new IntersectionObserver(([en]) => {
  renderer.setAnimationLoop(en.isIntersecting ? frame : null);
}).observe(wrap);

drawScreen();
root.rotation.y = BASE_YAW;
resize();
document.fonts.ready.then(resize); // 제목 글꼴이 늦게 와서 줄 높이가 바뀌어도 다시 맞춤
wrap.classList.add("is-ready");
