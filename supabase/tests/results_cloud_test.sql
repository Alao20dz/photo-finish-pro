-- ═══════════════════════════════════════════════════════════════
-- اختبارات RLS السحابية — النتائج الرسمية (event_results / المرحلة 6)
-- 12 فحصاً: دور أمين النتائج، بوابة MFA على الكتابة حصراً، عزل الرابطات،
-- الرفع idempotent، الـ View العمومي، وسجل التدقيق.
-- نفس آلية المجموعة الرئيسية: معاملة واحدة تتراجع كلياً — صفر أثر.
-- ═══════════════════════════════════════════════════════════════

begin;

-- ═══ معرفات ثابتة ═══
-- exec_a   = 22222222-2222-2222-2222-222222222222 (مدير تنفيذي رابطة أ)
-- clerk    = 66666666-6666-6666-6666-666666666666 (أمين نتائج رابطة أ)
-- outsider = 77777777-7777-7777-7777-777777777777 (مدير تنفيذي رابطة ب)
-- admin    = 11111111-1111-1111-1111-111111111111 (مدير منصة — للتدقيق)
-- LIGA = aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
-- LIGB = bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
-- CA1  = c1111111-1111-1111-1111-111111111111
-- ath1 = f1111111-1111-1111-1111-111111111111
-- comp_res (عامة results_published) = d1111111-1111-1111-1111-111111111111
-- comp_run (عامة running)          = d3333333-3333-3333-3333-333333333333
-- comp_unl (غير مدرجة results_published) = d4444444-4444-4444-4444-444444444444
-- ev1 (comp_res) = e1111111-1111-1111-1111-111111111111
-- ev2 (comp_run) = e3333333-3333-3333-3333-333333333333
-- ev3 (comp_unl) = e4444444-4444-4444-4444-444444444444
-- reg1 (ev1, approved, صدر 7) = 1a111111-1111-1111-1111-111111111111
-- reg2 (ev2, approved, صدر 8) = 1a333333-3333-3333-3333-333333333333
-- reg3 (ev3, approved, صدر 9) = 1a444444-4444-4444-4444-444444444444

-- ═══ بيانات تجريبية ═══
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'pfp-admin@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'pfp-exec-a@test.local'),
  ('66666666-6666-6666-6666-666666666666', 'pfp-clerk@test.local'),
  ('77777777-7777-7777-7777-777777777777', 'pfp-outsider@test.local');

insert into public.platform_admins (user_id)
  values ('11111111-1111-1111-1111-111111111111');

insert into public.leagues (id, name_ar, wilaya, code, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'رابطة الاختبار أ', 'وهران', 'LIGA', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'رابطة الاختبار ب', 'الجزائر', 'LIGB', 'active');

insert into public.league_members (league_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'executive_manager'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'results_clerk'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '77777777-7777-7777-7777-777777777777', 'executive_manager');

insert into public.clubs (id, league_id, name_ar, code, approval_status) values
  ('c1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'نادي أ1', 'CA1', 'approved');

insert into public.athletes (id, club_id, first_name, last_name, gender, birth_date) values
  ('f1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'عداء', 'أول', 'M', current_date - 7300);

insert into public.competitions (id, league_id, title_ar, type, start_date, end_date, status, visibility) values
  ('d1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'تظاهرة منشورة النتائج', 'track', current_date - 5, current_date - 5, 'results_published', 'public'),
  ('d3333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'تظاهرة جارية', 'track', current_date, current_date, 'running', 'public'),
  ('d4444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'تظاهرة غير مدرجة', 'track', current_date - 3, current_date - 3, 'results_published', 'unlisted');

insert into public.events (id, competition_id, discipline, gender, category, status) values
  ('e1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', '100m', 'M', 'elite', 'running'),
  ('e3333333-3333-3333-3333-333333333333', 'd3333333-3333-3333-3333-333333333333', '200m', 'M', 'elite', 'running'),
  ('e4444444-4444-4444-4444-444444444444', 'd4444444-4444-4444-4444-444444444444', '400m', 'M', 'elite', 'done');

insert into public.registrations (id, competition_id, event_id, athlete_id, club_id, status, bib_number) values
  ('1a111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'approved', 7),
  ('1a333333-3333-3333-3333-333333333333', 'd3333333-3333-3333-3333-333333333333', 'e3333333-3333-3333-3333-333333333333', 'f1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'approved', 8),
  ('1a444444-4444-4444-4444-444444444444', 'd4444444-4444-4444-4444-444444444444', 'e4444444-4444-4444-4444-444444444444', 'f1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'approved', 9);

-- ═══ جدول النتائج ═══
create temp table res_results (test_name text, passed boolean, detail text);
grant select, insert on table pg_temp.res_results to anon, authenticated;

select set_config('role', 'authenticated', true);

-- ═══ R1: المدير التنفيذي بجلسة aal2 ينشر نتائج ═══
select set_config('request.jwt.claims',
  json_build_object('sub','22222222-2222-2222-2222-222222222222','role','authenticated','aal','aal2')::text, true);
do $$
begin
  insert into public.event_results
    (event_id, competition_id, league_id, registration_id, athlete_id, club_id,
     bib_number, athlete_name, club_code, position, mark_ms, mark_text, status, source, published_by)
  values
    ('e1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111',
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '1a111111-1111-1111-1111-111111111111',
     'f1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111',
     7, 'عداء أول', 'CA1', 1, 10234, '10.23', 'ok', 'photo_finish',
     '22222222-2222-2222-2222-222222222222');
  insert into pg_temp.res_results values ('R1_exec_publishes_with_aal2', true, 'inserted');
exception when others then
  insert into pg_temp.res_results values ('R1_exec_publishes_with_aal2', false, 'SQLERR: ' || SQLERRM);
end $$;

-- ═══ R2: أمين النتائج (results_clerk) ينشر + يغلق الاختصاص ═══
select set_config('request.jwt.claims',
  json_build_object('sub','66666666-6666-6666-6666-666666666666','role','authenticated','aal','aal2')::text, true);
do $$
declare ok_ins boolean := false; ok_upd boolean := false;
begin
  begin
    insert into public.event_results
      (event_id, competition_id, league_id, registration_id, athlete_id, club_id,
       bib_number, athlete_name, club_code, position, mark_ms, mark_text, status, source, published_by)
    values
      ('e3333333-3333-3333-3333-333333333333', 'd3333333-3333-3333-3333-333333333333',
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '1a333333-3333-3333-3333-333333333333',
       'f1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111',
       8, 'عداء أول', 'CA1', 1, 11450, '11.45', 'ok', 'photo_finish',
       '66666666-6666-6666-6666-666666666666');
    ok_ins := true;
  exception when others then ok_ins := false;
  end;
  begin
    update public.events set status = 'done' where id = 'e3333333-3333-3333-3333-333333333333';
    ok_upd := found;
  exception when others then ok_upd := false;
  end;
  insert into pg_temp.res_results values ('R2_clerk_publishes_and_closes_event', ok_ins and ok_upd,
    'insert=' || ok_ins || ' event_close=' || ok_upd);
end $$;

-- ═══ R3: مدير رابطة أخرى (بجلسة aal2) مرفوض — عزل الرابطات ═══
select set_config('request.jwt.claims',
  json_build_object('sub','77777777-7777-7777-7777-777777777777','role','authenticated','aal','aal2')::text, true);
do $$
begin
  begin
    insert into public.event_results
      (event_id, competition_id, league_id, registration_id, bib_number,
       athlete_name, club_code, position, mark_ms, mark_text, status, source)
    values
      ('e1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111',
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '1a111111-1111-1111-1111-111111111111',
       7, 'اختراق', 'HACK', 1, 1, '0.01', 'ok', 'manual');
    insert into pg_temp.res_results values ('R3_cross_league_write_blocked', false, 'BUG: كتابة من رابطة أخرى نجحت');
  exception when insufficient_privilege then
    insert into pg_temp.res_results values ('R3_cross_league_write_blocked', true, 'blocked by RLS (42501)');
  end;
end $$;

-- ═══ R4: المدير التنفيذي بجلسة aal1 مرفوض — بوابة MFA على الكتابة ═══
select set_config('request.jwt.claims',
  json_build_object('sub','22222222-2222-2222-2222-222222222222','role','authenticated','aal','aal1')::text, true);
do $$
begin
  begin
    insert into public.event_results
      (event_id, competition_id, league_id, registration_id, bib_number,
       athlete_name, club_code, position, mark_ms, mark_text, status, source)
    values
      ('e1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111',
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '1a111111-1111-1111-1111-111111111111',
       7, 'عداء أول', 'CA1', 2, 12000, '12.00', 'ok', 'manual');
    insert into pg_temp.res_results values ('R4_mfa_gate_blocks_aal1_write', false, 'BUG: كتابة نجحت بجلسة aal1');
  exception when insufficient_privilege then
    insert into pg_temp.res_results values ('R4_mfa_gate_blocks_aal1_write', true, 'blocked by MFA gate (42501)');
  end;
end $$;

-- ═══ R5: القراءة اليومية بلا MFA — موظف الرابطة (aal1) يرى نتائج رابطته حصراً ═══
select set_config('request.jwt.claims',
  json_build_object('sub','66666666-6666-6666-6666-666666666666','role','authenticated','aal','aal1')::text, true);
insert into pg_temp.res_results
select 'R5_clerk_reads_own_league_without_mfa',
       (select count(*) from public.event_results) = 2,
       'clerk count=' || (select count(*) from public.event_results) || ' (نتيجتا الرابطة أ فقط)';

select set_config('request.jwt.claims',
  json_build_object('sub','77777777-7777-7777-7777-777777777777','role','authenticated','aal','aal1')::text, true);
insert into pg_temp.res_results
select 'R5b_outsider_reads_zero_results',
       (select count(*) from public.event_results) = 0,
       'outsider count=' || (select count(*) from public.event_results);

-- ═══ R6: الرفع idempotent — نفس (event_id, registration_id) لا يكرّر الصف ═══
select set_config('request.jwt.claims',
  json_build_object('sub','22222222-2222-2222-2222-222222222222','role','authenticated','aal','aal2')::text, true);
do $$
begin
  insert into public.event_results
    (event_id, competition_id, league_id, registration_id, athlete_id, club_id,
     bib_number, athlete_name, club_code, position, mark_ms, mark_text, status, source)
  values
    ('e1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111',
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '1a111111-1111-1111-1111-111111111111',
     'f1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111',
     7, 'عداء أول', 'CA1', 1, 10210, '10.21', 'ok', 'photo_finish')
  on conflict (event_id, registration_id)
  do update set mark_ms = excluded.mark_ms, mark_text = excluded.mark_text, published_at = now();
  insert into pg_temp.res_results values ('R6_upsert_idempotent', true, 'upsert ok');
exception when others then
  insert into pg_temp.res_results values ('R6_upsert_idempotent', false, 'SQLERR: ' || SQLERRM);
end $$;
insert into pg_temp.res_results
select 'R6b_still_two_rows_after_upsert',
       (select count(*) from public.event_results) = 2,
       'count=' || (select count(*) from public.event_results) || ' (التكرار اندمج لا أُضيف)';

-- ═══ R7: سجل التدقيق — مدير المنصة يرى أثر النشر ═══
select set_config('request.jwt.claims',
  json_build_object('sub','11111111-1111-1111-1111-111111111111','role','authenticated','aal','aal2')::text, true);
insert into pg_temp.res_results
select 'R7_audit_log_tracks_event_results',
       (select count(*) from public.audit_log where entity = 'event_results') >= 2,
       'audit rows=' || (select count(*) from public.audit_log where entity = 'event_results');

-- ═══ تبديل إلى الزائر المجهول (اتجاه واحد — الفحوص العمومية آخراً) ═══
select set_config('role', 'anon', true);
select set_config('request.jwt.claims', '{}', true);

-- ═══ R8: anon محجوب عن الجدول مباشرة (لا سياسة قراءة عامة إطلاقاً) ═══
insert into pg_temp.res_results
select 'R8_anon_zero_direct_table',
       (select count(*) from public.event_results) = 0,
       'anon direct count=' || (select count(*) from public.event_results);

-- ═══ R9: الـ View العمومي يعرض نتائج results_published العامة فقط ═══
insert into pg_temp.res_results
select 'R9_view_exposes_published_public_only',
       (select count(*) from public.public_event_results) = 1
       and exists (select 1 from public.public_event_results where mark_text = '10.21'),
       'view count=' || (select count(*) from public.public_event_results)
       || ' (الجارية وغير المدرجة مخفيتان — والمحدث 10.21 ظاهر)';

-- ═══ R10: الـ View لا يكشف أعمدة حساسة (لا registration_id ولا athlete_id) ═══
insert into pg_temp.res_results
select 'R10_view_no_sensitive_columns',
       not exists (
         select 1 from information_schema.columns
         where table_schema = 'public' and table_name = 'public_event_results'
           and column_name in ('registration_id','athlete_id','club_id','published_by')
       ),
       'sensitive columns leaked';

-- ═══ الحُكم النهائي (الاستثناء يتراجع عن كل المعاملة — صفر أثر) ═══
create function pg_temp.res_verdict() returns void language plpgsql as $$
declare fails int; total int; payload text;
begin
  select count(*), count(*) filter (where not passed) into total, fails from pg_temp.res_results;
  select coalesce(json_agg(json_build_object('test', test_name, 'detail', detail))::text, '[]')
    into payload from pg_temp.res_results where not passed;
  if fails > 0 then
    raise exception 'PFP_TESTS_FAILED total=% failed=% failures=%', total, fails, payload;
  else
    raise exception 'PFP_TESTS_PASSED total=%', total;
  end if;
end $$;
select pg_temp.res_verdict();
