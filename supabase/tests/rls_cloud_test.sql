-- ═══════════════════════════════════════════════════════════════
-- اختبارات RLS السحابية — Photo Finish Pro (12 اختباراً)
-- تشغيل: python3 scripts/run_cloud_rls_tests.py
-- الآلية: معاملة واحدة + بيانات تجريبية ثابتة + انتحال هويات عبر
--   ادعاءات JWT (نمط Supabase المعتمد) + حُكم نهائي عبر استثناء
--   يُرجع ملخصاً JSON — والمعاملة تتراجع كلياً مهما كانت النتيجة
--   (صفر أثر على قاعدة الإنتاج).
-- ملاحظة: pg_temp لا يُبحث لأسماء الدوال إلا بتحديد صريح pg_temp.<fn>
-- ═══════════════════════════════════════════════════════════════

begin;

-- ═══ معرفات ثابتة (لتكرارية الاختبار) ═══
-- admin  = 11111111-1111-1111-1111-111111111111  مدير منصة
-- exec_a = 22222222-2222-2222-2222-222222222222  مدير تنفيذي رابطة أ
-- exec_b = 33333333-3333-3333-3333-333333333333  مدير تنفيذي رابطة ب
-- coach  = 44444444-4444-4444-4444-444444444444  مدرب نادي أ1
-- judge  = 55555555-5555-5555-5555-555555555555  حكم نقطة مراقبة بكود
-- league_a = aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
-- league_b = bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
-- club_a1  = c1111111-1111-1111-1111-111111111111
-- club_a2  = c2222222-2222-2222-2222-222222222222
-- club_b1  = c3333333-3333-3333-3333-333333333333
-- comp_a   = d1111111-1111-1111-1111-111111111111 (غير مدرجة — تُرى بكود)
-- comp_bdr = d2222222-2222-2222-2222-222222222222 (مسودة)
-- ev_a     = e1111111-1111-1111-1111-111111111111
-- ev_a2    = e2222222-2222-2222-2222-222222222222
-- ath1     = f1111111-1111-1111-1111-111111111111 (نادي أ1)
-- ath2     = f2222222-2222-2222-2222-222222222222 (نادي أ2)
-- ath3     = f3333333-3333-3333-3333-333333333333 (نادي ب1)
-- reg1     = 1a111111-1111-1111-1111-111111111111 (تسجيل مرسل)
-- reg2     = 1a222222-2222-2222-2222-222222222222 (تسجيل مرسل)
-- code1    = 2a111111-1111-1111-1111-111111111111

-- ═══ بيانات تجريبية ═══
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'pfp-admin@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'pfp-exec-a@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'pfp-exec-b@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'pfp-coach@test.local'),
  ('55555555-5555-5555-5555-555555555555', 'pfp-judge@test.local');

insert into public.platform_admins (user_id)
  values ('11111111-1111-1111-1111-111111111111');

insert into public.leagues (id, name_ar, wilaya, code, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'رابطة الاختبار أ', 'وهران', 'LIGA', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'رابطة الاختبار ب', 'الجزائر', 'LIGB', 'active'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'رابطة معلّقة', 'قسنطينة', 'LIGC', 'pending');

insert into public.league_members (league_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'executive_manager'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'executive_manager');

insert into public.clubs (id, league_id, name_ar, code, approval_status) values
  ('c1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'نادي أ1', 'CA1', 'approved'),
  ('c2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'نادي أ2', 'CA2', 'approved'),
  ('c3333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'نادي ب1', 'CB1', 'approved');

insert into public.club_coaches (club_id, user_id, status) values
  ('c1111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'approved');

insert into public.athletes (id, club_id, first_name, last_name, gender, birth_date) values
  ('f1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'عداء', 'أول', 'M', current_date - 7300),
  ('f2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 'عداءة', 'ثانية', 'F', current_date - 7000),
  ('f3333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'عداء', 'ثالث', 'M', current_date - 7100);

insert into public.competitions (id, league_id, title_ar, type, start_date, end_date, status, visibility) values
  ('d1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'تظاهرة أ', 'track', current_date + 10, current_date + 10, 'published', 'unlisted'),
  ('d2222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'مسودة ب', 'track', current_date + 30, current_date + 30, 'draft', 'public');

insert into public.events (id, competition_id, discipline, gender, category) values
  ('e1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', '100m', 'M', 'elite'),
  ('e2222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', '200m', 'M', 'elite');

insert into public.registrations (id, competition_id, event_id, athlete_id, club_id, status) values
  ('1a111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'submitted'),
  ('1a222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 'e2222222-2222-2222-2222-222222222222', 'f1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'submitted');

insert into public.competition_codes (id, competition_id, league_id, code_hash, code_masked, role, expires_at) values
  ('2a111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   repeat('x', 64), 'PF-****', 'checkpoint_judge', now() + interval '1 day');

insert into public.code_sessions (code_id, auth_user_id, device_id) values
  ('2a111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'dev-test-runner');

-- ═══ جدول النتائج ═══
create temp table test_results (test_name text, passed boolean, detail text);
grant select, insert on table pg_temp.test_results to anon, authenticated;

-- ═══ T1: كل جداول المخطط العام عليها RLS ═══
insert into pg_temp.test_results
select 'T1_rls_enabled_everywhere',
       not exists (select 1 from pg_tables where schemaname = 'public' and rowsecurity = false),
       'unguarded: ' || coalesce((select string_agg(tablename, ',') from pg_tables where schemaname = 'public' and rowsecurity = false), 'none');

-- ═══ تبديل الدور: من هنا نعمل بهوية authenticated وننوّع الادعاءات ═══
select set_config('role', 'authenticated', true);

-- ═══ T2: زائر بلا ادعاءات لا يرى أي تظاهرة ═══
select set_config('request.jwt.claims', '{}', true);
insert into pg_temp.test_results
select 'T2_visitor_empty_claims_sees_zero_competitions',
       (select count(*) from public.competitions) = 0,
       'count=' || (select count(*) from public.competitions);

-- ═══ T3: النشطة عامة بالتصميم (دليل عام)، والمعلّقة مخفية عن غير الأعضاء ═══
select set_config('request.jwt.claims',
  json_build_object('sub','22222222-2222-2222-2222-222222222222','role','authenticated','aal','aal1')::text, true);
insert into pg_temp.test_results
select 'T3_pending_league_hidden_from_non_member',
       (select count(*) from public.leagues) = 2
       and exists (select 1 from public.leagues where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
       and not exists (select 1 from public.leagues where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
       'count=' || (select count(*) from public.leagues) || ' (النشطتان فقط — المعلّقة مخفية)';

-- ═══ T4: عزل العدائين بين الرابطات ═══
insert into pg_temp.test_results
select 'T4_athletes_cross_league_isolation',
       (select count(*) from public.athletes) = 2
       and not exists (select 1 from public.athletes where id = 'f3333333-3333-3333-3333-333333333333'),
       'count=' || (select count(*) from public.athletes) || ' (متوقع 2: عداءا الرابطة أ فقط)';

-- ═══ T5: المدرب يرى عداءي ناديه فقط ═══
select set_config('request.jwt.claims',
  json_build_object('sub','44444444-4444-4444-4444-444444444444','role','authenticated','aal','aal1')::text, true);
insert into pg_temp.test_results
select 'T5_coach_own_club_athletes_only',
       (select count(*) from public.athletes) = 1
       and exists (select 1 from public.athletes where id = 'f1111111-1111-1111-1111-111111111111'),
       'count=' || (select count(*) from public.athletes);

-- ═══ T6: مدير المنصة يرى كل الرابطات ═══
select set_config('request.jwt.claims',
  json_build_object('sub','11111111-1111-1111-1111-111111111111','role','authenticated','aal','aal2')::text, true);
insert into pg_temp.test_results
select 'T6_platform_admin_sees_all_leagues',
       (select count(*) from public.leagues) = 3,
       'count=' || (select count(*) from public.leagues) || ' (يشمل المعلّقة — المدير يرى الكل)';

-- ═══ T7: المدرب لا يستطيع اعتماد تسجيله بنفسه (البتّ حصراً للرابطة) ═══
select set_config('request.jwt.claims',
  json_build_object('sub','44444444-4444-4444-4444-444444444444','role','authenticated','aal','aal1')::text, true);
do $$
begin
  begin
    update public.registrations set status = 'approved'
     where id = '1a222222-2222-2222-2222-222222222222';
    insert into pg_temp.test_results values ('T7_coach_cannot_self_approve', false, 'BUG: اعتماد ذاتي نجح — سياسة with check ناقصة');
  exception when insufficient_privilege then
    insert into pg_temp.test_results values ('T7_coach_cannot_self_approve', true, 'blocked by with-check RLS violation as expected (42501)');
  end;
end $$;

-- ═══ T8: مدير الرابطة (بجلسة AAL2) يبتّ في التسجيل ═══
select set_config('request.jwt.claims',
  json_build_object('sub','22222222-2222-2222-2222-222222222222','role','authenticated','aal','aal2')::text, true);
do $$
begin
  update public.registrations set status = 'approved', review_note = 'معتمد'
   where id = '1a111111-1111-1111-1111-111111111111';
  if found then
    insert into pg_temp.test_results values ('T8_exec_with_aal2_decides_registration', true, 'approved');
  else
    insert into pg_temp.test_results values ('T8_exec_with_aal2_decides_registration', false, 'update blocked unexpectedly');
  end if;
end $$;

-- ═══ T9: تجزئات الأكواد مخفية عن باقي الرابطات والزوار ═══
select set_config('request.jwt.claims',
  json_build_object('sub','33333333-3333-3333-3333-333333333333','role','authenticated','aal','aal1')::text, true);
insert into pg_temp.test_results
select 'T9_code_hashes_hidden_from_other_leagues',
       (select count(*) from public.competition_codes) = 0,
       'exec_b count=' || (select count(*) from public.competition_codes);
select set_config('request.jwt.claims', '{}', true);
insert into pg_temp.test_results
select 'T9b_code_hashes_hidden_from_visitor',
       (select count(*) from public.competition_codes) = 0,
       'visitor count=' || (select count(*) from public.competition_codes);

-- ═══ T10: حكم بكود نشط يرى تظاهرته غير المدرجة ومهامها ═══
select set_config('request.jwt.claims',
  json_build_object('sub','55555555-5555-5555-5555-555555555555','role','authenticated','aal','aal1')::text, true);
insert into pg_temp.test_results
select 'T10_judge_with_active_session_sees_assigned_comp',
       (select count(*) from public.competitions where id = 'd1111111-1111-1111-1111-111111111111') = 1
       and (select count(*) from public.events) = 2,
       'comps=' || (select count(*) from public.competitions) || ' events=' || (select count(*) from public.events);

-- ═══ T11: بوابة MFA — بدون AAL2 تُرفض كتابة التظاهرات، وبـ AAL2 تُقبل ═══
select set_config('request.jwt.claims',
  json_build_object('sub','22222222-2222-2222-2222-222222222222','role','authenticated','aal','aal1')::text, true);
do $$
begin
  update public.competitions set venue = 'مرفوض-بدون-MFA'
   where id = 'd1111111-1111-1111-1111-111111111111';
  if found then
    insert into pg_temp.test_results values ('T11_mfa_gate_blocks_aal1', false, 'BUG: كتابة نجحت بجلسة aal1');
  else
    insert into pg_temp.test_results values ('T11_mfa_gate_blocks_aal1', true, 'blocked as expected');
  end if;
end $$;
select set_config('request.jwt.claims',
  json_build_object('sub','22222222-2222-2222-2222-222222222222','role','authenticated','aal','aal2')::text, true);
do $$
begin
  update public.competitions set venue = 'مقبول-مع-MFA'
   where id = 'd1111111-1111-1111-1111-111111111111';
  if found then
    insert into pg_temp.test_results values ('T11b_mfa_gate_allows_al2', true, 'updated with aal2');
  else
    insert into pg_temp.test_results values ('T11b_mfa_gate_allows_al2', false, 'update blocked unexpectedly with aal2');
  end if;
end $$;

-- ═══ T12: سجل التدقيق حصراً لمديري المنصة ═══
select set_config('request.jwt.claims',
  json_build_object('sub','11111111-1111-1111-1111-111111111111','role','authenticated','aal','aal2')::text, true);
insert into pg_temp.test_results
select 'T12_audit_log_admin_only',
       (select count(*) from public.audit_log) >= 1,
       'admin count=' || (select count(*) from public.audit_log);
select set_config('request.jwt.claims',
  json_build_object('sub','33333333-3333-3333-3333-333333333333','role','authenticated','aal','aal1')::text, true);
insert into pg_temp.test_results
select 'T12b_audit_log_hidden_from_league_member',
       (select count(*) from public.audit_log) = 0,
       'exec_b count=' || (select count(*) from public.audit_log);

-- ═══ الحُكم النهائي (الاستثناء يتراجع عن كل المعاملة — صفر أثر) ═══
create function pg_temp.verdict() returns void language plpgsql as $$
declare fails int; total int; payload text;
begin
  select count(*), count(*) filter (where not passed) into total, fails from pg_temp.test_results;
  select coalesce(json_agg(json_build_object('test', test_name, 'detail', detail))::text, '[]')
    into payload from pg_temp.test_results where not passed;
  if fails > 0 then
    raise exception 'PFP_TESTS_FAILED total=% failed=% failures=%', total, fails, payload;
  else
    raise exception 'PFP_TESTS_PASSED total=%', total;
  end if;
end $$;
select pg_temp.verdict();
