import { sql } from "../lib/sql.js";
import { NICHE_BY_ID } from "../lib/taxonomy/index.js";

const CACHE_MS = 60 * 60 * 1000;
let cached = null;

// Uploads whose views don't come from their packaging (film reuploads, music, test signals,
// TV episodes) and placeholder titles are noise on a landing page.
const NOT_A_BREAKOUT = /full movie|official|#|cover|bass test|lyrics|trailer|\bmusic\b|\bM\/?V\b|highlights|S\d+E\d+|^video [\w-]+$|background|no music|screen saver/i;
// Titles outside the Latin script read as noise to a French or English-speaking visitor.
const NON_LATIN = /[^\p{Script=Latin}\p{N}\p{P}\p{Zs}\p{Sc}\p{Sm}]/u;
// Racy or tabloid topics that would cheapen the page
const RACY = /michetonn|escort|onlyfans|\bsexe?\b|sexy|porn|nude|naked|strip|prostitu|sugar ?dadd|\bpute\b|\bxxx\b/i;
const isShowcase = (title) => !NOT_A_BREAKOUT.test(title) && !NON_LATIN.test(title) && !RACY.test(title);

// English or French uploads only: romanized Hindi or Urdu titles pass the Latin check, so the
// language and the channel's country do the filtering (no regional channels on the landing).
const READABLE = sql`(v.language ILIKE 'en%' OR v.language ILIKE 'fr%'
  OR (v.language IS NULL AND c.country IN ('US', 'GB', 'CA', 'AU', 'IE', 'NZ', 'FR', 'BE', 'CH')))
  AND coalesce(c.country, '') NOT IN ('IN', 'PK', 'BD', 'NP', 'LK')`;

// What the landing shows first: independent storytelling channels (documentaries, video essays,
// commentary, the Fern or Thinker kind), not TV networks, trailers or full-length reuploads.
const NETWORK = /\b(official|news|tv|pbs|bbc|cbs|nbc|abc|cnn|fox|live|prime video|netflix|discovery|banijay|frontline|clips|itv|guardian|forces|movies?|shorts|cartoons?)\b/i;
const NOT_A_STORY = /full (documentary|episode|film|movie)|\bmovie\b|\bepisodes?\b|life update|\bvlog\b/i;
const ESSAY_FORMATS = new Set(["documentary", "video_essay", "animation", "storytime"]);
const ESSAY_NICHES = new Set(["history_documentary", "science_education", "space_astronomy", "geography_travel", "animals_nature"]);
const COMMENTARY_FORMATS = new Set(["news_commentary", "experiment"]);
/** -1 for networks, reuploads and kids' channels; up to 4 for an independent documentary or essay channel. */
function storyScore(r) {
  if (NETWORK.test(r.name) || NOT_A_STORY.test(r.title) || r.channel_niche === "family_kids") return -1;
  return (
    (ESSAY_FORMATS.has(r.primary_format) ? 2 : 0) +
    (ESSAY_NICHES.has(r.channel_niche) ? 2 : 0) +
    (COMMENTARY_FORMATS.has(r.primary_format) || r.channel_niche === "creators_streamers" || r.channel_niche === "true_crime" ? 1 : 0)
  );
}
/** Best storytelling channels first; equal scores keep their relevance order. */
const storiesFirst = (rows) => rows.map((r) => ({ r, s: storyScore(r) })).sort((a, b) => b.s - a.s).map(({ r }) => r);
/** At most `cap` rows per channel niche up front, so one genre (police footage) cannot fill the page; the rest follow. */
function diversify(rows, cap) {
  const count = new Map();
  const head = [];
  const tail = [];
  for (const r of rows) {
    const key = r.channel_niche ?? r.niche ?? "other";
    const n = count.get(key) ?? 0;
    if (n < cap) {
      count.set(key, n + 1);
      head.push(r);
    } else tail.push(r);
  }
  return [...head, ...tail];
}

const toLandingVideo = (r) => ({
  id: r.youtube_video_id,
  title: r.title,
  thumbnail: r.thumbnail_url || `https://i.ytimg.com/vi/${r.youtube_video_id}/hqdefault.jpg`,
  channelTitle: r.name,
  channelAvatar: r.avatar ?? null,
  channelSubscribers: Number(r.subscriber_count ?? 0),
  viewCount: Number(r.view_count),
  outlierMultiplier: Number(r.outlier_multiplier),
  publishedAt: new Date(r.published_at).toISOString(),
  duration: r.duration_formatted ?? "",
});

/** Relevant long-form outliers (scored by the worker), the best video of each channel, best first. Music is left out. */
const outliers = (where, limit) => sql`
  SELECT * FROM (
    SELECT DISTINCT ON (c.id)
      v.youtube_video_id, v.title, v.thumbnail_url, v.published_at, v.view_count, v.outlier_multiplier,
      v.duration_formatted, v.niche, v.relevance_score, c.name, c.thumbnail_url AS avatar, c.subscriber_count,
      c.primary_format, c.niche AS channel_niche
    FROM videos v JOIN channels c ON c.id = v.channel_id
    WHERE NOT v.is_short AND v.duration_seconds >= 180 AND v.relevance_score IS NOT NULL
      AND v.niche IS DISTINCT FROM 'music' AND ${READABLE} AND ${where}
    ORDER BY c.id, v.relevance_score DESC
  ) best
  ORDER BY relevance_score DESC
  LIMIT ${limit}`;

async function load() {
  const [stats] = await sql`
    SELECT
      (SELECT count(*) FROM videos)::int AS videos,
      (SELECT count(*) FROM channels)::int AS channels,
      (SELECT coalesce(sum(view_count), 0) FROM videos)::float8 AS views,
      (SELECT count(*) FROM videos WHERE relevance_score IS NOT NULL AND outlier_multiplier >= 10)::int AS "bigOutliers",
      (SELECT count(*) FROM videos WHERE published_at > now() - interval '7 days')::int AS "freshWeek",
      (SELECT max(finished_at) FROM scan_runs WHERE status = 'ok') AS "updatedAt"`;

  // Wall and showcase: believable multipliers on videos people actually watched
  const wall = (await outliers(sql`v.view_count >= 50000 AND v.outlier_multiplier BETWEEN 3 AND 300 AND c.subscriber_count >= 10000`, 200)).filter(
    (r) => isShowcase(r.title) && storyScore(r) >= 0
  );
  const showcase = diversify(storiesFirst(wall), 3).map((r) => ({ ...toLandingVideo(r), niche: r.niche }));

  // Proof: recent breakouts from channels under 100k subscribers, storytelling channels only when there are enough
  const candidates = (
    await outliers(
      sql`c.subscriber_count BETWEEN 1000 AND 100000 AND v.outlier_multiplier BETWEEN 10 AND 500
        AND v.view_count >= 100000 AND v.published_at > now() - interval '120 days'`,
      60
    )
  ).filter((r) => isShowcase(r.title) && storyScore(r) >= 0);
  const stories = candidates.filter((r) => storyScore(r) >= 1);
  const breakouts = diversify(stories.length >= 6 ? stories : candidates, 2)
    .slice(0, 6)
    .map(toLandingVideo);

  // Demo tabs: the niches with the most showcase videos
  const byNiche = new Map();
  for (const v of showcase) {
    if (!v.niche || !NICHE_BY_ID[v.niche]) continue;
    if (!byNiche.has(v.niche)) byNiche.set(v.niche, []);
    byNiche.get(v.niche).push(v);
  }
  const niches = [...byNiche.entries()]
    .filter(([, list]) => list.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5)
    .map(([id, list]) => ({ id, label: NICHE_BY_ID[id].label, videos: list.slice(0, 6) }));

  const videos = showcase.map(({ niche, ...v }) => v);
  const creators = [...new Map(videos.filter((v) => v.channelAvatar).map((v) => [v.channelTitle, v])).values()]
    .sort((a, b) => b.channelSubscribers - a.channelSubscribers)
    .slice(0, 24)
    .map((v) => ({ name: v.channelTitle, avatar: v.channelAvatar, subscribers: v.channelSubscribers }));

  return {
    stats: { ...stats, updatedAt: stats.updatedAt ? new Date(stats.updatedAt).toISOString() : null },
    videos: videos.slice(0, 40),
    breakouts,
    niches,
    creators,
  };
}

/** GET /api/landing: public numbers and real outliers for /welcome, cached for an hour. */
export async function landing(req, res) {
  if (!cached || Date.now() - cached.at > CACHE_MS) cached = { at: Date.now(), data: await load() };
  res.set("Cache-Control", "public, max-age=600");
  res.json(cached.data);
}
