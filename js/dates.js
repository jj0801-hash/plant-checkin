// @AI_GENERATED
// 日期工具：全部使用 'YYYY-MM-DD' 字符串，内部按 UTC 计算，避免时区和夏令时影响。
// 星期：周一=1 … 周日=7。周以周一为起点，周编号采用 ISO 8601（如 2026-W45）。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dates = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var DAY = 86400000;

  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
    if (!m) throw new Error('日期格式应为 YYYY-MM-DD: ' + s);
    var ms = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    var d = new Date(ms);
    if (d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) throw new Error('日期不存在: ' + s);
    return ms;
  }
  function fmt(ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
  }
  function addDays(s, n) { return fmt(parse(s) + n * DAY); }
  function diffDays(a, b) { return Math.round((parse(a) - parse(b)) / DAY); }
  function dow(s) { var d = new Date(parse(s)).getUTCDay(); return d === 0 ? 7 : d; }
  function weekStart(s) { return addDays(s, -(dow(s) - 1)); }
  function weekEnd(s) { return addDays(weekStart(s), 6); }
  function isoWeekKey(s) {
    var thu = addDays(weekStart(s), 3);
    var year = new Date(parse(thu)).getUTCFullYear();
    var week = Math.floor(diffDays(thu, year + '-01-01') / 7) + 1;
    return year + '-W' + String(week).padStart(2, '0');
  }
  function range(a, b) {
    var out = [];
    for (var d = a; d <= b; d = addDays(d, 1)) out.push(d);
    return out;
  }
  function min(a, b) { return a <= b ? a : b; }
  function max(a, b) { return a >= b ? a : b; }

  return { parse: parse, fmt: fmt, addDays: addDays, diffDays: diffDays, dow: dow,
           weekStart: weekStart, weekEnd: weekEnd, isoWeekKey: isoWeekKey, range: range, min: min, max: max };
});
// @AI_GENERATED: end
