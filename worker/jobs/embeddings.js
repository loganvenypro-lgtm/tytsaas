/**
 * CLIP embeddings of thumbnails and titles for "Similar videos" (local model,
 * thumbnails from i.ytimg.com: no quota). A few hundred videos per tick within
 * a time cap, so the backlog fills over days without holding up the other jobs.
 * Quality outliers first, newest first: they are the ones the app shows.
 * A video is embedded again when its thumbnail or title changes (A/B tests).
 */
import { sql } from "../../lib/sql.js";
import { CLIP_MODEL, embedImages, embedTexts, fetchThumbnail } from "../../lib/clip.js";
import { chunk, mapLimit } from "../../lib/youtube.js";
import { CONFIG } from "../config.js";

// text[] of '{…}' literals: unnest can't take an array of arrays.
const toLiteral = (vector) => (vector ? `{${Array.from(vector).join(",")}}` : null);

export async function runEmbeddings() {
  const stats = { embedded: 0, missingThumbnails: 0, failed: 0, stoppedEarly: false, backlog: 0 };
  const deadline = Date.now() + CONFIG.embedMaxSeconds * 1000;

  const videos = await sql`
    select v.youtube_video_id as id, v.title, v.thumbnail_variants, v.title_variants
    from videos v
    left join video_embeddings e on e.youtube_video_id = v.youtube_video_id
    where e.youtube_video_id is null
       or e.model <> ${CLIP_MODEL}
       or e.thumbnail_version is distinct from v.thumbnail_variants
       or e.title_version is distinct from v.title_variants
    order by e.youtube_video_id is not null, v.relevance_score is null, v.published_at desc
    limit ${CONFIG.embedMaxPerTick}`;

  for (const batch of chunk(videos, CONFIG.embedBatch)) {
    if (Date.now() > deadline) {
      stats.stoppedEarly = true;
      break;
    }
    const images = new Map();
    const failed = new Set();
    await mapLimit(batch, 8, async (video) => {
      try {
        const image = await fetchThumbnail(video.id);
        if (image) images.set(video.id, image);
        else stats.missingThumbnails++;
      } catch {
        failed.add(video.id);
        stats.failed++;
      }
    });
    // A failed download is retried next tick; a missing thumbnail (404) is stored as null.
    const rows = batch.filter((v) => !failed.has(v.id));
    if (!rows.length) continue;

    const withImage = rows.filter((v) => images.has(v.id));
    const [thumbs, titles] = await Promise.all([
      embedImages(withImage.map((v) => images.get(v.id))),
      embedTexts(rows.map((v) => v.title ?? "")),
    ]);
    const thumbById = new Map(withImage.map((v, i) => [v.id, thumbs[i]]));

    await sql`
      insert into video_embeddings (youtube_video_id, model, thumbnail, title, thumbnail_version, title_version, embedded_at)
      select r.id, ${CLIP_MODEL}, r.thumbnail::real[], r.title::real[], r.thumbnail_version, r.title_version, now()
      from unnest(
        ${rows.map((v) => v.id)}::text[],
        ${rows.map((v) => toLiteral(thumbById.get(v.id)))}::text[],
        ${titles.map(toLiteral)}::text[],
        ${rows.map((v) => v.thumbnail_variants)}::smallint[],
        ${rows.map((v) => v.title_variants)}::smallint[]
      ) as r(id, thumbnail, title, thumbnail_version, title_version)
      on conflict (youtube_video_id) do update set
        model = excluded.model, thumbnail = excluded.thumbnail, title = excluded.title,
        thumbnail_version = excluded.thumbnail_version, title_version = excluded.title_version,
        embedded_at = excluded.embedded_at`;
    stats.embedded += rows.length;
  }

  const [{ count }] = await sql`
    select count(*)::int as count from videos v
    where not exists (select 1 from video_embeddings e where e.youtube_video_id = v.youtube_video_id)`;
  stats.backlog = count;
  return stats;
}
