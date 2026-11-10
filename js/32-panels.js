    /* ============ 面板显示 / 隐藏 ============ */
    function showPanel(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.add('show');
      const reopen = document.getElementById(id === 'leftPanel' ? 'reopenLeft' : 'reopenRight');
      if (reopen) reopen.style.display = 'none';
      setTimeout(() => { if (map) map.invalidateSize(); }, 420);
    }
    function hidePanel(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('show');
      const reopen = document.getElementById(id === 'leftPanel' ? 'reopenLeft' : 'reopenRight');
      if (reopen) reopen.style.display = 'block';
      setTimeout(() => { if (map) map.invalidateSize(); }, 420);
    }
    window.showPanel = showPanel;
    window.hidePanel = hidePanel;

    document.getElementById('reopenLeft').onclick = () => showPanel('leftPanel');
    document.getElementById('reopenRight').onclick = () => showPanel('rightPanel');
