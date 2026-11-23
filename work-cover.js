/* 상세 페이지 상단 커버 움직임 (2026-11-22, 레퍼런스 goodgrowth.com/#/rally)
   - 커버는 아래 끝이 화면 바닥에 닿으면 멈춤(sticky) → 다음 섹션이 위로 덮으며 올라옴
   - 덮이는 동안: 커버가 살짝 작아지고 어두워짐, 제목은 위로 / 휴대폰은 아래로 벌어지며 깊이감
   - 마우스: 휴대폰이 마우스 쪽으로 살짝 기울고 따라옴 */
(function () {
  var cover = document.querySelector(".w-cover");
  if (!cover) return;

  // 커버가 화면보다 길면, 아래 끝이 보인 다음에 멈추도록 top을 음수로
  function setTop() { cover.style.setProperty("--cover-top", Math.min(0, window.innerHeight - cover.offsetHeight) + "px"); }
  setTop();
  window.addEventListener("resize", setTop);
  if (window.ResizeObserver) new ResizeObserver(setTop).observe(cover); // 프로토타입이 그려진 뒤 높이가 바뀌어도 다시 계산

  if (!window.gsap) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var obj = document.getElementById("coverObj");
  var title = document.getElementById("coverTitle");
  var next = cover.nextElementSibling; // 커버 바로 다음 섹션 (열나요 .w-hero / Piccha·베베드피노 첫 .fx)

  if (window.ScrollTrigger && next) {
    var st = { trigger: next, start: "top bottom", end: "top top", scrub: true };
    gsap.to(cover, { scale: 0.92, ease: "none", scrollTrigger: st });
    gsap.to(".w-cover__dim", { opacity: 0.55, ease: "none", scrollTrigger: st });
    gsap.to(title, { yPercent: -160, ease: "none", scrollTrigger: st });
    gsap.to(obj, { y: 80, ease: "none", scrollTrigger: st });
    // 다 덮이면 커버를 숨겨 히어로 아래로 가장자리가 비치지 않게
    ScrollTrigger.create({ trigger: next, start: "top top", onEnter: function () { cover.style.visibility = "hidden"; }, onLeaveBack: function () { cover.style.visibility = ""; } });
  }

  // (휴대폰이 눌러 쓰는 프로토타입이 되어 마우스 기울임은 뺌, 2026-11-22)
})();
