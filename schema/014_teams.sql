-- Teams: Better Auth's organization plugin (organization, member, invitation,
-- session."activeOrganizationId"). Column names are camelCase because Better
-- Auth queries them by field name.
create table if not exists "organization" (
  "id" text primary key,
  "name" text not null,
  "slug" text not null unique,
  "logo" text,
  "metadata" text,
  "createdAt" timestamptz not null default current_timestamp
);

-- Roles: owner (the creator, can delete the team), admin (invites and removes
-- members), member (reads and edits the shared data)
create table if not exists "member" (
  "id" text primary key,
  "organizationId" text not null references "organization" ("id") on delete cascade,
  "userId" text not null references "user" ("id") on delete cascade,
  "role" text not null default 'member',
  "createdAt" timestamptz not null default current_timestamp
);
create unique index if not exists "member_org_user_idx" on "member" ("organizationId", "userId");
create index if not exists "member_userId_idx" on "member" ("userId");

-- Pending until accepted, rejected, canceled or past expiresAt (7 days)
create table if not exists "invitation" (
  "id" text primary key,
  "organizationId" text not null references "organization" ("id") on delete cascade,
  "email" text not null,
  "role" text,
  "teamId" text,
  "status" text not null default 'pending',
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz not null default current_timestamp,
  "inviterId" text not null references "user" ("id") on delete cascade
);
create index if not exists "invitation_org_idx" on "invitation" ("organizationId");
create index if not exists "invitation_email_idx" on "invitation" ("email");

-- The team the session works in; null is the user's personal space
alter table "session" add column if not exists "activeOrganizationId" text;
alter table "session" add column if not exists "activeTeamId" text;

-- Folders and followed channels belong to a team when organization_id is set
-- (user_id is then who added them), to the user alone when it is null.
alter table saved_folders add column if not exists organization_id text references "organization" ("id") on delete cascade;
create index if not exists saved_folders_org_idx on saved_folders (organization_id, created_at) where organization_id is not null;

alter table inspiration_channels add column if not exists organization_id text references "organization" ("id") on delete cascade;
-- One follow per channel and kind in each space: the old primary key
-- (user_id, kind, channel_id) would let two members follow the same channel twice
alter table inspiration_channels drop constraint if exists inspiration_channels_pkey;
create unique index if not exists inspiration_channels_personal_idx
  on inspiration_channels (user_id, kind, channel_id) where organization_id is null;
create unique index if not exists inspiration_channels_team_idx
  on inspiration_channels (organization_id, kind, channel_id) where organization_id is not null;
