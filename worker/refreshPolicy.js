/**
 * How often each video's stats are refreshed, by age and by value, and what
 * that costs per day. The same SQL decides what the refresh job reads and what
 * the quota pilot projects, so the projection is exactly what will be spent.
 *
 *                   views live from RSS   otherwise
 *   < 48 h  outlier       4 h                   1 h   may be an outlier (>= 1.5x normal, relevant) or tracked
 *           normal        8 h                   3 h   channel above the relevance floor, not clearly underperforming
 *           low          12 h                   8 h   small channel, or well below its normal
 *   < 7 d   outlier      12 h                   6 h   >= 2x normal or tracked
 *           other        48 h                  24 h
 *   < 30 d                2 d if >= 3x normal, else 5 d
 *   older                25 d (API data policy: refreshed or deleted within 30 days)
 *
 * "Live from RSS": the channel feed gave the video's views recently (hot channels
 * are read hourly). Views, multiplier and velocity then stay current for free; the
 * API call only brings likes, comments and metadata, so it can wait longer.
 */
import { sql } from "../lib/sql.js";
import { CONFIG } from "./config.js";

const BATCH = 50; // ids per videos.list / channels.list call (1 unit)
const CHANNEL_REFRESH_HOURS = 20;

/** Refresh interval in hours for `videos v` joined to `channels c` and `tracked_channels tc` (0 = never refreshed). */
export const refreshIntervalHours = sql`
  case
    when v.last_stats_at is null then 0
    when v.published_at > now() - interval '48 hours' then
      case
        when tc.channel_id is not null or v.relevance_score is not null or v.outlier_multiplier >= 1.5 then
          case when v.rss_views_at > now() - interval '90 minutes' then 4 else 1 end
        when coalesce(c.subscriber_count, 0) >= ${CONFIG.minSubscribers}
          and (v.outlier_multiplier is null or v.outlier_multiplier >= 0.7) then
          case when v.rss_views_at > now() - interval '90 minutes' then 8 else 3 end
        else case when v.rss_views_at > now() - interval '90 minutes' then 12 else 8 end
      end
    when v.published_at > now() - interval '7 days' then
      case
        when tc.channel_id is not null or v.outlier_multiplier >= 2 then
          case when v.rss_views_at > now() - interval '6 hours' then 12 else 6 end
        else case when v.rss_views_at > now() - interval '6 hours' then 48 else 24 end
      end
    when v.published_at > now() - interval '30 days' then
      case when v.outlier_multiplier >= 3 then 48 else 120 end
    else 600
  end`;

export const refreshFrom = sql`
  videos v
  join channels c on c.id = v.channel_id
  left join tracked_channels tc on tc.channel_id = c.youtube_channel_id`;

/**
 * Quota the current database needs per day to keep every refresh on schedule,
 * and what one more channel adds to it (measured on the existing channels).
 */
export async function projectDailyDemand() {
  const [row] = await sql`
    select
      coalesce(sum(24.0 / nullif(i.hours, 0)), 0)::float8 as video_refreshes,
      count(*) filter (where i.hours = 0)::int as never_refreshed
    from ${refreshFrom}
    cross join lateral (select ${refreshIntervalHours} as hours) i
    where v.published_at <= now()`;
  const [channels] = await sql`select count(*)::int as active from channels where rss_error_count < 5`;

  const videoUnits = row.video_refreshes / BATCH;
  const channelUnits = (channels.active / BATCH) * (24 / CHANNEL_REFRESH_HOURS);
  return {
    videoUnits: Math.round(videoUnits),
    channelUnits: Math.round(channelUnits),
    total: Math.round(videoUnits + channelUnits),
    activeChannels: channels.active,
    neverRefreshed: row.never_refreshed,
    // Ongoing cost of one more channel (its share of video + channel refreshes).
    unitsPerChannel: channels.active ? (videoUnits + channelUnits) / channels.active : 1,
  };
}
