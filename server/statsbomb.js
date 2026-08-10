/*
 * StatsBomb Open Data 数据层（历史深度复盘）
 * 数据源：github.com/hudl/open-data（raw.githubusercontent.com 静态 JSON）
 * - competitions.json      赛事/赛季列表
 * - matches/{comp}/{season} 某赛事某赛季的比赛列表
 * - events/{matchId}        逐事件数据（含真实 xG）
 * - lineups/{matchId}       双方阵容
 * 说明：该数据为历史静态数据（最新约 2023/24 赛季），用于历史比赛深度复盘，
 * 不提供实时数据与赔率。数据免费、无需密钥。
 */
const TEAM_NAMES_ZH = require('./data/team-names');

const BASE = 'https://raw.githubusercontent.com/hudl/open-data/master/data';
const cache = new Map(); // key -> { data, ts }

async function fetchJson(path, ttlMs) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.ts < ttlMs) return hit.data;
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`StatsBomb HTTP ${res.status}`);
  const data = await res.json();
  cache.set(path, { data, ts: Date.now() });
  return data;
}

function log(msg) { console.log(`[statsbomb] ${msg}`); }

/* ---------- 基础数据 ---------- */

async function competitions() {
  return fetchJson('competitions.json', 6 * 3600 * 1000);
}

async function matches(compId, seasonId) {
  return fetchJson(`matches/${compId}/${seasonId}.json`, 3600 * 1000);
}

async function events(matchId) {
  return fetchJson(`events/${matchId}.json`, 6 * 3600 * 1000);
}

async function lineups(matchId) {
  try {
    return await fetchJson(`lineups/${matchId}.json`, 6 * 3600 * 1000);
  } catch (_) {
    return null;
  }
}

/* ---------- 复盘计算 ---------- */

function zh(name) {
  return TEAM_NAMES_ZH.zhTeamName(name, name) || name;
}

const SHOT_ON_TARGET = new Set(['Goal', 'Saved', 'Post']);

function summarize(match, evs, lus) {
  const homeId = match.home_team.home_team_id;
  const awayId = match.away_team.away_team_id;
  const side = (teamId) => (teamId === homeId ? 'home' : teamId === awayId ? 'away' : null);
  const nameOf = (teamId) => (teamId === homeId ? match.home_team.home_team_name : match.away_team.away_team_name);

  const stat = () => ({ xg: 0, shots: 0, sot: 0, fouls: 0, cards: 0, possession: 0, duration: 0 });
  const s = { home: stat(), away: stat() };
  const shots = [];
  const timeline = [];

  for (const ev of evs) {
    const tid = ev.team && ev.team.id;
    const sd = side(tid);
    if (!sd) continue;
    const st = s[sd];

    // 控球时间（按事件 duration 累计）
    const dur = ev.duration || 0;
    st.duration += dur;

    if (ev.type && ev.type.name === 'Shot') {
      st.shots += 1;
      const xg = (ev.shot && ev.shot.statsbomb_xg) || 0;
      st.xg += xg;
      const outcome = ev.shot && ev.shot.outcome && ev.shot.outcome.name;
      if (SHOT_ON_TARGET.has(outcome)) st.sot += 1;
      const isGoal = outcome === 'Goal';
      shots.push({
        team: sd,
        player: (ev.player && ev.player.name) || '未知',
        xg: +xg.toFixed(3),
        outcome,
        goal: isGoal,
        minute: ev.minute,
        loc: ev.location || [0, 0],
      });
      if (isGoal) {
        timeline.push({ minute: ev.minute, team: sd, type: 'goal', detail: `进球：${(ev.player && ev.player.name) || '未知'}` });
      }
    } else if (ev.type && ev.type.name === 'Foul Committed') {
      st.fouls += 1;
    } else if (ev.type && ev.type.name === 'Card') {
      st.cards += 1;
      const card = ev.card && ev.card.name;
      timeline.push({
        minute: ev.minute, team: sd, type: 'card',
        detail: `${card === 'Red Card' ? '红牌' : '黄牌'}：${(ev.player && ev.player.name) || '未知'}`,
      });
    } else if (ev.type && ev.type.name === 'Substitution') {
      timeline.push({
        minute: ev.minute, team: sd, type: 'sub',
        detail: `换人：${(ev.player && ev.player.name) || ''} → ${(ev.substitution && ev.substitution.replacement && ev.substitution.replacement.name) || '替补'}`,
      });
    } else if (ev.type && (ev.type.name === 'Own Goal For' || ev.type.name === 'Own Goal Against')) {
      const scorerTeam = ev.type.name === 'Own Goal For' ? ev.team.id : (ev.team.id === homeId ? awayId : homeId);
      timeline.push({
        minute: ev.minute, team: side(scorerTeam), type: 'goal',
        detail: `乌龙球：${(ev.player && ev.player.name) || '未知'}`,
      });
    }
  }

  const totalDur = s.home.duration + s.away.duration || 1;
  const mk = (sd, name) => ({
    id: sd === 'home' ? match.home_team.home_team_id : match.away_team.away_team_id,
    name,
    zh: zh(name),
    score: sd === 'home' ? match.home_score : match.away_score,
    xg: +s[sd].xg.toFixed(2),
    shots: s[sd].shots,
    sot: s[sd].sot,
    fouls: s[sd].fouls,
    cards: s[sd].cards,
    possession: Math.round((s[sd].duration / totalDur) * 100),
  });

  const home = mk('home', match.home_team.home_team_name);
  const away = mk('away', match.away_team.away_team_name);

  // 阵容：lineup 数组中 start_reason=Starting XI 的为首发；位置信息存于 positions 对象数组
  const lineupOf = (teamId) => {
    if (!lus) return null;
    const lu = lus.find((x) => x.team_id === teamId);
    if (!lu || !Array.isArray(lu.lineup)) return null;
    const starters = lu.lineup.filter((p) => Array.isArray(p.positions)
      && p.positions.some((s) => s && String(s.start_reason) === 'Starting XI'));
    if (!starters.length) return null;
    const posOf = (p) => ((p.positions && p.positions[0] && p.positions[0].position) || '').trim();
    return {
      formation: '',
      list: starters.map((p) => [p.player_name || '球员', p.jersey_number || 0, { pos: posOf(p) }]),
    };
  };

  timeline.sort((a, b) => a.minute - b.minute);

  return {
    matchId: match.match_id,
    date: match.match_date || '',
    competition: match.competition && match.competition.competition_name,
    season: match.season && match.season.season_name,
    home,
    away,
    shots,
    timeline,
    lineups: {
      home: lineupOf(homeId),
      away: lineupOf(awayId),
    },
    has360: !!match.match_available_360,
  };
}

/* ---------- 对外接口 ---------- */

/* 赛事/赛季列表（前端选择器用），按赛事名分组并给出赛季数 */
async function competitionGroups() {
  const comps = await competitions();
  const groups = new Map();
  for (const c of comps) {
    if (c.competition_youth) continue; // 跳过青年赛事
    const key = `${c.country_name} · ${c.competition_name}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  return [...groups.entries()].map(([name, seasons]) => ({
    name,
    country: seasons[0].country_name,
    gender: seasons[0].competition_gender,
    seasons: seasons
      .map((s) => ({ id: s.season_id, name: s.season_name, competitionId: s.competition_id, matchAvailable: s.match_available }))
      .sort((a, b) => (a.name < b.name ? 1 : -1)),
  }));
}

async function matchesFor(compId, seasonId) {
  const list = await matches(compId, seasonId);
  return list.map((m) => ({
    id: m.match_id,
    date: m.match_date || '',
    home: { name: m.home_team.home_team_name, zh: zh(m.home_team.home_team_name) },
    away: { name: m.away_team.away_team_name, zh: zh(m.away_team.away_team_name) },
    homeScore: m.home_score,
    awayScore: m.away_score,
    competition: m.competition.competition_name,
    season: m.season.season_name,
  }));
}

async function reviewFor(compId, seasonId, matchId) {
  const list = await matches(compId, seasonId);
  const meta = list.find((m) => String(m.match_id) === String(matchId));
  if (!meta) throw new Error('比赛信息缺失');
  const evs = await events(matchId);
  if (!Array.isArray(evs)) throw new Error('事件数据缺失');
  const lus = await lineups(matchId);
  return summarize(meta, evs, lus);
}

module.exports = { competitionGroups, matchesFor, reviewFor };
