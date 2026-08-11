/*
 * 五大联赛射手榜 / 助攻榜 / 评分榜
 * - 数据源：Sofascore 公开 API（api.sofascore.com，部分网络/区域 403，需海外网络时自动失败返回空）
 * - 联赛 unique-tournament id：英超 17 / 西甲 8 / 德甲 35 / 意甲 23 / 法甲 34
 * - 缓存 12 小时
 */
const httpcache = require('./httpcache');

const LEAGUE_TIDS = { 英超: 17, 西甲: 8, 德甲: 35, 意甲: 23, 法甲: 34 };
const UA = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'accept': 'application/json',
  'referer': 'https://www.sofascore.com/',
};

async function sofaGet(path, ttlMs) {
  const key = 'topscorers:' + path;
  const cached = httpcache.get(key);
  if (cached !== undefined) return cached;
  const res = await fetch('https://api.sofascore.com/api/v1' + path, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  httpcache.set(key, j, ttlMs);
  return j;
}

/* 最新赛季 id（缓存 24h） */
async function seasonId(league) {
  const tid = LEAGUE_TIDS[league];
  const j = await sofaGet(`/unique-tournament/${tid}/seasons`, 24 * 3600 * 1000);
  const seasons = (j.seasons || []).filter((s) => s && s.year).sort((a, b) => (b.year || 0) - (a.year || 0));
  return seasons[0] ? seasons[0].id : null;
}

/* 榜单数据：stat ∈ goals / assists / rating */
async function topPlayers(league, stat) {
  const tid = LEAGUE_TIDS[league];
  if (!tid) return [];
  const sid = await seasonId(league);
  if (!sid) return [];
  const j = await sofaGet(`/unique-tournament/${tid}/season/${sid}/top-players/${stat}`, 12 * 3600 * 1000);
  const arr = (j && (j.topPlayers || j[stat])) || [];
  return arr.slice(0, 20).map((x) => {
    const p = x.player || {};
    const s = x.statistics || {};
    const value = s[stat] != null ? s[stat] : null;
    return {
      name: p.name || '',
      team: p.team ? p.team.name : '',
      teamId: p.team ? p.team.id : null,
      value: value != null ? Number(value) : null,
      games: s.games != null ? Number(s.games) : null,
      position: p.position ? p.position.split('_').pop().toUpperCase() : '',
    };
  }).filter((x) => x.name && x.value != null);
}

async function list(league, stat) {
  try { return await topPlayers(league, stat); }
  catch (_) { return []; }
}

module.exports = { list, LEAGUE_TIDS };
