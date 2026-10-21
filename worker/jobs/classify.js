/**
 * Niche, sub-niche, format, title hooks and language for every video and
 * channel (local, no quota). Channels first, from their last 60 uploads and
 * their about text / topics; then their videos, using the channel as a prior.
 * Rows are reclassified when CLASSIFIER_VERSION changes or their title/tags change.
 */
import { sql } from "../../lib/sql.js";
import { classifyChannel, classifyVideo, detectFormat, normalizeLanguage } from "../../lib/classifier.js";
import { CLASSIFIER_VERSION } from "../../lib/taxonomy/index.js";
import { chunk } from "../../lib/youtube.js";
import { CONFIG } from "../config.js";

export async function runClassify({ full = false } = {}) {
  const stats = { channels: 0, videos: 0 };
  const limit = full ? 1_000_000 : CONFIG.classifyBatch;

  // 1. Channels: new, outdated, or whose content may have drifted.
  const channels = await sql`
    select id, name, description, keywords, topic_categories
    from channels
    where classifier_version is distinct from ${CLASSIFIER_VERSION}
       or classified_at is null
       or classified_at < now() - make_interval(days => ${CONFIG.channelReclassifyDays})
    order by classified_at nulls first
    limit ${full ? 1_000_000 : Math.ceil(limit / 4)}`;
  for (const batch of chunk(channels, 200)) {
    stats.channels += await classifyChannels(batch);
  }

  // 2. Videos, with their channel's classification.
  for (;;) {
    const videos = await sql`
      select v.id, v.title, v.description, v.tags, v.topic_categories, v.category_id, v.duration_seconds,
        v.is_short, v.is_livestream, v.language,
        c.niche as c_niche, c.sub_niche as c_sub_niche, c.niche_confidence as c_confidence, c.lang as c_lang
      from videos v
      left join channels c on c.id = v.channel_id
      where v.classifier_version is distinct from ${CLASSIFIER_VERSION}
      order by v.published_at desc
      limit ${Math.min(limit - stats.videos, 5000)}`;
    if (!videos.length) break;

    const rows = videos.map((v) => {
      const result = classifyVideo(
        {
          title: v.title,
          description: v.description,
          tags: v.tags,
          topics: v.topic_categories,
          categoryId: v.category_id,
          durationSeconds: v.duration_seconds,
          isShort: v.is_short,
          isLivestream: v.is_livestream,
          language: v.language,
        },
        v.c_niche ? { niche: v.c_niche, subNiche: v.c_sub_niche, confidence: v.c_confidence, lang: v.c_lang } : { lang: v.c_lang },
      );
      return { id: v.id, ...result };
    });
    await writeVideos(rows);
    stats.videos += rows.length;
    if (stats.videos >= limit) break;
  }
  return stats;
}

async function classifyChannels(channels) {
  const ids = channels.map((c) => c.id);
  const videos = await sql`
    select channel_id, title, tags, category_id, duration_seconds, is_short, is_livestream, language, lang, format
    from (
      select v.*, row_number() over (partition by channel_id order by published_at desc) as rank
      from videos v
      where channel_id in ${sql(ids)}
    ) recent
    where rank <= 60`;
  const byChannel = new Map();
  for (const v of videos) {
    if (!byChannel.has(v.channel_id)) byChannel.set(v.channel_id, []);
    byChannel.get(v.channel_id).push({
      title: v.title,
      tags: v.tags,
      categoryId: v.category_id,
      isShort: v.is_short,
      lang: normalizeLanguage(v.language) ?? v.lang,
      format: v.format ?? detectFormat({ title: v.title, tags: v.tags, durationSeconds: v.duration_seconds, isShort: v.is_short, isLivestream: v.is_livestream, categoryId: v.category_id }),
    });
  }

  const rows = channels.map((c) => {
    const result = classifyChannel({
      name: c.name,
      description: c.description,
      keywords: c.keywords,
      topics: c.topic_categories,
      videos: byChannel.get(c.id) ?? [],
    });
    return { id: c.id, ...result };
  });

  await sql`
    update channels c set
      niche = r.niche,
      sub_niche = r.sub_niche,
      niche_confidence = r.confidence,
      primary_format = r.primary_format,
      lang = r.lang,
      category_id = coalesce(r.category_id, c.category_id),
      short_share = r.short_share,
      classifier_version = ${CLASSIFIER_VERSION},
      classified_at = now()
    from unnest(
      ${rows.map((r) => r.id)}::text[],
      ${rows.map((r) => r.niche)}::text[],
      ${rows.map((r) => r.subNiche)}::text[],
      ${rows.map((r) => r.confidence)}::real[],
      ${rows.map((r) => r.primaryFormat)}::text[],
      ${rows.map((r) => r.lang)}::text[],
      ${rows.map((r) => r.categoryId)}::smallint[],
      ${rows.map((r) => r.shortShare)}::real[]
    ) as r(id, niche, sub_niche, confidence, primary_format, lang, category_id, short_share)
    where c.id = r.id`;
  return rows.length;
}

async function writeVideos(rows) {
  // text[][] can't hold ragged arrays: hooks travel as comma-joined strings.
  await sql`
    update videos v set
      niche = r.niche,
      sub_niche = r.sub_niche,
      niche_confidence = r.confidence,
      format = r.format,
      title_hooks = case when r.hooks = '' then '{}'::text[] else string_to_array(r.hooks, ',') end,
      lang = r.lang,
      classifier_version = ${CLASSIFIER_VERSION}
    from unnest(
      ${rows.map((r) => r.id)}::text[],
      ${rows.map((r) => r.niche)}::text[],
      ${rows.map((r) => r.subNiche)}::text[],
      ${rows.map((r) => r.confidence)}::real[],
      ${rows.map((r) => r.format)}::text[],
      ${rows.map((r) => r.hooks.join(","))}::text[],
      ${rows.map((r) => r.lang)}::text[]
    ) as r(id, niche, sub_niche, confidence, format, hooks, lang)
    where v.id = r.id`;
}
