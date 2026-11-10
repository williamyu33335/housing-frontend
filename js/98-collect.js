/* ============================================================
   V9.1 匿名画像上报
   ------------------------------------------------------------
   只做三件事：
     1. 给这台机器一个随机 session_id（不是设备号，重装就换）；
     2. 推演成功后，把"参数 + 结论摘要"发给 /api/collect；
     3. 用户关掉开关，就一次都不发。
   永远不发：姓名、手机号、IP、精确坐标、自由文本。
   ============================================================ */
(function () {
  "use strict";

  var SID_KEY = "jw_sid";
  var OPT_KEY = "jw_collect";          // "off" = 用户明确关闭；其它/空 = 默认开启
  var lastSent = 0;

  function uuid() {
    try {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    } catch (_) { }
    var s = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return s;
  }

  function sid() {
    try {
      var v = localStorage.getItem(SID_KEY);
      if (v && /^[A-Za-z0-9_-]{8,64}$/.test(v)) return v;
      v = uuid();
      localStorage.setItem(SID_KEY, v);
      return v;
    } catch (_) {
      return uuid();
    }
  }

  function enabled() {
    try { return localStorage.getItem(OPT_KEY) !== "off"; } catch (_) { return true; }
  }

  function setEnabled(on) {
    try { localStorage.setItem(OPT_KEY, on ? "on" : "off"); } catch (_) { }
  }

  function platform() {
    try {
      if (window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) return "android";
    } catch (_) { }
    return "web";
  }

  function version() {
    var m = document.querySelector('meta[name="app-version"]');
    return m ? m.getAttribute("content") : "";
  }

  function compact(res, payload, kind) {
    var top = (res && res.top_comprehensive && res.top_comprehensive[0]) || null;
    var n = (res && Array.isArray(res.all_scheme)) ? res.all_scheme.length : 0;
    return {
      meta: { session_id: sid(), app_version: version(), platform: platform(), kind: kind || "simulate" },
      params: payload || {},
      result: {
        top_comprehensive: top ? [{
          rent_year: top.rent_year, loan_year: top.loan_year,
          down_strategy: top.down_strategy, comprehensive_score: top.comprehensive_score,
          net_worth_end_wan: top.net_worth_end_wan
        }] : [],
        all_scheme_count: n
      }
    };
  }

  function send(body) {
    if (!enabled()) return;
    var now = Date.now();
    if (now - lastSent < 20000) return;    // 20 秒内只发一次，防止连点刷数据
    lastSent = now;
    try {
      fetch((typeof API_HOST === "string" ? API_HOST : "") + "/api/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true
      }).catch(function () { /* 采集失败不能影响用户 */ });
    } catch (_) { }
  }

  document.addEventListener("jw:result", function (e) {
    try {
      var d = e.detail || {};
      send(compact(d.result, d.payload, "simulate"));
    } catch (_) { }
  });

  document.addEventListener("jw:noscheme", function (e) {
    try {
      var d = e.detail || {};
      send(compact({ all_scheme: [] }, d.payload, "no_scheme"));
    } catch (_) { }
  });

  window.JWCollect = {
    enabled: enabled,
    setEnabled: setEnabled,
    sessionId: sid,
    info: function () {
      return { enabled: enabled(), sessionId: sid(), platform: platform(), version: version() };
    }
  };
})();
