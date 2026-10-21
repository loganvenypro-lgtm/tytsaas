/**
 * Writes Data API results to PostgreSQL, in batches. Shared by every job that
 * calls videos.list / channels.list so a video looks the same whichever job saw it.
 */
import { sql } from "../lib/sql.js";
import { parseIsoDuration, SHORT_MAX_SECONDS, chunk } from "../lib/youtube.js";
import { topicSlugs, normalizeLanguage } from "../lib/classifier.js";

export const channelRowId = (youtubeChannelId) => `ch-${youtubeChannelId}`;
export const videoRowId = (youtubeVideoId) => `vid-${youtubeVideoId}`;

// videos.list parts: the call costs 1 unit whatever the parts, so take everything useful.
export const VIDEO_PARTS = "snippet,statistics,contentDetails,topicDetails,status,liveStreamingDetails";
export const CHANNEL_PARTS = "snippet,statistics,brandingSettings,topicDetails";

const int = (value) => (value != null && value !== "" ? Number(value) : null);

/** A videos.list item -> row of the videos table. */
export function videoRowFromApi(item) {
  const snippet = item.snippet ?? {};
  const stats = item.statistics ?? {};
  const duration = parseIsoDuration(item.contentDetails?.duration);
  const live = item.liveStreamingDetails;
  // Premieres also carry liveStreamingDetails; a real stream VOD is long or still live.
  const isLivestream = Boolean(live) && (duration.seconds >= 1800 || snippet.liveBroadcastContent === "live");
  return {
    id: videoRowId(item.id),
    youtube_video_id: item.id,
    channel_id: channelRowId(snippet.channelId),
    title: snippet.title ?? "",
    description: snippet.description ?? "",
    thumbnail_url: snippet.thumbnails?.high?.url ?? `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`,
    published_at: snippet.publishedAt,
    view_count: int(stats.viewCount) ?? 0,
    like_count: int(stats.likeCount),
    comment_count: int(stats.commentCount),
    duration_seconds: duration.seconds,
    duration_formatted: duration.formatted,
    // Provisional for <= 3 min: the Shorts probe settles it (short_checked_at).
    is_short: duration.seconds > 0 && duration.seconds <= 60,
    category_id: int(snippet.categoryId),
    tags: snippet.tags ?? null,
    language: snippet.defaultAudioLanguage ?? snippet.defaultLanguage ?? null,
    topic_categories: topicSlugs(item.topicDetails?.topicCategories),
    is_livestream: isLivestream,
    made_for_kids: item.status?.madeForKids ?? null,
    last_stats_at: new Date(),
    analyzed_at: new Date(),
  };
}

/**
 * Upsert videos.list items whose channel is in the database. Returns
 * { saved, inserted } and writes view snapshots and title variants.
 */
export async function saveApiVideos(items) {
  const usable = items.filter((i) => i.snippet?.publishedAt && i.snippet?.channelId);
  if (!usable.length) return { saved: 0, inserted: 0 };

  const channelIds = [...new Set(usable.map((i) => channelRowId(i.snippet.channelId)))];
  const known = new Set((await sql`select id from channels where id in ${sql(channelIds)}`).map((r) => r.id));
  const rows = usable.map(videoRowFromApi).filter((r) => known.has(r.channel_id));
  if (!rows.length) return { saved: 0, inserted: 0 };

  let inserted = 0;
  for (const batch of chunk(rows, 500)) {
    const result = await sql`
      insert into videos ${sql(batch)}
      on conflict (youtube_video_id) do update set
        title = excluded.title,
        description = excluded.description,
        thumbnail_url = excluded.thumbnail_url,
        view_count = excluded.view_count,
        like_count = excluded.like_count,
        comment_count = excluded.comment_count,
        duration_seconds = excluded.duration_seconds,
        duration_formatted = excluded.duration_formatted,
        is_short = case
          when excluded.duration_seconds > ${SHORT_MAX_SECONDS} then false
          when videos.short_checked_at is not null then videos.is_short
          else videos.is_short or excluded.is_short
        end,
        category_id = excluded.category_id,
        tags = excluded.tags,
        language = excluded.language,
        topic_categories = excluded.topic_categories,
        is_livestream = excluded.is_livestream,
        made_for_kids = excluded.made_for_kids,
        last_stats_at = excluded.last_stats_at,
        analyzed_at = excluded.analyzed_at,
        -- Title or tags changed: classify again.
        classifier_version = case
          when videos.title is distinct from excluded.title or videos.tags is distinct from excluded.tags then null
          else videos.classifier_version
        end
      returning (xmax = 0) as inserted`;
    inserted += result.filter((r) => r.inserted).length;
  }

  const snapshots = rows.map((r) => ({
    youtube_video_id: r.youtube_video_id,
    view_count: r.view_count,
    like_count: r.like_count,
    comment_count: r.comment_count,
  }));
  const titles = rows
    .filter((r) => r.title)
    .map((r) => ({ youtube_video_id: r.youtube_video_id, kind: "title", value: r.title }));
  for (const batch of chunk(snapshots, 1000)) {
    await sql`insert into video_stat_snapshots ${sql(batch)} on conflict do nothing`;
  }
  for (const batch of chunk(titles, 1000)) {
    await sql`
      insert into video_variants ${sql(batch)}
      on conflict (youtube_video_id, kind, value) do update set last_seen_at = now()`;
  }
  return { saved: rows.length, inserted };
}

/** A channels.list item -> row of the channels table (stats + metadata). */
export function channelRowFromApi(item, extra = {}) {
  const snippet = item.snippet ?? {};
  const stats = item.statistics ?? {};
  return {
    id: channelRowId(item.id),
    youtube_channel_id: item.id,
    name: (snippet.title ?? item.id).slice(0, 255),
    handle: snippet.customUrl ?? null,
    thumbnail_url: snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? null,
    description: snippet.description ?? null,
    keywords: item.brandingSettings?.channel?.keywords ?? null,
    topic_categories: topicSlugs(item.topicDetails?.topicCategories),
    country: snippet.country ?? null,
    channel_created_at: snippet.publishedAt ?? null,
    subscriber_count: stats.hiddenSubscriberCount ? null : int(stats.subscriberCount) ?? 0,
    total_views: int(stats.viewCount) ?? 0,
    video_count: int(stats.videoCount) ?? 0,
    last_stats_at: new Date(),
    updated_at: new Date(),
    ...extra,
  };
}

/** Upsert channels.list items and record their daily snapshot. */
export async function saveApiChannels(items, extra = {}) {
  if (!items.length) return 0;
  const rows = items.map((item) => channelRowFromApi(item, extra));
  for (const batch of chunk(rows, 200)) {
    await sql`
      insert into channels ${sql(batch)}
      on conflict (youtube_channel_id) do update set
        name = excluded.name,
        handle = coalesce(excluded.handle, channels.handle),
        thumbnail_url = coalesce(excluded.thumbnail_url, channels.thumbnail_url),
        description = excluded.description,
        keywords = excluded.keywords,
        topic_categories = excluded.topic_categories,
        country = coalesce(excluded.country, channels.country),
        channel_created_at = coalesce(excluded.channel_created_at, channels.channel_created_at),
        subscriber_count = excluded.subscriber_count,
        total_views = excluded.total_views,
        video_count = excluded.video_count,
        last_stats_at = excluded.last_stats_at,
        updated_at = excluded.updated_at`;
  }
  const snapshots = rows.map((r) => ({
    youtube_channel_id: r.youtube_channel_id,
    subscriber_count: r.subscriber_count,
    total_views: r.total_views,
    video_count: r.video_count,
  }));
  await sql`insert into channel_stat_snapshots ${sql(snapshots)} on conflict do nothing`;
  return rows.length;
}

