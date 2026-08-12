/* 首页：真实赛事一览 + 实时比分（数据来自 football-data.org） */
(function () {
  const BIG_FIVE = ['英超', '西甲', '德甲', '意甲', '法甲'];

  const state = {
    overview: null,
    selectedDate: null,
    selectedComp: null, // null = 全部赛事
  };

  const $ = (sel) => document.querySelector(sel);

  /* ---------- 标签点击翻转反馈（事件委托，覆盖动态渲染的标签） ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target && e.target.nodeType === 1 ? e.target : (e.target && e.target.parentElement);
    if (!el || typeof el.closest !== 'function') return;
    const btn = el.closest('.filter-chip, .standings-tab, .date-btn, .refresh-btn');
    if (!btn) return;
    const flip = (n) => { n.classList.remove('tap-flip'); void n.offsetWidth; n.classList.add('tap-flip'); };
    // 点击处理可能重建标签 DOM（筛选/积分榜重渲染）；先记录类型，下一轮事件循环按类型精确定位补动画
    const key = btn.dataset.comp !== undefined ? btn.dataset.comp
      : (btn.dataset.date !== undefined ? btn.dataset.date
        : (btn.dataset.league !== undefined ? btn.dataset.league : ''));
    const kind = btn.classList.contains('filter-chip') ? 'filter-chip'
      : btn.classList.contains('standings-tab') ? 'standings-tab'
        : btn.classList.contains('date-btn') ? 'date-btn' : '';
    flip(btn);
    if (key !== '' && kind) {
      const sel = '.' + kind + '[data-' + (kind === 'standings-tab' ? 'league' : kind === 'date-btn' ? 'date' : 'comp') + '="' + CSS.escape(key) + '"]';
      setTimeout(() => { const c = document.querySelector(sel); if (c && !c.classList.contains('tap-flip')) flip(c); }, 0);
    }
  });
  document.addEventListener('animationend', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('tap-flip')) {
      e.target.classList.remove('tap-flip');
    }
  });

  /* ---------- 日期工具 ---------- */
  function shiftDate(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    const p = (x) => String(x).padStart(2, '0');
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
  }
  function weekdayOf(dateStr) {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('zh-CN', { weekday: 'long' });
  }
  function monthDay(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  /* ---------- 渲染日期导航（昨天/今天/明天 + 更多日期下拉） ---------- */
  function renderDateNav() {
    const nav = $('#dateNav');
    const today = state.overview.today;
    const dates = state.overview.dates || [];

    nav.innerHTML = [-1, 0, 1]
      .map((off) => {
        const d = shiftDate(today, off);
        const isActive = state.selectedDate === d;
        const hasMatch = dates.includes(d);
        return `<button class="date-btn${isActive ? ' is-today' : ''}" data-date="${d}" ${hasMatch ? '' : 'disabled'}>
          ${['昨天', '今天', '明天'][off + 1]}
        </button>`;
      })
      .join('') + '<select class="date-select" id="dateSelect" aria-label="选择其他日期"></select>';

    const others = dates.filter((d) => ![-1, 0, 1].includes((new Date(d) - new Date(today)) / 86400000));
    const sel = nav.querySelector('#dateSelect');
    sel.innerHTML = '<option value="">更多日期</option>' +
      others.map((d) => `<option value="${d}"${state.selectedDate === d ? ' selected' : ''}>${monthDay(d)} ${weekdayOf(d)}</option>`).join('');
    sel.onchange = () => {
      state.selectedDate = sel.value || state.overview.today;
      state.selectedComp = null;
      render();
      renderDateNav();
    };

    nav.querySelectorAll('.date-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedDate = btn.dataset.date;
        state.selectedComp = null;
        render();
        renderDateNav();
      });
    });
  }

  /* ---------- 联赛筛选：全部 + 五大联赛标签 + 更多联赛下拉 ---------- */
  function renderFilters() {
    const wrap = $('#compFilters');
    wrap.innerHTML = '<button class="filter-chip' + (state.selectedComp === null ? ' active' : '') + '" data-comp="__ALL__">全部</button>' +
      BIG_FIVE
        .map((c) => `<button class="filter-chip${state.selectedComp === c ? ' active' : ''}" data-comp="${esc(c)}">${esc(c)}</button>`)
        .join('');
    wrap.querySelectorAll('.filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        if (chip.dataset.comp === '__ALL__') {
          state.selectedComp = null;
        } else {
          state.selectedComp = state.selectedComp === chip.dataset.comp ? null : chip.dataset.comp;
        }
        syncSelect();
        renderFilters();
        renderMatchList();
        renderLive();
      });
    });
  }

  function renderSelect() {
    const sel = $('#compSelect');
    const others = (state.overview.competitions || []).filter((c) => !BIG_FIVE.includes(c));
    // 仅有五大联赛时隐藏"更多联赛"下拉
    sel.style.display = others.length ? '' : 'none';
    sel.innerHTML = '<option value="">更多联赛</option>' +
      others.map((c) => `<option value="${esc(c)}"${state.selectedComp === c ? ' selected' : ''}>${esc(c)}</option>`).join('');
    sel.onchange = () => {
      state.selectedComp = sel.value || null;
      syncFilters();
      renderMatchList();
      renderLive();
      renderHead();
    };
  }

  function syncFilters() {
    $('#compFilters').querySelectorAll('.filter-chip').forEach((chip) => {
      const active = chip.dataset.comp === '__ALL__'
        ? state.selectedComp === null
        : chip.dataset.comp === state.selectedComp;
      chip.classList.toggle('active', active);
    });
  }

  function syncSelect() {
    const sel = $('#compSelect');
    if (BIG_FIVE.includes(state.selectedComp)) sel.value = '';
  }

  /* ---------- 页面标题 ---------- */
  function renderHead() {
    const isToday = state.selectedDate === state.overview.today;
    const titleComp = state.selectedComp ? `${state.selectedComp} · ` : '';
    $('#pageTitle').textContent = isToday ? `${titleComp}今日赛程` : `${titleComp}${monthDay(state.selectedDate)} ${weekdayOf(state.selectedDate)}`;
    const total = (state.overview.byDate[state.selectedDate] || []).length;
    $('#pageSub').textContent = `数据来源 football-data.org · 当日共 ${total} 场比赛`;
    $('#listNote').textContent = '点击球队名称查看阵容与近期战绩';
  }

  function visibleMatches() {
    const list = state.overview.byDate[state.selectedDate] || [];
    if (!state.selectedComp) return list; // 未筛选 = 全部联赛
    return list.filter((m) => m.competition === state.selectedComp);
  }

  /* ---------- 比赛列表渲染 ---------- */
  let predMap = {};
  async function loadPredictions() {
    try {
      const res = await fetch('/api/predictions');
      const j = await res.json();
      predMap = {};
      (j.predictions || []).forEach((p) => { predMap[p.id] = p.pred; });
      window.__predMap = predMap; // 供预览弹窗（实力分区下）读取
    } catch (_) { predMap = {}; window.__predMap = {}; }
  }
  function renderMatchList() {
    const list = visibleMatches();
    const wrap = $('#matchList');
    wrap.innerHTML = list.map((m, i) => matchCard({ ...m, pred: predMap[m.id] }, i)).join('');
    const empty = $('#emptyState');
    empty.hidden = list.length > 0;
    empty.innerHTML = list.length
      ? ''
      : `<p>${(state.overview.dates || []).length === 0
        ? '暂无比赛数据：请确认已配置 football-data.org API 密钥，或当前时间段该赛事未进行'
        : '该日期暂无赛事安排'}</p>`;
  }

  /* ---------- 直播区（跟随当前联赛筛选） ---------- */
  function liveMatches() {
    const today = state.overview.byDate[state.overview.today] || [];
    return today.filter((m) => m.status === 'live')
      .filter((m) => !state.selectedComp || m.competition === state.selectedComp);
  }

  function liveCard(match) {
    const oppBadge = match.oppXg
      ? '<span class="opp-badge opp-xg">⚡ 好机会 · xG异动</span>'
      : match.oppHc
        ? '<span class="opp-badge opp-hc">⚡ 好机会 · 盘口异动</span>'
        : '';
    return `<div class="live-card${(match.oppXg || match.oppHc) ? ' is-opp' : ''}" id="live-${match.id}" data-match="${match.id}">
      <div class="live-card-top">
        <span class="live-competition">${esc(match.competition)} · ${esc(match.round)}</span>
        <span class="live-minute" data-role="minute">${match.minute != null ? match.minute + '&#39;' : '进行中'}</span>
        ${oppBadge}
      </div>
      <div class="live-teams">
        <div class="live-team">
          ${crestHtml(match.home, 38)}
          <span class="live-team-name">${teamLink(match.home)}</span>
        </div>
        <div class="live-score">
          <span class="home-score" data-role="hs">${match.score.home}</span>
          <span> : </span>
          <span class="away-score" data-role="as">${match.score.away}</span>
        </div>
        <div class="live-team away">
          <span class="live-team-name">${teamLink(match.away)}</span>
          ${crestHtml(match.away, 38)}
        </div>
      </div>
      <div class="live-enter-row">
        <a class="live-enter" href="/match.html?match=${match.id}">查看比赛详情 →</a>
      </div>
    </div>`;
  }

  function renderLive() {
    const section = $('#liveSection');
    const grid = $('#liveGrid');
    const list = liveMatches();
    if (!list.length) { section.hidden = true; return; }
    section.hidden = false;
    grid.innerHTML = list.map(liveCard).join('');
  }

  /* ---------- WS 增量更新 ---------- */
  function applyLiveUpdate(data) {
    const card = document.getElementById(`live-${data.matchId}`);
    if (card) {
      const minute = card.querySelector('[data-role="minute"]');
      if (minute) minute.textContent = data.status === 'finished' ? '完场' : `${data.minute}'`;
      const hs = card.querySelector('[data-role="hs"]');
      const as = card.querySelector('[data-role="as"]');
      if (hs && Number(hs.textContent) !== data.score.home) flash(hs);
      if (as && Number(as.textContent) !== data.score.away) flash(as);
      if (hs) hs.textContent = data.score.home;
      if (as) as.textContent = data.score.away;
    }

    /* 同步更新比赛列表中的该场比分 */
    const listCard = document.querySelector(`[data-match-row="${data.matchId}"]`);
    if (listCard) {
      const scoreEl = listCard.querySelector('[data-role="score"]');
      if (scoreEl) {
        const liveText = `<span class="match-score-live">${data.score.home} : ${data.score.away}</span>`;
        if (scoreEl.innerHTML !== liveText) {
          scoreEl.innerHTML = liveText;
          flash(scoreEl);
        }
      }
      const statusEl = listCard.querySelector('.match-status-live');
      if (statusEl) statusEl.innerHTML = data.status === 'finished' ? '已完场' : `进行中 ${data.minute}&#39;`;
    }
  }

  function flash(el) {
    el.classList.remove('score-flash');
    void el.offsetWidth;
    el.classList.add('score-flash');
    setTimeout(() => el.classList.remove('score-flash'), 750);
  }

  /* ---------- 好机会模块 ---------- */
  function oppMatches() {
    const out = [];
    for (const d of state.overview.dates || []) {
      for (const m of state.overview.byDate[d] || []) {
        if (m.oppXg || m.oppHc) out.push(m);
      }
    }
    return out;
  }
  function renderOpp() {
    const sec = $('#oppSection');
    const list = oppMatches();
    sec.hidden = list.length === 0;
    $('#oppList').innerHTML = list.map((m) => {
      const tag = m.oppXg
        ? '<span class="opp-badge opp-xg">xG异动</span>'
        : '<span class="opp-badge opp-hc">盘口异动</span>';
      return `<a class="opp-item" href="/match.html?match=${m.id}">
        ${crestHtml(m.home, 22)} <b>${esc(m.home.name)}</b>
        <span class="opp-vs">vs</span>
        <b>${esc(m.away.name)}</b> ${crestHtml(m.away, 22)}
        <span class="opp-comp">${esc(m.competition)}</span>${tag}</a>`;
    }).join('');
  }
  /* WS：好机会高亮/取消 */
  function applyOpp(data) {
    const set = (el, isLive) => {
      if (!el) return;
      el.classList.toggle('is-opp', data.on);
      const old = el.querySelector('.opp-badge');
      if (old) old.remove();
      if (data.on) {
        const badge = document.createElement('span');
        badge.className = 'opp-badge ' + (data.kind === 'xg' ? 'opp-xg' : 'opp-hc');
        badge.textContent = data.kind === 'xg' ? '⚡ 好机会 · xG异动' : '⚡ 好机会 · 盘口异动';
        const box = isLive ? el.querySelector('.live-card-top') : el.querySelector('.match-meta');
        if (box) box.appendChild(badge);
      }
    };
    set(document.getElementById(`live-${data.matchId}`), true);
    set(document.querySelector(`[data-match-row="${data.matchId}"]`), false);
    renderOpp();
  }

  /* ---------- 数据刷新（fetcher 同步完成后） ---------- */
  async function refetchOverview() {
    try {
      const res = await fetch('/api/overview');
      const ov = await res.json();
      const prevDate = state.selectedDate;
      state.overview = ov;
      state.selectedDate = (ov.dates || []).includes(prevDate) ? prevDate : ov.today;
      await loadPredictions();
      render();
    } catch (_) { /* 保留当前视图 */ }
  }

  /* ---------- 五大联赛积分榜（免费源） ---------- */
  let standings = null;
  let standingsTab = '英超';
  async function loadStandings(force) {
    try {
      const q = force ? '?force=1' : '';
      const res = await fetch('/api/standings' + q);
      const j = await res.json();
      standings = j.leagues || [];
      const sec = $('#standingsSection');
      if (standings.length) {
        sec.hidden = false;
        renderStandings();
      }
    } catch (_) { /* 静默：无积分榜不影响主页 */ }
  }
  function renderStandings() {
    const tabs = $('#standingsTabs');
    tabs.innerHTML = standings.map((l) =>
      `<button class="standings-tab${l.league === standingsTab ? ' active' : ''}" data-league="${esc(l.league)}">${esc(l.league)}</button>`).join('');
    tabs.querySelectorAll('.standings-tab').forEach((btn) => {
      btn.addEventListener('click', () => { standingsTab = btn.dataset.league; renderStandings(); });
    });
    const cur = standings.find((l) => l.league === standingsTab) || standings[0];
    const wrap = $('#standingsWrap');
    if (!cur || !cur.rows.length) {
      wrap.innerHTML = '<p class="empty-state">该联赛暂无积分榜数据</p>';
      return;
    }
    const rows = cur.rows.map((r) => {
      const linkId = r.storeId ? r.storeId : (r.fmId ? 'fm:' + r.fmId : '');
      const teamHtml = linkId
        ? `<a href="/team.html?team=${encodeURIComponent(linkId)}" class="st-team-link" title="查看球队详情">${esc(r.name)}</a>`
        : esc(r.name);
      return `<tr class="qual-${(r.qualColor || '').replace('#', '') || 'none'}">
        <td class="st-rank">${r.rank}</td>
        <td class="st-team">${teamHtml}</td>
        <td>${r.played}</td><td>${r.win}</td><td>${r.draw}</td><td>${r.loss}</td>
        <td>${r.gf}</td><td>${r.ga}</td><td class="st-gd">${r.gd > 0 ? '+' : ''}${r.gd}</td>
        <td class="st-pts">${r.pts}</td>
      </tr>`;
    }).join('');
    wrap.innerHTML = `<table class="standings-table">
      <thead><tr><th>#</th><th>球队</th><th>赛</th><th>胜</th><th>平</th><th>负</th><th>进</th><th>失</th><th>净</th><th>积分</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <p class="standings-note">数据来源 ${cur.source}</p>`;
  }

  /* ---------- 手动刷新 ---------- */
  let refreshing = false;
  let refreshCoolDown = 0;
  async function refreshData() {
    const btn = $('#refreshBtn');
    const txt = $('#refreshTxt');
    if (refreshing) return;
    if (Date.now() < refreshCoolDown) {
      txt.textContent = '操作太频繁';
      setTimeout(() => { txt.textContent = '刷新'; }, 1500);
      return;
    }
    refreshing = true;
    btn.disabled = true;
    btn.classList.add('spinning');
    txt.textContent = '刷新中…';
    try {
      const res = await fetch('/api/refresh', { method: 'POST' });
      if (res.status === 409) {
        txt.textContent = '同步中，稍候';
      } else if (res.ok) {
        const r = await res.json();
        txt.textContent = `已更新 ${r.updated} 场`;
        await refetchOverview();
        renderDateNav();
        renderFilters();
        renderSelect();
        loadStandings(true);
        refreshCoolDown = Date.now() + 30 * 1000;
      } else {
        txt.textContent = '刷新失败';
      }
    } catch (_) {
      txt.textContent = '网络错误';
    }
    btn.classList.remove('spinning');
    btn.disabled = false;
    setTimeout(() => { txt.textContent = '刷新'; }, 2500);
  }

  /* ---------- 初始化 ---------- */
  async function init() {
    try {
      const res = await fetch('/api/overview');
      state.overview = await res.json();
    } catch (_) {
      $('#pageSub').textContent = '无法连接服务器，请确认已启动后端（npm start）';
      return;
    }
    state.selectedDate = state.overview.today;
    renderDateNav();
    renderFilters();
    renderSelect();
    await loadPredictions();
    render();
    $('#refreshBtn').addEventListener('click', refreshData);
    loadStandings(false);
    connectWS((data) => {
      if (data.type === 'opportunity') { applyOpp(data); return; }
      if (data.type === 'data-refreshed') { refetchOverview(); return; }
      applyLiveUpdate(data);
    });
  }

  function render() {
    renderHead();
    renderMatchList();
    renderLive();
    renderOpp();
  }

  init();
})();
