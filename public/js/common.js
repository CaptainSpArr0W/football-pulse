/* 公共工具 + WebSocket 实时客户端 */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* 队徽：队色渐变圆 + 缩写 */
function crestHtml(team, size = 34, cls = 'crest') {
  if (team && team.crest) {
    return `<img class="${cls}" src="${esc(team.crest)}" alt="${esc(team.name)}" style="width:${size}px;height:${size}px" loading="lazy">`;
  }
  const s = size;
  return `<span class="${cls}" style="width:${s}px;height:${s}px;font-size:${Math.round(s * 0.32)}px;background:linear-gradient(140deg, ${esc(team.color)}, ${esc(team.color2)})">${esc(team.short)}</span>`;
}

/* 球队链接（点击队名跳转详情页） */
function teamLink(team) {
  return `<a href="/team.html?team=${encodeURIComponent(team.id)}">${esc(team.name)}</a>`;
}

function fmtKick(kickoff) {
  return kickoff; // 后端已格式化为 HH:mm
}

function formResultClass(r) {
  return r === 'W' ? 'W' : r === 'D' ? 'D' : 'L';
}

/* ---------- 赔率表格 ---------- */

/* 亚盘盘口：阿拉伯数字表述（负=主让，正=主受） */
function lineText(line) {
  if (line == null) return '--';
  if (line === 0) return '0';
  return line > 0 ? `+${line}` : `${line}`;
}

/* 未开盘（体彩）行的占位 */
function emptyRow(bookmaker) {
  return `<tr class="odds-row-empty">
    <td class="odds-bookmaker">${esc(bookmaker)}</td>
    <td colspan="3" class="odds-empty">-- 未开盘 --</td>
  </tr>`;
}

function europeTable(match) {
  const rows = match.odds.europe
    .map((o) => {
      if (o.open === false) return emptyRow(o.bookmaker);
      const cell = (v) => `<td class="odds-value">${v.toFixed(2)}</td>`;
      return `<tr>
        <td class="odds-bookmaker">${esc(o.bookmaker)}</td>
        ${cell(o.home)}${cell(o.draw)}${cell(o.away)}
      </tr>`;
    })
    .join('');
  return `<table class="odds-table">
    <thead><tr><th></th><th>主胜</th><th>平局</th><th>客胜</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="odds-note">胜平负赔率 · 数据来源 API-Football</div>`;
}

function asianTable(match) {
  const rows = match.odds.asian
    .map((o) => {
      if (o.open === false) return emptyRow(o.bookmaker);
      return `<tr>
        <td class="odds-bookmaker">${esc(o.bookmaker)}</td>
        <td class="odds-line">${lineText(o.line)}</td>
        <td class="odds-value">${o.home.toFixed(2)}</td>
        <td class="odds-value">${o.away.toFixed(2)}</td>
      </tr>`;
    })
    .join('');
  return `<table class="odds-table">
    <thead><tr><th></th><th>盘口</th><th>主水</th><th>客水</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="odds-note">盘口以主队视角，负数为让球，正数为受让</div>`;
}

function totalTable(match) {
  const rows = match.odds.total
    .map((o) => {
      if (o.open === false) return emptyRow(o.bookmaker);
      return `<tr>
        <td class="odds-bookmaker">${esc(o.bookmaker)}</td>
        <td class="odds-line">${o.line.toFixed(2)}</td>
        <td class="odds-value">${o.over.toFixed(2)}</td>
        <td class="odds-value">${o.under.toFixed(2)}</td>
      </tr>`;
    })
    .join('');
  return `<table class="odds-table">
    <thead><tr><th></th><th>盘口</th><th>大球</th><th>小球</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="odds-note">总进球数盘口</div>`;
}

function cornersTable(match) {
  const rows = match.odds.corners
    .map((o) => {
      if (o.open === false) return emptyRow(o.bookmaker);
      return `<tr>
        <td class="odds-bookmaker">${esc(o.bookmaker)}</td>
        <td class="odds-line">${o.line.toFixed(1)}</td>
        <td class="odds-value">${o.over.toFixed(2)}</td>
        <td class="odds-value">${o.under.toFixed(2)}</td>
      </tr>`;
    })
    .join('');
  return `<table class="odds-table">
    <thead><tr><th></th><th>盘口</th><th>大角</th><th>小角</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="odds-note">全场角球总数大小盘</div>`;
}

/* ---------- 比赛预测面板（Dixon-Coles 模型：胜平负 / 大小球 / 亚盘，置于选项卡内） ---------- */
function predPanel(pred) {
  if (!pred) return '';
  const pct = (v) => (v == null ? '--' : `${v}%`);
  const bar = (v) => `<span class="pred-bar"><i style="width:${Math.min(v, 100)}%"></i></span>`;
  const x12 = pred.x12 || [];
  const rows = x12.map((x) => `
    <span class="pred-cell${x.label === pred.x12Pick.label ? ' is-pick' : ''}">
      <em>${esc(x.label)}</em><b>${pct(x.prob)}</b>${bar(x.prob)}
    </span>`).join('');
  return `<div class="pred-wrap" data-pred>
    <div class="pred-head">模型预测 <span class="pred-src">Dixon-Coles · 2025-26 数据拟合</span></div>
    <div class="pred-block">
      <div class="pred-label">胜平负</div>
      <div class="pred-x12">${rows}</div>
      <div class="pred-pick">推荐 <b>${esc(pred.x12Pick.label)}</b>（${pct(pred.x12Pick.prob)}）· 期望 ${pred.expGoals.home}:${pred.expGoals.away}</div>
    </div>
    <div class="pred-block pred-two">
      <div>
        <div class="pred-label">大小球（${pred.ou.line}）</div>
        <div class="pred-ou">
          <span class="pred-cell${pred.ou.pick === '大' ? ' is-pick' : ''}"><em>大球</em><b>${pct(pred.ou.over)}</b>${bar(pred.ou.over)}</span>
          <span class="pred-cell${pred.ou.pick === '小' ? ' is-pick' : ''}"><em>小球</em><b>${pct(pred.ou.under)}</b>${bar(pred.ou.under)}</span>
        </div>
        <div class="pred-pick">推荐 <b>${esc(pred.ou.pick)}球</b>（${pct(pred.ou.pick === '大' ? pred.ou.over : pred.ou.under)}）</div>
      </div>
      <div>
        <div class="pred-label">亚盘（${esc(pred.asian.lineText)}）</div>
        <div class="pred-ou">
          <span class="pred-cell${pred.asian.pick === '主队' ? ' is-pick' : ''}"><em>主队赢盘</em><b>${pct(pred.asian.homeCover)}</b>${bar(pred.asian.homeCover)}</span>
          <span class="pred-cell${pred.asian.pick === '客队' ? ' is-pick' : ''}"><em>客队赢盘</em><b>${pct(pred.asian.awayCover)}</b>${bar(pred.asian.awayCover)}</span>
        </div>
        <div class="pred-pick">推荐 <b>${esc(pred.asian.pick)}</b>（${pct(pred.asian.pick === '主队' ? pred.asian.homeCover : pred.asian.awayCover)}）</div>
      </div>
    </div>
  </div>`;
}

/* 卡片选项卡组装：赔率 tabs（若有）+ 模型预测 tab（若有），均置于选项卡内 */
function oddsSection(match) {
  const od = match.odds || {};
  const hasOdds = (od.europe && od.europe.length) || (od.asian && od.asian.length)
    || (od.total && od.total.length) || (od.corners && od.corners.length);
  const pred = match.pred;
  if (!hasOdds && !pred) return '';

  const tabs = [];
  const panels = [];
  if (hasOdds) {
    tabs.push('<button class="odds-tab active" data-tab="europe">欧赔</button>',
      '<button class="odds-tab" data-tab="asian">亚盘</button>',
      '<button class="odds-tab" data-tab="total">大小球</button>',
      '<button class="odds-tab" data-tab="corners">角球</button>');
    panels.push(`<div class="odds-panel" data-panel="europe">${europeTable(match)}</div>`,
      `<div class="odds-panel" data-panel="asian" hidden>${asianTable(match)}</div>`,
      `<div class="odds-panel" data-panel="total" hidden>${totalTable(match)}</div>`,
      `<div class="odds-panel" data-panel="corners" hidden>${cornersTable(match)}</div>`);
  }
  if (pred) {
    tabs.push(`<button class="odds-tab${hasOdds ? '' : ' active'}" data-tab="pred">预测</button>`);
    panels.push(`<div class="odds-panel" data-panel="pred"${hasOdds ? ' hidden' : ''}>${predPanel(pred)}</div>`);
  }

  return `<div class="odds-wrap" data-odds>
    <div class="odds-tabs">${tabs.join('')}</div>
    ${panels.join('')}
    <div class="odds-updated">${match.status === 'live' ? '实时更新' : pred ? '模型预测 · Dixon-Coles' : '赛前数据'}</div>
  </div>`;
}

function oddsTable(match) {
  const od = match.odds || {};
  const hasOdds = (od.europe && od.europe.length) || (od.asian && od.asian.length)
    || (od.total && od.total.length) || (od.corners && od.corners.length);
  if (!hasOdds) return ''; // 无真实赔率数据时不渲染赔率区
  return `<div class="odds-wrap" data-odds>
    <div class="odds-tabs">
      <button class="odds-tab active" data-tab="europe">欧赔</button>
      <button class="odds-tab" data-tab="asian">亚盘</button>
      <button class="odds-tab" data-tab="total">大小球</button>
      <button class="odds-tab" data-tab="corners">角球</button>
    </div>
    <div class="odds-panel" data-panel="europe">${europeTable(match)}</div>
    <div class="odds-panel" data-panel="asian" hidden>${asianTable(match)}</div>
    <div class="odds-panel" data-panel="total" hidden>${totalTable(match)}</div>
    <div class="odds-panel" data-panel="corners" hidden>${cornersTable(match)}</div>
    <div class="odds-updated">${match.status === 'live' ? '实时更新' : '赛前数据'}</div>
  </div>`;
}

/* ---------- 比赛预测面板（Dixon-Coles 模型：胜平负 / 大小球 / 亚盘） ---------- */
function predPanel(pred) {
  if (!pred) return '';
  const pct = (v) => (v == null ? '--' : `${v}%`);
  const bar = (v) => `<span class="pred-bar"><i style="width:${Math.min(v, 100)}%"></i></span>`;
  const x12 = pred.x12 || [];
  const rows = x12.map((x) => `
    <span class="pred-cell${x.label === pred.x12Pick.label ? ' is-pick' : ''}">
      <em>${esc(x.label)}</em><b>${pct(x.prob)}</b>${bar(x.prob)}
    </span>`).join('');
  return `<div class="pred-wrap" data-pred>
    <div class="pred-head">模型预测 <span class="pred-src">Dixon-Coles · 2025-26 数据拟合</span></div>
    <div class="pred-block">
      <div class="pred-label">胜平负</div>
      <div class="pred-x12">${rows}</div>
      <div class="pred-pick">推荐 <b>${esc(pred.x12Pick.label)}</b>（${pct(pred.x12Pick.prob)}）· 期望 ${pred.expGoals.home}:${pred.expGoals.away}</div>
    </div>
    <div class="pred-block pred-two">
      <div>
        <div class="pred-label">大小球（${pred.ou.line}）</div>
        <div class="pred-ou">
          <span class="pred-cell${pred.ou.pick === '大' ? ' is-pick' : ''}"><em>大球</em><b>${pct(pred.ou.over)}</b>${bar(pred.ou.over)}</span>
          <span class="pred-cell${pred.ou.pick === '小' ? ' is-pick' : ''}"><em>小球</em><b>${pct(pred.ou.under)}</b>${bar(pred.ou.under)}</span>
        </div>
        <div class="pred-pick">推荐 <b>${esc(pred.ou.pick)}球</b>（${pct(pred.ou.pick === '大' ? pred.ou.over : pred.ou.under)}）</div>
      </div>
      <div>
        <div class="pred-label">亚盘（${esc(pred.asian.lineText)}）</div>
        <div class="pred-ou">
          <span class="pred-cell${pred.asian.pick === '主队' ? ' is-pick' : ''}"><em>主队赢盘</em><b>${pct(pred.asian.homeCover)}</b>${bar(pred.asian.homeCover)}</span>
          <span class="pred-cell${pred.asian.pick === '客队' ? ' is-pick' : ''}"><em>客队赢盘</em><b>${pct(pred.asian.awayCover)}</b>${bar(pred.asian.awayCover)}</span>
        </div>
        <div class="pred-pick">推荐 <b>${esc(pred.asian.pick)}</b>（${pct(pred.asian.pick === '主队' ? pred.asian.homeCover : pred.asian.awayCover)}）</div>
      </div>
    </div>
  </div>`;
}

/* 赔率 Tab 切换（事件委托） */
document.addEventListener('click', (e) => {
  const tab = e.target.closest('.odds-tab');
  if (!tab) return;
  const wrap = tab.closest('.odds-wrap');
  wrap.querySelectorAll('.odds-tab').forEach((t) => t.classList.toggle('active', t === tab));
  wrap.querySelectorAll('.odds-panel').forEach((p) => { p.hidden = p.dataset.panel !== tab.dataset.tab; });
});

/* ---------- 本地订阅（localStorage） ---------- */
const SUB_KEY = 'fp-subs';
function getSubs() {
  try { return JSON.parse(localStorage.getItem(SUB_KEY) || '[]'); } catch (_) { return []; }
}
function setSubs(list) { localStorage.setItem(SUB_KEY, JSON.stringify(list)); }
function isSubscribed(id) { return getSubs().includes(id); }
function toggleSub(id) {
  const list = getSubs();
  const i = list.indexOf(id);
  let on;
  if (i >= 0) { list.splice(i, 1); on = false; } else { list.push(id); on = true; }
  setSubs(list);
  updateSubCount();
  return on;
}
function updateSubCount() {
  const el = document.getElementById('subCount');
  if (el) el.textContent = getSubs().length;
}
/* 多标签页同步订阅数 */
window.addEventListener('storage', (e) => { if (e.key === SUB_KEY) updateSubCount(); });
updateSubCount();

/* 订阅按钮（星标）事件委托 */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.sub-btn');
  if (!btn) return;
  const on = toggleSub(btn.dataset.sub);
  btn.classList.toggle('on', on);
  if (btn.dataset.text) btn.textContent = on ? '★ 已订阅' : '☆ 订阅';
  else btn.textContent = on ? '★' : '☆';
});

/* ---------- 比赛列表卡片 ---------- */
function matchCard(match, index) {
  const isLive = match.status === 'live';
  const scoreHtml = match.status === 'finished'
    ? `${match.score.home} : ${match.score.away}`
    : isLive
      ? `<span class="match-score-live">${match.score.home} : ${match.score.away}</span>`
      : '<span class="vs">VS</span>';

  const statusHtml = isLive
    ? `<span class="match-status-live">进行中 ${match.minute}&#39;</span>`
    : `<span class="match-time">${fmtKick(match.kickoff)}</span>`;

  const subOn = isSubscribed(match.id);
  const oppBadge = match.oppXg
    ? '<span class="opp-badge opp-xg">⚡ 好机会 · xG异动</span>'
    : match.oppHc
      ? '<span class="opp-badge opp-hc">⚡ 好机会 · 盘口异动</span>'
      : '';
  return `<div class="match-card${isLive ? ' is-live' : ''}${(match.oppXg || match.oppHc) ? ' is-opp' : ''} match-clickable" data-match-row="${match.id}" data-match="${match.id}" style="animation-delay:${Math.min(index * 45, 360)}ms" title="点击查看实力分区与预测首发">
    <button class="sub-btn${subOn ? ' on' : ''}" data-sub="${match.id}" title="订阅本场比赛" onclick="event.stopPropagation()">${subOn ? '★' : '☆'}</button>
    <div class="match-meta">
      <span class="match-comp">${esc(match.competition)} · ${esc(match.round)}</span>
      <span class="match-round">${esc(match.date)}</span>
      ${statusHtml}
      ${oppBadge}
    </div>
    <div class="match-teams">
      <div class="match-team">
        ${crestHtml(match.home)}
        <span class="match-team-name">${teamLink(match.home)}</span>
      </div>
      <div class="match-score" data-role="score">${scoreHtml}</div>
      <div class="match-team away-team">
        <span class="match-team-name">${teamLink(match.away)}</span>
        ${crestHtml(match.away)}
      </div>
    </div>
    ${oddsSection(match)}
  </div>`;
}

/* WebSocket 客户端：自动重连 */
function connectWS(onMessage) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  let ws = null;
  let retry = 0;
  let closedByUser = false;

  function open() {
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onopen = () => { retry = 0; };
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        /* 全局：在线人数 */
        if (data.type === 'online-count') {
          const el = document.getElementById('onlineCount');
          if (el) el.textContent = data.count;
        }
        onMessage(data);
      } catch (_) { /* ignore */ }
    };
    ws.onclose = () => {
      if (closedByUser) return;
      const delay = Math.min(1000 * 2 ** retry, 10000);
      retry += 1;
      setTimeout(open, delay);
    };
  }

  open();
  return {
    close() { closedByUser = true; if (ws) ws.close(); },
  };
}
