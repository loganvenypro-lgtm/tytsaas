import { sql } from "../lib/sql.js";
import { FORMAT_BY_ID, NICHES, NICHE_BY_ID } from "../lib/taxonomy/index.js";
import { channelProfile } from "../lib/channelProfile.js";
import { YPP_STATUSES } from "../lib/taxonomy/monetization.js";
import { topKeywords } from "../lib/titleKeywords.js";
import { VIDEO_COLUMNS, toVideoJson } from "../lib/videoRows.js";
import { applyFilters, applySort, parsePage } from "../lib/filterSpec.js";
import { nicheOptions, subNicheOptions, formatOptions, languageOptions, categoryOptions } from "./videos.js";

const PAGE_SIZE = 18;

const num = (value) => (value != null ? Number(value) : null);

const label = (en, fr) => ({ en, fr });
const values = (options) => () => options().map((o) => o.value);
const subsPerDay = sql`c.subscriber_count::float8 / GREATEST(EXTRACT(EPOCH FROM now() - c.channel_created_at) / 86400, 1)`;
const yppOptions = () => Object.entries(YPP_STATUSES).map(([value, l]) => ({ value, label: l }));

/** Everything the channel lists can be filtered and sorted by (r = 30-day aggregates, snap = 24 h deltas). */
export const CHANNEL_SPEC = {
  filters: [
    {
      key: "q",
      type: "text",
      label: label("Search", "Recherche"),
      where: (text) => sql`(c.name ILIKE ${"%" + text + "%"} OR c.handle ILIKE ${"%" + text + "%"})`,
    },
    {
      key: "format",
      type: "choice",
      label: label("Format", "Format"),
      default: "all",
      options: [
        { value: "all", label: label("All", "Tous") },
        { value: "long", label: label("Long-form channels", "Chaînes de vidéos longues"), where: sql`r.short_share < 0.5` },
        { value: "short", label: label("Shorts channels", "Chaînes de Shorts"), where: sql`r.short_share >= 0.5` },
      ],
    },
    { key: "niche", type: "enum", label: label("Niche", "Niche"), column: sql`c.niche`, options: nicheOptions, values: values(nicheOptions) },
    { key: "subNiche", type: "enum", label: label("Sub-niche", "Sous-niche"), column: sql`c.sub_niche`, options: subNicheOptions, values: values(subNicheOptions) },
    { key: "style", type: "enum", label: label("Main video style", "Style principal"), column: sql`c.primary_format`, options: formatOptions, values: values(formatOptions) },
    { key: "language", type: "enum", label: label("Language", "Langue"), column: sql`c.lang`, options: languageOptions, values: values(languageOptions) },
    { key: "country", type: "enum", label: label("Country", "Pays"), column: sql`c.country`, pattern: /^[A-Z]{2}$/ },
    {
      key: "category",
      type: "enum",
      numeric: true,
      label: label("YouTube category", "Catégorie YouTube"),
      column: sql`COALESCE(c.category_id, r.category_id)`,
      options: categoryOptions,
      values: values(categoryOptions),
    },
    { key: "subs", type: "range", label: label("Subscribers", "Abonnés"), column: sql`c.subscriber_count` },
    { key: "ageDays", type: "range", label: label("Channel age", "Âge de la chaîne"), unit: "days", column: sql`EXTRACT(EPOCH FROM now() - c.channel_created_at) / 86400` },
    { key: "subsPerDay", type: "range", label: label("Subscribers per day", "Abonnés par jour"), column: subsPerDay },
    { key: "outlierRate", type: "range", label: label("Outlier rate", "Taux d'outliers"), unit: "%", scale: 0.01, column: sql`c.outlier_rate` },
    { key: "trend", type: "range", label: label("Trend score", "Score de tendance"), unit: "/100", column: sql`c.trend_score` },
    { key: "opportunity", type: "range", label: label("Opportunity score", "Score d'opportunité"), unit: "/100", column: sql`c.opportunity_score` },
    { key: "uploadsPerWeek", type: "range", label: label("Uploads per week", "Vidéos par semaine"), column: sql`c.uploads_per_week` },
    { key: "medianViews", type: "range", label: label("Usual views", "Vues habituelles"), column: sql`c.median_views` },
    {
      key: "ypp",
      type: "enum",
      label: label("Partner Program (estimated)", "Programme Partenaire (estimé)"),
      column: sql`c.ypp_status`,
      options: yppOptions,
      values: values(yppOptions),
    },
    {
      key: "revenue",
      type: "range",
      label: label("Est. monthly ad revenue", "Revenus pub. estimés / mois"),
      unit: "$",
      column: sql`(c.est_monthly_revenue_low + c.est_monthly_revenue_high) / 2`,
    },
    {
      key: "withOutliers",
      type: "bool",
      label: label("With recent outliers", "Avec des outliers récents"),
      where: (on) => (on ? sql`r.outliers_30d > 0` : null),
    },
  ],
  sorts: [
    { value: "trend", label: label("Trending", "Tendance"), orderBy: sql`c.trend_score DESC NULLS LAST, r.views_7d DESC NULLS LAST` },
    { value: "views24h", label: label("Views in 24 h", "Vues en 24 h"), orderBy: sql`views_24h DESC NULLS LAST, r.views_7d DESC NULLS LAST` },
    { value: "subs24h", label: label("Subscribers in 24 h", "Abonnés en 24 h"), orderBy: sql`subs_24h DESC NULLS LAST, r.views_7d DESC NULLS LAST` },
    { value: "views7d", label: label("Views in 7 days", "Vues en 7 jours"), orderBy: sql`r.views_7d DESC NULLS LAST` },
    { value: "opportunity", label: label("Opportunity", "Opportunité"), orderBy: sql`c.opportunity_score DESC NULLS LAST` },
    { value: "subsPerDay", label: label("Fastest growth", "Croissance la plus rapide"), orderBy: sql`${subsPerDay} DESC NULLS LAST` },
    { value: "outlierRate", label: label("Outlier rate", "Taux d'outliers"), orderBy: sql`c.outlier_rate DESC NULLS LAST, c.opportunity_score DESC NULLS LAST` },
    { value: "outliers", label: label("Most outliers", "Le plus d'outliers"), orderBy: sql`r.outliers_30d DESC, r.best_multiplier DESC NULLS LAST` },
    { value: "multiplier", label: label("Best outlier", "Meilleur outlier"), orderBy: sql`r.best_multiplier DESC NULLS LAST` },
    { value: "newest", label: label("Newest channels", "Chaînes les plus récentes"), orderBy: sql`c.channel_created_at DESC NULLS LAST` },
    {
      value: "revenue",
      label: label("Highest est. revenue", "Revenus estimés"),
      orderBy: sql`(c.est_monthly_revenue_low + c.est_monthly_revenue_high) DESC NULLS LAST`,
    },
    { value: "subscribers", label: label("Most subscribers", "Plus d'abonnés"), orderBy: sql`c.subscriber_count DESC NULLS LAST` },
  ],
  defaultSort: "trend",
};

/** Estimated Partner Program status and ad revenue (worker's monetization job). */
function monetizationJson(r) {
  return {
    status: r.ypp_status ?? null,
    watchHours: num(r.ypp_watch_hours),
    shortsViews90d: num(r.ypp_shorts_views),
    dailyViews: num(r.est_daily_views),
    monthlyRevenue:
      r.est_monthly_revenue_low != null ? { low: num(r.est_monthly_revenue_low), high: num(r.est_monthly_revenue_high) } : null,
    changedAt: r.ypp_changed_at ? new Date(r.ypp_changed_at).toISOString() : null,
  };
}

/**
 * Monetization tracker: channels whose estimated Partner Program status changed
 * (newest first), e.g. the ones that just became eligible.
 * ?status=eligible|early|not_eligible  ?days=30
 */
export async function monetizationEvents(req, res) {
  const status = Object.hasOwn(YPP_STATUSES, req.query.status) ? req.query.status : null;
  const days = Math.min(90, Math.max(1, Math.floor(Number(req.query.days) || 30)));
  const rows = await sql`
    SELECT e.status AS event_status, e.previous_status, e.detected_at, e.subscriber_count AS event_subs,
      c.youtube_channel_id, c.name, c.handle, c.thumbnail_url, c.subscriber_count, c.niche, c.lang, c.country,
      c.channel_created_at, c.ypp_status, c.ypp_watch_hours, c.ypp_shorts_views, c.ypp_changed_at, c.est_daily_views,
      c.est_monthly_revenue_low, c.est_monthly_revenue_high
    FROM channel_monetization_events e
    JOIN channels c ON c.id = e.channel_id
    WHERE e.status IS NOT NULL
      AND e.detected_at > now() - make_interval(days => ${days})
      ${status ? sql`AND e.status = ${status}` : sql``}
    ORDER BY e.detected_at DESC
    LIMIT 100`;
  const [counts] = await sql`
    SELECT
      count(*) FILTER (WHERE ypp_status = 'eligible')::int AS eligible,
      count(*) FILTER (WHERE ypp_status = 'early')::int AS early,
      count(*) FILTER (WHERE ypp_status = 'not_eligible')::int AS "notEligible",
      count(*) FILTER (WHERE ypp_status IS NULL)::int AS unknown
    FROM channels WHERE rss_error_count < 5`;
  res.json({
    counts,
    statuses: YPP_STATUSES,
    items: rows.map((r) => ({
      status: r.event_status,
      previousStatus: r.previous_status,
      detectedAt: new Date(r.detected_at).toISOString(),
      channel: {
        id: r.youtube_channel_id,
        name: r.name,
        handle: r.handle ?? null,
        avatar: r.thumbnail_url ?? null,
        subscribers: num(r.subscriber_count),
        niche: r.niche ?? null,
        language: r.lang ?? null,
        country: r.country ?? null,
        createdAt: r.channel_created_at ? new Date(r.channel_created_at).toISOString() : null,
      },
      monetization: monetizationJson(r),
    })),
  });
}

/**
 * Niche Finder: small, young channels whose videos get far more views than they
 * have subscribers and that are (estimated) monetized. Strangers watching a
 * new channel in numbers is the clearest sign of unmet demand in a niche.
 *   ?maxSubs=100000 &maxAgeDays=365 &minRatio=2 &format=long|short &language=fr &niche=… &page=0
 * Ratio = average views of the channel's matured uploads of the last 90 days / subscribers.
 */
export async function nicheFinder(req, res) {
  const pick = (v, d, lo, hi) => (Number.isFinite(Number(v)) && v !== "" ? Math.min(hi, Math.max(lo, Number(v))) : d);
  const maxSubs = pick(req.query.maxSubs, 100_000, 1000, 10_000_000);
  const maxAgeDays = pick(req.query.maxAgeDays, 365, 7, 3650);
  const minRatio = pick(req.query.minRatio, 2, 0.1, 1000);
  const page = Math.floor(pick(req.query.page, 0, 0, 50));
  const format = req.query.format === "long" || req.query.format === "short" ? req.query.format : null;
  const language = /^[a-z]{2}$/.test(String(req.query.language ?? "")) ? req.query.language : null;
  const niche = NICHE_BY_ID[req.query.niche] ? req.query.niche : null;
  const size = 12;

  const rows = await sql`
    WITH recent AS (
      SELECT v.channel_id,
        avg(v.view_count)::float8 AS avg_views,
        count(*)::int AS uploads_90d,
        avg(v.is_short::int)::float8 AS short_share,
        avg(v.engagement_rate)::float8 AS engagement,
        avg(v.duration_seconds) FILTER (WHERE NOT v.is_short)::float8 AS avg_duration
      FROM videos v
      WHERE v.published_at BETWEEN now() - interval '90 days' AND now() - interval '3 days'
        AND NOT v.is_livestream AND v.last_stats_at IS NOT NULL
      GROUP BY v.channel_id
      HAVING count(*) >= 2
    )
    SELECT c.*, r.avg_views, r.uploads_90d, r.short_share AS recent_short_share, r.engagement, r.avg_duration,
      r.avg_views / greatest(c.subscriber_count, 1) AS ratio,
      count(*) OVER () AS total
    FROM channels c
    JOIN recent r ON r.channel_id = c.id
    WHERE c.rss_error_count < 5
      AND c.ypp_status = 'eligible'
      AND c.subscriber_count BETWEEN 1000 AND ${maxSubs}
      AND c.channel_created_at > now() - make_interval(days => ${maxAgeDays})
      AND r.avg_views / greatest(c.subscriber_count, 1) >= ${minRatio}
      ${format === "short" ? sql`AND r.short_share >= 0.5` : format === "long" ? sql`AND r.short_share < 0.5` : sql``}
      ${language ? sql`AND c.lang = ${language}` : sql``}
      ${niche ? sql`AND c.niche = ${niche}` : sql``}
    -- Strongest demand signal first: the ratio (log), weighted towards younger channels.
    ORDER BY ln(1 + r.avg_views / greatest(c.subscriber_count, 1))
      * (1.5 - least(1, extract(epoch FROM now() - c.channel_created_at) / 86400 / ${maxAgeDays})) DESC
    LIMIT ${size} OFFSET ${page * size}`;

  const ids = rows.map((r) => r.id);
  const videos = ids.length
    ? await sql`
        SELECT * FROM (
          SELECT v.channel_id, v.youtube_video_id, v.title, v.thumbnail_url, v.view_count, v.outlier_multiplier,
            v.published_at, v.is_short,
            row_number() OVER (PARTITION BY v.channel_id ORDER BY v.view_count DESC) AS rank
          FROM videos v WHERE v.channel_id IN ${sql(ids)} AND NOT v.is_livestream
        ) x WHERE rank <= 3`
    : [];
  const keywordsBy = new Map();
  if (ids.length) {
    const titles = await sql`
      SELECT channel_id, array_agg(title ORDER BY published_at DESC) AS titles
      FROM videos WHERE channel_id IN ${sql(ids)} GROUP BY channel_id`;
    for (const t of titles) keywordsBy.set(t.channel_id, topKeywords(t.titles.slice(0, 40), 5));
  }

  res.json({
    total: Number(rows[0]?.total ?? 0),
    page,
    hasMore: (page + 1) * size < Number(rows[0]?.total ?? 0),
    params: { maxSubs, maxAgeDays, minRatio, format, language, niche },
    items: rows.map((r) => {
      const ratio = Number(r.ratio);
      const isShorts = Number(r.recent_short_share) >= 0.5;
      const insights = [
        Number(r.est_rpm) >= 5 && "highProfitability",
        ratio >= 3 && "highDemand",
        Number(r.engagement) >= 0.04 && "loyalViewers",
        (Number(r.uploads_90d) >= 24 || Number(r.avg_duration) >= 900) && "highCommitment",
      ].filter(Boolean);
      return {
        id: r.youtube_channel_id,
        name: r.name,
        handle: r.handle ?? null,
        avatar: r.thumbnail_url ?? null,
        subscribers: num(r.subscriber_count),
        createdAt: iso(r.channel_created_at),
        spottedAt: iso(r.discovered_at ?? r.created_at),
        totalVideos: num(r.video_count),
        typicalViews: num(r.median_views),
        avgViews: Math.round(Number(r.avg_views)),
        ratio: Math.round(ratio * 10) / 10,
        language: r.lang ?? null,
        content: isShorts ? "short" : "long",
        niche: r.niche ?? null,
        subNiche: r.sub_niche ?? null,
        keywords: keywordsBy.get(r.id) ?? [],
        rpm: num(r.est_rpm),
        monetization: monetizationJson(r),
        insights,
        videos: videos
          .filter((v) => v.channel_id === r.id)
          .map((v) => ({
            id: v.youtube_video_id,
            title: v.title,
            thumbnail: v.thumbnail_url || `https://i.ytimg.com/vi/${v.youtube_video_id}/hqdefault.jpg`,
            views: Number(v.view_count),
            multiplier: num(v.outlier_multiplier),
            publishedAt: iso(v.published_at),
            isShort: Boolean(v.is_short),
          })),
      };
    }),
  });
}

const iso = (d) => (d ? new Date(d).toISOString() : null);

/**
 * Today's trending charts (daily job): ?region=FR&category=0 (0 = overall).
 * Rank changes against the previous day's chart.
 */
export async function trending(req, res) {
  const region = /^[A-Z]{2}$/.test(String(req.query.region ?? "")) ? req.query.region : "US";
  const category = Number.isInteger(Number(req.query.category)) ? Number(req.query.category) : 0;
  const [{ day } = {}] = await sql`SELECT max(day) AS day FROM trending_entries WHERE region = ${region}`;
  const regions = await sql`SELECT DISTINCT region FROM trending_entries WHERE day = ${day ?? null} ORDER BY region`;
  if (!day) return res.json({ day: null, region, category, regions: [], items: [] });

  const rows = await sql`
    SELECT t.rank, t.youtube_video_id AS chart_video_id, t.title AS chart_title, t.view_count AS chart_views,
      t.published_at AS chart_published_at,
      y.rank AS previous_rank,
      v.youtube_video_id AS stored, ${VIDEO_COLUMNS}
    FROM trending_entries t
    LEFT JOIN trending_entries y
      ON y.day = t.day - 1 AND y.region = t.region AND y.category_id = t.category_id AND y.youtube_video_id = t.youtube_video_id
    LEFT JOIN videos v ON v.youtube_video_id = t.youtube_video_id
    LEFT JOIN channels c ON c.id = v.channel_id
    WHERE t.day = ${day} AND t.region = ${region} AND t.category_id = ${category}
    ORDER BY t.rank`;
  res.json({
    day,
    region,
    category,
    regions: regions.map((r) => r.region),
    items: rows.map((r) => ({
      rank: r.rank,
      previousRank: r.previous_rank ?? null,
      // Videos of channels the database tracks come with their full stats and outlier score.
      video: r.stored
        ? toVideoJson(r)
        : {
            id: r.chart_video_id,
            title: r.chart_title,
            thumbnail: `https://i.ytimg.com/vi/${r.chart_video_id}/hqdefault.jpg`,
            views: num(r.chart_views),
            publishedAt: r.chart_published_at ? new Date(r.chart_published_at).toISOString() : null,
          },
    })),
  });
}

/**
 * Breakout Creators: channels ranked by momentum, read from PostgreSQL only.
 * +views/+subs over 24 h come from daily channel snapshots (scanner);
 * until a channel has a day of history, momentum falls back to its last 7 days of uploads.
 */
export async function breakout(req, res) {
  const { where: filtered, applied } = applyFilters(CHANNEL_SPEC, req.query);
  const where = sql`c.rss_error_count < 5 AND ${filtered}`;
  const { sort, orderBy } = applySort(CHANNEL_SPEC, req.query);
  const { page } = parsePage(req.query, PAGE_SIZE);

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
        c.niche, c.sub_niche, c.niche_confidence, c.primary_format, c.lang, c.median_views, c.uploads_per_week,
        c.ypp_status, c.ypp_watch_hours, c.ypp_shorts_views, c.ypp_changed_at, c.est_daily_views,
        c.est_monthly_revenue_low, c.est_monthly_revenue_high,
        r.views_7d, r.uploads_7d, r.outliers_30d, r.best_multiplier, r.short_share, r.category_id, r.language,
        snap.views_24h, snap.views_prev_24h, snap.subs_24h
      FROM ${from}
      WHERE ${where}
      ORDER BY ${orderBy}
      LIMIT ${PAGE_SIZE} OFFSET ${page * PAGE_SIZE}`,
    sql`SELECT count(*)::int AS total FROM ${from} WHERE ${where}`,
    sql`
      SELECT lang AS code, count(*)::int AS count
      FROM channels
      WHERE lang IS NOT NULL AND rss_error_count < 5
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
    language: r.lang ?? r.language ?? null,
    niche: r.niche ?? null,
    subNiche: r.sub_niche ?? null,
    nicheConfidence: num(r.niche_confidence),
    style: r.primary_format ?? null,
    medianViews: num(r.median_views),
    uploadsPerWeek: num(r.uploads_per_week),
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
    monetization: monetizationJson(r),
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
    filters: applied,
    sort,
    updatedAt: lastScan?.at ? new Date(lastScan.at).toISOString() : null,
  });
}

const SUB_NICHE_BY_ID = Object.fromEntries(NICHES.flatMap((n) => n.subNiches.map((s) => [s.id, { ...s, niche: n.id }])));
const SIMILAR_LIMIT = 12;
const SIMILAR_VIDEOS = 8;
// Channels scored in full (each on its last 30 videos), out of the niche and term matches.
const SIMILAR_POOL = 400;

/** { id: share } → [{ id, label, share, niche? }] with the labels the frontend shows (niche: a sub-niche's parent). */
const labelled = (shares, byId) =>
  Object.entries(shares)
    .filter(([id]) => byId[id])
    .map(([id, share]) => ({ id, label: byId[id].label, share, niche: byId[id].niche }));

/**
 * Channels and videos similar to this one. The channel is first read into a search
 * profile (lib/channelProfile.js: how its videos spread across niches, sub-niches,
 * styles and title hooks, its format, language and its dominant title terms weighted
 * by IDF, hype words left out). Candidates are the channels of its main niches plus
 * those whose titles share its terms; each one's last 30 videos are scored against
 * the profile in SQL (topic, sub-topic and style first, then term overlap, then
 * language, Shorts/long-form mix, duration and size). Postgres only, no YouTube quota.
 */
export async function similar(req, res) {
  const { channelId } = req.params;

  const [channel] = await sql`
    SELECT id, name, handle, description, niche, sub_niche, niche_confidence, lang, primary_format, short_share, subscriber_count
    FROM channels WHERE youtube_channel_id = ${channelId}`;
  if (!channel) return res.status(404).json({ error: "Chaîne introuvable." });

  const profile = await channelProfile(channel);
  const topNiches = Object.keys(profile.niches).slice(0, 2);
  const queries = profile.terms.map((t) => t.query);
  const weights = profile.terms.map((t) => t.weight);
  const shares = profile.terms.map((t) => t.share);
  const profileJson = {
    niches: labelled(profile.niches, NICHE_BY_ID).slice(0, 3),
    subNiches: labelled(profile.subNiches, SUB_NICHE_BY_ID).slice(0, 3),
    formats: labelled(profile.formats, FORMAT_BY_ID).slice(0, 2),
    language: profile.lang,
    shortShare: profile.shortShare,
    medianDuration: profile.medianDuration,
  };
  if (!topNiches.length && !queries.length) return res.json({ keywords: [], niche: null, profile: profileJson, items: [], videos: [] });

  const json = (shares) => sql.json(shares);
  const top = (shares) => Math.max(...Object.values(shares), 0) || 1;
  const norm = (shares) => Math.hypot(...Object.values(shares)) || 1;
  const anyTerm = queries.map((q) => `(${q})`).join(" | ");
  const subs = Math.max(Number(channel.subscriber_count ?? 0), 1);
  const longForm = profile.shortShare < 0.5;

  const rows = await sql`
    WITH terms AS (
      SELECT t.i, to_tsquery('simple', t.q) AS tq, t.w, greatest(t.s, 0.05) AS s
      FROM unnest(${queries}::text[], ${weights}::float8[], ${shares}::float8[]) WITH ORDINALITY AS t(q, w, s, i)
    ),
    -- Recall: channels of the main niches and channels whose recent titles hold the terms (ts_rank), capped so a
    -- channel with hundreds of videos does not win on volume. The best ones get scored.
    pool AS (
      SELECT x.channel_id AS id
      FROM (
        SELECT id AS channel_id, 0 AS from_niche, 0 AS from_terms, 3 * coalesce((${json(profile.niches)}::jsonb ->> niche)::float8, 0) AS from_label
        FROM channels WHERE niche = ANY(${topNiches}::text[])
        UNION ALL
        SELECT channel_id, coalesce((${json(profile.niches)}::jsonb ->> niche)::float8, 0), 0, 0
        FROM videos WHERE niche = ANY(${topNiches}::text[]) AND published_at > now() - interval '2 years'
        ${
          queries.length
            ? sql`UNION ALL
              SELECT channel_id, 0, 10 * ts_rank(to_tsvector('simple', title), to_tsquery('simple', ${anyTerm})), 0
              FROM videos
              WHERE to_tsvector('simple', title) @@ to_tsquery('simple', ${anyTerm}) AND published_at > now() - interval '2 years'`
            : sql``
        }
      ) x
      JOIN channels c ON c.id = x.channel_id
      WHERE c.id <> ${channel.id} AND c.rss_error_count < 5 AND c.terminated_at IS NULL AND COALESCE(c.subscriber_count, 0) >= 1000
      GROUP BY x.channel_id
      ORDER BY least(sum(x.from_niche), 8) + least(sum(x.from_terms), 8) + max(x.from_label) DESC
      LIMIT ${SIMILAR_POOL}
    ),
    candidates AS (
      SELECT c.* FROM channels c WHERE c.id = ${channel.id} OR c.id IN (SELECT id FROM pool)
    ),
    -- Each candidate's last 30 videos against the profile: share of their niche, sub-niche, style and hooks in it,
    -- profile terms their title holds.
    vids AS (
      SELECT v.*,
        coalesce((${json(profile.niches)}::jsonb ->> v.niche)::float8, 0) AS p_niche,
        coalesce((${json(profile.subNiches)}::jsonb ->> v.sub_niche)::float8, 0) AS p_sub,
        coalesce((${json(profile.formats)}::jsonb ->> v.format)::float8, 0) AS p_format,
        coalesce((SELECT avg(coalesce((${json(profile.hooks)}::jsonb ->> h)::float8, 0)) FROM unnest(v.title_hooks) h), 0) AS p_hooks,
        ARRAY(SELECT t.i FROM terms t WHERE v.tsv @@ t.tq) AS matched
      FROM candidates c
      CROSS JOIN LATERAL (
        SELECT channel_id, youtube_video_id, title, thumbnail_url, view_count, outlier_multiplier, published_at,
          is_short, duration_seconds, niche, sub_niche, format, title_hooks, to_tsvector('simple', title) AS tsv
        FROM videos WHERE channel_id = c.id ORDER BY published_at DESC LIMIT 30
      ) v
    ),
    -- How often each channel uses each term.
    hits AS (
      SELECT v.channel_id, m.i, count(*) AS cnt FROM vids v CROSS JOIN unnest(v.matched) AS m(i) GROUP BY 1, 2
    ),
    -- Term overlap: each profile term counts by its weight, fully once the channel uses it as often as the source
    -- does. Breadth wins: one shared word ("game") is a small part of the total.
    term_fit AS (
      SELECT h.channel_id, sum(t.w * least(1, (h.cnt::float8 / n.n) / t.s)) / ${weights.reduce((a, b) => a + b, 0) || 1} AS fit
      FROM hits h
      JOIN terms t ON t.i = h.i
      JOIN (SELECT channel_id, count(*) AS n FROM vids GROUP BY 1) n ON n.channel_id = h.channel_id
      GROUP BY h.channel_id
    ),
    -- Length of each channel's niche, sub-niche and style count vectors, for the cosine with the profile.
    norms AS (
      SELECT channel_id,
        sqrt(sum(cnt * cnt) FILTER (WHERE axis = 1)) AS niche_norm, sum(cnt) FILTER (WHERE axis = 1) AS niche_n,
        sqrt(sum(cnt * cnt) FILTER (WHERE axis = 2)) AS sub_norm, sum(cnt) FILTER (WHERE axis = 2) AS sub_n,
        sqrt(sum(cnt * cnt) FILTER (WHERE axis = 3)) AS format_norm, sum(cnt) FILTER (WHERE axis = 3) AS format_n
      FROM (
        SELECT channel_id, 1 AS axis, count(*)::float8 AS cnt FROM vids WHERE niche IS NOT NULL GROUP BY channel_id, niche
        UNION ALL
        SELECT channel_id, 2, count(*) FROM vids WHERE sub_niche IS NOT NULL GROUP BY channel_id, sub_niche
        UNION ALL
        SELECT channel_id, 3, count(*) FROM vids WHERE format IS NOT NULL GROUP BY channel_id, format
      ) x
      GROUP BY channel_id
    ),
    agg AS (
      SELECT v.channel_id, count(*)::int AS n,
        -- Cosine between how the channel's videos spread and the profile, damped when few of them are classified.
        coalesce(sum(p_niche) / nullif(max(nm.niche_norm) * ${norm(profile.niches)}, 0) * max(nm.niche_n) / (max(nm.niche_n) + 3), 0) AS topic,
        coalesce(sum(p_sub) / nullif(max(nm.sub_norm) * ${norm(profile.subNiches)}, 0) * max(nm.sub_n) / (max(nm.sub_n) + 3), 0) AS sub_topic,
        coalesce(sum(p_format) / nullif(max(nm.format_norm) * ${norm(profile.formats)}, 0) * max(nm.format_n) / (max(nm.format_n) + 3), 0) AS style,
        avg(p_hooks) AS hooks_dot,
        coalesce(max(tf.fit), 0) AS term_fit,
        count(*) FILTER (WHERE cardinality(matched) > 0)::int AS matching_videos,
        avg(is_short::int)::float8 AS short_share,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_seconds) FILTER (WHERE NOT is_short AND duration_seconds > 0) AS median_duration
      FROM vids v
      LEFT JOIN term_fit tf ON tf.channel_id = v.channel_id
      LEFT JOIN norms nm ON nm.channel_id = v.channel_id
      GROUP BY v.channel_id
    ),
    -- The source channel against its own profile: what a perfect match scores on the term and hook axes.
    src AS (SELECT * FROM agg WHERE channel_id = ${channel.id}),
    -- Fit on each axis, 0 to 1.
    fits AS (
      SELECT c.id, c.youtube_channel_id, c.name, c.handle, c.thumbnail_url, c.subscriber_count, c.country,
        c.channel_created_at, c.outlier_rate, c.opportunity_score, c.trend_score, c.niche, c.sub_niche,
        a.matching_videos,
        -- Few videos: their averages say less.
        a.n::float8 / (a.n + 3) AS trust,
        a.topic, a.sub_topic, a.style,
        -- Square root: sharing a third of the source terms is already a strong signal.
        sqrt(least(1, coalesce(a.term_fit / nullif(s.term_fit, 0), 0))) AS terms,
        least(1, coalesce(a.hooks_dot / nullif(s.hooks_dot, 0), 0)) AS hooks,
        coalesce((${json(profile.niches)}::jsonb ->> c.niche)::float8, 0) / ${top(profile.niches)} AS label,
        coalesce((${json(profile.subNiches)}::jsonb ->> c.sub_niche)::float8, 0) / ${top(profile.subNiches)} AS sub_label,
        1 - abs(a.short_share - ${profile.shortShare}::float8) AS shorts,
        CASE WHEN ${profile.medianDuration}::float8 IS NULL OR a.median_duration IS NULL THEN 0.5
          ELSE greatest(0, 1 - abs(ln(a.median_duration / ${profile.medianDuration}::float8)) / ln(4)) END AS duration,
        -- Same order of magnitude of subscribers.
        greatest(0, 1 - abs(ln(greatest(c.subscriber_count, 1)::float8 / ${subs}::float8)) / ln(100::float8)) AS size,
        ${profile.lang}::text IS NULL OR c.lang = ${profile.lang} AS same_lang
      FROM agg a
      JOIN candidates c ON c.id = a.channel_id
      LEFT JOIN src s ON true
      WHERE a.channel_id <> ${channel.id}
    ),
    -- What the channel is about first (niche, sub-niche, terms), then how it makes videos (style, hooks, format,
    -- duration, size), which only fully counts for channels on the same topics. Another language costs 45 %.
    scored AS (
      SELECT f.*, (CASE WHEN same_lang THEN 1 ELSE 0.55 END) * (
          topic_score + (0.3 + 0.7 * least(1, topic_score / 4)) * (
            trust * 0.5 * hooks + shorts + 0.5 * duration + 0.3 * size
          )
        ) AS score
      FROM (
        SELECT *, trust * (2 * topic + 2 * sub_topic + 4 * terms + 2 * style) + 0.5 * label + 0.5 * sub_label AS topic_score FROM fits
      ) f
    ),
    best AS (
      SELECT * FROM scored ORDER BY score DESC NULLS LAST LIMIT ${SIMILAR_LIMIT * 3}
    )
    -- Each top channel with its video closest to the profile.
    SELECT b.*, bv.youtube_video_id AS video_id, bv.title AS video_title, bv.thumbnail_url AS video_thumbnail,
      bv.view_count AS video_views, bv.outlier_multiplier AS video_multiplier, bv.published_at AS video_published_at,
      bv.is_short AS video_is_short, bv.video_score
    FROM best b
    LEFT JOIN LATERAL (
      SELECT v.*,
        2 * v.p_niche / ${top(profile.niches)} + 1.5 * v.p_sub / ${top(profile.subNiches)} + v.p_format / ${top(profile.formats)}
        + 2.5 * least(1, (SELECT coalesce(sum(t.w), 0) FROM terms t WHERE t.i = ANY(v.matched)))
        + (CASE WHEN v.is_short = ${!longForm} THEN 1 ELSE 0 END)
        + 0.5 * least(1, ln(1 + greatest(coalesce(v.outlier_multiplier, 0), 0)) / ln(11)) AS video_score
      FROM vids v WHERE v.channel_id = b.id
      ORDER BY video_score DESC, v.view_count DESC NULLS LAST
      LIMIT 1
    ) bv ON true
    ORDER BY b.score DESC NULLS LAST`;

  const niche = topNiches[0] ?? null;
  const items = rows.slice(0, SIMILAR_LIMIT).map((r) => ({
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
    niche: NICHE_BY_ID[r.niche]?.label ?? null,
    subNiche: SUB_NICHE_BY_ID[r.sub_niche]?.label ?? null,
    sampleVideo: r.video_id ? { id: r.video_id, title: r.video_title } : null,
  }));
  // Similar videos: the closest video of each top channel, the channel's own rank counting too.
  const bestScore = Number(rows[0]?.score) || 1;
  const videos = rows
    .filter((r) => r.video_id)
    .map((r) => ({ r, rank: Number(r.video_score) + 2 * (Number(r.score) / bestScore) }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, SIMILAR_VIDEOS)
    .map(({ r }) => ({
      id: r.video_id,
      title: r.video_title,
      thumbnail: r.video_thumbnail || `https://i.ytimg.com/vi/${r.video_id}/hqdefault.jpg`,
      views: Number(r.video_views ?? 0),
      multiplier: num(r.video_multiplier),
      publishedAt: new Date(r.video_published_at).toISOString(),
      isShort: Boolean(r.video_is_short),
      channelId: r.youtube_channel_id,
      channelName: r.name,
    }));

  res.json({
    keywords: profile.terms.slice(0, 10).map((t) => t.term),
    niche: niche
      ? {
          id: niche,
          label: NICHE_BY_ID[niche].label,
          subNiche: profileJson.subNiches.find((s) => NICHE_BY_ID[niche].subNiches.some((x) => x.id === s.id))?.label ?? null,
        }
      : null,
    profile: profileJson,
    items,
    videos,
  });
}

const TERMINATED_SORTS = {
  recent: sql`c.terminated_at DESC, c.subscriber_count DESC NULLS LAST`,
  subscribers: sql`c.subscriber_count DESC NULLS LAST, c.terminated_at DESC`,
  views: sql`c.total_views DESC NULLS LAST, c.terminated_at DESC`,
};

/**
 * Terminated channels: YouTube no longer returns them (worker's "terminated" job).
 * Everything shown is what the database kept from before. ?q=… &niche=… &sort=recent|subscribers|views &page=0
 */
export async function terminatedChannels(req, res) {
  const sort = Object.hasOwn(TERMINATED_SORTS, req.query.sort) ? req.query.sort : "recent";
  const q = String(req.query.q ?? "").trim().slice(0, 100);
  const niche = NICHE_BY_ID[req.query.niche] ? req.query.niche : null;
  const { page, limit, offset } = parsePage(req.query, PAGE_SIZE);
  const where = sql`
    c.terminated_at IS NOT NULL
    ${q ? sql`AND (c.name ILIKE ${"%" + q + "%"} OR c.handle ILIKE ${"%" + q + "%"})` : sql``}
    ${niche ? sql`AND c.niche = ${niche}` : sql``}`;

  const [rows, [{ total }]] = await Promise.all([
    sql`
      SELECT c.id, c.youtube_channel_id, c.name, c.handle, c.thumbnail_url, c.subscriber_count, c.total_views,
        c.video_count, c.median_views, c.niche, c.sub_niche, c.lang, c.country, c.channel_created_at, c.terminated_at,
        last.youtube_video_id AS last_video_id, last.title AS last_title, last.thumbnail_url AS last_thumbnail,
        last.view_count AS last_views, last.published_at AS last_published_at, last.is_short AS last_is_short
      FROM channels c
      LEFT JOIN LATERAL (
        SELECT youtube_video_id, title, thumbnail_url, view_count, published_at, is_short
        FROM videos v WHERE v.channel_id = c.id ORDER BY published_at DESC LIMIT 1
      ) last ON true
      WHERE ${where}
      ORDER BY ${TERMINATED_SORTS[sort]}
      LIMIT ${limit} OFFSET ${offset}`,
    sql`SELECT count(*)::int AS total FROM channels c WHERE ${where}`,
  ]);

  res.json({
    total,
    page,
    hasMore: offset + rows.length < total,
    sort,
    items: rows.map((r) => ({
      id: r.youtube_channel_id,
      name: r.name,
      handle: r.handle ?? null,
      avatar: r.thumbnail_url ?? null,
      subscribers: num(r.subscriber_count),
      totalViews: num(r.total_views),
      totalVideos: num(r.video_count),
      medianViews: num(r.median_views),
      niche: r.niche ?? null,
      subNiche: r.sub_niche ?? null,
      language: r.lang ?? null,
      country: r.country ?? null,
      createdAt: iso(r.channel_created_at),
      terminatedAt: iso(r.terminated_at),
      lastVideo: r.last_video_id
        ? {
            id: r.last_video_id,
            title: r.last_title,
            thumbnail: r.last_thumbnail || `https://i.ytimg.com/vi/${r.last_video_id}/hqdefault.jpg`,
            views: Number(r.last_views),
            publishedAt: iso(r.last_published_at),
            isShort: Boolean(r.last_is_short),
          }
        : null,
    })),
  });
}
