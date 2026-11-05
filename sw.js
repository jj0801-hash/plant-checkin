// @AI_GENERATED
// Service Worker：缓存页面外壳和内置素材，断网也能打开。数据请求（跨域的 GitHub API）从不经过缓存。
// abe9d77b88 在打包时替换为版本号；改了任何文件发布新版本，旧缓存会在激活时清掉。
const BUILD = 'abe9d77b88';
const CACHE = 'plantcheckin-' + BUILD;
const SHELL = [
  './', 'index.html', 'admin.html', 'css/tokens.css', 'css/style.css', 'css/anim.css', 'css/admin.css',
  'fonts/barlow-500.woff2', 'fonts/barlow-600.woff2',
  'js/ui.js', 'js/dates.js', 'js/rules.js', 'js/anim.js', 'js/store.js', 'js/pwa.js',
  'js/app.js', 'js/app_pages.js',
  'js/admin_logic.js', 'js/admin.js', 'js/admin_pages.js', 'js/admin_redeem.js', 'js/admin_settings.js',
  'manifest.webmanifest', 'admin.webmanifest',
  'icons/mystery-plant.svg', 'icons/mystery-zombie.svg', 'icons/kid-192.png', 'icons/kid-512.png', 'icons/kid-180.png', 'icons/admin-192.png', 'icons/admin-512.png', 'icons/admin-180.png',
  'packs/core-autumn/pack.json', 'packs/core-spring/pack.json', 'packs/zombies-basic/pack.json'
];

self.addEventListener('install', (e) => {
  // cache:'reload' 绕过浏览器 HTTP 缓存，避免把旧文件当成新版本存进去（GitHub Pages 默认带约 10 分钟缓存）
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('plantcheckin-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function put(req, res) {
  if (res && res.status === 200 && res.type === 'basic') { const c = await caches.open(CACHE); await c.put(req, res.clone()); }
  return res;
}
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;        // 只处理本站的 GET，API 请求直接放行
  if (req.mode === 'navigate') {                                                    // 页面：优先联网拿最新，失败用缓存
    e.respondWith(fetch(req).then((r) => put(req, r)).catch(async () =>
      (await caches.match(req, { ignoreSearch: true })) || (await caches.match(url.pathname.endsWith('admin.html') ? 'admin.html' : 'index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => {                                   // 其他：先用缓存，同时后台更新
    const net = fetch(req).then((r) => put(req, r)).catch(() => hit);
    return hit || net;
  }));
});
// @AI_GENERATED: end
