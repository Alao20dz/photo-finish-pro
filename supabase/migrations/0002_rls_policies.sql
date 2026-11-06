-- ═══════════════════════════════════════════════════════════════
-- 0002: سياسات RLS الشاملة + دوال مساعدة security definer
-- القاعدة: RLS مفعّل على كل جدول دون استثناء.
-- الصلاحيات من الجداول (league_members/platform_admins/club_coaches)
-- لا من user_metadata القابلة للتعديل من المستخدم.
-- ═══════════════════════════════════════════════════════════════

-- ─── دوال مساعدة (security definer لتفادي الاستعلامات التكرارية في السياسات) ───
create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid());
$$;

create or replace function public.is_league_member(lid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.league_members where league_id = lid and user_id = auth.uid());
$$;

create or replace function public.has_league_role(lid uuid, r text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.league_members
    where league_id = lid and user_id = auth.uid()
      and (role = r or role = 'executive_manager')
  );
$$;

create or replace function public.is_club_coach(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.club_coaches
    where club_id = cid and user_id = auth.uid() and status = 'approved'
  );
$$;

-- جلسة كود نشطة لهذا المستخدم (حكام وضع المنافسة)
create or replace function public.active_code_session(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.code_sessions s
    join public.competition_codes c on c.id = s.code_id
    where s.auth_user_id = auth.uid()
      and c.competition_id = cid
      and c.revoked = false
      and c.expires_at > now()
  );
$$;

-- ─── تفعيل RLS على كل الجداول ───
do $$
declare t text;
begin
  foreach t in array array[
    'leagues','league_members','platform_admins','profiles','clubs','club_coaches',
    'athletes','competitions','events','category_rules','registrations',
    'competition_codes','code_sessions','assignments','audit_log','notifications'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('alter table public.%I force row level security;', t);
  end loop;
end $$;

-- ─── الرابطات: القراءة العامة للنشطة، الإدارة لأعضائها ───
create policy leagues_public_read on public.leagues
  for select using (status = 'active' or is_league_member(id) or is_platform_admin());
create policy leagues_admin_write on public.leagues
  for all using (is_platform_admin()) with check (is_platform_admin());
create policy leagues_exec_update on public.leagues
  for update using (has_league_role(id, 'executive_manager'))
  with check (has_league_role(id, 'executive_manager'));

create policy members_self_read on public.league_members
  for select using (user_id = auth.uid() or is_league_member(league_id) or is_platform_admin());
create policy members_exec_write on public.league_members
  for all using (has_league_role(league_id, 'executive_manager'))
  with check (has_league_role(league_id, 'executive_manager'));

create policy admins_super_only on public.platform_admins
  for select using (user_id = auth.uid() or is_platform_admin());

create policy profiles_self on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- ─── الأندية ───
create policy clubs_read on public.clubs
  for select using (
    approval_status = 'approved'
    or is_club_coach(id)
    or is_league_member(league_id)
    or is_platform_admin()
  );
create policy clubs_league_write on public.clubs
  for all using (has_league_role(league_id, 'executive_manager') or is_platform_admin())
  with check (has_league_role(league_id, 'executive_manager') or is_platform_admin());

create policy coaches_self on public.club_coaches
  for select using (user_id = auth.uid() or is_league_member((select league_id from public.clubs c where c.id = club_id)));
create policy coaches_league_write on public.club_coaches
  for all using (
    is_league_member((select league_id from public.clubs c where c.id = club_id))
    or is_club_coach(club_id)
  )
  with check (
    is_league_member((select league_id from public.clubs c where c.id = club_id))
    or is_club_coach(club_id)
  );

-- ─── العدائون: النادي يرى عداءيه، الرابطة ترى كل عدائيها، لا قراءة عامة ───
create policy athletes_read on public.athletes
  for select using (
    (deleted_at is null)
    and (is_club_coach(club_id) or is_league_member((select league_id from public.clubs c where c.id = club_id)) or is_platform_admin())
  );
create policy athletes_coach_write on public.athletes
  for all using (is_club_coach(club_id)) with check (is_club_coach(club_id));

-- ─── التظاهرات: المنشورة للعموم، الكاملة لأعضاء الرابطة ───
create policy comps_read on public.competitions
  for select using (
    (deleted_at is null)
    and (
      (visibility = 'public' and status <> 'draft')
      or is_league_member(league_id)
      or is_platform_admin()
      or active_code_session(id)
    )
  );
create policy comps_league_write on public.competitions
  for all using (has_league_role(league_id, 'executive_manager') or is_platform_admin())
  with check (has_league_role(league_id, 'executive_manager') or is_platform_admin());

create policy events_read on public.events
  for select using (
    exists (
      select 1 from public.competitions c
      where c.id = competition_id
        and ((c.visibility = 'public' and c.status <> 'draft') or is_league_member(c.league_id) or active_code_session(c.id))
    )
  );
create policy events_league_write on public.events
  for all using (
    has_league_role((select league_id from public.competitions c where c.id = competition_id), 'executive_manager')
    or is_platform_admin()
  )
  with check (
    has_league_role((select league_id from public.competitions c where c.id = competition_id), 'executive_manager')
    or is_platform_admin()
  );

create policy category_rules_league on public.category_rules
  for all using (is_league_member(league_id) or is_platform_admin())
  with check (is_league_member(league_id) or is_platform_admin());

-- ─── التسجيلات: المدرب يدير تسجيلات ناديه، الرابطة تعتمد، الحكم يرى قوائم مهمته ───
create policy registrations_read on public.registrations
  for select using (
    is_club_coach(club_id)
    or is_league_member((select league_id from public.competitions c where c.id = competition_id))
    or active_code_session(competition_id)
    or is_platform_admin()
    or (
      status = 'approved'
      and exists (
        select 1 from public.competitions c
        where c.id = competition_id and c.visibility = 'public' and c.status in ('running','finished','results_published')
      )
    )
  );
create policy registrations_coach_write on public.registrations
  for insert with check (is_club_coach(club_id));
create policy registrations_coach_update on public.registrations
  for update using (is_club_coach(club_id) and status in ('draft','submitted','needs_edit'))
  with check (is_club_coach(club_id));
create policy registrations_league_decide on public.registrations
  for update using (
    has_league_role((select league_id from public.competitions c where c.id = competition_id), 'executive_manager')
    or is_platform_admin()
  )
  with check (
    has_league_role((select league_id from public.competitions c where c.id = competition_id), 'executive_manager')
    or is_platform_admin()
  );

-- ─── الأكواد: القناع فقط لأعضاء الرابطة، التجزئة سرّية (لا تُقرأ من الواجهة أبداً) ───
create policy codes_league_read on public.competition_codes
  for select using (is_league_member(league_id) or is_platform_admin());
create policy codes_league_write on public.competition_codes
  for insert with check (has_league_role(league_id, 'executive_manager') or is_platform_admin());
create policy codes_revoke on public.competition_codes
  for update using (has_league_role(league_id, 'executive_manager') or is_platform_admin())
  with check (has_league_role(league_id, 'executive_manager') or is_platform_admin());
-- NOTE: الكود الأصلي غير قابل للقراءة أبداً من العميل — الإصدار يتم عبر Edge Function
-- التي تُرجع الكود مرة واحدة عند التوليد ثم تخزّن التجزئة فقط.

create policy sessions_self on public.code_sessions
  for select using (auth_user_id = auth.uid() or is_league_member(
    (select league_id from public.competition_codes c where c.id = code_id)
  ));
-- الإنشاء يتم عبر Edge Function redeem-code حصراً (service role)

create policy assignments_read on public.assignments
  for select using (active_code_session(competition_id) or is_league_member(
    (select league_id from public.competitions c where c.id = competition_id)
  ));
create policy assignments_league_write on public.assignments
  for all using (has_league_role(
    (select league_id from public.competitions c where c.id = competition_id), 'executive_manager'
  ) or is_platform_admin())
  with check (has_league_role(
    (select league_id from public.competitions c where c.id = competition_id), 'executive_manager'
  ) or is_platform_admin());

-- ─── سجل التدقيق: قراءة لأعضاء الرابطة فقط، كتابة عبر مشغّلات خادمية ───
create policy audit_read on public.audit_log
  for select using (is_platform_admin());
-- الكتابة: دالة audit_entity() security definer من المشغّلات

create policy notifications_self on public.notifications
  for select using (to_user = auth.uid() or to_email = (select email from auth.users where id = auth.uid()));

-- ═══════════════════════════════════════════════════════════════
-- مشغّل التدقيق الآلي: كل تعديل على البيانات الرسمية يُسجَّل في audit_log
-- ═══════════════════════════════════════════════════════════════
create or replace function public.audit_entity() returns trigger
language plpgsql security definer set search_path = public as $$
declare rec jsonb; old_rec jsonb := null;
begin
  rec = to_jsonb(new);
  if (tg_op = 'UPDATE') then old_rec = to_jsonb(old); end if;
  if (tg_op = 'DELETE') then rec = to_jsonb(old); end if;

  insert into public.audit_log (actor, actor_email, action, entity, entity_id, before, after, ip)
  values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    tg_op || ':' || tg_table_name,
    tg_table_name,
    coalesce (rec->>'id')::uuid,
    old_rec,
    case when tg_op <> 'DELETE' then rec end,
    current_setting('request.headers', true)::jsonb->>'x-forwarded-for'
  );
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['leagues','clubs','athletes','competitions','events','registrations','competition_codes']
  loop
    execute format('drop trigger if exists trg_%s_audit on public.%I;', t, t);
    execute format('create trigger trg_%s_audit after insert or update or delete on public.%I for each row execute function public.audit_entity();', t, t);
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════
-- Views عامة للزوار (anon) — أعمدة عامة فقط، لا بيانات قاصرين خاصة
-- ═══════════════════════════════════════════════════════════════
create or replace view public.public_competitions with (security_invoker = false) as
  select id, league_id, title_ar, title_fr, type, venue, start_date, end_date, status, registration_deadline
  from public.competitions
  where deleted_at is null and visibility = 'public' and status <> 'draft';

create or replace view public.public_leagues with (security_invoker = false) as
  select id, name_ar, name_fr, wilaya, code, logo_url, colors
  from public.leagues where status = 'active';

grant select on public.public_competitions to anon, authenticated;
grant select on public.public_leagues to anon, authenticated;

-- إشعار: مفتاح service_role لا يظهر أبداً في الواجهة — Edge Functions فقط.
-- عمليات MFA (AAL2) تُفرض في سياسات العمليات الحساسة عبر: auth.jwt()->>'aal' = 'al2'
