/* ============================================================
   V9.1 首启引导
   ------------------------------------------------------------
   目标不是"教功能"，是回答三个问题：
     1. 这是什么？（不是房贷计算器，是把 30 年账摊开的决策工具）
     2. 我该做什么？（选城市 → 填数字 → 开始推演）
     3. 然后呢？（房源里有真房子；报告先给结论再给证据）
   只出现一次；「我的」里可以再看；?guide=1 强制打开（验收用）。
   ============================================================ */
(function () {
  "use strict";

  var KEY = "jw_onboard_v1";
  var ID = "jwOnboard";
  var idx = 0;

  var SLIDES = [
    {
      icon: "🧭",
      title: "这不是房贷计算器",
      body: "它把未来 30 年的账摊开：租几年、贷几年、首付怎么付，哪一种最不把生活压垮。\n结论先给你，证据在后面。",
      tip: "我们只算代价，不替你签字。"
    },
    {
      icon: "🏙️",
      title: "先选城市，再填数字",
      body: "同样 100 万，在南宁和在深圳是两种人生。\n在地图上点城市、点片区，然后填收入、存款、想住多大。",
      tip: "不知道总价就填 0，只填面积也能算。"
    },
    {
      icon: "🏠",
      title: "房源里是真好房",
      body: "「房源」里有 34 套二手房和 852 个新房户型。\n点一张卡片，总价和面积会自动填进推演。",
      tip: "没有数据的城市会如实说没有，我们不编。"
    }
  ];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function build() {
    var old = document.getElementById(ID);
    if (old) return old;
    var box = document.createElement("div");
    box.id = ID;
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.innerHTML =
      '<div class="jw-ob-card">' +
      '<button type="button" class="jw-ob-skip" data-ob="skip">跳过</button>' +
      '<div class="jw-ob-emoji" id="jwObEmoji"></div>' +
      '<h2 class="jw-ob-title" id="jwObTitle"></h2>' +
      '<p class="jw-ob-text" id="jwObText"></p>' +
      '<p class="jw-ob-tip" id="jwObTip"></p>' +
      '<div class="jw-ob-dots" id="jwObDots"></div>' +
      '<div class="jw-ob-actions">' +
      '<button type="button" class="jw-ob-next" data-ob="next" id="jwObNext">下一步</button>' +
      "</div>" +
      '<p class="jw-ob-foot">匿名统计可在「我的 → 设置 → 隐私管理」里随时关闭</p>' +
      "</div>";
    document.body.appendChild(box);

    box.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest ? e.target.closest("[data-ob]") : null;
      if (!btn) return;
      var act = btn.getAttribute("data-ob");
      if (act === "skip") finish();
      else if (act === "next") next();
    });
    return box;
  }

  function paint() {
    var s = SLIDES[idx];
    document.getElementById("jwObEmoji").textContent = s.icon;
    document.getElementById("jwObTitle").textContent = s.title;
    document.getElementById("jwObText").textContent = s.body;
    document.getElementById("jwObTip").textContent = s.tip;
    document.getElementById("jwObNext").textContent = idx === SLIDES.length - 1 ? "开始使用" : "下一步";
    document.getElementById("jwObDots").innerHTML = SLIDES.map(function (_, i) {
      return '<i class="' + (i === idx ? "on" : "") + '"></i>';
    }).join("");
  }

  function open() {
    var box = build();
    idx = 0;
    paint();
    box.classList.add("on");
    document.body.classList.add("jw-ob-open");
  }

  function finish() {
    var box = document.getElementById(ID);
    if (box) box.classList.remove("on");
    document.body.classList.remove("jw-ob-open");
    try { localStorage.setItem(KEY, "1"); } catch (_) { }
  }

  function next() {
    if (idx >= SLIDES.length - 1) { finish(); return; }
    idx += 1;
    paint();
  }

  function seen() {
    try { return localStorage.getItem(KEY) === "1"; } catch (_) { return false; }
  }

  function maybeShow() {
    if (seen()) return;
    setTimeout(open, 600);
  }

  window.JWOnboarding = {
    open: open,
    close: finish,
    reset: function () {
      try { localStorage.removeItem(KEY); } catch (_) { }
      open();
    }
  };

  // 进入系统（启动页点「进入全景中国地图」）之后再弹，避免盖住启动页
  document.addEventListener("jw:enter", maybeShow);

  // ?guide=1 强制看一遍（验收 / 给朋友演示用）
  try {
    if (new URLSearchParams(location.search).get("guide") === "1") {
      setTimeout(open, 400);
    }
  } catch (_) { }
})();
