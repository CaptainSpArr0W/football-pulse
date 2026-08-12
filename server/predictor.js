/* 比赛预测引擎：Dixon-Coles 泊松模型（借鉴 GitHub 开源预测模型方案）
 * 用 2025-26 五大联赛逐场比赛数据（understat-xg.json）拟合球队攻击/防守强度，
 * 预测 2026-27 赛季每场比赛的：胜平负 / 大小球(2.5) / 亚盘赢盘
 */
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'understat-xg.json');
const ZH = require('./data/team-names'); // module.exports = ZH

/* 联赛中文名 → code（与 competitions.js CODES 一致） */
const COMP_CODE = { 英超: 'PL', 西甲: 'PD', 德甲: 'BL1', 意甲: 'SA', 法甲: 'FL1' };
/* 联赛 code → understat-xg.json key */
const US_KEY = { PL: 'ENG-Premier League', PD: 'ESP-La Liga', BL1: 'GER-Bundesliga', SA: 'ITA-Serie A', FL1: 'FRA-Ligue 1' };

/* 中文球队名 → 全部候选英文键（反向查 team-names ZH） */
const zhToEnCache = {};
function zhToEn(name) {
  if (!name) return [];
  const low = String(name).toLowerCase().trim();
  if (zhToEnCache[low]) return zhToEnCache[low];
  const hits = [];
  for (const [k, v] of Object.entries(ZH)) {
    if (String(v).toLowerCase() === low) hits.push(k);
  }
  if (!hits.length) hits.push(low); /* 本身即英文名 */
  zhToEnCache[low] = hits;
  return hits;
}

/* ---------- 模型拟合 ---------- */
const RAW = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

function buildLeagueModel(usKey) {
  const matches = RAW[usKey] || [];
  const teamGF = {};   // 球队总进球
  const teamGA = {};   // 球队总失球
  const teamPlayed = {};
  const homeGoals = [], awayGoals = [];

  for (const m of matches) {
    if (m.home_goals == null) continue;
    const h = m.home, a = m.away;
    homeGoals.push(m.home_goals);
    awayGoals.push(m.away_goals);
    teamGF[h] = (teamGF[h] || 0) + m.home_goals;
    teamGA[h] = (teamGA[h] || 0) + m.away_goals;
    teamGF[a] = (teamGF[a] || 0) + m.away_goals;
    teamGA[a] = (teamGA[a] || 0) + m.home_goals;
    teamPlayed[h] = (teamPlayed[h] || 0) + 1;
    teamPlayed[a] = (teamPlayed[a] || 0) + 1;
  }

  const n = matches.length;
  const muHome = n ? homeGoals.reduce((s, g) => s + g, 0) / n : 1.4;
  const muAway = n ? awayGoals.reduce((s, g) => s + g, 0) / n : 1.1;
  const tot = n * 2;
  const muAll = tot ? (homeGoals.reduce((s, g) => s + g, 0) + awayGoals.reduce((s, g) => s + g, 0)) / tot : 1.25;

  /* 攻击/防守强度：以联赛平均为基准的对数比率，两次迭代平滑 + 收缩（防极端值） */
  const teams = Object.keys(teamPlayed);
  const SHRINK = 0.55;
  const attack = {}, defense = {};
  for (const t of teams) {
    const played = teamPlayed[t] || 1;
    const gf90 = teamGF[t] / played;
    const ga90 = teamGA[t] / played;
    attack[t] = Math.log(Math.max(gf90, 0.05) / muAll) * SHRINK;
    defense[t] = Math.log(Math.max(ga90, 0.05) / muAll) * SHRINK;
  }
  /* 居中（联赛均值为 0） */
  const aMean = teams.reduce((s, t) => s + attack[t], 0) / (teams.length || 1);
  const dMean = teams.reduce((s, t) => s + defense[t], 0) / (teams.length || 1);
  for (const t of teams) {
    attack[t] -= aMean;
    defense[t] -= dMean;
  }

  return { teams, attack, defense, muHome, muAway, muAll, homeAdv: Math.log(muHome / Math.max(muAway, 0.01)) };
}

const MODELS = {};
for (const code of Object.keys(US_KEY)) MODELS[code] = buildLeagueModel(US_KEY[code]);

/* ---------- 预测 ---------- */
const MAX_GOALS = 7;      // 比分矩阵上限
const RHO = -0.05;        // Dixon-Coles 低比分修正系数（固定经验值）

function poissonPmf(lambda, k) {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

/* Dixon-Coles τ 修正：0-0, 1-0, 0-1, 1-1 */
function tau(x, y, lh, la) {
  if (x === 0 && y === 0) return 1 - lh * la * RHO;
  if (x === 0 && y === 1) return 1 + lh * RHO;
  if (x === 1 && y === 0) return 1 + la * RHO;
  if (x === 1 && y === 1) return 1 - RHO;
  return 1;
}

/* 生成比分矩阵 */
function scoreMatrix(lh, la) {
  const M = [];
  for (let i = 0; i <= MAX_GOALS; i++) {
    M[i] = [];
    for (let j = 0; j <= MAX_GOALS; j++) {
      M[i][j] = poissonPmf(lh, i) * poissonPmf(la, j) * tau(i, j, lh, la);
    }
  }
  /* 归一化 */
  let sum = 0;
  for (let i = 0; i <= MAX_GOALS; i++) for (let j = 0; j <= MAX_GOALS; j++) sum += M[i][j];
  for (let i = 0; i <= MAX_GOALS; i++) for (let j = 0; j <= MAX_GOALS; j++) M[i][j] /= sum;
  return M;
}

/* 亚盘：让球线取主客实力差（主场视角，负=主让），压缩系数 0.55，就近半档 */
function asianLine(diff) {
  const target = -Math.round((diff * 0.55) * 2) / 2;
  const steps = [-2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5];
  let best = 0, bestDist = Infinity;
  for (const s of steps) {
    const d = Math.abs(s - target);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return best;
}

/* 每 90 分钟预期进球 + 预测 */
function predictMatch(competition, homeZh, awayZh) {
  const code = COMP_CODE[competition];
  if (!code || !MODELS[code]) return null;
  const model = MODELS[code];
  const hCands = zhToEn(homeZh);
  const aCands = zhToEn(awayZh);

  /* 英文名小写规范化匹配模型球队 */
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '').replace(/united/g, 'utd');
  const teamKey = {};
  for (const t of model.teams) teamKey[norm(t)] = t;
  let hk = null, ak = null;
  for (const c of hCands) { const nk = teamKey[norm(c)]; if (nk) { hk = nk; break; } }
  for (const c of aCands) { const nk = teamKey[norm(c)]; if (nk) { ak = nk; break; } }
  if (!hk || !ak) return null;

  const attH = model.attack[hk] || 0, defH = model.defense[hk] || 0;
  const attA = model.attack[ak] || 0, defA = model.defense[ak] || 0;

  const lh = Math.max(0.05, model.muHome * Math.exp(attH - defA));
  const la = Math.max(0.05, model.muAway * Math.exp(attA - defH));
  const M = scoreMatrix(lh, la);

  /* 胜平负 */
  let pHome = 0, pDraw = 0, pAway = 0;
  for (let i = 0; i <= MAX_GOALS; i++) for (let j = 0; j <= MAX_GOALS; j++) {
    if (i > j) pHome += M[i][j];
    else if (i === j) pDraw += M[i][j];
    else pAway += M[i][j];
  }
  const x12 = [['主胜', pHome], ['平局', pDraw], ['客胜', pAway]]
    .map(([k, v]) => ({ label: k, prob: Math.round(v * 1000) / 10 }))
    .sort((a, b) => b.prob - a.prob);
  const x12Pick = x12[0];

  /* 大小球 2.5 */
  let pOver = 0;
  for (let i = 0; i <= MAX_GOALS; i++) for (let j = 0; j <= MAX_GOALS; j++) if (i + j >= 3) pOver += M[i][j];
  const ou = {
    line: 2.5,
    over: Math.round(pOver * 1000) / 10,
    under: Math.round((1 - pOver) * 1000) / 10,
    pick: pOver >= 0.5 ? '大' : '小',
  };

  /* 亚盘（主队视角） */
  const line = asianLine(lh - la);
  let pHomeCover = 0;
  for (let i = 0; i <= MAX_GOALS; i++) for (let j = 0; j <= MAX_GOALS; j++) {
    const hh = i + (line < 0 ? line : 0);
    const aa = j + (line > 0 ? line : 0);
    if (hh > aa) pHomeCover += M[i][j];
    /* 平半/半球类只分胜负；整数盘平局走盘，此处归入走盘不计 */
  }
  const asian = {
    line,
    lineText: line === 0 ? '平手' : line < 0 ? `主让 ${-line}` : `主受 ${line}`,
    homeCover: Math.round(pHomeCover * 1000) / 10,
    awayCover: Math.round((1 - pHomeCover) * 1000) / 10,
    pick: pHomeCover >= 0.5 ? '主队' : '客队',
  };

  return {
    league: competition,
    expGoals: { home: Math.round(lh * 100) / 100, away: Math.round(la * 100) / 100 },
    x12, x12Pick,
    ou,
    asian,
  };
}

/* 缓存（1 小时） */
let cache = { ts: 0, data: {} };
const CACHE_MS = 3600 * 1000;

function predictionsForDate(dateStr, matches) {
  const now = Date.now();
  if (now - cache.ts > CACHE_MS) { cache = { ts: now, data: {} }; }
  if (cache.data[dateStr]) return cache.data[dateStr];
  const out = [];
  for (const m of matches) {
    if (m.status !== 'upcoming') continue;
    const hName = m._homeName || (m.home && m.home.name);
    const aName = m._awayName || (m.away && m.away.name);
    const pred = predictMatch(m.competition, hName, aName);
    if (pred) out.push({ id: m.id, competition: m.competition, home: hName, away: aName, pred });
  }
  cache.data[dateStr] = out;
  return out;
}

module.exports = { predictMatch, predictionsForDate, zhToEn };
