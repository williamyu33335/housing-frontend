    /* ============ 视角切换联动 ============ */
    function flashAIReport() {
      const card = document.querySelector('#aiReportBox .ai-report-card');
      if (!card) return;
      card.classList.remove('flash');
      void card.offsetWidth;
      card.classList.add('flash');
      // 手机上只闪一下，不抢滚动位置——用户点“视角”是想看方案，不是想被拖去读报告
      if (window.innerWidth > 760) {
        const box = document.getElementById('aiReportBox');
        if (box) {
          try { box.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) { }
        }
      }
    }

    function generateAIExpertReport(topItem, res, viewTag = "综合最优") {
      if (!topItem) return;
      currentTopItem = topItem;

      // ==========================================
      // 🌟 颜色标记与数据评价引擎
      // ==========================================
      const cGreen = 'color:#34d399;font-weight:700;'; // 理想数据
      const cRed = 'color:#f87171;font-weight:700;';   // 高压/代价数据
      const cBlue = 'color:#60a5fa;font-weight:700;';  // 中性数据

      const regionName = document.getElementById("regionSel").value || "目标片区";
      // 💡 V8.11：同上——报告里的"总价/房价收入比"必须用方案里算出来的购房总价，
      // 不能用输入框（用户只填面积时，输入框的 0 会让整段文字自相矛盾）。
      const houseTotalWan = (topItem && Number(topItem.purchase_price_wan) > 0)
        ? Number(topItem.purchase_price_wan) : nv("houseTotalWan");
      const monthIncomeNet = nv("monthIncomeNet");
      const monthExp = nv("monthExp");
      const propertyFee = nv("propertyFee");
      const housingFundPct = nv("housingFundPct");
      const loanRatePct = nv("loanRatePct");
      const repayKind = document.getElementById("repayKind").value;
      const rentMonthly = (typeof topItem.rent_level === "number") ? topItem.rent_level : nv("rentBase");

      // 优先读取后端算出的真实首付和贷款金额
      const downPaymentWan = topItem.down_payment_wan !== undefined ? topItem.down_payment_wan : (houseTotalWan * nv("downRatio") / 100);
      const loanPrincipalWan = topItem.loan_principal_wan !== undefined ? topItem.loan_principal_wan : (houseTotalWan - downPaymentWan);

      const loanYears = topItem.loan_year;
      const rentYears = topItem.rent_year;

      const provCap = parseFloat(document.getElementById("providentLoanCapWan").value || 0);
      const calc = calcComboMortgage(loanPrincipalWan, loanRatePct, provCap, 3.1, loanYears, repayKind);
      const monthlyMortgage = calc.monthly;
      const totalInterestWan = calc.totalInterest / 10000;

      const housingFundMonthly = monthIncomeNet * (housingFundPct / 100);
      const buyCar = document.getElementById("buyCar").value === "true";
      const carTotalWan = parseFloat(document.getElementById("carTotalWan").value || 0);
      const carExpense = parseFloat(document.getElementById("carMonthlyExpense").value || 0);
      const growthRate = parseFloat(document.getElementById("annualIncomeGrowthPct").value || 0);

      // 🌟 动态判定组合贷
      const isComboLoan = loanPrincipalWan > provCap;
      let loanText = isComboLoan
        ? `由于突破了 ${provCap} 万的公积金上限，你必须承担 <span style="${cRed}">组合贷</span>（${provCap}万低息 + ${(loanPrincipalWan - provCap).toFixed(1)}万高息商贷）的双重夹击`
        : `全额使用公积金低息贷款，完美避开了商贷的剥削`;

      // 在 AI 报告生成的 `text` 里面，找到合适的位置插入以下彩蛋：

      // (1) 如果你在“综合最优”或者“稳健型”里，找一段加入
      let carComment = "";
      if (buyCar) {
        carComment = `这套方案里，你选择了 <span style="${cRed}">${carTotalWan}万元的汽车</span>。记住，车轮一落地就打了八折。你每个月还要为这辆车额外支付 ${carExpense} 元的养车费。为了平衡这笔开支，系统为你匹配了极长的租房蛰伏期（${rentYears}年），别让四个轮子碾碎了你原本从容的上车梦。`;
      } else {
        carComment = `你选择了 <span style="${cGreen}">暂时不买车</span>。在城市地铁与公交的穿梭中，你把每一分钱都砸向了保值的房产，这种延迟满足的克制力，是你未来实现阶层跨越的最强武器。`;
      }

      let growthComment = "";
      if (growthRate > 0) {
        growthComment = `系统测算了你每年 <span style="${cGreen}">${growthRate}%</span> 的职场能力复利。这意味着你现在的紧绷只是暂时的，随着你的月收入在30年里不断跃升，后期的房贷压力会被通胀和涨薪逐渐稀释，时间最终会站在你这边。`;
      } else {
        growthComment = `你选择了一条保守的静态收入路线，这要求你在未来30年里时刻保持警惕，因为一旦遭遇裁员降薪，缺乏成长弹性的现金流将面临巨大的断供风险。`;
      }

      const fundDeduct = Math.min(monthlyMortgage, housingFundMonthly);
      const actualNetMortgage = Math.max(0, monthlyMortgage - fundDeduct);

      const totalMonthlyOutflow = monthExp + propertyFee + actualNetMortgage;
      const expenseRatioNum = monthIncomeNet > 0 ? ((totalMonthlyOutflow / monthIncomeNet) * 100) : 0;
      const expenseRatio = expenseRatioNum.toFixed(1);

      const remainingCash = monthIncomeNet - totalMonthlyOutflow;
      const surplusRateNum = monthIncomeNet > 0 ? ((remainingCash / monthIncomeNet) * 100) : 0;
      const surplusRate = surplusRateNum.toFixed(1);
      const redlineMargin = (monthIncomeNet * 0.70) - totalMonthlyOutflow;

      const score = topItem.comprehensive_score;
      const adapt = topItem.adapt_score;
      const comfort = topItem.comfort_score;
      const happy = topItem.surplus_happiness;
      const time = topItem.time_efficiency;
      const nominalAssetWan = topItem.net_worth_end_wan;
      const realAssetWan = (typeof topItem.real_net_worth_end_wan === "number") ? topItem.real_net_worth_end_wan : null;
      const inflationFactor = (res.spatial && res.spatial.inflation_factor_30y) ? res.spatial.inflation_factor_30y : 2.098;
      const asset = formatNum(nominalAssetWan, 2);

      // ==========================================
      // 🌟 颜色标记与数据评价引擎
      // ==========================================


      // 1. 利息评价（按“利息 / 本金”判断，绝对金额会骗人）
      const interestRatio = loanPrincipalWan > 0 ? totalInterestWan / loanPrincipalWan : 0;
      const interestPct = (interestRatio * 100).toFixed(1);
      let interestPhrase;
      if (interestRatio > 0.55) {
        interestPhrase = `<span style="${cRed}">${totalInterestWan.toFixed(1)} 万元</span> 的利息（本金的 ${interestPct}%）`;
      } else if (interestRatio > 0.30) {
        interestPhrase = `<span style="${cBlue}">${totalInterestWan.toFixed(1)} 万元</span> 的利息（本金的 ${interestPct}%）`;
      } else {
        interestPhrase = `<span style="${cGreen}">${totalInterestWan.toFixed(1)} 万元</span> 的利息（本金的 ${interestPct}%，已算克制）`;
      }

      // 2. 支出占比评价
      let expenseText, expenseHtml;
      if (expenseRatioNum > 60) {
        expenseText = `高达 <span style="${cRed}">${expenseRatio}%</span> 的支出占比`;
        expenseHtml = `每月支出占比达到高压的 <span style="${cRed}">${expenseRatio}%</span>，逼迫你必须在职场不断突破`;
      } else if (expenseRatioNum > 40) {
        expenseText = `<span style="${cBlue}">${expenseRatio}%</span> 的支出占比`;
        expenseHtml = `每月支出占比控制在合理的 <span style="${cBlue}">${expenseRatio}%</span>`;
      } else {
        expenseText = `仅 <span style="${cGreen}">${expenseRatio}%</span> 的极低支出占比`;
        expenseHtml = `每月支出占比仅 <span style="${cGreen}">${expenseRatio}%</span>，现金流的呼吸感极佳`;
      }

      // 3. 结余率评价
      let surplusText, surplusHtml;
      if (surplusRateNum >= 50) {
        surplusText = `高达 <span style="${cGreen}">${surplusRate}%</span> 的真实结余率`;
        surplusHtml = `真实结余率 <span style="${cGreen}">${surplusRate}%</span>，远高于 50% 的小康线，抗风险能力如同磐石般坚定`;
      } else if (surplusRateNum >= 20) {
        surplusText = `<span style="${cBlue}">${surplusRate}%</span> 的结余率`;
        surplusHtml = `保持了 <span style="${cBlue}">${surplusRate}%</span> 的真实结余率，虽不宽裕但也游刃有余`;
      } else {
        surplusText = `不足 <span style="${cRed}">${surplusRate}%</span> 的紧绷结余率`;
        surplusHtml = `仅 <span style="${cRed}">${surplusRate}%</span> 的结余率，是一种为了长远资产跨越而采取的战术性紧缩`;
      }

      // 4. 期末资产评价（名义 + 今日购买力，双口径）
      const realAssetText = realAssetWan !== null
        ? `，按今日物价约 <span style="${cBlue}">${formatNum(realAssetWan, 2)} 万元</span>`
        : "";
      let assetText = topItem.net_worth_end_wan > 100
        ? `高达 <span style="${cGreen}">${asset} 万元</span> 的流动现金${realAssetText}`
        : `<span style="${cBlue}">${asset} 万元</span> 的流动现金${realAssetText}`;

      // 5. 时间效率动态评价
      const timeText = time >= 80
        ? `高达 <span style="${cGreen}">${time} 分</span>`
        : `<span style="${cBlue}">${time} 分</span>`;

      // 6. 租房年限与贷款年限的过渡语
      const triggerRentShort = rentYears > 0
        ? `前 ${rentYears} 年的蛰伏期里，你没有把青春白白上交给银行，而是把首付款安放在理财账户中让复利翻滚。`
        : `直接买房的果断，让你立刻终结了颠沛流离的搬家之苦，获得了满满的归属感。`;

      const triggerLoanShort = loanYears <= 27
        ? `它没有强迫你在“立刻背上30年房贷”的焦虑中砸锅卖铁，而是用 ${loanYears} 年的温和节奏为你铺就了从容的阶梯。`
        : `它要求你直面长达 ${loanYears} 年的长期贷款，用未来的汗水去置换当下的确定性。`;

      // 7. 首付策略过渡语
      const dsText = topItem.down_strategy === "max" ? "极限倾囊首付" : (topItem.down_strategy === "balanced" ? "平衡折中首付" : "最低门槛首付");
      let dsDesc = "";
      if (topItem.down_strategy === "max") {
        dsDesc = `你果断采取了<span style="${cRed}">极致的进取策略</span>，倾尽所有现金砸出 ${downPaymentWan.toFixed(1)} 万首付，将贷款本金压制到最低的 ${loanPrincipalWan.toFixed(1)} 万，这是壮士断腕般的魄力。`;
      } else if (topItem.down_strategy === "balanced") {
        dsDesc = `你采用了<span style="${cBlue}">精妙的平衡首付</span>，掏出 ${downPaymentWan.toFixed(1)} 万首付，贷款 ${loanPrincipalWan.toFixed(1)} 万，既降低了月供，又留有余粮。`;
      } else {
        dsDesc = `你选择了<span style="${cGreen}">最保守的最低首付</span>，只付 ${downPaymentWan.toFixed(1)} 万，背上 ${loanPrincipalWan.toFixed(1)} 万的贷款，把剩余现金死死攥在手里用于理财。`;
      }

      let healthTag = "💡 深度解析";
      let healthDesc = "该组合在财务压力与生活品质之间找到了奇妙的平衡点。";
      if (res.warning || score < 60 || adapt < 60) {
        healthTag = "⚠️ 风险警示";
        healthDesc = "该方案触发了财务紧绷警告，现金流的安全垫相对薄弱。";
      } else if (score >= 85 && happy >= 80) {
        healthTag = "🏆 黄金方案";
        healthDesc = "该方案不仅实现了极高的资产沉淀，还保留了极佳的生活品质。";
      }

      let tag = healthTag;

      // ==========================================
      // 🌟 用户画像引擎：识别你的真实处境
      // ==========================================
      const yieldRate = parseFloat(document.getElementById("investYieldPct").value);
      const ratio = houseTotalWan / ((monthIncomeNet * 12) / 10000); // 房价收入比

      let userProfile = "balanced";
      if (yieldRate >= 2.0) {
        userProfile = "aggressive"; // 能力进取型（有野心、懂理财或结余极高）
      } else if (surplusRateNum >= 55) {
        userProfile = "steady_saver"; // 稳健积累型：不碰高风险，靠结余率取胜
      } else if (ratio >= 15 || (expenseRatioNum > 50 && monthExp > 5000)) {
        userProfile = "city_striver"; // 大城拼搏型（买房压力极大，开销高）
      } else if (ratio <= 8) {
        userProfile = "relaxed"; // 小城安逸型（压力小）
      }

      let profileDesc = "";
      if (userProfile === "relaxed") {
        profileDesc = `<div style="background: rgba(16, 185, 129, 0.1); border-left: 3px solid #10b981; padding: 10px; margin-bottom: 15px; font-size: 13px; color: #6ee7b7;">
      🍃 <b>生活平衡大师：</b>系统识别到你的购房压力相对较小。你不需要去卷高风险投资，稳稳的幸福才是你的主旋律。
    </div>`;
      } else if (userProfile === "city_striver") {
        profileDesc = `<div style="background: rgba(239, 68, 68, 0.1); border-left: 3px solid #ef4444; padding: 10px; margin-bottom: 15px; font-size: 13px; color: #fca5a5;">
      🔥 <b>逆风破局者：</b>系统识别到你在高压环境下奋斗。仅靠死工资和活期理财，在这个城市扎根会极其吃力，你需要寻找破局点。
    </div>`;
      } else if (userProfile === "steady_saver") {
        profileDesc = `<div style="background: rgba(56, 189, 248, 0.1); border-left: 3px solid #38bdf8; padding: 10px; margin-bottom: 15px; font-size: 13px; color: #7dd3fc;">
      🧱 <b>稳健积累型：</b>你不碰高风险理财，靠的是每月实打实的结余。这不是“不够激进”，这是最抗揍的活法。
    </div>`;
      } else if (userProfile === "aggressive") {
        profileDesc = `<div style="background: rgba(139, 92, 246, 0.1); border-left: 3px solid #8b5cf6; padding: 10px; margin-bottom: 15px; font-size: 13px; color: #c4b5fd;">
      ⚔️ <b>金融猎手/潜力股：</b>你主动选择了 2% 以上的理财收益，愿意用风险换收益。系统会盯紧你的现金流，但市场的毒打谁也替不了你。
    </div>`;
      }

      // 将 profileDesc 插入到最终的 text 字符串里：
      // 找到 text 模板里那句 "亲爱的朋友..." 或 "在这个连呼吸都带着KPI考核味道的时代..." 前面，加上 ${profileDesc}

      const ppBanner = realAssetWan !== null ? `
      <div class="pp-banner">
        <div class="pp-num"><b>${formatNum(nominalAssetWan, 2)} 万</b><span>30 年后名义资产</span></div>
        <div class="pp-arrow">→</div>
        <div class="pp-num real"><b>${formatNum(realAssetWan, 2)} 万</b><span>按今日物价（${inflationFactor}× 通胀）</span></div>
        <div class="pp-loss">购买力被通胀吃掉 <b>${formatNum(Math.max(0, nominalAssetWan - realAssetWan), 2)} 万</b>（-${nominalAssetWan > 0 ? ((1 - realAssetWan / nominalAssetWan) * 100).toFixed(1) : 0}%）</div>
        <div class="pp-note">别拿 30 年后的数字当今天的钱花。下面所有判断，都以“今天的钱”为准。</div>
      </div>` : "";

      let text = "";

      // ==================== 维度1：综合最优 ====================
      if (viewTag === "综合最优") {
        text = `
        ${profileDesc}
        <span class="section-title">一、 生活不是非黑即白，在柴米油盐的数据里拥抱真实</span>
        亲爱的朋友，在这个连呼吸都带着KPI考核味道的时代，买房似乎成了悬在所有年轻人头顶的达摩克利斯之剑。但这套为你算出的【综合最优】方案，并不是一碗只讲情怀的迷魂汤。它总价 ${houseTotalWan} 万，首付 <span style="${cBlue}">${downPaymentWan.toFixed(1)} 万</span>，租房过渡 <span style="${cBlue}">${rentYears} 年</span>，贷款 <span style="${cBlue}">${loanYears} 年</span>。这不仅是一串数字，更是你真实的人生轨迹。${dsDesc} ${triggerLoanShort} 它懂得你深夜加班后渴望有一盏归家明灯，也明白你不愿被沉重的账单剥夺周末喝一杯手冲咖啡的自由。数据是冰冷的，但生活有温度；这套在严苛矩阵中斩获 <span style="${cGreen}">${score} 分</span> 的方案，正是用理性的克制，为你书写的一封情书。${healthDesc}
        
        <span class="section-title">二、 听听数据背后的心声</span>
        ${buyCar ? `<strong>🚗 进阶生活：</strong>${carComment}<br>` : ''} <!-- 🌟 加上车 -->
        ${growthRate > 0 ? `<strong>📈 职场复利：</strong>${growthComment}<br>` : ''} <!-- 🌟 加上涨薪 -->
        <strong>1. 资本与杠杆的共舞：</strong>这套避风港总价值 <span style="${cBlue}">${houseTotalWan} 万元</span>，你将用 <span style="${cBlue}">${downPaymentWan.toFixed(1)} 万元</span> 首付敲开大门。剩下的 <span style="${cBlue}">${loanPrincipalWan.toFixed(1)} 万元</span> 贷款，通过${repayKind === "equal_principal" ? "等额本金" : "等额本息"}方式在 ${loanYears} 年中偿还。虽然要支付${interestPhrase}，但这是跨越阶层的必经之路。<br>
        <strong>2. 现金流的呼吸感：</strong>公积金账户的进账（约 <span style="${cBlue}">${formatNum(housingFundMonthly, 0)} 元</span>）只能用于购房/还贷，<b>不是可支配现金</b>；它把真实的自付月供压到 <span style="${cBlue}">${formatNum(actualNetMortgage, 0)} 元</span>。${expenseHtml}。<br>
        <strong>3. 抵御风险的温柔铠甲：</strong>每月还能剩下 <span style="${cBlue}">${formatNum(remainingCash, 0)} 元</span> 纯现金，${surplusHtml}。你距离残酷的 70% 破产红线，还有 <span style="${redlineMargin > 0 ? cGreen : cRed}">${formatNum(redlineMargin, 0)} 元</span> 的安全余量。<br>
        <strong>4. 时间的玫瑰：</strong>30 年后，当你彻底卸下债务，手里将握着 ${assetText}，那是时间与复利给你的最高奖赏。
        
        <span class="section-title">三、 写给你的生活指南</span>
        ${userProfile === 'city_striver' ? `
        1. <strong>寻找第二曲线：</strong>不要光盯着死工资，试着利用你的专业去接点私活，或者去学习真正的资产配置。<br>
        2. <strong>考虑降维打击：</strong>如果在这个城市强行上车会让你失去翻盘的机会，不妨考虑下周边二线城市，你的生活品质会瞬间翻倍。<br>
        ` : userProfile === 'relaxed' ? `
        1. <strong>享受松弛感：</strong>你已经比很多大城市焦虑的白领过得舒服了，保持这个节奏，多花点时间陪陪家人。<br>
        2. <strong>稳健为王：</strong>千万别去碰那些不懂的高风险理财，你的抗风险能力很好，别把它毁了。<br>
        ` : `
        1. <strong>建立防火墙：</strong>在你野心勃勃向前的路上，一定要把 50% 的资产配置在绝对安全的底仓上，永远不要拿还房贷的钱去赌。<br>
        2. <strong>敬畏市场：</strong>高收益伴随高风险，保持警惕，祝你早日实现真正的财务自由。<br>
        `}
        3. <strong>为爱筑起防线：</strong>每月健康的结余就是最大的底气。拿出一部分买好重疾险，这是你在风雨来临时，护家人周全的温柔承诺。
        `;
      }
      // ==================== 维度2：舒适度TOP ====================
      else if (viewTag === "舒适度TOP") {
        text = `
        <span class="section-title">一、 拼命赚钱的终极奥义，是买下自由呼吸的灵魂</span>
        我的朋友，当你点开这个【舒适度TOP】标签时，空气里仿佛都弥漫着咖啡豆的香气。这套方案以 <span style="${cGreen}">${happy} 分</span> 的幸福感和 <span style="${cGreen}">${comfort} 分</span> 的舒适度登顶，它是一场对沉重消费主义的浪漫反叛。在这个人人都在鼓吹“早买早安心”的浮躁社会里，它让你在长达 <span style="${cBlue}">${rentYears} 年</span> 的过渡期里，依然能住在离公司步行五分钟的精致公寓，不用把有限青春出卖给地铁。它用 ${houseTotalWan} 万总价的期望，搭配 ${dsText} 的 ${downPaymentWan.toFixed(1)} 万，没有榨干你最后的一滴血。这是一种极其奢侈的精神松弛感，它把“家”温柔地还原成了卸下防备的柔软角落。生活不是苦行僧的竞赛，而是一段应该被温柔以待的旅程。
        
        <span class="section-title">二、 自由，是最高级的财富</span>
        <strong>1. 杠杆的温柔面：</strong>虽然房屋总价高达 ${houseTotalWan} 万，但通过精明的蓄水，你只需 <span style="${cBlue}">${downPaymentWan.toFixed(1)} 万元</span> 首付即可上车，避免了砸锅卖铁的窘境。<br>
        <strong>2. 毫无压迫的月度账单：</strong>${expenseHtml}，你不用把有限的青春悉数上交给冷冰冰的利息账单。<br>
        <strong>3. 留住的不是钱，是光：</strong>每月 <span style="${cGreen}">${formatNum(remainingCash, 0)} 元</span> 的纯现金流，是随时可以辞职看世界的底气。${surplusHtml}。<br>
        <strong>4. 必然的取舍：</strong>虽然这份舒适可能让你在通勤上（${time} 分）、资产上（${asset} 万）做出让步，但谁在乎呢？你过得开心，才是对这个世界最漂亮的反击。
        
        <span class="section-title">三、 写给你的生活指南</span>
        1. <strong>把租房当成生活美学：</strong>花心思布置租来的家，买最好的床垫，买一束鲜艳的花。房子是别人的，但岁月是你自己的。<br>
        2. <strong>设立“浪费”基金：</strong>既然结余这么多，每月拿出 30% 去“浪费”吧！去听一场演唱会，为无用的美好买单，这是对未来漫长岁月的情绪补偿。<br>
        3. <strong>警惕温水煮青蛙：</strong>长租期意味着你需要极强的自律，确保首付款不被消费主义吞噬，资金必须锁死在低风险理财中。
      `;
      }
      // ==================== 维度3：资产积蓄TOP ====================
      else if (viewTag === "资产积蓄TOP") {
        text = `
        <span class="section-title">一、 拒绝为盲目跟风买单，用绝对理性的极客复利让资本打工</span>
        嘿，极客朋友，如果你骨子里流淌着对数学之美的崇拜，那么这套【资产积蓄TOP】方案绝对会让你会心一笑。但请注意，这世上没有免费的午餐，这套方案不是只有光鲜亮丽的数字。${dsDesc} 并在漫长岁月中支付了${interestPhrase}。它的底层逻辑冷酷得像一把手术刀：将现金尽可能留在理财账户里野蛮生长，同时用长达 ${loanYears} 年的杠杆去换取现金流的喘息空间。这是一个将金融杠杆玩弄于股掌之间的艺术，它冷酷、精准，不带一丝情绪化冲动。到了30年后，你将手握 ${assetText}，完成了普通人几代人都难以逾越的资本原始积累。这不仅是买房，更是一场资本运作的沙盘演练。
        
        <span class="section-title">二、 金钱永不眠，时间看得见</span>
        <strong>1. 极客的算盘：</strong>房屋总价 ${houseTotalWan} 万，你选择了 ${loanYears} 年的贷款期限，产生了${interestPhrase}。这看似是一笔沉重的买路钱，但它是你撬动未来资产的支点。<br>
        <strong>2. 极致的资产冲刺：</strong>30 年后，当你彻底卸下债务，手里将握着 ${assetText}，那是资本为你疯狂打工的最强核武器。<br>
        <strong>3. 现金流的代价：</strong>想要在30年后拥有惊人的财富，就必须在当下承受压力。你的真实月供为 <span style="${cBlue}">${formatNum(actualNetMortgage, 0)} 元</span>，红线上方仅剩 <span style="${redlineMargin > 0 ? cGreen : cRed}">${formatNum(redlineMargin, 0)} 元</span> 的缓冲。${expenseHtml}。<br>
        <strong>4. 战略性的蛰伏：</strong>${triggerRentShort} 先用租房把首付攒厚、再缩短贷款年限，这条路径的时间效率是 ${timeText}（租 + 贷的年数越短，分数越高）。
        
        <span class="section-title">三、 写给你的生活指南</span>
        1. <strong>做金钱的执剑人：</strong>守住你的本金！把首付投入到年化收益能跑赢房贷利率的稳健基金里，去吃市场的无风险利差。<br>
        2. <strong>早日赎回自由：</strong>尽早清空房贷。当你拿到那张贷款结清证明时，无债一身轻的快乐比任何消费都来得极致。<br>
        3. <strong>警惕黑天鹅：</strong>${expenseRatioNum > 60 ? '<span style="color:#f87171">你的支出处于极高位，</span>' : ''}必须保留至少 12 个月的月供作为紧急备用金，不要让精妙的复利模型因为断供而瞬间崩塌。
      `;
      }
      // ==================== 维度4：稳健型 ====================
      else if (viewTag === "稳健型") {
        text = `
        <span class="section-title">一、 在黑天鹅满天飞的时代里，把安全感织成黄金铠甲</span>
        在这个充满不确定性的疯狂世界里，真正成熟的成年人从来不屑于去玩一荣俱荣的豪赌游戏。这套【稳健型】方案以惊人的 <span style="${cGreen}">${adapt} 分</span> 稳健评分傲视群雄。它用 ${houseTotalWan} 万总价、${dsText} 的 ${downPaymentWan.toFixed(1)} 万，向你证明了一个真理：活得安稳，本身就是一种胜利。它通过极其宽裕的现金流安全垫，将每月开销死死压在安全地带。哪怕明天职场面临优化裁员，你依然可以端起茶杯，心里默念一句：“没关系，我的备用金还能撑很久。”这种泰山崩于前而色不变的底气，才是千金难买的人生顶级奢侈品。成年人的体面，是银行卡里永远有一笔能应对变故的“Fuck You Money”。
        
        <span class="section-title">二、 数据背后的踏实安稳</span>
        <strong>1. 拒做账单奴隶：</strong>为了这份安全感，你选择了租 ${rentYears} 年、贷 ${loanYears} 年的组合。虽然在这个过程中产生了${interestPhrase}，但这换来的是极致的从容。<br>
        <strong>2. 极致的冗余：</strong>${expenseHtml}，距离那条残酷的 70% 破产红线，你拥有高达 <span style="${cGreen}">${formatNum(redlineMargin, 0)} 元</span> 的免死金牌。<br>
        <strong>3. 现金的厚度：</strong>每月结余 <span style="${cGreen}">${formatNum(remainingCash, 0)} 元</span>，${surplusHtml}。这种宽裕，是你面对生活刁难时最坚硬的盾牌。<br>
        <strong>4. 必然的妥协：</strong>30年后你将拥有 ${assetText}。虽然稳健的策略可能让你错失了一些激进加杠杆的机会，但在这个比烂的时代，活下去本身就是巨大的胜利。
        
        <span class="section-title">三、 写给你的生活指南</span>
        1. <strong>守住你的护城河：</strong>继续保持至少 6 个月的活期存款。那是你的战略储备，无论谁向你借钱，都别动这笔钱。<br>
        2. <strong>把长租进行到底：</strong>别急，${triggerRentShort} 让时间帮你熬死那些高杠杆的炒房客，我们再从容出手。<br>
        3. <strong>稳步削减债务：</strong>有余钱别去乱投资，优先提前还贷。无债一身轻，是你未来十年最坚硬的铠甲。
      `;
      }
      // ==================== 维度5：速度型 ====================
      else if (viewTag === "速度型") {
        text = `
        <span class="section-title">一、 不做最猛的赌徒，做最早收工的人</span>
        这套【速度型】有个前提必须说在前面：它不是"谁冲得最快"，而是<b>先把四个维度都拉过及格线，再看谁最早把房子变成自己的</b>。租 ${rentYears} 年、贷 ${loanYears} 年，全程 ${rentYears + loanYears} 年收工——比大多数方案早了整整 ${Math.max(0, 30 - (rentYears + loanYears))} 年。这几年的差距，不是账面上的数字，是你四十岁时还背不背月供的差别。方案综合得分 <span style="${cGreen}">${score} 分</span>，${dsDesc}，没有为了快把抗风险、舒适、幸福感任何一项拉爆，这才是"速度"这两个字的分量。

        <span class="section-title">二、 速度型的数据解剖</span>
        <strong>1. 首付与杠杆：</strong>首付 ${downPaymentWan.toFixed(1)} 万，贷 ${loanPrincipalWan.toFixed(1)} 万。${triggerLoanShort} 期间你需要承担${interestPhrase}。<br>
        <strong>2. 收工时间表：</strong>租房 ${rentYears} 年 + 还贷 ${loanYears} 年 = ${rentYears + loanYears} 年。之后那 ${Math.max(0, 30 - (rentYears + loanYears))} 年，你的工资不再有月供这个出口。<br>
        <strong>3. 及格线以上的人生：</strong>${expenseHtml}。每月结余 <span style="${cBlue}">${formatNum(remainingCash, 0)} 元</span>，${surplusHtml}。<br>
        <strong>4. 早点还完的价值：</strong>这套组合租 ${rentYears} 年、贷 ${loanYears} 年，时间效率 ${timeText}——离"没有月供"还有 ${rentYears + loanYears} 年。省下来的不是利息，是"还没老就先自由"的那段时间；30 年后你手上还有 ${assetText}。

        <span class="section-title">三、 写给你的生活指南</span>
        1. <strong>把"收工年"标在日历上：</strong>${rentYears + loanYears} 年后你不再有月供。从今天起，所有关于换工作、换城市的决定，都可以按"那时候我已经没有债"来规划。<br>
        2. <strong>别在收工前加杠杆：</strong>速度型最怕中途加码。车、装修贷、消费贷，任何一笔都会把这 ${rentYears + loanYears} 年往后推。<br>
        3. <strong>收工之后才是开始：</strong>那 ${Math.max(0, 30 - (rentYears + loanYears))} 年不要再拿去补消费，转成指数基金或第二套房的首付，你才真正从"还完"走到"跑赢"。
      `;
      }
      // ==================== 维度6：进取型 ====================
      else if (viewTag === "进取型") {
        text = `
        <span class="section-title">一、 敢叫日月换新天的破局者：用摧枯拉朽的姿态撞开命运的大门</span>
        平庸是温水煮青蛙的毒药，而真正的勇士敢于迎着惊涛骇浪扬帆起航！这套【进取型】方案是专属于你热血基因的赞歌。它以极具侵略性的高效率（综合得分 <span style="${cGreen}">${score} 分</span>），面对 ${houseTotalWan} 万的资产，${dsDesc} 用最快的速度在城市核心打下属于自己的烙印。这是一场充满荷尔蒙的勇敢者游戏，它要求你在职场披荆斩棘、用未来的成长速度去碾压眼前的障碍。虽然过程伴随着紧绷，虽然你需要支付${interestPhrase}，但当你看到期末那串数字时，所有的汗水都会化作骄傲。人生短短数十载，如果连做梦都不敢最大胆一点，那和咸鱼有什么分别？
        
        <span class="section-title">二、 锋芒毕露的数据解剖</span>
        <strong>1. 雷霆万钧的杠杆：</strong>总价 ${houseTotalWan} 万，贷款 ${loanPrincipalWan.toFixed(1)} 万。你几乎没有犹豫，极短的租房期后直接拿下红本。<br>
        <strong>2. 效率就是生命：</strong>时间效率达到 ${timeText}，你像是一个精算师，将付给银行的利息锁定在 <span style="${totalInterestWan > 50 ? cRed : cBlue}">${totalInterestWan.toFixed(1)} 万元</span>。<br>
        <strong>3. 战斗状态的面板：</strong>家庭月支出占比达到了 <span style="${cRed}">${expenseRatio}%</span>，${expenseHtml}。你想赢，就必须承受这份张力。<br>
        <strong>4. 金钱的嘉奖：</strong>30 年后你将手握 ${assetText}。在通胀时代，快鱼吃慢鱼。这套方案强制你保持极高的职场竞争力，不接受任何懈怠。
        
        <span class="section-title">三、 写给你的生活指南</span>
        1. <strong>打造不可替代的护城河：</strong>激进的方案全靠强大的现金流支撑。请务必保持你的职场竞争力，你现在的收入，就是这座大厦的地基。<br>
        2. <strong>盯紧你的红线：</strong>距离 70% 红线仅剩 <span style="${cRed}">${formatNum(redlineMargin, 0)} 元</span> 的缓冲，如果遇到收入波动，立刻勒紧裤腰带，保住月供是第一要务。<br>
        3. <strong>给自己留条后路：</strong>在房贷结清前，不要把所有的子弹都打光。保持抗压底线，你才能在风浪中笑到最后。
      `;
      }
      // ==================== 兜底备用 ====================
      else {
        text = `
        <span class="section-title">一、 为你量身定制的宏大推演画卷，在不确定的时代锚定确定的幸福</span>
        系统针对您的严格要求，对【${escapeHtml(regionName)}】片区进行了像素级的深度解构。这套方案（租 ${rentYears} 年 + 贷 ${loanYears} 年）在严苛的风控红线过滤下成功突出重围。${dsDesc} 并承担${interestPhrase}。${healthDesc}这不仅是一场关于金钱流向的推演，更是一面映照你内心渴望的镜子。买房不是终点，好好生活才是。无论你选择了怎样的租贷组合，都是在用当下的克制，去换取未来的从容。生活就像这不断变动的周期，我们无法预测明天的风雨，但可以通过精密的计算，为自己在狂风暴雨中建造一座坚固的灯塔。
        
        <span class="section-title">二、 数据背后的心声</span>
        <strong>1. 坚实的财务地基：</strong>首付支出 ${downPaymentWan.toFixed(1)} 万，贷款本金 ${loanPrincipalWan.toFixed(1)} 万。<br>
        <strong>2. 真实的呼吸空间：</strong>每月总支出 <span style="${cBlue}">${formatNum(totalMonthlyOutflow, 0)} 元</span>。${expenseHtml}。<br>
        <strong>3. 抵御寒冬的存粮：</strong>每月结余 <span style="${cBlue}">${formatNum(remainingCash, 0)} 元</span>，${surplusHtml}。距离红线余量 <span style="${redlineMargin > 0 ? cGreen : cRed}">${formatNum(redlineMargin, 0)} 元</span>。<br>
        <strong>4. 资产沉淀的真相：</strong>${triggerRentShort} 最终沉淀下 ${assetText}。
        
        <span class="section-title">三、 写给你的生活指南</span>
        1. 保持对宏观利率环境的敏感度，如有闲钱优先考虑提前还款，早日卸下包袱，赎回自由身。<br>
        2. 严格监控每月的现金结余率，这是维持家庭幸福感与抗风险能力的基石，切忌盲目加杠杆。<br>
        3. 无论选择哪条路径，切忌盲目跟风，数据才是客观的指路明灯。做这个浮躁世界里清醒的少数派。
      `;
      }

      // ==========================================
      // 🏙️ 城市与通勤叙事（V2.0）：这一节，是整套报告的灵魂
      // ==========================================
      const sp = (res && res.spatial) ? res.spatial : null;
      let spatialHtml = "";
      if (sp) {
        const areaVerdict = sp.area_per_person < 15
          ? "人均面积已经跌破了“体面生活”的警戒线，这不是买房，是把自己塞进一个昂贵的储物柜。"
          : sp.area_per_person < 25
            ? "人均面积勉强够用，多一个人、多一件家具都会显得局促。"
            : sp.area_per_person < 40
              ? "人均面积落在舒适的区间，日子能舒展得开。"
              : "人均面积称得上宽裕，这是这份方案里最值得庆幸的空间红利。";
        const commuteVerdict = sp.commute.own_min >= 60
          ? "每天单程一小时以上，意味着你每年有超过 500 个小时被钉在路上——那不是通勤，是慢性失血。"
          : sp.commute.own_min >= 40
            ? "单程四十分钟，是大多数城市打工人真实的生活切片。"
            : "单程半小时以内，你买下的不只是房子，还有每天多出来的那一点人生。";
        const cityVerdict = sp.pir >= 18
          ? `房价收入比 ${sp.pir}，这座城市正在用一套房子，收割一个年轻人三十年的可能性。`
          : sp.pir >= 10
            ? `房价收入比 ${sp.pir}，压力和希望并存，这是大多数普通人真实的战场。`
            : `房价收入比 ${sp.pir}，在这座城市，努力和回报还没有彻底脱钩。`;
        spatialHtml = `
        <span class="section-title">四、 城市与通勤：你在哪座城市，买的是哪种人生</span>
        这套方案落在 <b>${escapeHtml(sp.city_name)} · ${escapeHtml(sp.tier_label)}</b>，${escapeHtml(sp.family_label)}。按片区 ${formatNum(sp.district_price_sqm, 0)} 元/㎡ 折算，${houseTotalWan} 万只能买到 <b>${sp.own_area_sqm} ㎡</b>，人均 <b>${sp.area_per_person} ㎡</b>。${areaVerdict}<br>
        你的税后收入，是本地平均薪资（${formatNum(sp.city_avg_salary, 0)} 元/月）的 <b>${sp.rel_income} 倍</b>。这个倍数决定了你在这座城市里，到底是“被平均”，还是“有余裕”。${cityVerdict}<br>
        ${commuteVerdict} 按当地时薪折算，买房后每天往返 ${sp.commute.own_min * 2} 分钟（单程 ${sp.commute.own_min} 分钟），每月相当于隐性支付 <b>${formatNum(sp.commute.time_cost_month, 0)} 元</b>——它不会出现在工资条上，但它真实地吃掉你的人生。通勤分是 <b>${sp.commute.own_score} 分</b>（租房期 ${sp.commute.rent_score} 分 / 买房后 ${sp.commute.own_score} 分）——它只作参考，不进"时间效率"（那个算的是租 + 贷要多少年）。<br>
        最后是那个最容易被忽略的真相：30 年后你手里的 ${asset} 万，是名义资产；按 30 年通胀系数 ${sp.inflation_factor_30y}× 折算，按今天物价只剩 <b>${realAssetWan !== null ? formatNum(realAssetWan, 2) : "--"} 万元</b>。这正是我们反复拒绝“画大饼”的原因——数字会膨胀，人生不会。
        ${(res.market && res.market.house_price_growth_pct > 0 && topItem.purchase_price_wan)
            ? `<br>房价按每年 <b>${res.market.house_price_growth_pct}%</b> 增长：你在租 ${rentYears} 年后买入时，总价已变成 <b>${formatNum(topItem.purchase_price_wan, 1)} 万</b>，首付与贷款都按这个价格重算。`
            : ""}`;
      }

      // ==========================================
      // 🧭 V6.1 风险姿态叙事（V6.5 增补现金缓冲）
      // ==========================================
      const rk = (res && res.risk) ? res.risk : null;
      const bufMonths = topItem.buffer_months;
      const bufReq = topItem.buffer_required;
      const bufferLine = (typeof bufMonths === "number")
        ? `整个周期里最紧的时候，你手里只剩 <b>${bufMonths} 个月</b>的支出；按你的职业波动，建议至少留 <b>${bufReq} 个月</b>。${bufMonths >= bufReq ? "这条线守住了。" : "这就是悬崖：缓冲不足，一次断粮就会踩空。"}`
        : "";
      let riskHtml = "";
      if (rk && rk.mode === "aggressive") {
        riskHtml = `
        <span class="section-title">五、 悬崖方案：踩在刀尖上的全速前进</span>
        你主动选择了 <b>${rk.loan_cap_pct}%</b> 的生存线。系统不再替你留那 30% 的安全垫——它把每一分钱都压进了"早点还完"这件事里。${rk.squeeze_life ? "你甚至勾选了节衣缩食，把可支配生活开销压到 8 折。" : ""}
        ${bufferLine}
        这不是一个可以推荐给任何人的方案，它是一个只属于“现在就要”的选择：任何一次失业、一场病、一个必须随的份子钱，都会让你踩空。
        但我也必须承认，在房价和收入的双重挤压下，有些人确实只剩下这一条路。系统把它算清楚，不是为了鼓励你跳，而是让你知道自己在跳什么。`;
      } else if (rk) {
        const hiddenHtml = rk.hidden_expense_month > 0
          ? `除此之外，系统还替你按月摊销了 <b>${formatNum(rk.hidden_expense_month, 0)} 元</b> 的隐形支出——红包、旅行、体检、一张突然的医院缴费单、家里半夜打来的一通电话。它们从不出现在工资条上，但它们真实发生。`
          : `这套方案没有计入隐形支出。红包、旅行、体检、一张突然的医院缴费单——它们不在工资条上，但真实发生。建议你自己补上这一笔，再决定要不要签字。`;
        riskHtml = `
        <span class="section-title">五、 那道 70% 的红线，和它守住的 30%</span>
        这套方案里，还贷期的真实支出始终没有越过收入的 <b>${rk.loan_cap_pct}%</b>。${hiddenHtml}
        ${bufferLine}
        我们坚持这条线，不是保守，是因为见过太多被一场病、一次裁员击穿的家庭。`;
      }

      const reportBox = document.getElementById("aiReportBox");
      reportBox.style.display = "block";
      reportBox.innerHTML = `
    <div class="ai-report-card" id="aiReportCard">
      <div class="ai-report-header">
        <div class="ai-report-title">
          💡 智能置业多维决策报告
          <span class="ai-view-chip">当前视角：${escapeHtml(viewTag)}</span>
        </div>
        <div class="ai-report-tag">${tag}</div>
      </div>

      <div class="ai-data-grid">
        <div class="ai-data-item">
          <div class="val">${formatNum(remainingCash, 0)}元</div>
          <div class="lbl">月度纯现金结余</div>
        </div>
        <div class="ai-data-item">
          <div class="val" style="${parseFloat(surplusRate) >= 50 ? cGreen : cRed}">${surplusRate}%</div>
          <div class="lbl">真实结余率(小康线50%)</div>
        </div>
        <div class="ai-data-item">
          <div class="val" style="${parseFloat(redlineMargin) < 0 ? cRed : cGreen}">${formatNum(redlineMargin, 0)}元</div>
          <div class="lbl">距离70%红线余量</div>
        </div>
        <div class="ai-data-item">
          <div class="val">${formatNum(actualNetMortgage, 0)}元</div>
          <div class="lbl">实际自付月供</div>
        </div>
        <div class="ai-data-item">
          <div class="val">${formatNum(totalMonthlyOutflow, 0)}元</div>
          <div class="lbl">家庭月度总支出</div>
        </div>
        <div class="ai-data-item">
          <div class="val" style="color:#fbbf24">${realAssetWan !== null ? formatNum(realAssetWan, 2) : "--"}万</div>
          <div class="lbl">30年后购买力（今日物价）</div>
        </div>
      </div>

      <div class="ai-report-content">${ppBanner}${text}${spatialHtml}${riskHtml}</div>

      <button type="button" class="m-report-toggle" data-mact="report">展开完整解释 ↓</button>

      <button class="ai-jump-btn" onclick="openModal(currentTopItem)">📋 查看该方案完整财务明细（月供 / 收支 / 占比 / 利息）</button>
    </div>
  `;
    }

    const BASE_COLUMNS = [
      { key: "rent_year", label: "先租几年", dec: 0 },
      { key: "loan_year", label: "再还几年", dec: 0 },
      { key: "down_payment_wan", label: "首付(万)", dec: 1 },
      { key: "loan_principal_wan", label: "贷款(万)", dec: 1 },
      { key: "net_worth_end_wan", label: "30年后家底(万)", dec: 2, barMax: 420, color: "rgba(59,130,246,0.3)" },
      { key: "real_net_worth_end_wan", label: "按今天物价(万)", dec: 2, barMax: 420, color: "rgba(251,191,36,0.3)" },
      { key: "buffer_months", label: "现金能撑(月)", dec: 1, barMax: 12, color: "rgba(16,185,129,0.3)" },
      { key: "adapt_score", label: "抗风险", dec: 2, barMax: 100, color: "rgba(16,185,129,0.3)" },
      { key: "comfort_score", label: "住得舒服", dec: 2, barMax: 100, color: "rgba(245,158,11,0.3)" },
      { key: "surplus_happiness", label: "手里有余钱", dec: 2, barMax: 100, color: "rgba(139,92,246,0.3)" },
      { key: "time_efficiency", label: "时间效率", dec: 2, barMax: 100, color: "rgba(14,165,233,0.3)" },
      { key: "suitability_score", label: "合不合适", dec: 2, barMax: 100, color: "rgba(236,72,153,0.3)" },
      { key: "comprehensive_score", label: "综合得分", dec: 2, barMax: 100, color: "rgba(37,99,235,0.4)" },
    ];

    function renderTableInto(container, arr) {
      container.innerHTML = "";
      if (!arr || arr.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#94a3b8;padding:20px;">暂无可行方案数据</p>';
        return;
      }
      const cols = [...BASE_COLUMNS];
      if (arr[0].rent_level !== undefined) {
        cols.unshift({ key: "rent_level", label: "租金档(元)", dec: 0 });
      }
      cols.push({ key: "action", label: "操作", isAction: true });

      const wrap = document.createElement("div"); wrap.className = "table-scroll";
      const table = document.createElement("table");
      const trh = document.createElement("tr");
      cols.forEach(c => { const th = document.createElement("th"); th.textContent = c.label; trh.appendChild(th); });
      const thead = document.createElement("thead"); thead.appendChild(trh); table.appendChild(thead);

      // 7 是队长的号码，也是“一眼能扫完”的上限：先给前 7 条，想要再展开
      const LIMIT = window.innerWidth <= 760 ? arr.length : 7;
      const showAll = container.dataset.expanded === "1";
      const rows = showAll ? arr : arr.slice(0, LIMIT);

      const tbody = document.createElement("tbody");
      rows.forEach(item => {
        const tr = document.createElement("tr");
        cols.forEach(c => {
          const td = document.createElement("td");
          const raw = item[c.key];

          if (c.isAction) {
            const btn = document.createElement("button");
            btn.className = "btn-row-detail";
            btn.textContent = "📋 详情";
            btn.onclick = (e) => {
              e.stopPropagation();
              openModal(item);
            };
            td.appendChild(btn);
          } else if (c.barMax) {
            td.className = "data-bar-cell";
            const pct = Math.max(0, Math.min(100, (raw / c.barMax) * 100));
            td.innerHTML = `<div class="data-bar-bg" style="width: ${pct}%; background: ${c.color};"></div><span class="data-bar-text">${formatNum(raw, c.dec)}</span>`;
          } else if (c.key === "rent_level") {
            td.textContent = raw === 0 ? "直接买房" : formatNum(raw, c.dec);
          } else {
            td.textContent = formatNum(raw, c.dec);
          }
          if (typeof raw === "number" && raw < 0) td.style.color = "#f87171";
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody); wrap.appendChild(table); container.appendChild(wrap);

      if (!showAll && arr.length > LIMIT) {
        const more = document.createElement("button");
        more.type = "button";
        more.className = "table-more-btn";
        more.textContent = `展开全部 ${arr.length} 条 ↓`;
        more.onclick = () => {
          container.dataset.expanded = "1";
          renderTableInto(container, arr);
        };
        container.appendChild(more);
      }
    }

    function drawChart(topItem, topArr) {
      const dom = document.getElementById("chartDom");
      if (!chart) chart = echarts.init(dom);

      if (currentChartType === "bar") {
        if (!topArr || topArr.length === 0) return;
        const top10 = topArr.slice(0, 10);
        const assetKey = currentAssetView === "real" ? "real_net_worth_end_wan" : "net_worth_end_wan";
        const assetName = currentAssetView === "real" ? "家底·今日购买力(万)" : "30年后家底(万)";
        const assetData = top10.map(i => (typeof i[assetKey] === "number" ? i[assetKey] : i.net_worth_end_wan));
        const scoreData = top10.map(i => i.comprehensive_score);
        // 📱 390px 上 10 根柱子 + 双轴，标签必须倾斜，否则会叠成一团
        const narrow = window.innerWidth <= 760;

        let chartWarning = "";

        const assetMax = Math.max(...assetData);
        const assetMin = Math.min(...assetData);
        let assetYAxisMin = 0;
        let assetYAxisMax = 0;
        let assetInterval = 0;

        if (assetMax > 0 && (assetMax - assetMin) < assetMax * 0.25) {
          assetInterval = Math.max(1, Math.ceil((assetMax - assetMin) / 6));
          assetYAxisMin = Math.max(0, Math.floor(assetMin / assetInterval) * assetInterval - assetInterval);
          assetYAxisMax = assetYAxisMin + assetInterval * 6;
          while (assetYAxisMax < assetMax) assetYAxisMax += assetInterval;
          chartWarning = "※ 资产轴非0起始，为放大微小差异";
        } else {
          assetYAxisMin = 0;
          assetInterval = Math.max(1, Math.ceil(assetMax / 6));
          assetYAxisMax = assetInterval * 6;
          while (assetYAxisMax < assetMax) assetYAxisMax += assetInterval;
        }

        const scoreMax = Math.max(...scoreData);
        const scoreMin = Math.min(...scoreData);

        let scoreInterval = 1;
        if (scoreMax - scoreMin > 10) {
          scoreInterval = Math.ceil((scoreMax - scoreMin) / 6);
        } else if (scoreMax - scoreMin > 3) {
          scoreInterval = Math.ceil((scoreMax - scoreMin) / 5);
        } else {
          scoreInterval = 0.5;
        }

        let scoreAxisMin = Math.max(0, Math.floor(scoreMin / scoreInterval) * scoreInterval);
        let scoreAxisMax = scoreAxisMin + scoreInterval * 6;
        while (scoreAxisMax < scoreMax) scoreAxisMax += scoreInterval;
        if (scoreAxisMax > 100) {
          scoreAxisMax = 100;
          scoreAxisMin = Math.max(0, scoreAxisMax - scoreInterval * 6);
        }
        chartWarning += (chartWarning ? "，" : "") + "评分轴已动态适配间距";

        const opt = {
          animation: false,
          title: {
            subtext: chartWarning,
            subtextStyle: { color: '#f59e0b', fontSize: 11 },
            left: 'center'
          },
          tooltip: {
            trigger: "axis", formatter: function (params) {
              let res = params[0].name + '<br/>';
              params.forEach(item => {
                const unit = item.seriesName.indexOf("万") >= 0 ? " 万" : " 分";
                res += `${item.marker} ${item.seriesName}: <b>${item.value}${unit}</b><br/>`;
              });
              return res;
            }
          },
          legend: {
            data: [assetName, "综合得分"], bottom: 0,
            itemWidth: narrow ? 16 : 25, itemGap: narrow ? 10 : 20,
            textStyle: { color: '#cbd5e1', fontSize: narrow ? 10 : 12 }
          },
          grid: {
            left: narrow ? 42 : "8%", right: narrow ? 40 : "8%",
            bottom: narrow ? "24%" : "15%", top: narrow ? "18%" : "20%"
          },
          xAxis: {
            type: "category", data: top10.map(i => {
              const prefix = i.rent_level !== undefined ? (i.rent_level === 0 ? "买房/" : `¥${i.rent_level}/`) : "";
              return `${prefix}租${i.rent_year}贷${i.loan_year}`;
            }),
            axisLabel: {
              color: '#94a3b8', fontSize: narrow ? 9 : 11,
              rotate: narrow ? 45 : 0, interval: 0, margin: narrow ? 4 : 8
            }
          },
          yAxis: [
            {
              type: "value", name: currentAssetView === "real" ? "购买力(万)" : "资产(万)",
              min: assetYAxisMin,
              max: assetYAxisMax,
              interval: assetInterval,
              axisLabel: { color: '#94a3b8' },
              splitLine: { lineStyle: { color: 'rgba(255,255,255,0.05)' } }
            },
            {
              type: "value", name: "得分",
              min: scoreAxisMin,
              max: scoreAxisMax,
              interval: scoreInterval,
              axisLabel: { color: '#94a3b8', formatter: (v) => v.toFixed(scoreInterval % 1 === 0 ? 0 : 1) },
              splitLine: { show: false }
            }
          ],
          series: [
            { name: assetName, type: "bar", data: assetData, itemStyle: { color: currentAssetView === "real" ? "#fbbf24" : "#3b82f6", borderRadius: [4, 4, 0, 0] } },
            { name: "综合得分", type: "line", yAxisIndex: 1, data: scoreData, itemStyle: { color: "#10b981" }, smooth: true }
          ]
        };
        chart.setOption(opt, true);
      } else {
        if (!topItem) {
          chart.clear(); chart.setOption({ title: { text: "暂无数据", left: "center", top: "center", textStyle: { color: "#94a3b8" } } }, true); return;
        }
        const maxAsset = topArr && topArr.length > 0 ? Math.max(...topArr.map(x => x.net_worth_end_wan || 0), 1) : 300;
        const dataArr = [
          Math.min(100, Math.max(0, ((topItem.net_worth_end_wan || 0) / maxAsset) * 100)),
          topItem.adapt_score, topItem.comfort_score, topItem.surplus_happiness, topItem.time_efficiency
        ];
        const opt = {
          animation: false,
          title: { text: `榜首方案能力雷达图`, left: 'center', textStyle: { fontSize: 13, color: '#f8fafc' } },
          radar: { indicator: [{ name: '资产积累', max: 100 }, { name: '抗风险', max: 100 }, { name: '居住舒适', max: 100 }, { name: '结余幸福', max: 100 }, { name: '时间效率', max: 100 }], radius: '62%', splitArea: { areaStyle: { color: ['rgba(30,41,59,0.5)', 'rgba(15,23,42,0.5)'] } }, axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } }, splitLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } } },
          series: [{ type: 'radar', data: [{ value: dataArr, name: '方案能力', areaStyle: { color: 'rgba(37, 99, 235, 0.35)' }, lineStyle: { color: '#3b82f6', width: 2 }, itemStyle: { color: '#3b82f6' } }] }]
        };
        chart.setOption(opt, true);
      }
    }

    // =================================================================
    // 🧭 V7.5 锚点方案卡片
    //   原则：先承认他的判断有道理（利息确实省了），再摆出周期末端的差距。
    //   不恐吓、不吹，只把两套方案的数字并排放。
    // =================================================================
    function clearAnchorBox() {
      const box = document.getElementById("anchorBox");
      if (box) { box.style.display = "none"; box.innerHTML = ""; }
    }

    function anchorWan(v) {
      return (v >= 0 ? "+" : "") + Number(v).toFixed(2);
    }

    function d2(x, y) {
      return Number((x - y).toFixed(2));
    }

    // 先肯定他算对的部分，再摆出差距；如果推荐方案其实有代价，也照实说。
    function anchorStory(a, b, d) {
      const interestLine = d.interest_wan > 0
        ? `你的方案利息 <b>${a.total_interest_wan} 万</b>，比推荐方案少 ${Math.abs(d.interest_wan)} 万——这一点你算得没错。`
        : `利息上你其实没占到便宜：你的方案 <b>${a.total_interest_wan} 万</b>，反而比推荐方案多 ${Math.abs(d.interest_wan)} 万，因为首付留得多、贷款本金反而更大。`;
      const assetLine = d.asset_wan > 0
        ? `把 30 年拉通看，家底（现金＋房子）${a.net_worth_end_wan} 万 对 ${b.net_worth_end_wan} 万，你少 ${Math.abs(d.asset_wan)} 万（按今天物价算少 ${Math.abs(d.real_asset_wan)} 万）。`
        : `把 30 年拉通看，家底你是 ${a.net_worth_end_wan} 万、推荐方案 ${b.net_worth_end_wan} 万——<b>单看钱，你的方案反而多 ${Math.abs(d.asset_wan)} 万</b>。它排名靠前，是因为“综合最优”不是“资产最多”：五维加权里还算了住得舒服、时间效率、每月剩多少，不只看家底。`;
      const costLine = b.buffer_months + 1 < a.buffer_months
        ? `但推荐方案不是白拿的：它把首付掏到 ${b.down_payment_wan} 万，手上现金只够撑 <b>${b.buffer_months} 个月</b>；你的方案留了 ${a.buffer_months} 个月。这就是它的代价。`
        : `推荐方案的现金缓冲是 ${b.buffer_months} 个月，你的方案是 ${a.buffer_months} 个月，承压能力差不多。`;
      return interestLine + assetLine + costLine;
    }

    function downLabel(key) {
      return key === "min" ? "最低首付" : key === "max" ? "掏空首付" : "折中首付";
    }

    function renderAnchorBox(res) {
      const box = document.getElementById("anchorBox");
      if (!box) return;
      const req = res.anchor_request || {};

      if (!res.feasible) {
        const near = (res.near_feasible || []).slice(0, 3).map(s =>
          `<li>租 ${s.rent_year} 年 + 贷 ${s.loan_year} 年 · ${downLabel(s.down_strategy)} · 家底 ${s.net_worth_end_wan} 万</li>`
        ).join("");
        box.innerHTML = `
          <div class="toggle-card anchor-fail" data-anchor-infeasible="1"
               style="display:block; border-left:4px solid #ef4444; background:rgba(239,68,68,.08);">
            <b style="color:#f87171;">❌ 你这个预期实现不了</b>
            <div class="form-hint" style="margin:6px 0 8px;">
              你打算：租 ${req.rent_year} 年 + 贷 ${req.loan_year} 年 · ${downLabel(req.down_strategy)}
            </div>
            <p style="margin:8px 0; line-height:1.7; color:#fecaca;">${escapeHtml(res.reason || "这个组合过不了风控。")}</p>
            <p style="margin:6px 0 4px; color:#cbd5e1;">这不是说你不能买房，是这个组合在首付 / 70% 红线下过不了。把年限或首付策略改一改，或者先看这些更接近可行的组合：</p>
            ${near ? `<ul style="margin:0 0 0 18px; line-height:1.8;">${near}</ul>` : ""}
          </div>`;
        box.style.display = "block";
        return;
      }

      const a = res.anchor, b = res.best, d = res.delta || {};
      const interestLine = d.interest_wan > 0
        ? `你的方案利息 <b>${a.total_interest_wan} 万</b>，比推荐方案少 ${Math.abs(d.interest_wan)} 万——这一点你算得没错。`
        : `利息上你其实没占到便宜：你的方案 <b>${a.total_interest_wan} 万</b>，反而比推荐方案多 ${Math.abs(d.interest_wan)} 万。`;
      const assetLine = d.asset_wan > 0
        ? `把 30 年拉通看，家底（现金＋房子）${a.net_worth_end_wan} 万 对 ${b.net_worth_end_wan} 万，你少 ${Math.abs(d.asset_wan)} 万（按今天物价算少 ${Math.abs(d.real_asset_wan)} 万）。`
        : `把 30 年拉通看，期末资产你是 ${a.liquid_asset_end_wan} 万、推荐方案 ${b.liquid_asset_end_wan} 万——单看钱，你的方案反而多 ${Math.abs(d.asset_wan)} 万。`;

      box.innerHTML = `
        <div class="toggle-card" style="display:block; border-left:3px solid #38bdf8;">
          <b>🧭 你打算：租 ${req.rent_year} 年 + 贷 ${req.loan_year} 年 · ${downLabel(req.down_strategy)}</b>
          <div class="form-hint" style="margin:6px 0 10px;">
            这套组合我们原样算了一遍，没有替你改任何参数。它在 ${res.total} 个可行方案里排第 <b>${res.rank}</b>。
          </div>
          <div class="anchor-stats">
            <div><span>30 年总利息</span><b>${a.total_interest_wan} 万</b></div>
            <div><span>家底（现金＋房子）</span><b>${a.net_worth_end_wan} 万</b></div>
            <div><span>家底（今日购买力）</span><b>${a.real_net_worth_end_wan} 万</b></div>
          </div>
          <p style="line-height:1.8; margin:10px 0;">
            ${interestLine}${assetLine}
          </p>
          <button id="anchorCompareBtn">📊 查看逐月 / 逐年详细对比</button>
        </div>`;
      box.style.display = "block";

      const btn = document.getElementById("anchorCompareBtn");
      if (btn) btn.onclick = () => openCompareModal(res);

      if (new URLSearchParams(location.search).get("compare") === "1") {
        setTimeout(() => openCompareModal(res), 600);
      }
    }

