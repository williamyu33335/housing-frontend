
    // 🚨 全局错误可见化：线上出问题时不用开 DevTools 也能看到原因
    (function () {
      function showErr(msg) {
        const el = document.getElementById("errBanner");
        if (!el) return;
        el.style.display = "block";
        el.textContent = "⚠️ 前端运行错误：" + msg + "（版本 V9.4.0，请把这条发给经纬）";
      }
      window.addEventListener("error", function (e) {
        showErr((e.message || "未知错误") + " @ " + (e.filename || "").split("/").pop() + ":" + (e.lineno || 0));
      });
      window.addEventListener("unhandledrejection", function (e) {
        const r = e.reason;
        showErr("Promise: " + (r && r.message ? r.message : String(r)));
      });
    })();

    const API_HOST = (function () {
      try {
        const q = new URLSearchParams(location.search).get("api");
        if (q) return q.replace(/\/$/, "");
        const saved = localStorage.getItem("housing_api_host");
        if (saved) return saved.replace(/\/$/, "");
      } catch (_) { }
      return "https://housing-api2.onrender.com";
    })();
    const DEFAULT_FORM = {
      "houseTotalWan": 100, "initialSavingsWan": 40, "downRatio": 30,
      "monthIncomeNet": 6500, "monthExp": 2200, "propertyFee": 200,
      "housingFundPct": 16, "rentBase": 1800, "investYieldPct": 0.9,
      "rentInflationPct": 2, "loanRatePct": 3.9, "repayKind": "equal_principal_interest",
      "annualInflationPct": 2.5, "housePriceGrowthPct": 0,
      "buyCar": "false", "carTotalWan": 15, "carLoanYear": 3, "carMonthlyExpense": 1500,
      "annualIncomeGrowthPct": 3, "providentLoanCapWan": 60, "hiddenExpenseMonth": 0
    };
    const FALLBACK_REGIONS = [
      { "name": "青秀区", "lat": 22.79, "lng": 108.38, "house_ref": 140, "rent_ref": 3000, "price_sqm": 15500, "commute_min": 15, "desc": "核心城区，配套完善，名校云集" },
      { "name": "西乡塘区", "lat": 22.84, "lng": 108.28, "house_ref": 85, "rent_ref": 1600, "price_sqm": 9500, "commute_min": 28, "desc": "科教片区，高校林立，生活成本低" },
      { "name": "江南区", "lat": 22.78, "lng": 108.28, "house_ref": 78, "rent_ref": 1500, "price_sqm": 8700, "commute_min": 30, "desc": "老城区，刚需友好，烟火气浓" },
      { "name": "兴宁区", "lat": 22.85, "lng": 108.33, "house_ref": 92, "rent_ref": 1900, "price_sqm": 10200, "commute_min": 22, "desc": "老城商圈，火车站附近，交通便利" },
      { "name": "良庆区", "lat": 22.74, "lng": 108.36, "house_ref": 110, "rent_ref": 2300, "price_sqm": 12200, "commute_min": 25, "desc": "五象新区核心地带，发展潜力大" },
      { "name": "邕宁区", "lat": 22.76, "lng": 108.48, "house_ref": 82, "rent_ref": 1600, "price_sqm": 9100, "commute_min": 35, "desc": "五象东扩区，价格洼地，生态宜居" },
      { "name": "武鸣区", "lat": 23.16, "lng": 108.27, "house_ref": 55, "rent_ref": 1200, "price_sqm": 6100, "commute_min": 55, "desc": "教育园区，大学城，价格极低" },
      { "name": "五象新区", "lat": 22.72, "lng": 108.35, "house_ref": 120, "rent_ref": 2500, "price_sqm": 13300, "commute_min": 20, "desc": "自治区级重点发展新区，总部基地" }
    ];
