-- ═══════════════════════════════════════════════════════════════
--  TREASURE HUNT — Full Reset + Setup
--  Drops everything and rebuilds from scratch.
--  Run this entire file in Supabase → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────
--  0. CLEAN SLATE — drop everything first
-- ─────────────────────────────────────────────
drop table if exists public.rate_limit_log   cascade;
drop table if exists public.audit_log        cascade;
drop table if exists public.survey_responses cascade;
drop table if exists public.profiles         cascade;

drop function if exists public.fn_audit_log()                    cascade;
drop function if exists public.fn_clean_rate_log()               cascade;
drop function if exists public.fn_email_exists(text)             cascade;
drop function if exists public.fn_phone_exists(text)             cascade;
drop function if exists public.fn_ip_submission_count(inet, int) cascade;
drop function if exists public.handle_new_user()                 cascade;
drop function if exists public.handle_updated_at()               cascade;
drop function if exists public.get_user_role(uuid)               cascade;

drop view if exists public.survey_responses_redacted cascade;


-- ─────────────────────────────────────────────
--  1. ROLES
-- ─────────────────────────────────────────────
revoke all on schema public from public;
revoke all on schema public from anon;
revoke all on schema public from authenticated;
grant usage on schema public to service_role;


-- ─────────────────────────────────────────────
--  2. PROFILES TABLE (extends auth.users)
-- ─────────────────────────────────────────────
create table public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  email       text        not null,
  full_name   text,
  role        text        not null default 'viewer',
  status      text        not null default 'pending',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint valid_role check (
    role in ('owner', 'admin', 'editor', 'viewer')
  ),
  constraint valid_status check (
    status in ('pending', 'approved', 'rejected')
  )
);

create index idx_profiles_role   on public.profiles (role);
create index idx_profiles_status on public.profiles (status);

create unique index idx_profiles_email_unique
  on public.profiles (lower(email));

create unique index idx_profiles_name_unique
  on public.profiles (lower(full_name))
  where full_name is not null and full_name != '';


-- ─────────────────────────────────────────────
--  3. AUTO-CREATE PROFILE ON SIGNUP
-- ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'viewer'),
    'pending'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─────────────────────────────────────────────
--  4. AUTO-UPDATE updated_at
-- ─────────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_profile_updated
  before update on public.profiles
  for each row execute function public.handle_updated_at();


-- ─────────────────────────────────────────────
--  5. SURVEY RESPONSES TABLE
-- ─────────────────────────────────────────────
create table public.survey_responses (
  id              bigserial       primary key,
  name            text            not null,
  email           text,
  phone           text            not null,
  frequency       text,
  ip_address      inet,
  user_agent      text,
  submitted_at    timestamptz     not null default now(),
  is_flagged      boolean         not null default false,
  notes           text,

  constraint email_format check (
    email ~* '^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$'
  ),
  constraint name_length check (
    char_length(name) between 2 and 120
  ),
  constraint phone_length check (
    char_length(phone) between 7 and 20
  ),
  constraint frequency_values check (
    frequency = '' or frequency in (
      'Daily — multiple times a day',
      'Daily — once a day',
      'A few times a week',
      'Once a week',
      'A few times a month',
      'Rarely'
    )
  )
);

create unique index idx_survey_email
  on public.survey_responses (lower(email));

create unique index idx_survey_phone
  on public.survey_responses (regexp_replace(phone, '[^0-9+]', '', 'g'));

create index idx_survey_submitted_at
  on public.survey_responses (submitted_at desc);

create index idx_survey_ip
  on public.survey_responses (ip_address);

create index idx_survey_flagged
  on public.survey_responses (is_flagged) where is_flagged = true;


-- ─────────────────────────────────────────────
--  6. AUDIT LOG TABLE
-- ─────────────────────────────────────────────
create table public.audit_log (
  id           bigserial    primary key,
  table_name   text         not null,
  operation    text         not null,
  row_id       text,
  old_data     jsonb,
  new_data     jsonb,
  performed_at timestamptz  not null default now(),
  performed_by text         not null default current_user
);

create rule audit_no_update as on update to public.audit_log do instead nothing;
create rule audit_no_delete as on delete to public.audit_log do instead nothing;

create or replace function public.fn_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_log (table_name, operation, row_id, old_data, new_data)
  values (
    TG_TABLE_NAME,
    TG_OP,
    coalesce(new.id, old.id),
    case when TG_OP = 'DELETE' then to_jsonb(old) else null end,
    case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

-- NOTE: No auto-trigger on survey_responses.
-- API routes log audit entries with proper actor attribution via lib/audit.js.


-- ─────────────────────────────────────────────
--  7. RATE LIMIT TRACKING TABLE
-- ─────────────────────────────────────────────
create table public.rate_limit_log (
  id           bigserial   primary key,
  ip_address   inet        not null,
  attempted_at timestamptz not null default now(),
  success      boolean     not null default false
);

create index idx_rate_ip_time
  on public.rate_limit_log (ip_address, attempted_at desc);


-- ─────────────────────────────────────────────
--  8. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────

-- profiles
alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Owners can update any profile"
  on public.profiles for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'owner'
    )
  );

create policy "Admins can update non-owner profiles"
  on public.profiles for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role = 'admin'
    )
    and role != 'owner'
  );

-- survey_responses, audit_log, rate_limit_log
alter table public.survey_responses enable row level security;
alter table public.audit_log        enable row level security;
alter table public.rate_limit_log   enable row level security;

create policy "deny_anon_all_survey"
  on public.survey_responses as restrictive for all
  to anon, authenticated using (false) with check (false);

create policy "deny_anon_all_audit"
  on public.audit_log as restrictive for all
  to anon, authenticated using (false) with check (false);

create policy "deny_anon_all_rate"
  on public.rate_limit_log as restrictive for all
  to anon, authenticated using (false) with check (false);


-- ─────────────────────────────────────────────
--  9. GRANT PERMISSIONS
-- ─────────────────────────────────────────────

-- profiles — service_role bypasses RLS (for API routes)
grant all on public.profiles to service_role;

-- survey_responses
grant select, insert, update on public.survey_responses to service_role;
grant usage, select on sequence public.survey_responses_id_seq to service_role;

-- audit_log
grant select, insert on public.audit_log to service_role;
grant usage, select on sequence public.audit_log_id_seq to service_role;

-- rate_limit_log
grant select, insert, delete on public.rate_limit_log to service_role;
grant usage, select on sequence public.rate_limit_log_id_seq to service_role;

-- revoke everything from anon/authenticated on data tables
revoke all on public.survey_responses from anon, authenticated;
revoke all on public.audit_log        from anon, authenticated;
revoke all on public.rate_limit_log   from anon, authenticated;


-- ─────────────────────────────────────────────
--  10. SECURE VIEW
-- ─────────────────────────────────────────────
create or replace view public.survey_responses_redacted
with (security_invoker = true)
as
select
  id,
  name,
  regexp_replace(email, '^[^@]+', '****')        as email,
  regexp_replace(phone, '\d(?=\d{3})', '*', 'g') as phone,
  frequency,
  split_part(ip_address::text, '.', 1) || '.***.***.***' as ip_address,
  submitted_at,
  is_flagged
from public.survey_responses;

revoke all on public.survey_responses_redacted from anon, authenticated;


-- ─────────────────────────────────────────────
--  11. HELPER FUNCTIONS
-- ─────────────────────────────────────────────

-- Get role for a user
create or replace function public.get_user_role(user_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = user_id;
$$;

grant execute on function public.get_user_role(uuid) to authenticated;
grant execute on function public.get_user_role(uuid) to service_role;

-- Check duplicate email (case-insensitive)
create or replace function public.fn_email_exists(p_email text)
returns boolean language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.survey_responses
    where lower(email) = lower(p_email)
  );
$$;

-- Check duplicate phone (normalised — ignores spaces, dashes, dots)
create or replace function public.fn_phone_exists(p_phone text)
returns boolean language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from public.survey_responses
    where regexp_replace(phone, '[^0-9+]', '', 'g') =
          regexp_replace(p_phone, '[^0-9+]', '', 'g')
  );
$$;

-- Count successful submissions from an IP in last N minutes
create or replace function public.fn_ip_submission_count(
  p_ip   inet,
  p_mins int default 15
)
returns int language sql security definer stable set search_path = public
as $$
  select count(*)::int
  from public.rate_limit_log
  where ip_address = p_ip
    and success = true
    and attempted_at > now() - (p_mins || ' minutes')::interval;
$$;

-- Clean old rate log entries
create or replace function public.fn_clean_rate_log()
returns void language sql security definer set search_path = public
as $$
  delete from public.rate_limit_log
  where attempted_at < now() - interval '24 hours';
$$;

-- Grants for data helper functions
grant execute on function public.fn_email_exists(text)             to service_role;
grant execute on function public.fn_phone_exists(text)             to service_role;
grant execute on function public.fn_ip_submission_count(inet, int) to service_role;
grant execute on function public.fn_clean_rate_log()               to service_role;

revoke execute on function public.fn_email_exists(text)             from anon, authenticated;
revoke execute on function public.fn_phone_exists(text)             from anon, authenticated;
revoke execute on function public.fn_ip_submission_count(inet, int) from anon, authenticated;
revoke execute on function public.fn_clean_rate_log()               from anon, authenticated;


-- ─────────────────────────────────────────────
--  12. VERIFICATION
-- ─────────────────────────────────────────────

-- RLS status
select tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'survey_responses', 'audit_log', 'rate_limit_log')
order by tablename;

-- Policies
select tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename;

-- Constraints
select conname as constraint_name, contype as type
from pg_constraint
join pg_class on pg_class.oid = pg_constraint.conrelid
where pg_class.relname = 'survey_responses'
order by conname;

-- Indexes
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('profiles', 'survey_responses', 'rate_limit_log')
order by tablename, indexname;


-- ─────────────────────────────────────────────
--  NOTE: Create your first Owner manually:
--
--  1. Sign up via the app (or Supabase dashboard → Auth → Add User)
--  2. Then run:
--     UPDATE public.profiles
--       SET role = 'owner', status = 'approved'
--       WHERE email = 'your@email.com';
--
--  After that, the owner can approve new signups and manage roles.
-- ─────────────────────────────────────────────
