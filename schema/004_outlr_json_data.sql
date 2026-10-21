-- Data that only existed in Outlr's JSON stores (data/*.json), filled once by
-- scripts/import-outlr-json.js. Channels, videos, snapshots, alerts and title /
-- thumbnail variants go to the scanner tables; the rest gets its own tables here.

-- Editorial profile of a channel, from Outlr's AI analysis (intelligence_database.json → channelDna)
create table if not exists channel_dna (
  youtube_channel_id varchar(64) primary key,
  archetype varchar(100),
  archetype_label text,
  primary_niche text,
  secondary_niches text[] not null default '{}',
  content_pillars text[] not null default '{}',
  video_formats text[] not null default '{}',
  editorial_traits text[] not null default '{}',
  language varchar(16),
  representative_video_ids text[] not null default '{}',
  confidence real,
  typical_views bigint,
  typical_duration_seconds integer,
  upload_frequency_days real,
  analyzed_at timestamptz
);

-- Competitor graph between channels (intelligence_database.json → channelRelationships)
create table if not exists channel_relationships (
  source_channel_id varchar(64) not null,
  target_channel_id varchar(64) not null,
  -- null for "niche_peer" links, which only share a niche
  similarity_score real,
  relationship_type varchar(50),
  shared_topics text[] not null default '{}',
  co_occurrence_count integer,
  calculated_at timestamptz,
  primary key (source_channel_id, target_channel_id)
);

-- A/B test verdict per monitored video; its versions live in video_variants (thumbnail_intelligence_db.json)
create table if not exists video_ab_analyses (
  youtube_video_id varchar(64) primary key,
  classification varchar(50),
  confidence_score real,
  evidence text[] not null default '{}',
  uncertainty_reasons text[] not null default '{}',
  -- views gained per hour before / after the change, and the verdict (acceleration, deceleration…)
  performance jsonb,
  niche text,
  first_discovered_at timestamptz,
  last_change_at timestamptz,
  last_observed_at timestamptz
);

-- Sponsors detected in videos (sponsor_database.json)
create table if not exists sponsor_brands (
  id varchar(64) primary key,
  name text not null,
  normalized_name text not null,
  website text,
  industry text,
  contact_email text,
  created_at timestamptz not null default now()
);

create table if not exists sponsor_videos (
  id varchar(64) primary key,
  youtube_video_id varchar(64) not null unique,
  title text not null,
  thumbnail_url text,
  published_at timestamptz,
  view_count bigint,
  duration_formatted varchar(20),
  analyzed_at timestamptz
);

create table if not exists sponsorships (
  id varchar(64) primary key,
  brand_id varchar(64) not null references sponsor_brands(id) on delete cascade,
  sponsor_video_id varchar(64) not null references sponsor_videos(id) on delete cascade,
  detection_method varchar(50),
  confidence varchar(20),
  evidence text,
  time_code varchar(50),
  status varchar(50),
  detected_at timestamptz not null default now()
);

create index if not exists sponsorships_brand_idx on sponsorships (brand_id);
create index if not exists channel_relationships_target_idx on channel_relationships (target_channel_id);
