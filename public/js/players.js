/* 球员数据页：FBref 英超 2025-26 赛季快照 */
(function () {
  const state = { pos: '', sort: 'score', q: '' };
  const $ = (id) => document.getElementById(id);
  let debounceTimer = null;

  const fmt = (v, d = 0) => (v == null || isNaN(v) ? '--' : Number(v).toFixed(d));
  const fmtMin = (v) => (v ? String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '--');

  /* 评分颜色 */
  function scoreColor(s) {
    if (s >= 85) return '#2e7d32';
    if (s >= 70) return '#2e7d32';
    if (s >= 55) return '#e65100';
    return '#9e9e9e';
  }

  async function load() {
    const qs = new URLSearchParams({ sort: state.sort, limit: 300 });
    if (state.pos) qs.set('pos', state.pos);
    if (state.q) qs.set('q', state.q);
    try {
      const res = await fetch(`/api/players?${qs}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      $('pageSub').textContent = `${data.league} ${data.season} 赛季 · 数据来源 ${data.source} · 更新于 ${new Date(data.updatedAt).toLocaleString('zh-CN')}`;
      $('playersMeta').textContent = `共 ${data.total} 名球员，当前显示 ${data.filtered} 名（按${sortName(state.sort)}排序）`;
      render(data.players);
      $('playersNote').textContent = '综合评分由进球、助攻、效率与出场时间加权计算；跑动进阶数据（Progressive Carries 等）在 FBref 免费版不可用。';
    } catch (err) {
      $('playersBody').innerHTML = '';
      $('playersEmpty').hidden = false;
      $('playersEmpty').textContent = `加载失败：${err.message}`;
    }
  }

  function sortName(s) {
    return { score: '综合评分', gls: '进球', ast: '助攻', ga: '进球+助攻', mp: '出场', min: '出场时间', sh90: '每90分钟射门', sot: '射正' }[s] || s;
  }

  function render(list) {
    const body = $('playersBody');
    $('playersEmpty').hidden = list.length > 0;
    body.innerHTML = list.map((p) => `
      <tr>
        <td><span class="score-badge" style="background:${scoreColor(p.score)}">${p.score}</span></td>
        <td class="p-name">${esc(p.name)}</td>
        <td>${esc(p.nation)}</td>
        <td>${esc(p.pos)}</td>
        <td class="p-squad">${esc(p.squad)}</td>
        <td>${p.age}</td>
        <td>${p.mp}</td>
        <td>${p.starts}</td>
        <td>${fmtMin(p.min)}</td>
        <td class="p-hot">${p.gls}</td>
        <td class="p-hot">${p.ast}</td>
        <td>${p.ga}</td>
        <td>${p.sh || '--'}</td>
        <td>${p.sot || '--'}</td>
        <td>${fmt(p.sotPct, 1)}%</td>
        <td>${fmt(p.sh90, 2)}</td>
      </tr>`).join('');
  }

  /* 事件 */
  $('posFilters').addEventListener('click', (e) => {
    const chip = e.target.closest('.filter-chip');
    if (!chip) return;
    document.querySelectorAll('#posFilters .filter-chip').forEach((c) => c.classList.toggle('active', c === chip));
    state.pos = chip.dataset.pos;
    load();
  });

  $('sortSelect').addEventListener('change', (e) => { state.sort = e.target.value; load(); });

  $('searchInput').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => { state.q = e.target.value.trim(); load(); }, 300);
  });

  load();
})();
