# 足球脉动 · Football Pulse

一站式足球赛事数据平台：真实赛程与实时比分、球队深度档案（阵容 / 近况）。全部数据来自 football-data.org，无任何模拟数据。

## 功能一览

| 模块 | 说明 |
| --- | --- |
| 赛程一览 | 按日期（昨天 / 今天 / 明天）与赛事分类筛选，覆盖五大联赛、英冠、葡超、荷甲、巴西甲、欧冠等 13 项赛事（免费档实际开放） |
| 实时比分 | 进行中的比赛实时推送比分与比赛分钟（WebSocket） |
| 赔率数据 | 可选接入 API-Football：欧赔 / 亚盘 / 大小球 / 角球（赛前与滚球） |
| 事件流 | 可选接入 API-Football：进球、点球、红黄牌、换人的真实事件时间线 |
| 球队档案 | 点击任意球队名称进入详情页，查看首发阵容阵型图、近六场真实战绩与球队状态串（队名自动翻译为中文，英文名保留于详情页） |
| 真实数据 | 全部来自 football-data.org v4：赛程、比分、状态、首发阵容、球队近六场 |
| 历史复盘 | 独立入口「历史复盘」：StatsBomb Open Data 真实 XG、射门分布图、事件时间线、统计与首发阵容（覆盖至 2023/24 赛季） |
| 数据同步 | 服务端定时拉取（默认 5 分钟），接口限流适配免费档 10 次/分钟 |
| 订阅收藏 | 本地收藏比赛，订阅人数存于浏览器 localStorage |

## 快速启动

要求 Node.js 18 及以上。

```bash
npm install     # 首次运行安装依赖
npm start       # 启动服务
```

启动后访问 http://localhost:3000

开发模式（代码改动自动重启）：`npm run dev`

## 配置真实数据（必需）

本项目**不包含任何模拟数据**，未配置 API Key 时站点保持空数据。

1. 在 [football-data.org](https://www.football-data.org/) 注册获取免费 API Key。
2. 配置密钥（二选一）：
   - 复制 `server/data/api-config.example.json` 为 `server/data/api-config.json` 并填入 key（文件已被 `.gitignore` 排除，不会入库）；
   - 或设置环境变量 `FOOTBALL_API_KEY`。
3. 重启服务即可。`server/fetcher.js` 会按间隔（默认 5 分钟）拉取最近三天真实赛程、比分、状态，并对直播/已完场同步首发阵容、对当日涉及球队同步近六场战绩。

免费档 API 实际开放 13 项赛事（配置于 `server/data/competitions.js`）：英超、西甲、德甲、意甲、法甲、英冠、葡超、荷甲、巴西甲、欧冠、解放者杯、欧洲杯、世界杯。未开放的赛事（如韩K、日职、沙特甲等）不会出现在站点中。

免费档不提供的字段（赔率、XG、事件流、实时统计、舆论）对应区块会隐藏或显示「暂无数据」占位，不会出现模拟值。

## 接入 API-Football（赔率 + 事件流，可选）

[API-Football](https://www.api-football.com) 免费档（100 次/天）提供赛前/滚球赔率与逐场事件。配置后站点自动展示赔率板块与事件时间线，未配置则保持隐藏：

1. 在 [dashboard.api-football.com](https://dashboard.api-football.com) 注册并复制 API Key（免费，无需信用卡）。
2. 配置密钥（二选一）：
   - 复制 `server/data/apifootball-config.example.json` 为 `server/data/apifootball-config.json` 并填入 key（已被 `.gitignore` 排除）；
   - 或设置环境变量 `API_FOOTBALL_KEY`。
3. 重启服务。服务端会自动把 football-data 比赛与 API-Football 比赛按队名匹配，然后：
   - 每日拉取当日比赛赔率（欧赔 / 亚盘 / 大小球 / 角球，每场 1 次请求，缓存 30 分钟）；
   - 直播中比赛每 5 分钟同步事件流（进球 / 点球 / 红黄牌 / 换人），并随 WebSocket 实时推送；
   - 打开比赛详情页时按需补充赔率与事件（缓存命中不消耗配额）。

免费档配额为 100 次/天，服务端做了预算管理：按需拉取 + 长缓存，超出安全阈值（90 次）自动暂停请求并在控制台提示，不影响站点其它功能。

## 历史深度复盘（StatsBomb Open Data）

顶部导航「历史复盘」入口，使用 [hudl/open-data](https://github.com/hudl/open-data)（StatsBomb 免费开放数据）提供历史比赛的深度分析：

- **真实 XG**：逐射门统计的预期进球，双方对比条展示
- **射门分布图**：球场坐标上的射门点，圆点大小 = XG，实心圆 = 进球，悬浮显示球员/结果
- **事件时间线**：进球、红黄牌、换人
- **数据统计**：控球率、射门、射正、犯规、牌数
- **首发阵容**：真实比赛名单与位置

覆盖赛事：五大联赛部分赛季、欧冠（多赛季）、世界杯（1970 起多届）、美洲杯 2024、非洲杯 2023、英女超等（最新约 2023/24 赛季）。数据为历史静态 JSON，按需从 `raw.githubusercontent.com` 拉取并缓存，无需密钥。

## 部署到 Render（免费，一键部署）

仓库根目录已包含 `render.yaml` Blueprint 配置，部署步骤：

1. 注册并登录 [render.com](https://render.com)（可用 GitHub 账号直接登录）。
2. 点击 **New → Blueprint**，选择本仓库 `CaptainSpArr0W/football-pulse`。
3. 在环境变量处填写：
   - `FOOTBALL_API_KEY`：你的 football-data.org API Key（必填，不填则站点为空数据）。
4. 点击 **Apply**，Render 自动完成构建与部署，完成后得到访问地址：`https://football-pulse.onrender.com`。

注意事项：

- 免费档闲置 15 分钟会自动休眠，下次访问需等待约 1 分钟自动唤醒（页面会先显示加载提示）。
- 服务已设置 `TZ=Asia/Shanghai`，比赛日期按北京时间生成。
- 推送新代码到 `main` 分支会自动触发重新部署。

## 目录结构

```
football-pulse/
├── server/
│   ├── index.js            # Express + WebSocket 入口
│   ├── store.js            # 内存数据仓库（启动为空，由 fetcher 填充）
│   ├── fetcher.js          # 真实数据同步层（football-data.org，含限流）
│   ├── apifootball.js      # 赔率 + 事件流补充层（API-Football，含配额预算）
│   ├── statsbomb.js        # 历史复盘数据层（StatsBomb Open Data）
│   └── data/
│       ├── competitions.js # 可接入赛事配置（免费档开放的 13 项）
│       ├── team-names.js   # 球队中英文名对照表（未收录保留英文）
│       ├── api-config.example.json  # football-data API 配置模板
│       └── apifootball-config.example.json # API-Football 配置模板
├── public/
│   ├── index.html          # 首页：赛程 + 实时比分
│   ├── match.html          # 比赛详情页
│   ├── team.html           # 球队详情页
│   ├── review.html         # 历史深度复盘页
│   ├── css/style.css       # 设计系统
│   └── js/                 # common / index / match / team / review 脚本
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

实时推送：`ws://localhost:3000/ws`，连接后立即收到进行中比赛快照，此后每次数据同步推送 `live-update`（比分 / 状态 / 分钟）与 `data-refreshed`（通知前端重新拉取）。

## 技术栈

- 后端：Node.js + Express + ws（WebSocket）
- 前端：原生 HTML / CSS / JavaScript，无构建步骤
- 数据：football-data.org v4 REST API（免费档 10 次/分钟，服务端限流适配）
