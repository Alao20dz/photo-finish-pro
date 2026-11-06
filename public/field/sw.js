/**
 * Photo Finish Pro — Service Worker v1.0.0
 * 
 * إستراتيجية التخزين المؤقت الميداني:
 * - Precache: واجهة التطبيق المفردة + الأصوات + الأيقونات (تعمل بلا إنترنت)
 * - Cache-First: لكل أصول التطبيق الثابتة
 * - Network-First + fallback: للصفحة الرئيسية لضمان آخر تحديث مع عمل offline
 * 
 * ملاحظة: لا يتم اعتراض اتصالات WS/MQTT/WebRTC — التوقيت الحي يعمل دائماً عبر الشبكة.
 */

const CACHE_VERSION = 'photo-finish-v1.0.0';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/icon-180.png',
  '/icons/icon-32.png',
  '/sounds/official_start_gun.mp3',
  '/sounds/starter_gun_shot.wav',
  '/sounds/son_depart_2.mp3',
  '/sounds/sond_depart.mp3',
];

// ─── التثبيت: تخزين مسبق لكل الأصول الحرجة ───
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── التفعيل: تنظيف النسخ القديمة من الكاش ───
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── اعتراض الطلبات ───
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // لا تعترض طلبات الشبكة الحية (SSE احتياطي)
  if (url.pathname.startsWith('/api/')) return;

  // الصفحة الرئيسية: Network-First مع سقوط offline إلى الكاش
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('/', copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('/index.html').then((c) => c || caches.match('/')))
    );
    return;
  }

  // نفس الأصل (أصوات، أيقونات، manifest): Cache-First ثم الشبكة
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
            }
            return response;
          })
      )
    );
  }
});
