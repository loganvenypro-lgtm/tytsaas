-- Weekly recap: one edition per user and per week, built every Monday morning by
-- the worker's "weekly-digest" job (lib/weeklyDigest.js). The app shows the latest
-- edition as it was built, it never recomputes it when the user opens it.
create table if not exists weekly_digests (
  user_id text not null references "user"(id) on delete cascade,
  -- Monday the edition came out (Europe/Paris), e.g. 2026-10-19
  edition date not null,
  -- The 7 days it covers: [period_start, period_end)
  period_start timestamptz not null,
  period_end timestamptz not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, edition)
);
create index if not exists weekly_digests_edition_idx on weekly_digests (edition);
