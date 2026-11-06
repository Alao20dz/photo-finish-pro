-- ═══════════════════════════════════════════════════════════════
-- اختبارات سحابية — الإشارات اللحظية (المرحلة 7 — تهجير 0010)
-- فحوص كتالوج قراءة-فقط: دالة الإشارة، المشغّلات الأربعة، سلامة التعريف.
-- لا تُدرج أي بيانات — صفر أثر بالكامل (ولا بث إشارات حتى).
-- ═══════════════════════════════════════════════════════════════

begin;

create temp table rt_results (test_name text, passed boolean, detail text);

-- ═══ RT1: دالة الإشارة موجودة على public ═══
insert into rt_results
select 'RT1_rt_signal_change_exists',
       count(*) = 1,
       'function missing'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'rt_signal_change';

-- ═══ RT2: security definer مع search_path مثبّت (public, realtime) ═══
insert into rt_results
select 'RT2_security_definer_search_path',
       count(*) = 1,
       'prosecdef or search_path mismatch'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'rt_signal_change'
  and p.prosecdef = true
  and p.proconfig is not null
  and exists (
    select 1 from unnest(p.proconfig) cfg
    where cfg like 'search_path=%'
      and cfg ilike '%public%'
      and cfg ilike '%realtime%'
  );

-- ═══ RT3: دالة الإشارة نقية — تعريفها بلا عمليات كتابة على الجداول ═══
-- (التعريف يستخدم perform realtime.send حصراً — لا insert/update/delete خارج المعالج)
insert into rt_results
select 'RT3_no_data_writes_in_function',
       not (
         lower(pg_get_functiondef(p.oid)) ~ 'insert\s+into\s+public\.'
         or lower(pg_get_functiondef(p.oid)) ~ 'update\s+public\.'
         or lower(pg_get_functiondef(p.oid)) ~ 'delete\s+from\s+public\.'
       ),
       'function body contains data writes'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'rt_signal_change';

-- ═══ RT4: المشغّلات الأربعة مثبّتة (ROW/AFTER/INSERT لكل جدول) ═══
insert into rt_results
select 'RT4_triggers_on_four_tables',
       count(*) = 4,
       'attached to ' || count(*) || ' of 4 tables: ' || coalesce(string_agg(tgrelid::regclass::text, ', '), 'none')
from pg_trigger t
where not t.tgisinternal
  and t.tgname like '%_rt_signal'
  and t.tgrelid in (
    select c.oid from pg_class c join pg_namespace cn on cn.oid = c.relnamespace
    where cn.nspname = 'public'
      and c.relname in ('clubs','competitions','registrations','event_results')
  )
  and (t.tgtype & 1) <> 0     -- ROW level
  and (t.tgtype & 4) <> 0     -- AFTER
  and (t.tgtype & 16) <> 0;   -- INSERT

-- ═══ RT5: كل مشغّل يستدعي rt_signal_change ═══
insert into rt_results
select 'RT5_triggers_call_rt_signal_change',
       count(*) = 4 and count(*) filter (where p.proname = 'rt_signal_change') = 4,
       'wrong handler function'
from pg_trigger t
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal
  and t.tgname like '%_rt_signal'
  and t.tgrelid in (
    select c.oid from pg_class c join pg_namespace cn on cn.oid = c.relnamespace
    where cn.nspname = 'public'
      and c.relname in ('clubs','competitions','registrations','event_results')
  );

-- ═══ RT6: القناة في الدالة تطابق تسمية الواجهة pf:league: ═══
insert into rt_results
select 'RT6_channel_prefix_contract',
       count(*) = 1 and coalesce(bool_and(pg_get_functiondef(p.oid) like '%pf:league:%'), false),
       'channel prefix drift between DB and UI'
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'rt_signal_change';

-- ═══ RT7: بلا انحراف في أسماء الأحداث (الجدول يعدّ المفقود حصراً) ═══
insert into rt_results
select 'RT7_no_event_name_drift',
       count(*) = 0,
       'missing events in function body: ' || coalesce(string_agg(ev, ', '), 'none')
from (
  select ev
  from unnest(array[
    'clubs_changed','comps_changed','regs_changed','results_changed'
  ]) as ev
  where (select pg_get_functiondef(p.oid)
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = 'rt_signal_change')
        not like '%' || ev || '%'
) missing;

-- ═══ RT8: realtime.send متاح في هذه البيئة (معلومية — بلا إخفاق إن غاب) ═══
-- ملاحظة: غياب realtime.send لا يُفشل المجموعة (المشغّل محمي بمعالج استثناء
-- والواجهة تعمل بالكاش) — لكن نسجّل وجوده للتشخيص.
insert into rt_results
select 'RT8_realtime_send_available_note',
       true, -- معلومية حصراً
       case when count(*) = 1 then 'available' else 'MISSING — broadcast signals disabled (client falls back to cache/polling)' end
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'realtime' and p.proname = 'send';

-- ═══ الحُكم النهائي (الاستثناء يتراجع عن المعاملة — صفر أثر) ═══
create function pg_temp.rt_verdict() returns void language plpgsql as $$
declare fails int; total int; payload text;
begin
  select count(*), count(*) filter (where not passed) into total, fails from rt_results;
  select coalesce(json_agg(json_build_object('test', test_name, 'detail', detail))::text, '[]')
    into payload from rt_results where not passed;
  if fails > 0 then
    raise exception 'PFP_TESTS_FAILED total=% failed=% failures=%', total, fails, payload;
  else
    raise exception 'PFP_TESTS_PASSED total=%', total;
  end if;
end $$;
select pg_temp.rt_verdict();
