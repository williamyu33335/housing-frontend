    /* ============================================================
       🖥️ V8.10 三视图互斥：params（填数字）/ result（看结论）/ match（挑房）
       ------------------------------------------------------------
       规则只有一条：同一时刻只能有一个视图可见。
       以前是"该显示时显示"，没写"不该显示时隐藏"，结果两块面板叠在一起、
       关不掉也切不走（记忆体 6.0 记过这个）。现在改成显式状态机：
         · body[data-view] 决定桌面端哪个面板可见（CSS 早就在守这条）；
         · 手机端同步 data-mtab / data-mscreen，Tab 与视图永远一致。
       ============================================================ */
    const VIEWS = ["params", "result", "match"];

    function setView(v) {
      if (VIEWS.indexOf(v) < 0) v = "params";
      document.body.dataset.view = v;

      // 入口是"结果视图专属的导航"：参数页不需要它，匹配页由匹配面板自己收尾
      if (v === "result") { try { ensureMatchDock(); } catch (_) { } }
      else { removeMatchDock(); }

      // 📱 手机端：视图和 Tab / 二级屏是一套状态，必须一起切，否则会出现"两块面板叠着"
      if (window.innerWidth <= 760 && window.MApp) {
        if (v === "params") { window.MApp.setTab("sim"); window.MApp.setScreen("params"); }
        else if (v === "result") { window.MApp.setTab("sim"); window.MApp.setScreen("result"); }
      }

      // 面板宽度变了，ECharts 不会自己知道——不 resize 就会一直是被压扁的旧尺寸
      const relayout = () => {
        try { map && map.invalidateSize(); } catch (_) { }
        try { if (chart) chart.resize(); } catch (_) { }
      };
      setTimeout(relayout, 120);
      setTimeout(relayout, 360);
      setTimeout(relayout, 700);
    }
    window.__setView = setView;

    /* 🔎 顶部悬浮入口：贴着面板顶端，滚动时永远在最上面。
       为什么用 sticky 而不是 fixed：fixed 要算面板宽度，一旦窗口 resize、
       或者结果视图把面板从 820 加宽到 1180，它就会错位；sticky 天生跟着容器走。 */
    function ensureMatchDock() {
      const rp = document.getElementById("rightPanel");
      if (!rp || document.getElementById("matchDock")) return;
      const dock = document.createElement("button");
      dock.id = "matchDock";
      dock.type = "button";
      dock.innerHTML = "🔎 进入推荐房源匹配<small>按你算出来的条件，挑出最适合的房子</small>";
      dock.onclick = function () {
        if (window.MApp && window.MApp.openMatchPanel) window.MApp.openMatchPanel();
        else showToast("房源匹配还没准备好，稍后再试");
      };
      // 放在面板最前面：和面板同宽、同圆角，看起来像页签栏，不像贴片广告
      rp.insertBefore(dock, rp.firstChild);
    }

    function removeMatchDock() {
      const d = document.getElementById("matchDock");
      if (d) d.remove();
    }

    /* 📋 回参数：左侧口袋点一下就开。
       桌面端要把左栏重新 show 出来（结果视图只把左栏 display:none，没清 .show）；
       手机端交给 setView 联动 Tab，不用单独处理。 */
    function openParamsView() {
      const ov = document.getElementById("matchOverlay");
      if (ov) ov.classList.remove("on");
      try { showPanel("leftPanel"); } catch (_) { }
      setView("params");
      try { map && map.invalidateSize(); } catch (_) { }
    }
    window.__openParams = openParamsView;

    (function bindParamPocket() {
      const pocket = document.getElementById("paramPocket");
      if (pocket) pocket.onclick = openParamsView;
    })();

    function renderResult(res) {
      document.getElementById("emptyState").style.display = "none";


      if (res.assumptions && Array.isArray(res.assumptions)) {
        let liHtml = res.assumptions.map(item => `<li>${escapeHtml(item)}</li>`).join("");
        document.getElementById("assumptionCard").innerHTML = `<ul class="assumption-list">${liHtml}</ul>`;
      }

      if (assumptionOpen) document.getElementById("assumptionCard").style.display = "block";

      if (res.warning) document.getElementById("warningBox").innerHTML = `<div class="warning-box">⚠️ ${escapeHtml(res.warning)}</div>`;
      if (res.skipped) {
        document.getElementById("skipTipBox").innerHTML = `<div class="skip-tip">📌 共尝试 ${res.skipped.total_attempted} 个组合，剔除 ${res.skipped.by_downpay + res.skipped.by_loan_overrun} 个不可行解。</div>`;
      }

      const gbBox = document.getElementById("globalBestBox");
      if (res.global_best && typeof res.global_best.rent_level === "number") {
        const gb = res.global_best;
        gbBox.style.display = "block";
        const rentLabelText = gb.rent_level === 0 ? "直接买房" : `¥${formatNum(gb.rent_level, 0)}`;
        gbBox.innerHTML = `
      <div class="global-best-card">
        <h3>🏆 智能寻优：全局最优推荐方案</h3>
        <div class="metrics">
          <div class="metric"><div class="val">${rentLabelText}</div><div class="lbl">推荐月租</div></div>
          <div class="metric"><div class="val">${gb.rent_year} 年</div><div class="lbl">租房年限</div></div>
          <div class="metric"><div class="val">${gb.loan_year} 年</div><div class="lbl">贷款年限</div></div>
          <div class="metric"><div class="val">${formatNum(gb.comprehensive_score, 2)}</div><div class="lbl">综合得分</div></div>
          <div class="metric"><div class="val">${formatNum(gb.net_worth_end_wan, 2)}万</div><div class="lbl">30 年后家底</div></div>
          <div class="metric"><div class="val" style="color:#fbbf24">${gb.real_net_worth_end_wan !== undefined ? formatNum(gb.real_net_worth_end_wan, 2) : "--"}万</div><div class="lbl">按今日物价</div></div>
        </div>
      </div>`;
      } else {
        gbBox.style.display = "none";
      }

      const topArr = res.top_comprehensive ?? [];
      if (topArr.length > 0) {
        drawChart(topArr[0], topArr);
        generateAIExpertReport(topArr[0], res, "综合最优");
      }

      // 🏙️ 城市与通勤面板 + ⏳ 时光机
      renderCareerCard(res.career);
      renderRiskCard(res.risk);
      if (res.spatial) {
        renderSpatialCard(res.spatial, res);
      } else {
        document.getElementById("spatialBox").innerHTML =
          `<div class="warning-box">⚠️ 当前后端引擎尚未升级到 V6.0，城市与通勤系数（面积 / 通勤 / 按今天物价）没有参与计算。请先部署新版 main.py，再刷新本页。</div>`;
      }
      renderTimeMachine(res);

      const allScheme = res.all_scheme ?? [];
      const topAsset = res.top_asset ?? [...allScheme].sort((a, b) => b.net_worth_end_wan - a.net_worth_end_wan).slice(0, 20);
      const topComfort = [...allScheme].sort((a, b) => b.comfort_score - a.comfort_score).slice(0, 20);

      const style = res.style_boards ?? {};
      const styleSteady = style["稳健型"] ?? [];
      const styleSpeed = style["速度型"] ?? [];
      const styleAggressive = style["进取型"] ?? [];

      const viewBar = document.getElementById("viewBar");
      viewBar.style.display = "flex";
      buildTabs([
        { id: "tab-comp", label: "🏆 综合最优", render: el => renderTableInto(el, topArr), list: topArr, tag: "综合最优" },
        { id: "tab-comfort", label: "舒适度TOP", render: el => renderTableInto(el, topComfort), list: topComfort, tag: "舒适度TOP" },
        { id: "tab-wealth", label: "资产积蓄TOP", render: el => renderTableInto(el, topAsset), list: topAsset, tag: "资产积蓄TOP" },
        { id: "tab-steady", label: "🛡️稳健型", render: el => renderTableInto(el, styleSteady), list: styleSteady, tag: "稳健型" },
        { id: "tab-speed", label: "⚡速度型", render: el => renderTableInto(el, styleSpeed), list: styleSpeed, tag: "速度型" },
        { id: "tab-aggressive", label: "🚀进取型", render: el => renderTableInto(el, styleAggressive), list: styleAggressive, tag: "进取型" },
        { id: "tab-all", label: "全部方案", render: el => renderTableInto(el, allScheme), list: allScheme, tag: "全部方案" }
      ]);

      showPanel('rightPanel');

      // 📱 V8.0：手机端把同一份结果收成一张结论卡（桌面端不执行）
      if (window.MApp) {
        setTimeout(() => {
          try { window.MApp.onResult(res); } catch (e) { console.warn("[V8.0] 结论卡渲染失败", e); }
        }, 0);
      }
    }

    // 熵权细节仅内部使用，前端不再渲染
    function renderEntropy(ew) {
      // 熵权细节不再对外展示（V7.7）：保留函数以免旧调用点报错，但直接返回
      if (!document.getElementById("entropyCard")) return;
      const labels = { asset: "期末资产", adapt: "抗风险", comfort: "舒适度", happiness: "幸福感", time: "时间效率" };
      let html = `<div style="font-weight:600;color:#60a5fa;margin-bottom:12px;font-size:13px;">熵权法自动计算出的五维指标权重</div><div class="ew-grid">`;
      Object.keys(labels).forEach(k => {
        let w = typeof ew[`weight_${k}`] !== "undefined" ? ew[`weight_${k}`] : 0;
        html += `<div class="ew-item"><b>${labels[k]}</b><span>${(w * 100).toFixed(1)}%</span></div>`;
      });
      html += `</div>`;
      document.getElementById("entropyCard").innerHTML = html;
    }

    function buildTabs(tabDefs) {
      const tabWrap = document.getElementById("tabWrap");
      const tabContents = document.getElementById("tabContents");
      tabWrap.innerHTML = ""; tabContents.innerHTML = "";
      tabDefs.forEach((t, idx) => {
        const btn = document.createElement("div");
        btn.className = "tab" + (idx === 0 ? " active" : "");
        btn.textContent = t.label;
        btn.onclick = () => {
          tabWrap.querySelectorAll(".tab").forEach(x => x.classList.toggle("active", x === btn));
          tabContents.querySelectorAll(".tab-content").forEach(x => x.classList.toggle("active", x.id === t.id));

          if (t.list && t.list.length > 0 && t.tag) {
            generateAIExpertReport(t.list[0], currentResult, t.tag);
            flashAIReport();
          }
        };
        tabWrap.appendChild(btn);

        const content = document.createElement("div");
        content.className = "tab-content" + (idx === 0 ? " active" : "");
        content.id = t.id;
        tabContents.appendChild(content);
        try { t.render(content); } catch (e) { content.innerHTML = `<p style="color:#ef4444;padding:15px;">表格渲染异常</p>`; }
      });
    }

    async function loadRegion() {
      try {
        let nanning = FALLBACK_REGIONS;
        try {
          // ⏱️ 必须带超时：Render 冷启动要几十秒，这里挂住会把整个首屏
          //    （城市下拉、?city= 预选、周边数据）一起拖死。
          const res = await fetch(`${API_HOST}/api/gis/regions`, {
            signal: (window.AbortSignal && AbortSignal.timeout) ? AbortSignal.timeout(3500) : undefined
          });
          if (!res.ok) throw new Error("后端API不可用");
          const json = await res.json();
          if (json.data && json.data.length) nanning = json.data;
        } catch (err) {
          console.warn("⚠️ 后端片区数据加载失败，已启用前端本地兜底数据。", err);
        }

        // 🗄️ V7.0：优先使用数据库里的城市表，失败则用内置 CITY_DB
        try {
          const rc = await fetch(`${API_HOST}/api/cities`, {
            signal: (window.AbortSignal && AbortSignal.timeout) ? AbortSignal.timeout(3500) : undefined
          });
          if (rc.ok) {
            const jc = await rc.json();
            if (jc.data && jc.data.length) {
              CITY_DB.length = 0;
              jc.data.forEach(c => CITY_DB.push({
                code: c.code, name: c.name, tier: c.tier,
                price: c.price, rent: c.rent, salary: c.salary,
                lat: c.lat, lng: c.lng
              }));
              console.info(`[V7.0] 已从数据库加载 ${jc.data.length} 个城市`);
              document.documentElement.dataset.citySource = "db";
            } else {
              // 库没配（/api/health/db → enabled:false）时接口会返回空数组，这里必须显式标记回退
              console.warn("[V7.0] 城市库接口为空（后端未配 DATABASE_URL？），使用内置 CITY_DB");
              document.documentElement.dataset.citySource = "fallback";
            }
          } else {
            document.documentElement.dataset.citySource = "fallback";
          }
        } catch (e) {
          console.warn("[V7.0] 城市库接口不可用，使用内置 CITY_DB", e);
          document.documentElement.dataset.citySource = "fallback";
        }

        // 🏷️ V7.0 数据来源可见：库里读的，还是内置表兜的，徽标上必须一眼看出来
        (function markCitySource() {
          const src = document.documentElement.dataset.citySource === "db" ? "库" : "内置";
          document.documentElement.dataset.citySourceLabel = src;
          const badge = document.getElementById("appBadge");
          if (badge) badge.textContent = `V9.2.0 · ${src}`;
          const chip = document.querySelector(".ver-chip");
          if (chip) chip.textContent = `V9.2.0 · ${src}`;
        })();

        const nn = CITY_DB.find(c => c.code === "450100");
        if (nn) nn.zones = nanning;

        buildCitySelect();
        loadPoiNearby();
        loadProjects();
        loadAmenities();
        loadListingAmenities();
        // ⚠️ 这个必须 await：?city= 直达时马上要 applyCity，晚一步就会退回假区位
        await loadDistrictCenters();
        // 🚩 默认全国视角，不自动跳南宁；?city=450100 或 ?city=南宁 可直达
        const cityParam = new URLSearchParams(location.search).get("city");
        const preset = cityParam
          ? CITY_DB.find(x => x.code === cityParam || x.name === cityParam)
          : null;
        if (preset) {
          applyCity(preset);
        } else if (!currentCity && (!map || map.getZoom() < 8)) {
          // 已经放大到市级时交给自动识别，不要清空
          clearCity();
        }
        setTimeout(() => { if (window.__syncCityFromMap) window.__syncCityFromMap(); }, 250);
        runBtn.disabled = false;
      } catch (e) {
        console.error("城市数据初始化失败：", e);
        try { clearCity(); } catch (_) { }
        runBtn.disabled = false;   // 至少让用户能按全国平均口径推演
        showToast("城市数据初始化异常，已回退到全国平均口径：" + (e && e.message ? e.message : e));
      }
    }

    // 📱 手机端：在地图上点了片区，就直接把人送到「推演」填数字。
    //    电脑端两边都能看，不跳。
    function maybeJumpToSim() {
      if (!window.MApp || window.innerWidth > 760) return;
      setTimeout(function () {
        window.MApp.setTab("sim");
        window.MApp.setScreen("params");
      }, 500);
    }

    function selectAndFly(name, lat, lng) {
      const sel = document.getElementById("regionSel");
      sel.value = name;
      currentZone = regionList.find(x => x.name === name) || currentZone;
      syncZoneToForm(true);
      if (map) map.flyTo(mapLL(lat, lng), 12, { duration: 1.2 });
      revealPanels();
      showToast(`已切换至【${name}】，去「推演」填数字`);
      maybeJumpToSim();
    }

    document.getElementById("regionSel").onchange = function () {
      if (!this.value) { clearCity(); return; }   // 选“全国平均”回到全国口径
      const find = regionList.find(x => x.name === this.value);
      if (!find) return;
      currentZone = find;
      // 切换片区：重算几何通勤、可购面积、房价收入比
      syncZoneToForm(true);
      revealPanels();
      if (map) map.flyTo(mapLL(find.lat, find.lng), 12, { duration: 1.2 });
      maybeJumpToSim();
    };

    document.getElementById("leftPanel").addEventListener("keydown", (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runBtn.click();
      }
    });

    runBtn.onclick = async function () {
      if (isCalculating) return;

      const inputs = [
        { id: "monthIncomeNet", label: "税后月收入" }, { id: "monthExp", label: "每月开销" },
        { id: "downRatio", label: "首付比例" }, { id: "houseTotalWan", label: "房屋总价" },
        { id: "initialSavingsWan", label: "初始存款" }, { id: "housingFundPct", label: "公积金比例" },
        { id: "investYieldPct", label: "理财收益" }, { id: "rentInflationPct", label: "租金通胀" },
        { id: "loanRatePct", label: "房贷利率" }
      ];
      if (currentMode === "relative") inputs.push({ id: "rentBase", label: "基准月租金" });

      for (let item of inputs) {
        const el = document.getElementById(item.id);
        const val = parseFloat(el.value);
        if (isNaN(val) || val < 0) { el.classList.add("invalid"); return showToast(`【${item.label}】必须是大于等于0的数字`); }
        else { el.classList.remove("invalid"); }
      }

      const downRatio = parseFloat(document.getElementById("downRatio").value);
      if (downRatio < 15 || downRatio > 80) return showToast("首付比例必须在 15~80 之间");

      const monthIn = parseFloat(document.getElementById("monthIncomeNet").value);
      const monthEx = parseFloat(document.getElementById("monthExp").value);
      if (monthIn <= monthEx) return showToast("税后月收入必须大于基础生活开销");

      if (calcAbortCtrl) calcAbortCtrl.abort();
      calcAbortCtrl = new AbortController();
      isCalculating = true;
      loadingText.textContent = currentMode === "relative" ? "正在推演全组合租贷矩阵..." : "正在执行全档位矩阵寻优...";
      setLoading(true);

      const payload = {
        buy_car: document.getElementById("buyCar").value === "true",
        car_buy_year: parseInt(document.getElementById("carBuyYear").value || 0),
        house_total_wan: parseFloat(document.getElementById("houseTotalWan").value),
        // 🏠 V8.2：房屋类型决定税费与装修口径
        house_type: houseType,
        target_area_sqm: parseFloat((document.getElementById("targetAreaSqm") || {}).value || 0),
        public_share_pct: parseFloat((document.getElementById("publicSharePct") || {}).value || 0),
        house_decoration: document.getElementById("houseDecoration")
          ? (document.getElementById("houseDecoration").value === "finished" ? "finished" : "rough")
          : "finished",
        reno_level: document.getElementById("renoLevel")
          ? document.getElementById("renoLevel").value : "standard",
        reno_budget_wan: parseFloat((document.getElementById("renoBudgetWan") || {}).value || 0),
        initial_savings_wan: parseFloat(document.getElementById("initialSavingsWan").value),
        down_payment_ratio: downRatio,
        monthly_income_net: monthIn,
        monthly_expense: monthEx,
        property_fee_monthly: parseFloat(document.getElementById("propertyFee").value),
        housing_fund_pct: parseFloat(document.getElementById("housingFundPct").value),
        invest_annual_yield_pct: parseFloat(document.getElementById("investYieldPct").value),
        rent_inflation_year_pct: parseFloat(document.getElementById("rentInflationPct").value),
        annual_inflation_pct: parseFloat(document.getElementById("annualInflationPct").value),
        loan_annual_rate_pct: parseFloat(document.getElementById("loanRatePct").value),
        repay_kind: document.getElementById("repayKind").value,

        // 🌟 映射新参数
        car_total_wan: parseFloat(document.getElementById("carTotalWan").value || 0),
        car_loan_year: parseInt(document.getElementById("carLoanYear").value || 0),
        car_monthly_expense: parseFloat(document.getElementById("carMonthlyExpense").value || 0),
        annual_income_growth_pct: parseFloat(document.getElementById("annualIncomeGrowthPct").value || 0),
        provident_loan_cap_wan: parseFloat(document.getElementById("providentLoanCapWan").value || 0)
      };
      if (currentMode === "relative") payload.rent_monthly_base = parseFloat(document.getElementById("rentBase").value);

      // 🏙️ V2.0 城市与通勤参数：城市能级、片区单价、家庭规模、双阶段通勤
      Object.assign(payload, spatialRequestFields());

      // 🧭 V6.1 风险姿态与隐形支出
      payload.risk_mode = currentRisk;
      payload.squeeze_life = document.getElementById("squeezeLife").checked && currentRisk === "aggressive";
      payload.hidden_expense_month = parseFloat(document.getElementById("hiddenExpenseMonth").value || 0);
      payload.career_type = document.getElementById("careerType").value;
      payload.city_code = currentCity ? currentCity.code : "000000";
      payload.city_code = currentCity ? currentCity.code : "000000";
      payload.industry = document.getElementById("industry").value;
      payload.income_earners = parseInt(document.getElementById("incomeEarners").value || 1);
      // 不预测房价：永远传 0（参数已经从界面去掉）
      payload.house_price_growth_pct = 0;


      // 🧭 V7.5：填了“我的打算”就走锚点接口，一次请求同时拿回“你的方案”和“最优方案”
      const anchorRentEl = document.getElementById("anchorRentYear");
      const anchorLoanEl = document.getElementById("anchorLoanYear");
      const anchorRent = anchorRentEl ? anchorRentEl.value.trim() : "";
      const anchorLoan = anchorLoanEl ? anchorLoanEl.value.trim() : "";
      const useAnchor = currentMode === "relative" && anchorRent !== "" && anchorLoan !== "";
      let endpoint = currentMode === "relative" ? "/api/simulate" : "/api/simulate/absolute";
      if (useAnchor) {
        payload.anchor_rent_year = Math.max(0, Math.min(20, parseInt(anchorRent, 10) || 0));
        payload.anchor_loan_year = Math.max(1, Math.min(30, parseInt(anchorLoan, 10) || 10));
        payload.anchor_down_strategy = document.getElementById("anchorDownStrategy").value;
        endpoint = "/api/simulate/anchor";
      }

      const areaHintBox = document.getElementById("areaHint");
      if (areaHintBox) { areaHintBox.style.display = "none"; areaHintBox.textContent = ""; }

      if (payload.house_total_wan <= 0 && payload.target_area_sqm <= 0) {
        setLoading(false);
        isCalculating = false;
        showToast("房屋总价和想住多大，至少填一个");
        return;
      }

      try {
        const res = await fetch(`${API_HOST}${endpoint}`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: calcAbortCtrl.signal
        });

        if (!res.ok) {
          let msg = "请求失败";
          try {
            const errJson = await res.json();
            if (res.status === 422) {
              msg = "数据校验未通过: " + JSON.stringify(errJson.detail);
            } else if (errJson.detail) {
              msg = errJson.detail;
            }
          } catch (_) { }

          // 🏠 先匹配再计算：总价和面积对不上，直接把差距说清楚
          if (msg.indexOf("这套房子没对上") >= 0) {
            if (window.showAreaModal) window.showAreaModal(msg, "这套房子没对上");
            return;
          }

          // 🌟 核心判断：如果是无可行方案，弹出黑马激励窗口，不报错
          if (msg.includes("无可行方案") || msg.includes("均无可行方案")) {
            let failMsg = `💡 算法推演提示：${msg}`;
            const buyCarStr = document.getElementById("buyCar").value;
            if (buyCarStr === "true") {
              failMsg += `<br><br><b>🚗 而且你还选了买车！</b><br>在当前严苛的红线之下，强行买车确实透支了你上车的能力。不妨做做取舍？如果不买车，可能立马就能找到完美的上车方案哦！`;
            }
            document.getElementById('failReasonBox').innerHTML = failMsg;
            document.getElementById('failModal').style.display = "flex";
            try { document.dispatchEvent(new CustomEvent("jw:noscheme", { detail: { payload: payload } })); } catch (_) { }
            // 🔙 失败就别把人锁在结果页里：左栏必须回来，否则他没地方改参数
            setView("params");
            return;
          }

          throw new Error(msg);
        }

        const result = await res.json();
        currentResult = result;
        clearResults();

        // 渲染表格与分析（先把 DOM 与 ECharts 的重活干完）
        renderResult(result);
        setView("result");
        if (useAnchor && result.mode === "anchor") {
          renderAnchorBox(result);
        } else clearAnchorBox();
        showToast("推演计算完成！");
        try { document.dispatchEvent(new CustomEvent("jw:result", { detail: { result: result, payload: payload } })); } catch (_) { }

        // 🎉 撒花放在渲染之后：不再和表格 / ECharts 的重绘抢帧
        setTimeout(() => window.triggerConfetti(), 1200);

        if (window.innerWidth <= 900) {
          document.getElementById('leftPanel').classList.remove('show');
          document.getElementById('rightPanel').classList.add('show');
          setTimeout(() => { if (map) map.invalidateSize(); }, 500);
        }

      } catch (err) {
        if (err.name !== "AbortError") {
          if (String(err).includes("CORS") || String(err).includes("Failed to fetch")) showToast("❌ 网络异常或跨域拦截，请确保后端已启动且允许CORS");
          else showToast(`请求失败：${err.message}`);
        }
      } finally {
        setLoading(false);
        calcAbortCtrl = null;
        isCalculating = false;
      }
    };

    window.onload = () => {
      initMap();
      loadRegion();

      const inputList = [
        "monthIncomeNet", "monthExp", "downRatio", "houseTotalWan", "initialSavingsWan",
        "housingFundPct", "rentBase", "investYieldPct", "rentInflationPct", "loanRatePct"
      ];
      inputList.forEach(id => {
        const inp = document.getElementById(id);
        if (!inp) return;
        inp.addEventListener("input", function () {
          const val = parseFloat(this.value);
          if (isNaN(val) || val < 0) this.classList.add("invalid");
          else this.classList.remove("invalid");
        });
      });

      // 🏙️ 城市与通勤：这些输入会即时改变“可购面积 / 房价收入比”芯片
      ["houseTotalWan", "monthIncomeNet", "initialSavingsWan"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("input", refreshSpatialChips);
      });
      const famEl = document.getElementById("familyMode");
      if (famEl) {
        famEl.addEventListener("change", () => {
          const fam = parseInt(famEl.value) || 1;
          const earn = document.getElementById("incomeEarners");
          if (earn) earn.value = fam >= 2 ? "2" : "1";
          const label = document.getElementById("incomeLabel");
          if (label) label.textContent = fam >= 2 ? "家庭税后月收入（两人合计，元）" : "税后月收入（元）";
          refreshSpatialChips();
        });
      }
      const earnEl = document.getElementById("incomeEarners");
      if (earnEl) earnEl.addEventListener("change", refreshSpatialChips);
      ["ownCommuteMin", "rentCommuteMin"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("input", () => { commuteManual = true; refreshSpatialChips(); });
      });

      // 🚦 早晚高峰开关：只改芯片和请求参数，不改输入框里的数字——
      // 输入框永远代表"平峰实际单程"，倍数在发请求时才乘上去。
      const peakBox = document.getElementById("peakCommute");
      if (peakBox) {
        peakBox.addEventListener("change", () => {
          refreshSpatialChips();
          showToast(peakBox.checked
            ? "已按假设 ×1.45 估算高峰通勤（不是实测数据）"
            : "已回到平峰通勤");
        });
      }

      // 🧪 演示/验收钩子：?autorun=1 自动跑一次默认推演（不影响正常使用）
      if (new URLSearchParams(location.search).get("autorun") === "1") {
        setTimeout(() => {
          const b = document.getElementById("runBtn");
          if (b && !b.disabled) b.click();
        }, 1200);
      }
    };