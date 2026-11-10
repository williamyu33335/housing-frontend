    /* ============================================================
       🏙️ V2.0 全国城市库 · 空间异质性的数据底座
       ------------------------------------------------------------
       price  : 元/㎡（二手房综合口径）
       rent   : 元/㎡·月（整租折算）
       salary : 城镇就业月均收入（用于“相对收入位置”，不是人均可支配）
       ============================================================ */
    const CITY_DB = [
      { code: "110000", name: "北京", tier: 1, price: 63000, rent: 92, salary: 13900, lat: 39.90, lng: 116.41 },
      { code: "310000", name: "上海", tier: 1, price: 61000, rent: 95, salary: 13800, lat: 31.23, lng: 121.47 },
      { code: "440300", name: "深圳", tier: 1, price: 58000, rent: 85, salary: 13000, lat: 22.54, lng: 114.06 },
      { code: "440100", name: "广州", tier: 2, price: 33000, rent: 55, salary: 11500, lat: 23.13, lng: 113.26 },
      { code: "330100", name: "杭州", tier: 2, price: 31000, rent: 52, salary: 11000, lat: 30.27, lng: 120.16 },
      { code: "320100", name: "南京", tier: 2, price: 28000, rent: 40, salary: 10500, lat: 32.06, lng: 118.80 },
      { code: "320500", name: "苏州", tier: 2, price: 22000, rent: 36, salary: 10000, lat: 31.30, lng: 120.58 },
      { code: "330200", name: "宁波", tier: 2, price: 24000, rent: 38, salary: 9800, lat: 29.87, lng: 121.55 },
      { code: "350200", name: "厦门", tier: 2, price: 35000, rent: 45, salary: 10000, lat: 24.48, lng: 118.09 },
      { code: "120000", name: "天津", tier: 2, price: 18000, rent: 32, salary: 9000, lat: 39.13, lng: 117.20 },
      { code: "370200", name: "青岛", tier: 2, price: 20000, rent: 33, salary: 9000, lat: 36.07, lng: 120.38 },
      { code: "510100", name: "成都", tier: 2, price: 18000, rent: 35, salary: 9500, lat: 30.57, lng: 104.07 },
      { code: "420100", name: "武汉", tier: 2, price: 16500, rent: 32, salary: 9000, lat: 30.59, lng: 114.31 },
      { code: "610100", name: "西安", tier: 2, price: 15000, rent: 30, salary: 8800, lat: 34.34, lng: 108.94 },
      { code: "500000", name: "重庆", tier: 2, price: 12000, rent: 28, salary: 8500, lat: 29.56, lng: 106.55 },
      { code: "430100", name: "长沙", tier: 2, price: 11000, rent: 26, salary: 8200, lat: 28.23, lng: 112.94 },
      { code: "410100", name: "郑州", tier: 2, price: 12000, rent: 26, salary: 7800, lat: 34.75, lng: 113.63 },
      { code: "340100", name: "合肥", tier: 2, price: 16000, rent: 28, salary: 8500, lat: 31.86, lng: 117.28 },
      { code: "440600", name: "佛山", tier: 2, price: 14000, rent: 27, salary: 8500, lat: 23.02, lng: 113.12 },
      { code: "441900", name: "东莞", tier: 2, price: 18000, rent: 30, salary: 8800, lat: 23.02, lng: 113.75 },
      { code: "320200", name: "无锡", tier: 2, price: 17000, rent: 30, salary: 9000, lat: 31.49, lng: 120.31 },
      { code: "350100", name: "福州", tier: 2, price: 22000, rent: 34, salary: 9000, lat: 26.07, lng: 119.30 },
      { code: "530100", name: "昆明", tier: 3, price: 11500, rent: 26, salary: 7500, lat: 25.04, lng: 102.71 },
      { code: "450100", name: "南宁", tier: 3, price: 10500, rent: 27, salary: 7200, lat: 22.82, lng: 108.37 },
      { code: "520100", name: "贵阳", tier: 3, price: 9500, rent: 24, salary: 7000, lat: 26.65, lng: 106.63 },
      { code: "360100", name: "南昌", tier: 3, price: 12000, rent: 25, salary: 7500, lat: 28.68, lng: 115.86 },
      { code: "370100", name: "济南", tier: 3, price: 15000, rent: 28, salary: 8500, lat: 36.65, lng: 117.12 },
      { code: "210200", name: "大连", tier: 3, price: 13000, rent: 28, salary: 8000, lat: 38.91, lng: 121.61 },
      { code: "210100", name: "沈阳", tier: 3, price: 10000, rent: 24, salary: 7000, lat: 41.80, lng: 123.43 },
      { code: "230100", name: "哈尔滨", tier: 3, price: 9500, rent: 23, salary: 6800, lat: 45.80, lng: 126.53 },
      { code: "220100", name: "长春", tier: 3, price: 9500, rent: 23, salary: 6800, lat: 43.82, lng: 125.32 },
      { code: "130100", name: "石家庄", tier: 3, price: 11000, rent: 24, salary: 7200, lat: 38.04, lng: 114.51 },
      { code: "140100", name: "太原", tier: 3, price: 10000, rent: 23, salary: 7000, lat: 37.87, lng: 112.55 },
      { code: "460200", name: "三亚", tier: 3, price: 28000, rent: 45, salary: 8000, lat: 18.25, lng: 109.51 },
      { code: "620100", name: "兰州", tier: 4, price: 9000, rent: 22, salary: 6500, lat: 36.06, lng: 103.83 },
      { code: "460100", name: "海口", tier: 4, price: 17000, rent: 30, salary: 7800, lat: 20.04, lng: 110.32 },
      { code: "440400", name: "珠海", tier: 4, price: 24000, rent: 35, salary: 9000, lat: 22.27, lng: 113.58 },
      { code: "650100", name: "乌鲁木齐", tier: 4, price: 8500, rent: 22, salary: 7000, lat: 43.83, lng: 87.62 },
      { code: "150100", name: "呼和浩特", tier: 4, price: 9000, rent: 21, salary: 6800, lat: 40.84, lng: 111.75 },
      { code: "640100", name: "银川", tier: 4, price: 8000, rent: 20, salary: 6500, lat: 38.49, lng: 106.23 },
      { code: "630100", name: "西宁", tier: 4, price: 8500, rent: 21, salary: 6600, lat: 36.62, lng: 101.78 },
      { code: "540100", name: "拉萨", tier: 4, price: 12000, rent: 30, salary: 8000, lat: 29.65, lng: 91.14 }
    ];

    const TIER_LABELS = { 1: "超一线", 2: "新一线", 3: "二线", 4: "三线", 5: "四线及以下" };
    const TIER_SPEED = { 1: 24, 2: 23, 3: 22, 4: 21, 5: 20 };   // 城市平均通勤速度 km/h
    const TIER_RADIUS = { 1: 18, 2: 14, 3: 11, 4: 9, 5: 7 };     // 城区半径 km
    const CITY_ZONES = [
      { key: "core", label: "核心区", priceMult: 1.30, rentMult: 1.25, distMult: 0.18, desc: "城市心脏，通勤最短，价格最贵" },
      { key: "main", label: "主城区", priceMult: 1.00, rentMult: 1.00, distMult: 0.50, desc: "生活配套成熟，性价比的主战场" },
      { key: "suburb", label: "近郊新区", priceMult: 0.70, rentMult: 0.72, distMult: 1.00, desc: "价格洼地，用通勤时间换居住面积" }
    ];

    let currentCity = null;
    let currentZone = null;
    let commuteManual = false;
    let currentRisk = "steady";
    // 用户没选城市时的“全国平均”口径（百城二手均价 + 50 城平均租金 + 城镇非私营月薪）
    const NATIONAL_DEFAULT = {
      name: "全国平均", tier: 3, price: 13268, rent: 35, salary: 10342, lat: 35.0, lng: 105.0
    };
    const TM_KEY = "housing_v2_time_machine";

    let map = null;
    let chart = null;
    let regionMarkersGroup = null;

    // 🗺️ V7.3 全国区县底图（按省拆分，看哪个省下哪个省）
    let countyData = null;              // 当前已加载省份的 FeatureCollection
    let countyProvince = null;          // 已加载的省码，如 450000
    let countyLayer = null;
    let countyFetchState = 'idle';      // idle | loading | ready | failed
    let countyRenderer = null;
    let currentProvincePrefix = null;   // 用户点开的是哪个省
    let countyCity = null;              // 当前画的是哪个市（区划码前 4 位）

    // 🏠 V7.9 房源图钉
    let listingsLayer = null;
    let listingsData = [];
    let listingsAll = [];
    let listingsLoading = false;
    const LISTING_BUCKETS = [
      { max: 600000, color: "#38bdf8", label: "60 万以下" },
      { max: 900000, color: "#34d399", label: "60~90 万" },
      { max: 1200000, color: "#fbbf24", label: "90~120 万" },
      { max: Infinity, color: "#f87171", label: "120 万以上" },
    ];
    const COUNTY_DIR = 'county/';
    let regionList = [];
    let calcAbortCtrl = null;
    let currentMode = "relative";
    let currentResult = null;
    let currentChartType = "bar";
    let currentAssetView = "nominal";   // nominal | real

    let isCalculating = false;
    let entropyOpen = false;
    let assumptionOpen = false;
    let allMapMarkers = [];
    let panelsRevealed = false;

    let isSatellite = true;
    let esriSat = null;
    let amapVector = null;
    let provinceLayer = null;
    let cityLayer = null;
