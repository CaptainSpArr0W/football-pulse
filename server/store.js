/*
 * 内存数据仓库：赛事查询、球队查询、WebSocket 客户端广播
 */
const { buildMatches } = require('./data/matches');
const { TEAMS, teamMap } = require('./data/teams');
const { XgEngine } = require('./xgEngine');

class Store {
  constructor() {
    const { today, all } = buildMatches();
    this.today = today;
    this.matches = all;
    this.clients = new Set();
    this.engine = new XgEngine({
      broadcast: (payload) => this.broadcast(payload),
      onFinished: (match) => this._restartLive(match),
    });
    this.booted = false;
  }

  /* 演示模式：终场后重置比赛并重新开赛，保持页面始终有实时直播 */
  _restartLive(match) {
    match.score = { home: 0, away: 0 };
    match.xg = { home: 0, away: 0 };
    match.events = [];
    match.minute = 0;
    match.halfReport = null;
    this.engine.start(match);
  }

  /* 启动时初始化进行中的比赛 */
  boot() {
    if (this.booted) return;
    this.booted = true;
    for (const m of this.matches) {
      if (m.status === 'live') this.engine.start(m);
    }
  }

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

  team(id) {
    const team = teamMap.get(id);
    if (!team) return null;
    const upcoming = this.matches.filter(
      (m) =>
        (m.home.id === id || m.away.id === id) &&
        (m.status === 'live' || m.status === 'upcoming'),
    );
    return { ...team, matches: upcoming.map((m) => this._publicMatch(m)) };
  }

  teams() {
    return TEAMS.map((t) => ({
      id: t.id, name: t.name, en: t.en, short: t.short,
      color: t.color, color2: t.color2, league: t.league, form: t.form,
    }));
  }

  _publicMatch(m) {
    return {
      id: m.id,
      date: m.date,
      competition: m.competition,
      round: m.round,
      home: { id: m.home.id, name: m.home.name, short: m.home.short, color: m.home.color, crest: m.home.crest || null },
      away: { id: m.away.id, name: m.away.name, short: m.away.short, color: m.away.color, crest: m.away.crest || null },
      kickoff: m.kickoff,
      kickoffTs: m.kickoffTs,
      status: m.status,
      minute: m.minute,
      score: m.score,
      xg: m.xg,
      stats: m.stats || null,
      halfReport: m.halfReport || null,
      odds: m.odds,
      events: m.events.slice(-8),
    };
  }

  matchById(id) {
    const m = this.matches.find((x) => x.id === id);
    if (!m) return null;
    const pm = this._publicMatch(m);
    pm.stats = m.stats || null;
    pm.halfReport = m.halfReport || null;
    pm.homeTeam = {
      id: m.home.id, name: m.home.name, short: m.home.short, color: m.home.color, color2: m.home.color2, crest: m.home.crest || null,
      formation: m.home.formation, lineup: m.home.lineup, recent: m.home.recent,
    };
    pm.awayTeam = {
      id: m.away.id, name: m.away.name, short: m.away.short, color: m.away.color, color2: m.away.color2, crest: m.away.crest || null,
      formation: m.away.formation, lineup: m.away.lineup, recent: m.away.recent,
    };
    return pm;
  }

  addClient(ws) {
    this.clients.add(ws);
    ws.on('close', () => this.clients.delete(ws));
  }

  /* 当前在线人数（活跃 WebSocket 连接数） */
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
