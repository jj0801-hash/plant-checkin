// @AI_GENERATED
// M3 孩子端：令牌绑定、今日关卡、勾选与提交、同步状态、离线缓存。
// 安全：所有数据渲染使用 textContent / setAttribute，不使用 innerHTML。
(function () {
  'use strict';
  var LS = 'plantcheckin_v1:';
  var BUILTIN = ['core-autumn', 'core-spring', 'zombies-basic'];
  var S = { renderers: {}, bind: null, store: null, data: null, state: null, content: null, tab: 'today', lastSync: null,
            busy: false, error: null, popup: null, verify: null };

  // ---------- 小工具（来自 ui.js）----------
  var h = UI.h, todayStr = UI.todayStr, isoLocal = function () { return UI.isoLocal(false); };
  var kv = UI.storage(LS), lsGet = kv.get, lsSet = kv.set, lsDel = kv.del, ERR = UI.ERR;

  // ---------- 内容包 ----------
  async function loadContent() {
    var plants = {}, zombies = [], prices = {};
    for (var i = 0; i < BUILTIN.length; i++) {
      try {
        var r = await fetch('packs/' + BUILTIN[i] + '/pack.json'); if (!r.ok) continue;
        var p = await r.json();
        p.characters.forEach(function (c) {
          var art = 'packs/' + p.id + '/' + c.art;
          var info = { id: c.id, name: c.name, art: art, rarity: c.rarity, description: c.description || '' };
          if (c.kind === 'plant') {
            info.stats = c.stats || null; info.price = typeof c.price === 'number' ? c.price : null;
            if (info.price !== null) prices[c.id] = info.price;
            plants[c.id] = info;
          }
          else zombies.push(Object.assign(info, { subject: c.subject, unlockStars: c.unlockStars, boss: !!c.boss }));
        });
      } catch (e) { /* 内容包缺失时界面用占位 */ }
    }
    S.content = { plants: plants, zombies: zombies, prices: prices };
  }

  // ---------- 数据与状态 ----------
  function makeStore(b) {
    return new Store.GithubStore({ api: b.api, owner: b.owner, repoKid: b.repoKid, repoParent: b.repoParent, role: 'kid',
                                   tokens: { kidWrite: b.kidWrite, kidRead: b.kidRead } });
  }
  function recompute() {
    var d = S.data; if (!d || !d.config) { S.state = null; return; }
    S.state = Rules.computeState({ config: d.config, submissions: d.submissions, reviews: d.reviews, grades: d.grades, redeems: d.redeems,
      content: { extraPlants: [], zombies: S.content.zombies, prices: S.content.prices }, today: todayStr() });
  }
  async function refresh(silent) {
    if (!S.store || S.busy) return;
    S.busy = true; if (!silent) render();
    try {
      S.data = await S.store.loadAll(todayStr());
      S.lastSync = new Date(); S.error = null;
      lsSet('cache', { data: S.data, at: S.lastSync.toISOString() });
    } catch (e) { S.error = e; }
    S.busy = false; recompute(); render();
  }
  function todayTasks() { return Rules.tasksOnDate(S.data.config, todayStr()); }
  function pickZombie() {
    var ok = S.content.zombies.filter(function (z) { return !z.boss && S.state.zombies.indexOf(z.id) >= 0; });
    if (!ok.length) return null;
    var n = Dates.diffDays(todayStr(), '2020-01-01');
    return ok[n % ok.length];
  }

  // ---------- 渲染 ----------
  var NAV_TITLE = { today: '今日', dex: '图鉴', cal: '日历', shop: '商店', me: '我的' };
  function render() {
    var view = document.getElementById('view'), banner = document.getElementById('banner'), tabs = document.getElementById('tabs');
    view.textContent = '';
    var navsub = document.getElementById('navsub');
    if (navsub) navsub.textContent = S.bind ? (NAV_TITLE[S.tab] || '') : '绑定';
    if (!S.bind) { banner.hidden = true; tabs.hidden = true; view.appendChild(renderSetup()); return; }
    tabs.hidden = false;
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.className = b.getAttribute('data-tab') === S.tab ? 'on' : ''; });
    banner.hidden = !S.error && !S.busy;
    banner.className = 'banner' + (S.error ? ' err' : '');
    banner.textContent = S.error ? (ERR[S.error.kind] || S.error.message) : '同步中……';
    view.appendChild((S.renderers[S.tab] || renderToday)());
    if (S.popup) { document.body.appendChild(S.popup); S.popup = null; }
  }

  function meter(label, value, text, cls) {
    var bar = h('div', { class: 'bar ' + (cls || '') }), i = h('i');
    i.style.width = Math.max(0, Math.min(100, value * 100)) + '%'; bar.appendChild(i);
    return h('div', { class: 'meter' }, h('div', { class: 'lbl' }, h('span', { text: label }), h('span', { text: text })), bar);
  }

  function renderToday() {
    var wrap = h('div');
    if (!S.data) return h('div', { class: 'empty', text: S.busy ? '加载中……' : '还没有数据，点“我的”里的“立即同步”' });
    if (!S.data.config) return h('div', { class: 'card empty', text: '家长还没有完成初始化，请先在家长端设置学期和任务。' });
    var st = S.state, cfg = S.data.config, today = todayStr();
    if (!st || !st.started) {
      return h('div', { class: 'card empty', text: '奖励从 ' + cfg.semester.rewardStart + ' 开始，到时候再来打卡吧！' });
    }
    var p = st.progress, nick = (cfg.profile && cfg.profile.nickname) || '小朋友';
    wrap.appendChild(h('div', { class: 'top' }, h('div', { class: 'hi', text: nick + '，今天也加油！' }), h('div', { class: 'sun', text: '☀️ ' + st.sun.balance })));

    var card = h('div', { class: 'card' });
    var semEnd = cfg.semester.end, semRatio = semEnd ? (Dates.diffDays(today, cfg.semester.rewardStart) + 1) / (Dates.diffDays(semEnd, cfg.semester.rewardStart) + 1) : 0;
    card.appendChild(meter('学期', semRatio, '第 ' + p.currentWeekNo + ' 周' + (p.daysToEnd === null ? '' : '，还有 ' + p.daysToEnd + ' 天结束'), 'g'));
    var exp = Math.max(p.plantsExpected, 1);
    card.appendChild(meter('植物收集', Math.min(1, p.plantsUnlocked / exp), p.plantsUnlocked + ' / ' + p.plantsExpected +
      (p.plantsAhead > 0 ? '（领先 ' + p.plantsAhead + '）' : p.plantsAhead < 0 ? '（落后 ' + (-p.plantsAhead) + '）' : '')));
    // 打卡里程碑：每累计通关 N 天，按顺序多解锁一株植物（不透露是哪一株）
    var du = p.dailyUnlock;
    if (du && du.toNext !== null) { var dm = meter('打卡解锁下一株', (du.every - du.toNext) / du.every, '再通关 ' + du.toNext + ' 天', 'g'); dm.id = 'dailymeter'; card.appendChild(dm); }
    if (p.thisWeek) card.appendChild(meter('本周通关', p.thisWeek.requiredDays ? p.thisWeek.passedDays / p.thisWeek.requiredDays : 1, p.thisWeek.passedDays + ' / ' + p.thisWeek.requiredDays + ' 天', 'g'));
    wrap.appendChild(card);

    // 本周植物 + 今日僵尸
    var wk = st.weeks[st.weeks.length - 1], plant = wk && wk.plantId && S.content.plants[wk.plantId], z = pickZombie();
    var stage = h('div', { class: 'card stage' });
    // 未解锁的植物不请求原图，用打码占位图，避免提前看到奖励长什么样
    var plantOpen = !!(plant && st.plants[wk.plantId]);
    if (plant) stage.appendChild(h('img', { src: plantOpen ? plant.art : 'icons/mystery-plant.svg', alt: plantOpen ? plant.name : '未解锁的植物' }));
    stage.appendChild(h('div', { class: 't' }, h('b', { text: '本周植物：' + (plant ? (plantOpen ? plant.name : '？？？') : '（待定）') }),
      h('small', { text: plantOpen && st.plants[wk.plantId].source === 'daily' ? '已通过打卡解锁！三科都拿“优”还能升级成金色版' :
                         wk && wk.status === '进行中' ? '周末家长录入成绩后，看看能不能解锁！' : '等待家长录入成绩' })));
    if (z) stage.appendChild(h('img', { src: z.art, alt: z.name }));
    wrap.appendChild(stage);

    // 今日任务：每项任务有自己的状态（已通过 / 待家长确认 / 被驳回 / 还没做），可以只提交做完的几项
    var day = st.days[today] || { status: 'none', approvedTasks: [], pendingTasks: [], rejectedTasks: [], sun: 0 }, tasks = todayTasks(), status = day.status;
    var review = S.data.reviews[today], R = Object.assign({}, Rules.DEFAULT_REWARDS, cfg.rewards || {});
    var ap = day.approvedTasks, pend = day.pendingTasks, free = tickedFree(day);
    var tc = h('div', { class: 'card' });
    var apCount = tasks.filter(function (t) { return ap.indexOf(t.id) >= 0; }).length;
    var badge = { cleared: ['b-ok', '今日已通关 🎉'], pending: ['b-wait', '等待家长确认'], partial: ['b-ok', '已通过 ' + apCount + ' / ' + tasks.length + ' 项'],
                  rejected: ['b-bad', '家长让你再改改'], in_progress: ['b-gray', '进行中'],
                  revoked: ['b-bad', '这天的通关被撤销了'], exempt: ['b-gray', '今天免打卡'], none: ['b-gray', '今天没有任务'], missed: ['b-gray', '未完成'] }[status] || ['b-gray', ''];
    tc.appendChild(h('div', { class: 'row' }, h('h2', { text: '今日任务' }), h('span', { class: 'badge ' + badge[0], text: badge[1] })));
    tc.appendChild(h('p', { class: 'tiny', text: '每完成一项、经家长通过就得 ' + R.taskSun + ' 阳光，不用等全部做完。' }));
    if (review && review.note && (status === 'rejected' || day.rejectedTasks.length || (status === 'partial' && review.rejectedTasks && review.rejectedTasks.length))) tc.appendChild(h('div', { class: 'note', text: '家长说：' + review.note }));
    if (!tasks.length) tc.appendChild(h('div', { class: 'empty', text: '今天不用打卡，好好休息 😊' }));
    tasks.forEach(function (t) {
      var isAp = ap.indexOf(t.id) >= 0, isPend = pend.indexOf(t.id) >= 0, isRej = !isAp && !isPend && (day.rejectedTasks.indexOf(t.id) >= 0 || status === 'rejected' && lastDone().indexOf(t.id) >= 0);
      var on = isAp || isPend || free.indexOf(t.id) >= 0;
      var tag = isAp ? h('span', { class: 'tag ok', text: '+' + R.taskSun + ' ☀️' }) : isPend ? h('span', { class: 'tag wait', text: '待确认' }) : isRej ? h('span', { class: 'tag bad', text: '被驳回' }) : null;
      tc.appendChild(h('button', { class: 'task' + (on ? ' done' : '') + (isAp ? ' approved' : '') + (isPend ? ' pending' : '') + (isRej ? ' rejected' : ''), disabled: isAp || isPend, 'data-task': t.id, onclick: function () { toggle(t.id); } },
        h('span', { class: 'ico', text: t.icon || '📘' }), h('span', { class: 'nm', text: t.name }), tag, h('span', { class: 'box', text: on ? '✓' : '' })));
    });
    if (tasks.length) {
      var fresh2 = tasks.filter(function (t) { return free.indexOf(t.id) >= 0 && ap.indexOf(t.id) < 0 && pend.indexOf(t.id) < 0; });
      var coverAll = tasks.every(function (t) { return ap.indexOf(t.id) >= 0 || pend.indexOf(t.id) >= 0 || free.indexOf(t.id) >= 0; });
      var label = status === 'cleared' ? '今日已通关' : fresh2.length ? (coverAll ? '提交通关！' : '提交已完成的 ' + fresh2.length + ' 项') : pend.length ? '已提交，等家长确认' : '先勾选做完的任务';
      tc.appendChild(h('button', { class: 'btn', id: 'submit', disabled: !fresh2.length || S.busy, onclick: submit }, label));
    }
    wrap.appendChild(tc);

    // 打卡解锁了新植物：这台设备上还没庆祝过的，弹一次（补审以前的日子也能弹到）
    var fresh = Object.keys(st.plants).filter(function (id) { return st.plants[id].source === 'daily' && !lsGet('seen-daily:' + id) && S.content.plants[id]; })
      .sort(function (a, b) { return st.plants[b].milestone - st.plants[a].milestone; });
    fresh.forEach(function (id) { lsSet('seen-daily:' + id, 1); });
    var newest = fresh.length ? S.content.plants[fresh[0]] : null;
    // 家长通过了新的任务：每多通过一项就庆祝一次（记录已庆祝的项数，刷新不会重复）
    var seenN = Number(lsGet('cel2:' + today)) || 0;
    if (ap.length > seenN) {
      lsSet('cel2:' + today, ap.length);
      var gain = (ap.length - seenN) * R.taskSun + (status === 'cleared' ? R.daily : 0);
      var sunText = '获得 ' + gain + ' 阳光 ☀️';
      var allDone = status === 'cleared';
      S.popup = newest ? popup((allDone ? '今日通关！' : '家长通过了 ' + (ap.length - seenN) + ' 项！') + '解锁新植物', sunText + '\n并解锁了「' + newest.name + '」' + (fresh.length > 1 ? '等 ' + fresh.length + ' 株' : '') + '！', newest.art)
                       : popup(allDone ? '今日通关！' : '家长通过了 ' + (ap.length - seenN) + ' 项！', sunText, z && z.art);
    } else if (newest) {
      S.popup = popup('解锁新植物！', '累计通关 ' + st.plants[fresh[0]].milestone + ' 天，解锁了「' + newest.name + '」' + (fresh.length > 1 ? '等 ' + fresh.length + ' 株' : '') + '！', newest.art);
    }
    return wrap;
  }

  function popup(title, text, img) {
    var box = h('div', { class: 'box' }, img ? h('img', { src: img, alt: '' }) : null, h('h2', { text: title }), h('p', { text: text }),
      h('button', { class: 'btn', onclick: function () { var p = document.querySelector('.pop'); if (p) p.remove(); } }, '好的'));
    return h('div', { class: 'pop' }, box);
  }

  // 最近一次提交的任务（累计）。被驳回的任务会沿用这份勾选，方便直接重新提交
  function lastDone() { var sub = S.data.submissions[todayStr()]; return sub && sub.done ? sub.done : []; }
  // 还没被家长通过、也不在等待确认的任务里，孩子当前勾选了哪些：有草稿用草稿。
  // 整天被驳回时，沿用上次提交的勾选，方便直接重新提交；只有个别任务被驳回时，那几项默认不勾，重做后再勾。
  function tickedFree(day) {
    var draft = lsGet('draft:' + todayStr());
    if (draft) return draft;
    if (day.status !== 'rejected') return [];
    return lastDone().filter(function (id) { return day.approvedTasks.indexOf(id) < 0 && day.pendingTasks.indexOf(id) < 0; });
  }
  function toggle(id) {
    var day = S.state.days[todayStr()], cur = tickedFree(day).slice();
    var i = cur.indexOf(id); if (i >= 0) cur.splice(i, 1); else cur.push(id);
    lsSet('draft:' + todayStr(), cur); render();
  }
  async function submit() {
    var today = todayStr(), day = S.state.days[today], tasks = todayTasks(), free = tickedFree(day);
    // 提交的是累计清单：已通过的 + 等待确认的 + 这次新勾选的（按任务顺序）
    var done = tasks.map(function (t) { return t.id; }).filter(function (id) { return day.approvedTasks.indexOf(id) >= 0 || day.pendingTasks.indexOf(id) >= 0 || free.indexOf(id) >= 0; });
    var partial = done.length < tasks.length;
    S.busy = true; render();
    try {
      var rv = S.data.reviews[today];
      await S.store.saveSubmission(today, { done: done, clientDate: today, clientSubmittedAt: isoLocal(), ackReviewedAt: rv ? rv.reviewedAt : null });
      lsDel('draft:' + today); S.error = null;
      S.popup = popup('提交成功', partial ? '等家长确认后就发阳光，剩下的做完再来提交！' : '等家长确认后就算通关啦！', null);
    } catch (e) { S.error = e; }
    S.busy = false; await refresh(true);
  }

  // ---------- 绑定与设置 ----------
  function renderSetup() {
    var q = new URLSearchParams(location.search), dev = /^(127\.0\.0\.1|localhost)$/.test(location.hostname) && q.get('dev') === '1';
    var f = { api: 'https://api.github.com', owner: '', repoKid: 'plant-checkin-data-kid', repoParent: 'plant-checkin-data-parent', kidWrite: '', kidRead: '' };
    if (dev) f = { api: 'http://127.0.0.1:8787', owner: 'demo-user', repoKid: f.repoKid, repoParent: f.repoParent, kidWrite: 'mock-kw', kidRead: 'mock-kr' };
    var inputs = {}, box = h('div', { class: 'card' }), msg = h('div', { class: 'note', hidden: true });
    function field(label, key, secret) {
      inputs[key] = h('input', { type: secret ? 'password' : 'text', value: f[key], autocomplete: 'off', autocapitalize: 'off' });
      box.appendChild(h('label', { text: label })); box.appendChild(inputs[key]);
    }
    box.appendChild(h('h2', { text: '第一次使用：请家长帮忙绑定' }));
    field('GitHub 用户名', 'owner'); field('孩子数据仓库名', 'repoKid'); field('家长数据仓库名', 'repoParent');
    field('孩子写令牌（K-write）', 'kidWrite', true); field('孩子读令牌（K-read）', 'kidRead', true);
    if (dev) field('API 地址（仅本地调试）', 'api');
    box.appendChild(msg);
    box.appendChild(h('button', { class: 'btn', onclick: async function () {
      var b = {}; Object.keys(f).forEach(function (k) { b[k] = inputs[k] ? inputs[k].value.trim() : f[k]; });
      msg.hidden = false; msg.textContent = '检查中……';
      var r = await makeStore(b).verify();
      if (!r.ok) { msg.textContent = r.problems.join('；'); return; }
      S.bind = b; lsSet('bind', b); S.store = makeStore(b); await startSession();
    } }, '绑定并检查'));
    box.appendChild(h('p', { class: 'tiny', text: '令牌只保存在这台设备的浏览器里。' }));
    return box;
  }
  function renderMe() {
    var w = h('div'), c = h('div', { class: 'card' });
    c.appendChild(h('h2', { text: '我的' }));
    c.appendChild(h('p', { text: '数据仓库：' + S.bind.owner + ' / ' + S.bind.repoKid }));
    c.appendChild(h('p', { class: 'tiny', id: 'lastsync', text: '上次同步：' + (S.lastSync ? S.lastSync.toLocaleString() : '还没有') }));
    c.appendChild(h('button', { class: 'btn sec', id: 'sync', onclick: function () { refresh(); } }, '立即同步'));
    c.appendChild(h('button', { class: 'btn sec', id: 'unbind', onclick: function () {
      if (!confirm('解除绑定后需要家长重新输入令牌，确定吗？')) return;
      lsDel('bind'); lsDel('cache'); S.bind = null; S.store = null; S.data = null; S.state = null; S.tab = 'today'; render();
    } }, '解除绑定'));
    w.appendChild(c); return w;
  }

  async function startSession() {
    if (!S.content) await loadContent();
    var cache = lsGet('cache');
    if (cache && cache.data) { S.data = cache.data; S.lastSync = new Date(cache.at); recompute(); }
    render(); await refresh(true);
  }
  function init() {
    document.getElementById('tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; S.tab = b.getAttribute('data-tab'); render();
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && S.store && (!S.lastSync || Date.now() - S.lastSync.getTime() > 30000)) refresh(true);
    });
    S.bind = lsGet('bind');
    if (S.bind) { S.store = makeStore(S.bind); startSession(); } else { loadContent().then(render); }
  }
  S.renderers.today = renderToday; S.renderers.me = renderMe;
  S.render = render; S.todayStr = todayStr; S.refresh = refresh; S.isoLocal = isoLocal;
  window.__app = S;                  // 便于调试和测试，也是各页面脚本的注册入口
  document.addEventListener('DOMContentLoaded', init);
}());
// @AI_GENERATED: end
