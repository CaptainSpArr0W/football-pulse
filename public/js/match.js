/* 比赛实时数据页：比分/XG/统计/事件实时推送 + 赔率 + 阵容 + 近况 */
(function () {
  const params = new URLSearchParams(location.search);
  const matchId = params.get('match');
  const $ = (sel) => document.querySelector(sel);

  if (!matchId) {
    location.href = '/';
    return;
  }

  let current = null;

  /* ---------- 工具 ---------- */
  function crestBig(team) {
    if (team && team.crest) {
      return `<img class="crest-big" src="${esc(team.crest)}" alt="${esc(team.name)}" loading="lazy">`;
    }
    return `<span class="crest-big" style="background:linear-gradient(140deg, ${esc(team.color)}, ${esc(team.color2)})">${esc(team.short)}</span>`;
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

  /* ---------- 横幅 ---------- */
  function renderHero(m) {
    const isLive = m.status === 'live';
    const isFinished = m.status === 'finished';
    $('#heroComp').textContent = `${m.competition} · ${m.round}`;
    const status = isLive ? `${m.minute}'` : isFinished ? '完场' : `${m.kickoff} 开球`;
    $('#heroStatus').textContent = status;
    $('#heroStatus').className = 'hero-status' + (isLive ? ' is-live' : '');

    /* 订阅按钮 */
    const heroSub = $('#heroSub');
    heroSub.hidden = false;
    heroSub.dataset.sub = m.id;
    heroSub.classList.toggle('on', isSubscribed(m.id));
    heroSub.textContent = isSubscribed(m.id) ? '★ 已订阅' : '☆ 订阅';

    $('#homeCrest').outerHTML = crestBig(m.home);
    $('#awayCrest').outerHTML = crestBig(m.away);
    $('#homeName').textContent = m.home.name;
    $('#awayName').textContent = m.away.name;
    $('#homeName').innerHTML = teamLink(m.home);
    $('#awayName').innerHTML = teamLink(m.away);

    const score = isLive || isFinished ? `${m.score.home} : ${m.score.away}` : 'VS';
    $('#heroScore').textContent = score;
    $('#heroScore').innerHTML = isLive
      ? `<span data-role="hs">${m.score.home}</span> : <span data-role="as">${m.score.away}</span>`
      : score;

    if (isLive && m.xg && m.xg.home + m.xg.away > 0) renderHeroXg(m);
    else $('#heroXg').innerHTML = '';
  }

  function renderHeroXg(m) {
    const total = m.xg.home + m.xg.away || 1;
    $('#heroXg').innerHTML = `<div class="xg-row">
      <span class="xg-tag home-tag" data-role="xgh">${m.xg.home.toFixed(2)}</span>
      <div class="xg-track">
        <div class="xg-bar home" data-role="barh" style="width:${((m.xg.home / total) * 100).toFixed(1)}%"></div>
        <div class="xg-bar away" data-role="bara" style="width:${((m.xg.away / total) * 100).toFixed(1)}%"></div>
        <div class="xg-divider"></div>
      </div>
      <span class="xg-tag away-tag" data-role="xga">${m.xg.away.toFixed(2)}</span>
    </div>
    <div class="xg-caption">预期进球 XG · 实时更新</div>`;
  }

  /* ---------- 实时统计 ---------- */
  const STAT_DEFS = [
    ['shots', '射门'],
    ['sot', '射正'],
    ['possession', '控球率', true],
    ['corners', '角球'],
    ['yellowCards', '黄牌'],
    ['redCards', '红牌'],
    ['fouls', '犯规'],
  ];

  function renderStats(m) {
    const s = m.stats;
    if (!s) {
      $('#statsGrid').innerHTML = '<div class="empty-state">暂无实时统计（免费档 API 不提供）</div>';
      return;
    }
    $('#statsGrid').innerHTML = STAT_DEFS.map(([key, label, isPct]) => {
      const hv = s[key] && s[key].home;
      const av = s[key] && s[key].away;
      const h = isPct ? `${hv}%` : hv;
      const a = isPct ? `${av}%` : av;
      return `<div class="stat-row">
        <span class="stat-val home" data-stat="${key}-h">${h}</span>
        <span class="stat-label">${label}</span>
        <span class="stat-val away" data-stat="${key}-a">${a}</span>
      </div>`;
    }).join('');
  }

  function renderEvents(m) {
    $('#matchEvents').innerHTML = m.events.length
      ? [...m.events].reverse().map(eventHtml).join('')
      : '<div class="event-item"><span class="event-detail" style="color:var(--ink-3)">暂无关键事件</span></div>';
  }

  /* ---------- 中场战报 ---------- */
  function showHalfReport(report) {
    const box = $('#halfReport');
    if (!report) { box.hidden = true; box.innerHTML = ''; return; }
    const s = report.stats;
    box.hidden = false;
    box.innerHTML = `<div class="report-head">⚽ 中场战报 · 45'</div>
      <p class="report-text">${esc(report.text)}</p>
      <div class="report-stats">
        <span>XG ${report.xg.home.toFixed(2)}-${report.xg.away.toFixed(2)}</span>
        <span>射门 ${s.shots.home}-${s.shots.away}</span>
        <span>射正 ${s.sot.home}-${s.sot.away}</span>
        <span>角球 ${s.corners.home}-${s.corners.away}</span>
        <span>黄牌 ${s.yellowCards.home}-${s.yellowCards.away}</span>
      </div>`;
  }

  function renderHalfReport(m) {
    showHalfReport(m.halfReport);
  }

  /* ---------- 赔率（无真实赔率数据时隐藏整块） ---------- */
  function renderOdds(m) {
    const wrap = $('#oddsWrap');
    wrap.innerHTML = oddsTable(m);
    const hasOdds = m.odds && ((m.odds.europe && m.odds.europe.length) || (m.odds.asian && m.odds.asian.length)
      || (m.odds.total && m.odds.total.length) || (m.odds.corners && m.odds.corners.length));
    const section = wrap.closest('section');
    if (section) section.hidden = !hasOdds;
  }

  /* ---------- 双方阵容 ---------- */
  function lineupCol(team) {
    const list = team.lineup && team.lineup.length
      ? team.lineup.map(([name, num, p]) => `
        <li>
          <span class="lu-num">${num}</span>
          <span class="lu-name">${esc(name)}</span>
          <span class="lu-pos">${p.pos}</span>
        </li>`).join('')
      : '<li style="color:var(--ink-3);font-size:12.5px">暂无阵容数据</li>';
    return `<div class="lineup-col">
      <div class="lineup-col-head">${crestHtml(team)} ${esc(team.name)} <small>${esc(team.formation || '')}</small></div>
      <ul class="lineup-bench">${list}</ul>
    </div>`;
  }

  function renderLineups(m) {
    $('#lineupCompare').innerHTML = lineupCol(m.homeTeam) + lineupCol(m.awayTeam);
  }

  /* ---------- 近六场 ---------- */
  function recentCol(team) {
    const recent = team.recent || [];
    if (!recent.length) {
      return `<div class="recent-col">
        <div class="lineup-col-head">${crestHtml(team)} ${esc(team.name)}</div>
        <div class="empty-state" style="margin:8px 0">暂无近期战绩（免费档 API 未提供该队数据）</div>
      </div>`;
    }
    const form = [...(team.form || '')].map((r) => {
      const txt = r === 'W' ? '胜' : r === 'D' ? '平' : '负';
      return `<span class="form-chip ${formResultClass(r)}">${txt}</span>`;
    }).join('');
    const rows = recent.map((r) => {
      const hs = r.home ? '主' : '客';
      return `<div class="recent-line">
        <span class="recent-line-date">${esc(r.date)}</span>
        <span class="recent-line-opp">vs ${esc(r.opponent)}</span>
        <span class="recent-line-score">${r.gf} : ${r.ga}</span>
        <span class="recent-line-result ${formResultClass(r.result)}">${hs}·${r.result === 'W' ? '胜' : r.result === 'D' ? '平' : '负'}</span>
      </div>`;
    }).join('');
    return `<div class="recent-col">
      <div class="lineup-col-head">${crestHtml(team)} ${esc(team.name)}</div>
      <div class="recent-form">${form}</div>
      <div class="recent-lines">${rows}</div>
    </div>`;
  }

  function renderRecent(m) {
    $('#recentCompare').innerHTML = recentCol(m.homeTeam) + recentCol(m.awayTeam);
  }

  /* ---------- WS 实时更新 ---------- */
  function applyLiveUpdate(data) {
    if (!current || data.matchId !== current.id) return;

    const heroStatus = $('#heroStatus');
    if (heroStatus) heroStatus.textContent = data.status === 'finished' ? '完场' : `${data.minute}'`;

    const hs = document.querySelector('[data-role="hs"]');
    const as = document.querySelector('[data-role="as"]');
    if (hs) {
      if (Number(hs.textContent) !== data.score.home) flash(hs);
      hs.textContent = data.score.home;
    }
    if (as) {
      if (Number(as.textContent) !== data.score.away) flash(as);
      as.textContent = data.score.away;
    }

    const total = data.xg.home + data.xg.away || 1;
    const barh = document.querySelector('[data-role="barh"]');
    const bara = document.querySelector('[data-role="bara"]');
    if (barh) barh.style.width = `${((data.xg.home / total) * 100).toFixed(1)}%`;
    if (bara) bara.style.width = `${((data.xg.away / total) * 100).toFixed(1)}%`;
    const xgh = document.querySelector('[data-role="xgh"]');
    const xga = document.querySelector('[data-role="xga"]');
    if (xgh) xgh.textContent = data.xg.home.toFixed(2);
    if (xga) xga.textContent = data.xg.away.toFixed(2);

    if (data.stats) {
      for (const [key, label, isPct] of STAT_DEFS) {
        const h = document.querySelector(`[data-stat="${key}-h"]`);
        const a = document.querySelector(`[data-stat="${key}-a"]`);
        if (h) h.textContent = isPct ? `${data.stats[key].home}%` : data.stats[key].home;
        if (a) a.textContent = isPct ? `${data.stats[key].away}%` : data.stats[key].away;
      }
    }
    if (data.events && data.events.length) {
      $('#matchEvents').innerHTML = [...data.events].reverse().map(eventHtml).join('');
    }
    if (data.status === 'finished') {
      $('#liveDataSection').hidden = true;
      heroStatus.textContent = '完场';
    }
  }

  function flash(el) {
    el.classList.remove('score-flash');
    void el.offsetWidth;
    el.classList.add('score-flash');
    setTimeout(() => el.classList.remove('score-flash'), 750);
  }

  /* ---------- 初始化 ---------- */
  async function fetchMatch() {
    const res = await fetch(`/api/match/${encodeURIComponent(matchId)}`);
    if (!res.ok) throw new Error('not found');
    return (await res.json()).match;
  }

  function renderMatch(match) {
    current = match;
    document.title = `${match.home.name} vs ${match.away.name} · 足球脉动`;
    renderHero(match);
    $('#liveDataSection').hidden = match.status !== 'live';
    if (match.status === 'live') {
      renderStats(match);
      renderEvents(match);
      renderHalfReport(match);
    }
    renderOdds(match);
    renderLineups(match);
    renderRecent(match);
  }

  async function init() {
    try {
      renderMatch(await fetchMatch());
      connectWS((data) => {
        if (data.type === 'data-refreshed') {
          fetchMatch().then(renderMatch).catch(() => {});
          return;
        }
        if (data.type === 'half-time-report') { showHalfReport(data.report); return; }
        applyLiveUpdate(data);
      });
    } catch (_) {
      $('#heroComp').textContent = '比赛不存在';
      $('#heroStatus').textContent = '请返回赛程页重新选择';
    }
  }

  init();
})();
