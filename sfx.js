/*
  효과음 (8비트 게임 소리) — 소리 파일 없이 브라우저(Web Audio)에서 바로 합성
  - 반응하는 곳(링크·버튼·스티커·작업 목록·컴퓨터)에만 소리
  - 기본 켜짐. 메뉴 바 스피커 버튼으로 끄고 켬 (선택은 브라우저에 기억)
  - 다른 파일에서 쓰기: window.sfx.play("click")
*/
(() => {
  const KEY = "sfx";
  let on = localStorage.getItem(KEY) === "on"; // 처음 방문엔 꺼짐, 켜 둔 사람만 켜짐
  let ctx, master;
  let firstPlayed = false;

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.16; // 전체 음량 (작게)
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // 삑: 주파수가 from → to 로 미끄러지는 짧은 음
  function tone(from, to, dur, type = "square", vol = 0.6, delay = 0) {
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(to, 1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  // 칙: 짧은 잡음 (철컥 같은 기계음)
  function noise(dur, vol = 0.5, delay = 0, freq = 1800) {
    const t = ctx.currentTime + delay;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource();
    s.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    s.connect(f).connect(g).connect(master);
    s.start(t);
  }
  const notes = (list, step, type = "square", vol = 0.45, delay = 0) =>
    list.forEach((f, i) => tone(f, f, step * 1.1, type, vol, delay + i * step));

  const SOUNDS = {
    click: () => tone(660, 1320, 0.07),                                   // 뿅
    key: () => { tone(520, 260, 0.06, "square", 0.7); noise(0.03, 0.25); }, // 뽁 (컴퓨터 키)
    open: () => { tone(400, 900, 0.1, "triangle", 0.9); tone(900, 1500, 0.08, "square", 0.35, 0.07); }, // 뾰롱 (메뉴 열기)
    close: () => tone(900, 380, 0.12, "triangle", 0.9),                    // 메뉴 닫기
    insert: () => { noise(0.06, 0.7, 0, 2400); tone(170, 110, 0.07, "square", 0.5, 0.03); }, // 철컥 (디스크 꽂기)
    ready: () => notes([523, 659, 784, 1047], 0.07),                       // 띠리링 (디스크 읽기 끝)
    eject: () => { noise(0.04, 0.5, 0, 2400); tone(800, 300, 0.14, "square", 0.45, 0.03); }, // 디스크 꺼내기
    hop: () => tone(260, 1200, 0.2, "square", 0.55),                       // 뾰옹 (컴퓨터 점프)
    pop: () => { tone(300, 620, 0.05, "sine", 1); tone(620, 900, 0.05, "square", 0.3, 0.04); }, // 스티커 집기
    error: () => { tone(150, 150, 0.08, "square", 0.6); tone(150, 150, 0.08, "square", 0.6, 0.12); }, // 삐삐 (준비 중)
    on: () => notes([523, 784], 0.07),
  };

  function play(name) {
    if (!on || !SOUNDS[name] || !audio()) return;
    SOUNDS[name]();
    if (!firstPlayed) { firstPlayed = true; hint(4000); } // 첫 소리가 날 때 스피커가 깜빡여 끄는 곳을 알려 줌
  }

  /* ---------- 메뉴 바 스피커 버튼 ---------- */
  const btn = document.getElementById("sfxToggle");
  let hintTimer;
  function hint(ms) {
    if (!btn || !on) return;
    btn.classList.add("is-hint");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => btn.classList.remove("is-hint"), ms);
  }
  function render() {
    if (!btn) return;
    btn.setAttribute("aria-pressed", String(on));
    btn.setAttribute("aria-label", on ? "효과음 끄기" : "효과음 켜기");
  }
  if (btn) {
    render();
    hint(5000); // 들어오자마자 잠깐 깜빡임
    btn.addEventListener("click", () => {
      on = !on;
      localStorage.setItem(KEY, on ? "on" : "off");
      btn.classList.remove("is-hint");
      render();
      if (on) play("on");
    });
  }

  /* ---------- 반응하는 곳에만 소리 (컴퓨터는 hero-pc.js가 따로 냄) ---------- */
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (e.button !== 0) return;
      const t = e.target;
      if (t.closest("#sfxToggle, [data-pc], #heroPcCanvas")) return;
      if (t.closest("#gnbToggle")) {
        return play(t.closest("#gnbToggle").getAttribute("aria-expanded") === "true" ? "close" : "open");
      }
      if (t.closest(".work.is-soon")) return play("error");
      if (t.closest("[data-sticker]") && !t.closest("a")) return play("pop");
      if (t.closest("a, button, .work, [role='button']")) play("click");
    },
    true,
  );

  window.sfx = { play, get on() { return on; } };
})();
