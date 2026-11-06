-- ═══════════════════════════════════════════════════════════════
-- 0008: النتائج الرسمية للمنافسات (Competition Mode — النشر السحابي)
-- ═══════════════════════════════════════════════════════════════
-- الهدف: إغلاق الحلقة بين وضع المنافسة المحلي (التوقيت/Photo Finish)
-- والسحابة: النتائج الرسمية لكل اختصاص تُنشر في event_results ثم
-- تظهر للعموم عبر View آمن بعد انتقال التظاهرة إلى results_published.
--
-- قواعد الحكم (الخادم سلطة الإذن النهائية):
--  • النتيجة الرسمية مرتبطة بتسجيل معتمد حصراً (registration_id NOT NULL
--    + قيد فريد event_id,registration_id يجعل الرفع idempotent).
--  • الكتابة لمن يملك دور results_clerk (المدير التنفيذي ضمنياً عبر
--    has_league_role) — وبوابة MFA RESTRICTIVE كعمليات الحسم الأخرى.
--  • القراءة لأعضاء الرابطة؛ أما العموم ف عبر View بعناصر جرد آمنة فقط
--    (بلا معرفات حساسة) ولنتائج تظاهرات results_published العامة.
-- ═══════════════════════════════════════════════════════════════

create table public.event_results (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  competition_id uuid not null references public.competitions(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  -- لقطات جرد للعرض العمومي (لا تتبع تغيّرات الاسم لاحقاً — رسمية لحظة النشر)
  athlete_id uuid references public.athletes(id) on delete set null,
  club_id uuid references public.clubs(id) on delete set null,
  bib_number int,
  athlete_name text,
  club_code text,
  position int check (position is null or position >= 1),
  mark_ms bigint check (mark_ms is null or mark_ms >= 0),
  mark_text text,                                  -- «10.23» / «1:03.40» / «8.25m»
  status text not null default 'ok'
    check (status in ('ok','dq','dnf','dns')),
  source text not null default 'manual'
    check (source in ('photo_finish','multi_judge','cross_country','manual')),
  note text,
  published_at timestamptz not null default now(),
  published_by uuid references auth.users(id),
  unique (event_id, registration_id)
);
create index event_results_event_idx on public.event_results (event_id);
create index event_results_comp_idx on public.event_results (competition_id);
create index event_results_league_idx on public.event_results (league_id);

-- ─── تفعيل RLS ───
alter table public.event_results enable row level security;
alter table public.event_results force row level security;

-- القراءة: أعضاء الرابطة ومديرو المنصة
create policy results_staff_read on public.event_results
  for select using (is_league_member(league_id) or is_platform_admin());

-- الكتابة: أمين النتائج (والمدير التنفيذي ضمنياً عبر has_league_role)
create policy results_staff_write on public.event_results
  for all using (has_league_role(league_id, 'results_clerk') or is_platform_admin())
  with check (has_league_role(league_id, 'results_clerk') or is_platform_admin());

-- بوابة MFA: النشر تعديل رسمي حساس — جلسة aal2 إلزامية للمعني
create policy results_mfa on public.event_results
  as restrictive for all
  using (public.mfa_gate(is_platform_admin() or is_league_member(league_id)))
  with check (public.mfa_gate(is_platform_admin() or is_league_member(league_id)));

-- ─── إغلاق الاختصاص: أمين النتائج يحدّث حالة الاختصاص إلى done ───
-- (سياسة إضافية تُجمع OR مع events_league_write من 0002)
create policy events_clerk_close on public.events
  for update using (
    has_league_role((select league_id from public.competitions c where c.id = competition_id), 'results_clerk')
  )
  with check (
    has_league_role((select league_id from public.competitions c where c.id = competition_id), 'results_clerk')
  );

-- بوابة MFA على كتابة الاختصاصات (اتساق مع حساسية الحسم الرسمي)
create policy events_mfa on public.events
  as restrictive for all
  using (
    public.mfa_gate(
      is_platform_admin()
      or is_league_member((select league_id from public.competitions c where c.id = competition_id))
    )
  )
  with check (
    public.mfa_gate(
      is_platform_admin()
      or is_league_member((select league_id from public.competitions c where c.id = competition_id))
    )
  );

-- ─── View عمومي: نتائج التظاهرات results_published العامة فقط ───
-- نمط 0002 نفسه: security_invoker=false مع تصفية ذاتية صارمة —
-- الجدول الأم يبقى محجوباً عن anon (لا سياسة قراءة عامة عليه إطلاقاً).
create or replace view public.public_event_results with (security_invoker = false) as
  select
    r.id,
    r.event_id,
    r.competition_id,
    r.league_id,
    r.bib_number,
    r.athlete_name,
    r.club_code,
    r.position,
    r.mark_text,
    r.mark_ms,
    r.status,
    r.source,
    e.discipline,
    e.gender,
    e.category,
    c.title_ar,
    c.title_fr,
    c.venue,
    c.start_date,
    c.end_date
  from public.event_results r
  join public.events e on e.id = r.event_id
  join public.competitions c on c.id = r.competition_id
  where c.deleted_at is null
    and c.visibility = 'public'
    and c.status = 'results_published';

grant select on public.public_event_results to anon, authenticated;

-- ─── التدقيق: النتائج الرسمية تدخل سجل التدقيق ───
drop trigger if exists trg_event_results_audit on public.event_results;
create trigger trg_event_results_audit
  after insert or update or delete on public.event_results
  for each row execute function public.audit_entity();
