-- 小猫吃药监督 - Supabase Schema
-- Run this in the Supabase SQL Editor

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ===========================================
-- MEDICATIONS: 药柜
-- ===========================================
create table public.medications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  dosage text,
  unit text default '粒',
  frequency text default 'daily'
    check (frequency in ('daily', 'twice_daily', 'three_daily', 'weekly', 'as_needed')),
  photo_url text,
  barcode text,
  expiry_date date,
  notes text,
  color text default '#FF9F43',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ===========================================
-- SCHEDULES: 提醒计划
-- ===========================================
create table public.schedules (
  id uuid primary key default uuid_generate_v4(),
  medication_id uuid not null references public.medications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  time_of_day time not null,
  days_of_week integer[] default '{0,1,2,3,4,5,6}',
  enabled boolean default true,
  notification_id text,
  created_at timestamptz default now()
);

-- ===========================================
-- MEDICATION_LOGS: 用药记录
-- ===========================================
create table public.medication_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  medication_id uuid not null references public.medications(id) on delete cascade,
  schedule_id uuid references public.schedules(id) on delete set null,
  scheduled_date date not null,
  scheduled_time time not null,
  status text not null default 'pending'
    check (status in ('pending', 'taken', 'skipped', 'missed')),
  taken_at timestamptz,
  created_at timestamptz default now()
);

-- Unique: one log per schedule per day
create unique index idx_logs_unique
  on public.medication_logs(schedule_id, scheduled_date)
  where schedule_id is not null;

-- Performance indexes
create index idx_medications_user on public.medications(user_id);
create index idx_schedules_medication on public.schedules(medication_id);
create index idx_schedules_user on public.schedules(user_id);
create index idx_logs_user_date on public.medication_logs(user_id, scheduled_date);
create index idx_logs_medication on public.medication_logs(medication_id);

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================
alter table public.medications enable row level security;
alter table public.schedules enable row level security;
alter table public.medication_logs enable row level security;

create policy "Users manage own medications"
  on public.medications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own schedules"
  on public.schedules for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own logs"
  on public.medication_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ===========================================
-- STORAGE: 药品照片
-- ===========================================
insert into storage.buckets (id, name, public)
  values ('medication-photos', 'medication-photos', false);

create policy "Users upload own photos"
  on storage.objects for insert
  with check (
    bucket_id = 'medication-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users read own photos"
  on storage.objects for select
  using (
    bucket_id = 'medication-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
