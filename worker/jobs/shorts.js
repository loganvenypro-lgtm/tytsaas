/**
 * Exact Short / long-form status for videos of 3 minutes or less (free).
 * Duration alone can't tell since Shorts go up to 3 minutes, and the RSS feed
 * only flags some of them. Recent videos first: they drive the outlier lists.
 */
import { sql } from "../../lib/sql.js";
import { probeIsShort, mapLimit, sleep, SHORT_MAX_SECONDS } from "../../lib/youtube.js";
import { CONFIG } from "../config.js";

export async function runShortsProbe() {
  const stats = { checked: 0, shorts: 0, long: 0, changed: 0, unknown: 0, throttled: false };
  const videos = await sql`
    select youtube_video_id, is_short
    from videos
    where short_checked_at is null and duration_seconds between 1 and ${SHORT_MAX_SECONDS}
    order by published_at desc
    limit ${CONFIG.shortsMaxPerTick}`;

  const results = [];
  await mapLimit(videos, 8, async (video) => {
    if (stats.throttled) return;
    await sleep(50 + Math.random() * 100);
    try {
      const isShort = await probeIsShort(video.youtube_video_id);
      if (isShort === null) {
        stats.unknown++;
        return;
      }
      stats.checked++;
      if (isShort) stats.shorts++;
      else stats.long++;
      if (isShort !== video.is_short) stats.changed++;
      results.push({ id: video.youtube_video_id, isShort });
    } catch (err) {
      if (err.throttled) stats.throttled = true;
      else stats.unknown++;
    }
  });

  if (results.length) {
    await sql`
      update videos v set
        is_short = r.is_short,
        short_checked_at = now(),
        -- Format and baseline depend on it.
        classifier_version = case when v.is_short is distinct from r.is_short then null else v.classifier_version end
      from unnest(${results.map((r) => r.id)}::text[], ${results.map((r) => String(r.isShort))}::text[]::bool[])
        as r(youtube_video_id, is_short)
      where v.youtube_video_id = r.youtube_video_id`;
  }
  return stats;
}
