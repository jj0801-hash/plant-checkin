// @AI_GENERATED
// M4 家长后台（第 1 部分）：令牌绑定、同步、待审核列表（通过 / 驳回 / 全部通过）。
// 其他页面通过 Admin.renderers 注册（见 admin_pages.js）。
(function () {
  'use strict';
  var h = UI.h, today = UI.todayStr, kv = UI.storage('plantcheckin_admin_v1:'), ERR = UI.ERR;
  var WD = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  var Admin = window.Admin = {
    bind: null, store: null, data: null, state: null, lastSync: null, busy: false, error: null, tab: 'pending', open: {}, msg: null,
    renderers: {}, labels: {}, kv: kv, WD: WD
  };
  var A = Admin;

  function recompute() {
    var d = A.data;
    if (!d || !d.config) { A.state = null; return; }
    A.state = Rules.computeState({ config: d.config, submissions: d.submissions, reviews: d.reviews, grades: d.grades, redeems: d.redeems,
      content: { extraPlants: [], zombies: [] }, today: today() });
  }
  A.refresh = async function (silent) {
    if (!A.store || A.busy) return;
    A.busy = true; if (!silent) A.render();
    try { A.data = await A.store.loadAll(today()); A.lastSync = new Date(); A.error = null; kv.set('cache', { data: A.data, at: A.lastSync.toISOString() }); }
    catch (e) { A.error = e; }
    A.busy = false; A.initialLoading = false; recompute(); A.render();
  };
  // 统一的“保存并刷新”：成功给出提示，失败显示明确原因
  A.act = async function (okMsg, fn) {
    if (A.busy) return false;
    A.busy = true; A.msg = null; A.render();
    var ok = false;
    try { await fn(); A.error = null; A.msg = { ok: true, text: okMsg }; ok = true; }
    catch (e) { A.msg = { ok: false, text: (e.kind && ERR[e.kind]) || e.message }; if (e.kind) A.error = e; }
    A.busy = false;
    await A.refresh(true);
    return ok;
  };
  A.dateLabel = function (d) { return d.slice(5).replace('-', '月') + '日 ' + WD[Dates.dow(d)]; };

  // ---------- 渲染框架 ----------
  A.render = function () {
    var view = document.getElementById('view'), banner = document.getElementById('banner'), tabs = document.getElementById('tabs');
    view.textContent = '';
    var navsub = document.getElementById('navsub'); if (navsub) navsub.textContent = '绑定';
    if (!A.bind) { banner.hidden = true; tabs.hidden = true; view.appendChild(renderSetup()); return; }
    // 已经用整页错误卡片展示时，不再重复显示顶部提示条；有数据时错误只是附带的，才用顶部条
    banner.hidden = (!A.error && !A.busy) || (A.error && !A.data);
    banner.className = 'banner' + (A.error ? ' err' : '');
    banner.textContent = A.error ? (ERR[A.error.kind] || A.error.message) : '处理中……';
    if (A.data && !A.data.config) A.tab = 'settings';   // 还没初始化：只能进设置页
    var keys = Object.keys(A.renderers);
    tabs.hidden = false; tabs.textContent = '';
    keys.forEach(function (k) {
      var label = typeof A.labels[k] === 'function' ? A.labels[k]() : A.labels[k];
      if (k === A.tab && navsub) navsub.textContent = label.text;
      tabs.appendChild(h('button', { 'data-tab': k, class: k === A.tab ? 'on' : '', 'aria-current': k === A.tab ? 'page' : null, onclick: function () { A.tab = k; A.msg = null; A.render(); } },
        h('span', { text: label.icon }), h('span', { class: 'lbl', text: label.text }), label.badge ? h('span', { class: 'cnt', 'aria-label': label.badge + ' 项待处理', text: String(label.badge) }) : null));
    });
    if (A.msg) view.appendChild(h('div', { class: 'note' + (A.msg.ok ? ' okmsg' : ''), id: 'msg', text: A.msg.text }));
    if (!A.data) {
      view.appendChild(A.error ? UI.errorState(ERR[A.error.kind] || A.error.message, function () { A.refresh(); }) : (A.busy || A.initialLoading ? UI.skeleton(3) : UI.emptyState('📭', '还没有数据', '点击下方标签或刷新试试')));
      UI.monoNumbers(view); return;
    }
    view.appendChild((A.renderers[A.tab] || A.renderers[keys[0]])());
    UI.monoNumbers(view); UI.monoNumbers(tabs);
  };

  // ---------- 绑定 ----------
  function renderSetup() {
    var q = new URLSearchParams(location.search), dev = /^(127\.0\.0\.1|localhost)$/.test(location.hostname) && q.get('dev') === '1';
    var f = { api: 'https://api.github.com', owner: '', repoKid: 'plant-checkin-data-kid', repoParent: 'plant-checkin-data-parent', parent: '' };
    if (dev) f = { api: 'http://127.0.0.1:8787', owner: 'demo-user', repoKid: f.repoKid, repoParent: f.repoParent, parent: 'mock-p' };
    var inputs = {}, box = h('div', { class: 'card' }), msg = h('div', { class: 'note', hidden: true });
    function field(label, key, secret) {
      inputs[key] = h('input', { type: secret ? 'password' : 'text', value: f[key], autocomplete: 'off', autocapitalize: 'off' });
      box.appendChild(h('label', { text: label })); box.appendChild(inputs[key]);
    }
    box.appendChild(h('h2', { text: '家长后台：绑定' }));
    field('GitHub 用户名', 'owner'); field('孩子数据仓库名', 'repoKid'); field('家长数据仓库名', 'repoParent'); field('家长令牌（P-token）', 'parent', true);
    if (dev) field('API 地址（仅本地调试）', 'api');
    box.appendChild(msg);
    box.appendChild(h('button', { class: 'btn', onclick: async function () {
      var b = {}; Object.keys(f).forEach(function (k) { b[k] = inputs[k] ? inputs[k].value.trim() : f[k]; });
      msg.hidden = false; msg.textContent = '检查中……';
      var st = A.makeStore(b), r = await st.verify();
      if (!r.ok) { msg.textContent = r.problems.join('；'); return; }
      A.bind = b; kv.set('bind', b); A.store = st; start();
    } }, '绑定并检查'));
    box.appendChild(h('p', { class: 'tiny', text: '令牌只保存在这台设备的浏览器里，请用你自己的手机。' }));
    return box;
  }
  A.makeStore = function (b) {
    return new Store.GithubStore({ api: b.api, owner: b.owner, repoKid: b.repoKid, repoParent: b.repoParent, role: 'parent', tokens: { parent: b.parent } });
  };

  // ---------- 待审核 ----------
  A.labels.pending = function () { var n = A.state ? AdminLogic.pendingList(A.state, A.data).length : 0; return { icon: '📝', text: '待审核', badge: n }; };
  A.renderers.pending = function () {
    var w = h('div'), list = A.state ? AdminLogic.pendingList(A.state, A.data) : [];
    w.appendChild(h('div', { class: 'row' }, h('h1', { text: '待审核' }), h('button', { class: 'btn sec mini', id: 'sync', onclick: function () { A.refresh(); } }, '刷新')));
    w.appendChild(h('p', { class: 'tiny', id: 'lastsync', text: '上次同步：' + (A.lastSync ? A.lastSync.toLocaleString() : '还没有') }));
    if (!list.length) { var es = UI.emptyState('✅', '没有待审核的打卡', '孩子提交后会出现在这里'); es.id = 'nopending'; w.appendChild(es); return w; }
    if (list.length > 1) {
      var clean = list.filter(function (x) { return !x.dateMismatch; });
      w.appendChild(h('button', { class: 'btn', id: 'approve-all', disabled: !clean.length || A.busy, onclick: function () { approveAll(clean); } },
        '全部通过（' + clean.length + ' 天' + (clean.length < list.length ? '，日期异常的除外' : '') + '）'));
    }
    var grid = h('div', { class: 'list' });
    list.forEach(function (it) { grid.appendChild(pendingCard(it)); });
    w.appendChild(grid);
    return w;
  };
  // 每张卡片里，没勾选的待审任务会被驳回。A.skip[date] = { 任务id: true } 记录被取消勾选的任务
  A.skip = {};
  function checkedIds(it) { var sk = A.skip[it.date] || {}; return it.done.map(function (t) { return t.id; }).filter(function (id) { return !sk[id]; }); }
  function skippedIds(it) { var sk = A.skip[it.date] || {}; return it.done.map(function (t) { return t.id; }).filter(function (id) { return sk[id]; }); }
  function pendingCard(it) {
    var c = h('div', { class: 'card pend', 'data-date': it.date });
    c.appendChild(h('div', { class: 'row' }, h('h2', { text: A.dateLabel(it.date) }),
      h('span', { class: 'badge b-wait', text: it.resubmitted ? '重新提交' : (it.approved.length ? '追加提交' : '待确认') })));
    var doneCount = it.done.length + it.approved.length;
    c.appendChild(h('p', { class: 'tiny', text: '提交时间：' + (it.clientSubmittedAt ? it.clientSubmittedAt.replace('T', ' ').slice(0, 19) : '未知') + '　完成 ' + doneCount + ' / ' + it.expected + ' 项' +
      (it.approved.length ? '（其中 ' + it.approved.length + ' 项之前已通过）' : '') }));
    if (it.dateMismatch) c.appendChild(h('div', { class: 'note', text: '⚠️ 提交时间与所属日期对不上，请确认是不是孩子改过手机时间。' }));
    // 已通过的任务：只读
    it.approved.forEach(function (t) { c.appendChild(h('div', { class: 'chk done', text: '✓ ' + t.name + '（已通过）' })); });
    // 待审任务：多于一项时可以逐项取消勾选；只有一项时保持原来的样子
    var many = it.done.length > 1, sk = A.skip[it.date] || {};
    it.done.forEach(function (t) {
      if (!many) { c.appendChild(h('div', { class: 'chk', text: '✓ ' + t.name })); return; }
      var cb = h('input', { type: 'checkbox', 'data-task': t.id });
      cb.checked = !sk[t.id];
      cb.addEventListener('change', function () { A.skip[it.date] = Object.assign({}, A.skip[it.date] || {}); A.skip[it.date][t.id] = !cb.checked; A.render(); });
      c.appendChild(h('label', { class: 'chk pick' }, cb, h('span', { text: ' ' + t.name })));
    });
    var mode = A.open[it.date];            // true / 'reject'：驳回全部；'partial'：通过所选、驳回其余
    var okIds = checkedIds(it), noIds = skippedIds(it);
    if (mode === 'partial') {
      var tb = h('input', { type: 'text', placeholder: '没勾选的 ' + noIds.length + ' 项会被驳回，写给孩子的话（必填）', id: 'note-' + it.date });
      c.appendChild(tb);
      c.appendChild(h('div', { class: 'row2' },
        h('button', { class: 'btn ok', 'data-confirm-partial': it.date, onclick: function () { review(it, 'approved', tb.value, okIds, noIds); } }, '确认：通过 ' + okIds.length + ' 项，驳回 ' + noIds.length + ' 项'),
        h('button', { class: 'btn sec', onclick: function () { A.open[it.date] = false; A.render(); } }, '取消')));
    } else if (mode) {
      var ta = h('input', { type: 'text', placeholder: '写给孩子的话（必填），例如：字迹要工整', id: 'note-' + it.date });
      c.appendChild(ta);
      c.appendChild(h('div', { class: 'row2' },
        h('button', { class: 'btn danger', onclick: function () { review(it, 'rejected', ta.value, [], it.done.map(function (t) { return t.id; })); } }, '确认驳回'),
        h('button', { class: 'btn sec', onclick: function () { A.open[it.date] = false; A.render(); } }, '取消')));
    } else {
      var label = noIds.length ? '通过所选（' + okIds.length + ' 项）' : '通过';
      c.appendChild(h('div', { class: 'row2' },
        h('button', { class: 'btn ok', 'data-act': 'approve', disabled: A.busy || !okIds.length, onclick: function () {
          if (noIds.length) { A.open[it.date] = 'partial'; A.render(); } else review(it, 'approved', '', okIds, []);
        } }, label),
        h('button', { class: 'btn sec', 'data-act': 'reject', onclick: function () { A.open[it.date] = 'reject'; A.render(); } }, '驳回')));
    }
    return c;
  }
  function reviewFor(it, result, note, approve, reject) {
    return AdminLogic.makeReview(result, { now: UI.isoLocal(true), note: note, prev: A.data.reviews[it.date], tasks: it.snapshot, approve: approve, reject: reject });
  }
  async function review(it, result, note, approve, reject) {
    var rec;
    try { rec = reviewFor(it, result, note, approve, reject); } catch (e) { A.msg = { ok: false, text: e.message }; A.render(); return; }
    var text = result === 'rejected' ? ' 已驳回，孩子会看到你写的话' : reject.length ? ' 已通过 ' + approve.length + ' 项，驳回 ' + reject.length + ' 项' : ' 已通过';
    await A.act(A.dateLabel(it.date) + text, function () { return A.store.saveReview(it.date, rec); });
    A.open[it.date] = false; delete A.skip[it.date];
  }
  async function approveAll(items) {
    await A.act('已通过 ' + items.length + ' 天', async function () {
      for (var i = 0; i < items.length; i++) await A.store.saveReview(items[i].date, reviewFor(items[i], 'approved', '', items[i].done.map(function (t) { return t.id; }), []));
    });
  }

  // ---------- 启动 ----------
  function start() {
    var cache = kv.get('cache');
    if (cache && cache.data) { A.data = cache.data; A.lastSync = new Date(cache.at); recompute(); }
    // 没有缓存时先标记“加载中”再渲染，否则会在首次加载的几秒里闪出误导性的“还没有数据”
    if (!A.data) A.initialLoading = true;
    A.render(); A.refresh(true);
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && A.store && (!A.lastSync || Date.now() - A.lastSync.getTime() > 20000)) A.refresh(true);
  });
  document.addEventListener('DOMContentLoaded', function () {
    A.bind = kv.get('bind');
    if (A.bind) { A.store = A.makeStore(A.bind); start(); } else A.render();
  });
}());
// @AI_GENERATED: end
