import { sql } from "../lib/sql.js";
import { VIDEO_COLUMNS, toVideoJson } from "../lib/videoRows.js";

const PERIOD_HOURS = {
  "24h": 24,
  "3d": 72,
  "7d": 168,
  "30d": 720,
  "90d": 2160,
};

const PAGE_SIZE = 24;

export function toNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Top Videos: videos far above their channel's usual views. Reads only
 * PostgreSQL (filled by the scanner), so browsing never spends YouTube quota.
 */
export async function topVideos(req, res) {
  const params = req.query;

  const format = params.format ?? "all";
  const period = params.period ?? "7d";
  const periodHours = period === "all" ? null : (PERIOD_HOURS[period] ?? PERIOD_HOURS["7d"]);
  const minSubs = toNumber(params.minSubs);
  const maxSubs = toNumber(params.maxSubs);
  const minViews = toNumber(params.minViews);
  const minMultiplier = toNumber(params.minMultiplier);
  const category = toNumber(params.category);
  const language = String(params.language ?? "").trim().toLowerCase() || null;
  const query = String(params.q ?? "").trim() || null;
  const relevantOnly = params.relevant !== "false";
  const sort = params.sort ?? "score";
  const page = Math.max(0, Math.floor(toNumber(params.page) ?? 0));

  const where = sql`
    ${periodHours !== null ? sql`v.published_at > now() - make_interval(hours => ${periodHours})` : sql`TRUE`}
    ${format === "short" ? sql`AND v.is_short` : format === "long" ? sql`AND NOT v.is_short` : sql``}
    ${relevantOnly ? sql`AND v.relevance_score IS NOT NULL` : sql``}
    ${minSubs !== null ? sql`AND c.subscriber_count >= ${minSubs}` : sql``}
    ${maxSubs !== null ? sql`AND c.subscriber_count <= ${maxSubs}` : sql``}
    ${minViews !== null ? sql`AND v.view_count >= ${minViews}` : sql``}
    ${minMultiplier !== null ? sql`AND v.outlier_multiplier >= ${minMultiplier}` : sql``}
    ${category !== null ? sql`AND v.category_id = ${category}` : sql``}
    ${language ? sql`AND split_part(lower(v.language), '-', 1) = ${language}` : sql``}
    ${query ? sql`AND (v.title ILIKE ${"%" + query + "%"} OR c.name ILIKE ${"%" + query + "%"})` : sql``}
  `;

  const orderBy =
    sort === "multiplier"
      ? sql`v.outlier_multiplier DESC NULLS LAST`
      : sort === "views"
        ? sql`v.view_count DESC`
        : sort === "velocity"
          ? sql`v.views_per_hour DESC NULLS LAST`
          : sort === "recent"
            ? sql`v.published_at DESC`
            : sql`v.relevance_score DESC NULLS LAST, v.outlier_multiplier DESC NULLS LAST`;

  const [rows, [{ total }], languages, [lastScan]] = await Promise.all([
    sql`
      SELECT ${VIDEO_COLUMNS}
      FROM videos v
      JOIN channels c ON c.id = v.channel_id
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT ${PAGE_SIZE} OFFSET ${page * PAGE_SIZE}`,
    sql`
      SELECT count(*)::int AS total
      FROM videos v
      JOIN channels c ON c.id = v.channel_id
      WHERE ${where}`,
    sql`
      SELECT split_part(lower(language), '-', 1) AS code, count(*)::int AS count
      FROM videos
      WHERE language IS NOT NULL AND relevance_score IS NOT NULL
        AND published_at > now() - interval '30 days'
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 12`,
    sql`SELECT max(finished_at) AS at FROM scan_runs WHERE status = 'ok'`,
  ]);

  res.json({
    items: rows.map(toVideoJson),
    total,
    page,
    pageSize: PAGE_SIZE,
    hasMore: (page + 1) * PAGE_SIZE < total,
    languages,
    updatedAt: lastScan?.at ? new Date(lastScan.at).toISOString() : null,
  });
}
