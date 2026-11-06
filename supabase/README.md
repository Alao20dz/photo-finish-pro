# مجلد Supabase — مصدر الحقيقة الوحيد للخلفية

## البنية (الحالة الفعلية)
```
supabase/
├── config.toml                 # إعدادات المشروع (Supabase CLI v3)
├── migrations/                 # مصدر الحقيقة الوحيد للمخطط (لا تعديل يدوي من اللوحة)
│   ├── 0001_initial_schema.sql            # الجداول + الفهارس + المشغّلات
│   ├── 0002_rls_policies.sql              # RLS الشامل + دوال المساعدة + Views عامة
│   ├── 0003_fix_notifications_policy.sql  # إصلاح سياسة الإشعارات (auth.jwt())
│   ├── 0004_mfa_enforcement.sql           # بوابة MFA AAL2 (RESTRICTIVE) للكتابات الحساسة
│   ├── 0005_fix_mfa_scope_and_coach_self_approval.sql
│   ├── 0006_fix_aal_claim_value.sql       # 'aal2' وفق مواصفة JWT الرسمية
│   ├── 0007_medical_certificates_storage.sql # مخزن خاص بشهادات المدربين
│   ├── 0008_competition_results.sql       # نشر النتائج الرسمية
│   ├── 0009_fix_results_mfa_scope.sql
│   ├── 0010_realtime_signals.sql          # بث أحداث تغيّر الرابطة (rt_signal_change)
│   └── 0011_public_analytics.sql          # page_views + RPC التحليلات العامة
├── scripts/
│   ├── backup.sh               # نسخ احتياطي: docker | pg | api (تلقائي — انظر OPERATIONS.md)
│   ├── restore.sh              # استعادة نسخة SQL إلى مشروع هدف (psql)
│   └── restore_api.sh          # استعادة نسخة JSON عبر Management API (--dry-run للفحص)
└── tests/
    ├── rls_test.sql / rls_anon_test.sql     # اختبارات pgTAP / SQL محلية
    ├── run_cloud_rls_tests.py               # 18 اختبار RLS سحابياً (معاملات صفرية الأثر)
    └── *_cloud_test.sql                     # سيناريوهات سحابية (نتائج، realtime، تحليلات)
```

> ملاحظة: `functions/` (Edge Functions) غير موجودة حالياً — كل المنطق
> الحساس في دوال SQL داخل الترحيلات وسياسات RLS.

## المتغيرات المستخدمة في الواجهة (photo-finish-main)
```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
```
(يقرؤها `src/services/supabaseClient.ts` — أسماء `NEXT_PUBLIC_*` قديمة ولا يستخدمها التطبيق.)

## العمليات السحابية اليومية
```bash
# من جذر المستودع:
export SUPABASE_ACCESS_TOKEN='...'
npx supabase db push --remote --yes            # تطبيق الترحيلات
npx supabase migration list --remote           # Local == Remote؟
python3 supabase/tests/run_cloud_rls_tests.py  # 18 اختباراً (لا يترك أثراً)
bash supabase/scripts/backup.sh                # نسخة احتياطية (docker→pg→api تلقائياً)
```

## قواعد أمنية إلزامية (مطبقة في الترحيلات)
1. **RLS مفعّل + مفروض (`force`) على كل جدول** — لا جدول بلا RLS.
2. **الأدوار من الجداول** (`league_members`, `platform_admins`, `club_coaches`) عبر دوال
   `security definer` — لا اعتماد على `user_metadata` القابلة للتعديل.
3. **لا استعلام `auth.users` من داخل السياسات** — يُكسر تقييم anon (42501)؛
   البديل المعتمد: `auth.jwt()->>'email'`.
4. **تجزئة أكواد وضع المنافسة فقط** (`code_hash`) — الكود الأصلي يُعرض مرة واحدة عند الإصدار.
5. **كل تعديل رسمي يُسجَّل تلقائياً** في `audit_log` بمشغّلات قاعدية.
6. **Views عامة** للزوار بأعمدة عامة فقط — لا تاريخ ميلاد كامل للقاصرين (draft مستثنى).
7. **MFA (AAL2)** يُفرض بسياسات RESTRICTIVE على العمليات الحساسة
   (إصدار الأكواد، منح الأدوار، اعتماد التسجيلات، نشر النتائج) — claim `'aal2'` الرسمي.

## النسخ الاحتياطي والاستعادة
- **المخطط**: محفوظ تلقائياً في git عبر الترحيلات.
- **البيانات**: `scripts/backup.sh` (مسارات docker/pg/api — تفصيل كامل في
  [`docs/OPERATIONS.md`](../docs/OPERATIONS.md)) + جدولة أسبوعية CI
  (`.github/workflows/backup.yml` — يكفي ضبط سرّي `SUPABASE_ACCESS_TOKEN`
  و `SUPABASE_PROJECT_REF` للمستودع).
- **الاستعادة**: `restore.sh` (SQL/psql) أو `restore_api.sh` (JSON — جرّب `--dry-run` أولاً).
- **اختبار الجدارة**: استعد أحدث نسخة على مشروع مؤقت كل 3 أشهر.

## حدود الخطة المجانية
- راجع صفحة الأسعار الرسمية قبل الاعتماد على أي رقم (تتغير دورياً).
- المشاريع المجانية تتوقف عند الخمول وبلا نسخ احتياطي مضمون:
  CI المجدول أعلاه يغطي الاثنين (يعمل أسبوعياً وينشئ نسخة).
- **لا تُجرَ بطولة رسمية على مشروع بلا نسخ احتياطية مُختبَرة الجدارة.**
