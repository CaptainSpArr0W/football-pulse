/*
 * API-Football（api-sports.io）补充数据层
 * - 赔率（赛前/滚球）映射为站点 match.odds 格式（europe / asian / total / corners）
 * - 事件流（进球/点球/乌龙/红黄牌/换人）映射为站点 events 格式
 * - 免费档 100 次/天：按需拉取 + 服务端缓存（缓存即限流），全程静默降级
 *
 * Key 配置优先级：
 *   1. 环境变量 API_FOOTBALL_KEY
 *   2. 本地配置文件 server/data/apifootball-config.json（{"key":"..."}）
 */
const fs = require('fs');
const path = require('path');

const BASE = 'https://v3.football.api-sports.io';
const CONFIG_FILE = path.join(__dirname, 'data', 'apifootball-config.json');
const DAILY_LIMIT = 100; // 免费档每日请求上限，留 10% 余量按 90 计
const SAFE_LIMIT = 90;

function loadConfig() {
  try {
    let raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}
const KEY = process.env.API_FOOTBALL_KEY || loadConfig().key || '';

function log(msg) { console.log(`[apifootball] ${msg}`); }

/* ---------- 每日预算 ---------- */
const budget = { date: '', count: 0 };
function todayStr() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function useBudget() {
  const t = todayStr();
  if (budget.date !== t) { budget.date = t; budget.count = 0; }
  budget.count += 1;
  if (budget.count % 10 === 0 || budget.count === SAFE_LIMIT) {
    log(`今日 API 配额已用 ${budget.count}/${DAILY_LIMIT}`);
  }
  return budget.count;
}
function overBudget() {
  const t = todayStr();
  if (budget.date !== t) { budget.date = t; budget.count = 0; }
  return budget.count >= SAFE_LIMIT;
}
function usage() {
  const t = todayStr();
  if (budget.date !== t) return 0;
  return budget.count;
}

/* ---------- 请求 + 缓存 ---------- */
const cache = new Map(); // key -> { data, ts, ttl }
async function api(pathname, ttlMs) {
  const hit = cache.get(pathname);
  if (hit && Date.now() - hit.ts < hit.ttl) return hit.data;
  if (overBudget()) throw new Error('今日 API-Football 配额已达上限');
  const res = await fetch(BASE + pathname, { headers: { 'x-apisports-key': KEY } });
  if (res.status === 401) throw new Error('API-Football key 无效');
  if (res.status === 429) throw new Error('API-Football 请求超限(429)');
  if (!res.ok) throw new Error(`API-Football HTTP ${res.status}`);
  const j = await res.json();
  useBudget();
  cache.set(pathname, { data: j, ts: Date.now(), ttl: ttlMs });
  return j;
}

/* ---------- 队名归一化（用于两套数据源的球队匹配） ---------- */
const _norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\b(fc|afc|cf|sc|cd|ec|cr|us|as|ss|ac|de|csd|club|football|association|sport|sports|clube)\b/g, '')
  .replace(/[^a-z0-9]+/g, '');
function normTeam(name) { return _norm(name); }

/* ---------- 当日赛程（获取 API 侧 fixtureId / 队ID / 实时比分） ---------- */
async function fixturesByDate(date) {
  const j = await api(`/fixtures?date=${date}`, 12 * 3600 * 1000);
  return (j.response || []).map((f) => ({
    id: f.fixture && f.fixture.id,
    date: (f.fixture && f.fixture.date) || '',
    home: { id: f.teams.home.id, name: f.teams.home.name },
    away: { id: f.teams.away.id, name: f.teams.away.name },
    status: f.fixture && f.fixture.status && f.fixture.status.short,
    goals: (f.goals && { home: f.goals.home, away: f.goals.away }) || { home: null, away: null },
  }));
}

/* 为 store 中某日的比赛绑定 API fixtureId（按双方队名匹配） */
async function attachFixtureIds(store, date) {
  const fixtures = await fixturesByDate(date);
  let hit = 0;
  for (const m of store.matches) {
    if (m.date !== date || m.apiFixtureId) continue;
    const hn = normTeam(m.home.name || '');
    const an = normTeam(m.away.name || '');
    const f = fixtures.find((x) => normTeam(x.home.name) === hn && normTeam(x.away.name) === an);
    if (f) {
      m.apiFixtureId = f.id;
      m.apiHomeId = f.home.id;
      m.apiAwayId = f.away.id;
      hit += 1;
    }
  }
  if (hit) log(`当日 ${date} 绑定 API 比赛 ${hit} 场`);
  return hit;
}

/* ---------- 赔率映射 ---------- */
const BOOK_ZH = {
  'Bet365': 'bet365',
  'William Hill': '威廉希尔',
  'Pinnacle': '平博',
  'Betfair': '必发',
  'Crown': '皇冠',
  'Dafabet': 'Dafabet',
  'Marathonbet': 'Marathonbet',
  '1xBet': '1xBet',
  'Bwin': 'Bwin',
  'Unibet': 'Unibet',
  'Betsson': 'Betsson',
  'Betway': 'Betway',
  '10BET': '10BET',
  'NordicBet': 'NordicBet',
  'ComeOn': 'ComeOn',
  'STS': 'STS',
  'MrGreen': 'MrGreen',
  'Vbet': 'Vbet',
  'N1 Bet': 'N1Bet',
  'Bodog': 'Bodog',
  'Interwetten': 'Interwetten',
  'SNAI': 'SNAI',
  'Ireland': 'Ireland',
  'Fonbet': 'Fonbet',
  'Wplay': 'Wplay',
  'Efbet': 'Efbet',
  'PokerStars': 'PokerStars',
  'BetOnline': 'BetOnline',
  'Sportsbet': 'Sportsbet',
  '888': '888',
};
const zhBook = (name) => BOOK_ZH[name] || name;

function mapEurope(bm) {
  const bet = bm.bets && bm.bets.find((b) => b.name === 'Match Winner');
  if (!bet || !bet.values) return null;
  let home, draw, away;
  for (const x of bet.values) {
    if (x.value === 'Home' || x.value === '1') home = parseFloat(x.odd);
    else if (x.value === 'Draw' || x.value === 'X') draw = parseFloat(x.odd);
    else if (x.value === 'Away' || x.value === '2') away = parseFloat(x.odd);
  }
  if (home == null || draw == null || away == null) return null;
  return { bookmaker: zhBook(bm.name), home, draw, away, open: true };
}

function mapAsian(bm) {
  const bet = bm.bets && bm.bets.find((b) => b.name === 'Asian Handicap');
  if (!bet || !bet.values) return null;
  let line, home, away;
  for (const x of bet.values) {
    const m = /^(Home|Away)\s*([+-]?\d+(?:\.\d+)?)$/i.exec(x.value);
    if (!m) continue;
    if (m[1].toLowerCase() === 'home') { line = -parseFloat(m[2]); home = parseFloat(x.odd); }
    else away = parseFloat(x.odd);
  }
  if (line == null || home == null || away == null) return null;
  return { bookmaker: zhBook(bm.name), line, home, away, open: true };
}

function mapTotal(bm) {
  const bet = bm.bets && bm.bets.find((b) => b.name === 'Goals Over/Under');
  if (!bet || !bet.values) return null;
  let line, over, under;
  for (const x of bet.values) {
    const m = /^(Over|Under)\s+([\d.]+)$/i.exec(x.value);
    if (!m) continue;
    if (m[1].toLowerCase() === 'over') { line = parseFloat(m[2]); over = parseFloat(x.odd); }
    else under = parseFloat(x.odd);
  }
  if (line == null || over == null || under == null) return null;
  return { bookmaker: zhBook(bm.name), line, over, under, open: true };
}

function mapCorners(bm) {
  const bet = bm.bets && bm.bets.find((b) => /corner/i.test(b.name) && b.values.some((v) => /^(Over|Under)/i.test(v.value)));
  if (!bet || !bet.values) return null;
  let line, over, under;
  for (const x of bet.values) {
    const m = /^(Over|Under)\s+([\d.]+)$/i.exec(x.value);
    if (!m) continue;
    if (m[1].toLowerCase() === 'over') { line = parseFloat(m[2]); over = parseFloat(x.odd); }
    else under = parseFloat(x.odd);
  }
  if (line == null || over == null || under == null) return null;
  return { bookmaker: zhBook(bm.name), line, over, under, open: true };
}

/* 某场比赛赔率 → 站点格式（无则返回 null） */
async function oddsFor(fixtureId, status) {
  const ttl = status === 'live' ? 5 * 60 * 1000 : 30 * 60 * 1000;
  const j = await api(`/odds?fixture=${fixtureId}`, ttl);
  const f = (j.response || [])[0];
  if (!f || !Array.isArray(f.bookmakers)) return null;
  const odds = { europe: [], asian: [], total: [], corners: [] };
  for (const bm of f.bookmakers) {
    const e = mapEurope(bm); if (e) odds.europe.push(e);
    const a = mapAsian(bm); if (a) odds.asian.push(a);
    const t = mapTotal(bm); if (t) odds.total.push(t);
    const c = mapCorners(bm); if (c) odds.corners.push(c);
  }
  // 控制展示数量
  for (const k of Object.keys(odds)) odds[k] = odds[k].slice(0, 10);
  return odds;
}

/* ---------- 事件映射 ---------- */
async function eventsFor(fixtureId, status) {
  const ttl = status === 'live' ? 5 * 60 * 1000 : 6 * 3600 * 1000;
  const j = await api(`/fixtures/events?fixture=${fixtureId}`, ttl);
  const list = j.response || [];
  if (!list.length) return [];
  // 按分钟排序
  list.sort((a, b) => (a.time && a.time.elapsed || 0) - (b.time && b.time.elapsed || 0));
  const events = [];
  for (const ev of list) {
    const t = ev.type;
    const d = ev.detail || '';
    const player = (ev.player && ev.player.name) || '';
    let type, detail;
    if (t === 'Goal') {
      if (d === 'Penalty') { type = 'penalty'; detail = `点球：${player}`; }
      else if (d === 'Own Goal') { type = 'own-goal'; detail = `乌龙球：${player}`; }
      else { type = 'goal'; detail = `进球：${player}`; }
    } else if (t === 'Card') {
      if (d === 'Red Card' || d === 'Second Yellow card') { type = 'red'; detail = `红牌：${player}`; }
      else { type = 'yellow'; detail = `黄牌：${player}`; }
    } else if (t === 'Subst') {
      const on = (ev.assist && ev.assist.name) || '';
      type = 'sub';
      detail = on ? `换人：${player} → ${on}` : `换人：${player}`;
    } else {
      continue; // Var 等忽略
    }
    events.push({ minute: (ev.time && ev.time.elapsed) || 0, apiTeamId: ev.team && ev.team.id, type, detail });
  }
  return events;
}

/* 依据 match 的 apiHomeId/apiAwayId 判定主客，并从头回放比分生成每个事件的比分徽章 */
function finalizeEvents(match, events) {
  if (!match.apiHomeId) return events;
  const score = { home: 0, away: 0 };
  for (const ev of events) {
    ev.team = ev.apiTeamId === match.apiHomeId ? 'home' : 'away';
    delete ev.apiTeamId;
    ev.homeScore = score.home;
    ev.awayScore = score.away;
    if (ev.type === 'goal' || ev.type === 'penalty') {
      if (ev.team === 'home') score.home += 1; else score.away += 1;
    } else if (ev.type === 'own-goal') {
      if (ev.team === 'home') score.away += 1; else score.home += 1;
    }
  }
  return events;
}

/* ---------- 同步入口 ---------- */

async function syncApifootball(store) {
  if (!KEY) return [];
  if (overBudget()) { log('配额已满，跳过本轮'); return []; }
  try {
    const today = todayStr();
    await attachFixtureIds(store, today);

    // 今日比赛赔率（30 分钟缓存；直播中 5 分钟）
    for (const m of store.matches) {
      if (m.date !== today || !m.apiFixtureId) continue;
      try {
        const odds = await oddsFor(m.apiFixtureId, m.status);
        if (odds) m.odds = odds;
      } catch (err) { log(`赔率失败 ${m.id}：${err.message}`); }
    }

    // 直播/已完场事件（5 分钟 / 6 小时缓存，缓存即限流）
    const changed = [];
    for (const m of store.matches) {
      if (!m.apiFixtureId || (m.status !== 'live' && m.status !== 'finished')) continue;
      try {
        const raw = await eventsFor(m.apiFixtureId, m.status);
        const events = finalizeEvents(m, raw);
        if (JSON.stringify(events) !== JSON.stringify(m.events)) {
          m.events = events;
          changed.push(m);
        }
      } catch (err) { log(`事件失败 ${m.id}：${err.message}`); }
    }
    if (changed.length) log(`事件更新 ${changed.length} 场`);
    return changed;
  } catch (err) {
    log(`同步失败：${err.message}`);
    return [];
  }
}

/* 单场按需补充（/api/match/:id 调用）：赔率缺失/过期或事件缺失时补拉 */
async function ensureForMatch(match) {
  if (!KEY || !match || !match.apiFixtureId) return;
  try {
    const noOdds = !match.odds || (!match.odds.europe.length && !match.odds.asian.length && !match.odds.total.length);
    if (noOdds) {
      const odds = await oddsFor(match.apiFixtureId, match.status);
      if (odds) match.odds = odds;
    }
    if (match.status === 'live' || match.status === 'finished') {
      const raw = await eventsFor(match.apiFixtureId, match.status);
      if (raw.length) match.events = finalizeEvents(match, raw);
    }
  } catch (err) {
    log(`单场补充失败 ${match.id}：${err.message}`);
  }
}

module.exports = {
  isEnabled: () => !!KEY,
  syncApifootball,
  ensureForMatch,
  usage,
  DAILY_LIMIT: DAILY_LIMIT,
};
