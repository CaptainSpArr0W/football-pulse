# 足球脉动 · Football Pulse

一站式足球赛事数据平台：赛程与赔率一览、球队深度档案（阵容 / 近况 / 舆论）、比赛进行时 XG（预期进球）指数实时推送。

## 功能一览

| 模块 | 说明 |
| --- | --- |
| 赛程一览 | 按日期（昨天 / 今天 / 明天）与赛事分类筛选，覆盖五大联赛、荷甲、沙特甲、韩K、日职等 16 项赛事 |
| 赔率数据 | 每场比赛展示 bet365、皇冠、威廉希尔、澳门、必发、中国体育彩票的欧赔，以及亚盘、大小球、角球盘口 |
| 实时直播 | 进行中的比赛实时推送比分、比赛分钟、XG 双向进度条与关键事件流 |
| 球队档案 | 点击任意球队名称进入详情页，查看首发阵容阵型图、近六场 XG 场面数据 |
| 真实数据 | 可选接入 football-data.org 拉取真实赛程、比分、赛果与首发阵容（免费档按映射匹配球队） |
| 实时更新 | WebSocket 全站推送，比赛进行时 XG 指数实时刷新，比分变化带动画反馈 |

## 快速启动

要求 Node.js 18 及以上。

```bash
npm install     # 首次运行安装依赖
npm start       # 启动服务
```

启动后访问 http://localhost:3000

开发模式（代码改动自动重启）：`npm run dev`

## 目录结构

```
football-pulse/
├── server/
│   ├── index.js            # Express + WebSocket 入口
│   ├── store.js            # 内存数据仓库与广播
│   ├── xgEngine.js         # XG 实时引擎（事件剧本推进）
│   ├── fetcher.js          # 真实数据同步层（football-data.org）
│   └── data/
│       ├── matches.js      # 赛事 + 赔率数据
│       ├── teams.js        # 球队阵容 / 近况 / 舆论数据
│       ├── crests.json     # 队标文件名映射
│       └── api-config.example.json  # API 配置模板（复制为 api-config.json 使用）
├── public/
│   ├── index.html          # 首页：赛程 + 赔率 + 直播
│   ├── match.html          # 比赛详情页
│   ├── team.html           # 球队详情页
│   ├── css/style.css       # 设计系统
│   └── js/                 # common / index / match / team 脚本
└── validate.js             # 数据完整性自检（可选）
```

## API 与实时推送

REST 接口：

| 接口 | 说明 |
| --- | --- |
| `GET /api/overview` | 可用日期、赛事分类、按日赛程 |
| `GET /api/matches?date=YYYY-MM-DD` | 按日期查询赛程 |
| `GET /api/team/:id` | 球队档案（含相关赛事） |
| `GET /api/match/:id` | 单场比赛详情 |
| `GET /api/teams` | 球队列表 |

实时推送：`ws://localhost:3000/ws`，连接后立即收到进行中比赛快照，此后每数秒推送一次 `live-update` 消息，字段包含 `score`、`xg`、`minute`、`events`。

## 接入真实数据源（football-data.org）

服务内置模拟数据，可随时切换为真实数据，前端无需改动：

1. 在 [football-data.org](https://www.football-data.org/) 注册获取免费 API Key。
2. 配置密钥（二选一）：
   - 复制 `server/data/api-config.example.json` 为 `server/data/api-config.json` 并填入 key（文件已被 `.gitignore` 排除，不会入库）；
   - 或设置环境变量 `FOOTBALL_API_KEY`。
3. 重启服务，`server/fetcher.js` 会按间隔（默认 5 分钟）拉取真实赛程 / 比分 / 状态，并对已完场自动回填球队近况，对进行中或已完场同步首发阵容（免费档未开放的场次自动跳过，全程静默降级为模拟数据）。

球队 ID 映射位于 `fetcher.js` 的 `KNOWN_TEAM_IDS`（已覆盖英超、西甲、德甲、意甲、法甲、葡超部分球队），可另建 `server/data/api-team-map.json` 追加映射。

## 演示机制

未配置 API Key 或接口不可用时，内置数据基于真实球队与赛事背景构建，开球时间随服务器本地日期动态生成。为保证页面随时打开都有直播，两场进行中的比赛（阿森纳 vs 利物浦、曼联 vs 切尔西）由 XG 引擎按剧本推进，约 2.5 分钟踢完一场后自动重置重开。

## 技术栈

- 后端：Node.js + Express + ws（WebSocket）
- 前端：原生 HTML / CSS / JavaScript，无构建步骤
- 数据：内存化演示数据，结构对齐真实接口
