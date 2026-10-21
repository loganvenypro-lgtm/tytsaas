/**
 * Background YouTube worker: keeps PostgreSQL fresh so the app never calls
 * YouTube while a user waits. Every tick runs the jobs that are due, in order;
 * each job has its own interval and its last run is kept in worker_jobs.
 * Jobs requested from the admin (worker_jobs.requested_at) run within a minute.
 *
 * Usage: npm run worker              loop every SCAN_INTERVAL_MINUTES
 *        npm run worker -- --once    one tick, then exit
 *        npm run worker -- --once --only=classify,scores
 */
import "../lib/env.js";
import { sql } from "../lib/sql.js";
import { quotaUsedToday, createBudget } from "../lib/youtube.js";
import { CONFIG } from "./config.js";
import { JOBS } from "./jobs/index.js";
import { trendingUnitsPerRun } from "./jobs/trending.js";
import { projectDailyDemand } from "./refreshPolicy.js";
import { planQuota, tickAllowance } from "./pilot.js";

const args = process.argv.slice(2);
const once = args.includes("--once");
const only = args.find((a) => a.startsWith("--only="))?.slice(7).split(",");

const clock = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

async function isDue(job, selected) {
  if (selected) return selected.includes(job.name);
  if (!job.everyMinutes) return true;
  const [row] = await sql`select last_finished_at from worker_jobs where name = ${job.name} and last_status = 'ok'`;
  return !row?.last_finished_at || Date.now() - new Date(row.last_finished_at).getTime() >= job.everyMinutes * 60_000;
}

/** One tick. `selected`: run exactly these jobs (CLI --only or an admin request). */
async function tick(selected = only) {
  const startedAt = Date.now();
  const [{ id: runId }] = await sql`insert into scan_runs default values returning id`;
  console.log(`\n[${clock()}] Tick #${runId}${selected ? ` (${selected.join(", ")})` : ""}`);

  const dailyBudget = Math.floor(CONFIG.dailyQuota * CONFIG.workerQuotaShare);
  const usedBefore = await quotaUsedToday();
  const { leftToday, allowance } = tickAllowance({ dailyBudget, usedToday: usedBefore, tickMinutes: CONFIG.tickMinutes });
  const pilot = planQuota({
    demand: await projectDailyDemand(),
    dailyBudget,
    // Trending charts are a fixed daily cost.
    fixedUnits: Math.round(trendingUnitsPerRun() * (24 / CONFIG.trendingIntervalHours)),
    config: CONFIG,
  });

  const budgets = {
    discovery: createBudget(Math.min(pilot.discoveryUnits, leftToday)),
    trending: createBudget(Math.min(trendingUnitsPerRun(), leftToday)),
    backfill: createBudget(allowance * CONFIG.backfillShare * (pilot.saturated ? 0.25 : 1)),
    channels: createBudget(allowance * CONFIG.channelShare),
  };
  // Videos and the RSS fallback share what the other jobs leave of the tick.
  const rest = createBudget(allowance);
  const budgetFor = (job) => {
    if (job.quota === "rest") {
      rest.allowed = Math.max(0, allowance - budgets.backfill.spent - budgets.channels.spent);
      return rest;
    }
    return budgets[job.quota] ?? createBudget(0);
  };

  const stats = { runId, jobs: {}, quota: { dailyBudget, usedBefore, tickAllowance: allowance }, pilot, requested: selected ?? null };
  console.log(
    `  quota: ${pilot.demand.total + pilot.fixedUnits}/${dailyBudget} units/day needed (${pilot.demand.activeChannels} channels), ` +
      (pilot.saturated
        ? "headroom too low: discovery paused, backfill slowed"
        : `discovery ${pilot.discoveryUnits} units/run, up to ${pilot.maxNewChannels} new channels/run`),
  );
  let failed = false;

  for (const job of JOBS) {
    if (!(await isDue(job, selected))) continue;
    const [state] = await sql`
      insert into worker_jobs (name, last_started_at) values (${job.name}, now())
      on conflict (name) do update set last_started_at = now()
      returning last_stats, last_finished_at`;
    const t0 = Date.now();
    try {
      if (job.name === "report") stats.quota.usedThisTick = (await quotaUsedToday()) - usedBefore;
      const result = await job.run({
        budget: budgetFor(job),
        previous: state.last_stats,
        since: state.last_finished_at ?? new Date(0),
        pilot,
        tick: stats,
      });
      result.ms = Date.now() - t0;
      stats.jobs[job.name] = result;
      await sql`
        -- A skipped run is not 'ok': interval jobs try again on the next tick.
        update worker_jobs set last_finished_at = now(), last_status = ${result.skipped ? "skipped" : "ok"},
          last_stats = ${sql.json(result)}, last_error = null
        where name = ${job.name}`;
      console.log(`  ✓ ${job.name.padEnd(12)} ${String(result.ms).padStart(6)} ms  ${JSON.stringify(result).slice(0, 220)}`);
    } catch (err) {
      failed = true;
      stats.jobs[job.name] = { error: err.message };
      await sql`
        update worker_jobs set last_finished_at = now(), last_status = 'failed', last_error = ${err.message}
        where name = ${job.name}`;
      console.error(`  ✗ ${job.name}:`, err);
    }
  }

  stats.quota.usedThisTick = (await quotaUsedToday()) - usedBefore;
  stats.durationMs = Date.now() - startedAt;
  await sql`
    update scan_runs set finished_at = now(), status = ${failed ? "failed" : "ok"}, stats = ${sql.json(stats)}
    where id = ${runId}`;
  console.log(`[${clock()}] Tick #${runId} done in ${Math.round(stats.durationMs / 1000)} s, ${stats.quota.usedThisTick} quota units`);
}

let running = false;
async function safeTick(selected) {
  if (running) return console.warn("Previous tick still running, skipped.");
  running = true;
  try {
    await tick(selected);
  } catch (err) {
    console.error("Tick failed:", err);
  } finally {
    running = false;
  }
}

/** Jobs the admin asked to run now (POST /api/admin/worker/run). */
async function runRequested() {
  if (running) return;
  const rows = await sql`
    select name from worker_jobs
    where requested_at is not null and (last_started_at is null or requested_at > last_started_at)`;
  const names = rows.map((r) => r.name).filter((name) => JOBS.some((j) => j.name === name));
  if (names.length) await safeTick(names);
}

console.log(`YouTube worker, one tick every ${CONFIG.tickMinutes} min`);
await safeTick();
if (once) {
  await sql.end();
} else {
  setInterval(safeTick, CONFIG.tickMinutes * 60_000);
  setInterval(() => runRequested().catch((err) => console.error("Requested run failed:", err)), 60_000);
  // pm2 stops with SIGINT: let the current tick's queries finish their connection cleanly.
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
      console.log(`${signal}: stopping`);
      await sql.end({ timeout: 5 });
      process.exit(0);
    });
  }
}
