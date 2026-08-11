/*
 * ESPN 新闻爬虫
 * - 数据源：site.api.espn.com（公开 API，无需密钥）
 *   - 联赛球队列表：/apis/site/v2/sports/soccer/{league}/teams（缓存 24h）
 *   - 球队新闻：/apis/site/v2/sports/soccer/{league}/news?team={id}&limit=8（缓存 30min）
 * - 按球队分类：为 store 中五大联赛球队匹配 ESPN 球队 id，拉取新闻写入 t.news
 * - 情绪倾向：基于标题关键词的简易分类（positive / negative / neutral）
 * - 全部异常静默降级，不影响站点其它功能
 */
const httpcache = require('./httpcache');

const LEAGUE_SLUGS = { 英超: 'eng.1', 西甲: 'esp.1', 德甲: 'ger.1', 意甲: 'ita.1', 法甲: 'fra.1' };
const UA = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'accept': 'application/json',
};

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
const pad = (n) => String(n).padStart(2, '0');
function log(msg) { console.log(`[ESPN] ${msg}`); }

/* 联赛球队列表（id / 名称 / 短名 / slug） */
async function leagueTeams(league) {
  const slug = LEAGUE_SLUGS[league];
  if (!slug) return [];
  const key = 'espn-teams:' + slug;
  const cached = httpcache.get(key);
  if (cached !== undefined) return cached;
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams`, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  const teams = ((j.sports && j.sports[0] && j.sports[0].leagues && j.sports[0].leagues[0] && j.sports[0].leagues[0].teams) || [])
    .map((x) => x.team && ({
      id: String(x.team.id),
      name: x.team.displayName || '',
      short: x.team.shortDisplayName || '',
      slug: x.team.slug || '',
    }))
    .filter((x) => x && x.id);
  httpcache.set(key, teams, 24 * 3600 * 1000);
  return teams;
}

/* 球队新闻（ESPN：按球队 id；仅保留最近 15 天） */
async function teamNews(espnId, league) {
  const slug = LEAGUE_SLUGS[league];
  const key = `espn-news:15d:${slug}:${espnId}`;
  const cached = httpcache.get(key);
  if (cached !== undefined) return cached;
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/news?team=${espnId}&limit=15`, { headers: UA });
  if (!res.ok) return [];
  const j = await res.json();
  const now = Date.now();
  const CUTOFF = 15 * 24 * 3600 * 1000;
  const out = (j.articles || [])
    .filter((a) => a.published && now - Date.parse(a.published) <= CUTOFF)
    .slice(0, 8)
    .map((a) => {
      const d = a.published ? new Date(a.published) : null;
      const bj = d && !isNaN(d.getTime()) ? new Date(d.getTime() + 8 * 3600 * 1000) : null;
      const links = a.links || {};
      return {
        sentiment: classify(a.headline || ''),
        source: 'ESPN',
        time: bj ? `${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())} ${pad(bj.getUTCHours())}:${pad(bj.getUTCMinutes())}` : '',
        title: a.headline || '',
        summary: a.description || '',
        link: (links.web && links.web.href) || (links.mobile && links.mobile.href) || '',
      };
    });
  httpcache.set(key, out, 30 * 60 * 1000);
  return out;
}

/* 情绪倾向（标题关键词简易分类） */
function classify(text) {
  const t = String(text || '').toLowerCase();
  const pos = ['win', 'wins', 'victory', 'triumph', 'signed', 'signing', 'debut', 'return', 'comeback', 'qualif', 'title', 'champions', 'breakthrough', 'record', 'agreement', 'renew', 'extension', 'goal', 'scorer', 'superb', 'brilliant'];
  const neg = ['loss', 'loses', 'defeat', 'injur', 'out', 'sack', 'crisis', 'fail', 'struggl', 'exit', 'dropped', 'ban', 'suspend', 'penalt', 'blow', 'miss', 'doubt', 'worry', 'surgery', 'ruled out', 'drawn', 'worse'];
  let p = 0, n = 0;
  for (const w of pos) if (t.includes(w)) p += 1;
  for (const w of neg) if (t.includes(w)) n += 1;
  if (p > n) return 'positive';
  if (n > p) return 'negative';
  return 'neutral';
}

/* 为 store 球队匹配 ESPN 球队 id（精确优先，其次名称包含） */
async function matchEspnId(team, league) {
  const teams = await leagueTeams(league);
  const en = norm(team.en || team.name || '');
  if (!en) return null;
  let hit = teams.find((x) => norm(x.name) === en || norm(x.short) === en || norm(x.slug) === en);
  if (!hit) {
    hit = teams.find((x) => {
      const xn = norm(x.name);
      return xn && (xn.includes(en) || en.includes(xn));
    });
  }
  return hit ? hit.id : null;
}

/* 取单支球队的 ESPN 新闻（供 cn-news 聚合：匹配 id + 拉取 + 15 天过滤） */
async function getNewsForTeam(team) {
  if (!(team.league && LEAGUE_SLUGS[team.league])) return [];
  try {
    const espnId = await matchEspnId(team, team.league);
    if (!espnId) return [];
    return await teamNews(espnId, team.league);
  } catch (_) {
    return [];
  }
}

module.exports = { teamNews, leagueTeams, getNewsForTeam, classify, norm };
