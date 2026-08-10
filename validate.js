/* 数据完整性校验 */
const store = require('./server/store');
const { teamMap } = require('./server/data/teams');
let errors = 0;
const fail = (msg) => { console.error('✗ ' + msg); errors++; };

console.log('== 赛事 ==');
for (const m of store.matches) {
  if (!teamMap.has(m.home.id) || !teamMap.has(m.away.id)) fail(`${m.id} 球队引用无效`);
  if (m.odds.europe.length !== 6) fail(`${m.id} 欧赔数量=${m.odds.europe.length}`);
  if (m.odds.asian.length !== 5) fail(`${m.id} 亚盘数量=${m.odds.asian.length}`);
  if (m.odds.total.length !== 5) fail(`${m.id} 大小球数量=${m.odds.total.length}`);
  if (m.odds.corners.length !== 5) fail(`${m.id} 角球数量=${m.odds.corners.length}`);
  if (!m.kickoff || !m.date) fail(`${m.id} 缺少时间/日期`);

  if (m.odds.europe[1].bookmaker !== '皇冠') fail(`${m.id} 欧赔皇冠未在第二位`);
  if (m.odds.asian.some((o) => o.bookmaker === '中国体育彩票')) fail(`${m.id} 亚盘不应包含体彩行`);
  const lotteryRows = m.odds.europe.filter((o) => o.bookmaker === '中国体育彩票');
  if (lotteryRows.length !== 1) fail(`${m.id} 欧赔体彩行数量=${lotteryRows.length}`);
  // 大小球与角球不得出现体彩行
  for (const dim of ['total', 'corners']) {
    if (m.odds[dim].some((o) => o.bookmaker === '中国体育彩票')) fail(`${m.id} ${dim} 不应包含体彩行`);
  }

  for (const o of m.odds.europe) {
    if (o.open === false) continue;
    for (const k of ['home', 'draw', 'away']) {
      if (!(o[k] > 1)) fail(`${m.id} ${o.bookmaker} 欧赔 ${k} 异常`);
    }
  }
  for (const o of m.odds.asian) {
    if (o.open === false) continue;
    if (!(o.home > 0.5 && o.away > 0.5)) fail(`${m.id} ${o.bookmaker} 亚盘水位异常`);
  }
  for (const o of m.odds.total) {
    if (o.open === false) continue;
    if (!(o.over > 0.5 && o.under > 0.5)) fail(`${m.id} ${o.bookmaker} 大小球水位异常`);
  }
  for (const o of m.odds.corners) {
    if (o.open === false) continue;
    if (!(o.over > 0.5 && o.under > 0.5)) fail(`${m.id} ${o.bookmaker} 角球水位异常`);
  }
}
console.log(`赛事共 ${store.matches.length} 场，通过`);

console.log('== 球队 ==');
for (const t of teamMap.values()) {
  const isLight = t.lineup.length === 0; // 轻量档球队（无阵容/舆论）
  if (isLight) {
    if (t.news.length !== 0) fail(`${t.id} 轻量队不应有舆论数据`);
  } else {
    if (t.lineup.length !== 11) fail(`${t.id} 阵容人数=${t.lineup.length}`);
    if (t.news.length < 4) fail(`${t.id} 舆论=${t.news.length}`);
  }
  if (t.recent.length !== 6) fail(`${t.id} 近六场=${t.recent.length}`);
  if (t.form.length !== 6) fail(`${t.id} 状态串=${t.form}`);
  if (!isLight) {
    for (const p of t.lineup) {
      const [, , posObj] = p;
      if (posObj.x < 0 || posObj.x > 100 || posObj.y < 0 || posObj.y > 100) fail(`${t.id} 位置坐标越界`);
    }
  }
}
console.log(`球队共 ${teamMap.size} 支，通过`);

console.log('== 实时引擎 ==');
store.boot(); // 校验脚本需自行启动引擎
if (store.engine.running().length !== 2) fail(`live 比赛数=${store.engine.running().length}`);
console.log('live 比赛: ' + store.engine.running().map((s) => s.match.id + '@' + s.match.minute + "'").join(', '));

if (errors) { console.error(`\n共 ${errors} 个问题`); process.exit(1); }
console.log('\n✓ 全部数据校验通过');
process.exit(0);
