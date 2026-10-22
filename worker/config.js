// Worker settings. Every value can be overridden from .env.
const num = (key, fallback) => {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && process.env[key] !== "" ? value : fallback;
};
const list = (key, fallback) =>
  (process.env[key] ?? fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const CONFIG = {
  // Main loop: every tick runs the jobs that are due.
  tickMinutes: num("SCAN_INTERVAL_MINUTES", 30),

  // Quota: the app itself never calls YouTube, so the worker may use most of it.
  dailyQuota: num("YOUTUBE_DAILY_QUOTA", 10_000),
  workerQuotaShare: num("SCAN_QUOTA_SHARE", 0.9),
  // Share of each tick's allowance kept for backfills and channel stats; videos get the rest.
  backfillShare: num("SCAN_BACKFILL_SHARE", 0.25),
  channelShare: num("SCAN_CHANNEL_SHARE", 0.15),

  // RSS: every channel is read once per rotation.
  rssRotationHours: num("SCAN_RSS_ROTATION_HOURS", 4),
  rssMinPerTick: num("SCAN_RSS_CHANNELS", 400),
  rssMaxPerTick: num("SCAN_RSS_MAX_CHANNELS", 3000),
  rssConcurrency: num("SCAN_RSS_CONCURRENCY", 5),
  rssBackoffBaseMinutes: num("SCAN_RSS_BACKOFF_MINUTES", 15),
  rssBackoffMaxMinutes: num("SCAN_RSS_BACKOFF_MAX_MINUTES", 240),
  // Channels read through playlistItems (1 unit each) while RSS is throttled.
  rssFallbackMaxCalls: num("SCAN_RSS_FALLBACK_MAX", 200),
  // Channels with an upload < 48 h are read this often: their feed is a free, live view counter.
  rssHotMinutes: num("SCAN_RSS_HOT_MINUTES", 60),
  rssHotMaxPerTick: num("SCAN_RSS_HOT_MAX", 800),
  // View snapshots from RSS for videos up to this age (velocity for free).
  rssSnapshotMaxAgeDays: num("SCAN_RSS_SNAPSHOT_DAYS", 7),

  // Relevance filters: a video gets a relevance score only if it clears all of them.
  minSubscribers: num("OUTLIER_MIN_SUBS", 1000),
  minViewsLong: num("OUTLIER_MIN_VIEWS_LONG", 10_000),
  minViewsShort: num("OUTLIER_MIN_VIEWS_SHORT", 50_000),
  // Baseline floor so "usually 0 views, now 1K" doesn't read as a 1000x outlier.
  medianFloorLong: num("OUTLIER_MEDIAN_FLOOR_LONG", 1000),
  medianFloorShort: num("OUTLIER_MEDIAN_FLOOR_SHORT", 5000),
  // Baseline = median of the channel's last N matured uploads of the same format.
  baselineVideos: num("OUTLIER_BASELINE_VIDEOS", 30),
  baselineMinVideos: num("OUTLIER_BASELINE_MIN_VIDEOS", 5),
  baselineMinAgeDays: num("OUTLIER_BASELINE_MIN_AGE_DAYS", 3),

  // Backfill: newly added channels get their last 50 uploads + stats (2 units) for an immediate baseline.
  backfillMaxPerTick: num("BACKFILL_MAX_PER_TICK", 60),

  // A/B tests (thumbnail CDN, free): how recent and how often.
  abWindowDays: num("AB_WINDOW_DAYS", 14),
  // Videos < 48 h are rechecked hourly (~5-6K of them): each tick must cover half of them plus the rest.
  abMaxPerTick: num("AB_MAX_PER_TICK", 3000),

  // Shorts probe (free): videos up to 3 min whose format is not certain yet.
  shortsMaxPerTick: num("SHORTS_MAX_PER_TICK", 800),

  // Classification (local, no quota).
  classifyBatch: num("CLASSIFY_BATCH", 4000),
  channelReclassifyDays: num("CHANNEL_RECLASSIFY_DAYS", 7),

  // Discovery
  discoveryIntervalHours: num("DISCOVERY_INTERVAL_HOURS", 6),
  discoveryQuota: num("DISCOVERY_QUOTA_PER_RUN", 900),
  discoveryRegions: list("DISCOVERY_REGIONS", "US,GB,CA,FR,DE,ES,BR,IN"),
  discoverySearchesPerRun: num("DISCOVERY_SEARCHES_PER_RUN", 4),
  // Upper bounds; within them, each source spends what its ROI share allows.
  discoveryFeaturedPerRun: num("DISCOVERY_FEATURED_PER_RUN", 100),
  discoveryHandlesPerRun: num("DISCOVERY_HANDLES_PER_RUN", 150),
  // Source ROI: each source gets a share of the run's quota proportional to the useful
  // channels it found per unit over this window, never under the floor (keeps exploring).
  discoveryRoiDays: num("DISCOVERY_ROI_DAYS", 30),
  discoveryMinSourceShare: num("DISCOVERY_MIN_SOURCE_SHARE", 0.1),
  // Trending charts: once a day per region × category (1 unit each), stored for the app.
  trendingIntervalHours: num("TRENDING_INTERVAL_HOURS", 24),
  discoveryMaxNewPerRun: num("DISCOVERY_MAX_NEW_PER_RUN", 300),
  discoveryMinSubs: num("DISCOVERY_MIN_SUBS", 1000),
  // Skips media giants (labels, TV networks) that trending charts are full of.
  discoveryMaxSubs: num("DISCOVERY_MAX_SUBS", 10_000_000),
  discoveryMinVideos: num("DISCOVERY_MIN_VIDEOS", 5),
  // Quota pilot. headroom = daily budget - projected daily refresh demand.
  // Discovery gets this share of the headroom per day…
  pilotDiscoveryShare: num("PILOT_DISCOVERY_SHARE", 0.4),
  // …new channels may add this share of the headroom to the daily refresh demand per day…
  pilotGrowthShare: num("PILOT_GROWTH_SHARE", 0.25),
  // …and discovery stops while the headroom is under this share of the daily budget.
  pilotMinHeadroomShare: num("PILOT_MIN_HEADROOM_SHARE", 0.1),
  // Extra seed queries on top of the taxonomy's per-niche queries.
  discoverySeedQueries: list("DISCOVERY_QUERIES", ""),

  // Terminated channels: suspects (failing RSS) confirmed with channels.list, 50 ids per unit.
  terminatedIntervalHours: num("TERMINATED_INTERVAL_HOURS", 6),
  terminatedMaxCalls: num("TERMINATED_MAX_CALLS", 20),
  // Suspect after this many RSS 404s in a row, or without a feed read for this long.
  terminatedMinRssErrors: num("TERMINATED_MIN_RSS_ERRORS", 1),
  terminatedStaleRssHours: num("TERMINATED_STALE_RSS_HOURS", 72),
  // A suspect that answered isn't checked again before this; terminated channels are rechecked this often.
  terminatedSuspectCooldownHours: num("TERMINATED_SUSPECT_COOLDOWN_HOURS", 24),
  terminatedRecheckHours: num("TERMINATED_RECHECK_HOURS", 72),

  // Estimated monetization (local, no quota).
  monetizationIntervalHours: num("MONETIZATION_INTERVAL_HOURS", 6),

  // Discord (DISCORD_WEBHOOK_URL; alerts go to DISCORD_ALERTS_WEBHOOK_URL when set).
  discordWebhook: process.env.DISCORD_WEBHOOK_URL ?? "",
  discordAlertsWebhook: process.env.DISCORD_ALERTS_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || "",
  // Outliers are posted once per tier (3x, 10x, 25x) when their relevance score clears this.
  discordMinScore: num("DISCORD_MIN_SCORE", 60),
  discordMaxPerReport: num("DISCORD_MAX_PER_REPORT", 5),
  discordWindowHours: num("DISCORD_WINDOW_HOURS", 48),
  discordDailyHour: num("DISCORD_DAILY_HOUR", 9), // Europe/Paris
};
