/*
 * The Odds API 赔率数据源（免费档 500 次/月）
 * - 联赛 → sport key：英超 soccer_epl / 西甲 soccer_spain_la_liga / 德甲 soccer_germany_bundesliga / 意甲 soccer_italy_serie_a / 法甲 soccer_france_ligue_one
 * - 仅提供未来比赛赔率（历史比赛无赔率）
 * - 市场：h2h（欧赔 1X2）/ spreads（亚盘让球）/ totals（大小球）
 * - 缓存 10 分钟；每次调用消耗配额，正式模式每 15 分钟刷新一次
 */
const fs = require('fs');
const path = require('path');
const httpcache = require('./httpcache');

const LEAGUE_SPORT = {
  英超: 'soccer_epl',
  西甲: 'soccer_spain_la_liga',
  德甲: 'soccer_germany_bundesliga',
  意甲: 'soccer_italy_serie_a',
  法甲: 'soccer_france_ligue_one',
};

let KEY = '';
function config() {
  if (KEY) return KEY;
  try {
    const c = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'odds-api-config.json'), 'utf8'));
    if (c.enabled && c.key) KEY = c.key;
  } catch (_) { KEY = ''; }
  return KEY;
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
function nameMatch(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length > 5 && y.length > 5 && (x.includes(y) || y.includes(x))) return true;
  return false;
}

async function fetchLeagueOdds(league) {
  const sport = LEAGUE_SPORT[league];
  if (!sport) return [];
  const key = 'odds-api:' + league;
  const cached = httpcache.get(key);
  if (cached !== undefined) return cached;
  const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${config()}&regions=eu&markets=h2h,totals,spreads&oddsFormat=decimal`;
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`odds-api HTTP ${res.status}`);
  const j = await res.json();
  httpcache.set(key, j, 10 * 60 * 1000);
  return Array.isArray(j) ? j : [];
}

/* 单场比赛 → 站点 odds 格式 */
function mapOdds(g) {
  const odds = { europe: [], asian: [], total: [], corners: [] };
  for (const bm of g.bookmakers || []) {
    const bk = bm.key || 'odds';
    for (const m of bm.markets || []) {
      if (m.key === 'h2h') {
        let home, draw, away;
        for (const o of m.outcomes || []) {
          if (nameMatch(o.name, g.home_team)) home = o.price;
          else if (nameMatch(o.name, g.away_team)) away = o.price;
          else if (/draw/i.test(o.name)) draw = o.price;
        }
        if (home && away && draw) odds.europe.push({ bookmaker: bk, home, draw, away, open: true });
      } else if (m.key === 'spreads') {
        let line, home, away;
        for (const o of m.outcomes || []) {
          if (nameMatch(o.name, g.home_team)) { line = o.point != null ? o.point : 0; home = o.price; }
          else if (nameMatch(o.name, g.away_team)) away = o.price;
        }
        if (line != null && home && away) odds.asian.push({ bookmaker: bk, line, home, away, open: true });
      } else if (m.key === 'totals') {
        let line, over, under;
        for (const o of m.outcomes || []) {
          if (/over/i.test(o.name)) { line = o.point != null ? o.point : 2.5; over = o.price; }
          else if (/under/i.test(o.name)) under = o.price;
        }
        if (line != null && over && under) odds.total.push({ bookmaker: bk, line, over, under, open: true });
      }
    }
  }
  for (const k of Object.keys(odds)) odds[k] = odds[k].slice(0, 10);
  return odds;
}

/* 最近一次各队盘口（用于异动检测：开盘 line → 当前 line） */
const lastLines = new Map();

/* 为 store 中未开赛比赛填充赔率；返回 { filled, flagged } */
async function applyToStore(store) {
  if (!config()) return { filled: 0, flagged: 0, disabled: true };
  const upcoming = store.matches.filter((m) => m.status === 'upcoming' && LEAGUE_SPORT[m.competition]);
  if (!upcoming.length) return { filled: 0, flagged: 0, disabled: false, reason: 'no-upcoming' };
  let filled = 0, flagged = 0;
  for (const m of upcoming) {
    try {
      const games = await fetchLeagueOdds(m.competition);
      const home = store.teamIndex.get(m.home.id);
      const away = store.teamIndex.get(m.away.id);
      if (!home || !away) continue;
      const g = games.find((x) => nameMatch(x.home_team, home.en || home.name) && nameMatch(x.away_team, away.en || away.name));
      if (!g) continue;
      const odds = mapOdds(g);
      if (!odds.europe.length && !odds.asian.length && !odds.total.length) continue;
      m.odds = odds;
      filled++;
      // 盘口异动：亚盘 line 变化 ±0.25+ 即标记
      const line = odds.asian[0] && odds.asian[0].line;
      if (line != null) {
        const prev = lastLines.get(m.id);
        if (prev != null && Math.abs(line - prev) >= 0.25) {
          m.oppHc = true;
          flagged++;
        }
        lastLines.set(m.id, line);
      }
    } catch (_) { /* 单个联赛失败不影响其它 */ }
  }
  return { filled, flagged };
}

module.exports = { applyToStore, fetchLeagueOdds, LEAGUE_SPORT };
