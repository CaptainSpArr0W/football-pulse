/*
 * 赛事配置：football-data.org 免费档实际开放的赛事
 * 仅展示 API 能提供真实数据的赛事，未开放赛事一律不展示
 */

/* 联赛代码 → 中文名（探测自 /v4/competitions） */
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

module.exports = { CODES, BIG_FIVE };
