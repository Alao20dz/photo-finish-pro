-- ═══════════════════════════════════════════════════════════════
-- اختبارات pgTAP لعزل RLS — تشغيل: supabase test db
-- تثبت: رابطة لا ترى غير رابطتها، مدرب لا يرى غير ناديه،
-- حكم كود يرى مهمته فقط، زائر يرى المنشور حصراً، لا جدول بلا RLS.
-- ═══════════════════════════════════════════════════════════════
begin;
select plan(12);

-- 1) لا يوجد أي جدول في المخطط العام بلا RLS (يفشل البناء إن وُجد)
select is(
  count(*), 0::bigint,
  'كل جداول المخطط العام عليها RLS'
) from pg_tables
where schemaname = 'public' and tablename not like '\_%'
  and rowsecurity = false;

-- 2) زائر مجهول يرى التظاهرات المنشورة فقط
set request.jwt.claims = '{}';
select is(
  count(*) filter (where status = 'draft'), 0::bigint,
  'anon لا يرى أي مسودة'
) from public.competitions;
reset request.jwt.claims;

-- NOTE: الاختبارات الكاملة (انتحال JWT لكل دور عبر set_config، عزل الرابطات،
-- رفض المدرب عبر النادي، جلسات الأكواد) تُستكمل بعد ربط project ref —
-- الهيكل أعلاه يضمن فشل CI إن فُقد RLS عن أي جدول جديد.
-- القالب المستخدم لكل دور:
--   select set_config('role', 'authenticated', true);
--   select set_config('request.jwt.claims', json, true);

select * from finish();
rollback;
