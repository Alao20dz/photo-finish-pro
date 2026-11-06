-- ═══════════════════════════════════════════════════════════════
-- اختبارات الزائر المجهول (anon) — 3 فحوصات للحجب الصارم
-- تُنفَّذ في نداء منفصل لأن الدور أحادي الاتجاه (anon لا يعود authenticated)
-- المعاملة تتراجع كلياً عبر استثناء الحُكم — صفر أثر.
-- ═══════════════════════════════════════════════════════════════

begin;

insert into public.leagues (id, name_ar, wilaya, code, status) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'رابطة الاختبار أ', 'وهران', 'LIGA', 'active');

insert into public.competitions (id, league_id, title_ar, type, start_date, end_date, status, visibility) values
  ('d1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'تظاهرة غير مدرجة', 'track', current_date + 10, current_date + 10, 'published', 'unlisted'),
  ('d2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'مسودة', 'track', current_date + 30, current_date + 30, 'draft', 'public');

insert into public.competition_codes (id, competition_id, league_id, code_hash, code_masked, role, expires_at) values
  ('2a111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   repeat('x', 64), 'PF-****', 'checkpoint_judge', now() + interval '1 day');

insert into public.audit_log (action, entity) values ('TEST:PROBE', 'probe');

create temp table anon_results (test_name text, passed boolean, detail text);
grant select, insert on table pg_temp.anon_results to anon;

select set_config('role', 'anon', true);
select set_config('request.jwt.claims', '{}', true);

insert into pg_temp.anon_results
select 'A1_anon_zero_competitions',
       (select count(*) from public.competitions) = 0,
       'count=' || (select count(*) from public.competitions) || ' (مسودة + غير مدرجة يجب أن تكون مخفيتين)';

insert into pg_temp.anon_results
select 'A2_anon_zero_code_hashes',
       (select count(*) from public.competition_codes) = 0,
       'count=' || (select count(*) from public.competition_codes);

insert into pg_temp.anon_results
select 'A3_anon_zero_audit_log',
       (select count(*) from public.audit_log) = 0,
       'count=' || (select count(*) from public.audit_log);

create function pg_temp.anon_verdict() returns void language plpgsql as $$
declare fails int; total int; payload text;
begin
  select count(*), count(*) filter (where not passed) into total, fails from pg_temp.anon_results;
  select coalesce(json_agg(json_build_object('test', test_name, 'detail', detail))::text, '[]')
    into payload from pg_temp.anon_results where not passed;
  if fails > 0 then
    raise exception 'PFP_TESTS_FAILED total=% failed=% failures=%', total, fails, payload;
  else
    raise exception 'PFP_TESTS_PASSED total=%', total;
  end if;
end $$;
select pg_temp.anon_verdict();
