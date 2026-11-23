/* ===== 피그마 프로토타입 재생기 (2026-11-22, 전환 개선 2026-11-23) =====
   피그마 '프레젠테이션'처럼 휴대폰 안에서 화면을 눌러 넘겨 보는 장치.
   데이터(window.PROTO_DATA[이름])는 피그마 프로토타입 연결을 그대로 옮긴 것:
     screens[id] = { img, h, pos?('bottom'|'center' = 겹쳐 뜨는 화면), dim?, state?, flip?, hs:[핫스팟], timeout? }
     핫스팟 { b:[x,y,w,h], nav:id | ov:id | close:1 | set:값 | flip:1 | gnb:1|0, when:값, t:전환 }
       nav  = 화면 이동 / ov = 겹쳐 띄우기 / close = 겹친 화면 닫기
       set  = 같은 화면의 다른 상태(컴포넌트 변형)로 바꾸기, when = 그 상태일 때만 보이는 핫스팟
       flip = 켜기/끄기 버튼 (flip 이미지의 같은 자리로 바꿔 보여 줌)
       gnb  = 아래 메뉴 + 버튼 펼치기(1)/접기(0)
     전환 t = 피그마 설정 그대로 { k:'smart'|'dissolve'|'movein'|'moveout'|'push'|'slidein'|'slideout', d:'LEFT'|'RIGHT'|'TOP'|'BOTTOM', ms, e:이징 }
       t가 없으면 피그마의 '즉시(Instant)'와 같음 — 다음 화면 그림이 준비된 뒤 한 번에 바뀜(하얀 깜빡임 없음)
   사용: <div class="proto" data-proto="yeolnayo"></div> + 데이터 파일 + 이 파일 */
(function () {
  var W = 375, H = 812;
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 피그마 이징 → CSS 곡선 (스프링 계열은 비슷한 곡선으로)
  var EASE = {
    LINEAR: "linear",
    EASE_IN: "cubic-bezier(0.42, 0, 1, 1)",
    EASE_OUT: "cubic-bezier(0, 0, 0.58, 1)",
    EASE_IN_AND_OUT: "cubic-bezier(0.42, 0, 0.58, 1)",
    EASE_IN_BACK: "cubic-bezier(0.3, -0.05, 0.7, -0.5)",
    EASE_OUT_BACK: "cubic-bezier(0.45, 1.45, 0.8, 1)",
    EASE_IN_AND_OUT_BACK: "cubic-bezier(0.7, -0.4, 0.4, 1.4)",
    GENTLE: "cubic-bezier(0.25, 1, 0.5, 1)",
    QUICK: "cubic-bezier(0.2, 0.9, 0.25, 1)",
    SLOW: "cubic-bezier(0.16, 1, 0.3, 1)",
    BOUNCY: "cubic-bezier(0.34, 1.4, 0.64, 1)"
  };
  // 피그마 방향 = 움직이는 쪽 (LEFT = 왼쪽으로 움직임 → 오른쪽에서 들어옴)
  var VEC = { LEFT: [-1, 0], RIGHT: [1, 0], TOP: [0, -1], BOTTOM: [0, 1] };
  var OPP = { LEFT: "RIGHT", RIGHT: "LEFT", TOP: "BOTTOM", BOTTOM: "TOP" };
  var REV = { sheetup: "sheetdown", sheetdown: "sheetup", movein: "moveout", moveout: "movein", slidein: "slideout", slideout: "slidein", push: "push", smart: "smart", dissolve: "dissolve" };

  function el(tag, cls, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
  function place(e, b) { e.style.left = b[0] + "px"; e.style.top = b[1] + "px"; e.style.width = b[2] + "px"; e.style.height = b[3] + "px"; }
  function tr(v, f) { return "translate(" + (v[0] * f) + "%, " + (v[1] * f) + "%)"; }
  // 그림이 실제로 그려질 준비가 될 때까지 기다림 (최대 ms)
  function ready(imgs, ms) {
    var list = imgs.filter(Boolean).map(function (i) {
      if (i.decode) return i.decode().catch(function () {});
      return new Promise(function (r) { if (i.complete) r(); else { i.onload = i.onerror = r; } });
    });
    return Promise.race([Promise.all(list), new Promise(function (r) { setTimeout(r, ms || 1500); })]);
  }
  function reverse(t) {
    if (!t) return null;
    var r = { k: REV[t.k] || t.k, ms: t.ms, e: t.e };
    if (t.d) r.d = (t.k === "smart" || t.k === "dissolve") ? t.d : OPP[t.d];
    return r;
  }

  function Proto(root, data) {
    W = data.W || 375; H = data.H || 812;                  // 화면 크기(디자인 px): 앱 375×812, 웹 1920×1080
    if (data.device) root.classList.add("proto--" + data.device);
    root.style.setProperty("--pw", W); root.style.setProperty("--ph", H);
    this.timers = []; this.tok = 0;
    this.root = root; this.d = data; this.hist = []; this.cur = null; this.ov = null; this.gnbOpen = false; this.timer = null;
    this.build();
    this.go(data.start, { noHist: true });
    this.fit();
    var self = this;
    window.addEventListener("resize", function () { self.fit(); });
    if (data.gnb) setTimeout(function () { self.preload({ img: data.gnb.img }); }, 800);
  }
  Proto.prototype.src = function (name) { return this.d.base + name + ".webp"; };
  // 지금 화면에서 갈 수 있는 화면만 미리 받아 둠 (눌렀을 때 바로 바뀌도록)
  Proto.prototype.preloadNext = function (id) {
    var self = this, s = this.d.screens[id];
    (s.hs || []).forEach(function (h) { var t = h.nav || h.ov; if (t && self.d.screens[t]) self.preload(self.d.screens[t]); });
    if (s.timeout && this.d.screens[s.timeout.to]) this.preload(this.d.screens[s.timeout.to]);
  };
  Proto.prototype.preload = function (s) {
    if (s._pre) return; s._pre = true;
    var self = this, list = [s.img];
    if (s.fixed) ["top", "bot"].forEach(function (p) { var L = s.fixed[p]; if (!L) return; if (L.items) L.items.forEach(function (it) { list.push(it.img); }); else list.push(L.img); });
    if (s.flip) list.push(s.flip);
    if (s.state) Object.keys(s.state.imgs).forEach(function (k) { list.push(s.state.imgs[k]); });
    list.forEach(function (n) { var i = new Image(); i.src = self.src(n); if (i.decode) i.decode().catch(function () {}); });
  };

  Proto.prototype.build = function () {
    var r = this.root, self = this;
    r.innerHTML = "";
    this.device = el("div", "proto__device", r);
    this.clip = el("div", "proto__clip", this.device);
    this.vp = el("div", "proto__vp", this.clip);            // 375×812 기준 화면 (배율로 줄여 보여 줌)
    this.stage = el("div", "proto__stage", this.vp);        // 화면 한 장씩 겹쳐 놓고 전환
    this.gnbLayer = el("div", "proto__gnb", this.vp);
    this.ovLayer = el("div", "proto__ovl", this.vp);
    // 핫스팟이 아닌 곳을 누르면 누를 수 있는 곳을 잠깐 표시 (피그마 프레젠테이션과 같은 안내)
    this.vp.addEventListener("click", function (e) {
      if (e.target.closest(".proto__hs")) return;
      if (e.target === self.ovLayer && self.ov) { self.closeOv(); return; }
      if (self.gnbOpen && !e.target.closest(".proto__hs")) { self.setGnb(false); return; }
      self.vp.classList.remove("is-hint"); void self.vp.offsetWidth; self.vp.classList.add("is-hint");
    });

    // 아래 조작줄: 뒤로 + 흐름 바로가기(피그마 Flow 시작점)
    var bar = el("div", "proto__bar", r);
    var back = el("button", "proto__chip proto__chip--back", bar);
    back.type = "button"; back.textContent = "← 뒤로"; back.setAttribute("data-cursor", "[ 뒤로 ]");
    back.addEventListener("click", function () { self.back(); });
    (this.d.flows || []).forEach(function (f) {
      var b = el("button", "proto__chip", bar); b.type = "button"; b.textContent = f.label;
      b.setAttribute("data-cursor", "[ " + f.label + " ]");
      b.addEventListener("click", function () { self.go(f.to, { t: { k: "dissolve", ms: 240, e: "EASE_OUT" } }); });
    });
  };

  Proto.prototype.fit = function () {
    var vw = window.innerWidth, s;
    if (this.d.device === "desktop") s = Math.min(0.5, (vw < 768 ? vw - 40 : vw * 0.62) / W); // 웹: 브라우저 창 폭 = 화면의 62%
    else if (vw < 768) s = Math.min(0.8, (vw - 80) / W);
    else s = Math.max(0.5, Math.min(0.8, vw * 0.00052));
    this.root.style.setProperty("--ps", s.toFixed(4));
  };

  // 화면 한 장 = 스크롤 영역 + 고정 바(위/아래)를 담은 층
  Proto.prototype.makeLayer = function () {
    var L = el("div", "proto__layer");
    L.scroll = el("div", "proto__scroll", L);
    L.scroll.setAttribute("data-lenis-prevent", "");      // 페이지 부드러운 스크롤(Lenis)이 휠을 가로채지 않게 → 화면 안에서 스크롤됨
    L.scroll.tabIndex = -1;
    L.page = el("div", "proto__page", L.scroll);
    L.fixTop = el("div", "proto__fix proto__fix--top", L);
    L.fixBot = el("div", "proto__fix proto__fix--bot", L);
    return L;
  };

  Proto.prototype.go = function (id, opt) {
    opt = opt || {};
    var s = this.d.screens[id]; if (!s) return;
    if (s.pos) { this.openOv(id, opt.t); return; }        // 겹쳐 뜨는 화면
    var fromOv = this.ov;
    if (this.ov) this.closeOv(!opt.t, "fade");              // 팝업에서 다른 화면으로: 팝업이 서서히 사라지며 넘어감
    if (this.gnbOpen) this.setGnb(false);
    if (this.cur && !opt.noHist) this.hist.push({ id: this.cur, t: opt.t, ov: fromOv });
    this.cur = id;
    this.stateOf = {}; this.flips = {};                    // 화면을 옮기면 버튼 상태는 처음으로 (피그마와 같음)
    this.timers.forEach(clearInterval); this.timers = [];  // 이전 화면의 자동 넘김 멈춤
    clearTimeout(this.timer);

    var self = this, tok = ++this.tok, old = this.layer;
    var L = this.makeLayer();
    L.style.visibility = "hidden";
    this.stage.appendChild(L);
    this.layer = L; this.scroll = L.scroll; this.page = L.page;
    this.renderPage(L.page, id);
    this.renderExtras(L.page, id);
    this.renderFixed(L, id);
    this.renderScene(L.page, id, L);
    this.preloadNext(id);

    ready([].slice.call(L.querySelectorAll("img")).filter(function (i) { return !i.classList.contains("proto__piece--hover"); }), 1500).then(function () {
      if (tok !== self.tok) { if (L.parentNode) L.remove(); return; } // 그사이 다른 화면을 눌렀으면 버림
      L.style.visibility = "";
      self.transition(old, L, opt.t);
      if (s.timeout) self.timer = setTimeout(function () { self.go(s.timeout.to, { noHist: true, t: s.timeout.t }); }, s.timeout.ms);
    });
  };

  // 이전 층(a) → 새 층(b) 전환. 피그마 전환 종류를 그대로 흉내 냄
  Proto.prototype.transition = function (a, b, t) {
    var stage = this.stage;
    // 이전 전환이 아직 남아 있으면 정리
    [].slice.call(stage.children).forEach(function (c) { if (c !== a && c !== b) c.remove(); });
    if (!a) return;
    if (!t || REDUCED || !b.animate) { a.remove(); return; }
    var ms = t.ms || 300, ease = EASE[t.e] || EASE.EASE_OUT, v = VEC[t.d] || [-1, 0];
    var opt = { duration: ms, easing: ease, fill: "both" }, anims = [];
    stage.classList.add("is-moving");
    if (t.k === "smart" || t.k === "dissolve") {
      // Smart Animate(그림 두 장 사이) / Dissolve: 같은 부분은 그대로, 바뀌는 부분만 서서히
      anims.push(b.animate([{ opacity: 0 }, { opacity: 1 }], opt));
    } else if (t.k === "movein") {
      anims.push(b.animate([{ transform: tr(v, -100) }, { transform: "translate(0,0)" }], opt));
    } else if (t.k === "moveout") {
      stage.insertBefore(b, a);                            // 새 화면은 아래, 이전 화면이 밀려 나감
      anims.push(a.animate([{ transform: "translate(0,0)" }, { transform: tr(v, 100) }], opt));
    } else if (t.k === "push") {
      anims.push(b.animate([{ transform: tr(v, -100) }, { transform: "translate(0,0)" }], opt));
      anims.push(a.animate([{ transform: "translate(0,0)" }, { transform: tr(v, 100) }], opt));
    } else if (t.k === "slidein") {
      anims.push(b.animate([{ transform: tr(v, -100) }, { transform: "translate(0,0)" }], opt));
      anims.push(a.animate([{ transform: "translate(0,0)" }, { transform: tr(v, 30) }], opt));
    } else if (t.k === "slideout") {
      stage.insertBefore(b, a);
      anims.push(a.animate([{ transform: "translate(0,0)" }, { transform: tr(v, 100) }], opt));
      anims.push(b.animate([{ transform: tr(v, -30) }, { transform: "translate(0,0)" }], opt));
    } else if (t.k === "sheetup" || t.k === "sheetdown") {
      // 위(검색·칩)와 아래(GNB)는 그대로, 가운데 목록 시트만 미끄러짐 (화면 전체가 올라오면 어색해서)
      var top = t.top, bot = t.bot, d = t.d;
      var open = [{ transform: "translateY(" + d + "px)", clipPath: "inset(" + top + "px 0 " + (bot + d) + "px 0)" }, { transform: "translateY(0)", clipPath: "inset(" + top + "px 0 " + bot + "px 0)" }];
      if (t.k === "sheetup") anims.push(b.animate(open, opt));
      else { stage.insertBefore(b, a); anims.push(a.animate(open.slice().reverse(), opt)); }
    } else { a.remove(); stage.classList.remove("is-moving"); return; }
    Promise.all(anims.map(function (x) { return x.finished.catch(function () {}); })).then(function () {
      if (a.parentNode) a.remove();
      anims.forEach(function (x) { try { x.cancel(); } catch (e) {} });
      stage.classList.remove("is-moving");
    });
  };

  Proto.prototype.back = function () {
    if (this.ov) { this.closeOv(); return; }
    if (this.gnbOpen) { this.setGnb(false); return; }
    var prev = this.hist.pop(); if (!prev) return;
    this.go(prev.id, { noHist: true, t: reverse(prev.t) }); // 피그마처럼 반대로 돌아감
    if (prev.ov) { var self = this; setTimeout(function () { if (self.cur === prev.id) self.openOv(prev.ov, { k: "dissolve", ms: 250, e: "EASE_OUT" }); }, 120); } // 팝업 위에서 넘어왔으면 팝업도 다시
  };

  // 한 장(본 화면 또는 겹친 화면)을 그림
  Proto.prototype.renderPage = function (box, id) {
    var self = this, s = this.d.screens[id];
    var st = s.state ? (this.stateOf[id] || s.state.def) : null;
    box.innerHTML = "";
    box.style.height = ((st && s.state.h && s.state.h[st]) || s.h || H) + "px";
    var img = el("img", "proto__img", box);
    img.alt = s.alt || ""; img.draggable = false; img.decoding = "async";
    img.src = this.src(st ? s.state.imgs[st] : s.img);
    (s.hs || []).forEach(function (h, i) {
      if (h.when && h.when !== st) return;
      if (h.fix && box === self.page) return;              // 고정 바 위의 핫스팟은 renderFixed에서
      if (h.flip) {
        var f = el("div", "proto__flip", box); place(f, h.b);
        f.style.backgroundImage = "url(" + self.src(s.flip) + ")";
        f.style.backgroundSize = W + "px auto";
        f.style.backgroundPosition = (-h.b[0]) + "px " + (-h.b[1]) + "px";
        var key = id + ":" + i;
        if (self.flips[key]) f.classList.add("is-on");
        self.hotspot(box, h, function () { self.flips[key] = !self.flips[key]; f.classList.toggle("is-on", self.flips[key]); });
        return;
      }
      self.hotspot(box, h, function () { self.act(h, id); });
    });
    return img;
  };

  // 웹 전용 (2026-11-23): 흐르는 글자(marquee) / 위에 덮는 그림(layers) / 섹션 동안 고정(sticky) / 화면에 들어오면 등장(enter)
  //   / 부품 애니메이션(rigs: 피그마 Smart Animate처럼 부품의 위치·회전을 변형 값대로 움직임)
  Proto.prototype.renderScene = function (box, id, L) {
    var self = this, s = this.d.screens[id];
    (s.marquee || []).forEach(function (m) {
      var w = el("div", "proto__marquee", box); place(w, m.b);
      var im = el("img", "proto__marquee-strip", w); im.src = self.src(m.img); im.alt = ""; im.draggable = false;
      im.style.width = m.w + "px"; im.style.height = m.b[3] + "px";
      im.style.setProperty("--period", -m.period + "px"); im.style.animationDuration = m.sec + "s";
    });
    (s.layers || []).forEach(function (ly) { var im = el("img", "proto__piece", box); place(im, ly.b); im.src = self.src(ly.img); im.alt = ""; im.draggable = false; });
    (s.sticky || []).forEach(function (st) {
      var w = el("div", "proto__sticky", box); place(w, [st.b[0], st.range[0], st.b[2], st.range[1] - st.range[0]]);
      var im = el("img", "proto__sticky-img", w); im.src = self.src(st.img); im.alt = ""; im.draggable = false;
      im.style.width = st.b[2] + "px"; im.style.height = st.b[3] + "px"; im.style.marginTop = (st.b[1] - st.range[0]) + "px"; im.style.top = st.top + "px";
    });
    (s.enter || []).forEach(function (en) {
      var im = el("img", "proto__piece proto__enter proto__enter--" + en.anim, box); place(im, en.b); im.src = self.src(en.img); im.alt = ""; im.draggable = false;
      if (REDUCED || !("IntersectionObserver" in window)) { im.classList.add("is-in"); return; }
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { im.classList.add("is-in"); io.disconnect(); } }); }, { root: L.scroll, threshold: 0.35 });
      io.observe(im);
    });
    // 저절로 바뀌는 그림 (피그마 AFTER_TIMEOUT 변형 순환: 변형마다 머무는 시간 그대로)
    (s.loops || []).forEach(function (lp) {
      var ims = lp.imgs.map(function (n, i) { var im = el("img", "proto__piece proto__loop", box); place(im, lp.b[i] || lp.b[0]); im.src = self.src(n); im.alt = ""; im.style.opacity = i ? 0 : 1; if (lp.fade) im.style.transition = "opacity " + lp.fade + "ms ease-in-out"; return im; });
      var i = 0; var step = function () { var d = lp.delays[i]; self.timers.push(setTimeout(function () { ims[i].style.opacity = 0; i = (i + 1) % ims.length; ims[i].style.opacity = 1; step(); }, d)); };
      if (!REDUCED) step();
    });
    // 마우스를 올린 줄에 따라 다른 그림 (피그마 text_block: 줄마다 상태가 바뀌고 마지막 상태 유지)
    (s.rows || []).forEach(function (rw) {
      var ims = rw.imgs.map(function (n, i) { var im = el("img", "proto__piece proto__fade", box); place(im, (rw.bs && rw.bs[i]) || rw.b); im.src = self.src(n); im.alt = ""; im.style.transitionDuration = rw.ms + "ms"; im.style.opacity = i === (rw.def || 0) ? 1 : 0; return im; });
      var cur = rw.def || 0;
      box.addEventListener("mousemove", function (e) {
        var rc = box.getBoundingClientRect(), k = rc.width / W, x = (e.clientX - rc.left) / k, y = (e.clientY - rc.top) / k;
        rw.hit.forEach(function (h) { if (x >= h[0] && x <= h[0] + h[2] && y >= h[1] && y <= h[1] + h[3] && cur !== h[4]) { ims[cur].style.opacity = 0; cur = h[4]; ims[cur].style.opacity = 1; } });
      });
    });
    // 눌러서 밀어 넘기는 영역 (피그마 CHANGE_TO + Smart Animate: 안쪽 내용이 실제로 미끄러짐)
    (s.slides || []).forEach(function (sl) {
      var c = el("div", "proto__clip-box", box); place(c, sl.clip); if (sl.bg) c.style.background = sl.bg;
      var strip = el("div", "proto__slide-strip", c);
      strip.style.transition = REDUCED ? "none" : "transform " + sl.ms + "ms " + (EASE[sl.e] || EASE.EASE_OUT);
      var im = el("img", "proto__slide-img", strip); im.src = self.src(sl.img); im.alt = ""; im.draggable = false;
      place(im, [sl.at[0], sl.at[1], sl.w, sl.h]);
      if (sl.video) { var v = self.video(strip, sl.video); }
      if (sl.over) { var ov = el("img", "proto__piece", box); place(ov, sl.over.b); ov.src = self.src(sl.over.img); ov.alt = ""; }
      (sl.fixed || []).forEach(function (f) { var fi = el("img", "proto__piece", box); place(fi, f.b); fi.src = self.src(f.img); fi.alt = ""; });
      var st = sl.start || 0; var set = function () { var o = sl.offs[st]; strip.style.transform = "translate(" + o[0] + "px," + o[1] + "px)"; };
      set();
      sl.hs.forEach(function (b) { self.hotspot(box, { b: b, label: "넘기기" }, function () { st = (st + 1) % sl.offs.length; set(); }); });
    });
    // 세로 스크롤 영역 (피그마 overflow VERTICAL: 시트 안 목록 등). 안의 핫스팟·가로 줄도 함께 움직임
    function adoptHotspots(host, inner, r, cw, ch) {
      [].slice.call(host.querySelectorAll(":scope > .proto__hs")).forEach(function (h) {
        var x = parseFloat(h.style.left), y = parseFloat(h.style.top), hw = parseFloat(h.style.width), hh = parseFloat(h.style.height);
        if (x >= r[0] - 1 && y >= r[1] - 1 && x + hw <= r[0] + cw + 1 && y + hh <= r[1] + ch + 1) { inner.appendChild(h); h.style.left = (x - r[0]) + "px"; h.style.top = (y - r[1]) + "px"; }
      });
    }
    function makeH(host, hz) {
      var w = el("div", "proto__hscroll", host); place(w, hz.b); w.style.background = hz.bg || "#fff"; w.setAttribute("data-lenis-prevent", "");
      var inner = el("div", "proto__hscroll-in", w); inner.style.width = hz.cw + "px"; inner.style.height = hz.b[3] + "px";
      var im = el("img", "proto__piece", inner); place(im, hz.ib); im.src = self.src(hz.img); im.alt = ""; im.draggable = false;
      adoptHotspots(host, inner, hz.b, hz.cw, hz.b[3]);
      var down = null, moved = false;
      w.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") return; down = { x: e.clientX, sl: w.scrollLeft }; moved = false; });
      window.addEventListener("pointermove", function (e) { if (!down) return; var dx = e.clientX - down.x; if (Math.abs(dx) > 4) moved = true; if (moved) w.scrollLeft = down.sl - dx / (w.getBoundingClientRect().width / w.offsetWidth); });
      window.addEventListener("pointerup", function () { down = null; });
      w.addEventListener("click", function (e) { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
      return w;
    }
    (s.vscroll || []).forEach(function (vz) {
      var w = el("div", "proto__vscroll", box); place(w, vz.b); w.style.background = vz.bg || "#fff"; w.setAttribute("data-lenis-prevent", "");
      if (vz.when) { w.dataset.when = vz.when; var st0 = s.state ? (self.stateOf[id] || s.state.def) : null; w.style.display = st0 === vz.when ? "" : "none"; }
      var inner = el("div", "proto__vscroll-in", w); inner.style.height = vz.ch + "px";
      var im = el("img", "proto__piece", inner); place(im, vz.ib); im.src = self.src(vz.img); im.alt = ""; im.draggable = false;
      adoptHotspots(box, inner, vz.b, vz.b[2], vz.ch);
      (vz.hscroll || []).forEach(function (hz) { makeH(inner, hz); });
    });
    (s.hscroll || []).forEach(function (hz) { makeH(box, hz); });
    if (false) // 이전 방식(아래) 비활성
    // 가로 스크롤 영역 (피그마 overflow HORIZONTAL): 잘려 있던 내용 전체를 옆으로 밀 수 있게. 그 안의 핫스팟도 함께 움직임
    (s.hscroll || []).forEach(function (hz) {
      var w = el("div", "proto__hscroll", box); place(w, hz.b); w.style.background = hz.bg || "#fff"; w.setAttribute("data-lenis-prevent", "");
      var inner = el("div", "proto__hscroll-in", w); inner.style.width = hz.cw + "px"; inner.style.height = hz.b[3] + "px";
      var im = el("img", "proto__piece", inner); place(im, hz.ib); im.src = self.src(hz.img); im.alt = ""; im.draggable = false;
      [].slice.call(box.querySelectorAll(":scope > .proto__hs")).forEach(function (h) {
        var x = parseFloat(h.style.left), y = parseFloat(h.style.top), hw = parseFloat(h.style.width), hh = parseFloat(h.style.height);
        if (x >= hz.b[0] - 1 && y >= hz.b[1] - 1 && x + hw <= hz.b[0] + hz.cw + 1 && y + hh <= hz.b[1] + hz.b[3] + 1) { inner.appendChild(h); h.style.left = (x - hz.b[0]) + "px"; h.style.top = (y - hz.b[1]) + "px"; }
      });
      // 마우스로 끌어서 넘기기 (끌었을 때는 클릭 막기)
      var down = null, moved = false;
      w.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") return; down = { x: e.clientX, sl: w.scrollLeft }; moved = false; });
      window.addEventListener("pointermove", function (e) { if (!down) return; var dx = e.clientX - down.x; if (Math.abs(dx) > 4) moved = true; if (moved) w.scrollLeft = down.sl - dx / (w.getBoundingClientRect().width / w.offsetWidth); });
      window.addEventListener("pointerup", function () { down = null; });
      w.addEventListener("click", function (e) { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    });
    // 겹쳐 쌓이는 카드 (스크롤하면 위 카드는 붙어 있고 아래 카드가 올라와 덮음). 카드 안은 눌러서 미끄러지는 내용(slide) 또는 그림
    (s.stack || []).forEach(function (stk) {
      var wrap = el("div", "proto__stack", box); place(wrap, stk.b);
      stk.cards.forEach(function (cd) {
        var card = el("div", "proto__stack-card", wrap); card.style.height = cd.h + "px"; card.style.top = (stk.top || 0) + "px"; if (cd.bg) card.style.background = cd.bg;
        if (cd.img) { var ci = el("img", "proto__piece", card); place(ci, [0, 0, stk.b[2], cd.h]); ci.src = self.src(cd.img); ci.alt = ""; }
        var sl = cd.slide; if (!sl) return;
        var strip = el("div", "proto__slide-strip", card);
        strip.style.transition = REDUCED ? "none" : "transform " + sl.ms + "ms " + (EASE[sl.e] || EASE.EASE_OUT);
        var im = el("img", "proto__slide-img", strip); im.src = self.src(sl.img); im.alt = ""; im.draggable = false; place(im, [sl.at[0], sl.at[1], sl.w, sl.h]);
        var st = sl.start || 0; var set = function () { var o = sl.offs[st]; strip.style.transform = "translate(" + o[0] + "px," + o[1] + "px)"; }; set();
        sl.hs.forEach(function (b) { self.hotspot(card, { b: b, label: "넘기기" }, function () { st = (st + 1) % sl.offs.length; set(); }); });
      });
    });
    // 캐러셀 (피그마 carousel_inner: 화살표로 변형 전환, Smart Animate 1200ms → 겹쳐 바뀜). 슬라이드는 영상 또는 그림
    (s.carousels || []).forEach(function (cr) {
      var wrap = el("div", "proto__clip-box", box); place(wrap, cr.b); wrap.style.borderRadius = (cr.r || 0) + "px";
      var slides = cr.slides.map(function (sd, i) {
        var d = el("div", "proto__car-slide", wrap); d.style.opacity = i ? 0 : 1; d.style.transition = "opacity " + cr.ms + "ms ease-in-out";
        if (sd.video) { var v = self.video(d, { b: [0, 0, cr.b[2], cr.b[3]], src: sd.video }); d._v = v; if (i) v.pause(); }
        else { var im = el("img", "proto__piece", d); place(im, [0, 0, cr.b[2], cr.b[3]]); im.src = self.src(sd.img); im.alt = ""; }
        return d;
      });
      var ovs = cr.over.map(function (o, i) { var im = el("img", "proto__piece", box); place(im, o.b); im.src = self.src(o.img); im.alt = ""; im.style.opacity = i ? 0 : 1; im.style.transition = "opacity " + cr.ms + "ms ease-in-out"; return im; });
      var cur = 0; var go = function (n) {
        n = (n + slides.length) % slides.length; if (n === cur) return;
        if (slides[n]._v) { try { slides[n]._v.currentTime = 0; slides[n]._v.play(); } catch (e) {} }
        slides[cur].style.opacity = 0; ovs[cur].style.opacity = 0; slides[n].style.opacity = 1; ovs[n].style.opacity = 1;
        var old = slides[cur]; setTimeout(function () { if (old._v && old.style.opacity === "0") old._v.pause(); }, cr.ms);
        cur = n;
      };
      self.hotspot(box, { b: cr.prev, label: "이전" }, function () { go(cur - 1); });
      self.hotspot(box, { b: cr.next, label: "다음" }, function () { go(cur + 1); });
    });
    // 스크롤 위치에 따라 글자색이 자연스럽게 바뀜 (그림 여러 장을 스크롤 진행률만큼 겹침)
    (s.scrub || []).forEach(function (sc) {
      var ims = sc.imgs.map(function (n, i) { var im = el("img", "proto__piece", box); place(im, sc.b); im.src = self.src(n); im.alt = ""; im.style.opacity = i ? 0 : 1; return im; });
      var upd = function () {
        var t = L.scroll.scrollTop, p = Math.max(0, Math.min(1, (t - sc.range[0]) / (sc.range[1] - sc.range[0]))), f = p * (ims.length - 1);
        for (var i = 1; i < ims.length; i++) ims[i].style.opacity = Math.max(0, Math.min(1, f - (i - 1))).toFixed(3);
      };
      L.scroll.addEventListener("scroll", upd, { passive: true }); upd();
    });
    // 영상 (자동재생·소리 없음·반복)
    (s.videos || []).forEach(function (vd) { self.video(box, vd); });
    (s.layersTop || []).forEach(function (ly) { var im = el("img", "proto__piece", box); place(im, ly.b); im.src = self.src(ly.img); im.alt = ""; im.draggable = false; });
    var rigs = (s.rigs || []).filter(function (r) { return !r.fix; });
    if (rigs.length) this.bindRigs(box, rigs);
    if (s.fixed && s.fixed.top && s.fixed.top.shift) {        // 스크롤하면 맨 위 빨간 띠가 사라지고 메뉴가 올라붙음 (피그마 header state=false)
      var top = L.fixTop, sh = s.fixed.top.shift;
      L.scroll.addEventListener("scroll", function () { top.classList.toggle("is-shifted", L.scroll.scrollTop > 8); top.style.setProperty("--shift", -sh + "px"); }, { passive: true });
    }
  };

  Proto.prototype.video = function (host, vd) {
    var v = el("video", "proto__video", host); place(v, vd.b);
    v.muted = true; v.defaultMuted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.preload = "auto";
    v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("aria-hidden", "true");
    if (vd.poster) v.poster = this.src(vd.poster);
    v.src = vd.src; var p = v.play(); if (p && p.catch) p.catch(function () {});
    return v;
  };

  // 부품 애니메이션: r = { b:[x,y,w,h](인스턴스 자리), s:배율, hit:[x,y,w,h], parts:[{img,w,h,st:[행렬…]}], seq:[[상태,ms,이징]…], back:[ms,이징] }
  Proto.prototype.bindRigs = function (box, rigs) {
    var self = this;
    rigs.forEach(function (r) {
      var c = el("div", "proto__rig", box); place(c, r.b);
      var inner = el("div", "proto__rig-in", c); inner.style.transform = "scale(" + r.s + ")";
      r._els = r.parts.map(function (p) {
        var im = el("img", "proto__rig-part", inner); im.src = self.src(p.img); im.alt = ""; im.draggable = false;
        im.style.width = p.w + "px"; im.style.height = p.h + "px"; im.style.transform = "matrix(" + p.st[0].join(",") + ")";
        return im;
      });
      r._on = false; r._t = [];
      if (r.loop && !REDUCED) {                              // 계속 반복 (피그마 AFTER_TIMEOUT 0초 + Smart Animate 순환)
        var k = 0; var tick = function () { var st = r.seq[k]; go(r, st[0], st[1], st[2]); k = (k + 1) % r.seq.length; self.timers.push(setTimeout(tick, st[1])); };
        self.timers.push(setTimeout(tick, 300));
      }
    });
    function go(r, state, ms, ease) {
      r._els.forEach(function (im, i) { im.style.transition = REDUCED ? "none" : "transform " + ms + "ms " + (EASE[ease] || EASE.EASE_OUT); im.style.transform = "matrix(" + r.parts[i].st[state].join(",") + ")"; });
    }
    function enter(r) {
      r._on = true; r._t.forEach(clearTimeout); r._t = []; var at = 0;
      r.seq.forEach(function (st) { r._t.push(setTimeout(function () { if (r._on) go(r, st[0], st[1], st[2]); }, at)); at += st[1]; });
    }
    function leave(r) { r._on = false; r._t.forEach(clearTimeout); r._t = []; go(r, 0, r.back[0], r.back[1]); }
    function onMove(e) {
      var rc = box.getBoundingClientRect(), k = rc.width / W, x = (e.clientX - rc.left) / k, y = (e.clientY - rc.top) / k;
      rigs.forEach(function (r) { if (r.loop) return; var h = r.hit, inn = x >= h[0] && x <= h[0] + h[2] && y >= h[1] && y <= h[1] + h[3]; if (inn && !r._on) enter(r); else if (!inn && r._on) leave(r); });
    }
    box.addEventListener("mousemove", onMove);
    box.addEventListener("mouseleave", function () { rigs.forEach(function (r) { if (r._on && !r.loop) leave(r); }); });
  };

  Proto.prototype.bindHover = function (box, list) {
    var self = this;
    list.forEach(function (hv) { hv._els = hv.show.map(function (p) { var im = el("img", "proto__piece proto__piece--hover", box); place(im, p.b); im.src = self.src(p.img); im.alt = ""; if (hv.ms !== undefined) im.style.transitionDuration = hv.ms + "ms"; return im; }); });
    box.addEventListener("mousemove", function (e) {
      var r = box.getBoundingClientRect(), k = r.width / W, x = (e.clientX - r.left) / k, y = (e.clientY - r.top) / k;
      list.forEach(function (hv) { var b = hv.b, on = x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3]; hv._els.forEach(function (im) { im.classList.toggle("is-on", on); }); });
    });
    box.addEventListener("mouseleave", function () { list.forEach(function (hv) { hv._els.forEach(function (im) { im.classList.remove("is-on"); }); }); });
  };

  // 웹 전용: 마우스를 올리면 바뀌는 부분(hover) / 저절로 넘어가는 이미지(cycles)
  Proto.prototype.renderExtras = function (box, id) {
    var self = this, s = this.d.screens[id];
    (s.cycles || []).forEach(function (c) {
      var im = el("img", "proto__piece", box); place(im, c.b); im.alt = ""; im.style.opacity = 0;
      var i = -1;
      self.timers.push(setInterval(function () { i = (i + 1) % (c.imgs.length + 1); if (i === c.imgs.length) im.style.opacity = 0; else { im.src = self.src(c.imgs[i]); im.style.opacity = 1; } }, Math.max(400, c.ms)));
    });
    if (!s.hover || !s.hover.length) { box.onmousemove = box.onmouseleave = null; return; }
    s.hover.forEach(function (hv) {
      var host = box;
      if (hv.clip) { host = el("div", "proto__clip-box", box); place(host, hv.clip); host.style.borderRadius = (hv.clip[4] || 0) + "px"; } // 카드 안에서만 보이게
      hv._els = hv.show.map(function (p) {
        var im = el("img", "proto__piece proto__piece--hover" + (p.from ? " proto__piece--slide" : ""), host); place(im, hv.clip ? [p.b[0] - hv.clip[0], p.b[1] - hv.clip[1], p.b[2], p.b[3]] : p.b); im.alt = ""; im.dataset.src = self.src(p.img);
        if (hv.ms) { im.style.transitionDuration = hv.ms + "ms"; im.style.transitionTimingFunction = EASE[hv.e] || EASE.EASE_OUT; }
        if (p.from) im.style.setProperty("--from", "translate(" + p.from[0] + "px," + p.from[1] + "px)");
        return im;
      });
    });
    box.onmousemove = function (e) {
      var r = box.getBoundingClientRect(), k = r.width / W, x = (e.clientX - r.left) / k, y = (e.clientY - r.top) / k;
      s.hover.forEach(function (hv) {
        var b = hv.b, on = x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3];
        hv._els.forEach(function (im) { if (on && !im.src) im.src = im.dataset.src; im.classList.toggle("is-on", on); });
      });
    };
    box.onmouseleave = function () { s.hover.forEach(function (hv) { hv._els.forEach(function (im) { im.classList.remove("is-on"); }); }); };
  };

  Proto.prototype.renderFixed = function (L, id) {
    var self = this, s = this.d.screens[id], f = s.fixed || {};
    [["top", L.fixTop], ["bot", L.fixBot]].forEach(function (p) {
      var box = p[1], F = f[p[0]];
      box.innerHTML = ""; box.style.display = F ? "block" : "none";
      if (!F) return;
      box.style.height = F.h + "px";
      if (F.items) F.items.forEach(function (it) { var im = el("img", "proto__piece", box); place(im, it.b); im.src = self.src(it.img); im.alt = ""; im.draggable = false; });
      else { var img = el("img", "proto__img", box); img.src = self.src(F.img); img.alt = ""; img.draggable = false; }
      (s.hs || []).forEach(function (h) { if (h.fix === p[0]) self.hotspot(box, h, function () { self.act(h, id); }); });
      var rg = (s.rigs || []).filter(function (r) { return r.fix === p[0]; });
      if (rg.length) self.bindRigs(box, rg);
      if (F.hover && F.hover.length) self.bindHover(box, F.hover);   // 헤더 메뉴 호버 (피그마 gnb state=hover)
    });
  };

  Proto.prototype.hotspot = function (box, h, fn) {
    var b = el("button", "proto__hs", box); b.type = "button"; place(b, h.b);
    b.setAttribute("aria-label", h.label || "누르기");
    b.setAttribute("data-cursor", "[ 누르기 ]");
    b.addEventListener("click", function (e) { e.stopPropagation(); fn(); });
    return b;
  };

  Proto.prototype.act = function (h, id) {
    if (h.nav) { this.go(h.nav, { t: h.t }); return; }
    if (h.ov) { this.openOv(h.ov, h.t); return; }
    if (h.close) { this.closeOv(); return; }
    if (h.back) { this.back(); return; }
    if (h.toggle) { var t = this.page.querySelector('[data-tg="' + h.toggle.img + '"]'); if (!t) { t = el("img", "proto__piece", this.page); place(t, h.toggle.b); t.src = this.src(h.toggle.img); t.alt = ""; t.dataset.tg = h.toggle.img; requestAnimationFrame(function () { t.classList.add("is-on"); }); } else t.classList.toggle("is-on"); return; }
    if (h.scroll !== undefined) { this.scroll.scrollTo({ top: h.scroll, behavior: "smooth" }); return; }
    if (h.set) { this.setState(id, h.set); return; }
    if (h.gnb !== undefined) { this.setGnb(!!h.gnb); return; }
  };

  // 같은 화면의 다른 상태(피그마 CHANGE_TO, 즉시): 새 그림이 준비되면 그 자리에서 바로 바꿈 — 스크롤 위치 유지
  Proto.prototype.setState = function (id, val) {
    var self = this, s = this.d.screens[id];
    this.stateOf[id] = val;
    var pre = new Image(); pre.src = this.src(s.state.imgs[val]);
    ready([pre], 1000).then(function () {
      if (self.stateOf[id] !== val) return;
      var box = (self.ov === id) ? self.ovPanel : self.page;
      var top = self.scroll ? self.scroll.scrollTop : 0;
      var keep = s.state.fade && !REDUCED ? box.querySelector(":scope > .proto__img") : null;   // 앱처럼 부드럽게: 이전 모습을 잠깐 위에 두고 사라지게
      if (keep) keep.parentNode.removeChild(keep);
      var extras = [].slice.call(box.children).filter(function (c) { return !c.classList.contains("proto__img") && !c.classList.contains("proto__hs") && !c.classList.contains("proto__flip"); });
      self.renderPage(box, id);
      extras.forEach(function (c) { box.appendChild(c); if (c.dataset && c.dataset.when) c.style.display = c.dataset.when === val ? "" : "none"; });
      if (keep) { keep.classList.add("proto__img--leaving"); keep.style.position = "absolute"; keep.style.left = 0; keep.style.top = 0; box.insertBefore(keep, box.children[1] || null);
        keep.animate([{ opacity: 1 }, { opacity: 0 }], { duration: s.state.fade, easing: EASE.EASE_OUT, fill: "forwards" }).finished.catch(function () {}).then(function () { keep.remove(); });
        var fresh = box.querySelector(":scope > .proto__img:not(.proto__img--leaving)"); if (fresh) fresh.animate([{ transform: "translateY(6px)", opacity: 0.6 }, { transform: "none", opacity: 1 }], { duration: s.state.fade, easing: EASE.EASE_OUT }); }
      if (box === self.page) self.scroll.scrollTop = top;
    });
  };

  Proto.prototype.openOv = function (id, t) {
    var self = this, s = this.d.screens[id];
    this.ov = id; this.ovT = t;
    clearTimeout(this.ovClose);
    this.ovLayer.innerHTML = "";
    this.ovLayer.className = "proto__ovl pos-" + s.pos + (s.dim === false ? " no-dim" : "");
    this.ovPanel = el("div", "proto__ovp", this.ovLayer);
    this.ovPanel.style.width = (s.w || W) + "px";
    var img = this.renderPage(this.ovPanel, id);
    // 피그마 기본: 아래 시트는 아래에서 올라옴(Move in ↑ 300ms), 가운데 팝업은 즉시
    if (!t && s.pos === "bottom") t = { k: "movein", d: "TOP", ms: 300, e: "EASE_OUT" };
    this.ovT = t;
    ready([img], 1200).then(function () {
      if (self.ov !== id) return;
      self.ovLayer.classList.add("is-open");
      if (!t || REDUCED || !self.ovPanel.animate) return;
      var o = { duration: t.ms || 300, easing: EASE[t.e] || EASE.EASE_OUT };
      if (s.dim !== false) self.ovLayer.animate([{ backgroundColor: "rgba(0,0,0,0)" }, { backgroundColor: "rgba(0,0,0,0.4)" }], o);
      if (t.k === "movein" || t.k === "slidein" || t.k === "push") self.ovPanel.animate([{ transform: tr(VEC[t.d] || [0, -1], -100) }, { transform: "translate(0,0)" }], o);
      else self.ovPanel.animate([{ opacity: 0 }, { opacity: 1 }], o);
    });
  };
  Proto.prototype.closeOv = function (instant, mode) {
    var self = this, layer = this.ovLayer, panel = this.ovPanel, t = this.ovT;
    if (mode === "fade" && !instant && layer.animate && !REDUCED) {
      this.ov = null; layer.style.pointerEvents = "none";
      layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, easing: EASE.EASE_OUT, fill: "forwards" }).finished.catch(function () {}).then(function () { layer.style.pointerEvents = ""; layer.getAnimations().forEach(function (a) { a.cancel(); }); if (!self.ov) { layer.className = "proto__ovl"; layer.innerHTML = ""; } });
      return;
    }
    this.ov = null;
    var done = function () { if (self.ov) return; layer.className = "proto__ovl"; layer.innerHTML = ""; };
    if (instant || !t || REDUCED || !panel || !panel.animate) { done(); return; }
    // 피그마처럼 들어온 길로 되돌아 나감
    var o = { duration: t.ms || 300, easing: EASE.EASE_IN, fill: "forwards" };
    if (!layer.classList.contains("no-dim")) layer.animate([{ backgroundColor: "rgba(0,0,0,0.4)" }, { backgroundColor: "rgba(0,0,0,0)" }], o);
    var a = (t.k === "movein" || t.k === "slidein" || t.k === "push")
      ? panel.animate([{ transform: "translate(0,0)" }, { transform: tr(VEC[t.d] || [0, -1], -100) }], o)
      : panel.animate([{ opacity: 1 }, { opacity: 0 }], o);
    layer.style.pointerEvents = "none";
    a.finished.catch(function () {}).then(function () { layer.style.pointerEvents = ""; done(); });
  };

  Proto.prototype.setGnb = function (open) {
    var g = this.d.gnb, self = this;
    if (g.parts) return this.setGnbParts(open);
    this.gnbOpen = open;
    if (!open) {                                           // 접을 때도 살짝 사라지게
      var layer = this.gnbLayer;
      if (layer.animate && !REDUCED && layer.classList.contains("is-open")) {
        layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: EASE.EASE_IN }).finished.catch(function () {}).then(function () { if (!self.gnbOpen) { layer.classList.remove("is-open"); layer.innerHTML = ""; } });
      } else { layer.classList.remove("is-open"); layer.innerHTML = ""; }
      return;
    }
    this.gnbLayer.innerHTML = "";
    this.gnbLayer.classList.add("is-open");
    var img = el("img", "proto__img", this.gnbLayer); img.src = this.src(g.img); img.alt = ""; img.draggable = false;
    g.hs.forEach(function (h) { self.hotspot(self.gnbLayer, h, function () { self.act(h, self.cur); }); });
  };

  // 기록 메뉴(피그마 gnb 속성 1=베리언트2): 보던 화면 위로 검은 막 50% + 가운데 버튼 45° 회전 + 카드 두 장이 떠오름 (300ms)
  Proto.prototype.setGnbParts = function (open) {
    var g = this.d.gnb, P = g.parts, self = this, L = this.gnbLayer;
    if (open === this.gnbOpen && L.childNodes.length) return;
    this.gnbOpen = open;
    clearTimeout(this._gnbT);
    if (open) {
      L.innerHTML = ""; L.classList.add("is-open", "proto__gnb--parts");
      var dim = el("div", "proto__gnb-dim", L); place(dim, P.dim);
      var cards = el("img", "proto__gnb-cards", L); place(cards, P.cards.b); cards.src = this.src(P.cards.img); cards.alt = "";
      var patch = el("div", "proto__gnb-patch", L); place(patch, P.patch);
      var btn = el("img", "proto__gnb-btn", L); place(btn, P.btn.b); btn.src = this.src(P.btn.img); btn.alt = ""; btn.style.transformOrigin = P.btn.o[0] + "px " + P.btn.o[1] + "px";
      g.hs.forEach(function (h) { self.hotspot(L, h, function () { self.act(h, self.cur); }); });
      this._gnbEls = { dim: dim, cards: cards, btn: btn };
      void L.offsetWidth;
      L.classList.add("is-on");
    } else {
      L.classList.remove("is-on");
      this._gnbT = setTimeout(function () { if (!self.gnbOpen) { L.innerHTML = ""; L.classList.remove("is-open", "proto__gnb--parts"); } }, REDUCED ? 0 : 300);
    }
  };

  function init() {
    document.querySelectorAll("[data-proto]").forEach(function (r) {
      var d = window.PROTO_DATA && window.PROTO_DATA[r.getAttribute("data-proto")];
      if (d) r._proto = new Proto(r, d);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
