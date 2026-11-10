    /* ===== 周边便利分（V8.10 起由 Python 预计算） =====
       数据：amenities_nanning.json（片区级，8 区 × 8 类）/ amenities_listings.json（房源级，按坐标）
       算法：距离衰减 × 偏好权重 − 闹静惩罚，规则只有一份：backend/amenity_score.py
       前端只读 scores，不再自己算——否则"片区一套算法、房源一套算法"迟早对不上。
       没有 scores 字段时（旧数据）才回退到下面的本地公式。 */
    let amenities = null;
    let listingAmenities = null;

    async function loadAmenities() {
      try {
        const res = await fetch("amenities_nanning.json", { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        amenities = await res.json();
        document.documentElement.dataset.amenities = "ready";
      } catch (_) {
        document.documentElement.dataset.amenities = "missing";
      }
    }

    // 🏠 V8.10 房源级：按"纬度,经度"（5 位小数）索引；同一楼盘的多套房共用一个键
    async function loadListingAmenities() {
      try {
        const res = await fetch("amenities_listings.json", { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        listingAmenities = await res.json();
        document.documentElement.dataset.listingAmenities =
          String(Object.keys(listingAmenities.by_coord || {}).length);
      } catch (_) {
        document.documentElement.dataset.listingAmenities = "missing";
      }
    }

    function coordKeyOf(lat, lng) {
      const la = Number(lat), ln = Number(lng);
      if (!isFinite(la) || !isFinite(ln) || Math.abs(la) < 0.001) return null;
      return la.toFixed(5) + "," + ln.toFixed(5);
    }

    // 这套房自己的周边数据；没有就是 null（不是空行）。
    function listingAmenityRow(x) {
      const byc = listingAmenities && listingAmenities.by_coord;
      if (!byc || !x) return null;
      const k = coordKeyOf(x.lat, x.lng);
      return k ? (byc[k] || null) : null;
    }

    const AMENITY_PREFS = {
      commute: { label: "通勤优先", w: { metro: 6, school: 1.2, hospital: 1.2, mall: 1, park: 0.6, market: 1, food: 0.6 } },
      family: { label: "家庭刚需", w: { metro: 2, school: 4.5, hospital: 3, mall: 1.2, park: 2, market: 3, food: 1 } },
      leisure: { label: "宜居休闲", w: { metro: 1.5, school: 1, hospital: 2, mall: 1, park: 4.5, market: 2.2, food: 2 } },
    };
    // night 只用于扣分：夜市贴脸是吵，不是方便（豆包的原话：只有高干扰设施才该扣分）
    const AMENITY_META = {
      metro: { label: "地铁站", cap: 3000, kind: "positive" },
      school: { label: "小学", cap: 2500, kind: "positive" },
      hospital: { label: "医院", cap: 3000, kind: "positive" },
      mall: { label: "购物中心", cap: 3000, kind: "positive" },
      park: { label: "公园", cap: 2000, kind: "positive" },
      market: { label: "菜市场", cap: 2000, kind: "positive" },
      food: { label: "美食街", cap: 2500, kind: "positive" },
      night: { label: "夜市", cap: 1500, kind: "negative" },
    };

    // 距离衰减：门口 1 分，越远越低，超过上限归零
    function decayed(dist, cap) {
      if (dist == null || dist < 0) return 0;
      if (dist >= cap) return 0;
      return 1 - dist / cap;
    }

    // 只给"旧数据没有 scores"时用：规则和 backend/amenity_score.py 一致
    function amenityScoreLocal(row, pref) {
      if (!row) return null;
      const w = (AMENITY_PREFS[pref] || AMENITY_PREFS.commute).w;
      let got = 0, max = 0, seen = 0;
      Object.keys(w).forEach((k) => {
        const m = AMENITY_META[k];
        if (!m || !row[k]) return;      // 没采到 -> 不进分母
        seen += 1;
        max += w[k];
        got += w[k] * decayed(row[k].near, m.cap);
      });
      if (!max) return null;
      let score = (got / max) * 100;
      const pen = (key, rules) => {
        const d = row[key] && row[key].near;
        if (d == null) return 0;
        for (const [lim, pts] of rules) if (d < lim) return pts;
        return 0;
      };
      const penalty = Math.min(20,
        pen("mall", [[150, 10], [300, 4]]) +
        pen("food", [[120, 8], [250, 3]]) +
        pen("night", [[200, 12], [400, 6]]));
      return Math.max(0, Math.min(100, Math.round(score - penalty)));
    }

    // 一个"周边数据行"的分数：优先用预计算，旧数据才现算
    function scoreOfRow(row, pref) {
      if (!row) return null;
      const pre = row.scores && row.scores[pref];
      if (typeof pre === "number") return pre;
      return amenityScoreLocal(row, pref);
    }

    function amenityScore(districtName, pref) {
      if (!amenities) return null;
      const row = (amenities.districts || {})[districtName];
      if (!row) return null;
      return scoreOfRow(row, pref || "commute");
    }

    // 一套房的便利分：房源级优先，片区级兜底
    function amenityScoreOfRow(x, pref) {
      const p = pref || "commute";
      const own = listingAmenityRow(x);
      if (own) return scoreOfRow(own, p);
      if (x && x.amenity_score != null) return x.amenity_score;   // 后端已经算好的
      return amenityScore(x && x.district_name, p);
    }

    // 给 UI 用的完整信息（分数 + 逐个设施的最近距离 + 这份数据是哪一级）
    function amenityInfoFor(x, pref) {
      const p = pref || "commute";
      const own = listingAmenityRow(x);
      const row = own || (amenities && (amenities.districts || {})[x && x.district_name]);
      if (!row) return null;
      const items = Object.keys(AMENITY_META).filter((k) => row[k]).map((k) => ({
        key: k,
        label: AMENITY_META[k].label,
        kind: AMENITY_META[k].kind,
        near: row[k] ? row[k].near : null,
        n: row[k] ? row[k].n : null,
      }));
      return {
        score: scoreOfRow(row, p),
        items,
        pref: p,
        level: own ? "listing" : "district",
        radius_m: row.radius_m || 3000,
        captured_at: row.captured_at || null,
      };
    }
    window.__amenityInfoFor = amenityInfoFor;

    window.__amenityInfo = function (districtName, pref) {
      const p = pref || "commute";
      if (!amenities) return null;
      const row = (amenities.districts || {})[districtName];
      if (!row) return null;
      const items = Object.keys(AMENITY_META).filter((k) => row[k]).map((k) => ({
        key: k,
        label: AMENITY_META[k].label,
        kind: AMENITY_META[k].kind,
        near: row[k] ? row[k].near : null,
        n: row[k] ? row[k].n : null,
      }));
      return { score: scoreOfRow(row, p), items, pref: p, level: "district",
               radius_m: row.radius_m || 3000, captured_at: row.captured_at || null };
    };

    // 兼容旧调用（只传片区名的地方还很多）
    window.__poiScore = function (d, pref) {
      const info = window.__amenityInfo(d, pref);
      return info ? info.score : null;
    };

    function refreshSpatialChips() {
      const box = document.getElementById("spatialChips");
      if (!box) return;
      const city = currentCity || NATIONAL_DEFAULT;
      const zone = currentZone || { price_sqm: city.price, name: "全国平均" };
      const price = zone.price_sqm || city.price;
      const house = nv("houseTotalWan");
      const income = nv("monthIncomeNet");
      const famEl = document.getElementById("familyMode");
      const fam = famEl ? (parseInt(famEl.value) || 2) : 2;
      const area = price > 0 ? house * 10000 / price : 0;
      const per = area / Math.max(1, fam);
      const pir = income > 0 ? house * 10000 / (income * 12) : 0;
      const rel = city.salary > 0 ? income / city.salary : 0;
      const items = [
        { t: TIER_LABELS[city.tier] || "未知能级", cls: "" },
        { t: `${formatNum(price, 0)} 元/㎡`, cls: "" },
        { t: `可购 ${area.toFixed(0)}㎡`, cls: per < 18 ? "warn" : "ok" },
        { t: `人均 ${per.toFixed(1)}㎡`, cls: per < 18 ? "warn" : "" },
        { t: `房价收入比 ${pir.toFixed(1)}`, cls: pir >= 15 ? "warn" : "" },
        { t: `收入/本地均薪 ${rel.toFixed(2)}×`, cls: rel >= 1.2 ? "ok" : "" }
      ];
      const proj = projectChipFor(city, zone);
      if (proj) items.push(proj);
      const poi = poiChipFor(city, zone);
      if (poi) items.push(poi);
      const peakEl = document.getElementById("peakCommute");
      if (peakEl && peakEl.checked) {
        items.push({ t: "🚦 高峰假设 ×1.45", cls: "warn", title: "这是假设值，不是实测：真实分时段路况还没采" });
      }
      box.innerHTML = items.map(i => `<span class="spatial-chip ${i.cls}"${i.title ? ` title="${escapeHtml(i.title)}"` : ""}>${escapeHtml(i.t)}</span>`).join("");
    }

    function spatialRequestFields() {
      const city = currentCity || NATIONAL_DEFAULT;
      const zone = currentZone || { price_sqm: city.price };
      const famEl = document.getElementById("familyMode");
      const fam = famEl ? (parseInt(famEl.value) || 2) : 2;
      const rentMin = nv("rentCommuteMin");
      const ownMin = nv("ownCommuteMin");
      const peakEl = document.getElementById("peakCommute");
      const peak = !!(peakEl && peakEl.checked);
      return {
        city_name: city.name,
        city_tier: city.tier,
        city_avg_price_sqm: city.price,
        city_avg_rent_sqm: city.rent,
        city_avg_salary: city.salary,
        district_price_sqm: zone.price_sqm || city.price,
        family_size: fam,
        rent_commute_min: rentMin,
        own_commute_min: ownMin,
        // 🚦 假设倍数：1.0 = 不假设（默认）；打开开关就是 1.45，界面会写明是假设
        commute_peak_factor: peak ? 1.45 : 1.0,
        rent_transport_month: Math.round(120 + 4 * rentMin),
        own_transport_month: Math.round(120 + 4 * ownMin)
      };
    }

    function renderCareerCard(career) {
      const box = document.getElementById("careerBox");
      if (!box) return;
      if (!career) { box.innerHTML = ""; return; }
      const nominal = career.nominal_curve || {};
      const years = Object.keys(nominal).map(Number).sort((a, b) => a - b);
      if (years.length < 2) { box.innerHTML = ""; return; }
      const vals = years.map(y => nominal[y]);
      const maxV = Math.max(...vals), minV = Math.min(...vals);
      const pts = years.map((y, i) => {
        const x = (i / (years.length - 1)) * 100;
        const yy = 42 - ((nominal[y] - minV) / Math.max(1, maxV - minV)) * 36;
        return `${x.toFixed(1)},${yy.toFixed(1)}`;
      }).join(" ");
      box.innerHTML = `
      <div class="career-card">
        <h3>📈 你未来的工资，大概会怎么涨 · ${escapeHtml(career.career_label || "企业职员")}</h3>
        <div class="card-sub">你未来能挣多少：起薪会慢慢涨到一个天花板，不会无限涨上去。</div>
        <div class="row"><span>家庭起薪 / 人均</span><b>${formatNum(career.start_monthly, 0)} / ${formatNum(career.per_earner_start || career.start_monthly, 0)} 元/月</b></div>
        <div class="row"><span>职业天花板</span><b>${formatNum(career.ceiling_monthly, 0)} 元/月 · ${career.cap_multiple} 倍</b></div>
        <div class="row"><span>行业</span><b>${escapeHtml(career.industry_label || "其他 / 综合")}</b></div>
        <div class="row"><span>收入波动 / 应急缓冲</span><b>${career.volatility_pct != null ? career.volatility_pct : "--"}% · 建议 ${career.buffer_months_required != null ? career.buffer_months_required : "--"} 个月</b></div>
        <div class="row"><span>30 年后（名义 / 今日物价）</span><b>${formatNum(career.nominal_30y_monthly, 0)} / ${formatNum(career.real_30y_monthly, 0)} 元</b></div>
        <div class="row"><span>就业人数</span><b>${career.income_earners || 1} 人</b></div>
        <svg viewBox="0 0 100 46" preserveAspectRatio="none" aria-hidden="true">
          <polyline points="${pts}" fill="none" stroke="#38bdf8" stroke-width="1.2" vector-effect="non-scaling-stroke"></polyline>
        </svg>
        <div class="note">${escapeHtml((career.career_note ? career.career_note + "。" : "") + career.note)}</div>
      </div>`;
    }

    function renderRiskCard(rk) {
      const box = document.getElementById("riskBox");
      if (!box) return;
      if (!rk) { box.innerHTML = ""; return; }
      const hidden = rk.hidden_expense_month || 0;
      const hiddenSteady = hidden > 0
        ? `另按月摊销 ${formatNum(hidden, 0)} 元隐形支出（红包 / 旅行 / 医疗 / 意外）。`
        : `你没有计入隐形支出——红包、旅行、医疗、意外，请自己在心里补上这一笔。`;
      if (rk.mode === "aggressive") {
        box.innerHTML = `
        <div class="risk-card aggressive">
          🚀 <b>悬崖方案 · ${rk.loan_cap_pct}% 生存线</b>${rk.squeeze_life ? " · 节衣缩食 ×0.8" : ""}<br>
          你主动放弃了安全垫。系统按 ${rk.loan_cap_pct}% 的支出上限放行方案${hidden > 0 ? `，并按月摊销 ${formatNum(hidden, 0)} 元隐形支出` : "（未计入隐形支出）"}。
          这不是推荐，是把你自己的选择算到最清楚：一旦收入中断，你没有那 30% 的缓冲。
        </div>`;
      } else {
        box.innerHTML = `
        <div class="risk-card steady">
          🛡️ <b>稳健红线 · ${rk.loan_cap_pct}%</b><br>
          <span style="color:#64748b;font-size:12px;">你能承受多少月供：每月总支出不超过收入的 ${rk.loan_cap_pct}%，剩下的留给“万一”。</span><br>
          还贷期真实支出始终 ≤ 收入 ${rk.loan_cap_pct}%。${hiddenSteady}
          这条线不是保守，是给“万一”留的活路。
        </div>`;
      }
    }

    function renderSpatialCard(sp, res) {
      const box = document.getElementById("spatialBox");
      if (!box) return;
      if (!sp) { box.innerHTML = ""; return; }
      const top = (res && res.top_comprehensive && res.top_comprehensive[0]) || null;
      const realAsset = top && typeof top.real_asset_wan === "number" ? top.real_asset_wan : null;
      const nominal = top ? top.liquid_asset_end_wan : null;
      box.innerHTML = `
      <div class="spatial-card">
        <h3>🏙️ 你所在的城市，和你的生活半径
          <span style="font-size:11px;color:#94a3b8;font-weight:400;">${escapeHtml(sp.city_name)} · ${escapeHtml(sp.tier_label)} · ${escapeHtml(sp.family_label)}</span>
        </h3>
        <div class="spatial-grid">
          <div class="item"><div class="v">${sp.own_area_sqm}</div><div class="k">可购建面 ㎡</div></div>
          <div class="item"><div class="v">${sp.area_per_person}</div><div class="k">人均套内 ㎡</div></div>
          <div class="item"><div class="v">${sp.commute.own_min}′</div><div class="k">买房后单程</div></div>
          <div class="item"><div class="v">${formatNum(sp.commute.time_cost_month, 0)}</div><div class="k">通勤时间成本 元/月</div></div>
          <div class="item"><div class="v">${sp.pir}</div><div class="k">房价收入比</div></div>
          <div class="item"><div class="v">${sp.rel_income}×</div><div class="k">相对本地收入</div></div>
        </div>
        <div class="spatial-note">
          套内约 <b>${sp.live_area_sqm != null ? sp.live_area_sqm : "--"} ㎡</b>（公摊 ${sp.public_share_pct != null ? sp.public_share_pct : "--"}%，房产证按建面计价，公摊也付钱）。
          ${escapeHtml(sp.area_note)}。通勤分：租房期 ${sp.commute.rent_score} 分 / 买房后 ${sp.commute.own_score} 分（只作参考，不进方案综合分——通勤是"哪套房"的属性，不是"租几年/贷几年"的属性）；通勤时间成本 ${formatNum(sp.commute.time_cost_month_rent, 0)} → ${formatNum(sp.commute.time_cost_month, 0)} 元/月，交通费 ${formatNum(sp.commute.transport_month.rent, 0)} → ${formatNum(sp.commute.transport_month.own, 0)} 元/月。
          ${sp.commute.peak_applied ? `<br><span class="peak-badge">🚦 ${escapeHtml(sp.commute.peak_note)}：平峰 ${sp.commute.own_min_raw} 分钟 → 高峰约 ${sp.commute.own_min} 分钟。</span>` : ""}
          ${realAsset !== null ? `30 年后名义资产 ${formatNum(nominal, 2)} 万，按今日物价只值 <b>${formatNum(realAsset, 2)} 万</b>。` : ""}
        </div>
      </div>`;
    }
