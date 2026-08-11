/*
 * Understat 每场 xG 数据（经 soccerdata 抓取，见 fetch-understat.py）
 * - 数据文件：server/data/understat-xg.json（2025/26 五大联赛全部场次）
 * - 用途：为比赛填充 xG（Understat 优先，Fotmob 兜底）
 */
const fs = require('fs');
const path = require('path');
const httpcache = require('./httpcache');

const LEAGUE_KEY = {
  'ENG-Premier League': '英超',
  'ESP-La Liga': '西甲',
  'GER-Bundesliga': '德甲',
  'ITA-Serie A': '意甲',
  'FRA-Ligue 1': '法甲',
};

/* Understat 队名 → 常见拼写变体 */
const ALIASES = {
  'manchesterunited': ['manunited'],
  'manchestercity': ['mancity'],
  'nottinghamforest': ['nottmforest', 'nottingham'],
  'wolverhamptonwanderers': ['wolves', 'wolverhampton'],
  'arsenal': ['arsenal'],
  'tottenham': ['tottenhamhotspur', 'spurs'],
  'westham': ['westhamunited', 'westham'],
  'brighton': ['brightonhovealbion'],
  'bayernmunchen': ['bayern', 'bayernmunich'],
  'borussia': [], // 特殊处理
  'koln': ['koln', '1fckoln'],
  'monchengladbach': ['borussiamonchengladbach', 'mgladbach'],
  'leverkusen': ['bayerleverkusen'],
  'dortmund': ['borussiadortmund'],
  'atleticomadrid': ['atleticodemadrid'],
  'realmadrid': ['realmadrid'],
  'barcelona': ['fcbarcelona'],
  'psg': ['parissaintgermain'],
  'parissaintgermain': ['psg'],
  'milan': ['acmilan'],
  'inter': ['intermilan', 'fcinternazionale'],
  'napoli': ['napoli'],
  'roma': ['asroma'],
  'lazio': ['lazio'],
  'marseille': ['olympiquedemarseille'],
  'lyon': ['olympiquelyonnais'],
};

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');

let DATA = null;
function loadData() {
  if (DATA) return DATA;
  try {
    const p = path.join(__dirname, 'data', 'understat-xg.json');
    DATA = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (_) { DATA = {}; }
  return DATA;
}

function understatLeague(zh) {
  return Object.keys(LEAGUE_KEY).find((k) => LEAGUE_KEY[k] === zh) || null;
}

/* 判断 store 球队（en 名）是否匹配 Understat 队名 */
function matchName(usName, team) {
  const us = norm(usName);
  const en = norm(team.en || team.name || '');
  if (!us || !en) return false;
  if (us === en) return true;
  const usVariants = new Set([us, ...(ALIASES[us] || [])]);
  if (usVariants.has(en)) return true;
  // 短名包含匹配（防误伤：长度都 > 6 才用包含）
  if (us.length > 6 && en.length > 6 && (us.includes(en) || en.includes(us))) return true;
  return false;
}

/* 为单场比赛填充 xG（Understat 有数据时覆盖） */
function applyMatch(match, store) {
  if (!match || match.status === 'upcoming') return;
  const ul = understatLeague(match.competition);
  if (!ul) return;
  const home = store.teamIndex.get(match.home.id);
  const away = store.teamIndex.get(match.away.id);
  if (!home || !away) return;
  const list = (loadData()[ul] || []);
  const date = String(match.date).slice(0, 10);
  const hit = list.find((r) => r.date === date && matchName(r.home, home) && matchName(r.away, away));
  if (hit && (hit.home_xg > 0 || hit.away_xg > 0)) {
    match.xg = { home: hit.home_xg, away: hit.away_xg };
    return true;
  }
  return false;
}

/* 为 store 中所有五大联赛已完赛比赛填充 */
function applyAll(store) {
  let n = 0;
  for (const m of store.matches.values()) {
    if (applyMatch(m, store)) n++;
  }
  return n;
}

module.exports = { applyMatch, applyAll };
