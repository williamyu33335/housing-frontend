    /* ============ 🏠 V8.2 新房 / 二手房 ============ */
    let houseType = "new";
    const HOUSE_TYPE_CONF = {
      new: {
        note: "新房：契税＋维修基金约 3.5%，多为毛坯，记得把装修钱留出来。",
        deco: "rough",
        share: 22,
      },
      used: {
        note: "二手房：契税＋个税＋中介费约 4.5%，通常带装修；要重装就把预算填进去。",
        deco: "finished",
        share: 15,
      },
    };

    function syncRenoFields() {
      const deco = document.getElementById("houseDecoration");
      const wrap = document.getElementById("renoFields");
      if (!deco || !wrap) return;
      const needsReno = deco.value === "rough" || deco.value === "partial";
      wrap.style.display = needsReno ? "block" : "none";
      const level = document.getElementById("renoLevel");
      const levelItem = level ? level.closest(".form-item") : null;
      // 局部改造不需要选“装修档次”，只需要一个预算
      if (levelItem) levelItem.style.display = deco.value === "partial" ? "none" : "";
      const budget = document.getElementById("renoBudgetWan");
      if (budget && deco.value === "partial" && Number(budget.value) === 0) budget.value = 3;
    }

    function applyHouseType(t) {
      houseType = HOUSE_TYPE_CONF[t] ? t : "used";
      const conf = HOUSE_TYPE_CONF[houseType];
      document.querySelectorAll(".type-btn").forEach((b) => {
        b.classList.toggle("active", b.getAttribute("data-htype") === houseType);
      });
      const note = document.getElementById("typeNote");
      if (note) note.textContent = conf.note;
      const deco = document.getElementById("houseDecoration");
      if (deco) deco.value = conf.deco;
      const share = document.getElementById("publicSharePct");
      if (share && conf.share != null) share.value = conf.share;
      syncRenoFields();
    }

    document.querySelectorAll(".type-btn").forEach((b) => {
      b.onclick = () => applyHouseType(b.getAttribute("data-htype"));
    });
    (function () {
      const deco = document.getElementById("houseDecoration");
      if (deco) deco.onchange = syncRenoFields;
      applyHouseType(houseType);   // 默认新房：毛坯 + 22% 公摊
    })();

    document.querySelectorAll(".mode-btn").forEach(btn => {
      btn.onclick = () => {
        currentMode = btn.dataset.mode;
        document.querySelectorAll(".mode-btn").forEach(b => b.classList.toggle("active", b === btn));
        document.getElementById("rentBaseGroup").style.display = currentMode === "relative" ? "" : "none";
        document.getElementById("rentBaseNote").style.display = currentMode === "absolute" ? "" : "none";

        if (currentMode === "absolute") {
          showToast("已切换至绝对寻优模式，系统将自动搜索最优租金档位");
        }

        clearResults();
      };
    });
