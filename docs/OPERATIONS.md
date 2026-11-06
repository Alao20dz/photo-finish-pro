# دليل العمليات — Photo Finish Pro (منصة SaaS متعددة البطولات)

> المرجع التشغيلي الكامل: النشر، المصادقة، النسخ الاحتياطي، تدوير الأسرار،
> وطوارئ يوم السباق. للمعمارية التقنية انظر `README.md` الرئيسي، ولمخطط
> القاعدة انظر `supabase/README.md`.

---

## 1. خريطة الوصول (Entry Map)

كل الشاشات تُصل من نطاق واحد (Hash Router — لا يحتاج إعادة نشر لكل دور):

| الوصول | الشاشة | الجمهور |
| --- | --- | --- |
| `https://<domain>/` | الموقع العام (الرابطات + صفحات الرابطات) | الجميع (زوار) |
| `https://<domain>/#/league/<uuid>` | صفحة رابطة محددة | الجميع |
| `https://<domain>/#/compete` | وضع المنافسة (اختيار الدور) | الحكام الميدانيون |
| `https://<domain>/?role=<role>&room=<code>` | دخول مباشر لهاتف ميداني (QR) | هواتف السباق |
| `https://<domain>/#/manage` | بوابة مدير الرابطة (تسجيل دخول) | أعضاء الرابطة |
| `https://<domain>/#/coach` | بوابة المدرب (إدارة عدّائه وتسجيلاته) | مدربو الأندية |
| `https://<domain>/?admin` | ADMIN SUITE (إصدار التراخيص) | مدير المنصة |

**القاعدة الذهبية:** `?admin` و `?role=`/`?room=` القديمة تتقدمان على كل شيء
(توافق مضمون مع QR المطبوعة سابقاً — لا تُكسر أبداً).

### أدوار أعضاء الرابطة (`league_members.role`)

| الدور | الوصف | صلاحية الكتابة الاعتيادية | عمليات AAL2 |
| --- | --- | --- | --- |
| `executive_manager` | المدير التنفيذي | ✔ كاملة | إصدار أكواد المنافسة، اعتماد التسجيلات، منح الأدوار |
| `tech_manager` | المدير التقني | ✔ كاملة | نفس أعلاه |
| `secretary` | أمين المكتب | إدخال وتحرير | اعتماد التسجيلات (يتطلب MFA) |
| `results_clerk` | كاتب النتائج | إدخال النتائج | نشر النتائج الرسمية (يتطلب MFA) |

## 2. المصادقة و MFA (AAL2)

تسلسل الدخول في `#/manage` (خدمة `src/services/authService.ts`):

1. **البريد + كلمة السر** → `supabase.auth.signInWithPassword` — الجلسة `aal1`.
2. **بوابة MFA** (`MfaGateModal`):
   - إن لم يملك العضو عاملاً مسجلاً → شاشة **التسجيل الإلزامي**:
     QR (تطبيق Google Authenticator / Authy) + تأكيد برمز 6 أرقام
     (`enrollTotp` ثم `verifyEnrollment`).
   - إن كان لديه عامل مسجل → **تحدي**: `challengeTotp` + `verifyChallenge`.
3. بعد النجاح يُتحقق فعلياً `currentAal() === 'aal2'` قبل فتح اللوحة.

**لماذا؟** سياسات RESTRICTIVE في قاعدة البيانات (ترحيلات 0004–0006) ترفض
الكتابات الحساسة (إصدار أكواد، منح أدوار، اعتماد تسجيلات، نشر نتائج) إلا من
جلسة `aal2`. الواجهة لا تستطيع تخطيها — الحماية خادمية.

**فقد العضو تطبيق المصادقة؟** مدير المنصة يعيد ضبط العامل من
Dashboard → Authentication → Users → (المستخدم) → Two Factor Auth (إزالة
العامل) ثم العضو يعيد التسجيل من بوابة `#/manage`.

## 3. متغيرات البيئة

### الواجهة (`photo-finish-main/.env` — عامة بحكم التصميم)

| المتغير | الوصف |
| --- | --- |
| `VITE_SUPABASE_URL` | رابط المشروع (`https://<ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | المفتاح العام (`sb_publishable_...`) — الحماية عبر RLS |
| `VITE_RELAY_WS_URL` | اختياري: خادم الترحيل `wss://...` للتزامن الميداني |
| `VITE_SYNC_API_URL` | اختياري: خادم مزامنة REST (غالباً نفس الترحيل) |
| `VITE_LICENSE_PUBLIC_KEY` | مفتاح Ed25519 العام للتحقق أوفلاين من التراخيص |

### الخادم (بيئة النشر فقط — لا تُوضع في الواجهة أبداً)

| المتغير | الوصف |
| --- | --- |
| `LICENSE_PRIVATE_KEY_BASE64` | مفتاح إصدار التراخيص (خادمي حصراً) |
| `ADMIN_PORTAL_PASSWORD` | كلمة بوابة `?admin` (أو فارغة ليولّد عشوائياً) |
| `PORT` | منفذ خادم الترحيل/المزامنة (افتراضي 3001) |

### أدوات التشغيل (جهاز المهندس / CI)

| المتغير | الوصف |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | واجهة CLI و Management API (`supabase.com/dashboard/account/tokens`) |
| `SUPABASE_PROJECT_REF` | رمز المشروع (من رابط Dashboard) |
| `SUPABASE_DB_URL` | بديل: سلسلة اتصال Postgres مباشرة (مسار pg_dump) |

## 4. النشر (Deployment)

### 4.1 قاعدة البيانات (Supabase)

```bash
# مطبّق حالياً: 0001 → 0011 (مصدر الحقيقة: supabase/migrations — لا تعديل يدوي)
export SUPABASE_ACCESS_TOKEN='...'
npx supabase db push --remote --yes        # من جذر المستودع (supabase/config.toml)
npx supabase migration list --remote       # تحقق: Local == Remote
```

بعد إنشاء مشروع جديد (ترحيل أو استعادة): اضبط `VITE_SUPABASE_URL/ANON_KEY`
في Vercel ثم أعد النشر، وسجّل الدخول من `#/manage` لإعادة تسجيل MFA.

### 4.2 الواجهة (Vercel — مرتبط بـ GitHub)

- أي `git push` إلى `main` = نشر تلقائي + CI (`.github/workflows/ci.yml`):
  typecheck → 302 اختباراً → build → رفع `dist` كـ artifact.
- الإعدادات: Framework **Vite**، Root Directory = `photo-finish-main`،
  وبناء `npm run build`. متغيرات `VITE_*` من القسم 3.
- PWA: بعد أول زيارة، زر «ثبّت التطبيق» — تحديث النسخة يُكتشف تلقائياً.

### 4.3 خادم الترحيل الميداني (اختياري — كمون منخفض)

- مجلد `photo-finish-main/relay-server/` جاهز لـ Render/Railway
  (انظر `relay-server/render.yaml` و `relay-server/README.md`).
- بعد النشر: `VITE_RELAY_WS_URL=wss://<host>` ثم إعادة نشر الواجهة.
- الشبكة المحلية تعمل بلا هذا الخادم (WebSocket مدمج + BroadcastChannel)،
  وMQTT احتياط تلقائي عبر شركات الاتصال المختلفة.

## 5. النسخ الاحتياطي والاستعادة

### المبدأ
- **المخطط** مصدره `supabase/migrations/` في git — محفوظ تلقائياً مع كل commit.
- **البيانات** تحتاج تصديراً دورياً — خطة Supabase المجانية **بلا نسخ احتياطي
  مضمونة** والمشروع يتوقف عند الخمول.

### المسارات الثلاثة لـ `supabase/scripts/backup.sh`

| المسار | المتطلبات | يُنتج |
| --- | --- | --- |
| `docker` (الأشمل) | Docker + TOKEN + REF | roles.sql + schema.sql + data.sql |
| `pg` | pg_dump + `SUPABASE_DB_URL` | roles(اختياري) + schema + data |
| `api` (صفر اعتماديات) | TOKEN + REF + curl | كل جداول public كـ JSON + بيان SHA-256 |

السكربت يختار تلقائياً: docker → pg → api. فرض مسار: `--docker` / `--pg` / `--api`.

```bash
export SUPABASE_ACCESS_TOKEN='...' SUPABASE_PROJECT_REF='...'
bash supabase/scripts/backup.sh              # لقطة كاملة إلى backups/<timestamp>/
KEEP_DAYS=60 bash supabase/scripts/backup.sh # مع احتفاظ 60 يوماً
```

### الاستعادة

| المصدر | الأداة |
| --- | --- |
| نسخة docker/pg | `bash supabase/scripts/restore.sh backups/<ts> TARGET_DB_URL` (psql) |
| نسخة API (JSON) | `bash supabase/scripts/restore_api.sh backups/<ts>` (نفس قناة API) — جرّب أولاً `--dry-run` |

قواعد صارمة: **لا استعادة على مشروع إنتاج حي** — أنشئ مشروعاً جديداً،
استعد، تحقق (دخول مدير + الموقع العام + الأعداد)، ثم وجّه `VITE_SUPABASE_URL`
إليه.

### الجدولة
- **CI مجدول**: `.github/workflows/backup.yml` كل أحد 03:00 UTC — يرفع
  artifact لمدة 60 يوماً. التفعيل: أضف سرّي المستودع `SUPABASE_ACCESS_TOKEN`
  و `SUPABASE_PROJECT_REF` (يتخطى نفسه بأمان غيابهما).
- **يدوي ميداني قبل كل بطولة**: شغّل `backup.sh --api` من أي جهاز — دقيقة واحدة.

### اختبار الجدارة (يُنفَّذ كل 3 أشهر)
استعد أحدث نسخة على مشروع Supabase مؤقت جديد وتحقق من الدخول والعرض —
نسخة لا تُستعاد ليست نسخة.

## 6. تدوير الأسرار (Rotation Runbook)

> قاعدة: كل سرّ ظهر يوماً في دردشة/تذكرة/لقطة شاشة يُعتبر مكشوفاً نهائياً.

| السر | أين يُدار | إجراء التدوير |
| --- | --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Dashboard → Account → Access Tokens | Generate new → حُدِّث CI/الجهاز → Revoke القديم فوراً |
| GitHub PAT (دفع المستودع) | GitHub → Settings → Developer settings → Tokens | New token (نطاق repo) → حُدِّث النشر → حذف القديم |
| `ADMIN_PORTAL_PASSWORD` | بيئة خادم التراخيص | كلمة جديدة قوية → restart الخادم |
| `LICENSE_PRIVATE_KEY_BASE64` | بيئة الخادم | زوج مفاتيح جديد → Public Key الجديد في `VITE_...` → **إصدار تراخيص جديدة لكل العملاء وإبطال القديمة** |
| كلمات مرور الأعضاء | Supabase Auth | من لوحة كل عضو: Send password recovery |

بعد أي تدوير: راقب أول تشغيل CI (نسخة جديدة من token) وسجل دخول تجريبي
من `#/manage`.

## 7. طوارئ يوم السباق (Field Runbook)

| العرض | السبب المرجح | الإجراء |
| --- | --- | --- |
| خطأ `42501 row-level security` | جلسة `aal1` على عملية حساسة | أكمل تحدي MFA من البوابة ثم أعد العملية |
| الموقع العام يعرض «نسخة مخزنة» | انقطاع شبكة الزائر | طبيعي (offline-first) — تتحدث تلقائياً عند عودة الاتصال |
| هواتف الميدان لا تتزامن | لا WebSocket محلي ولا relay | تحقق من `VITE_RELAY_WS_URL` — MQTT يبقى يعمل احتياطاً |
| نُسيت كلمة مرور عضو | — | Send password recovery من Dashboard ثم دخول من `#/manage` |
| فقد TOTP | هاتف ضائع | إزالة العامل من Dashboard (قسم 2) وإعادة تسجيل |
| نتائج لا تُنشر | كاتب النتائج بلا MFA | بوابة `#/manage` تكمل التسجيل/التحدي قبل النشر |

**قاعدة ميدانية**: التوقيت والصورة تعمل أوفلاين بالكامل (PWA + IndexedDB) —
أي انقطاع إنترنت لا يوقف سباقاً أبداً؛ المزامنة تلتقط ما فاته عند العودة.

## 8. قائمة فحص ما قبل البطولة (Pre-Race Checklist)

- [ ] نسخة احتياطية طازجة (`backup.sh --api`) قبل فتح التسجيل
- [ ] حالة الرابطة `active` والتظاهرة `published` أو `registration_open`
- [ ] تسجيل دخول تجريبي من `#/manage` لكل عضو (بما فيه تحدي MFA)
- [ ] تجربة QR لهاتف واحد على الأقل لكل دور ميداني
- [ ] CI أخضر على آخر commit (شارة README)
- [ ] بطارية/حامل هاتف الكاميرا + محاذاة خط النهاية مُجرَّبة
- [ ] إنترنت الموقع مُجرَّب من هاتفين على شبكتين مختلفتين (Mobilis/Djezzy/Ooredoo)

## 9. حدود الخطة المجانية (Free Tier)

- المشروع يتوقف بعد أسبوع خمول — تفعيل دوري (CI المجدول نفسه يلمس API للنسخ).
- **لا نسخ احتياطية مضمونة** — القسم 5 إلزامي، لا اختياري.
- راجع صفحة الأسعار الرسمية قبل الاعتماد على أي رقم (تتغير دورياً).
- **لا تُجرى بطولة رسمية على مشروع بلا نسخ احتياطية مُختبَرة الجدارة.**
