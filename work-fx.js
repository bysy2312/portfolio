/* 피그마 1920 좌표계를 화면 폭에 맞추는 배율 (--fz). 1920보다 넓으면 1(원래 크기) */
(function () {
  var root = document.documentElement;
  function fit() { root.style.setProperty("--fz", Math.min(root.clientWidth - 32, 1920) / 1920); } /* 좌우 여백 16px×2 제외 */
  fit();
  window.addEventListener("resize", fit);
})();
