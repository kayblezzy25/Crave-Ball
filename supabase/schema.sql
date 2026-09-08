-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query)
-- before starting the bot. Safe to re-run (idempotent).

create table if not exists bot_settings (
  id text primary key,
  startup_message text not null default 'Welcome! The administrator has not configured a startup message yet.',
  startup_image_path text,
  startup_image_url text,
  buttons jsonb not null default '[]'::jsonb,
  updated_at timestamptz,
  updated_by bigint
);

insert into bot_settings (id)
values ('general')
on conflict (id) do nothing;

create table if not exists admins (
  telegram_id bigint primary key,
  username text,
  role text not null default 'admin',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Row Level Security stays on with no policies: only the service_role key
-- (used exclusively by the trusted Railway server, never exposed to
-- Telegram users or a frontend) can read/write these tables.
alter table bot_settings enable row level security;
alter table admins enable row level security;
