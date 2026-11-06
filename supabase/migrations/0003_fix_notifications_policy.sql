-- ═══════════════════════════════════════════════════════════════
-- 0003: إصلاح سياسة الإشعارات — منع الاستعلام المباشر من auth.users
-- المشكلة: سياسة notifications_self كانت تستعلم (select email from auth.users)
-- ودور anon/authenticated لا يملك صلاحية القراءة من auth schema، فينهار
-- تقييم السياسة بخطأ 42501 بدل أن يُرجع النتائج المسموحة.
-- الحل: قراءة البريد من ادعاءات JWT نفسها (auth.jwt()->>'email') —
-- نمط Supabase القياسي، بلا صلاحيات إضافية وبلا تسريب.
-- ═══════════════════════════════════════════════════════════════

drop policy if exists notifications_self on public.notifications;

create policy notifications_self on public.notifications
  for select using (
    to_user = auth.uid()
    or to_email = auth.jwt()->>'email'
  );
