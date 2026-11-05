// @AI_GENERATED
// M4 家长后台（第 3 部分）：设置页。首次初始化、学期、任务（版本化）、免打卡日、昵称、绑定信息。
(function () {
  'use strict';
  var A = window.Admin, h = UI.h, D = Dates, L = AdminLogic;
  var WD_SHORT = ['一', '二', '三', '四', '五', '六', '日'];
  A.editTaskId = null;           // null | 'new' | 任务 id
  A.confirmWarn = null;          // 学期设置里有警告时，需要再点一次确认
  A.labels.settings = { icon: '⚙️', text: '设置' };

  function cfg() { return A.data.config; }
  function monday(date) { return D.weekStart(date); }
  function saveConfig(okMsg, next) { return A.act(okMsg, function () { return A.store.saveConfig(next); }); }
  function field(box, label, node) { box.appendChild(h('label', { text: label })); box.appendChild(node); return node; }

  A.renderers.settings = function () {
    var w = h('div');
    w.appendChild(h('h1', { text: '设置' }));
    if (!cfg()) { w.appendChild(initCard()); return w; }
    w.appendChild(semesterCard());
    w.appendChild(tasksCard());
    w.appendChild(exemptCard());
    w.appendChild(profileCard());
    w.appendChild(bindCard());
    return w;
  };

  // ---------- 首次初始化 ----------
  function initCard() {
    var c = h('div', { class: 'card' }), type = h('select', { id: 'i-type' }, h('option', { value: 'autumn', text: '秋季学期（9 月开学）' }), h('option', { value: 'spring', text: '春季学期（春节后开学）' }));
    c.appendChild(h('h2', { text: '第一次使用：创建学期' }));
    c.appendChild(h('p', { class: 'tiny', text: '奖励从你选的这一周的周一开始算，不回补之前的周。结束日期可以以后再填。' }));
    field(c, '学期类型', type);
    var start = field(c, '奖励起始日（必须是周一）', h('input', { type: 'text', id: 'i-start', value: monday(UI.todayStr()) }));
    var nick = field(c, '孩子昵称', h('input', { type: 'text', id: 'i-nick', value: '', placeholder: '例如：小明' }));
    c.appendChild(h('button', { class: 'btn', id: 'i-go', disabled: A.busy, onclick: async function () {
      var v = L.validateSemester({ rewardStart: start.value.trim(), passRate: 0 });
      if (v.errors.length) { A.msg = { ok: false, text: v.errors.join('；') }; A.render(); return; }
      var pack = type.value === 'spring' ? 'core-spring' : 'core-autumn', schedule;
      try { var r = await fetch('packs/' + pack + '/pack.json'); schedule = (await r.json()).characters.filter(function (x) { return x.kind === 'plant'; }).map(function (x, i) { return { week: i + 1, plantId: x.id }; }); }
      catch (e) { A.msg = { ok: false, text: '读取内置植物包失败，无法生成排期' }; A.render(); return; }
      var init = { schemaVersion: 1, profile: { nickname: nick.value.trim() || '小朋友' },
        semester: { name: (type.value === 'spring' ? '春季' : '秋季') + '学期', type: type.value, rewardStart: start.value.trim(), end: null, passRate: 0,
                    gradeScale: Rules.DEFAULT_SCALE.slice(), gradeThreshold: '优' },
        subjects: ['chinese', 'math', 'english'], exemptDays: [], tasks: [],
        rewards: { daily: 0, taskSun: 2.5, subjectStar: 20, perfectWeek: 30, makeupPlant: 80, earlyUnlockPerWeek: 40, dailyUnlockEvery: 5 }, templateId: pack, schedule: schedule };
      await saveConfig('已创建。接下来请到下面添加每天的学习任务。', init);
    } }, '创建'));
    return c;
  }

  // ---------- 学期 ----------
  function semesterCard() {
    var s = cfg().semester, c = h('div', { class: 'card', id: 'sem-card' });
    c.appendChild(h('h2', { text: '学期：' + (s.name || '') }));
    var start = field(c, '奖励起始日（周一）', h('input', { type: 'text', id: 's-start', value: s.rewardStart }));
    var end = field(c, '学期结束日（可空，知道校历后再填）', h('input', { type: 'text', id: 's-end', value: s.end || '', placeholder: 'YYYY-MM-DD，留空表示未设置' }));
    var pr = field(c, '打卡完成率通过线（%，0 表示只看成绩）', h('input', { type: 'text', id: 's-pass', value: String(Math.round((s.passRate || 0) * 100)) }));
    var thr = h('select', { id: 's-thr' });
    (s.gradeScale || Rules.DEFAULT_SCALE).forEach(function (x) { thr.appendChild(h('option', { value: x, text: x })); });
    thr.value = s.gradeThreshold || '优';
    field(c, '成绩达标线（达到这一档及以上算达标）', thr);
    var warn = h('div', { class: 'note', id: 's-warn', hidden: true });
    c.appendChild(warn);
    c.appendChild(h('button', { class: 'btn ok', id: 's-save', disabled: A.busy, onclick: async function () {
      var next = JSON.parse(JSON.stringify(cfg()));
      next.semester.rewardStart = start.value.trim(); next.semester.end = end.value.trim() || null;
      next.semester.passRate = (parseFloat(pr.value) || 0) / 100; next.semester.gradeThreshold = thr.value;
      var graded = A.state ? A.state.weeks.filter(function (x) { return x.gradesEntered; }) : [];
      var v = L.validateSemester(next.semester, { gradedWeeks: graded });
      if (v.errors.length) { A.msg = { ok: false, text: v.errors.join('；') }; A.render(); return; }
      var key = JSON.stringify(next.semester);
      if (v.warnings.length && A.confirmWarn !== key) {
        A.confirmWarn = key; warn.hidden = false; warn.textContent = '⚠️ ' + v.warnings.join('；') + '。再点一次“保存学期设置”确认。'; return;
      }
      A.confirmWarn = null;
      await saveConfig('学期设置已保存，奖励会按新设置重新计算', next);
    } }, '保存学期设置'));
    return c;
  }

  // ---------- 任务 ----------
  function liveTasks() {
    var t = UI.todayStr();
    return (cfg().tasks || []).filter(function (x) { return x.active !== false && (x.effectiveTo || '9999-12-31') >= t; });
  }
  function tasksCard() {
    var c = h('div', { class: 'card', id: 'tasks-card' });
    c.appendChild(h('div', { class: 'row' }, h('h2', { text: '每日任务' }), h('button', { class: 'btn sec mini', id: 't-add', onclick: function () { A.editTaskId = 'new'; A.render(); } }, '＋ 新增')));
    c.appendChild(h('p', { class: 'tiny', text: '修改或停用只影响今天及以后，之前的日子不会变。' }));
    var list = liveTasks();
    var zebra = h('div', { class: 'zebra' });
    if (!list.length) c.appendChild(h('div', { class: 'empty', id: 'notasks', text: '还没有任务，点“新增”添加。' }));
    else c.appendChild(zebra);
    list.forEach(function (t) {
      zebra.appendChild(h('div', { class: 'row trow', 'data-tid': t.id },
        h('span', { text: (t.icon || '📘') + ' ' + t.name + '　' + (t.weekdays || []).map(function (d) { return WD_SHORT[d - 1]; }).join('') + (t.effectiveFrom > UI.todayStr() ? '（从 ' + t.effectiveFrom.slice(5) + ' 起）' : '') }),
        h('span', {}, h('button', { class: 'btn sec mini', 'data-edit': t.id, onclick: function () { A.editTaskId = t.id; A.render(); } }, '改'),
          h('button', { class: 'btn danger mini', 'data-stop': t.id, onclick: function () { stop(t); } }, '停'))));
    });
    if (A.editTaskId) c.appendChild(taskForm());
    return c;
  }
  function taskForm() {
    var isNew = A.editTaskId === 'new', cur = isNew ? { name: '', icon: '📘', minutes: 10, weekdays: [1, 2, 3, 4, 5] } : cfg().tasks.filter(function (x) { return x.id === A.editTaskId; })[0];
    var f = h('div', { class: 'card', id: 'task-form' });
    f.appendChild(h('h2', { text: isNew ? '新增任务' : '修改任务' }));
    var name = field(f, '任务名称', h('input', { type: 'text', id: 'tf-name', value: cur.name, placeholder: '例如：语文：阅读 20 分钟' }));
    var icon = field(f, '图标（一个表情）', h('input', { type: 'text', id: 'tf-icon', value: cur.icon || '📘' }));
    var min = field(f, '预计分钟数', h('input', { type: 'text', id: 'tf-min', value: String(cur.minutes || 10) }));
    f.appendChild(h('label', { text: '每周哪几天' }));
    var boxes = h('div', { class: 'row2' });
    WD_SHORT.forEach(function (n, i) {
      var cb = h('input', { type: 'checkbox', 'data-wd': String(i + 1), checked: (cur.weekdays || []).indexOf(i + 1) >= 0 });
      boxes.appendChild(h('label', { class: 'wdbox' }, cb, n));
    });
    f.appendChild(boxes);
    f.appendChild(h('div', { class: 'row2' },
      h('button', { class: 'btn ok', id: 'tf-save', disabled: A.busy, onclick: async function () {
        var wds = Array.prototype.filter.call(boxes.querySelectorAll('input'), function (x) { return x.checked; }).map(function (x) { return +x.getAttribute('data-wd'); });
        var patch = { name: name.value.trim(), icon: icon.value.trim() || '📘', minutes: parseInt(min.value, 10) || 10, weekdays: wds }, next;
        try { next = isNew ? L.addTask(cfg(), patch, UI.todayStr()) : L.editTask(cfg(), A.editTaskId, patch, UI.todayStr()); }
        catch (e) { A.msg = { ok: false, text: e.message }; A.render(); return; }
        A.editTaskId = null;
        await saveConfig(isNew ? '任务已添加，从今天起生效' : '任务已修改，从今天起生效，之前的日子不变', next);
      } }, '保存'),
      h('button', { class: 'btn sec', id: 'tf-cancel', onclick: function () { A.editTaskId = null; A.render(); } }, '取消')));
    return f;
  }
  async function stop(t) {
    if (!window.confirm('停用“' + t.name + '”？从今天起不再要求，之前的记录保留。')) return;
    await saveConfig('已停用：' + t.name, L.stopTask(cfg(), t.id, UI.todayStr()));
  }

  // ---------- 免打卡日 ----------
  function exemptCard() {
    var c = h('div', { class: 'card', id: 'exempt-card' }), ex = (cfg().exemptDays || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    c.appendChild(h('h2', { text: '免打卡日' }));
    c.appendChild(h('p', { class: 'tiny', text: '节假日、请假、考试周。这些天不计入应打卡天数。也可以在“日历”里点一天来设置。' }));
    var exZebra = h('div', { class: 'zebra' });
    if (!ex.length) c.appendChild(h('div', { class: 'tiny', text: '暂无' }));
    else c.appendChild(exZebra);
    ex.forEach(function (e) {
      exZebra.appendChild(h('div', { class: 'row' }, h('span', { text: e.date + '　' + (e.reason || '') }),
        h('button', { class: 'btn sec mini', 'data-unex': e.date, onclick: function () {
          var next = JSON.parse(JSON.stringify(cfg())); next.exemptDays = next.exemptDays.filter(function (x) { return x.date !== e.date; });
          saveConfig('已取消 ' + e.date + ' 的免打卡', next);
        } }, '取消')));
    });
    var from = field(c, '从（YYYY-MM-DD）', h('input', { type: 'text', id: 'x-from', placeholder: '例如 2026-12-31' }));
    var to = field(c, '到（可空，只设一天就留空）', h('input', { type: 'text', id: 'x-to' }));
    var why = field(c, '原因', h('input', { type: 'text', id: 'x-why', placeholder: '例如：元旦放假' }));
    c.appendChild(h('button', { class: 'btn sec', id: 'x-add', disabled: A.busy, onclick: function () {
      var a = from.value.trim(), b = to.value.trim() || a, days;
      try { days = D.range(a, b); if (!days.length || days.length > 62) throw new Error(days.length ? '一次最多设置 62 天' : '结束日不能早于开始日'); }
      catch (e) { A.msg = { ok: false, text: e.message.indexOf('日期') >= 0 ? '日期格式应为 YYYY-MM-DD，且必须真实存在' : e.message }; A.render(); return; }
      var next = JSON.parse(JSON.stringify(cfg())), have = {};
      next.exemptDays.forEach(function (x) { have[x.date] = true; });
      days.forEach(function (d) { if (!have[d]) next.exemptDays.push({ date: d, reason: why.value.trim() || '家长设置' }); });
      saveConfig('已添加 ' + days.length + ' 天免打卡', next);
    } }, '添加免打卡日'));
    return c;
  }

  // ---------- 昵称、绑定 ----------
  function profileCard() {
    var c = h('div', { class: 'card' }), nick = field(c, '孩子昵称', h('input', { type: 'text', id: 'p-nick', value: (cfg().profile && cfg().profile.nickname) || '' }));
    c.insertBefore(h('h2', { text: '孩子' }), c.firstChild);
    c.appendChild(h('button', { class: 'btn sec', id: 'p-save', disabled: A.busy, onclick: function () {
      var next = JSON.parse(JSON.stringify(cfg())); next.profile = Object.assign({}, next.profile, { nickname: nick.value.trim() || '小朋友' });
      saveConfig('昵称已保存', next);
    } }, '保存昵称'));
    return c;
  }
  function bindCard() {
    var c = h('div', { class: 'card' });
    c.appendChild(h('h2', { text: '绑定信息' }));
    c.appendChild(h('p', { class: 'tiny', text: '数据仓库：' + A.bind.owner + ' / ' + A.bind.repoParent }));
    c.appendChild(h('button', { class: 'btn sec', id: 'unbind', onclick: function () {
      if (!window.confirm('解除绑定后需要重新输入令牌，确定吗？')) return;
      A.kv.del('bind'); A.kv.del('cache'); A.bind = null; A.store = null; A.data = null; A.state = null; A.render();
    } }, '解除绑定'));
    return c;
  }
}());
// @AI_GENERATED: end
