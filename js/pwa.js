// @AI_GENERATED
// 注册 Service Worker（仅在 https 或本机地址下可用）。失败不影响正常使用。
(function () {
  var ok = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && ok) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* 忽略 */ }); });
  }
}());
// @AI_GENERATED: end
