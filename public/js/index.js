/* 首页：真实赛事一览 + 实时比分（数据来自 football-data.org） */
(function () {
  const BIG_FIVE = ['英超', '西甲', '德甲', '意甲', '法甲'];

  const state = {
    overview: null,
    selectedDate: null,
    selectedComp: null, // null = 五大联赛全部
  };

  const $ = (sel) => document.querySelector(sel);

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

  /* ---------- 联赛筛选：五大联赛标签 + 其他联赛下拉 ---------- */
  function renderFilters() {
    const wrap = $('#compFilters');
    wrap.innerHTML = BIG_FIVE
      .map((c) => `<button class="filter-chip${state.selectedComp === c ? ' active' : ''}" data-comp="${esc(c)}">${esc(c)}</button>`)
      .join('');
    wrap.querySelectorAll('.filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        state.selectedComp = state.selectedComp === chip.dataset.comp ? null : chip.dataset.comp;
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
      chip.classList.toggle('active', chip.dataset.comp === state.selectedComp);
    });
  }

  function syncSelect() {
    const sel = $('#compSelect');
    if (BIG_FIVE.includes(state.selectedComp)) sel.value = '';
  }

  /* ---------- 页面标题 ---------- */
  function renderHead() {
    const isToday = state.selectedDate === state.overview.today;
    const titleComp = state.selectedComp ? `${state.selectedComp} · ` : '五大联赛 · ';
    $('#pageTitle').textContent = isToday ? `${titleComp}今日赛程` : `${titleComp}${monthDay(state.selectedDate)} ${weekdayOf(state.selectedDate)}`;
    const total = (state.overview.byDate[state.selectedDate] || []).length;
    $('#pageSub').textContent = `数据来源 football-data.org · 当日共 ${total} 场比赛`;
    $('#listNote').textContent = '点击球队名称查看阵容与近期战绩';
  }

  function visibleMatches() {
    const list = state.overview.byDate[state.selectedDate] || [];
    if (!state.selectedComp) return list.filter((m) => BIG_FIVE.includes(m.competition));
    return list.filter((m) => m.competition === state.selectedComp);
  }

  /* ---------- 比赛列表渲染 ---------- */
  function renderMatchList() {
    const list = visibleMatches();
    const wrap = $('#matchList');
    wrap.innerHTML = list.map((m, i) => matchCard(m, i)).join('');
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
    return `<div class="live-card" id="live-${match.id}" data-match="${match.id}">
      <div class="live-card-top">
        <span class="live-competition">${esc(match.competition)} · ${esc(match.round)}</span>
        <span class="live-minute" data-role="minute">${match.minute != null ? match.minute + '&#39;' : '进行中'}</span>
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

  /* ---------- 数据刷新（fetcher 同步完成后） ---------- */
  async function refetchOverview() {
    try {
      const res = await fetch('/api/overview');
      const ov = await res.json();
      const prevDate = state.selectedDate;
      state.overview = ov;
      state.selectedDate = (ov.dates || []).includes(prevDate) ? prevDate : ov.today;
      render();
    } catch (_) { /* 保留当前视图 */ }
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
    render();
    connectWS((data) => {
      if (data.type === 'data-refreshed') { refetchOverview(); return; }
      applyLiveUpdate(data);
    });
  }

  function render() {
    renderHead();
    renderMatchList();
    renderLive();
  }

  init();
})();
