/*
 * 球队阵容模块（squads）
 * - 优先：FBref 当前赛季（2026-27）球队阵容（Playwright 真实浏览器抓取，通过 Cloudflare 挑战）
 * - 兜底：players-*.json 上赛季（2025-26）球员快照按球队分组
 * - 持久化 squads-current.json，后台渐进刷新（每轮一个联赛），新赛季开赛后自动更新为新阵容
 */
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, 'data');
const CURRENT_FILE = path.join(DATA, 'squads-current.json');
const FBREF = 'https://fbref.com';
/* 联赛 -> [上赛季球员快照文件, FBref comp id, FBref 联赛 slug] */
const LEAGUES = {
  英超: ['players-ENG-2025.json', 9, 'Premier-League'],
  西甲: ['players-ESP-2025.json', 12, 'La-Liga'],
  德甲: ['players-GER-2025.json', 20, 'Bundesliga'],
  意甲: ['players-ITA-2025.json', 11, 'Serie-A'],
  法甲: ['players-FRA-2025.json', 13, 'Ligue-1'],
};

const POS_ZH = { GK: '门将', DF: '后卫', MF: '中场', FW: '前锋' };

function norm(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') /* 重音字符归一化：é→e */
    .replace(/[^a-z0-9]/g, '');
}
function fbrefSeason() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  return m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}
function log(msg) { console.log(`[squads] ${msg}`); }

/* ---------- 上赛季快照（players-*.json 按球队分组） ---------- */
let snapshot = null;
function loadSnapshot() {
  if (snapshot) return snapshot;
  snapshot = { teams: {}, source: '2025-26 球员快照（FBref/Understat）' };
  for (const [league, [file]] of Object.entries(LEAGUES)) {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
      const list = Array.isArray(j) ? j : (j.players || []);
      for (const p of list) {
        const key = norm(p.squad);
        if (!key || !p.name) continue;
        if (!snapshot.teams[key]) snapshot.teams[key] = [];
        snapshot.teams[key].push({
          name: p.name, num: 0,
          pos: POS_ZH[(p.pos || '').split('/')[0]] || (p.pos || '').split('/')[0] || '',
          season: '2025-26（上赛季）',
        });
      }
    } catch (_) { /* 快照文件缺失不影响 */ }
  }
  return snapshot;
}

/* ---------- FBref 当前赛季（持久化缓存） ---------- */
let current = null;
function loadCurrent() {
  if (current) return current;
  try { current = JSON.parse(fs.readFileSync(CURRENT_FILE, 'utf8')); }
  catch (_) { current = { teams: {}, teamEn: {}, formations: {}, starting: {}, source: 'Fotmob 当前赛季', updatedAt: 0 }; }
  return current;
}
function saveCurrent() {
  try { fs.writeFileSync(CURRENT_FILE, JSON.stringify(current), 'utf8'); }
  catch (_) { /* 静默 */ }
}

/* ---------- Fotmob 当前赛季阵容（免费 API，主源；FBref 需过 Cloudflare 挑战故不采用） ---------- */
const FOTMOB = 'https://www.fotmob.com/api/data';
const FM_LEAGUES = { 英超: 47, 西甲: 87, 德甲: 54, 意甲: 55, 法甲: 53 };
const FM_UA = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'accept': '*/*',
  'accept-language': 'en-US,en;q=0.9',
  'referer': 'https://www.fotmob.com/',
};
const FM_POS = { 0: '门将', 1: '后卫', 2: '中场', 3: '前锋' };

async function fmGet(path, ttlMs) {
  const httpcache = require('./httpcache');
  const key = 'squads:' + path;
  const c = httpcache.get(key);
  if (c !== undefined) return c;
  const res = await fetch(FOTMOB + path, { headers: FM_UA });
  if (!res.ok) throw new Error(`Fotmob HTTP ${res.status}`);
  const j = await res.json();
  if (ttlMs > 0) httpcache.set(key, j, ttlMs);
  return j;
}

/* 抓取一个联赛全部球队阵容（leagueZh: 英超/西甲/...），返回填充球队数 */
async function fetchLeague(leagueZh) {
  const fmId = FM_LEAGUES[leagueZh];
  if (!fmId) return 0;
  const j = await fmGet(`/leagues?id=${fmId}`, 6 * 3600 * 1000);
  const d = j.table && j.table[0] && j.table[0].data;
  const rows = d && d.table && d.table.all;
  if (!Array.isArray(rows) || !rows.length) return 0;
  const cur = loadCurrent();
  let filled = 0;
  for (const r of rows) {
    const en = r.name || r.shortName;
    const key = norm(en);
    if (!key || !r.id) continue;
    /* 已有完整数据（阵容+阵型+首发）则跳过；缺阵型/首发的旧数据重新补抓 */
    if (cur.teams[key] && cur.teams[key].length && cur.formations[key] && cur.starting[key]) continue;
    try {
      const tj = await fmGet(`/teams?id=${r.id}`, 6 * 3600 * 1000);
      const groups = tj.squad && tj.squad.squad;
      if (!Array.isArray(groups)) continue;
      const players = [];
      for (const g of groups) {
        if (!Array.isArray(g.members)) continue;
        for (const p of g.members) {
          if (!p.name || p.role && p.role.key === 'coach') continue;
          players.push({
            name: p.name,
            num: p.shirtNumber || 0,
            pos: FM_POS[p.positionId] || (p.role && p.role.fallback) || '',
            season: fbrefSeason().replace('-', '/') + '（当前赛季）',
          });
        }
      }
      if (players.length >= 5) {
        cur.teams[key] = players;
        cur.teamEn[key] = en;
        /* 最近一场比赛的阵型与首发（Fotmob lastLineupStats，用户要求：阵型按各队实际数据） */
        try {
          const lls = tj.overview && tj.overview.lastLineupStats;
          if (lls && lls.formation) {
            cur.formations[key] = String(lls.formation);
            if (Array.isArray(lls.starters) && lls.starters.length >= 5) {
              cur.starting[key] = lls.starters.slice(0, 11).map((p) => ({
                name: p.name || '',
                num: p.shirtNumber || 0,
                positionId: Number(p.positionId) || 0,
              }));
            }
          }
        } catch (_) { /* 阵型缺失不影响 */ }
        filled++;
        log(`${leagueZh} ${en}：${players.length} 人，阵型 ${cur.formations[key] || '无'}`);
      }
    } catch (_) { /* 单队失败跳过 */ }
  }
  cur.updatedAt = Date.now();
  saveCurrent();
  return filled;
}

/* 渐进刷新：启动后立即全联赛抓一轮（首轮约 1-2 分钟），此后每 6 小时轮询更新 */
let refreshing = false;
async function refreshTick() {
  if (refreshing) return;
  refreshing = true;
  try {
    for (const zh of Object.keys(LEAGUES)) {
      try { await fetchLeague(zh); } catch (_) { /* 单联赛失败静默 */ }
    }
  } finally {
    refreshing = false;
  }
}

/* Fotmob positionId 分档：11=GK，20-39=后卫，40-79=中场，80+=前锋（与 match 阵容一致） */
function fmPosOf(pid) {
  const p = Number(pid);
  if (p === 11) return '门将';
  if (p >= 20 && p <= 39) return '后卫';
  if (p >= 40 && p <= 79) return '中场';
  if (p >= 80) return '前锋';
  return '中场';
}

/* 解析阵型字符串 → {df, mids:[...], fw}，如 "4-2-3-1" → {df:4, mids:[2,3], fw:1}；失败返回 null */
function parseFormation(fmt) {
  if (!fmt) return null;
  const nums = String(fmt).trim().split(/\s*-\s*/).map((x) => parseInt(x, 10)).filter((n) => Number.isInteger(n) && n >= 0);
  if (nums.length < 3) return null;
  const sum = nums.reduce((a, b) => a + b, 0);
  if (sum !== 10) return null;
  const df = nums[0];
  const fw = nums[nums.length - 1];
  const mids = nums.slice(1, -1);
  return { df, mids, fw };
}

/* 按真实阵型 + Fotmob 最近一场首发站位：多层中场逐层排布（4-2-3-1：双后腰+三前腰） */
function buildFromFormation(starters, formation) {
  const byPos = { 门将: [], 后卫: [], 中场: [], 前锋: [] };
  for (const p of starters) {
    const g = byPos[fmPosOf(p.positionId)] ? fmPosOf(p.positionId) : '中场';
    byPos[g].push(p);
  }
  const rule = parseFormation(formation) || { df: 4, mids: [3], fw: 3 };
  const gk = byPos.门将.slice(0, 1);
  let d = byPos.后卫.slice(0, rule.df);
  let f = byPos.前锋.slice(0, rule.fw);
  let midsAll = byPos.中场.slice(0, rule.mids.reduce((a, b) => a + b, 0));
  /* 位置不足时补足：后卫/中场/前锋互相补充至 11 人（门将 1 + 其余 10） */
  let need = 11 - gk.length - d.length - midsAll.length - f.length;
  const restPool = byPos.后卫.slice(d.length).concat(byPos.中场.slice(midsAll.length), byPos.前锋.slice(f.length));
  while (need > 0 && restPool.length) {
    const pick = restPool.shift();
    if (pick && pick.positionId >= 80) f.push(pick);
    else if (pick && pick.positionId >= 20 && pick.positionId <= 39) d.push(pick);
    else midsAll.push(pick);
    need--;
  }
  /* 多层线位：门将 10 / 后卫 30 / 中场按层 44-62 / 前锋 78 */
  const lineup = [];
  const placeRow = (players, y) => {
    const n = players.length;
    players.forEach((p, i) => {
      const x = n === 1 ? 50 : Math.round(18 + (64 * i) / (n - 1));
      lineup.push([p.name || '', p.num || 0, { pos: fmPosOf(p.positionId), x, y }]);
    });
  };
  placeRow(gk, 10);
  placeRow(d, 30);
  const layers = rule.mids.length || 1;
  midsAll.forEach((p, i) => {
    const perLayer = Math.ceil(midsAll.length / layers);
    const layer = Math.min(layers - 1, Math.floor(i / perLayer));
    const y = layers === 1 ? 52 : (layers === 2 ? (layer === 0 ? 44 : 62) : [38, 52, 66][layer]);
    const row = midsAll.filter((_, j) => Math.min(layers - 1, Math.floor(j / perLayer)) === layer);
    const idx = row.indexOf(p);
    const x = row.length === 1 ? 50 : Math.round(18 + (64 * idx) / (row.length - 1));
    lineup.push([p.name || '', p.num || 0, { pos: '中场', x, y }]);
  });
  placeRow(f, 78);
  return { lineup, formation: `${rule.df}-${rule.mids.join('-')}-${rule.fw}` };
}

/* 从阵容中选首发 11 人并按标准阵型排布（无真实阵型时的兜底）：
 * 门将 1 + 后卫/中场/前锋（总数 10），球员按号码优先排序 */
const FORMATION_RULES = [
  { d: 4, m: 3, f: 3, label: '4-3-3' },
  { d: 4, m: 4, f: 2, label: '4-4-2' },
  { d: 4, m: 2, f: 3, label: '4-2-3-1' },
  { d: 3, m: 5, f: 2, label: '3-5-2' },
  { d: 3, m: 4, f: 3, label: '3-4-3' },
  { d: 5, m: 3, f: 2, label: '5-3-2' },
  { d: 4, m: 5, f: 1, label: '4-5-1' },
];
const LINE_Y = { 门将: 10, 后卫: 28, 中场: 52, 前锋: 78 };

function pickStarting11(list) {
  const byPos = { 门将: [], 后卫: [], 中场: [], 前锋: [] };
  for (const p of list) {
    const g = byPos[p.pos] ? p.pos : '中场';
    byPos[g].push(p);
  }
  for (const k of Object.keys(byPos)) byPos[k].sort((a, b) => (b.num || 0) - (a.num || 0));
  const gk = byPos.门将.slice(0, 1);
  let rule = FORMATION_RULES.find((r) =>
    byPos.后卫.length >= r.d && byPos.中场.length >= r.m && byPos.前锋.length >= r.f);
  if (!rule) {
    const d = Math.min(4, byPos.后卫.length);
    const m = Math.min(3, byPos.中场.length);
    rule = { d, m, f: Math.max(0, 10 - d - m), label: `${d}-${m}-${Math.max(0, 10 - d - m)}` };
  }
  let d = byPos.后卫.slice(0, rule.d);
  let m = byPos.中场.slice(0, rule.m);
  let f = byPos.前锋.slice(0, rule.f);
  /* 位置人数不足时，用其余位置补足 10 人（后卫不足→中场补，中场不足→后卫/前锋补） */
  let need = 10 - d.length - m.length - f.length;
  while (need > 0) {
    const rest = byPos.后卫.slice(d.length).concat(byPos.中场.slice(m.length), byPos.前锋.slice(f.length));
    const pick = rest.shift();
    if (!pick) break;
    if (pick.pos === '后卫') d.push(pick);
    else if (pick.pos === '前锋') f.push(pick);
    else m.push(pick);
    need--;
  }
  /* 线内均匀分布生成站位 */
  const lineup = [];
  const place = (group, players) => {
    const n = players.length;
    const y = LINE_Y[group];
    players.forEach((p, i) => {
      const x = n === 1 ? 50 : Math.round(18 + (64 * i) / (n - 1));
      lineup.push([p.name, p.num || 0, { pos: p.pos || group, x, y }]);
    });
  };
  place('门将', gk);
  place('后卫', d);
  place('中场', m);
  place('前锋', f);
  return { lineup, formation: rule.label };
}

/* 匹配球队（team 含 en/name/league）→ 完整阵容 + 首发 11 人阵型排布 */
function lineupFor(team) {
  if (!team) return null;
  const keys = [team.en, team.name].map(norm).filter((k) => k && k.length > 2);
  const matchIn = (index) => {
    for (const k of keys) {
      if (index[k]) return index[k];
      /* 包含匹配：Fotmob/快照名 与 站点英文名 规范化后互相包含（如 arsenal ⊆ arsenalfc） */
      for (const ik of Object.keys(index)) {
        if (ik.includes(k) || k.includes(ik)) {
          if (Math.abs(ik.length - k.length) <= 12) return index[ik];
        }
      }
    }
    return null;
  };
  const cur = loadCurrent();
  /* 匹配键：精确 → 包含 → 去除数字后的包含（Bayer 04 Leverkusen ↔ Bayer Leverkusen） */
  const matchKey = (() => {
    for (const k of keys) {
      if (cur.teams[k]) return k;
      const kNoNum = k.replace(/[0-9]+/g, '');
      for (const ik of Object.keys(cur.teams)) {
        if (ik.includes(k) || k.includes(ik)) {
          if (Math.abs(ik.length - k.length) <= 12) return ik;
        }
        const ikNoNum = ik.replace(/[0-9]+/g, '');
        if (kNoNum.length > 2 && (ikNoNum.includes(kNoNum) || kNoNum.includes(ikNoNum))) return ik;
      }
    }
    return null;
  })();
  let list = matchKey ? cur.teams[matchKey] : null;
  const isCurrent = !!list && list.length > 0;
  if (!list || !list.length) list = matchIn(loadSnapshot().teams);
  if (!list || !list.length) return null;
  const src = isCurrent ? 'Fotmob 当前赛季（2026-27）' : '2025-26 上赛季快照';
  const full = list.slice(0, 30).map((p) => [p.name, p.num || 0, { pos: p.pos || '' }]);
  /* 优先：Fotmob 最近一场真实阵型 + 首发；兜底：按位置规则排布 */
  let start = null;
  if (isCurrent && matchKey && cur.starting[matchKey] && cur.starting[matchKey].length >= 5) {
    start = buildFromFormation(cur.starting[matchKey], cur.formations[matchKey]);
  }
  if (!start || start.lineup.length < 11) start = pickStarting11(list);
  return {
    lineup: full,
    starting11: start.lineup,
    formation: start.formation,
    source: src,
    count: list.length,
  };
}

function start() {
  /* 启动后先跑一轮（全联赛抓取），随后每 6 小时轮询 */
  setTimeout(refreshTick, 8 * 1000);
  setInterval(refreshTick, 6 * 3600 * 1000);
}

module.exports = { start, lineupFor, fetchLeague, norm };
