/**
 * توليد sitemap.xml عند البناء — Photo Finish Pro (المرحلة 8)
 * ==========================================================
 * الاستخدام:
 *   VITE_SITE_URL=https://example.com node scripts/generate-sitemap.mjs
 *
 * • يُشغَّل تلقائياً بعد vite build (خطوة البناء في package.json).
 * • بدون VITE_SITE_URL يُتخطى التوليد بصمت (خريطة بلا نطاق حقيقي غير صالحة).
 * • التطبيق SPA بمسارات hash — بروتوكول sitemap لا يدعم الأجزاء (#)،
 *   لذا تُدرج الصفحات القابلة للفهرسة دون جزء: '/' حصراً حالياً؛
 *   صفحات الرابطات تُفهرس عبر تصيير JS (title/description/JSON-LD ديناميكية).
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @typedef {Object} SitemapRoute
 * @property {string} path
 * @property {string} [priority]    '0.0'..'1.0'
 * @property {'always'|'hourly'|'daily'|'weekly'|'monthly'|'yearly'|'never'} [changefreq]
 */

/** المسارات القابلة للفهرسة (بدون # — بروتوكول sitemap) */
export const INDEXABLE_ROUTES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
];

/** بناء XML الخريطة — نقية وقابلة للاختبار */
export function generateSitemapXml(origin, routes = INDEXABLE_ROUTES) {
  const base = origin.replace(/\/+$/, '');
  const today = new Date().toISOString().slice(0, 10);
  const urls = routes
    .map((r) => {
      const p = r.path.startsWith('/') ? r.path : `/${r.path}`;
      const freq = r.changefreq ? `<changefreq>${r.changefreq}</changefreq>` : '';
      const prio = r.priority ? `<priority>${r.priority}</priority>` : '';
      return `  <url><loc>${base}${p}</loc><lastmod>${today}</lastmod>${freq}${prio}</url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

// ─── التنفيذ المباشر فقط (وليس عند الاستيراد من الاختبارات) ───
const invokedDirectly = (() => {
  try {
    return process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  const origin = (process.env.VITE_SITE_URL || process.env.SITE_URL || '').trim();
  if (!origin) {
    console.log('[sitemap] VITE_SITE_URL غير مضبوط — تخطي توليد sitemap.xml (مسموح)');
  } else {
    const distDir = path.join(__dirname, '..', 'dist');
    if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });
    const xml = generateSitemapXml(origin);
    writeFileSync(path.join(distDir, 'sitemap.xml'), xml, 'utf8');
    console.log(`[sitemap] ✅ dist/sitemap.xml (${INDEXABLE_ROUTES.length} مسار) — الأصل: ${origin}`);
  }
}
