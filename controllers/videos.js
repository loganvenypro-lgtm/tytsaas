import { sql } from "../lib/sql.js";
import { applyFilters, applySort, parsePage } from "../lib/filterSpec.js";
import { NICHES, FORMATS, HOOKS, LANGUAGES, CATEGORIES } from "../lib/taxonomy/index.js";
import { VIDEO_COLUMNS, toVideoJson } from "../lib/videoRows.js";

const PAGE_SIZE = 24;

export function toNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

const label = (en, fr) => ({ en, fr });
const PERIODS = [
  ["24h", 24, label("Last 24 hours", "24 dernières heures")],
  ["3d", 72, label("Last 3 days", "3 derniers jours")],
  ["7d", 168, label("Last 7 days", "7 derniers jours")],
  ["30d", 720, label("Last 30 days", "30 derniers jours")],
  ["90d", 2160, label("Last 90 days", "90 derniers jours")],
  ["365d", 8760, label("Last 12 months", "12 derniers mois")],
];

export const nicheOptions = () => NICHES.map((n) => ({ value: n.id, label: n.label }));
export const subNicheOptions = () =>
  NICHES.flatMap((n) => n.subNiches.map((s) => ({ value: s.id, label: s.label, parent: n.id })));
export const formatOptions = () => FORMATS.map((f) => ({ value: f.id, label: f.label }));
export const languageOptions = () => Object.entries(LANGUAGES).map(([value, l]) => ({ value, label: l }));
export const categoryOptions = () => Object.entries(CATEGORIES).map(([value, l]) => ({ value: Number(value), label: l }));
const values = (options) => () => options().map((o) => o.value);

// Hindi, Bhojpuri, Bengali, Telugu, Tamil, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese.
const INDIAN_LANGS = ["hi", "bh", "bn", "te", "ta", "mr", "gu", "kn", "ml", "pa", "or", "as"];
const channelAgeDays =sql`extract(epoch from now() - c.channel_created_at) / 86400`;

/** Everything the video lists can be filtered and sorted by. */
export const VIDEO_SPEC = {
  filters: [
    {
      key: "q",
      type: "text",
      label: label("Search", "Recherche"),
      where: (text) => sql`(v.title ilike ${"%" + text + "%"} or c.name ilike ${"%" + text + "%"})`,
    },
    {
      key: "format",
      type: "choice",
      label: label("Format", "Format"),
      // Shorts' outlier scores dwarf long-form ones and would fill the top: long-form unless asked.
      default: "long",
      options: [
        { value: "all", label: label("All", "Tous") },
        { value: "long", label: label("Long-form", "Vidéos longues"), where: sql`not v.is_short` },
        { value: "short", label: label("Shorts", "Shorts"), where: sql`v.is_short` },
      ],
    },
    {
      key: "period",
      type: "choice",
      label: label("Published", "Publiée"),
      default: "7d",
      options: [
        ...PERIODS.map(([value, hours, l]) => ({
          value,
          label: l,
          where: sql`v.published_at > now() - make_interval(hours => ${hours})`,
        })),
        { value: "all", label: label("Any time", "Toutes les dates") },
      ],
    },
    { key: "niche", type: "enum", label: label("Niche", "Niche"), column: sql`v.niche`, options: nicheOptions, values: values(nicheOptions) },
    { key: "subNiche", type: "enum", label: label("Sub-niche", "Sous-niche"), column: sql`v.sub_niche`, options: subNicheOptions, values: values(subNicheOptions) },
    { key: "style", type: "enum", label: label("Video style", "Style de vidéo"), column: sql`v.format`, options: formatOptions, values: values(formatOptions) },
    {
      key: "hooks",
      type: "tags",
      label: label("Title hooks", "Accroches du titre"),
      column: sql`v.title_hooks`,
      options: () => HOOKS.map((h) => ({ value: h.id, label: h.label })),
      values: () => HOOKS.map((h) => h.id),
    },
    { key: "language", type: "enum", label: label("Language", "Langue"), column: sql`v.lang`, options: languageOptions, values: values(languageOptions) },
    { key: "country", type: "enum", label: label("Channel country", "Pays de la chaîne"), column: sql`c.country`, pattern: /^[A-Z]{2}$/ },
    {
      key: "category",
      type: "enum",
      numeric: true,
      label: label("YouTube category", "Catégorie YouTube"),
      column: sql`v.category_id`,
      options: categoryOptions,
      values: values(categoryOptions),
    },
    {
      key: "subs",
      type: "range",
      label: label("Channel subscribers", "Abonnés de la chaîne"),
      column: sql`c.subscriber_count`,
      presets: [
        { value: "micro", label: label("Under 10K", "Moins de 10K"), max: 10_000 },
        { value: "small", label: label("10K - 100K", "10K - 100K"), min: 10_000, max: 100_000 },
        { value: "medium", label: label("100K - 1M", "100K - 1M"), min: 100_000, max: 1_000_000 },
        { value: "large", label: label("Over 1M", "Plus de 1M"), min: 1_000_000 },
      ],
    },
    { key: "views", type: "range", label: label("Views", "Vues"), column: sql`v.view_count` },
    { key: "multiplier", type: "range", label: label("Outlier score (x normal)", "Outlier (x la normale)"), unit: "x", column: sql`v.outlier_multiplier` },
    { key: "vph", type: "range", label: label("Views per hour", "Vues par heure"), column: sql`v.views_per_hour` },
    { key: "engagement", type: "range", label: label("Engagement rate", "Taux d'engagement"), unit: "%", scale: 0.01, column: sql`v.engagement_rate` },
    { key: "duration", type: "range", label: label("Duration", "Durée"), unit: "min", scale: 60, column: sql`v.duration_seconds` },
    { key: "score", type: "range", label: label("Relevance score", "Score de pertinence"), unit: "/100", column: sql`v.relevance_score` },
    { key: "channelAge", type: "range", label: label("Channel age", "Âge de la chaîne"), unit: "days", column: channelAgeDays },
    {
      key: "relevant",
      type: "bool",
      label: label("Quality outliers only", "Outliers de qualité uniquement"),
      default: true,
      where: (on) => (on ? sql`v.relevance_score is not null` : null),
    },
    {
      key: "abTest",
      type: "choice",
      label: label("A/B tests", "Tests A/B"),
      default: "all",
      options: [
        { value: "all", label: label("All videos", "Toutes les vidéos") },
        { value: "any", label: label("Title or thumbnail changed", "Titre ou miniature modifié"), where: sql`(v.thumbnail_variants > 1 or v.title_variants > 1)` },
        { value: "thumbnail", label: label("Thumbnail tests", "Tests de miniature"), where: sql`v.thumbnail_variants > 1` },
        { value: "title", label: label("Title changes", "Changements de titre"), where: sql`v.title_variants > 1` },
      ],
    },
    {
      key: "includeLive",
      type: "bool",
      label: label("Include live streams", "Inclure les lives"),
      default: false,
      where: (on) => (on ? null : sql`not v.is_livestream`),
    },
    {
      key: "excludeKids",
      type: "bool",
      label: label("Hide made-for-kids", "Masquer le contenu enfants"),
      default: false,
      where: (on) => (on ? sql`v.made_for_kids is not true` : null),
    },
    {
      // Songs, clips and playlists from artists and labels. Beats and music reviews are creators' work: kept.
      key: "excludeMusic",
      type: "bool",
      label: label("Hide music channels", "Masquer les chaînes musique"),
      default: true,
      where: (on) =>
        on
          ? sql`not ((coalesce(v.niche, '') = 'music' and coalesce(v.sub_niche, '') not in ('music_production', 'music_commentary'))
              or coalesce(v.category_id, 0) = 10 or coalesce(v.format, '') = 'music_video')`
          : null,
    },
    {
      // Old Indian videos crowd the tops. Many of these channels have no country and Hinglish titles
      // get odd languages, so an Indian script in the title counts too.
      key: "excludeIndia",
      type: "bool",
      label: label("Hide Indian videos", "Masquer les vidéos indiennes"),
      default: true,
      where: (on) =>
        on
          ? sql`not (coalesce(c.country, '') = 'IN' or coalesce(v.lang, '') = any(${INDIAN_LANGS}) or v.title ~ '[ऀ-ൿ]')`
          : null,
    },
  ],
  sorts: [
    { value: "score", label: label("Relevance", "Pertinence"), orderBy: sql`v.relevance_score desc nulls last, v.outlier_multiplier desc nulls last` },
    { value: "multiplier", label: label("Outlier score", "Score outlier"), orderBy: sql`v.outlier_multiplier desc nulls last` },
    { value: "views", label: label("Most views", "Plus de vues"), orderBy: sql`v.view_count desc nulls last` },
    { value: "velocity", label: label("Fastest growing", "Croissance la plus rapide"), orderBy: sql`v.views_per_hour desc nulls last` },
    { value: "engagement", label: label("Engagement", "Engagement"), orderBy: sql`v.engagement_rate desc nulls last` },
    { value: "recent", label: label("Newest", "Plus récentes"), orderBy: sql`v.published_at desc` },
    { value: "smallChannels", label: label("Smallest channels first", "Petites chaînes d'abord"), orderBy: sql`c.subscriber_count asc nulls last, v.outlier_multiplier desc nulls last` },
  ],
  defaultSort: "score",
};

/**
 * Top Videos: videos far above their channel's usual views, filtered by niche,
 * style, hooks, audience… Reads only PostgreSQL (filled by the worker), so
 * browsing never spends YouTube quota.
 */
export async function topVideos(req, res) {
  const { where, applied } = applyFilters(VIDEO_SPEC, req.query);
  const { sort, orderBy } = applySort(VIDEO_SPEC, req.query);
  const { page, limit, offset } = parsePage(req.query, PAGE_SIZE);

  const [rows, [{ total }], languages, [lastScan]] = await Promise.all([
    sql`
      select ${VIDEO_COLUMNS}
      from videos v
      join channels c on c.id = v.channel_id
      where ${where}
      order by ${orderBy}
      limit ${limit} offset ${offset}`,
    sql`select count(*)::int as total from videos v join channels c on c.id = v.channel_id where ${where}`,
    sql`
      select lang as code, count(*)::int as count
      from videos
      where lang is not null and relevance_score is not null and published_at > now() - interval '30 days'
      group by 1
      order by 2 desc
      limit 12`,
    sql`select max(finished_at) as at from scan_runs where status = 'ok'`,
  ]);

  res.json({
    items: rows.map(toVideoJson),
    total,
    page,
    pageSize: PAGE_SIZE,
    hasMore: offset + rows.length < total,
    languages,
    filters: applied,
    sort,
    updatedAt: lastScan?.at ? new Date(lastScan.at).toISOString() : null,
  });
}

/** Title and thumbnail history of a video (A/B tests and post-publish changes). */
export async function variants(req, res) {
  const { videoId } = req.params;
  const rows = await sql`
    select kind, value, set_at, first_seen_at, last_seen_at, image is not null as has_image
    from video_variants
    where youtube_video_id = ${videoId}
    order by kind, coalesce(set_at, first_seen_at)`;
  const toIso = (d) => (d ? new Date(d).toISOString() : null);
  res.json({
    videoId,
    titles: rows
      .filter((r) => r.kind === "title")
      .map((r) => ({ title: r.value, firstSeenAt: toIso(r.first_seen_at), lastSeenAt: toIso(r.last_seen_at) })),
    thumbnails: rows
      .filter((r) => r.kind === "thumbnail" && r.value !== "0")
      .map((r) => ({
        version: r.value,
        setAt: toIso(r.set_at),
        firstSeenAt: toIso(r.first_seen_at),
        lastSeenAt: toIso(r.last_seen_at),
        image: r.has_image ? `/api/videos/${encodeURIComponent(videoId)}/thumbnails/${encodeURIComponent(r.value)}.jpg` : null,
      })),
  });
}

/** Saved picture of one thumbnail version. */
export async function thumbnailImage(req, res) {
  const { videoId, version } = req.params;
  const [row] = await sql`
    select image from video_variants
    where youtube_video_id = ${videoId} and kind = 'thumbnail' and value = ${version.replace(/\.jpg$/, "")}`;
  if (!row?.image) return res.status(404).json({ error: "Miniature introuvable." });
  res.set("Content-Type", "image/jpeg").set("Cache-Control", "private, max-age=86400").send(row.image);
}
