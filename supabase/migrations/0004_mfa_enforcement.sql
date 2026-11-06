-- ═══════════════════════════════════════════════════════════════
-- 0004: فرض المصادقة متعددة العوامل MFA (AAL2) على العمليات الحساسة
-- ═══════════════════════════════════════════════════════════════
-- المبدأ: كل من يملك صلاحية كتابة رسمية (مديرو الرابطات ومنصة المنصة)
-- يجب أن تكون جلسته مرفوعة إلى Authenticator Assurance Level 2
-- (عبر تسجيل TOTP في Supabase Auth) قبل:
--   • تعديل بيانات الرابطة أو الأندية أو التظاهرات
--   • إصدار/إبطال أكواد وضع المنافسة
--   • منح/سحب أدوار الأعضاء (league_members)
--   • البتّ في التسجيلات (اعتماد/رفض) من طرف الرابطة
--
-- الآلية: سياسات RESTRICTIVE — تُضرب (AND) مع السياسات المسموحة
-- ولا تؤثر على من لا علاقة له بالعملية (المدربون والحكام ينتفعون
-- بالبند «غير المعني» داخل الشرط حتى لا يُحجب عملهم اليومي).
-- ═══════════════════════════════════════════════════════════════

-- ─── دالة فحص مستوى ضمان الجلسة ───
create or replace function public.aal2_required() returns boolean
language sql stable as $$
  select coalesce(auth.jwt()->>'aal', 'aal1') = 'al2';
$$;

-- شرط موحّد: المعني بالعملية (مدير منصة أو عضو الرابطة المعنية) يجب أن تكون
-- جلسته AAL2؛ غير المعني يمرّ (السياسات المسموحة تحجبه أصلاً حيث يجب).
create or replace function public.mfa_gate(is_involved boolean) returns boolean
language sql stable as $$
  select not is_involved or public.aal2_required();
$$;

-- ─── الرابطات: تعديل بيانات الرابطة ───
create policy leagues_mfa on public.leagues
  as restrictive for update
  using (public.mfa_gate(is_platform_admin() or is_league_member(id)));

-- ─── الأعضاء: منح/سحب الأدوار (أخطر عملية على الإطلاق) ───
create policy members_mfa on public.league_members
  as restrictive for all
  using (public.mfa_gate(is_platform_admin() or is_league_member(league_id)))
  with check (public.mfa_gate(is_platform_admin() or is_league_member(league_id)));

-- ─── الأندية: إنشاء/تعديل/تعليق ───
create policy clubs_mfa on public.clubs
  as restrictive for all
  using (public.mfa_gate(is_platform_admin() or is_league_member(league_id)))
  with check (public.mfa_gate(is_platform_admin() or is_league_member(league_id)));

-- ─── التظاهرات: إنشاء/نشر/تجميد ───
create policy competitions_mfa on public.competitions
  as restrictive for all
  using (public.mfa_gate(is_platform_admin() or is_league_member(league_id)))
  with check (public.mfa_gate(is_platform_admin() or is_league_member(league_id)));

-- ─── أكواد المنافسة: الإصدار والإبطال ───
create policy codes_mfa on public.competition_codes
  as restrictive for insert
  with check (public.mfa_gate(is_platform_admin() or is_league_member(league_id)));
create policy codes_mfa_revoke on public.competition_codes
  as restrictive for update
  using (public.mfa_gate(is_platform_admin() or is_league_member(league_id)))
  with check (public.mfa_gate(is_platform_admin() or is_league_member(league_id)));

-- ─── التسجيلات: بتّ الرابطة فقط يتطلب AAL2 (المدربون غير المعنيين يمرّون) ───
create policy registrations_mfa on public.registrations
  as restrictive for update
  using (public.mfa_gate(
    is_league_member((select league_id from public.competitions c where c.id = competition_id))
    or is_platform_admin()
  ))
  with check (public.mfa_gate(
    is_league_member((select league_id from public.competitions c where c.id = competition_id))
    or is_platform_admin()
  ));

-- ─── مديرو المنصة: إدارة المنح نفسها تتطلب AAL2 ───
create policy admins_mfa on public.platform_admins
  as restrictive for all
  using (public.mfa_gate(is_platform_admin()))
  with check (public.mfa_gate(is_platform_admin()));
