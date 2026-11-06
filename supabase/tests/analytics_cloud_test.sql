-- ═══════════════════════════════════════════════════════════════
-- اختبارات سحابية — تحليلات الموقع العمومي (المرحلة 8 — تهجير 0011)
-- خصوصية أولاً: بنية الجدول + RLS + السياسات + الدالتان المجمّعتان
-- + سلوك حقيقي داخل المعاملة (إدراج/حجب/تجميع) — كلها تتراجع، صفر أثر.
-- ═══════════════════════════════════════════════════════════════

begin;

create temp table an_results (test_name text, passed boolean, detail text);
grant select, insert on table pg_temp.an_results to anon, authenticated;

-- بيانات مؤقتة داخل المعاملة (تتراجع تلقائياً)
insert into auth.users (id, email) values
  ('b1b11111-1111-4111-8111-111111111111', 'pfp-an-member@test.local');

insert into public.leagues (id, name_ar, wilaya, code, status)
values ('a1a11111-1111-4111-8111-111111111111', 'رابطة اختبار التحليلات', 'الجزائر', 'AN-01', 'active')
on conflict do nothing;

insert into public.league_members (league_id, user_id, role)
values ('a1a11111-1111-4111-8111-111111111111', 'b1b11111-1111-4111-8111-111111111111', 'executive_manager')
on conflict do nothing;

-- ═══ AN1: الجدول موجود على public بأعمدة محصورة بلا أي PII ═══
insert into an_results
select 'AN1_page_views_no_pii_columns',
       count(*) = 9 and coalesce(bool_and(c.column_name in (
         'id','kind','path','league_id','referrer_host','lang','device','day','created_at'
       )), false),
       'columns: ' || coalesce(string_agg(c.column_name, ', ' order by c.ordinal_position), 'none')
from information_schema.columns c
where c.table_schema = 'public' and c.table_name = 'page_views';

-- ═══ AN2: RLS مفعّل ومُلزَم ═══
insert into an_results
select 'AN2_rls_enabled_and_forced',
       bool_and(c.relrowsecurity) and bool_and(c.relforcerowsecurity),
       'enable+force required'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'page_views';

-- ═══ AN3: سياسة الإدراج العمومي حاضرة بالاسم ═══
insert into an_results
select 'AN3_insert_policy_present',
       count(*) >= 1,
       'matching policies: ' || coalesce(string_agg(pol.polname, ', '), 'none')
from pg_policy pol
join pg_class t on t.oid = pol.polrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public' and t.relname = 'page_views'
  and pol.polname = 'page_views_insert_public';

-- ═══ AN4: الزائر المجهول يُدرج (سلوك فعلي) ═══
select set_config('role', 'anon', true);
select set_config('request.jwt.claims', '{}', true);
do $$
declare ok boolean := false; detail text := 'insert denied';
begin
  begin
    insert into public.page_views (kind, path, league_id, lang, device)
    values ('page_view', '/', 'a1a11111-1111-4111-8111-111111111111', 'ar', 'unknown');
    ok := true; detail := 'inserted_ok';
  exception when others then
    detail := SQLERRM;
  end;
  insert into an_results values ('AN4_anon_can_insert', ok, detail);
end $$;

-- ═══ AN5: الزائر المجهول لا يقرأ — revoke select يمنع حتى COUNT (أشدّ من RLS) ═══
do $$
declare denied boolean := false; detail text := 'anon read rows!';
begin
  begin
    perform count(*) from public.page_views;
  exception when insufficient_privilege then
    denied := true; detail := 'select denied for anon (table-level revoke) as expected';
  end;
  insert into an_results values ('AN5_anon_cannot_read', denied, detail);
end $$;

-- ═══ AN6: قيود القيم — kind خارج القائمة يُرفض ═══
do $$
declare rejected boolean := false; detail text := 'accepted!';
begin
  begin
    insert into public.page_views (kind, path) values ('suspicious_kind', '/x');
  exception when check_violation then
    rejected := true; detail := 'invalid kind rejected';
  end;
  insert into an_results values ('AN6_kind_check_constraint', rejected, detail);
end $$;

-- ═══ AN7: دالتا التجميع موجودة بتعريف محصّن ═══
insert into an_results
select 'AN7_rpc_functions_security_definer',
       count(*) = 2 and bool_and(p.prosecdef)
       and bool_and(exists (
         select 1 from unnest(p.proconfig) cfg
         where cfg like 'search_path=%' and cfg ilike '%public%'
       )),
       'found ' || count(*) || ' of 2 (prosecdef=' || coalesce(bool_and(p.prosecdef)::text, '?') || ')'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('league_analytics_daily', 'league_analytics_top');

-- ═══ AN8: دالتا التجميع تحملان حارس عضوية صريح ═══
insert into an_results
select 'AN8_rpc_membership_guard',
       count(*) = 2 and coalesce(bool_and(pg_get_functiondef(p.oid) like '%is_league_member%'), false),
       'guard missing in: ' || coalesce(string_agg(p.proname, ', '), 'none')
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('league_analytics_daily', 'league_analytics_top');

-- ═══ AN9: تنفيذ RPC محجوب عن anon (revoke execute — صلاحية لا سياسة) ═══
do $$
declare denied boolean := false; detail text := 'anon executed RPC!';
begin
  begin
    perform count(*) from public.league_analytics_daily('a1a11111-1111-4111-8111-111111111111', 30);
  exception when insufficient_privilege then
    denied := true; detail := 'execute denied for anon as expected';
  end;
  insert into an_results values ('AN9_rpc_execute_denied_for_anon', denied, detail);
end $$;

-- ═══ AN10: نداء بلا هوية (ادعاءات فارغة) → حارس العضوية يعيد فراغاً ═══
reset role;
select set_config('request.jwt.claims', '{}', true);
insert into an_results
select 'AN10_no_identity_rpc_returns_empty',
       (select count(*) from public.league_analytics_daily('a1a11111-1111-4111-8111-111111111111', 30)) = 0,
       'identity-less rpc returned ' || (select count(*) from public.league_analytics_daily('a1a11111-1111-4111-8111-111111111111', 30)) || ' rows';

-- ═══ AN11: بيانات تشغيلية داخل المعاملة ثم تجميع لعضو الرابطة ═══
insert into public.page_views (kind, path, league_id, lang, device) values
  ('page_view', '/',                        'a1a11111-1111-4111-8111-111111111111', 'ar', 'mobile'),
  ('page_view', '/league/a1a11111-1111-4111-8111-111111111111', 'a1a11111-1111-4111-8111-111111111111', 'fr', 'desktop'),
  ('cta_click', '/',                        'a1a11111-1111-4111-8111-111111111111', 'ar', 'mobile'),
  ('page_view', '/',                        null, 'ar', 'mobile'); -- بلا رابطة (لا يُحسب)

select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims',
  json_build_object('sub', 'b1b11111-1111-4111-8111-111111111111', 'role', 'authenticated', 'aal', 'aal1')::text, true);

insert into an_results
select 'AN11_member_rpc_aggregates',
       d.day_count = 1 and d.views = 3 and d.cta = 1 and t.top_path = '/',
       format('daily(rows=%s views=%s cta=%s) top=%s',
              d.day_count, d.views, d.cta, t.top_path)
from (
  select count(*) as day_count,
         coalesce(sum(views), 0) as views,
         coalesce(sum(cta_clicks), 0) as cta
  from public.league_analytics_daily('a1a11111-1111-4111-8111-111111111111', 30)
) d
cross join (
  select path as top_path
  from public.league_analytics_top('a1a11111-1111-4111-8111-111111111111', 30, 8)
  limit 1
) t;

-- ═══ AN12: تنفيذ الدالتين محصور بـ authenticated (ممنوح لأعضاء الرابطات حصراً) ═══
insert into an_results
select 'AN12_execute_grants',
       has_function_privilege('authenticated', 'public.league_analytics_daily(uuid, int)', 'execute')
       and has_function_privilege('authenticated', 'public.league_analytics_top(uuid, int, int)', 'execute'),
       format('auth_daily=%s auth_top=%s',
              has_function_privilege('authenticated', 'public.league_analytics_daily(uuid, int)', 'execute')::text,
              has_function_privilege('authenticated', 'public.league_analytics_top(uuid, int, int)', 'execute')::text);

-- ═══ AN13: عضو رابطة أخرى (غير مرتبطة) لا يرى شيئاً ═══
select set_config('request.jwt.claims',
  json_build_object('sub', 'c1c11111-1111-4111-8111-111111111111', 'role', 'authenticated', 'aal', 'aal1')::text, true);
insert into an_results
select 'AN13_other_member_sees_nothing',
       (select count(*) from public.league_analytics_daily('a1a11111-1111-4111-8111-111111111111', 30)) = 0,
       'outsider saw ' || (select count(*) from public.league_analytics_daily('a1a11111-1111-4111-8111-111111111111', 30)) || ' rows';

-- ═══ الحُكم النهائي (الاستثناء يتراجع عن المعاملة — صفر أثر) ═══
create function pg_temp.an_verdict() returns void language plpgsql as $$
declare fails int; total int; payload text;
begin
  select count(*), count(*) filter (where not passed) into total, fails from an_results;
  select coalesce(json_agg(json_build_object('test', test_name, 'detail', detail))::text, '[]')
    into payload from an_results where not passed;
  if fails > 0 then
    raise exception 'PFP_TESTS_FAILED total=% failed=% failures=%', total, fails, payload;
  else
    raise exception 'PFP_TESTS_PASSED total=%', total;
  end if;
end $$;
select pg_temp.an_verdict();
