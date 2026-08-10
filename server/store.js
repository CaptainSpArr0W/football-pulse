/*
 * 内存数据仓库（真实数据模式）
 * - 启动时为空，由 fetcher 从 football-data.org 实时填充比赛与球队
 * - 提供赛事查询、球队查询、WebSocket 客户端广播
 */
const { BIG_FIVE } = require('./data/competitions');

function pad(n) { return String(n).padStart(2, '0'); }

/* 北京时区（UTC+8）的今天日期 */
function todayStr() {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

class Store {
  constructor() {
    this.matches = [];            // 真实比赛列表
    this.teamIndex = new Map();   // 球队 id -> 球队对象（含 lineup / recent / form）
    this.matchIndex = new Map();  // apiId -> match
    this.clients = new Set();
  }

  get today() { return todayStr(); }

  /* ---------- 由 fetcher 写入 ---------- */

  upsertMatch(m) {
    const existing = this.matchIndex.get(m.apiId);
    if (existing) {
      for (const k of Object.keys(m)) existing[k] = m[k];
      return existing;
    }
    this.matches.push(m);
    this.matchIndex.set(m.apiId, m);
    return m;
  }

  upsertTeam(t) {
    this.teamIndex.set(t.id, t);
    return t;
  }

  /* ---------- 查询 ---------- */

  matchesByDate(date) {
    return this.matches
      .filter((m) => m.date === date)
      .sort((a, b) => a.kickoffTs - b.kickoffTs);
  }

  availableDates() {
    return [...new Set(this.matches.map((m) => m.date))].sort();
  }

  competitions() {
    return [...new Set(this.matches.map((m) => m.competition))];
  }

  _teamView(id) {
    const t = this.teamIndex.get(id);
    if (t) return { id: t.id, name: t.name, short: t.short, color: t.color, color2: t.color2, crest: t.crest };
    return { id, name: id, short: id.slice(0, 3).toUpperCase(), color: '#5c6bc0', color2: '#3949ab', crest: null };
  }

  _publicMatch(m) {
    return {
      id: m.id,
      date: m.date,
      competition: m.competition,
      round: m.round,
      home: this._teamView(m.home.id),
      away: this._teamView(m.away.id),
      kickoff: m.kickoff,
      kickoffTs: m.kickoffTs,
      status: m.status,
      minute: m.minute,
      score: m.score,
      xg: m.xg || { home: 0, away: 0 },
      stats: m.stats || null,
      halfReport: m.halfReport || null,
      odds: m.odds || { europe: [], asian: [], total: [], corners: [] },
      events: (m.events || []).slice(-8),
    };
  }

  matchById(id) {
    const m = this.rawMatchById(id);
    if (!m) return null;
    const pm = this._publicMatch(m);
    const ht = this.teamIndex.get(m.home.id);
    const at = this.teamIndex.get(m.away.id);
    pm.homeTeam = {
      id: m.home.id, name: (ht && ht.name) || m.home.name, short: (ht && ht.short) || '', color: (ht && ht.color) || '#5c6bc0',
      color2: (ht && ht.color2) || '#3949ab', crest: (ht && ht.crest) || null,
      formation: (ht && ht.formation) || '', lineup: (ht && ht.lineup) || null, recent: (ht && ht.recent) || [],
    };
    pm.awayTeam = {
      id: m.away.id, name: (at && at.name) || m.away.name, short: (at && at.short) || '', color: (at && at.color) || '#5c6bc0',
      color2: (at && at.color2) || '#3949ab', crest: (at && at.crest) || null,
      formation: (at && at.formation) || '', lineup: (at && at.lineup) || null, recent: (at && at.recent) || [],
    };
    return pm;
  }

  /* 内部原始比赛对象（供 fetcher / apifootball 直接读写） */
  rawMatchById(id) {
    return this.matches.find((x) => x.id === id || String(x.apiId) === id) || null;
  }

  team(id) {
    const t = this.teamIndex.get(String(id));
    if (!t) return null;
    const upcoming = this.matches.filter(
      (m) =>
        (m.home.id === String(id) || m.away.id === String(id)) &&
        (m.status === 'live' || m.status === 'upcoming'),
    );
    return {
      id: t.id, name: t.name, en: t.en, short: t.short,
      color: t.color, color2: t.color2, crest: t.crest, league: t.league,
      formation: t.formation, lineup: t.lineup, recent: t.recent, form: t.form,
      matches: upcoming.map((m) => this._publicMatch(m)),
    };
  }

  teams() {
    return [...this.teamIndex.values()].map((t) => ({
      id: t.id, name: t.name, en: t.en, short: t.short,
      color: t.color, color2: t.color2, league: t.league, form: t.form,
    }));
  }

  /* ---------- WebSocket ---------- */

  addClient(ws) {
    this.clients.add(ws);
    ws.on('close', () => this.clients.delete(ws));
  }

  onlineCount() {
    return this.clients.size;
  }

  broadcast(payload) {
    const data = JSON.stringify(payload);
    for (const ws of this.clients) {
      if (ws.readyState === 1) ws.send(data);
    }
  }
}

module.exports = new Store();
