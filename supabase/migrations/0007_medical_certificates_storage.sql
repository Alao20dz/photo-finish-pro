-- ═══════════════════════════════════════════════════════════════
-- 0007: حاوية الشهادات الطبية الخاصة (Medical Certificates Storage)
-- ═══════════════════════════════════════════════════════════════
-- المرحلة 5: بوابة المدرب — رفع الشهادات الطبية للعدائين.
-- الحاوية خاصة (private) تماماً؛ الوصول فقط عبر مسار مُقيّد:
--   {club_id}/{athlete_id}-{timestamp}.{ext}
--
-- من يقرأ؟
--   • مدرب النادي المعني (ملفات ناديه) — عبر club_coaches المعتمدة
--   • أعضاء الرابطة صاحبة النادي (للتحقق عند اعتماد التسجيلات)
--   • مديرو المنصة
-- من يرفع/يعدّل/يحذف؟
--   • مدرب النادي المعني حصراً — وبمجلد ناديه فقط (أول جزء من المسار)
--
-- الأمان: سياسات storage.objects تعتمد على دالة coached_club_ids()
-- (security definer محصورة بـ public) — لا حقن مسارات، ولا حاويات عامة.
-- ═══════════════════════════════════════════════════════════════

-- ─── الحاوية الخاصة: PDF/JPG/PNG بحد 5MB ───
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'medical-certificates',
  'medical-certificates',
  false,
  5242880, -- 5 MB
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─── أندية المدرب المعتمدين (دالة مساعدة محصورة) ───
create or replace function public.coached_club_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select cc.club_id
  from public.club_coaches cc
  where cc.user_id = auth.uid() and cc.status = 'approved'
$$;

-- ─── سياسات storage.objects للحاوية ───

-- الرفع: مدرب معتمد وبمجلد ناديه حصراً
create policy "medical_coach_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'medical-certificates'
    and (storage.foldername(name))[1] in (select public.coached_club_ids()::text)
  );

-- القراءة: مدرب النادي + أعضاء الرابطة صاحبة النادي + مديرو المنصة
create policy "medical_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'medical-certificates'
    and (
      (storage.foldername(name))[1] in (select public.coached_club_ids()::text)
      or exists (
        select 1
        from public.clubs c
        where c.id::text = (storage.foldername(name))[1]
          and c.league_id in (
            select lm.league_id from public.league_members lm where lm.user_id = auth.uid()
          )
      )
      or public.is_platform_admin()
    )
  );

-- التعديل/الحذف: مدرب النادي حصراً (استبدال شهادة منتهية مثلاً)
create policy "medical_coach_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'medical-certificates'
    and (storage.foldername(name))[1] in (select public.coached_club_ids()::text)
  )
  with check (
    bucket_id = 'medical-certificates'
    and (storage.foldername(name))[1] in (select public.coached_club_ids()::text)
  );

create policy "medical_coach_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'medical-certificates'
    and (storage.foldername(name))[1] in (select public.coached_club_ids()::text)
  );

-- ─── تحديث عمود مسار الشهادة في athletes مسموح أصلاً عبر
--     athletes_coach_write (is_club_coach) — لا تغيير مطلوب. ───
