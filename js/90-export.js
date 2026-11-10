    /* ============================================================
       🔌 调试 / 集成入口（不影响业务逻辑）
       ------------------------------------------------------------
       顶层 const 不会挂到 window 上，这里显式暴露一个只读命名空间，
       方便控制台调试、无头浏览器验收，以及未来的小程序/第三方嵌入。
       ============================================================ */
    window.HousingApp = {
      cityDb: CITY_DB,
      zoneDefs: CITY_ZONES,
      get currentCity() { return currentCity; },
      get currentZone() { return currentZone; },
      get currentResult() { return currentResult; },
      applyCity: applyCity,
      buildCitySelect: buildCitySelect,
      spatialRequestFields: spatialRequestFields,
      refreshSpatialChips: refreshSpatialChips,
      // 📱 手机端面板是“显示/隐藏”切换的，图表要能被确定性地重新量尺寸
      resizeViz: function () {
        try { if (chart) chart.resize(); } catch (_) { }
        try { if (map) map.invalidateSize(); } catch (_) { }
      },
      get map() { return map; },
      // 📱 V8.0：手机端「房源」屏复用同一份加载逻辑，不另写一套
      loadListings: loadListings,
      apiHost: API_HOST,
      get listings() { return listingsAll; },
      // 🏗 V9.0：新房户型数据晚到时补画手机端「房源」屏
      repaintMobileHuxing: function () { try { paintMobileHuxing(); } catch (_) { } },
      // 🏗 V8.12：楼盘 + 在售户型（匹配面板要按预算筛户型，不能只筛二手房）
      get projects() { return (projectsData && projectsData.items) || []; },
      toast: showToast
    };
  