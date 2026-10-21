/**
 * The worker's jobs in run order. `everyMinutes` is the minimum time between
 * two runs; `quota` picks the job's share of the tick allowance ("discovery"
 * and "trending" have their own). Imported by the worker and the admin API.
 */
import { CONFIG } from "../config.js";
import { runRss } from "./rss.js";
import { refreshVideos, refreshChannels } from "./refresh.js";
import { runBackfill } from "./backfill.js";
import { runShortsProbe } from "./shorts.js";
import { runAbTests } from "./abtests.js";
import { runClassify } from "./classify.js";
import { runScores } from "./scores.js";
import { runTrending } from "./trending.js";
import { runDiscovery } from "./discovery.js";
import { runMonetization } from "./monetization.js";
import { runReport } from "./report.js";
import { runPurge } from "./purge.js";

export const JOBS = [
  { name: "rss", everyMinutes: 0, quota: "rest", run: runRss },
  { name: "trending", everyMinutes: CONFIG.trendingIntervalHours * 60, quota: "trending", run: runTrending },
  { name: "discovery", everyMinutes: CONFIG.discoveryIntervalHours * 60, quota: "discovery", run: runDiscovery },
  { name: "backfill", everyMinutes: 0, quota: "backfill", run: runBackfill },
  { name: "channels", everyMinutes: 0, quota: "channels", run: refreshChannels },
  { name: "videos", everyMinutes: 0, quota: "rest", run: refreshVideos },
  { name: "shorts", everyMinutes: 0, run: runShortsProbe },
  { name: "abtests", everyMinutes: 0, run: runAbTests },
  { name: "classify", everyMinutes: 0, run: runClassify },
  { name: "scores", everyMinutes: 0, run: runScores },
  { name: "monetization", everyMinutes: CONFIG.monetizationIntervalHours * 60, run: runMonetization },
  { name: "purge", everyMinutes: 24 * 60, run: runPurge },
  // Last: reads what the other jobs did this tick.
  { name: "report", everyMinutes: 0, run: runReport },
];
