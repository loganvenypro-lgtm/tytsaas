import { sql } from "../lib/sql.js";
import { parsePage } from "../lib/filterSpec.js";
import { titleTerms } from "../lib/titleKeywords.js";
import { VIDEO_COLUMNS, toVideoJson } from "../lib/videoRows.js";

const PAGE_SIZE = 24;
const MAX_LENGTH = 80;
const TOP_CHANNELS = 10;
const RELATED_SAMPLE = 300;

const PERIODS = { "30d": 30, "90d": 90, "365d": 365, all: null };
const FORMATS = {
  all: sql`TRUE`,
  long: sql`NOT v.is_short`,
  short: sql`v.is_short`,
};
const SORTS = {
  multiplier: sql`v.outlier_multiplier DESC NULLS LAST, v.view_count DESC`,
  views: sql`v.view_count DESC NULLS LAST`,
  recent: sql`v.published_at DESC`,
};

/**
 * The search text for websearch_to_tsquery: a plain keyword is searched as a phrase
 * ("dark web" means those two words side by side); quotes, OR and -word pass through.
 * Null when nothing searchable is left.
 */
export function keywordQuery(raw) {
  const text = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_LENGTH);
  if (!/[\p{L}\p{N}]/u.test(text)) return null;
  const hasOperators = /["]|(^|\s)-\S|\sOR\s/.test(text);
  return hasOperators ? text : `"${text.replace(/"/g, "")}"`;
}

/** Frequent title terms next to the keyword, minus the keyword's own words. */
export function relatedTerms(titles, keyword, limit = 12) {
  const own = new Set(keyword.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  const minCount = Math.max(3, Math.ceil(titles.length * 0.03));
  return [...titleTerms(titles)]
    .filter(([term, count]) => count >= minCount && !term.split(" ").every((w) => own.has(w)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

const toNum = (value) => (value != null ? Number(value) : null);

/**
 * Keywords: a niche seen through one keyword. Searches every analysed title with the
 * full-text index (idx_videos_title_fts), then returns the topic's size and views,
 * the channels that dominate it and its outlier videos. Terminated channels are left out.
 */
export async function search(req, res) {
  const q = keywordQuery(req.query.q);
  const format = FORMATS[req.query.format] ? req.query.format : "all";
  const period = req.query.period in PERIODS ? req.query.period : "365d";
  const sort = SORTS[req.query.sort] ? req.query.sort : "multiplier";
  const { page, limit, offset } = parsePage(req.query, PAGE_SIZE);
  if (!q) return res.status(400).json({ error: "Saisis un mot-clé." });

  const days = PERIODS[period];
  const where = sql`
    to_tsvector('simple', v.title) @@ websearch_to_tsquery('simple', ${q})
    AND c.terminated_at IS NULL
    AND NOT v.is_livestream
    AND ${FORMATS[format]}
    ${days ? sql`AND v.published_at > now() - make_interval(days => ${days})` : sql``}`;
  const outliers = sql`${where} AND v.outlier_multiplier IS NOT NULL`;

  // Stats, channels and related terms only on the first page; later pages just add videos.
  const [rows, [{ total }], statsRows, channelRows, sampleRows] = await Promise.all([
    sql`
      SELECT ${VIDEO_COLUMNS}
      FROM videos v JOIN channels c ON c.id = v.channel_id
      WHERE ${outliers}
      ORDER BY ${SORTS[sort]}
      LIMIT ${limit} OFFSET ${offset}`,
    sql`SELECT count(*)::int AS total FROM videos v JOIN channels c ON c.id = v.channel_id WHERE ${outliers}`,
    page > 0
      ? []
      : sql`
          SELECT count(*)::int AS videos,
                 count(DISTINCT v.channel_id)::int AS channels,
                 coalesce(sum(v.view_count), 0)::bigint AS total_views,
                 avg(v.view_count)::bigint AS avg_views,
                 percentile_cont(0.5) WITHIN GROUP (ORDER BY v.view_count)::bigint AS median_views,
                 count(*) FILTER (WHERE v.outlier_multiplier >= 3)::int AS outliers,
                 count(*) FILTER (WHERE v.published_at > now() - interval '30 days')::int AS last_30_days
          FROM videos v JOIN channels c ON c.id = v.channel_id
          WHERE ${where}`,
    page > 0
      ? []
      : sql`
          SELECT c.youtube_channel_id, c.name, c.handle, c.thumbnail_url, c.subscriber_count, c.niche,
                 count(*)::int AS videos,
                 sum(v.view_count)::bigint AS total_views,
                 avg(v.view_count)::bigint AS avg_views,
                 max(v.outlier_multiplier) AS best_multiplier
          FROM videos v JOIN channels c ON c.id = v.channel_id
          WHERE ${where}
          GROUP BY c.id
          ORDER BY sum(v.view_count) DESC NULLS LAST, count(*) DESC
          LIMIT ${TOP_CHANNELS}`,
    page > 0
      ? []
      : sql`
          SELECT v.title FROM videos v JOIN channels c ON c.id = v.channel_id
          WHERE ${where}
          ORDER BY v.view_count DESC NULLS LAST
          LIMIT ${RELATED_SAMPLE}`,
  ]);

  const s = statsRows[0];
  res.json({
    query: String(req.query.q).trim().slice(0, MAX_LENGTH),
    format,
    period,
    sort,
    items: rows.map(toVideoJson),
    total,
    page,
    pageSize: PAGE_SIZE,
    hasMore: offset + rows.length < total,
    ...(s && {
      stats: {
        videos: s.videos,
        channels: s.channels,
        totalViews: toNum(s.total_views),
        avgViews: toNum(s.avg_views),
        medianViews: toNum(s.median_views),
        outliers: s.outliers,
        last30Days: s.last_30_days,
      },
      channels: channelRows.map((r) => ({
        id: r.youtube_channel_id,
        name: r.name,
        handle: r.handle ?? null,
        avatar: r.thumbnail_url ?? null,
        subscribers: toNum(r.subscriber_count),
        niche: r.niche ?? null,
        videos: r.videos,
        totalViews: toNum(r.total_views),
        avgViews: toNum(r.avg_views),
        // Share of the topic's views this channel holds.
        share: s.total_views > 0 ? Number(r.total_views) / Number(s.total_views) : 0,
        bestMultiplier: r.best_multiplier != null ? Math.round(Number(r.best_multiplier) * 10) / 10 : null,
      })),
      related: relatedTerms(sampleRows.map((r) => r.title), String(req.query.q)),
    }),
  });
}
