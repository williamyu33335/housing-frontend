    /* ============ 🧭 风险姿态：70% 是承诺，90% 必须自己按 ============ */
    document.querySelectorAll(".risk-btn").forEach(btn => {
      btn.onclick = () => {
        currentRisk = btn.dataset.risk;
        document.querySelectorAll(".risk-btn").forEach(b => b.classList.toggle("active", b === btn));
        const aggressive = currentRisk === "aggressive";
        document.getElementById("squeezeWrap").style.display = aggressive ? "block" : "none";
        const note = document.getElementById("riskNote");
        note.className = "risk-note" + (aggressive ? " danger" : "");
        note.innerHTML = aggressive
          ? "🚨 悬崖方案：租贷两期都放宽到 90% 生存线。你在用安全垫换时间——任何一次失业、一场病、一个必须随的份子钱，都可能让你踩空。"
          : "70% 红线：还贷期真实支出不超过收入的 70%，替你守住 30% 的呼吸空间——那里装着生病、失业、和突然要随的份子钱。";
        if (!aggressive) document.getElementById("squeezeLife").checked = false;
        clearResults();
        showToast(aggressive ? "已切换到悬崖方案：请先确认你承担得起最坏的情况" : "已回到稳健红线 70%");
      };
    });

    function clearResults() {
      entropyOpen = false; assumptionOpen = false;
      currentTopItem = null;
      const _ec2 = document.getElementById("entropyCard");
    if (_ec2) _ec2.style.display = "none";
      const _ea = document.getElementById("entropyArrow");
      if (_ea) _ea.textContent = "▼";
      document.getElementById("assumptionCard").style.display = "none";
      document.getElementById("assumptionArrow").textContent = "▼";
      document.getElementById("warningBox").innerHTML = "";
      document.getElementById("skipTipBox").innerHTML = "";
      document.getElementById("globalBestBox").style.display = "none";
      document.getElementById("aiReportBox").style.display = "none";
      document.getElementById("viewBar").style.display = "none";
      document.getElementById("tabWrap").innerHTML = "";
      document.getElementById("tabContents").innerHTML = "";
      document.getElementById("emptyState").style.display = "block";
      document.getElementById("spatialBox").innerHTML = "";
      document.getElementById("riskBox").innerHTML = "";
      document.getElementById("careerBox").innerHTML = "";
      document.getElementById("timeMachineBox").innerHTML = "";
      if (chart) { chart.dispose(); chart = null; }
    }
