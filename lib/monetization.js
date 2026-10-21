/**
 * Estimated monetization from Data API stats only (no watch-page scraping):
 * Partner Program eligibility from subscribers, long-form watch hours (12 months)
 * and Shorts views (90 days), and a monthly ad revenue range for eligible
 * channels. Pure functions, used by the worker's monetization job.
 */
import {
  YPP, NICHE_RPM, DEFAULT_RPM, SHORTS_RPM, LANGUAGE_RPM_FACTOR, DEFAULT_LANGUAGE_FACTOR, AVERAGE_VIEW_SHARE,
} from "./taxonomy/monetization.js";

const DAY = 86_400_000;

export function averageViewShare(durationSeconds) {
  return AVERAGE_VIEW_SHARE.find(([max]) => durationSeconds <= max)[1];
}

/**
 * Watch hours and views from a channel's videos in the database. Lower bounds:
 * videos older than the database's history aren't counted.
 * @param videos [{ views, durationSeconds, isShort, isLivestream, publishedAt }]
 */
export function summarizeVideos(videos, now = Date.now()) {
  let watchHours = 0;
  let shortsViews90d = 0;
  let longViews90d = 0;
  let uploads90d = 0;
  // Average watched seconds per long-form view, weighted by views (any age).
  let longViews = 0;
  let longWatchedSeconds = 0;
  let allShortsViews = 0;
  let allViews = 0;
  for (const v of videos) {
    const age = now - new Date(v.publishedAt).getTime();
    const views = Number(v.views ?? 0);
    allViews += views;
    if (v.isShort) allShortsViews += views;
    if (!v.isShort && !v.isLivestream && v.durationSeconds > 0) {
      longViews += views;
      longWatchedSeconds += views * v.durationSeconds * averageViewShare(v.durationSeconds);
    }
    if (age < 0 || age > 365 * DAY) continue;
    if (age <= 90 * DAY) {
      uploads90d++;
      if (v.isShort) shortsViews90d += views;
      else longViews90d += views;
    }
    if (!v.isShort && !v.isLivestream && v.durationSeconds > 0) {
      watchHours += (views * v.durationSeconds * averageViewShare(v.durationSeconds)) / 3600;
    }
  }
  return {
    watchHours: Math.round(watchHours),
    shortsViews90d,
    uploads90d,
    // Where the channel's views come from: recent uploads when there are some, else its whole catalogue.
    shortsViewShare:
      shortsViews90d + longViews90d > 0
        ? shortsViews90d / (shortsViews90d + longViews90d)
        : allViews > 0
          ? allShortsViews / allViews
          : 0,
    watchedSecondsPerLongView: longViews > 0 ? longWatchedSeconds / longViews : null,
  };
}

/** eligible | early | not_eligible, or null when subscribers are hidden. */
export function yppStatus({ subscribers, watchHours, shortsViews90d, uploads90d }) {
  if (subscribers == null) return null;
  const meets = (t) =>
    subscribers >= t.subscribers && (watchHours >= t.watchHours || shortsViews90d >= t.shortsViews90d);
  if (meets(YPP.full)) return "eligible";
  if (meets(YPP.early) && uploads90d >= YPP.early.uploads90d) return "early";
  return "not_eligible";
}

/** Blended RPM range [low, typical, high] after market and Shorts adjustments. */
export function blendedRpm({ niche, lang, shortsViewShare }) {
  const long = NICHE_RPM[niche] ?? DEFAULT_RPM;
  const market = LANGUAGE_RPM_FACTOR[lang] ?? DEFAULT_LANGUAGE_FACTOR;
  const shorts = Math.min(1, Math.max(0, shortsViewShare ?? 0));
  return long.map((rpm, i) => Math.round(((1 - shorts) * rpm * market + shorts * SHORTS_RPM[i]) * 100) / 100);
}

/**
 * Full estimate for one channel.
 * @param channel { subscribers, niche, lang, dailyViews (whole channel, or null),
 *                  historyComplete (the database holds all its uploads of the last 12 months) }
 */
export function estimateMonetization(channel, videos, now = Date.now()) {
  const summary = summarizeVideos(videos, now);

  // Views this month's uploads gathered are a floor for the channel's daily views,
  // also when the channel's total view counter hasn't moved between snapshots.
  const recentViews = videos
    .filter((v) => now - new Date(v.publishedAt).getTime() <= 28 * DAY)
    .reduce((acc, v) => acc + Number(v.views ?? 0), 0);
  const dailyViews = Math.max(channel.dailyViews ?? 0, recentViews / 28);

  // Watch hours, two ways, keep the larger:
  //   - this year's uploads: their views × watched share (misses views on older videos)
  //   - whole-channel views per day × long-form share × watched seconds per view, over a year
  const fromChannelViews =
    channel.dailyViews != null && summary.watchedSecondsPerLongView != null
      ? (channel.dailyViews * 365 * (1 - summary.shortsViewShare) * summary.watchedSecondsPerLongView) / 3600
      : 0;
  const watchHours = Math.round(Math.max(summary.watchHours, fromChannelViews));
  // Same for Shorts: views on every Short over 90 days, not only on this quarter's.
  const shortsViews90d = Math.round(
    Math.max(summary.shortsViews90d, (channel.dailyViews ?? 0) * 90 * summary.shortsViewShare),
  );

  let status = yppStatus({ subscribers: channel.subscribers, ...summary, watchHours, shortsViews90d });
  // Without the full year of uploads (the Shorts / long-form mix would come from a
  // sample) and the channel's measured views per day (views on older videos count
  // too), the figures are lower bounds: they can prove "eligible", not "not yet".
  if (status !== "eligible" && !(channel.historyComplete && channel.dailyViews != null)) status = null;
  const rpm = blendedRpm({ niche: channel.niche, lang: channel.lang, shortsViewShare: summary.shortsViewShare });

  // Ad revenue needs the full Partner Program; the expanded tier only opens fan funding.
  const monthly = (r) => (status === "eligible" && dailyViews > 0 ? Math.round((dailyViews * 30 * r) / 1000) : null);

  return {
    status,
    watchHours,
    shortsViews90d,
    dailyViews: Math.round(dailyViews),
    rpm: rpm[1],
    monthlyRevenueLow: monthly(rpm[0]),
    monthlyRevenueHigh: monthly(rpm[2]),
  };
}
