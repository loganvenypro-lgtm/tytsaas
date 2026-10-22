-- Ideation notes on a video saved in a folder: video ideas, hooks and titles the
-- user writes while studying it. They belong to the folder item, so removing the
-- video from the folder (or deleting the folder) deletes its notes.
create table if not exists saved_folder_notes (
  id varchar(32) primary key,
  folder_id varchar(32) not null,
  item_type varchar(16) not null default 'video' check (item_type = 'video'),
  item_id varchar(64) not null,
  kind varchar(16) not null default 'idea' check (kind in ('idea', 'hook', 'title')),
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (folder_id, item_type, item_id)
    references saved_folder_items (folder_id, item_type, item_id) on delete cascade
);
create index if not exists saved_folder_notes_item_idx on saved_folder_notes (folder_id, item_id, created_at);
