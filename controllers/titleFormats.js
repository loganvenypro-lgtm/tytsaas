import { sql } from "../lib/sql.js";
import { parsePage } from "../lib/filterSpec.js";
import { mineTitleFormats } from "../lib/titleFormats.js";
import { VIDEO_COLUMNS, toVideoJson } from "../lib/videoRows.js";

const PAGE_SIZE = 8;
const EXAMPLES = 5;
const MAX_VIDEOS = 200;
// Mining reads every title of the year (~5 s); formats barely move within a few hours.
const TTL_MS = 6 * 60 * 60 * 1000;

let cache = null;
let building = null;

async function build() {
  const rows = await sql`
    SELECT youtube_video_id, title, channel_id, outlier_multiplier, view_count, published_at, title_hooks, lang
    FROM videos
    WHERE published_at > now() - interval '365 days' AND NOT is_livestream AND title IS NOT NULL`;
  const videos = rows.map((r) => ({
    id: r.youtube_video_id,
    title: r.title,
    channelId: r.channel_id,
    multiplier: r.outlier_multiplier != null ? Number(r.outlier_multiplier) : null,
    views: Number(r.view_count ?? 0),
    publishedAt: new Date(r.published_at),
    hooks: r.title_hooks ?? [],
    lang: r.lang,
  }));
  const { formats } = mineTitleFormats(videos);
  return { formats, byId: new Map(formats.map((f) => [f.id, f])), builtAt: new Date().toISOString() };
}

/** The mined formats; a stale cache is served while the next one builds. */
async function formats() {
  const fresh = cache && Date.now() - Date.parse(cache.builtAt) < TTL_MS;
  if (!fresh && !building) {
    building = build()
      .then((next) => (cache = next))
      .finally(() => (building = null));
  }
  return cache ?? building;
}

const SORTS = {
  boost: (a, b) => b.boost - a.boost,
  popular: (a, b) => b.channelCount - a.channelCount || b.videoCount - a.videoCount,
  recent: (a, b) => b.latestAt.localeCompare(a.latestAt),
};

async function videosById(ids) {
  if (!ids.length) return new Map();
  const rows = await sql`
    SELECT ${VIDEO_COLUMNS}
    FROM videos v JOIN channels c ON c.id = v.channel_id
    WHERE v.youtube_video_id = ANY(${ids})`;
  return new Map(rows.map((r) => [r.youtube_video_id, toVideoJson(r)]));
}

/**
 * GET /api/formats?q=&lang=&sort=boost|popular|recent&page=
 * Title formats, each with its first examples, trend and click drivers.
 */
export async function list(req, res) {
  const { formats: all, builtAt } = await formats();
  const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
  const lang = typeof req.query.lang === "string" && /^[a-z]{2}$/.test(req.query.lang) ? req.query.lang : null;
  const sort = SORTS[req.query.sort] ?? SORTS.boost;
  const { page, limit, offset } = parsePage(req.query, PAGE_SIZE);

  const matching = all.filter((f) => (!q || f.formula.toLowerCase().includes(q)) && (!lang || f.lang === lang));
  const slice = [...matching].sort(sort).slice(offset, offset + limit);
  const videos = await videosById(slice.flatMap((f) => f.examples.slice(0, EXAMPLES).map((e) => e.id)));

  // Languages with formats, most first, for the filter
  const langCounts = new Map();
  for (const f of all) langCounts.set(f.lang, (langCounts.get(f.lang) ?? 0) + 1);

  res.json({
    items: slice.map(({ examples, ...f }) => ({
      ...f,
      examples: examples
        .slice(0, EXAMPLES)
        .filter((e) => videos.has(e.id))
        .map((e) => ({ slot: e.slot, video: videos.get(e.id) })),
    })),
    total: matching.length,
    page,
    hasMore: offset + limit < matching.length,
    updatedAt: builtAt,
    languages: [...langCounts].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count })),
  });
}

/** GET /api/formats/:formatId/videos: every video using the format, best multiplier first. */
export async function videos(req, res) {
  const { byId } = await formats();
  const format = byId.get(req.params.formatId);
  if (!format) return res.status(404).json({ error: "Format introuvable." });
  const examples = format.examples.slice(0, MAX_VIDEOS);
  const found = await videosById(examples.map((e) => e.id));
  res.json({
    format: { id: format.id, formula: format.formula, prefix: format.prefix, suffix: format.suffix },
    items: examples.filter((e) => found.has(e.id)).map((e) => ({ slot: e.slot, video: found.get(e.id) })),
  });
}
