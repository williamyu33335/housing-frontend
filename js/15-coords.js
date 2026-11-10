    /* ============================================================
       🌏 双坐标系：同一份数据，要在两张底图上都对准
       ------------------------------------------------------------
       我们有两张底图：
         · Esri 卫星影像 = WGS-84（所有数据入库/存储都用这套）
         · 高德矢量地图 = GCJ-02（和 WGS 差 500~800 米，俗称"火星坐标"）
       只存一套坐标，切底图就会"楼盘跑到江里、房源飘到隔壁小区"。
       所以：数据存 WGS-84，画之前按当前底图转一次；
       楼盘有豆包单独给的 lat_g/lng_g，直接用，不再现算。
       ============================================================ */
    function wgs2gcj(lat, lng) {
      const A = 6378245.0, EE = 0.00669342162296594323;
      const x = lng - 105.0, y = lat - 35.0;
      const rad = lat / 180.0 * Math.PI;
      let magic = 1 - EE * Math.sin(rad) ** 2;
      const sq = Math.sqrt(magic);
      let dlat = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
      dlat += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
      dlat += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
      dlat += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
      let dlng = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
      dlng += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
      dlng += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
      dlng += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
      dlat = (dlat * 180.0) / ((A * (1 - EE)) / (magic * sq) * Math.PI);
      dlng = (dlng * 180.0) / (A / sq * Math.cos(rad) * Math.PI);
      return [lat + dlat, lng + dlng];
    }

    // WGS 点 → 当前底图的坐标
    function mapLL(lat, lng) {
      if (isSatellite) return L.latLng(lat, lng);
      const g = wgs2gcj(lat, lng);
      return L.latLng(g[0], g[1]);
    }
    // 楼盘点：豆包给了 GCJ 就直接用（省一次计算，也和数据文件对得上）
    function projLL(p) {
      if (!isSatellite && p.lat_g && p.lng_g) return L.latLng(p.lat_g, p.lng_g);
      return mapLL(p.lat, p.lng);
    }
    // Leaflet 的 GeoJSON 坐标回调：[lng, lat] → LatLng
    function geoToLatLng(coords) { return mapLL(coords[1], coords[0]); }

    // GCJ 点 → WGS（切回卫星图时要把地图中心还原；迭代 3 次，误差 <1 米）
    function gcj2wgs(lat, lng) {
      let wlat = lat, wlng = lng;
      for (let i = 0; i < 3; i++) {
        const g = wgs2gcj(wlat, wlng);
        wlat -= (g[0] - lat);
        wlng -= (g[1] - lng);
      }
      return [wlat, wlng];
    }

    // 切底图后重画所有图层（点 + 边界）。不重画的话，数据还停在上一套坐标里。
    function refreshGeoForBasemap() {
      try { renderRegionMarkers(); } catch (_) { }
      try { renderProjects(); } catch (_) { }
      try { renderListingMarkers(); } catch (_) { }
      try { if (countyData) drawCountyLayer(); } catch (_) { }
      try {
        if (mapView === "cities" && currentProvincePrefix) {
          drawCitiesByProvince(Number(currentProvincePrefix), null);
        } else if (globalProvinceData) {
          drawProvinces(true);
        }
      } catch (_) { }
    }
    window.__refreshGeoForBasemap = refreshGeoForBasemap;

    let currentTopItem = null;
