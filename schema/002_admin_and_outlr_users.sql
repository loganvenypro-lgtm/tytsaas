-- Better Auth admin plugin: roles, bans and impersonation.
alter table "user" add column if not exists "role" text not null default 'user';
alter table "user" add column if not exists "banned" boolean not null default false;
alter table "user" add column if not exists "banReason" text;
alter table "user" add column if not exists "banExpires" timestamptz;
alter table "session" add column if not exists "impersonatedBy" text;

-- Outlr profile fields, carried over from the old users table.
alter table "user" add column if not exists "plan" text not null default 'Pro';
alter table "user" add column if not exists "youtube_channel_id" varchar(64);
alter table "user" add column if not exists "competitor_channel_ids" text[] not null default '{}';
