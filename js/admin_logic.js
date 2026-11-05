// @AI_GENERATED
// 家长后台的业务逻辑（纯函数，可在 Node 中测试）。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./dates.js'), require('./rules.js'));
  else root.AdminLogic = factory(root.Dates, root.Rules);
})(typeof self !== 'undefined' ? self : this, function (D, Rules) {
  var tasksOnDate = Rules.tasksOnDate;

  // 待审核列表：按日期从新到旧。
  // done：这一天孩子提交了、家长还没审的任务；approved：已经通过的任务；snapshot：当天全部任务（审核时固化进记录）
  function pendingList(state, data) {
    var out = [];
    var names = {};
    (data.config.tasks || []).forEach(function (t) { names[t.id] = t.name; });
    function named(id) { return { id: id, name: names[id] || id }; }
    Object.keys(state.days).forEach(function (d) {
      if (state.days[d].status !== 'pending') return;
      var sub = data.submissions[d] || {}, day = state.days[d];
      var submittedDate = sub.clientSubmittedAt ? String(sub.clientSubmittedAt).slice(0, 10) : null;
      var today = tasksOnDate(data.config, d).map(function (t) { return t.id; });
      var snapIds = today.slice();
      day.pendingTasks.concat(day.approvedTasks).forEach(function (id) { if (snapIds.indexOf(id) < 0) snapIds.push(id); });
      out.push({ date: d, done: day.pendingTasks.map(named), approved: day.approvedTasks.map(named), snapshot: snapIds.map(named),
                 expected: snapIds.length, clientSubmittedAt: sub.clientSubmittedAt || null,
                 // 孩子填写的日期与提交时刻所在的日期不一致，或提交时间晚于所属日期之后超过一天
                 dateMismatch: !!submittedDate && (submittedDate !== d && D.diffDays(submittedDate, d) !== 1),
                 resubmitted: !!(data.reviews[d] && (data.reviews[d].result === 'rejected' || (data.reviews[d].rejectedTasks || []).length)) });
    });
    return out.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }

  // 构造审核记录。now 为带毫秒的 ISO 时间；prev 为该日已有审核（用于保证 reviewedAt 一定不同，也用来合并已通过的任务）。
  // opts.tasks：当天全部任务（会固化为 taskSnapshot）；opts.approve：这次通过的任务编号（不传 = 当天全部）；
  // opts.reject：这次驳回的任务编号。已通过的任务与上一次审核合并，不会丢。
  // 通过一部分、驳回一部分时 result 为 approved；一项都没通过时为 rejected。
  function makeReview(result, opts) {
    var now = opts.now, prev = opts.prev, tasks = opts.tasks || [];
    if (prev && prev.reviewedAt === now) now = now.replace(/\.(\d{3})/, function (m, ms) { return '.' + String((+ms + 1) % 1000).padStart(3, '0'); });
    var ids = tasks.map(function (t) { return t.id; });
    function only(list) { return (list || []).filter(function (id, i, a) { return ids.indexOf(id) >= 0 && a.indexOf(id) === i; }); }
    var r = { result: result, reviewedAt: now, note: (opts.note || '').trim() };
    var prevApproved = [];
    if (prev && (prev.result === 'approved' || prev.result === 'makeup')) prevApproved = Array.isArray(prev.approvedTasks) ? only(prev.approvedTasks) : ids.slice();
    var reject = only(opts.reject);
    if (result === 'approved') {
      var add = opts.approve === undefined ? ids : only(opts.approve);
      var merged = ids.filter(function (id) { return prevApproved.indexOf(id) >= 0 || add.indexOf(id) >= 0; });
      r.approvedTasks = merged;
      r.taskSnapshot = tasks.map(function (t) { return { id: t.id, name: t.name }; });
      reject = reject.filter(function (id) { return merged.indexOf(id) < 0; });
      if (reject.length) { r.rejectedTasks = reject; if (!r.note) throw new Error('驳回必须填写原因'); }
    } else if (result === 'rejected') {
      if (!r.note) throw new Error('驳回必须填写原因');
      if (reject.length) r.rejectedTasks = reject;
      if (prevApproved.length) {                                  // 之前已经通过了一部分：这一天仍是"部分通过"，只是新提交的被驳回
        r.result = 'approved'; r.approvedTasks = prevApproved;
        r.taskSnapshot = tasks.map(function (t) { return { id: t.id, name: t.name }; });
      }
    } else if (result === 'makeup') {
      r.approvedTasks = ids.slice();
      r.taskSnapshot = tasks.map(function (t) { return { id: t.id, name: t.name }; });
    }
    if ((result === 'makeup' || result === 'revoked') && !r.note) throw new Error('补卡和撤销必须填写原因');
    return r;
  }

  // 周成绩录入的校验：每科必须选一个值
  function validateGrades(subjects, g, scale) {
    var out = {}, missing = [];
    subjects.forEach(function (s) {
      var v = g[s];
      if (v === undefined || v === null || v === '') missing.push(s); else out[s] = v;
    });
    if (missing.length) throw new Error('还有科目没有选择成绩：' + missing.join('、'));
    return out;
  }

  // 学期设置的校验。返回 {errors:[], warnings:[]}
  function validateSemester(sem, ctx) {
    var errors = [], warnings = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sem.rewardStart || '')) errors.push('奖励起始日格式应为 YYYY-MM-DD');
    else if (D.dow(sem.rewardStart) !== 1) errors.push('奖励起始日必须是周一（每周从周一开始计算）');
    if (sem.end) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(sem.end)) errors.push('结束日格式应为 YYYY-MM-DD');
      else if (sem.rewardStart && sem.end < sem.rewardStart) errors.push('结束日不能早于奖励起始日');
    }
    var pr = Number(sem.passRate);
    if (isNaN(pr) || pr < 0 || pr > 1) errors.push('打卡完成率通过线应在 0 到 1 之间');
    if (!errors.length && sem.end && ctx && ctx.gradedWeeks) {
      // 结束日提前：统计会被排除的已录入成绩周数
      var cut = ctx.gradedWeeks.filter(function (w) { return w.start > sem.end; }).length;
      if (cut) warnings.push('将有 ' + cut + ' 周已录入的成绩不再计入奖杯结算');
    }
    return { errors: errors, warnings: warnings };
  }

  // ---- 任务版本化：修改只影响今天及以后，历史不变 ----
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function nextTaskId(config) {
    var max = 0;
    (config.tasks || []).forEach(function (t) { var m = /^t(\d+)$/.exec(t.id); if (m && +m[1] > max) max = +m[1]; });
    return 't' + (max + 1);
  }
  function checkTask(t) {
    if (!String(t.name || '').trim()) throw new Error('任务名称不能为空');
    if (!Array.isArray(t.weekdays) || !t.weekdays.length) throw new Error('请至少选择一个星期');
    return t;
  }
  function addTask(config, task, today) {
    var cfg = clone(config);
    var t = Object.assign({ icon: '📘', minutes: 10, active: true }, task, { id: nextTaskId(cfg), effectiveFrom: today });
    cfg.tasks = (cfg.tasks || []).concat([checkTask(t)]);
    return cfg;
  }
  // 编辑：任务今天才生效（或尚未生效）→ 原地修改；已有历史 → 旧版本到昨天截止，新建从今天起的新版本
  function editTask(config, id, patch, today) {
    var cfg = clone(config), t = cfg.tasks.filter(function (x) { return x.id === id; })[0];
    if (!t) throw new Error('找不到任务 ' + id);
    if ((t.effectiveFrom || '0000-00-00') >= today) { Object.assign(t, patch); checkTask(t); return cfg; }
    var nt = Object.assign({}, t, patch, { id: nextTaskId(cfg), effectiveFrom: today });
    delete nt.effectiveTo; checkTask(nt);
    t.effectiveTo = D.addDays(today, -1);
    cfg.tasks.push(nt);
    return cfg;
  }
  // 停用：有历史则到昨天截止；今天才创建的直接删除
  function stopTask(config, id, today) {
    var cfg = clone(config), t = cfg.tasks.filter(function (x) { return x.id === id; })[0];
    if (!t) throw new Error('找不到任务 ' + id);
    if ((t.effectiveFrom || '0000-00-00') >= today) cfg.tasks = cfg.tasks.filter(function (x) { return x.id !== id; });
    else t.effectiveTo = D.addDays(today, -1);
    return cfg;
  }

  // ---- 兑换 ----
  function stateFor(data, redeems, today) {
    return Rules.computeState({ config: data.config, submissions: data.submissions, reviews: data.reviews, grades: data.grades,
      redeems: redeems, content: { extraPlants: [], zombies: [] }, today: today });
  }
  var redeemCost = Rules.redeemCost;
  // 家长确认前的检查：假设批准，用规则引擎试算，看会不会被忽略、阳光是否够
  function evaluateRedeem(req, data, today) {
    var cur = stateFor(data, data.redeems, today);
    if (!cur.started) return { ok: false, cost: 0, reason: '奖励还没有开始' };
    if (req.kind === 'buy') return evaluateBuy(req, data, today, cur);
    var cost = redeemCost(data.config, req.kind, req.weekNo, cur.progress.currentWeekNo);
    // 这一周的植物如果已经被"打卡里程碑"解锁，就不用再花阳光兑换了（否则同意后只是让打卡名额顺延，孩子白花阳光）
    var slot = ((data.config && data.config.schedule) || []).filter(function (x) { return x.week === req.weekNo; })[0];
    var owned = slot && cur.plants[slot.plantId];
    if (owned && owned.source === 'daily') return { ok: false, cost: cost, reason: '这株植物已经通过打卡解锁了，不需要再兑换。点“拒绝”即可，阳光不会被扣。' };
    var others = data.redeems.filter(function (r) { return r.id !== req.id; });
    var trial = stateFor(data, others.concat([{ id: req.id, kind: req.kind, weekNo: req.weekNo, status: 'approved', cost: cost }]), today);
    if (trial.ignoredRedeems.indexOf(req.id) >= 0) {
      return { ok: false, cost: cost, reason: req.kind === 'replant' ? '这一周现在不需要补种（植物已解锁，或这周还没结算）' : '这一周的植物已经解锁，或这一周已经结算，不能再提前解锁' };
    }
    if (trial.sun.balance < 0) return { ok: false, cost: cost, reason: '阳光不够：需要 ' + cost + '，现有 ' + cur.sun.balance };
    return { ok: true, cost: cost, balanceAfter: trial.sun.balance };
  }
  // 商店购买的审批试算：价格取自 data.prices（植物 id → 阳光价格）；是否会被忽略交给规则引擎判断
  var SRC_TXT = { weekly: '成绩', daily: '打卡', replant: '补种', early: '提前解锁', shop: '商店' };
  function evaluateBuy(req, data, today, cur) {
    var inSchedule = ((data.config && data.config.schedule) || []).some(function (x) { return x.plantId === req.plantId; });
    if (!req.plantId || !inSchedule) return { ok: false, cost: 0, reason: '这株植物不在当前学期的排期里，不能购买' };
    var price = Rules.plantPrice({ prices: data.prices || {} }, req.plantId);
    if (price === null) return { ok: false, cost: 0, reason: '这株植物还没有定价（价格数据没加载到），暂时不能同意' };
    var owned = cur.plants[req.plantId];
    if (owned) {
      var why = owned.source === 'daily' ? '这株植物已经通过打卡解锁了，不需要再买。点“拒绝”即可，阳光不会被扣。'
        : '这株植物已经拥有了（来源：' + (SRC_TXT[owned.source] || owned.source) + '），不需要再买。点“拒绝”即可，阳光不会被扣。';
      return { ok: false, cost: price, reason: why };
    }
    var others = data.redeems.filter(function (r) { return r.id !== req.id; });
    var trial = stateFor(data, others.concat([{ id: req.id, kind: 'buy', plantId: req.plantId, status: 'approved', cost: price }]), today);
    if (trial.ignoredRedeems.indexOf(req.id) >= 0) return { ok: false, cost: price, reason: '这株植物现在不能购买' };
    if (trial.sun.balance < 0) return { ok: false, cost: price, reason: '阳光不够：需要 ' + price + '，现有 ' + cur.sun.balance };
    return { ok: true, cost: price, balanceAfter: trial.sun.balance };
  }
  function pendingRedeems(data) {
    return data.redeems.filter(function (r) { return r.status === 'requested'; }).sort(function (a, b) { return String(a.requestedAt) < String(b.requestedAt) ? 1 : -1; });
  }

  return { evaluateRedeem: evaluateRedeem, redeemCost: redeemCost, pendingRedeems: pendingRedeems, addTask: addTask, editTask: editTask, stopTask: stopTask, nextTaskId: nextTaskId, tasksOnDate: tasksOnDate, pendingList: pendingList, makeReview: makeReview, validateGrades: validateGrades, validateSemester: validateSemester };
});
// @AI_GENERATED: end
