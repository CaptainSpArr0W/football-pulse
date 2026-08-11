/*
 * 实力分区模块
 * - 数据源：ESPN 公开 API（site.web.api.espn.com）上赛季（2025-26）各联赛最终积分榜
 *   （ESPN 数据访问方式参考 GitHub 开源项目 probberechts/soccerdata 的 ESPN 模块）
 * - 分区规则：按上赛季联赛排名映射梯队（S 争冠 / A 欧冠 / B 欧战 / C 中上 / D 中游 / E 保级）
 * - 缓存：积分榜赛季内不变，缓存 7 天
 */
const httpcache = require('./httpcache');

const LEAGUE_SLUGS = { 英超: 'eng.1', 西甲: 'esp.1', 德甲: 'ger.1', 意甲: 'ita.1', 法甲: 'fra.1' };
const UA = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'accept': 'application/json',
};
const SEASON = process.env.POWER_SEASON || 2025; // 上赛季：2025-26 最终积分榜

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');

/* 拼写差异别名（ESPN 名 vs 数据源名） */
const NAME_ALIASES = {
  'bayernmunchen': ['bayernmunich'],     // Bayern München ↔ Bayern Munich
  'psg': ['parissaintgermain'],          // PSG ↔ Paris Saint-Germain
  'parissaintgermain': ['psg'],
  'intermilan': ['inter'],               // Inter Milan ↔ Inter
  'inter': ['intermilan'],
  'acmilan': ['milan'],                  // AC Milan ↔ Milan
  'milan': ['acmilan'],
  'atleticomadrid': ['atleticodemadrid'], // 马竞
  'olympiquedemarseille': ['marseille'],
  'marseille': ['olympiquedemarseille'],
  'olympiquelyonnais': ['lyon'],
  'lyon': ['olympiquelyonnais'],
  'mancity': ['manchestercity'],                     // Man City ↔ Manchester City
  'manunited': ['manchesterunited'],                 // Man United ↔ Manchester United
  'nottmforest': ['nottinghamforest'],               // Nottm Forest ↔ Nottingham Forest
  'wolves': ['wolverhamptonwanderers', 'wolverhampton'],
  'mgladbach': ['monchengladbach', 'borussiamonchengladbach'], // M'gladbach ↔ Mönchengladbach
  'rennes': ['staderennais', 'staderennes'],         // Rennes ↔ Stade Rennais
};

function variantsOf(en) {
  const n = norm(en);
  const set = new Set([n]);
  if (n) for (const k of Object.keys(NAME_ALIASES)) {
    if (n.includes(k)) NAME_ALIASES[k].forEach((v) => set.add(v));
  }
  return [...set];
}

/* 排名 → 梯队（20 队联赛；18 队联赛按同样分档） */
function tierOf(rank, total) {
  if (!rank || rank < 1) return null;
  if (rank <= 2) return 'S';
  if (rank <= 4) return 'A';
  if (rank <= 7) return 'B';
  if (rank <= 12) return 'C';
  if (rank <= total - 3) return 'D'; // 20队:13-17；18队:13-15
  return 'E';
}
const TIER_ZH = { S: '争冠组', A: '欧冠组', B: '欧战组', C: '中上区', D: '中游区', E: '保级组' };

/* 拉取某联赛上赛季积分榜（缓存 7 天） */
async function standings(league) {
  const slug = LEAGUE_SLUGS[league];
  if (!slug) return [];
  const key = `power:standings:${slug}:${SEASON}`;
  const cached = httpcache.get(key);
  if (cached !== undefined) return cached;
  const res = await fetch(`https://site.web.api.espn.com/apis/v2/sports/soccer/${slug}/standings?season=${SEASON}`, { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  const entries = (j.children && j.children[0] && j.children[0].standings && j.children[0].standings.entries) || [];
  const stat = (e, name) => {
    const s = (e.stats || []).find((x) => x.name === name);
    return s ? s.value : null;
  };
  const out = entries.map((e) => ({
    name: (e.team && e.team.displayName) || '',
    short: (e.team && e.team.abbreviation) || '',
    rank: parseInt(stat(e, 'rank'), 10),
    pts: parseInt(stat(e, 'points'), 10),
  })).filter((x) => x.name);
  httpcache.set(key, out, 7 * 24 * 3600 * 1000);
  return out;
}

/* 匹配 store 球队 → 实力数据 */
async function powerOf(team) {
  if (!team || !LEAGUE_SLUGS[team.league]) return null;
  const list = await standings(team.league);
  const en = norm(team.en || team.name || '');
  if (!en) return null;
  const variants = variantsOf(team.en || team.name);
  let hit = list.find((x) => variants.includes(norm(x.name)) || variants.includes(norm(x.short)));
  if (!hit) {
    hit = list.find((x) => {
      const xn = norm(x.name);
      return xn && (xn.includes(en) || en.includes(xn));
    });
  }
  if (!hit) return null;
  const total = list.length;
  return {
    tier: tierOf(hit.rank, total),
    tierZh: TIER_ZH[tierOf(hit.rank, total)],
    rank: hit.rank,
    pts: hit.pts,
    league: team.league,
  };
}

module.exports = { powerOf, standings, TIER_ZH };
