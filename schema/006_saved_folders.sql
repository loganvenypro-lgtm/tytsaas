-- Per-user folders to save videos and channels (imported from Outlr, created here
-- for fresh installs). Items keep a snapshot of what the card showed (title,
-- thumbnail, stats) so a folder renders even if the video or channel is not in
-- our database; live stats from videos / channels replace it when they exist.
create table if not exists saved_folders (
  id varchar(32) primary key,
  user_id text not null references "user"(id) on delete cascade,
  name varchar(80) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists saved_folders_user_idx on saved_folders (user_id, created_at);

create table if not exists saved_folder_items (
  folder_id varchar(32) not null references saved_folders(id) on delete cascade,
  item_type varchar(16) not null check (item_type in ('video', 'channel')),
  item_id varchar(64) not null,
  snapshot jsonb not null default '{}'::jsonb,
  added_at timestamptz not null default now(),
  primary key (folder_id, item_type, item_id)
);
create index if not exists saved_folder_items_item_idx on saved_folder_items (item_type, item_id);
