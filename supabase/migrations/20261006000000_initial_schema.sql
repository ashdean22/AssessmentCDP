-- Applied to the production project via the Supabase MCP on 2026-10-06.
-- Kept here so the schema is reviewable and `supabase db push` can recreate it.

-- One row per real person after dedupe on normalized email.
create table subscribers (
  id              bigint generated always as identity primary key,
  email           text not null unique,            -- normalized: trim + lowercase
  email_hash      text not null unique,            -- HMAC(email, MASK_SECRET) -> masked id for the AI
  signup_date     date,
  status          text not null check (status in ('active','unsubscribed')),
  source          text not null default 'other',
  last_open_date  date,
  merged_count    int  not null default 1,         -- how many raw rows collapsed into this one
  engagement_score int,
  churn_tier      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index subscribers_source_idx on subscribers (source);
create index subscribers_status_idx on subscribers (status);
create index subscribers_last_open_idx on subscribers (last_open_date);
create index subscribers_signup_idx on subscribers (signup_date);

create table web_events (
  id            bigint generated always as identity primary key,
  visitor_id    text not null,
  page          text not null,
  ts            timestamptz not null,
  utm_source    text,
  email         text,                                -- normalized, as captured
  subscriber_id bigint references subscribers(id) on delete set null,
  unique (visitor_id, page, ts)                      -- makes re-import idempotent
);
create index web_events_subscriber_idx on web_events (subscriber_id);
create index web_events_visitor_idx on web_events (visitor_id);
create index web_events_page_idx on web_events (page);
create index web_events_ts_idx on web_events (ts);

-- App accounts from the CSV, plus stub profiles for user_ids first seen via webhook.
create table app_users (
  user_id       text primary key,
  email         text,
  created_at    timestamptz,
  subscriber_id bigint references subscribers(id) on delete set null,
  is_stub       boolean not null default false,
  first_seen_at timestamptz not null default now()
);
create index app_users_subscriber_idx on app_users (subscriber_id);

create table devices (
  device_id text primary key,
  user_id   text references app_users(user_id) on delete set null,
  linked_at timestamptz
);

-- Live webhook events. event_id unique => duplicates are no-ops.
create table app_events (
  event_id         text primary key,
  event            text not null check (event in ('app_open','read_story','link_click','login')),
  user_id          text,                             -- as sent (may be null before login)
  device_id        text not null,
  ts               timestamptz not null,             -- event time; always sort by this, never received_at
  properties       jsonb not null default '{}'::jsonb,
  resolved_user_id text references app_users(user_id) on delete set null,
  received_at      timestamptz not null default now()
);
create index app_events_resolved_user_ts_idx on app_events (resolved_user_id, ts desc);
create index app_events_device_idx on app_events (device_id);
create index app_events_ts_idx on app_events (ts desc);

create table segments (
  id          bigint generated always as identity primary key,
  name        text not null,
  filter_json jsonb not null,
  created_at  timestamptz not null default now()
);

-- Full result tables the AI refers to only by id; the browser fetches them behind login.
create table ai_results (
  result_id  uuid primary key default gen_random_uuid(),
  kind       text not null,
  rows       jsonb not null,
  created_at timestamptz not null default now()
);

create table import_issues (
  id         bigint generated always as identity primary key,
  run_id     text not null,
  file       text not null,
  row_number int,
  problem    text not null,
  raw        jsonb,
  created_at timestamptz not null default now()
);

-- Lock everything down. Only the server (service role) talks to the DB; no public policies.
alter table subscribers   enable row level security;
alter table web_events    enable row level security;
alter table app_users     enable row level security;
alter table devices       enable row level security;
alter table app_events    enable row level security;
alter table segments      enable row level security;
alter table ai_results    enable row level security;
alter table import_issues enable row level security;

-- Supabase's default helper is SECURITY DEFINER and callable via REST; nobody needs that.
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
