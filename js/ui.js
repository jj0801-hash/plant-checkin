// @AI_GENERATED
// 孩子端与家长端共用的界面小工具。所有文本一律用 textContent，不使用 innerHTML。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function h(tag, props) {
    var n = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === undefined || v === null || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'value') n.value = v;
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), v);
      else if (v === true) n.setAttribute(k, '');
      else n.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined || c === false) continue;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return n;
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayStr() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  // 带本地时区偏移的 ISO 时间；withMs=true 时精确到毫秒（用于需要区分先后的审核时间）
  function isoLocal(withMs) {
    var d = new Date(), o = -d.getTimezoneOffset(), s = o >= 0 ? '+' : '-';
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
      (withMs ? '.' + String(d.getMilliseconds()).padStart(3, '0') : '') + s + pad(Math.floor(Math.abs(o) / 60)) + ':' + pad(Math.abs(o) % 60);
  }
  // 带前缀的 localStorage 封装；存储不可用时静默失败
  function storage(prefix) {
    return {
      get: function (k) { try { return JSON.parse(localStorage.getItem(prefix + k) || 'null'); } catch (e) { return null; } },
      set: function (k, v) { try { localStorage.setItem(prefix + k, JSON.stringify(v)); } catch (e) { /* 存储满或被禁用 */ } },
      del: function (k) { try { localStorage.removeItem(prefix + k); } catch (e) { /* ignore */ } }
    };
  }
  // 把文本里的数字（含 12:30、3/7、2026-11-04、80% 这类连续写法）包进 <span class="num">，用等宽字体显示。
  // 只处理普通文本节点，不碰输入框、下拉选项和脚本；重复调用是安全的。
  var NUM_RE = /\d+(?:[.:/\-]\d+)*/g;
  function monoNumbers(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        if (!p || /^(INPUT|TEXTAREA|SELECT|OPTION|SCRIPT|STYLE)$/.test(p.nodeName) || (p.classList && p.classList.contains('num'))) return NodeFilter.FILTER_REJECT;
        return /\d/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = [], n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (t) {
      // 父元素是 flex / grid 容器时，文本和数字 span 会各自成为独立的布局项，彼此间出现多余空隙。
      // 此时先把这个文本节点包进一个普通行内元素，让它在容器里仍然只算一项。
      var host = t.parentNode, disp = window.getComputedStyle(host).display;
      if (/flex|grid/.test(disp)) {
        var wrap = document.createElement('span'); host.replaceChild(wrap, t); wrap.appendChild(t);
      }
      var text = t.nodeValue, frag = document.createDocumentFragment(), last = 0, m;
      NUM_RE.lastIndex = 0;
      while ((m = NUM_RE.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        var s = document.createElement('span'); s.className = 'num'; s.textContent = m[0]; frag.appendChild(s);
        last = m.index + m[0].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      t.parentNode.replaceChild(frag, t);
    });
  }
  // 三种页面状态：加载骨架 / 错误 / 空
  function skeleton(count) {
    var w = h('div', { class: 'list', id: 'loading', 'aria-busy': 'true', 'aria-label': '加载中' });
    for (var i = 0; i < (count || 3); i++) {
      w.appendChild(h('div', { class: 'card' }, h('div', { class: 'skel w1' }), h('div', { class: 'skel w2' }), h('div', { class: 'skel w3' }), h('div', { class: 'skel btnbar' })));
    }
    return w;
  }
  function errorState(message, onRetry) {
    var c = h('div', { class: 'card state err', id: 'errorstate', role: 'alert' }, h('div', { class: 'ico', text: '⚠️' }), h('h2', { text: '加载失败' }), h('p', { text: message }));
    if (onRetry) c.appendChild(h('button', { class: 'btn sec', id: 'retry', onclick: onRetry }, '重试'));
    return c;
  }
  function emptyState(icon, title, hint) {
    return h('div', { class: 'card state', id: 'emptystate' }, h('div', { class: 'ico', text: icon }), h('h2', { text: title }), hint ? h('p', { text: hint }) : null);
  }
  var ERR = { network: '连不上网络，下面显示的是上次同步的数据', auth: '令牌失效了，请重新生成并重新绑定',
              forbidden: '没有权限做这个操作', notfound: '找不到数据，请检查绑定信息', conflict: '保存冲突，请稍后再试',
              server: '服务暂时不可用，请稍后再试', corrupt: '数据文件损坏' };
  return { monoNumbers: monoNumbers, skeleton: skeleton, errorState: errorState, emptyState: emptyState, h: h, pad: pad, todayStr: todayStr, isoLocal: isoLocal, storage: storage, ERR: ERR };
});
// @AI_GENERATED: end
