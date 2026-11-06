-- ═══════════════════════════════════════════════════════════════
-- 0005: تصحيحان من اختبارات RLS السحابية (T4/T7)
-- ═══════════════════════════════════════════════════════════════
-- التصحيح 1 — بوابة MFA للكتابة حصراً:
--   سياسات 0004 التقييدية (RESTRICTIVE) بصيغة FOR ALL كانت تحجب أيضاً
--   قراءة الموظفين لبيانات رابطتهم اليومية (league_members/clubs/competitions)
--   لأن FOR ALL تشمل SELECT. القراءة لا تتطلب MFA؛ الكتابة الحساسة فقط.
--   الحل: تفكيكها إلى سياسات INSERT/UPDATE/DELETE تقييدية منفصلة.
--
-- التصحيح 2 — ثغرة الاعتماد الذاتي (T7):
--   registrations_coach_update كانت with check بلا قيد على الحالة الجديدة،
--   فاستطاع المدرب تحويل تسجيله من submitted إلى approved بنفسه.
--   الحل: قيد with check على نفس حالات ما قبل البتّ حصراً.
-- ═══════════════════════════════════════════════════════════════

-- ─── التصحيح 1: league_members ───
drop policy if exists members_mfa on public.league_members;
create policy members_mfa_ins on public.league_members
  as restrictive for insert
  with check (public.mfa_gate(is_platform_admin() or is_league_member(league_id)));
create policy members_mfa_upd on public.league_members
  as restrictive for update
  using (public.mfa_gate(is_platform_admin() or is_league_member(league_id)))
  with check (public.mfa_gate(is_platform_admin() or is_league_member(league_id)));
create policy members_mfa_del on public.league_members
  as restrictive for delete
  using (public.mfa_gate(is_platform_admin() or is_league_member(league_id)));

-- ─── التصحيح 1: clubs ───
drop policy if exists clubs_mfa on public.clubs;
create policy clubs_mfa_ins on public.clubs
  as restrictive for insert
  with check (public.mfa_gate(is_platform_admin() or is_league_member(league_id)));
create policy clubs_mfa_upd on public.clubs
  as restrictive for update
  using (public.mfa_gate(is_platform_admin() or is_league_member(league_id)))
  with check (public.mfa_gate(is_platform_admin() or is_league_member(league_id)));
create policy clubs_mfa_del on public.clubs
  as restrictive for delete
  using (public.mfa_gate(is_platform_admin() or is_league_member(league_id)));

-- ─── التصحيح 1: competitions ───
drop policy if exists competitions_mfa on public.competitions;
create policy competitions_mfa_ins on public.competitions
  as restrictive for insert
  with check (public.mfa_gate(is_platform_admin() or is_league_member(league_id)));
create policy competitions_mfa_upd on public.competitions
  as restrictive for update
  using (public.mfa_gate(is_platform_admin() or is_league_member(league_id)))
  with check (public.mfa_gate(is_platform_admin() or is_league_member(league_id)));
create policy competitions_mfa_del on public.competitions
  as restrictive for delete
  using (public.mfa_gate(is_platform_admin() or is_league_member(league_id)));

-- ─── التصحيح 1: platform_admins ───
drop policy if exists admins_mfa on public.platform_admins;
create policy admins_mfa_ins on public.platform_admins
  as restrictive for insert
  with check (public.mfa_gate(is_platform_admin()));
create policy admins_mfa_upd on public.platform_admins
  as restrictive for update
  using (public.mfa_gate(is_platform_admin()))
  with check (public.mfa_gate(is_platform_admin()));
create policy admins_mfa_del on public.platform_admins
  as restrictive for delete
  using (public.mfa_gate(is_platform_admin()));

-- ─── التصحيح 2: المدرب لا يعتمد تسجيلاته بنفسه ───
drop policy if exists registrations_coach_update on public.registrations;
create policy registrations_coach_update on public.registrations
  for update
  using (is_club_coach(club_id) and status in ('draft','submitted','needs_edit'))
  with check (is_club_coach(club_id) and status in ('draft','submitted','needs_edit'));
