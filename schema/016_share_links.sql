-- Share links: one per shared object. A folder link shows the folder read-only
-- to anyone who has it; a team link is a reusable invitation (joins as member).
-- Disabling keeps the row with enabled = false; regenerating changes the token,
-- so the old link stops working.
create table if not exists share_links (
  kind varchar(16) not null check (kind in ('folder', 'team')),
  target_id text not null,
  token varchar(64) not null unique,
  enabled boolean not null default true,
  created_by text not null references "user"(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (kind, target_id)
);

-- Links die with their folder or team (target_id has no foreign key since it
-- points at two tables)
create or replace function share_links_cleanup() returns trigger as $$
begin
  delete from share_links where kind = tg_argv[0] and target_id = old.id;
  return old;
end;
$$ language plpgsql;

drop trigger if exists saved_folders_share_links on saved_folders;
create trigger saved_folders_share_links after delete on saved_folders
  for each row execute function share_links_cleanup('folder');

drop trigger if exists organization_share_links on "organization";
create trigger organization_share_links after delete on "organization"
  for each row execute function share_links_cleanup('team');
