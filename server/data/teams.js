/*
 * 球队数据：档案信息、首发阵容、近六场比赛、舆论报道
 * 演示数据基于真实球队信息构建，可替换为真实 API 数据源（见 README）
 */

const pos = {
  GK: (x, y) => ({ pos: 'GK', x, y }),
  RB: (x, y) => ({ pos: 'RB', x, y }),
  CB: (x, y) => ({ pos: 'CB', x, y }),
  LB: (x, y) => ({ pos: 'LB', x, y }),
  RWB: (x, y) => ({ pos: 'RWB', x, y }),
  LWB: (x, y) => ({ pos: 'LWB', x, y }),
  CM: (x, y) => ({ pos: 'CM', x, y }),
  DM: (x, y) => ({ pos: 'DM', x, y }),
  AM: (x, y) => ({ pos: 'AM', x, y }),
  RM: (x, y) => ({ pos: 'RM', x, y }),
  LM: (x, y) => ({ pos: 'LM', x, y }),
  RW: (x, y) => ({ pos: 'RW', x, y }),
  LW: (x, y) => ({ pos: 'LW', x, y }),
  ST: (x, y) => ({ pos: 'ST', x, y }),
};

const TEAMS = [
  {
    id: 'ars', name: '阿森纳', en: 'Arsenal', short: 'ARS', color: '#EF0107', color2: '#063672',
    league: '英超', coach: '米克尔·阿尔特塔', stadium: '酋长球场', city: '伦敦',
    formation: '4-3-3', form: 'WWDLWW',
    lineup: [
      ['拉亚', 22, pos.GK(50, 7)], ['本·怀特', 4, pos.RB(12, 24)], ['萨利巴', 2, pos.CB(38, 22)],
      ['加布里埃尔', 6, pos.CB(62, 22)], ['廷贝尔', 12, pos.LB(88, 24)], ['赖斯', 41, pos.DM(50, 38)],
      ['厄德高', 8, pos.CM(36, 50)], ['哈弗茨', 29, pos.CM(64, 50)], ['萨卡', 7, pos.RW(82, 68)],
      ['热苏斯', 9, pos.ST(50, 66)], ['马丁内利', 11, pos.LW(18, 68)],
    ],
    recent: [
      { date: '08-07', opponent: '曼城', home: true, gf: 2, ga: 1, xg: 1.9, xga: 0.8, result: 'W', comp: '社区盾' },
      { date: '08-02', opponent: '曼联', home: false, gf: 3, ga: 1, xg: 2.4, xga: 0.6, result: 'W', comp: '热身赛' },
      { date: '07-27', opponent: '利物浦', home: false, gf: 1, ga: 1, xg: 1.3, xga: 1.1, result: 'D', comp: '热身赛' },
      { date: '07-21', opponent: '巴萨', home: true, gf: 0, ga: 2, xg: 0.4, xga: 1.6, result: 'L', comp: '热身赛' },
      { date: '07-14', opponent: '切尔西', home: true, gf: 2, ga: 0, xg: 2.1, xga: 0.7, result: 'W', comp: '热身赛' },
      { date: '05-25', opponent: '布莱顿', home: false, gf: 2, ga: 0, xg: 2.0, xga: 0.5, result: 'W', comp: '英超' },
    ],
    news: [
      { title: '阿尔特塔确认队长厄德高膝伤无碍，将出战新赛季揭幕战', source: '天空体育', time: '2小时前', sentiment: 'positive', summary: '厄德高在季前赛末段感到不适，但队医检查后排除了严重伤病，挪威中场将正常出战首轮联赛。' },
      { title: '枪手锋无力隐忧：热苏斯近5场热身赛仅入1球', source: '卫报', time: '5小时前', sentiment: 'negative', summary: '巴西前锋在季前赛中的状态令人担忧，阿森纳高层已重新评估冬窗引进中锋的必要性。' },
      { title: '新援卡拉菲奥里融入迅速，训练中获队友一致好评', source: '伦敦标准晚报', time: '1天前', sentiment: 'positive', summary: '意大利后卫与萨利巴、加布里埃尔组成的三中卫轮换体系初见成效，防守端对抗成功率出色。' },
      { title: '英媒：阿森纳即将与萨卡完成续约，周薪将打破队史纪录', source: '每日邮报', time: '2天前', sentiment: 'positive', summary: '据接近俱乐部的消息人士透露，双方已就一份为期五年的新合同达成原则性协议。' },
      { title: '中场硬度存疑：赖斯缺阵期间，阿森纳控制力明显下滑', source: '泰晤士报', time: '3天前', sentiment: 'neutral', summary: '数据统计显示，缺少赖斯覆盖的阿森纳在攻防转换中被反击的次数提升了约40%。' },
    ],
  },
  {
    id: 'liv', name: '利物浦', en: 'Liverpool', short: 'LIV', color: '#C8102E', color2: '#F6EB61',
    league: '英超', coach: '阿尔内·斯洛特', stadium: '安菲尔德球场', city: '利物浦',
    formation: '4-3-3', form: 'WWWDWL',
    lineup: [
      ['阿利松', 1, pos.GK(50, 7)], ['阿诺德', 66, pos.RB(12, 24)], ['科纳特', 5, pos.CB(38, 22)],
      ['范戴克', 4, pos.CB(62, 22)], ['罗伯逊', 26, pos.LB(88, 24)], ['麦卡利斯特', 10, pos.DM(50, 38)],
      ['索博斯洛伊', 8, pos.CM(36, 50)], ['赫拉芬贝赫', 38, pos.CM(64, 50)], ['萨拉赫', 11, pos.RW(82, 68)],
      ['加克波', 18, pos.ST(50, 66)], ['路易斯·迪亚斯', 7, pos.LW(18, 68)],
    ],
    recent: [
      { date: '08-06', opponent: '塞维利亚', home: false, gf: 2, ga: 2, xg: 1.7, xga: 1.4, result: 'D', comp: '热身赛' },
      { date: '08-02', opponent: '曼联', home: true, gf: 3, ga: 0, xg: 2.8, xga: 0.3, result: 'W', comp: '热身赛' },
      { date: '07-27', opponent: '阿森纳', home: true, gf: 1, ga: 1, xg: 1.1, xga: 1.3, result: 'D', comp: '热身赛' },
      { date: '07-23', opponent: '皇家贝蒂斯', home: true, gf: 2, ga: 1, xg: 2.2, xga: 0.9, result: 'W', comp: '热身赛' },
      { date: '05-25', opponent: '狼队', home: false, gf: 0, ga: 1, xg: 0.8, xga: 1.2, result: 'L', comp: '英超' },
      { date: '05-19', opponent: '西汉姆联', home: true, gf: 3, ga: 0, xg: 2.5, xga: 0.4, result: 'W', comp: '英超' },
    ],
    news: [
      { title: '范戴克续约谈判重启，利物浦队长有望留队至2027年', source: 'BBC体育', time: '3小时前', sentiment: 'positive', summary: '荷兰中卫在训练场上状态极佳，俱乐部已向其团队递交新报价，双方均对未来持乐观态度。' },
      { title: '萨拉赫赛季前瞻：35岁"法老王"仍是红箭三侠最锋利一刃', source: '利物浦回声报', time: '7小时前', sentiment: 'positive', summary: '季前赛5场贡献4球2助攻，萨拉赫的射门转化率与上赛季同期持平，年龄似乎未在他身上留下痕迹。' },
      { title: '中场覆盖问题未解，斯洛特承认引援窗口仍可能补强', source: 'The Athletic', time: '1天前', sentiment: 'negative', summary: '赫拉芬贝赫在防守端的补位速度令教练组担忧，若无法签下理想目标，球队将依赖内部挖潜。' },
      { title: '门将争议再起：凯莱赫离队后，二门人选悬而未决', source: '镜报', time: '2天前', sentiment: 'negative', summary: '阿利松的替补问题长期存在，青训门将科里瓦尔·克勒赫虽获得提拔但缺乏一线队经验。' },
    ],
  },
  {
    id: 'mci', name: '曼城', en: 'Manchester City', short: 'MCI', color: '#6CABDD', color2: '#1C2C5B',
    league: '英超', coach: '佩普·瓜迪奥拉', stadium: '伊蒂哈德球场', city: '曼彻斯特',
    formation: '4-2-3-1', form: 'DWWWLW',
    lineup: [
      ['埃德森', 31, pos.GK(50, 7)], ['沃克', 2, pos.RB(12, 24)], ['阿坎吉', 25, pos.CB(38, 22)],
      ['迪亚斯', 3, pos.CB(62, 22)], ['格瓦迪奥尔', 24, pos.LB(88, 24)], ['罗德里', 16, pos.DM(40, 38)],
      ['科瓦契奇', 8, pos.DM(60, 38)], ['福登', 47, pos.AM(50, 55)], ['贝尔纳多·席尔瓦', 20, pos.RW(82, 66)],
      ['哈兰德', 9, pos.ST(50, 64)], ['格拉利什', 10, pos.LW(18, 66)],
    ],
    recent: [
      { date: '08-07', opponent: '阿森纳', home: false, gf: 1, ga: 2, xg: 0.8, xga: 1.9, result: 'L', comp: '社区盾' },
      { date: '08-03', opponent: '切尔西', home: false, gf: 3, ga: 2, xg: 2.0, xga: 1.3, result: 'W', comp: '热身赛' },
      { date: '07-30', opponent: 'AC米兰', home: true, gf: 2, ga: 2, xg: 1.9, xga: 1.5, result: 'D', comp: '热身赛' },
      { date: '07-26', opponent: '拜仁', home: false, gf: 2, ga: 1, xg: 1.6, xga: 1.0, result: 'W', comp: '热身赛' },
      { date: '07-20', opponent: '多特', home: true, gf: 2, ga: 2, xg: 2.2, xga: 1.7, result: 'D', comp: '热身赛' },
      { date: '05-25', opponent: '富勒姆', home: true, gf: 4, ga: 0, xg: 3.1, xga: 0.2, result: 'W', comp: '英超' },
    ],
    news: [
      { title: '罗德里当选上赛季英超最佳球员，瓜帅赞其"不可替代"', source: '英超官网', time: '4小时前', sentiment: 'positive', summary: '西班牙中场以93%的传球成功率与场均4.1次拦截的数据蝉联赛季MVP。' },
      { title: '哈兰德休赛期加练射术：新赛季目标打破英超单季进球纪录', source: '曼彻斯特晚报', time: '9小时前', sentiment: 'positive', summary: '挪威前锋在挪威特训营期间每日加练200次射门，重点打磨逆足能力。' },
      { title: '转会窗难题：曼城错失追逐多年的防守型中场目标', source: '天空体育', time: '1天前', sentiment: 'negative', summary: '在罗德里年龄增长背景下，俱乐部未能引进理想轮换者，球迷担忧中场深度。' },
      { title: '德布劳内训练恢复合练，复出时间或在9月中旬', source: '每日电讯报', time: '2天前', sentiment: 'neutral', summary: '比利时中场目前仅参与无对抗训练，教练组对其回归持谨慎态度。' },
    ],
  },
  {
    id: 'mun', name: '曼联', en: 'Manchester United', short: 'MUN', color: '#DA291C', color2: '#FBE122',
    league: '英超', coach: '埃里克·滕哈赫', stadium: '老特拉福德球场', city: '曼彻斯特',
    formation: '4-2-3-1', form: 'WLDWWL',
    lineup: [
      ['奥纳纳', 24, pos.GK(50, 7)], ['达洛特', 20, pos.RB(12, 24)], ['瓦拉内', 19, pos.CB(38, 22)],
      ['利桑德罗', 6, pos.CB(62, 22)], ['卢克·肖', 23, pos.LB(88, 24)], ['卡塞米罗', 18, pos.DM(40, 38)],
      ['梅努', 37, pos.DM(60, 38)], ['布鲁诺·费尔南德斯', 8, pos.AM(50, 55)], ['安东尼', 21, pos.RW(82, 66)],
      ['霍伊伦', 11, pos.ST(50, 64)], ['拉什福德', 10, pos.LW(18, 66)],
    ],
    recent: [
      { date: '08-05', opponent: '贝蒂斯', home: false, gf: 1, ga: 1, xg: 1.0, xga: 1.2, result: 'D', comp: '热身赛' },
      { date: '08-02', opponent: '利物浦', home: false, gf: 0, ga: 3, xg: 0.3, xga: 2.8, result: 'L', comp: '热身赛' },
      { date: '07-29', opponent: '阿森纳', home: true, gf: 1, ga: 3, xg: 0.6, xga: 2.4, result: 'L', comp: '热身赛' },
      { date: '07-25', opponent: '流浪者', home: false, gf: 2, ga: 0, xg: 2.3, xga: 0.4, result: 'W', comp: '热身赛' },
      { date: '05-25', opponent: '布莱顿', home: false, gf: 2, ga: 0, xg: 1.8, xga: 0.6, result: 'W', comp: '英超' },
      { date: '05-19', opponent: '水晶宫', home: false, gf: 0, ga: 1, xg: 0.7, xga: 1.5, result: 'L', comp: '英超' },
    ],
    news: [
      { title: '滕哈赫确认将继续掌舵新赛季，管理层明确"给时间出成绩"', source: '曼联官网', time: '1小时前', sentiment: 'positive', summary: '俱乐部高层在赛季前通气会上表达了对荷兰主帅的支持，转会预算将优先用于中场补强。' },
      { title: '拉什福德状态回升：季前赛5场3球，重拾边路爆破手感', source: '曼彻斯特晚报', time: '6小时前', sentiment: 'positive', summary: '英格兰边锋在左路的过人成功率回到上上赛季的水准，这或许是曼联进攻端最积极的信号。' },
      { title: '更衣室风波未平：多名球员对训练强度表达不满', source: '每日邮报', time: '1天前', sentiment: 'negative', summary: '报道称部分老将认为双倍强度的体能训练挤占了战术演练时间，球队内部出现分歧声音。' },
      { title: '曼联锋线引援进展缓慢，霍伊伦独木难支引发担忧', source: '卫报', time: '2天前', sentiment: 'negative', summary: '在多名前锋目标谈判受阻后，俱乐部可能被迫在关窗前提高报价。' },
    ],
  },
  {
    id: 'che', name: '切尔西', en: 'Chelsea', short: 'CHE', color: '#034694', color2: '#DBA111',
    league: '英超', coach: '恩佐·马雷斯卡', stadium: '斯坦福桥球场', city: '伦敦',
    formation: '4-3-3', form: 'WLWDWW',
    lineup: [
      ['罗伯特·桑切斯', 1, pos.GK(50, 7)], ['古斯托', 27, pos.RB(12, 24)], ['福法纳', 33, pos.CB(38, 22)],
      ['科尔威尔', 26, pos.CB(62, 22)], ['库库雷利亚', 3, pos.LB(88, 24)], ['凯塞多', 25, pos.DM(50, 38)],
      ['恩佐', 8, pos.CM(36, 50)], ['加拉格尔', 23, pos.CM(64, 50)], ['帕尔默', 20, pos.RW(82, 68)],
      ['杰克逊', 15, pos.ST(50, 66)], ['穆德里克', 10, pos.LW(18, 68)],
    ],
    recent: [
      { date: '08-03', opponent: '曼城', home: true, gf: 2, ga: 3, xg: 1.3, xga: 2.0, result: 'L', comp: '热身赛' },
      { date: '07-31', opponent: '阿梅利亚', home: true, gf: 4, ga: 0, xg: 3.2, xga: 0.1, result: 'W', comp: '热身赛' },
      { date: '07-24', opponent: '凯尔特人', home: false, gf: 3, ga: 1, xg: 2.6, xga: 0.8, result: 'W', comp: '热身赛' },
      { date: '07-18', opponent: '雷克瑟姆', home: false, gf: 2, ga: 0, xg: 2.9, xga: 0.2, result: 'W', comp: '热身赛' },
      { date: '05-25', opponent: '伯恩茅斯', home: true, gf: 1, ga: 1, xg: 1.5, xga: 1.1, result: 'D', comp: '英超' },
      { date: '05-19', opponent: '纽卡斯尔', home: false, gf: 2, ga: 1, xg: 1.4, xga: 1.2, result: 'W', comp: '英超' },
    ],
    news: [
      { title: '帕尔默当选队内季前赛最佳，马雷斯卡视其为进攻核心', source: '天空体育', time: '2小时前', sentiment: 'positive', summary: '英格兰中场在季前赛中贡献4球3助攻，新帅围绕其打造的自由人体系初见雏形。' },
      { title: '斯坦福桥续约僵局：加拉格尔合同仅剩一年', source: '卫报', time: '5小时前', sentiment: 'negative', summary: '若无法在关窗前完成续约，切尔西可能被迫出售这位青训队长，多家豪门已表达兴趣。' },
      { title: '新帅战术试验成功：三后卫与四后卫体系灵活切换', source: 'The Athletic', time: '1天前', sentiment: 'positive', summary: '马雷斯卡在热身赛中频繁演练阵型切换，球员对新战术的理解速度超出预期。' },
      { title: '门将竞争白热化：桑切斯与彼得罗维奇争夺首发位置', source: '每日快报', time: '2天前', sentiment: 'neutral', summary: '两人在热身赛中均获得出场机会，马雷斯卡表示将根据数据表现决定揭幕战首发。' },
    ],
  },
  {
    id: 'tot', name: '热刺', en: 'Tottenham Hotspur', short: 'TOT', color: '#132257', color2: '#FFFFFF',
    league: '英超', coach: '安格·波斯特科格鲁', stadium: '托特纳姆热刺球场', city: '伦敦',
    formation: '4-3-3', form: 'LDWLWW',
    lineup: [
      ['维卡里奥', 13, pos.GK(50, 7)], ['波罗', 23, pos.RB(12, 24)], ['罗梅罗', 17, pos.CB(38, 22)],
      ['范德文', 37, pos.CB(62, 22)], ['乌多吉', 38, pos.LB(88, 24)], ['比苏马', 38, pos.DM(50, 38)],
      ['本坦库尔', 30, pos.CM(36, 50)], ['麦迪逊', 10, pos.CM(64, 50)], ['库卢塞夫斯基', 21, pos.RW(82, 68)],
      ['孙兴慜', 7, pos.ST(50, 66)], ['维尔纳', 16, pos.LW(18, 68)],
    ],
    recent: [
      { date: '08-06', opponent: '拜仁', home: false, gf: 0, ga: 2, xg: 0.5, xga: 1.9, result: 'L', comp: '热身赛' },
      { date: '08-02', opponent: '大阪钢巴', home: false, gf: 3, ga: 0, xg: 3.4, xga: 0.1, result: 'W', comp: '热身赛' },
      { date: '07-28', opponent: '鹿岛鹿角', home: false, gf: 2, ga: 0, xg: 2.5, xga: 0.3, result: 'W', comp: '热身赛' },
      { date: '07-22', opponent: '女王公园巡游者', home: false, gf: 1, ga: 1, xg: 1.2, xga: 1.0, result: 'D', comp: '热身赛' },
      { date: '05-25', opponent: '狼队', home: true, gf: 1, ga: 2, xg: 1.1, xga: 1.4, result: 'L', comp: '英超' },
      { date: '05-19', opponent: '谢菲尔德联', home: true, gf: 3, ga: 0, xg: 2.7, xga: 0.2, result: 'W', comp: '英超' },
    ],
    news: [
      { title: '波斯特科格鲁坚持高位压迫哲学，季前赛控球率场均67%', source: '伦敦标准晚报', time: '3小时前', sentiment: 'positive', summary: '澳大利亚教头对球队执行力的提升感到满意，新赛季目标直指前四。' },
      { title: '孙兴慜续约在望：俱乐部明确其仍是建队基石', source: '韩联社', time: '8小时前', sentiment: 'positive', summary: '韩国队长在亚洲行期间人气爆棚，管理层承诺将在新赛季初完成续约谈判。' },
      { title: '防线警报：罗梅罗与范德文季前赛均出现轻伤', source: '每日邮报', time: '1天前', sentiment: 'negative', summary: '两名主力中卫在训练中提前离场，虽然检查结果无碍，但轮换深度仍显薄弱。' },
      { title: '列维拒绝高价出售麦迪逊，热刺中场核心地位稳固', source: '泰晤士报', time: '2天前', sentiment: 'neutral', summary: '面对沙特联赛的报价，热刺主席明确表示麦迪逊不在出售名单中。' },
    ],
  },
  {
    id: 'rma', name: '皇家马德里', en: 'Real Madrid', short: 'RMA', color: '#FEBE10', color2: '#00529F',
    league: '西甲', coach: '卡洛·安切洛蒂', stadium: '伯纳乌球场', city: '马德里',
    formation: '4-3-3', form: 'WWWLWW',
    lineup: [
      ['库尔图瓦', 1, pos.GK(50, 7)], ['卡瓦哈尔', 2, pos.RB(12, 24)], ['米利唐', 3, pos.CB(38, 22)],
      ['吕迪格', 22, pos.CB(62, 22)], ['门迪', 23, pos.LB(88, 24)], ['琼阿梅尼', 18, pos.DM(50, 38)],
      ['巴尔韦德', 15, pos.CM(36, 50)], ['贝林厄姆', 5, pos.CM(64, 50)], ['罗德里戈', 11, pos.RW(82, 68)],
      ['姆巴佩', 9, pos.ST(50, 66)], ['维尼修斯', 7, pos.LW(18, 68)],
    ],
    recent: [
      { date: '08-08', opponent: '切尔西', home: false, gf: 2, ga: 1, xg: 1.8, xga: 0.9, result: 'W', comp: '热身赛' },
      { date: '08-03', opponent: '巴萨', home: false, gf: 2, ga: 0, xg: 1.6, xga: 0.7, result: 'W', comp: '热身赛' },
      { date: '07-28', opponent: '曼联', home: false, gf: 1, ga: 0, xg: 1.2, xga: 0.4, result: 'W', comp: '热身赛' },
      { date: '07-22', opponent: 'AC米兰', home: false, gf: 1, ga: 2, xg: 1.0, xga: 1.7, result: 'L', comp: '热身赛' },
      { date: '05-25', opponent: '塞维利亚', home: true, gf: 4, ga: 1, xg: 3.3, xga: 0.6, result: 'W', comp: '西甲' },
      { date: '05-18', opponent: '皇家贝蒂斯', home: true, gf: 3, ga: 0, xg: 2.8, xga: 0.3, result: 'W', comp: '西甲' },
    ],
    news: [
      { title: '姆巴佩伯纳乌首秀破门，皇马新三叉戟合体首战告捷', source: '马卡报', time: '2小时前', sentiment: 'positive', summary: '法国前锋在处子秀中打入一记标志性的内切射门，与维尼修斯、罗德里戈的配合超出预期。' },
      { title: '安切洛蒂确认轮换计划：新赛季将管理好三叉戟出场时间', source: '阿斯报', time: '6小时前', sentiment: 'neutral', summary: '意大利名帅表示会在密集赛程中合理分配三名攻击手的体能，避免伤病风险。' },
      { title: '克罗斯退役后中场真空：皇马仍未签下理想组织核心', source: 'Relevo', time: '1天前', sentiment: 'negative', summary: '琼阿梅尼的向前传球能力备受质疑，皇马在转会市场的追求屡屡碰壁。' },
      { title: '库尔图瓦状态回勇，扑救成功率恢复至巅峰水准', source: '皇马官网', time: '2天前', sentiment: 'positive', summary: '比利时门将在热身赛中连续两场零封，十字韧带伤愈后的身体状态已完全恢复。' },
    ],
  },
  {
    id: 'bar', name: '巴塞罗那', en: 'Barcelona', short: 'BAR', color: '#A50044', color2: '#004D98',
    league: '西甲', coach: '汉斯·弗里克', stadium: '诺坎普球场', city: '巴塞罗那',
    formation: '4-3-3', form: 'LWWWDW',
    lineup: [
      ['特尔施特根', 1, pos.GK(50, 7)], ['孔德', 23, pos.RB(12, 24)], ['阿劳霍', 4, pos.CB(38, 22)],
      ['库巴西', 2, pos.CB(62, 22)], ['巴尔德', 3, pos.LB(88, 24)], ['德容', 21, pos.DM(50, 38)],
      ['佩德里', 8, pos.CM(36, 50)], ['加维', 6, pos.CM(64, 50)], ['亚马尔', 27, pos.RW(82, 68)],
      ['莱万多夫斯基', 9, pos.ST(50, 66)], ['拉菲尼亚', 11, pos.LW(18, 68)],
    ],
    recent: [
      { date: '08-07', opponent: 'AC米兰', home: false, gf: 0, ga: 1, xg: 0.6, xga: 1.1, result: 'L', comp: '热身赛' },
      { date: '08-03', opponent: '皇马', home: true, gf: 0, ga: 2, xg: 0.7, xga: 1.6, result: 'L', comp: '热身赛' },
      { date: '07-30', opponent: '曼城', home: false, gf: 2, ga: 1, xg: 1.5, xga: 1.0, result: 'W', comp: '热身赛' },
      { date: '07-24', opponent: '布莱顿', home: false, gf: 3, ga: 0, xg: 2.4, xga: 0.5, result: 'W', comp: '热身赛' },
      { date: '07-21', opponent: '阿森纳', home: false, gf: 2, ga: 0, xg: 1.6, xga: 0.4, result: 'W', comp: '热身赛' },
      { date: '05-25', opponent: '塞维利亚', home: true, gf: 2, ga: 2, xg: 2.1, xga: 1.3, result: 'D', comp: '西甲' },
    ],
    news: [
      { title: '亚马尔引爆美洲行：17岁天才成巴萨季前赛最大亮点', source: '世界体育报', time: '4小时前', sentiment: 'positive', summary: '西班牙边锋在美洲行4场贡献3球5助攻，过人成功率高达64%，已锁定首发席位。' },
      { title: '弗里克敲定新赛季首发框架，莱万仍为锋线第一选择', source: '每日体育报', time: '8小时前', sentiment: 'neutral', summary: '德国教头在训练中反复演练4-3-3高位逼抢体系，莱万与亚马尔的连线被视为进攻生命线。' },
      { title: '巴萨财政困局未解：注册新援仍依赖"杠杆"方案', source: '西班牙国家报', time: '1天前', sentiment: 'negative', summary: '尽管出售了部分股权获得资金，但多名新援的注册问题仍在与西甲联盟协商中。' },
      { title: '特尔施特根伤愈复出，德甲教头确认其为门将首选', source: '加泰罗尼亚电台', time: '2天前', sentiment: 'positive', summary: '德国门将上赛季末段因伤缺席，目前已在热身赛中连续首发并表现稳健。' },
    ],
  },
  {
    id: 'bay', name: '拜仁慕尼黑', en: 'Bayern Munich', short: 'BAY', color: '#DC052D', color2: '#0066B2',
    league: '德甲', coach: '文森特·孔帕尼', stadium: '安联球场', city: '慕尼黑',
    formation: '4-2-3-1', form: 'WWDWWW',
    lineup: [
      ['诺伊尔', 1, pos.GK(50, 7)], ['莱默', 22, pos.RB(12, 24)], ['于帕梅卡诺', 2, pos.CB(38, 22)],
      ['金玟哉', 3, pos.CB(62, 22)], ['戴维斯', 19, pos.LB(88, 24)], ['基米希', 6, pos.DM(40, 38)],
      ['帕夫洛维奇', 45, pos.DM(60, 38)], ['穆西亚拉', 42, pos.AM(50, 55)], ['萨内', 10, pos.RW(82, 66)],
      ['凯恩', 9, pos.ST(50, 64)], ['格纳布里', 7, pos.LW(18, 66)],
    ],
    recent: [
      { date: '08-06', opponent: '热刺', home: true, gf: 2, ga: 0, xg: 1.9, xga: 0.5, result: 'W', comp: '热身赛' },
      { date: '08-03', opponent: '阿森纳', home: true, gf: 2, ga: 1, xg: 2.1, xga: 1.2, result: 'W', comp: '热身赛' },
      { date: '07-30', opponent: '国米', home: false, gf: 3, ga: 1, xg: 2.3, xga: 0.8, result: 'W', comp: '热身赛' },
      { date: '07-26', opponent: '曼城', home: true, gf: 1, ga: 2, xg: 1.0, xga: 1.6, result: 'L', comp: '热身赛' },
      { date: '07-20', opponent: '菲尔特', home: true, gf: 3, ga: 0, xg: 3.8, xga: 0.1, result: 'W', comp: '友谊赛' },
      { date: '05-25', opponent: '霍芬海姆', home: true, gf: 3, ga: 0, xg: 2.9, xga: 0.3, result: 'W', comp: '德甲' },
    ],
    news: [
      { title: '凯恩季前赛5场轰入6球，金靴之怒直指拜仁首冠', source: '图片报', time: '2小时前', sentiment: 'positive', summary: '英格兰队长延续火热状态，连续第三年获得金靴后，唯一目标就是为拜仁打破冠军荒。' },
      { title: '孔帕尼高压体系见效：拜仁季前赛对手平均传球成功率骤降12%', source: '踢球者', time: '5小时前', sentiment: 'positive', summary: '比利时教头在训练中反复强调的第一时间反抢正在奏效，场均夺回球权次数大幅提升。' },
      { title: '德里赫特转会风波：更衣室对后卫离队传闻态度微妙', source: '体育图片报', time: '1天前', sentiment: 'negative', summary: '荷兰中卫与曼联的转会传闻持续发酵，孔帕尼公开表示"一切以俱乐部决定为准"。' },
      { title: '诺伊尔将迎安联球场告别赛季？门将未来悬而未决', source: '慕尼黑日报', time: '3天前', sentiment: 'neutral', summary: '38岁的德国传奇门将与拜仁的合同将在赛季末到期，续约谈判尚未开启。' },
    ],
  },
  {
    id: 'bvb', name: '多特蒙德', en: 'Borussia Dortmund', short: 'BVB', color: '#FDE100', color2: '#000000',
    league: '德甲', coach: '努里·沙欣', stadium: '西格纳伊度纳公园', city: '多特蒙德',
    formation: '4-2-3-1', form: 'DWWLWD',
    lineup: [
      ['科贝尔', 1, pos.GK(50, 7)], ['瑞尔森', 26, pos.RB(12, 24)], ['施洛特贝克', 4, pos.CB(38, 22)],
      ['胡梅尔斯', 15, pos.CB(62, 22)], ['本塞拜尼', 5, pos.LB(88, 24)], ['埃姆雷·詹', 23, pos.DM(40, 38)],
      ['萨比策', 20, pos.DM(60, 38)], ['布兰特', 10, pos.AM(50, 55)], ['阿德耶米', 27, pos.RW(82, 66)],
      ['菲尔克鲁格', 14, pos.ST(50, 64)], ['吉滕斯', 43, pos.LW(18, 66)],
    ],
    recent: [
      { date: '08-06', opponent: '比利亚雷亚尔', home: false, gf: 2, ga: 2, xg: 1.8, xga: 1.5, result: 'D', comp: '热身赛' },
      { date: '08-02', opponent: '神户胜利船', home: false, gf: 1, ga: 2, xg: 1.1, xga: 1.4, result: 'L', comp: '热身赛' },
      { date: '07-28', opponent: '大阪樱花', home: false, gf: 3, ga: 1, xg: 2.7, xga: 0.7, result: 'W', comp: '热身赛' },
      { date: '07-24', opponent: '圣加伦', home: false, gf: 4, ga: 1, xg: 3.5, xga: 0.6, result: 'W', comp: '热身赛' },
      { date: '07-20', opponent: '曼城', home: false, gf: 2, ga: 2, xg: 1.7, xga: 2.2, result: 'D', comp: '热身赛' },
      { date: '05-25', opponent: '多特青年队', home: true, gf: 2, ga: 0, xg: 2.4, xga: 0.2, result: 'W', comp: '友谊赛' },
    ],
    news: [
      { title: '黄黑风暴再起：沙欣确定高位逼抢为赛季主基调', source: '鲁尔新闻', time: '3小时前', sentiment: 'positive', summary: '前多特中场在执教首季便展现雄心，季前赛的高位压迫数据位列德甲热身赛第一。' },
      { title: '菲尔克鲁格拒谈转会，德媒曝其将继续担任锋线支柱', source: '图片报', time: '7小时前', sentiment: 'positive', summary: '德国国脚在夏季多支豪门求购后选择留队，承诺以更多进球回报多特球迷。' },
      { title: '胡梅尔斯与俱乐部续约谈判搁浅，经验老将或冬窗离队', source: '体育图片报', time: '1天前', sentiment: 'negative', summary: '双方在合同年限上存在分歧，多特可能提前寻找替代者。' },
      { title: '阿德耶米伤病反复，边路突击火力存疑', source: '踢球者', time: '2天前', sentiment: 'negative', summary: '德国边锋在训练中再次感到腿筋不适，将缺席热身赛收官阶段。' },
    ],
  },
  {
    id: 'int', name: '国际米兰', en: 'Inter Milan', short: 'INT', color: '#0068A8', color2: '#000000',
    league: '意甲', coach: '西蒙尼·因扎吉', stadium: '梅阿查球场', city: '米兰',
    formation: '3-5-2', form: 'WWWWWD',
    lineup: [
      ['索默', 1, pos.GK(50, 7)], ['帕瓦尔', 28, pos.CB(26, 22)], ['阿切尔比', 15, pos.CB(50, 22)],
      ['巴斯托尼', 95, pos.CB(74, 22)], ['邓弗里斯', 2, pos.RWB(92, 42)], ['巴雷拉', 23, pos.CM(38, 42)],
      ['恰尔汗奥卢', 20, pos.CM(62, 42)], ['姆希塔良', 22, pos.CM(50, 52)], ['迪马尔科', 32, pos.LWB(8, 42)],
      ['劳塔罗', 10, pos.ST(38, 68)], ['图拉姆', 9, pos.ST(62, 68)],
    ],
    recent: [
      { date: '08-07', opponent: '巴萨', home: true, gf: 1, ga: 0, xg: 1.1, xga: 0.6, result: 'W', comp: '热身赛' },
      { date: '08-03', opponent: '拜仁', home: true, gf: 1, ga: 3, xg: 0.8, xga: 2.3, result: 'L', comp: '热身赛' },
      { date: '07-30', opponent: '曼城', home: false, gf: 2, ga: 2, xg: 1.5, xga: 1.9, result: 'D', comp: '热身赛' },
      { date: '07-25', opponent: '布鲁日', home: false, gf: 3, ga: 0, xg: 2.8, xga: 0.4, result: 'W', comp: '热身赛' },
      { date: '05-25', opponent: 'AC米兰', home: false, gf: 2, ga: 1, xg: 1.4, xga: 1.0, result: 'W', comp: '意甲' },
      { date: '05-19', opponent: '那不勒斯', home: true, gf: 3, ga: 0, xg: 2.5, xga: 0.7, result: 'W', comp: '意甲' },
    ],
    news: [
      { title: '劳塔罗续约至2029年，国米队长正式成为队史顶薪', source: '米兰体育报', time: '1小时前', sentiment: 'positive', summary: '阿根廷前锋在续约仪式上动情表示："国米就是我的家，我要在这里拿到更多奖杯。"' },
      { title: '三中卫体系成型，因扎吉新赛季目标意甲+欧冠双线冲击', source: '都灵体育报', time: '5小时前', sentiment: 'positive', summary: '巴斯托尼与帕瓦尔在两翼的表现让教练组信心十足，边翼卫的套上将成为进攻利器。' },
      { title: '转会预算有限，国米中场补强计划或推迟至冬窗', source: '转会市场网', time: '1天前', sentiment: 'negative', summary: '在满足财政公平原则的前提下，国米今夏引援投入被压缩，姆希塔良的替代者仍需等待。' },
      { title: '阿切尔比训练中肌肉不适，国米防线面临人员危机', source: '共和报', time: '2天前', sentiment: 'negative', summary: '35岁老将的伤情需要进一步检查，若缺席首轮，小将比塞克将获得首发机会。' },
    ],
  },
  {
    id: 'acm', name: 'AC米兰', en: 'AC Milan', short: 'ACM', color: '#FB090B', color2: '#000000',
    league: '意甲', coach: '保罗·丰塞卡', stadium: '圣西罗球场', city: '米兰',
    formation: '4-3-3', form: 'DLWWDL',
    lineup: [
      ['迈尼昂', 16, pos.GK(50, 7)], ['卡拉布里亚', 2, pos.RB(12, 24)], ['托莫里', 23, pos.CB(38, 22)],
      ['帕夫洛维奇', 31, pos.CB(62, 22)], ['特奥', 19, pos.LB(88, 24)], ['福法纳', 29, pos.DM(50, 38)],
      ['赖因德斯', 14, pos.CM(36, 50)], ['洛夫图斯-奇克', 8, pos.CM(64, 50)], ['普利西奇', 11, pos.RW(82, 68)],
      ['莫拉塔', 7, pos.ST(50, 66)], ['莱奥', 10, pos.LW(18, 68)],
    ],
    recent: [
      { date: '08-07', opponent: '巴萨', home: true, gf: 1, ga: 0, xg: 1.1, xga: 0.6, result: 'W', comp: '热身赛' },
      { date: '08-03', opponent: '曼城', home: false, gf: 2, ga: 2, xg: 1.5, xga: 1.9, result: 'D', comp: '热身赛' },
      { date: '07-28', opponent: '皇马', home: false, gf: 2, ga: 1, xg: 1.7, xga: 1.0, result: 'W', comp: '热身赛' },
      { date: '07-22', opponent: '维也纳快速', home: false, gf: 0, ga: 1, xg: 0.4, xga: 1.2, result: 'L', comp: '热身赛' },
      { date: '05-25', opponent: '国米', home: true, gf: 1, ga: 2, xg: 1.0, xga: 1.4, result: 'L', comp: '意甲' },
      { date: '05-19', opponent: '乌迪内斯', home: true, gf: 3, ga: 1, xg: 2.2, xga: 0.9, result: 'W', comp: '意甲' },
    ],
    news: [
      { title: '莫拉塔闪电加盟：西班牙队长完成体检，将穿7号战袍', source: '米兰体育报', time: '3小时前', sentiment: 'positive', summary: '米兰以1500万欧元转会费签下马竞前锋，莫拉塔表示自己一直梦想效力米兰。' },
      { title: '丰塞卡确认莱奥为核心，葡萄牙边锋获无限开火权', source: '天空体育', time: '6小时前', sentiment: 'positive', summary: '新帅在训练中为莱奥设计了大量左路爆破战术，期待其迎来生涯最巅峰赛季。' },
      { title: '锋线磨合需时日：季前赛米兰场均进球不足1.5个', source: '罗马体育报', time: '1天前', sentiment: 'negative', summary: '莫拉塔与莱奥之间的化学反应尚在培养中，中锋背身策应效果低于预期。' },
      { title: '中场轮换深度告急：福法纳与赖因德斯已连续多场首发', source: '全市场网', time: '2天前', sentiment: 'neutral', summary: '米兰在双后腰位置上储备不足，一旦出现伤病将被迫调整阵型。' },
    ],
  },
  {
    id: 'juv', name: '尤文图斯', en: 'Juventus', short: 'JUV', color: '#000000', color2: '#FFFFFF',
    league: '意甲', coach: '蒂亚戈·莫塔', stadium: '安联竞技场', city: '都灵',
    formation: '3-5-2', form: 'WDWWDW',
    lineup: [
      ['迪格雷戈里奥', 29, pos.GK(50, 7)], ['加蒂', 4, pos.CB(26, 22)], ['布雷默', 3, pos.CB(50, 22)],
      ['卡卢卢', 15, pos.CB(74, 22)], ['坎比亚索', 27, pos.RWB(92, 42)], ['洛卡特利', 5, pos.CM(38, 42)],
      ['图拉姆', 19, pos.CM(62, 42)], ['麦肯尼', 16, pos.CM(50, 52)], ['科斯蒂奇', 17, pos.LWB(8, 42)],
      ['弗拉霍维奇', 9, pos.ST(38, 68)], ['伊尔迪兹', 10, pos.ST(62, 68)],
    ],
    recent: [
      { date: '08-06', opponent: '布雷斯特', home: false, gf: 2, ga: 0, xg: 2.0, xga: 0.5, result: 'W', comp: '热身赛' },
      { date: '08-02', opponent: '比利亚雷亚尔', home: false, gf: 1, ga: 1, xg: 1.2, xga: 1.1, result: 'D', comp: '热身赛' },
      { date: '07-28', opponent: '不来梅', home: false, gf: 2, ga: 1, xg: 2.1, xga: 0.9, result: 'W', comp: '热身赛' },
      { date: '07-23', opponent: '莱比锡', home: true, gf: 1, ga: 2, xg: 1.0, xga: 1.5, result: 'L', comp: '热身赛' },
      { date: '05-25', opponent: '蒙扎', home: true, gf: 3, ga: 0, xg: 2.6, xga: 0.4, result: 'W', comp: '意甲' },
      { date: '05-20', opponent: '亚特兰大', home: true, gf: 1, ga: 1, xg: 1.3, xga: 1.0, result: 'D', comp: '意甲' },
    ],
    news: [
      { title: '莫塔蓝图成形：尤文确立三中卫体系，目标意甲冠军', source: '都灵体育报', time: '2小时前', sentiment: 'positive', summary: '前博洛尼亚教头在尤文的前三周展现出清晰的战术思路，高位防线与快速转换是核心。' },
      { title: '弗拉霍维奇状态爆棚：热身赛4场4球，找回射手本能', source: '天空体育', time: '7小时前', sentiment: 'positive', summary: '塞尔维亚前锋在莫塔体系中获得更多禁区内触球机会，射门选择明显改善。' },
      { title: '尤文锋线引援遇阻：多笔交易因薪资分歧告吹', source: '全尤文网', time: '1天前', sentiment: 'negative', summary: '俱乐部希望补强轮换前锋，但受到财政约束，谈判屡屡陷入僵局。' },
      { title: '伊尔迪兹或迎来爆发赛季：天才少年获教练组重点培养', source: '罗马体育报', time: '2天前', sentiment: 'positive', summary: '19岁土耳其小将在热身赛中客串前锋表现抢眼，被视为尤文未来十年的进攻核心。' },
    ],
  },
  {
    id: 'psg', name: '巴黎圣日耳曼', en: 'Paris Saint-Germain', short: 'PSG', color: '#004170', color2: '#DA291C',
    league: '法甲', coach: '路易斯·恩里克', stadium: '王子公园球场', city: '巴黎',
    formation: '4-3-3', form: 'DWWWWW',
    lineup: [
      ['多纳鲁马', 99, pos.GK(50, 7)], ['阿什拉夫', 2, pos.RB(12, 24)], ['马尔基尼奥斯', 5, pos.CB(38, 22)],
      ['什克里尼亚尔', 37, pos.CB(62, 22)], ['努诺·门德斯', 25, pos.LB(88, 24)], ['维蒂尼亚', 17, pos.DM(50, 38)],
      ['法比安·鲁伊斯', 8, pos.CM(36, 50)], ['若昂·内维斯', 87, pos.CM(64, 50)], ['登贝莱', 10, pos.RW(82, 68)],
      ['贡萨洛·拉莫斯', 9, pos.ST(50, 66)], ['巴尔科拉', 29, pos.LW(18, 68)],
    ],
    recent: [
      { date: '08-07', opponent: '皇家社会', home: false, gf: 2, ga: 0, xg: 2.2, xga: 0.6, result: 'W', comp: '热身赛' },
      { date: '08-03', opponent: '本菲卡', home: false, gf: 3, ga: 1, xg: 2.4, xga: 0.9, result: 'W', comp: '热身赛' },
      { date: '07-29', opponent: '莱比锡', home: false, gf: 2, ga: 1, xg: 1.9, xga: 1.1, result: 'W', comp: '热身赛' },
      { date: '07-24', opponent: '马德里竞技', home: false, gf: 1, ga: 1, xg: 1.2, xga: 1.2, result: 'D', comp: '热身赛' },
      { date: '07-19', opponent: '卡塔尔明星联', home: true, gf: 5, ga: 0, xg: 4.1, xga: 0.1, result: 'W', comp: '友谊赛' },
      { date: '05-25', opponent: '里昂', home: true, gf: 3, ga: 0, xg: 2.8, xga: 0.5, result: 'W', comp: '法甲' },
    ],
    news: [
      { title: '登贝莱正式接过10号球衣，恩里克称其"领袖型球员"', source: '队报', time: '4小时前', sentiment: 'positive', summary: '法国边锋在诺坎普的争议之后，在巴黎迎来新生，新赛季将承担更重的进攻组织任务。' },
      { title: '维蒂尼亚成中场节拍器：传球成功率93%领跑全队', source: '巴黎人报', time: '9小时前', sentiment: 'positive', summary: '葡萄牙中场的推进能力是恩里克体系运转的关键，预计将锁定首发位置。' },
      { title: '恩里克承认防线轮换存隐患，中卫组合仍无定论', source: 'RMC体育', time: '1天前', sentiment: 'negative', summary: '什克里尼亚尔与马尔基尼奥斯的双塔组合速度偏慢，面对反击型球队时恐成软肋。' },
      { title: '锋线年龄结构引热议：拉莫斯与穆阿尼谁该首发？', source: '法国足球', time: '2天前', sentiment: 'neutral', summary: '两位前锋风格迥异，恩里克表示将根据对手特点进行轮换，竞争会持续整个赛季。' },
    ],
  },
];

/* ============================================================
 * 轻量球队：五大联赛之外的其他联赛球队
 * 提供基本信息 + 近六场（确定性生成），阵容/舆论待接入真实数据
 * ============================================================ */

function seeded(key) {
  let h = 0;
  for (const c of String(key)) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return h / 9973;
}

function genLightTeam(def, pool) {
  const form = Array.from({ length: 6 }, (_, i) => {
    const r = seeded(`${def.id}:form:${i}`);
    return r < 0.5 ? 'W' : r < 0.75 ? 'D' : 'L';
  }).join('');

  const recent = Array.from({ length: 6 }, (_, i) => {
    const r = seeded(`${def.id}:r${i}`);
    const result = ['W', 'D', 'L'][r < 0.5 ? 0 : r < 0.75 ? 1 : 2];
    const opp = pool[(seeded(`${def.id}:opp:${i}`) * pool.length) | 0];
    const scores = {
      W: { gf: 2, ga: 1, xg: 1.9, xga: 0.9 },
      D: { gf: 1, ga: 1, xg: 1.1, xga: 1.1 },
      L: { gf: 0, ga: 1, xg: 0.6, xga: 1.6 },
    }[result];
    return {
      date: ['08-07', '08-03', '07-30', '07-26', '07-22', '07-18'][i],
      opponent: opp,
      home: i % 2 === 0,
      ...scores,
      result,
      comp: def.league,
    };
  });

  return {
    id: def.id,
    name: def.name,
    en: def.en,
    short: def.short,
    color: def.color,
    color2: def.color2,
    league: def.league,
    coach: def.coach,
    stadium: def.stadium,
    city: def.city,
    formation: def.formation || null,
    form,
    recent,
    lineup: def.lineup || [],
    news: def.news || [],
  };
}

const LIGHT_DEFS = [
  {
    id: 'monaco', name: '摩纳哥', en: 'Monaco', short: 'MON', color: '#d61021', color2: '#1a1a1a', league: '法甲', coach: '阿迪·许特尔', stadium: '路易二世球场', city: '摩纳哥', formation: '4-3-3',
    lineup: [
      ['马耶茨基', 1, pos.GK(50, 7)], ['万德森', 19, pos.RB(12, 24)], ['萨利苏', 22, pos.CB(38, 22)],
      ['迪萨西', 20, pos.CB(62, 22)], ['卡约·恩里克', 2, pos.LB(88, 24)], ['扎卡里亚', 15, pos.DM(50, 38)],
      ['戈洛温', 17, pos.CM(36, 50)], ['阿克利乌什', 11, pos.CM(64, 50)], ['巴洛贡', 29, pos.RW(82, 68)],
      ['恩博洛', 36, pos.ST(50, 66)], ['南野拓实', 18, pos.LW(18, 68)],
    ],
    news: [
      { title: '摩纳哥欧冠分组抽签出炉，新援恩博洛成锋线关键先生', source: '队报', time: '3小时前', sentiment: 'positive', summary: '瑞士前锋在季前赛贡献3球2助攻，许特尔确认其将领衔锋线出战新赛季。' },
      { title: '青训中卫迪萨西获续约，摩纳哥防线未来可期', source: 'RMC体育', time: '8小时前', sentiment: 'positive', summary: '21岁的法国中卫已锁定首发位置，俱乐部与其续约至2029年。' },
      { title: '中场厚度不足成隐忧，戈洛温轮换人选仍未敲定', source: '尼斯晨报', time: '1天前', sentiment: 'negative', summary: '在多名中场离队后，摩纳哥的中场轮换深度受到质疑。' },
      { title: '许特尔强调欧冠优先：联赛轮换策略将更加激进', source: '法国足球', time: '2天前', sentiment: 'neutral', summary: '奥地利教头表示会在法甲中大胆轮换，为欧冠关键战保存体能。' },
    ],
  },
  {
    id: 'atm', name: '马德里竞技', en: 'Atlético Madrid', short: 'ATM', color: '#cb3524', color2: '#1c1f24', league: '西甲', coach: '迭戈·西蒙尼', stadium: '大都会球场', city: '马德里', formation: '4-4-2',
    lineup: [
      ['奥布拉克', 13, pos.GK(50, 7)], ['莫利纳', 16, pos.RB(12, 24)], ['希门尼斯', 2, pos.CB(38, 22)],
      ['朗格莱', 15, pos.CB(62, 22)], ['加兰', 22, pos.LB(88, 24)], ['略伦特', 14, pos.RM(88, 48)],
      ['德保罗', 5, pos.CM(42, 46)], ['科克', 6, pos.CM(58, 46)], ['利诺', 12, pos.LM(12, 48)],
      ['格列兹曼', 7, pos.ST(40, 66)], ['阿尔瓦雷斯', 19, pos.ST(60, 66)],
    ],
    news: [
      { title: '格列兹曼与阿尔瓦雷斯双前锋组合效率惊人，季前赛合砍7球', source: '马卡报', time: '2小时前', sentiment: 'positive', summary: '两名前锋的化学反应超出预期，西蒙尼或在新赛季主打双前锋体系。' },
      { title: '西蒙尼确认奥布拉克仍是门将第一选择', source: '阿斯报', time: '6小时前', sentiment: 'positive', summary: '在转会传闻喧嚣过后，斯洛文尼亚门将依旧坐稳首发位置。' },
      { title: '马竞锋线冗余：多名边缘前锋或被迫离队', source: 'Relevo', time: '1天前', sentiment: 'negative', summary: '随着新援加盟，球队锋线人数超标，管理层需要在本月完成清洗。' },
      { title: '科克进入合同年，队长未来仍是问号', source: '世界体育报', time: '2天前', sentiment: 'neutral', summary: '球队大脑的续约谈判尚未开启，双方都在观察新赛季走势。' },
    ],
  },
  {
    id: 'rbl', name: '莱比锡红牛', en: 'RB Leipzig', short: 'RBL', color: '#dd0741', color2: '#0b1b33', league: '德甲', coach: '马尔科·罗泽', stadium: '红牛竞技场', city: '莱比锡', formation: '4-2-3-1',
    lineup: [
      ['古拉奇', 1, pos.GK(50, 7)], ['亨里希斯', 39, pos.RB(12, 24)], ['奥尔班', 4, pos.CB(38, 22)],
      ['卢克巴', 23, pos.CB(62, 22)], ['劳姆', 22, pos.LB(88, 24)], ['施拉格', 24, pos.DM(40, 38)],
      ['海达拉', 8, pos.DM(60, 38)], ['哈维·西蒙斯', 10, pos.AM(50, 55)], ['奥蓬达', 17, pos.RW(82, 66)],
      ['塞斯科', 30, pos.ST(50, 64)], ['努萨', 7, pos.LW(18, 66)],
    ],
    news: [
      { title: '塞斯科续约后状态火热，莱比锡锋线王牌剑指金靴', source: '踢球者', time: '4小时前', sentiment: 'positive', summary: '斯洛文尼亚前锋在新合同中包含解约条款，季前赛5场打入5球。' },
      { title: '哈维·西蒙斯租借期满回归，红牛中场创造力大增', source: '图片报', time: '7小时前', sentiment: 'positive', summary: '荷兰天才重回红牛竞技场，罗泽将围绕其打造前场进攻体系。' },
      { title: '卢克巴转会传闻不断，莱比锡中卫核心恐难留住', source: '体育图片报', time: '1天前', sentiment: 'negative', summary: '多家豪门对法国中卫兴趣浓厚，莱比锡可能被迫出售套现。' },
      { title: '门将位置更替：古拉奇伤愈复出重新夺回首发', source: '莱比锡人民报', time: '2天前', sentiment: 'neutral', summary: '匈牙利国门在长期伤病后回归，季前赛表现稳健。' },
    ],
  },
  {
    id: 'uls', name: '蔚山HD', en: 'Ulsan HD', short: 'ULS', color: '#0b2e63', color2: '#16357c', league: '韩K联赛', coach: '金判坤', stadium: '蔚山文殊球场', city: '蔚山', formation: '4-3-3',
    lineup: [
      ['赵贤祐', 21, pos.GK(50, 7)], ['薛英佑', 2, pos.RB(12, 24)], ['金英权', 19, pos.CB(38, 22)],
      ['林宗垠', 5, pos.CB(62, 22)], ['李明载', 3, pos.LB(88, 24)], ['朴镕宇', 24, pos.DM(50, 38)],
      ['高丞范', 8, pos.CM(36, 50)], ['李东炅', 10, pos.CM(64, 50)], ['严原上', 17, pos.RW(82, 68)],
      ['周敏圭', 99, pos.ST(50, 66)], ['马捷尼奥', 11, pos.LW(18, 68)],
    ],
    news: [
      { title: '蔚山HD豪取三连胜领跑K联赛，金判坤获月度最佳教练', source: 'K联赛官网', time: '5小时前', sentiment: 'positive', summary: '球队在攻防两端均展现统治力，赵贤祐连续三场零封。' },
      { title: '周敏圭续约至2027年，K联赛金靴留守蔚山', source: '东亚体育', time: '9小时前', sentiment: 'positive', summary: '韩国国脚前锋与俱乐部达成续约协议，继续担任锋线核心。' },
      { title: '亚冠出线压力：蔚山双线作战体能告急', source: '首尔体育', time: '1天前', sentiment: 'negative', summary: '密集赛程下主力球员出场时间居高不下，轮换深度成隐患。' },
      { title: '青训小将李东炅获提拔，蔚山中场注入新鲜血液', source: '京乡体育', time: '2天前', sentiment: 'neutral', summary: '19岁新星在联赛杯中表现出色，有望进入轮换阵容。' },
    ],
  },
  {
    id: 'junbuk', name: '全北现代', en: 'Jeonbuk Hyundai', short: 'JBH', color: '#128a46', color2: '#0d6b36', league: '韩K联赛', coach: '金斗炫', stadium: '全州世界杯球场', city: '全州', formation: '4-2-3-1',
    lineup: [
      ['金正勋', 1, pos.GK(50, 7)], ['金纹奂', 22, pos.RB(12, 24)], ['朴镇燮', 6, pos.CB(38, 22)],
      ['洪正好', 26, pos.CB(62, 22)], ['金珍洙', 3, pos.LB(88, 24)], ['崔荣峻', 5, pos.DM(40, 38)],
      ['韩教元', 13, pos.DM(60, 38)], ['宋旻奎', 11, pos.AM(50, 55)], ['蒂亚戈', 27, pos.RW(82, 66)],
      ['奥罗博', 9, pos.ST(50, 64)], ['金大元', 7, pos.LW(18, 66)],
    ],
    news: [
      { title: '全北现代触底反弹，奥罗博帽子戏法终结四轮不胜', source: 'SPOTV', time: '3小时前', sentiment: 'positive', summary: '尼日利亚前锋用帽子戏法帮助球队拿下关键三分，排名升至积分榜前六。' },
      { title: '洪正好领衔防线复苏，全北近三场仅失一球', source: 'KBS体育', time: '8小时前', sentiment: 'positive', summary: '老将中卫的指挥稳定了后防，球队零封场次明显增加。' },
      { title: '积分榜落后榜首两位数，全北争冠希望渺茫', source: 'MBC体育', time: '1天前', sentiment: 'negative', summary: '本赛季糟糕的开局让球队早早掉队，球迷要求管理层做出改变。' },
      { title: '金斗炫战术调整：双后腰体系初见成效', source: '韩联社', time: '2天前', sentiment: 'neutral', summary: '主帅在近期比赛中变阵4-2-3-1，攻守平衡得到改善。' },
    ],
  },
  {
    id: 'kobe', name: '神户胜利船', en: 'Vissel Kobe', short: 'KOB', color: '#b01e2e', color2: '#1a1a1a', league: '日职联赛', coach: '吉田孝行', stadium: '御崎公园球场', city: '神户', formation: '4-3-3',
    lineup: [
      ['前川黛也', 1, pos.GK(50, 7)], ['酒井高德', 24, pos.RB(12, 24)], ['山川哲史', 3, pos.CB(38, 22)],
      ['图尔勒', 4, pos.CB(62, 22)], ['初濑亮', 19, pos.LB(88, 24)], ['扇原贵宏', 6, pos.DM(50, 38)],
      ['井手口阳介', 7, pos.CM(36, 50)], ['山口萤', 5, pos.CM(64, 50)], ['宫代大圣', 18, pos.RW(82, 68)],
      ['大迫勇也', 10, pos.ST(50, 66)], ['武藤嘉纪', 11, pos.LW(18, 68)],
    ],
    news: [
      { title: '神户胜利船领跑J1积分榜，大迫勇也连续四轮破门', source: '日刊体育', time: '2小时前', sentiment: 'positive', summary: '卫冕冠军延续强势，巴西外援图尔勒与本土球员的防线组合固若金汤。' },
      { title: '大迫勇也：35岁的他仍是J联赛最锋利前锋', source: '报知体育', time: '7小时前', sentiment: 'positive', summary: '老将前锋本赛季已打入12球，领跑射手榜，状态令人惊叹。' },
      { title: '伤病潮来袭：井手口阳介拉伤将缺阵三周', source: '神户新闻', time: '1天前', sentiment: 'negative', summary: '中场核心的伤缺让球队在密集赛程中的轮换捉襟见肘。' },
      { title: '吉田孝行确认亚冠轮换计划，双线作战考验阵容深度', source: '体育报知', time: '2天前', sentiment: 'neutral', summary: '主帅表示将在亚冠与联赛之间合理分配主力体能。' },
    ],
  },
  {
    id: 'fmar', name: '横滨水手', en: 'Yokohama F. Marinos', short: 'FMA', color: '#0463b6', color2: '#0a2a6b', league: '日职联赛', coach: '约翰·哈钦森', stadium: '日产体育场', city: '横滨', formation: '4-2-3-1',
    lineup: [
      ['波普', 1, pos.GK(50, 7)], ['松原健', 27, pos.RB(12, 24)], ['爱德华多', 5, pos.CB(38, 22)],
      ['畠中槙之辅', 4, pos.CB(62, 22)], ['永户胜也', 2, pos.LB(88, 24)], ['喜田拓也', 8, pos.DM(40, 38)],
      ['渡边皓太', 6, pos.DM(60, 38)], ['马特乌斯', 10, pos.AM(50, 55)], ['埃尔伯', 17, pos.RW(82, 66)],
      ['安德森·洛佩斯', 9, pos.ST(50, 64)], ['水沼宏太', 11, pos.LW(18, 66)],
    ],
    news: [
      { title: '横滨水手新帅哈钦森上任，全攻全守足球重回车神', source: '神奈川新闻', time: '4小时前', sentiment: 'positive', summary: '澳大利亚教头延续球队攻势足球传统，季前赛场均进球超过3个。' },
      { title: '安德森·洛佩斯状态火爆，巴西前锋领跑队内射手榜', source: '日刊体育', time: '8小时前', sentiment: 'positive', summary: '前K联赛金靴在J联赛继续高产，已贡献9球4助攻。' },
      { title: '防守顽疾未除：横滨水手客场失球数联赛倒数', source: '东京体育', time: '1天前', sentiment: 'negative', summary: '高位防线在面对反击型球队时屡屡失守，教练组正尝试调整。' },
      { title: '青训中场山根陆晋升一线队，横滨水手人才储备充足', source: '产经体育', time: '2天前', sentiment: 'neutral', summary: '18岁新星在联赛杯中首发并贡献助攻，获得教练组好评。' },
    ],
  },
  {
    id: 'kawasaki', name: '川崎前锋', en: 'Kawasaki Frontale', short: 'KAW', color: '#1857a4', color2: '#0d3d75', league: '日职联赛', coach: '鬼木达', stadium: '等等力陆上竞技场', city: '川崎', formation: '4-3-3',
    lineup: [
      ['郑成龙', 1, pos.GK(50, 7)], ['山根视来', 13, pos.RB(12, 24)], ['车屋绅太郎', 4, pos.CB(38, 22)],
      ['大南拓磨', 5, pos.CB(62, 22)], ['登里享平', 2, pos.LB(88, 24)], ['橘田健人', 8, pos.DM(50, 38)],
      ['脇坂泰斗', 14, pos.CM(36, 50)], ['濑川祐辅', 17, pos.CM(64, 50)], ['马尔西尼奥', 23, pos.RW(82, 68)],
      ['山田新', 9, pos.ST(50, 66)], ['埃里松', 11, pos.LW(18, 68)],
    ],
    news: [
      { title: '川崎前锋逆转取胜，山田新梅开二度续写青春风暴', source: '神奈川新闻', time: '3小时前', sentiment: 'positive', summary: '22岁的年轻前锋连续三轮破门，被视为J联赛锋线新希望。' },
      { title: '鬼木达执教十周年：川崎王朝仍在延续', source: '足球文摘', time: '6小时前', sentiment: 'positive', summary: '这位日本足坛最成功主帅之一的球队继续稳居积分榜前列。' },
      { title: '后防老化问题凸显，川崎中卫组合平均年龄超30岁', source: '东京中日体育', time: '1天前', sentiment: 'negative', summary: '速度型前锋的冲击让老迈防线屡屡告急，引援迫在眉睫。' },
      { title: '脇坂泰斗或将留洋，欧洲球队密切关注', source: '日刊体育', time: '2天前', sentiment: 'neutral', summary: '日本国脚中场的经纪团队透露已有欧洲报价，冬窗动向成焦点。' },
    ],
  },
  {
    id: 'fla', name: '弗拉门戈', en: 'Flamengo', short: 'FLA', color: '#d20a11', color2: '#1a1a1a', league: '巴西甲', coach: '蒂特', stadium: '马拉卡纳球场', city: '里约热内卢', formation: '4-3-3',
    lineup: [
      ['罗西', 1, pos.GK(50, 7)], ['瓦雷拉', 2, pos.RB(12, 24)], ['莱奥·奥尔蒂斯', 3, pos.CB(38, 22)],
      ['法布里西奥·布鲁诺', 15, pos.CB(62, 22)], ['艾尔顿', 33, pos.LB(88, 24)], ['热尔松', 8, pos.DM(50, 38)],
      ['德阿拉斯卡埃塔', 14, pos.CM(36, 50)], ['普尔加', 5, pos.CM(64, 50)], ['布鲁诺·恩里克', 27, pos.RW(82, 68)],
      ['佩德罗', 9, pos.ST(50, 66)], ['加布里埃尔', 10, pos.LW(18, 68)],
    ],
    news: [
      { title: '弗拉门戈冲击巴甲榜首，佩德罗已打入16球', source: '环球体育', time: '4小时前', sentiment: 'positive', summary: '马拉卡纳之王本赛季状态神勇，领跑联赛射手榜。' },
      { title: '蒂特确认加布里埃尔与佩德罗双枪合璧', source: '兰斯报', time: '8小时前', sentiment: 'positive', summary: '两位巴西国脚前锋的共存问题终于解决，球队攻击力大增。' },
      { title: '连续客场不胜，弗拉门戈客场虫魔咒再现', source: '环球报', time: '1天前', sentiment: 'negative', summary: '球队在主客场表现差异巨大，客场积分仅为主场的一半。' },
      { title: '德阿拉斯卡埃塔合同将尽，弗拉门戈面临续约抉择', source: '巴西日报', time: '2天前', sentiment: 'neutral', summary: '乌拉圭中场是球队核心，但薪资要求成为续约阻碍。' },
    ],
  },
  {
    id: 'pal', name: '帕尔梅拉斯', en: 'Palmeiras', short: 'PAL', color: '#006437', color2: '#004a28', league: '巴西甲', coach: '阿贝尔·费雷拉', stadium: '安联公园球场', city: '圣保罗', formation: '4-2-3-1',
    lineup: [
      ['韦弗顿', 21, pos.GK(50, 7)], ['马科斯·罗查', 2, pos.RB(12, 24)], ['古斯塔沃·戈麦斯', 15, pos.CB(38, 22)],
      ['穆里略', 26, pos.CB(62, 22)], ['皮克雷斯', 22, pos.LB(88, 24)], ['泽·拉斐尔', 8, pos.DM(40, 38)],
      ['阿尼巴尔·莫雷诺', 5, pos.DM(60, 38)], ['拉斐尔·维加', 23, pos.AM(50, 55)], ['埃斯特万', 41, pos.RW(82, 66)],
      ['何塞·洛佩斯', 9, pos.ST(50, 64)], ['杜杜', 7, pos.LW(18, 66)],
    ],
    news: [
      { title: '帕尔梅拉斯豪取五连胜，埃斯特万荣膺月度最佳新秀', source: '环球体育', time: '2小时前', sentiment: 'positive', summary: '17岁天才边锋延续惊艳表现，已吸引多家欧洲豪门关注。' },
      { title: '韦弗顿神扑救主，帕尔梅拉斯门将再创零封纪录', source: '圣保罗页报', time: '7小时前', sentiment: 'positive', summary: '巴西国门本赛季已完成14次零封，冠绝巴甲。' },
      { title: '多线作战显疲态，帕尔梅拉斯近两场联赛仅取1分', source: '兰斯报', time: '1天前', sentiment: 'negative', summary: '解放者杯与联赛双线作战让球队体能告急，轮换深度受质疑。' },
      { title: '费雷拉合同续约谈判开启，帕尔梅拉斯全力留帅', source: '巴西日报', time: '2天前', sentiment: 'neutral', summary: '俱乐部高层视葡萄牙教头为复兴基石，正讨论续约细节。' },
    ],
  },
  {
    id: 'cor', name: '科林蒂安', en: 'Corinthians', short: 'COR', color: '#0b0b0b', color2: '#ffffff', league: '巴西甲', coach: '拉蒙·迪亚斯', stadium: '新科林蒂安竞技场', city: '圣保罗', formation: '3-5-2',
    lineup: [
      ['多内利', 1, pos.GK(50, 7)], ['费利克斯·托雷斯', 3, pos.CB(26, 22)], ['吉尔', 4, pos.CB(50, 22)],
      ['古斯塔沃·亨里克', 25, pos.CB(74, 22)], ['法格纳', 23, pos.RWB(92, 42)], ['拉伊恩', 8, pos.CM(38, 42)],
      ['加尔哈多', 11, pos.CM(62, 42)], ['奥古斯托', 5, pos.CM(50, 52)], ['比杜', 12, pos.LWB(8, 42)],
      ['尤里·阿尔贝托', 9, pos.ST(38, 68)], ['罗梅罗', 7, pos.ST(62, 68)],
    ],
    news: [
      { title: '科林蒂安爆冷击败领头羊，尤里·阿尔贝托定乾坤', source: '环球体育', time: '5小时前', sentiment: 'positive', summary: '阿根廷前锋的制胜球帮助球队终结对手不败金身，士气大振。' },
      { title: '罗梅罗领跑队内射手榜，巴拉圭前锋持续输出', source: '圣保罗页报', time: '9小时前', sentiment: 'positive', summary: '这位经验丰富的老将已贡献9球5助攻，是球队进攻端最稳定的点。' },
      { title: '科林蒂安财政危机悬而未决，引援受限', source: '巴西日报', time: '1天前', sentiment: 'negative', summary: '债务压力让球队在转会市场捉襟见肘，只能依靠租借补强。' },
      { title: '拉蒙·迪亚斯确认战术重心：三中卫体系将延续', source: '环球报', time: '2天前', sentiment: 'neutral', summary: '阿根廷教头表示球队已习惯352阵型，不会轻易改变。' },
    ],
  },
  {
    id: 'ame', name: '墨西哥美洲', en: 'Club América', short: 'AME', color: '#f7c500', color2: '#1a1a1a', league: '墨西哥超', coach: '安德烈·雅尔丁', stadium: '阿兹特克球场', city: '墨西哥城', formation: '4-3-3',
    lineup: [
      ['路易斯·马拉贡', 1, pos.GK(50, 7)], ['凯文·阿尔瓦雷斯', 2, pos.RB(12, 24)], ['塞巴斯蒂安·卡塞雷斯', 3, pos.CB(38, 22)],
      ['伊斯拉埃尔·雷耶斯', 26, pos.CB(62, 22)], ['路易斯·富恩特斯', 17, pos.LB(88, 24)], ['埃德森·阿尔瓦雷斯', 4, pos.DM(50, 38)],
      ['迭戈·巴尔德斯', 10, pos.CM(36, 50)], ['约纳坦·多斯桑托斯', 13, pos.CM(64, 50)], ['朱利安·基尼奥内斯', 27, pos.RW(82, 68)],
      ['亨利·马丁', 21, pos.ST(50, 66)], ['布莱恩·罗德里格斯', 7, pos.LW(18, 68)],
    ],
    news: [
      { title: '墨西哥美洲卫冕之路再进一步，亨利·马丁梅开二度', source: '纪录报', time: '3小时前', sentiment: 'positive', summary: '卫冕冠军在联赛中继续高歌猛进，暂列积分榜首位。' },
      { title: '阿兹特克球场上座率创纪录，美洲球迷热情不减', source: '墨西哥体育日报', time: '7小时前', sentiment: 'positive', summary: '主场平均上座人数突破7万，创造俱乐部历史新高。' },
      { title: '防线轮换不足，美洲中卫组合连续作战显疲态', source: '宇宙报', time: '1天前', sentiment: 'negative', summary: '卡塞雷斯与雷耶斯的搭档缺乏替补支持，伤病风险上升。' },
      { title: '雅尔丁表态：美洲的目标是联赛与杯赛双冠', source: '民族报', time: '2天前', sentiment: 'neutral', summary: '葡萄牙教头对球队阵容深度充满信心，强调双线作战计划。' },
    ],
  },
  {
    id: 'mtry', name: '蒙特雷', en: 'Monterrey', short: 'MTR', color: '#0d5c8c', color2: '#083b5e', league: '墨西哥超', coach: '马丁·德米凯利斯', stadium: 'BBVA球场', city: '蒙特雷', formation: '4-4-2',
    lineup: [
      ['埃斯特万·安德拉达', 1, pos.GK(50, 7)], ['斯特凡·梅迪纳', 33, pos.RB(12, 24)], ['塞萨尔·蒙特斯', 3, pos.CB(38, 22)],
      ['维克托·古斯曼', 14, pos.CB(62, 22)], ['赫拉尔多·阿特亚加', 16, pos.LB(88, 24)], ['马克西米利亚诺·梅萨', 21, pos.RM(88, 48)],
      ['路易斯·罗莫', 5, pos.CM(42, 46)], ['卡洛斯·罗德里格斯', 10, pos.CM(58, 46)], ['塞尔希奥·卡纳莱斯', 8, pos.LM(12, 48)],
      ['热尔曼·贝尔特拉梅', 9, pos.ST(40, 66)], ['富内斯·莫里', 7, pos.ST(60, 66)],
    ],
    news: [
      { title: '蒙特雷逆袭取胜，卡纳莱斯世界波震惊全场', source: '纪录报', time: '4小时前', sentiment: 'positive', summary: '前皇家社会球星延续出色状态，帮助球队升至积分榜前三。' },
      { title: '富内斯·莫里荣膺月度最佳，老将第二春仍在继续', source: '墨西哥体育日报', time: '8小时前', sentiment: 'positive', summary: '35岁的阿根廷前锋本月打入5球，重回国家队名单的呼声渐高。' },
      { title: '蒙特雷中场发动机罗德里格斯伤停四周', source: '宇宙报', time: '1天前', sentiment: 'negative', summary: '墨西哥国脚的缺阵将影响球队中前场衔接，教练组急需调整。' },
      { title: '德米凯利斯确认冬季转会窗口将补强边路', source: '民族报', time: '2天前', sentiment: 'neutral', summary: '阿根廷教头认为边锋位置深度不足，已向管理层提交引援清单。' },
    ],
  },
  {
    id: 'mil', name: '百万富翁', en: 'Millonarios', short: 'MIL', color: '#0f0f8e', color2: '#1a1a5e', league: '哥伦比亚甲', coach: '阿尔贝托·加梅罗', stadium: '埃尔坎平球场', city: '波哥大', formation: '4-2-3-1',
    lineup: [
      ['阿尔瓦罗·蒙特罗', 1, pos.GK(50, 7)], ['埃尔维斯·莫斯克拉', 4, pos.RB(12, 24)], ['安德烈斯·利纳斯', 3, pos.CB(38, 22)],
      ['胡安·莫雷诺', 26, pos.CB(62, 22)], ['奥马尔·贝尔特兰', 17, pos.LB(88, 24)], ['胡安·卡洛斯·佩雷拉', 6, pos.DM(40, 38)],
      ['拉里·巴斯克斯', 15, pos.DM(60, 38)], ['丹尼尔·鲁伊斯', 10, pos.AM(50, 55)], ['费尔南多·乌里韦', 27, pos.RW(82, 66)],
      ['莱昂纳多·卡斯特罗', 9, pos.ST(50, 64)], ['豪尔赫·卡瓦哈尔', 11, pos.LW(18, 66)],
    ],
    news: [
      { title: '百万富翁主场不败纪录延续，卡斯特罗一剑封喉', source: '时代报', time: '5小时前', sentiment: 'positive', summary: '波哥大豪门在埃尔坎平的强势表现让对手胆寒，稳居联赛前三。' },
      { title: '青训体系再结硕果：19岁中场丹尼尔·鲁伊斯爆发', source: '哥伦比亚国家报', time: '9小时前', sentiment: 'positive', summary: '年轻中场连续两轮当选全场最佳，被视为哥伦比亚足球未来。' },
      { title: '解放者杯资格赛出局，百万富翁重心回归联赛', source: '观察者报', time: '1天前', sentiment: 'negative', summary: '洲际赛事过早出局让球队经济受损，但联赛争冠目标不变。' },
      { title: '加梅罗确定轮换方针，应对密集赛程', source: '哥伦比亚体育报', time: '2天前', sentiment: 'neutral', summary: '主帅强调阵容深度管理，将给更多年轻球员出场机会。' },
    ],
  },
  {
    id: 'med', name: '麦德林独立', en: 'Independiente Medellín', short: 'MED', color: '#1a4e9e', color2: '#12386e', league: '哥伦比亚甲', coach: '亚历杭德罗·雷斯特雷波', stadium: '阿塔纳西奥球场', city: '麦德林', formation: '4-4-2',
    lineup: [
      ['安德烈斯·莫斯克拉', 1, pos.GK(50, 7)], ['约翰·弗洛雷斯', 4, pos.RB(12, 24)], ['安德烈斯·卡达维德', 3, pos.CB(38, 22)],
      ['迭戈·莫雷诺', 26, pos.CB(62, 22)], ['奥斯卡·穆里略', 17, pos.LB(88, 24)], ['埃德温·卡多纳', 21, pos.RM(88, 48)],
      ['胡安·迪亚斯', 6, pos.CM(42, 46)], ['约恩·鲁伊斯', 15, pos.CM(58, 46)], ['安德烈斯·里维拉', 11, pos.LM(12, 48)],
      ['费利佩·帕尔多', 9, pos.ST(40, 66)], ['圣地亚哥·罗德里格斯', 7, pos.ST(60, 66)],
    ],
    news: [
      { title: '麦德林独立客场掀翻领头羊，帕尔多双响封神', source: '哥伦比亚体育报', time: '3小时前', sentiment: 'positive', summary: '这场大胜让球队排名跃升至前四，争冠希望重燃。' },
      { title: '阿塔纳西奥球场翻新完成，麦德林主场人气爆棚', source: '观察者报', time: '8小时前', sentiment: 'positive', summary: '修缮一新的球场本赛季场均上座突破4万人，创下俱乐部纪录。' },
      { title: '核心中场约恩·鲁伊斯遭遇十字韧带重伤', source: '时代报', time: '1天前', sentiment: 'negative', summary: '球队大脑将缺席本赛季剩余比赛，麦德林独立面临严峻考验。' },
      { title: '雷斯特雷波谈争冠前景：一场一场拼', source: '哥伦比亚国家报', time: '2天前', sentiment: 'neutral', summary: '主帅对争冠话题保持低调，强调球队专注每一场比赛。' },
    ],
  },
  {
    id: 'malmo', name: '马尔默', en: 'Malmö FF', short: 'MFF', color: '#0093dd', color2: '#0a5e8c', league: '瑞超', coach: '亨里克·里德斯特伦', stadium: '瑞典银行球场', city: '马尔默', formation: '4-3-3',
    lineup: [
      ['约翰·达林', 1, pos.GK(50, 7)], ['马丁·拉尔松', 17, pos.RB(12, 24)], ['彭图斯·扬松', 18, pos.CB(38, 22)],
      ['尼尔斯·莫伊桑德', 6, pos.CB(62, 22)], ['奥斯卡·泽特斯特伦', 13, pos.LB(88, 24)], ['莱维茨基', 8, pos.DM(50, 38)],
      ['塞尔吉奥·佩尼亚', 10, pos.CM(36, 50)], ['约翰内松', 14, pos.CM(64, 50)], ['南纳西', 29, pos.RW(82, 68)],
      ['博特海姆', 9, pos.ST(50, 66)], ['林德斯特兰德', 22, pos.LW(18, 68)],
    ],
    news: [
      { title: '马尔默继续领跑瑞超，博特海姆冲击金靴', source: '瑞典晚报', time: '2小时前', sentiment: 'positive', summary: '球队已连续11轮不败，挪威前锋以14球领跑射手榜。' },
      { title: '欧战经验加持：马尔默双线作战信心十足', source: '快报', time: '7小时前', sentiment: 'positive', summary: '作为瑞超欧战常客，球队在小组赛抽签中抽到不错签位。' },
      { title: '中场核心佩尼亚伤疑，马尔默组织进攻面临考验', source: '瑞典日报', time: '1天前', sentiment: 'negative', summary: '秘鲁国脚在训练中感到不适，能否出战周末联赛存疑。' },
      { title: '青训门将约翰·达林续约，马尔默门将位置无忧', source: '体育快讯', time: '2天前', sentiment: 'neutral', summary: '俱乐部与主力门将完成续约，稳定了后防基石。' },
    ],
  },
  {
    id: 'hammarby', name: '哈马比', en: 'Hammarby IF', short: 'HAM', color: '#1fa05a', color2: '#146b3c', league: '瑞超', coach: '金·赫尔伯格', stadium: '泰乐竞技场', city: '斯德哥尔摩', formation: '4-2-3-1',
    lineup: [
      ['瓦尔纳·哈恩', 1, pos.GK(50, 7)], ['维克托·埃里克松', 5, pos.RB(12, 24)], ['西蒙·桑德贝里', 4, pos.CB(38, 22)],
      ['马尔科·布兰科', 23, pos.CB(62, 22)], ['安东·库尔贝里', 3, pos.LB(88, 24)], ['科林·桑德贝里', 8, pos.DM(40, 38)],
      ['弗雷德里克·哈马德', 6, pos.DM(60, 38)], ['纳比尔·图雷', 10, pos.AM(50, 55)], ['威拉特·塔伊', 27, pos.RW(82, 66)],
      ['巴扎鲁·迪亚比', 9, pos.ST(50, 64)], ['埃里克·科恩', 11, pos.LW(18, 66)],
    ],
    news: [
      { title: '哈马比主场击败索尔纳，斯德哥尔摩德比笑到最后', source: '快报', time: '4小时前', sentiment: 'positive', summary: '泰乐竞技场3.5万球迷见证球队拿下关键三分，联赛排名升至第三。' },
      { title: '图雷状态火热：哈马比进攻核心本赛季两双在望', source: '瑞典晚报', time: '8小时前', sentiment: 'positive', summary: '瑞典国脚已贡献8球7助攻，是球队进攻端的绝对核心。' },
      { title: '哈马比防线连续三轮丢球，客场表现令人担忧', source: '瑞典日报', time: '1天前', sentiment: 'negative', summary: '球队在客场的防守强度明显下滑，教练组正着手调整。' },
      { title: '赫尔伯格确认冬季引援重点在中后卫', source: '体育快讯', time: '2天前', sentiment: 'neutral', summary: '主帅坦言防线深度不足，希望冬窗补强轮换中卫。' },
    ],
  },
  {
    id: 'bodoe', name: '博德闪耀', en: 'Bodø/Glimt', short: 'BOD', color: '#f7c948', color2: '#1a1a1a', league: '挪超', coach: '谢蒂尔·克努森', stadium: '阿斯普米拉球场', city: '博德', formation: '4-3-3',
    lineup: [
      ['尼基塔·海金', 1, pos.GK(50, 7)], ['布赖斯·温班戈莫', 3, pos.RB(12, 24)], ['奥丁·比亚尔塔利德', 4, pos.CB(38, 22)],
      ['弗雷德里克·比约坎', 26, pos.CB(62, 22)], ['布林德海姆', 5, pos.LB(88, 24)], ['乌尔里克·萨尔滕', 14, pos.DM(50, 38)],
      ['斯韦雷·尼尔森', 8, pos.CM(36, 50)], ['帕特里克·格罗内斯', 10, pos.CM(64, 50)], ['卡斯珀·霍格', 27, pos.RW(82, 68)],
      ['尼诺·祖格利', 9, pos.ST(50, 66)], ['安布罗斯·卡佩纳', 11, pos.LW(18, 68)],
    ],
    news: [
      { title: '博德闪耀人工草皮主场显神威，欧冠资格赛大胜晋级', source: '挪威晚邮报', time: '3小时前', sentiment: 'positive', summary: '球队在欧冠资格赛附加赛首回合取得大胜，距离正赛一步之遥。' },
      { title: '祖格利成挪威新星：闪耀前锋闪耀欧洲赛场', source: '体育杂志', time: '9小时前', sentiment: 'positive', summary: '22岁前锋本赛季各项赛事已打入18球，引起五大联赛关注。' },
      { title: '海金离队传闻再起，博德闪耀门将位置悬念', source: '每日新闻报', time: '1天前', sentiment: 'negative', summary: '主力门将可能登陆欧洲主流联赛，球队正寻找替代者。' },
      { title: '克努森：闪耀足球哲学不会改变', source: '挪威体育报', time: '2天前', sentiment: 'neutral', summary: '名帅强调高位逼抢与快速转换的战术DNA，不受对手影响。' },
    ],
  },
  {
    id: 'molde', name: '莫尔德', en: 'Molde FK', short: 'MOL', color: '#1e4e8c', color2: '#14355f', league: '挪超', coach: '埃尔林·莫埃', stadium: '阿克球场', city: '莫尔德', formation: '4-2-3-1',
    lineup: [
      ['雅各布·卡尔斯特伦', 1, pos.GK(50, 7)], ['马丁·林海姆', 2, pos.RB(12, 24)], ['马丁·比约尔巴克', 3, pos.CB(38, 22)],
      ['马库斯·安德烈亚森', 5, pos.CB(62, 22)], ['海于根', 17, pos.LB(88, 24)], ['埃米尔·布雷维克', 8, pos.DM(40, 38)],
      ['马格努斯·沃尔夫', 6, pos.DM(60, 38)], ['桑德贝里', 10, pos.AM(50, 55)], ['奥拉·布莱姆', 27, pos.RW(82, 66)],
      ['托马斯·诺萨', 9, pos.ST(50, 64)], ['伊曼纽尔·埃孔', 11, pos.LW(18, 66)],
    ],
    news: [
      { title: '莫尔德击败布兰，紧咬榜首博德闪耀', source: '挪威晚邮报', time: '5小时前', sentiment: 'positive', summary: '球队在争冠关键战中拿下胜利，与领头羊分差缩小到3分。' },
      { title: '诺萨状态回暖：莫尔德锋线王牌重新开火', source: '体育杂志', time: '9小时前', sentiment: 'positive', summary: '尼日利亚前锋近五场打入4球，摆脱了赛季中段的低迷。' },
      { title: '欧协联出局后专注联赛，莫尔德全力冲刺冠军', source: '每日新闻报', time: '1天前', sentiment: 'neutral', summary: '球队在欧战中提前出局，赛程压力得到缓解。' },
      { title: '门将卡尔斯特伦续约两年，莫尔德稳定后防', source: '挪威体育报', time: '2天前', sentiment: 'positive', summary: '主力门将的留守让球队防线保持稳定，球员本人表达忠诚。' },
    ],
  },
  {
    id: 'benfica', name: '本菲卡', en: 'Benfica', short: 'BEN', color: '#e30613', color2: '#1a1a1a', league: '葡超', coach: '布鲁诺·拉热', stadium: '光明球场', city: '里斯本', formation: '4-3-3',
    lineup: [
      ['特鲁宾', 1, pos.GK(50, 7)], ['亚历山大·巴', 17, pos.RB(12, 24)], ['奥塔门迪', 30, pos.CB(38, 22)],
      ['安东尼奥·席尔瓦', 4, pos.CB(62, 22)], ['阿尔瓦罗·费尔南德斯', 3, pos.LB(88, 24)], ['弗洛伦蒂诺', 61, pos.DM(50, 38)],
      ['科克丘', 10, pos.CM(36, 50)], ['雷纳托·桑谢斯', 8, pos.CM(64, 50)], ['阿克托', 27, pos.RW(82, 68)],
      ['帕夫利季斯', 9, pos.ST(50, 66)], ['布鲁马', 7, pos.LW(18, 68)],
    ],
    news: [
      { title: '本菲卡欧冠开门红，帕夫利季斯梅开二度闪耀光明球场', source: '纪录报', time: '2小时前', sentiment: 'positive', summary: '希腊前锋延续火热状态，球队主场大胜开启欧战征程。' },
      { title: '奥塔门迪续约一年：本菲卡后防核心选择留守', source: '球报', time: '6小时前', sentiment: 'positive', summary: '阿根廷老将以稳定表现继续统领防线，为年轻后卫树立榜样。' },
      { title: '雷纳托·桑谢斯伤病反复，中场创造力受限', source: '葡萄牙晨报', time: '1天前', sentiment: 'negative', summary: '葡萄牙中场再度因伤缺席，本菲卡的中场轮换面临考验。' },
      { title: '拉热确认阵容轮换策略，全力冲击葡超冠军', source: '足球报', time: '2天前', sentiment: 'neutral', summary: '主帅表示会在密集赛程中合理分配球员体能，保持竞争力。' },
    ],
  },
  {
    id: 'porto', name: '波尔图', en: 'Porto', short: 'POR', color: '#0a2e6f', color2: '#0a2048', league: '葡超', coach: '维托尔·布鲁诺', stadium: '巨龙球场', city: '波尔图', formation: '4-2-3-1',
    lineup: [
      ['迪奥戈·科斯塔', 99, pos.GK(50, 7)], ['若昂·马里奥', 23, pos.RB(12, 24)], ['佩佩', 3, pos.CB(38, 22)],
      ['泽·佩德罗', 5, pos.CB(62, 22)], ['温德尔', 18, pos.LB(88, 24)], ['阿兰·瓦雷拉', 22, pos.DM(40, 38)],
      ['安德烈·安德烈', 13, pos.DM(60, 38)], ['法比奥·维埃拉', 10, pos.AM(50, 55)], ['弗朗西斯科·孔塞桑', 11, pos.RW(82, 66)],
      ['奥莫罗迪翁', 9, pos.ST(50, 64)], ['加莱诺', 30, pos.LW(18, 66)],
    ],
    news: [
      { title: '波尔图国家德比击败本菲卡，奥莫罗迪翁制胜', source: '球报', time: '3小时前', sentiment: 'positive', summary: '西班牙前锋的进球帮助球队在巨龙球场拿下三分，积分追平榜首。' },
      { title: '迪奥戈·科斯塔再度入选葡萄牙国家队', source: '纪录报', time: '8小时前', sentiment: 'positive', summary: '波尔图门将凭借稳定表现巩固国门地位，成为防线定海神针。' },
      { title: '波尔图伤病名单再添新人：加莱诺肌肉拉伤', source: '葡萄牙晨报', time: '1天前', sentiment: 'negative', summary: '巴西边锋将缺席数周，球队边路进攻火力受损。' },
      { title: '布鲁诺谈欧战目标：力争小组头名出线', source: '足球报', time: '2天前', sentiment: 'neutral', summary: '主帅对球队抽签结果感到满意，目标是掌握出线主动权。' },
    ],
  },
  {
    id: 'sporting', name: '葡萄牙体育', en: 'Sporting CP', short: 'SPO', color: '#0b3d2e', color2: '#0a2d22', league: '葡超', coach: '鲁本·阿莫林', stadium: '阿尔瓦拉德球场', city: '里斯本', formation: '4-3-3',
    lineup: [
      ['弗兰科·以色列', 1, pos.GK(50, 7)], ['杰诺·卡塔莫', 4, pos.RB(12, 24)], ['贡萨洛·伊纳西奥', 25, pos.CB(38, 22)],
      ['爱德华多·夸雷斯马', 72, pos.CB(62, 22)], ['努诺·桑托斯', 26, pos.LB(88, 24)], ['莫滕·许尔曼德', 5, pos.DM(50, 38)],
      ['丹尼尔·布拉干萨', 23, pos.CM(36, 50)], ['佩德罗·贡萨尔维斯', 8, pos.CM(64, 50)], ['特林康', 17, pos.RW(82, 68)],
      ['维克托·久尔凯雷什', 9, pos.ST(50, 66)], ['帕乌利尼奥', 20, pos.LW(18, 68)],
    ],
    news: [
      { title: '久尔凯雷什领跑葡超射手榜，葡萄牙体育夺冠在望', source: '纪录报', time: '2小时前', sentiment: 'positive', summary: '瑞典前锋本赛季已打入20球，是球队冲击联赛冠军的最大功臣。' },
      { title: '葡萄牙体育欧战强势，特林康当选队内月最佳', source: '球报', time: '7小时前', sentiment: 'positive', summary: '前巴萨边锋在欧冠赛场连续贡献进球助攻，状态火爆。' },
      { title: '阿莫林去留成谜：多家豪门争抢葡萄牙体育少帅', source: '葡萄牙晨报', time: '1天前', sentiment: 'negative', summary: '教练组的出色表现引来英超豪门关注，球队可能面临换帅。' },
      { title: '青训中场夸雷斯马晋升主力，葡萄牙体育人才辈出', source: '足球报', time: '2天前', sentiment: 'neutral', summary: '19岁新星在近期比赛中获得稳定出场时间，表现可圈可点。' },
    ],
  },
  {
    id: 'leeds', name: '利兹联', en: 'Leeds United', short: 'LEE', color: '#ffcd00', color2: '#1a1a5e', league: '英冠', coach: '丹尼尔·法尔克', stadium: '埃兰路球场', city: '利兹', formation: '4-2-3-1',
    lineup: [
      ['卡尔·达洛', 1, pos.GK(50, 7)], ['杰登·博格尔', 2, pos.RB(12, 24)], ['帕斯卡尔·斯特鲁伊克', 21, pos.CB(38, 22)],
      ['乔·罗登', 6, pos.CB(62, 22)], ['朱尼尔·菲尔波', 3, pos.LB(88, 24)], ['乔·罗斯韦尔', 8, pos.DM(40, 38)],
      ['伊利亚·格鲁耶夫', 4, pos.DM(60, 38)], ['布伦登·阿伦森', 7, pos.AM(50, 55)], ['丹尼尔·詹姆斯', 20, pos.RW(82, 66)],
      ['乔尔·皮罗', 9, pos.ST(50, 64)], ['马诺·所罗门', 11, pos.LW(18, 66)],
    ],
    news: [
      { title: '利兹联客场大胜重返榜首，皮罗戴帽一雪前耻', source: '约克郡晚报', time: '3小时前', sentiment: 'positive', summary: '荷兰前锋的帽子戏法帮助球队在冲超关键战中确立优势。' },
      { title: '埃兰路球场氛围火爆，利兹主场成英冠魔鬼主场', source: '天空体育', time: '8小时前', sentiment: 'positive', summary: '主场场均上座近3.7万人，远超英冠平均水平，球迷热情高涨。' },
      { title: '利兹联冲超前景再生变数：财政公平法案限制引援', source: '每日邮报', time: '1天前', sentiment: 'negative', summary: '受财务规则约束，球队冬季窗口的补强计划可能大幅缩水。' },
      { title: '法尔克确认皮罗为锋线首选，续约谈判开启', source: '卫报', time: '2天前', sentiment: 'neutral', summary: '主帅明确前锋核心地位，俱乐部正与其商讨长期合同。' },
    ],
  },
  {
    id: 'burnley', name: '伯恩利', en: 'Burnley', short: 'BUR', color: '#6c1d45', color2: '#48a5d8', league: '英冠', coach: '斯科特·帕克', stadium: '特夫摩尔球场', city: '伯恩利', formation: '4-4-2',
    lineup: [
      ['詹姆斯·特拉福德', 1, pos.GK(50, 7)], ['康纳·罗伯茨', 14, pos.RB(12, 24)], ['乔丹·拜尔', 5, pos.CB(38, 22)],
      ['马克斯·埃斯特夫', 2, pos.CB(62, 22)], ['查理·泰勒', 3, pos.LB(88, 24)], ['雅各布·布伦·拉尔森', 17, pos.RM(88, 48)],
      ['乔什·库伦', 8, pos.CM(42, 46)], ['汉内斯·德尔克罗瓦', 16, pos.CM(58, 46)], ['卢卡·科莱奥绍', 19, pos.LM(12, 48)],
      ['泽基·阿姆杜尼', 23, pos.ST(40, 66)], ['福法纳', 10, pos.ST(60, 66)],
    ],
    news: [
      { title: '伯恩利强势领跑英冠，冲超主动权掌握在自己手中', source: '兰开夏晚报', time: '4小时前', sentiment: 'positive', summary: '球队在特夫摩尔球场继续高歌猛进，晋级形势一片大好。' },
      { title: '特拉福德再献神扑：伯恩利门将零封纪录领跑英冠', source: '天空体育', time: '9小时前', sentiment: 'positive', summary: '英格兰新星门将的出色发挥是球队防守端最可靠的一环。' },
      { title: '伯恩利客场疲软：冲超最大隐患浮现', source: '每日邮报', time: '1天前', sentiment: 'negative', summary: '球队客场战绩远逊主场，客场取分能力成为冲超隐患。' },
      { title: '帕克确认冬窗引援目标，伯恩利瞄准边路快马', source: '卫报', time: '2天前', sentiment: 'neutral', summary: '主帅表示将利用冬季窗口补强边路速度，提升反击效率。' },
    ],
  },
  {
    id: 'ajax', name: '阿贾克斯', en: 'Ajax', short: 'AJA', color: '#d2122e', color2: '#1a1a1a', league: '荷甲', coach: '弗朗切斯科·法里奥利', stadium: '约翰·克鲁伊夫球场', city: '阿姆斯特丹', formation: '4-3-3',
    lineup: [
      ['雷姆科·帕斯费尔', 1, pos.GK(50, 7)], ['德文·伦施', 2, pos.RB(12, 24)], ['约雷尔·哈托', 3, pos.CB(38, 22)],
      ['尤里安·苏塔洛', 4, pos.CB(62, 22)], ['约翰·巴西亚', 37, pos.LB(88, 24)], ['乔丹·亨德森', 6, pos.DM(50, 38)],
      ['肯尼思·泰勒', 8, pos.CM(36, 50)], ['基安·菲茨-吉姆', 11, pos.CM(64, 50)], ['史蒂文·贝赫伊斯', 18, pos.RW(82, 68)],
      ['布莱恩·布罗比', 9, pos.ST(50, 66)], ['克里斯蒂安·拉斯穆森', 28, pos.LW(18, 68)],
    ],
    news: [
      { title: '阿贾克斯大胜宿敌，布罗比梅开二度延续荷甲开局强势', source: '电讯报', time: '3小时前', sentiment: 'positive', summary: '荷兰中锋包办两球帮助球队主场大胜，争冠形势一片大好。' },
      { title: '亨德森续约谈判启动：阿贾克斯中场大脑有望留守', source: 'NOS体育', time: '8小时前', sentiment: 'positive', summary: '前利物浦队长在更衣室的领袖作用无可替代，俱乐部希望锁定其未来。' },
      { title: '阿贾克斯青训流失隐忧：多名新星收到海外报价', source: '荷兰足球国际', time: '1天前', sentiment: 'negative', summary: '多位年轻才俊被五大联赛球探盯上，管理层面临留人难题。' },
      { title: '法里奥利确认门将轮换策略，帕斯费尔仍是首选', source: '体育周报', time: '2天前', sentiment: 'neutral', summary: '主帅在门将位置做出明确表态，球队将按对手特点轮换。' },
    ],
  },
  {
    id: 'psv', name: '埃因霍温', en: 'PSV Eindhoven', short: 'PSV', color: '#e30613', color2: '#1a1a1a', league: '荷甲', coach: '彼得·博斯', stadium: '飞利浦球场', city: '埃因霍温', formation: '4-3-3',
    lineup: [
      ['沃尔特·贝尼特斯', 1, pos.GK(50, 7)], ['理查德·穆尼奥斯', 2, pos.RB(12, 24)], ['阿曼多·奥比斯波', 4, pos.CB(38, 22)],
      ['瑞安·弗拉明戈', 3, pos.CB(62, 22)], ['马特奥·丹斯', 17, pos.LB(88, 24)], ['约尔迪·希克斯', 8, pos.DM(50, 38)],
      ['耶尔迪·斯豪滕', 6, pos.CM(36, 50)], ['马利克·蒂尔曼', 10, pos.CM(64, 50)], ['约翰·巴卡约科', 11, pos.RW(82, 68)],
      ['卢克·德容', 9, pos.ST(50, 66)], ['诺阿·朗', 7, pos.LW(18, 68)],
    ],
    news: [
      { title: '埃因霍温欧冠连胜，蒂尔曼世界波当选周最佳进球', source: '埃因霍温日报', time: '2小时前', sentiment: 'positive', summary: '球队在欧冠赛场延续强势，中场新星成为绝对核心。' },
      { title: '卢克·德容宣布赛季末退役：埃因霍温锋线进入倒计时', source: '荷兰足球国际', time: '7小时前', sentiment: 'neutral', summary: '35岁老将确认最后一个赛季，球队已着手寻找接班人。' },
      { title: '巴卡约科续约至2029：比利时边锋长留飞利浦球场', source: 'NOS体育', time: '1天前', sentiment: 'positive', summary: '炙手可热的边路飞翼选择留守，击碎英超转会传闻。' },
      { title: '博斯战术再调整：埃因霍温改打三中卫试验成功', source: '电讯报', time: '2天前', sentiment: 'positive', summary: '荷兰教头在近期比赛中变阵收获奇效，攻守更加平衡。' },
    ],
  },
  {
    id: 'fey', name: '费耶诺德', en: 'Feyenoord', short: 'FEY', color: '#e01e29', color2: '#1a1a1a', league: '荷甲', coach: '布莱恩·普里斯克', stadium: '德库伊普球场', city: '鹿特丹', formation: '4-3-3',
    lineup: [
      ['蒂蒙·韦伦罗伊特', 1, pos.GK(50, 7)], ['卢卡什·罗特勒', 2, pos.RB(12, 24)], ['托马斯·汉科', 33, pos.CB(38, 22)],
      ['格里特·特劳纳', 18, pos.CB(62, 22)], ['奎林·哈特曼', 5, pos.LB(88, 24)], ['安东尼·米兰博', 17, pos.DM(50, 38)],
      ['金·廷贝尔', 8, pos.CM(36, 50)], ['卡尔文·斯特恩', 6, pos.CM(64, 50)], ['伊戈尔·派尚', 14, pos.RW(82, 68)],
      ['圣地亚哥·希门尼斯', 29, pos.ST(50, 66)], ['卢卡·伊万努舍奇', 10, pos.LW(18, 68)],
    ],
    news: [
      { title: '希门尼斯帽子戏法，费耶诺德德比战完胜埃因霍温', source: '鹿特丹公报', time: '3小时前', sentiment: 'positive', summary: '墨西哥前锋在德比中大开杀戒，射手榜上独占鳌头。' },
      { title: '费耶诺德天才中场廷贝尔获英超豪门关注', source: '电讯报', time: '9小时前', sentiment: 'neutral', summary: '荷兰小将的出色发挥引来多家俱乐部球探现场考察。' },
      { title: '德库伊普球场扩建计划获批，费耶诺德主场扩容在即', source: 'NOS体育', time: '1天前', sentiment: 'positive', summary: '俱乐部宣布将主场容量提升至65000人，球迷基础持续壮大。' },
      { title: '门将韦伦罗伊特伤愈复出，费耶诺德防线重归完整', source: '体育周报', time: '2天前', sentiment: 'positive', summary: '主力门将回归训练场，此前两轮的丢球问题有望缓解。' },
    ],
  },
  {
    id: 'twente', name: '特温特', en: 'FC Twente', short: 'TWE', color: '#d01427', color2: '#e8e8e8', league: '荷甲', coach: '约瑟夫·奥斯汀', stadium: '赫罗尔斯城堡球场', city: '恩斯赫德', formation: '4-2-3-1',
    lineup: [
      ['拉斯·翁内斯塔尔', 1, pos.GK(50, 7)], ['梅斯·范罗伊', 20, pos.RB(12, 24)], ['杰拉尔德·希尔赫斯', 3, pos.CB(38, 22)],
      ['马克斯·布伦斯', 38, pos.CB(62, 22)], ['巴特·范罗伊', 34, pos.LB(88, 24)], ['卡雷尔·艾廷', 8, pos.DM(40, 38)],
      ['尤里·雷赫', 14, pos.DM(60, 38)], ['米哈尔·萨迪莱克', 10, pos.AM(50, 55)], ['杜桑·塔迪奇', 11, pos.RW(82, 66)],
      ['里基·范沃尔夫斯文克尔', 9, pos.ST(50, 64)], ['萨姆·拉默斯', 7, pos.LW(18, 66)],
    ],
    news: [
      { title: '特温特主场逼平阿贾克斯，塔迪奇助攻老当益壮', source: '荷兰足球国际', time: '4小时前', sentiment: 'positive', summary: '36岁老将宝刀不老，球队在强强对话中拿到宝贵一分。' },
      { title: '特温特青训中场萨迪莱克当选月最佳新秀', source: 'NOS体育', time: '8小时前', sentiment: 'positive', summary: '19岁中场在近期的稳定表现获得联盟官方认可。' },
      { title: '财政受限：特温特冬窗引援计划或再度缩水', source: '电讯报', time: '1天前', sentiment: 'negative', summary: '俱乐部财政预算紧张，冬季补强可能以租借为主。' },
      { title: '奥斯汀：客场成绩是球队冲击欧战区的关键', source: '体育周报', time: '2天前', sentiment: 'neutral', summary: '主帅点出球队客战疲软的问题，将针对性加强客场部署。' },
    ],
  },
  {
    id: 'miami', name: '迈阿密国际', en: 'Inter Miami', short: 'MIA', color: '#f5a623', color2: '#1a1a1a', league: '美职联', coach: '哈维尔·马斯切拉诺', stadium: '大通体育场', city: '迈阿密', formation: '4-3-3',
    lineup: [
      ['德雷克·卡伦德', 1, pos.GK(50, 7)], ['德安德烈·耶德林', 2, pos.RB(12, 24)], ['托马斯·阿维莱斯', 6, pos.CB(38, 22)],
      ['诺亚·艾伦', 27, pos.CB(62, 22)], ['弗兰科·内格里', 18, pos.LB(88, 24)], ['塞尔希奥·布斯克茨', 5, pos.DM(50, 38)],
      ['费德里科·雷东多', 26, pos.CM(36, 50)], ['朱利安·格雷塞尔', 24, pos.CM(64, 50)], ['莱奥·梅西', 10, pos.RW(82, 68)],
      ['路易斯·苏亚雷斯', 9, pos.ST(50, 66)], ['迭戈·戈麦斯', 7, pos.LW(18, 68)],
    ],
    news: [
      { title: '梅西传射建功，迈阿密国际豪取五连胜领跑东部', source: '迈阿密先驱报', time: '2小时前', sentiment: 'positive', summary: '阿根廷球王延续火热状态，球队冲击常规赛冠军势头强劲。' },
      { title: '苏亚雷斯续约一年：迈阿密锋线双星继续联袂', source: 'ESPN', time: '6小时前', sentiment: 'positive', summary: '乌拉圭老将与俱乐部达成续约，与梅西的黄金搭档延续。' },
      { title: '迈阿密防线隐患：客场连续失球引教练组担忧', source: '美联社体育', time: '1天前', sentiment: 'negative', summary: '球队在客场的防守表现不稳定，冲冠之路需解决客场顽疾。' },
      { title: '马斯切拉诺确认轮换计划，保护梅西体能为先', source: '进球网', time: '2天前', sentiment: 'neutral', summary: '主帅表示会合理安排球王出场时间，确保季后赛状态。' },
    ],
  },
  {
    id: 'lafc', name: '洛杉矶FC', en: 'LAFC', short: 'LAF', color: '#0d1e36', color2: '#c8a45c', league: '美职联', coach: '史蒂夫·切伦多洛', stadium: 'BMO球场', city: '洛杉矶', formation: '4-3-3',
    lineup: [
      ['雨果·洛里斯', 1, pos.GK(50, 7)], ['塞尔希奥·帕伦西亚', 24, pos.RB(12, 24)], ['阿龙·朗', 33, pos.CB(38, 22)],
      ['赫苏斯·穆里略', 4, pos.CB(62, 22)], ['帕拉西奥斯', 12, pos.LB(88, 24)], ['马尔基·德尔加多', 20, pos.DM(50, 38)],
      ['蒂莫西·蒂尔曼', 8, pos.CM(36, 50)], ['埃杜阿德·阿图恩加', 19, pos.CM(64, 50)], ['丹尼斯·布安加', 99, pos.RW(82, 68)],
      ['奥利维耶·吉鲁', 14, pos.ST(50, 66)], ['内森·奥达', 11, pos.LW(18, 68)],
    ],
    news: [
      { title: '吉鲁梅开二度，洛杉矶FC德比战击退银河', source: '洛杉矶时报', time: '3小时前', sentiment: 'positive', summary: '法国传奇前锋在洛杉矶德比中闪耀，帮助球队巩固西部头名。' },
      { title: '洛里斯成定海神针：洛杉矶FC门将扑救率联盟第一', source: 'ESPN', time: '8小时前', sentiment: 'positive', summary: '前法国队长在美职联延续顶级状态，多次拯救球队于水火。' },
      { title: '洛杉矶FC客场战绩堪忧，冠军相打折扣', source: '美联社体育', time: '1天前', sentiment: 'negative', summary: '球队在客场的取分效率远低于主场，季后赛客场之旅成考验。' },
      { title: '切伦多洛确认战术重心：高压逼抢不会改变', source: '进球网', time: '2天前', sentiment: 'neutral', summary: '主帅表示球队的战术DNA不会因对手变化，坚持进攻足球。' },
    ],
  },
  {
    id: 'nyrb', name: '纽约红牛', en: 'New York Red Bulls', short: 'NYR', color: '#ee2737', color2: '#0d1e36', league: '美职联', coach: '桑德罗·施瓦茨', stadium: '红牛竞技场', city: '新泽西', formation: '4-2-3-1',
    lineup: [
      ['卡洛斯·科罗内尔', 1, pos.GK(50, 7)], ['迪伦·尼利斯', 2, pos.RB(12, 24)], ['安德烈斯·雷耶斯', 5, pos.CB(38, 22)],
      ['肖恩·尼利斯', 6, pos.CB(62, 22)], ['约翰·托尔金', 3, pos.LB(88, 24)], ['丹尼尔·埃德尔曼', 8, pos.DM(40, 38)],
      ['弗兰基·阿马亚', 14, pos.DM(60, 38)], ['埃米尔·福斯贝里', 10, pos.AM(50, 55)], ['刘易斯·摩根', 27, pos.RW(82, 66)],
      ['埃利亚斯·马诺埃尔', 9, pos.ST(50, 64)], ['科里·伯克', 11, pos.LW(18, 66)],
    ],
    news: [
      { title: '纽约红牛附加赛席位稳固，福斯贝里连场破门', source: '纽约邮报', time: '4小时前', sentiment: 'positive', summary: '瑞典球星延续出色状态，球队在东部排名持续攀升。' },
      { title: '红牛青训再出成果：马诺埃尔获月度最佳新秀', source: 'ESPN', time: '9小时前', sentiment: 'positive', summary: '19岁前锋的爆发让红牛锋线焕然一新，未来可期。' },
      { title: '纽约红牛伤病潮：尼利斯兄弟同时缺阵', source: '美联社体育', time: '1天前', sentiment: 'negative', summary: '两名主力后卫的伤缺让球队防线捉襟见肘，替补深度受考验。' },
      { title: '施瓦茨确认球队目标：稳固季后赛席位再图突破', source: '进球网', time: '2天前', sentiment: 'neutral', summary: '主帅对球队现状保持清醒，强调一步一个脚印。' },
    ],
  },
  {
    id: 'hilal', name: '利雅得新月', en: 'Al Hilal', short: 'HIL', color: '#1e5cc4', color2: '#f5c518', league: '沙特甲', coach: '豪尔赫·热苏斯', stadium: '法赫德国王国际体育场', city: '利雅得', formation: '4-3-3',
    lineup: [
      ['布努', 37, pos.GK(50, 7)], ['穆罕默德·阿卜杜勒哈米德', 66, pos.RB(12, 24)], ['库利巴利', 3, pos.CB(38, 22)],
      ['阿里·坦巴蒂', 87, pos.CB(62, 22)], ['雷南·洛迪', 6, pos.LB(88, 24)], ['鲁本·内维斯', 8, pos.DM(50, 38)],
      ['米林科维奇-萨维奇', 22, pos.CM(36, 50)], ['若昂·坎塞洛', 2, pos.CM(64, 50)], ['萨勒姆·多萨里', 29, pos.RW(82, 68)],
      ['米特罗维奇', 9, pos.ST(50, 66)], ['萨勒姆·阿卜杜勒哈米德', 10, pos.LW(18, 68)],
    ],
    news: [
      { title: '利雅得新月联赛豪取八连胜，米特罗维奇领跑射手榜', source: '利雅得体育报', time: '2小时前', sentiment: 'positive', summary: '塞尔维亚前锋延续火热状态，球队一骑绝尘领跑积分榜。' },
      { title: '内维斯当选月度最佳球员，利雅得新月中场核心获官方认可', source: '阿拉伯体育台', time: '7小时前', sentiment: 'positive', summary: '前狼队队长在沙特的发挥堪称完美，传球成功率冠绝联赛。' },
      { title: '坎塞洛伤病困扰：利雅得新月右路攻防受影响', source: '沙特足球杂志', time: '1天前', sentiment: 'negative', summary: '葡萄牙边后卫的肌肉问题令热苏斯不得不调整首发。' },
      { title: '热苏斯：沙特联赛竞争加剧，卫冕之路不容松懈', source: '半岛体育', time: '2天前', sentiment: 'neutral', summary: '主帅提醒球队警惕追赶者的威胁，专注每一场比赛。' },
    ],
  },
  {
    id: 'nassr', name: '利雅得胜利', en: 'Al Nassr', short: 'NAS', color: '#f9c60f', color2: '#1e4fa0', league: '沙特甲', coach: '斯特凡诺·皮奥利', stadium: '沙特国王大学体育场', city: '利雅得', formation: '4-3-3',
    lineup: [
      ['本托', 24, pos.GK(50, 7)], ['苏丹·加纳姆', 2, pos.RB(12, 24)], ['拉波尔特', 27, pos.CB(38, 22)],
      ['穆罕默德·西马坎', 3, pos.CB(62, 22)], ['阿莱士·特列斯', 25, pos.LB(88, 24)], ['布罗佐维奇', 77, pos.DM(50, 38)],
      ['奥塔维奥', 25, pos.CM(36, 50)], ['阿卜杜拉·纳吉', 14, pos.CM(64, 50)], ['萨迪奥·马内', 10, pos.RW(82, 68)],
      ['C罗', 7, pos.ST(50, 66)], ['塔利斯卡', 94, pos.LW(18, 68)],
    ],
    news: [
      { title: 'C罗点射绝杀，利雅得胜利德比战逆转利雅得新月', source: '利雅得体育报', time: '3小时前', sentiment: 'positive', summary: '葡萄牙巨星在补时阶段一锤定音，为球队赢得关键三分。' },
      { title: '马内状态复苏：塞内加尔飞翼连场破门', source: '阿拉伯体育台', time: '8小时前', sentiment: 'positive', summary: '前利物浦边锋在皮奥利体系下重获新生，进攻端极具威胁。' },
      { title: '利雅得胜利防线漏洞：西马坎失误遭媒体批评', source: '沙特足球杂志', time: '1天前', sentiment: 'negative', summary: '法国中卫近期状态起伏，球队防守端需要更加专注。' },
      { title: '皮奥利谈争冠：每一分都很关键，球队已做好准备', source: '半岛体育', time: '2天前', sentiment: 'neutral', summary: '意大利教头表示球队目标明确，将全力冲击联赛冠军。' },
    ],
  },
  {
    id: 'ittihad', name: '吉达联合', en: 'Al Ittihad', short: 'ITT', color: '#f4d64c', color2: '#0a0a0a', league: '沙特甲', coach: '洛朗·布兰克', stadium: '阿卜杜拉国王体育城', city: '吉达', formation: '4-2-3-1',
    lineup: [
      ['拉伊科维奇', 1, pos.GK(50, 7)], ['莱昂纳德·马丁斯', 12, pos.RB(12, 24)], ['哈桑·卡德什', 4, pos.CB(38, 22)],
      ['艾哈迈德·赫加齐', 26, pos.CB(62, 22)], ['穆特布·法希姆', 13, pos.LB(88, 24)], ['法比尼奥', 22, pos.DM(40, 38)],
      ['坎特', 7, pos.DM(60, 38)], ['侯赛因·奥亚尔', 10, pos.AM(50, 55)], ['穆萨·迪亚比', 16, pos.RW(82, 66)],
      ['卡里姆·本泽马', 9, pos.ST(50, 64)], ['菲拉杰·加姆迪', 11, pos.LW(18, 66)],
    ],
    news: [
      { title: '本泽马梅开二度，吉达联合击败吉达国民赢下德比', source: '吉达体育报', time: '4小时前', sentiment: 'positive', summary: '金球奖得主状态依旧神勇，吉达德比战中独中两元。' },
      { title: '坎特与法比尼奥双后腰稳固，吉达联合中场硬度提升', source: '阿拉伯体育台', time: '9小时前', sentiment: 'positive', summary: '两名英超老将的搭档让球队中场控制力显著增强。' },
      { title: '布兰克战术受质疑：吉达联合客战战绩不佳', source: '沙特足球杂志', time: '1天前', sentiment: 'negative', summary: '法国教头的客场保守策略引发球迷不满，球队客战持续低迷。' },
      { title: '吉达联合有意冬窗引进边锋，迪亚比伤病成变数', source: '半岛体育', time: '2天前', sentiment: 'neutral', summary: '俱乐部计划在冬窗补强边路，同时关注迪亚比的伤情进展。' },
    ],
  },
  {
    id: 'ahli', name: '吉达国民', en: 'Al Ahli', short: 'AHL', color: '#32a852', color2: '#e8e8e8', league: '沙特甲', coach: '马蒂亚斯·雅伊斯勒', stadium: '阿卜杜拉国王体育城', city: '吉达', formation: '4-3-3',
    lineup: [
      ['爱德华·门迪', 1, pos.GK(50, 7)], ['阿里·哈马达', 27, pos.RB(12, 24)], ['罗杰·伊巴涅斯', 5, pos.CB(38, 22)],
      ['梅里赫·德米拉尔', 28, pos.CB(62, 22)], ['亚西尔·加姆迪', 36, pos.LB(88, 24)], ['弗兰克·凯西', 79, pos.DM(50, 38)],
      ['加布里·维加', 8, pos.CM(36, 50)], ['穆罕默德·马杰拉西', 19, pos.CM(64, 50)], ['里亚德·马赫雷斯', 7, pos.RW(82, 68)],
      ['罗伯特·菲尔米诺', 20, pos.ST(50, 66)], ['阿兰·圣马克西曼', 10, pos.LW(18, 68)],
    ],
    news: [
      { title: '马赫雷斯两传一射，吉达国民客场大胜稳固前三', source: '吉达体育报', time: '2小时前', sentiment: 'positive', summary: '前曼城边锋延续统治级表现，是球队进攻端绝对核心。' },
      { title: '菲尔米诺找回状态：吉达国民锋线重获火力', source: '阿拉伯体育台', time: '6小时前', sentiment: 'positive', summary: '巴西前锋近期连续进球，摆脱了赛季初的低迷。' },
      { title: '德米拉尔伤停四周：吉达国民后防告急', source: '沙特足球杂志', time: '1天前', sentiment: 'negative', summary: '土耳其中卫的缺阵让球队防线深度受到严峻考验。' },
      { title: '雅伊斯勒：德比失利已成过去，专注下一轮联赛', source: '半岛体育', time: '2天前', sentiment: 'neutral', summary: '奥地利教头呼吁球队向前看，尽快走出德比失利的阴影。' },
    ],
  },
];

const LIGHT_POOLS = {
  '法甲': ['摩纳哥', '巴黎圣日耳曼'],
  '西甲': ['马德里竞技', '皇家马德里', '巴塞罗那'],
  '德甲': ['莱比锡红牛', '拜仁慕尼黑', '多特蒙德'],
  '韩K联赛': ['蔚山HD', '全北现代', '浦项制铁'],
  '日职联赛': ['神户胜利船', '横滨水手', '川崎前锋'],
  '巴西甲': ['弗拉门戈', '帕尔梅拉斯', '科林蒂安'],
  '墨西哥超': ['墨西哥美洲', '蒙特雷', '瓜达拉哈拉'],
  '哥伦比亚甲': ['百万富翁', '麦德林独立'],
  '瑞超': ['马尔默', '哈马比', '尤尔加登'],
  '挪超': ['博德闪耀', '莫尔德', '罗森博格'],
  '葡超': ['本菲卡', '波尔图', '葡萄牙体育'],
  '英冠': ['利兹联', '伯恩利', '桑德兰'],
  '美职联': ['迈阿密国际', '洛杉矶FC', '纽约红牛'],
  '荷甲': ['阿贾克斯', '埃因霍温', '费耶诺德', '特温特'],
  '沙特甲': ['利雅得新月', '利雅得胜利', '吉达联合', '吉达国民'],
};

const LIGHT_TEAMS = LIGHT_DEFS.map((def) => genLightTeam(def, LIGHT_POOLS[def.league] || []));

const teamMap = new Map([...TEAMS, ...LIGHT_TEAMS].map((t) => [t.id, t]));

/* 注入队标图片路径（crests.json 由队标下载脚本生成，缺失的球队回退为配色徽章） */
const fs = require('fs');
const path = require('path');
let CRESTS = {};
try {
  let raw = fs.readFileSync(path.join(__dirname, 'crests.json'), 'utf8');
  if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1); // 兼容 UTF-8 BOM
  CRESTS = JSON.parse(raw);
} catch (_) { /* 无队标映射，全部使用配色徽章 */ }
for (const t of teamMap.values()) {
  if (CRESTS[t.id]) t.crest = '/img/crests/' + CRESTS[t.id];
}

module.exports = { TEAMS, teamMap };
