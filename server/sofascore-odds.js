/*
 * Sofascore 赔率数据源（早盘赔率，需海外网络）
 * - 接口：scheduled-events（按日比赛列表）+ event/{id}/odds/1/all（全部赔率）
 * - 市场：Match Winner（欧赔 1X2）/ Asian Handicap（亚盘）/ Asian Total（大小球）
 * - 缓存 15 分钟；403（无海外网络）时自动跳过，不消耗 The Odds API 配额
 */
const httpcache = require('./httpcache');

const LEAGUE_TID = {
  英超: 17,
  西甲: 8,
  德甲: 35,
  意甲: 23,
  法甲: 34,
};

const UA = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36',
  'accept': 'application/json',
  'referer': 'https://www.sofascore.com/',
};

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
function nameMatch(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length > 5 && y.length > 5 && (x.includes(y) || y.includes(x))) return true;
  return false;
}

/* 当日五大联赛比赛列表（含 event id） */
async function dayEvents(dateStr) {
  const key = 'sofa-odds:day:' + dateStr;
  const cached = httpcache.get(key);
  if (cached !== undefined) return cached;
  const res = await fetch(`https://api.sofascore.com/api/v1/sport/football/scheduled-events/${dateStr}`, { headers: UA });
  if (res.status === 403) { httpcache.set(key, [], 5 * 60 * 1000); return []; }
  if (!res.ok) return [];
  const j = await res.json();
  const list = (j.events || []).filter((e) => e.tournament && Object.values(LEAGUE_TID).includes(e.tournament.id));
  httpcache.set(key, list, 15 * 60 * 1000);
  return list;
}

/* 单场赔率 → 站点格式 */
async function eventOdds(eventId) {
  const key = 'sofa-odds:event:' + eventId;
  const cached = httpcache.get(key);
  if (cached !== undefined) return cached;
  const res = await fetch(`https://api.sofascore.com/api/v1/event/${eventId}/odds/1/all`, { headers: UA });
  if (!res.ok) return null;
  const j = await res.json();
  const data = (j && j.data) || [];
  const odds = { europe: [], asian: [], total: [], corners: [] };
  for (const bm of data) {
    const bk = bm.name || 'sofascore';
    const mw = (bm.markets || []).find((m) => m.name === 'Match Winner');
    if (mw) {
      let home, draw, away;
      for (const o of mw.outcomes || []) {
        if (o.type === 'home') home = parseFloat(o.price);
        else if (o.type === 'draw') draw = parseFloat(o.price);
        else if (o.type === 'away') away = parseFloat(o.price);
      }
      if (home && draw && away) odds.europe.push({ bookmaker: bk, home, draw, away, open: true });
    }
    const ah = (bm.markets || []).find((m) => /Asian Handicap/i.test(m.name));
    if (ah) {
      let line, home, away;
      for (const o of ah.outcomes || []) {
        if (o.type === 'home') { line = o.point != null ? parseFloat(o.point) : 0; home = parseFloat(o.price); }
        else if (o.type === 'away') away = parseFloat(o.price);
      }
      if (line != null && home && away) odds.asian.push({ bookmaker: bk, line, home, away, open: true });
    }
    const at = (bm.markets || []).find((m) => /Asian Total|Over\/Under/i.test(m.name));
    if (at) {
      let line, over, under;
      for (const o of at.outcomes || []) {
        if (/over/i.test(o.type) || /over/i.test(o.name)) { line = o.point != null ? parseFloat(o.point) : 2.5; over = parseFloat(o.price); }
        else if (/under/i.test(o.type) || /under/i.test(o.name)) under = parseFloat(o.price);
      }
      if (line != null && over && under) odds.total.push({ bookmaker: bk, line, over, under, open: true });
    }
  }
  for (const k of Object.keys(odds)) odds[k] = odds[k].slice(0, 10);
  httpcache.set(key, odds, 15 * 60 * 1000);
  return odds;
}

/* 可用性探测：Sofascore 是否可达（403 表示无海外网络） */
async function probe() {
  try {
    const r = await fetch('https://api.sofascore.com/api/v1/sport/football/scheduled-events/' + new Date().toISOString().slice(0, 10), { headers: UA });
    return r.ok;
  } catch (_) { return false; }
}

/* 为单场未开赛比赛填充 Sofascore 赔率；返回 true 表示填充成功 */
async function applyMatch(m, store) {
  if (!LEAGUE_TID[m.competition]) return false;
  const home = store.teamIndex.get(m.home.id);
  const away = store.teamIndex.get(m.away.id);
  if (!home || !away) return false;
  const dateStr = String(m.date).slice(0, 10);
  const events = await dayEvents(dateStr);
  const g = events.find((e) => e.homeTeam && e.awayTeam
    && nameMatch(e.homeTeam.name, home.en || home.name) && nameMatch(e.awayTeam.name, away.en || away.name));
  if (!g || !g.id) return false;
  const odds = await eventOdds(g.id);
  if (!odds || (!odds.europe.length && !odds.asian.length && !odds.total.length)) return false;
  m.odds = odds;
  return true;
}

module.exports = { applyMatch, probe, LEAGUE_TID };
