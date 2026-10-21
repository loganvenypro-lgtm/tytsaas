import { sql } from "./sql.js";

const num = (value) => (value != null ? Number(value) : null);

/** Columns read by toVideoJson, for a query on `videos v JOIN channels c ON c.id = v.channel_id`. */
export const VIDEO_COLUMNS = sql`
  v.youtube_video_id, v.title, v.thumbnail_url, v.published_at, v.view_count, v.like_count, v.comment_count,
  v.duration_formatted, v.duration_seconds, v.is_short, v.is_livestream, v.outlier_multiplier, v.baseline_views,
  v.views_per_hour, v.engagement_rate, v.relevance_score, v.category_id, v.language, v.lang, v.niche, v.sub_niche,
  v.format, v.title_hooks, v.thumbnail_variants, v.title_variants,
  c.youtube_channel_id, c.name AS channel_name, c.handle, c.thumbnail_url AS channel_avatar,
  c.subscriber_count, c.country
`;

/** A video as the frontend's OutlierCard reads it. */
export function toVideoJson(r) {
  const views = Number(r.view_count ?? 0);
  const multiplier = num(r.outlier_multiplier);
  return {
    id: r.youtube_video_id,
    title: r.title,
    thumbnail: r.thumbnail_url || `https://i.ytimg.com/vi/${r.youtube_video_id}/hqdefault.jpg`,
    publishedAt: new Date(r.published_at).toISOString(),
    views,
    likes: num(r.like_count),
    comments: num(r.comment_count),
    duration: r.duration_formatted ?? null,
    durationSeconds: num(r.duration_seconds),
    isShort: Boolean(r.is_short),
    isLivestream: Boolean(r.is_livestream),
    multiplier,
    // The channel's real baseline when the worker computed one.
    usualViews: num(r.baseline_views) ?? (multiplier && multiplier > 0 ? Math.round(views / multiplier) : null),
    viewsPerHour: r.views_per_hour != null ? Math.round(Number(r.views_per_hour)) : null,
    engagementRate: num(r.engagement_rate),
    score: num(r.relevance_score),
    categoryId: num(r.category_id),
    // Detected language (API language, else from the title), falls back to the raw API value.
    language: r.lang ?? r.language ?? null,
    niche: r.niche ?? null,
    subNiche: r.sub_niche ?? null,
    style: r.format ?? null,
    hooks: r.title_hooks ?? [],
    abTest: { thumbnails: num(r.thumbnail_variants) ?? 1, titles: num(r.title_variants) ?? 1 },
    channel: {
      id: r.youtube_channel_id,
      name: r.channel_name,
      handle: r.handle ?? null,
      avatar: r.channel_avatar ?? null,
      subscribers: num(r.subscriber_count),
      country: r.country ?? null,
    },
  };
}
