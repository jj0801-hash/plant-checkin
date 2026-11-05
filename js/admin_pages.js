// @AI_GENERATED
// M4 家长后台（第 2 部分）：周成绩录入、日历（补卡 / 撤销 / 免打卡）。依赖 admin.js 先加载。
(function () {
  'use strict';
  var A = window.Admin, h = UI.h, D = Dates;
  var SUBJ = { chinese: '语文', math: '数学', english: '英语' };
  var DEFAULT_SCALE = Rules.DEFAULT_SCALE;
  var names = {};   // 植物 id → 名称，用于结算预览
  var prices = {};  // 植物 id → 阳光价格，用于商店购买的审批试算
  A.names = names; A.prices = prices;
  (async function loadNames() {
    for (var id of ['core-autumn', 'core-spring']) {
      try { var r = await fetch('packs/' + id + '/pack.json'); if (r.ok) (await r.json()).characters.forEach(function (c) { names[c.id] = c.name; if (c.kind === 'plant' && typeof c.price === 'number') prices[c.id] = c.price; }); } catch (e) { /* 没有名称就显示 id */ }
    }
  }());
  function sem() { return A.data.config.semester; }
  function subjects() { return A.data.config.subjects || ['chinese', 'math', 'english']; }

  // ================= 周成绩 =================
  A.labels.grades = function () {
    var n = A.state ? A.state.weeks.filter(function (w) { return w.status === '待录入成绩'; }).length : 0;
    return { icon: '🏅', text: '周成绩', badge: n };
  };
  A.renderers.grades = function () {
    var w = h('div'), st = A.state;
    w.appendChild(h('h1', { text: '周成绩' }));
    w.appendChild(h('p', { class: 'tiny', text: '每科填一个等级（来自老师的作业批改和课后学习情况）。周日结束后才会结算奖励，录错了可以随时改。' }));
    if (!st || !st.started) { w.appendChild(h('div', { class: 'card empty', text: '奖励还没有开始。' })); return w; }
    var grid = h('div', { class: 'list' });
    st.weeks.slice().reverse().forEach(function (wk) { grid.appendChild(weekCard(wk)); });
    w.appendChild(grid);
    return w;
  };
  function weekCard(wk) {
    var scale = sem().gradeScale || DEFAULT_SCALE, g = A.data.grades[wk.key] || {}, sels = {};
    var badge = { '进行中': 'b-gray', '待录入成绩': 'b-wait', '已结算': 'b-ok' }[wk.status];
    var c = h('div', { class: 'card wk', 'data-week': wk.key });
    c.appendChild(h('div', { class: 'row' }, h('h2', { text: '第 ' + wk.weekNo + ' 周　' + wk.start.slice(5) + ' ～ ' + wk.end.slice(5) }), h('span', { class: 'badge ' + badge, text: wk.status })));
    c.appendChild(h('p', { class: 'tiny', text: wk.key + '　通关 ' + wk.passedDays + ' / ' + wk.requiredDays + ' 天' }));
    var grid = h('div', { class: 'grid2' });
    subjects().forEach(function (s) {
      var sel = h('select', { id: 'g-' + wk.key + '-' + s }, h('option', { value: '', text: '未录入' }));
      scale.forEach(function (x) { sel.appendChild(h('option', { value: x, text: x })); });
      sel.value = g[s] || ''; sels[s] = sel;
      grid.appendChild(h('div', {}, h('label', { text: SUBJ[s] || s }), sel));
    });
    c.appendChild(grid);
    c.appendChild(h('button', { class: 'btn ok', 'data-save': wk.key, disabled: A.busy, onclick: function () { saveGrades(wk, sels); } }, '保存成绩'));
    var res = resultLine(wk);
    if (res) c.appendChild(h('div', { class: 'note okmsg', text: res }));
    return c;
  }
  function resultLine(wk) {
    if (wk.status === '进行中' && !wk.gradesEntered) return '';
    var parts = subjects().map(function (s) { var x = wk.subjects[s]; return (SUBJ[s] || s) + ' ' + (x.grade || '未录入') + (x.pass ? ' ⭐' : ''); });
    var plant = wk.plantId ? (names[wk.plantId] || wk.plantId) : '无（超出排期）';
    var tail;
    if (wk.status === '进行中') tail = '本周还没结束，周日之后才结算。';
    else if (wk.status === '待录入成绩') tail = '成绩没填满，还不能结算。';
    else if (wk.plantPending === '待追回') tail = '打卡完成率没达到通过线，奖励待追回。';
    else if (wk.plantUnlocked && A.state && (A.state.plants[wk.plantId] || {}).source === 'daily') tail = plant + ' 已通过打卡解锁（本周没有科目达标，不需要补种）。';
    else if (wk.plantUnlocked) tail = '解锁 ' + plant + (wk.plantGold ? '（金色版）' : '') + '，获得 ' + wk.starsEarned + ' 颗星。';
    else if (wk.bonusSun) tail = '超出排期，额外 +' + wk.bonusSun + ' 阳光。';
    else tail = plant + ' 待补种（本周没有科目达标）。';
    return parts.join('　') + '\n' + tail;
  }
  async function saveGrades(wk, sels) {
    var vals = {}; Object.keys(sels).forEach(function (s) { vals[s] = sels[s].value; });
    var out;
    try { out = AdminLogic.validateGrades(subjects(), vals); }
    catch (e) { A.msg = { ok: false, text: e.message.replace(/chinese|math|english/g, function (x) { return SUBJ[x]; }) }; A.render(); return; }
    await A.act('第 ' + wk.weekNo + ' 周成绩已保存', function () { return A.store.saveGrades(wk.key, out); });
  }

  // ================= 日历 =================
  var STATUS_TXT = { cleared: '已通关', partial: '部分完成', pending: '待确认', rejected: '已驳回', revoked: '已撤销', missed: '缺卡', exempt: '免打卡', in_progress: '进行中', none: '无任务' };
  A.month = null; A.sel = null;
  A.labels.calendar = { icon: '📅', text: '日历' };
  A.renderers.calendar = function () {
    var w = h('div'), st = A.state;
    w.appendChild(h('h1', { text: '日历' }));
    if (!st || !st.started) { w.appendChild(h('div', { class: 'card empty', text: '奖励还没有开始。' })); return w; }
    var start = sem().rewardStart, now = UI.todayStr();
    A.month = A.month || now.slice(0, 7);
    var minM = start.slice(0, 7), maxM = (sem().end && sem().end < now ? sem().end : now).slice(0, 7);
    var first = A.month + '-01', lead = D.dow(first) - 1, last = D.addDays(nextMonth(A.month) + '-01', -1);
    w.appendChild(h('div', { class: 'row' },
      h('button', { class: 'btn sec mini', id: 'prev', disabled: A.month <= minM, onclick: function () { A.month = prevMonth(A.month); A.sel = null; A.render(); } }, '◀'),
      h('h2', { id: 'monthlabel', text: A.month.replace('-', ' 年 ') + ' 月' }),
      h('button', { class: 'btn sec mini', id: 'next', disabled: A.month >= maxM, onclick: function () { A.month = nextMonth(A.month); A.sel = null; A.render(); } }, '▶')));
    var cal = h('div', { class: 'cal card' });
    ['一', '二', '三', '四', '五', '六', '日'].forEach(function (x) { cal.appendChild(h('div', { class: 'tiny', text: x })); });
    for (var i = 0; i < lead; i++) cal.appendChild(h('div'));
    D.range(first, last).forEach(function (d) {
      var day = st.days[d], cls = 'd' + (day ? ' ' + day.status : '') + (A.sel === d ? ' sel' : '');
      cal.appendChild(h('button', { class: cls, 'data-day': d, disabled: !day, onclick: function () { A.sel = d; A.render(); } },
        h('b', { text: String(+d.slice(8)) }), day ? (STATUS_TXT[day.status] || '') : ''));
    });
    w.appendChild(cal);
    if (A.sel && st.days[A.sel]) w.appendChild(dayPanel(A.sel));
    else w.appendChild(h('p', { class: 'tiny', text: '点一天可以补卡、撤销或设为免打卡。' }));
    return w;
  };
  function prevMonth(m) { var y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1; if (mo < 1) { mo = 12; y--; } return y + '-' + UI.pad(mo); }
  function nextMonth(m) { var y = +m.slice(0, 4), mo = +m.slice(5, 7) + 1; if (mo > 12) { mo = 1; y++; } return y + '-' + UI.pad(mo); }

  function dayPanel(d) {
    var day = A.state.days[d], sub = A.data.submissions[d], rv = A.data.reviews[d], c = h('div', { class: 'card', id: 'daypanel' });
    c.appendChild(h('h2', { text: A.dateLabel(d) + '　' + (STATUS_TXT[day.status] || '') }));
    if (sub) c.appendChild(h('p', { class: 'tiny', text: '孩子提交：' + String(sub.clientSubmittedAt || '').replace('T', ' ').slice(0, 19) + '，完成 ' + (sub.done || []).length + ' 项' }));
    if (rv) c.appendChild(h('p', { class: 'tiny', text: '审核：' + rv.result + (rv.note ? '（' + rv.note + '）' : '') }));
    var reason = h('input', { type: 'text', id: 'reason', placeholder: '补卡或撤销必须写原因，例如：忘记提交，家长看过作业' });
    c.appendChild(reason);
    var row = h('div', { class: 'row2' });
    if (day.status !== 'cleared') row.appendChild(h('button', { class: 'btn ok', id: 'makeup', disabled: A.busy || d > UI.todayStr(), onclick: function () { markDay(d, 'makeup', reason.value); } }, '补卡（算作已通关）'));
    if (day.status === 'cleared') row.appendChild(h('button', { class: 'btn danger', id: 'revoke', disabled: A.busy, onclick: function () { markDay(d, 'revoked', reason.value); } }, '撤销通关'));
    c.appendChild(row);
    var isEx = (A.data.config.exemptDays || []).some(function (e) { return e.date === d; });
    c.appendChild(h('button', { class: 'btn sec', id: 'exempt', disabled: A.busy, onclick: function () { toggleExempt(d, isEx); } }, isEx ? '取消免打卡' : '设为免打卡日（节假日、请假）'));
    return c;
  }
  async function markDay(d, result, note) {
    var rec;
    try { rec = AdminLogic.makeReview(result, { now: UI.isoLocal(true), note: note, prev: A.data.reviews[d], tasks: AdminLogic.tasksOnDate(A.data.config, d) }); }
    catch (e) { A.msg = { ok: false, text: e.message }; A.render(); return; }
    await A.act(A.dateLabel(d) + (result === 'makeup' ? ' 已补卡' : ' 已撤销，相关奖励会自动重新计算'), function () { return A.store.saveReview(d, rec); });
  }
  async function toggleExempt(d, isEx) {
    var cfg = JSON.parse(JSON.stringify(A.data.config));
    cfg.exemptDays = (cfg.exemptDays || []).filter(function (e) { return e.date !== d; });
    if (!isEx) cfg.exemptDays.push({ date: d, reason: '家长设置' });
    await A.act(A.dateLabel(d) + (isEx ? ' 已取消免打卡' : ' 已设为免打卡日'), function () { return A.store.saveConfig(cfg); });
  }
}());
// @AI_GENERATED: end
