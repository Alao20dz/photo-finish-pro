-- ═══════════════════════════════════════════════════════════════
-- 0009: تصحيح نطاق بوابة MFA — كتابة حصراً (نمط 0005 نفسه)
-- ═══════════════════════════════════════════════════════════════
-- المشكلة: سياسات 0008 التقييدية (RESTRICTIVE) بصيغة FOR ALL على
-- event_results وevents كانت ستحجب قراءة الموظفين اليومية لبيانات
-- رابطتهم (SELECT تدخل في FOR ALL) — نفس الخلل الذي صحّحه 0005.
-- الحل: تفكيك كل بوابة إلى INSERT/UPDATE/DELETE تقييدية منفصلة،
-- فتبقى القراءة حرة لأعضاء الرابطة والكتابة الحساسة خلف AAL2.
-- ═══════════════════════════════════════════════════════════════

-- ─── event_results: بوابة الكتابة حصراً ───
drop policy if exists results_mfa on public.event_results;
create policy results_mfa_ins on public.event_results
  as restrictive for insert
  with check (public.mfa_gate(is_platform_admin() or is_league_member(league_id)));
create policy results_mfa_upd on public.event_results
  as restrictive for update
  using (public.mfa_gate(is_platform_admin() or is_league_member(league_id)))
  with check (public.mfa_gate(is_platform_admin() or is_league_member(league_id)));
create policy results_mfa_del on public.event_results
  as restrictive for delete
  using (public.mfa_gate(is_platform_admin() or is_league_member(league_id)));

-- ─── events: بوابة الكتابة حصراً ───
drop policy if exists events_mfa on public.events;
create policy events_mfa_ins on public.events
  as restrictive for insert
  with check (public.mfa_gate(
    is_platform_admin()
    or is_league_member((select league_id from public.competitions c where c.id = competition_id))
  ));
create policy events_mfa_upd on public.events
  as restrictive for update
  using (public.mfa_gate(
    is_platform_admin()
    or is_league_member((select league_id from public.competitions c where c.id = competition_id))
  ))
  with check (public.mfa_gate(
    is_platform_admin()
    or is_league_member((select league_id from public.competitions c where c.id = competition_id))
  ));
create policy events_mfa_del on public.events
  as restrictive for delete
  using (public.mfa_gate(
    is_platform_admin()
    or is_league_member((select league_id from public.competitions c where c.id = competition_id))
  ));
