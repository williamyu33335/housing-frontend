
    (function () {
      "use strict";

      const MQ = window.matchMedia("(max-width: 760px)");
      const body = document.body;
      const $ = (id) => document.getElementById(id);
      const isMobile = () => MQ.matches;

      let tab = "map";
      let screen = "params";
      let compact = true;
      let summaryBox = null;
      let listingTimer = null;
      let usedSubText = "正在读取房源…";

      /* ---------- 小工具 ---------- */
      const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
      ));
      const wan = (v, d) => (v == null || isNaN(v)) ? "—" : Number(v).toFixed(d === undefined ? 1 : d);
      const signWan = (v, d) => (v > 0 ? "+" : "") + wan(v, d === undefined ? 2 : d);
      const near = (a, b, eps = 0.05) => Math.abs(a - b) < eps;

      /* ---------- 结论卡容器 ---------- */
      function ensureSummary() {
        if (summaryBox && document.contains(summaryBox)) return summaryBox;
        const rp = $("rightPanel");
        if (!rp) return null;
        summaryBox = document.createElement("div");
        summaryBox.id = "mSummary";
        summaryBox.className = "m-keep";
        // 顶部匹配入口是导航，必须排在结论卡前面——不能把入口顶下去
        const dock = $("matchDock");
        if (dock && dock.parentNode === rp) rp.insertBefore(summaryBox, dock.nextSibling);
        else rp.insertBefore(summaryBox, rp.firstChild);
        return summaryBox;
      }

      /* ---------- Tab / 屏切换 ---------- */
      function paintTabs() {
        document.querySelectorAll("#mTabBar .m-tab").forEach((b) => {
          b.classList.toggle("on", b.getAttribute("data-tab") === tab);
        });
      }

      function setTab(name, opts) {
        const ov = document.getElementById("matchOverlay");
        if (ov) ov.classList.remove("on");
        if (!isMobile()) return;
        if (!name) return;
        tab = name;
        body.dataset.mtab = name;
        // 切 Tab 等于"离开当前视图"：匹配覆盖层已经关了，视图状态必须跟着走，
        // 否则 body 上还挂着 data-view="match"，回推演时会看见两个面板互斥打架。
        if (body.dataset.view === "match") {
          body.dataset.view = (name === "sim" && screen === "result") ? "result" : "params";
        }
        if (name === "sim") body.dataset.mscreen = screen;
        paintTabs();
        if (name === "list") ensureListings();
        if (name === "me") renderMe();
        bumpViz();
        if (!(opts && opts.silent)) {
          const el = name === "list" ? $("mScreenList") : (name === "me" ? $("mScreenMe") : null);
          if (el && name !== tab) el.scrollTop = 0;
        }
      }

      function setScreen(s) {
        if (!isMobile()) return;
        const prev = screen;
        screen = (s === "result") ? "result" : "params";
        if (tab === "sim") body.dataset.mscreen = screen;
        if (screen === "result") setCompact(true);
        // 只有真的换了屏才回到顶部：改个片区就把人弹回页首，很烦
        if (screen !== prev) {
          const el = screen === "result" ? $("rightPanel") : $("leftPanel");
          if (el) el.scrollTop = 0;
        }
        bumpViz();
      }

      function setCompact(on) {
        compact = !!on;
        body.classList.toggle("m-compact", compact);
        const btn = document.querySelector("#mSummary [data-mact='expand']");
        if (btn) btn.textContent = compact ? "展开全部明细（图表 / 全部方案 / 报告）" : "收起，只看结论";
      }

      /* ---------- 尺寸校正：面板是显隐切换的，图要重新量 ---------- */
      function bumpViz() {
        const ha = window.HousingApp;
        const run = () => { if (ha && ha.resizeViz) ha.resizeViz(); };
        run();
        setTimeout(run, 120);
        setTimeout(run, 420);
      }

      /* ---------- 结论卡 ---------- */
      const DIMS = [
        ["时间效率", "time_efficiency"],
        ["居住舒适", "comfort_score"],
        ["抗风险", "adapt_score"],
        ["结余幸福", "surplus_happiness"],
        ["期末资产", "liquid_asset_end_wan"]
      ];

      function kpi(label, value, unit, tone) {
        return '<div class="m-kpi ' + (tone || "") + '">' +
          '<div class="k">' + label + '</div>' +
          '<div class="v">' + value + '<span class="u">' + (unit || "") + '</span></div></div>';
      }

      function chip(text, warn) {
        return '<span class="m-chip' + (warn ? " warn" : "") + '">' + text + '</span>';
      }

      function anchorChips(a, b) {
        const mine = [], theirs = [];
        DIMS.forEach(([label, key]) => {
          const av = Number(a[key]), bv = Number(b[key]);
          if (isNaN(av) || isNaN(bv) || near(av, bv)) return;
          (av > bv ? mine : theirs).push(label);
        });
        let html = "";
        if (mine.length) html += chip("你的优势：" + mine.join(" / "));
        if (theirs.length) html += chip("推荐优势：" + theirs.join(" / "), true);
        return html ? '<div class="m-chips">' + html + '</div>' : "";
      }

      // 两句话说完：你赢在哪 / 你输在哪 + 推荐方案的代价。
      // 更细的逐项解释放「逐项对比」，不在这里堆。
      function verdictFor(a, b, d) {
        const ai = Number(a.total_interest_wan) || 0;
        const bi = Number(b.total_interest_wan) || 0;
        const da = Number(d.asset_wan) || 0;

        let s1;
        if (Math.abs(ai - bi) < 0.05) {
          s1 = "两边利息一样（<b>" + wan(ai) + " 万</b>）";
        } else if (ai < bi) {
          s1 = "你利息省了 <b>" + wan(bi - ai) + " 万</b>";
        } else {
          s1 = "你利息多了 <b>" + wan(ai - bi) + " 万</b>";
        }

        let s2;
        if (da > 0.05) {
          s2 = "，但 30 年后少 <b>" + wan(da) + " 万</b>" +
            (d.real_asset_wan != null ? "（今天的 " + wan(d.real_asset_wan) + " 万）" : "") + "。";
        } else if (da < -0.05) {
          s2 = "，钱反而多 <b>" + wan(-da) + " 万</b>；推荐是赢在别的维度。";
        } else {
          s2 = "，家底（含房子）也几乎一样。";
        }

        const cost = [];
        const dd = Number(b.down_payment_wan) - Number(a.down_payment_wan);
        if (dd > 0.5) cost.push("首付多 " + wan(dd) + " 万");
        cost.push("现金最低 " + wan(b.min_cash_wan) + " 万（撑 " + wan(b.buffer_months, 1) + " 个月）");
        return s1 + s2 + "推荐方案的代价：" + cost.join("，") + "。";
      }

      function renderSummary(res) {
        const box = ensureSummary();
        if (!box) return;
        if (!res) { box.innerHTML = ""; return; }

        /* 情况一：用户自报的方案不可行 */
        if (res.mode === "anchor" && res.feasible === false) {
          const nb = (res.near_feasible || []).slice(0, 3).map((x) =>
            '<div class="m-row"><span>租 ' + x.rent_year + " 年 · 贷 " + x.loan_year + " 年</span>" +
            '<span style="color:#6ee7b7">综合 ' + wan(x.comprehensive_score, 1) + "</span></div>"
          ).join("");
          box.innerHTML =
            '<div class="m-sum-card">' +
            '<div class="m-sum-eyebrow">你的方案</div>' +
            '<div class="m-sum-title">❌ 你这个预期实现不了</div>' +
            '<div class="m-sum-verdict">' + esc(res.reason || "在当前参数下，这个组合过不了红线。") + "</div>" +
            (nb ? '<div class="m-kpis" style="grid-template-columns:1fr"><div class="m-kpi"><div class="k">同一租房年限下最接近的可行方案</div>' + nb + "</div></div>" : "") +
            '<div class="m-actions"><button class="m-btn" data-mact="params">改参数再算一次</button></div>' +
            "</div>";
          return;
        }

        const a = (res.mode === "anchor" && res.feasible) ? res.anchor : null;
        const b = a ? res.best : (res.top_comprehensive || [])[0];
        if (!b) { box.innerHTML = ""; return; }
        const d = res.delta || {};

        let title, sub, verdict;
        title = "推荐 租 " + b.rent_year + " 年 · 贷 " + b.loan_year + " 年";
        if (a) {
          sub = "你的方案：租 " + a.rent_year + " · 贷 " + a.loan_year +
            "　·　第 " + res.rank + " / " + res.total + " 名";
          verdict = verdictFor(a, b, d);
        } else {
          sub = "首付 " + wan(b.down_payment_wan) + " 万 · 贷款 " + wan(b.loan_principal_wan) + " 万";
          // 极端参数下抗风险会退化成 0（所有可行方案都贴着 70% 红线），
          // 直接写“抗风险 0.0”会让人以为模型坏了，这里说清楚。
          const adaptTxt = Number(b.adapt_score) < 1
            ? "贴线（可行方案都卡在 70% 红线）"
            : "<b>" + wan(b.adapt_score) + "</b>";
          verdict = "综合 " + wan(b.comprehensive_score, 1) + " 分 · 抗风险 " + adaptTxt +
            " · 住得舒服 " + wan(b.comfort_score) + " · 时间效率 " + wan(b.time_efficiency) + "。";
        }

        // 普通人最先问的是“每月要还多少”，所以这一格必须有。
        // 有逐月明细（锚点接口）就用真实自付；没有就退到月供口径并说明。
        // 和报告里“实际自付月供”用同一套口径，避免一屏两个数打架
        let payVal = null, payUnit = "元", payLabel = "每月自付";
        try {
          const sm = schemeMonthly(b);
          const fundM = Number(nv("monthIncomeNet") || 0) * Number(nv("housingFundPct") || 0) / 100;
          payVal = Math.max(0, Math.round(sm.monthly - Math.min(sm.monthly, fundM)));
        } catch (_) { payVal = null; }

        const kpis =
          kpi("综合得分", wan(b.comprehensive_score, 1), "分") +
          kpi("30 年后家底", wan(b.net_worth_end_wan), "万") +
          kpi(payLabel, payVal == null ? "—" : Number(payVal).toLocaleString(), payUnit) +
          kpi("总利息", wan(b.total_interest_wan), "万") +
          kpi("首付", wan(b.down_payment_wan), "万") +
          kpi("最低现金", wan(b.min_cash_wan), "万", Number(b.buffer_months) < Number(b.buffer_required) ? "bad" : "good");

        box.innerHTML =
          '<div class="m-sum-card">' +
          '<div class="m-sum-eyebrow">' + (a ? "你的方案 vs 系统推荐" : "系统推荐") +
          (b.house_type === "new" ? " · 新房" : " · 二手房") +
          (b.purchase_tax_rate_pct != null ? " · 税费 " + wan(b.purchase_tax_rate_pct, 1) + "%" : "") + "</div>" +
          '<div class="m-sum-title">' + title + "</div>" +
          '<div class="m-sum-sub">' + sub + "</div>" +
          '<div class="m-sum-verdict">' + verdict + "</div>" +
          '<div class="m-kpis">' + kpis + "</div>" +
          '<div class="m-sum-note">家底=现金+房−房贷；车不算资产。</div>' +
          (() => {
            const am = res.spatial && res.spatial.area_match;
            if (!am || am.status !== "over") return "";
            return '<div class="m-sum-note" style="color:#fcd34d;">按这个预算，你能买到约 ' +
              am.live_area_sqm + " ㎡ 套内，比你要的 " + am.target_area_sqm +
              " ㎡ 还大；只想要 " + am.target_area_sqm + " ㎡ 的话，总价大约 " +
              am.need_total_wan + " 万。</div>";
          })() +
          (a ? anchorChips(a, b) : "") +
          '<div class="m-actions">' +
          '<button class="m-btn" data-mact="compare">逐项对比</button>' +
          '<button class="m-btn plain" data-mact="params">改参数</button>' +
          "</div>" +
          '<div class="m-actions"><button class="m-btn ghost" data-mact="expand">看图表与全部方案</button></div>' +
          "</div>";
        setCompact(compact);
      }

      /* ---------- 房源闭环第一步：先匹配，再摆清单 ----------
         用户打开「房源」，第一个问题不是"你有多少套房"，
         是"我这个预算、这个面积，到底有没有对得上的房子"。
         规则在后端 listings_match.py（纯函数），这里只负责问和显示。 */
      let matchRows = [];

      function currentMatchParams() {
        const ha = window.HousingApp || {};
        const city = ha.currentCity || null;
        const num = (id, d) => {
          const el = $(id);
          const v = el ? parseFloat(el.value) : NaN;
          return isNaN(v) ? d : v;
        };
        const htBtn = document.querySelector("[data-htype].active");
        return {
          city_code: city ? String(city.code) : "450100",
          budget_wan: num("houseTotalWan", 0),
          target_area_sqm: num("targetAreaSqm", 0),
          house_type: htBtn ? htBtn.getAttribute("data-htype") : "unspecified",
          public_share_pct: (() => {
            const el = $("publicSharePct");
            const v = el ? parseFloat(el.value) : NaN;
            return isNaN(v) ? -1 : v;
          })(),
          limit: 12,
          // V8.10：偏好与权重一起发给后端，后端和前端用同一套排序口径
          pref: currentPref,
          amenity_weight: 0.12
        };
      }

      /* 后端还是旧版时的本地兜底：规则和后端 listings_match.py 一致，
         界面上会标明"本地规则"，绝不假装是后端算的。 */
      function localMatch(p, rows) {
        const share = p.public_share_pct >= 0
          ? p.public_share_pct / 100
          : ({ new: 0.22, used: 0.15 }[p.house_type] || 0.18);
        const liveOf = (x) => {
          const live = Number(x.live_area_sqm) || 0;
          if (live > 0) return live;
          const built = Number(x.area_sqm) || 0;
          return built > 0 ? built * Math.max(0.55, 1 - share) : 0;
        };
        const pool = (rows || []).filter((x) => (Number(x.total_price) || 0) > 0);
        const deco = (x, budget, target) => {
          const wanP = (Number(x.total_price) || 0) / 10000;
          const live = liveOf(x);
          const o = {
            id: x.id, community: x.community || x.title || "未命名小区",
            district_name: x.district_name, total_price: x.total_price,
            price_wan: Math.round(wanP * 100) / 100,
            area_sqm: Math.round((Number(x.area_sqm) || 0) * 10) / 10,
            live_area_sqm: Math.round(live * 10) / 10,
            price_sqm: Math.round(Number(x.price_sqm) || 0),
            bedrooms: x.bedrooms, decoration: x.decoration, source: x.source,
            geo_level: x.geo_level, geo_approximate: !!x.geo_approximate,
            lat: x.lat, lng: x.lng
          };
          if (budget > 0) o.price_delta_pct = Math.round((wanP - budget) / budget * 1000) / 10;
          if (target > 0 && live > 0) o.area_delta_pct = Math.round((live - target) / target * 1000) / 10;
          return o;
        };
        if (!pool.length) {
          return { data: [], count: 0, reason: "no_pool", pool: { n: 0 }, band: {},
                   nearest: [], message: "这个城市还没有入库房源。我们不编数据，所以这里就是空的。" };
        }
        if (!(p.budget_wan > 0) && !(p.target_area_sqm > 0)) {
          return { data: [], count: 0, reason: "no_budget", pool: { n: pool.length }, band: {},
                   nearest: [], message: "先填「房屋总价」或「想住多大」，我才能去库里找。" };
        }
        const lo = p.budget_wan > 0 ? p.budget_wan * 0.9 : 0;
        const hi = p.budget_wan > 0 ? p.budget_wan * 1.1 : Infinity;
        const aLo = p.target_area_sqm > 0 ? p.target_area_sqm * 0.85 : 0;
        const aHi = p.target_area_sqm > 0 ? p.target_area_sqm * 1.15 : Infinity;
        const hits = [];
        pool.forEach((x) => {
          const wanP = (Number(x.total_price) || 0) / 10000;
          if (wanP < lo || wanP > hi) return;
          const live = liveOf(x);
          if (p.target_area_sqm > 0 && (live < aLo || live > aHi)) return;
          const o = deco(x, p.budget_wan, p.target_area_sqm);
          o._s = Math.abs(o.price_delta_pct || 0) + Math.abs(o.area_delta_pct || 0);
          hits.push(o);
        });
        hits.sort((a, b) => a._s - b._s);
        hits.forEach((h) => { delete h._s; });
        const out = { data: hits.slice(0, 12), count: hits.length, band: {}, nearest: [], __local: true };
        const prices = pool.map((x) => (Number(x.total_price) || 0) / 10000);
        out.pool = { n: pool.length, min_wan: Math.round(Math.min.apply(null, prices) * 10) / 10,
                     max_wan: Math.round(Math.max.apply(null, prices) * 10) / 10 };
        if (!hits.length) {
          out.reason = "no_match";
          out.message = "库里 " + pool.length + " 套在售，总价 " + out.pool.min_wan + "~" +
            out.pool.max_wan + " 万；你要的 " + (p.budget_wan > 0 ? wan(p.budget_wan, 0) + " 万" : "") +
            (p.target_area_sqm > 0 ? " / 套内 " + wan(p.target_area_sqm, 0) + " ㎡" : "") + " 里没有对得上的。";
          out.nearest = pool.slice().sort((a, b) =>
            Math.abs((Number(a.total_price) || 0) / 10000 - p.budget_wan) -
            Math.abs((Number(b.total_price) || 0) / 10000 - p.budget_wan)
          ).slice(0, 3).map((x) => deco(x, p.budget_wan, p.target_area_sqm));
        }
        return out;
      }

      function decoLabel(v) {
        return { rough: "毛坯", partial: "带装修要改造", finished: "已装修" }[v] || "";
      }

      function matchCard(x, i, isNearest) {
        const pps = x.price_sqm ? Math.round(x.price_sqm) : null;
        const bits = [];
        if (x.price_delta_pct != null) {
          const d = x.price_delta_pct;
          bits.push((d > 0 ? "比预算贵 " : (d < 0 ? "比预算便宜 " : "与预算持平 ")) +
            (d === 0 ? "" : wan(Math.abs(d), 1) + "%"));
        }
        if (x.area_delta_pct != null) {
          const a = x.area_delta_pct;
          bits.push((a >= 0 ? "套内大 " : "套内小 ") + wan(Math.abs(a), 1) + "%");
        }
        if (x.decoration) bits.push(decoLabel(x.decoration));
        return '<div class="m-lcard">' +
          '<div class="m-lcard-top"><b>' + esc(x.community || "未命名小区") + "</b>" +
          '<span class="m-price">' + wan(x.price_wan) + " 万</span></div>" +
          '<div class="m-lcard-sub">套内 ' + wan(x.live_area_sqm, 1) + " ㎡ · 建面 " + wan(x.area_sqm, 1) + " ㎡" +
          (pps ? " · " + pps.toLocaleString() + " 元/㎡" : "") +
          (x.bedrooms ? " · " + esc(x.bedrooms) + " 室" : "") + "</div>" +
          (bits.length ? '<div class="m-lcard-sub" style="color:#94a3b8;">' + esc(bits.join(" · ")) + "</div>" : "") +
          '<div class="m-lcard-foot"><span>📍 ' + esc(x.district_name || "区位未知") + "</span>" +
          "<span>" + (x.geo_approximate ? "区位中心近似" : "精确坐标") + "</span></div>" +
          '<div class="m-actions"><button class="m-btn plain" data-use="' + i + '">用这套去推演</button></div>' +
          "</div>";
      }

      function renderMatch(json, p) {
        const box = $("mMatchBox");
        if (!box) return;
        const list = (json && json.data) || [];
        const nearList = (json && json.nearest) || [];
        matchRows = list.concat(nearList);

        const want = [
          p.budget_wan > 0 ? wan(p.budget_wan, 0) + " 万" : "",
          p.target_area_sqm > 0 ? "套内 " + wan(p.target_area_sqm, 0) + " ㎡" : ""
        ].filter(Boolean).join(" / ");

        if (json && json.reason === "no_db") {
          box.innerHTML = '<div class="m-note" style="color:#fca5a5;">' + esc(json.message || "数据库没连上") + "</div>";
          return;
        }
        if (json && json.reason === "no_budget") {
          box.innerHTML = '<div class="m-note">' + esc(json.message || "") + "</div>";
          return;
        }

        const localNote = json.__local
          ? '<div class="m-note" style="color:#94a3b8;">（这批结果是本地按同一套规则算的：后端还没升级到 V8.13.0，部署后会自动改为后端计算。）</div>'
          : "";

        if (list.length) {
          const head = "按你的 " + esc(want) + "，库里 " + list.length + " 套对得上" +
            (json.count > list.length ? "（共 " + json.count + " 套，先给你最接近的 " + list.length + " 套）" : "") + "：";
          box.innerHTML =
            '<div class="m-note" style="color:#86efac;">✅ ' + head + "</div>" + localNote +
            list.map((x, i) => matchCard(x, i, false)).join("") +
            '<div class="m-note">点「用这套去推演」，总价和套内会自动填进参数，再点开始推演。</div>';
          return;
        }

        // 没匹配上：先把原因说对，再给"最接近的"——但绝不叫推荐
        let html = '<div class="m-note" style="color:#fcd34d;">⚠️ ' +
          esc((json && json.message) || "库里没有对得上的房子") + "</div>" + localNote;
        if (nearList.length) {
          html += '<div class="m-note">下面 3 套不是匹配结果，只是让你看看差多少：</div>' +
            nearList.map((x, i) => matchCard(x, list.length + i, true)).join("");
        }
        box.innerHTML = html;
      }

      async function ensureMatch() {
        const box = $("mMatchBox");
        if (!box) return;
        const ha = window.HousingApp || {};
        const p = currentMatchParams();
        if (!(p.budget_wan > 0) && !(p.target_area_sqm > 0)) {
          matchRows = [];
          box.innerHTML = '<div class="m-note">先填「房屋总价」或「想住多大」，这里就能告诉你：这个预算在库里有没有对得上的房子。</div>';
          return;
        }
        box.innerHTML = '<div class="m-note">正在按你的预算找房…</div>';
        try {
          const res = await fetch((ha.apiHost || "") + "/api/listings/match", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p),
            signal: (window.AbortSignal && AbortSignal.timeout) ? AbortSignal.timeout(30000) : undefined
          });
          if (!res.ok) throw new Error("HTTP " + res.status);
          renderMatch(await res.json(), p);
        } catch (e) {
          const rows = (ha.listings || []).slice();
          const msg = String((e && e.message) || e);
          if (rows.length && /404|HTTP 5\d\d/.test(msg)) {
            // 后端还是旧版：本地按同一套规则算，并标明来源
            renderMatch(localMatch(p, rows), p);
            return;
          }
          const sleepy = /abort|timeout|timed out|failed to fetch/i.test(msg);
          box.innerHTML = '<div class="m-note" style="color:#fcd34d;">' +
            (sleepy ? "后端还在唤醒（Render 免费实例冷启动要 20~30 秒），再点一次「房源」就好。" :
                      "房源匹配接口没通（" + esc(msg) + "）。") +
            "<br><span style='font-size:12px;'>" +
            '这里不会拿"最接近的"冒充匹配结果。</span></div>';
        }
      }

      /* ---------- 独立匹配面板（桌面/手机通用） ---------- */
      let panelRows = [];
      let panelShown = 7;
      let currentPref = "commute";     // commute | family | leisure

      function ensureOverlay() {
        if (document.getElementById("matchOverlay")) return;
        const ov = document.createElement("div");
        ov.id = "matchOverlay";
        ov.innerHTML =
          '<div id="matchPanel">' +
          '<div class="mp-head"><div><h3>🔎 推荐房源匹配</h3>' +
          '<div class="mp-sub" id="mpSub">按你算出来的条件，在真实房源里挑</div>' +
          '<div class="mp-prefs" style="display:flex;gap:8px;margin:6px 0 10px;">' +
          Object.keys(AMENITY_PREFS).map((k, idx) =>
            '<button type="button" class="pref-chip' + (idx === 0 ? " on" : "") + '" data-pref="' + k + '">' +
            AMENITY_PREFS[k].label + "</button>").join("") +
          "</div></div>" +
          '<div style="display:flex;gap:6px;flex:0 0 auto;">' +
          '<button class="mp-close" id="mpCollapse" type="button">收起 ↩</button>' +
          '<button class="mp-close" id="mpClose" type="button" title="关闭匹配，回到结果分析">✕</button>' +
          "</div></div>" +
          '<div class="mp-grid" id="mpGrid"></div>' +
          '<button class="mp-more" id="mpMore" type="button" style="display:none;"></button>' +
          '<div id="mpHuxing"></div>' +
          "</div>";
        document.body.appendChild(ov);
        ov.addEventListener("click", (e) => { if (e.target === ov) closeMatchPanel(); });
        ov.querySelector("#mpClose").onclick = closeMatchPanel;
        // 「收起」= 把面板折叠成一条，地图留在原地（这就是用户要的"看看这个地方长啥样"），
        // 不是回到结果分析。再点一次展开。
        ov.querySelector("#mpCollapse").onclick = () => setMatchCollapsed(!mpCollapsed);
        ov.querySelectorAll("[data-pref]").forEach((b) => {
          b.onclick = () => {
            currentPref = b.getAttribute("data-pref");
            ov.querySelectorAll("[data-pref]").forEach((x) => x.classList.toggle("on", x === b));
            sortPanelRows();
            paintMatchPanel();
          };
        });
        ov.querySelector("#mpMore").onclick = () => {
          panelShown = panelRows.length;
          paintMatchPanel();
        };
      }

      /* 收起/展开：折叠只动"列表"，不动视图。
         折叠后 overlay 背景透明、点击穿透，地图可以继续拖、继续放大——
         用户点完一套房想看清这块地方，不该被弹回结果页。 */
      let mpCollapsed = false;
      function setMatchCollapsed(on) {
        mpCollapsed = !!on;
        const ov = document.getElementById("matchOverlay");
        const panel = document.getElementById("matchPanel");
        const btn = document.getElementById("mpCollapse");
        if (ov) ov.classList.toggle("collapsed", mpCollapsed);
        if (panel) panel.classList.toggle("collapsed", mpCollapsed);
        if (btn) btn.textContent = mpCollapsed ? "展开 ⇣" : "收起 ↩";
        const sub = document.getElementById("mpSub");
        if (sub && mpCollapsed) sub.dataset.keep = sub.textContent;
      }

      function closeMatchPanel() {
        const ov = document.getElementById("matchOverlay");
        if (ov) ov.classList.remove("on");
        lpReturnToMatch = false;
        try { closeListingPage(); } catch (_) { }
        if (window.__setView) window.__setView("result");
      }

      function poiOf(any) {
        // V8.10：优先这套房自己的周边数据，没有才退回片区
        try { return amenityScoreOfRow(any, currentPref); } catch (_) { return null; }
      }

      // 排序：预算/面积贴合为主（这是刚需的第一约束），便利分只做微调。
      // 12% 这个权重是刻意压住的：豆包提醒过，配套权重一高，预算就沦为次要条件，
      // 那不是"更智能"，那是把用户带去看买不起的房子。
      function sortPanelRows() {
        panelRows.sort((a, b) => {
          const sa = Math.abs(a.price_delta_pct || 0) + Math.abs(a.area_delta_pct || 0)
            - (poiOf(a) || 0) * 0.12;
          const sb = Math.abs(b.price_delta_pct || 0) + Math.abs(b.area_delta_pct || 0)
            - (poiOf(b) || 0) * 0.12;
          return sa - sb;
        });
      }

      function paintMatchPanel() {
        const grid = document.getElementById("mpGrid");
        if (!grid) return;
        const rows = panelRows.slice(0, panelShown);
        grid.innerHTML = rows.map((x, i) => {
          const pps = x.price_sqm ? Math.round(x.price_sqm) : null;
          const info = (window.__amenityInfoFor && window.__amenityInfoFor(x, currentPref)) || null;
          const metro = info && info.items ? info.items.filter((it) => it.key === "metro")[0] : null;
          const poiLine = info && info.score != null
            ? '<div class="mp-poi">🧭 周边便利 ' + info.score + " 分" +
              (info.level === "listing"
                ? (metro && metro.near != null ? " · 最近地铁 " + metro.near + " 米" : " · 按这套房坐标量")
                : " · 片区级（还没有这套房的楼下数据）") + "</div>"
            : "";
          return '<div class="mp-card" data-card="' + i + '">' +
            '<div style="display:flex;justify-content:space-between;gap:8px;">' +
            "<b>" + esc(x.community || "未命名小区") + "</b>" +
            '<span class="mp-price">' + wan(x.price_wan) + " 万</span></div>" +
            '<div class="mp-meta">套内 ' + wan(x.live_area_sqm, 1) + " ㎡ · 建面 " + wan(x.area_sqm, 1) + " ㎡" +
            (pps ? " · " + pps.toLocaleString() + " 元/㎡" : "") +
            (x.bedrooms ? " · " + x.bedrooms + " 室" : "") + "</div>" +
            '<div class="mp-meta">📍 ' + esc(x.district_name || "区位未知") +
            (x.price_delta_pct != null ? " · 比预算" + (x.price_delta_pct > 0 ? "贵 " : "便宜 ") +
              wan(Math.abs(x.price_delta_pct), 1) + "%" : "") + "</div>" +
            poiLine +
            '<button type="button" data-panel-open="' + i + '">看看这套 →</button>' +
            "</div>";
        }).join("");

        // 卡片和按钮都只做一件事：打开详情。推演按钮只在详情里出现——
        // 用户还没看过这套房，先让他相信，再问要不要拿它算。
        grid.querySelectorAll("[data-panel-open]").forEach((b) => {
          b.onclick = (ev) => {
            ev.stopPropagation();
            openListingDetail(Number(b.getAttribute("data-panel-open")));
          };
        });
        // 点卡片本身 → 定位到这套房 + 看明细（不是让它再选一次）
        grid.querySelectorAll(".mp-card").forEach((card) => {
          card.onclick = () => openListingDetail(Number(card.getAttribute("data-card")));
        });

        const more = document.getElementById("mpMore");
        if (more) {
          const left = panelRows.length - rows.length;
          more.style.display = left > 0 ? "block" : "none";
          more.textContent = left > 0 ? "看剩下的 " + left + " 套" : "";
        }
        paintHuxingMatches();
      }

      /* 🏗 新房在售户型：把 168 个楼盘 / 852 个在售户型按"你的预算和面积"筛一遍。
         为什么要它：二手房只有 35 套，用户填 96 万 85㎡ 常常"一套都没对上"，
         但其实南宁有 177 个在售楼盘、765 个户型带参考总价——这才是能回答
         "这个预算在这片能买多大"的真实数据。
         口径：新房是期房，参考总价是页面标价、不是成交价；面积是建面。 */
      function huxingMatches(p) {
        const items = (window.HousingApp && window.HousingApp.projects) || [];
        const budget = Number(p.budget_wan) || 0;
        const area = Number(p.target_area_sqm) || 0;
        if (!(budget > 0) && !(area > 0)) return [];
        const out = [];
        items.forEach((proj) => {
          (proj.huxing || []).forEach((h) => {
            if (!(h.total > 0) || !(h.area > 0)) return;   // 没有参考总价的没法比价
            let score = 0;
            if (budget > 0) {
              const dp = (h.total - budget) / budget * 100;
              if (Math.abs(dp) > 12) return;
              score += Math.abs(dp);
            }
            if (area > 0) {
              const da = (h.area - area) / area * 100;
              if (Math.abs(da) > 18) return;
              score += Math.abs(da) * 0.6;
            }
            out.push({ proj, h, score });
          });
        });
        out.sort((a, b) => a.score - b.score);
        return out;
      }

      function paintHuxingMatches() {
        const box = document.getElementById("mpHuxing");
        if (!box) return;
        const p = currentMatchParams();
        const hits = huxingMatches(p);
        // 摘要行带上"新房户型有多少个"，否则用户在卡片下面根本不知道还有这一块
        const sub = document.getElementById("mpSub");
        if (sub) {
          const base = sub.textContent.split(" · 新房户型")[0];
          sub.textContent = hits.length ? base + " · 新房户型 " + hits.length + " 个" : base;
        }
        if (!hits.length) { box.innerHTML = ""; return; }
        const shown = hits.slice(0, 6);
        const cond = [
          p.budget_wan > 0 ? wan(p.budget_wan, 0) + " 万" : "",
          p.target_area_sqm > 0 ? wan(p.target_area_sqm, 0) + " ㎡" : "",
        ].filter(Boolean).join(" / ");
        box.innerHTML =
          '<div style="margin-top:14px;padding-top:10px;border-top:2px dashed rgba(146,64,14,.35);">' +
          '<div style="font-size:14px;font-weight:800;color:#451a03;">🏗 新房在售户型 · ' +
          hits.length + " 个对得上" + (cond ? "（按你的 " + cond + "）" : "") + "</div>" +
          '<div style="font-size:12px;color:#78350f;margin:2px 0 8px;">' +
          "期房，参考总价是页面标价（不是成交价）；面积是建面，到手要减公摊。</div>" +
          '<div class="mp-grid" style="margin-top:8px;">' +
          shown.map((x) =>
            '<div class="mp-card" style="cursor:default;">' +
            '<div style="display:flex;justify-content:space-between;gap:8px;">' +
            "<b>" + esc(x.proj.name) + "</b>" +
            '<span class="mp-price">' + wan(x.h.total) + " 万</span></div>" +
            '<div class="mp-meta">' + (x.h.room ? esc(x.h.room) + " · " : "") +
            "<b>" + wan(x.h.area, 1) + " ㎡</b> 建面" +
            (x.proj.property_type === "别墅" ? " · 别墅" : "") + "</div>" +
            '<div class="mp-meta">📍 ' + esc(x.proj.district || "") +
            (x.proj.block ? " · " + esc(x.proj.block) : "") +
            (p.budget_wan > 0 ? " · 比预算" + (x.h.total > p.budget_wan ? "贵 " : "便宜 ") +
              wan(Math.abs((x.h.total - p.budget_wan) / p.budget_wan * 100), 1) + "%" : "") +
            "</div></div>").join("") +
          "</div>" +
          (hits.length > shown.length
            ? '<div class="m-note" style="margin-top:6px;">还有 ' + (hits.length - shown.length) +
              " 个对得上——把预算或面积改精确一点，这里会跟着变。</div>"
            : "") +
          "</div>";
      }

      /* ============================================================
         🏠 V8.13 房源详情：独立一页（App 的做法）
         ------------------------------------------------------------
         以前是"在匹配面板的格子里塞一张详情卡"——列表没了、地图还在旁边，
         用户根本不知道说的是哪一套。现在点进去就是新一页：
           · 地图上给这套房一个呼吸光点，其它房源点变淡（一眼知道选的是哪套）；
           · 页面独占，返回才回到列表；
           · 手机上整屏，底部固定操作条（拇指够得到）。
         ============================================================ */
      let highlightMarker = null;
      let lpReturnToMatch = false;

      function highlightListing(x) {
        clearHighlight(false);
        if (!map) return;
        const ll = (x.geo_approximate || !x.lat)
          ? mapLL(x.lat, x.lng)
          : mapLL(x.lat, x.lng);
        highlightMarker = L.marker(ll, {
          zIndexOffset: 1200,
          icon: L.divIcon({
            className: "", html: '<div class="pin-pulse"></div>',
            iconSize: [18, 18], iconAnchor: [9, 9],
          }),
        }).addTo(map);
        // 其它房源点变淡：不然旁边一堆点，看不出选的是哪一套
        if (listingsLayer) {
          try { listingsLayer.eachLayer((l) => l.setOpacity && l.setOpacity(0.18)); } catch (_) { }
        }
      }

      function clearHighlight(restore) {
        if (highlightMarker && map) {
          try { map.removeLayer(highlightMarker); } catch (_) { }
        }
        highlightMarker = null;
        if (restore !== false && listingsLayer) {
          try { listingsLayer.eachLayer((l) => l.setOpacity && l.setOpacity(1)); } catch (_) { }
        }
      }

      function closeListingPage() {
        const page = document.getElementById("listingPage");
        if (page) page.classList.remove("on");
        document.body.classList.remove("listing-open");
        clearHighlight(true);
        // 是从匹配面板点进来的，就回到面板；否则什么都不做
        if (lpReturnToMatch) {
          const ov = document.getElementById("matchOverlay");
          if (ov) ov.classList.add("on");
          lpReturnToMatch = false;
        }
      }

      /* ---------- V9.2 收藏 / 浏览历史 / 分享（都存在本机，不上传） ---------- */
      const LS_FAV = "jw_favs";
      const LS_HIS = "jw_history";

      function readList(key) {
        try { const v = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(v) ? v : []; }
        catch (_) { return []; }
      }

      function writeList(key, arr) {
        try { localStorage.setItem(key, JSON.stringify((arr || []).slice(0, 60))); } catch (_) { }
      }

      function listingKey(x) {
        return [x.city_code || "", x.community || x.title || "", x.price_wan || 0, x.area_sqm || 0].join("|");
      }

      function slimListing(x) {
        return {
          key: listingKey(x),
          community: x.community || x.title || "未命名小区",
          price_wan: x.price_wan,
          area_sqm: x.area_sqm,
          live_area_sqm: x.live_area_sqm,
          district_name: x.district_name || "",
          at: Date.now()
        };
      }

      function isFav(x) {
        const k = listingKey(x);
        return readList(LS_FAV).some((it) => it.key === k);
      }

      function toggleFav(x) {
        const k = listingKey(x);
        const list = readList(LS_FAV);
        const i = list.findIndex((it) => it.key === k);
        if (i >= 0) { list.splice(i, 1); writeList(LS_FAV, list); return false; }
        list.unshift(slimListing(x));
        writeList(LS_FAV, list);
        return true;
      }

      function pushHistory(x) {
        const list = readList(LS_HIS).filter((it) => it.key !== listingKey(x));
        list.unshift(slimListing(x));
        writeList(LS_HIS, list);
      }

      function shareListing(x) {
        const text = (x.community || "这套房") + " · " + wan(x.price_wan) + " 万 · " +
          wan(x.live_area_sqm || x.area_sqm, 0) + "㎡ · " + (x.district_name || "");
        const done = (msg) => {
          if (window.HousingApp && window.HousingApp.toast) window.HousingApp.toast(msg);
        };
        try {
          if (navigator.share) {
            navigator.share({ title: "经纬置业", text: text }).catch(() => { });
            return;
          }
        } catch (_) { }
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => done("已复制房源信息")).catch(() => done(text));
            return;
          }
        } catch (_) { }
        done(text);
      }

      function quickPayHtml(x) {
        const price = Number(x.price_wan) || 0;
        if (!price) return "";
        let rate = 3.9;
        try {
          const el = document.getElementById("loanRatePct");
          if (el && Number(el.value) > 0) rate = Number(el.value);
        } catch (_) { }
        const down = price * 0.3;
        const loanYuan = price * 0.7 * 10000;
        let m30 = 0, m20 = 0;
        try {
          const r30 = calcMonthlyMortgage(loanYuan, rate, 30, "equal_principal_interest");
          const r20 = calcMonthlyMortgage(loanYuan, rate, 20, "equal_principal_interest");
          m30 = r30 && r30.monthly;
          m20 = r20 && r20.monthly;
        } catch (_) { }
        const cell = (v, unit, label) => '<div class="q"><b>' + v + unit + '</b><span>' + label + "</span></div>";
        return '<div class="lp-quick">' +
          cell(wan(down), " 万", "首付 3 成") +
          cell(m30 ? Math.round(m30).toLocaleString() : "—", " 元", "商贷 30 年月供") +
          cell(m20 ? Math.round(m20).toLocaleString() : "—", " 元", "商贷 20 年月供") +
          "</div>";
      }

      function openListingDetail(i) {
        const x = panelRows[i];
        if (!x) return;
        // 打开详情时先把匹配面板收起来：不然左边还是那张黄表，地图被盖住，
        // "这套在哪"根本看不到（用户原话：旁边一堆房源，我都不知道选的是哪套）。
        const ov = document.getElementById("matchOverlay");
        if (ov) { lpReturnToMatch = ov.classList.contains("on"); ov.classList.remove("on"); }

        // 📍 只有"精确坐标"才飞过去；区中心近似的房源飞过去等于骗人
        const exact = !x.geo_approximate && x.geo_level && x.geo_level !== "district";
        if (exact && x.lat && x.lng && window.HousingApp && window.HousingApp.map) {
          const m = window.HousingApp.map;
          try {
            m.flyTo(mapLL(x.lat, x.lng), 16, { duration: 0.9 });
            // 桌面端详情页占右边 62%，把选中的点挪到"可见那半边"的中间
            const drawer = window.innerWidth > 760 ? Math.min(760, window.innerWidth * 0.62) : 0;
            if (drawer) {
              setTimeout(() => { try { m.panBy([Math.round(drawer / 2), 0], { animate: true, duration: .4 }); } catch (_) { } }, 1000);
            }
          } catch (_) { }
        }
        highlightListing(x);

        pushHistory(x);

        const pref = currentPref;
        const info = window.__amenityInfoFor ? window.__amenityInfoFor(x, pref) : null;
        const pps = x.price_sqm ? Math.round(x.price_sqm) : null;

        const poiRows = info ? (info.items || []).map((it) =>
          '<div class="d-item">' + (it.kind === "negative" ? "🔇 " : "") + it.label + "：" +
          (it.near == null ? '<span>这个范围内没有</span>' :
            "最近 <span>" + it.near + " 米</span>" + (it.n != null ? " · 周边共 " + it.n + " 处" : "")) +
          "</div>").join("") : "";

        const poiSource = info
          ? (info.level === "listing"
            ? "周边距离以这套房的坐标为圆心，按各类设施的搜索范围（2~3 公里）量的直线距离；不是步行时间。"
            : "周边距离以「区中心」为圆心（还没有这套房自己的楼下数据，会偏——青秀区的中心就落在山边上）。")
          : "这套房还没有周边数据：我们不拿区均值的空白冒充结论。";

        const unitCells = [
          ["楼层", x.floor_info || x.floor],
          ["总楼层", x.total_floors],
          ["朝向", x.orientation],
          ["建成", x.built_year],
          ["电梯", x.elevator],
          ["房号", x.unit_no],
          ["装修", x.decoration === "rough" ? "毛坯" : (x.decoration === "finished" ? "已装修" : x.decoration)],
          ["来源", x.source],
          ["挂牌", x.listed_at],
        ].filter(([, v]) => v != null && v !== "");

        const title = document.getElementById("lpTitle");
        if (title) title.textContent = (x.community || "未命名小区") + " · " + wan(x.price_wan) + " 万";

        const body = document.getElementById("lpBody");
        if (!body) return;
        body.innerHTML =
          '<div class="lp-price"><b>' + wan(x.price_wan) + " 万</b>" +
          '<span>' + (pps ? pps.toLocaleString() + " 元/㎡" : "单价未填") + " · " +
          (exact ? "精确到小区" : "只到区（区位中心近似）") + "</span></div>" +
          '<div class="lp-facts">' +
          '<div><div class="k">建面</div><div class="v">' + wan(x.area_sqm, 1) + " ㎡</div></div>" +
          '<div><div class="k">套内</div><div class="v">' + wan(x.live_area_sqm, 1) + " ㎡</div></div>" +
          '<div><div class="k">户型</div><div class="v">' + (x.bedrooms ? x.bedrooms + " 室" : "—") + "</div></div>" +
          '<div><div class="k">区位</div><div class="v">' + esc(x.district_name || "—") + "</div></div>" +
          '<div><div class="k">便利分</div><div class="v">' + (info && info.score != null ? info.score + " 分" : "—") + "</div></div>" +
          unitCells.map(([k, v]) => '<div><div class="k">' + k + '</div><div class="v">' + esc(v) + "</div></div>").join("") +
          "</div>" +
          quickPayHtml(x) +
          (poiRows ? '<div class="lp-sec">周边（直线距离）</div><div class="lp-poi">' + poiRows + "</div>" : "") +
          '<div class="lp-note">' + poiSource + "</div>" +
          (unitCells.length ? "" :
            '<div class="lp-note">这套房只有楼盘级信息（小区、总价、面积），没有「哪层哪套」：楼层、朝向、建成年代还不清楚。</div>') +
          '<div class="lp-note">位置精度：' + (exact ? "精确到小区" : "只到区（区位中心近似，不是楼栋）") + "。价格是挂牌价，不是成交价。</div>";

        const fav = isFav(x);
        const foot = document.getElementById("lpFoot");
        if (foot) {
          foot.innerHTML =
            '<div class="lp-actions">' +
            '<button type="button" class="lp-btn fav' + (fav ? " on" : "") + '" id="lpFav2">' +
            (fav ? "★ 已收藏" : "☆ 收藏") + "</button>" +
            '<button type="button" class="lp-btn" id="lpShare2">↗ 分享</button>' +
            "</div>" +
            '<button type="button" class="lp-link-use" id="lpUse2">用这套去推演 →</button>';
          const f = document.getElementById("lpFav2");
          if (f) f.onclick = () => {
            const on = toggleFav(x);
            f.classList.toggle("on", on);
            f.textContent = on ? "★ 已收藏" : "☆ 收藏";
            if (window.HousingApp && window.HousingApp.toast) {
              window.HousingApp.toast(on ? "已收藏，可在「我的」里找到" : "已取消收藏");
            }
          };
          const sh = document.getElementById("lpShare2");
          if (sh) sh.onclick = () => shareListing(x);
          const u = document.getElementById("lpUse2");
          if (u) u.onclick = () => { closeListingPage(); closeMatchPanel(); useMatchRowById(x); };
        }

        const page = document.getElementById("listingPage");
        if (page) page.classList.add("on");
        document.body.classList.add("listing-open");
      }

      // 详情页的返回/关闭/点遮罩关闭，只绑一次
      (function bindListingPage() {
        const back = document.getElementById("lpBack");
        if (back) back.onclick = closeListingPage;
        const close = document.getElementById("lpClose");
        if (close) close.onclick = closeListingPage;
        const page = document.getElementById("listingPage");
        if (page) {
          page.addEventListener("click", (e) => { if (e.target === page) closeListingPage(); });
        }
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") closeListingPage();
        });
      })();

      function useMatchRowById(x) {
        const priceEl = $("houseTotalWan");
        const areaEl = $("targetAreaSqm");
        if (priceEl) { priceEl.value = Math.round(x.price_wan * 10) / 10; priceEl.dispatchEvent(new Event("input", { bubbles: true })); }
        if (areaEl) { areaEl.value = Math.round(x.live_area_sqm); areaEl.dispatchEvent(new Event("input", { bubbles: true })); }
        const ha = window.HousingApp || {};
        if (ha.toast) ha.toast("已填好：" + wan(x.price_wan) + " 万 · 套内 " + wan(x.live_area_sqm, 0) + " ㎡");
        setTab("sim");
        setScreen("params");
      }

      async function openMatchPanel() {
        ensureOverlay();
        const ov = document.getElementById("matchOverlay");
        ov.classList.add("on");
        setMatchCollapsed(false);          // 每次重新打开都展开
        if (window.__setView) window.__setView("match");
        panelShown = 7;

        const ha = window.HousingApp || {};
        const p = currentMatchParams();
        const sub = document.getElementById("mpSub");
        const grid = document.getElementById("mpGrid");
        sub.textContent = "正在按你的条件找房…";
        grid.innerHTML = "";

        try {
          const res = await fetch((ha.apiHost || "") + "/api/listings/match", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p),
            signal: (window.AbortSignal && AbortSignal.timeout) ? AbortSignal.timeout(30000) : undefined
          });
          if (!res.ok) throw new Error("HTTP " + res.status);
          const json = await res.json();
          panelRows = (json.data || []).slice();
          sortPanelRows();
          const list = panelRows;
          if (!list.length) {
            sub.textContent = json.message || "这个预算下，库里没有对得上的房子。";
            return;
          }
          sub.textContent = "共 " + list.length + " 套对得上，先给你最合适的 " + Math.min(7, list.length) + " 套";
          paintMatchPanel();
        } catch (e) {
          const sleepy = /abort|timeout|timed out|failed to fetch/i.test(String(e));
          sub.textContent = sleepy
            ? "后端在唤醒（约 20~30 秒），关掉再点一次入口就好。"
            : "接口没通：" + String((e && e.message) || e);
        }
      }

      function useMatchRow(i) {
        const x = matchRows[i];
        if (!x) return;
        const priceEl = $("houseTotalWan");
        const areaEl = $("targetAreaSqm");
        if (priceEl) {
          priceEl.value = Math.round(x.price_wan * 10) / 10;
          priceEl.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (areaEl) {
          areaEl.value = Math.round(x.live_area_sqm);
          areaEl.dispatchEvent(new Event("input", { bubbles: true }));
        }
        const ha = window.HousingApp || {};
        if (ha.toast) ha.toast("已填好：" + wan(x.price_wan) + " 万 · 套内 " + wan(x.live_area_sqm, 0) + " ㎡，点「开始推演」");
        setTab("sim");
        setScreen("params");
      }

      /* ---------- 房源列表 ---------- */
      function renderList(list, meta) {
        const box = $("mListBody");
        if (!box) return;
        clearTimeout(listingTimer);
        const items = (list || []).slice().sort((x, y) => (x.total_price || 0) - (y.total_price || 0));
        const usedCnt = $("mSegUsedCount");
        if (usedCnt) usedCnt.textContent = items.length + " 套";

        if (!items.length) {
          usedSubText = "这个城市还没有入库房源。我们不编数据，所以这里就是空的。";
          $("mListSub").textContent = usedSubText;
          box.innerHTML = '<div class="m-sect"><span>🏠 二手房在售</span></div>' +
            '<div class="m-empty">🏚️ 暂无房源数据<br><span style="font-size:12px;">换一座有数据的城市，或等我们把房源补进来。</span></div>';
          return;
        }

        const prices = items.map((x) => (x.total_price || 0) / 10000).filter((x) => x > 0);
        const lo = prices.length ? Math.min.apply(null, prices) : 0;
        const hi = prices.length ? Math.max.apply(null, prices) : 0;
        $("mListSub").textContent = "共 " + items.length + " 套 · " + wan(lo, 0) + "~" + wan(hi, 0) +
          " 万 · 按总价从低到高";
        usedSubText = $("mListSub").textContent;

        const cards = items.map((x) => {
          const priceWan = (x.total_price || 0) / 10000;
          const pps = x.price_sqm ? Math.round(x.price_sqm) : null;
          return '<div class="m-lcard">' +
            '<div class="m-lcard-top"><b>' + esc(x.community || "未命名小区") + "</b>" +
            '<span class="m-price">' + wan(priceWan) + " 万</span></div>" +
            '<div class="m-lcard-sub">' + (x.area_sqm ? esc(x.area_sqm) + " ㎡" : "") +
            (x.bedrooms ? " · " + esc(x.bedrooms) + " 室" : "") +
            (pps ? " · " + pps.toLocaleString() + " 元/㎡" : "") + "</div>" +
            '<div class="m-lcard-foot"><span>📍 ' + esc(x.district_name || "区位未知") + "</span>" +
            "<span>" + (x.geo_approximate ? "区位中心近似" : "精确坐标") + "</span></div>" +
            "</div>";
        }).join("");

        box.innerHTML =
          '<div class="m-sect"><span>🏠 二手房在售</span><em>' + items.length + ' 套</em></div>' +
          '<div class="m-note">房源坐标只到「区」的，我们如实标成区位中心，不画成精确楼栋。价格是挂牌价，不是成交价。</div>' +
          cards;
      }

      function ensureListings() {
        ensureMatch();          // 每次进「房源」都按当前参数重算一次，参数改了要跟着变
        paintMobileHuxing();    // 新房户型不依赖房源接口，先画，别让它等 6 秒超时
        setListSeg(listSeg);
        const ha = window.HousingApp || {};
        const city = ha.currentCity || null;
        const code = city ? city.code : "450100";
        const name = city ? city.name : "南宁";
        $("mListTitle").textContent = name + "在售房源";
        const box = $("mListBody");
        if (box.dataset.code === code && box.dataset.loaded === "1") return;

        box.dataset.code = code;
        box.dataset.loaded = "";
        $("mListSub").textContent = "正在读取房源…";
        box.innerHTML = '<div class="m-empty">正在读取…</div>';

        if (ha.loadListings) {
          ha.loadListings(code);
          clearTimeout(listingTimer);
          listingTimer = setTimeout(() => {
            if (box.dataset.loaded !== "1") {
              $("mListSub").textContent = "房源接口没有响应。";
              box.innerHTML = '<div class="m-empty">暂时连不上房源接口。<br><span style="font-size:12px;">这不是没有房子，是网络或后端没通。</span></div>';
            }
          }, 6000);
        } else {
          box.innerHTML = '<div class="m-empty">房源模块还没接上。</div>';
        }
      }

      function onListings(list) {
        const box = $("mListBody");
        if (box) box.dataset.loaded = "1";
        renderList(list);
        paintMobileHuxing();
      }

      /* ---------- 🏗 V9.0 手机端「新房在售户型」 ----------
         桌面端这块在匹配面板底部（#mpHuxing），手机端以前只有二手房列表，
         用户填 96 万经常"一套都没对上"，但南宁有 177 个在售楼盘、852 个户型。
         数据同源 window.HousingApp.projects，规则同源 huxingMatches()，不另写一套。 */
      let mHuxingRows = [];

      function hxDelta(total, budget) {
        const dp = (total - budget) / budget * 100;
        if (Math.abs(dp) < 0.05) return "与预算持平";
        return dp > 0 ? "超预算 " + wan(dp, 1) + "%" : "比预算省 " + wan(-dp, 1) + "%";
      }

      function paintMobileHuxing() {
        const box = $("mHuxing");
        if (!box) return;
        const p = currentMatchParams();
        if (!(p.budget_wan > 0) && !(p.target_area_sqm > 0)) {
          mHuxingRows = [];
          const c0 = $("mSegNewCount"); if (c0) c0.textContent = "—";
          if (listSeg === "new") $("mListSub").textContent = "先填「房屋总价」或「想住多大」，再看新房户型";
          box.innerHTML = '<div class="m-sect"><span>🏗 新房在售户型</span></div>' +
            '<div class="m-note">先填「房屋总价」或「想住多大」。南宁在售新房有 852 个户型，是二手房（34 套）之外另一条真实数据。</div>';
          return;
        }
        const projects = (window.HousingApp && window.HousingApp.projects) || [];
        if (!projects.length) {
          mHuxingRows = [];
          const c1 = $("mSegNewCount"); if (c1) c1.textContent = "…";
          box.innerHTML = '<div class="m-sect"><span>🏗 新房在售户型</span></div>' +
            '<div class="m-note">正在读取新房户型（327 个楼盘 / 852 个户型）…数据没到之前不给你编数字。</div>';
          return;
        }
        const hits = huxingMatches(p);
        mHuxingRows = hits.slice(0, 6);
        const newCnt = $("mSegNewCount");
        if (newCnt) newCnt.textContent = hits.length + " 个";
        const want = [
          p.budget_wan > 0 ? wan(p.budget_wan, 0) + " 万" : "",
          p.target_area_sqm > 0 ? "建面 " + wan(p.target_area_sqm, 0) + " ㎡" : ""
        ].filter(Boolean).join(" / ");
        if (hits.length && listSeg === "new") $("mListSub").textContent = "按你的 " + want + " 筛到 " + hits.length + " 个新房户型 · 参考价不是成交价";
        if (!hits.length) {
          const c2 = $("mSegNewCount"); if (c2) c2.textContent = "0 个";
          box.innerHTML = '<div class="m-sect"><span>🏗 新房在售户型</span></div>' +
            '<div class="m-note">按 ' + esc(want) + ' 没筛到新房户型（总价 ±12% / 面积 ±18%）。把预算或面积放宽一点。</div>';
          return;
        }
        box.innerHTML = '<div class="m-sect"><span>🏗 新房在售户型</span><em>' + hits.length + ' 个对得上</em></div>' +
          '<div class="m-note" style="color:#fcd34d;">期房：参考总价是页面标价（不是成交价），面积是建面，套内要减公摊（新房默认 22%）。点卡片直接填进推演。</div>' +
          mHuxingRows.map((x, i) =>
            '<div class="m-lcard m-hx" data-hx="' + i + '">' +
            '<div class="m-lcard-top"><b>' + esc(x.proj.name) + "</b>" +
            '<span class="m-price">' + wan(x.h.total) + " 万</span></div>" +
            '<div class="m-lcard-sub">' + (x.h.room ? esc(x.h.room) + " · " : "") +
            "建面 <b>" + wan(x.h.area, 1) + " ㎡</b>（套内约 " + wan(x.h.area * 0.78, 0) + " ㎡）" +
            (x.proj.property_type === "别墅" ? " · 别墅" : "") + "</div>" +
            '<div class="m-lcard-foot"><span>📍 ' + esc(x.proj.district || "") +
            (x.proj.block ? " · " + esc(x.proj.block) : "") + "</span>" +
            "<span>" + (p.budget_wan > 0 ? hxDelta(x.h.total, p.budget_wan) : "共 " + hits.length + " 个") + "</span></div>" +
            '<span class="m-hx-go">用这套去推演 →</span>' +
            "</div>").join("") +
          (hits.length > mHuxingRows.length
            ? '<div class="m-note">还有 ' + (hits.length - mHuxingRows.length) + " 个对得上——把预算或面积改精确一点，这里会跟着变。</div>"
            : "");
      }

      function useHuxingRow(i) {
        const x = mHuxingRows[i];
        if (!x) return;
        const typeBtn = document.querySelector('.type-btn[data-htype="new"]');
        if (typeBtn) typeBtn.click();          // 新房口径：毛坯 + 公摊 22%
        const priceEl = $("houseTotalWan");
        const areaEl = $("targetAreaSqm");
        const live = Math.round(x.h.area * 0.78);
        if (priceEl) {
          priceEl.value = Math.round(x.h.total * 10) / 10;
          priceEl.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (areaEl) {
          areaEl.value = live;
          areaEl.dispatchEvent(new Event("input", { bubbles: true }));
        }
        const ha = window.HousingApp || {};
        if (ha.toast) ha.toast("已填好：" + wan(x.h.total) + " 万 · 建面 " + wan(x.h.area, 0) + " ㎡，套内约 " + live + " ㎡");
        setTab("sim");
        setScreen("params");
      }

      /* ---------- 二手 / 新房 分段开关 ---------- */
      let listSeg = "used";

      function setListSeg(s) {
        listSeg = s === "new" ? "new" : "used";
        document.querySelectorAll("#mListSeg [data-seg]").forEach((b) => {
          b.classList.toggle("on", b.getAttribute("data-seg") === listSeg);
        });
        const pu = $("mPaneUsed"), pn = $("mPaneNew");
        if (pu) pu.style.display = listSeg === "used" ? "" : "none";
        if (pn) pn.style.display = listSeg === "new" ? "" : "none";
        if (listSeg === "new") paintMobileHuxing();
        else $("mListSub").textContent = usedSubText;
      }

      (function bindListSeg() {
        const seg = $("mListSeg");
        if (!seg) return;
        seg.addEventListener("click", (e) => {
          const b = e.target && e.target.closest ? e.target.closest("[data-seg]") : null;
          if (!b) return;
          setListSeg(b.getAttribute("data-seg"));
        });
      })();

      (function bindHuxingBox() {
        const box = $("mHuxing");
        if (!box) return;
        box.addEventListener("click", (e) => {
          const card = e.target && e.target.closest ? e.target.closest("[data-hx]") : null;
          if (!card) return;
          useHuxingRow(Number(card.getAttribute("data-hx")));
        });
      })();

      (function bindMatchBox() {
        const box = $("mMatchBox");
        if (!box) return;
        box.addEventListener("click", (e) => {
          const btn = e.target && e.target.closest ? e.target.closest("[data-use]") : null;
          if (!btn) return;
          useMatchRow(Number(btn.getAttribute("data-use")));
        });
      })();

      /* ---------- 我的 ---------- */
      function renderMe() {
        const box = $("mMeBody");
        if (!box) return;
        const ha = window.HousingApp || {};
        const city = ha.currentCity || null;
        const res = ha.currentResult || null;
        const ver = ($("appBadge") && $("appBadge").textContent) || "V9.2.0";
        const favs = readList(LS_FAV);
        const his = readList(LS_HIS);
        const runs = Number(localStorage.getItem("jw_runs") || 0) || 0;

        const ar = $("anchorRentYear"), al = $("anchorLoanYear"), ad = $("anchorDownStrategy");
        const planned = (ar && ar.value !== "" && al && al.value !== "")
          ? ("租 " + ar.value + " 年 · 贷 " + al.value + " 年 · " + (ad ? ad.options[ad.selectedIndex].text : ""))
          : "";

        const anyScheme = res && (res.best || (res.top_comprehensive || [])[0]);
        const typeLabel = anyScheme && anyScheme.house_type === "new"
          ? "新房（含维修基金）" : "二手房（含个税与中介费）";
        const bestLine = (res && res.top_comprehensive && res.top_comprehensive[0])
          ? ("租 " + res.top_comprehensive[0].rent_year + " 年 · 贷 " + res.top_comprehensive[0].loan_year +
            " 年，家底 " + wan(res.top_comprehensive[0].net_worth_end_wan) + " 万")
          : "";

        const ds = document.documentElement.dataset;
        const zoneSrc = ds.zoneSource || "";
        const zoneLine = zoneSrc === "real"
          ? "片区用的是真实行政区中心，片区价按距市中心衰减估算"
          : (zoneSrc === "nanning" ? "南宁八区用的是真实片区价"
            : "片区坐标是估算的（还没有这个城市的真实区县中心）");
        const amCount = Number(ds.listingAmenities);
        const amenityLine = amCount > 0
          ? ("周边设施已采到 " + amCount + " 个房源坐标；没采到的房源只说“片区级”，" +
             "不拿区均值的空白冒充这套楼的楼下")
          : "周边设施只有片区级数据（以区中心为圆心），房源级的还没采到";

        const item = (it, kind) =>
          '<div class="m-saved" data-saved="' + esc(it.key) + '" data-kind="' + kind + '">' +
          '<div class="m-saved-main"><b>' + esc(it.community) + "</b>" +
          '<span>' + wan(it.price_wan) + " 万 · " + wan(it.live_area_sqm || it.area_sqm, 0) + " ㎡" +
          (it.district_name ? " · " + esc(it.district_name) : "") + "</span></div>" +
          '<button type="button" class="m-saved-use" data-use-saved="' + esc(it.key) + '">去推演</button>' +
          "</div>";

        box.innerHTML =
          '<div class="m-prof">' +
          '<div class="m-avatar">🏠</div>' +
          '<div class="m-prof-main"><div class="m-prof-name">本地用户</div>' +
          '<div class="m-prof-sub">' + esc(city ? city.name : "未选城市") + " · " + esc(ver) + "</div></div>" +
          '<button type="button" class="m-btn plain m-prof-btn" data-mact="go-sim">去推演</button>' +
          "</div>" +

          '<div class="m-stats">' +
          '<div class="m-stat"><b>' + his.length + "</b><span>浏览</span></div>" +
          '<div class="m-stat"><b>' + favs.length + "</b><span>收藏</span></div>" +
          '<div class="m-stat"><b>' + runs + "</b><span>推演</span></div>" +
          '<div class="m-stat"><b>' + (bestLine ? "1" : "0") + "</b><span>已出方案</span></div>" +
          "</div>" +

          '<div class="m-card"><h4>我的工具</h4><div class="m-tools">' +
          '<button type="button" class="m-tool" data-mact="go-anchor"><i>📊</i><span>我的打算</span></button>' +
          '<button type="button" class="m-tool" data-mact="go-map"><i>🗺️</i><span>地图选城</span></button>' +
          '<button type="button" class="m-tool" data-mact="go-list"><i>🏠</i><span>找房</span></button>' +
          '<button type="button" class="m-tool" data-mact="guide"><i>🧭</i><span>新手引导</span></button>' +
          '<button type="button" class="m-tool" data-mact="go-collect"><i>📈</i><span>匿名数据</span></button>' +
          '<button type="button" class="m-tool" data-mact="reset"><i>↺</i><span>重置参数</span></button>' +
          "</div></div>" +

          '<div class="m-card"><h4>我的收藏 <span class="m-h4-sub">' + favs.length + " 套</span></h4>" +
          (favs.length ? favs.slice(0, 5).map((it) => item(it, "fav")).join("") +
            (favs.length > 5 ? '<p class="m-sub">还有 ' + (favs.length - 5) + " 套，先在「找房」里看" + "</p>" : "")
            : '<p class="m-sub">还没收藏。在房源详情里点「☆ 收藏」，这里就会留下。</p>') +
          "</div>" +

          '<div class="m-card"><h4>浏览历史 <span class="m-h4-sub">' + his.length + " 条</span></h4>" +
          (his.length ? his.slice(0, 5).map((it) => item(it, "his")).join("")
            : '<p class="m-sub">还没看过房源。去「房源」里点一套看看。</p>') +
          "</div>" +

          '<div class="m-card"><h4>我的方案</h4>' +
          '<div class="m-row"><span class="t">上次推荐</span><span>' + (bestLine || "还没跑过推演") + "</span></div>" +
          '<div class="m-row"><span class="t">我的打算</span><span>' + (planned || "还没填") + "</span></div>" +
          '<div class="m-row"><span class="t">房屋类型</span><span>' + typeLabel + "</span></div>" +
          '<div class="m-actions"><button class="m-btn" data-mact="go-sim">继续推演</button>' +
          '<button class="m-btn plain" data-mact="go-anchor">' + (planned ? "改我的打算" : "填我的打算") + "</button></div></div>" +

          '<div class="m-card"><h4>匿名数据</h4>' +
          '<label class="m-switch"><input type="checkbox" id="jwCollectToggle">' +
          '<span>参与《年轻人买房压力报告》</span></label>' +
          '<p class="m-sub">只收城市、职业、行业、收入区间、目标房价这类统计口径；不收姓名、手机号、IP、精确位置。关掉后一次都不发。</p></div>' +

          '<details class="m-card m-details"><summary>我们守的四条线</summary>' +
          "<p><b>50% 小康线</b>：扣掉生存成本，每月还能剩一半，才算有余地。</p>" +
          "<p><b>70% 红线</b>：月供加开销不超过收入的 70%，剩下的留给“万一”。</p>" +
          "<p><b>0.9% 活期</b>：不给你编 3% 的收益，降息年代就这么点。</p>" +
          "<p><b>2.5% 通胀</b>：30 年后的一万块，不是今天的一万块。</p></details>" +

          '<details class="m-card m-details"><summary>数据与口径</summary>' +
          "<p>42 城基准 + 2890 个区县；" + zoneLine + "</p>" +
          "<p>" + amenityLine + "</p>" +
          "<p>房源只到区的会标“区位中心近似”，不假装定位到楼栋。</p>" +
          "<p>公积金不算现金：租房只累积，还贷只抵月供。</p></details>" +

          '<details class="m-card m-details"><summary>免责声明</summary>' +
          "<p>决策参考，不是投资建议。利率会变、收入会变，模型只帮你把账算清楚，不替你签字。</p></details>";

        // 引导重看 + 匿名数据开关
        const gbtn = box.querySelector('[data-mact="guide"]');
        if (gbtn) gbtn.onclick = function () {
          if (window.JWOnboarding) window.JWOnboarding.open();
        };
        const ct = box.querySelector("#jwCollectToggle");
        if (ct) {
          ct.checked = !(window.JWCollect && !window.JWCollect.enabled());
          ct.onchange = function () {
            if (window.JWCollect) window.JWCollect.setEnabled(ct.checked);
            if (window.HousingApp && window.HousingApp.toast) {
              window.HousingApp.toast(ct.checked ? "已开启匿名数据，谢谢" : "已关闭，不再发送任何数据");
            }
          };
        }

        // 收藏 / 历史里的「去推演」：把价格与面积填回参数
        box.querySelectorAll("[data-use-saved]").forEach((btn) => {
          btn.onclick = function () {
            const key = btn.getAttribute("data-use-saved");
            const all = readList(LS_FAV).concat(readList(LS_HIS));
            const it = all.find((x) => x.key === key);
            if (!it) return;
            const priceEl = $("houseTotalWan"), areaEl = $("targetAreaSqm");
            if (priceEl) {
              priceEl.value = it.price_wan;
              priceEl.dispatchEvent(new Event("input", { bubbles: true }));
            }
            if (areaEl) {
              areaEl.value = Math.round(it.live_area_sqm || it.area_sqm || 0);
              areaEl.dispatchEvent(new Event("input", { bubbles: true }));
            }
            setTab("sim");
            setScreen("params");
            if (window.HousingApp && window.HousingApp.toast) {
              window.HousingApp.toast("已填好：" + wan(it.price_wan) + " 万，点开始推演");
            }
          };
        });
      }

      /* ---------- 前 7 套方案（默认只给这些，大表收起来） ---------- */
      let schemeLists = null;
      const TAB_ORDER = ["tab-comp", "tab-comfort", "tab-wealth", "tab-steady", "tab-speed", "tab-aggressive", "tab-all"];

      function buildSchemeLists(res) {
        const all = res.all_scheme || [];
        const byKey = (k) => all.slice().sort((a, b) => (b[k] || 0) - (a[k] || 0)).slice(0, 20);
        const sb = res.style_boards || {};
        schemeLists = {
          "tab-comp": res.top_comprehensive || [],
          "tab-comfort": byKey("comfort_score"),
          "tab-wealth": byKey("net_worth_end_wan"),
          "tab-steady": sb["稳健型"] || [],
          "tab-speed": sb["速度型"] || [],
          "tab-aggressive": sb["进取型"] || [],
          "tab-all": all.slice().sort((a, b) => (b.comprehensive_score || 0) - (a.comprehensive_score || 0))
        };
        schemeLists.__total = all.length;
      }

      function activeTabId() {
        const tabs = Array.prototype.slice.call(document.querySelectorAll("#tabWrap .tab"));
        const i = tabs.findIndex((t) => t.classList.contains("active"));
        return TAB_ORDER[i < 0 ? 0 : i] || "tab-comp";
      }

      function monthlyPayFor(it) {
        try {
          const sm = schemeMonthly(it);
          const fundM = Number(nv("monthIncomeNet") || 0) * Number(nv("housingFundPct") || 0) / 100;
          return Math.max(0, Math.round(sm.monthly - Math.min(sm.monthly, fundM)));
        } catch (_) { return null; }
      }

      function renderSchemeCards() {
        const box = $("mSchemes");
        if (!box || !schemeLists) return;
        const list = (schemeLists[activeTabId()] || []).slice(0, 7);
        if (!list.length) {
          box.innerHTML = '<div class="m-empty">这个视角暂时没有可行方案。</div>';
          return;
        }
        const rows = list.map((it, i) => {
          const pay = monthlyPayFor(it);
          return '<button class="m-scheme" data-scheme="' + i + '">' +
            '<span class="rank">' + (i + 1) + "</span>" +
            '<span class="main"><b>租 ' + it.rent_year + " 年 · 贷 " + it.loan_year + " 年</b>" +
            "<small>首付 " + wan(it.down_payment_wan) + " 万 · 每月 " +
            (pay == null ? "—" : pay.toLocaleString()) + " 元</small></span>" +
            '<span class="score">' + wan(it.comprehensive_score, 1) + "<span>分</span></span>" +
            "</button>";
        }).join("");
        box.innerHTML = rows +
          '<button class="m-show-all" data-mact="show-all">看全部 ' + (schemeLists.__total || 0) + " 个方案（大表）</button>";
      }

      /* ---------- 地图控件：缩放 + 选城市 ---------- */
      function renderCityList(keyword) {
        const box = $("mCityList");
        if (!box) return;
        const ha = window.HousingApp || {};
        const db = (ha.cityDb || []).slice().sort((a, b) => (a.tier || 9) - (b.tier || 9));
        const kw = String(keyword || "").trim();
        const rows = db.filter((c) => !kw || c.name.indexOf(kw) >= 0);
        if (!rows.length) {
          box.innerHTML = '<div class="m-empty">没有这个城市。<br><span style="font-size:12px;">我们只有 42 个城市有基准数据。</span></div>';
          return;
        }
        box.innerHTML = rows.map((c) =>
          '<div class="m-city-row" data-city="' + esc(c.code) + '">' +
          "<span>" + esc(c.name) + ' <small>' + (c.tier ? c.tier + " 线" : "") + "</small></span>" +
          '<small>均价 ' + (c.price ? Math.round(c.price).toLocaleString() : "--") + " 元/㎡</small></div>"
        ).join("");
      }

      function openCitySheet() {
        renderCityList("");
        const s = $("mCitySearch");
        if (s) s.value = "";
        $("mSheetMask").classList.add("on");
        $("mCitySheet").classList.add("on");
      }

      function closeCitySheet() {
        $("mSheetMask").classList.remove("on");
        $("mCitySheet").classList.remove("on");
      }

      function bindMapChrome() {
        const btn = $("mCityBtn");
        if (btn) btn.addEventListener("click", openCitySheet);

        const zoom = $("mZoomBtns");
        if (zoom) {
          zoom.addEventListener("click", (e) => {
            const b = e.target.closest("[data-mapact]");
            if (!b) return;
            const m = (window.HousingApp || {}).map;
            if (!m) return;
            if (b.getAttribute("data-mapact") === "zoom-in") m.zoomIn(); else m.zoomOut();
          });
        }

        const mask = $("mSheetMask");
        if (mask) mask.addEventListener("click", closeCitySheet);

        const jump = document.querySelector(".m-scroll-jump");
        if (jump) {
          jump.addEventListener("click", (e) => {
            const b = e.target.closest("[data-scrolljump]");
            if (!b) return;
            const panel = $("leftPanel");
            if (!panel) return;
            panel.scrollTo({ top: b.getAttribute("data-scrolljump") === "top" ? 0 : panel.scrollHeight, behavior: "smooth" });
          });
        }

        const schemes = $("mSchemes");
        if (schemes) {
          schemes.addEventListener("click", (e) => {
            const btn = e.target.closest("[data-scheme]");
            if (!btn || !schemeLists) return;
            const list = (schemeLists[activeTabId()] || []).slice(0, 7);
            const item = list[Number(btn.getAttribute("data-scheme"))];
            if (item && window.openModal) window.openModal(item);
          });
        }

        const tabWrap = $("tabWrap");
        if (tabWrap) {
          tabWrap.addEventListener("click", () => {
            setTimeout(() => { if (isMobile()) renderSchemeCards(); }, 30);
          });
        }

        const search = $("mCitySearch");
        if (search) search.addEventListener("input", (e) => renderCityList(e.target.value));

        const list = $("mCityList");
        if (list) {
          list.addEventListener("click", (e) => {
            const row = e.target.closest("[data-city]");
            if (!row) return;
            const code = row.getAttribute("data-city");
            const ha = window.HousingApp || {};
            const city = (ha.cityDb || []).find((c) => String(c.code) === code);
            if (!city) return;
            ha.applyCity(city);
            closeCitySheet();
            setTab("map");
            if (ha.resizeViz) ha.resizeViz();
          });
        }
      }

      /* ---------- 与既有流程的接口 ---------- */
      /**
       * 朋友的原话：先说答案，再说为什么。
       * 所以手机上把「方案 / 图 / 解释」提到结论卡后面，
       * 长分析（薪资曲线、城市与通勤、模型假设）留在最后。
       */
      function arrangeResult(isMob) {
        const rp = $("rightPanel");
        if (!rp) return;
        document.body.classList.remove("m-report-open");
        document.body.classList.remove("m-show-all");

        // 锚点：手机是结论卡；电脑是“你的方案”卡，没有就挂到标题下
        let anchor = isMob ? $("mSummary") : null;
        if (!anchor) {
          const cands = [$("anchorBox"), $("globalBestBox"), rp.querySelector(".panel-head")];
          anchor = cands.find((el) => el && getComputedStyle(el).display !== "none") || rp.firstElementChild;
        }
        if (!anchor) return;

        const chain = [
          $("globalBestBox"),
          $("viewBar"),
          $("mSchemes"),
          rp.querySelector(".m-scroll-hint"),
          $("tabContents"),
          rp.querySelector(".chart-toolbar"),
          $("chartDom"),
          $("aiReportBox")
        ];
        chain.forEach((el) => {
          if (!el || el === anchor) return;
          // 面板此刻可能还是 display:none，子元素的 computed display 全是 none，
          // 所以只按显式的 inline 开关判断（全局最优卡是 display:none 内联）
          if (el.id === "globalBestBox" && el.style.display === "none") return;
          rp.insertBefore(el, anchor.nextSibling);
          anchor = el;
        });
        const aw = rp.querySelector(".assumption-wrapper");
        if (aw) rp.appendChild(aw);
      }

      function onResult(res) {
        if (!res) return;
        try {
          const n = Number(localStorage.getItem("jw_runs") || 0) + 1;
          localStorage.setItem("jw_runs", String(n));
        } catch (_) { }
        if (!isMobile()) { arrangeResult(false); return; }
        renderSummary(res);
        buildSchemeLists(res);
        renderSchemeCards();
        arrangeResult(true);
        setScreen("result");
        setTab("sim");
        // ?expand=1：验收/分享时直接看全量（默认收成结论卡）
        if (new URLSearchParams(location.search).get("expand") === "1") setCompact(false);
      }

      /* ---------- 事件 ---------- */
      function bind() {
        const bar = $("mTabBar");
        if (bar) {
          bar.addEventListener("click", (e) => {
            const btn = e.target.closest(".m-tab");
            if (!btn) return;
            const t = btn.getAttribute("data-tab");
            setTab(t);
            if (t === "sim") body.dataset.mscreen = screen;
          });
        }

        document.addEventListener("click", (e) => {
          const t = e.target.closest("[data-mact]");
          if (!t) return;
          const act = t.getAttribute("data-mact");
          if (act === "params") { setTab("sim"); setScreen("params"); }
          else if (act === "compare") {
            const res = (window.HousingApp && HousingApp.currentResult) || null;
            const item = res ? (res.best || (res.top_comprehensive || [])[0]) : null;
            if (item && window.openModal) window.openModal(item);
          }
          else if (act === "expand") { setCompact(!compact); setTimeout(bumpViz, 60); }
          else if (act === "report") {
            const open = document.body.classList.toggle("m-report-open");
            t.textContent = open ? "收起完整解释 ↑" : "展开完整解释 ↓";
          }
          else if (act === "close-city") closeCitySheet();
          else if (act === "show-all") {
            const on = document.body.classList.toggle("m-show-all");
            t.textContent = on ? "收起大表，只看前 7 套" : ("看全部 " + ((schemeLists && schemeLists.__total) || 0) + " 个方案（大表）");
            if (on) bumpViz();
          }
          else if (act === "go-sim") { setTab("sim"); setScreen("params"); }
          else if (act === "go-map") { setTab("map"); }
          else if (act === "go-list") { setTab("list"); }
          else if (act === "go-collect") {
            const ct = document.getElementById("jwCollectToggle");
            if (ct) {
              ct.scrollIntoView({ behavior: "smooth", block: "center" });
              const card = ct.closest(".m-card");
              if (card) {
                card.style.transition = "box-shadow .3s";
                card.style.boxShadow = "0 0 0 2px rgba(251,191,36,.55)";
                setTimeout(() => { card.style.boxShadow = ""; }, 1400);
              }
            }
          }
          else if (act === "go-anchor") {
            setTab("sim"); setScreen("params");
            setTimeout(() => {
              const g = $("anchorGroup");
              if (g) { g.open = true; g.scrollIntoView({ behavior: "smooth", block: "center" }); }
            }, 120);
          }
          else if (act === "reset") {
            const b = $("resetParamBtn");
            if (b) b.click();
            renderMe();
          }
        });

        window.addEventListener("resize", () => {
          if (!isMobile()) {
            body.classList.remove("m-compact");
            body.removeAttribute("data-mtab");
            body.removeAttribute("data-mscreen");
          } else if (!body.dataset.mtab) {
            body.dataset.mtab = "map";
            body.dataset.mscreen = "params";
            paintTabs();
          }
        });

        if (window.MQ && MQ.addEventListener) MQ.addEventListener("change", () => window.dispatchEvent(new Event("resize")));
      }

      function init() {
        bind();
        bindMapChrome();
        if (!isMobile()) return;
        body.dataset.mtab = "map";
        body.dataset.mscreen = "params";
        paintTabs();
        const q = new URLSearchParams(location.search);
        const qt = q.get("tab");
        if (qt && ["map", "sim", "list", "me"].indexOf(qt) >= 0) setTab(qt, { silent: true });
        if (q.get("mscreen") === "result") { screen = "result"; body.dataset.mscreen = "result"; setCompact(true); }
        if (q.get("expand") === "1") setCompact(false);
      }

      window.MApp = {
        init: init,
        setTab: setTab,
        setScreen: setScreen,
        setCompact: setCompact,
        renderSummary: renderSummary,
        renderMe: renderMe,
        onResult: onResult,
        onListings: onListings,
        openMatchPanel: openMatchPanel,
        get tab() { return tab; },
        get screen() { return screen; }
      };

      init();
    })();
  