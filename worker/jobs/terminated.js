/**
 * Terminated channels (banned, deleted or hidden), for the "Terminated" tab.
 * A failing RSS feed only makes a channel a suspect (the feed endpoint answers
 * stray 404s); channels.list confirms it: a channel YouTube no longer returns
 * is marked terminated_at. 50 ids per unit, so a few units a day at most.
 *   - suspects: RSS errors, or no feed read for days, checked once per cooldown
 *   - terminated channels are checked again every few days: one that answers
 *     loses the status and goes back to the RSS rotation
 */
import { sql } from "../../lib/sql.js";
import { youtubeApi, chunk, QuotaExceededError } from "../../lib/youtube.js";
import { saveApiChannels, CHANNEL_PARTS } from "../store.js";
import { CONFIG } from "../config.js";

export async function runTerminated({ budget }) {
  const stats = { suspects: 0, rechecked: 0, calls: 0, terminated: 0, revived: 0, alive: 0 };
  if (budget.left <= 0) return { ...stats, skipped: "no budget" };

  const channels = await sql`
    select youtube_channel_id, terminated_at is not null as terminated
    from channels
    where youtube_channel_id like 'UC%'
      and (
        (terminated_at is null
          and (rss_error_count >= ${CONFIG.terminatedMinRssErrors}
            or last_rss_at < now() - make_interval(hours => ${CONFIG.terminatedStaleRssHours}))
          and (terminated_checked_at is null
            or terminated_checked_at < now() - make_interval(hours => ${CONFIG.terminatedSuspectCooldownHours})))
        or (terminated_at is not null
          and (terminated_checked_at is null
            or terminated_checked_at < now() - make_interval(hours => ${CONFIG.terminatedRecheckHours})))
      )
    order by terminated_checked_at nulls first, rss_error_count desc
    limit ${Math.min(budget.left, CONFIG.terminatedMaxCalls) * 50}`;
  stats.suspects = channels.filter((c) => !c.terminated).length;
  stats.rechecked = channels.length - stats.suspects;
  const wasTerminated = new Set(channels.filter((c) => c.terminated).map((c) => c.youtube_channel_id));

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
    // The call fetched fresh stats anyway: keep them.
    await saveApiChannels(items);

    const returned = new Set(items.map((i) => i.id));
    const alive = batch.filter((id) => returned.has(id));
    const missing = batch.filter((id) => !returned.has(id));
    if (alive.length) {
      // Back in the RSS rotation; a feed that keeps failing makes it a suspect again after the cooldown.
      await sql`
        update channels set terminated_at = null, terminated_checked_at = now(), rss_error_count = 0
        where youtube_channel_id in ${sql(alive)}`;
      stats.revived += alive.filter((id) => wasTerminated.has(id)).length;
      stats.alive += alive.filter((id) => !wasTerminated.has(id)).length;
    }
    if (missing.length) {
      await sql`
        update channels
        set terminated_at = coalesce(terminated_at, now()), terminated_checked_at = now(),
          rss_error_count = greatest(rss_error_count, 5)
        where youtube_channel_id in ${sql(missing)}`;
      stats.terminated += missing.filter((id) => !wasTerminated.has(id)).length;
    }
  }
  return stats;
}
