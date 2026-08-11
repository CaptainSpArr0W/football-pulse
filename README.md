# 足球脉动 · Football Pulse

一站式足球赛事数据平台：真实赛程与实时比分、球队深度档案（阵容 / 近况）。全部数据来自 football-data.org，无任何模拟数据。

## 功能一览

| 模块 | 说明 |
| --- | --- |
| 赛程一览 | 按日期（昨天 / 今天 / 未来 5 天）与赛事分类筛选，覆盖五大联赛（英超、西甲、德甲、意甲、法甲） |
| 实时比分 | 进行中的比赛实时推送比分与比赛分钟（WebSocket） |
| 五大联赛积分榜 | 免费源实时积分榜（Fotmob 主源，Sofascore / FBref 备源降级） |
| 好机会 | 直播 xG 短时异动（≥0.4）高亮比赛卡，进球或 xG 回落自动解除；未开赛亚盘开盘→临场（开赛前 1h）波动（±0.5）高亮选项卡 |
| 单场数据 | 阵容、比赛统计、事件时间线、XG（API-Football 缺数据时由 Fotmob 免费补充） |
| 比赛预览 | 点击比赛卡弹出卡片：两队实力分区（ESPN 上赛季积分榜梯队）+ 本场 xG + 近六场进/失球合计 + 首发阵容（实际/预测） |
| 比赛详情 | 已完赛/直播展示统计与事件；历史交锋 H2H（Fotmob）+ 场地天气 + 双方首发 + 近六场 |
| xG 数据 | 每场 xG 由 Understat（经 soccerdata 库，含非点球 xG、PPDA）提供，Fotmob 兜底 |
| 赔率数据 | 可选接入 API-Football：欧赔 / 亚盘 / 大小球 / 角球（赛前与滚球） |
| 事件流 | 可选接入 API-Football：进球、点球、红黄牌、换人的真实事件时间线 |
| 球队档案 | 点击任意球队名称进入详情页，查看首发阵容阵型图、近六场真实战绩与球队状态串（队名自动翻译为中文，英文名保留于详情页） |
| 舆论新闻 | 新闻聚合：ESPN（仅最近 15 天）+ 新浪体育 + 搜狐体育，按球队分类抓取五大联赛各队新闻，自动标注情绪倾向并外链原文 |
| 真实数据 | 全部来自 football-data.org v4：赛程、比分、状态、首发阵容、球队近六场 |
| 数据同步 | 服务端定时拉取（默认 5 分钟），接口限流适配免费档 10 次/分钟 |
| 手动刷新 | 首页右上角「刷新」按钮，点击立即同步最新赛程/比分/赔率（缓存命中不额外调接口） |
| 调试模式 | `SEED_2025=1` 启动：从 Fotmob 拉取 2025 赛季揭幕周五大联赛数据填充站点（65 场比赛 / 90 队），用于系统调试（可用 `SEED_2025=2025-03-15,2025-03-16` 指定日期） |
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
   - **多 Key 分流**：在配置文件中用 `keys` 数组填写多个 Key，请求自动轮转、429 时自动冷却切换，等效提升限流上限。
3. 重启服务即可。`server/fetcher.js` 会按间隔（默认 5 分钟）拉取窗口内真实赛程、比分、状态，并对直播/已完场同步首发阵容、对当日涉及球队同步近六场战绩（阵容 6 小时 / 近况 30 分钟多级缓存，重启不重拉）。

免费档 API 实际开放的五大联赛（配置于 `server/data/competitions.js`）：英超、西甲、德甲、意甲、法甲。其余赛事一律不展示（接口返回的其他联赛数据直接丢弃，不占用存储）。

免费档不提供的字段（赔率、XG、事件流、实时统计、舆论）对应区块会隐藏或显示「暂无数据」占位，不会出现模拟值。

## 接入 API-Football（赔率 + 事件流，可选）

[API-Football](https://www.api-football.com) 免费档（100 次/天）提供赛前/滚球赔率与逐场事件。配置后站点自动展示赔率板块与事件时间线，未配置则保持隐藏：

1. 在 [dashboard.api-football.com](https://dashboard.api-football.com) 注册并复制 API Key（免费，无需信用卡）。
2. 配置密钥（二选一）：
   - 复制 `server/data/apifootball-config.example.json` 为 `server/data/apifootball-config.json` 并填入 key（已被 `.gitignore` 排除）；
   - 或设置环境变量 `API_FOOTBALL_KEY`。
   - **多 Key 分流**：用 `keys` 数组填写多个 Key，最少使用优先 + 轮转分流，配额按 Key 独立统计（N 个 Key = N×100 次/天）。
3. 重启服务。服务端会自动把 football-data 比赛与 API-Football 比赛按队名匹配，然后：
   - 按需拉取比赛涉及日期的赛程并过滤到五大联赛（不拉取无关赛事数据）；
   - 每日拉取窗口内比赛赔率（欧赔 / 亚盘 / 大小球 / 角球，每场 1 次请求，缓存 30 分钟）；
   - 直播中比赛每 5 分钟同步事件流（进球 / 点球 / 红黄牌 / 换人），并随 WebSocket 实时推送；
   - 打开比赛详情页时按需补充赔率与事件（缓存命中不消耗配额）。

免费档配额为每个 Key 100 次/天。服务端做了**多级缓存**（内存 + 磁盘，服务重启不重复拉取）与配额管理：按需拉取 + 长缓存，单个 Key 超出安全阈值（90 次）自动暂停并切换其他 Key，全部暂停时在控制台提示，不影响站点其它功能。

### 配额按天重置

配额与 API-Football 的计费周期对齐，按 **UTC 自然日**统计，UTC 午夜（北京时间 08:00）自动重置（整点定时器 + 惰性检查双保险），无需重启服务。API 侧返回配额耗尽时自动暂停请求并发送告警邮件，次日 UTC 午夜自动恢复。

## 免费足球数据源（Fotmob / Sofascore / FBref，无需密钥）

复用 GitHub 开源轮子的抓取方案，为站点补充**五大联赛积分榜**与**单场阵容/统计/事件/XG**，全部免费、无需注册：

| 数据源 | 用途 | 对应开源轮子 |
|---|---|---|
| Fotmob（主源） | 积分榜、单场详情（阵容/统计/事件/XG） | [pseudo-r/Public-FotMob-API](https://github.com/pseudo-r/Public-FotMob-API)、[maxencelobry/fotmob](https://github.com/maxencelobry/fotmob) |
| Sofascore（备源） | 积分榜降级（WAF 较严，需住宅 IP） | [probberechts/soccerdata](https://github.com/probberechts/soccerdata) |
| FBref（备源） | 积分榜降级（Playwright 浏览器抓取，绕过 Cloudflare JS 挑战） | [probberechts/soccerdata](https://github.com/probberechts/soccerdata) |

- 实现于 `server/freefootball.js`：三源自动降级（Fotmob → Sofascore → FBref），全部失败时静默隐藏对应区块；
- 数据经多级缓存（积分榜 6 小时 / 单场 5-30 分钟）；
- FBref 使用 **Playwright + 浏览器**抓取（`playwright-core`）：
  - Windows：自动驱动系统 Edge（`channel: msedge`），无需下载浏览器；
  - Linux / Render：构建时自动安装 chromium（`render.yaml` 已配置），默认无头模式；
  - 环境变量 `FBREF_HEADLESS=1` 强制无头，`FBREF_HEADLESS=0` 强制有头；
  - 能否通过 Cloudflare 挑战取决于出口 IP 信誉：住宅/低风险 IP 一般数秒自动通过，数据中心/机场 IP 可能无限验证（此时该源自动跳过，不影响 Fotmob 主源）；
- 部分网络（如国内直连）会拦截 Sofascore（403），此时自动降级为 Fotmob；部署在海外服务器（如 Render）时 Fotmob 与 FBref 均可使用；
- 前端：首页新增「五大联赛积分榜」板块（联赛页签切换）；比赛详情页在 API-Football 数据缺失时自动展示 Fotmob 的阵容/统计/事件/XG。

## 「好机会」模块（实时机会提示）

首页「好机会」板块实时提示值得关注的比赛，比赛卡片金色脉冲高亮 + 徽章标记：

| 场景 | 检测规则 | 解除条件 |
|---|---|---|
| 直播中 | xG 短时异动：任一队 xG 单轮询窗口（5 分钟）增长 ≥ 0.4 | 任意队进球；或 8 分钟内未进球且 xG 回落至飙升前基线 ±0.1 |
| 未开赛 | 亚盘盘口：开盘让球线 vs 开赛前 1 小时临场盘口 | 波动 ≥ ±0.5 即高亮（固定每场临场前 1 小时强制刷新一次） |

- xG 实时检测优先使用免费数据源（Fotmob 直播详情，5 分钟缓存，无配额消耗）；
- 盘口追踪使用 API-Football 亚盘（开赛前 48h 内首次捕获开盘线，每场开赛前 1 小时固定刷新一次对比，波动 ≥0.5 高亮）；
- 高亮状态经 WebSocket 实时推送，首页「好机会」板块与比赛卡片同步更新；`server/opportunity.js` 全部异常静默降级，不影响其它功能。

### 用量告警邮件（可选）

用量跨越 50% / 75% / 90% 以及配额耗尽时，会发送告警邮件（同一阈值每天只发一次，避免打扰）。配置方式：

1. 复制 `server/data/notify-config.example.json` 为 `server/data/notify-config.json`，填入 SMTP 信息（QQ / 163 邮箱需开启 SMTP 并填写授权码；Gmail 需应用专用密码）：
   ```json
   {
     "smtp": { "host": "smtp.qq.com", "port": 465, "secure": true, "user": "xxx@qq.com", "pass": "授权码" },
     "from": "足球脉动 <xxx@qq.com>",
     "to": ["接收告警的邮箱"]
   }
   ```
2. 或使用环境变量：`NOTIFY_SMTP_HOST`、`NOTIFY_SMTP_PORT`、`NOTIFY_SMTP_USER`、`NOTIFY_SMTP_PASS`、`NOTIFY_FROM`、`NOTIFY_TO`。
3. 未配置时仅输出控制台日志，不影响站点功能。

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
│   ├── fetcher.js          # 真实数据同步层（football-data.org，多Key分流+多级缓存）
│   ├── httpcache.js        # 多级 HTTP 缓存（内存 + 磁盘持久化）
│   ├── freefootball.js     # 免费数据源（Fotmob / Sofascore / FBref：积分榜 + 单场补充）
│   ├── power-rank.js       # 实力分区（ESPN 上赛季积分榜 → S/A/B/C/D/E 梯队）
│   ├── understat.js        # Understat 每场 xG 数据（soccerdata 抓取，匹配填充比赛 xG）
│   ├── espn-news.js        # ESPN 新闻源（15 天内过滤，供聚合）
│   ├── cn-news.js          # 国内新闻聚合（新浪体育 + 搜狐体育，按球队关键词分类）
│   ├── seed-2025.js        # 2025 赛季调试数据（SEED_2025=1 启用，Fotmob 填充）
│   ├── opportunity.js      # 「好机会」模块（xG 实时检测 + 亚盘盘口临场追踪）
│   ├── apifootball.js      # 赔率 + 事件流补充层（API-Football，多Key配额与告警）
│   ├── notify.js           # 用量告警邮件（SMTP，可选）
│   └── data/
│       ├── competitions.js # 可接入赛事配置（五大联赛）
│       ├── team-names.js   # 球队中英文名对照表（未收录保留英文）
│       ├── api-config.example.json  # football-data API 配置模板
│       ├── apifootball-config.example.json # API-Football 配置模板
│       └── notify-config.example.json     # 邮件告警配置模板
├── public/
│   ├── index.html          # 首页：赛程 + 实时比分
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

实时推送：`ws://localhost:3000/ws`，连接后立即收到进行中比赛快照，此后每次数据同步推送 `live-update`（比分 / 状态 / 分钟）与 `data-refreshed`（通知前端重新拉取）。

## 技术栈

- 后端：Node.js + Express + ws（WebSocket）
- 前端：原生 HTML / CSS / JavaScript，无构建步骤
- 数据：football-data.org v4 REST API（免费档 10 次/分钟，服务端限流适配）
