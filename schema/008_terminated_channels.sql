-- Terminated channels: YouTube no longer returns them (banned, deleted or hidden).
-- Set by the worker's "terminated" job once channels.list confirms a failing RSS feed,
-- cleared when the channel answers again.
alter table channels add column if not exists terminated_at timestamptz;
alter table channels add column if not exists terminated_checked_at timestamptz;

create index if not exists channels_terminated_at_idx on channels (terminated_at desc) where terminated_at is not null;
