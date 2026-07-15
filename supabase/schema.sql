-- Run this in the Supabase SQL Editor for your project:
-- https://supabase.com/dashboard/project/_/sql

create table if not exists app_settings (
    id integer primary key default 1 check (id = 1),
    settings jsonb not null,
    updated_at timestamptz not null default now()
);

alter table app_settings enable row level security;

-- No public policies on app_settings: only the service role key can read/write.

-- Lightweight sync table for realtime updates (no sensitive data).
create table if not exists config_sync (
    id integer primary key default 1 check (id = 1),
    version integer not null default 1,
    updated_at timestamptz not null default now()
);

alter table config_sync enable row level security;

drop policy if exists "Public read config sync" on config_sync;
create policy "Public read config sync"
    on config_sync
    for select
    using (true);

insert into config_sync (id, version)
values (1, 1)
on conflict (id) do nothing;

alter publication supabase_realtime add table config_sync;
