/*
 * 赛事数据：日期、赛事分类、比赛名称、开球时间、各大博彩公司赔率
 * 赛事范围：五大联赛 + 韩K / 日职 / 巴西甲 / 墨西哥超 / 哥伦比亚甲 / 瑞超 / 挪超 / 葡超 / 英冠 / 美职联 / 欧冠
 * 赔率包含四类：欧赔（europe）、亚盘（asian）、大小球（total）、角球（corners）
 * 公司：bet365 / 威廉希尔 / 澳门 / 必发 / 中国体育彩票（部分场次未开盘则留空）
 * 演示数据动态基于服务器本地日期生成（today ± 1 天），可替换为真实数据源
 */

const { teamMap } = require('./teams');

function pad(n) { return String(n).padStart(2, '0'); }

function fmtDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shiftDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return fmtDate(d);
}

/* 五大联赛（首页标签）与其他联赛（下拉栏） */
const BIG_FIVE = ['英超', '西甲', '德甲', '意甲', '法甲'];
const OTHER_LEAGUES = ['韩K联赛', '日职联赛', '巴西甲', '墨西哥超', '哥伦比亚甲', '瑞超', '挪超', '葡超', '英冠', '美职联', '欧冠', '荷甲', '沙特甲'];

/* 国际盘口公司（体彩单列；皇冠列第二位） */
const INTERNATIONAL = ['bet365', '皇冠', '威廉希尔', '澳门', '必发'];
const LOTTERY = '中国体育彩票';
const BOOKMAKERS = [...INTERNATIONAL, LOTTERY];

/* 在 bet365 之后插入皇冠盘欧赔 */
function withCrown(odds) {
  const b365 = odds.find((o) => o.bookmaker === 'bet365');
  const crown = {
    bookmaker: '皇冠',
    home: +(b365.home - 0.02).toFixed(2),
    draw: +(b365.draw + 0.05).toFixed(2),
    away: +(b365.away - 0.02).toFixed(2),
  };
  return [odds[0], crown, ...odds.slice(1)];
}

/* 确定性伪随机（基于种子），保证每次启动生成的水位一致 */
function seeded(key) {
  let h = 0;
  for (const c of String(key)) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return h / 9973;
}

/* 亚盘：盘口（主队让球，负=主让，正=主受）+ 主/客水位 */
function genAsianHandicap(id, line, bookmakers) {
  return bookmakers.map((b) => {
    const r = seeded(`${id}:ah:${b}`);
    const home = Math.round((0.9 - line * 0.03 + r * 0.05) * 100) / 100;
    const away = Math.round((0.96 + line * 0.03 + (1 - r) * 0.04) * 100) / 100;
    return { bookmaker: b, line, home, away };
  });
}

/* 大小球：盘口（进球数）+ 大/小水位 */
function genTotal(id, line, bookmakers) {
  return bookmakers.map((b) => {
    const r = seeded(`${id}:ou:${b}`);
    const over = Math.round((0.9 + r * 0.07) * 100) / 100;
    const under = Math.round((1.86 - over + (1 - r) * 0.02) * 100) / 100;
    return { bookmaker: b, line, over, under };
  });
}

/* 角球：全场角球总数大小盘（8.5 - 11.5），不同公司盘口 ±0.5 浮动 */
function genCorners(id, bookmakers) {
  const base = [9.5, 10.5, 11.5][Math.floor(seeded(`${id}:oc`) * 3)];
  return bookmakers.map((b) => {
    const r = seeded(`${id}:oc:${b}`);
    const line = base + (r < 0.35 ? -0.5 : r > 0.65 ? 0.5 : 0);
    const over = Math.round((0.88 + seeded(`${id}:ocw:${b}`) * 0.06) * 100) / 100;
    const under = Math.round((1.84 - over) * 100) / 100;
    return { bookmaker: b, line, over, under };
  });
}

/* ============================================================
 * 扩展赛程生成器：为过去 3 天与未来 7 天批量生成比赛
 * 对阵来自轮转池，赔率/盘口基于球队基准实力推导，赛果确定性生成
 * ============================================================ */

const STRENGTH = {
  ars: 0.84, liv: 0.82, mci: 0.9, mun: 0.68, che: 0.7, tot: 0.72,
  rma: 0.9, bar: 0.8, atm: 0.78, bay: 0.85, bvb: 0.7, rbl: 0.72,
  int: 0.78, acm: 0.72, juv: 0.7, psg: 0.8, monaco: 0.72,
  uls: 0.72, junbuk: 0.66, kobe: 0.74, fmar: 0.7, kawasaki: 0.68,
  fla: 0.74, pal: 0.72, cor: 0.66, ame: 0.7, mtry: 0.68,
  mil: 0.66, med: 0.64, malmo: 0.7, hammarby: 0.64, bodoe: 0.72, molde: 0.68,
  benfica: 0.76, porto: 0.74, sporting: 0.72, leeds: 0.7, burnley: 0.68,
  miami: 0.72, lafc: 0.7, nyrb: 0.64,
  ajax: 0.78, psv: 0.74, fey: 0.72, twente: 0.66,
  hilal: 0.78, nassr: 0.76, ittihad: 0.72, ahli: 0.7,
};

const FIXTURE_POOL = [
  ['英超', 'ars', 'che', '第3轮'], ['英超', 'liv', 'tot', '第3轮'], ['英超', 'mci', 'mun', '第4轮'], ['英超', 'che', 'liv', '第4轮'],
  ['西甲', 'bar', 'atm', '第3轮'], ['西甲', 'rma', 'atm', '第4轮'], ['西甲', 'atm', 'bar', '第5轮'],
  ['德甲', 'bay', 'rbl', '第3轮'], ['德甲', 'bvb', 'bay', '第4轮'], ['德甲', 'rbl', 'bvb', '第5轮'],
  ['意甲', 'int', 'juv', '第3轮'], ['意甲', 'juv', 'acm', '第4轮'], ['意甲', 'acm', 'int', '第5轮'],
  ['法甲', 'monaco', 'psg', '第2轮'], ['法甲', 'psg', 'monaco', '第3轮'],
  ['韩K联赛', 'junbuk', 'uls', '第25轮'], ['韩K联赛', 'uls', 'junbuk', '第26轮'],
  ['日职联赛', 'fmar', 'kawasaki', '第28轮'], ['日职联赛', 'kobe', 'kawasaki', '第29轮'],
  ['巴西甲', 'pal', 'cor', '第22轮'], ['巴西甲', 'fla', 'cor', '第23轮'],
  ['墨西哥超', 'mtry', 'ame', '第7轮'], ['墨西哥超', 'ame', 'mtry', '第8轮'],
  ['哥伦比亚甲', 'med', 'mil', '第13轮'], ['哥伦比亚甲', 'mil', 'med', '第14轮'],
  ['瑞超', 'hammarby', 'malmo', '第19轮'], ['瑞超', 'malmo', 'hammarby', '第20轮'],
  ['挪超', 'molde', 'bodoe', '第17轮'], ['挪超', 'bodoe', 'molde', '第18轮'],
  ['葡超', 'porto', 'benfica', '第3轮'], ['葡超', 'sporting', 'porto', '第4轮'],
  ['英冠', 'burnley', 'leeds', '第4轮'], ['英冠', 'leeds', 'burnley', '第5轮'],
  ['美职联', 'lafc', 'miami', '常规赛'], ['美职联', 'miami', 'nyrb', '常规赛'],
  ['欧冠', 'mci', 'rma', '小组赛'], ['欧冠', 'bay', 'psg', '小组赛'], ['欧冠', 'bar', 'liv', '小组赛'], ['欧冠', 'int', 'rma', '小组赛'],
  ['荷甲', 'ajax', 'psv', '第4轮'], ['荷甲', 'fey', 'twente', '第4轮'], ['荷甲', 'psv', 'fey', '第5轮'], ['荷甲', 'twente', 'ajax', '第5轮'],
  ['沙特甲', 'hilal', 'nassr', '第3轮'], ['沙特甲', 'ittihad', 'ahli', '第3轮'], ['沙特甲', 'nassr', 'hilal', '第4轮'], ['沙特甲', 'ahli', 'ittihad', '第4轮'],
];

const KICKOFFS = ['19:30', '20:00', '21:00', '22:00', '23:00', '01:00', '08:00'];

/* 为某天生成若干场比赛（offset < 0 为已完场） */
function genDay(offset) {
  const list = [];
  const count = 4 + Math.abs(offset) % 2;
  for (let i = 0; i < count; i++) {
    const idx = (((offset + 3) * 5 + i * 3) % FIXTURE_POOL.length + FIXTURE_POOL.length) % FIXTURE_POOL.length;
    const [competition, hid, aid, round] = FIXTURE_POOL[idx];
    const id = `g-${offset}-${hid}-${aid}`;
    const h = STRENGTH[hid] || 0.7;
    const a = STRENGTH[aid] || 0.7;
    const ph = h / (h + a);

    const homeOdds = +(1.08 / ph).toFixed(2);
    const awayOdds = +(1.08 / (1 - ph)).toFixed(2);
    const drawOdds = +(2.6 + Math.abs(h - a) * 2.2).toFixed(2);
    const odds = [
      { bookmaker: 'bet365', home: homeOdds, draw: drawOdds, away: awayOdds },
      { bookmaker: '威廉希尔', home: +(homeOdds + 0.03).toFixed(2), draw: +(drawOdds - 0.05).toFixed(2), away: +(awayOdds + 0.03).toFixed(2) },
      { bookmaker: '澳门', home: +(homeOdds + 0.02).toFixed(2), draw: drawOdds, away: +(awayOdds + 0.02).toFixed(2) },
      { bookmaker: '必发', home: +(homeOdds - 0.03).toFixed(2), draw: +(drawOdds + 0.06).toFixed(2), away: +(awayOdds - 0.03).toFixed(2) },
    ];
    const line = -Math.round((ph - 0.5) * 8) / 4;
    const ouLine = +(2 + (h + a) * 0.75).toFixed(2);
    const kickoff = KICKOFFS[Math.abs(offset * 3 + i) % KICKOFFS.length];

    const match = {
      id, competition, round, home: hid, away: aid, kickoff,
      status: offset < 0 ? 'finished' : 'upcoming',
      lottery: true,
      ah: { line }, ou: { line: ouLine },
      odds,
    };
    if (offset < 0) {
      const r = seeded(`g-result:${id}`);
      const results = [
        { home: 2, away: 0, xg: { home: 2.1, away: 0.5 } },
        { home: 1, away: 0, xg: { home: 1.4, away: 0.6 } },
        { home: 1, away: 1, xg: { home: 1.1, away: 1.0 } },
        { home: 0, away: 1, xg: { home: 0.6, away: 1.3 } },
        { home: 3, away: 1, xg: { home: 2.6, away: 0.9 } },
        { home: 2, away: 2, xg: { home: 1.8, away: 1.7 } },
      ];
      const s = results[Math.floor(r * results.length)];
      match.score = { home: s.home, away: s.away };
      match.xg = s.xg;
    }
    list.push(match);
  }
  return list;
}

/* ---------- 体彩（竞彩）盘口 ---------- */

/* 欧赔：竞彩抽水较高，赔率约为国际盘口的 0.87 倍 */
function lotteryEurope(m) {
  if (!m.lottery) return { bookmaker: LOTTERY, open: false, home: null, draw: null, away: null };
  const b365 = m.odds.find((o) => o.bookmaker === 'bet365');
  return {
    bookmaker: LOTTERY,
    home: +(b365.home * 0.87).toFixed(2),
    draw: +(b365.draw * 0.87).toFixed(2),
    away: +(b365.away * 0.87).toFixed(2),
  };
}

/* 亚盘：竞彩让球为整数盘口，水位接近 1.8x */
function lotteryAsian(m) {
  if (!m.lottery) return { bookmaker: LOTTERY, open: false, line: null, home: null, away: null };
  return { bookmaker: LOTTERY, line: Math.round(m.ah.line), home: 1.8, away: 1.9 };
}

/* 每场比赛：对阵 + 各公司欧赔 + 亚盘/大小球盘口基准 + 体彩开盘标记 */
const SCHEDULE = {
  0: [
    { id: 'm-ars-liv', competition: '英超', round: '第1轮', home: 'ars', away: 'liv', kickoff: '19:30', status: 'live', lottery: true, ah: { line: -0.25 }, ou: { line: 2.75 },
      odds: [{ bookmaker: 'bet365', home: 2.30, draw: 3.40, away: 3.10 }, { bookmaker: '威廉希尔', home: 2.38, draw: 3.30, away: 3.00 }, { bookmaker: '澳门', home: 2.35, draw: 3.35, away: 3.05 }, { bookmaker: '必发', home: 2.28, draw: 3.45, away: 3.15 }] },
    { id: 'm-mun-che', competition: '英超', round: '第1轮', home: 'mun', away: 'che', kickoff: '19:30', status: 'live', lottery: true, ah: { line: -0.5 }, ou: { line: 2.5 },
      odds: [{ bookmaker: 'bet365', home: 2.15, draw: 3.50, away: 3.40 }, { bookmaker: '威廉希尔', home: 2.20, draw: 3.40, away: 3.30 }, { bookmaker: '澳门', home: 2.18, draw: 3.45, away: 3.35 }, { bookmaker: '必发', home: 2.12, draw: 3.55, away: 3.45 }] },
    { id: 'm-tot-mci', competition: '英超', round: '第1轮', home: 'tot', away: 'mci', kickoff: '22:00', status: 'upcoming', lottery: true, ah: { line: 0.5 }, ou: { line: 3.0 },
      odds: [{ bookmaker: 'bet365', home: 4.00, draw: 3.80, away: 1.85 }, { bookmaker: '威廉希尔', home: 4.20, draw: 3.75, away: 1.80 }, { bookmaker: '澳门', home: 4.10, draw: 3.85, away: 1.83 }, { bookmaker: '必发', home: 3.95, draw: 3.90, away: 1.88 }] },
    { id: 'm-rma-bar', competition: '西甲', round: '第1轮', home: 'rma', away: 'bar', kickoff: '23:00', status: 'upcoming', lottery: true, ah: { line: -0.25 }, ou: { line: 2.75 },
      odds: [{ bookmaker: 'bet365', home: 2.60, draw: 3.60, away: 2.65 }, { bookmaker: '威廉希尔', home: 2.65, draw: 3.50, away: 2.60 }, { bookmaker: '澳门', home: 2.62, draw: 3.55, away: 2.63 }, { bookmaker: '必发', home: 2.55, draw: 3.65, away: 2.70 }] },
    { id: 'm-bay-bvb', competition: '德甲', round: '第1轮', home: 'bay', away: 'bvb', kickoff: '21:30', status: 'upcoming', lottery: true, ah: { line: -1.25 }, ou: { line: 3.25 },
      odds: [{ bookmaker: 'bet365', home: 1.55, draw: 4.20, away: 5.50 }, { bookmaker: '威廉希尔', home: 1.57, draw: 4.00, away: 5.25 }, { bookmaker: '澳门', home: 1.56, draw: 4.10, away: 5.40 }, { bookmaker: '必发', home: 1.52, draw: 4.30, away: 5.70 }] },
    { id: 'm-int-acm', competition: '意甲', round: '第1轮', home: 'int', away: 'acm', kickoff: '21:00', status: 'upcoming', lottery: true, ah: { line: -0.5 }, ou: { line: 2.25 },
      odds: [{ bookmaker: 'bet365', home: 2.40, draw: 3.30, away: 3.00 }, { bookmaker: '威廉希尔', home: 2.45, draw: 3.25, away: 2.95 }, { bookmaker: '澳门', home: 2.42, draw: 3.28, away: 2.98 }, { bookmaker: '必发', home: 2.36, draw: 3.35, away: 3.05 }] },
    { id: 'm-psg-mon', competition: '法甲', round: '第1轮', home: 'psg', away: 'monaco', kickoff: '20:30', status: 'upcoming', lottery: true, ah: { line: -1.25 }, ou: { line: 3.25 },
      odds: [{ bookmaker: 'bet365', home: 1.40, draw: 4.80, away: 7.50 }, { bookmaker: '威廉希尔', home: 1.42, draw: 4.60, away: 7.00 }, { bookmaker: '澳门', home: 1.41, draw: 4.70, away: 7.20 }, { bookmaker: '必发', home: 1.38, draw: 4.90, away: 7.80 }] },
    { id: 'm-uls-junbuk', competition: '韩K联赛', round: '第24轮', home: 'uls', away: 'junbuk', kickoff: '18:00', status: 'upcoming', lottery: true, ah: { line: -0.5 }, ou: { line: 2.5 },
      odds: [{ bookmaker: 'bet365', home: 2.10, draw: 3.20, away: 3.30 }, { bookmaker: '威廉希尔', home: 2.15, draw: 3.15, away: 3.20 }, { bookmaker: '澳门', home: 2.12, draw: 3.18, away: 3.25 }, { bookmaker: '必发', home: 2.05, draw: 3.25, away: 3.40 }] },
    { id: 'm-kobe-fmar', competition: '日职联赛', round: '第27轮', home: 'kobe', away: 'fmar', kickoff: '18:30', status: 'upcoming', lottery: true, ah: { line: -0.5 }, ou: { line: 2.75 },
      odds: [{ bookmaker: 'bet365', home: 2.05, draw: 3.40, away: 3.20 }, { bookmaker: '威廉希尔', home: 2.10, draw: 3.30, away: 3.10 }, { bookmaker: '澳门', home: 2.08, draw: 3.35, away: 3.15 }, { bookmaker: '必发', home: 2.00, draw: 3.45, away: 3.30 }] },
    { id: 'm-fla-pal', competition: '巴西甲', round: '第21轮', home: 'fla', away: 'pal', kickoff: '07:00', status: 'upcoming', lottery: true, ah: { line: -0.25 }, ou: { line: 2.25 },
      odds: [{ bookmaker: 'bet365', home: 2.45, draw: 3.15, away: 2.85 }, { bookmaker: '威廉希尔', home: 2.50, draw: 3.10, away: 2.80 }, { bookmaker: '澳门', home: 2.48, draw: 3.12, away: 2.82 }, { bookmaker: '必发', home: 2.40, draw: 3.20, away: 2.90 }] },
    { id: 'm-ajax-psv', competition: '荷甲', round: '第4轮', home: 'ajax', away: 'psv', kickoff: '21:00', status: 'upcoming', lottery: true, ah: { line: -0.5 }, ou: { line: 3.0 },
      odds: [{ bookmaker: 'bet365', home: 2.30, draw: 3.50, away: 2.90 }, { bookmaker: '威廉希尔', home: 2.35, draw: 3.40, away: 2.80 }, { bookmaker: '澳门', home: 2.32, draw: 3.45, away: 2.85 }, { bookmaker: '必发', home: 2.25, draw: 3.55, away: 2.95 }] },
    { id: 'm-hilal-nassr', competition: '沙特甲', round: '第3轮', home: 'hilal', away: 'nassr', kickoff: '01:00', status: 'upcoming', lottery: true, ah: { line: -0.25 }, ou: { line: 3.0 },
      odds: [{ bookmaker: 'bet365', home: 2.40, draw: 3.40, away: 2.85 }, { bookmaker: '威廉希尔', home: 2.45, draw: 3.30, away: 2.75 }, { bookmaker: '澳门', home: 2.42, draw: 3.35, away: 2.80 }, { bookmaker: '必发', home: 2.35, draw: 3.45, away: 2.90 }] },
  ],
  1: [
    { id: 'm-liv-mun', competition: '英超', round: '第2轮', home: 'liv', away: 'mun', kickoff: '20:00', status: 'upcoming', lottery: true, ah: { line: -1.0 }, ou: { line: 3.0 },
      odds: [{ bookmaker: 'bet365', home: 1.62, draw: 4.00, away: 5.00 }, { bookmaker: '威廉希尔', home: 1.65, draw: 3.90, away: 4.80 }, { bookmaker: '澳门', home: 1.63, draw: 3.95, away: 4.90 }, { bookmaker: '必发', home: 1.60, draw: 4.10, away: 5.10 }] },
    { id: 'm-che-tot', competition: '英超', round: '第2轮', home: 'che', away: 'tot', kickoff: '22:30', status: 'upcoming', lottery: true, ah: { line: -0.25 }, ou: { line: 2.75 },
      odds: [{ bookmaker: 'bet365', home: 2.50, draw: 3.50, away: 2.75 }, { bookmaker: '威廉希尔', home: 2.55, draw: 3.40, away: 2.70 }, { bookmaker: '澳门', home: 2.52, draw: 3.45, away: 2.72 }, { bookmaker: '必发', home: 2.45, draw: 3.55, away: 2.80 }] },
    { id: 'm-bar-atm', competition: '西甲', round: '第2轮', home: 'bar', away: 'atm', kickoff: '23:00', status: 'upcoming', lottery: true, ah: { line: -1.0 }, ou: { line: 2.75 },
      odds: [{ bookmaker: 'bet365', home: 1.50, draw: 4.30, away: 5.80 }, { bookmaker: '威廉希尔', home: 1.52, draw: 4.10, away: 5.50 }, { bookmaker: '澳门', home: 1.51, draw: 4.20, away: 5.60 }, { bookmaker: '必发', home: 1.48, draw: 4.40, away: 6.00 }] },
    { id: 'm-bvb-rbl', competition: '德甲', round: '第2轮', home: 'bvb', away: 'rbl', kickoff: '21:30', status: 'upcoming', lottery: true, ah: { line: -0.25 }, ou: { line: 3.0 },
      odds: [{ bookmaker: 'bet365', home: 2.45, draw: 3.70, away: 2.55 }, { bookmaker: '威廉希尔', home: 2.50, draw: 3.55, away: 2.50 }, { bookmaker: '澳门', home: 2.48, draw: 3.60, away: 2.52 }, { bookmaker: '必发', home: 2.40, draw: 3.75, away: 2.60 }] },
    { id: 'm-acm-juv', competition: '意甲', round: '第2轮', home: 'acm', away: 'juv', kickoff: '21:00', status: 'upcoming', lottery: true, ah: { line: 0 }, ou: { line: 2.25 },
      odds: [{ bookmaker: 'bet365', home: 2.55, draw: 3.10, away: 2.75 }, { bookmaker: '威廉希尔', home: 2.60, draw: 3.00, away: 2.70 }, { bookmaker: '澳门', home: 2.58, draw: 3.05, away: 2.72 }, { bookmaker: '必发', home: 2.50, draw: 3.15, away: 2.80 }] },
    { id: 'm-ame-mtry', competition: '墨西哥超', round: '第6轮', home: 'ame', away: 'mtry', kickoff: '09:00', status: 'upcoming', lottery: false, ah: { line: -0.5 }, ou: { line: 2.5 },
      odds: [{ bookmaker: 'bet365', home: 2.20, draw: 3.30, away: 3.00 }, { bookmaker: '威廉希尔', home: 2.25, draw: 3.20, away: 2.95 }, { bookmaker: '澳门', home: 2.22, draw: 3.25, away: 2.98 }, { bookmaker: '必发', home: 2.15, draw: 3.35, away: 3.05 }] },
    { id: 'm-mil-med', competition: '哥伦比亚甲', round: '第12轮', home: 'mil', away: 'med', kickoff: '08:30', status: 'upcoming', lottery: false, ah: { line: -0.25 }, ou: { line: 2.25 },
      odds: [{ bookmaker: 'bet365', home: 2.35, draw: 3.10, away: 2.90 }, { bookmaker: '威廉希尔', home: 2.40, draw: 3.00, away: 2.85 }, { bookmaker: '澳门', home: 2.38, draw: 3.05, away: 2.88 }, { bookmaker: '必发', home: 2.30, draw: 3.15, away: 2.95 }] },
    { id: 'm-malmo-hammarby', competition: '瑞超', round: '第18轮', home: 'malmo', away: 'hammarby', kickoff: '21:00', status: 'upcoming', lottery: false, ah: { line: -0.75 }, ou: { line: 2.75 },
      odds: [{ bookmaker: 'bet365', home: 1.95, draw: 3.50, away: 3.45 }, { bookmaker: '威廉希尔', home: 2.00, draw: 3.40, away: 3.35 }, { bookmaker: '澳门', home: 1.98, draw: 3.45, away: 3.40 }, { bookmaker: '必发', home: 1.90, draw: 3.60, away: 3.55 }] },
    { id: 'm-bodoe-molde', competition: '挪超', round: '第16轮', home: 'bodoe', away: 'molde', kickoff: '01:00', status: 'upcoming', lottery: false, ah: { line: -0.5 }, ou: { line: 2.75 },
      odds: [{ bookmaker: 'bet365', home: 2.05, draw: 3.60, away: 3.10 }, { bookmaker: '威廉希尔', home: 2.10, draw: 3.45, away: 3.00 }, { bookmaker: '澳门', home: 2.08, draw: 3.50, away: 3.05 }, { bookmaker: '必发', home: 2.00, draw: 3.65, away: 3.20 }] },
    { id: 'm-benfica-porto', competition: '葡超', round: '第2轮', home: 'benfica', away: 'porto', kickoff: '22:00', status: 'upcoming', lottery: true, ah: { line: -0.5 }, ou: { line: 2.5 },
      odds: [{ bookmaker: 'bet365', home: 2.10, draw: 3.30, away: 3.30 }, { bookmaker: '威廉希尔', home: 2.15, draw: 3.20, away: 3.20 }, { bookmaker: '澳门', home: 2.12, draw: 3.25, away: 3.25 }, { bookmaker: '必发', home: 2.05, draw: 3.35, away: 3.40 }] },
    { id: 'm-leeds-burnley', competition: '英冠', round: '第3轮', home: 'leeds', away: 'burnley', kickoff: '19:30', status: 'upcoming', lottery: true, ah: { line: -0.5 }, ou: { line: 2.5 },
      odds: [{ bookmaker: 'bet365', home: 2.15, draw: 3.25, away: 3.20 }, { bookmaker: '威廉希尔', home: 2.20, draw: 3.15, away: 3.10 }, { bookmaker: '澳门', home: 2.18, draw: 3.20, away: 3.15 }, { bookmaker: '必发', home: 2.10, draw: 3.30, away: 3.25 }] },
    { id: 'm-miami-lafc', competition: '美职联', round: '常规赛', home: 'miami', away: 'lafc', kickoff: '08:00', status: 'upcoming', lottery: true, ah: { line: -0.25 }, ou: { line: 3.0 },
      odds: [{ bookmaker: 'bet365', home: 2.30, draw: 3.60, away: 2.65 }, { bookmaker: '威廉希尔', home: 2.35, draw: 3.45, away: 2.60 }, { bookmaker: '澳门', home: 2.32, draw: 3.50, away: 2.62 }, { bookmaker: '必发', home: 2.25, draw: 3.65, away: 2.70 }] },
    { id: 'm-rma-mci', competition: '欧冠', round: '小组赛', home: 'rma', away: 'mci', kickoff: '23:30', status: 'upcoming', lottery: true, ah: { line: -0.25 }, ou: { line: 2.75 },
      odds: [{ bookmaker: 'bet365', home: 2.35, draw: 3.45, away: 2.85 }, { bookmaker: '威廉希尔', home: 2.40, draw: 3.30, away: 2.80 }, { bookmaker: '澳门', home: 2.38, draw: 3.35, away: 2.82 }, { bookmaker: '必发', home: 2.30, draw: 3.50, away: 2.90 }] },
    { id: 'm-fey-twente', competition: '荷甲', round: '第4轮', home: 'fey', away: 'twente', kickoff: '20:00', status: 'upcoming', lottery: true, ah: { line: -1.0 }, ou: { line: 2.75 },
      odds: [{ bookmaker: 'bet365', home: 1.62, draw: 4.00, away: 5.20 }, { bookmaker: '威廉希尔', home: 1.65, draw: 3.90, away: 5.00 }, { bookmaker: '澳门', home: 1.63, draw: 3.95, away: 5.10 }, { bookmaker: '必发', home: 1.60, draw: 4.10, away: 5.40 }] },
    { id: 'm-ittihad-ahli', competition: '沙特甲', round: '第3轮', home: 'ittihad', away: 'ahli', kickoff: '02:00', status: 'upcoming', lottery: true, ah: { line: -0.25 }, ou: { line: 2.5 },
      odds: [{ bookmaker: 'bet365', home: 2.45, draw: 3.30, away: 2.90 }, { bookmaker: '威廉希尔', home: 2.50, draw: 3.20, away: 2.80 }, { bookmaker: '澳门', home: 2.48, draw: 3.25, away: 2.85 }, { bookmaker: '必发', home: 2.40, draw: 3.35, away: 2.95 }] },
  ],
  '-1': [
    { id: 'm-mci-che', competition: '英超', round: '第1轮', home: 'mci', away: 'che', kickoff: '19:30', status: 'finished', lottery: true, score: { home: 2, away: 1 }, xg: { home: 2.4, away: 0.9 }, ah: { line: -1.75 }, ou: { line: 3.0 },
      odds: [{ bookmaker: 'bet365', home: 1.28, draw: 5.50, away: 10.00 }, { bookmaker: '威廉希尔', home: 1.30, draw: 5.25, away: 9.50 }, { bookmaker: '澳门', home: 1.29, draw: 5.40, away: 9.80 }, { bookmaker: '必发', home: 1.26, draw: 5.60, away: 10.50 }] },
    { id: 'm-kawasaki-kobe', competition: '日职联赛', round: '第26轮', home: 'kawasaki', away: 'kobe', kickoff: '18:00', status: 'finished', lottery: true, score: { home: 1, away: 0 }, xg: { home: 1.6, away: 0.5 }, ah: { line: -0.5 }, ou: { line: 2.5 },
      odds: [{ bookmaker: 'bet365', home: 2.30, draw: 3.20, away: 2.90 }, { bookmaker: '威廉希尔', home: 2.35, draw: 3.10, away: 2.85 }, { bookmaker: '澳门', home: 2.32, draw: 3.15, away: 2.88 }, { bookmaker: '必发', home: 2.25, draw: 3.25, away: 2.95 }] },
    { id: 'm-porto-sporting', competition: '葡超', round: '第1轮', home: 'porto', away: 'sporting', kickoff: '22:00', status: 'finished', lottery: true, score: { home: 2, away: 0 }, xg: { home: 1.9, away: 0.6 }, ah: { line: -0.75 }, ou: { line: 2.5 },
      odds: [{ bookmaker: 'bet365', home: 1.85, draw: 3.50, away: 4.20 }, { bookmaker: '威廉希尔', home: 1.88, draw: 3.40, away: 4.00 }, { bookmaker: '澳门', home: 1.86, draw: 3.45, away: 4.10 }, { bookmaker: '必发', home: 1.82, draw: 3.60, away: 4.30 }] },
    { id: 'm-nyrb-miami', competition: '美职联', round: '常规赛', home: 'nyrb', away: 'miami', kickoff: '08:00', status: 'finished', lottery: true, score: { home: 1, away: 2 }, xg: { home: 0.8, away: 1.8 }, ah: { line: 0.25 }, ou: { line: 2.75 },
      odds: [{ bookmaker: 'bet365', home: 2.80, draw: 3.60, away: 2.30 }, { bookmaker: '威廉希尔', home: 2.85, draw: 3.45, away: 2.25 }, { bookmaker: '澳门', home: 2.82, draw: 3.50, away: 2.28 }, { bookmaker: '必发', home: 2.75, draw: 3.65, away: 2.35 }] },
    { id: 'm-cor-fla', competition: '巴西甲', round: '第20轮', home: 'cor', away: 'fla', kickoff: '07:00', status: 'finished', lottery: true, score: { home: 0, away: 1 }, xg: { home: 0.5, away: 1.5 }, ah: { line: 0.25 }, ou: { line: 2.25 },
      odds: [{ bookmaker: 'bet365', home: 3.00, draw: 3.10, away: 2.35 }, { bookmaker: '威廉希尔', home: 3.05, draw: 3.00, away: 2.30 }, { bookmaker: '澳门', home: 3.02, draw: 3.05, away: 2.32 }, { bookmaker: '必发', home: 2.95, draw: 3.15, away: 2.40 }] },
    { id: 'm-rma-bvb', competition: '欧冠', round: '季前热身', home: 'rma', away: 'bvb', kickoff: '23:00', status: 'finished', lottery: true, score: { home: 3, away: 0 }, xg: { home: 2.9, away: 0.4 }, ah: { line: -1.25 }, ou: { line: 3.0 },
      odds: [{ bookmaker: 'bet365', home: 1.45, draw: 4.50, away: 6.50 }, { bookmaker: '威廉希尔', home: 1.47, draw: 4.30, away: 6.20 }, { bookmaker: '澳门', home: 1.46, draw: 4.40, away: 6.35 }, { bookmaker: '必发', home: 1.42, draw: 4.60, away: 6.80 }] },
    { id: 'm-psv-fey', competition: '荷甲', round: '第3轮', home: 'psv', away: 'fey', kickoff: '21:00', status: 'finished', lottery: true, score: { home: 2, away: 1 }, xg: { home: 1.9, away: 1.0 }, ah: { line: -0.5 }, ou: { line: 2.75 },
      odds: [{ bookmaker: 'bet365', home: 2.20, draw: 3.50, away: 3.10 }, { bookmaker: '威廉希尔', home: 2.25, draw: 3.40, away: 3.00 }, { bookmaker: '澳门', home: 2.22, draw: 3.45, away: 3.05 }, { bookmaker: '必发', home: 2.15, draw: 3.55, away: 3.15 }] },
    { id: 'm-nassr-hilal', competition: '沙特甲', round: '第2轮', home: 'nassr', away: 'hilal', kickoff: '01:00', status: 'finished', lottery: true, score: { home: 1, away: 1 }, xg: { home: 1.2, away: 1.5 }, ah: { line: 0.25 }, ou: { line: 2.75 },
      odds: [{ bookmaker: 'bet365', home: 2.75, draw: 3.30, away: 2.50 }, { bookmaker: '威廉希尔', home: 2.80, draw: 3.20, away: 2.45 }, { bookmaker: '澳门', home: 2.78, draw: 3.25, away: 2.48 }, { bookmaker: '必发', home: 2.70, draw: 3.35, away: 2.55 }] },
  ],
};

/* 完整赛程：过去 3 天（-3/-2）由生成器补充，-1/0/1 为手写重点场次，未来 7 天（+2..+7）由生成器补充 */
const EXTENDED_SCHEDULE = {
  '-3': genDay(-3),
  '-2': genDay(-2),
  ...SCHEDULE,
  '2': genDay(2),
  '3': genDay(3),
  '4': genDay(4),
  '5': genDay(5),
  '6': genDay(6),
  '7': genDay(7),
};

/* 构建完整的比赛对象（注入球队信息、开球时间戳与四类赔率） */
function buildMatches() {
  const today = shiftDays(0);
  const all = [];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  for (const [offset, list] of Object.entries(EXTENDED_SCHEDULE)) {
    const date = shiftDays(Number(offset));
    for (const m of list) {
      const [h, min] = m.kickoff.split(':').map(Number);
      const kick = new Date(todayStart);
      kick.setDate(todayStart.getDate() + Number(offset));
      kick.setHours(h, min, 0, 0);
      all.push({
        id: m.id,
        date,
        competition: m.competition,
        round: m.round,
        home: teamMap.get(m.home),
        away: teamMap.get(m.away),
        kickoff: m.kickoff,
        kickoffTs: kick.getTime(),
        status: m.status,
        score: m.score ? { ...m.score } : { home: 0, away: 0 },
        xg: m.xg ? { ...m.xg } : { home: 0, away: 0 },
        minute: m.status === 'live' ? 0 : null,
        odds: {
          europe: [...withCrown(m.odds), lotteryEurope(m)],
          asian: genAsianHandicap(m.id, m.ah.line, INTERNATIONAL),
          total: genTotal(m.id, m.ou.line, INTERNATIONAL),
          corners: genCorners(m.id, INTERNATIONAL),
        },
        events: [],
      });
    }
  }
  return { today, all };
}

module.exports = { buildMatches, BOOKMAKERS, BIG_FIVE, OTHER_LEAGUES };
