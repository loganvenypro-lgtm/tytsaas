/**
 * Monetization tracker (local, no quota): estimated Partner Program status and
 * ad revenue for every active channel, from the stats already in the database.
 * Outlr read the yt_ad flag of watch pages; that scraping was dropped for the
 * API compliance audit, so this tracks eligibility instead and records every
 * status change in channel_monetization_events ("just became eligible").
 */
import { sql } from "../../lib/sql.js";
import { estimateMonetization } from "../../lib/monetization.js";
import { chunk } from "../../lib/youtube.js";

export async function runMonetization() {
  const stats = { channels: 0, eligible: 0, early: 0, notEligible: 0, unknown: 0, changes: 0 };

  const channels = await sql`
    select c.id, c.subscriber_count, c.niche, c.lang, c.ypp_status, d.daily_views,
      -- Every upload of the last 12 months is in the database: all of its uploads, or a
      -- backfill (last 50 uploads) that reaches back more than a year.
      (h.stored >= c.video_count or (c.backfilled_at is not null and h.last_year < 50)) as history_complete
    from channels c
    left join lateral (
      select count(*) as stored, count(*) filter (where published_at > now() - interval '365 days') as last_year
      from videos v where v.channel_id = c.id
    ) h on true
    left join lateral (
      -- Whole-channel views per day over the last week of snapshots (>= 20 h apart).
      select (max(s.total_views) - min(s.total_views))::float8
               / (extract(epoch from max(s.captured_at) - min(s.captured_at)) / 86400) as daily_views
      from channel_stat_snapshots s
      where s.youtube_channel_id = c.youtube_channel_id and s.captured_at > now() - interval '8 days'
      having max(s.captured_at) - min(s.captured_at) >= interval '20 hours'
    ) d on true
    where c.rss_error_count < 5`;

  const videos = await sql`
    select channel_id, view_count, duration_seconds, is_short, is_livestream, published_at
    from videos`;
  const byChannel = new Map();
  for (const v of videos) {
    let list = byChannel.get(v.channel_id);
    if (!list) byChannel.set(v.channel_id, (list = []));
    list.push({
      views: Number(v.view_count),
      durationSeconds: v.duration_seconds,
      isShort: v.is_short,
      isLivestream: v.is_livestream,
      publishedAt: v.published_at,
    });
  }

  const rows = [];
  const events = [];
  for (const c of channels) {
    const estimate = estimateMonetization(
      {
        subscribers: c.subscriber_count,
        niche: c.niche,
        lang: c.lang,
        dailyViews: c.daily_views != null ? Number(c.daily_views) : null,
        historyComplete: Boolean(c.history_complete),
      },
      byChannel.get(c.id) ?? [],
    );
    rows.push({ id: c.id, ...estimate });
    const key = { eligible: "eligible", early: "early", not_eligible: "notEligible" }[estimate.status] ?? "unknown";
    stats[key]++;
    // The first estimate is a baseline, not a change.
    if (c.ypp_status && estimate.status && estimate.status !== c.ypp_status) {
      events.push({
        channel_id: c.id,
        status: estimate.status,
        previous_status: c.ypp_status,
        subscriber_count: c.subscriber_count,
        watch_hours: estimate.watchHours,
        shorts_views: estimate.shortsViews90d,
      });
    }
  }

  for (const batch of chunk(rows, 1000)) {
    await sql`
      update channels c set
        ypp_changed_at = case when c.ypp_status is distinct from r.status and c.ypp_status is not null
          then now() else c.ypp_changed_at end,
        ypp_status = r.status,
        ypp_watch_hours = r.watch_hours,
        ypp_shorts_views = r.shorts_views,
        ypp_checked_at = now(),
        est_daily_views = r.daily_views,
        est_rpm = r.rpm,
        est_monthly_revenue_low = r.low,
        est_monthly_revenue_high = r.high
      from unnest(
        ${batch.map((r) => r.id)}::text[],
        ${batch.map((r) => r.status)}::text[],
        ${batch.map((r) => r.watchHours)}::real[],
        ${batch.map((r) => r.shortsViews90d)}::bigint[],
        ${batch.map((r) => r.dailyViews)}::real[],
        ${batch.map((r) => r.rpm)}::real[],
        ${batch.map((r) => r.monthlyRevenueLow)}::real[],
        ${batch.map((r) => r.monthlyRevenueHigh)}::real[]
      ) as r(id, status, watch_hours, shorts_views, daily_views, rpm, low, high)
      where c.id = r.id`;
  }
  if (events.length) await sql`insert into channel_monetization_events ${sql(events)}`;
  stats.channels = rows.length;
  stats.changes = events.length;
  return stats;
}
