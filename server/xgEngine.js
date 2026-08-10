/*
 * XG（预期进球）实时引擎
 * 为每场进行中的比赛生成事件剧本（射门/进球），按时间推进并累计 XG 指数。
 * 接入真实数据源时，可替换 tick() 内的数据来源（见 README"接入真实数据"章节）。
 */

const RANDOM_EVENTS = [
  { type: 'shot', detail: '禁区内抽射偏出', xg: 0.18 },
  { type: 'shot', detail: '远射被门将扑出', xg: 0.06 },
  { type: 'shot', detail: '单刀机会，推射被扑', xg: 0.52 },
  { type: 'shot', detail: '定位球头球攻门，稍稍高出', xg: 0.22 },
  { type: 'shot', detail: '小角度射门击中边网', xg: 0.08 },
  { type: 'shot', detail: '反击中禁区内低射被挡', xg: 0.31 },
  { type: 'shot', detail: '禁区内混战补射打高', xg: 0.28 },
  { type: 'goal', detail: '禁区内推射远角得手！', xg: 0.55 },
  { type: 'goal', detail: '头球破门！', xg: 0.48 },
  { type: 'goal', detail: '世界波！禁区外远射直挂死角', xg: 0.09 },
  { type: 'goal', detail: '点球命中！', xg: 0.78 },
  { type: 'goal', detail: '反击单刀冷静推射入网！', xg: 0.65 },
];

const SCRIPTS = {
  // 阿森纳 vs 利物浦：相对均衡，利物浦稍占优势
  'm-ars-liv': [
    { minute: 6, team: 'home', type: 'shot', xg: 0.12, detail: '萨卡右路内切远射偏出' },
    { minute: 12, team: 'away', type: 'shot', xg: 0.31, detail: '萨拉赫禁区内低射被拉亚扑出' },
    { minute: 19, team: 'home', type: 'goal', xg: 0.55, detail: '厄德高禁区弧顶抽射得手！' },
    { minute: 26, team: 'away', type: 'shot', xg: 0.08, detail: '迪亚斯内切打门偏出' },
    { minute: 34, team: 'away', type: 'goal', xg: 0.48, detail: '范戴克角球头球破门扳平！' },
    { minute: 41, team: 'home', type: 'shot', xg: 0.22, detail: '马丁内利远射被阿利松没收' },
    { minute: 53, team: 'away', type: 'shot', xg: 0.52, detail: '加克波单刀推射被扑' },
    { minute: 61, team: 'home', type: 'shot', xg: 0.18, detail: '热苏斯禁区内转身打门高出' },
    { minute: 69, team: 'away', type: 'goal', xg: 0.65, detail: '萨拉赫反击中冷静推射入网！' },
    { minute: 77, team: 'home', type: 'shot', xg: 0.31, detail: '赖斯禁区外远射被扑出' },
    { minute: 84, team: 'away', type: 'shot', xg: 0.06, detail: '索博斯洛伊远射打飞' },
  ],
  // 曼联 vs 切尔西：曼联稍占优势
  'm-mun-che': [
    { minute: 9, team: 'home', type: 'shot', xg: 0.14, detail: '拉什福德左路内切打门偏出' },
    { minute: 17, team: 'away', type: 'shot', xg: 0.26, detail: '帕尔默禁区弧顶兜射被扑' },
    { minute: 24, team: 'home', type: 'goal', xg: 0.6, detail: '霍伊伦禁区内抢点破门！' },
    { minute: 33, team: 'away', type: 'shot', xg: 0.2, detail: '杰克逊禁区内抽射偏出' },
    { minute: 40, team: 'home', type: 'shot', xg: 0.1, detail: 'B费远射偏出立柱' },
    { minute: 49, team: 'away', type: 'goal', xg: 0.5, detail: '帕尔默禁区内推射得手！' },
    { minute: 57, team: 'home', type: 'shot', xg: 0.34, detail: '安东尼内切射门被扑出' },
    { minute: 65, team: 'away', type: 'shot', xg: 0.15, detail: '恩佐远射打高' },
    { minute: 72, team: 'home', type: 'goal', xg: 0.68, detail: '拉什福德反击单刀破门！' },
    { minute: 81, team: 'away', type: 'shot', xg: 0.28, detail: '穆德里克远射被奥纳纳扑出' },
    { minute: 88, team: 'home', type: 'shot', xg: 0.05, detail: '卡塞米罗头球攻门偏出' },
  ],
};

/* 基于球队实力比为没有剧本的 live 比赛自动生成事件 */
function autoScript(homeId, awayId) {
  const strength = {
    mci: 0.9, rma: 0.9, bay: 0.85, bar: 0.8, liv: 0.82, int: 0.78,
    acm: 0.72, psg: 0.8, che: 0.7, tot: 0.72, juv: 0.7, bvb: 0.7,
    ars: 0.84, mun: 0.68,
  };
  const h = strength[homeId] || 0.7;
  const a = strength[awayId] || 0.7;
  const totalEvents = 16 + Math.floor(Math.random() * 8);
  const script = [];
  const evPool = RANDOM_EVENTS;
  for (let i = 0; i < totalEvents; i++) {
    const team = Math.random() < h / (h + a) ? 'home' : 'away';
    const minute = 1 + Math.floor(Math.random() * 89);
    const ev = evPool[Math.floor(Math.random() * evPool.length)];
    script.push({ minute, team, ...ev });
  }
  script.sort((x, y) => x.minute - y.minute);
  return script;
}

class XgEngine {
  constructor({ tickMs = 1500, broadcast, onFinished }) {
    this.tickMs = tickMs;
    this.broadcast = broadcast;
    this.onFinished = onFinished;
    this.matches = new Map(); // matchId -> { match, script, scriptIdx, timer, done }
    this._timer = null;
  }

  start(match) {
    const script = SCRIPTS[match.id] || autoScript(match.home.id, match.away.id);
    const state = {
      match,
      script,
      scriptIdx: 0,
      minute: 0,
      half: '上半场',
      done: false,
    };
    this.matches.set(match.id, state);
    match.status = 'live';
    match.minute = 0;
    match.stats = {
      shots: { home: 0, away: 0 },
      sot: { home: 0, away: 0 },
      corners: { home: 0, away: 0 },
      yellowCards: { home: 0, away: 0 },
      redCards: { home: 0, away: 0 },
      fouls: { home: 0, away: 0 },
      possession: { home: 50, away: 50 },
    };
    if (!this._timer) this._timer = setInterval(() => this.tick(), this.tickMs);
  }

  /* 事件触发后同步更新实时统计 */
  _updateStats(match, team) {
    const s = match.stats;
    s.shots[team] += 1;
    const ev = match.events[match.events.length - 1];
    if (ev.type === 'goal' || ev.xg > 0.3) s.sot[team] += 1;
    if (Math.random() < 0.3) s.fouls[team] += 1;
    const drift = Math.random() * 3 - 1.5;
    s.possession.home = Math.max(35, Math.min(65, s.possession.home + drift));
    s.possession.away = Math.round(100 - s.possession.home);
    s.possession.home = Math.round(s.possession.home);
  }

  /* 独立实时事件：角球 / 黄牌 / 红牌 / 换人（不依赖射门剧本，每比赛分钟小概率触发） */
  _ambientEvents(match) {
    let pushed = false;
    const pickPlayer = (team) => {
      const lineup = team === 'home' ? match.home.lineup : match.away.lineup;
      return lineup && lineup.length ? lineup[Math.floor(Math.random() * lineup.length)][0] : '球员';
    };
    const teamName = (team) => (team === 'home' ? match.home.name : match.away.name);
    const base = { homeScore: match.score.home, awayScore: match.score.away };

    // 角球：场均约 10 次
    if (Math.random() < 0.11) {
      const team = Math.random() < 0.5 ? 'home' : 'away';
      match.stats.corners[team] += 1;
      match.events.push({ minute: match.minute, team, type: 'corner', detail: teamName(team) + '获得角球', ...base });
      pushed = true;
    }
    // 黄牌：场均约 4 张
    if (Math.random() < 0.045) {
      const team = Math.random() < 0.5 ? 'home' : 'away';
      match.stats.yellowCards[team] += 1;
      match.events.push({ minute: match.minute, team, type: 'yellow', detail: pickPlayer(team) + '犯规吃到黄牌', ...base });
      pushed = true;
    }
    // 红牌：低概率，场均约 0.2 张
    if (Math.random() < 0.003) {
      const team = Math.random() < 0.5 ? 'home' : 'away';
      match.stats.redCards[team] += 1;
      match.events.push({ minute: match.minute, team, type: 'red', detail: pickPlayer(team) + '严重犯规被红牌罚下', ...base });
      pushed = true;
    }
    // 换人：场均约 5 次
    if (Math.random() < 0.055) {
      const team = Math.random() < 0.5 ? 'home' : 'away';
      const lineup = team === 'home' ? match.home.lineup : match.away.lineup;
      if (lineup && lineup.length > 1) {
        const idxA = Math.floor(Math.random() * lineup.length);
        let idxB = Math.floor(Math.random() * (lineup.length - 1));
        if (idxB >= idxA) idxB += 1;
        match.events.push({
          minute: match.minute, team, type: 'sub',
          detail: `${lineup[idxA][0]} 被换下，${lineup[idxB][0]} 替补登场`,
          ...base,
        });
        pushed = true;
      }
    }
    return pushed;
  }

  /* 中场战报：生成并推送半场数据小结 */
  _halftimeReport(match) {
    const s = match.stats;
    const lead = match.score.home > match.score.away
      ? { name: match.home.name, by: match.score.home - match.score.away }
      : match.score.away > match.score.home
        ? { name: match.away.name, by: match.score.away - match.score.home }
        : null;
    let text;
    if (!lead) {
      text = `上半场双方 ${match.score.home}-${match.score.away} 战平，XG ${match.xg.home.toFixed(2)}-${match.xg.away.toFixed(2)}，场面胶着难分高下。`;
    } else {
      text = `上半场 ${lead.name} 以 ${lead.by} 球优势领先，XG ${match.xg.home.toFixed(2)}-${match.xg.away.toFixed(2)}，进攻效率更胜一筹。`;
    }
    match.halfReport = {
      minute: 45,
      score: { ...match.score },
      xg: { ...match.xg },
      stats: {
        shots: { ...s.shots }, sot: { ...s.sot }, corners: { ...s.corners },
        yellowCards: { ...s.yellowCards }, redCards: { ...s.redCards }, fouls: { ...s.fouls },
      },
      text,
    };
    this.broadcast({ type: 'half-time-report', matchId: match.id, report: match.halfReport });
  }

  running() {
    return [...this.matches.values()].filter((s) => s.match.status === 'live');
  }

  tick() {
    for (const state of this.running()) {
      const { match, script } = state;
      state.minute += 1;
      match.minute = state.minute;

      if (state.minute === 45) {
        state.half = '中场休息';
        this._halftimeReport(match);
        this._push(match);
        continue;
      }
      if (state.minute > 90) {
        if (!state.done) {
          state.done = true;
          match.status = 'finished';
          match.minute = 90;
          this._push(match);
          // 演示模式：终场后自动重置并重新开赛，保证页面始终有直播
          if (this.onFinished) this.onFinished(match);
        }
        continue;
      }
      if (state.minute > 45) state.half = '下半场';

      // 执行到点的剧本事件（进球有小概率变异为点球 / 乌龙球）
      let consumed = 0;
      while (state.scriptIdx < script.length && script[state.scriptIdx].minute === state.minute) {
        const ev = script[state.scriptIdx];
        let type = ev.type;
        let detail = ev.detail;
        let xgVal = ev.xg;
        let scorerTeam = ev.team; // 得分方
        let statTeam = ev.team;   // 统计归属方
        let statShot = true;

        if (ev.type === 'goal') {
          const r = Math.random();
          if (r < 0.16) {
            type = 'penalty';
            detail = '点球命中！';
            xgVal = 0.78;
          } else if (r < 0.24) {
            type = 'own-goal';
            scorerTeam = ev.team === 'home' ? 'away' : 'home';
            statShot = false; // 乌龙球不计入射门与 XG
            const defLineup = ev.team === 'home' ? match.home.lineup : match.away.lineup;
            const name = defLineup && defLineup.length
              ? defLineup[Math.floor(Math.random() * defLineup.length)][0]
              : '防守球员';
            detail = `${name} 解围失误，乌龙球！`;
          }
        }

        if (statShot) match.xg[statTeam] = +(match.xg[statTeam] + xgVal).toFixed(2);
        const rec = {
          minute: state.minute,
          team: ev.team,
          type,
          xg: statShot ? xgVal : 0,
          detail,
          homeScore: match.score.home,
          awayScore: match.score.away,
        };
        if (type === 'goal' || type === 'penalty' || type === 'own-goal') {
          match.score[scorerTeam] += 1;
          rec.homeScore = match.score.home;
          rec.awayScore = match.score.away;
        }
        match.events.push(rec);
        if (statShot) this._updateStats(match, statTeam);
        consumed++;
        state.scriptIdx++;
      }

      const ambient = this._ambientEvents(match);
      if (consumed > 0 || ambient || state.minute % 3 === 0) this._push(match);
    }
  }

  _push(match) {
    this.broadcast({
      type: 'live-update',
      matchId: match.id,
      minute: match.minute,
      half: this.matches.get(match.id)?.half || '',
      status: match.status,
      score: match.score,
      xg: match.xg,
      stats: match.stats || null,
      events: match.events.slice(-6),
      homeTeam: match.home.id,
      awayTeam: match.away.id,
    });
  }

  stopAll() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }
}

module.exports = { XgEngine };
