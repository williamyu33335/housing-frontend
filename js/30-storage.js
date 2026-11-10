    /* ============================================================
       ⏳ V1.5 时光机：把这一次推演刻进浏览器
       ============================================================ */
    function readTimeMachine() {
      try { return JSON.parse(localStorage.getItem(TM_KEY) || "null"); } catch (_) { return null; }
    }

    function renderTimeMachine(res) {
      const box = document.getElementById("timeMachineBox");
      if (!box) return;
      const prev = readTimeMachine();
      const sp = res.spatial || {};
      const top = (res.top_comprehensive && res.top_comprehensive[0]) || {};
      const cur = {
        ts: Date.now(),
        city: sp.city_name || "",
        tier: sp.tier_label || "",
        house: nv("houseTotalWan"),
        income: nv("monthIncomeNet"),
        savings: nv("initialSavingsWan"),
        scheme: {
          rent_year: top.rent_year, loan_year: top.loan_year,
          down_strategy: top.down_strategy,
          liquid_asset_end_wan: top.liquid_asset_end_wan
        }
      };
      if (prev && prev.ts && prev.scheme) {
        const days = Math.max(0, Math.round((Date.now() - prev.ts) / 86400000));
        const ds = (cur.savings || 0) - (prev.savings || 0);
        const da = (cur.scheme.liquid_asset_end_wan || 0) - (prev.scheme.liquid_asset_end_wan || 0);
        const sign = v => (v >= 0 ? "+" : "") + v.toFixed(1);
        box.innerHTML = `
        <div class="timemachine-card">
          ⏳ <b>时光机 · 距上次推演 ${days} 天</b><br>
          上次（${new Date(prev.ts).toLocaleDateString("zh-CN")}）：存款 <b>${formatNum(prev.savings, 1)}</b> 万，方案 租 ${prev.scheme.rent_year} 年 + 贷 ${prev.scheme.loan_year} 年。<br>
          这次：存款 <b>${formatNum(cur.savings, 1)}</b> 万（<b style="color:#6ee7b7">${sign(ds)} 万</b>），期末资产预测 ${formatNum(prev.scheme.liquid_asset_end_wan, 1)} → <b>${formatNum(cur.scheme.liquid_asset_end_wan, 1)}</b> 万（${sign(da)} 万）。<br>
          ${ds > 0 ? "你确实在往前走。数字不会说谎。" : ds === 0 ? "参数没变，说明你在认真核对。真正的答案，要等一年后再看。" : "存款没有变多，这不丢人；但下一次，我希望这个数字是正的。"}
        </div>`;
      } else {
        box.innerHTML = `
        <div class="timemachine-card">
          ⏳ <b>时光机已启动</b>：这是这套参数在本机的第一次推演，我已经把它刻进浏览器。
          一年后回来，我会告诉你走了多远。
        </div>`;
      }
      try { localStorage.setItem(TM_KEY, JSON.stringify(cur)); } catch (_) { }
    }


    const runBtn = document.getElementById("runBtn");
    const loadingText = document.getElementById("loadingText");

    function formatNum(val, dec = 2) {
      if (val === null || val === undefined || isNaN(val)) return "--";
      return Number(val).toFixed(dec);
    }
    function nv(id) {
      const el = document.getElementById(id);
      return el ? (parseFloat(el.value) || 0) : 0;
    }
    function showToast(msg) {
      const t = document.getElementById("toastBox");
      t.textContent = msg; t.style.display = "block";
      clearTimeout(showToast._tid);
      showToast._tid = setTimeout(() => t.style.display = "none", 3500);
    }
    function setLoading(flag) {
      document.getElementById("loadingMask").style.display = flag ? "flex" : "none";
      runBtn.disabled = flag;
    }
    function escapeHtml(str) {
      if (str == null) return '';
      return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }
    function csvEscape(v) {
      if (v == null) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    }
