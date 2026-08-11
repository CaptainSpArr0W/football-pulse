/*
 * 2025 赛季调试数据种子（调试用，不参与正式数据流）
 * - 触发：环境变量 SEED_2025=1（同时跳过 football-data 同步，纯调试数据）
 * - 数据源：Fotmob 免费 API（/api/data/matches?date=YYYYMMDD，按日期拉取）
 * - 默认填充 2025-2026 赛季揭幕周（2025-08-16 ~ 08-24，五大联赛全覆盖）
 * - 结构：与 fetcher 的 match/team 对象完全一致，前端与 /api 零改动
 * - 单场详情：打开详情页时 freefootball.enrichMatch 自动按「日期+队名」反查 Fotmob 补充
 */
const httpcache = require('./httpcache');
const TEAM_NAMES_ZH = require('./data/team-names');

const FOTMOB = 'https://www.fotmob.com/api/data';
const UA = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'accept': '*/*',
};
/* ccode -> { 中文联赛名, 联赛名正则 }（精确匹配顶级联赛，排除次级/U21/杯赛） */
const CC_TO_ZH = {
  ENG: { zh: '英超', re: /^premier league$/i },
  ESP: { zh: '西甲', re: /^laliga$/i },
  GER: { zh: '德甲', re: /^bundesliga$/i },
  ITA: { zh: '意甲', re: /^serie a$/i },
  FRA: { zh: '法甲', re: /^ligue 1$/i },
};

const DEFAULT_DATES = ['2025-08-16', '2025-08-17', '2025-08-22', '2025-08-23', '2025-08-24'];

function pad(n) { return String(n).padStart(2, '0'); }
function log(msg) { console.log(`[seed-2025] ${msg}`); }

const PALETTE = ['#5c6bc0', '#ef5350', '#26a69a', '#ffa726', '#ab47bc', '#26c6da', '#66bb6a', '#ff7043', '#7e57c2', '#29b6f6', '#d4e157', '#f06292'];
function colorFor(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return PALETTE[h % PALETTE.length];
}

async function fotmobGet(path, ttlMs = 24 * 3600 * 1000) {
  const key = 'seed2025:' + path;
  const cached = httpcache.get(key);
  if (cached !== undefined) return cached;
  const res = await fetch(FOTMOB + path, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  httpcache.set(key, j, ttlMs);
  return j;
}

/* Fotmob 比赛时间 → 北京时间 {date, time} */
function bjOf(utc) {
  const d = new Date(Date.parse(utc) + 8 * 3600 * 1000);
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
  };
}

function parseScore(str) {
  const m = /(\d+)\s*[-–:]\s*(\d+)/.exec(String(str || ''));
  if (!m) return { home: 0, away: 0 };
  return { home: parseInt(m[1], 10), away: parseInt(m[2], 10) };
}

/* 球队对象（与 fetcher teamObj 结构一致） */
function seedTeam(store, ft, league) {
  const id = String(ft.id);
  let t = store.teamIndex.get(id);
  if (!t) {
    const zh = TEAM_NAMES_ZH.zhTeamName(ft.name, ft.shortName);
    const shortRaw = ft.abbr || ft.shortName || ft.name || '??';
    t = {
      id,
      name: zh || ft.name || id,
      en: ft.name || '',
      short: shortRaw.slice(0, 3).toUpperCase(),
      color: colorFor(id),
      color2: colorFor(id + 'x'),
      crest: ft.img || null,
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

/* 拉取一个比赛日并写入 store */
async function seedDate(store, dateStr) {
  const ymd = dateStr.replace(/-/g, '');
  const j = await fotmobGet(`/matches?date=${ymd}`);
  let count = 0;
  for (const l of j.leagues || []) {
    const cc = CC_TO_ZH[l.ccode];
    if (!cc || !cc.re.test(String(l.name || '')) || !Array.isArray(l.matches)) continue;
    for (const m of l.matches) {
      if (!m.home || !m.away || !m.status) continue;
      const bj = bjOf(m.status.utcTime);
      const home = seedTeam(store, m.home, cc.zh);
      const away = seedTeam(store, m.away, cc.zh);
      const finished = !!m.status.finished;
      const score = parseScore(m.status.scoreStr);
      const prev = store.rawMatchById(`fm-${m.id}`);
      if (prev) continue; // 已存在（多日拉取不重复）
      store.upsertMatch({
        id: `fm-${m.id}`,
        apiId: m.id,
        date: bj.date,
        competition: cc.zh,
        round: l.name || '',
        home: { id: home.id },
        away: { id: away.id },
        kickoff: bj.time,
        kickoffTs: Date.parse(m.status.utcTime),
        status: finished ? 'finished' : (m.status.live ? 'live' : 'upcoming'),
        minute: m.status.liveTime != null ? m.status.liveTime : null,
        score,
        xg: { home: 0, away: 0 },
        stats: null,
        events: [],
        odds: { europe: [], asian: [], total: [], corners: [] },
        halfReport: null,
      });
      count++;
    }
  }
  log(`${dateStr}: 写入 ${count} 场比赛`);
  return count;
}

async function seed(store) {
  const raw = (process.env.SEED_2025 || '').trim();
  // 布尔启用（1/true/on）→ 用默认日期；否则视为日期列表（逗号分隔）
  const list = /^(1|true|on)$/i.test(raw) ? DEFAULT_DATES : raw.split(',').map((s) => s.trim()).filter(Boolean);
  let total = 0;
  for (const d of list) {
    try { total += await seedDate(store, d); } catch (e) { log(`${d} 失败: ${e.message}`); }
  }
  log(`完成：${list.length} 个比赛日，共 ${total} 场比赛`);
  // 补近六场 + 状态串（Fotmob 球队档案，并发 3，失败跳过）
  const free = require('./freefootball');
  const all = [...store.teamIndex.values()];
  let idx = 0;
  const worker = async () => {
    while (idx < all.length) {
      const t = all[idx++];
      try {
        const ft = await free.fotmobTeam(t.id);
        if (ft && ft.recent && ft.recent.length) { t.recent = ft.recent; t.form = ft.form || ''; }
      } catch (_) { /* 单队失败跳过 */ }
    }
  };
  await Promise.all(Array.from({ length: 3 }, () => worker()));
  log(`近六场已填充（${all.length} 支球队）`);
  // 种子完成后主动刷新一次新闻（避免与 cn-news 首刷竞态导致部分球队漏新闻）
  try {
    const cnNews = require('./cn-news');
    await cnNews.refresh(store);
  } catch (_) { /* 新闻失败不影响种子 */ }
  return total;
}

module.exports = { seed };
