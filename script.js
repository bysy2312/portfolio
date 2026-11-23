gsap.registerPlugin(
  ScrollTrigger,
  SplitText,
  ScrambleTextPlugin,
);
// 끌기(푸터 스티커)는 메인 페이지에서만 불러옴
if (window.Draggable) gsap.registerPlugin(Draggable, InertiaPlugin);

const EASE = "quint.out"; // 사이트 전체 한 가지 감속 곡선
const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

/* ---------- 1. 부드러운 스크롤 (Lenis) ---------- */
const lenis = new Lenis({ lerp: 0.1 });
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

/* ---------- 3. 히어로: 처음 등장 + 스크롤 연출 ---------- */
// 등장: 문장이 한 줄씩 아래에서 올라오고, 양옆 단어·컴퓨터가 서서히
function introHero() {
  const split = SplitText.create(".hero__statement span", { type: "lines", mask: "lines" });
  gsap.from(split.lines, { yPercent: 110, duration: 0.5, ease: EASE, stagger: 0.06 });
  gsap.from(".hero__side, .hero__pc", { opacity: 0, duration: 0.5, ease: EASE, stagger: 0.06, delay: 0.1 });
}
// 스크롤: (컴퓨터 회전·확대는 hero-pc.js가 같은 구간을 읽어서 처리)
function heroScroll() {
  const st = { trigger: "#top", start: "top top", end: "bottom bottom", scrub: true };
  // ① 왼쪽 아래 문장: 아래로 내려가며 사라짐
  gsap.to(".hero__statement", {
    yPercent: 140, opacity: 0, ease: "power2.in",
    scrollTrigger: { ...st, end: "15% top" },
  });
  // ② 양옆 단어: 회전이 반쯤 왔을 때 글자가 뒤섞이며 바뀜 (되돌아가면 원래 단어로)
  const sides = gsap.utils.toArray(".hero__side");
  sides.forEach((el) => { el.dataset.orig = el.textContent; });
  ScrollTrigger.create({
    trigger: "#top", start: "28% top",
    onEnter: () => sides.forEach((el) => gsap.to(el, { duration: 0.6, scrambleText: { text: el.dataset.swap, chars: "01#*+=/", speed: 0.6 } })),
    onLeaveBack: () => sides.forEach((el) => gsap.to(el, { duration: 0.6, scrambleText: { text: el.dataset.orig, chars: "01#*+=/", speed: 0.6 } })),
  });
  // 컴퓨터가 화면을 채우기 시작하면 양옆 단어는 빠짐
  gsap.to(".hero__side", { opacity: 0, ease: "none", scrollTrigger: { ...st, start: "55% top", end: "75% top" } });
  // ③ 끝: 모니터가 꽉 찬 순간 파란 막으로 덮어 다음 섹션(같은 파랑)과 이음새 없이
  gsap.to(".hero__fill", { opacity: 1, ease: "none", scrollTrigger: { ...st, start: "86% top", end: "97% top" } });
}

/* ---------- 4. 파란 섹션: 흩어진 단어가 스크롤에 따라 문장으로 모임 ---------- */
function introWords() {
  const split = SplitText.create("#introText", {
    type: "words",
    wordsClass: "word",
  });
  const words = split.words;

  // 처음엔 모든 단어를 화면 오른쪽 바깥으로 밀어 둠 (글자가 하나도 안 보임)
  // 뒤쪽 단어일수록 더 멀리 → 들어올 때 순서대로, 서로 겹치지 않음
  const boxLeft = document
    .querySelector(".intro__pin")
    .getBoundingClientRect().left;
  words.forEach((w, i) => {
    const left = w.getBoundingClientRect().left - boxLeft;
    gsap.set(w, { x: window.innerWidth - left + 40 + i * 30 });
  });

  // 섹션 고정은 위에 닿은 뒤 화면 한 장만큼
  ScrollTrigger.create({ trigger: "#intro", start: "top top", end: "+=100%", pin: ".intro__pin" });
  // 단어는 섹션이 화면 아래쪽에서 올라오는 순간부터 들어오기 시작 → 히어로 뒤 파란 빈 화면이 짧아짐 (2026-11-22)
  gsap.to(words, {
    x: 0,
    ease: "none",
    stagger: { each: 0.04 },
    scrollTrigger: {
      trigger: "#intro",
      start: "top bottom",
      end: "top -80%",
      scrub: 1,
    },
  });
}

/* ---------- 5. 프로젝트 목록이 아래에서 나타남 ---------- */
function worksReveal() {
  gsap.from(".work", {
    y: 12,
    opacity: 0,
    duration: 0.5,
    stagger: 0.06,
    ease: EASE,
    scrollTrigger: { trigger: ".works", start: "top 70%" },
  });
}

/* ---------- 5-1. 작업 목록 미리보기 (레퍼런스 studiobumps 방식) ----------
   줄에 마우스를 올리면 대표 이미지가 마우스 옆에 나타나고, 마우스를 따라 부드럽게 움직임 */
function worksPreview() {
  const peek = document.getElementById("workPeek");
  if (!peek || !window.matchMedia("(pointer: fine)").matches) return;
  const img = peek.querySelector("img");
  const moveX = gsap.quickTo(peek, "left", { duration: 0.35, ease: "power3.out" });
  const moveY = gsap.quickTo(peek, "top", { duration: 0.35, ease: "power3.out" });

  document.querySelectorAll(".work[data-preview]").forEach((row, i) => {
    new Image().src = row.dataset.preview; // 미리 불러와서 깜빡임 방지
    row.addEventListener("pointerenter", (e) => {
      img.src = row.dataset.preview;
      gsap.set(peek, { left: e.clientX, top: e.clientY });
      peek.classList.add("is-on");
    });
    row.addEventListener("pointermove", (e) => { moveX(e.clientX); moveY(e.clientY); });
    row.addEventListener("pointerleave", () => peek.classList.remove("is-on"));
  });
}

/* ---------- 5-2. 상세 페이지: 덩어리가 화면에 들어오면 아래에서 떠오름 ---------- */
function revealOnScroll() {
  document.querySelectorAll("[data-reveal]").forEach((el) => {
    gsap.from(el, {
      y: 12, opacity: 0, duration: 0.5, ease: EASE,
      scrollTrigger: { trigger: el, start: "top 85%" },
    });
  });
}

/* ---------- 7. 스티커: 마우스를 올리면 선택된 모양, 벗어나면 기본 상태 / 끌어서 옮기기 ---------- */
function stickers() {
  const items = document.querySelectorAll("[data-sticker]");
  let topZ = 10;

  // 선택된 모양: 라임 테두리 + 핸들, 살짝 커지고 기울며 그림자
  const lift = (el) => {
    el.classList.add("is-selected");
    el.style.zIndex = ++topZ; // 맨 위로
    gsap.to(el, {
      scale: 1.06,
      rotation: gsap.utils.random(-6, 6),
      filter: "drop-shadow(0 16px 24px rgba(0,0,0,0.35))",
      duration: 0.25,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  // 기본 상태로 되돌리기 (자리는 옮긴 곳 그대로)
  const settle = (el) => {
    el.classList.remove("is-selected");
    gsap.to(el, {
      scale: 1,
      rotation: 0,
      filter: "drop-shadow(0 0 0 rgba(0,0,0,0))",
      duration: 0.6,
      ease: "elastic.out(1, 0.5)",
      overwrite: "auto",
    });
  };

  items.forEach((el) => {
    let hovering = false;

    const drag = Draggable.create(el, {
      bounds: "#footerStage",
      inertia: true, // 던지듯 놓으면 미끄러지다 멈춤
      onRelease() {
        // 놓았을 때 마우스가 이미 밖에 있으면 기본 상태로
        if (!hovering) settle(el);
      },
    })[0];

    el.addEventListener("pointerenter", () => {
      hovering = true;
      lift(el);
    });
    el.addEventListener("pointerleave", () => {
      hovering = false;
      if (!drag.isPressed) settle(el); // 끄는 중에는 유지
    });
  });
}

/* ---------- 7-3. GNB: 레퍼런스 two-step 메뉴 ----------
   열기 (레퍼런스 실측):
     1단계 0~0.45초  가로로 넓어짐(348 → 400px) + 햄버거가 X로 + 구분선 나타남 + 뒤 화면 어두워짐
     2단계 0.3초~    아래로 펼쳐짐 (높이 0 → 내용 높이)
   닫기: 같은 움직임을 거꾸로 (아래가 먼저 접히고 → 가로가 줄어듦) */
function gnb() {
  const bar = document.getElementById("gnbBar");
  const toggle = document.getElementById("gnbToggle");
  const panel = document.getElementById("gnbPanel");
  const dim = document.getElementById("gnbDim");
  const [barTop, barBottom] = toggle.querySelectorAll(".gnb__toggle-bar");
  // 열린 너비: 기본 400, 스크롤해서 이미 더 넓으면 그 너비 유지
  const openWidth = () => Math.max(Math.min(400, window.innerWidth - 32), bar.offsetWidth);

  // 스크롤하면 바가 넓어지고 반투명해짐 (CSS .is-scrolled)
  const onScroll = (y) => bar.classList.toggle("is-scrolled", y > 40);
  onScroll(window.scrollY);
  lenis.on("scroll", ({ scroll }) => onScroll(scroll));
  window.addEventListener("scroll", () => onScroll(window.scrollY), { passive: true });

  const tl = gsap.timeline({
    paused: true, defaults: { ease: "power3.inOut" },
    // 다 닫히면 GSAP이 넣은 너비를 지워 스크롤 상태(CSS)가 다시 너비를 정하게
    onReverseComplete: () => { gsap.set(bar, { clearProps: "width" }); bar.classList.remove("is-menu"); },
  })
    // 1단계: 가로로 넓어짐
    .to(bar, { width: openWidth, duration: 0.45 }, 0)
    .to(barTop, { y: 0, rotation: 45, duration: 0.45 }, 0)
    .to(barBottom, { y: 0, rotation: -45, duration: 0.45 }, 0)
    .to("#gnbLine", { opacity: 1, duration: 0.3 }, 0.15)
    .to(dim, { autoAlpha: 1, duration: 0.4, ease: "power2.out" }, 0)
    // 2단계: 아래로 펼쳐짐
    .to(panel, { height: "auto", duration: 0.7, ease: "power3.out" }, 0.3);

  let isOpen = false;
  const setOpen = (open) => {
    isOpen = open;
    toggle.setAttribute("aria-expanded", open);
    toggle.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
    if (open) { bar.classList.add("is-menu"); tl.invalidate().timeScale(1).play(); lenis.stop(); }
    else { tl.timeScale(1.4).reverse(); lenis.start(); } // 닫을 땐 조금 더 빠르게
  };

  toggle.addEventListener("click", () => setOpen(!isOpen));
  dim.addEventListener("click", () => setOpen(false)); // 어두운 바깥 누르면 닫힘
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen) setOpen(false); });

  // 메뉴 링크: 메뉴를 닫고 해당 섹션으로 부드럽게 이동
  document.querySelectorAll("[data-gnb-link]").forEach((link) => {
    link.addEventListener("click", (e) => {
      const href = link.getAttribute("href");
      const target = href.startsWith("#") && document.querySelector(href);
      if (!target) return; // 다른 페이지로 가는 링크는 브라우저 기본 이동
      e.preventDefault();
      if (isOpen) setOpen(false);
      lenis.start();
      lenis.scrollTo(target, { offset: 0, duration: 1.4 });
    });
  });

  // 화면 크기가 바뀌면 열린 너비 다시 계산
  window.addEventListener("resize", () => { tl.invalidate(); if (isOpen) tl.progress(1); });
}

/* ---------- 8. 픽셀 마우스 커서 ---------- */
function pixelCursor() {
  // 터치 기기(휴대폰 등)에서는 기본 동작 유지
  if (!window.matchMedia("(pointer: fine)").matches) return;

  // 픽셀 화살표 그림: B = 테두리, F = 채움
  const bitmap = [
    "B",
    "BB",
    "BFB",
    "BFFB",
    "BFFFB",
    "BFFFFB",
    "BFFFFFB",
    "BFFFFFFB",
    "BFFFFFFFB",
    "BFFFFBBBB",
    "BFFBFFB",
    "BFB BFFB",
    "BB  BFFB",
    "B    BFFB",
    "     BFFB",
    "      BB",
  ];
  const svg = document.getElementById("cursorArrow");
  const size = 3; // 픽셀 하나 = 3px
  let rects = "";
  bitmap.forEach((row, y) => {
    [...row].forEach((p, x) => {
      if (p === " ") return;
      rects += `<rect class="${p === "B" ? "b" : "f"}" x="${x * size}" y="${y * size}" width="${size}" height="${size}"/>`;
    });
  });
  svg.setAttribute("viewBox", `0 0 ${9 * size} ${bitmap.length * size}`);
  svg.innerHTML = rects;

  const cursor = document.getElementById("cursor");
  const label = document.getElementById("cursorLabel");
  document.documentElement.classList.add("has-cursor");

  // 마우스를 살짝 늦게 따라와서 부드럽게 보이게
  const moveX = gsap.quickTo(cursor, "x", {
    duration: 0.15,
    ease: "power3.out",
  });
  const moveY = gsap.quickTo(cursor, "y", {
    duration: 0.15,
    ease: "power3.out",
  });

  window.addEventListener("pointermove", (e) => {
    moveX(e.clientX);
    moveY(e.clientY);
    cursor.classList.add("is-visible");
  });
  document.addEventListener("mouseleave", () =>
    cursor.classList.remove("is-visible"),
  );
  window.addEventListener("pointerdown", () => cursor.classList.add("is-down"));
  window.addEventListener("pointerup", () =>
    cursor.classList.remove("is-down"),
  );

  // 올려 둔 대상에 따라 커서 모양 바꾸기
  document.addEventListener("pointerover", (e) => {
    const t = e.target;
    const sticker = t.closest("[data-sticker]");
    const link = t.closest("a, button, .work");
    const tilt = t.closest("[data-tilt]");
    const work = t.closest(".work");

    // 말풍선 문구: 스티커 / 작업 목록 줄 (상세 있음 · 준비 중)
    let text = "";
    const custom = t.closest("[data-cursor]"); // 요소마다 직접 정한 문구 (예: 소개 페이지 디스크)
    if (custom) text = custom.dataset.cursor;
    else if (t.closest("#sfxToggle")) text = window.sfx?.on ? "[ 소리 끄기 ]" : "[ 소리 켜기 ]";
    else if (sticker && !link) text = "[ 잡아서 옮기기 ]";
    else if (work) text = work.classList.contains("is-soon") ? "[ 준비 중 ]" : "[ 보러 가기 ]";

    cursor.classList.toggle("is-link", !!link && !sticker && !work?.classList.contains("is-soon"));
    cursor.classList.toggle("is-tilt", !!tilt);
    cursor.classList.toggle("has-label", !!text);
    if (text) label.textContent = text;
  });
}

/* ---------- 실행 (글꼴이 다 불러와진 뒤 줄 계산) ---------- */
/* ---------- 푸터 제목: 글자에 마우스를 올리면 제각각 기울어지고, 누르면 통 튀어 오름 ---------- */
function tiltLetters() {
  const split = SplitText.create("[data-tilt]", { type: "words,chars", wordsClass: "word", charsClass: "char" });
  split.chars.forEach((char) => {
    char.addEventListener("mouseenter", () => {
      gsap.to(char, {
        rotation: gsap.utils.random(-25, 25), y: gsap.utils.random(-24, 24), x: gsap.utils.random(-8, 8),
        duration: 0.3, ease: "power2.out", overwrite: "auto",
      });
    });
    char.addEventListener("mouseleave", () => {
      gsap.to(char, { rotation: 0, x: 0, y: 0, duration: 1.2, ease: "elastic.out(1, 0.35)", delay: 0.2, overwrite: "auto" });
    });
    char.addEventListener("click", () => {
      gsap.timeline({ overwrite: "auto" })
        .to(char, { y: -64, rotation: "+=360", scale: 1.2, duration: 0.45, ease: "power2.out" })
        .to(char, { y: 0, rotation: 0, scale: 1, duration: 0.9, ease: "bounce.out" });
    });
  });
}

pixelCursor();
document.fonts.ready.then(() => {
  const has = (sel) => !!document.querySelector(sel);

  if (has("[data-sticker]") && window.Draggable) stickers();

  gnb();
  worksPreview();
  if (!reduceMotion) {
    if (has(".hero__stage")) heroScroll();
    if (has("#introText")) introWords();
    if (has(".works__index")) worksReveal();
    if (has("[data-reveal]")) revealOnScroll();
    if (has("[data-tilt]") && window.SplitText) tiltLetters();
  }

  // 상세 페이지에서 index.html#works 처럼 위치를 지정해 돌아오면 바로 그 위치로
  const hashTarget = location.hash && document.querySelector(location.hash);
  if (has(".hero__statement") && !reduceMotion && !hashTarget) introHero();
  if (hashTarget) {
    ScrollTrigger.refresh();
    lenis.scrollTo(hashTarget, { immediate: true, force: true });
  }
});
