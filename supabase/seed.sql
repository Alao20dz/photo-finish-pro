-- ═══════════════════════════════════════════════════════════════
-- seed: بيانات تجريبية (رابطتان، أندية، تظاهرات، تسجيلات)
-- تطبيق: supabase db reset  (يُنفَّذ بعد الهجرات تلقائياً)
-- NOTE: الحسابات الحقيقية تُنشأ عبر Supabase Auth — هذا الملف للعرض فقط.
-- ═══════════════════════════════════════════════════════════════

insert into public.leagues (name_ar, name_fr, wilaya, code, status) values
  ('الرابطة الولائية لألعاب القوى — وهران', 'Ligue Wilaya d''Athlétisme d''Oran', 'وهران', 'LIG31', 'active'),
  ('رابطة الجزائر العاصمة لألعاب القوى', 'Ligue d''Athlétisme d''Alger', 'الجزائر العاصمة', 'LIG16', 'active');

insert into public.clubs (league_id, name_ar, code, approval_status, quota_per_event)
select id, 'مولودية وهران لألعاب القوى', 'MPO-ATH', 'approved', 3 from public.leagues where code = 'LIG31'
union all
select id, 'أولمبيك سطيف للعدو الريفي', 'ASO-XC', 'approved', 2 from public.leagues where code = 'LIG31'
union all
select id, 'شباب بلوزداد', 'CRB-ATH', 'approved', 3 from public.leagues where code = 'LIG16'
union all
select id, 'اتحاد العاصمة ميليتار', 'USMA-ATH', 'approved', 2 from public.leagues where code = 'LIG16';

insert into public.competitions (league_id, title_ar, type, venue, start_date, end_date, status, registration_deadline)
select id, 'البطولة الولائية للعدو الريفي — وهران', 'cross_country', 'غابة مرسى الكبير، وهران', current_date + 21, current_date + 21, 'registration_open', now() + interval '14 days'
from public.leagues where code = 'LIG31'
union all
select id, 'لقاء المضمار الدولي — الجزائر العاصمة', 'track', 'ملعب 5 جويلية 1962م', current_date + 35, current_date + 36, 'registration_open', now() + interval '28 days'
from public.leagues where code = 'LIG16';

insert into public.events (competition_id, discipline, gender, category)
select c.id, x.discipline, x.gender, x.category
from public.competitions c
join (values
  ('البطولة الولائية للعدو الريفي — وهران', 'cross_7k', 'M', 'elite'),
  ('البطولة الولائية للعدو الريفي — وهران', 'cross_5k', 'F', 'elite'),
  ('البطولة الولائية للعدو الريفي — وهران', 'cross_4k', 'M', 'u18'),
  ('لقاء المضمار الدولي — الجزائر العاصمة', '100m', 'M', 'elite'),
  ('لقاء المضمار الدولي — الجزائر العاصمة', '400m', 'M', 'u20'),
  ('لقاء المضمار الدولي — الجزائر العاصمة', 'long_jump', 'F', 'elite')
) as x(comp_title, discipline, gender, category) on x.comp_title = c.title_ar;

-- جدول الأصناف الافتراضي (قابل للتعديل لكل رابطة وموسم)
insert into public.category_rules (league_id, season, category, gender, min_birth, max_birth)
select l.id, to_char(now(), 'YYYY'), x.category, x.gender::char(1), x.min_birth::date, x.max_birth::date
from public.leagues l
join (values
  ('u16', 'M', (current_date - interval '16 years')::date + 1, current_date),
  ('u18', 'M', (current_date - interval '18 years')::date + 1, (current_date - interval '16 years')::date),
  ('u20', 'M', (current_date - interval '20 years')::date + 1, (current_date - interval '18 years')::date),
  ('elite', 'M', null, (current_date - interval '20 years')::date),
  ('u18', 'F', (current_date - interval '18 years')::date + 1, (current_date - interval '16 years')::date),
  ('u20', 'F', (current_date - interval '20 years')::date + 1, (current_date - interval '18 years')::date),
  ('elite', 'F', null, (current_date - interval '20 years')::date)
) as x(category, gender, min_birth, max_birth) on true;
