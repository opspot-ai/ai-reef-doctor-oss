-- AI Reef Doctor — initial schema, RLS, triggers, storage.
-- Apply with: supabase db push   (or paste into the Supabase SQL editor).
-- Every table is owner-scoped via RLS (user_id = auth.uid()). `subscriptions` is the
-- entitlements source of truth, written ONLY by the Stripe webhook (service role).

create extension if not exists "pgcrypto";

-- ─────────────────────────── enums ───────────────────────────
do $$ begin
  create type tank_type   as enum ('fowlr','soft','lps','sps','mixed','nano');
  create type live_kind   as enum ('fish','coral','invert');
  create type live_status as enum ('alive','deceased','removed');
  create type param_source as enum ('manual','photo');
  create type recurrence  as enum ('none','daily','weekly','biweekly','monthly');
  create type diag_kind   as enum ('fish','coral','algae','params','symptom');
  create type diag_urgency as enum ('routine','monitor','urgent','emergency');
  create type chat_role    as enum ('user','assistant');
  create type sub_tier     as enum ('free','pro','premium');
exception when duplicate_object then null; end $$;

-- ─────────────────────────── tables ───────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  tier sub_tier not null default 'free',
  status text not null default 'inactive',          -- active|trialing|past_due|canceled|inactive
  price_id text,
  current_period_end timestamptz,
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists tanks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  type tank_type not null default 'mixed',
  volume_liters numeric(8,2) not null check (volume_liters > 0),
  started_at date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists livestock (
  id uuid primary key default gen_random_uuid(),
  tank_id uuid not null references tanks(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind live_kind not null,
  common_name text not null,
  scientific_name text,
  nickname text,
  added_at date,
  photo_path text,
  status live_status not null default 'alive',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists equipment (
  id uuid primary key default gen_random_uuid(),
  tank_id uuid not null references tanks(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  category text,
  installed_at date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists parameters (
  id uuid primary key default gen_random_uuid(),
  tank_id uuid not null references tanks(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  measured_at timestamptz not null default now(),
  salinity_sg numeric(5,4),
  temp_c numeric(4,1),
  ph numeric(3,2),
  alkalinity_dkh numeric(4,2),
  calcium_ppm integer,
  magnesium_ppm integer,
  ammonia_ppm numeric(5,3),
  nitrite_ppm numeric(5,3),
  nitrate_ppm numeric(6,2),
  phosphate_ppm numeric(5,3),
  orp_mv integer,
  source param_source not null default 'manual',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists journal_events (
  id uuid primary key default gen_random_uuid(),
  tank_id uuid not null references tanks(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  type text not null,
  title text not null,
  body text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  tank_id uuid not null references tanks(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  kind text not null,
  due_at timestamptz not null,
  recurrence recurrence not null default 'none',
  last_done_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists diagnoses (
  id uuid primary key default gen_random_uuid(),
  tank_id uuid references tanks(id) on delete set null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind diag_kind not null,
  summary text,
  result jsonb not null,
  urgency diag_urgency,
  photo_path text,
  created_at timestamptz not null default now()
);

create table if not exists chat_threads (
  id uuid primary key default gen_random_uuid(),
  tank_id uuid references tanks(id) on delete set null,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now()
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role chat_role not null,
  content text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table if not exists usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null,                              -- 'YYYY-MM'
  ai_chats integer not null default 0,
  photo_diagnoses integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, period)
);

-- ─────────────────────────── indexes ───────────────────────────
create index if not exists idx_tanks_user on tanks(user_id);
create index if not exists idx_livestock_tank on livestock(tank_id);
create index if not exists idx_equipment_tank on equipment(tank_id);
create index if not exists idx_parameters_tank_time on parameters(tank_id, measured_at desc);
create index if not exists idx_journal_tank on journal_events(tank_id, occurred_at desc);
create index if not exists idx_reminders_user_due on reminders(user_id, due_at);
create index if not exists idx_diagnoses_user on diagnoses(user_id, created_at desc);
create index if not exists idx_threads_user on chat_threads(user_id, created_at desc);
create index if not exists idx_messages_thread on chat_messages(thread_id, created_at);

-- ─────────────────────────── updated_at trigger ───────────────────────────
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_subs_updated on subscriptions;
create trigger trg_subs_updated before update on subscriptions
  for each row execute function set_updated_at();

-- ─────────────────────────── new-user bootstrap ───────────────────────────
-- On signup: create a profile and a free-tier subscription row.
create or replace function handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
    values (new.id, new.email, new.raw_user_meta_data->>'full_name')
    on conflict (id) do nothing;
  insert into public.subscriptions (user_id, tier, status)
    values (new.id, 'free', 'active')
    on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────── RLS ───────────────────────────
alter table profiles       enable row level security;
alter table subscriptions  enable row level security;
alter table tanks          enable row level security;
alter table livestock      enable row level security;
alter table equipment      enable row level security;
alter table parameters     enable row level security;
alter table journal_events enable row level security;
alter table reminders      enable row level security;
alter table diagnoses      enable row level security;
alter table chat_threads   enable row level security;
alter table chat_messages  enable row level security;
alter table usage_counters enable row level security;

-- profiles: owner read/update
drop policy if exists own_profile on profiles;
create policy own_profile on profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- subscriptions: owner may READ only. Writes happen via service role (webhook), which bypasses RLS.
drop policy if exists own_sub_read on subscriptions;
create policy own_sub_read on subscriptions
  for select using (user_id = auth.uid());

-- usage_counters: owner read only (server increments via service role)
drop policy if exists own_usage_read on usage_counters;
create policy own_usage_read on usage_counters
  for select using (user_id = auth.uid());

-- generic owner-scoped full access for the user-owned content tables
do $$
declare t text;
begin
  foreach t in array array[
    'tanks','livestock','equipment','parameters','journal_events',
    'reminders','diagnoses','chat_threads','chat_messages'
  ] loop
    execute format('drop policy if exists own_rows on %I;', t);
    execute format(
      'create policy own_rows on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid());',
      t);
  end loop;
end $$;

-- ─────────────────────────── storage ───────────────────────────
insert into storage.buckets (id, name, public)
  values ('tank-photos','tank-photos', false)
  on conflict (id) do nothing;

drop policy if exists own_tank_photos on storage.objects;
create policy own_tank_photos on storage.objects
  for all using (bucket_id = 'tank-photos' and owner = auth.uid())
  with check (bucket_id = 'tank-photos' and owner = auth.uid());
