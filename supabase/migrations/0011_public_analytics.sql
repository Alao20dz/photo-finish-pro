-- ═══════════════════════════════════════════════════════════════
-- 0011: تحليلات الموقع العمومي — خصوصية أولاً (المرحلة 8)
-- ═══════════════════════════════════════════════════════════════
-- مبادئ التصميم:
--  1. بلا كوكيز ولا بصمات ولا أسماء ولا عناوين IP — صفوف عدّ فقط:
--     المسار، نوع الحدث، اللغة، فئة الجهاز (mobile/desktop)، مُعرّف الرابطة.
--  2. الزائر المجهول (anon) يستطيع الإدراج حصراً — لا قراءة إطلاقاً
--     (RLS + revoke select عمقاً إضافياً).
--  3. القراءة عبر دالتي تجميع security definer بحارس عضوية صريح:
--     عضو الرابطة يرى إحصاءات رابطته مجمّعة فقط — لا صفوف خام.
--  4. لا استعلام auth.users داخل السياسات (درس 0003) — الحارس يستعمل
--     is_league_member المعمولة أصلاً في 0002 بنفس النمط الآمن.
-- ═══════════════════════════════════════════════════════════════

-- ─── جدول أحداث الزيارات (عدّ مجهول الهوية) ───
create table public.page_views (
  id            uuid primary key default gen_random_uuid(),
  -- نوع الحدث: مشاهدة صفحة / نقرة على دعوة المنافسة / مشاركة رابط
  kind          text not null default 'page_view'
                check (kind in ('page_view', 'cta_click', 'share')),
  -- المسار الداخلي (مطبّع في العميل، ≤ 300 حرف) مثال: /league/<uuid>
  path          text not null check (char_length(path) between 1 and 300),
  -- الرابطة المرتبطة إن وُجدت (اختياري — الرئيسية بلا رابطة)
  league_id     uuid references public.leagues(id) on delete set null,
  -- مضيف المُحيل فقط (hostname بلا مسار ولا query) — إن وُجد
  referrer_host text check (referrer_host is null or char_length(referrer_host) between 1 and 200),
  -- لغة الواجهة وقت الحدث
  lang          text not null default 'ar' check (lang in ('ar', 'fr')),
  -- فئة الجهاز التقريبية (من user-agent كفئة — لا بصمة)
  device        text not null default 'unknown' check (device in ('mobile', 'desktop', 'unknown')),
  -- اليوم (بتوقيت UTC) لتجميع سريع دون تواريخ معقدة
  day           date not null default current_date,
  created_at    timestamptz not null default now()
);

comment on table public.page_views is
  'تحليلات خصوصية-أولاً: أحداث عدّ مجهولة بلا كوكيز ولا IP ولا PII (المرحلة 8)';

create index page_views_league_day_idx on public.page_views (league_id, day);
create index page_views_created_idx    on public.page_views (created_at);

-- ─── RLS: تمكين + إلزام (اتساق مع بقية الجداول) ───
alter table public.page_views enable row level security;
alter table public.page_views force row level security;

-- الإدراج العمومي فقط (الزائر المجهول والمستخدمون) — بدون أي قراءة
create policy page_views_insert_public on public.page_views
  for insert to anon, authenticated
  with check (true);

-- مديرو المنصة يرون كل شيء (قراءة للدعم والاشراف)
create policy page_views_admin_read on public.page_views
  for select to authenticated
  using (public.is_platform_admin());

create policy page_views_admin_write on public.page_views
  for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy page_views_admin_delete on public.page_views
  for delete to authenticated
  using (public.is_platform_admin());

-- عمق إضافي: سحب صلاحية SELECT نفسها عن anon وauthenticated
-- (السياسات تكفي نظرياً — والسحب يمنع أي خطأ سياسة مستقبلي)
revoke select on public.page_views from anon, authenticated;

-- ─── دالتا تجميع لعضو الرابطة (security definer + حارس صريح) ───
-- ملاحظة أمنية: الحارس is_league_member يعتمد auth.uid() من JWT —
-- لا قراءة لأي بيانات خام، مخرجات مجمّعة باليوم/بالمسار فقط.

create or replace function public.league_analytics_daily(p_league_id uuid, p_days int default 30)
returns table (day date, views bigint, cta_clicks bigint)
language sql
stable
security definer
set search_path = public
as $$
  select pv.day,
         count(*) filter (where pv.kind = 'page_view') as views,
         count(*) filter (where pv.kind = 'cta_click') as cta_clicks
  from public.page_views pv
  where pv.league_id = p_league_id
    and public.is_league_member(p_league_id)          -- الحارس: عضو الرابطة حصراً
    and pv.created_at >= now() - make_interval(days => greatest(coalesce(p_days, 30), 1))
  group by pv.day
  order by pv.day asc;
$$;

create or replace function public.league_analytics_top(p_league_id uuid, p_days int default 30, p_limit int default 8)
returns table (path text, views bigint)
language sql
stable
security definer
set search_path = public
as $$
  select pv.path,
         count(*) filter (where pv.kind = 'page_view') as views
  from public.page_views pv
  where pv.league_id = p_league_id
    and public.is_league_member(p_league_id)          -- الحارس: عضو الرابطة حصراً
    and pv.created_at >= now() - make_interval(days => greatest(coalesce(p_days, 30), 1))
    and pv.path is not null
  group by pv.path
  order by views desc, pv.path asc
  limit greatest(coalesce(p_limit, 8), 1);
$$;

-- التنفيذ لأعضاء الرابطات (authenticated) حصراً — سحبها عن عام والمجهول
revoke execute on function public.league_analytics_daily(uuid, int) from public, anon;
revoke execute on function public.league_analytics_top(uuid, int, int) from public, anon;
grant  execute on function public.league_analytics_daily(uuid, int) to authenticated;
grant  execute on function public.league_analytics_top(uuid, int, int) to authenticated;
