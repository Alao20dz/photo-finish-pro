-- ═══════════════════════════════════════════════════════════════
-- 0001: المخطط الأساسي — منصة Photo Finish Pro متعددة الرابطات
-- مصدر الحقيقة الوحيد للمخطط (لا تعديلات يدوية من لوحة Supabase)
-- تطبيق: supabase db push   |   إعادة الضبط: supabase db reset
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ─── الرابطات ───
create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_fr text,
  wilaya text not null,
  code text not null unique,
  logo_url text,
  colors jsonb default '{}',
  contact jsonb default '{}',
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  settings jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

-- ─── أعضاء الرابطة (الأدوار تُقرأ في سياسات RLS — لا تعتمد user_metadata) ───
create table public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('executive_manager','tech_manager','secretary','results_clerk')),
  permissions text[] default '{}',
  created_at timestamptz not null default now(),
  unique (league_id, user_id)
);

-- مديرو المنصة (Super Admins) — يُدارون خادمياً فقط
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- ─── الملفات الشخصية (مرتبطة بـ auth.users) ───
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  locale text not null default 'ar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── الأندية والمدربون ───
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  name_ar text not null,
  code text not null unique,
  logo_url text,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','suspended')),
  quota_per_event int not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table public.club_coaches (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','suspended')),
  created_at timestamptz not null default now(),
  unique (club_id, user_id)
);

-- ─── العدائون (سجل واحد + عدة مشاركات) ───
create table public.athletes (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  gender char(1) not null check (gender in ('M','F')),
  birth_date date not null,
  license_no text unique,
  wilaya text,
  medical_cert_path text,          -- حاوية Storage خاصة
  medical_cert_expiry date,
  deleted_at timestamptz,          -- حذف منطقي
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index athletes_club_idx on public.athletes (club_id);
create index athletes_name_idx on public.athletes (lower(first_name || ' ' || last_name));

-- ─── التظاهرات والمسابقات ───
create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  title_ar text not null,
  title_fr text,
  type text not null check (type in ('track','field','cross_country','road')),
  venue text,
  start_date date not null,
  end_date date not null,
  status text not null default 'draft'
    check (status in ('draft','published','registration_open','registration_closed','frozen','running','finished','results_published')),
  registration_deadline timestamptz,
  visibility text not null default 'public' check (visibility in ('public','unlisted')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);
create index competitions_league_idx on public.competitions (league_id);
create index competitions_status_idx on public.competitions (status);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  discipline text not null,
  gender char(1) not null check (gender in ('M','F')),
  category text not null,                     -- يُحسب من جدول الأصناف القابل للتعديل
  attempts_count int check (attempts_count in (3,6)),
  rounds jsonb default '[]',
  heights jsonb default '[]',
  status text not null default 'open' check (status in ('open','sealed','running','done')),
  created_at timestamptz not null default now()
);
create index events_comp_idx on public.events (competition_id);

-- ─── جدول الأصناف (قابل للتعديل لكل رابطة وموسم — لا قيم مكتوبة في الشفرة) ───
create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season text not null,
  category text not null,                     -- u16 | u18 | u20 | elite ...
  gender char(1),
  min_birth date,
  max_birth date,
  unique (league_id, season, category, gender)
);

-- ─── التسجيلات (قائمة انتظار الرابطة) ───
create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  coach_id uuid references auth.users(id),
  status text not null default 'submitted'
    check (status in ('draft','submitted','approved','rejected','needs_edit')),
  review_note text,
  bib_number int,
  snapshot jsonb,                             -- قائمة مجمّدة عند غلق التسجيل
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  unique (event_id, athlete_id)
);
create index registrations_comp_idx on public.registrations (competition_id);
create index registrations_status_idx on public.registrations (status);

-- ─── أكواد وضع المنافسة (تجزئة فقط) والجلسات ───
create table public.competition_codes (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  code_hash text not null unique,             -- SHA-256 — الكود الأصلي يُعرض مرة واحدة
  code_masked text not null,
  role text not null check (role in ('checkpoint_judge','field_judge','chief_judge','call_room','start_judge','finish_judge','results_clerk')),
  scope text not null default 'competition',
  assigned_to text,
  note text,
  expires_at timestamptz not null,
  max_uses int not null default 1,
  uses int not null default 0,
  revoked boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create table public.code_sessions (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.competition_codes(id) on delete cascade,
  auth_user_id uuid references auth.users(id), -- من Anonymous Sign-in
  device_id text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- ─── المهام (ربط الحكام بالنقاط) ───
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  code_id uuid references public.competition_codes(id) on delete set null,
  role text not null,
  station text,                               -- نقطة مراقبة / محطة ميدان
  shift text,
  created_at timestamptz not null default now()
);

-- ─── سجل التدقيق (مشغّلات خادمية — لا من الواجهة) ───
create table public.audit_log (
  id bigserial primary key,
  actor uuid references auth.users(id),
  actor_email text,
  action text not null,
  entity text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  ip text,
  at timestamptz not null default now()
);
create index audit_entity_idx on public.audit_log (entity, entity_id);

-- ─── الإشعارات ───
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  to_user uuid references auth.users(id),
  to_email text,
  channel text not null default 'in_app' check (channel in ('in_app','email','sms','whatsapp')),
  template text not null,
  payload jsonb default '{}',
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  created_at timestamptz not null default now()
);

-- ─── مشغّل updated_at ───
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['leagues','clubs','athletes','competitions','registrations','profiles']
  loop
    execute format('create trigger trg_%s_touch before update on public.%I for each row execute function public.touch_updated_at();', t, t);
  end loop;
end $$;
