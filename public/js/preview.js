/* 比赛预览弹窗：点击比赛卡片弹出（实力分区 + 近六场进/失球 + 首发） */
(function () {
  const TIER_COLOR = { S: '#d50000', A: '#e65100', B: '#f9a825', C: '#2e7d32', D: '#1565c0', E: '#616161' };
  const TIER_ZH = { S: 'S·争冠组', A: 'A·欧冠组', B: 'B·欧战组', C: 'C·中上区', D: 'D·中游区', E: 'E·保级组' };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function crestHtml(t, size) {
    if (t && t.crest) return `<img class="pv-crest" src="${esc(t.crest)}" alt="" width="${size || 44}" height="${size || 44}" onerror="this.style.display='none'">`;
    return `<span class="pv-crest pv-crest-fallback" style="background:${t && t.color || '#5c6bc0'}">${esc((t && t.short || '?').slice(0, 3))}</span>`;
  }

  function build() {
    let el = document.getElementById('previewModal');
    if (el) return el;
    const wrap = document.createElement('div');
    wrap.id = 'previewModal';
    wrap.className = 'pv-modal';
    wrap.hidden = true;
    wrap.innerHTML = `
      <div class="pv-backdrop" data-pv-close></div>
      <div class="pv-card" role="dialog" aria-modal="true">
        <button class="pv-close" data-pv-close aria-label="关闭">×</button>
        <div class="pv-body" id="previewBody"><p class="pv-loading">加载中…</p></div>
      </div>`;
    document.body.appendChild(wrap);
    wrap.addEventListener('click', (e) => {
      if (e.target.closest('[data-pv-close]')) close();
      else if (e.target.closest('a[data-pv-detail]')) { /* 详情跳转由默认行为处理 */ }
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    return wrap;
  }

  function open() {
    const m = build();
    m.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function close() {
    const m = document.getElementById('previewModal');
    if (m) m.hidden = true;
    document.body.style.overflow = '';
  }
  window.closeMatchPreview = close;

  /* ---------- 渲染 ---------- */

  function teamRow(side, t) {
    return `<div class="pv-team">
      <div class="pv-team-head">
        ${crestHtml(t, 40)}
        <div class="pv-team-name">${esc(t.name || '')}</div>
      </div>
      <div class="pv-tag">${esc(t.league || '')}</div>
    </div>`;
  }

  function powerHtml(side, p) {
    if (!p || !p.tier) return `<div class="pv-cell pv-empty">暂无实力数据</div>`;
    return `<div class="pv-cell pv-power">
      <span class="pv-tier" style="background:${TIER_COLOR[p.tier]}">${p.tier}</span>
      <span class="pv-tier-name">${TIER_ZH[p.tier] || p.tierZh || ''}</span>
      <span class="pv-sub">上赛季 ${p.league} 第${p.rank}名 · ${p.pts}分</span>
    </div>`;
  }

  function formHtml(f) {
    if (!f) return `<div class="pv-cell pv-empty">暂无近六场数据</div>`;
    const gd = f.gd >= 0 ? '+' + f.gd : String(f.gd);
    return `<div class="pv-cell pv-form">
      <div class="pv-form-main">近${f.played}场 进 <b>${f.gf}</b> 失 <b>${f.ga}</b></div>
      <div class="pv-sub">净胜 ${gd} · 状态串 ${esc(f.form || '—')}</div>
    </div>`;
  }

  function lineupHtml(t, l) {
    if (!l || !l.players || !l.players.length) {
      return `<div class="pv-cell pv-empty">首发名单开赛前更新</div>`;
    }
    const rows = l.players.map((pl) => {
      const name = Array.isArray(pl) ? pl[0] : (pl.name || '');
      const pos = Array.isArray(pl) && pl[2] ? (pl[2].pos || '') : (pl.pos || '');
      return `<li><span class="pv-pos">${esc(pos)}</span>${esc(name)}</li>`;
    }).join('');
    return `<div class="pv-cell pv-lineup">
      <div class="pv-sub">${l.formation ? '阵型 ' + esc(l.formation) : ''}</div>
      <ul class="pv-lineup-list">${rows}</ul>
    </div>`;
  }

  /* 本场 xG */
  function xgHtml(m, side) {
    const hasXg = m.xg && (Number(m.xg.home) > 0 || Number(m.xg.away) > 0);
    if (!hasXg) return `<div class="pv-cell pv-empty">暂无 xG 数据</div>`;
    const mine = Number(m.xg[side]);
    return `<div class="pv-cell pv-xg">
      <div class="pv-xg-item"><span class="pv-xg-label">xG 预期进球</span><b>${mine.toFixed(2)}</b></div>
    </div>`;
  }

  function section(title, note, homeHtml, awayHtml) {
    return `<div class="pv-section">
      <div class="pv-section-title"><b>${esc(title)}</b><span class="pv-note">${note}</span></div>
      <div class="pv-grid">${homeHtml}${awayHtml}</div>
    </div>`;
  }

  /* 本场预测（模型 + 赔率融合），展示在实力分区下方 */
  function predHtml(matchId) {
    const pred = (window.__predMap || {})[matchId];
    if (!pred) return '';
    const pct = (v) => (v == null ? '--' : `${v}%`);
    const bar = (v) => `<span class="pred-bar"><i style="width:${Math.min(v, 100)}%"></i></span>`;
    const x12 = (pred.x12 || []).map((x) => `
      <span class="pred-cell${x.label === pred.x12Pick.label ? ' is-pick' : ''}">
        <em>${esc(x.label)}</em><b>${pct(x.prob)}</b>${bar(x.prob)}
      </span>`).join('');
    const fusedTip = pred.fused ? '已融合最新赔率' : '模型初值';
    return `<div class="pv-section">
      <div class="pv-section-title"><b>模型预测</b><span class="pv-note">Dixon-Coles · ${fusedTip} · 期望 ${pred.expGoals.home}:${pred.expGoals.away}</span></div>
      <div class="pv-pred">
        <div class="pv-pred-label">胜平负 · 推荐 <b>${esc(pred.x12Pick.label)}</b> ${pct(pred.x12Pick.prob)}</div>
        <div class="pred-x12">${x12}</div>
        <div class="pv-pred-two">
          <div class="pv-pred-cell">大小球（${pred.ou.line}）· 推荐 <b>${esc(pred.ou.pick)}</b> ${pct(pred.ou.pick === '大' ? pred.ou.over : pred.ou.under)}</div>
          <div class="pv-pred-cell">亚盘（${esc(pred.asian.lineText)}）· 推荐 <b>${esc(pred.asian.pick)}</b> ${pct(pred.asian.pick === '主队' ? pred.asian.homeCover : pred.asian.awayCover)}</div>
        </div>
      </div>
    </div>`;
  }

  function render(data) {
    const m = data.match;
    if (!m) return;
    const body = document.getElementById('previewBody');
    const score = m.status === 'upcoming'
      ? '<span class="pv-vs">VS</span>'
      : `<b class="pv-score">${m.score.home} : ${m.score.away}</b>`;
    const lineupNote = data.lineups && data.lineups.predicted
      ? '预测首发 · 开赛前更新'
      : (m.status === 'live' ? '实时首发' : '本场实际首发');
    body.innerHTML = `
      <div class="pv-head">
        <div class="pv-meta"><span class="pv-comp">${esc(m.competition)}</span> · ${esc(m.round || '')} · ${esc(m.date)} ${esc(m.kickoff)}</div>
        <div class="pv-teams">
          <div class="pv-team-side">${crestHtml(m.homeTeam, 44)}<div class="pv-team-name">${esc(m.homeTeam.name)}</div></div>
          <div class="pv-center">${score}<div class="pv-status">${m.status === 'finished' ? '已结束' : m.status === 'live' ? '进行中' : '未开赛'}</div></div>
          <div class="pv-team-side">${crestHtml(m.awayTeam, 44)}<div class="pv-team-name">${esc(m.awayTeam.name)}</div></div>
        </div>
      </div>
      ${section('实力分区', '基于上赛季联赛排名（ESPN）', powerHtml('home', data.power.home), powerHtml('away', data.power.away))}
      ${section('xG', '本场预期进球（Fotmob）', xgHtml(m, 'home'), xgHtml(m, 'away'))}
      ${section('近六场综合', '两队在各自联赛近六场进/失球合计', formHtml(data.form.home), formHtml(data.form.away))}
      ${section('首发阵容', lineupNote, lineupHtml(m.homeTeam, data.lineups.home), lineupHtml(m.awayTeam, data.lineups.away))}
      <div class="pv-foot">
        <a class="pv-detail-btn" data-pv-detail href="/match.html?match=${encodeURIComponent(m.id)}">查看比赛详情 →</a>
        <span class="pv-note">数据来源：ESPN 积分榜 · football-data / Fotmob 近况与阵容</span>
      </div>`;
  }

  async function openMatchPreview(matchId) {
    open();
    const body = document.getElementById('previewBody');
    body.innerHTML = '<p class="pv-loading">加载比赛预览…</p>';
    try {
      const res = await fetch(`/api/match/preview/${encodeURIComponent(matchId)}`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      render(await res.json());
    } catch (_) {
      body.innerHTML = '<p class="pv-loading">预览加载失败，请稍后重试</p>';
    }
  }
  window.openMatchPreview = openMatchPreview;

  /* 事件委托：点击比赛卡弹出预览（订阅按钮已阻止冒泡） */
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.match-clickable[data-match]');
    if (!card) return;
    openMatchPreview(card.dataset.match);
  });
})();
