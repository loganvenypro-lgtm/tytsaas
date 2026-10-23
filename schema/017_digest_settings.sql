-- When and how each user gets their recap (lib/digestSettings.js). No row means
-- the defaults: weekly, Monday at 8:00 Paris time, every section, no email.
create table if not exists digest_settings (
  user_id text primary key references "user"(id) on delete cascade,
  enabled boolean not null default true,
  frequency varchar(16) not null default 'weekly' check (frequency in ('weekly', 'monthly')),
  -- Weekly: day of the week (0 = Sunday … 6 = Saturday)
  weekday smallint not null default 1 check (weekday between 0 and 6),
  -- Monthly: day of the month, up to 28 so every month has it
  month_day smallint not null default 1 check (month_day between 1 and 28),
  hour smallint not null default 8 check (hour between 0 and 23),
  timezone text not null default 'Europe/Paris',
  -- Which parts the recap shows (myChannel, topVideos, competitorHits, risingChannels)
  sections text[] not null default array['myChannel', 'topVideos', 'competitorHits', 'risingChannels'],
  -- Also send an email when an edition comes out
  email boolean not null default false,
  updated_at timestamptz not null default now()
);

-- A monthly edition covers a month, not 7 days
alter table weekly_digests add column if not exists frequency varchar(16) not null default 'weekly';
