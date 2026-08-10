/* 历史深度复盘：StatsBomb Open Data 真实 XG / 射门分布 / 事件时间线 / 统计 / 阵容 */
(function () {
  const $ = (s) => document.querySelector(s);
  const state = { groups: [], compSel: null };

  /* ---------- 赛事/赛季选择 ---------- */
  async function init() {
    try {
      const res = await fetch('/api/statsbomb/competitions');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      state.groups = data.groups;
      renderCompSelect();
    } catch (e) {
      $('#listNote').textContent = '赛事列表加载失败：' + e.message;
      $('#emptyState').innerHTML = '<p>无法连接 StatsBomb 数据源，请稍后重试</p>';
    }
  }

  function renderCompSelect() {
    const sel = $('#compSelect');
    sel.innerHTML = '<option value="">选择赛事…</option>' +
      state.groups.map((g, i) => `<option value="${i}">${esc(g.name)}（${g.seasons.length} 赛季）</option>`).join('');
    sel.onchange = () => {
      const i = sel.value;
      state.compSel = i === '' ? null : state.groups[i];
      renderSeasonSelect();
      $('#matchList').innerHTML = '';
      $('#emptyState').hidden = false;
      $('#emptyState').innerHTML = '<p>请选择赛季</p>';
      $('#reviewPanel').hidden = true;
    };
  }

  function renderSeasonSelect() {
    const sel = $('#seasonSelect');
    if (!state.compSel) { sel.innerHTML = '<option value="">选择赛季…</option>'; return; }
    sel.innerHTML = '<option value="">选择赛季…</option>' +
      state.compSel.seasons.map((s) => `<option value="${s.competitionId}|${s.id}">${esc(s.name)}</option>`).join('');
    sel.onchange = () => {
      const v = sel.value;
      if (!v) return;
      const [comp, season] = v.split('|');
      loadMatches(comp, season);
    };
  }

  /* ---------- 比赛列表 ---------- */
  async function loadMatches(comp, season) {
    $('#matchList').innerHTML = '<div class="empty-state"><p>加载中…</p></div>';
    $('#emptyState').hidden = true;
    $('#reviewPanel').hidden = true;
    try {
      const res = await fetch(`/api/statsbomb/matches?comp=${encodeURIComponent(comp)}&season=${encodeURIComponent(season)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      renderMatches(data.matches, comp, season);
    } catch (e) {
      $('#matchList').innerHTML = `<div class="empty-state"><p>加载失败：${esc(e.message)}</p></div>`;
    }
  }

  function renderMatches(list, comp, season) {
    const wrap = $('#matchList');
    if (!list.length) { wrap.innerHTML = '<div class="empty-state"><p>该赛季暂无比赛数据</p></div>'; return; }
    wrap.innerHTML = list.map((m) => `
      <div class="match-card sb-card" data-mid="${m.id}" data-comp="${comp}" data-season="${season}">
        <div class="match-meta">
          <span class="match-comp">${esc(m.competition)} · ${esc(m.season)}</span>
          <span class="match-round">${esc(m.date)}</span>
        </div>
        <div class="match-teams">
          <div class="match-team">
            <span class="crest sb-crest">${esc((m.home.zh || m.home.name).slice(0, 1))}</span>
            <span class="match-team-name">${esc(m.home.zh || m.home.name)}</span>
          </div>
          <div class="match-score"><span class="match-score-live">${m.homeScore} : ${m.awayScore}</span></div>
          <div class="match-team away-team">
            <span class="match-team-name">${esc(m.away.zh || m.away.name)}</span>
            <span class="crest sb-crest">${esc((m.away.zh || m.away.name).slice(0, 1))}</span>
          </div>
        </div>
        <div class="sb-enter-row"><span class="live-enter">查看深度复盘 →</span></div>
      </div>`).join('');
    wrap.querySelectorAll('.sb-card').forEach((card) => {
      card.addEventListener('click', () => loadReview(card.dataset.comp, card.dataset.season, card.dataset.mid));
    });
  }

  /* ---------- 深度复盘 ---------- */
  async function loadReview(comp, season, mid) {
    $('#reviewPanel').hidden = true;
    try {
      const res = await fetch(`/api/statsbomb/review?comp=${encodeURIComponent(comp)}&season=${encodeURIComponent(season)}&match=${encodeURIComponent(mid)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      renderReview(data.review);
      $('#reviewPanel').hidden = false;
      $('#reviewPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      alert('复盘加载失败：' + e.message);
    }
  }

  function renderReview(r) {
    $('#revComp').textContent = `${r.competition} · ${r.season}`;
    $('#revDate').textContent = r.date || '';
    $('#revHomeName').textContent = r.home.zh;
    $('#revAwayName').textContent = r.away.zh;
    $('#revScore').textContent = `${r.home.score} : ${r.away.score}`;

    /* XG 对比条 */
    const total = r.home.xg + r.away.xg || 1;
    const wH = ((r.home.xg / total) * 100).toFixed(1);
    const wA = ((r.away.xg / total) * 100).toFixed(1);
    $('#revXg').innerHTML = `<div class="xg-row">
      <span class="xg-tag home-tag">${r.home.xg.toFixed(2)}</span>
      <div class="xg-track">
        <div class="xg-bar home" style="width:${wH}%"></div>
        <div class="xg-bar away" style="width:${wA}%"></div>
        <div class="xg-divider"></div>
      </div>
      <span class="xg-tag away-tag">${r.away.xg.toFixed(2)}</span>
    </div>
    <div class="xg-caption">真实 XG（StatsBomb 事件数据）</div>`;

    renderShotMap(r);
    renderStats(r);
    renderTimeline(r);
    renderLineups(r);
  }

  /* ---------- 射门分布（120x80 球场 → 600x400 SVG） ---------- */
  function renderShotMap(r) {
    const W = 600, H = 400;
    const PITCH = `<rect x="0" y="0" width="${W}" height="${H}" fill="var(--bg-soft)" stroke="var(--line-strong)"/>
      <line x1="${W / 2}" y1="0" x2="${W / 2}" y2="${H}" stroke="var(--line-strong)" stroke-width="1.5" stroke-dasharray="6 5"/>
      <circle cx="${W / 2}" cy="${H / 2}" r="48" fill="none" stroke="var(--line-strong)" stroke-width="1.5"/>
      <rect x="0" y="52" width="88" height="${H - 104}" fill="none" stroke="var(--line-strong)"/>
      <rect x="${W - 88}" y="52" width="88" height="${H - 104}" fill="none" stroke="var(--line-strong)"/>
      <rect x="0" y="130" width="34" height="${H - 260}" fill="none" stroke="var(--line-strong)"/>
      <rect x="${W - 34}" y="130" width="34" height="${H - 260}" fill="none" stroke="var(--line-strong)"/>
      <rect x="-6" y="160" width="12" height="80" fill="var(--line-strong)"/>
      <rect x="${W - 6}" y="160" width="12" height="80" fill="var(--line-strong)"/>`;
    const dots = r.shots.map((s) => {
      const isHome = s.team === 'home';
      const x = isHome ? s.loc[0] : 120 - s.loc[0];
      const y = isHome ? s.loc[1] : 80 - s.loc[1];
      const sx = (x / 120) * W;
      const sy = ((80 - y) / 80) * H;
      const rad = 4 + Math.min(s.xg, 0.9) * 16;
      return `<circle cx="${sx}" cy="${sy}" r="${rad.toFixed(1)}" class="shot-dot ${s.goal ? 'goal' : ''} ${isHome ? 'home' : 'away'}"
        data-tip="${esc(s.player)} · ${s.xg.toFixed(3)} · ${s.outcome || ''}（${s.minute}'）"></circle>`;
    }).join('');
    $('#shotMap').innerHTML = PITCH + dots;
  }

  /* ---------- 统计 ---------- */
  function renderStats(r) {
    const row = (label, h, a) => `<div class="stat-row">
      <span class="stat-val home">${h}</span>
      <span class="stat-label">${label}</span>
      <span class="stat-val away">${a}</span>
    </div>`;
    $('#revStats').innerHTML =
      row('XG', r.home.xg.toFixed(2), r.away.xg.toFixed(2)) +
      row('控球率', r.home.possession + '%', r.away.possession + '%') +
      row('射门', r.home.shots, r.away.shots) +
      row('射正', r.home.sot, r.away.sot) +
      row('犯规', r.home.fouls, r.away.fouls) +
      row('黄/红牌', r.home.cards, r.away.cards);
  }

  /* ---------- 事件时间线 ---------- */
  function renderTimeline(r) {
    if (!r.timeline.length) {
      $('#revTimeline').innerHTML = '<div class="event-item"><span class="event-detail" style="color:var(--ink-3)">暂无关键事件</span></div>';
      return;
    }
    const tag = (t) => t === 'goal'
      ? '<span class="event-card goal">进球</span>'
      : t === 'card'
        ? '<span class="event-card yellow">牌</span>'
        : '<span class="event-card sub">换人</span>';
    $('#revTimeline').innerHTML = r.timeline.map((e) => `
      <div class="event-item">
        <span class="event-min">${e.minute}'</span>
        <span class="event-detail">${tag(e.type)}${esc(e.detail)}</span>
      </div>`).join('');
  }

  /* ---------- 阵容 ---------- */
  function lineupCol(lu, name) {
    if (!lu || !lu.list || !lu.list.length) {
      return `<div class="lineup-col">
        <div class="lineup-col-head">${esc(name)}</div>
        <div class="empty-state" style="padding:20px 0">暂无阵容数据</div>
      </div>`;
    }
    return `<div class="lineup-col">
      <div class="lineup-col-head">${esc(name)} <small>${esc(lu.formation || '')}</small></div>
      <ul class="lineup-bench">
        ${lu.list.map(([name2, num, p]) => `<li><span class="lu-num">${num}</span><span class="lu-name">${esc(name2)}</span><span class="lu-pos">${esc(p.pos)}</span></li>`).join('')}
      </ul>
    </div>`;
  }

  function renderLineups(r) {
    $('#revLineups').innerHTML = lineupCol(r.lineups.home, r.home.zh) + lineupCol(r.lineups.away, r.away.zh);
  }

  /* 射门点悬浮提示 */
  document.addEventListener('mouseover', (e) => {
    const d = e.target.closest('.shot-dot');
    if (!d) return;
    const tip = document.createElement('div');
    tip.className = 'shot-tip';
    tip.textContent = d.dataset.tip;
    tip.style.left = '0';
    tip.style.top = '0';
    d.parentNode.appendChild(tip);
    const rect = d.getBoundingClientRect();
    const pr = d.parentNode.getBoundingClientRect();
    tip.style.left = (rect.left - pr.left + rect.width / 2 - 70) + 'px';
    tip.style.top = (rect.top - pr.top - 26) + 'px';
    d._tip = tip;
  });
  document.addEventListener('mouseout', (e) => {
    const d = e.target.closest('.shot-dot');
    if (d && d._tip) { d._tip.remove(); d._tip = null; }
  });

  init();
})();
