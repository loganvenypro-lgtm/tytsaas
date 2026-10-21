/**
 * Upload history for channels that have none yet: the last 50 uploads
 * (playlistItems, 1 unit) and their stats (videos.list, 1 unit). Without it a
 * new channel needs weeks of RSS before its outlier baseline means anything.
 * Newly discovered and tracked channels first, then channels with no baseline.
 */
import { sql } from "../../lib/sql.js";
import { youtubeApi, uploadsPlaylistId, QuotaExceededError } from "../../lib/youtube.js";
import { saveApiVideos, VIDEO_PARTS } from "../store.js";
import { CONFIG } from "../config.js";

export async function runBackfill({ budget }) {
  const stats = { channels: 0, videos: 0, inserted: 0, failed: 0 };
  const maxChannels = Math.min(CONFIG.backfillMaxPerTick, Math.floor(budget.left / 2));
  if (maxChannels <= 0) return { ...stats, skipped: "no budget" };

  const channels = await sql`
    select c.id, c.youtube_channel_id
    from channels c
    left join tracked_channels tc on tc.channel_id = c.youtube_channel_id
    where c.backfilled_at is null and c.rss_error_count < 5 and c.youtube_channel_id like 'UC%'
      and coalesce(c.subscriber_count, 0) >= ${CONFIG.minSubscribers}
    order by
      (tc.channel_id is not null) desc,
      (c.discovered_at > now() - interval '7 days') desc nulls last,
      (coalesce(c.median_views, 0) = 0) desc,
      c.subscriber_count desc nulls last
    limit ${maxChannels}`;

  for (const channel of channels) {
    try {
      const playlist = await youtubeApi(
        "playlistItems",
        { part: "contentDetails", playlistId: uploadsPlaylistId(channel.youtube_channel_id), maxResults: "50" },
        budget,
      );
      const ids = (playlist.items ?? []).map((i) => i.contentDetails?.videoId).filter(Boolean);
      if (ids.length) {
        const data = await youtubeApi("videos", { part: VIDEO_PARTS, id: ids.join(","), maxResults: "50" }, budget);
        const { saved, inserted } = await saveApiVideos(data.items ?? []);
        stats.videos += saved;
        stats.inserted += inserted;
      }
      await sql`update channels set backfilled_at = now() where id = ${channel.id}`;
      stats.channels++;
    } catch (err) {
      if (err instanceof QuotaExceededError) return { ...stats, quotaExhausted: true };
      // playlistNotFound: channel without public uploads; don't retry it every tick.
      if (err.reason === "playlistNotFound") await sql`update channels set backfilled_at = now() where id = ${channel.id}`;
      stats.failed++;
    }
  }
  return stats;
}
