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
const notify = require('./notify');

/* ---------- 每日配额（与 API 的 UTC 自然日对齐：UTC 午夜重置 = 北京时间 08:00，避免跨时区死区） ---------- */
const THRESHOLDS = [50, 75, 90]; // 用量百分比告警阈值
const USAGE_FILE = path.join(__dirname, 'data', 'apifootball-usage.json');
const budget = loadBudget();
let quotaPausedUntil = 0; // API 侧配额耗尽后的暂停截止时间戳（UTC 午夜）

function loadBudget() {
  try {
    const raw = fs.readFileSync(USAGE_FILE, 'utf8');
    const j = JSON.parse(raw);
    return { date: j.date || '', count: j.count || 0, alerted: new Set(j.alerted || []) };
  } catch (_) {
    return { date: '', count: 0, alerted: new Set() };
  }
}

/* 持久化配额状态（写入本地文件，服务重启后不丢计数） */
let saveTimer = null;
function saveBudget() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.writeFileSync(USAGE_FILE, JSON.stringify({ date: budget.date, count: budget.count, alerted: [...budget.alerted] }));
    } catch (_) { /* 忽略写入失败 */ }
  }, 800);
}

function bjToday() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/* API 配额按 UTC 自然日统计（与 api-sports 免费档重置时刻一致） */
function quotaDay() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/* 到达新的一天时重置配额（每次访问时检查，保证任何时刻状态一致） */
function ensureDailyReset() {
  const t = quotaDay();
  if (budget.date !== t) {
    budget.date = t;
    budget.count = 0;
    budget.alerted.clear();
    quotaPausedUntil = 0;
    saveBudget();
    log(`配额已按天重置（${t}，上限 ${DAILY_LIMIT} 次/天）`);
  }
}

/* 定时器：在 UTC 午夜（北京时间 08:00）整点重置，与 API 重置时刻对齐 */
function scheduleMidnightReset() {
  const now = new Date();
  const msToMidnight = 24 * 3600 * 1000
    - ((now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds()) * 1000 + now.getUTCMilliseconds());
  setTimeout(() => {
    ensureDailyReset();
    scheduleMidnightReset();
  }, msToMidnight + 1000);
}
scheduleMidnightReset();

function useBudget() {
  ensureDailyReset();
  budget.count += 1;
  saveBudget();
  const c = budget.count;
  if (c % 10 === 0 || c === SAFE_LIMIT) log(`今日 API 配额已用 ${c}/${DAILY_LIMIT}`);
  checkThresholds(c);
  return c;
}

function overBudget() {
  ensureDailyReset();
  return budget.count >= SAFE_LIMIT;
}

function usage() {
  ensureDailyReset();
  return budget.count;
}

/* API 侧配额耗尽：暂停请求到下一个 UTC 午夜（不发请求，仅发送一次告警邮件） */
function pauseQuota() {
  ensureDailyReset();
  if (quotaPausedUntil) return;
  const now = new Date();
  const until = new Date(now);
  until.setUTCHours(24, 0, 0, 0);
  quotaPausedUntil = until.getTime();
  log(`API-Football 日配额已耗尽，已暂停请求至 UTC 午夜自动恢复`);
  if (!budget.alerted.has(100)) {
    budget.alerted.add(100);
    saveBudget();
    notify.alert('apifb-quota-exhausted',
      `足球脉动 · API-Football 配额已耗尽（${bjToday()}）`,
      `今日 ${DAILY_LIMIT} 次配额已全部用完，API-Football 请求已暂停，北京时间次日 08:00（UTC 午夜）自动恢复。`);
  }
}

function quotaPaused() {
  ensureDailyReset();
  return quotaPausedUntil > Date.now();
}

/* 用量告警：跨越阈值（50/75/90%）时发送邮件，当天每个阈值只发一次 */
function checkThresholds(used) {
  const pct = Math.round((used / DAILY_LIMIT) * 100);
  const remain = Math.max(0, DAILY_LIMIT - used);
  for (const t of THRESHOLDS) {
    if (pct >= t && !budget.alerted.has(t)) {
      budget.alerted.add(t);
      saveBudget();
      notify.alert(`apifb-quota-${t}`,
        `足球脉动 · API-Football 配额告警（${bjToday()}）`,
        `API-Football 免费档今日配额已用 ${used}/${DAILY_LIMIT}（${pct}%），剩余 ${remain} 次。\n` +
        `超过 90 次后服务将暂停 API-Football 请求，实时比分仍由 football-data.org 支撑。`);
    }
  }
}

/* ---------- 请求 + 缓存（含免费档限流：6 秒间隔 ≈ 10 次/分钟） ---------- */
const cache = new Map(); // key -> { data, ts, ttl }
let lastCallAt = 0;
async function throttled(fn) {
  const wait = Math.max(0, 6000 - (Date.now() - lastCallAt));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
  return fn();
}
async function api(pathname, ttlMs) {
  const hit = cache.get(pathname);
  if (hit && Date.now() - hit.ts < hit.ttl) return hit.data;
  if (overBudget() || quotaPaused()) throw new Error('API-Football 配额已暂停');
  return throttled(async () => {
    const res = await fetch(BASE + pathname, { headers: { 'x-apisports-key': KEY } });
    if (res.status === 401) throw new Error('API-Football key 无效');
    if (res.status === 429) { pauseQuota(); throw new Error('API-Football 请求超限(429)'); }
    if (!res.ok) throw new Error(`API-Football HTTP ${res.status}`);
    const j = await res.json();
    // 免费档日配额耗尽：API 返回 200 + errors.requests（该次请求已被计数，立即暂停不再重试）
    if (j && j.errors && j.errors.requests) {
      pauseQuota();
      throw new Error('API-Football 日配额已耗尽，已暂停请求');
    }
    useBudget();
    cache.set(pathname, { data: j, ts: Date.now(), ttl: ttlMs });
    return j;
  });
}

/* ---------- 队名归一化（用于两套数据源的球队匹配） ---------- */
const _norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\b(fc|afc|cf|sc|cd|ec|cr|us|as|ss|ac|de|csd|club|football|association|sport|sports|clube)\b/g, '')
  .replace(/[^a-z0-9]+/g, '');
function normTeam(name) { return _norm(name); }

/* 包含式匹配：Botafogo FR 与 Botafogo、SC Corinthians Paulista 与 Corinthians 均视为同一队 */
function teamMatch(a, b) {
  if (!a || !b || a.length < 3 || b.length < 3) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/* ---------- 当日赛程（获取 API 侧 fixtureId / 队ID / 实时比分） ---------- */

/* 北京时区日期偏移（返回 yyyy-MM-dd 字符串） */
function bjDate(offsetDays) {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/* 按 UTC 单日拉取赛程（API-Football 仅支持 date= 单日查询，dateFrom/dateTo 无效；按 paging 自动翻页） */
async function fixturesByDate(date) {
  const out = [];
  let page = 1;
  let total = 1;
  while (page <= total) {
    const suffix = page > 1 ? `&page=${page}` : '';
    const j = await apiWithRetry(`/fixtures?date=${date}${suffix}`, 12 * 3600 * 1000);
    const p = j.paging || {};
    total = p.total || 1;
    out.push(...(j.response || []));
    page += 1;
  }
  return out.map((f) => ({
    id: f.fixture && f.fixture.id,
    home: { id: f.teams.home.id, name: f.teams.home.name },
    away: { id: f.teams.away.id, name: f.teams.away.name },
    status: f.fixture && f.fixture.status && f.fixture.status.short,
    minute: f.fixture && f.fixture.status && f.fixture.status.elapsed,
    goals: (f.goals && { home: f.goals.home, away: f.goals.away }) || { home: null, away: null },
    league: {
      id: f.league && f.league.id,
      name: f.league && f.league.name,
      country: f.league && f.league.country,
      round: f.league && f.league.round,
    },
    kickoffTs: f.fixture && f.fixture.timestamp, // unix 秒
  }));
}

/* 免费档偶发返回空结果（限流瞬时态），重试一次 */
async function apiWithRetry(pathname, ttlMs) {
  const j = await api(pathname, ttlMs);
  if (j && j.results === 0) {
    await new Promise((r) => setTimeout(r, 8000));
    return api(pathname, ttlMs);
  }
  return j;
}

/* 窗口内全部赛程：北京 -2 天 ~ +5 天对应 UTC -3 ~ +5 共 9 个日期（缓存 12h，跨日自动过期） */
async function windowFixtures() {
  const fixtures = [];
  for (let i = -3; i <= 5; i++) {
    const d = bjDate(i);
    try {
      fixtures.push(...await fixturesByDate(d));
    } catch (err) {
      log(`赛程 ${d} 拉取失败：${err.message}`);
    }
  }
  return fixtures;
}

/* 为 store 中窗口内比赛绑定 API fixtureId（按双方队名匹配，跨时区） */
async function attachFixtureIds(store) {
  const fixtures = await windowFixtures();
  let hit = 0;
  // store 中比赛只存球队 id，英文名需从 teamIndex 解析（en 为英文全名）
  const nameOf = (m, side) => {
    const t = store.teamIndex.get(m[side].id);
    return t ? (t.en || t.name || '') : '';
  };
  for (const m of store.matches) {
    if (m.apiFixtureId) continue;
    const hn = normTeam(nameOf(m, 'home'));
    const an = normTeam(nameOf(m, 'away'));
    if (!hn || !an) continue;
    const f = fixtures.find(
      (x) => teamMatch(hn, normTeam(x.home.name)) && teamMatch(an, normTeam(x.away.name)),
    );
    if (f) {
      m.apiFixtureId = f.id;
      m.apiHomeId = f.home.id;
      m.apiAwayId = f.away.id;
      hit += 1;
    }
  }
  if (hit) log(`绑定 API 比赛 ${hit} 场`);
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
    const num = parseFloat(m[2]);
    if (m[1].toLowerCase() === 'home') {
      // 主队视角：-1.5 = 主让；+1.5 = 主受；无符号默认主让
      line = m[2].startsWith('+') ? num : (m[2].startsWith('-') ? num : -num);
      home = parseFloat(x.odd);
    } else {
      away = parseFloat(x.odd);
    }
  }
  if (line == null || home == null || away == null) return null;
  return { bookmaker: zhBook(bm.name), line, home, away, open: true };
}

function mapTotal(bm) {
  const bet = bm.bets && bm.bets.find((b) => /^goals over\/under$/i.test(b.name));
  if (!bet || !bet.values) return null;
  // 多档盘口（1.5 / 2.5 / 3.5...），选取最接近 2.5 的主盘
  return pickLineBet(bet, 2.5, bm.name);
}

function mapCorners(bm) {
  const bet = bm.bets && bm.bets.find((b) => /corner.*over.*under|over.*under.*corner/i.test(b.name));
  if (!bet || !bet.values) return null;
  // 选取最接近 9.5 的主盘
  return pickLineBet(bet, 9.5, bm.name);
}

/* 从含 Over/Under 多档盘口中选出最接近 targetLine 的一档 */
function pickLineBet(bet, targetLine, bookmakerName) {
  let best = null;
  let bestDist = Infinity;
  let over, under;
  for (const x of bet.values) {
    const m = /^(Over|Under)\s+([\d.]+)$/i.exec(x.value);
    if (!m) continue;
    if (m[1].toLowerCase() === 'over') { over = { line: parseFloat(m[2]), odd: parseFloat(x.odd) }; }
    else { under = { line: parseFloat(m[2]), odd: parseFloat(x.odd) }; }
    if (over && under && over.line === under.line) {
      const dist = Math.abs(over.line - targetLine);
      if (dist < bestDist) {
        bestDist = dist;
        best = { line: over.line, over: over.odd, under: under.odd };
      }
    }
  }
  if (!best) return null;
  return { bookmaker: zhBook(bookmakerName), ...best, open: true };
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
    } else if (String(t).toLowerCase() === 'subst') {
      // API-Football 中 player = 上场的球员，assist = 被换下的球员
      const off = (ev.assist && ev.assist.name) || '';
      const on = player;
      type = 'sub';
      detail = off ? `换人：${off} → ${on}` : `换人：${on}`;
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
    const today = bjToday();
    await attachFixtureIds(store);

    // 今日比赛赔率（30 分钟缓存；直播中 5 分钟；额外联赛按需拉取不占后台配额）
    for (const m of store.matches) {
      if (m.date !== today || !m.apiFixtureId || m._extra) continue;
      try {
        const odds = await oddsFor(m.apiFixtureId, m.status);
        if (odds) m.odds = odds;
      } catch (err) { log(`赔率失败 ${m.id}：${err.message}`); }
    }

    // 直播/已完场事件（5 分钟 / 6 小时缓存，缓存即限流；额外联赛按需拉取）
    const changed = [];
    for (const m of store.matches) {
      if (!m.apiFixtureId || m._extra || (m.status !== 'live' && m.status !== 'finished')) continue;
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
  windowFixtures,
  usage,
  DAILY_LIMIT: DAILY_LIMIT,
};
