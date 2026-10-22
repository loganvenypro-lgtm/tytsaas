-- Onboarding completion. Accounts that existed before the onboarding came back
-- count as onboarded, so only new sign-ups are sent to /onboarding.
alter table "user" add column if not exists "onboarded_at" timestamptz;
alter table "user" add column if not exists "onboarding_role" varchar(16);
update "user" set "onboarded_at" = "createdAt" where "onboarded_at" is null and "createdAt" < '2026-10-22';
