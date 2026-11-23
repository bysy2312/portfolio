/* 베베드피노 상세 — 움직이는 장식 (레퍼런스: 메지로대 MEJINAVI2026)
   CSS만으로 되는 것(구름·스티커)은 work-bebedepino-motion.css,
   레이어를 다시 쌓아야 하는 것(오리 날개)과 스크롤로 시작하는 것(토끼)은 여기서 준비 */
(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.documentElement.classList.add("bdp-motion");

  function img(src, cls, x, y, w, h) {
    var el = document.createElement("img");
    el.src = src; el.alt = ""; el.className = cls; el.decoding = "async";
    el.style.left = x + "px"; el.style.top = y + "px"; el.style.width = w + "px"; el.style.height = h + "px";
    return el;
  }

  // 1) 오리 (top_btn_02): 피그마 원본 레이어(오른쪽 날개·부리·몸체·왼쪽 날개)를 그대로 쌓고 날개만 파닥
  //    좌표는 피그마 duck_img 기준 px (images/bebedepino/motion/duck2-*.webp, 원본 3배 해상도)
  var duck = document.querySelector(".b10 img.top-btn-02");
  if (duck) {
    var D = "images/bebedepino/motion/duck2-";
    var box = document.createElement("div");
    box.className = "bdp-duck";
    box.setAttribute("aria-hidden", "true");
    box.appendChild(img(D + "wing-r.webp", "bdp-duck__wing bdp-duck__wing--back", 51.53, 0, 66.97, 67.54));
    box.appendChild(img(D + "beak.webp", "bdp-duck__part", 11.31, 62.09, 22.7, 20.89));
    box.appendChild(img(D + "body.webp", "bdp-duck__part", 0, 33.52, 167.46, 67.32));
    box.appendChild(img(D + "wing-l.webp", "bdp-duck__wing bdp-duck__wing--front", 51.53, 52.35, 84.12, 88.84));
    duck.replaceWith(box);
  }

  // 2) 구름: 하나하나 속도·출발 시점·흔들 방향을 다르게
  var clouds = document.querySelectorAll(".b01 [class^='background-cloud'], .b11 [class^='deco-cloud'], .b12 [class^='deco-cloud'], .b13 [class^='deco-cloud'], .b14 [class^='deco-cloud'], .b15 [class^='deco-cloud']");
  clouds.forEach(function (c, i) {
    c.style.setProperty("--dur", (6 + (i * 1.7) % 4).toFixed(1) + "s");
    c.style.setProperty("--delay", (-((i * 2.3) % 6)).toFixed(1) + "s");
    c.style.setProperty("--dx", ((i % 2 ? -1 : 1) * (8 + (i * 3) % 7)) + "px");
  });

  // 3) 토끼: 07 화면이 충분히 보이면 오른쪽 화면 밖에서 뛰어 들어옴 (화면을 완전히 벗어나면 다시 준비 → 다음에 또 뛰어옴)
  var rabbit = document.querySelector(".b07 .deco-rabbit");
  var sec = document.querySelector(".fx.b07");
  if (rabbit && sec && "IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && e.intersectionRatio >= 0.45) rabbit.classList.add("is-in");
        else if (!e.isIntersecting) rabbit.classList.remove("is-in");
      });
    }, { threshold: [0, 0.45] }).observe(sec);
  } else if (rabbit) rabbit.classList.add("is-in");
})();
