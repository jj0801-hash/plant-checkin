// @AI_GENERATED
// M5 家长后台：兑换页。孩子申请补种 / 提前解锁，家长确认前先用规则引擎试算（是否有效、阳光够不够）。
(function () {
  'use strict';
  var A = window.Admin, h = UI.h, L = AdminLogic;
  A.reject = {};                              // 正在填写拒绝原因的请求 id
  var KIND = { replant: '补种', early_unlock: '提前解锁', buy: '商店购买' };
  A.labels.redeem = function () { var n = A.data ? L.pendingRedeems(A.data).length : 0; return { icon: '🎁', text: '兑换', badge: n }; };

  function plantName(week, plantId) {
    if (plantId) return (A.names || {})[plantId] || plantId;
    var slot = (A.data.config.schedule || []).filter(function (x) { return x.week === week; })[0];
    var id = slot && slot.plantId;
    return id ? ((A.names || {})[id] || id) : '（超出排期）';
  }
  // 已同意的购买，如果后来植物改由成绩或打卡解锁，规则引擎会忽略这笔、把阳光退回，这里要如实告诉家长
  function refunded(r) { return r.status === 'approved' && !!A.state && A.state.ignoredRedeems.indexOf(r.id) >= 0; }
  A.renderers.redeem = function () {
    var w = h('div'), list = L.pendingRedeems(A.data);
    w.appendChild(h('div', { class: 'row' }, h('h1', { text: '兑换申请' }), h('span', { class: 'badge b-ok', id: 'balance', text: '☀️ ' + (A.state ? A.state.sun.balance : 0) })));
    w.appendChild(h('p', { class: 'tiny', text: '孩子在商店里用阳光申请解锁植物。同意后会扣除阳光，植物立即解锁。' }));
    if (!list.length) { var es = UI.emptyState('🎁', '没有待处理的申请', '孩子在商店里申请解锁植物后会出现在这里'); es.id = 'noredeem'; w.appendChild(es); }
    var grid = h('div', { class: 'list' });
    list.forEach(function (r) { grid.appendChild(card(r)); });
    if (list.length) w.appendChild(grid);
    var done = (A.data.redeems || []).filter(function (r) { return r.status !== 'requested'; }).sort(function (a, b) { return String(a.decidedAt) < String(b.decidedAt) ? 1 : -1; }).slice(0, 8);
    if (done.length) {
      var hist = h('div', { class: 'card' }, h('h2', { text: '最近处理' })), zebra = h('div', { class: 'zebra' });
      hist.appendChild(zebra);
      done.forEach(function (r) {
        zebra.appendChild(h('div', { class: 'row trow' }, h('span', { text: r.kind === 'buy' ? KIND[r.kind] + '：' + plantName(null, r.plantId) : KIND[r.kind] + ' 第 ' + r.weekNo + ' 周 ' + plantName(r.weekNo) }),
          h('span', { class: 'badge ' + (r.status === 'approved' && !refunded(r) ? 'b-ok' : r.status === 'approved' ? 'b-gray' : 'b-bad'),
            text: r.status === 'approved' ? (refunded(r) ? '已退回（后来通过成绩或打卡解锁）' : '已同意 -' + (r.cost || 0)) : '已拒绝' })));
      });
      w.appendChild(hist);
    }
    return w;
  };

  function card(r) {
    var ev = L.evaluateRedeem(r, Object.assign({}, A.data, { prices: A.prices }), UI.todayStr()), c = h('div', { class: 'card', 'data-redeem': r.id });
    c.appendChild(h('div', { class: 'row' }, h('h2', { text: r.kind === 'buy' ? KIND[r.kind] + '：' + plantName(null, r.plantId) : KIND[r.kind] + '：第 ' + r.weekNo + ' 周 ' + plantName(r.weekNo) }), h('span', { class: 'badge b-wait', text: '待处理' })));
    c.appendChild(h('p', { class: 'tiny', text: '需要 ☀️ ' + ev.cost + '，现有 ☀️ ' + (A.state ? A.state.sun.balance : 0) + '　申请时间：' + String(r.requestedAt || '').replace('T', ' ').slice(0, 16) }));
    if (!ev.ok) c.appendChild(h('div', { class: 'note', text: '现在不能同意：' + ev.reason }));
    if (A.reject[r.id]) {
      var why = h('input', { type: 'text', id: 'why-' + r.id, placeholder: '想对孩子说的话（可不填）' });
      c.appendChild(why);
      c.appendChild(h('div', { class: 'row2' }, h('button', { class: 'btn danger', 'data-confirm-reject': r.id, onclick: function () { decide(r, 'rejected', 0, why.value); } }, '确认拒绝'),
        h('button', { class: 'btn sec', onclick: function () { A.reject[r.id] = false; A.render(); } }, '取消')));
    } else {
      c.appendChild(h('div', { class: 'row2' }, h('button', { class: 'btn ok', 'data-approve': r.id, disabled: !ev.ok || A.busy, onclick: function () { decide(r, 'approved', ev.cost, ''); } }, '同意'),
        h('button', { class: 'btn sec', 'data-reject': r.id, onclick: function () { A.reject[r.id] = true; A.render(); } }, '拒绝')));
    }
    return c;
  }
  async function decide(r, status, cost, note) {
    var dec = { id: r.id, kind: r.kind, weekNo: r.weekNo, status: status, cost: status === 'approved' ? cost : 0, requestedAt: r.requestedAt, decidedAt: UI.isoLocal(true) };
    if (r.plantId) dec.plantId = r.plantId;                 // 商店购买要带上植物，规则引擎靠它解锁
    if (note && note.trim()) dec.note = note.trim();
    await A.act(status === 'approved' ? '已同意，扣除 ☀️ ' + cost + '，植物已解锁' : '已拒绝', function () { return A.store.decideRedeem(dec); });
    A.reject[r.id] = false;
  }
}());
// @AI_GENERATED: end
