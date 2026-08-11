/*
 * 赛事配置：仅保留五大联赛（football-data.org 免费档可提供真实数据）
 */

/* 联赛代码 → 中文名 */
const CODES = {
  PL: '英超',
  PD: '西甲',
  BL1: '德甲',
  SA: '意甲',
  FL1: '法甲',
};

/* 首页标签固定展示的五大联赛 */
const BIG_FIVE = ['英超', '西甲', '德甲', '意甲', '法甲'];

/* 全部联赛 = 五大联赛 */
const ALL_LEAGUES = [...BIG_FIVE];

module.exports = { CODES, BIG_FIVE, ALL_LEAGUES };
