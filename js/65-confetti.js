    /* ============================================================
       🎉 撒花引擎 v2 · 性能优先
       ------------------------------------------------------------
       旧版卡顿的三个真实原因（不是“电脑不好”）：
         1. 每帧对 60 个 emoji 调 fillText：彩色字形走不了字形缓存，
            字号还是随机的，等于每帧重新栅格化 60 次；
         2. 每个粒子 save()/restore()，每帧还要调 140 次 Date.now()；
         3. 淡出阶段粒子仍在全量遍历，恰好和表格 / ECharts 的重绘撞车。
       新版：
         · 字形、星星预渲染成 64px 贴图，每帧只 drawImage
         · setTransform 取代 save/restore
         · 每帧只取一次时间，dt 归一化（掉帧时动画不变慢）
         · 死粒子 swap-remove，淡出结束立刻停帧、清画布
         · 尊重 prefers-reduced-motion；低端机自动降采样
       ============================================================ */
    (function () {
      // ⚠️ canvas 在脚本标签之后才出现，所以不能在这里取，必须惰性初始化
      let canvas = null;
      let ctx = null;

      function ensureCanvas() {
        if (canvas) return true;
        canvas = document.getElementById('confettiCanvas');
        if (!canvas) return false;
        ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
        return !!ctx;
      }

      const SPRITE = 64;
      const cache = new Map();

      function makeSprite(key, painter) {
        let c = cache.get(key);
        if (c) return c;
        c = document.createElement('canvas');
        c.width = c.height = SPRITE;
        painter(c.getContext('2d'), SPRITE);
        cache.set(key, c);
        return c;
      }

      function emojiSprite(ch) {
        return makeSprite('e:' + ch, (g, S) => {
          g.font = '52px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",Arial';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(ch, S / 2, S / 2 + 2);
        });
      }

      function starSprite(color) {
        return makeSprite('s:' + color, (g, S) => {
          const cx = S / 2, cy = S / 2, R = 27, r = 10;
          g.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = -Math.PI / 2 + (i * Math.PI) / 4;
            const rad = i % 2 ? r : R;
            const px = cx + Math.cos(a) * rad;
            const py = cy + Math.sin(a) * rad;
            if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
          }
          g.closePath();
          g.fillStyle = color;
          g.fill();
          g.beginPath();
          g.arc(cx, cy, 3.2, 0, Math.PI * 2);
          g.fillStyle = 'rgba(255,255,255,.85)';
          g.fill();
        });
      }

      const PALETTE = ['#ff6b81', '#ffb347', '#ffe066', '#5ee0a0', '#5aa9ff', '#b388ff', '#ff8ad8'];
      const STAR_COLORS = ['#ffe066', '#ffb347', '#ff8ad8', '#8fd3ff', '#c4b5fd', '#ffffff'];
      const EMOJIS = ['🌸', '🎉', '✨', '🎊', '💖'];

      let running = false;
      let raf = 0;
      let particles = [];
      let last = 0;
      let startTime = 0;
      let dpr = 1;
      let frameCount = 0;
      let avgDelta = 16.7;
      let throttled = false;

      function sizeCanvas() {
        // 装饰性动画不值得为 HiDPI 付 4 倍像素的合成成本：
        // 固定 1x，肉眼几乎无差，但在 2x/3x 屏上能省掉大量全屏合成。
        dpr = 1;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      function addRibbon(x, y, angle, speed) {
        particles.push({
          kind: 'ribbon',
          x: x, y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 8 + Math.random() * 10,
          color: PALETTE[(Math.random() * PALETTE.length) | 0],
          rot: Math.random() * 6.283,
          rotSpeed: (Math.random() - 0.5) * 0.24,
          sway: 0.25 + Math.random() * 0.65,
          phase: Math.random() * 6.283,
          alpha: 1
        });
      }

      function addSprite(kind, img, x, y, vx, vy, size) {
        particles.push({
          kind: kind, img: img,
          x: x, y: y, vx: vx, vy: vy,
          size: size,
          rot: Math.random() * 6.283,
          rotSpeed: (Math.random() - 0.5) * 0.12,
          sway: 0.6 + Math.random() * 0.9,
          phase: Math.random() * 6.283,
          alpha: 1
        });
      }

      function spawn() {
        const w = window.innerWidth, h = window.innerHeight;
        const cores = navigator.hardwareConcurrency || 8;
        const lowEnd = cores <= 4 || w < 900;

        const nCenter = lowEnd ? 26 : 36;
        const nSide = lowEnd ? 6 : 10;
        const nStar = lowEnd ? 16 : 24;
        const nEmoji = lowEnd ? 5 : 10;

        particles = [];

        // 1) 中央礼花：向上炸开
        for (let i = 0; i < nCenter; i++) {
          addRibbon(
            w * 0.5 + (Math.random() - 0.5) * 70,
            h * 0.82,
            -Math.PI / 2 + (Math.random() - 0.5) * 1.7,
            10 + Math.random() * 15
          );
        }

        // 2) 左右两侧礼炮：向内上方喷射，构图更满
        for (let i = 0; i < nSide; i++) {
          addRibbon(-10, h * 0.88, -Math.PI / 2 + 0.35 + Math.random() * 0.55, 17 + Math.random() * 10);
          addRibbon(w + 10, h * 0.88, -Math.PI / 2 - 0.35 - Math.random() * 0.55, 17 + Math.random() * 10);
        }

        // 3) 顶部星屑：慢速飘落，负责“收尾的美感”
        for (let i = 0; i < nStar; i++) {
          addSprite(
            'star',
            starSprite(STAR_COLORS[(Math.random() * STAR_COLORS.length) | 0]),
            Math.random() * w,
            -Math.random() * h * 0.5 - 20,
            (Math.random() - 0.5) * 1.6,
            1.8 + Math.random() * 2.6,
            9 + Math.random() * 12
          );
        }

        // 4) 花瓣 / 彩带 emoji：克制数量，只做点睛
        for (let i = 0; i < nEmoji; i++) {
          addSprite(
            'emoji',
            emojiSprite(EMOJIS[(Math.random() * EMOJIS.length) | 0]),
            Math.random() * w,
            -Math.random() * h * 0.6 - 40,
            (Math.random() - 0.5) * 1.2,
            1.4 + Math.random() * 2.2,
            16 + Math.random() * 14
          );
        }
      }

      function finish() {
        running = false;
        cancelAnimationFrame(raf);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = 'none';
      }

      function frame(now) {
        if (!running) return;
        if (!startTime) { startTime = now; last = now; }

        const rawDelta = now - last;
        let dt = rawDelta / 16.667;
        last = now;
        if (dt > 2.5) dt = 2.5;      // 切后台回来不要瞬移
        if (dt <= 0) dt = 0.001;

        frameCount++;
        // 🩺 自适应降帧：连续偏慢就主动降到 ~30fps，宁可稳，不要一顿一顿的
        avgDelta = avgDelta * 0.9 + Math.min(rawDelta, 80) * 0.1;
        if (frameCount > 20 && !throttled && avgDelta > 19) throttled = true;
        if (throttled && (frameCount & 1)) {
          raf = requestAnimationFrame(frame);
          return;
        }

        const elapsed = now - startTime;
        // 尾段：淡出更快（1.9s 开始，2.35s 结束），并隔帧渲染，
        // 避免全屏半透明粒子和页面重绘抢帧——旧版“最后缓降时卡”就卡在这里。
        const fading = elapsed > 1900;
        if (fading && particles.length < 60 && (frameCount & 1)) {
          raf = requestAnimationFrame(frame);
          return;
        }
        const fade = elapsed < 1900 ? 1 : Math.max(0, 1 - (elapsed - 1900) / 450);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const w = window.innerWidth, h = window.innerHeight;
        const drag = Math.pow(0.992, dt);

        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];

          p.vy += 0.34 * dt;
          p.vx *= drag;
          p.vy *= drag;
          p.x += p.vx * dt + Math.sin((p.y + p.phase) * 0.018) * p.sway * dt;
          p.y += p.vy * dt;
          p.rot += p.rotSpeed * dt;

          // 出界、淡到看不见、或淡出结束：立刻移除（swap-remove，避免数组空洞）
          const alpha = p.alpha * fade;
          if (fade <= 0 || alpha <= 0.22 || p.y > h + 70 || p.x < -90 || p.x > w + 90) {
            particles[i] = particles[particles.length - 1];
            particles.pop();
            continue;
          }

          const cos = Math.cos(p.rot);
          const sin = Math.sin(p.rot);

          if (p.kind === 'ribbon') {
            // 丝带：横向缩放模拟“翻转”，比 3D 便宜得多，观感接近
            const flip = 0.35 + 0.65 * Math.abs(Math.cos(p.phase + elapsed * 0.004));
            const s = dpr;
            ctx.setTransform(cos * s * flip, sin * s * flip, -sin * s, cos * s, p.x * dpr, p.y * dpr);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size * 0.22, p.size, p.size * 0.44);
            ctx.fillStyle = 'rgba(255,255,255,.35)';
            ctx.fillRect(-p.size / 2, -p.size * 0.22, p.size, p.size * 0.12);
          } else {
            const scale = (p.size / SPRITE) * dpr;
            ctx.setTransform(cos * scale, sin * scale, -sin * scale, cos * scale, p.x * dpr, p.y * dpr);
            ctx.globalAlpha = alpha;
            ctx.drawImage(p.img, -SPRITE / 2, -SPRITE / 2);
          }
        }

        if (particles.length === 0) {
          finish();
          return;
        }
        raf = requestAnimationFrame(frame);
      }

      window.triggerConfetti = function () {
        if (running) return;   // 连点不叠加，避免粒子翻倍
        // 自动化验收时可用 ?noconfetti=1 关掉动画，避免 rAF 阻塞无头浏览器
        if (new URLSearchParams(location.search).get('noconfetti') === '1') return;
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        if (!ensureCanvas()) return;

        running = true;
        sizeCanvas();
        spawn();
        canvas.style.display = 'block';
        startTime = 0;
        last = 0;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
      };

      window.addEventListener('resize', function () {
        if (running) sizeCanvas();
      });
    })();

    // 关闭激励弹窗
    window.closeFailModal = function () {
      document.getElementById("failModal").style.display = "none";
    };
