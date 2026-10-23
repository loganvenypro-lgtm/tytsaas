import { sql } from "../lib/sql.js";
import { applyFilters } from "../lib/filterSpec.js";
import { VIDEO_COLUMNS, toVideoJson } from "../lib/videoRows.js";
import { embedImages, embedTexts, fetchThumbnail, thumbnailUrl } from "../lib/clip.js";
import { backend, coverage, nearest, storedVectors, storeVectors } from "../lib/similarVideos.js";
import { VIDEO_SPEC } from "./videos.js";

const MODES = ["thumbnail", "title", "topic", "channel"];
const PAGE_SIZE = 48;

/** An 11-character video id from an id or any youtube.com / youtu.be link. */
export function parseVideoId(input) {
  const text = String(input ?? "").trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  const match = text.match(/(?:[?&]v=|youtu\.be\/|\/shorts\/|\/live\/|\/embed\/)([\w-]{11})/);
  return match?.[1] ?? null;
}

/**
 * Among the neighbours, outliers first without letting a loose match jump ahead:
 * similarity rescaled to 0-1 over this result set, plus 0.1 per doubling of the
 * outlier score (64x at most, 0.25x at least), so a 8x video passes a 1x one
 * that is up to 30% of the set's similarity spread closer.
 */
function byPerformance(items) {
  const sims = items.map((i) => i.similarity);
  const min = Math.min(...sims);
  const spread = Math.max(...sims) - min || 1;
  const rank = (i) => (i.similarity - min) / spread + 0.1 * Math.log2(Math.min(Math.max(i.multiplier ?? 1, 0.25), 64));
  const ranks = new Map(items.map((i) => [i, rank(i)]));
  return (a, b) => ranks.get(b) - ranks.get(a);
}

/** Title and channel of a video that isn't in the base, from YouTube's oEmbed (free, no quota). */
async function oembed(videoId) {
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!res?.ok) return null;
  return res.json();
}

/** The video to compare with, and its vectors (computed now if the worker hasn't yet). */
async function resolveSource(videoId) {
  const [row] = await sql`
    select ${VIDEO_COLUMNS}, v.channel_id
    from videos v join channels c on c.id = v.channel_id
    where v.youtube_video_id = ${videoId}`;
  let video = row ? toVideoJson(row) : null;
  if (!video) {
    const info = await oembed(videoId);
    if (!info) return null;
    video = { id: videoId, title: info.title, thumbnail: thumbnailUrl(videoId), channel: { id: null, name: info.author_name, handle: null, avatar: null } };
  }

  let vectors = row ? await storedVectors(videoId) : null;
  if (!vectors) {
    const image = await fetchThumbnail(videoId);
    const [[thumbnail], [title]] = await Promise.all([embedImages(image ? [image] : []), embedTexts([video.title ?? ""])]);
    vectors = { thumbnail: thumbnail ?? null, title };
    if (row) await storeVectors(videoId, vectors);
  }
  return { video, inBase: Boolean(row), channelRowId: row?.channel_id ?? null, vectors };
}

/**
 * Similar videos: the nearest CLIP neighbours of a video (?video=id or link) or of
 * a typed concept (?q=), then sorted by performance (outlier score) by default.
 *   by=thumbnail  thumbnails that look alike (default)
 *   by=title      titles that mean the same thing
 *   by=topic      both at once
 *   by=channel    the same channel's videos, closest thumbnails first
 * The usual video filters apply (format, language, niche…), over every date by default.
 */
export async function similarVideos(req, res) {
  const by = MODES.includes(req.query.by) ? req.query.by : "thumbnail";
  const sort = req.query.sort === "similarity" ? "similarity" : "performance";
  const text = String(req.query.q ?? "").trim().slice(0, 200);
  const videoId = parseVideoId(req.query.video);
  if (!videoId && !text) return res.status(400).json({ error: "Indique une vidéo ou un sujet." });

  // Not the list pages' defaults: any date, every video (not only quality outliers), no title search.
  const { q: _q, ...filterQuery } = req.query;
  const { where: filters, applied } = applyFilters(VIDEO_SPEC, { period: "all", relevant: "false", ...filterQuery });

  let source = null;
  let query;
  let where = filters;
  if (videoId) {
    source = await resolveSource(videoId);
    if (!source) return res.status(404).json({ error: "Vidéo introuvable." });
    const { thumbnail, title } = source.vectors;
    if (by !== "title" && !thumbnail) return res.status(422).json({ error: "Cette vidéo n'a pas de miniature." });
    query = by === "title" ? { title } : by === "topic" ? { thumbnail, title } : { thumbnail };
    where = sql`${where} and v.youtube_video_id <> ${videoId}`;
    if (by === "channel") {
      if (!source.channelRowId) return res.status(422).json({ error: "Cette chaîne n'est pas encore dans la base." });
      where = sql`${where} and v.channel_id = ${source.channelRowId}`;
    }
  } else {
    // A typed concept: CLIP puts it in the same space as thumbnails and titles.
    const [vector] = await embedTexts([text]);
    query = by === "title" ? { title: vector } : by === "topic" ? { thumbnail: vector, title: vector } : { thumbnail: vector };
  }

  const limit = Math.min(Math.max(Number(req.query.limit) || PAGE_SIZE, 1), 96);
  const neighbours = await nearest(query, where, limit);
  const similarity = new Map(neighbours.map((n) => [n.id, Number(n.similarity)]));
  const rows = neighbours.length
    ? await sql`
        select ${VIDEO_COLUMNS}
        from videos v join channels c on c.id = v.channel_id
        where v.youtube_video_id = any(${[...similarity.keys()]}::text[])`
    : [];

  const items = rows.map((r) => ({ ...toVideoJson(r), similarity: similarity.get(r.youtube_video_id) }));
  items.sort(sort === "similarity" ? (a, b) => b.similarity - a.similarity : byPerformance(items));

  const [{ name }, indexed] = await Promise.all([backend(), coverage()]);
  res.json({
    source: source ? { ...source.video, inBase: source.inBase } : null,
    query: text || null,
    by,
    sort,
    filters: applied,
    items,
    index: { backend: name, ...indexed },
  });
}
