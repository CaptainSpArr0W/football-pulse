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

/* 总览：可用日期、赛事分类、每日赛程 */
app.get('/api/overview', (req, res) => {
  const dates = store.availableDates();
  const byDate = {};
  for (const d of dates) byDate[d] = store.matchesByDate(d).map((m) => store._publicMatch(m));
  res.json({ today: store.today, dates, competitions: store.competitions(), byDate });
});

/* 按日期查赛事 */
app.get('/api/matches', (req, res) => {
  const { date } = req.query;
  const list = date ? store.matchesByDate(date) : store.matches;
  res.json({ date: date || null, matches: list.map((m) => store._publicMatch(m)) });
});

/* 球队列表 */
app.get('/api/teams', (req, res) => res.json({ teams: store.teams() }));

/* 球队详情：档案 + 阵容 + 近六场 + 舆论 + 相关赛事 */
app.get('/api/team/:id', (req, res) => {
  const team = store.team(req.params.id);
  if (!team) return res.status(404).json({ error: '球队不存在' });
  res.json({ team });
});

/* 单场详情（按需补充 API-Football 赔率与事件） */
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
  res.json({ match: store.matchById(req.params.id) });
});

/* ---------- StatsBomb 历史深度复盘 ---------- */
const statsbomb = require('./statsbomb');

/* 赛事/赛季列表（历史复盘选择器） */
app.get('/api/statsbomb/competitions', async (req, res) => {
  try {
    res.json({ groups: await statsbomb.competitionGroups() });
  } catch (err) {
    res.status(502).json({ error: `StatsBomb 数据获取失败：${err.message}` });
  }
});

/* 某赛事某赛季的比赛列表 */
app.get('/api/statsbomb/matches', async (req, res) => {
  const { comp, season } = req.query;
  if (!comp || !season) return res.status(400).json({ error: '缺少 comp/season 参数' });
  try {
    res.json({ matches: await statsbomb.matchesFor(comp, season) });
  } catch (err) {
    res.status(502).json({ error: `StatsBomb 数据获取失败：${err.message}` });
  }
});

/* 单场深度复盘（真实 XG / 射门 / 事件 / 统计 / 阵容） */
app.get('/api/statsbomb/review', async (req, res) => {
  const { comp, season, match } = req.query;
  if (!comp || !season || !match) return res.status(400).json({ error: '缺少 comp/season/match 参数' });
  try {
    res.json({ review: await statsbomb.reviewFor(comp, season, match) });
  } catch (err) {
    res.status(502).json({ error: `复盘数据获取失败：${err.message}` });
  }
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

/* ---------- 真实数据同步（可选，需 FOOTBALL_API_KEY） ---------- */
const fetcher = require('./fetcher');
fetcher.start(store);

server.listen(PORT, () => {
  console.log(`⚽ Football Pulse 已启动`);
  console.log(`   页面地址   http://localhost:${PORT}`);
  console.log(`   实时推送   ws://localhost:${PORT}/ws`);
  console.log(`   进行中比赛 ${store.matches.filter((m) => m.status === 'live').length} 场`);
});
