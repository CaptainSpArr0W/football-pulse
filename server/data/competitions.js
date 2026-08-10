/*
 * 赛事配置
 * - CODES：football-data.org 免费档实际开放的赛事（能提供真实数据）
 * - EXTRA_LEAGUES：football-data 免费档不提供、由 API-Football 补充的赛事
 *   （通过赛程接口中的联赛名称/国家识别，无需额外接口）
 */

/* 联赛代码 → 中文名（football-data.org 免费档） */
const CODES = {
  PL: '英超',
  PD: '西甲',
  BL1: '德甲',
  SA: '意甲',
  FL1: '法甲',
  ELC: '英冠',
  PPL: '葡超',
  DED: '荷甲',
  BSA: '巴西甲',
  CL: '欧冠',
  CLI: '解放者杯',
  EC: '欧洲杯',
  WC: '世界杯',
};

/* 首页标签固定展示的五大联赛 */
const BIG_FIVE = ['英超', '西甲', '德甲', '意甲', '法甲'];

/* 额外联赛（API-Football 数据源）：
 * apifbName    - 赛程接口 league.name 匹配正则
 * apifbCountry - 赛程接口 league.country 匹配正则（两项均须命中，防误配） */
const EXTRA_LEAGUES = [
  { code: 'KLEAGUE', name: '韩K', apifbName: /k\s*league/i, apifbCountry: /korea/i },
  { code: 'JLEAGUE', name: '日职', apifbName: /j\s*1\s*\.?\s*league|j\.?league/i, apifbCountry: /japan/i },
  { code: 'SAL', name: '沙特甲', apifbName: /saudi|pro league/i, apifbCountry: /saudi/i },
  { code: 'ALLS', name: '瑞典超', apifbName: /allsvenskan/i, apifbCountry: /sweden/i },
  { code: 'SDL', name: '丹麦超', apifbName: /superliga/i, apifbCountry: /denmark/i },
  { code: 'EERSTE', name: '荷兰乙', apifbName: /eerste divisie/i, apifbCountry: /netherlands/i },
  { code: 'BL2', name: '德国乙', apifbName: /2\.\s*bundesliga|bundesliga\s*2/i, apifbCountry: /germany/i },
  { code: 'MXL', name: '墨西哥超', apifbName: /liga mx|primera divisi|liga bbva|apertura|clausura/i, apifbCountry: /mexico/i },
];

/* 全部联赛（用于筛选下拉始终展示） */
const ALL_LEAGUES = [...new Set([
  ...BIG_FIVE,
  ...Object.values(CODES),
  ...EXTRA_LEAGUES.map((l) => l.name),
])];

module.exports = { CODES, BIG_FIVE, EXTRA_LEAGUES, ALL_LEAGUES };
