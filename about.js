/* 소개 페이지 전용 동작
   - 플로피디스크 명함: 누르면 앞/뒤 뒤집기
   - 큰 글자: 화면 폭에 꼭 맞게 크기 조절 */
(function () {
  // 1. 디스크 명함 뒤집기
  const card = document.getElementById("diskCard");
  const hint = document.getElementById("diskHint");
  if (card) {
    card.addEventListener("click", () => {
      const on = card.getAttribute("aria-pressed") !== "true";
      card.setAttribute("aria-pressed", String(on));
      if (hint) hint.textContent = on ? "다시 눌러서 되돌리기 ↻" : "눌러서 뒤집기 ↻";
    });
  }

  // 2. 큰 글자(워드마크, 연락 메일 주소)를 화면 폭(좌우 여백 안쪽)에 꼭 맞추기
  const fits = [...document.querySelectorAll(".about-contact__mail")];
  function fit() {
    fits.forEach((box) => {
      const span = box.querySelector("span");
      if (!span) return;
      const cs = getComputedStyle(box);
      const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      span.style.fontSize = "100px";
      const w = span.getBoundingClientRect().width;
      span.style.fontSize = (100 * avail / w).toFixed(2) + "px";
    });
  }
  document.fonts.ready.then(fit);
  window.addEventListener("resize", fit);
})();
