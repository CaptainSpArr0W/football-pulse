/*
 * 真实数据同步层（fetcher）— football-data.org 版
 * - 从 football-data.org v4 拉取真实赛程 / 比分 / 状态 / 阵容 / 球队近况
 * - 只保留 API 免费档实际开放的赛事，其余一律不展示
 * - 写入 store 内存，前端 /api 与 WebSocket 推送零改动
 * - 未配置 token、请求失败或超限时静默降级：站点保持空数据而非模拟数据
 *
 * Token 配置优先级（任选其一）：
 *   1. 环境变量 FOOTBALL_API_KEY
 *   2. 本地配置文件 server/data/api-config.json（{"key":"...","intervalMin":5}）
 * 部署到公网时建议改用环境变量，避免 token 入库。
 */
const fs = require('fs');
const path = require('path');
const { CODES, BIG_FIVE } = require('./data/competitions');
const TEAM_NAMES_ZH = require('./data/team-names');

const BASE = 'https://api.football-data.org/v4';
const CONFIG_FILE = path.join(__dirname, 'data', 'api-config.json');

/* ---------- 配置 ---------- */

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
  process.env.FOOTBALL_API_KEY,
  ...(CONFIG.keys || []),
  CONFIG.key,
].filter(Boolean))];
const KEY_STATES = KEY_CONFIG.map((k) => ({ key: k, lastCallAt: 0, cooldownUntil: 0 }));
let rrIndex = 0;
const INTERVAL_MS = Math.max(1, Number(process.env.SYNC_INTERVAL_MIN || CONFIG.intervalMin || 5)) * 60 * 1000;
const httpcache = require('./httpcache');

const NAME_BY_CODE = CODES;

/* ---------- 工具 ---------- */

function pad(n) { return String(n).padStart(2, '0'); }

/* 北京时区（UTC+8，无夏令时）的今天日期 */
function todayStr() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/* UTC ISO 时间 → 北京时间日期 + HH:mm */
function bjOf(utcDate) {
  const d = new Date(Date.parse(utcDate) + 8 * 3600 * 1000);
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

/* 队徽缺失时的兜底配色（由球队 id 确定性生成） */
const PALETTE = ['#5c6bc0', '#ef5350', '#26a69a', '#ffa726', '#ab47bc', '#26c6da', '#66bb6a', '#ff7043', '#7e57c2', '#29b6f6', '#d4e157', '#f06292'];
function colorFor(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return PALETTE[h % PALETTE.length];
}

function log(msg) { console.log(`[fetcher] ${msg}`); }

/* 限流队列：多 Key 轮转，每 Key 6 秒间隔余量；429 时该 Key 冷却 60 秒 */
async function api(pathname) {
  const now = Date.now();
  const avail = KEY_STATES.filter((k) => now >= k.cooldownUntil);
  const ks = avail.length ? avail[rrIndex++ % avail.length] : (KEY_STATES[0] || null);
  if (!ks) throw new Error('未配置 football-data token');
  const wait = Math.max(0, 6000 - (Date.now() - ks.lastCallAt));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  ks.lastCallAt = Date.now();
  const res = await fetch(BASE + pathname, { headers: { 'X-Auth-Token': ks.key } });
  if (res.status === 429) { ks.cooldownUntil = Date.now() + 60 * 1000; throw new Error('请求超限(429)，稍后自动重试'); }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/* 带多级缓存（内存/磁盘）的请求：TTL 内不重复调取 */
async function apiCached(pathname, ttlMs) {
  const cached = httpcache.get(pathname);
  if (cached !== undefined) return cached;
  const j = await api(pathname);
  httpcache.set(pathname, j, ttlMs);
  return j;
}

/* v4 比赛状态 → 项目状态 */
function statusOf(s) {
  switch (s) {
    case 'LIVE': case 'IN_PLAY': case 'PAUSED': case 'SUSPENDED':
      return 'live';
    case 'FINISHED': case 'AWARDED':
      return 'finished';
    default:
      return 'upcoming'; // SCHEDULED / TIMED / POSTPONED / CANCELLED
  }
}

function roundOf(fx) {
  if (fx.matchday) return `第${fx.matchday}轮`;
  if (fx.group) return fx.group.replace(/_/g, ' ');
  if (fx.stage && fx.stage !== 'REGULAR_SEASON') return fx.stage.replace(/_/g, ' ').toLowerCase();
  return '';
}

/* ---------- 球队对象 ---------- */

/* 球队中文名：优先匹配短名，再匹配全名，未收录保留英文 */
function zhTeamName(apiTeam) {
  return TEAM_NAMES_ZH.zhTeamName(apiTeam.name, apiTeam.shortName);
}

function teamObj(store, apiTeam, league) {
  const id = String(apiTeam.id);
  let t = store.teamIndex.get(id);
  if (!t) {
    const zh = zhTeamName(apiTeam);
    t = {
      id,
      name: zh || apiTeam.name || id,
      en: apiTeam.name || apiTeam.shortName || '',
      short: apiTeam.tla || (apiTeam.shortName || '??').slice(0, 3).toUpperCase(),
      color: colorFor(id),
      color2: colorFor(id + 'x'),
      crest: apiTeam.crest || null,
      league,
      formation: '',
      lineup: null,
      recent: [],
      form: '',
      _recentFetchedAt: 0,
      _lineupFetched: false,
    };
    store.upsertTeam(t);
  }
  return t;
}

/* ---------- 比赛对象 ---------- */

function buildMatch(store, fx) {
  const cn = NAME_BY_CODE[fx.competition.code];
  if (!cn) return null;
  const bj = bjOf(fx.utcDate);
  const status = statusOf(fx.status);
  const home = teamObj(store, fx.homeTeam, cn);
  const away = teamObj(store, fx.awayTeam, cn);

  const sc = fx.score || {};
  const pick = (o) => (o && o.home != null ? { home: o.home, away: o.away } : null);
  const score = pick(sc.fullTime) || pick(sc.regularTime) || pick(sc.halfTime)
    || (status === 'live' ? { home: 0, away: 0 } : (status === 'finished' ? { home: 0, away: 0 } : { home: 0, away: 0 }));

  return {
    id: `f-${fx.id}`,
    apiId: fx.id,
    date: bj.date,
    competition: cn,
    round: roundOf(fx),
    home: { id: home.id },
    away: { id: away.id },
    kickoff: bj.time,
    kickoffTs: Date.parse(fx.utcDate),
    status,
    minute: fx.minute != null ? fx.minute : null,
    score,
    xg: { home: 0, away: 0 },
    stats: null,
    events: [],
    odds: { europe: [], asian: [], total: [], corners: [] },
    halfReport: null,
    _lineupFetched: false,
  };
}

/* 写入 store，返回发生变化的比赛（新建或状态/比分/分钟变化） */
function applyToStore(store, fx) {
  const m = buildMatch(store, fx);
  if (!m) return null;
  const existing = store.matchIndex.get(m.apiId);
  if (existing) {
    const changed =
      existing.status !== m.status ||
      existing.score.home !== m.score.home ||
      existing.score.away !== m.score.away ||
      existing.minute !== m.minute ||
      existing.kickoffTs !== m.kickoffTs;
    const up = store.upsertMatch(m);
    return changed ? up : null;
  }
  store.upsertMatch(m);
  return m;
}

/* ---------- 阵容同步 ---------- */

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

async function fetchLineupsFor(store, m) {
  if (m._lineupFetched) return;
  try {
    const lu = await apiCached(`/matches/${m.apiId}/lineups`, 6 * 3600 * 1000);
    const build = (side) => (side && Array.isArray(side.startingXI) && side.startingXI.length
      ? buildLineupFromApi(side.startingXI, side.formation)
      : null);
    const homeLu = build(lu.home);
    const awayLu = build(lu.away);
    if (homeLu || awayLu) {
      const ht = store.teamIndex.get(m.home.id);
      const at = store.teamIndex.get(m.away.id);
      if (ht && homeLu) { ht.lineup = homeLu; ht.formation = lu.home.formation || ht.formation; }
      if (at && awayLu) { at.lineup = awayLu; at.formation = (lu.away && lu.away.formation) || at.formation; }
      log(`阵容同步：${m.id} ${ht && ht.name} vs ${at && at.name}`);
    }
    m._lineupFetched = true;
  } catch (err) {
    // 403/404 表示免费档未开放该场阵容，本场不再重试；429 限流保留下次重试
    if (!String(err.message).includes('429')) m._lineupFetched = true;
  }
}

/* ---------- 球队近况同步 ---------- */

async function fetchRecentFor(store, teamId) {
  const t = store.teamIndex.get(teamId);
  if (!t) return;
  try {
    // 当前赛季刚开始时 status=FINISHED 无窗口会返回空，须显式指定历史日期窗口（过去 365 天）
    const d = new Date(Date.now() + 8 * 3600 * 1000);
    d.setUTCDate(d.getUTCDate() - 365);
    const from = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    const j = await apiCached(`/teams/${teamId}/matches?dateFrom=${from}&dateTo=${todayStr()}&status=FINISHED&limit=5`, 30 * 60 * 1000);
    const list = (j.matches || []).slice(0, 5);
    t.recent = list.map((m) => {
      const home = String(m.homeTeam.id) === teamId;
      const ft = (m.score && m.score.fullTime) || {};
      const gf = home ? ft.home : ft.away;
      const ga = home ? ft.away : ft.home;
      const bj = bjOf(m.utcDate);
      return {
        date: bj.date.slice(5),
        opponent: zhTeamName(home ? m.awayTeam : m.homeTeam) || (home ? m.awayTeam.name : m.homeTeam.name),
        home,
        gf: gf == null ? 0 : gf,
        ga: ga == null ? 0 : ga,
        result: gf == null || ga == null ? 'D' : gf > ga ? 'W' : gf < ga ? 'L' : 'D',
        comp: NAME_BY_CODE[m.competition.code] || m.competition.name,
      };
    });
    t.form = t.recent.map((r) => r.result).join('');
    t._recentFetchedAt = Date.now();
  } catch (err) {
    log(`球队近况失败 ${teamId}：${err.message}`);
  }
}

/* ---------- 推送 ---------- */

function pushUpdate(store, match) {
  store.broadcast({
    type: 'live-update',
    matchId: match.id,
    minute: match.minute,
    half: '',
    status: match.status,
    score: match.score,
    xg: match.xg || { home: 0, away: 0 },
    stats: null,
    events: (match.events || []).slice(-6),
    homeTeam: match.home.id,
    awayTeam: match.away.id,
  });
}

/* ---------- 主循环 ---------- */

let syncing = false; // 防止定时同步与手动刷新并发

async function syncOnce(store, opts = {}) {
  if (!KEY_CONFIG.length) return { ok: false, reason: 'no-key' };
  if (syncing) return { ok: false, reason: 'busy' };
  syncing = true;
  try {
    const off = (n) => {
      const d = new Date(Date.now() + 8 * 3600 * 1000);
      d.setUTCDate(d.getUTCDate() + n);
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    };
    const j = await api(`/matches?dateFrom=${off(-2)}&dateTo=${off(7)}`);
    const fixtures = j.matches || [];
    const changed = [];
    for (const fx of fixtures) {
      const m = applyToStore(store, fx);
      if (m) changed.push(m);
    }

    // 直播/已完场：同步首发阵容（每场一次，6 小时多级缓存）
    for (const m of store.matches) {
      if ((m.status === 'live' || m.status === 'finished') && !m._lineupFetched) {
        await fetchLineupsFor(store, m);
      }
    }

    // 窗口内涉及球队：同步近六场（每轮最多 10 支，30 分钟多级缓存，多轮循环覆盖全部）
    const involved = new Set();
    for (const m of store.matches) { involved.add(m.home.id); involved.add(m.away.id); }
    let n = 0;
    for (const tid of involved) {
      const t = store.teamIndex.get(tid);
      if (t && (!t._recentFetchedAt || Date.now() - t._recentFetchedAt > 30 * 60 * 1000) && n < 10) {
        await fetchRecentFor(store, tid);
        n++;
      }
    }

    for (const m of changed) pushUpdate(store, m);

    // API-Football 补充：赔率 + 真实事件流（免费档按需 + 多级缓存；手动刷新可绕过赔率缓存）
    let evChanged = [];
    const apiFb = require('./apifootball');
    if (apiFb.isEnabled()) {
      evChanged = await apiFb.syncApifootball(store, { forceOdds: !!opts.forceOdds });
      for (const m of evChanged) pushUpdate(store, m);
    }

    store.broadcast({ type: 'data-refreshed', at: Date.now(), matches: store.matches.length });
    log(`同步完成：接口 ${fixtures.length} 场，更新 ${changed.length} 场，球队 ${store.teamIndex.size} 支`);
    return { ok: true, updated: changed.length + evChanged.length };
  } catch (err) {
    log(`同步失败，保持现有数据：${err.message}`);
    return { ok: false, reason: err.message };
  } finally {
    syncing = false;
  }
}

let timer = null;

function start(store) {
  if (!KEY_CONFIG.length) {
    log('未配置 football-data token，站点将保持空数据。');
    log('设置环境变量 FOOTBALL_API_KEY 或写入 server/data/api-config.json 后重启即可启用。');
    return;
  }
  log(`已启用真实数据同步（football-data.org，${KEY_CONFIG.length} 个 Key，间隔 ${INTERVAL_MS / 60000} 分钟）`);
  syncOnce(store);
  timer = setInterval(() => syncOnce(store), INTERVAL_MS);
  timer.unref && timer.unref();
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { start, stop, syncOnce, todayStr, CODES, BIG_FIVE };
