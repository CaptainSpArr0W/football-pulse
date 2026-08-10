/* 首页：赛事一览 + 赔率 + 实时 XG */
(function () {
  const BIG_FIVE = ['英超', '西甲', '德甲', '意甲', '法甲'];

  const state = {
    overview: null,
    selectedDate: null,
    selectedComp: null, // null = 五大联赛全部
  };

  const $ = (sel) => document.querySelector(sel);

  /* ---------- 日期工具 ---------- */
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
    const dates = state.overview.dates;
    const todayIdx = dates.indexOf(state.overview.today);
    const labels = ['昨天', '今天', '明天'];

    nav.innerHTML = [-1, 0, 1]
      .map((off) => {
        const d = dates[todayIdx + off];
        if (!d) return '';
        const isActive = state.selectedDate === d;
        return `<button class="date-btn${isActive ? ' is-today' : ''}" data-date="${d}">${labels[off + 1]}</button>`;
      })
      .join('') + '<select class="date-select" id="dateSelect" aria-label="选择其他日期"></select>';

    const others = dates.filter((_, i) => ![-1, 0, 1].includes(i - todayIdx));
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
        // 点击已选中的联赛取消选择，回到五大联赛全部
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
    const others = state.overview.competitions.filter((c) => !BIG_FIVE.includes(c));
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

  /* 选中其他联赛时，取消五大联赛标签高亮 */
  function syncFilters() {
    $('#compFilters').querySelectorAll('.filter-chip').forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.comp === state.selectedComp);
    });
  }

  /* 选中五大联赛标签时，下拉回到占位 */
  function syncSelect() {
    const sel = $('#compSelect');
    if (BIG_FIVE.includes(state.selectedComp)) sel.value = '';
  }

  /* ---------- 页面标题 ---------- */
  function renderHead() {
    const isToday = state.selectedDate === state.overview.today;
    const titleComp = state.selectedComp ? `${state.selectedComp} · ` : '五大联赛 · ';
    $('#pageTitle').textContent = isToday ? `${titleComp}今日赛程` : `${titleComp}${monthDay(state.selectedDate)} ${weekdayOf(state.selectedDate)}`;
    $('#pageSub').textContent = `赛程覆盖过去3天至未来7天 · 共 ${visibleMatches().length} 场比赛 · 赔率数据实时更新`;
    $('#listNote').textContent = '点击球队名称查看阵容、近况与舆论分析';
  }

  function visibleMatches() {
    const list = state.overview.byDate[state.selectedDate] || [];
    if (!state.selectedComp) return list.filter((m) => BIG_FIVE.includes(m.competition));
    return list.filter((m) => m.competition === state.selectedComp);
  }

  /* ---------- 比赛列表渲染 ---------- */
  function renderMatchList() {
    const list = visibleMatches().filter(
      (m) => state.selectedComp === '全部' || m.competition === state.selectedComp,
    );
    const wrap = $('#matchList');
    wrap.innerHTML = list.map((m, i) => matchCard(m, i)).join('');
    $('#emptyState').hidden = list.length > 0;
  }

  /* ---------- 直播区（跟随当前联赛筛选） ---------- */
  function liveMatches() {
    const today = state.overview.byDate[state.overview.today] || [];
    return today.filter((m) => m.status === 'live')
      .filter((m) => !state.selectedComp || m.competition === state.selectedComp);
  }

  function eventHtml(ev) {
    const badge = ev.type === 'goal'
      ? `<span class="event-score-badge">${ev.homeScore}-${ev.awayScore}</span>`
      : '';
    const tag = ev.type === 'goal'
      ? '<span class="event-card goal">进球</span>'
      : ev.type === 'penalty'
        ? '<span class="event-card penalty">点球</span>'
        : ev.type === 'own-goal'
          ? '<span class="event-card own-goal">乌龙</span>'
          : ev.type === 'yellow'
            ? '<span class="event-card yellow">黄牌</span>'
            : ev.type === 'red'
              ? '<span class="event-card red">红牌</span>'
              : ev.type === 'corner'
                ? '<span class="event-card corner">角球</span>'
                : ev.type === 'sub'
                  ? '<span class="event-card sub">换人</span>'
                  : '';
    return `<div class="event-item${ev.type === 'goal' ? ' event-type-goal' : ''}">
      <span class="event-min">${ev.minute}&#39;</span>
      <span class="event-detail">${tag}${esc(ev.detail)}${badge}</span>
    </div>`;
  }

  function reportInner(r) {
    const s = r.stats;
    return `<div class="live-report-head">⚽ 中场战报</div>
      <p class="live-report-text">${esc(r.text)}</p>
      <div class="live-report-stats">XG ${r.xg.home.toFixed(2)}-${r.xg.away.toFixed(2)} · 射门 ${s.shots.home}-${s.shots.away} · 角球 ${s.corners.home}-${s.corners.away} · 黄牌 ${s.yellowCards.home}-${s.yellowCards.away}</div>`;
  }

  function liveCard(match) {
    const total = match.xg.home + match.xg.away || 1;
    const wHome = (match.xg.home / total) * 100;
    const wAway = (match.xg.away / total) * 100;
    const events = [...match.events].reverse().map(eventHtml).join('');

    return `<div class="live-card" id="live-${match.id}" data-match="${match.id}">
      <div class="live-card-top">
        <span class="live-competition">${esc(match.competition)} · ${esc(match.round)}</span>
        <span class="live-minute" data-role="minute">${match.minute}&#39;</span>
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
      <div class="live-xg">
        <div class="xg-row">
          <span class="xg-tag home-tag" data-role="xgh">${match.xg.home.toFixed(2)}</span>
          <div class="xg-track">
            <div class="xg-bar home" data-role="barh" style="width:${wHome.toFixed(1)}%"></div>
            <div class="xg-bar away" data-role="bara" style="width:${wAway.toFixed(1)}%"></div>
            <div class="xg-divider"></div>
          </div>
          <span class="xg-tag away-tag" data-role="xga">${match.xg.away.toFixed(2)}</span>
        </div>
      </div>
      <div class="live-report" id="report-${match.id}" data-role="report"${match.halfReport ? '' : ' hidden'}>
        ${match.halfReport ? reportInner(match.halfReport) : ''}
      </div>
      <div class="live-events">
        <div class="live-events-title">关键事件</div>
        <div data-role="events">${events || '<div class="event-item"><span class="event-detail" style="color:var(--ink-3)">比赛即将开始</span></div>'}</div>
      </div>
      <div class="live-enter-row">
        <a class="live-enter" href="/match.html?match=${match.id}">查看实时数据 →</a>
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

      const total = data.xg.home + data.xg.away || 1;
      const bh = card.querySelector('[data-role="barh"]');
      const ba = card.querySelector('[data-role="bara"]');
      if (bh) bh.style.width = `${((data.xg.home / total) * 100).toFixed(1)}%`;
      if (ba) ba.style.width = `${((data.xg.away / total) * 100).toFixed(1)}%`;
      card.querySelector('[data-role="xgh"]').textContent = data.xg.home.toFixed(2);
      card.querySelector('[data-role="xga"]').textContent = data.xg.away.toFixed(2);
      if (data.events && data.events.length) {
        card.querySelector('[data-role="events"]').innerHTML = [...data.events].reverse().map(eventHtml).join('');
      }
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

  /* ---------- 首页直播卡：中场战报 ---------- */
  function showLiveReport(matchId, report) {
    const box = document.getElementById(`report-${matchId}`);
    if (box) {
      box.hidden = false;
      box.innerHTML = reportInner(report);
    }
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
      if (data.type === 'half-time-report') { showLiveReport(data.matchId, data.report); return; }
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
