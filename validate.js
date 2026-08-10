/* 数据完整性校验（真实数据模式） */
const store = require('./server/store');
let errors = 0;
const fail = (msg) => { console.error('✗ ' + msg); errors++; };

console.log('== 比赛 ==');
for (const m of store.matches) {
  if (!store.teamIndex.has(m.home.id) || !store.teamIndex.has(m.away.id)) fail(`${m.id} 球队引用无效`);
  if (!m.date || !m.kickoff || !m.kickoffTs) fail(`${m.id} 缺少时间/日期`);
  if (!['upcoming', 'live', 'finished'].includes(m.status)) fail(`${m.id} 状态异常：${m.status}`);
  if (m.score.home == null || m.score.away == null) fail(`${m.id} 比分异常`);
}
console.log(`比赛共 ${store.matches.length} 场`);

console.log('== 球队 ==');
for (const t of store.teamIndex.values()) {
  if (!t.name) fail(`${t.id} 缺少队名`);
  if (t.recent && t.recent.length > 6) fail(`${t.id} 近况超过 6 场`);
}
console.log(`球队共 ${store.teamIndex.size} 支`);

console.log('== 日期 ==');
const dates = store.availableDates();
console.log(`覆盖 ${dates.length} 天：${dates.join(', ')}`);

if (errors) {
  console.error(`共 ${errors} 个问题`);
  process.exit(1);
}
console.log('校验通过');
