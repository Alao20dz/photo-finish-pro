-- ═══════════════════════════════════════════════════════════════
-- 0010: الإشارات اللحظية (Realtime Signals — بث من قاعدة البيانات)
-- ═══════════════════════════════════════════════════════════════
-- الهدف: عندما تتغير بيانات رابطة (أندية/تظاهرات/تسجيلات/نتائج)
-- تُبثّ «إشارة» إلى قناة الرابطة فتُحدّث الواجهات المفتوحة نفسها
-- (الموقع العمومي + لوحة المدير) دون تحديث يدوي.
--
-- المبدأ الأمني (الحكم الذهبي نفسه):
--  • الإشارة تحمل معرفات حصراً (league_id / competition_id) — صفر بيانات
--    مستخدم أو صفوف. البيانات تُجلب دائماً عبر قراءات RLS/Views القائمة
--    (public_leagues / public_competitions / public_event_results / RLS).
--  • القناة عمومية (private = false) لكن حمولتها بلا أي حساسية:
--    «تغيّر شيء في رابطة X — أعد الجلب». من لا يملك صلاحية القراءة
--    سيرى فرقاً صفرياً بعد إعادة الجلب (RLS تُعيد ما يُسمح به حصراً).
--  • بث الإشارة لا يُعطّل عملية البيانات أبداً (معالجة استثناء داخلي).
--  • security definer مع search_path مثبّت: تنفيذ realtime.send ممكن
--    من أي دور يعتمد السجل، دون فتح صلاحيات على المخطط.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.rt_signal_change()
returns trigger
language plpgsql
security definer
set search_path = public, realtime
as $$
declare
  v_league_id uuid;
  v_comp_id   uuid;
  v_event     text;
  v_topic     text;
begin
  -- اسم الحدث حسب الجدول (تسمية موحّدة تعرفها الواجهة)
  v_event := case tg_table_name
    when 'clubs'          then 'clubs_changed'
    when 'competitions'   then 'comps_changed'
    when 'registrations'  then 'regs_changed'
    when 'event_results'  then 'results_changed'
    else null
  end;
  if v_event is null then
    return coalesce(new, old);
  end if;

  -- سياق الرابطة/التظاهرة ( registrations لا يحمل league_id — يُستنتج )
  if tg_table_name = 'registrations' then
    v_comp_id   := coalesce(new.competition_id, old.competition_id);
    select league_id into v_league_id
      from public.competitions where id = v_comp_id;
  elsif tg_table_name = 'event_results' then
    v_comp_id   := coalesce(new.competition_id, old.competition_id);
    v_league_id := coalesce(new.league_id, old.league_id);
  else
    v_league_id := coalesce(new.league_id, old.league_id);
  end if;

  -- بلا سياق رابطة (حذف متسلسل مثلاً) — لا إشارة
  if v_league_id is null then
    return coalesce(new, old);
  end if;

  v_topic := 'pf:league:' || v_league_id::text;

  begin
    perform realtime.send(
      jsonb_build_object(
        'league_id',      v_league_id,
        'competition_id', v_comp_id,
        'table',          tg_table_name,
        'op',             tg_op
      ),
      v_event,
      v_topic,
      false                       -- قناة عمومية — حمولة معرفات فقط
    );
  exception when others then
    -- بث الإشارة تجميلي حصراً: أي فشل لا يُتراجع عن عملية البيانات
    null;
  end;

  return coalesce(new, old);
end $$;

-- ─── تثبيت المشغّلات على جداول الرابطة الأربعة ───
drop trigger if exists trg_clubs_rt_signal on public.clubs;
create trigger trg_clubs_rt_signal
  after insert or update or delete on public.clubs
  for each row execute function public.rt_signal_change();

drop trigger if exists trg_competitions_rt_signal on public.competitions;
create trigger trg_competitions_rt_signal
  after insert or update or delete on public.competitions
  for each row execute function public.rt_signal_change();

drop trigger if exists trg_registrations_rt_signal on public.registrations;
create trigger trg_registrations_rt_signal
  after insert or update or delete on public.registrations
  for each row execute function public.rt_signal_change();

drop trigger if exists trg_event_results_rt_signal on public.event_results;
create trigger trg_event_results_rt_signal
  after insert or update or delete on public.event_results
  for each row execute function public.rt_signal_change();

-- ملاحظة تشغيلية: إن غاب realtime.send عن بيئة ما (نسخة قديمة) فإن
-- المشغّل يُنشأ كاملاً والبث يفشل بصمت داخل معالج الاستثناء —
-- الواجهة تعمل كما هي عبر الكاش والتحديث اليدوي (أوفلاين أولاً).
