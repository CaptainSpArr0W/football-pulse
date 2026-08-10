/* 球队详情页：档案、阵容、近六场、舆论、相关赛事实时数据 */
(function () {
  const params = new URLSearchParams(location.search);
  const teamId = params.get('team');
  const $ = (sel) => document.querySelector(sel);

  if (!teamId) {
    location.href = '/';
    return;
  }

  const sentimentMap = { positive: '正面', negative: '负面', neutral: '中性' };

  /* ---------- 横幅 ---------- */
  function renderBanner(team) {
    const bg = $('#bannerBg');
    bg.style.background = `linear-gradient(140deg, ${team.color} 0%, #0d1117 82%)`;

    if (team.crest) {
      $('#teamCrest').innerHTML = `<img src="${esc(team.crest)}" alt="${esc(team.name)}" class="team-crest-img" loading="lazy">`;
    } else {
      $('#teamCrest').textContent = team.short;
      $('#teamCrest').style.background = `linear-gradient(140deg, ${team.color}, ${team.color2})`;
    }
    $('#teamName').textContent = team.name;
    $('#teamEn').textContent = team.en.toUpperCase() + ' · ' + team.short;

    $('#teamFacts').innerHTML = [
      ['联赛', team.league],
      ['主教练', team.coach],
      ['主场', team.stadium],
      ['城市', team.city],
      ['常用阵型', team.formation],
    ].map(([k, v]) => `<li><span>${k}</span>${esc(v)}</li>`).join('');

    $('#formChips').innerHTML = [...team.form]
      .map((r) => `<span class="form-chip ${formResultClass(r)}">${r === 'W' ? '胜' : r === 'D' ? '平' : '负'}</span>`)
      .join('');
  }

  /* ---------- 相关赛事 ---------- */
  function renderTeamMatches(team) {
    const section = $('#teamLiveSection');
    const wrap = $('#teamMatches');
    if (!team.matches || !team.matches.length) { section.hidden = true; return; }
    section.hidden = false;
    wrap.innerHTML = team.matches.map((m, i) => matchCard(m, i)).join('');
  }

  /* ---------- 近六场 ---------- */
  function renderRecent(team) {
    $('#recentGrid').innerHTML = team.recent.map((r, i) => {
      const total = r.xg + r.xga || 1;
      const wXg = ((r.xg / total) * 100).toFixed(1);
      const wXga = ((r.xga / total) * 100).toFixed(1);
      const isHome = r.home ? '主场' : '客场';
      return `<div class="recent-card" style="animation-delay:${i * 60}ms">
        <div class="recent-head">
          <span>${esc(r.comp || '')} · ${isHome}</span>
          <span class="recent-result ${formResultClass(r.result)}">${r.result === 'W' ? '胜' : r.result === 'D' ? '平' : '负'}</span>
        </div>
        <div class="recent-opp">vs ${esc(r.opponent)}</div>
        <div class="recent-score">${r.gf} : ${r.ga}</div>
        <div class="xg-compare">
          <div class="xg-compare-line">
            <span>XG ${r.xg.toFixed(1)}</span>
            <div class="xg-compare-track"><div class="xg-compare-fill" style="width:${wXg}%"></div></div>
          </div>
          <div class="xg-compare-line away-line">
            <span>${r.xga.toFixed(1)} XGA</span>
            <div class="xg-compare-track"><div class="xg-compare-fill" style="width:${wXga}%"></div></div>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  /* ---------- 阵容 ---------- */
  function renderLineup(team) {
    const hasLineup = team.lineup && team.lineup.length;
    if (!hasLineup) {
      $('#formationNote').textContent = '暂无首发阵容数据';
      $('#lineupList').innerHTML = '<li style="color:var(--ink-3);font-size:12.5px">暂无阵容数据，接入真实数据源后可查看</li>';
      return;
    }
    $('#formationNote').textContent = `阵型 ${team.formation} · 首发 11 人（GK 门将）`;
    const svg = $('#pitchSvg');
    const color = team.color;

    /* 数据坐标（0-100）映射到球场 viewBox（500x640，门将在下方、进攻朝上） */
    const marks = team.lineup.map(([name, num, p]) => {
      const x = (p.x / 100) * 500;
      const y = 640 * (1 - p.y / 100);
      return `<g class="player-dot">
        <circle cx="${x}" cy="${y}" r="17" fill="${color}"></circle>
        <text x="${x}" y="${y - 0.5}" class="p-num">${num}</text>
        <text x="${x}" y="${y + 36}" class="p-name">${esc(name)}</text>
        <text x="${x}" y="${y + 52}" class="p-pos">${p.pos}</text>
      </g>`;
    }).join('');
    svg.insertAdjacentHTML('beforeend', marks);

    $('#lineupList').innerHTML = team.lineup.map(([name, num, p]) => `
      <li>
        <span class="lu-num">${num}</span>
        <span class="lu-name">${esc(name)}</span>
        <span class="lu-pos">${p.pos}</span>
      </li>`).join('');
  }

  /* ---------- 舆论 ---------- */
  function renderNews(team) {
    if (!team.news || !team.news.length) {
      $('#newsList').innerHTML = '<div class="empty-state">暂无舆论数据，接入真实数据源后可查看</div>';
      return;
    }
    $('#newsList').innerHTML = team.news.map((n, i) => `
      <article class="news-card" style="animation-delay:${i * 50}ms">
        <div class="news-top">
          <span class="news-sentiment ${esc(n.sentiment)}">${sentimentMap[n.sentiment] || '中性'}</span>
          <span class="news-source">${esc(n.source)}</span>
          <span class="news-time">${esc(n.time)}</span>
        </div>
        <h3 class="news-title">${esc(n.title)}</h3>
        <p class="news-summary">${esc(n.summary)}</p>
      </article>`).join('');
  }

  /* ---------- WS 实时更新 ---------- */
  function applyLiveUpdate(data) {
    const card = document.querySelector(`[data-match-row="${data.matchId}"]`);
    if (!card) return;
    const scoreEl = card.querySelector('[data-role="score"]');
    if (scoreEl) {
      const liveText = `<span class="match-score-live">${data.score.home} : ${data.score.away}</span>`;
      if (scoreEl.innerHTML !== liveText) {
        scoreEl.innerHTML = liveText;
        scoreEl.classList.remove('score-flash');
        void scoreEl.offsetWidth;
        scoreEl.classList.add('score-flash');
      }
    }
    const statusEl = card.querySelector('.match-status-live');
    if (statusEl) statusEl.innerHTML = data.status === 'finished' ? '已完场' : `进行中 ${data.minute}&#39;`;
    const oddsNote = card.querySelector('.odds-updated');
    if (oddsNote && data.status !== 'finished') oddsNote.textContent = '实时更新';
  }

  /* ---------- 初始化 ---------- */
  async function init() {
    try {
      const res = await fetch(`/api/team/${encodeURIComponent(teamId)}`);
      if (!res.ok) throw new Error('not found');
      const { team } = await res.json();
      document.title = `${team.name} · 足球脉动`;
      renderBanner(team);
      renderTeamMatches(team);
      renderRecent(team);
      renderLineup(team);
      renderNews(team);
      connectWS(applyLiveUpdate);
    } catch (_) {
      $('#teamName').textContent = '球队不存在';
      $('#teamEn').textContent = '请返回赛程页重新选择';
    }
  }

  init();
})();
