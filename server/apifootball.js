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
const DAILY_LIMIT = 100; // 每个 Key 免费档每日请求上限
const SAFE_LIMIT = 90;   // 每个 Key 安全阈值（留余量）
const THRESHOLDS = [50, 75, 90]; // 总量告警阈值（相对全部 Key 合计）
const httpcache = require('./httpcache');

function loadConfig() {
  try {
    let raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}
const CONFIG = loadConfig();
/* 多 Key：环境变量 > 配置文件 keys 数组 > 配置文件 key（向后兼容），自动去重 */
const KEY_CONFIG = [...new Set([
  process.env.API_FOOTBALL_KEY,
  ...(CONFIG.keys || []),
  CONFIG.key,
].filter(Boolean))];
const KEY_STATES = KEY_CONFIG.map((k) => ({ key: k, count: 0, lastCallAt: 0, paused: false }));
let rrIndex = 0;

function log(msg) { console.log(`[apifootball] ${msg}`); }
const notify = require('./notify');

/* ---------- 多 Key 配额（UTC 自然日对齐；最少使用优先 + 轮转分流） ---------- */
const USAGE_FILE = path.join(__dirname, 'data', 'apifootball-usage.json');
const budget = loadBudget(); // { date, keys: {key: count}, alerted: Set }

function loadBudget() {
  try {
    const raw = fs.readFileSync(USAGE_FILE, 'utf8');
    const j = JSON.parse(raw);
    const keys = {};
    if (j.keys) {
      for (const k of KEY_CONFIG) keys[k] = j.keys[k] || 0;
    } else if (j.count) {
      // 旧格式迁移：单 Key 计数归属第一个 Key
      if (KEY_STATES[0]) keys[KEY_STATES[0].key] = j.count;
    }
    return { date: j.date || '', keys, alerted: new Set(j.alerted || []) };
  } catch (_) {
    return { date: '', keys: {}, alerted: new Set() };
  }
}

/* 持久化配额状态（写入本地文件，服务重启后不丢计数） */
let saveTimer = null;
function saveBudget() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.writeFileSync(USAGE_FILE, JSON.stringify({ date: budget.date, keys: budget.keys, alerted: [...budget.alerted] }));
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
    budget.keys = {};
    budget.alerted.clear();
    for (const ks of KEY_STATES) { ks.count = 0; ks.paused = false; }
    saveBudget();
    log(`配额已按天重置（${t}，${KEY_STATES.length} 个 Key，共 ${DAILY_LIMIT * KEY_STATES.length} 次/天）`);
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

/* 全部 Key 今日合计用量 */
function totalUsage() {
  ensureDailyReset();
  return Object.values(budget.keys).reduce((a, b) => a + b, 0);
}

function usage() { return totalUsage(); }

/* 选择本次请求使用的 Key：最少使用优先，平局轮转；全部超限返回 null */
function pickKey() {
  ensureDailyReset();
  const avail = KEY_STATES.filter((k) => !k.paused && (budget.keys[k.key] || 0) < SAFE_LIMIT);
  if (!avail.length) return null;
  const min = Math.min(...avail.map((k) => budget.keys[k.key] || 0));
  const cands = avail.filter((k) => (budget.keys[k.key] || 0) === min);
  const chosen = cands[rrIndex % cands.length];
  rrIndex += 1;
  return chosen;
}

function maskKey(k) { return k ? `${k.slice(0, 4)}***` : '?'; }

/* 单个 Key 暂停（API 侧报耗尽/超限/无效）；全部暂停时发一次告警邮件 */
function pauseKey(ks) {
  ensureDailyReset();
  ks.paused = true;
  const alive = KEY_STATES.filter((k) => !k.paused).length;
  log(`Key ${maskKey(ks.key)} 配额已耗尽，已暂停；可用 ${alive}/${KEY_STATES.length} 个 Key`);
  if (KEY_STATES.length > 0 && alive === 0 && !budget.alerted.has(100)) {
    budget.alerted.add(100);
    saveBudget();
    notify.alert('apifb-quota-exhausted',
      `足球脉动 · API-Football 配额已全部耗尽（${bjToday()}）`,
      `全部 ${KEY_STATES.length} 个 Key 的日配额已用完（合计 ${totalUsage()}/${DAILY_LIMIT * KEY_STATES.length}），` +
      `API-Football 请求已暂停，北京时间次日 08:00（UTC 午夜）自动恢复。`);
  }
}

/* 用量告警：按全部 Key 总量跨越阈值（50/75/90%）时发送邮件，当天每个阈值只发一次 */
function checkThresholds() {
  const used = totalUsage();
  const total = DAILY_LIMIT * KEY_STATES.length;
  const pct = Math.round((used / total) * 100);
  const remain = Math.max(0, total - used);
  for (const t of THRESHOLDS) {
    if (pct >= t && !budget.alerted.has(t)) {
      budget.alerted.add(t);
      saveBudget();
      notify.alert(`apifb-quota-${t}`,
        `足球脉动 · API-Football 配额告警（${bjToday()}）`,
        `今日配额合计已用 ${used}/${total}（${pct}%），剩余 ${remain} 次。\n` +
        `超过安全阈值后服务将暂停 API-Football 请求，实时比分仍由 football-data.org 支撑。`);
    }
  }
}

function isEnabled() { return KEY_STATES.length > 0; }

/* ---------- 请求：多 Key 分流 + 多级缓存（内存/磁盘）+ 每 Key 6 秒限流 ---------- */
async function api(pathname, ttlMs) {
  if (ttlMs > 0) {
    const cached = httpcache.get(pathname);
    if (cached !== undefined) return cached;
  }
  const ks = pickKey();
  if (!ks) throw new Error('API-Football 全部 Key 配额已用尽');
  const wait = Math.max(0, 6000 - (Date.now() - ks.lastCallAt));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  ks.lastCallAt = Date.now();
  const res = await fetch(BASE + pathname, { headers: { 'x-apisports-key': ks.key } });
  if (res.status === 401) { ks.paused = true; log(`Key ${maskKey(ks.key)} 无效，已停用`); throw new Error('API-Football key 无效'); }
  if (res.status === 429) { pauseKey(ks); throw new Error('API-Football 请求超限(429)'); }
  if (!res.ok) throw new Error(`API-Football HTTP ${res.status}`);
  const j = await res.json();
  // 免费档日配额耗尽：API 返回 200 + errors.requests（该次请求已被计数，立即暂停该 Key 不再重试）
  if (j && j.errors && j.errors.requests) { pauseKey(ks); throw new Error('API-Football 该 Key 日配额已耗尽'); }
  budget.keys[ks.key] = (budget.keys[ks.key] || 0) + 1;
  saveBudget();
  checkThresholds();
  if (ttlMs > 0) httpcache.set(pathname, j, ttlMs);
  return j;
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

/* 五大联赛的 API-Football 联赛名（免费档不支持 league 参数，按名称客户端过滤） */
const BIG_FIVE_LEAGUE_RE = /premier league|la liga|bundesliga|serie a|ligue 1/i;

/* 为 store 中窗口内比赛绑定 API fixtureId：
 * - 只拉取 store 比赛涉及日期的赛程（仅五大联赛相关日期，减少无效请求）
 * - 赛程结果按联赛名过滤到五大联赛
 * - 按双方队名匹配 */
async function attachFixtureIds(store) {
  const utcDates = new Set();
  for (const m of store.matches) {
    if (m.kickoffTs) {
      const d = new Date(m.kickoffTs);
      utcDates.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`);
    }
  }
  const fixtures = [];
  for (const d of utcDates) {
    try {
      fixtures.push(...await fixturesByDate(d));
    } catch (err) {
      log(`赛程 ${d} 拉取失败：${err.message}`);
    }
  }
  const bigFive = fixtures.filter((f) => f.league && BIG_FIVE_LEAGUE_RE.test(f.league.name));
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
    const f = bigFive.find(
      (x) => teamMatch(hn, normTeam(x.home.name)) && teamMatch(an, normTeam(x.away.name)),
    );
    if (f) {
      m.apiFixtureId = f.id;
      m.apiHomeId = f.home.id;
      m.apiAwayId = f.away.id;
      hit += 1;
    }
  }
  if (hit) log(`绑定 API 比赛 ${hit} 场（涉及 ${utcDates.size} 个日期）`);
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

/* 某场比赛赔率 → 站点格式（无则返回 null）；force=true 时绕过缓存（手动刷新用） */
async function oddsFor(fixtureId, status, force) {
  const ttl = force ? 0 : (status === 'live' ? 5 * 60 * 1000 : 30 * 60 * 1000);
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

async function syncApifootball(store, opts = {}) {
  if (!isEnabled()) return [];
  try {
    const today = bjToday();
    await attachFixtureIds(store);

    // 今日比赛赔率（30 分钟缓存；直播中 5 分钟；手动刷新 forceOdds 可绕过缓存）
    for (const m of store.matches) {
      if (m.date !== today || !m.apiFixtureId) continue;
      try {
        const odds = await oddsFor(m.apiFixtureId, m.status, opts.forceOdds);
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
  if (!isEnabled() || !match || !match.apiFixtureId) return;
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

/* 亚盘盘口线（供「好机会」模块追踪开盘→临场波动）；force=true 绕过缓存 */
async function asianLine(fixtureId, force) {
  try {
    const odds = await oddsFor(fixtureId, 'upcoming', force);
    const asian = odds && odds.asian;
    return asian && asian[0] ? { line: asian[0].line, bookmaker: asian[0].bookmaker } : null;
  } catch (_) {
    return null;
  }
}

module.exports = {
  isEnabled,
  syncApifootball,
  ensureForMatch,
  asianLine,
  usage,
  DAILY_LIMIT: DAILY_LIMIT,
};
