// @AI_GENERATED
// M5 孩子端：图鉴（植物、僵尸）与打卡日历。依赖 app.js 先加载并暴露 window.__app。
(function () {
  'use strict';
  var S = window.__app, h = UI.h, D = Dates;
  var SUBJ = { chinese: '语文', math: '数学', english: '英语' };
  var RARITY = { common: '普通', rare: '稀有', epic: '史诗', legend: '传说' };
  var SRC = { weekly: '', replant: '（补种）', early: '（提前解锁）', daily: '（打卡）', shop: '（商店）' };
  S.dexTab = 'plant'; S.month = null; S.selDay = null;
  // 未解锁角色一律使用统一的打码占位图，不请求原图，所以浏览器里也看不到原图
  var MYSTERY = { plant: 'icons/mystery-plant.svg', zombie: 'icons/mystery-zombie.svg' };
  var MASK_NAME = '？？？';   // 未解锁角色的名字、简介、稀有度一律不显示，避免提前泄漏

  function ready() { return S.data && S.data.config && S.state && S.state.started && S.content; }
  function notReady() { return h('div', { class: 'card empty', text: S.data && S.data.config ? '奖励还没有开始。' : '还没有数据，请先同步。' }); }

  function closePop() { var p = document.querySelector('.pop'); if (p) p.remove(); }
  function showDetail(info, lines, locked, actions, kind) {
    var img = h('img', { src: locked ? MYSTERY[kind] : info.art, alt: locked ? '未解锁' : info.name });
    // 已解锁的角色：用动画舞台代替静态大图（植物攻击普通僵尸，僵尸展示自己的技能）；未解锁的保持问号，不播放任何动画
    var anim = null;
    if (!locked && window.Anim) {
      var foeZ = (S.content.zombies || []).filter(function (z) { return z.id === 'zombie_normal'; })[0];   // 普通僵尸是默认拥有的，不会泄露任何未解锁内容
      anim = Anim.stage(kind, info.id, { hero: info.art, foe: foeZ ? foeZ.art : null });
    }
    var box = h('div', { class: 'box', id: 'detail' }, anim ? anim.el : img, h('h2', { text: locked ? MASK_NAME : info.name }),
      h('p', { class: 'tiny', text: locked ? '未解锁' : (RARITY[info.rarity] || '') + '　已解锁' }), locked ? null : h('p', { text: info.description || '' }));
    if (!locked && info.stats) {
      box.appendChild(h('div', { class: 'stats', id: 'stats' }, bar('攻击', info.stats.attack), bar('血量', info.stats.hp)));
      if (info.stats.skill) box.appendChild(h('p', { class: 'skill', text: '特长：' + info.stats.skill }));
    }
    lines.forEach(function (l) { box.appendChild(h('p', { class: 'tiny', text: l })); });
    (actions || []).forEach(function (a) {
      box.appendChild(a.note ? h('p', { class: 'note', text: a.note }) : h('button', { class: 'btn ok', id: a.id, disabled: a.disabled, onclick: a.onclick }, a.label));
    });
    if (anim && !anim.still) box.insertBefore(h('button', { class: 'btn sec mini', id: 'replay', onclick: anim.replay }, '▶ 再来一次'), box.querySelector('h2'));
    box.appendChild(h('button', { class: 'btn sec', id: 'closedetail', onclick: closePop }, '好的'));
    document.body.appendChild(h('div', { class: 'pop', onclick: function (e) { if (e.target.className === 'pop') closePop(); } }, box));
    if (anim) requestAnimationFrame(function () { requestAnimationFrame(anim.replay); });          // 等弹窗画出来再开始播放
  }

  // ================= 图鉴 =================
  S.renderers.dex = function () {
    if (!ready()) return notReady();
    var w = h('div'), sub = h('div', { class: 'seg' });
    [['plant', '🌱 植物'], ['zombie', '🧟 僵尸']].forEach(function (x) {
      sub.appendChild(h('button', { class: x[0] === S.dexTab ? 'on' : '', 'data-dex': x[0], onclick: function () { S.dexTab = x[0]; S.render(); } }, x[1]));
    });
    w.appendChild(sub);
    w.appendChild(S.dexTab === 'plant' ? plantDex() : zombieDex());
    return w;
  };

  function plantStatus(week, unlocked, wk, requested) {
    if (requested && !unlocked) return { text: '已申请，等家长确认', cls: 'pend' };
    if (unlocked) return { text: unlocked.gold ? '金色版 ✨' : '已解锁' + (SRC[unlocked.source] || ''), cls: 'got' };
    if (!wk) return { text: '第 ' + week + ' 周', cls: '' };
    if (wk.plantPending) return { text: wk.plantPending, cls: 'pend' };
    if (wk.status === '待录入成绩') return { text: '等待结算', cls: 'pend' };
    return { text: '本周进行中', cls: '' };
  }
  // ---- 阳光商店：用阳光申请解锁植物（家长在后台同意后生效）----
  function buysOf(plantId) { return (S.data.redeems || []).filter(function (r) { return r.kind === 'buy' && r.plantId === plantId; }); }
  async function sendBuy(plantId, btn) {
    if (btn) btn.disabled = true;
    try {
      await S.store.requestRedeem({ id: 'b-' + plantId + '-' + Date.now().toString(36), kind: 'buy', plantId: plantId, requestedAt: S.isoLocal() });
      S.error = null; await S.refresh(true);
      document.body.appendChild(h('div', { class: 'pop', id: 'redeemsent', onclick: function (e) { if (e.target.className === 'pop') closePop(); } },
        h('div', { class: 'box' }, h('h2', { text: '已发给家长' }), h('p', { text: '家长同意后，植物就是你的啦！' }), h('button', { class: 'btn', onclick: closePop }, '好的'))));
    } catch (e) { S.error = e; S.render(); }
  }
  function bar(label, value) {
    var b = h('div', { class: 'bar' }), i = h('i'); i.style.width = Math.max(0, Math.min(100, value)) + '%'; b.appendChild(i);
    return h('div', { class: 'stat' }, h('span', { class: 'sl', text: label }), b, h('b', { class: 'sv', text: String(value) }));
  }
  S.renderers.shop = function () {
    if (!ready()) return notReady();
    var st = S.state, cfg = S.data.config, w = h('div');
    var sched = (cfg.schedule || []).filter(function (x) { return S.content.plants[x.plantId] && !st.plants[x.plantId]; });
    w.appendChild(h('div', { class: 'row' }, h('h1', { text: '阳光商店' }), h('span', { class: 'sun', id: 'shopbalance', text: '☀️ ' + st.sun.balance })));
    w.appendChild(h('p', { class: 'tiny', text: '用阳光买下你想要的植物，家长同意后就是你的。买到之前，不知道它是哪一株哦！越厉害的植物越贵。' }));
    var list = sched.map(function (x) { var p = S.content.plants[x.plantId]; return { id: x.plantId, week: x.week, price: p.price, stats: p.stats }; })
      .filter(function (x) { return x.price !== null; })
      .sort(function (a, b) { return a.price - b.price || a.week - b.week; });
    if (!list.length) { w.appendChild(h('div', { class: 'card empty', id: 'shopempty', text: st.progress.poolLeft === 0 ? '植物都收集齐啦！' : '现在没有可以买的植物。' })); return w; }
    var grid = h('div', { class: 'shop' });
    list.forEach(function (x) {
      var reqs = buysOf(x.id), open = reqs.filter(function (r) { return r.status === 'requested'; })[0], rej = reqs.filter(function (r) { return r.status === 'rejected'; }).pop();
      var enough = st.sun.balance >= x.price;
      var card = h('div', { class: 'card item', 'data-buy': x.id });
      card.appendChild(h('img', { src: MYSTERY.plant, alt: '未解锁' }));
      var info = h('div', { class: 'info' }, h('div', { class: 'nm', text: MASK_NAME }));
      if (x.stats) { info.appendChild(bar('攻击', x.stats.attack)); info.appendChild(bar('血量', x.stats.hp)); }
      info.appendChild(h('div', { class: 'price', text: '☀️ ' + x.price }));
      if (rej && !open) info.appendChild(h('div', { class: 'note', text: '上次家长没有同意' + (rej.note ? '：' + rej.note : '') }));
      var btn = open ? h('button', { class: 'btn sec', disabled: true }, '已申请，等家长确认')
        : h('button', { class: 'btn ok', disabled: !enough, 'data-buybtn': x.id, onclick: function (e) { sendBuy(x.id, e.currentTarget); } }, enough ? '申请解锁' : '还差 ' + (x.price - st.sun.balance) + ' ☀️');
      info.appendChild(btn); card.appendChild(info); grid.appendChild(card);
    });
    w.appendChild(grid);
    return w;
  };

  function plantDex() {
    var st = S.state, cfg = S.data.config, sched = (cfg.schedule || []).slice().sort(function (a, b) { return a.week - b.week; });
    var got = sched.filter(function (x) { return st.plants[x.plantId]; }).length;
    var w = h('div');
    w.appendChild(h('p', { class: 'tiny', id: 'dexcount', text: '已收集 ' + got + ' / ' + sched.length + ' 株（成绩、打卡或商店解锁）' }));
    var grid = h('div', { class: 'dex' });
    sched.forEach(function (x) {
      var p = S.content.plants[x.plantId]; if (!p) return;
      var un = st.plants[x.plantId], wk = st.weeks.filter(function (k) { return k.weekNo === x.week; })[0], reqs = buysOf(x.plantId), s = plantStatus(x.week, un, wk, reqs.some(function (r) { return r.status === 'requested'; }));
      var cell = h('button', { class: 'cell ' + (un ? 'unlocked' : 'locked'), 'data-plant': x.plantId, onclick: function () {
        var lines = ['第 ' + x.week + ' 周的奖励'];
        if (un) lines.push(un.gold ? '三科都达标，获得金色版！' : un.source === 'daily' ? '累计通关 ' + un.milestone + ' 天时解锁！' : '在第 ' + un.week + ' 周解锁' + (SRC[un.source] || ''));
        else if (wk && wk.plantPending === '待补种') lines.push('这一周没有科目达标，不过可以去商店用阳光把它买下来。');
        else lines.push('这周任意一科拿到“优”及以上就能解锁，也可以去商店用阳光买。');
        var du = st.progress && st.progress.dailyUnlock;
        if (!un && du && du.toNext !== null) lines.push('另外，累计通关每满 ' + du.every + ' 天，也会按顺序解锁一株（再通关 ' + du.toNext + ' 天）。');
        var goShop = un ? [] : [{ id: 'goshop', label: '去商店看看', onclick: function () { closePop(); S.tab = 'shop'; S.render(); } }];
        showDetail(p, lines, !un, goShop, 'plant');
      } }, h('img', { src: un ? p.art : MYSTERY.plant, alt: un ? p.name : '未解锁' }), h('span', { class: 'nm', text: un ? p.name : MASK_NAME }), h('span', { class: 'st ' + s.cls, text: s.text }));
      grid.appendChild(cell);
    });
    w.appendChild(grid);
    return w;
  }

  function zombieDex() {
    var st = S.state, zs = S.content.zombies, w = h('div');
    function zcell(z, tip) {
      var un = st.zombies.indexOf(z.id) >= 0;
      return h('button', { class: 'cell ' + (un ? 'unlocked' : 'locked'), 'data-zombie': z.id, onclick: function () {
        showDetail(z, [un ? '已解锁！' : tip], !un, [], 'zombie');
      } }, h('img', { src: un ? z.art : MYSTERY.zombie, alt: un ? z.name : '未解锁' }), h('span', { class: 'nm', text: un ? z.name : MASK_NAME }), h('span', { class: 'st ' + (un ? 'got' : ''), text: un ? '已解锁' : tip }));
    }
    var base = zs.filter(function (z) { return !z.subject && !z.boss; });
    var boss = zs.filter(function (z) { return z.boss; });
    var got = zs.filter(function (z) { return st.zombies.indexOf(z.id) >= 0; }).length;
    w.appendChild(h('p', { class: 'tiny', id: 'dexcount', text: '已收集 ' + got + ' / ' + zs.length + ' 只。每科拿到“优”及以上就得 1 颗星，星多了解锁新僵尸。' }));
    if (base.length) { var g0 = h('div', { class: 'dex' }); base.forEach(function (z) { g0.appendChild(zcell(z, '一开始就有')); }); w.appendChild(g0); }
    ['chinese', 'math', 'english'].forEach(function (sub) {
      var line = zs.filter(function (z) { return z.subject === sub; }).sort(function (a, b) { return a.unlockStars - b.unlockStars; });
      if (!line.length) return;
      var n = st.stars[sub] || 0, sec = h('div', { class: 'card' });
      sec.appendChild(h('div', { class: 'row' }, h('h2', { text: SUBJ[sub] + '线' }), h('span', { class: 'badge b-wait', 'data-stars': sub, text: '⭐ ' + n })));
      var grid = h('div', { class: 'dex' });
      line.forEach(function (z) { grid.appendChild(zcell(z, '再得 ' + Math.max(0, z.unlockStars - n) + ' 颗' + SUBJ[sub] + '星')); });
      sec.appendChild(grid); w.appendChild(sec);
    });
    if (boss.length) {
      var t = st.trophy, sec2 = h('div', { class: 'card' }), g2 = h('div', { class: 'dex' });
      sec2.appendChild(h('h2', { text: '终极首领' }));
      boss.forEach(function (z) { g2.appendChild(zcell(z, '学期结束拿到奖杯后解锁')); });
      sec2.appendChild(g2);
      sec2.appendChild(h('p', { class: 'tiny', text: '目前星数 ' + t.stars + ' / ' + t.maxStars + (t.projectedTier ? '，照这样下去会得到' + ({ gold: '金', silver: '银', bronze: '铜' }[t.projectedTier]) + '奖杯' : '') }));
      w.appendChild(sec2);
    }
    return w;
  }

  // ================= 日历 =================
  var STATUS = { cleared: '已通关', partial: '部分完成', pending: '待确认', rejected: '被驳回', revoked: '已撤销', missed: '缺卡', exempt: '免打卡', in_progress: '进行中', none: '' };
  function prevMonth(m) { var y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1; if (mo < 1) { mo = 12; y--; } return y + '-' + UI.pad(mo); }
  function nextMonth(m) { var y = +m.slice(0, 4), mo = +m.slice(5, 7) + 1; if (mo > 12) { mo = 1; y++; } return y + '-' + UI.pad(mo); }

  S.renderers.cal = function () {
    if (!ready()) return notReady();
    var st = S.state, cfg = S.data.config, now = S.todayStr(), w = h('div');
    var minM = cfg.semester.rewardStart.slice(0, 7), maxM = (cfg.semester.end && cfg.semester.end < now ? cfg.semester.end : now).slice(0, 7);
    S.month = S.month || maxM;
    var first = S.month + '-01', last = D.addDays(nextMonth(S.month) + '-01', -1), lead = D.dow(first) - 1;
    var inMonth = Object.keys(st.days).filter(function (d) { return d.slice(0, 7) === S.month; });
    var cleared = inMonth.filter(function (d) { return st.days[d].status === 'cleared'; }).length;
    w.appendChild(h('div', { class: 'row' },
      h('button', { class: 'btn sec mini', id: 'prev', disabled: S.month <= minM, onclick: function () { S.month = prevMonth(S.month); S.selDay = null; S.render(); } }, '◀'),
      h('h2', { id: 'monthlabel', text: S.month.replace('-', ' 年 ') + ' 月' }),
      h('button', { class: 'btn sec mini', id: 'next', disabled: S.month >= maxM, onclick: function () { S.month = nextMonth(S.month); S.selDay = null; S.render(); } }, '▶')));
    w.appendChild(h('p', { class: 'tiny', id: 'calsummary', text: '这个月通关了 ' + cleared + ' 天 🎉' }));
    var cal = h('div', { class: 'cal card' });
    ['一', '二', '三', '四', '五', '六', '日'].forEach(function (x) { cal.appendChild(h('div', { class: 'tiny', text: x })); });
    for (var i = 0; i < lead; i++) cal.appendChild(h('div'));
    D.range(first, last).forEach(function (d) {
      var day = st.days[d], has = day && day.status !== 'none';
      cal.appendChild(h('button', { class: 'd' + (day ? ' ' + day.status : '') + (S.selDay === d ? ' sel' : ''), 'data-day': d, disabled: !day,
        onclick: function () { S.selDay = d; S.render(); } }, h('b', { text: String(+d.slice(8)) }), has ? STATUS[day.status] || '' : ''));
    });
    w.appendChild(cal);
    var leg = h('div', { class: 'legend tiny' });
    [['cleared', '已通关'], ['partial', '部分完成'], ['pending', '待确认'], ['rejected', '被驳回'], ['missed', '缺卡'], ['exempt', '免打卡']].forEach(function (x) { leg.appendChild(h('span', { class: 'lg ' + x[0], text: x[1] })); });
    w.appendChild(leg);
    if (S.selDay && st.days[S.selDay]) w.appendChild(dayDetail(S.selDay));
    return w;
  };
  function dayDetail(d) {
    var st = S.state, cfg = S.data.config, day = st.days[d], sub = S.data.submissions[d], rv = S.data.reviews[d], c = h('div', { class: 'card', id: 'daydetail' });
    c.appendChild(h('div', { class: 'row' }, h('h2', { text: d.slice(5).replace('-', '月') + '日' }), h('span', { class: 'badge b-gray', text: STATUS[day.status] || '无任务' })));
    var names = {}; (cfg.tasks || []).forEach(function (t) { names[t.id] = t.name; });
    (rv && rv.taskSnapshot || []).forEach(function (t) { names[t.id] = t.name; });
    var sunEach = (cfg.rewards && cfg.rewards.taskSun !== undefined ? cfg.rewards.taskSun : Rules.DEFAULT_REWARDS.taskSun);
    function line(id, mark, text, cls) { c.appendChild(h('div', { class: 'chk' + (cls ? ' ' + cls : ''), text: mark + ' ' + (names[id] || id) + text })); }
    day.approvedTasks.forEach(function (id) { line(id, '✓', sunEach ? '　+' + sunEach + ' ☀️' : ''); });
    day.pendingTasks.forEach(function (id) { line(id, '⏳', '　等家长确认', 'wait'); });
    day.rejectedTasks.forEach(function (id) { line(id, '✗', '　被驳回，可以重做', 'bad'); });
    var shown = day.approvedTasks.length + day.pendingTasks.length + day.rejectedTasks.length;
    if (day.sun) c.appendChild(h('p', { class: 'tiny', text: '这天共得到 ' + day.sun + ' 阳光' }));
    if (!shown && day.status !== 'exempt') c.appendChild(h('p', { class: 'tiny', text: day.status === 'missed' ? '这天没有打卡。' : '没有记录。' }));
    if (rv && rv.note && (day.status === 'rejected' || day.status === 'revoked' || rv.result === 'makeup')) c.appendChild(h('div', { class: 'note', text: '家长说：' + rv.note }));
    if (rv && rv.result === 'makeup') c.appendChild(h('p', { class: 'tiny', text: '这天是家长帮你补的卡。' }));
    return c;
  }
}());
// @AI_GENERATED: end
