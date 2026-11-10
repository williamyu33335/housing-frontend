    /* ============ 贷款月供计算辅助 ============ */
    function calcMonthlyMortgage(principal, ratePct, years, kind) {
      const n = years * 12;
      if (n <= 0 || principal <= 0) return { monthly: 0, totalInterest: 0 };
      const r = ratePct / 100 / 12;
      if (Math.abs(r) < 1e-9) return { monthly: principal / n, totalInterest: 0 };
      if (kind === "equal_principal_interest") {
        const m = principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
        return { monthly: m, totalInterest: m * n - principal };
      } else {
        const totalInterest = principal * r * (n + 1) / 2;
        const avgMonthly = (principal + totalInterest) / n;
        return { monthly: avgMonthly, totalInterest };
      }
    }

    function calcComboMortgage(loanPrincipalWan, commercialRatePct, provCapWan, provRatePct, years, kind) {
      const totalPrincipal = loanPrincipalWan * 10000;
      const provCap = provCapWan * 10000;
      const provLoan = Math.min(totalPrincipal, provCap);
      const commLoan = totalPrincipal - provLoan;

      const provCalc = calcMonthlyMortgage(provLoan, provRatePct, years, kind);
      const commCalc = calcMonthlyMortgage(commLoan, commercialRatePct, years, kind);

      return {
        monthly: provCalc.monthly + commCalc.monthly,
        totalInterest: provCalc.totalInterest + commCalc.totalInterest
      };
    }

    // =================================================================
    // 🧭 V7.6 方案对比弹窗：左边系统推荐，右边你的方案
    //   规则：同一行谁更好谁绿，另一个红；中性指标（首付/本金）不上色。
    // =================================================================
    function cmpClass(sysVal, userVal, dir) {
      if (dir === 0 || !isFinite(sysVal) || !isFinite(userVal) || sysVal === userVal) return ["", ""];
      const sysBetter = dir > 0 ? sysVal > userVal : sysVal < userVal;
      return sysBetter ? ["ok", "bad"] : ["bad", "ok"];
    }

    function cmpRow(label, sysVal, userVal, dir, unit, digits) {
      const f = (v) => (v === undefined || v === null || isNaN(v))
        ? "--" : Number(v).toLocaleString("zh-CN", { minimumFractionDigits: digits || 0, maximumFractionDigits: digits || 0 }) + (unit || "");
      const [cs, cu] = cmpClass(Number(sysVal), Number(userVal), dir);
      const tagFor = (c) => (!c ? "" : (c === "ok" ? " ▲ 更优" : " ▼ 更差"));
      return `<tr>
        <td class="cmp-lbl">${label}</td>
        <td class="${cs}">${f(sysVal)}<span class="cmp-tag">${tagFor(cs)}</span></td>
        <td class="${cu}">${f(userVal)}<span class="cmp-tag">${tagFor(cu)}</span></td>
      </tr>`;
    }

    function cmpBar(label, sysVal, userVal, lowerBetter, unit = " 万", digits = 2) {
      const a = Math.max(Number(sysVal) || 0, 0), c = Math.max(Number(userVal) || 0, 0);
      const max = Math.max(a, c, 1);
      const sysPct = Math.round(a / max * 100), userPct = Math.round(c / max * 100);
      const equal = Math.abs(a - c) < 1e-9;
      const sysWin = !equal && (lowerBetter ? a < c : a > c);
      const suffix = equal ? "（持平）" : (sysWin ? "（推荐更优）" : "（你的更优）");
      const f = (v) => Number(v).toLocaleString("zh-CN", {
        minimumFractionDigits: digits, maximumFractionDigits: digits,
      }) + unit;
      return `<div class="cmp-bar-block">
        <div class="cmp-bar-label">${label}${suffix}</div>
        <div class="cmp-bar-line"><span class="cmp-bar-name">推荐</span>
          <span class="cmp-bar-track"><span class="cmp-bar-fill ${equal ? "win" : (sysWin ? "win" : "lose")}" style="width:${sysPct}%"></span></span>
          <b>${f(a)}</b></div>
        <div class="cmp-bar-line"><span class="cmp-bar-name">你的</span>
          <span class="cmp-bar-track"><span class="cmp-bar-fill ${equal ? "win" : (sysWin ? "lose" : "win")}" style="width:${userPct}%"></span></span>
          <b>${f(c)}</b></div>
      </div>`;
    }

    function scoreStrip(sysItem, userItem) {
      const dims = [
        { key: "time_efficiency", label: "时间效率", digits: 1 },
        { key: "comfort_score", label: "住得舒服", digits: 1 },
        { key: "adapt_score", label: "抗风险", digits: 1 },
        { key: "surplus_happiness", label: "每月剩多少", digits: 1 },
      ];
      const fmt = (v, d) => Number(v || 0).toFixed(d);
      const sysScore = Number(sysItem.comprehensive_score || 0);
      const userScore = Number(userItem.comprehensive_score || 0);
      const scoreDiff = sysScore - userScore;
      const scoreWinner = Math.abs(scoreDiff) < 0.01 ? "tie" : (scoreDiff > 0 ? "sys" : "user");
      const dimHtml = dims.map(d => {
        const s = Number(sysItem[d.key] || 0), u = Number(userItem[d.key] || 0);
        const diff = s - u;
        const tie = Math.abs(diff) < 0.05;
        const sCls = tie ? "tie" : (diff > 0 ? "sys" : "user");
        const uCls = tie ? "tie" : (diff > 0 ? "user" : "sys");
        const dTxt = tie ? "持平" : `${diff > 0 ? "推荐高" : "你的高"} ${Math.abs(diff).toFixed(d.digits)}`;
        return `<div class="cmp-score-dim">
          <span class="name">${d.label}</span>
          <div class="nums"><b class="${sCls}">${fmt(s, d.digits)}</b> <span class="d">vs</span> <b class="${uCls}">${fmt(u, d.digits)}</b></div>
          <span class="d">${dTxt}</span>
        </div>`;
      }).join("");

      const sysWins = [], userWins = [];
      const cmp = (label, s, u, higherBetter, unit = "", digits = 2) => {
        const diff = s - u;
        if (Math.abs(diff) < 0.01) return;
        const sysBetter = higherBetter ? diff > 0 : diff < 0;
        const word = higherBetter ? "高" : "低";
        const txt = `${label}${word} ${Math.abs(diff).toFixed(digits)}${unit}`;
        (sysBetter ? sysWins : userWins).push(txt);
      };
      cmp("综合得分", sysScore, userScore, true, "", 2);
      dims.forEach(d => cmp(d.label, Number(sysItem[d.key] || 0), Number(userItem[d.key] || 0), true, "", d.digits));
      cmp("期末资产", Number(sysItem.liquid_asset_end_wan || 0), Number(userItem.liquid_asset_end_wan || 0), true, " 万", 2);
      cmp("30 年总利息", Number(sysItem.total_interest_wan || 0), Number(userItem.total_interest_wan || 0), false, " 万", 2);

      const winnerText = scoreWinner === "sys"
        ? `推荐方案 <b class="ok">+${Math.abs(scoreDiff).toFixed(2)}</b> 分`
        : scoreWinner === "user"
          ? `你的方案 <b class="ok">+${Math.abs(scoreDiff).toFixed(2)}</b> 分`
          : "两边持平";
      const trade = `你的优势：${userWins.length ? userWins.join("、") : "无"}；推荐的优势：${sysWins.length ? sysWins.join("、") : "无"}。`;
      return `<div class="cmp-score-strip">
        <div class="cmp-score-head">
          <span class="lbl">综合得分</span>
          <span class="sys">${fmt(sysScore, 2)}</span>
          <span class="delta">vs</span>
          <span class="user">${fmt(userScore, 2)}</span>
          <span class="delta">${winnerText}</span>
        </div>
        <div class="cmp-score-dims">${dimHtml}</div>
        <div class="cmp-score-tradeoff">${trade}<br>
          综合得分不是资产排行：它把时间、舒适、抗风险、每月剩多少一起加权。要不要为了这些非现金维度，接受资产/利息上的差距，是你自己的选择。
        </div>
      </div>`;
    }

    function schemeMonthly(item) {
      const loanP = item.loan_principal_wan || 0;
      const years = item.loan_year || 0;
      const repay = document.getElementById("repayKind").value;
      const calc = calcComboMortgage(loanP, nv("loanRatePct"), nv("providentLoanCapWan"), 3.1, years, repay);
      return { monthly: calc.monthly, interestWan: calc.totalInterest / 10000 };
    }

    // 逐年 / 逐月：先给 30 年，点哪一年再看那一年的 12 个月
    function flowRows(sysRows, userRows, unit, digits, labelOf) {
      const n = Math.min(sysRows.length, userRows.length);
      const get = (r) => ({
        outflow: r.outflow_wan !== undefined ? r.outflow_wan : r.outflow,
        cash: r.end_cash_wan !== undefined ? r.end_cash_wan : r.end_cash,
      });
      const fmtv = (v) => Number(v).toLocaleString("zh-CN", {
        minimumFractionDigits: digits, maximumFractionDigits: digits,
      });
      const num = (r, yearly, monthly) => {
        const v = r[yearly] !== undefined ? r[yearly] : r[monthly];
        return Number(v || 0);
      };
      // V7.10：鼠标悬停能看见“月供 / 公积金 / 自付”的拆分。
      // 不再让用户把“公积金抵扣后的自付支出”误读成“没有房贷”。
      const detail = (r) => {
        if (r.mortgage_wan === undefined && r.mortgage === undefined) return "";
        const mort = num(r, "mortgage_wan", "mortgage");
        const fund = num(r, "fund_inflow_wan", "fund_inflow");
        const pay = num(r, "self_pay_wan", "self_pay");
        const f = (v) => Number(v).toLocaleString("zh-CN", { maximumFractionDigits: digits });
        if (r.phase === "rent") {
          return `租房期：生活+房租+交通；公积金入账 ${f(fund)}${unit}（专款专用，不计入现金）`;
        }
        if (r.phase === "free") {
          return `自由期：生活+物业+交通；公积金入账 ${f(fund)}${unit}（专款专用，不计入现金）`;
        }
        return `房贷月供 ${f(mort)}${unit}，公积金抵扣 ${f(fund)}${unit}，自付 ${f(pay)}${unit}`;
      };

      const sign = (d) => Math.abs(d) < 0.005 ? 0 : (d > 0 ? 1 : -1);
      let finalLeader = 0;
      for (let i = n - 1; i >= 0; i--) {
        const d = get(sysRows[i]).cash - get(userRows[i]).cash;
        if (Math.abs(d) >= 0.005) { finalLeader = d > 0 ? 1 : -1; break; }
      }
      let crossIdx = -1;
      if (finalLeader !== 0) {
        for (let i = n - 1; i >= 1; i--) {
          const cur = sign(get(sysRows[i]).cash - get(userRows[i]).cash);
          const prev = sign(get(sysRows[i - 1]).cash - get(userRows[i - 1]).cash);
          if (cur === finalLeader && prev !== finalLeader) { crossIdx = i; break; }
        }
      }
      const crossWinner = finalLeader > 0 ? "sys" : finalLeader < 0 ? "user" : null;
      const finalDiff = n ? get(sysRows[n - 1]).cash - get(userRows[n - 1]).cash : 0;

      const rows = [];
      for (let i = 0; i < n; i++) {
        const s = get(sysRows[i]), u = get(userRows[i]);
        // 相等时两栏都绿（不再一红一绿）
        const sysCls = s.cash >= u.cash ? "ok" : "bad";
        const userCls = u.cash >= s.cash ? "ok" : "bad";
        // 支出：越低越好，相等时两边都绿
        const sysOut = s.outflow <= u.outflow ? "ok" : "bad";
        const userOut = u.outflow <= s.outflow ? "ok" : "bad";
        const mark = (i === crossIdx)
          ? `<span class="cmp-cross-tag">${crossWinner === "sys" ? "推荐从这里反超" : "你的方案从这里反超"}</span>`
          : "";
        rows.push(`<tr class="${i === crossIdx ? "cmp-cross-row" : ""}" ${labelOf.click ? `data-year="${i + 1}" style="cursor:pointer;"` : ""}>
          <td>${labelOf.text(sysRows[i])}${mark}</td>
          <td class="${sysOut}" title="${detail(sysRows[i])}">${fmtv(s.outflow)}${unit}</td>
          <td class="${userOut}" title="${detail(userRows[i])}">${fmtv(u.outflow)}${unit}</td>
          <td class="${sysCls}">${fmtv(s.cash)}${unit}</td>
          <td class="${userCls}">${fmtv(u.cash)}${unit}</td>
        </tr>`);
      }
      return { html: rows.join(""), crossIdx, crossWinner, finalDiff };
    }

    function outflowExplain(res) {
      const d = res.compare_diagnostics || {};
      const sysRows = res.best_timeline || [];
      const userRows = (res.anchor && res.anchor.timeline) || [];
      if (!sysRows.length || !userRows.length) return "";
      const by = {}, uy = {};
      sysRows.forEach(r => { by[r.year] = r; });
      userRows.forEach(r => { uy[r.year] = r; });
      const fmt = (v) => Number(v || 0).toFixed(2);
      const userEnd = d.user_loan_end_year;
      const bestFree = d.best_loan_end_year || (sysRows.find(r => r.phase === "free") || {}).year;
      const eq = d.outflow_equal_from_year;
      const lowerFrom = d.user_lower_from_year;
      const lowerTo = d.user_lower_to_year;
      const lowerAvg = d.user_lower_avg_wan;

      // 真 bug：还有明显自付，支出却相同
      if (d.unexplained_from_year) {
        return `<div class="cmp-foot" style="color:#f87171; background:rgba(248,113,113,.08); border-left:3px solid #f87171; padding:8px 10px; border-radius:6px; margin-top:8px;">⚠️ 第 ${d.unexplained_from_year} 年起，两边明明还有自付房贷，支出却相同。这可能是算法问题，请把这一屏截图发给经纬。</div>`;
      }

      const parts = [];
      if (lowerFrom && lowerTo) {
        parts.push(`✅ 第 ${lowerFrom}–${lowerTo} 年你的支出更低，平均每年少 <b>${fmt(lowerAvg)} 万</b>。`);
      }
      if (eq && by[eq] && uy[eq]) {
        const b = by[eq], u = uy[eq];
        const userPhase = d.user_phase_at_equal || u.phase;
        const bestPhase = d.best_phase_at_equal || b.phase;
        if (d.equal_outflow_reason === "fund_covers") {
          let text = `📌 第 ${eq} 年起两边支出相同，<b>不是算错</b>：`;
          if (bestPhase === "loan" && Number(b.mortgage_wan || 0) > 0.005) {
            text += `推荐方案还有房贷（月供 ${fmt(b.mortgage_wan)} 万/年），但公积金每年入账 ${fmt(b.fund_inflow_wan)} 万，自付 0；`;
          } else {
            text += `推荐方案第 ${bestFree || "--"} 年已不用还房贷；`;
          }
          if (userPhase === "loan" && Number(u.mortgage_wan || 0) > 0.005) {
            text += `你的方案虽然还有房贷，但公积金也已覆盖月供，自付 0。`;
          } else {
            text += `你的方案第 ${userEnd || "--"} 年已还完。`;
          }
          text += `两边剩下的都只是生活、物业、交通。`;
          parts.push(text);
        } else if (d.equal_outflow_reason === "both_free") {
          parts.push(`✅ 第 ${eq} 年起两边都还完了房贷，支出相同是正常的。你的方案第 ${userEnd || "--"} 年还完，推荐方案第 ${bestFree || "--"} 年还完。`);
        }
      }
      if (!parts.length) return "";
      const color = d.equal_outflow_reason === "fund_covers" ? "#fbbf24" : "#34d399";
      const bg = d.equal_outflow_reason === "fund_covers" ? "rgba(251,191,36,.08)" : "rgba(52,211,153,.08)";
      return `<div class="cmp-foot" style="color:${color}; background:${bg}; border-left:3px solid ${color}; padding:8px 10px; border-radius:6px; margin-top:8px;">${parts.join("<br>")}</div>`;
    }

    function timeSection(res) {
      const sysMonths = res.best_months || [], userMonths = (res.anchor && res.anchor.months) || [];
      const sysYears = res.best_timeline || [], userYears = (res.anchor && res.anchor.timeline) || [];

      const yearTable = flowRows(sysYears, userYears, " 万", 2, {
        text: (r) => `第 ${r.year} 年`, click: true,
      });
      const winnerName = yearTable.crossWinner === "sys" ? "推荐方案"
        : yearTable.crossWinner === "user" ? "你的方案" : "两边";
      const finalAbs = Math.abs(Number(yearTable.finalDiff || 0)).toFixed(2);
      const crossNote = yearTable.crossIdx >= 0
        ? `<div class="cmp-foot" style="color:#fbbf24;">📌 第 ${yearTable.crossIdx + 1} 年起，${winnerName}的现金领先并保持到第 30 年；最终${winnerName}多 <b>${finalAbs} 万</b>。点这一行，看它当年每个月的具体变化。</div>`
        : `<div class="cmp-foot">30 年里现金领先权没有切换；最终${winnerName}多 <b>${finalAbs} 万</b>。点某一年可看逐月变化。</div>`;

      return `<div class="cmp-section">
        <div class="cmp-title">🗓️ 逐年对比：你是在哪一年开始落后的</div>
        <table class="cmp-table tight clickable">
          <thead><tr><th>年份</th><th>推荐 · 自付支出</th><th>你的 · 自付支出</th><th>推荐 · 现金</th><th>你的 · 现金</th></tr></thead>
          <tbody>${yearTable.html}</tbody>
        </table>
        <div class="cmp-foot">支出 = 生活 + 物业 + 交通 + 房贷自付。公积金只能用于购房/还贷，抵扣掉的月供不算支出；期末资产只算现金，不含公积金账户余额和房子本身。鼠标悬停每一格可看拆分。${(_gapNote(res))}</div>
        ${outflowExplain(res)}
        ${crossNote}
        <div id="cmpMonthDrill" style="display:none; margin-top:12px;">
          <div class="cmp-title" id="cmpMonthDrillTitle"></div>
          <table class="cmp-table tight">
            <thead><tr><th>月份</th><th>推荐 · 自付支出</th><th>你的 · 自付支出</th><th>推荐 · 现金</th><th>你的 · 现金</th></tr></thead>
            <tbody id="cmpMonthDrillBody"></tbody>
          </table>
          <div class="cmp-foot">单位：元。这一年里每个月的现金差距，比年度数字更能说明问题。</div>
        </div>
      </div>`;
    }

    function bindYearDrill(res) {
      const sysMonths = res.best_months || [], userMonths = (res.anchor && res.anchor.months) || [];
      document.querySelectorAll("#detailModal .cmp-table.clickable tbody tr").forEach(tr => {
        tr.onclick = () => {
          const y = parseInt(tr.dataset.year, 10);
          if (!y) return;
          const from = (y - 1) * 12, to = y * 12;
          const s = sysMonths.slice(from, to), u = userMonths.slice(from, to);
          const body = flowRows(s, u, " 元", 0, { text: (r) => `第 ${r.month} 个月`, click: false }).html;
          document.getElementById("cmpMonthDrillTitle").innerText = `📅 第 ${y} 年 · 逐月`;
          document.getElementById("cmpMonthDrillBody").innerHTML = body;
          const box = document.getElementById("cmpMonthDrill");
          box.style.display = "block";
          box.scrollIntoView({ behavior: "smooth", block: "nearest" });
        };
      });
    }

    // 装修借款说明：毛坯房首付掏空后借钱装修，期末一次性扣回。
    // 不写这句，用户会看到"最后一年现金突然变少"或"我的现金更多却说我少"。
    function _gapNote(res) {
      const a = (res && res.anchor) || {}, b = (res && res.best) || {};
      const parts = [];
      if ((Number(b.reno_gap_wan) || 0) > 0.01) parts.push(`推荐方案 ${Number(b.reno_gap_wan).toFixed(2)} 万`);
      if ((Number(a.reno_gap_wan) || 0) > 0.01) parts.push(`你的方案 ${Number(a.reno_gap_wan).toFixed(2)} 万`);
      if (!parts.length) return "";
      return ` <span style="color:#fbbf24;">毛坯房装修借款：${parts.join("、")}，已在第 30 年一次性扣回` +
        `（所以最后一年现金会比前一年低——那是还钱，不是算错）。</span>`;
    }

    function openCompareModal(res) {
      const sysItem = res.best, userItem = res.anchor;
      // 两个方案并排，需要更宽的窗口：800 → 1180
      const _mc = document.querySelector("#detailModal .modal-content");
      if (_mc) _mc.style.maxWidth = "1180px";
      const dsText = (k) => k === "max" ? "掏空首付" : (k === "balanced" ? "折中首付" : "最低首付");
      const s = schemeMonthly(sysItem), u = schemeMonthly(userItem);
      const spend = nv("monthExp") + nv("propertyFee");
      // 公积金抵扣后再算自付，否则会把"支出占比"算高（月供里有一半是公积金账户在还）
      const incomeAtLoan = (item) =>
        nv("monthIncomeNet") * Math.pow(1 + nv("annualIncomeGrowthPct") / 100, item.rent_year || 0);
      const fundAtLoan = (item) => incomeAtLoan(item) * nv("housingFundPct") / 100;
      const selfPayMonthly = (item) => Math.max(0, schemeMonthly(item).monthly - fundAtLoan(item));
      const ratio = (item) => {
        const income = incomeAtLoan(item);
        if (!(income > 0)) return 0;
        return (spend + selfPayMonthly(item)) / income * 100;
      };

      const sections = [
        ["🏠 购房与贷款", [
          ["实际首付", sysItem.down_payment_wan, userItem.down_payment_wan, 0, " 万", 1],
          ["贷款本金", sysItem.loan_principal_wan, userItem.loan_principal_wan, 0, " 万", 1],
          ["30 年总利息", sysItem.total_interest_wan, userItem.total_interest_wan, -1, " 万", 2],
          ["房贷月供（估）", s.monthly, u.monthly, -1, " 元", 0],
          ["首年月供自付（估）", selfPayMonthly(sysItem), selfPayMonthly(userItem), -1, " 元", 0],
          ["支出占收入比（估）", ratio(sysItem), ratio(userItem), -1, " %", 1],
          ["装修预算", sysItem.reno_budget_wan, userItem.reno_budget_wan, 0, " 万", 1],
        ]],
        ["💰 30 年后", [
          ["30 年后家底（现金＋房子）", sysItem.net_worth_end_wan, userItem.net_worth_end_wan, 1, " 万", 2],
          ["其中现金", sysItem.liquid_asset_end_wan, userItem.liquid_asset_end_wan, 1, " 万", 2],
          ["家底（今日购买力）", sysItem.real_net_worth_end_wan, userItem.real_net_worth_end_wan, 1, " 万", 2],
          // 毛坯房借钱装修的那笔，期末扣回——必须单独列出来，
          // 否则"我的现金更多、你却说我家底更少"（用户 2026-11-05 的疑问）
          ...((Number(sysItem.reno_gap_wan) > 0.01 || Number(userItem.reno_gap_wan) > 0.01)
            ? [["其中装修借款（期末扣回）", sysItem.reno_gap_wan || 0, userItem.reno_gap_wan || 0, -1, " 万", 2]]
            : []),
          ["最低现金可撑", sysItem.buffer_months, userItem.buffer_months, 1, " 个月", 1],
        ]],
        ["📊 五维评分", [
          ["抗风险", sysItem.adapt_score, userItem.adapt_score, 1, "", 1],
          ["住得舒服", sysItem.comfort_score, userItem.comfort_score, 1, "", 1],
          ["每月剩多少", sysItem.surplus_happiness, userItem.surplus_happiness, 1, "", 1],
          ["时间效率", sysItem.time_efficiency, userItem.time_efficiency, 1, "", 1],
          ["综合得分", sysItem.comprehensive_score, userItem.comprehensive_score, 1, "", 2],
        ]],
      ];

      const body = sections.map(([title, rows]) => `
        <div class="cmp-section">
          <div class="cmp-title">${title}</div>
          <table class="cmp-table">
            <thead><tr><th>指标</th><th>推荐：租 ${sysItem.rent_year} 年 + 贷 ${sysItem.loan_year} 年</th>
              <th>你的：租 ${userItem.rent_year} 年 + 贷 ${userItem.loan_year} 年</th></tr></thead>
            <tbody>${rows.map(r => cmpRow(...r)).join("")}</tbody>
          </table>
        </div>`).join("");

      document.getElementById("modalBody").innerHTML = `
        <div class="cmp-head">
          <div class="cmp-side sys"><b>系统推荐</b><span>租 ${sysItem.rent_year} 年 + 贷 ${sysItem.loan_year} 年 · ${dsText(sysItem.down_strategy)} · 综合 ${Number(sysItem.comprehensive_score || 0).toFixed(2)}</span></div>
          <div class="cmp-vs">VS</div>
          <div class="cmp-side user"><b>你的方案</b><span>租 ${userItem.rent_year} 年 + 贷 ${userItem.loan_year} 年 · ${dsText(userItem.down_strategy)} · 综合 ${Number(userItem.comprehensive_score || 0).toFixed(2)}</span></div>
        </div>
        ${scoreStrip(sysItem, userItem)}
        <div class="cmp-bars">
          ${cmpBar("综合得分", sysItem.comprehensive_score, userItem.comprehensive_score, false, "", 2)}
          ${cmpBar("30 年后家底", sysItem.net_worth_end_wan, userItem.net_worth_end_wan, false)}
          ${cmpBar("30 年总利息", sysItem.total_interest_wan, userItem.total_interest_wan, true)}
        </div>
        ${body}
        ${timeSection(res)}
        <div class="cmp-foot">绿 = 这一项更优，红 = 更差。首付、贷款本金属于中性指标，不判优劣：首付多则本金少，是一体两面。
          ${(Number(sysItem.adapt_score) === 0 && Number(userItem.adapt_score) === 0)
            ? "<br>⚠️ 两套方案抗风险都是 0：说明它们都贴着 70% 红线，安全余量为 0，只是勉强可行。"
            : ""}</div>
      `;
      document.getElementById("modalTitle").innerText = "📊 方案对比 | 系统推荐 vs 你的方案";
      document.getElementById("detailModal").style.display = "flex";
      bindYearDrill(res);

      document.querySelectorAll(".cmp-tab").forEach(btn => {
        btn.onclick = () => {
          document.querySelectorAll(".cmp-tab").forEach(x => x.classList.remove("active"));
          btn.classList.add("active");
          const monthly = btn.dataset.tab === "monthly";
          document.getElementById("cmpMonthly").style.display = monthly ? "block" : "none";
          document.getElementById("cmpYearly").style.display = monthly ? "none" : "block";
        };
      });
    }
