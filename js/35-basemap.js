    /* ============ 底图切换 ============ */
    document.getElementById("layerSwitchBtn").onclick = function () {
      // 切底图 = 换坐标系：中心点、所有点图层、所有边界都要按新坐标系重画，
      // 否则地图换了一张，数据还停在上一套坐标上（差 500 米，肉眼一眼能看出来）。
      const c = map ? map.getCenter() : null;
      if (isSatellite) {
        map.removeLayer(esriSat); map.addLayer(amapVector);
        isSatellite = false;
        document.getElementById("layerIcon").textContent = "🗺️";
        document.getElementById("layerText").textContent = "当前底图：高德矢量（GCJ-02）· 点击切换";
      } else {
        map.removeLayer(amapVector); map.addLayer(esriSat);
        isSatellite = true;
        document.getElementById("layerIcon").textContent = "🛰️";
        document.getElementById("layerText").textContent = "当前底图：卫星影像（WGS-84）· 点击切换";
      }
      if (c && map) {
        // 旧中心是上一套坐标里的数值，转成新坐标系再 setView，否则视野会偏 500 米
        const nc = isSatellite ? gcj2wgs(c.lat, c.lng) : wgs2gcj(c.lat, c.lng);
        map.setView([nc[0], nc[1]], map.getZoom(), { animate: false });
      }
      refreshGeoForBasemap();
      showToast(isSatellite ? "已切换至卫星影像（WGS-84）" : "已切换至高德矢量（GCJ-02），点位已同步换算");
    };

    function enterSystem() {
      document.getElementById('splashScreen').classList.add('hide');
      // V9.1：首启引导等启动页退场后再弹
      try { document.dispatchEvent(new CustomEvent("jw:enter")); } catch (_) { }
      if (map) map.setView([34.5, 108.9], 4);
      showToast("已进入全国全景视角，点击城市轮廓或左右边缘配置参数");
    }

    function revealPanels() {
      if (panelsRevealed) return;
      panelsRevealed = true;
      showPanel('leftPanel');
      showPanel('rightPanel');
      const hint = document.getElementById('mapHint');
      if (hint) hint.style.opacity = '0';
    }

    document.getElementById("mobileToggleBtn").onclick = function () {
      const left = document.getElementById('leftPanel');
      const right = document.getElementById('rightPanel');
      left.classList.toggle('show');
      right.classList.toggle('show');
      setTimeout(() => map && map.invalidateSize(), 300);
    };

    function initMap() {
      map = L.map("map", { zoomControl: false }).setView([34.5, 108.9], 4);
      // ?anchor=5,10,balanced 预填“我的打算”（便于分享与验收）
      const anchorParam = new URLSearchParams(location.search).get("anchor");
      if (anchorParam) {
        const ap = anchorParam.split(",");
        const ar = document.getElementById("anchorRentYear");
        const al = document.getElementById("anchorLoanYear");
        const ad = document.getElementById("anchorDownStrategy");
        if (ar && ap[0] !== undefined) ar.value = ap[0].trim();
        if (al && ap[1] !== undefined) al.value = ap[1].trim();
        if (ad && ap[2]) ad.value = ap[2].trim();
        const grp = document.getElementById("anchorGroup");
        if (grp) grp.open = true;
      }

      // ?listings=1 自动打开房源图钉（验收/分享用）
      if (new URLSearchParams(location.search).get("listings") === "1") {
        setTimeout(() => {
          const cb = document.getElementById("showListings");
          if (cb) { cb.checked = true; toggleListings(true); }
        }, 1500);
      }

      // ?enter=1 跳过启动页直达地图（分享/无头验收用，不影响正常流程）
      if (new URLSearchParams(location.search).get("enter") === "1") {
        setTimeout(() => {
          const sp = document.getElementById('splashScreen');
          if (sp) { sp.classList.add('hide'); sp.style.display = 'none'; }
        }, 30);
      }

      // ?view=22.82,108.37,9 可直接定位到某个视角（分享/验收用）
      const viewParam = new URLSearchParams(location.search).get("view");
      if (viewParam) {
        const vp = viewParam.split(",").map(Number);
        if (vp.length >= 2 && vp.every(n => !isNaN(n))) {
          map.setView([vp[0], vp[1]], vp[2] || 9);
        }
      }

      // 🌟 使用 Canvas 渲染器，不再卡顿
      const canvasRenderer = L.canvas({ padding: 0.5, tolerance: 0.5 });

      // 区县底图单独一个窗格：压在瓦片之上、图钉和合成区之下
      map.createPane('countyPane');
      map.getPane('countyPane').style.zIndex = 350;
      countyRenderer = L.canvas({ padding: 0.5, pane: 'countyPane' });

      // 省界 / 市界各占一个窗格：市界在结构上永远压在省界之上，
      // 不依赖"谁后 addTo"，也不依赖 canvas 的绘制顺序。
      map.createPane('provincePane');
      map.getPane('provincePane').style.zIndex = 360;
      map.createPane('cityPane');
      map.getPane('cityPane').style.zIndex = 380;

      map.createPane('markers');
      map.getPane('markers').style.zIndex = 650;

      esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '&copy; Esri', maxZoom: 18 });
      amapVector = L.tileLayer('https://webrd02.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', { attribution: '© 高德地图', maxZoom: 18 });

      esriSat.addTo(map);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

      regionMarkersGroup = L.layerGroup();
      let autoHintShown = false;

      let globalProvinceData = null;
      let globalCityData = null;
      let currentProvinceLayer = null;
      let currentCityLayer = null;
      let mapView = 'provinces';

      const baseStyle = { renderer: canvasRenderer, color: '#00ffff', weight: 1.2, opacity: 0.7, fillColor: '#00ffff', fillOpacity: 0.02, className: 'china-border' };
      const highlightStyle = { color: '#000000', weight: 2.5, opacity: 1, fillColor: '#000000', fillOpacity: 0.05 };

      fetch('china-province.geojson')
        .then(res => res.ok ? res.json() : null)
        .then(geoData => { if (geoData) { globalProvinceData = geoData; drawProvinces(); } })
        .catch(e => console.log("未找到省级边界", e));

      fetch('china-city.geojson')
        .then(res => res.ok ? res.json() : null)
        .then(geoData => {
          if (geoData) {
            globalCityData = geoData;
            globalCityData.features.forEach(f => {
              try { f.__bounds = L.geoJSON(f).getBounds(); } catch (_) { }
            });
            // 数据晚到时补几次城市识别（避开 loadRegion/clearCity 的时序竞争）
            [200, 800, 1800].forEach(ms => setTimeout(() => {
              if (window.__syncCityFromMap) window.__syncCityFromMap();
            }, ms));
            // 手机网络慢时，用户可能先点了省、市界数据后才到：补画一次
            if (pendingProvince) {
              const p = pendingProvince;
              pendingProvince = null;
              drawCitiesByProvince(p.adcode, p.bounds);
            }
            // 区县底图也补几次：非基准城市全靠这里反查省份
            [400, 1200, 2600].forEach(ms => setTimeout(() => {
              if (window.__syncCountyLayer) window.__syncCountyLayer();
            }, ms));
          }
        })
        .catch(e => console.log("未找到市级边界", e));

      // 地图当前处在哪一层视图：provinces（省视图，看市界轮廓）/ cities（市视图）
      // 用 dataset 同步一份，无头验收可以直接读 <html data-map-view>。
      function setMapView(v) {
        mapView = v;
        document.documentElement.dataset.mapView = v;
      }

      // 🎯 进省时多给一档：省界换市界那一刻，市名要能一眼看见。
      //    只按 fit 那一档飞，市名会挤成一团，用户还得自己点一次「+」。
      function flyToProvince(bounds, duration) {
        if (!bounds || (bounds.isValid && !bounds.isValid())) return;
        let fit = 8;
        try { fit = map.getBoundsZoom(bounds, false, L.point(20, 20)); } catch (_) { }
        const z = Math.min(map.getMaxZoom(), fit + 1);
        map.flyTo(bounds.getCenter(), z, { duration: duration || 1.1, easeLinearity: 0.25 });
      }

      // 把当前选中城市的行政面从"市界图层"里移除，只留其他市的轮廓
      window.hideCityPolygon = function (cityName) {
        if (!currentCityLayer || !cityName) return;
        currentCityLayer.eachLayer(function (layer) {
          const nm = layer.feature && layer.feature.properties && layer.feature.properties.name;
          if (nm && (nm === cityName || nm === cityName + "市")) {
            layer.options.interactive = false;
            if (layer.setStyle) layer.setStyle({ opacity: 0, fillOpacity: 0 });
            if (layer._path) layer._path.style.pointerEvents = "none";
          }
        });
      };

      function drawProvinces(force) {
        if (!globalProvinceData) return;
        // 🐛 老 bug 的根：城市视图下任何一次 drawProvinces() 都会把省界重新铺回
        //    地图最上层，市界就被盖住了。这里直接拒绝重画。
        if (mapView === 'cities' && !force) return;
        if (currentCityLayer) { map.removeLayer(currentCityLayer); currentCityLayer = null; }
        if (currentProvinceLayer) { map.removeLayer(currentProvinceLayer); currentProvinceLayer = null; }

        currentProvinceLayer = L.geoJSON(globalProvinceData, {
          coordsToLatLng: geoToLatLng,
          pane: 'provincePane',
          style: { ...baseStyle, renderer: null },
          onEachFeature: function (feature, layer) {
            try { feature.__bounds = layer.getBounds(); } catch (_) { }
            const name = feature.properties.name || "未知省份";
            const adcode = feature.properties.adcode;
            layer.bindTooltip(name, {
              permanent: false, direction: 'center', className: 'region-tooltip'
            });
            layer.on('click', (e) => {
              L.DomEvent.stopPropagation(e);
              if (adcode === 100000) return;
              currentProvincePrefix = String(adcode).slice(0, 2) + "0000";
              flyToProvince(layer.getBounds(), 1.2);
              // 视野已经由 flyToProvince 定了，这里不要再传 bounds 去 fit
              setTimeout(() => { drawCitiesByProvince(adcode, null); }, 300);
              setTimeout(syncCountyLayer, 340);
            });
          }
        }).addTo(map);
        setMapView('provinces');
      }

      let pendingProvince = null;   // 地图数据还没到时，先把“想看哪个省”记下来

      function drawCitiesByProvince(provinceAdcode, bounds) {
        if (!globalCityData) {
          pendingProvince = { adcode: provinceAdcode, bounds: bounds };
          return;
        }
        // 进省之后省界就没用了：直接卸掉，不是"压在下面"，是"不存在"。
        if (currentProvinceLayer) {
          map.removeLayer(currentProvinceLayer);
          currentProvinceLayer = null;
        }
        if (currentCityLayer) { map.removeLayer(currentCityLayer); currentCityLayer = null; }

        const cityFeatures = globalCityData.features.filter(f => f.properties.parent && f.properties.parent.adcode === provinceAdcode);
        if (cityFeatures.length === 0) {
          showToast("该省暂无市级边界数据");
          setMapView('provinces');
          drawProvinces(true);
          return;
        }

        currentCityLayer = L.geoJSON(cityFeatures, {
          coordsToLatLng: geoToLatLng,
          pane: 'cityPane',
          style: { ...baseStyle, renderer: null, color: '#60a5fa' },
          onEachFeature: function (feature, layer) {
            layer.bindTooltip(feature.properties.name, {
              permanent: true, direction: 'center', className: 'map-label-city'
            });
            layer.on('click', (e) => {
              L.DomEvent.stopPropagation(e);
              layer.setStyle(highlightStyle);
              const matched = matchCityByName(feature.properties.name);
              if (matched) {
                applyCity(matched);   // 命中基准库：同步城市下拉 + 生成图钉
              } else {
                map.flyToBounds(layer.getBounds(), { duration: 1.0, padding: [20, 20], easeLinearity: 0.25 });
                showToast(`「${feature.properties.name}」暂无基准数据，可在左侧选择邻近城市`);
              }
            });
          }
        }).addTo(map);
        setMapView('cities');
        // 注意：这里**不再** fitBounds。原来点省时会 fit 两次
        //（点击一次、画市界又一次），第二次把"多放大一档"又拉回原样，
        // 用户看到的就是"点了省还是不显示市名"。视野只由 flyToProvince 决定。
      }

      window.__drawCitiesByProvince = drawCitiesByProvince;

      function syncCityFromMap() {
        if (!globalCityData || currentCity) return;
        if (map.getZoom() < 8) return;
        const hit = findCityAt(map.getCenter());
        if (!hit) return;
        const matched = matchCityByName(hit.name);
        if (matched) {
          applyCity(matched, { fly: false });
          showToast(`已识别城市：${matched.name}，可直接选择片区`);
        } else if (!autoHintShown) {
          autoHintShown = true;
          showToast(`「${hit.name}」暂无基准数据，可在左侧选择邻近城市`);
        }
      }
      window.__syncCityFromMap = syncCityFromMap;
      window.__findCityAt = findCityAt;

      // 根据地图中心点找所在城市（用预计算的 bounds，取范围最小的）
      function findCityAt(latlng) {
        if (!globalCityData) return null;
        let best = null;
        for (const f of globalCityData.features) {
          const b = f.__bounds;
          if (!b || !b.contains(latlng)) continue;
          const area = Math.abs((b.getNorth() - b.getSouth()) * (b.getEast() - b.getWest()));
          if (!best || area < best.area) {
            best = { name: f.properties.name, area: area, adcode: f.properties.adcode };
          }
        }
        return best;
      }

      // 🖐️ 手机兜底：手指不一定正好落在省界多边形里。
      //    省视图（z<7）下，点地图任意位置都按“点中了哪个省”处理，
      //    这跟电脑端点省界的效果一致，不要求像素级准确。
      map.on('click', function (e) {
        if (map.getZoom() >= 7 || !globalProvinceData) return;
        let best = null;
        for (const f of globalProvinceData.features) {
          const b = f.__bounds;
          if (!b || !b.contains(e.latlng)) continue;
          const area = Math.abs((b.getNorth() - b.getSouth()) * (b.getEast() - b.getWest()));
          if (!best || area < best.area) best = { f, area };
        }
        if (!best) return;
        const adcode = best.f.properties.adcode;
        if (!adcode || adcode === 100000) return;
        currentProvincePrefix = String(adcode).slice(0, 2) + "0000";
        flyToProvince(best.f.__bounds, 1.1);
        setTimeout(() => { drawCitiesByProvince(adcode, null); }, 300);
        setTimeout(syncCountyLayer, 340);
      });

      setTimeout(() => map.invalidateSize(), 200);

      let pinDotState = null;

      map.on('zoomend', function () {
        const z = map.getZoom();
        if (z < 7) {
          if (currentCityLayer && map.hasLayer(currentCityLayer)) {
            map.removeLayer(currentCityLayer);
            currentCityLayer = null;
          }
          if (!currentProvinceLayer && globalProvinceData) {
            setMapView('provinces');
            drawProvinces(true);
          }
        } else if (z >= 7 && mapView !== 'cities' && currentProvincePrefix) {
          // 缩出去又放回来：省界这时已经不在图上，把市界补回来
          const ad = Number(currentProvincePrefix);
          if (globalCityData && ad) drawCitiesByProvince(ad, null);
        }
        if (z >= 8) {
          if (!map.hasLayer(regionMarkersGroup)) regionMarkersGroup.addTo(map);
          // 🎯 放大到市级时自动识别城市并同步下拉，不需要先点列表
          setTimeout(syncCityFromMap, 60);
        } else {
          if (map.hasLayer(regionMarkersGroup)) map.removeLayer(regionMarkersGroup);
        }
        // 省视图（z≥7）就该看到县界；晚一点，等 syncCityFromMap 把城市定下来
        setTimeout(syncCountyLayer, 120);
        setTimeout(renderProjects, 150);     // 楼盘只在 z≥9 显示

        // 圆点 ↔ 带名字的图钉：跨过阈值时重画一次
        const wantDot = window.innerWidth <= 760 && z < 11;
        if (wantDot !== pinDotState) {
          pinDotState = wantDot;
          renderRegionMarkers();
        }
      });

      buildProjectControl();

      // 首屏 setView 早于 zoomend 监听、拿不到事件，这里兜底补几次
      [600, 2000, 4000].forEach(ms => setTimeout(syncCountyLayer, ms));

      // 🔎 只读诊断口：无头验收用（tests/cdp_probe.mjs 直接读）
      window.__mapDiag = function () {
        const paths = (l) => (l && map.hasLayer(l)) ? l.getLayers().length : 0;
        return {
          zoom: map.getZoom(),
          view: mapView,
          provinceOnMap: !!(currentProvinceLayer && map.hasLayer(currentProvinceLayer)),
          cityOnMap: !!(currentCityLayer && map.hasLayer(currentCityLayer)),
          cityPaths: paths(currentCityLayer),
          countyOnMap: !!(countyLayer && map.hasLayer(countyLayer)),
          cityLabels: document.querySelectorAll('.map-label-city').length,
          projectMarkers: projectsLayer ? projectsLayer.getLayers().length : 0,
          provincePaneZ: map.getPane('provincePane') ? map.getPane('provincePane').style.zIndex : null,
          cityPaneZ: map.getPane('cityPane') ? map.getPane('cityPane').style.zIndex : null
        };
      };
    }

    const _listingsToggle = document.getElementById("showListings");
    if (_listingsToggle) _listingsToggle.onchange = (e) => toggleListings(e.target.checked);

    const _entropyBtn = document.getElementById("toggleEntropyBtn");
    if (_entropyBtn) _entropyBtn.onclick = function () {
      entropyOpen = !entropyOpen;
      const _ec = document.getElementById("entropyCard");
    if (_ec) _ec.style.display = entropyOpen ? "block" : "none";
      document.getElementById("entropyArrow").textContent = entropyOpen ? "▲" : "▼";
    };
    document.getElementById("toggleAssumptionBtn").onclick = function () {
      assumptionOpen = !assumptionOpen;
      document.getElementById("assumptionCard").style.display = assumptionOpen ? "block" : "none";
      document.getElementById("assumptionArrow").textContent = assumptionOpen ? "▲" : "▼";
    };
    document.getElementById("resetParamBtn").onclick = function () {
      for (let key in DEFAULT_FORM) {
        const el = document.getElementById(key);
        if (el) el.value = DEFAULT_FORM[key];
      }
      const famSel = document.getElementById("familyMode");
      if (famSel) famSel.value = "2";
      const ct = document.getElementById("careerType"); if (ct) ct.value = "corporate";
      const ind = document.getElementById("industry"); if (ind) ind.value = "other";
      currentRisk = "steady";
      document.querySelectorAll(".risk-btn").forEach(b => b.classList.toggle("active", b.dataset.risk === "steady"));
      document.getElementById("squeezeWrap").style.display = "none";
      document.getElementById("squeezeLife").checked = false;
      const rn = document.getElementById("riskNote");
      rn.className = "risk-note";
      rn.innerHTML = "70% 红线：还贷期真实支出不超过收入的 70%，替你守住 30% 的呼吸空间——那里装着生病、失业、和突然要随的份子钱。";
      commuteManual = false;
      if (currentCity) applyCity(currentCity);
      applyHouseType("new");
      showToast("参数已重置为默认值");
      const sel = document.getElementById("regionSel");
      if (sel && sel.value && regionList.length > 0) {
        const find = regionList.find(x => x.name === sel.value);
        if (find) {
          document.getElementById("houseTotalWan").value = find.house_ref;
          document.getElementById("rentBase").value = find.rent_ref;
        }
      }
    };

    document.getElementById("assetViewBtn").onclick = function () {
      currentAssetView = currentAssetView === "nominal" ? "real" : "nominal";
      this.textContent = currentAssetView === "real" ? "🟡 今日购买力" : "💵 名义资产";
      if (currentResult && currentResult.top_comprehensive && currentResult.top_comprehensive.length) {
        drawChart(currentResult.top_comprehensive[0], currentResult.top_comprehensive);
      }
    };

    document.getElementById("saveChartBtn").onclick = function () {
      if (!chart) return showToast("暂无图表可下载");
      const a = document.createElement('a'); a.href = chart.getDataURL({ type: 'png', pixelRatio: 2 }); a.download = '仿真图表.png'; a.click();
    }
    document.querySelectorAll(".chart-tab").forEach(tab => {
      tab.onclick = () => {
        document.querySelectorAll(".chart-tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        currentChartType = tab.dataset.chart;
        if (currentResult && currentResult.top_comprehensive?.length > 0) {
          drawChart(currentResult.top_comprehensive[0], currentResult.top_comprehensive);
        }
      };
    });

    window.addEventListener('resize', () => { if (chart) chart.resize(); if (map) map.invalidateSize(); });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => { if (chart) chart.resize(); if (map) map.invalidateSize(); }, 300);
    });

    document.getElementById("exportCsvBtn").onclick = function () {
      if (!currentResult || !currentResult.all_scheme) return showToast("请先推演计算");
      const dataList = currentResult.all_scheme;
      if (dataList.length === 0) return showToast("无数据可导出");
      const baseCols = [
        ["rent_year", "租年"], ["loan_year", "贷年"],
        ["down_strategy", "首付策略"], ["down_payment_wan", "首付(万)"],
        ["liquid_asset_end_wan", "期末资产(万)"], ["real_asset_wan", "今日购买力(万)"], ["buffer_months", "现金缓冲(月)"], ["adapt_score", "稳健分"],
        ["comfort_score", "舒适度"], ["surplus_happiness", "幸福感"],
        ["time_efficiency", "时间效率"], ["suitability_score", "合适度"],
        ["comprehensive_score", "综合得分"]
      ];
      const hasRentLevel = dataList[0].rent_level !== undefined;
      const cols = hasRentLevel ? [["rent_level", "租金档(元)"]].concat(baseCols) : baseCols;
      let csvStr = cols.map(c => c[1]).join(',') + '\n';
      dataList.forEach(row => {
        csvStr += cols.map(c => {
          let val = row[c[0]];
          if (c[0] === "down_strategy") {
            val = val === "max" ? "极限" : (val === "balanced" ? "平衡" : "最低");
          }
          return csvEscape(val);
        }).join(',') + '\n';
      });
      const now = new Date(); const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const blob = new Blob(['\uFEFF' + csvStr], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `房产推演_${currentMode}_${ts}.csv`; a.click();
    }
