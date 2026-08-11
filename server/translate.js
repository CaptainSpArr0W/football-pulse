/*
 * 翻译模块：抓取数据内部翻译后再挂到前端
 * - 词典翻译（离线、零成本）：天气描述、球员位置、足球常用词
 * - 在线翻译（MyMemory，国内可达）：英文新闻标题等长文本，带缓存 + 每日字符限额
 * - 全部失败时降级返回原文，不影响站点功能
 */
const httpcache = require('./httpcache');

/* ---------- 词典 ---------- */
const DICT = {
  /* 天气 */
  'sunny': '晴', 'clear': '晴', 'clear sky': '晴',
  'partly cloudy': '局部多云', 'partially cloudy': '局部多云',
  'cloudy': '多云', 'mostly cloudy': '多云', 'overcast': '阴',
  'rain': '雨', 'light rain': '小雨', 'moderate rain': '中雨', 'heavy rain': '大雨',
  'rainy': '雨', 'drizzle': '毛毛雨', 'showers': '阵雨',
  'snow': '雪', 'light snow': '小雪', 'heavy snow': '大雪',
  'thunderstorm': '雷雨', 'thunderstorms': '雷雨', 'storm': '暴风雨',
  'windy': '大风', 'breezy': '微风', 'wind': '风',
  'fog': '雾', 'foggy': '雾', 'mist': '薄雾',
  'humid': '潮湿', 'hot': '炎热', 'warm': '温暖', 'mild': '温和', 'cool': '凉爽', 'cold': '寒冷', 'chilly': '寒冷',
  'hail': '冰雹', 'sleet': '雨夹雪',
  /* 风向 */
  'north': '北风', 'south': '南风', 'east': '东风', 'west': '西风',
  'northwest': '西北风', 'northeast': '东北风', 'southwest': '西南风', 'southeast': '东南风',
  'n': '北风', 's': '南风', 'e': '东风', 'w': '西风',
  'nw': '西北风', 'ne': '东北风', 'sw': '西南风', 'se': '东南风',
  'calm': '无风', 'light air': '微风', 'gentle breeze': '微风', 'moderate breeze': '和风', 'fresh breeze': '清风', 'strong breeze': '强风', 'near gale': '疾风', 'gale': '大风', 'storm': '暴风', 'hurricane': '飓风',
  /* 球员位置 */
  'gk': '门将', 'df': '后卫', 'mf': '中场', 'fw': '前锋',
  'goalkeeper': '门将', 'defender': '后卫', 'midfielder': '中场', 'forward': '前锋', 'striker': '前锋',
  /* 足球常用词 */
  'assist': '助攻', 'own goal': '乌龙球', 'substitution': '换人', 'red card': '红牌',
  'yellow card': '黄牌', 'penalty': '点球', 'free kick': '任意球', 'corner': '角球',
  'header': '头球', 'offsides': '越位', 'foul': '犯规', 'possession': '控球',
};

const hasCJK = (s) => /[\u4e00-\u9fff]/.test(s);
const lower = (s) => String(s || '').toLowerCase();

/* 词典翻译：整词/短语匹配（天气与位置等短文本） */
function zhDict(text) {
  const s = String(text || '').trim();
  if (!s || hasCJK(s)) return s;
  const key = lower(s);
  if (DICT[key]) return DICT[key];
  // 逗号分隔的多词描述：逐词翻译后拼接
  const parts = key.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const zh = parts.map((p) => DICT[p] || p).join('，');
    if (zh !== s) return zh;
  }
  return s;
}

/* ---------- 在线翻译（MyMemory，免费 5000 字符/天） ---------- */
const DAY_LIMIT = 4500; // 每日在线翻译字符上限（保留余量）
const usage = { date: '', chars: 0 };

function usageToday() {
  const today = new Date().toISOString().slice(0, 10);
  if (usage.date !== today) { usage.date = today; usage.chars = 0; }
  return usage;
}

async function onlineZh(text) {
  const s = String(text || '').trim();
  if (!s || s.length < 3 || hasCJK(s)) return s;
  const key = 'tr-zh:' + s;
  const cached = httpcache.get(key);
  if (cached !== undefined) return cached;
  const u = usageToday();
  if (u.chars + s.length > DAY_LIMIT) return s; // 超限降级原文
  try {
    const q = encodeURIComponent(s.slice(0, 480));
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${q}&langpair=en|zh-CN`, {
      headers: { 'user-agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return s;
    const j = await res.json();
    const zh = (j.responseData && j.responseData.translatedText) || '';
    if (zh && zh !== s) {
      u.chars += s.length;
      httpcache.set(key, zh, 30 * 24 * 3600 * 1000);
      return zh;
    }
  } catch (_) { /* 网络失败降级 */ }
  return s;
}

/* 批量翻译新闻标题（英文才翻译，去重缓存） */
async function translateNews(news) {
  const seen = new Map();
  const out = [];
  for (const n of news || []) {
    const t = String(n.title || '');
    let zh = t;
    if (t && !hasCJK(t)) {
      if (seen.has(t)) zh = seen.get(t);
      else { zh = await onlineZh(t); seen.set(t, zh); }
    }
    out.push({ ...n, title: zh });
  }
  return out;
}

/* 天气对象翻译（同步，词典） */
function zhWeather(w) {
  if (!w) return w;
  return {
    ...w,
    desc: zhDict(w.desc || w.description || ''),
    windDir: zhDict(w.windDir || ''),
  };
}

/* 阵容位置翻译（同步，词典） */
function zhLineup(lineup) {
  if (!Array.isArray(lineup)) return lineup;
  return lineup.map(([name, num, p]) => {
    if (!p || !p.pos) return [name, num, p];
    return [name, num, { ...p, pos: zhDict(p.pos) }];
  });
}

module.exports = { zhDict, onlineZh, translateNews, zhWeather, zhLineup, quotaUsage: () => usageToday().chars };
