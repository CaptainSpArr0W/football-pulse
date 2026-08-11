/*
 * 国内新闻爬虫（新浪体育 + 搜狐体育）
 * - 新浪：sports.sina.com.cn/global/（国际足球频道，服务端渲染，标题 + 链接 + 日期）
 * - 搜狐：sports.sohu.com/ 首页解析，按五大联赛球队/联赛关键词过滤（避免网球等噪音）
 * - 按球队分类：以球队中文名 / 英文名 / 常见别名匹配新闻标题，归入对应球队
 * - 聚合：ESPN（15 天内） + 新浪 + 搜狐 → 按时间倒序写入 t.news（最多 12 条）
 * - 全部异常静默降级，不影响站点其它功能
 */
const cheerio = require('cheerio');
const httpcache = require('./httpcache');
const espn = require('./espn-news');
const translate = require('./translate');

const BIG_FIVE = ['英超', '西甲', '德甲', '意甲', '法甲'];
const UA = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};
const pad = (n) => String(n).padStart(2, '0');
function log(msg) { console.log(`[新闻] ${msg}`); }

/* 常见中文别名（key：espn.norm 归一化后的英文队名） */
const ALIASES = {
  'manchesterunited': ['曼联', '红魔'],
  'manchesterunitedfc': ['曼联', '红魔'],
  'manchestercity': ['曼城', '蓝月亮'],
  'manchestercityfc': ['曼城', '蓝月亮'],
  'arsenal': ['阿森纳', '兵工厂', '枪手'],
  'arsenalfc': ['阿森纳', '兵工厂', '枪手'],
  'chelsea': ['切尔西', '蓝军'],
  'chelseafc': ['切尔西', '蓝军'],
  'liverpool': ['利物浦', '红军'],
  'liverpoolfc': ['利物浦', '红军'],
  'tottenhamhotspur': ['热刺'],
  'tottenhamhotspurfc': ['热刺'],
  'newcastleunited': ['纽卡', '纽卡斯尔'],
  'newcastleunitedfc': ['纽卡', '纽卡斯尔'],
  'westhamunited': ['西汉姆', '铁锤帮'],
  'westhamunitedfc': ['西汉姆', '铁锤帮'],
  'everton': ['埃弗顿', '太妃糖'],
  'evertonfc': ['埃弗顿', '太妃糖'],
  'realmadrid': ['皇马'],
  'realmadridcf': ['皇马'],
  'barcelona': ['巴萨', '巴塞罗那'],
  'fcbarcelona': ['巴萨', '巴塞罗那'],
  'atleticomadrid': ['马竞'],
  'clubatleticodemadrid': ['马竞'],
  'athleticclub': ['毕尔巴鄂', '毕包'],
  'realsociedad': ['皇家社会'],
  'realbetis': ['贝蒂斯'],
  'villarreal': ['比利亚雷亚尔', '黄潜'],
  'sevilla': ['塞维利亚'],
  'sevillafc': ['塞维利亚'],
  'valencia': ['瓦伦西亚'],
  'celtavigo': ['塞尔塔'],
  'girona': ['赫罗纳'],
  'osasuna': ['奥萨苏纳'],
  'getafe': ['赫塔菲', '赫塔费'],
  'mallorca': ['马略卡'],
  'rayovallecano': ['巴列卡诺'],
  'deportivoalaves': ['阿拉维斯'],
  'espanyol': ['西班牙人'],
  'bayernmunich': ['拜仁', '拜仁慕尼黑'],
  'bayernmunchen': ['拜仁', '拜仁慕尼黑'],
  'fcbayernmunchen': ['拜仁', '拜仁慕尼黑'],
  'borussiadortmund': ['多特', '多特蒙德'],
  'bvborussiadortmund': ['多特', '多特蒙德'],
  'rbleipzig': ['莱比锡'],
  'bayerleverkusen': ['勒沃库森', '药厂'],
  'bayer04leverkusen': ['勒沃库森', '药厂'],
  'eintrachtfrankfurt': ['法兰克福'],
  'vflwolfsburg': ['沃尔夫斯堡'],
  'borussiamonchengladbach': ['门兴'],
  'scfreiburg': ['弗赖堡'],
  'tsghoffenheim': ['霍芬海姆'],
  'mainz05': ['美因茨'],
  'fcaugsburg': ['奥格斯堡'],
  'werderbremen': ['不莱梅', '云达不莱梅'],
  'vfbstuttgart': ['斯图加特'],
  'unionberlin': ['柏林联合'],
  'fckoln': ['科隆'],
  'fcstpauli': ['圣保利'],
  'inter': ['国米', '国际米兰'],
  'intermilan': ['国米', '国际米兰'],
  'fcinternazionale': ['国米', '国际米兰'],
  'acmilan': ['AC米兰', '米兰'],
  'milan': ['AC米兰', '米兰'],
  'juventus': ['尤文', '尤文图斯'],
  'juventusfc': ['尤文', '尤文图斯'],
  'napoli': ['那不勒斯'],
  'sscnapoli': ['那不勒斯'],
  'roma': ['罗马'],
  'asroma': ['罗马'],
  'lazio': ['拉齐奥'],
  'sslazio': ['拉齐奥'],
  'atalanta': ['亚特兰大'],
  'fiorentina': ['佛罗伦萨'],
  'bologna': ['博洛尼亚'],
  'torino': ['都灵'],
  'udinese': ['乌迪内斯'],
  'psg': ['巴黎', '大巴黎', '巴黎圣日耳曼'],
  'parissaintgermain': ['巴黎', '大巴黎', '巴黎圣日耳曼'],
  'parissaint-germain': ['巴黎', '大巴黎', '巴黎圣日耳曼'],
  'marseille': ['马赛'],
  'olympiquedemarseille': ['马赛'],
  'lyon': ['里昂'],
  'olympiquelyonnais': ['里昂'],
  'monaco': ['摩纳哥'],
  'asmonaco': ['摩纳哥'],
  'lille': ['里尔'],
  'lilleosc': ['里尔'],
  'nice': ['尼斯'],
  'rennes': ['雷恩'],
  'lens': ['朗斯'],
  'strasbourg': ['斯特拉斯堡'],
  'nantes': ['南特'],
  'montpellier': ['蒙彼利埃'],
  'toulouse': ['图卢兹'],
  'reims': ['兰斯'],
  'auxerre': ['欧塞尔'],
  'brest': ['布雷斯特'],
  'lehavre': ['勒阿弗尔'],
  'angers': ['昂热'],
  'saintetienne': ['圣埃蒂安'],
};

/* 球队匹配关键词：中文名 + 英文名 + 别名 */
function teamKeywords(t) {
  const kws = [t.name, t.en].filter(Boolean);
  const alias = ALIASES[espn.norm(t.en)] || ALIASES[espn.norm(t.name)] || [];
  return [...new Set(kws.concat(alias))];
}

/* ---------- 新浪国际足球频道 ---------- */
async function fetchSina() {
  const key = 'cn-news:sina';
  const cached = httpcache.get(key);
  if (cached !== undefined) return cached;
  const res = await fetch('https://sports.sina.com.cn/global/', { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const $ = cheerio.load(await res.text());
  const seen = new Set();
  const out = [];
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const txt = $(el).text().replace(/\s+/g, ' ').trim();
    const m = /sports\.sina\.com\.cn\/\w+\/(20\d\d-\d\d-\d\d)\/doc-[a-z0-9]+\.shtml/i.exec(href);
    if (!m || txt.length < 10 || seen.has(txt)) return;
    seen.add(txt);
    const [y, mo, d] = m[1].split('-');
    out.push({
      sentiment: espn.classify(txt),
      source: '新浪体育',
      time: `${mo}-${d}`,
      title: txt.slice(0, 60),
      summary: '',
      link: href,
    });
  });
  httpcache.set(key, out, 20 * 60 * 1000);
  return out;
}

/* ---------- 搜狐体育首页（按球队/联赛关键词过滤） ---------- */
const SOHU_FILTER = ['皇马', '巴萨', '巴塞罗那', '皇家马德里', '马竞', '马德里竞技', '毕尔巴鄂', '皇家社会', '贝蒂斯', '比利亚雷亚尔', '塞维利亚', '瓦伦西亚', '塞尔塔', '赫罗纳', '奥萨苏纳', '赫塔菲', '马略卡', '巴列卡诺', '阿拉维斯', '西班牙人', '曼联', '曼城', '阿森纳', '切尔西', '利物浦', '热刺', '纽卡', '纽卡斯尔', '西汉姆', '埃弗顿', '拜仁', '多特', '莱比锡', '勒沃库森', '法兰克福', '沃尔夫斯堡', '门兴', '弗赖堡', '霍芬海姆', '美因茨', '奥格斯堡', '不莱梅', '斯图加特', '柏林联合', '科隆', '国米', '国际米兰', 'AC米兰', '米兰', '尤文', '那不勒斯', '罗马', '拉齐奥', '亚特兰大', '佛罗伦萨', '博洛尼亚', '都灵', '乌迪内斯', '巴黎', '大巴黎', '巴黎圣日耳曼', '马赛', '里昂', '摩纳哥', '里尔', '尼斯', '雷恩', '朗斯', '斯特拉斯堡', '南特', '英超', '西甲', '德甲', '意甲', '法甲', '欧冠'];

async function fetchSohu() {
  const key = 'cn-news:sohu';
  const cached = httpcache.get(key);
  if (cached !== undefined) return cached;
  const res = await fetch('https://sports.sohu.com/', { headers: UA });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const $ = cheerio.load(await res.text());
  const seen = new Set();
  const out = [];
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const txt = $(el).text().replace(/\s+/g, ' ').trim();
    if (!/sohu\.com\/a\/\d+/.test(href) || txt.length < 10 || seen.has(txt)) return;
    if (!SOHU_FILTER.some((k) => txt.includes(k))) return;
    seen.add(txt);
    const now = new Date(Date.now() + 8 * 3600 * 1000);
    out.push({
      sentiment: espn.classify(txt),
      source: '搜狐体育',
      time: `${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`,
      title: txt.slice(0, 60),
      summary: '',
      link: href.startsWith('//') ? 'https:' + href : href,
    });
  });
  httpcache.set(key, out, 20 * 60 * 1000);
  return out;
}

/* ---------- 聚合 ---------- */

function sortByTime(news) {
  return news.slice().sort((a, b) => (a.time > b.time ? -1 : a.time < b.time ? 1 : 0));
}

/* 刷新：为 store 中五大联赛球队聚合 ESPN + 新浪 + 搜狐 新闻 */
async function refresh(store) {
  const targets = [];
  for (const t of store.teamIndex.values()) {
    if (t.league && BIG_FIVE.includes(t.league) && (t.en || t.name)) targets.push(t);
  }
  if (!targets.length) return 0;
  // 国内新闻（一次抓取，多队共用）
  let cnItems = [];
  try { cnItems = cnItems.concat(await fetchSina()); } catch (_) {}
  try { cnItems = cnItems.concat(await fetchSohu()); } catch (_) {}
  log(`抓取国内新闻 ${cnItems.length} 条（新浪+搜狐）`);
  // 各队：ESPN（15 天内）+ 国内命中新闻
  let idx = 0;
  const worker = async () => {
    while (idx < targets.length) {
      const t = targets[idx++];
      try {
        const espnNews = await espn.getNewsForTeam(t);
        const kws = teamKeywords(t);
        const cnNews = cnItems.filter((n) => kws.some((k) => k && n.title.includes(k)));
        const merged = sortByTime(espnNews.concat(cnNews)).slice(0, 12);
        if (merged.length) t.news = await translate.translateNews(merged);
      } catch (_) { /* 单队失败不影响其它 */ }
    }
  };
  await Promise.all(Array.from({ length: 3 }, () => worker()));
  const withNews = targets.filter((t) => t.news && t.news.length).length;
  log(`完成：${targets.length} 支球队，${withNews} 支有新闻`);
  return targets.length;
}

function start(store) {
  const loop = () => refresh(store).catch((e) => log('刷新异常：' + e.message));
  setTimeout(loop, 8000);
  const timer = setInterval(loop, 30 * 60 * 1000);
  if (timer.unref) timer.unref();
  log('国内新闻爬虫已启动：每 30 分钟刷新（新浪 + 搜狐 + ESPN 聚合）');
}

module.exports = { start, refresh, fetchSina, fetchSohu };
