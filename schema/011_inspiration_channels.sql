-- Channels each user follows, with their own tags and notes:
--   inspiration  /channels/inspirations
--   competitor   /channels/competitors, mirrored in "user".competitor_channel_ids
--                (picked at onboarding, read by the home page)
-- tracked_channels stays the worker's global watch list (it reads those channels
-- first): following a channel adds it there too.
-- seen_at is the user's last visit of the page, so outliers published since then
-- show as "new".
create table if not exists inspiration_channels (
  user_id text not null references "user"(id) on delete cascade,
  kind varchar(16) not null default 'inspiration' check (kind in ('inspiration', 'competitor')),
  channel_id varchar(64) not null,
  tags text[] not null default '{}',
  notes text check (notes is null or char_length(notes) <= 4000),
  followed_at timestamptz not null default now(),
  seen_at timestamptz not null default now(),
  primary key (user_id, kind, channel_id)
);
create index if not exists inspiration_channels_channel_idx on inspiration_channels (channel_id);
