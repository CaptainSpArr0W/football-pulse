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
      fmId: r.id,
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

/* ---------- FBref（备源，Playwright 浏览器抓取以通过 Cloudflare JS 挑战） ---------- */

const FBREF = 'https://fbref.com';
const FBREF_COMPS = { 英超: '9', 西甲: '12', 德甲: '20', 意甲: '11', 法甲: '13' };

function fbrefSeason() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  // 7 月前为上一赛季（2025-2026），否则为本赛季（2026-2027）
  return m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

/* Playwright 浏览器单例：优先系统 Edge（Windows），否则用内置 chromium（Linux 部署需 playwright install chromium） */
let _browserPromise = null;
async function fbrefBrowser() {
  if (_browserPromise) return _browserPromise;
  _browserPromise = (async () => {
    const { chromium } = require('playwright-core');
    const args = ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-gpu'];
    try {
      // Windows：驱动系统 Edge，无需下载浏览器
      return await chromium.launch({ channel: 'msedge', headless: process.env.FBREF_HEADLESS === '1', args });
    } catch (_) {
      // Linux（如 Render）：使用 playwright 安装的 chromium
      return chromium.launch({ headless: process.env.FBREF_HEADLESS !== '0', args });
    }
  })().catch((e) => { _browserPromise = null; throw e; });
  return _browserPromise;
}

/* 浏览器抓取 FBref 页面：等待 Cloudflare 挑战通过（真实浏览器执行 JS），返回 HTML */
async function fbrefFetchHtml(url) {
  let browser;
  try { browser = await fbrefBrowser(); } catch (_) { return null; }
  const ctx = await browser.newContext({ locale: 'en-US' });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // 等待挑战通过：标题不再是 "Just a moment" 且出现积分榜表格（最多 30s）
    try {
      await page.waitForFunction(() => {
        const t = document.title || '';
        const hasTable = !!document.querySelector('#div_standings table, table[id^="standings"]');
        return hasTable || (t.length > 0 && !t.includes('Just a moment'));
      }, { timeout: 30000 });
    } catch (_) { return null; }
    const title = await page.title();
    if (!title || title.includes('Just a moment')) return null;
    return await page.content();
  } catch (_) {
    return null;
  } finally {
    await ctx.close().catch(() => {});
  }
}

/* FBref 积分榜：Playwright 抓取 + HTML 表格（data-stat 属性）解析 */
async function fbrefStandings(leagueName, force) {
  const comp = FBREF_COMPS[leagueName];
  if (!comp) return null;
  const season = fbrefSeason();
  const en = { 英超: 'Premier-League', 西甲: 'La-Liga', 德甲: 'Bundesliga', 意甲: 'Serie-A', 法甲: 'Ligue-1' }[leagueName];
  const url = `${FBREF}/en/comps/${comp}/${season}/${en}-Stats`;
  const key = 'fbref-pw:' + url;
  if (!force) {
    const c = httpcache.get(key);
    if (c !== undefined) return c;
  }
  const html = await fbrefFetchHtml(url);
  if (!html) return null;
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
  if (!rows.length) return null;
  const out = { source: 'fbref', league: leagueName, rows };
  httpcache.set(key, out, 6 * 3600 * 1000);
  return out;
}

/* ---------- 对外聚合 ---------- */

const BIG_FIVE = ['英超', '西甲', '德甲', '意甲', '法甲'];

/* 五大联赛积分榜：Fotmob → Sofascore → FBref 依次降级；行内附带 storeId（命中站点球队库时）与 fmId（Fotmob id） */
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
  // 关联站点球队 id（按英文名匹配 store.teamIndex），供积分榜点击跳转球队页
  const store = require('./store');
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
  for (const l of out) {
    for (const row of l.rows) {
      const rn = norm(row.en);
      if (!rn) continue;
      for (const t of store.teamIndex.values()) {
        const tn = norm(t.en) || norm(t.name);
        if (tn && (rn.includes(tn) || tn.includes(rn))) { row.storeId = t.id; break; }
      }
    }
  }
  return out;
}

/* Fotmob 球队档案（供非 store 球队的详情页降级填充：横幅/近六场/相关赛事） */
const LEAGUE_ZH = { 'premier league': '英超', 'la liga': '西甲', 'bundesliga': '德甲', 'serie a': '意甲', 'ligue 1': '法甲' };
async function fotmobTeam(teamId) {
  const j = await fotmobGet(`/teams?id=${teamId}`, 6 * 3600 * 1000, false);
  const d = j.details || {};
  const o = j.overview || {};
  const color = (o.teamColors && (o.teamColors.darkMode || o.teamColors.lightMode)) || '#5c6bc0';
  const venue = o.venue && o.venue.widget ? o.venue.widget : null;
  const coach = (o.coachHistory && o.coachHistory[0]) ? o.coachHistory[0].name : null;
  const en = d.name || '';
  const zh = TEAM_NAMES_ZH.zhTeamName(en, d.shortName);
  const nameOf = (f, side) => {
    const v = f && f[side];
    return v && typeof v === 'object' ? String(v.name || '') : String(v || '');
  };
  const idOf = (f, side) => {
    const v = f && f[side];
    return v && typeof v === 'object' ? String(v.id || '') : '';
  };
  const compOf = (f) => {
    const pick = (v) => (v && typeof v === 'object' ? (v.name || '') : (typeof v === 'string' ? v : ''));
    return pick(f.displayTournament) || pick(f.tournament);
  };
  // 近六场：从 overviewFixtures 取已完场（前 6 场）
  const fixtures = Array.isArray(o.overviewFixtures) ? o.overviewFixtures : [];
  const finished = fixtures.filter((f) => f.status && f.status.finished);
  const recent = finished.slice(0, 6).map((f) => {
    const hn = nameOf(f, 'home');
    const an = nameOf(f, 'away');
    const isHome = hn === en;
    const parts = String(f.status.scoreStr || '').split('-');
    const gf = parseInt(parts[0], 10) || 0;
    const ga = parseInt(parts[1], 10) || 0;
    return {
      comp: compOf(f),
      home: isHome,
      result: f.result === 1 ? 'W' : f.result === -1 ? 'L' : 'D',
      opponent: isHome ? an : hn,
      gf: isHome ? gf : ga,
      ga: isHome ? ga : gf,
      date: f.status && f.status.utcTime ? new Date(f.status.utcTime).toISOString().slice(0, 10) : '',
    };
  });
  // 相关赛事：未开赛的未来比赛
  const upcoming = fixtures.filter((f) => f.notStarted);
  const matches = upcoming.slice(0, 6).map((f) => {
    const hn = nameOf(f, 'home');
    const an = nameOf(f, 'away');
    return {
      id: `fm-${f.id}`,
      date: f.status && f.status.utcTime ? new Date(f.status.utcTime).toISOString().slice(0, 10) : '',
      competition: compOf(f),
      round: '',
      home: { id: idOf(f, 'home'), name: hn, short: hn.slice(0, 3).toUpperCase(), color, color2: color, crest: null },
      away: { id: idOf(f, 'away'), name: an, short: an.slice(0, 3).toUpperCase(), color: '#5c6bc0', color2: '#3949ab', crest: null },
      kickoff: f.status && f.status.utcTime ? new Date(f.status.utcTime).toISOString().slice(11, 16) : '',
      kickoffTs: f.status && f.status.utcTime ? Date.parse(f.status.utcTime) : 0,
      status: 'upcoming', minute: null,
      score: { home: 0, away: 0 }, xg: { home: 0, away: 0 },
      odds: { europe: [], asian: [], total: [], corners: [] }, events: [],
      oppXg: false, oppHc: false,
    };
  });
  const form = Array.isArray(o.teamForm)
    ? o.teamForm.map((x) => (x.resultString || (x.result === 1 ? 'W' : x.result === -1 ? 'L' : 'D'))).join('').slice(0, 6)
    : '';
  return {
    id: `fm:${teamId}`, name: zh || en, en, short: d.shortName || en,
    color, color2: color, crest: `https://images.fotmob.com/image_resources/logo/teamlogo/${teamId}.png`,
    league: LEAGUE_ZH[String(d.primaryLeagueName || '').toLowerCase()] || d.primaryLeagueName || '',
    coach, stadium: venue ? venue.name : '', city: venue ? venue.city : '',
    formation: '', lineup: null, recent, form, matches,
    news: [],
  };
}

/* 实时 xG（Fotmob，优先免费源）：返回 {home, away} 或 null；命中后缓存 Fotmob matchId 到 match._fotmobId */
async function liveXg(match, force) {
  let mId = match._fotmobId;
  if (!mId) {
    const store = require('./store');
    const nameOf = (side) => {
      const t = store.teamIndex.get(match[side].id);
      return t ? (t.en || t.name || '') : '';
    };
    const dateStr = new Date(match.kickoffTs).toISOString().slice(0, 10);
    mId = await fotmobMatchIdByTeams(dateStr, nameOf('home'), nameOf('away'), force);
    if (mId) match._fotmobId = mId;
  }
  if (!mId) return null;
  const d = await fotmobMatchDetails(mId, match.status, force);
  return d.xg;
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
    match._fotmobId = mId;
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

module.exports = { standingsAll, enrichMatch, fotmobMatchesByDate, fotmobMatchDetails, liveXg, fotmobTeam };
