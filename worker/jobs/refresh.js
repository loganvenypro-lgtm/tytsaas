/**
 * Fresh stats from the Data API, 50 ids per unit.
 * Videos on the schedule of worker/refreshPolicy.js (by age and by value).
 * Channels once every 20 h (subscribers, about text, topics).
 */
import { sql } from "../../lib/sql.js";
import { youtubeApi, chunk, QuotaExceededError } from "../../lib/youtube.js";
import { saveApiVideos, saveApiChannels, VIDEO_PARTS, CHANNEL_PARTS } from "../store.js";
import { refreshIntervalHours, refreshFrom } from "../refreshPolicy.js";

export async function refreshVideos({ budget }) {
  const stats = { requested: 0, refreshed: 0, hot: 0, unavailable: 0, calls: 0 };
  const maxCalls = budget.left;
  if (maxCalls <= 0) return { ...stats, skipped: "no budget" };

  // Due videos, shortest interval first (most valuable), then the most overdue.
  const videos = await sql`
    select v.youtube_video_id, v.published_at > now() - interval '48 hours' as hot
    from ${refreshFrom}
    cross join lateral (select ${refreshIntervalHours} as hours) i
    -- Terminated channels' videos would all come back missing and be deleted: the tab keeps them until the purge.
    where v.published_at <= now() and c.terminated_at is null
      and (i.hours = 0 or v.last_stats_at < now() - make_interval(hours => i.hours))
    order by i.hours, v.last_stats_at nulls first, v.published_at desc
    limit ${maxCalls * 50}`;
  stats.requested = videos.length;
  const hot = new Set(videos.filter((v) => v.hot).map((v) => v.youtube_video_id));

  for (const batch of chunk(videos.map((v) => v.youtube_video_id), 50)) {
    let data;
    try {
      data = await youtubeApi("videos", { part: VIDEO_PARTS, id: batch.join(","), maxResults: "50" }, budget);
    } catch (err) {
      if (err instanceof QuotaExceededError) return { ...stats, quotaExhausted: true };
      throw err;
    }
    stats.calls++;
    const items = data.items ?? [];
    const { saved } = await saveApiVideos(items);
    stats.refreshed += saved;
    stats.hot += items.filter((i) => hot.has(i.id)).length;

    // Private or deleted: delete everything stored about them (API data policy).
    const returned = new Set(items.map((i) => i.id));
    const missing = batch.filter((id) => !returned.has(id));
    if (missing.length) {
      await sql`delete from videos where youtube_video_id in ${sql(missing)}`;
      await sql`delete from video_stat_snapshots where youtube_video_id in ${sql(missing)}`;
      await sql`delete from video_variants where youtube_video_id in ${sql(missing)}`;
      stats.unavailable += missing.length;
    }
  }
  return stats;
}

export async function refreshChannels({ budget }) {
  const stats = { requested: 0, refreshed: 0, missing: 0, calls: 0 };
  const maxCalls = budget.left;
  if (maxCalls <= 0) return { ...stats, skipped: "no budget" };

  const channels = await sql`
    select c.youtube_channel_id
    from channels c
    left join tracked_channels tc on tc.channel_id = c.youtube_channel_id
    where c.rss_error_count < 5 and (c.last_stats_at is null or c.last_stats_at < now() - interval '20 hours')
    order by (tc.channel_id is not null) desc, c.last_stats_at nulls first
    limit ${maxCalls * 50}`;
  stats.requested = channels.length;

  for (const batch of chunk(channels.map((c) => c.youtube_channel_id), 50)) {
    let data;
    try {
      data = await youtubeApi("channels", { part: CHANNEL_PARTS, id: batch.join(","), maxResults: "50" }, budget);
    } catch (err) {
      if (err instanceof QuotaExceededError) return { ...stats, quotaExhausted: true };
      throw err;
    }
    stats.calls++;
    const items = data.items ?? [];
    stats.refreshed += await saveApiChannels(items);

    // Terminated channels: stop polling; the "terminated" job rechecks them, the purge deletes them after 30 days.
    const returned = new Set(items.map((i) => i.id));
    const missing = batch.filter((id) => !returned.has(id));
    if (missing.length) {
      await sql`
        update channels set rss_error_count = 5, terminated_at = coalesce(terminated_at, now()), terminated_checked_at = now()
        where youtube_channel_id in ${sql(missing)}`;
      stats.missing += missing.length;
    }
  }
  return stats;
}
