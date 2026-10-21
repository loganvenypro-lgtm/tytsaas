/**
 * YouTube API Services policy: API data is refreshed or deleted within 30 days.
 * Anything not refreshed for 30 days (quota shortfall, deleted channel…) goes.
 */
import { sql } from "../../lib/sql.js";

export async function runPurge() {
  const deleted = {};
  deleted.videoSnapshots = (await sql`delete from video_stat_snapshots where captured_at < now() - interval '30 days'`).count;
  deleted.channelSnapshots = (await sql`delete from channel_stat_snapshots where captured_at < now() - interval '30 days'`).count;
  deleted.variants = (await sql`delete from video_variants where last_seen_at < now() - interval '30 days'`).count;
  // Deleting a channel cascades to its videos.
  deleted.channels = (await sql`delete from channels where coalesce(last_stats_at, created_at) < now() - interval '30 days'`).count;
  deleted.videos = (await sql`delete from videos where coalesce(last_stats_at, created_at) < now() - interval '30 days'`).count;
  deleted.trendingEntries = (await sql`delete from trending_entries where day < current_date - 30`).count;
  await sql`delete from discovery_rejected where rejected_at < now() - interval '90 days'`;
  await sql`delete from discovery_spend where day < current_date - 90`;
  await sql`delete from discord_reports where sent_at < now() - interval '90 days'`;
  await sql`delete from scan_runs where started_at < now() - interval '60 days'`;
  return deleted;
}
