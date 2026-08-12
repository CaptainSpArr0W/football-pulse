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

/* ---------- 赔率融合：把 ODDS 网站最新赔率（隐含概率去水）与模型概率按 5:5 融合 ---------- */
const MARKET_WEIGHT = 0.5;

/* 欧赔 → [主胜, 平, 客胜] 隐含概率（去水归一化） */
function europeImplied(odds) {
  const e = odds && odds.europe && odds.europe.find((o) => o.open !== false);
  if (!e || !(e.home > 1) || !(e.draw > 1) || !(e.away > 1)) return null;
  const raw = [1 / e.home, 1 / e.draw, 1 / e.away];
  const s = raw[0] + raw[1] + raw[2];
  return s > 0 ? raw.map((v) => v / s) : null;
}
/* 大小球盘口 → over 隐含概率（取最接近 line 的盘口） */
function totalImplied(odds, line) {
  const arr = odds && odds.total;
  if (!arr || !arr.length) return null;
  let best = null, bd = Infinity;
  for (const o of arr) {
    if (o.line == null) continue;
    const d = Math.abs(o.line - line);
    if (d < bd) { bd = d; best = o; }
  }
  if (!best || !(best.over > 1) || !(best.under > 1)) return null;
  const po = 1 / best.over, pu = 1 / best.under;
  const s = po + pu;
  return s > 0 ? { pOver: po / s, marketLine: best.line } : null;
}
/* 亚盘 → 主队赢盘隐含概率（取最接近模型让球线的盘口） */
function asianImplied(odds, line) {
  const arr = odds && odds.asian;
  if (!arr || !arr.length) return null;
  let best = null, bd = Infinity;
  for (const o of arr) {
    if (o.line == null) continue;
    const d = Math.abs(o.line - line);
    if (d < bd) { bd = d; best = o; }
  }
  if (!best || !(best.home > 1) || !(best.away > 1)) return null;
  const ph = 1 / best.home, pa = 1 / best.away;
  const s = ph + pa;
  return s > 0 ? { pHome: ph / s, marketLine: best.line } : null;
}

const blend = (a, b) => (b == null ? a : a * (1 - MARKET_WEIGHT) + b * MARKET_WEIGHT);

/* 每 90 分钟预期进球 + 预测（odds 为可选的最新赔率，用于融合校准） */
function predictMatch(competition, homeZh, awayZh, odds) {
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

  /* 胜平负（模型 + 欧赔融合） */
  let pHome = 0, pDraw = 0, pAway = 0;
  for (let i = 0; i <= MAX_GOALS; i++) for (let j = 0; j <= MAX_GOALS; j++) {
    if (i > j) pHome += M[i][j];
    else if (i === j) pDraw += M[i][j];
    else pAway += M[i][j];
  }
  let fused = false;
  const eImpl = europeImplied(odds);
  if (eImpl) {
    pHome = blend(pHome, eImpl[0]);
    pDraw = blend(pDraw, eImpl[1]);
    pAway = blend(pAway, eImpl[2]);
    fused = true;
  }
  const x12 = [['主胜', pHome], ['平局', pDraw], ['客胜', pAway]]
    .map(([k, v]) => ({ label: k, prob: Math.round(v * 1000) / 10 }))
    .sort((a, b) => b.prob - a.prob);
  const x12Pick = x12[0];

  /* 大小球 2.5（模型 + 大小盘口融合） */
  let pOver = 0;
  for (let i = 0; i <= MAX_GOALS; i++) for (let j = 0; j <= MAX_GOALS; j++) if (i + j >= 3) pOver += M[i][j];
  let ouLine = 2.5;
  const tImpl = totalImplied(odds, 2.5);
  if (tImpl) { pOver = blend(pOver, tImpl.pOver); ouLine = tImpl.marketLine || 2.5; fused = true; }
  const ou = {
    line: ouLine,
    over: Math.round(pOver * 1000) / 10,
    under: Math.round((1 - pOver) * 1000) / 10,
    pick: pOver >= 0.5 ? '大' : '小',
  };

  /* 亚盘（主队视角；模型让球线 + 市场盘口融合） */
  let line = asianLine(lh - la);
  const aImpl = asianImplied(odds, line);
  if (aImpl) { line = aImpl.marketLine; fused = true; }
  const lineText = line === 0 ? '平手' : line < 0 ? `主让 ${-line}` : `主受 ${line}`;
  let pHomeCover = 0;
  for (let i = 0; i <= MAX_GOALS; i++) for (let j = 0; j <= MAX_GOALS; j++) {
    const hh = i + (line < 0 ? line : 0);
    const aa = j + (line > 0 ? line : 0);
    if (hh > aa) pHomeCover += M[i][j];
  }
  if (aImpl) pHomeCover = blend(pHomeCover, aImpl.pHome);
  const asian = {
    line,
    lineText,
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
    fused, // 是否已融合最新赔率
  };
}

/* ---------- 预测记录（全赛季日志，供赛后结算统计；不对外展示） ---------- */
const LOG_FILE = path.join(__dirname, 'data', 'predictions-log.json');
let logCache = null;
function loadLog() {
  if (logCache) return logCache;
  try { logCache = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); }
  catch (_) { logCache = { season: '2026-27', records: [] }; }
  return logCache;
}
function saveLog() {
  try { fs.writeFileSync(LOG_FILE, JSON.stringify(logCache, null, 1), 'utf8'); }
  catch (_) { /* 写失败不影响主流程 */ }
}
function logPrediction(entry) {
  const log = loadLog();
  const idx = log.records.findIndex((r) => r.id === entry.id);
  if (idx >= 0) {
    /* 已记录：仅更新预测字段（未结算前允许随赔率调整），保留结算字段 */
    const r = log.records[idx];
    if (r.settled) return;
    Object.assign(r, entry, { actual: r.actual, settled: r.settled, hitX12: r.hitX12, hitOU: r.hitOU, hitAsian: r.hitAsian });
    r.updates = (r.updates || 0) + 1;
  } else {
    entry.updates = 0;
    log.records.push(entry);
  }
  saveLog();
}

/* 缓存（1 小时；赔率更新后调用 invalidateCache 强制重算） */
let cache = { ts: 0, data: {} };
const CACHE_MS = 3600 * 1000;
function invalidateCache() { cache = { ts: 0, data: {} }; }

function predictionsForDate(dateStr, matches) {
  const now = Date.now();
  if (now - cache.ts > CACHE_MS) { cache = { ts: now, data: {} }; }
  if (cache.data[dateStr]) return cache.data[dateStr];
  const out = [];
  for (const m of matches) {
    if (m.status !== 'upcoming') continue;
    const hName = m._homeName || (m.home && m.home.name);
    const aName = m._awayName || (m.away && m.away.name);
    const pred = predictMatch(m.competition, hName, aName, m.odds);
    if (pred) {
      out.push({ id: m.id, competition: m.competition, home: hName, away: aName, pred });
      logPrediction({
        id: String(m.id), date: dateStr, competition: m.competition,
        home: hName, away: aName,
        predX12: pred.x12Pick.label, predX12Prob: pred.x12Pick.prob,
        expHome: pred.expGoals.home, expAway: pred.expGoals.away,
        predOU: pred.ou.pick, overProb: pred.ou.over, underProb: pred.ou.under,
        asianLine: pred.asian.lineText, predAsian: pred.asian.pick,
        predAsianHome: pred.asian.homeCover, predAsianAway: pred.asian.awayCover,
        fused: pred.fused || false,
        actual: null, settled: false, hitX12: null, hitOU: null, hitAsian: null,
      });
    }
  }
  cache.data[dateStr] = out;
  return out;
}

/* 双节点更新：赔率刷新（早盘/临场）后，用最新赔率重新预测并更新日志（未结算） */
function refreshWithOdds(matches) {
  const log = loadLog();
  let changed = 0;
  const byDate = {};
  for (const m of matches) {
    if (m.status !== 'upcoming') continue;
    const d = m.date;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(m);
  }
  invalidateCache();
  for (const d of Object.keys(byDate)) {
    predictionsForDate(d, byDate[d]); // 重算 + upsert 日志
    changed += byDate[d].length;
  }
  return changed;
}

/* 赛后结算：回填实际比分并判定三项命中（幂等，仅未结算记录） */
function settleFinishedMatches(finishedMatches) {
  const log = loadLog();
  let changed = false;
  for (const m of finishedMatches) {
    const rec = log.records.find((r) => !r.settled && r.id === String(m.id));
    if (!rec || !m.score) continue;
    const h = Number(m.score.home), a = Number(m.score.away);
    if (isNaN(h) || isNaN(a)) continue;
    rec.actual = { home: h, away: a };
    rec.settled = true;
    /* 胜平负 */
    const res = h > a ? '主胜' : h < a ? '客胜' : '平局';
    rec.hitX12 = rec.predX12 === res;
    /* 大小球 2.5 */
    rec.hitOU = (h + a >= 3) ? rec.predOU === '大' : rec.predOU === '小';
    /* 亚盘：主队让球（line 文本解析）后净胜判定，平手盘走盘不计命中 */
    const lineMatch = /主让\s*([\d.]+)/.exec(rec.asianLine);
    const lineHome = lineMatch ? -parseFloat(lineMatch[1]) : 0;
    const lineAway = /主受\s*([\d.]+)/.test(rec.asianLine) ? parseFloat(/主受\s*([\d.]+)/.exec(rec.asianLine)[1]) : 0;
    const line = lineHome + lineAway; // 主队让球视角：负=让
    const net = h - a + line;
    if (net > 0) rec.hitAsian = rec.predAsian === '主队' ? true : false;
    else if (net < 0) rec.hitAsian = rec.predAsian === '客队' ? true : false;
    else rec.hitAsian = null; // 走盘
    changed = true;
  }
  if (changed) saveLog();
  return changed;
}

/* 导出统计 CSV（UTF-8 BOM，Excel 兼容；含明细行 + 汇总行） */
function exportCsv() {
  const log = loadLog();
  const recs = log.records;
  const rows = [['日期', '联赛', '主队', '客队', '预测胜平负', '概率%', '预测大小球', '大球%', '小球%',
    '亚盘', '预测赢盘方', '主队赢盘%', '实际比分', '实际结果', '胜平负命中', '大小球命中', '亚盘命中']];
  for (const r of recs) {
    rows.push([
      r.date, r.competition, r.home, r.away,
      r.predX12, r.predX12Prob, r.predOU, r.overProb, r.underProb,
      r.asianLine, r.predAsian, r.predAsianHome,
      r.actual ? `${r.actual.home}:${r.actual.away}` : '',
      r.actual ? (r.actual.home > r.actual.away ? '主胜' : r.actual.home < r.actual.away ? '客胜' : '平局') : '',
      r.hitX12 == null ? '' : (r.hitX12 ? '✓' : '✗'),
      r.hitOU == null ? '' : (r.hitOU ? '✓' : '✗'),
      r.hitAsian == null ? '' : (r.hitAsian ? '✓' : '✗'),
    ]);
  }
  /* 汇总统计 */
  const settled = recs.filter((r) => r.settled);
  const rate = (list) => (list.length ? `${(list.filter(Boolean).length / list.length * 100).toFixed(1)}%` : '--');
  const hitCount = (list) => list.filter(Boolean).length;
  const rateTxt = (list) => `${hitCount(list)}/${list.length}（${rate(list)}）`;
  rows.push([]);
  rows.push(['=== 统计汇总 ===']);
  rows.push(['已结算场次', settled.length, '', '', '未结算', recs.length - settled.length]);
  rows.push(['胜平负命中率', rateTxt(settled.map((r) => r.hitX12))]);
  rows.push(['大小球命中率', rateTxt(settled.map((r) => r.hitOU))]);
  rows.push(['亚盘命中率', rateTxt(settled.map((r) => r.hitAsian))]);
  rows.push(['生成时间', new Date().toLocaleString('zh-CN')]);
  return '\uFEFF' + rows.map((r) => r.map((c) => {
    const s = String(c == null ? '' : c);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\r\n');
}

module.exports = { predictMatch, predictionsForDate, refreshWithOdds, settleFinishedMatches, exportCsv, zhToEn };
