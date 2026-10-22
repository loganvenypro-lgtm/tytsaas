/**
 * Thumbnail A/B tests and post-publish changes (free, thumbnail CDN).
 * The ETag of i.ytimg.com is the Unix time the current thumbnail was set, so a
 * new ETag means the creator changed it or a "Test & Compare" run swapped it.
 * Each version's 320x180 picture is saved when first seen: YouTube only serves
 * the current one. Title changes come from the stats refresh (video_variants).
 *
 * Checked: recent videos of channels that matter (relevant outliers, tracked
 * or trending), more often in the first 48 hours when tests usually run.
 */
import { sql } from "../../lib/sql.js";
import { thumbnailEtag, thumbnailImage, mapLimit } from "../../lib/youtube.js";
import { CONFIG } from "../config.js";

export async function runAbTests() {
  const stats = { checked: 0, newVariants: 0, imagesSaved: 0, failed: 0 };
  const videos = await sql`
    select v.youtube_video_id
    from videos v
    join channels c on c.id = v.channel_id
    left join tracked_channels tc on tc.channel_id = c.youtube_channel_id
    where v.published_at > now() - make_interval(days => ${CONFIG.abWindowDays})
      and (v.relevance_score is not null or tc.channel_id is not null or c.trend_score >= 40
           or coalesce(c.subscriber_count, 0) >= 100000)
      and (
        v.thumb_checked_at is null
        or (v.published_at > now() - interval '48 hours' and v.thumb_checked_at < now() - interval '1 hour')
        or (v.published_at > now() - interval '7 days' and v.thumb_checked_at < now() - interval '4 hours')
        or v.thumb_checked_at < now() - interval '12 hours'
      )
    -- Tests run in the first 48 h and swap versions within hours: those videos and
    -- the ones already showing a change come first, so a backlog of older
    -- never-checked videos can't delay them (and their versions' pictures).
    order by (v.published_at > now() - interval '48 hours' or v.thumbnail_variants > 1) desc,
      v.thumb_checked_at nulls first, v.published_at desc
    limit ${CONFIG.abMaxPerTick}`;

  const checked = [];
  await mapLimit(videos, 8, async ({ youtube_video_id: id }) => {
    try {
      const etag = await thumbnailEtag(id);
      checked.push(id);
      if (!etag) return;
      stats.checked++;
      const setAt = /^\d{9,11}$/.test(etag) ? new Date(Number(etag) * 1000) : null;
      const [variant] = await sql`
        insert into video_variants (youtube_video_id, kind, value, set_at)
        values (${id}, 'thumbnail', ${etag}, ${setAt})
        on conflict (youtube_video_id, kind, value) do update set last_seen_at = now()
        returning (xmax = 0) as inserted, image is null as needs_image`;
      if (variant.inserted) stats.newVariants++;
      if (variant.needs_image) {
        const image = await thumbnailImage(id, etag);
        if (image) {
          await sql`
            update video_variants set image = ${image}
            where youtube_video_id = ${id} and kind = 'thumbnail' and value = ${etag}`;
          stats.imagesSaved++;
        }
      }
    } catch {
      stats.failed++;
    }
  });
  if (checked.length) {
    await sql`update videos set thumb_checked_at = now() where youtube_video_id in ${sql(checked)}`;
  }

  // Variant counts on the video row, so the API can filter A/B tests with an index.
  await sql`
    update videos v set thumbnail_variants = s.thumbs, title_variants = s.titles
    from (
      select youtube_video_id,
        greatest(1, count(*) filter (where kind = 'thumbnail' and value <> '0'))::smallint as thumbs,
        greatest(1, count(*) filter (where kind = 'title'))::smallint as titles
      from video_variants
      group by youtube_video_id
    ) s
    where v.youtube_video_id = s.youtube_video_id
      and (v.thumbnail_variants <> s.thumbs or v.title_variants <> s.titles)`;
  return stats;
}
