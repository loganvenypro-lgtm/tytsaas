-- Worker v2: free RSS view counts, daily trending charts, discovery spend per
-- source, estimated monetization, Discord reports and admin-requested runs.

-- RSS feeds carry live view counts for each channel's last 15 uploads.
alter table videos add column if not exists rss_views_at timestamptz;
-- Highest outlier tier already posted to Discord (1: >= 3x, 2: >= 10x, 3: >= 25x).
alter table videos add column if not exists discord_tier smallint;
alter table videos add column if not exists discord_reported_at timestamptz;

-- Admin "run now": the worker runs a job when requested_at is newer than its last start.
alter table worker_jobs add column if not exists requested_at timestamptz;

-- Daily trending charts (videos.list chart=mostPopular), one row per position.
-- category_id 0 = the region's overall chart.
create table if not exists trending_entries (
  day date not null,
  region varchar(2) not null,
  category_id smallint not null,
  rank smallint not null,
  youtube_video_id varchar(32) not null,
  youtube_channel_id varchar(64) not null,
  title text not null,
  view_count bigint,
  published_at timestamptz,
  primary key (day, region, category_id, rank)
);
alter table trending_entries add column if not exists video_category_id smallint;
create index if not exists idx_trending_video on trending_entries (youtube_video_id, day desc);
create index if not exists idx_trending_channel on trending_entries (youtube_channel_id, day desc);

-- Quota spent and channels found per discovery source and day, for source ROI.
create table if not exists discovery_spend (
  day date not null,
  source varchar(16) not null,
  units integer not null default 0,
  candidates integer not null default 0,
  added integer not null default 0,
  primary key (day, source)
);

-- Estimated YouTube Partner Program eligibility and ad revenue (Data API stats only,
-- watch pages are never read). Watch hours and Shorts views are lower bounds built
-- from the videos in the database.
alter table channels add column if not exists ypp_status varchar(16);
alter table channels add column if not exists ypp_watch_hours real;
alter table channels add column if not exists ypp_shorts_views bigint;
alter table channels add column if not exists ypp_checked_at timestamptz;
alter table channels add column if not exists ypp_changed_at timestamptz;
alter table channels add column if not exists est_daily_views real;
alter table channels add column if not exists est_rpm real;
alter table channels add column if not exists est_monthly_revenue_low real;
alter table channels add column if not exists est_monthly_revenue_high real;
create index if not exists idx_channels_ypp on channels (ypp_status, ypp_changed_at desc);
create index if not exists idx_channels_revenue on channels (est_monthly_revenue_high desc nulls last);

-- One row per estimated status change (e.g. not_eligible -> eligible).
create table if not exists channel_monetization_events (
  id bigserial primary key,
  channel_id varchar(64) not null references channels (id) on delete cascade,
  status varchar(16) not null,
  previous_status varchar(16),
  detected_at timestamptz not null default now(),
  subscriber_count integer,
  watch_hours real,
  shorts_views bigint
);
-- Outlr's version of this table had a monetized boolean instead of status.
alter table channel_monetization_events add column if not exists status varchar(16);
alter table channel_monetization_events add column if not exists previous_status varchar(16);
alter table channel_monetization_events add column if not exists subscriber_count integer;
alter table channel_monetization_events add column if not exists watch_hours real;
alter table channel_monetization_events add column if not exists shorts_views bigint;
do $$ begin
  if exists (select 1 from information_schema.columns
             where table_name = 'channel_monetization_events' and column_name = 'monetized') then
    alter table channel_monetization_events alter column monetized drop not null;
  end if;
end $$;
create index if not exists idx_monetization_events_detected on channel_monetization_events (detected_at desc);

-- Discord reports already sent (the daily one compares its totals with the previous).
create table if not exists discord_reports (
  id bigserial primary key,
  kind varchar(16) not null,
  sent_at timestamptz not null default now(),
  totals jsonb not null default '{}'
);
create index if not exists idx_discord_reports_kind on discord_reports (kind, sent_at desc);

create index if not exists idx_videos_discord on videos (published_at desc) where relevance_score is not null;
