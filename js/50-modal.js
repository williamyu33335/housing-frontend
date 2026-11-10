    /* ============ 详情弹窗逻辑 ============ */
    function openModal(item) {
      if (!item) return;
      const _mc0 = document.querySelector("#detailModal .modal-content");
      if (_mc0) _mc0.style.maxWidth = "800px";

      // 🧭 V7.6：这次推演带了"我的方案"，明细直接变左右对比
      const anchorItem = (currentResult && currentResult.mode === "anchor"
        && currentResult.feasible && currentResult.anchor) ? currentResult.anchor : null;
      if (anchorItem) { openCompareModal(currentResult); return; }

      const regionName = document.getElementById("regionSel").value || "目标片区";
      // 💡 V8.11：文本里的"总价"要用**算出来的**那个，不是输入框里那个。
      // 只填"想住 90㎡"、总价填 0 时，输入框是 0，真实总价是后端按面积×单价算的。
      const houseTotalWan = (item && Number(item.purchase_price_wan) > 0)
        ? Number(item.purchase_price_wan) : nv("houseTotalWan");
      const monthIncomeNet = nv("monthIncomeNet");
      const monthExp = nv("monthExp");
      const propertyFee = nv("propertyFee");
      const housingFundPct = nv("housingFundPct");
      const loanRatePct = nv("loanRatePct");
      const repayKind = document.getElementById("repayKind").value;

      const provCap = nv("providentLoanCapWan"); // 🌟 获取公积金贷款上限
      // 🌟 核心修改：优先读取后端算出的真实首付和贷款金额
      const downPaymentWan = item.down_payment_wan !== undefined ? item.down_payment_wan : (houseTotalWan * nv("downRatio") / 100);
      const loanPrincipalWan = item.loan_principal_wan !== undefined ? item.loan_principal_wan : (houseTotalWan - downPaymentWan);

      const loanYears = item.loan_year || 0;
      const rentYears = item.rent_year || 0;
      const rentMonthly = (typeof item.rent_level === "number") ? item.rent_level : nv("rentBase");

      const calc = calcComboMortgage(loanPrincipalWan, loanRatePct, provCap, 3.1, loanYears, repayKind);
      const monthlyMortgage = calc.monthly;
      const totalInterestWan = calc.totalInterest / 10000;

      const housingFundMonthly = monthIncomeNet * housingFundPct / 100;
      const fundDeduct = Math.min(monthlyMortgage, housingFundMonthly);
      const realSelfPay = Math.max(0, monthlyMortgage - fundDeduct);
      const totalMonthlyOutflow = monthExp + propertyFee + realSelfPay;
      const expenseRatio = monthIncomeNet > 0 ? totalMonthlyOutflow / monthIncomeNet * 100 : 0;
      const remainingCash = monthIncomeNet - totalMonthlyOutflow;
      const surplusRate = monthIncomeNet > 0 ? remainingCash / monthIncomeNet * 100 : 0;
      const redlineMargin = monthIncomeNet * 0.70 - totalMonthlyOutflow;

      const fmt = (v, d = 0) => (isNaN(v) ? "--" : Number(v).toLocaleString("zh-CN", { minimumFractionDigits: d, maximumFractionDigits: d }));
      const pctCls = (v) => v >= 50 ? "ok" : (v >= 0 ? "warn" : "bad");
      const sp = (currentResult && currentResult.spatial) ? currentResult.spatial : null;

      const row = (label, val, cls = "") => `<div class="dr-row"><span class="dr-lbl">${label}</span><span class="dr-val ${cls}">${val}</span></div>`;
      const dsText = item.down_strategy === "max" ? "极限首付(倾尽所有)" : (item.down_strategy === "balanced" ? "平衡首付(保留备用金)" : "最低首付(最大化杠杆)");

      const html = `
    <div class="dr-wrap">
      <div class="dr-section">
        <div class="dr-title">🏙️ 城市与通勤</div>
        ${row("目标城市", sp ? `${escapeHtml(sp.city_name)} · ${escapeHtml(sp.tier_label)}` : escapeHtml(regionName))}
        ${row("可购面积 / 人均", sp ? `${sp.own_area_sqm} ㎡ / ${sp.area_per_person} ㎡（${sp.family_label}）` : "--")}
        ${row("单程通勤（租房 → 买房）", sp ? `${sp.commute.rent_min} → ${sp.commute.own_min} 分钟` : "--")}
        ${row("通勤时间成本", sp ? `${fmt(sp.commute.time_cost_month, 0)} 元/月` : "--", sp && sp.commute.time_cost_month > 800 ? "warn" : "")}
        ${row("房价收入比", sp ? `${sp.pir} 倍` : "--", sp && sp.pir >= 15 ? "bad" : "ok")}
        ${row("相对本地收入", sp ? `${sp.rel_income} ×` : "--")}
      </div>
      <div class="dr-section">
        <div class="dr-title">🏠 购房与贷款</div>
        ${row("目标片区", escapeHtml(regionName))}
        ${row("房屋总价", `${fmt(houseTotalWan, 1)} 万元`)}
        ${row("首付策略", `<span style="color:#38bdf8">${dsText}</span>`)}
        ${row("实际首付金额", `${fmt(downPaymentWan, 1)} 万元`, "ok")}
        ${row("实际贷款本金", `${fmt(loanPrincipalWan, 1)} 万元`)}
        ${row("贷款年限", `${loanYears} 年`)}
        ${row("还款方式", repayKind === "equal_principal" ? "等额本金" : "等额本息")}
        ${row("房贷月供(均)", `${fmt(monthlyMortgage, 0)} 元`)}
        ${row("30年总利息", `${fmt(totalInterestWan, 1)} 万元`, totalInterestWan > houseTotalWan * 0.8 ? "warn" : "")}
        ${row("租房过渡年限", `${rentYears} 年`)}
        ${row("前期月租金", `${fmt(rentMonthly, 0)} 元`)}
      </div>
      <div class="dr-section">
        <div class="dr-title">💵 月度现金流</div>
        ${row("税后月收入", `${fmt(monthIncomeNet, 0)} 元`)}
        ${row("公积金账户月入账（专款专用）", `${fmt(housingFundMonthly, 0)} 元`)}
        ${row("公积金抵扣月供", `${fmt(fundDeduct, 0)} 元`)}
        ${row("真实自付月供", `${fmt(realSelfPay, 0)} 元`)}
        ${row("基础生活开销", `${fmt(monthExp, 0)} 元`)}
        ${row("物业费", `${fmt(propertyFee, 0)} 元`)}
        ${row("家庭总月支出", `${fmt(totalMonthlyOutflow, 0)} 元`, totalMonthlyOutflow / monthIncomeNet > 0.7 ? "bad" : "")}
        ${row("支出占收入比", `${fmt(expenseRatio, 1)} %`, expenseRatio > 70 ? "bad" : (expenseRatio > 60 ? "warn" : "ok"))}
        ${row("距离70%红线余量", `${fmt(redlineMargin, 0)} 元`, redlineMargin < 0 ? "bad" : (redlineMargin < monthIncomeNet * 0.1 ? "warn" : "ok"))}
        ${row("月度纯现金结余", `${fmt(remainingCash, 0)} 元`)}
        ${row("真实结余率", `${fmt(surplusRate, 1)} %`, pctCls(surplusRate))}
      </div>
      <div class="dr-section" style="grid-column: 1 / -1;">
        <div class="dr-title">📊 五维评分与资产</div>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:10px;text-align:center;">
          <div><div style="font-size:18px;font-weight:800;color:#38bdf8;">${fmt(item.adapt_score, 1)}</div><div style="font-size:11px;color:#94a3b8;">抗风险稳健</div></div>
          <div><div style="font-size:18px;font-weight:800;color:#f59e0b;">${fmt(item.comfort_score, 1)}</div><div style="font-size:11px;color:#94a3b8;">居住舒适</div></div>
          <div><div style="font-size:18px;font-weight:800;color:#8b5cf6;">${fmt(item.surplus_happiness, 1)}</div><div style="font-size:11px;color:#94a3b8;">结余幸福</div></div>
          <div><div style="font-size:18px;font-weight:800;color:#0ea5e9;">${fmt(item.time_efficiency, 1)}</div><div style="font-size:11px;color:#94a3b8;">时间效率</div></div>
          <div><div style="font-size:18px;font-weight:800;color:#ec4899;">${fmt(item.suitability_score, 1)}</div><div style="font-size:11px;color:#94a3b8;">综合合适度</div></div>
          <div><div style="font-size:18px;font-weight:800;color:#10b981;">${fmt(item.comprehensive_score, 1)}</div><div style="font-size:11px;color:#94a3b8;">综合得分</div></div>
        </div>
        <div style="margin-top:12px;">
          ${row("30 年后现金（名义）", `${fmt(item.liquid_asset_end_wan, 2)} 万元`, "ok")}
          ${row("房子价值（按买入价与年增值估算）", item.house_value_end_wan !== undefined ? `${fmt(item.house_value_end_wan, 2)} 万元` : "--")}
          ${row("30 年后家底（现金＋房子）", item.net_worth_end_wan !== undefined ? `${fmt(item.net_worth_end_wan, 2)} 万元` : "--", "ok")}
          ${row("家底按今日物价", item.real_net_worth_end_wan !== undefined ? `${fmt(item.real_net_worth_end_wan, 2)} 万元` : "--", "warn")}
          ${row("周期最低现金余额", item.min_cash_wan !== undefined ? `${fmt(item.min_cash_wan, 2)} 万元` : "--")}
        </div>
      </div>
    </div>
  `;

      document.getElementById("modalBody").innerHTML = html;
      document.getElementById("modalTitle").innerText = `📝 方案明细 | 租 ${item.rent_year} 年 + 贷 ${item.loan_year} 年`;
      document.getElementById("detailModal").style.display = "flex";
    }

    function closeModal() {
      document.getElementById("detailModal").style.display = "none";
    }
    window.openModal = openModal;
    window.closeModal = closeModal;

    // 面积/总价没对上的提示：居中弹窗
    window.closeAreaModal = function () {
      const el = document.getElementById("areaModal");
      if (el) el.style.display = "none";
    };
    window.showAreaModal = function (text, title) {
      const body = document.getElementById("areaModalBody");
      const t = document.getElementById("areaModalTitle");
      if (t && title) t.textContent = title;
      if (body) body.innerHTML = String(text || "").replace(/^这套房子没对上：/, "").replace(/\n/g, "<br>");
      const el = document.getElementById("areaModal");
      if (el) el.style.display = "flex";
    };
