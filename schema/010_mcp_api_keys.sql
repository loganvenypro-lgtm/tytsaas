-- Personal keys that connect Claude to the MCP server (/api/mcp). Only the
-- SHA-256 of a key is stored; the plain key is shown once at creation. Keys
-- created in Outlr were imported into this table and keep working.
create table if not exists mcp_api_keys (
  id varchar(32) primary key,
  user_id varchar(255) not null references "user"(id) on delete cascade,
  name varchar(80) not null,
  key_hash char(64) not null unique,
  key_prefix varchar(16) not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists mcp_api_keys_user_idx on mcp_api_keys (user_id, created_at desc);
