// @AI_GENERATED
// M1 规则引擎：纯函数，输入原始事实，输出全部推导状态（需求文档 5、7.2 节）。
// 不读写任何存储，不依赖 DOM，孩子端和家长端运行同一份代码。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./dates.js'));
  else root.Rules = factory(root.Dates);
})(typeof self !== 'undefined' ? self : this, function (D) {
  var DEFAULT_REWARDS = { daily: 0, taskSun: 2.5, subjectStar: 20, perfectWeek: 30, makeupPlant: 80,
                          earlyUnlockPerWeek: 40, beyondSchedule: 50, plantMinSubjects: 1,
                          dailyUnlockEvery: 5 };   // 每累计通关几天，按排期顺序多解锁一株植物；0 表示关闭
  // taskSun：每项任务经家长通过后的阳光；daily："通关日"（当天任务全部通过）的额外奖励，默认 0
  var DEFAULT_SCALE = ['不合格', '合格', '良', '优', '优加'];
  var TIERS = [['gold', 0.90], ['silver', 0.75], ['bronze', 0.60]];

  // 某天适用的任务（排除免打卡日、停用、未生效和已截止的）。孩子端、家长端和结算共用这一份。
  function tasksOnDate(config, date) {
    var ex = (config.exemptDays || []).some(function (e) { return (typeof e === 'string' ? e : e.date) === date; });
    if (ex) return [];
    return (config.tasks || []).filter(function (t) {
      return t.active !== false && (t.weekdays || []).indexOf(D.dow(date)) >= 0 &&
        (t.effectiveFrom || '0000-00-00') <= date && (t.effectiveTo || '9999-12-31') >= date;
    });
  }
  // 兑换价格：补种固定价；提前解锁 = 每周价 × 距离周数（至少 1 周）
  function redeemCost(config, kind, weekNo, currentWeekNo) {
    var R = Object.assign({}, DEFAULT_REWARDS, config.rewards || {});
    return kind === 'replant' ? R.makeupPlant : R.earlyUnlockPerWeek * Math.max(1, weekNo - currentWeekNo);
  }
  // 某株植物的阳光价格（来自内容包的 price 字段，由 app 汇总为 content.prices）；没有定价返回 null
  function plantPrice(content, plantId) {
    var p = content && content.prices && content.prices[plantId];
    return typeof p === 'number' && p > 0 ? p : null;
  }
  function weekNoOf(date, start) { return Math.floor(D.diffDays(D.weekStart(date), D.weekStart(start)) / 7) + 1; }
  function ts(s) { var t = Date.parse(s); return isNaN(t) ? 0 : t; }

  // 提交是否仍在等待审核：
  //  - 还没有审核 → 待确认
  //  - 提交带有 ackReviewedAt：等于当前审核的 reviewedAt，说明孩子是看到这条审核后才再次提交的 → 待确认（与两台设备的时钟无关）
  //  - 没有 ackReviewedAt 的旧数据：退回到比较时间戳
  function isResubmitted(sub, review) {
    if (!review) return true;
    if (Object.prototype.hasOwnProperty.call(sub, 'ackReviewedAt')) return sub.ackReviewedAt === review.reviewedAt;
    return ts(sub.clientSubmittedAt) > ts(review.reviewedAt);
  }

  function empty() {
    return { started: false, days: {}, weeks: [], sun: { earned: 0, spent: 0, balance: 0, ledger: [] }, plants: {},
             stars: {}, zombies: [], stages: [], trophy: { ended: false, tier: null, rate: 0, stars: 0, maxStars: 0 },
             progress: { currentWeekNo: 0, dailyUnlock: null }, ignoredRedeems: [] };
  }

  function computeState(input) {
    var cfg = input.config || {}, S = cfg.semester || {}, today = input.today;
    var R = Object.assign({}, DEFAULT_REWARDS, cfg.rewards || {});
    var subjects = cfg.subjects || ['chinese', 'math', 'english'];
    var scale = S.gradeScale || DEFAULT_SCALE;
    var thrIdx = scale.indexOf(S.gradeThreshold || '优');
    var passRate = S.passRate || 0;
    var subms = input.submissions || {}, revs = input.reviews || {}, grades = input.grades || {};
    var redeems = input.redeems || [], content = input.content || {};
    var start = S.rewardStart, end = S.end || null;
    if (!start || today < start) return empty();

    var exempt = {};
    (cfg.exemptDays || []).forEach(function (e) { exempt[typeof e === 'string' ? e : e.date] = true; });
    function applicable(d) { return tasksOnDate(cfg, d).length > 0; }
    function inScope(d) { return d >= start && (!end || d <= end); }
    // 某天的必做任务编号：审核当时的任务快照优先（历史不受后来改任务的影响），否则取当天适用的任务
    function reqIds(d) {
      var r = revs[d];
      if (r && r.taskSnapshot && r.taskSnapshot.length) return r.taskSnapshot.map(function (t) { return t.id; });
      return tasksOnDate(cfg, d).map(function (t) { return t.id; });
    }
    // 家长已通过的任务编号。未来日期的审核一律不生效（防止设备时间错误或伪造记录）。
    // 旧数据（审核记录没有 approvedTasks）视为当天的任务全部通过。
    function reviewOk(d) { var r = revs[d]; return d <= today && !!r && (r.result === 'approved' || r.result === 'makeup'); }
    function approvedIds(d) {
      if (!reviewOk(d)) return [];
      var r = revs[d], req = reqIds(d);
      if (!Array.isArray(r.approvedTasks)) return req;
      return req.filter(function (id) { return r.approvedTasks.indexOf(id) >= 0; });
    }
    // "通关日"：当天的任务全部通过
    function isCleared(d) {
      if (!reviewOk(d)) return false;
      var r = revs[d];
      if (!Array.isArray(r.approvedTasks)) return true;
      var ap = approvedIds(d);
      return reqIds(d).every(function (id) { return ap.indexOf(id) >= 0; });
    }
    function isRequired(d) {
      if (exempt[d]) return false;
      var r = revs[d];
      return applicable(d) || !!(r && r.taskSnapshot && r.taskSnapshot.length);
    }

    var lastDate = end && end < today ? end : today;
    var lastWeekNo = weekNoOf(lastDate, start);
    var curWeekNo = weekNoOf(today, start);
    var ledger = [];

    // ---- 每日 ----
    var days = {};
    D.range(start, lastDate).forEach(function (d) {
      var r = revs[d], s = subms[d], req = isRequired(d), st;
      var ids = reqIds(d), ap = approvedIds(d), cleared = isCleared(d);
      // 孩子提交了、家长还没审的任务（已通过的不再算待审）
      var pend = [];
      if (s && isResubmitted(s, r)) {
        (s.done || []).forEach(function (id) {
          // 不按"当天必做"过滤：家长改任务的同一天，孩子之前提交的旧任务编号也要能被看到和审核
          if (pend.indexOf(id) < 0 && ap.indexOf(id) < 0) pend.push(id);
        });
      }
      var rej = r && Array.isArray(r.rejectedTasks) && !cleared
        ? r.rejectedTasks.filter(function (id) { return pend.indexOf(id) < 0 && ap.indexOf(id) < 0; }) : [];
      if (cleared) st = 'cleared';
      else if (pend.length) st = 'pending';
      else if (ap.length) st = 'partial';
      else if (r && r.result === 'rejected') st = 'rejected';
      else if (r && r.result === 'revoked') st = 'revoked';
      else if (exempt[d]) st = 'exempt';
      else if (!req) st = 'none';
      else st = d < today ? 'missed' : 'in_progress';
      var taskSunToday = ap.length * R.taskSun, bonus = cleared ? R.daily : 0;
      days[d] = { status: st, required: req, cleared: st === 'cleared', approvedTasks: ap, pendingTasks: pend, rejectedTasks: rej, sun: taskSunToday + bonus };
      if (taskSunToday > 0) ledger.push({ reason: 'task', delta: taskSunToday, ref: d });
      if (bonus > 0) ledger.push({ reason: 'daily', delta: bonus, ref: d });
    });

    // ---- 排期 ----
    var schedule = {}, schedMax = 0;
    (cfg.schedule || []).forEach(function (x) { schedule[x.week] = x.plantId; if (x.week > schedMax) schedMax = x.week; });
    var extras = content.extraPlants || [];
    function plantFor(w) {
      if (schedule[w]) return schedule[w];
      var idx = w - schedMax - 1;
      return idx >= 0 && idx < extras.length ? extras[idx] : null;
    }

    // ---- 每周 ----
    var weeks = [], stars = {}, plants = {};
    subjects.forEach(function (s) { stars[s] = 0; });
    var weekOneStart = D.weekStart(start);
    for (var w = 1; w <= lastWeekNo; w++) {
      var ws = D.addDays(weekOneStart, (w - 1) * 7), we = D.addDays(ws, 6);
      var from = D.max(ws, start), to = end ? D.min(we, end) : we;
      var req = 0, passed = 0;
      D.range(from, to).forEach(function (d) {
        if (isRequired(d)) { req++; if (isCleared(d)) passed++; }
      });
      var rate = req === 0 ? 1 : Math.min(1, passed / req);
      var ended = to < today;
      var g = grades[D.isoWeekKey(ws)] || {};
      var allEntered = subjects.every(function (s) { return g[s] !== undefined && g[s] !== null && g[s] !== ''; });
      var settled = ended && allEntered;
      var gateOk = passRate <= 0 || rate >= passRate;
      var wk = { weekNo: w, key: D.isoWeekKey(ws), start: ws, end: we, requiredDays: req, passedDays: passed, rate: rate,
                 gradesEntered: allEntered, gateOk: gateOk, subjects: {}, starsEarned: 0, passedSubjects: 0,
                 plantId: plantFor(w), plantUnlocked: false, plantGold: false, plantPending: null, bonusSun: 0,
                 status: !ended ? '进行中' : (allEntered ? '已结算' : '待录入成绩') };
      subjects.forEach(function (s) {
        var gi = scale.indexOf(g[s]);
        wk.subjects[s] = { grade: g[s] === undefined ? null : g[s], pass: thrIdx >= 0 && gi >= thrIdx };
      });
      if (settled && !gateOk) {
        wk.plantPending = '待追回';
      } else if (settled) {
        subjects.forEach(function (s) {
          if (wk.subjects[s].pass) {
            wk.starsEarned++; stars[s]++;
            ledger.push({ reason: 'subjectStar', delta: R.subjectStar, ref: wk.key + ':' + s });
          }
        });
        wk.passedSubjects = wk.starsEarned;
        var all = subjects.length > 0 && wk.passedSubjects === subjects.length;
        if (all) ledger.push({ reason: 'perfectWeek', delta: R.perfectWeek, ref: wk.key });
        if (wk.passedSubjects >= R.plantMinSubjects) {
          if (wk.plantId) { wk.plantUnlocked = true; wk.plantGold = all; plants[wk.plantId] = { week: w, gold: all, source: 'weekly' }; }
          else { wk.bonusSun = R.beyondSchedule; ledger.push({ reason: 'beyondSchedule', delta: R.beyondSchedule, ref: wk.key }); }
        } else if (wk.plantId) wk.plantPending = '待补种';
      }
      weeks.push(wk);
    }
    var weekBy = {}; weeks.forEach(function (x) { weekBy[x.weekNo] = x; });

    // ---- 兑换：商店购买（buy），以及旧版的补种、提前解锁（历史记录继续有效）----
    var spent = 0, ignored = [];
    // 植物 → 它在排期里的周次（只有排期里的植物才能买）
    var weekOfPlant = {};
    (cfg.schedule || []).forEach(function (x) { if (x.plantId) weekOfPlant[x.plantId] = x.week; });
    extras.forEach(function (id, i) { if (!weekOfPlant[id]) weekOfPlant[id] = schedMax + i + 1; });
    redeems.forEach(function (r) {
      if (r.status !== 'approved') return;
      if (r.kind === 'buy') {
        var bw = weekOfPlant[r.plantId];
        if (!r.plantId || !bw || plants[r.plantId] || typeof r.cost !== 'number' || !(r.cost >= 0)) { ignored.push(r.id); return; }
        spent += r.cost;
        ledger.push({ reason: 'buy', delta: -r.cost, ref: String(r.id) });
        plants[r.plantId] = { week: bw, gold: false, source: 'shop' };
        var bwk = weekBy[bw];
        if (bwk && bwk.plantId === r.plantId) { bwk.plantUnlocked = true; bwk.plantPending = null; }
        return;
      }
      var wk = weekBy[r.weekNo], pid = plantFor(r.weekNo), ok = false;
      if (pid && !plants[pid]) {
        if (r.kind === 'replant') ok = !!wk && wk.status === '已结算' && wk.plantPending === '待补种';
        else if (r.kind === 'early_unlock') ok = r.weekNo > curWeekNo || (!!wk && wk.status !== '已结算');
      }
      if (!ok) { ignored.push(r.id); return; }
      var cost = typeof r.cost === 'number' ? r.cost :
        (r.kind === 'replant' ? R.makeupPlant : R.earlyUnlockPerWeek * Math.max(1, r.weekNo - curWeekNo));
      spent += cost;
      ledger.push({ reason: r.kind, delta: -cost, ref: String(r.id) });
      plants[pid] = { week: r.weekNo, gold: false, source: r.kind === 'replant' ? 'replant' : 'early' };
      if (wk) { wk.plantUnlocked = true; wk.plantPending = null; }
    });

    // ---- 打卡里程碑解锁（叠加在成绩路径上）----
    // 每累计通关 N 天，按排期顺序取"下一株还没拿到的植物"。放在成绩和兑换之后计算：
    // 已被成绩、补种、提前解锁拿到的植物会被跳过，所以后补录的成绩不会让已解锁的植物消失（结果只增不减）。
    var dailyUnlock = null;
    var every = Math.floor(Number(R.dailyUnlockEvery));
    if (every >= 1) {
      var clearedDates = Object.keys(days).filter(function (d) { return days[d].cleared; }).sort();
      var pool = [];                                               // [{ id, week }]，按周次顺序：排期植物，再接额外植物
      (cfg.schedule || []).slice().sort(function (a, b) { return a.week - b.week; }).forEach(function (x) { if (x.plantId) pool.push({ id: x.plantId, week: x.week }); });
      extras.forEach(function (id, i) { pool.push({ id: id, week: schedMax + i + 1 }); });
      var slots = Math.floor(clearedDates.length / every), used = 0;
      pool.forEach(function (p) {
        if (used >= slots || plants[p.id]) return;
        used++;
        plants[p.id] = { week: p.week, gold: false, source: 'daily', milestone: used * every, unlockedOn: clearedDates[used * every - 1] };
        var wkx = weekBy[p.week];
        if (wkx && wkx.plantId === p.id) { wkx.plantUnlocked = true; wkx.plantPending = null; }
      });
      var poolLeft = pool.filter(function (p) { return !plants[p.id]; }).length;
      dailyUnlock = { every: every, cleared: clearedDates.length, toNext: poolLeft > 0 ? every - (clearedDates.length % every) : null,
                      unlockedByDaily: used, poolLeft: poolLeft };
    }

    // ---- 阳光 ----
    var earned = 0;
    ledger.forEach(function (e) { if (e.delta > 0) earned += e.delta; });
    var sun = { earned: earned, spent: spent, balance: earned - spent, ledger: ledger };

    // ---- 阶段与场景 ----
    var totalWeeks = end ? weekNoOf(end, start) : null;
    var stages = [], maxStage = Math.ceil(Math.max(lastWeekNo, 1) / 4);
    for (var sg = 1; sg <= maxStage; sg++) {
      var sw = [];
      for (var k = (sg - 1) * 4 + 1; k <= sg * 4; k++) if (!totalWeeks || k <= totalWeeks) sw.push(k);
      var complete = sw.length > 0 && sw.every(function (n) { return weekBy[n] && weekBy[n].plantUnlocked; });
      stages.push({ stageNo: sg, weeks: sw, complete: complete });
    }
    stages.forEach(function (st, i) { st.sceneUnlocked = i === 0 || stages[i - 1].complete; });

    // ---- 学期奖杯 ----
    var ended = !!end && end < today;
    var scored = weeks.filter(function (x) { return x.requiredDays > 0 && x.status !== '进行中'; }).length;
    var maxStars = subjects.length * scored;
    var total = subjects.reduce(function (a, s) { return a + stars[s]; }, 0);
    var trate = maxStars ? total / maxStars : 0, tier = null;
    for (var t = 0; t < TIERS.length; t++) if (trate >= TIERS[t][1] - 1e-9) { tier = TIERS[t][0]; break; }
    var trophy = { ended: ended, tier: ended ? tier : null, projectedTier: tier, rate: trate, stars: total, maxStars: maxStars };

    // ---- 僵尸 ----
    var zombies = [];
    (content.zombies || []).forEach(function (z) {
      var ok;
      if (z.boss) ok = trophy.ended && !!trophy.tier;
      else if (!z.subject) ok = true;
      else ok = (stars[z.subject] || 0) >= z.unlockStars;
      if (ok) zombies.push(z.id);
    });

    // ---- 首页进度 ----
    var endedWeeks = weeks.filter(function (x) { return x.status !== '进行中'; }).length;
    var unlocked = Object.keys(plants).length;
    var cur = weekBy[curWeekNo];
    var progress = { currentWeekNo: curWeekNo, daysToEnd: end ? Math.max(0, D.diffDays(end, today)) : null,
                     plantsUnlocked: unlocked, plantsExpected: endedWeeks, plantsAhead: unlocked - endedWeeks,
                     thisWeek: cur ? { passedDays: cur.passedDays, requiredDays: cur.requiredDays } : null, dailyUnlock: dailyUnlock };

    return { started: true, days: days, weeks: weeks, sun: sun, plants: plants, stars: stars, zombies: zombies,
             stages: stages, trophy: trophy, progress: progress, ignoredRedeems: ignored };
  }

  return { computeState: computeState, tasksOnDate: tasksOnDate, redeemCost: redeemCost, plantPrice: plantPrice, DEFAULT_REWARDS: DEFAULT_REWARDS, DEFAULT_SCALE: DEFAULT_SCALE };
});
// @AI_GENERATED: end
