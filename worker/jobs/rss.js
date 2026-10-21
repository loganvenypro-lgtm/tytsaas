/**
 * New uploads and live view counts from channel RSS feeds (free).
 *   - every channel is read once per rotation (SCAN_RSS_ROTATION_HOURS)
 *   - channels with an upload < 48 h are read every SCAN_RSS_HOT_MINUTES: the
 *     feed's view counts are live, so hot videos get hourly view snapshots
 *     without spending quota (the API refresh then only needs to run for likes,
 *     comments and metadata, see worker/refreshPolicy.js)
 *   - feed titles equal the API's, so a changed title is a title variant (A/B test)
 * While YouTube throttles RSS, the job backs off (15 min, 30, 60…) and reads the
 * most important channels through playlistItems (1 unit each).
 */
import { sql } from "../../lib/sql.js";
import { fetchChannelRss, youtubeApi, mapLimit, sleep, uploadsPlaylistId, QuotaExceededError } from "../../lib/youtube.js";
import { CONFIG } from "../config.js";
import { videoRowId } from "../store.js";

export async function runRss({ budget, previous }) {
  const stats = {
    attempted: 0, hot: 0, ok: 0, notFound: 0, failed: 0, entries: 0, newVideos: 0,
    snapshots: 0, titleChanges: 0, rateLimited: false,
  };
  const channels = await pickChannels();
  stats.attempted = channels.length;
  stats.hot = channels.filter((c) => c.hot).length;

  const strikes = Number(previous?.strikes ?? 0);
  const backoffUntil = previous?.backoffUntil ? new Date(previous.backoffUntil).getTime() : 0;
  const done = new Set();

  if (backoffUntil > Date.now()) {
    Object.assign(stats, { skipped: true, strikes, backoffUntil: previous.backoffUntil });
  } else {
    const missing = [];
    await mapLimit(channels, CONFIG.rssConcurrency, async (channel) => {
      if (stats.rateLimited) return;
      await sleep(100 + Math.random() * 200);
      let feed;
      try {
        feed = await fetchWithRetry(channel.youtube_channel_id, stats);
      } catch {
        stats.failed++;
        return;
      }
      if (feed.status === 404) {
        stats.notFound++;
        missing.push(channel.id);
      } else if (feed.status === 429 || feed.status === 403) {
        stats.rateLimited = true;
        stats.throttleStatus = feed.status;
      } else if (feed.status >= 500) {
        // A stray 5xx happens; a run of them means YouTube is pushing back.
        stats.serverErrors = (stats.serverErrors ?? 0) + 1;
        if (stats.serverErrors >= 5 && stats.serverErrors > stats.ok * 0.2) {
          stats.rateLimited = true;
          stats.throttleStatus = feed.status;
        }
      } else if (feed.status !== 200) {
        stats.failed++;
      } else {
        stats.ok++;
        stats.entries += feed.entries.length;
        const saved = await saveEntries(channel, feed.channelName, feed.entries, { liveViews: true });
        stats.newVideos += saved.inserted;
        stats.snapshots += saved.snapshots;
        stats.titleChanges += saved.titleChanges;
        done.add(channel.id);
      }
    });

    // YouTube sometimes answers 404 for every feed: an outage, not deleted channels.
    if (stats.ok === 0 && missing.length >= 10) {
      stats.rateLimited = true;
      stats.outage = true;
    } else if (missing.length && !stats.rateLimited) {
      // While YouTube pushes back, a 404 proves nothing: only count it on a healthy run.
      await sql`update channels set rss_error_count = rss_error_count + 1, last_rss_at = now() where id in ${sql(missing)}`;
      for (const id of missing) done.add(id);
    }
    if (stats.rateLimited) {
      stats.strikes = strikes + 1;
      const minutes = Math.min(CONFIG.rssBackoffMaxMinutes, CONFIG.rssBackoffBaseMinutes * 2 ** strikes);
      stats.backoffUntil = new Date(Date.now() + minutes * 60_000).toISOString();
    } else {
      stats.strikes = 0;
    }
  }

  if (stats.skipped || stats.rateLimited) {
    stats.fallback = await readUploadsViaApi(channels.filter((c) => !done.has(c.id)), budget);
    stats.newVideos += stats.fallback.newVideos;
  }
  return stats;
}

/**
 * The feed endpoint answers a stray 404 or 500 for feeds that work a second
 * later (measured: ~1 in 3 at times, most fine on retry). Two more tries,
 * spaced out, before a status counts; throttling (429/403) is final at once.
 */
async function fetchWithRetry(channelId, stats) {
  let feed = await fetchChannelRss(channelId);
  for (let attempt = 1; attempt <= 2 && (feed.status === 404 || feed.status >= 500); attempt++) {
    await sleep(attempt * (600 + Math.random() * 600));
    feed = await fetchChannelRss(channelId);
    stats.retries = (stats.retries ?? 0) + 1;
  }
  return feed;
}

/**
 * Tracked channels, then hot channels due for their hourly read, then the
 * rotation (read longest ago first), deduplicated.
 */
async function pickChannels() {
  const [{ active }] = await sql`select count(*)::int as active from channels where rss_error_count < 5`;
  const ticksPerRotation = Math.max(1, (CONFIG.rssRotationHours * 60) / CONFIG.tickMinutes);
  const rotationLimit = Math.min(CONFIG.rssMaxPerTick, Math.max(CONFIG.rssMinPerTick, Math.ceil(active / ticksPerRotation)));

  const hot = await sql`
    select c.id, c.youtube_channel_id, true as hot
    from channels c
    left join tracked_channels tc on tc.channel_id = c.youtube_channel_id
    where c.rss_error_count < 5
      and (c.last_rss_at is null or c.last_rss_at < now() - make_interval(mins => ${Math.max(5, CONFIG.rssHotMinutes - 5)}))
      and exists (
        select 1 from videos v
        where v.channel_id = c.id and v.published_at > now() - interval '48 hours'
      )
    order by (tc.channel_id is not null) desc, c.last_rss_at nulls first
    limit ${CONFIG.rssHotMaxPerTick}`;
  const rotation = await sql`
    select c.id, c.youtube_channel_id, false as hot
    from channels c
    left join tracked_channels tc on tc.channel_id = c.youtube_channel_id
    where c.rss_error_count < 5
    order by (tc.channel_id is not null) desc, c.last_rss_at nulls first
    limit ${rotationLimit}`;

  const seen = new Set();
  return [...hot, ...rotation].filter((c) => !seen.has(c.id) && seen.add(c.id));
}

/**
 * Upserts a feed's videos. With live views (RSS), records a view snapshot for
 * recent videos whose count moved and a title variant when the title changed.
 */
async function saveEntries(channel, channelName, entries, { liveViews = false } = {}) {
  const result = { inserted: 0, snapshots: 0, titleChanges: 0 };
  await sql`
    update channels
    set last_rss_at = now(), rss_error_count = 0, name = coalesce(nullif(${channelName}, ''), name)
    where id = ${channel.id}`;
  if (!entries.length) return result;

  const ids = entries.map((e) => e.id);
  const existing = new Map(
    (await sql`select youtube_video_id, view_count, title from videos where youtube_video_id in ${sql(ids)}`).map((r) => [
      r.youtube_video_id,
      r,
    ]),
  );

  const now = new Date();
  const rows = entries.map((e) => ({
    id: videoRowId(e.id),
    youtube_video_id: e.id,
    channel_id: channel.id,
    title: e.title,
    description: e.description,
    thumbnail_url: e.thumbnail,
    published_at: e.publishedAt,
    view_count: e.views,
    is_short: e.isShort === true,
    // A /shorts/ link in the feed is certain: no need to probe.
    short_checked_at: e.isShort === true ? now : null,
    rss_views_at: liveViews ? now : null,
  }));
  const upserted = await sql`
    insert into videos ${sql(rows)}
    on conflict (youtube_video_id) do update set
      title = excluded.title,
      thumbnail_url = excluded.thumbnail_url,
      view_count = greatest(videos.view_count, excluded.view_count),
      rss_views_at = coalesce(excluded.rss_views_at, videos.rss_views_at),
      is_short = videos.is_short or excluded.is_short,
      short_checked_at = coalesce(videos.short_checked_at, excluded.short_checked_at),
      classifier_version = case when videos.title is distinct from excluded.title then null else videos.classifier_version end
    returning (xmax = 0) as inserted`;
  result.inserted = upserted.filter((r) => r.inserted).length;
  if (!liveViews) return result;

  const snapshotAfter = Date.now() - CONFIG.rssSnapshotMaxAgeDays * 86_400_000;
  const snapshots = entries
    .filter((e) => e.views > 0 && new Date(e.publishedAt).getTime() > snapshotAfter)
    .filter((e) => Number(existing.get(e.id)?.view_count ?? -1) !== e.views)
    .map((e) => ({ youtube_video_id: e.id, view_count: e.views }));
  if (snapshots.length) {
    await sql`insert into video_stat_snapshots ${sql(snapshots)} on conflict do nothing`;
    result.snapshots = snapshots.length;
  }

  // New videos get their first title variant; known ones only when the title moved
  // (with the previous title too, in case only RSS had seen it).
  const changed = entries.filter((e) => e.title && existing.get(e.id)?.title !== e.title);
  const previous = changed
    .filter((e) => existing.get(e.id)?.title)
    .map((e) => ({ youtube_video_id: e.id, kind: "title", value: existing.get(e.id).title }));
  if (previous.length) await sql`insert into video_variants ${sql(previous)} on conflict do nothing`;
  if (changed.length) {
    const current = changed.map((e) => ({ youtube_video_id: e.id, kind: "title", value: e.title }));
    await sql`
      insert into video_variants ${sql(current)}
      on conflict (youtube_video_id, kind, value) do update set last_seen_at = now()`;
    result.titleChanges = previous.length;
  }
  return result;
}

async function readUploadsViaApi(channels, budget) {
  const queue = channels
    .filter((c) => uploadsPlaylistId(c.youtube_channel_id))
    // Keep at least half of the tick's budget for stats.
    .slice(0, Math.max(0, Math.min(CONFIG.rssFallbackMaxCalls, Math.floor(budget.left / 2))));
  const stats = { attempted: queue.length, ok: 0, failed: 0, newVideos: 0 };

  await mapLimit(queue, 4, async (channel) => {
    let data;
    try {
      data = await youtubeApi(
        "playlistItems",
        { part: "snippet", playlistId: uploadsPlaylistId(channel.youtube_channel_id), maxResults: "15" },
        budget,
      );
    } catch (err) {
      if (err instanceof QuotaExceededError) stats.quotaExhausted = true;
      stats.failed++;
      return;
    }
    const items = data.items ?? [];
    const entries = items
      .map((item) => item.snippet)
      .filter((s) => s?.resourceId?.videoId && s.title && s.publishedAt)
      .map((s) => ({
        id: s.resourceId.videoId,
        title: s.title,
        description: s.description ?? "",
        publishedAt: s.publishedAt,
        thumbnail: s.thumbnails?.high?.url ?? `https://i.ytimg.com/vi/${s.resourceId.videoId}/hqdefault.jpg`,
        views: 0,
        isShort: null,
      }));
    stats.ok++;
    stats.newVideos += (await saveEntries(channel, items[0]?.snippet?.channelTitle ?? "", entries)).inserted;
  });
  return stats;
}
