import { sql } from "../lib/sql.js";
import { quotaUsedToday } from "../lib/youtube.js";
import { sendDiscord } from "../lib/discord.js";
import { CONFIG } from "../worker/config.js";
import { JOBS } from "../worker/jobs/index.js";
import { sourceRoi } from "../worker/jobs/discovery.js";
import { trendingUnitsPerRun } from "../worker/jobs/trending.js";
import { collectTotals, sendDailyReport } from "../worker/jobs/report.js";
import { projectDailyDemand } from "../worker/refreshPolicy.js";
import { planQuota } from "../worker/pilot.js";

const iso = (date) => (date ? new Date(date).toISOString() : null);

/**
 * Everything about the YouTube worker for the admin: each job's last run and
 * next due time, recent ticks, quota per day, the quota pilot's projection,
 * discovery ROI per source, data growth and monetization estimates.
 */
export async function status(req, res) {
  const dailyBudget = Math.floor(CONFIG.dailyQuota * CONFIG.workerQuotaShare);
  const [jobRows, ticks, quotaDays, usedToday, demand, roi, totals, growth, [monetization], discovery] = await Promise.all([
    sql`select * from worker_jobs`,
    sql`
      select id, started_at, finished_at, status, stats->'quota' as quota, stats->'requested' as requested,
        (select jsonb_object_agg(key, value ? 'error') from jsonb_each(stats->'jobs')) as job_errors
      from scan_runs order by id desc limit 30`,
    sql`select day, units, calls from api_quota_usage order by day desc limit 14`,
    quotaUsedToday(),
    projectDailyDemand(),
    sourceRoi(),
    collectTotals(),
    sql`
      select
        (select count(*) from videos where created_at > now() - interval '24 hours')::int as videos_24h,
        (select count(*) from channels where discovered_at > now() - interval '24 hours')::int as channels_24h,
        (select count(*) from video_stat_snapshots where captured_at > now() - interval '24 hours')::int as snapshots_24h,
        (select count(*) from video_variants where first_seen_at > now() - interval '24 hours')::int as variants_24h,
        (select max(day) from trending_entries) as trending_day,
        (select count(*) from trending_entries where day = (select max(day) from trending_entries))::int as trending_entries`,
    sql`
      select
        count(*) filter (where ypp_status = 'eligible')::int as eligible,
        count(*) filter (where ypp_status = 'early')::int as early,
        count(*) filter (where ypp_status = 'not_eligible')::int as "notEligible",
        count(*) filter (where ypp_status is null)::int as unknown,
        (select count(*) from channel_monetization_events
           where status is not null and detected_at > now() - interval '7 days')::int as "changes7d",
        max(ypp_checked_at) as "checkedAt"
      from channels where rss_error_count < 5`,
    sql`
      select query, source, niche, runs, videos_found, new_channels, last_run_at
      from discovery_queries
      where runs > 0
      order by new_channels desc, runs desc
      limit 15`,
  ]);

  const byName = new Map(jobRows.map((j) => [j.name, j]));
  const jobs = JOBS.map((job) => {
    const row = byName.get(job.name);
    const lastOk = row?.last_status === "ok" ? row.last_finished_at : null;
    return {
      name: job.name,
      everyMinutes: job.everyMinutes,
      status: row?.last_status ?? null,
      lastStartedAt: iso(row?.last_started_at),
      lastFinishedAt: iso(row?.last_finished_at),
      // Every-tick jobs run on the next tick; interval jobs once their interval has passed.
      nextDueAt: job.everyMinutes && lastOk ? iso(new Date(lastOk).getTime() + job.everyMinutes * 60_000) : null,
      requestedAt: iso(row?.requested_at),
      pending: Boolean(row?.requested_at && (!row.last_started_at || row.requested_at > row.last_started_at)),
      lastError: row?.last_error ?? null,
      lastStats: row?.last_stats ?? null,
    };
  });

  const fixedUnits = Math.round(trendingUnitsPerRun() * (24 / CONFIG.trendingIntervalHours));
  const lastTickAt = ticks.find((t) => t.finished_at)?.finished_at;
  res.json({
    // The worker writes a tick every SCAN_INTERVAL_MINUTES: two missed ticks = not running.
    alive: Boolean(lastTickAt && Date.now() - new Date(lastTickAt).getTime() < CONFIG.tickMinutes * 2.5 * 60_000),
    tickMinutes: CONFIG.tickMinutes,
    jobs,
    ticks: ticks.map((t) => ({
      id: Number(t.id),
      startedAt: iso(t.started_at),
      finishedAt: iso(t.finished_at),
      status: t.status,
      quota: t.quota,
      requested: t.requested,
      failedJobs: Object.entries(t.job_errors ?? {}).filter(([, failed]) => failed).map(([name]) => name),
    })),
    quota: {
      dailyQuota: CONFIG.dailyQuota,
      dailyBudget,
      usedToday,
      days: quotaDays.map((d) => ({ day: d.day, units: d.units, calls: d.calls })),
    },
    pilot: planQuota({ demand, dailyBudget, fixedUnits, config: CONFIG }),
    discovery: { roi, topQueries: discovery },
    totals,
    growth,
    monetization,
    discord: { configured: Boolean(CONFIG.discordWebhook), alerts: Boolean(CONFIG.discordAlertsWebhook) },
  });
}

/** Asks the worker to run these jobs within a minute: { jobs: ["discovery", "scores"] }. */
export async function run(req, res) {
  const names = [...new Set(Array.isArray(req.body?.jobs) ? req.body.jobs : [])].filter((name) =>
    JOBS.some((j) => j.name === name),
  );
  if (!names.length) return res.status(400).json({ error: "Aucun job valide.", jobs: JOBS.map((j) => j.name) });
  await sql`
    insert into worker_jobs (name, requested_at)
    select unnest(${names}::text[]), now()
    on conflict (name) do update set requested_at = now()`;
  res.json({ requested: names });
}

/** Sends a test message, or the daily report without recording it: { kind: "ping" | "daily" }. */
export async function testDiscord(req, res) {
  if (!CONFIG.discordWebhook) return res.status(400).json({ error: "DISCORD_WEBHOOK_URL n'est pas configuré." });
  const ok =
    req.body?.kind === "daily"
      ? await sendDailyReport({ record: false })
      : await sendDiscord(CONFIG.discordWebhook, {
          content: `✅ Webhook OK (test envoyé depuis l'admin par ${req.admin.email}).`,
        });
  res.status(ok ? 200 : 502).json({ ok });
}
