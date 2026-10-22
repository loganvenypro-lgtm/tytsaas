-- Alerts: a saved Top Videos search (same filter params, lib/filterSpec.js) on
-- the videos published in the last 7 days, optionally limited to the user's
-- competitors or inspirations. The worker's "alerts" job records each new match
-- once, then sends it to the alert's Discord webhook (instant, daily or weekly).
-- The app shows unread matches.
create table if not exists alert_rules (
  id varchar(32) primary key,
  user_id text not null references "user"(id) on delete cascade,
  name varchar(80) not null,
  filters jsonb not null default '{}'::jsonb,
  source varchar(16) not null default 'all' check (source in ('all', 'competitors', 'inspirations')),
  frequency varchar(16) not null default 'instant' check (frequency in ('instant', 'daily', 'weekly')),
  discord_webhook text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_checked_at timestamptz,
  last_sent_at timestamptz
);
create index if not exists alert_rules_user_idx on alert_rules (user_id, created_at);

create table if not exists alert_matches (
  alert_id varchar(32) not null references alert_rules(id) on delete cascade,
  video_id varchar(32) not null,
  matched_at timestamptz not null default now(),
  -- Set when sent to Discord (or when there was nothing to send it to)
  notified_at timestamptz,
  read_at timestamptz,
  primary key (alert_id, video_id)
);
create index if not exists alert_matches_unread_idx on alert_matches (alert_id) where read_at is null;
create index if not exists alert_matches_pending_idx on alert_matches (alert_id) where notified_at is null;
