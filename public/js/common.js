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
  <div class="odds-note">体彩竞彩胜平负</div>`;
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

function oddsTable(match) {
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
  return `<div class="match-card${isLive ? ' is-live' : ''}" data-match-row="${match.id}" style="animation-delay:${Math.min(index * 45, 360)}ms">
    <button class="sub-btn${subOn ? ' on' : ''}" data-sub="${match.id}" title="订阅本场比赛">${subOn ? '★' : '☆'}</button>
    <div class="match-meta">
      <span class="match-comp">${esc(match.competition)} · ${esc(match.round)}</span>
      <span class="match-round">${esc(match.date)}</span>
      ${statusHtml}
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
    ${oddsTable(match)}
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
