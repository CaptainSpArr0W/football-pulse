/*
 * 翻译模块：抓取数据内部翻译后再挂到前端
 * - 词典翻译（离线、零成本）：天气描述、球员位置、足球常用词
 * - 在线翻译（MyMemory，国内可达）：英文新闻标题等长文本，带缓存 + 每日字符限额
 * - 全部失败时降级返回原文，不影响站点功能
 */
const httpcache = require('./httpcache');
const teamNames = require('./data/team-names');

/* ---------- 赛事名词典 ---------- */
const COMP_DICT = {
  'bundesliga': '德甲', '1. bundesliga': '德甲', 'bundesliga qualification': '德甲附加赛',
  '2. bundesliga': '德乙', '2. bundesliga qualification': '德乙附加赛', '3. liga': '德丙', 'regionalliga': '德地区联赛',
  'dfb pokal': '德国杯',
  'premier league': '英超', 'premier league qualification': '英超附加赛',
  'efl championship': '英冠', 'championship': '英冠', 'efl league one': '英甲', 'efl league two': '英乙',
  'fa cup': '足总杯', 'efl cup': '联赛杯', 'carabao cup': '联赛杯',
  'la liga': '西甲', 'la liga qualification': '西甲附加赛', 'la liga 2': '西乙', 'segunda division': '西乙',
  'copa del rey': '国王杯', 'supercopa de espana': '西班牙超级杯',
  'serie a': '意甲', 'serie a qualification': '意甲附加赛', 'serie b': '意乙', 'coppa italia': '意大利杯', 'supercoppa': '意大利超级杯',
  'ligue 1': '法甲', 'ligue 1 qualification': '法甲附加赛', 'ligue 2': '法乙', 'coupe de france': '法国杯',
  'champions league': '欧冠', 'uefa champions league': '欧冠', 'champions league qualification': '欧冠资格赛',
  'europa league': '欧联杯', 'uefa europa league': '欧联杯', 'europa league qualification': '欧联资格赛',
  'conference league': '欧协联', 'europa conference league': '欧协联',
  'eredivisie': '荷甲', 'primeira liga': '葡超', 'super lig': '土超', 'superlig': '土超',
  'saudi pro league': '沙特联', 'mls': '美职联', 'a-league': '澳超', 'j1 league': '日职联', 'k league 1': '韩职联',
  'copa libertadores': '南美解放者杯', 'copa sudamericana': '南美杯',
  'world cup': '世界杯', 'fifa club world cup': '世俱杯',
  'european championship': '欧洲杯', 'european championship qualification': '欧洲杯预选赛', 'copa america': '美洲杯',
  'club friendly': '友谊赛', 'club friendlies': '友谊赛', 'international': '国际赛', 'play-offs': '附加赛',
};

/* ---------- 词典 ---------- */
const DICT = {
  /* 天气 */
  'sunny': '晴', 'clear': '晴', 'clear sky': '晴', 'fair': '晴', 'partly sunny': '晴间多云',
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

/* ---------- 球员名词典（常见球星，MyMemory 对纯人名不翻译，故内置） ---------- */
const PLAYER_DICT = {
  'manuel neuer': '曼努埃尔·诺伊尔', 'harry kane': '哈里·凯恩', 'kane': '凯恩',
  'jamal musiala': '贾马尔·穆西亚拉', 'musiala': '穆西亚拉',
  'joshua kimmich': '约书亚·基米希', 'kimmich': '基米希',
  'leroy sane': '勒鲁瓦·萨内', 'thomas muller': '托马斯·穆勒', 'muller': '穆勒',
  'kinglsey coman': '金斯利·科曼', 'kingsley coman': '金斯利·科曼',
  'serge gnabry': '塞尔吉·格纳布里', 'leon goretzka': '莱昂·格雷茨卡',
  'alphonso davies': '阿方索·戴维斯', 'dayot upamecano': '达约·于帕梅卡诺',
  'min-jae kim': '金玟哉', 'kim min-jae': '金玟哉',
  'konrad laimer': '康拉德·莱默', 'raphael guerreiロ': '拉斐尔·格雷罗',
  'josip stanisic': '约西普·斯坦尼西奇', 'sven ulreich': '斯文·乌尔赖希',
  'daniel peretz': '丹尼尔·佩雷茨', 'eric dier': '埃里克·戴尔',
  'mohamed salah': '穆罕默德·萨拉赫', 'salah': '萨拉赫',
  'virgil van dijk': '维吉尔·范戴克', 'van dijk': '范戴克',
  'alisson becker': '阿利松', 'alisson': '阿利松',
  'trent alexander-arnold': '特伦特·阿诺德', 'andrew robertson': '安德鲁·罗伯逊',
  'darwin nunez': '达尔文·努涅斯', 'luis diaz': '路易斯·迪亚斯',
  'dominic szoboszlai': '多米尼克·索博斯洛伊', 'alexis mac allister': '亚历克西斯·麦卡利斯特',
  'ryan gravenberch': '瑞安·赫拉芬贝赫', 'cody gakpo': '科迪·加克波',
  'kevin de bruyne': '凯文·德布劳内', 'de bruyne': '德布劳内',
  'erling haaland': '埃尔林·哈兰德', 'haaland': '哈兰德',
  'phil foden': '菲尔·福登', 'foden': '福登',
  'rodri': '罗德里', 'bernardo silva': '贝尔纳多·席尔瓦', 'jack grealish': '杰克·格雷利什',
  'john stones': '约翰·斯通斯', 'kyle walker': '凯尔·沃克', 'ederson': '埃德森',
  'ruben dias': '鲁本·迪亚斯', 'julian alvarez': '胡利安·阿尔瓦雷斯',
  'bukayo saka': '布卡约·萨卡', 'saka': '萨卡',
  'declan rice': '德克兰·赖斯', 'rice': '赖斯',
  'martin odegaard': '马丁·厄德高', 'odegaard': '厄德高',
  'gabriel jesus': '加布里埃尔·热苏斯', 'gabriel martinelli': '加布里埃尔·马丁内利',
  'william saliba': '威廉·萨利巴', 'saliba': '萨利巴',
  'kai havertz': '凯·哈弗茨', 'havertz': '哈弗茨',
  'leandro trossard': '莱安德罗·特罗萨德', 'david raya': '大卫·拉亚',
  'son heung-min': '孙兴慜', 'son': '孙兴慜', 'heung-min son': '孙兴慜',
  'james maddison': '詹姆斯·麦迪逊', 'richarlison': '理查利森',
  'cristian romero': '克里斯蒂安·罗梅罗', 'micky van de ven': '米奇·范德文',
  'dejan kulusevski': '德扬·库卢塞夫斯基', 'pedro porro': '佩德罗·波罗',
  'guglielmo vicario': '古列尔莫·维卡里奥', 'destiny udogie': '德斯蒂尼·乌多吉',
  'bruno fernandes': '布鲁诺·费尔南德斯', 'casemiro': '卡塞米罗',
  'marcus rashford': '马库斯·拉什福德', 'rashford': '拉什福德',
  'alejandro garnacho': '亚历杭德罗·加纳乔', 'andre onana': '安德烈·奥纳纳',
  'lisandro martinez': '利桑德罗·马丁内斯', 'lisandro martínez': '利桑德罗·马丁内斯',
  'rasmus hojlund': '拉斯穆斯·霍伊伦', 'kobbie mainoo': '科比·梅努',
  'luke shaw': '卢克·肖', 'diogo dalot': '迪奥戈·达洛特',
  'noni madueke': '诺尼·马杜埃凯', 'cole palmer': '科尔·帕尔默', 'palmer': '帕尔默',
  'enzo fernandez': '恩佐·费尔南德斯', 'moises caicedo': '莫伊塞斯·凯塞多',
  'christopher nkunku': '克里斯托弗·恩昆库', 'nkunku': '恩昆库',
  'marc cucurella': '马克·库库雷利亚', 'malo gusto': '马洛·古斯托',
  'reece james': '里斯·詹姆斯', 'raheem sterling': '拉希姆·斯特林',
  'mykhailo mudryk': '米哈伊洛·穆德里克', 'levi colwill': '利维·科尔威尔',
  'nicolas jackson': '尼古拉斯·杰克逊', 'jordan pickford': '乔丹·皮克福德',
  'kylian mbappe': '基利安·姆巴佩', 'mbappe': '姆巴佩',
  'osmane dembele': '奥斯曼·登贝莱', 'ousmane dembele': '奥斯曼·登贝莱',
  'achraf hakimi': '阿什拉夫·哈基米', 'achraf hakimi': '阿什拉夫·哈基米',
  'gianluigi donnarumma': '吉安路易吉·多纳鲁马', 'donnarumma': '多纳鲁马',
  'vitinha': '维蒂尼亚', 'warren zaire-emery': '沃伦·扎伊尔-埃梅里',
  'bradley barcola': '布拉德利·巴尔科拉', 'neymar': '内马尔',
  'judd beilingham': '裘德·贝林厄姆', 'jude bellingham': '裘德·贝林厄姆', 'bellingham': '贝林厄姆',
  'vinicius junior': '维尼修斯·儒尼奥尔', 'vinícius júnior': '维尼修斯·儒尼奥尔', 'vinicius': '维尼修斯',
  'rodrygo': '罗德里戈', 'federico valverde': '费德里科·巴尔韦德', 'valverde': '巴尔韦德',
  'thibaut courtois': '蒂博·库尔图瓦', 'courtois': '库尔图瓦',
  'ante modric': '卢卡·莫德里奇', 'luka modric': '卢卡·莫德里奇', 'modric': '莫德里奇',
  'tont kroos': '托尼·克罗斯', 'toni kroos': '托尼·克罗斯', 'kroos': '克罗斯',
  'robert lewandowski': '罗伯特·莱万多夫斯基', 'lewandowski': '莱万多夫斯基',
  'marc ter stegen': '马克-安德烈·特尔施特根', 'ter stegen': '特尔施特根',
  'pedri': '佩德里', 'gavi': '加维', 'fersi de jong': '弗兰基·德容', 'frenkie de jong': '弗兰基·德容',
  'joao felix': '若昂·费利克斯', 'antune griezmann': '安托万·格列兹曼', 'antoine griezmann': '安托万·格列兹曼',
  'julian lvarez': '胡利安·阿尔瓦雷斯', 'julian alvarez': '胡利安·阿尔瓦雷斯',
  'jude bellingham': '裘德·贝林厄姆', 'lautaro martinez': '劳塔罗·马丁内斯',
  'lautaro martínez': '劳塔罗·马丁内斯', 'nicola barella': '尼科洛·巴雷拉', 'barella': '巴雷拉',
  'theo hernandez': '特奥·埃尔南德斯', 'rafael leao': '拉斐尔·莱奥', 'leao': '莱奥',
  'mike maignan': '迈克·迈尼昂', 'olivier giroud': '奥利维尔·吉鲁', 'giroud': '吉鲁',
  'paulo dybala': '保罗·迪巴拉', 'dybala': '迪巴拉', 'romelu lukaku': '罗梅卢·卢卡库',
  'victor osimhen': '维克托·奥斯梅恩', 'osimhen': '奥斯梅恩',
  'khvicha kvaratskhelia': '赫维查·克瓦拉茨赫利亚', 'kvara': '克瓦拉茨赫利亚',
  'federico chiesa': '费德里科·基耶萨', 'duan vlahovic': '杜尚·弗拉霍维奇', 'dusan vlahovic': '杜尚·弗拉霍维奇',
  'sergej milinkovic-savic': '谢尔盖·米林科维奇-萨维奇', 'denzel dumfries': '登泽尔·邓弗里斯',
  'marcus thuram': '马库斯·图拉姆', 'hakan calhanoglu': '哈坎·恰尔汗奥卢',
  'yann sommer': '扬·索默', 'benjamin pavard': '本杰明·帕瓦尔',
  'alessandro bastoni': '亚历山德罗·巴斯托尼', 'francesco acerbi': '弗朗切斯科·阿切尔比',
  'cengiz under': '岑吉兹·云代尔', 'florian wirtz': '弗洛里安·维尔茨', 'wirtz': '维尔茨',
  'victor boniface': '维克托·博尼法斯', 'granit xhaka': '格拉尼特·扎卡',
  'deniz undav': '德尼兹·温达夫', 'niclas fullkrug': '尼克拉斯·菲尔克鲁格', 'fullkrug': '菲尔克鲁格',
  'serhou guirassy': '塞尔霍·吉拉西', 'guirassy': '吉拉西',
  'sebastian haller': '塞巴斯蒂安·阿莱', 'emre can': '埃姆雷·詹',
  'mats hummels': '马茨·胡梅尔斯', 'hummels': '胡梅尔斯',
  'gregor kobel': '格雷戈尔·科贝尔', 'nico schlotterbeck': '尼科·施洛特贝克',
  'ramy bensebaini': '拉米·本塞拜尼', 'marcel sabitzer': '马塞尔·萨比策',
  'julian brandt': '尤利安·布兰特', 'brandt': '布兰特',
  'karim adeyemi': '卡里姆·阿德耶米', 'adeyemi': '阿德耶米',
  'donyell malen': '多尼耶尔·马伦', 'jamie bynoe-gittens': '杰米·拜诺-吉滕斯',
  'julian ryerson': '尤利安·里尔森', 'waldemar anton': '瓦尔德马·安东',
  'kevin trapp': '凯文·特拉普', 'robin koch': '罗宾·科赫',
  'omar marmoush': '奥马尔·马尔穆什', 'marmoush': '马尔穆什',
  'ansgar knauff': '安斯加·克瑙夫', 'palmisano': '帕尔米萨诺',
  'jens stage': '延斯·斯塔格', 'romario baro': '罗马里奥·巴罗',
  'willian pacho': '威廉·帕乔', 'daniel munoz': '丹尼尔·穆尼奥斯',
  'jan fite': '扬·菲特', 'mats knauff': '马茨·克瑙夫',
  /* 补充常见球员 */
  'jonathan tah': '乔纳森·塔', 'tah': '塔',
  'marvin schwabe': '马文·施瓦贝', 'joel schmied': '约埃尔·施密德',
  'jahmai simpson-pusey': '贾迈·辛普森-普西', 'tim lemperle': '蒂姆·伦佩尔',
  'florian kainz': '弗洛里安·凯恩茨', 'kainz': '凯恩茨',
  'luca waldschmidt': '卢卡·瓦尔德施密特', 'waldschmidt': '瓦尔德施密特',
  'jan thielmann': '扬·蒂尔曼', 'justin diehl': '贾斯汀·迪尔',
  'dominique heintz': '多米尼克·海因茨', 'luca kilian': '卢卡·基利安',
  'damion downs': '达米翁·唐斯', 'denis huseinbasic': '德尼·侯赛因巴希奇',
  'mark ueth': '马克·乌特', 'max finkgrafe': '马克斯·芬克格拉夫',
  'sergio gomez': '塞尔希奥·戈麦斯', 'emre demir': '埃姆雷·德米尔',
  'sabastien hallseth': '塞巴斯蒂安·哈尔塞斯',
  'iliax moriba': '伊莱克斯·莫里巴', 'ilias moriba': '伊莱克斯·莫里巴',
  'kinglsey: coman': '金斯利·科曼', 'lars stindl': '拉尔斯·施廷德尔',
  'xavi simons': '哈维·西蒙斯', 'xavi simons': '哈维·西蒙斯',
  'raphael guerreiro': '拉斐尔·格雷罗', 'guerreiro': '格雷罗',
  'sven ulreich': '斯文·乌尔赖希', 'daniel peretz': '丹尼尔·佩雷茨',
  'joshua zirkzee': '约书亚·齐尔克泽', 'zirkzee': '齐尔克泽',
  'matthijs de ligt': '马泰斯·德利赫特', 'de ligt': '德利赫特',
  'noussair mazraoui': '努赛尔·马兹拉维', 'mazraoui': '马兹拉维',
  'ryan gravenberch': '瑞安·赫拉芬贝赫', 'franck kessie': '弗兰克·凯西',
  'marcos llorente': '马科斯·略伦特', 'llorente': '略伦特',
  'sergi roberto': '塞尔吉·罗贝托', 'ferran torres': '费兰·托雷斯',
  'ansu fati': '安苏·法蒂', 'fati': '法蒂',
  'rinaldo antonio': '里纳尔多·安东尼奥', 'diego llorente': '迭戈·略伦特',
  'rodrigo de paul': '罗德里戈·德保罗', 'de paul': '德保罗',
  'nehuen perez': '内乌恩·佩雷斯', 'sergio busquets': '塞尔吉奥·布斯克茨',
  'jordi alba': '若尔迪·阿尔巴', 'marcos alonso': '马科斯·阿隆索',
  'caleb okoli': '凯莱布·奥科利', 'samuel gigot': '萨穆埃尔·吉戈',
  'nuno tavares': '努诺·塔瓦雷斯', 'marius marin': '马里乌斯·马林',
  'alexis sanchez': '阿莱克西斯·桑切斯', 'arturo vidal': '阿图罗·比达尔',
  'ivan perisic': '伊万·佩里西奇', 'perisic': '佩里西奇',
  'marcelo brozovic': '马塞洛·布罗佐维奇', 'brozovic': '布罗佐维奇',
  'luka jovic': '卢卡·约维奇', 'jovic': '约维奇',
  'david alaba': '大卫·阿拉巴', 'alaba': '阿拉巴',
  'xherdan shaqiri': '谢尔丹·沙奇里', 'shaqiri': '沙奇里',
  'granit xhaka': '格拉尼特·扎卡', 'xhaka': '扎卡',
  'ricardo rodriguez': '里卡多·罗德里格斯',
  'breel embolo': '布雷尔·恩博洛', 'embolo': '恩博洛',
  'noah okaforte': '诺亚·奥卡福', 'noah okaford': '诺亚·奥卡福',
  'pierrer kalulu': '皮埃尔·卡卢卢', 'pierre kalulu': '皮埃尔·卡卢卢',
  'bennjamin sessko': '本杰明·塞什科', 'benjamin sesko': '本杰明·塞什科',
  'xavi simons': '哈维·西蒙斯', 'lois openda': '洛伊斯·奥彭达',
  'david raum': '大卫·劳姆', 'raum': '劳姆',
  'christoph baumgartner': '克里斯托夫·鲍姆加特纳', 'baumgartner': '鲍姆加特纳',
  'kevin kampl': '凯文·坎普尔', 'konrad laimer': '康拉德·莱默',
  /* 审计补充：各队核心球员 */
  'mark flekken': '马克·弗莱肯', 'robert andrich': '罗伯特·安德里希',
  'jarell quansah': '贾雷尔·宽萨', 'pierce hincapie': '皮尔斯·欣卡皮',
  'matthias ginter': '马蒂亚斯·金特尔', 'ginter': '金特尔',
  'nico elvedi': '尼科·埃尔维迪', 'elvedi': '埃尔维迪',
  'moritz nicolas': '莫里茨·尼古拉斯', 'philipp sander': '菲利普·桑德',
  'niclas elvedi': '尼克拉斯·埃尔维迪',
  'michael zetterer': '米夏埃尔·策特勒', 'rasmus kristensen': '拉斯穆斯·克里斯滕森',
  'aurele amenda': '奥雷勒·阿门达', 'aurèle amenda': '奥雷勒·阿门达',
  'marco bizot': '马尔科·比佐', 'matty cash': '马蒂·卡什',
  'ezri konsa': '埃兹里·孔萨', 'konsa': '孔萨',
  'bart verbruggen': '巴特·维尔布鲁根', 'verbuggen': '维尔布鲁根',
  'mats wieffer': '马茨·维弗', 'jan paul van hecke': '扬·保罗·范赫克',
  'robin roefs': '罗宾·鲁夫斯', 'trai hume': '特赖·休姆', 'daniel ballard': '丹尼尔·巴拉德',
  'noah atubolu': '诺亚·阿图博卢', 'philipp treu': '菲利普·特罗伊',
  'nikola vasilj': '尼古拉·瓦西利', 'tomoya ando': '安藤智也', 'hauke wahl': '豪克·瓦尔',
  'carl klaus': '卡尔·克劳斯', 'christopher trimmel': '克里斯托弗·特里梅尔',
  'danilho doekhi': '达尼略·多基', 'doekhi': '多基',
  'mio backhaus': '米奥·巴克豪斯', 'isaac schmidt': '伊萨克·施密特', 'amos pieper': '阿莫斯·皮珀',
  'nicola leali': '尼古拉·莱亚利',
  'stefano turati': '斯特凡诺·图拉蒂', 'sebastian walukiewicz': '塞巴斯蒂安·瓦卢凯维奇',
  'filippo romagna': '菲利波·罗马尼亚',
  'fikayo tomori': '菲卡约·托莫里', 'tomori': '托莫里',
  'matteo gabbia': '马泰奥·加比亚', 'gabbia': '加比亚',
  'strahinja pavlovic': '斯特拉希尼亚·帕夫洛维奇', 'pavlovic': '帕夫洛维奇',
  'lukas hradecky': '卢卡斯·赫拉德茨基', 'hradecky': '赫拉德茨基',
  'jordan teze': '乔丹·泰泽', 'christian mawissa': '克里斯蒂安·马维萨',
  'yehvann diouf': '耶万·迪乌夫', 'antoine mendy': '安托万·门迪', 'juma bah': '朱马·巴',
  'robin risser': '罗宾·里瑟', 'samson baidoo': '萨姆森·拜杜', 'malang sarr': '马朗·萨尔',
  'marnon-thomas busch': '马农-托马斯·布施', 'patrick mainka': '帕特里克·迈因卡',
  'frank feller': '弗兰克·费勒',
  'peter gulacsi': '彼得·古拉西奇', 'gulacsi': '古拉西奇', 'péter gulácsi': '彼得·古拉西奇',
  'tom bischof': '汤姆·比绍夫', 'lennart karl': '伦纳特·卡尔',
  'cenk ozkacar': '岑克·厄兹卡恰尔', 'cenk özkacar': '岑克·厄兹卡恰尔',
  'sebastian sebulonsen': '塞巴斯蒂安·塞布隆森',
  'felix nmecha': '费利克斯·恩梅查', 'nmecha': '恩梅查',
  'aleksandar pavlovic': '亚历山大·帕夫洛维奇',
  'josip stanišić': '约西普·斯坦尼西奇',
  'sacha boey': '萨沙·博伊', 'boey': '博伊',
  'nestory irankunda': '内斯托里·伊兰昆达',
  'gabriel vidovic': '加布里埃尔·维多维奇',
  'michael olise': '迈克尔·奥利斯', 'olise': '奥利斯',
  'harry kane': '哈里·凯恩',
  'patrik schick': '帕特里克·希克', 'schick': '希克',
  'jeremie frimpong': '杰雷米·弗林蓬', 'frimpong': '弗林蓬',
  'edmond tapsoba': '埃德蒙·塔普索巴', 'tapsoba': '塔普索巴',
  'jonathan tah': '乔纳森·塔',
  'alejandro grimaldo': '亚历杭德罗·格里马尔多', 'grimaldo': '格里马尔多',
  'amadou haidara': '阿马杜·海达拉',
  'xaver schlager': '哈维尔·施拉格', 'schlager': '施拉格',
  'christoph baumgartner': '克里斯托夫·鲍姆加特纳',
  'antonio nusa': '安东尼奥·努萨', 'nusa': '努萨',
  'benjamin sesko': '本杰明·塞什科',
  'lois openda': '洛伊斯·奥彭达',
  'dani olmo': '达尼·奥尔莫', 'olmo': '奥尔莫',
  'janick makota': '雅尼克·马科塔',
  'niclas fullkrug': '尼克拉斯·菲尔克鲁格',
  'serhou guirassy': '塞尔霍·吉拉西',
  'emre can': '埃姆雷·詹',
  'karim adeyemi': '卡里姆·阿德耶米',
  'felix passerlack': '费利克斯·帕斯拉克',
  'sami khedira': '萨米·赫迪拉',
  'mario gotze': '马里奥·格策', 'gotze': '格策',
  'marc-andre ter stegen': '马克-安德烈·特尔施特根',
  'ronald aaraujo': '罗纳德·阿劳霍', 'ronald araujo': '罗纳德·阿劳霍', 'araujo': '阿劳霍',
  'jules kounde': '朱尔·孔德', 'kounde': '孔德',
  'fermin lopez': '费尔明·洛佩斯', 'fermin lópez': '费尔明·洛佩斯',
  'pau cubarsi': '保罗·库巴西', 'cubarsi': '库巴西',
  'alejandro balde': '亚历杭德罗·巴尔德', 'balde': '巴尔德',
  'andreas christensen': '安德烈亚斯·克里斯滕森',
  'frank kessie': '弗兰克·凯西',
  'raheem sterling': '拉希姆·斯特林',
  "n'golo kante": '恩戈洛·坎特', 'kante': '坎特',
  'christopher nkunku': '克里斯托弗·恩昆库',
  'wang qi': '王琦', 'wu lei': '武磊',
  'federico valverde': '费德里科·巴尔韦德',
  'vinicius jr': '维尼修斯',
  'rodrygo goes': '罗德里戈', 'rodrygo': '罗德里戈',
  'ederson moraes': '埃德森',
  'manuel akanji': '曼努埃尔·阿坎吉', 'akanji': '阿坎吉',
  'nathan ake': '内森·阿克', 'ake': '阿克',
  'oscar bobb': '奥斯卡·博布',
  'mateo kovacic': '马特奥·科瓦契奇', 'kovacic': '科瓦契奇',
  'savinho': '萨维尼奥',
  'james mccatee': '詹姆斯·麦卡蒂', 'james mcatee': '詹姆斯·麦卡蒂',
  'nico gonzalez': '尼科·冈萨雷斯', 'nico gonzález': '尼科·冈萨雷斯',
  'omar marmoush': '奥马尔·马尔穆什',
  'ilan meslier': '伊兰·梅利耶', 'meslier': '梅利耶',
  'joe rodon': '乔·罗登', 'rodon': '罗登',
  'illia zabarnyi': '伊利亚·扎巴尔尼', 'zabarnyi': '扎巴尔尼',
  'antawn robinson': '安托尼·罗宾逊',
  'justin kluivert': '贾斯汀·克鲁伊维特', 'kluivert': '克鲁伊维特',
  'dango ouattara': '丹戈·瓦塔拉', 'ouattara': '瓦塔拉',
  'antonin barak': '安东宁·巴拉克', 'barak': '巴拉克',
  'semen adingra': '塞门·阿丁格拉',
  'joao pedro': '若昂·佩德罗',
  'evan ferguson': '埃文·弗格森',
  'yankuba minteh': '扬库巴·明特',
  'matthew ryan': '马修·瑞安',
  'fabricio bruno': '法布里西奥·布鲁诺',
  'miguel almiron': '米格尔·阿尔米隆', 'almiron': '阿尔米隆',
  'joe willock': '乔·威洛克',
  'anthony gordon': '安东尼·戈登', 'gordon': '戈登',
  'alexander isak': '亚历山大·伊萨克', 'isak': '伊萨克',
  'sven botman': '斯文·博特曼', 'botman': '博特曼',
  'kevin trapp': '凯文·特拉普',
  'henrik gundersen': '亨里克·贡德森',
  'david henrik': '大卫·亨里克',
  'shinji kagawa': '香川真司',
  'yoichiro kakitani': '柿谷曜一朗',
};

/* ---------- 球队名 / 赛事名 / 交锋 / 近六场 汉化 ---------- */

const compNorm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
const COMP_NORM = {};
for (const k of Object.keys(COMP_DICT)) COMP_NORM[compNorm(k)] = COMP_DICT[k];
function zhCompetition(comp) {
  const s = String(comp || '');
  if (!s || hasCJK(s)) return s;
  return COMP_NORM[compNorm(s)] || s;
}

/* 队名词典翻译（覆盖 football-data 全名 + Fotmob 短名） */
function zhTeamName(name) {
  const s = String(name || '').trim();
  if (!s || hasCJK(s)) return s;
  return teamNames.zhTeamName(s, s) || s;
}

/* 历史交锋汉化（队名 + 赛事名） */
function zhH2h(h2h) {
  if (!h2h || !Array.isArray(h2h.matches)) return h2h;
  return {
    ...h2h,
    matches: h2h.matches.map((m) => ({
      ...m,
      home: zhTeamName(m.home),
      away: zhTeamName(m.away),
      competition: zhCompetition(m.competition),
    })),
  };
}

/* 近六场汉化（对手队名 + 赛事名） */
function zhRecent(list) {
  if (!Array.isArray(list)) return list;
  return list.map((r) => ({ ...r, opponent: zhTeamName(r.opponent), comp: zhCompetition(r.comp) }));
}

/* 首发阵容球员名翻译（词典优先 + MyMemory 兜底 + 缓存 + 限额；失败保留原文） */
const playerNorm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
const PLAYER_NORM = {};
for (const k of Object.keys(PLAYER_DICT)) PLAYER_NORM[playerNorm(k)] = PLAYER_DICT[k];

function zhPlayerName(name) {
  const s = String(name || '').trim();
  if (!s || hasCJK(s)) return s;
  return PLAYER_NORM[playerNorm(s)] || s;
}

async function translatePlayerNames(lineup) {
  if (!Array.isArray(lineup)) return lineup;
  const rows = lineup.map(([name, num, p]) => ({ name, num, p }));
  // 词典优先，其余并行走在线翻译
  const pending = rows.filter((r) => zhPlayerName(r.name) === r.name);
  const results = await Promise.all(pending.map((r) => onlineZh(r.name)));
  const map = new Map();
  pending.forEach((r, i) => map.set(r.name, results[i]));
  return rows.map((r) => [zhPlayerName(r.name) === r.name ? (map.get(r.name) || r.name) : zhPlayerName(r.name), r.num, r.p]);
}

module.exports = { zhDict, onlineZh, translateNews, zhWeather, zhLineup, zhCompetition, zhTeamName, zhH2h, zhRecent, translatePlayerNames, quotaUsage: () => usageToday().chars };
