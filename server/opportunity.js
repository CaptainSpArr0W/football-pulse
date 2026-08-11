/*
 * 「好机会」模块
 *
 * 1. 直播中比赛：xG 实时检测（Fotmob 免费源）
 *    - 短时间（单轮询窗口）内任一队 xG 增长 ≥ 0.4 → 高亮比赛卡
 *    - 高亮后：比分变化（任意队进球）→ 取消高亮并重新检测
 *    - 或：一段时间（8 分钟）内比分未变且 xG 回落至飙升前基线 ±0.1 → 取消高亮并重新检测
 *
 * 2. 未开赛比赛：亚盘盘口追踪（API-Football）
 *    - 开赛前 48h 内首次捕获开盘让球线（作为初始盘口）
 *    - 每场固定在开赛前 1 小时强制刷新一次，对比临场盘口
 *    - 盘口波动 ≥ ±0.5 → 高亮比赛选项卡
 *
 * 全部异常静默降级；高亮状态写入 match.oppXg / match.oppHc，随 overview 输出，并经 WS 实时推送。
 */
const free = require('./freefootball');

const XG_POLL_MS = 5 * 60 * 1000;      // xG 轮询间隔（对齐 Fotmob 直播缓存 5 分钟）
const XG_SPIKE = 0.4;                   // xG 短时异动阈值
const XG_FALLBACK = 0.1;                // 高亮后 xG 回落判定（相对飙升前基线 ±0.1）
const XG_FALLBACK_MS = 8 * 60 * 1000;   // 高亮后等待窗口（8 分钟未进球才看回落）
const HC_OPEN_WINDOW = 48 * 3600 * 1000; // 开盘线捕获窗口（开赛前 48h 内）
const HC_CHECK_LEAD = 1 * 3600 * 1000;   // 临场检查提前量（开赛前 1 小时）
const HC_MOVE = 0.5;                     // 盘口异动阈值（±0.5）
const PRE_POLL_MS = 5 * 60 * 1000;       // 未开赛盘口轮询间隔

const xgStates = new Map(); // matchId -> { prevMax, spikeBase, highlighted, highlightedAt, lastScore }
const hcStates = new Map(); // matchId -> { opening, checked, highlighted }

function scoreKey(m) {
  return m.score ? `${m.score.home}-${m.score.away}` : '0-0';
}

function log(msg) { console.log(`[机会] ${msg}`); }

/* ---------- 直播 xG 检测 ---------- */
async function pollLive(store, push) {
  for (const m of store.matches) {
    if (m.status !== 'live') { xgStates.delete(m.id); continue; }
    let st = xgStates.get(m.id);
    if (!st) st = { prevMax: null, spikeBase: 0, highlighted: false, highlightedAt: 0, lastScore: scoreKey(m) };
    let xg = null;
    try { xg = await free.liveXg(m, false); } catch (_) { /* 免费源失败跳过本轮 */ }
    if (!xg) continue;
    const max = Math.max(xg.home || 0, xg.away || 0);
    const key = scoreKey(m);

    if (st.prevMax == null) {
      // 首次观察到该场：只初始化基线，不触发检测
      st.prevMax = max;
      st.lastScore = key;
      xgStates.set(m.id, st);
      continue;
    }

    if (st.highlighted) {
      if (key !== st.lastScore) {
        // 比分变化（任意队进球）→ 取消高亮，重新检测
        st.highlighted = false;
        m.oppXg = false;
        push(m, 'xg', false, { reason: '进球' });
        log(`xG 高亮取消（进球）：${m.id}`);
      } else if (Date.now() - st.highlightedAt >= XG_FALLBACK_MS && max <= st.spikeBase + XG_FALLBACK) {
        // 一段时间未进球且 xG 回落至飙升前基线附近 → 取消高亮
        st.highlighted = false;
        m.oppXg = false;
        push(m, 'xg', false, { reason: 'xG回落' });
        log(`xG 高亮取消（回落）：${m.id} 当前 ${max.toFixed(2)} / 基线 ${st.spikeBase.toFixed(2)}`);
      }
    } else if (max - st.prevMax >= XG_SPIKE) {
      // 短时间 xG 异动（≥0.4）→ 高亮
      st.highlighted = true;
      st.highlightedAt = Date.now();
      st.spikeBase = st.prevMax;
      m.oppXg = true;
      push(m, 'xg', true, { prev: st.prevMax, now: max });
      log(`xG 异动高亮：${m.id} ${st.prevMax.toFixed(2)} → ${max.toFixed(2)}`);
    }

    st.prevMax = max;
    st.lastScore = key;
    xgStates.set(m.id, st);
  }
}

/* ---------- 未开赛亚盘追踪 ---------- */
async function pollPreMatch(store, push) {
  const apiFb = require('./apifootball');
  if (!apiFb.isEnabled()) return;
  const now = Date.now();
  for (const m of store.matches) {
    if (m.status !== 'upcoming' || !m.kickoffTs || !m.apiFixtureId) { hcStates.delete(m.id); continue; }
    let st = hcStates.get(m.id);
    if (!st) st = { opening: null, checked: false, highlighted: false };
    const tilKickoff = m.kickoffTs - now;
    if (tilKickoff <= 0) { hcStates.delete(m.id); continue; }

    // 开盘线捕获：开赛前 48h 内；已有今日赔率直接复用，否则取一次（缓存 30 分钟）
    if (st.opening == null && tilKickoff <= HC_OPEN_WINDOW) {
      if (m.odds && m.odds.asian && m.odds.asian[0]) {
        st.opening = m.odds.asian[0].line;
      } else {
        const h = await apiFb.asianLine(m.apiFixtureId, false);
        if (h) st.opening = h.line;
      }
    }

    // 临场检查：开赛前 1 小时（含轮询提前量）固定刷新一次
    if (st.opening != null && !st.checked && tilKickoff <= HC_CHECK_LEAD + PRE_POLL_MS) {
      st.checked = true;
      const h = await apiFb.asianLine(m.apiFixtureId, true);
      if (h) {
        const move = Math.round(Math.abs(h.line - st.opening) * 100) / 100;
        const flagged = move >= HC_MOVE;
        st.highlighted = flagged;
        m.oppHc = flagged;
        push(m, 'hc', flagged, { opening: st.opening, now: h.line, move });
        log(`盘口临场${flagged ? '异动高亮' : '稳定'}：${m.id} 开盘 ${st.opening} → 临场 ${h.line}（±${move}）`);
      }
    }

    hcStates.set(m.id, st);
  }
}

/* ---------- 启动 ---------- */
function start(store) {
  const push = (m, kind, on, detail) => {
    store.broadcast({ type: 'opportunity', matchId: m.id, kind, on, detail });
  };
  const liveLoop = () => pollLive(store, push).catch(() => {});
  const preLoop = () => pollPreMatch(store, push).catch(() => {});
  preLoop(); // 先做盘口追踪（低频），再做 xG
  liveLoop();
  const t1 = setInterval(liveLoop, XG_POLL_MS);
  const t2 = setInterval(preLoop, PRE_POLL_MS);
  if (t1.unref) t1.unref();
  if (t2.unref) t2.unref();
  log(`已启动：xG 每 ${XG_POLL_MS / 60000} 分钟检测，盘口每 ${PRE_POLL_MS / 60000} 分钟轮询（开赛前 1 小时强制刷新）`);
}

module.exports = { start, pollLive, pollPreMatch };
