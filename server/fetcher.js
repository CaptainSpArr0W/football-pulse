/*
 * 真实数据同步层（fetcher）— football-data.org 版
 * - 从 football-data.org v4 拉取真实赛程 / 比分 / 状态
 * - 写入 store 内存，前端 /api 与 WebSocket 推送零改动
 * - 未配置 token、请求失败或超限时静默降级，保留本地模拟数据
 *
 * Token 配置优先级（任选其一）：
 *   1. 环境变量 FOOTBALL_API_KEY
 *   2. 本地配置文件 server/data/api-config.json（{"key":"...","intervalMin":5}）
 * 部署到公网时建议改用环境变量，避免 token 入库。
 */
const fs = require('fs');
const path = require('path');

const BASE = 'https://api.football-data.org/v4';
const MAP_FILE = path.join(__dirname, 'data', 'api-team-map.json');
const CONFIG_FILE = path.join(__dirname, 'data', 'api-config.json');

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
const KEY = process.env.FOOTBALL_API_KEY || CONFIG.key || '';
const INTERVAL_MS = Math.max(1, Number(process.env.SYNC_INTERVAL_MIN || CONFIG.intervalMin || 5)) * 60 * 1000;

/* 已核实的 football-data.org 队ID（免费档覆盖的欧洲主流联赛） */
const KNOWN_TEAM_IDS = {
  ars: 57, liv: 64, mci: 65, mun: 66, che: 61, tot: 73,
  rma: 86, bar: 81, atm: 78,
  bay: 5, bvb: 4, rbl: 721,
  int: 108, acm: 98, juv: 109,
  psg: 524, monaco: 548,
  benfica: 1903, porto: 503, sporting: 498,
};

/* v4 比赛状态 → 项目状态 */
const STATUS_MAP = {
  SCHEDULED: 'upcoming', TIMED: 'upcoming', POSTPONED: 'upcoming',
  LIVE: 'live', IN_PLAY: 'live', PAUSED: 'live', SUSPENDED: 'live',
  FINISHED: 'finished', CANCELLED: 'finished', AWARDED: 'finished',
};

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function log(msg) {
  console.log(`[fetcher] ${msg}`);
}

async function api(pathname) {
  const res = await fetch(BASE + pathname, { headers: { 'X-Auth-Token': KEY } });
  if (!res.ok) {
    const msg = res.status === 429 ? '请求超限(429)，稍后自动重试' : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return res.json();
}

/* ---------- 队ID映射（KNOWN + 用户可手补的本地文件） ---------- */

function loadMap() {
  try {
    let raw = fs.readFileSync(MAP_FILE, 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

/* ---------- 同步真实数据到 store ---------- */

function buildMatchIndex(store, apiMap) {
  const index = new Map(); // `${apiHome}|${apiAway}` -> match
  for (const m of store.matches) {
    const ah = apiMap[m.home.id];
    const aa = apiMap[m.away.id];
    if (ah && aa) index.set(`${ah}|${aa}`, m);
  }
  return index;
}

function applyFixture(match, fx) {
  if (match.status === 'live') return false; // 不覆盖模拟直播中的场次
  const status = STATUS_MAP[fx.status] || match.status;
  const ft = fx.score && fx.score.fullTime;
  const score = {
    home: ft && ft.home != null ? ft.home : match.score.home,
    away: ft && ft.away != null ? ft.away : match.score.away,
  };
  const changed =
    status !== match.status ||
    score.home !== match.score.home ||
    score.away !== match.score.away ||
    (status === 'live' && fx.minute != null && fx.minute !== match.minute);
  if (!changed) return false;

  match.status = status;
  if (fx.minute != null) match.minute = fx.minute;
  match.score = score;
  return true;
}

function pushUpdate(store, match) {
  store.broadcast({
    type: 'live-update',
    matchId: match.id,
    minute: match.minute,
    half: match.minute <= 45 ? '上半场' : '下半场',
    status: match.status,
    score: match.score,
    xg: match.xg,
    stats: match.stats || null,
    events: match.events.slice(-6),
    homeTeam: match.home.id,
    awayTeam: match.away.id,
  });
}

/* 已完场：把真实赛果回填到主客两队近六场（recent）与状态串（form） */
function backfillRecent(match, fx) {
  if (match._backfilled) return;
  const score = match.score;
  const date = todayStr().slice(5); // 'MM-DD'，与现有 recent 格式一致
  const estXg = (gf, ga) => ({ xg: +(0.4 + gf * 0.75).toFixed(2), xga: +(0.4 + ga * 0.75).toFixed(2) });

  const buildEntry = (self, opponent, home) => {
    const gf = home ? score.home : score.away;
    const ga = home ? score.away : score.home;
    return {
      date,
      opponent,
      home,
      gf, ga,
      ...estXg(gf, ga),
      result: gf > ga ? 'W' : gf < ga ? 'L' : 'D',
      comp: match.competition,
    };
  };

  const homeRecent = [buildEntry(match.home, match.away.name, true), ...(match.home.recent || [])].slice(0, 6);
  const awayRecent = [buildEntry(match.away, match.home.name, false), ...(match.away.recent || [])].slice(0, 6);
  match.home.recent = homeRecent;
  match.away.recent = awayRecent;
  if (match.home.form) match.home.form = homeRecent.map((r) => r.result).join('');
  if (match.away.form) match.away.form = awayRecent.map((r) => r.result).join('');
  match._backfilled = true;
}

/* ---------- 真实阵容（lineup）同步 ---------- */

/* 阵型模板：每个槽位 [角色, x, y]，坐标沿用项目 pos 体系 */
const LINEUP_TEMPLATES = {
  '4-3-3': [['GK', 50, 7], ['RB', 12, 24], ['CB', 38, 22], ['CB', 62, 22], ['LB', 88, 24], ['DM', 50, 38], ['CM', 36, 50], ['CM', 64, 50], ['RW', 82, 68], ['ST', 50, 66], ['LW', 18, 68]],
  '4-2-3-1': [['GK', 50, 7], ['RB', 12, 24], ['CB', 38, 22], ['CB', 62, 22], ['LB', 88, 24], ['DM', 40, 38], ['DM', 60, 38], ['AM', 50, 55], ['RW', 82, 66], ['ST', 50, 64], ['LW', 18, 66]],
  '4-4-2': [['GK', 50, 7], ['RB', 12, 24], ['CB', 38, 22], ['CB', 62, 22], ['LB', 88, 24], ['RM', 88, 48], ['CM', 42, 46], ['CM', 58, 46], ['LM', 12, 48], ['ST', 40, 66], ['ST', 60, 66]],
  '4-5-1': [['GK', 50, 7], ['RB', 12, 24], ['CB', 38, 22], ['CB', 62, 22], ['LB', 88, 24], ['RM', 88, 48], ['CM', 36, 46], ['CM', 50, 50], ['CM', 64, 46], ['LM', 12, 48], ['ST', 50, 64]],
  '3-5-2': [['GK', 50, 7], ['CB', 22, 22], ['CB', 50, 22], ['CB', 78, 22], ['RWB', 12, 34], ['DM', 50, 38], ['CM', 36, 50], ['CM', 64, 50], ['LWB', 88, 34], ['ST', 40, 66], ['ST', 60, 66]],
  '4-3-2-1': [['GK', 50, 7], ['RB', 12, 24], ['CB', 38, 22], ['CB', 62, 22], ['LB', 88, 24], ['CM', 36, 50], ['CM', 50, 52], ['CM', 64, 50], ['AM', 38, 64], ['AM', 62, 64], ['ST', 50, 66]],
};
const DEFAULT_TEMPLATE = LINEUP_TEMPLATES['4-3-3'];

function bucketOf(position) {
  if (position === 'Goalkeeper') return 'GK';
  if (position === 'Defender') return 'DF';
  if (position === 'Midfielder') return 'MF';
  return 'FW';
}
function bucketForRole(role) {
  if (role === 'GK') return 'GK';
  if (role === 'ST' || role === 'RW' || role === 'LW') return 'FW';
  if (role === 'RB' || role === 'CB' || role === 'LB' || role === 'RWB' || role === 'LWB') return 'DF';
  return 'MF';
}

/* 把 football-data 首发名单转为项目 lineup 格式：[[name, number, {pos,x,y}], ...] */
function buildLineupFromApi(startingXI, formation) {
  if (!Array.isArray(startingXI) || !startingXI.length) return null;
  const template = LINEUP_TEMPLATES[formation] || DEFAULT_TEMPLATE;
  const buckets = { GK: [], DF: [], MF: [], FW: [] };
  for (const p of startingXI) buckets[bucketOf(p.position)].push(p);

  const lineup = [];
  for (const [role, x, y] of template) {
    const need = bucketForRole(role);
    let p = buckets[need].shift();
    if (!p) {
      // 该线人数不足时按 FW → MF → DF → GK 顺序从相邻线补位
      for (const fallback of ['FW', 'MF', 'DF', 'GK']) {
        if (fallback === need) continue;
        p = buckets[fallback].shift();
        if (p) break;
      }
    }
    if (!p) break;
    lineup.push([p.name || '球员', p.shirtNumber || 0, { pos: role, x, y }]);
  }
  return lineup.length === 11 ? lineup : null;
}

async function fetchLineups(store, match, fx) {
  try {
    const lu = await api(`/matches/${fx.id}/lineups`);
    if (lu && lu.home && Array.isArray(lu.home.startingXI) && lu.home.startingXI.length) {
      const homeLineup = buildLineupFromApi(lu.home.startingXI, lu.home.formation || match.home.formation);
      const awayLineup = buildLineupFromApi(lu.away && lu.away.startingXI, lu.away && lu.away.formation || match.away.formation);
      if (homeLineup) match.home.lineup = homeLineup;
      if (awayLineup) match.away.lineup = awayLineup;
      log(`阵容同步：${match.id} ${match.home.name} vs ${match.away.name}`);
      match._lineupFetched = true;
    }
  } catch (err) {
    // 403 表示免费档未开放该场阵容，本场不再重试；429 限流保留下次重试
    if (!String(err.message).includes('429')) match._lineupFetched = true;
  }
}

/* ---------- 主循环 ---------- */

let timer = null;

async function syncOnce(store) {
  if (!KEY) return { ok: false, reason: 'no-key' };
  try {
    const apiMap = { ...KNOWN_TEAM_IDS, ...loadMap() };
    const index = buildMatchIndex(store, apiMap);
    if (!index.size) return { ok: false, reason: 'no-mapped-teams' };

    const [liveJson, todayJson] = await Promise.all([
      api('/matches?status=LIVE'),
      api(`/matches?date=${todayStr()}`),
    ]);

    const fixtures = [...(liveJson.matches || []), ...(todayJson.matches || [])];
    const seen = new Set();
    let updated = 0;

    for (const fx of fixtures) {
      const key = `${fx.homeTeam.id}|${fx.awayTeam.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const match = index.get(key);
      if (!match) continue;
      if (applyFixture(match, fx)) {
        updated++;
        if (match.status === 'finished') backfillRecent(match, fx);
        pushUpdate(store, match);
      }
      if (!match._lineupFetched && (match.status === 'live' || match.status === 'finished')) {
        await fetchLineups(store, match, fx);
      }
    }
    log(`同步完成：命中 ${seen.size} 场，更新 ${updated} 场（映射 ${index.size} 组）`);
    return { ok: true, updated };
  } catch (err) {
    log(`同步失败，降级为模拟数据：${err.message}`);
    return { ok: false, reason: err.message };
  }
}

function start(store) {
  if (!KEY) {
    log('未配置 football-data token，跳过真实数据（保持模拟模式）。');
    log('设置环境变量 FOOTBALL_API_KEY 或写入 server/data/api-config.json 后重启即可启用。');
    return;
  }
  log(`已启用真实数据同步（football-data.org，间隔 ${INTERVAL_MS / 60000} 分钟）`);
  syncOnce(store);
  timer = setInterval(() => syncOnce(store), INTERVAL_MS);
  timer.unref && timer.unref();
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, syncOnce, todayStr, KNOWN_TEAM_IDS };
