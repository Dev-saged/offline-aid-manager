// Service Worker: يخزّن كل الملفات (المحلية والخارجية مثل مكتبة الإكسل والخط) عند أول تشغيل متصل بالإنترنت،
// ثم يقدّمها من الذاكرة المؤقتة في كل مرة لاحقة، بحيث يعمل النظام بالكامل بدون إنترنت.
// تم ترقية CACHE_NAME إلى v5.2.0 حتى يُجبر المتصفح على استبدال index.html المخزّن مسبقًا بالنسخة الجديدة.

const CACHE_NAME = 'beneficiary-app-v5.2.0';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-72.png',
  './icons/icon-96.png',
  './icons/icon-128.png',
  './icons/icon-144.png',
  './icons/icon-152.png',
  './icons/icon-192.png',
  './icons/icon-384.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

// الموارد الخارجية (CDN) التي يجب تخزينها أيضًا عند توفر الإنترنت لأول مرة
const EXTERNAL_ASSETS = [
  'https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // الملفات المحلية: يجب أن تنجح كلها
      await cache.addAll(CORE_ASSETS);
      // الموارد الخارجية: محاولة أفضل جهد فقط، لا نوقف التثبيت إن تعذّر الوصول للإنترنت الآن
      await Promise.allSettled(
        EXTERNAL_ASSETS.map(async (url) => {
          try {
            const res = await fetch(url, { mode: 'no-cors' });
            await cache.put(url, res);
          } catch (e) { /* سيتم تخزينها لاحقًا عند أول اتصال ناجح من fetch handler */ }
        })
      );
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // صفحات التنقّل (فتح التطبيق نفسه): نحاول الشبكة أولاً للحصول على أحدث نسخة، ثم نرجع للذاكرة المؤقتة
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put('./index.html', fresh.clone());
          return fresh;
        } catch (e) {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match('./index.html')) || (await cache.match('./'));
        }
      })()
    );
    return;
  }

  // باقي الموارد (سكربتات، خطوط، أيقونات): من الذاكرة المؤقتة أولاً، وإلا من الشبكة مع تخزينها لاستخدام لاحق دون اتصال
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req, { ignoreVary: true, ignoreSearch: false });
      if (cached) return cached;
      try {
        const res = await fetch(req);
        cache.put(req, res.clone());
        return res;
      } catch (e) {
        return cached || Response.error();
      }
    })()
  );
});
