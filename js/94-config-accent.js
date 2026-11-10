
    /* ============================================================
       🎨 参数分组：七彩标题 + 收起时的一行摘要
       ------------------------------------------------------------
       朋友的原话：默认收起来，用户可能根本没注意到就跳过了。
       所以：① 每组一个颜色；② 收起时也显示组里的关键数字；
             ③ 把“必须填”的组挪到前面，进阶选项放最后。
       ============================================================ */
    (function () {
      var COLORS = ["#f87171", "#fb923c", "#facc15", "#34d399", "#38bdf8", "#a78bfa", "#f472b6"];

      function val(id) {
        var el = document.getElementById(id);
        return el ? String(el.value || "") : "";
      }
      function optText(id) {
        var el = document.getElementById(id);
        var t = el && el.selectedOptions && el.selectedOptions[0] ? el.selectedOptions[0].textContent.trim() : "";
        // 摘要里不需要 emoji：去掉开头的符号与空白
        return t.replace(/^[^\u4e00-\u9fa5A-Za-z0-9]+/, "");
      }
      function cityName() {
        var ha = window.HousingApp || {};
        return ha.currentCity ? ha.currentCity.name : "未选城市";
      }

      // 按“人对这套房的理解顺序”排：城市 → 房子 → 收入 → 利率 → 进阶
      var ORDER = ["城市能级", "核心资产", "收入与开销", "金融与租赁", "进阶生活"];

      function arrange() {
        var panel = document.getElementById("leftPanel");
        var anchor = document.getElementById("anchorGroup");
        if (!panel || !anchor) return;
        var groups = Array.prototype.slice.call(panel.querySelectorAll("details.config-group"));
        groups.forEach(function (g) {
          var title = (g.querySelector(".cfg-title") || g.querySelector("summary") || {}).textContent || "";
          var idx = ORDER.findIndex(function (k) { return title.indexOf(k) >= 0; });
          g.dataset.order = idx < 0 ? 99 : idx;
        });
        groups.sort(function (a, b) { return a.dataset.order - b.dataset.order; });
        groups.forEach(function (g) { panel.insertBefore(g, anchor); });
      }

      function buildTitles() {
        var groups = document.querySelectorAll("#leftPanel details.config-group, #anchorGroup");
        Array.prototype.forEach.call(groups, function (g, i) {
          g.style.setProperty("--cfg-accent", COLORS[i % COLORS.length]);
          var s = g.querySelector("summary");
          if (!s || s.querySelector(".cfg-title")) return;
          var raw = (s.textContent || "").trim();
          var t = document.createElement("span");
          t.className = "cfg-title";
          t.textContent = raw;
          var h = document.createElement("span");
          h.className = "cfg-hint";
          s.textContent = "";
          s.appendChild(t);
          s.appendChild(h);
        });
      }

      function hints() {
        var v = val;
        var data = [
          cityName() + " · " + (optText("familyMode") || "二人世界"),
          v("houseTotalWan") + " 万 · 首付 " + v("downRatio") + "% · 存款 " + v("initialSavingsWan") + " 万",
          "月入 " + v("monthIncomeNet") + " · 月支 " + v("monthExp") + " · 物业 " + v("propertyFee"),
          "利率 " + v("loanRatePct") + "% · 月租 " + v("rentBase") + " · 理财 " + v("investYieldPct") + "%",
          (v("buyCar") === "true" ? "要买车" : "不买车") + " · " + (optText("careerType") || "企业职员")
        ];
        var groups = document.querySelectorAll("#leftPanel details.config-group");
        Array.prototype.forEach.call(groups, function (g) {
          var titleEl = g.querySelector(".cfg-title");
          if (!titleEl) return;
          var title = titleEl.textContent || "";
          var idx = ORDER.findIndex(function (k) { return title.indexOf(k) >= 0; });
          var h = g.querySelector(".cfg-hint");
          if (h && idx >= 0 && data[idx]) h.textContent = data[idx];
        });

        // 「我的打算」也写一行：填了就写数字，没填就写“可选”
        var ag = document.getElementById("anchorGroup");
        if (ag) {
          var ah = ag.querySelector(".cfg-hint");
          var r = v("anchorRentYear"), l = v("anchorLoanYear");
          if (ah) ah.textContent = (r && l) ? ("租 " + r + " 年 · 贷 " + l + " 年 · " + (optText("anchorDownStrategy") || "")) : "可选：把你自己的打算填进来，模型原样算一遍";
        }
      }

      var tid = null;
      function refresh() {
        clearTimeout(tid);
        tid = setTimeout(hints, 120);
      }

      function init() {
        // 先排顺序再上色：颜色按“看到的第一组到最后一组”依次是 红橙黄绿蓝紫
        arrange();
        buildTitles();
        hints();
        document.addEventListener("input", refresh, true);
        document.addEventListener("change", refresh, true);
        setTimeout(hints, 1200);
        setTimeout(hints, 3000);
      }

      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
      else init();
    })();
  