-- "Ma chaîne": the user's own YouTube channel, linked through Google OAuth
-- (youtube.readonly, optionally yt-analytics.readonly) on top of the existing
-- Google sign-in. Tokens stay in Better Auth's "account" table.

-- When the channel came from the OAuth link (channels.list mine=true) rather than
-- typed at onboarding, and when its uploads were last pulled for the space.
alter table "user" add column if not exists "youtube_linked_at" timestamptz;
alter table "user" add column if not exists "youtube_synced_at" timestamptz;

-- Answers of the OAuth-only APIs (YouTube Analytics), cached per user so a page
-- view never calls Google more than once per few hours.
create table if not exists my_channel_cache (
  user_id text not null references "user"(id) on delete cascade,
  key varchar(64) not null,
  data jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- AI "revive this video" reports, kept so reopening one costs nothing.
create table if not exists video_revival_reports (
  user_id text not null references "user"(id) on delete cascade,
  youtube_video_id varchar(32) not null,
  locale varchar(8) not null,
  report jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, youtube_video_id, locale)
);
