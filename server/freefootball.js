/*
 * 免费足球数据源（GitHub 轮子同款方案的 Node 实现）
 * - Fotmob（主源，实测可用）：/api/data/ 前缀的非官方 JSON 接口
 *   （对应 GitHub 轮子 pseudo-r/Public-FotMob-API 与 maxencelobry/fotmob，已跟进其接口迁移）
 * - Sofascore（备源）：api.sofascore.com/api/v1/ 非官方 JSON 接口
 *   （对应 probberechts/soccerdata 的 Sofascore reader；部分网络/区域会 403，按需降级）
 * - FBref（备源）：fbref.com 页面 HTML 解析（对应 probberechts/soccerdata 的 FBref reader；
 *   部分网络有 Cloudflare 验证，按需降级）
 *
 * 所有请求经多级缓存（httpcache）缓存，全部异常静默降级：任一源失败不影响站点其它功能。
 */
const httpcache = require('./httpcache');
const cheerio = require('cheerio');
const TEAM_NAMES_ZH = require('./data/team-names');

const UA = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'accept': '*/*',
  'accept-language': 'en-US,en;q=0.9',
  'referer': 'https://www.fotmob.com/',
};

function log(msg) { console.log(`[free] ${msg}`); }

async function fetchJson(url, headers, ttlMs, force) {
  const key = 'free:' + url;
  if (!force && ttlMs > 0) {
    const c = httpcache.get(key);
    if (c !== undefined) return c;
  }
  const res = await fetch(url, { headers: headers || UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  if (ttlMs > 0) httpcache.set(key, j, ttlMs);
  return j;
}

async function fetchText(url, headers, ttlMs, force) {
  const key = 'free:' + url;
  if (!force && ttlMs > 0) {
    const c = httpcache.get(key);
    if (c !== undefined) return c;
  }
  const res = await fetch(url, { headers: headers || UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const t = await res.text();
  if (ttlMs > 0) httpcache.set(key, t, ttlMs);
  return t;
}

/* ---------- Fotmob（主源） ---------- */

const FOTMOB = 'https://www.fotmob.com/api/data';
const FOTMOB_LEAGUES = { 英超: 47, 西甲: 87, 德甲: 54, 意甲: 55, 法甲: 53 };

function fotmobGet(path, ttlMs, force) {
  return fetchJson(FOTMOB + path, UA, ttlMs, force);
}

/* 积分榜（Fotmob）：table[0].data.table.all 为全部球队行 */
async function fotmobStandings(leagueName, force) {
  const id = FOTMOB_LEAGUES[leagueName];
  if (!id) return null;
  const j = await fotmobGet(`/leagues?id=${id}`, 6 * 3600 * 1000, force);
  const d = j.table && j.table[0] && j.table[0].data;
  const rows = d && d.table && d.table.all;
  if (!Array.isArray(rows)) return null;
  const out = rows.map((r) => {
    const ss = String(r.scoresStr || '').split('-');
    const gf = parseInt(ss[0], 10) || 0;
    const ga = parseInt(ss[1], 10) || 0;
    return {
      rank: r.idx,
      name: TEAM_NAMES_ZH.zhTeamName(r.name, r.shortName) || r.name || r.shortName,
      en: r.name || '',
      played: r.played || 0,
      win: r.wins || 0,
      draw: r.draws || 0,
      loss: r.losses || 0,
      gf, ga,
      gd: r.goalConDiff != null ? r.goalConDiff : gf - ga,
      pts: r.pts || 0,
      qualColor: r.qualColor || '',
    };
  });
  return { source: 'fotmob', league: leagueName, rows: out };
}

/* 按日期赛程（Fotmob）：返回五大联赛比赛（国家代码 + 联赛名双重匹配，避免英冠等被误判为英超） */
const BIG_FIVE_CC = {
  ENG: { name: '英超', league: /^premier league$/i },
  ESP: { name: '西甲', league: /^la liga$/i },
  GER: { name: '德甲', league: /^bundesliga$/i },
  ITA: { name: '意甲', league: /^serie a$/i },
  FRA: { name: '法甲', league: /^ligue 1$/i },
};
async function fotmobMatchesByDate(dateStr, force) {
  const ymd = dateStr.replace(/-/g, '');
  const j = await fotmobGet(`/matches?date=${ymd}`, 60 * 60 * 1000, force);
  const out = [];
  for (const l of j.leagues || []) {
    const cc = BIG_FIVE_CC[l.ccode];
    if (!cc || !cc.league.test(l.name) || !Array.isArray(l.matches)) continue;
    for (const m of l.matches) {
      const score = m.status && m.status.scoreStr;
      out.push({
        source: 'fotmob', id: m.id, competition: cc.name,
        kickoffTs: m.status && m.status.utcTime ? Date.parse(m.status.utcTime) : 0,
        home: m.home && m.home.name, away: m.away && m.away.name,
        status: m.status && m.status.finished ? 'finished' : (m.status && m.status.live ? 'live' : 'upcoming'),
        scoreStr: score || null,
      });
    }
  }
  return out;
}

/* 单场详情（Fotmob）：阵容 / 统计 / 事件 */
async function fotmobMatchDetails(matchId, status, force) {
  const ttl = status === 'live' ? 5 * 60 * 1000 : 30 * 60 * 1000;
  const j = await fotmobGet(`/matchDetails?matchId=${matchId}`, ttl, force);
  const c = j.content || {};
  const stats = mapFotmobStats(c.stats);
  let xg = null;
  if (stats && stats._xg) { xg = stats._xg; delete stats._xg; }
  return {
    stats,
    lineup: mapFotmobLineup(c.lineup),
    events: mapFotmobEvents(c.matchFacts),
    xg,
  };
}

/* 用赛程接口按队名反查 Fotmob matchId */
async function fotmobMatchIdByTeams(dateStr, homeName, awayName, force) {
  const list = await fotmobMatchesByDate(dateStr, force);
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
  const hn = norm(homeName), an = norm(awayName);
  const hit = list.find((m) => (hn && an) && (norm(m.home).includes(hn) || hn.includes(norm(m.home))) && (norm(m.away).includes(an) || an.includes(norm(m.away))));
  return hit ? hit.id : null;
}

/* Fotmob 统计 → 站点 stats 格式（结构：stats.Periods.All.stats[].stats[]，值为 [home, away]） */
function mapFotmobStats(statsObj) {
  if (!statsObj || !statsObj.Periods || !statsObj.Periods.All) return null;
  const out = {};
  const map = {
    'ball possession': 'possession',
    'total shots': 'shots', 'shots': 'shots',
    'total shots on target': 'sot', 'shots on target': 'sot', 'shots on goal': 'sot',
    'corner kicks': 'corners', 'total corners': 'corners',
    'yellow cards': 'yellowCards', 'red cards': 'redCards',
    'fouls': 'fouls', 'fouls committed': 'fouls',
    'expected goals (xg)': '_xg',
  };
  const walk = (groups) => {
    for (const g of groups || []) {
      if (!g || !Array.isArray(g.stats)) continue;
      const isLeaf = typeof g.stats[0] === 'number' || typeof g.stats[0] === 'string';
      if (isLeaf) {
        const key = map[String(g.title || '').toLowerCase()];
        if (key) {
          const hv = parseFloat(String(g.stats[0]).replace('%', '').replace(/,/g, ''));
          const av = parseFloat(String(g.stats[1]).replace('%', '').replace(/,/g, ''));
          if (isFinite(hv) && isFinite(av) && !(key in out)) out[key] = { home: hv, away: av };
        }
      } else {
        walk(g.stats);
      }
    }
  };
  walk(statsObj.Periods.All.stats);
  return Object.keys(out).length ? out : null;
}

/* Fotmob 阵容 → 站点 lineup 格式 [[name, num, {pos}], ...]（结构：lineup.homeTeam.starters） */
function mapFotmobLineup(lineup) {
  if (!lineup || !lineup.homeTeam || !Array.isArray(lineup.homeTeam.starters)) return null;
  const build = (team) => (team && team.starters || []).map((p) => {
    const pos = p.positionId === 1 ? 'GK' : p.positionId === 2 ? 'DF' : p.positionId === 3 ? 'MF' : 'FW';
    return [p.name || '', p.shirtNumber != null ? p.shirtNumber : '', { pos }];
  });
  const home = build(lineup.homeTeam);
  const away = build(lineup.awayTeam);
  if (!home.length && !away.length) return null;
  return { home, away };
}

/* Fotmob 事件 → 站点 events 格式（结构：matchFacts.events = {ongoing, events: [...]}） */
function mapFotmobEvents(matchFacts) {
  const raw = matchFacts && matchFacts.events;
  const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.events) ? raw.events : null);
  if (!list) return null;
  const events = [];
  for (const ev of list) {
    const t = String(ev.type || '').toLowerCase();
    const minute = ev.timeStr != null ? ev.timeStr : (ev.time != null ? ev.time : '');
    const player = ev.player && ev.player.name;
    let type = null, detail = player || '';
    if (t === 'goal') { type = 'goal'; detail = (player || '') + (ev.relatedPlayer ? ' · 助攻 ' + ev.relatedPlayer.name : ''); }
    else if (t === 'penalty') { type = 'penalty'; detail = player || ''; }
    else if (t === 'own goal') { type = 'own-goal'; detail = player || ''; }
    else if (t === 'card') {
      const raw = JSON.stringify(ev.extraInfo || ev.detail || '');
      type = /red|second/i.test(raw) ? 'red' : 'yellow';
      detail = player || '';
    }
    else if (t === 'substitution' || t === 'subst') {
      type = 'sub';
      detail = `${ev.relatedPlayer ? ev.relatedPlayer.name : ''} ↓ ${player || ''}`;
    }
    else { continue; }
    events.push({
      type, minute,
      detail: String(detail).trim(),
      homeScore: ev.homeScore != null ? ev.homeScore : null,
      awayScore: ev.awayScore != null ? ev.awayScore : null,
    });
  }
  return events.length ? events : null;
}

/* ---------- Sofascore（备源，部分网络 403 时自动跳过） ---------- */

const SOFA = 'https://api.sofascore.com/api/v1';
const SOFA_LEAGUES = { 英超: 17, 西甲: 8, 德甲: 35, 意甲: 23, 法甲: 34 };

async function sofaGet(path, ttlMs, force) {
  return fetchJson(SOFA + path, {
    'user-agent': UA['user-agent'],
    'accept': '*/*', 'accept-language': 'en-US,en;q=0.9',
    'referer': 'https://www.sofascore.com/',
  }, ttlMs, force);
}

async function sofascoreStandings(leagueName, force) {
  const id = SOFA_LEAGUES[leagueName];
  if (!id) return null;
  const seasons = await sofaGet(`/unique-tournament/${id}/seasons`, 6 * 3600 * 1000, force);
  const sid = seasons.seasons && seasons.seasons[0] && seasons.seasons[0].id;
  if (!sid) return null;
  const j = await sofaGet(`/unique-tournament/${id}/season/${sid}/standings/total`, 6 * 3600 * 1000, force);
  const rows = j.standings && j.standings[0] && j.standings[0].rows;
  if (!Array.isArray(rows)) return null;
  return {
    source: 'sofascore', league: leagueName,
    rows: rows.map((r) => ({
      rank: r.position,
      name: TEAM_NAMES_ZH.zhTeamName(r.team && r.team.name) || (r.team && r.team.name) || '',
      en: r.team && r.team.name || '',
      played: r.played || 0, win: r.wins || 0, draw: r.draws || 0, loss: r.losses || 0,
      gf: r.scoresFor || 0, ga: r.scoresAgainst || 0,
      gd: r.goalConDiff != null ? r.goalConDiff : (r.scoresFor || 0) - (r.scoresAgainst || 0),
      pts: r.points || 0, qualColor: '',
    })),
  };
}

/* ---------- FBref（备源，Cloudflare 验证时自动跳过） ---------- */

const FBREF = 'https://fbref.com';
const FBREF_COMPS = { 英超: '9', 西甲: '12', 德甲: '20', 意甲: '11', 法甲: '13' };

function fbrefSeason() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  // 7 月前为上一赛季（2025-2026），否则为本赛季（2026-2027）
  return m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

/* FBref 积分榜：HTML 表格（th/td 的 data-stat 属性）解析 */
async function fbrefStandings(leagueName, force) {
  const comp = FBREF_COMPS[leagueName];
  if (!comp) return null;
  const season = fbrefSeason();
  const en = { 英超: 'Premier-League', 西甲: 'La-Liga', 德甲: 'Bundesliga', 意甲: 'Serie-A', 法甲: 'Ligue-1' }[leagueName];
  const html = await fetchText(`${FBREF}/en/comps/${comp}/${season}/${en}-Stats`, {
    'user-agent': UA['user-agent'],
    'accept': 'text/html,application/xhtml+xml',
    'accept-language': 'en-US,en;q=0.9',
    'referer': 'https://fbref.com/',
  }, 6 * 3600 * 1000, force);
  const $ = cheerio.load(html);
  const table = $('#div_standings table, table#standings, table[id^="standings"]').first();
  if (!table.length) return null;
  const rows = [];
  table.find('tbody tr').each((_, tr) => {
    const $t = $(tr);
    const cell = (stat) => { const el = $t.find(`[data-stat="${stat}"]`); return el.first().text().trim(); };
    const rank = parseInt(cell('rank'), 10);
    const name = cell('team');
    const played = parseInt(cell('games'), 10);
    if (!name || isNaN(played)) return;
    const gf = parseInt(cell('goals_for'), 10) || 0;
    const ga = parseInt(cell('goals_against'), 10) || 0;
    rows.push({
      rank: isNaN(rank) ? rows.length + 1 : rank,
      name: TEAM_NAMES_ZH.zhTeamName(name) || name,
      en: name,
      played,
      win: parseInt(cell('wins'), 10) || 0,
      draw: parseInt(cell('draws'), 10) || 0,
      loss: parseInt(cell('losses'), 10) || 0,
      gf, ga,
      gd: parseInt(cell('goal_diff'), 10) || (gf - ga),
      pts: parseInt(cell('points'), 10) || 0,
      qualColor: '',
    });
  });
  return rows.length ? { source: 'fbref', league: leagueName, rows } : null;
}

/* ---------- 对外聚合 ---------- */

const BIG_FIVE = ['英超', '西甲', '德甲', '意甲', '法甲'];

/* 五大联赛积分榜：Fotmob → Sofascore → FBref 依次降级 */
async function standingsAll(force) {
  const out = [];
  for (const name of BIG_FIVE) {
    let s = null;
    for (const fn of [fotmobStandings, sofascoreStandings, fbrefStandings]) {
      try { s = await fn(name, force); } catch (_) { s = null; }
      if (s && s.rows && s.rows.length) break;
    }
    if (s && s.rows && s.rows.length) out.push(s);
  }
  return out;
}

/* 单场补充：Fotmob 阵容/统计/事件（按日期+队名反查 matchId） */
async function enrichMatch(match, force) {
  try {
    const store = require('./store');
    const nameOf = (side) => {
      const t = store.teamIndex.get(match[side].id);
      return t ? (t.en || t.name || '') : '';
    };
    const dateStr = new Date(match.kickoffTs).toISOString().slice(0, 10);
    const mId = await fotmobMatchIdByTeams(dateStr, nameOf('home'), nameOf('away'), force);
    if (!mId) return { ok: false, reason: '未在 Fotmob 找到对应比赛' };
    const d = await fotmobMatchDetails(mId, match.status, force);
    if (d.lineup) {
      const ht = store.teamIndex.get(match.home.id);
      const at = store.teamIndex.get(match.away.id);
      if (ht && !ht.lineup) ht.lineup = d.lineup.home;
      if (at && !at.lineup) at.lineup = d.lineup.away;
    }
    if (d.stats && !match.stats) match.stats = d.stats;
    if (d.events && !match.events.length) match.events = d.events;
    return { ok: true, ...d };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

module.exports = { standingsAll, enrichMatch, fotmobMatchesByDate, fotmobMatchDetails };
