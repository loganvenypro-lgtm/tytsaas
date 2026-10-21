import { sql } from "../lib/sql.js";
import { classifyChannel, titleMatchesNiche } from "../lib/nicheClassifier.js";
import { toNumber } from "./videos.js";

const PAGE_SIZE = 18;

const num = (value) => (value != null ? Number(value) : null);

/**
 * Breakout Creators: channels ranked by momentum, read from PostgreSQL only.
 * +views/+subs over 24 h come from daily channel snapshots (scanner);
 * until a channel has a day of history, momentum falls back to its last 7 days of uploads.
 */
export async function breakout(req, res) {
  const params = req.query;
  const query = String(params.q ?? "").trim() || null;
  const format = params.format ?? "all";
  const category = toNumber(params.category);
  const language = String(params.language ?? "").trim().toLowerCase() || null;
  const minSubs = toNumber(params.minSubs);
  const maxSubs = toNumber(params.maxSubs);
  const withOutliers = params.withOutliers === "true";
  const maxAgeDays = toNumber(params.maxAgeDays);
  const minOutlierRate = toNumber(params.minOutlierRate);
  const sort = params.sort ?? "trend";
  const page = Math.max(0, Math.floor(toNumber(params.page) ?? 0));

  const where = sql`
    c.rss_error_count < 5
    ${format === "short" ? sql`AND r.short_share >= 0.5` : format === "long" ? sql`AND r.short_share < 0.5` : sql``}
    ${category !== null ? sql`AND r.category_id = ${category}` : sql``}
    ${language ? sql`AND r.language = ${language}` : sql``}
    ${minSubs !== null ? sql`AND c.subscriber_count >= ${minSubs}` : sql``}
    ${maxSubs !== null ? sql`AND c.subscriber_count <= ${maxSubs}` : sql``}
    ${withOutliers ? sql`AND r.outliers_30d > 0` : sql``}
    ${maxAgeDays !== null ? sql`AND c.channel_created_at > now() - make_interval(days => ${maxAgeDays})` : sql``}
    ${minOutlierRate !== null ? sql`AND c.outlier_rate >= ${minOutlierRate}` : sql``}
    ${query ? sql`AND (c.name ILIKE ${"%" + query + "%"} OR c.handle ILIKE ${"%" + query + "%"})` : sql``}
  `;

  const subsPerDay = sql`c.subscriber_count::float8 / GREATEST(EXTRACT(EPOCH FROM now() - c.channel_created_at) / 86400, 1)`;
  const orderBy =
    sort === "opportunity"
      ? sql`c.opportunity_score DESC NULLS LAST`
      : sort === "subsPerDay"
        ? sql`${subsPerDay} DESC NULLS LAST`
        : sort === "outlierRate"
          ? sql`c.outlier_rate DESC NULLS LAST, c.opportunity_score DESC NULLS LAST`
          : sort === "newest"
            ? sql`c.channel_created_at DESC NULLS LAST`
            : sort === "trend"
              ? sql`c.trend_score DESC NULLS LAST, r.views_7d DESC NULLS LAST`
              : sort === "views7d"
                ? sql`r.views_7d DESC NULLS LAST`
                : sort === "outliers"
                  ? sql`r.outliers_30d DESC, r.best_multiplier DESC NULLS LAST`
                  : sort === "subs24h"
                    ? sql`subs_24h DESC NULLS LAST, r.views_7d DESC NULLS LAST`
                    : sort === "subscribers"
                      ? sql`c.subscriber_count DESC NULLS LAST`
                      : sort === "multiplier"
                        ? sql`r.best_multiplier DESC NULLS LAST`
                        : sql`views_24h DESC NULLS LAST, r.views_7d DESC NULLS LAST`;

  // Shared FROM clause: per-channel aggregates over the last 30 days + snapshot deltas.
  const from = sql`
    channels c
    JOIN (
      SELECT
        channel_id,
        COALESCE(sum(view_count) FILTER (WHERE published_at > now() - interval '7 days'), 0)::float8 AS views_7d,
        count(*) FILTER (WHERE published_at > now() - interval '7 days')::int AS uploads_7d,
        count(*) FILTER (WHERE relevance_score IS NOT NULL AND outlier_multiplier >= 3)::int AS outliers_30d,
        max(outlier_multiplier) FILTER (WHERE relevance_score IS NOT NULL) AS best_multiplier,
        avg(is_short::int)::float8 AS short_share,
        mode() WITHIN GROUP (ORDER BY category_id) AS category_id,
        mode() WITHIN GROUP (ORDER BY split_part(lower(language), '-', 1)) AS language
      FROM videos
      WHERE published_at > now() - interval '30 days'
      GROUP BY channel_id
    ) r ON r.channel_id = c.id
    LEFT JOIN LATERAL (
      SELECT
        (array_agg(total_views ORDER BY captured_at DESC))[1]
          - (array_agg(total_views ORDER BY captured_at DESC) FILTER (WHERE captured_at <= now() - interval '20 hours'))[1] AS views_24h,
        (array_agg(total_views ORDER BY captured_at DESC) FILTER (WHERE captured_at <= now() - interval '20 hours'))[1]
          - (array_agg(total_views ORDER BY captured_at DESC) FILTER (WHERE captured_at <= now() - interval '44 hours'))[1] AS views_prev_24h,
        (array_agg(subscriber_count ORDER BY captured_at DESC))[1]
          - (array_agg(subscriber_count ORDER BY captured_at DESC) FILTER (WHERE captured_at <= now() - interval '20 hours'))[1] AS subs_24h
      FROM channel_stat_snapshots s
      WHERE s.youtube_channel_id = c.youtube_channel_id AND s.captured_at > now() - interval '4 days'
    ) snap ON true
  `;

  const [rows, [{ total }], languages, [lastScan]] = await Promise.all([
    sql`
      SELECT
        c.id, c.youtube_channel_id, c.name, c.handle, c.thumbnail_url, c.subscriber_count, c.country,
        c.trend_score, c.recent_ratio, c.channel_created_at, c.discovered_at, c.outlier_rate, c.opportunity_score,
        r.views_7d, r.uploads_7d, r.outliers_30d, r.best_multiplier, r.short_share, r.category_id, r.language,
        snap.views_24h, snap.views_prev_24h, snap.subs_24h
      FROM ${from}
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT ${PAGE_SIZE} OFFSET ${page * PAGE_SIZE}`,
    sql`SELECT count(*)::int AS total FROM ${from} WHERE ${where}`,
    sql`
      SELECT split_part(lower(language), '-', 1) AS code, count(DISTINCT channel_id)::int AS count
      FROM videos
      WHERE language IS NOT NULL AND published_at > now() - interval '30 days'
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 12`,
    sql`SELECT max(finished_at) AS at FROM scan_runs WHERE status = 'ok'`,
  ]);

  // Best recent videos for the channels on this page (3 each).
  const channelIds = rows.map((r) => r.id);
  const videos = channelIds.length
    ? await sql`
        SELECT * FROM (
          SELECT
            v.channel_id, v.youtube_video_id, v.title, v.thumbnail_url, v.view_count, v.outlier_multiplier,
            v.published_at, v.is_short,
            row_number() OVER (
              PARTITION BY v.channel_id
              ORDER BY (v.relevance_score IS NOT NULL) DESC, v.outlier_multiplier DESC NULLS LAST, v.published_at DESC
            ) AS rank
          FROM videos v
          WHERE v.channel_id IN ${sql(channelIds)} AND v.published_at > now() - interval '30 days'
        ) ranked
        WHERE rank <= 3`
    : [];

  const videosByChannel = new Map();
  for (const v of videos) {
    const list = videosByChannel.get(v.channel_id) ?? [];
    list.push(v);
    videosByChannel.set(v.channel_id, list);
  }

  const items = rows.map((r) => ({
    id: r.youtube_channel_id,
    name: r.name,
    handle: r.handle ?? null,
    avatar: r.thumbnail_url ?? null,
    subscribers: num(r.subscriber_count),
    country: r.country ?? null,
    categoryId: num(r.category_id),
    language: r.language ?? null,
    isShortsChannel: Number(r.short_share) >= 0.5,
    trendScore: num(r.trend_score),
    recentRatio: num(r.recent_ratio),
    createdAt: r.channel_created_at ? new Date(r.channel_created_at).toISOString() : null,
    discoveredAt: r.discovered_at ? new Date(r.discovered_at).toISOString() : null,
    outlierRate: num(r.outlier_rate),
    opportunityScore: num(r.opportunity_score),
    views24h: num(r.views_24h),
    viewsPrev24h: num(r.views_prev_24h),
    subs24h: num(r.subs_24h),
    views7d: Number(r.views_7d),
    uploads7d: Number(r.uploads_7d),
    outliers30d: Number(r.outliers_30d),
    bestMultiplier: num(r.best_multiplier),
    videos: (videosByChannel.get(r.id) ?? []).map((v) => ({
      id: v.youtube_video_id,
      title: v.title,
      thumbnail: v.thumbnail_url || `https://i.ytimg.com/vi/${v.youtube_video_id}/hqdefault.jpg`,
      views: Number(v.view_count),
      multiplier: num(v.outlier_multiplier),
      publishedAt: new Date(v.published_at).toISOString(),
      isShort: Boolean(v.is_short),
    })),
  }));

  res.json({
    items,
    total,
    page,
    hasMore: (page + 1) * PAGE_SIZE < total,
    languages,
    updatedAt: lastScan?.at ? new Date(lastScan.at).toISOString() : null,
  });
}

const STOPWORDS = new Set(
  `the a an and or of to in on for with is are was be this that it my your you i me we they he she his her at by from as
  how what why who when where vs not no do does did can will just new video videos official full part shorts short
  youtube channel day days year years first best top get got make made one two all out up into about over more most so
  if but its le la les de des du un une et en est pour pas qui que sur avec dans ce mon ma il elle on je tu nous vous`.split(/\s+/),
);

/**
 * Channels similar to this one, from the database: the most frequent words in its
 * recent titles become a full-text query, matching channels are ranked by how many
 * of their titles match, with a bonus for the same category and language.
 */
export async function similar(req, res) {
  const { channelId } = req.params;

  const [channel] = await sql`SELECT id, name FROM channels WHERE youtube_channel_id = ${channelId}`;
  if (!channel) return res.status(404).json({ error: "Chaîne introuvable." });

  const titles = await sql`
    SELECT title, category_id, split_part(lower(language), '-', 1) AS language
    FROM videos
    WHERE channel_id = ${channel.id}
    ORDER BY published_at DESC
    LIMIT 40`;

  const counts = new Map();
  for (const { title } of titles) {
    const words = new Set(
      title
        .toLowerCase()
        .replace(/[^\p{L}\p{N} ]+/gu, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w)),
    );
    for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const keywords = [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([w]) => w);
  if (keywords.length === 0) return res.json({ keywords: [], items: [] });

  const mode = (values) => {
    const freq = new Map();
    for (const v of values) if (v != null) freq.set(v, (freq.get(v) ?? 0) + 1);
    return [...freq].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };
  const category = mode(titles.map((t) => t.category_id));
  const language = mode(titles.map((t) => t.language));
  const query = keywords.join(" | ");
  const niche = classifyChannel({ titles: titles.map((t) => t.title), name: channel.name });

  const rows = await sql`
    WITH matches AS (
      SELECT
        v.channel_id,
        sum(ts_rank(to_tsvector('simple', v.title), to_tsquery('simple', ${query})))::float8 AS relevance,
        count(*)::int AS matching_videos,
        bool_or(v.category_id = ${category}) AS same_category,
        bool_or(split_part(lower(v.language), '-', 1) = ${language}) AS same_language
      FROM videos v
      WHERE to_tsvector('simple', v.title) @@ to_tsquery('simple', ${query})
        AND v.channel_id <> ${channel.id}
        AND v.published_at > now() - interval '365 days'
      GROUP BY v.channel_id
    )
    SELECT
      c.youtube_channel_id, c.name, c.handle, c.thumbnail_url, c.subscriber_count, c.country,
      c.channel_created_at, c.outlier_rate, c.opportunity_score, c.trend_score,
      m.matching_videos,
      (SELECT array_agg(title) FROM (
        SELECT title FROM videos WHERE channel_id = c.id ORDER BY published_at DESC LIMIT 20
      ) recent) AS recent_titles,
      m.relevance * (CASE WHEN m.same_category THEN 1.5 ELSE 1 END) * (CASE WHEN m.same_language THEN 1.5 ELSE 1 END) AS score
    FROM matches m
    JOIN channels c ON c.id = m.channel_id
    WHERE c.rss_error_count < 5 AND m.matching_videos >= 2 AND COALESCE(c.subscriber_count, 0) >= 1000
    ORDER BY score DESC
    LIMIT 40`;

  // Keep channels in the same niche: a shared word ("ads", "story") is not enough
  // for a documentary channel to count as similar to a dropshipping one.
  const ranked = niche.id
    ? rows
        .map((r) => {
          const recent = r.recent_titles ?? [];
          const share = recent.length ? recent.filter((t) => titleMatchesNiche(t, niche.id)).length / recent.length : 0;
          return { r, share, score: Number(r.score) * (0.5 + share * 2) };
        })
        .filter((x) => x.share >= 0.2)
        .sort((a, b) => b.score - a.score)
        .map((x) => x.r)
    : rows;

  res.json({
    keywords,
    niche: niche.id ? { id: niche.id, label: niche.label } : null,
    items: ranked.slice(0, 12).map((r) => ({
      id: r.youtube_channel_id,
      name: r.name,
      handle: r.handle ?? null,
      avatar: r.thumbnail_url ?? null,
      subscribers: num(r.subscriber_count),
      country: r.country ?? null,
      createdAt: r.channel_created_at ? new Date(r.channel_created_at).toISOString() : null,
      outlierRate: num(r.outlier_rate),
      opportunityScore: num(r.opportunity_score),
      trendScore: num(r.trend_score),
      matchingVideos: Number(r.matching_videos),
    })),
  });
}
