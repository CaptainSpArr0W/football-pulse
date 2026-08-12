/*
 * Football Pulse 服务器入口
 * - 静态资源：public/
 * - REST API：/api/*
 * - 实时推送：WebSocket /ws（比赛进行中的 XG / 比分 / 事件）
 */
const path = require('path');
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const store = require('./store');

const PORT = process.env.PORT || 3000;
const app = express();

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

/* ---------- REST API ---------- */

/* 总览：可用日期、赛事分类、每日赛程（competitions 始终列出全部配置联赛） */
app.get('/api/overview', (req, res) => {
  const dates = store.availableDates();
  const byDate = {};
  for (const d of dates) byDate[d] = store.matchesByDate(d).map((m) => store._publicMatch(m));
  const { ALL_LEAGUES } = require('./data/competitions');
  res.json({
    today: store.today,
    dates,
    competitions: [...new Set([...ALL_LEAGUES, ...store.competitions()])],
    byDate,
  });
});

/* 按日期查赛事 */
app.get('/api/matches', (req, res) => {
  const { date } = req.query;
  const list = date ? store.matchesByDate(date) : store.matches;
  res.json({ date: date || null, matches: list.map((m) => store._publicMatch(m)) });
});

/* 五大联赛比赛预测（Dixon-Coles 模型，2025-26 数据拟合；?date=YYYY-MM-DD 默认全部未开赛） */
app.get('/api/predictions', (req, res) => {
  try {
    const predictor = require('./predictor');
    const date = req.query.date;
    if (date) {
      res.json({ date, predictions: predictor.predictionsForDate(date, store.matchesByDate(date)) });
      return;
    }
    const out = [];
    const byDate = {};
    for (const m of store.matches) {
      if (m.status !== 'upcoming') continue;
      const pm = store._publicMatch(m);
      m._homeName = pm.home.name;
      m._awayName = pm.away.name;
      const d = m.date;
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(m);
    }
    for (const d of Object.keys(byDate)) {
      const p = predictor.predictionsForDate(d, byDate[d]);
      out.push(...p);
    }
    res.json({ predictions: out });
  } catch (err) {
    res.status(500).json({ error: `预测生成失败：${err.message}` });
  }
});

/* 导出预测记录统计表（CSV）到本地桌面 */
app.get('/api/predictions/export', (req, res) => {
  try {
    const predictor = require('./predictor');
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const desktop = path.join(os.homedir(), 'Desktop');
    const file = path.join(desktop, `足球预测记录_2026-27赛季_${new Date().toISOString().slice(0, 10)}.csv`);
    fs.writeFileSync(file, predictor.exportCsv(), 'utf8');
    res.json({ ok: true, file });
  } catch (err) {
    res.status(500).json({ error: `导出失败：${err.message}` });
  }
});

/* 球队列表 */
app.get('/api/teams', (req, res) => res.json({ teams: store.teams() }));

/* 球队详情：档案 + 阵容 + 近六场 + 舆论 + 相关赛事
 * 命中站点球队库直接返回；否则（fm: 前缀）用 Fotmob 免费源降级填充 */
app.get('/api/team/:id', async (req, res) => {
  let team = store.team(req.params.id);
  if (!team && String(req.params.id).startsWith('fm:')) {
    try {
      const free = require('./freefootball');
      team = await free.fotmobTeam(String(req.params.id).slice(3));
    } catch (_) { team = null; }
  }
  if (!team) return res.status(404).json({ error: '球队不存在' });
  // 阵容兜底：站点无实时首发时，用球队阵容数据填充（FBref 当前赛季优先 → 上赛季快照）
  try {
    if (!team.lineup || !team.lineup.length) {
      const squads = require('./squads');
      const got = squads.lineupFor(team);
      if (got && got.lineup.length) {
        team.lineup = got.lineup;
        team.lineupSource = got.source;
      }
    }
  } catch (_) { /* 阵容填充失败不影响详情页 */ }
  // 首发阵容球员名汉化（在线翻译，缓存 + 限额；MyMemory 配额恢复后自动生效）
  try {
    if (team.lineup) team.lineup = await require('./translate').translatePlayerNames(team.lineup);
  } catch (_) { /* 降级保留原文 */ }
  res.json({ team });
});

/* 单场详情（按需补充 API-Football 赔率与事件；缺失的阵容/统计/事件由 Fotmob 免费源补充） */
app.get('/api/match/:id', async (req, res) => {
  const raw = store.rawMatchById(req.params.id);
  if (!raw) return res.status(404).json({ error: '赛事不存在' });
  const apiFb = require('./apifootball');
  if (apiFb.isEnabled() && raw.apiFixtureId) {
    try {
      await apiFb.ensureForMatch(raw);
    } catch (err) {
      console.log(`[apifootball] 单场补充失败 ${raw.id}：${err.message}`);
    }
  }
  // 免费源补充：阵容缺失 / 统计缺失 / 事件为空时用 Fotmob 填充
  const free = require('./freefootball');
  try {
    const ht = store.teamIndex.get(raw.home.id);
    const at = store.teamIndex.get(raw.away.id);
    const needLineup = (!ht || !ht.lineup) || (!at || !at.lineup);
    const needStats = !raw.stats;
    const needEvents = !raw.events || !raw.events.length;
    if ((needLineup || needStats || needEvents) && raw.kickoffTs) {
      await free.enrichMatch(raw, false);
    }
  } catch (_) { /* 免费源失败静默 */ }
  // 首发阵容球员名汉化（在线翻译，缓存 + 限额，失败保留原文）
  const translate = require('./translate');
  try {
    const pm = store.matchById(req.params.id);
    if (pm.homeTeam && pm.homeTeam.lineup) pm.homeTeam.lineup = await translate.translatePlayerNames(pm.homeTeam.lineup);
    if (pm.awayTeam && pm.awayTeam.lineup) pm.awayTeam.lineup = await translate.translatePlayerNames(pm.awayTeam.lineup);
    res.json({ match: pm });
  } catch (_) { res.json({ match: store.matchById(req.params.id) }); }
});

/* 比赛预览（弹窗卡片）：实力分区 + 近六场进/失球 + 首发 */
app.get('/api/match/preview/:id', async (req, res) => {
  try {
    const raw = store.rawMatchById(req.params.id);
    if (!raw) return res.status(404).json({ error: '赛事不存在' });
    const powerRank = require('./power-rank');
    // 已赛/直播：补充阵容（复用 Fotmob 免费源）
    if (raw.status !== 'upcoming') {
      try {
        const free = require('./freefootball');
        const ht = store.teamIndex.get(raw.home.id);
        const at = store.teamIndex.get(raw.away.id);
        const need = (!ht || !ht.lineup) || (!at || !at.lineup) || !raw.stats || !raw.events || !raw.events.length;
        if (need && raw.kickoffTs) await free.enrichMatch(raw, false);
      } catch (_) { /* 补充失败不影响预览 */ }
    }
    const ht = store.teamIndex.get(raw.home.id);
    const at = store.teamIndex.get(raw.away.id);
    const formOf = (t) => {
      if (!t || !Array.isArray(t.recent) || !t.recent.length) return null;
      let gf = 0, ga = 0;
      for (const r of t.recent) { gf += Number(r.gf) || 0; ga += Number(r.ga) || 0; }
      return { played: t.recent.length, gf, ga, gd: gf - ga, form: t.form || '' };
    };
    const lineupOf = (t) => {
      if (!t || !t.lineup) return null;
      return { formation: t.formation || '', players: t.lineup };
    };
    const [ph, pa] = await Promise.all([
      powerRank.powerOf(ht).catch(() => null),
      powerRank.powerOf(at).catch(() => null),
    ]);
    res.json({
      match: store.matchById(req.params.id),
      power: { home: ph, away: pa },
      form: { home: formOf(ht), away: formOf(at) },
      lineups: {
        home: lineupOf(ht), away: lineupOf(at),
        predicted: raw.status === 'upcoming',
        status: raw.status,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* 五大联赛积分榜（免费源：Fotmob 主 → Sofascore/FBref 备；?force=1 绕过缓存） */
app.get('/api/standings', async (req, res) => {
  try {
    const free = require('./freefootball');
    const list = await free.standingsAll(req.query.force === '1');
    res.json({ leagues: list });
  } catch (err) {
    res.status(502).json({ error: `积分榜获取失败：${err.message}` });
  }
});

/* 五大联赛球员数据（FBref + Understat 2025-26 赛季静态快照；?league=ENG|ESP|GER|ITA|FRA&sort=score|gls|ast|xg|mp&pos=前锋&q=搜索&limit=N） */
app.get('/api/players', (req, res) => {
  try {
    const LEAGUES = {
      ENG: { name: '英超', file: 'players-ENG-2025.json' },
      ESP: { name: '西甲', file: 'players-ESP-2025.json' },
      GER: { name: '德甲', file: 'players-GER-2025.json' },
      ITA: { name: '意甲', file: 'players-ITA-2025.json' },
      FRA: { name: '法甲', file: 'players-FRA-2025.json' },
    };
    const league = String(req.query.league || 'ENG').toUpperCase();
    const cfg = LEAGUES[league];
    if (!cfg) return res.status(400).json({ error: `未知联赛：${league}` });
    const data = require(`./data/${cfg.file}`);
    const SORTS = { score: 'score', gls: 'gls', ast: 'ast', ga: 'ga', xg: 'xg', xa: 'xa', mp: 'mp', min: 'min', sh90: 'sh90', sot: 'sot' };
    const sort = SORTS[req.query.sort] || 'score';
    const pos = req.query.pos || '';
    const q = String(req.query.q || '').toLowerCase();
    const limit = Math.min(Number(req.query.limit) || 100, 600);
    let list = data.players.slice();
    if (pos) list = list.filter((p) => p.pos.includes(pos));
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.squad || '').toLowerCase().includes(q));
    list.sort((a, b) => (b[sort] || 0) - (a[sort] || 0));
    res.json({
      season: data.season, league: cfg.name, code: league, source: data.source, updatedAt: data.updatedAt,
      total: data.players.length, filtered: list.length, players: list.slice(0, limit),
    });
  } catch (err) {
    res.status(500).json({ error: `球员数据获取失败：${err.message}` });
  }
});

/* 手动刷新：立即同步最新赛程/比分/赔率（绕过赔率缓存；与定时同步互斥） */
app.post('/api/refresh', async (req, res) => {
  const fetcher = require('./fetcher');
  const r = await fetcher.syncOnce(store, { forceOdds: true });
  if (!r.ok) return res.status(r.reason === 'busy' ? 409 : 502).json(r);
  const apiFb = require('./apifootball');
  res.json({ ok: true, updated: r.updated, usage: apiFb.usage(), matches: store.matches.length });
});

/* ---------- HTTP 服务器 ---------- */
const server = http.createServer(app);

/* ---------- WebSocket 实时推送 ---------- */
const wss = new WebSocketServer({ server, path: '/ws' });
const pushOnline = () => store.broadcast({ type: 'online-count', count: store.onlineCount() });
wss.on('connection', (ws) => {
  store.addClient(ws);
  ws.on('close', pushOnline);
  pushOnline();
  // 连接建立后立即推送当前进行中的比赛快照
  for (const m of store.matches) {
    if (m.status === 'live') {
      ws.send(JSON.stringify({
        type: 'live-update',
        matchId: m.id,
        minute: m.minute,
        half: m.minute <= 45 ? '上半场' : '下半场',
        status: m.status,
        score: m.score,
        xg: m.xg,
        stats: m.stats || null,
        events: m.events.slice(-6),
        homeTeam: m.home.id,
        awayTeam: m.away.id,
      }));
    }
  }
});
/* 在线人数定时刷新（每 10 秒） */
setInterval(pushOnline, 10000);

/* ---------- 「好机会」模块：xG 实时检测 + 盘口临场追踪 ---------- */
require('./opportunity').start(store);

/* ---------- 新闻聚合：ESPN（15 天内）+ 新浪体育 + 搜狐体育 → 各球队舆论新闻 ---------- */
require('./cn-news').start(store);
/* 球队阵容：FBref 当前赛季渐进抓取 + 上赛季快照兜底 */
require('./squads').start();

/* ---------- 真实数据同步（需 FOOTBALL_API_KEY 或 server/data/api-config.json） ---------- */
const fetcher = require('./fetcher');
fetcher.start(store);
/* 赛后预测结算：每 2 分钟检查已结束比赛并回填命中（幂等） */
setInterval(() => {
  try {
    const predictor = require('./predictor');
    const finished = store.matches.filter((m) => m.status === 'finished' && m.score);
    if (predictor.settleFinishedMatches(finished)) {
      console.log('[predict] 已结算预测结果（比赛结束后自动回填命中）');
    }
  } catch (_) { /* 静默 */ }
}, 2 * 60 * 1000);
/* Understat xG 补充：同步完成后为已完赛比赛填充（每 6 小时重试） */
setTimeout(() => {
  const n = require('./understat').applyAll(store);
  if (n > 0) console.log(`[understat] 已填充 xG：${n} 场比赛`);
}, 20 * 1000);
  /* 赔率策略（The Odds API 低频轮询，节省配额）：
   * - 早盘：每天 09:00 固定一轮，为当日未开赛五大联赛比赛填充赔率（5 次请求）
   * - 临场：开赛前 ≤15 分钟时读取（每联赛 6 小时冷却，每天每联赛至多 2 次）
   * - 配额保护：每日硬上限 20 次，超限自动跳过本轮 */
  const oddsApi = require('./odds-api');
  const dayUsed = { date: '', count: 0 };
  let earlyRoundKey = '';
  const apiCool = {};
  const DAILY_CAP = 20;
  const EARLY_HOUR = 9;
  async function oddsLoop() {
    try {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      if (dayUsed.date !== today) { dayUsed.date = today; dayUsed.count = 0; }
      const upcoming = store.matches.filter((m) => m.status === 'upcoming' && oddsApi.LEAGUE_SPORT[m.competition]);
      if (!upcoming.length) return;
      const isEarly = now.getHours() === EARLY_HOUR && now.getMinutes() < 40 && earlyRoundKey !== today;
      const targets = new Set();
      for (const m of upcoming) {
        const mins = (new Date(m.date + 'T' + (m.time || '00:00') + 'Z') - now) / 60000;
        if (isEarly && mins > 15) targets.add(m.competition);
        else if (mins > 0 && mins <= 15) targets.add(m.competition);
      }
      let filled = 0, flagged = 0;
      for (const lg of targets) {
        if (dayUsed.count >= DAILY_CAP) break;
        const since = apiCool[lg] || 0;
        if (now - since < 6 * 3600 * 1000) continue;
        apiCool[lg] = now.getTime();
        dayUsed.count++;
        for (const m of upcoming.filter((x) => x.competition === lg)) {
          try { if (await oddsApi.applyMatch(m, store)) { filled++; if (m.oppHc) flagged++; } } catch (_) {}
        }
      }
      if (isEarly) earlyRoundKey = today;
      if (filled || flagged) {
        console.log(`[odds] The Odds API 填充 ${filled} 场 · 异动 ${flagged} 场 · 今日已用 ${dayUsed.count}/${DAILY_CAP} · 本月剩余 ${oddsApi.quotaLeft() || '?'} 次`);
        /* 双节点更新：赔率刷新（早盘/临场）后，用最新赔率重新预测并更新日志 */
        try {
          const predictor = require('./predictor');
          const n = predictor.refreshWithOdds(store.matches);
          if (n > 0) console.log(`[predict] 已用最新赔率重新预测 ${n} 场（胜平负/大小球/亚盘融合校准）`);
        } catch (e) { console.log('[predict] 赔率融合刷新失败:', e.message); }
      }
    } catch (_) { /* 静默降级 */ }
  }
  setTimeout(oddsLoop, 10 * 1000);
  setInterval(oddsLoop, 5 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`⚽ Football Pulse 已启动`);
  console.log(`   页面地址   http://localhost:${PORT}`);
  console.log(`   实时推送   ws://localhost:${PORT}/ws`);
  console.log(`   进行中比赛 ${store.matches.filter((m) => m.status === 'live').length} 场`);
});
