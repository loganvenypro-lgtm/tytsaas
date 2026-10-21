-- YouTube scanner: channels, videos, history and worker bookkeeping.
-- The tables already exist when the Outlr data was imported; every statement is
-- idempotent so a fresh database gets the same shape.

create table if not exists channels (
  id varchar(64) primary key,
  youtube_channel_id varchar(64) not null unique,
  name varchar(255) not null,
  handle varchar(255),
  thumbnail_url text,
  subscriber_count integer default 0,
  total_views bigint default 0,
  video_count integer default 0,
  median_views integer default 0,
  category varchar(100),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_rss_at timestamptz,
  last_stats_at timestamptz,
  rss_error_count integer not null default 0,
  country varchar(8),
  discovered_via varchar(16),
  discovered_at timestamptz,
  featured_checked_at timestamptz,
  trend_score real,
  recent_ratio real,
  backfilled_at timestamptz,
  channel_created_at timestamptz,
  outlier_rate real,
  opportunity_score real
);

create table if not exists videos (
  id varchar(64) primary key,
  youtube_video_id varchar(32) not null unique,
  channel_id varchar(64) references channels (id) on delete cascade,
  title text not null,
  description text,
  thumbnail_url text,
  published_at timestamptz not null,
  view_count bigint default 0,
  like_count integer default 0,
  comment_count integer default 0,
  duration_formatted varchar(32),
  duration_seconds integer default 0,
  is_short boolean default false,
  outlier_multiplier real default 1.0,
  views_per_day real default 0.0,
  title_pattern varchar(100),
  niche varchar(100),
  sub_niche varchar(100),
  analyzed_at timestamptz default now(),
  created_at timestamptz default now(),
  last_stats_at timestamptz,
  views_per_hour real,
  category_id smallint,
  tags text[],
  language varchar(16),
  relevance_score real,
  thumb_checked_at timestamptz
);

create table if not exists video_stat_snapshots (
  youtube_video_id varchar(32) not null,
  captured_at timestamptz not null default now(),
  view_count bigint not null,
  like_count integer,
  comment_count integer,
  primary key (youtube_video_id, captured_at)
);

create table if not exists channel_stat_snapshots (
  youtube_channel_id varchar(64) not null,
  captured_at timestamptz not null default now(),
  subscriber_count integer,
  total_views bigint not null,
  video_count integer,
  primary key (youtube_channel_id, captured_at)
);

-- Title and thumbnail history per video (A/B tests and post-publish changes).
-- Thumbnails are keyed by the ETag of i.ytimg.com: the Unix time the image was set.
create table if not exists video_variants (
  youtube_video_id varchar(32) not null,
  kind varchar(16) not null,
  value text not null,
  set_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  image bytea,
  primary key (youtube_video_id, kind, value)
);

create table if not exists api_quota_usage (
  day date primary key,
  units integer not null default 0,
  calls jsonb not null default '{}'
);

create table if not exists scan_runs (
  id bigserial primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status varchar(16) not null default 'running',
  stats jsonb not null default '{}',
  error text
);

create table if not exists discovery_queries (
  query text primary key,
  source varchar(16) not null,
  created_at timestamptz not null default now(),
  last_run_at timestamptz,
  runs integer not null default 0,
  videos_found integer not null default 0,
  new_channels integer not null default 0
);

create table if not exists discovery_rejected (
  youtube_channel_id varchar(64) primary key,
  rejected_at timestamptz not null default now(),
  reason varchar(64)
);

-- ---------------------------------------------------------------------------
-- Classification and precision columns
-- ---------------------------------------------------------------------------

alter table videos add column if not exists format varchar(32);
alter table videos add column if not exists title_hooks text[];
alter table videos add column if not exists niche_confidence real;
alter table videos add column if not exists lang varchar(8);
alter table videos add column if not exists classifier_version smallint;
alter table videos add column if not exists topic_categories text[];
alter table videos add column if not exists is_livestream boolean not null default false;
alter table videos add column if not exists made_for_kids boolean;
alter table videos add column if not exists short_checked_at timestamptz;
alter table videos add column if not exists baseline_views integer;
alter table videos add column if not exists engagement_rate real;
alter table videos add column if not exists thumbnail_variants smallint not null default 1;
alter table videos add column if not exists title_variants smallint not null default 1;
alter table videos add column if not exists sub_niche varchar(100);
alter table videos add column if not exists niche varchar(100);

alter table channels add column if not exists description text;
alter table channels add column if not exists keywords text;
alter table channels add column if not exists topic_categories text[];
alter table channels add column if not exists niche varchar(64);
alter table channels add column if not exists sub_niche varchar(64);
alter table channels add column if not exists niche_confidence real;
alter table channels add column if not exists primary_format varchar(32);
alter table channels add column if not exists lang varchar(8);
alter table channels add column if not exists category_id smallint;
alter table channels add column if not exists short_share real;
alter table channels add column if not exists uploads_per_week real;
alter table channels add column if not exists classifier_version smallint;
alter table channels add column if not exists classified_at timestamptz;

-- Per-job schedule of the worker (each job has its own interval).
create table if not exists worker_jobs (
  name varchar(32) primary key,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_status varchar(16),
  last_stats jsonb not null default '{}',
  last_error text
);

-- @handles mentioned in video descriptions, resolved once (channels.list forHandle, 1 unit).
create table if not exists discovery_handles (
  handle varchar(128) primary key,
  youtube_channel_id varchar(64),
  mentions integer not null default 1,
  first_seen_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_videos_niche on videos (niche, published_at desc);
create index if not exists idx_videos_format on videos (format);
create index if not exists idx_videos_lang on videos (lang);
create index if not exists idx_videos_hooks on videos using gin (title_hooks);
create index if not exists idx_videos_classifier on videos (classifier_version);
create index if not exists idx_videos_ab on videos (published_at desc) where thumbnail_variants > 1 or title_variants > 1;
create index if not exists idx_videos_short_check on videos (published_at desc) where short_checked_at is null;
create index if not exists idx_channels_niche on channels (niche);
create index if not exists idx_snapshots_captured on video_stat_snapshots (captured_at);
create index if not exists idx_channel_snapshots_captured on channel_stat_snapshots (captured_at);
create index if not exists idx_video_variants_seen on video_variants (kind, first_seen_at desc);
create index if not exists idx_videos_channel_pub on videos (channel_id, published_at desc);
create index if not exists idx_videos_pub on videos (published_at desc);
create index if not exists idx_videos_relevance on videos (relevance_score desc nulls last);
create index if not exists idx_videos_title_fts on videos using gin (to_tsvector('simple', title));
create index if not exists idx_channels_last_rss on channels (last_rss_at nulls first);
create index if not exists idx_channels_trend on channels (trend_score desc nulls last);
create index if not exists idx_channels_opportunity on channels (opportunity_score desc nulls last);

-- Discovery queries remember their niche, to target niches the database covers least.
alter table discovery_queries add column if not exists niche varchar(64);
