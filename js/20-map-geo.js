    /* ============================================================
       🏙️ 空间几何：城市 → 区位 → 通勤 → 参数
       ============================================================ */
    function haversineKm(lat1, lng1, lat2, lng2) {
      const R = 6371, toRad = d => d * Math.PI / 180;
      const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
      const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(a));
    }

    // 🗺️ V8.10 真实区县中心（42 城 → 456 个行政区）
    //    以前非南宁城市只有"核心区/主城区/近郊新区"三个假区位，坐标是
    //    市中心向东北偏移 2.5 / 8 / 16 公里——那不是任何一条街。
    //    现在用高德 config/district 的行政区中心（已转 WGS-84）。
    //    位置是真的；片区均价还是估算的，两个字段分开标，不许混着说。
    let districtCenters = null;

    async function loadDistrictCenters() {
      try {
        const res = await fetch("districts_centers.json", { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        districtCenters = await res.json();
        const n = Object.keys((districtCenters && districtCenters.cities) || {}).length;
        document.documentElement.dataset.districtCenters = String(n);
      } catch (_) {
        document.documentElement.dataset.districtCenters = "missing";
      }
    }

    function realDistrictsOf(city) {
      if (!city || !districtCenters || !districtCenters.cities) return null;
      const hit = districtCenters.cities[String(city.code)];
      if (!hit || !hit.districts || !hit.districts.length) return null;
      return hit;
    }

    // 真实区县 → 可推演区位。位置用真坐标，价格按"离市中心多远"折一个估算，
    // 并在 desc / price_source 里写清楚，界面上不会把估算说成事实。
    function zoneFromRealDistrict(city, d) {
      const speed = TIER_SPEED[city.tier] || 22;
      const radius = TIER_RADIUS[city.tier] || 11;
      const dist = (typeof d.dist_km === "number" && isFinite(d.dist_km))
        ? d.dist_km
        : haversineKm(city.lat, city.lng, d.lat, d.lng);
      const ratio = Math.max(0, Math.min(1, dist / Math.max(1, radius)));
      const mult = Math.max(0.65, Math.min(1.30, 1.30 - 0.65 * ratio));
      const realPrice = Number(d.price_sqm) > 0 ? Number(d.price_sqm) : null;
      const price = realPrice || Math.round(city.price * mult / 100) * 100;
      const rent = Math.max(500, Math.round(city.rent * 70 * mult / 100) * 100);
      return {
        name: `${city.name}·${d.name}`,
        district: d.name,
        lat: d.lat,
        lng: d.lng,
        price_sqm: realPrice || price,
        rent_ref: rent,
        house_ref: Math.max(20, Math.round(price * 90 / 10000)),
        commute_min: Math.max(6, Math.round(dist * 1.35 / speed * 60)),
        desc: `真实行政区中心 · 距市中心约 ${dist.toFixed(1)} km` +
          (realPrice ? " · 片区均价来自基准数据" : " · 片区均价按距中心衰减估算"),
        price_source: realPrice ? "real" : "estimated",
      };
    }

    // 非南宁城市：优先进真实区县；没有数据才退回"三环"估算（并明确标估算）
    function formCityZones(city) {
      if (city.zones && city.zones.length) return city.zones;   // 南宁：真实八区 + 真实片区价
      const real = realDistrictsOf(city);
      if (real) {
        return real.districts
          .map((d) => zoneFromRealDistrict(city, d))
          .sort((a, b) => a.commute_min - b.commute_min);
      }
      const speed = TIER_SPEED[city.tier] || 22;
      const radius = TIER_RADIUS[city.tier] || 11;
      return CITY_ZONES.map(z => {
        const dist = radius * z.distMult;
        const lat = city.lat + (dist / 111) * 0.9;
        const lng = city.lng + (dist / (111 * Math.cos(city.lat * Math.PI / 180))) * 0.5;
        const km = haversineKm(city.lat, city.lng, lat, lng);
        return {
          name: `${city.name}·${z.label}`,
          lat: lat,
          lng: lng,
          house_ref: Math.max(20, Math.round(city.price * z.priceMult * 90 / 10000)),
          rent_ref: Math.max(600, Math.round(city.rent * 70 * z.rentMult / 100) * 100),
          price_sqm: Math.round(city.price * z.priceMult / 100) * 100,
          commute_min: Math.max(6, Math.round(km * 1.35 / speed * 60)),
          desc: z.desc + " · 估算区位（不是真实行政区中心）",
          price_source: "estimated"
        };
      });
    }

    function buildCitySelect() {
      const sel = document.getElementById("citySel");
      if (!sel) return;
      sel.innerHTML = "";
      // 🚩 默认不选任何城市：不是每个用户都在南宁，也不是每个访客都想在这里买房
      sel.appendChild(new Option("🇨🇳 全国平均 · 请选择目标城市", ""));
      const groups = {};
      CITY_DB.forEach(c => { (groups[c.tier] = groups[c.tier] || []).push(c); });
      Object.keys(groups).sort().forEach(t => {
        const og = document.createElement("optgroup");
        og.label = TIER_LABELS[t] || ("能级 " + t);
        groups[t].forEach(c => og.appendChild(
          new Option(`${c.name} · ${TIER_LABELS[t] || ""}`, c.code)
        ));
        sel.appendChild(og);
      });
      sel.onchange = function () {
        if (!this.value) { clearCity(); return; }
        const c = CITY_DB.find(x => x.code === this.value);
        if (c) applyCity(c);
      };
    }

    function clearCity() {
      currentCity = null;
      currentZone = null;
      regionList = [];
      if (regionMarkersGroup) { regionMarkersGroup.clearLayers(); }
      if (typeof syncCountyLayer === 'function') syncCountyLayer();
      allMapMarkers = [];
      const sel = document.getElementById("regionSel");
      // 没选城市也能推演：给一个“全国平均”选项，而不是把下拉锁死
      sel.innerHTML = '<option value="">全国平均（未指定城市）</option>';
      sel.disabled = false;
      const citySel = document.getElementById("citySel");
      if (citySel) citySel.value = "";
      refreshSpatialChips();
    }

    // 把 GeoJSON 里的“南宁市/崇左市”映射到 CITY_DB 的“南宁/崇左”
    function matchCityByName(rawName) {
      if (!rawName) return null;
      const clean = String(rawName).replace(/(市|地区|自治州|盟|特别行政区)$/u, "");
      return CITY_DB.find(c => c.name === clean)
        || CITY_DB.find(c => clean.startsWith(c.name) || c.name.startsWith(clean))
        || null;
    }

    // ---------------------------------------------------------------
    // 🗺️ V7.3 全国区县底图
    //    · 数据：county/<省码>.geojson，34 个文件，平均 225KB，看哪个省下哪个
    //    · 全国 2890 个区县一个不少——产品要面向县城，不能只服务 42 个基准城市
    //    · zoom < 7 不画；interactive:false，点击穿透给我们的合成分区
    //    · 非基准城市（崇左、玉林…）靠地图中心反查省份，一样看得到自己的区
    // ---------------------------------------------------------------
    // 当前该看哪个市的区县：省视图（z<9 且没选城市）一律不给
    function currentViewCityAdcode4() {
      if (currentCity && currentCity.code) return String(currentCity.code).slice(0, 4);
      if (map && map.getZoom() >= 9 && window.__findCityAt) {
        const hit = window.__findCityAt(map.getCenter());
        const ad = hit && hit.adcode ? String(hit.adcode) : "";
        if (ad.length >= 6) return ad.slice(0, 4);
      }
      return null;
    }

    function loadProvinceCounties(prov) {
      countyFetchState = 'loading';
      countyData = null;
      countyProvince = prov;
      fetch(`${COUNTY_DIR}${prov}.geojson`)
        .then(res => res.ok ? res.json() : Promise.reject(new Error('HTTP ' + res.status)))
        .then(geo => {
          if (countyProvince !== prov) return;          // 期间又切了省，丢掉过期结果
          countyData = geo;
          countyFetchState = 'ready';
          document.documentElement.dataset.countyLayer = 'ready';
          console.info(`[V7.3] ${prov} 区县底图就绪：${geo.features.length} 个`);
          drawCountyLayer();
        })
        .catch(e => {
          countyFetchState = 'failed';
          document.documentElement.dataset.countyLayer = 'failed';
          console.warn(`[V7.3] ${prov} 区县底图没加载上，主功能不受影响`, e);
        });
    }

    function drawCountyLayer() {
      if (countyLayer) { map.removeLayer(countyLayer); countyLayer = null; }
      if (!countyData || !map || map.getZoom() < 7) return;
      const ad4 = countyCity;
      const feats = countyData.features.filter(f => String((f.properties || {}).gb || '').slice(3, 7) === ad4);
      if (!feats.length) return;
      console.info(`[V7.3] 画出 ${ad4} 的 ${feats.length} 个区县`);
      countyLayer = L.geoJSON({ type: 'FeatureCollection', features: feats }, {
        coordsToLatLng: geoToLatLng,
        renderer: countyRenderer,
        pane: 'countyPane',
        interactive: false,
        style: { color: '#e2e8f0', weight: 1.0, opacity: 0.75, dashArray: '5,4', fill: false }
      });
      countyLayer.addTo(map);
    }

    // 🏗️ V8.13.0 在售楼盘图层：314 个"有均价 + 有坐标"的南宁楼盘（豆包补全 600 个坐标，只画有均价的）。
    //    数据是本地保存页解析出来的，没发过网络请求。
    let projectsLayer = null;
    let projectsData = null;

    async function loadProjects() {
      try {
        const res = await fetch("projects_nanning.json", { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        projectsData = await res.json();
        document.documentElement.dataset.projects = String((projectsData.items || []).length);
        renderProjects();
        // 数据是异步到的，到了要重画一次空间卡（否则楼盘 chip 永远不出现）
        try { refreshSpatialChips(); } catch (_) { }
        // V9.0：手机端「房源」屏的新房户型也依赖这份数据，晚到要补画
        try { window.HousingApp && window.HousingApp.repaintMobileHuxing && window.HousingApp.repaintMobileHuxing(); } catch (_) { }
      } catch (_) {
        document.documentElement.dataset.projects = "missing";
      }
    }

    // 🏗️ 图层开关与价格档筛选（默认关：117 个点一起画太杂）
    let showProjects = false;
    let priceBand = "all";          // all | b1..b5

    const PRICE_BANDS = [
      { key: "all", label: "全部", test: () => true },
      { key: "b1", label: "≤6000", color: "#34d399", test: (p) => p <= 6000 },
      { key: "b2", label: "0.6–0.9万", color: "#38bdf8", test: (p) => p > 6000 && p <= 9000 },
      { key: "b3", label: "0.9–1.3万", color: "#fbbf24", test: (p) => p > 9000 && p <= 13000 },
      { key: "b4", label: "1.3–2万", color: "#fb923c", test: (p) => p > 13000 && p <= 20000 },
      { key: "b5", label: ">2万", color: "#f87171", test: (p) => p > 20000 },
    ];

    function buildProjectControl() {
      if (!map) return;
      const box = document.createElement("div");
      box.className = "project-layer-ctl";
      box.innerHTML =
        '<button type="button" id="projToggle" class="proj-toggle">' +
        '<span>🏗 楼盘</span><b id="projCount">0</b></button>' +
        '<div id="projBands" class="proj-bands" style="display:none;">' +
        PRICE_BANDS.map((b) => b.key === "all"
          ? '<button type="button" class="band-btn on" data-band="all">全部</button>'
          : `<button type="button" class="band-btn" data-band="${b.key}">` +
            `<i style="background:${b.color}"></i>${b.label}</button>`).join("") +
        "</div>";

      const ctl = L.control({ position: "topright" });
      ctl.onAdd = () => box;
      ctl.addTo(map);

      const toggle = box.querySelector("#projToggle");
      let justDragged = false;
      toggle.onclick = () => {
        if (justDragged) { justDragged = false; return; }
        showProjects = !showProjects;
        toggle.classList.toggle("on", showProjects);
        box.querySelector("#projBands").style.display = showProjects ? "flex" : "none";
        renderProjects();
      };

      // V9.4：手机端把楼盘开关做成可拖拽的悬浮球（初始在左侧）
      if (window.innerWidth <= 760) {
        let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
        toggle.addEventListener("pointerdown", (e) => {
          const r = box.getBoundingClientRect();
          ox = r.left; oy = r.top;
          sx = e.clientX; sy = e.clientY;
          dragging = true;
          justDragged = false;
          try { toggle.setPointerCapture(e.pointerId); } catch (_) { }
        });
        toggle.addEventListener("pointermove", (e) => {
          if (!dragging) return;
          const dx = e.clientX - sx, dy = e.clientY - sy;
          if (Math.abs(dx) + Math.abs(dy) > 8) justDragged = true;
          if (!justDragged) return;
          const left = Math.max(6, Math.min(window.innerWidth - 80, ox + dx));
          const top = Math.max(60, Math.min(window.innerHeight - 140, oy + dy));
          box.style.left = left + "px";
          box.style.top = top + "px";
        });
        toggle.addEventListener("pointerup", () => { dragging = false; });
        toggle.addEventListener("pointercancel", () => { dragging = false; });
      }
      box.querySelectorAll(".band-btn").forEach((btn) => {
        btn.onclick = () => {
          priceBand = btn.getAttribute("data-band");
          box.querySelectorAll(".band-btn").forEach((b) => b.classList.toggle("on", b === btn));
          renderProjects();
        };
      });
    }

    function projectColor(price) {
      if (price <= 6000) return "#34d399";
      if (price <= 9000) return "#38bdf8";
      if (price <= 13000) return "#fbbf24";
      if (price <= 20000) return "#fb923c";
      return "#f87171";
    }

    function renderProjects() {
      if (!map) return;
      if (!projectsLayer) projectsLayer = L.layerGroup();
      projectsLayer.clearLayers();
      const cntEl = document.getElementById("projCount");
      if (!projectsData || !(projectsData.items || []).length) {
        if (cntEl) cntEl.textContent = "0";
        return;
      }
      // 开关关掉 / 不是当前城市 / 级别太低 —— 都不画
      const sameCity = currentCity && String(currentCity.code) === String(projectsData.city_code);
      if (!showProjects || !sameCity || map.getZoom() < 9) {
        if (map.hasLayer(projectsLayer)) map.removeLayer(projectsLayer);
        if (cntEl) cntEl.textContent = sameCity ? "0" : "0";
        return;
      }

      const band = PRICE_BANDS.find((b) => b.key === priceBand) || PRICE_BANDS[0];
      // price = 0 的是"有户型但页面没给均价"的盘：不画点（否则会被当成 0 元/㎡ 的便宜货）
      const items = projectsData.items.filter((p) => p.price > 0 && band.test(p.price));
      if (cntEl) cntEl.textContent = String(items.length);

      items.forEach((p) => {
        const lo = p.area_min || 60, hi = p.area_max || lo;
        // 300+ 个点挤在 10 公里内，半径一大就糊成一团；小一点反而能看出密度
        const r = Math.max(3, Math.min(8, 2.5 + (lo + hi) / 90));
        const m = L.circleMarker(projLL(p), {
          pane: "markers", radius: r,
          color: projectColor(p.price), weight: 1.5, opacity: 0.9,
          fillColor: projectColor(p.price), fillOpacity: 0.22
        });
        // 在售户型：只列前 4 个，面积 + 参考总价（没有总价的就不编）
        const hx = (p.huxing || []).slice(0, 4);
        const hxRows = hx.map((h) =>
          '<div style="color:#334155;font-size:12px;line-height:1.6;">· ' +
          (h.room ? escapeHtml(h.room) + " · " : "") +
          "<b>" + h.area + " ㎡</b>" +
          (h.total ? " · 参考 " + h.total + " 万" : "") + "</div>").join("");
        const hxMore = (p.huxing || []).length > 4
          ? '<div style="color:#64748b;font-size:11px;">…还有 ' + ((p.huxing || []).length - 4) + " 个户型</div>"
          : "";
        m.bindPopup(
          '<div style="color:#1e293b;font-size:13px;min-width:190px;max-width:260px;">' +
          "<b>" + escapeHtml(p.name) + "</b>" +
          (p.property_type === "别墅" ? ' <span style="color:#b45309;font-size:11px;">别墅</span>' : "") + "<br>" +
          '<span style="color:#0f766e;font-weight:700;">均价 ' + p.price.toLocaleString() + " 元/㎡</span><br>" +
          "建面 " + (p.area_min || "?") + "–" + (p.area_max || "?") + " ㎡" +
          (p.rooms ? " · " + escapeHtml(p.rooms) : "") + "<br>" +
          escapeHtml(p.district || "") + " · " + escapeHtml(p.block || "") + "<br>" +
          '<span style="color:#64748b;font-size:12px;">' + escapeHtml(p.address || "") + "</span>" +
          (p.open_date ? '<br><span style="color:#64748b;font-size:12px;">开盘 ' + escapeHtml(p.open_date) + "</span>" : "") +
          (p.developer ? '<br><span style="color:#64748b;font-size:12px;">' + escapeHtml(p.developer) + "</span>" : "") +
          (hxRows ? '<div style="margin-top:6px;border-top:1px dashed #cbd5e1;padding-top:5px;">' +
            '<div style="color:#0f766e;font-size:12px;font-weight:700;">在售户型</div>' + hxRows + hxMore + "</div>" : "") +
          "</div>"
        );
        m.bindTooltip(p.name, { direction: "top", className: "region-tooltip" });
        projectsLayer.addLayer(m);
      });
      projectsLayer.addTo(map);
    }

    function priceColor(yuan) {
      const b = LISTING_BUCKETS.find(x => yuan <= x.max);
      return b ? b.color : "#94a3b8";
    }

    async function loadListings(cityCode) {
      if (!cityCode || listingsLoading) return;
      listingsLoading = true;
      try {
        const res = await fetch(`${API_HOST}/api/listings?city_code=${cityCode}&limit=500`, {
          signal: (window.AbortSignal && AbortSignal.timeout) ? AbortSignal.timeout(4000) : undefined
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const json = await res.json();
        listingsData = (json.data || []).filter(x => x.lat && x.lng);
        listingsAll = json.data || [];
        document.documentElement.dataset.listings = String(listingsData.length);
        renderListingMarkers();
        // 📱 V8.0：手机端「房源」屏拿同一份数据渲染列表（不重复请求）
        if (window.MApp) window.MApp.onListings(listingsAll);
      } catch (e) {
        console.warn("[V7.9] 房源接口不可用，地图上不显示房源", e);
        document.documentElement.dataset.listings = "failed";
      } finally {
        listingsLoading = false;
      }
    }

    function renderListingMarkers() {
      if (!map) return;
      if (!listingsLayer) { listingsLayer = L.layerGroup(); }
      listingsLayer.clearLayers();
      if (!listingsData.length) return;

      // 没有经纬度的房源只到"区位"精度：同一区位聚成一个点，避免画出一堆假精度
      const exact = listingsData.filter(x => !x.geo_approximate);
      const approx = listingsData.filter(x => x.geo_approximate);

      const popupFor = (item) => {
        const priceWan = (item.total_price / 10000).toFixed(1);
        return `<div style="margin:6px 0;padding-bottom:6px;border-bottom:1px dashed #e2e8f0;">
          <b>${escapeHtml(item.community || "未命名小区")}</b><br>
          总价 <b>${priceWan} 万</b> · ${item.area_sqm} ㎡ · ${item.bedrooms || "-"} 室 ·
          ${Math.round(item.price_sqm)} 元/㎡
          ${item.geo_approximate ? '<span style="color:#f59e0b;">（区位中心）</span>' : ""}
        </div>`;
      };

      // 1) 精确坐标：一房一点
      exact.forEach(item => {
        const color = priceColor(item.total_price);
        const m = L.marker(mapLL(item.lat, item.lng), {
          pane: "markers",
          icon: L.divIcon({ className: "", html:
            `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid rgba(15,23,42,.85);box-shadow:0 0 8px ${color}"></div>`,
            iconSize: [12, 12], iconAnchor: [6, 6] }),
        });
        m.bindPopup(`<div style="color:#1e293b;font-size:13px;">${popupFor(item)}</div>`);
        listingsLayer.addLayer(m);
      });

      // 2) 区位精度：同区聚一个，点开列清单
      const byDistrict = {};
      approx.forEach(item => {
        const k = item.district_name || "未知区位";
        (byDistrict[k] = byDistrict[k] || []).push(item);
      });
      Object.entries(byDistrict).forEach(([name, items]) => {
        const lat = items[0].lat, lng = items[0].lng;
        const prices = items.map(x => x.total_price / 10000);
        const lo = Math.min(...prices).toFixed(0), hi = Math.max(...prices).toFixed(0);
        const m = L.marker(mapLL(lat, lng), {
          pane: "markers",
          icon: L.divIcon({ className: "", html:
            `<div style="min-width:44px;height:26px;padding:0 6px;border-radius:13px;background:rgba(15,23,42,.86);
              border:2px solid #38bdf8;color:#e2e8f0;font-size:12px;display:flex;align-items:center;justify-content:center;
              box-shadow:0 0 10px rgba(56,189,248,.6);">🏠 ${items.length}</div>`,
            iconSize: [44, 26], iconAnchor: [22, 13] }),
        });
        const list = items.slice(0, 12).map(popupFor).join("");
        m.bindPopup(`<div style="color:#1e293b;font-size:13px;max-height:320px;overflow:auto;">
          <b>📍 ${escapeHtml(name)} · ${items.length} 套在售</b>
          <div style="color:#64748b;font-size:12px;margin:4px 0;">总价 ${lo}~${hi} 万 · 坐标为区位中心近似</div>
          ${list}
          ${items.length > 12 ? `<div style="color:#64748b;">… 还有 ${items.length - 12} 套</div>` : ""}
        </div>`, { maxWidth: 320 });
        listingsLayer.addLayer(m);
      });
    }

    // V9.4：参数面板里的"显示房源"开关已删，进城市后自动把二手房源画到地图上
    function autoShowListings() {
      setTimeout(function () {
        if (!listingsLayer || !map.hasLayer(listingsLayer)) toggleListings(true);
      }, 800);
    }

    function toggleListings(on) {
      if (!map) return;
      if (on) {
        if (!listingsLayer) listingsLayer = L.layerGroup();
        listingsLayer.addTo(map);
        if (currentCity) loadListings(currentCity.code);
      } else if (listingsLayer && map.hasLayer(listingsLayer)) {
        map.removeLayer(listingsLayer);
      }
    }

    function syncCountyLayer() {
      if (!map) return;
      const ad4 = currentViewCityAdcode4();
      document.documentElement.dataset.countyCity = ad4 || 'none';
      // 只有进到某个市才画区县；省视图只留市界（和阿里云 DataV 一致）
      if (map.getZoom() < 8 || !ad4) {
        if (countyLayer) { map.removeLayer(countyLayer); countyLayer = null; }
        return;
      }
      const prov = ad4.slice(0, 2) + "0000";
      countyCity = ad4;
      if (countyProvince === prov && countyData) { drawCountyLayer(); return; }
      if (countyFetchState === 'loading' && countyProvince === prov) return;
      loadProvinceCounties(prov);
    }

    window.__syncCountyLayer = syncCountyLayer;

    function applyCity(city, opts) {
      const fly = !opts || opts.fly !== false;
      currentCity = city;
      regionList = formCityZones(city);
      // 数据来源可见：真实行政区 / 三环估算 / 南宁真实八区
      try {
        document.documentElement.dataset.zoneSource =
          (city.zones && city.zones.length) ? "nanning"
            : (realDistrictsOf(city) ? "real" : "synthetic");
      } catch (_) { }
      const sel = document.getElementById("regionSel");
      sel.disabled = false;
      sel.innerHTML = "";
      regionList.forEach(r => sel.appendChild(new Option(r.name, r.name)));
      sel.selectedIndex = 0;
      currentZone = regionList[0] || null;
      renderRegionMarkers();
      setTimeout(renderProjects, 60);
      syncZoneToForm(true);
      // 📍 从「换城市」直接飞过来时，省界→市界这层从没画过，
      //    结果地图上只有虚线县界、看不出这个市的轮廓。这里补一次。
      if (window.__drawCitiesByProvince && String(city.code || "").length >= 4) {
        const prov = Number(String(city.code).slice(0, 2) + "0000");
        try { window.__drawCitiesByProvince(prov, null); } catch (_) { }
      }
      // 🧹 进到某个市之后，把它的行政面从图层里摘掉：
      //    否则那层浅黄色填充会盖在卫星图上（像一层滤镜），
      //    而且点它会再次触发 applyCity，把视角拽回"城市最佳视角"。
      setTimeout(() => { try { window.hideCityPolygon && window.hideCityPolygon(city.name); } catch (_) { } }, 260);
      syncCountyLayer();
      // V9.4：房源图层默认跟着城市走（参数面板的开关已删）
      autoShowListings();
      const citySel = document.getElementById("citySel");
      if (citySel) citySel.value = city.code;
      if (map) {
        map.invalidateSize();
        if (fly) {
          map.flyTo(mapLL(city.lat, city.lng), city.tier <= 2 ? 9 : 10, { duration: 1.2 });
          map.once('moveend', () => {
            if (!map.hasLayer(regionMarkersGroup)) regionMarkersGroup.addTo(map);
            map.invalidateSize();
          });
        } else if (!map.hasLayer(regionMarkersGroup)) {
          regionMarkersGroup.addTo(map);
        }
      }
    }

    function renderRegionMarkers() {
      if (!regionMarkersGroup) return;
      regionMarkersGroup.clearLayers();
      allMapMarkers = [];
      // 手机上 z<11 只画圆点（手指点得准，也不互相压字）；放大了再出名字
      const dotMode = window.innerWidth <= 760 && map && map.getZoom() < 11;
      regionList.forEach(r => {
        const shortName = String(r.name || "").replace(/(区|县|市)$/u, "");
        const customIcon = dotMode
          ? L.divIcon({
            className: '',
            html: '<div class="custom-dot"><span class="custom-dot-label">' + escapeHtml(shortName) + '</span></div>',
            iconSize: [34, 34],
            iconAnchor: [17, 17]
          })
          : L.divIcon({
            className: '',
            html: `
          <div class="custom-pin">
            <div class="custom-pin-icon"><span>📍</span></div>
            <div class="custom-pin-label">${escapeHtml(r.name)}</div>
          </div>
        `,
            iconSize: [80, 50],
            iconAnchor: [40, 50]
          });
        const m = L.marker(mapLL(r.lat, r.lng), { icon: customIcon });

        const popupDom = document.createElement('div');
        popupDom.style.cssText = "color:#1e293b; font-size:13px;";
        popupDom.innerHTML = `<b>📍 ${escapeHtml(r.name)}</b><br>
        参考房价: <b>${formatNum(r.price_sqm, 0)} 元/㎡</b><br>
        参考租金: <b>${formatNum(r.rent_ref, 0)} 元/月</b><br>
        单程通勤: <b>约 ${r.commute_min} 分钟</b><br>
        <i>${escapeHtml(r.desc || '')}</i><br>`;

        const btn = document.createElement("button");
        btn.textContent = "以此片区推演";
        btn.style.cssText = "margin-top:6px; background:#2563eb; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;";
        btn.onclick = (e) => {
          L.DomEvent.stopPropagation(e);
          e.stopPropagation();
          selectAndGo(r.name, r.lat, r.lng);
          m.closePopup();
        };
        popupDom.appendChild(btn);

        m.bindPopup(popupDom);
        m.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          const sel = document.getElementById("regionSel");
          sel.value = r.name;
          if (typeof sel.onchange === "function") sel.onchange();
        });

        regionMarkersGroup.addLayer(m);
        allMapMarkers.push({ marker: m, name: r.name });
      });
      if (map && !map.hasLayer(regionMarkersGroup)) regionMarkersGroup.addTo(map);
    }

    function estimateCommute(zone, city) {
      const km = haversineKm(city.lat, city.lng, zone.lat, zone.lng);
      const speed = TIER_SPEED[city.tier] || 22;
      const geoMin = Math.max(5, Math.round(km * 1.35 / speed * 60));
      const own = (typeof zone.commute_min === "number") ? zone.commute_min : geoMin;
      return { km: km, own: own, rent: Math.max(8, Math.round(own * 0.55)) };
    }

    function syncZoneToForm(force) {
      const z = currentZone;
      if (!z || !currentCity) return;
      if (force) {
        document.getElementById("houseTotalWan").value = z.house_ref;
        document.getElementById("rentBase").value = z.rent_ref;
      }
      const est = estimateCommute(z, currentCity);
      if (!commuteManual) {
        document.getElementById("ownCommuteMin").value = est.own;
        document.getElementById("rentCommuteMin").value = est.rent;
      }
      const hint = document.getElementById("commuteHint");
      if (hint) {
        hint.textContent = `几何估算：到城市中心直线 ${est.km.toFixed(1)} km → 单程约 ${est.own} 分钟（绕行系数 1.35，按 ${TIER_SPEED[currentCity.tier] || 22} km/h 计）。可手动修正。`;
      }
      refreshSpatialChips();
    }

    // 🏪 V8.13.0 周边设施：数据来自 数据/fetch_poi.py 采的高德 POI 计数。
    // 没采到就什么都不加——宁可少一行，不拿 0 冒充"周边很荒"。
    let poiNearby = null;
    let poiNearbyState = "idle";

    async function loadPoiNearby() {
      if (poiNearbyState !== "idle") return;
      poiNearbyState = "loading";
      try {
        const res = await fetch("poi_nearby.json", { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        poiNearby = await res.json();
        poiNearbyState = "ready";
        document.documentElement.dataset.poi = "ready";
      } catch (_) {
        poiNearbyState = "missing";
        document.documentElement.dataset.poi = "missing";
        return;
      }
      try { refreshSpatialChips(); } catch (_) { }
    }

    function poiChipFor(city, zone) {
      if (!poiNearby || !city || !zone) return null;
      const c = (poiNearby.cities || {})[String(city.code)];
      if (!c) return null;
      const z = (c.zones || {})[zone.name];
      if (!z || typeof z.metro !== "number") return null;
      const cats = poiNearby.categories || {};
      const label = (k, emoji) => cats[k] ? emoji + z[k] : "";
      const parts = [label("metro", "🚇"), label("school", "🏫"),
                     label("hospital", "🏥"), label("mall", "🛍️")].filter(Boolean);
      if (!parts.length) return null;
      // 半径以这条数据自己的 radius_m 为准：早期按 1km 采、后来按 3km 采，
      // 用全局配置去标会标错（数字和说法对不上，比没有数据更糟）。
      const r = z.radius_m || (cats.metro ? cats.metro.radius : 1000);
      return {
        t: parts.join(" ") + " / " + (r >= 1000 ? (r / 1000) + "km" : r + "m"),
        cls: "",
        title: "周边设施（" + (z.captured_at || poiNearby.generated_at || "") + " 采集，"
          + "以区位中心为圆心的 POI 计数，不是楼盘红线内）"
      };
    }

    // 🏗️ 当前片区在售楼盘统计（只对南宁有数据；别的城市返回 null，不显示）
    function projectChipFor(city, zone) {
      if (!projectsData || !city || !zone) return null;
      if (String(city.code) !== String(projectsData.city_code)) return null;
      // 只数有均价的（price=0 的是"没给报价"，混进来会把中位数拉低）
      const list = (projectsData.items || []).filter((p) => p.district === zone.name && p.price > 0);
      if (!list.length) return null;
      const prices = list.map((p) => p.price).sort((a, b) => a - b);
      const mid = prices[Math.floor(prices.length / 2)];
      return {
        t: "🏗 " + list.length + " 个在售 · 中位 " + mid.toLocaleString() + " 元/㎡",
        cls: "",
        title: "本区在售楼盘（均价档 " + prices[0].toLocaleString() + "~" +
          prices[prices.length - 1].toLocaleString() + " 元/㎡），数据来自本地保存页解析"
      };
    }

    // 🧭 周边便利分（0~100）：地铁权重最高，其次是医院、学校、商场。
    // 只对采过 POI 的区有值；没采到返回 null，调用方要知道"没有"≠"0 分"。