import { sql } from "./sql.js";
import { NICHE_BY_ID } from "./taxonomy/index.js";
import { VIDEO_COLUMNS, toVideoJson } from "./videoRows.js";
import { DIGEST_SECTIONS } from "./digestSettings.js";

const num = (value) => (value != null ? Number(value) : null);

// When each user's edition comes out (weekly or monthly, day, hour, timezone) is
// in lib/digestSettings.js.

/** How many past editions each user keeps. */
const KEEP_EDITIONS = 12;

/**
 * One user's recap over [periodStart, periodEnd) (a week or a month): their
 * channel's activity, the videos that performed best in their niche (else among
 * their competitors, else everywhere), and the channels that just appeared in it.
 * PostgreSQL only, so it never spends YouTube quota. Only `sections` are filled.
 */
export async function buildWeeklyDigest(userId, { periodStart, periodEnd }, sections = DIGEST_SECTIONS) {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const [user] = await sql`SELECT youtube_channel_id, competitor_channel_ids FROM "user" WHERE id = ${userId}`;
  const myChannelId = user?.youtube_channel_id ?? null;
  const competitorIds = (user?.competitor_channel_ids ?? []).filter((id) => id !== myChannelId);

  const [myChannel] = myChannelId
    ? await sql`SELECT id, youtube_channel_id, name, thumbnail_url, niche, sub_niche, lang FROM channels WHERE youtube_channel_id = ${myChannelId}`
    : [];
  const nicheId = myChannel?.niche && NICHE_BY_ID[myChannel.niche] ? myChannel.niche : null;
  const language = myChannel?.lang ?? null;
  const myInternalId = myChannel?.id ?? "";

  // Videos of the week by how far they beat their channel's usual views, one per
  // channel; a creator's own language counts 1.5x so a French creator mostly sees French hits.
  const weekHits = (scope) => sql`
    SELECT * FROM (
      SELECT DISTINCT ON (v.channel_id) ${VIDEO_COLUMNS},
        v.outlier_multiplier * (CASE WHEN ${language}::text IS NOT NULL AND v.lang = ${language} THEN 1.5 ELSE 1 END) AS digest_score
      FROM videos v JOIN channels c ON c.id = v.channel_id
      WHERE v.published_at >= ${start} AND v.published_at < ${end}
        AND v.channel_id <> ${myInternalId}
        AND v.view_count >= 1000
        AND v.outlier_multiplier IS NOT NULL
        AND ${scope}
      ORDER BY v.channel_id, digest_score DESC
    ) best
    ORDER BY digest_score DESC
    LIMIT 5`;

  const [nicheHits, competitorHits, risingChannels, myWeek, [deltas]] = await Promise.all([
    nicheId ? weekHits(sql`v.niche = ${nicheId}`) : Promise.resolve([]),
    competitorIds.length ? weekHits(sql`c.youtube_channel_id = ANY(${competitorIds})`) : Promise.resolve([]),
    nicheId
      ? sql`
          SELECT youtube_channel_id, name, handle, thumbnail_url, subscriber_count
          FROM channels
          WHERE niche = ${nicheId}
            AND discovered_at >= ${start} AND discovered_at < ${end}
            AND rss_error_count < 5 AND id <> ${myInternalId}
          ORDER BY trend_score DESC NULLS LAST, subscriber_count DESC NULLS LAST
          LIMIT 3`
      : Promise.resolve([]),
    myChannel
      ? sql`
          SELECT ${VIDEO_COLUMNS}
          FROM videos v JOIN channels c ON c.id = v.channel_id
          WHERE v.channel_id = ${myChannel.id}
            AND v.published_at >= ${start} AND v.published_at < ${end}
          ORDER BY v.outlier_multiplier DESC NULLS LAST`
      : Promise.resolve([]),
    myChannelId
      ? sql`
          SELECT
            (array_agg(total_views ORDER BY captured_at DESC))[1]
              - (array_agg(total_views ORDER BY captured_at DESC) FILTER (WHERE captured_at <= ${start}))[1] AS views_7d,
            (array_agg(subscriber_count ORDER BY captured_at DESC))[1]
              - (array_agg(subscriber_count ORDER BY captured_at DESC) FILTER (WHERE captured_at <= ${start}))[1] AS subs_7d
          FROM channel_stat_snapshots
          WHERE youtube_channel_id = ${myChannelId}
            AND captured_at > ${start}::timestamptz - interval '3 days' AND captured_at <= ${end}`
      : Promise.resolve([undefined]),
  ]);

  // Without a niche or competitors, the week's best hits everywhere
  const topVideos = nicheHits.length
    ? nicheHits
    : competitorHits.length
      ? competitorHits
      : await weekHits(sql`TRUE`);

  // Sections the user turned off stay empty, so the recap skips them
  const show = (section) => sections.includes(section);
  return {
    niche: nicheId ? { id: nicheId, label: NICHE_BY_ID[nicheId].label } : null,
    topVideosSource: nicheHits.length ? "niche" : competitorHits.length ? "competitors" : "all",
    myChannel: myChannel && show("myChannel")
      ? {
          id: myChannel.youtube_channel_id,
          name: myChannel.name,
          avatar: myChannel.thumbnail_url ?? null,
          uploads7d: myWeek.length,
          views7d: num(deltas?.views_7d),
          subs7d: num(deltas?.subs_7d),
          bestVideo: myWeek[0] ? toVideoJson(myWeek[0]) : null,
        }
      : null,
    topVideos: show("topVideos") ? topVideos.map(toVideoJson) : [],
    // Competitor hits are shown apart only when the niche already fills topVideos
    competitorHits: nicheHits.length && show("competitorHits") ? competitorHits.slice(0, 2).map(toVideoJson) : [],
    risingChannels: (show("risingChannels") ? risingChannels : []).map((c) => ({
      id: c.youtube_channel_id,
      name: c.name,
      handle: c.handle ?? null,
      avatar: c.thumbnail_url ?? null,
      subscribers: num(c.subscriber_count),
    })),
  };
}

/**
 * Builds and stores one user's edition (from currentEditionFor); a second call
 * for the same edition keeps the first. Returns whether it was new.
 */
export async function saveWeeklyDigest(userId, { edition, frequency, periodStart, periodEnd }, sections) {
  const data = await buildWeeklyDigest(userId, { periodStart, periodEnd }, sections);
  const inserted = await sql`
    INSERT INTO weekly_digests (user_id, edition, frequency, period_start, period_end, data)
    VALUES (${userId}, ${edition}, ${frequency}, ${periodStart}, ${periodEnd}, ${sql.json(data)})
    ON CONFLICT (user_id, edition) DO NOTHING
    RETURNING 1`;
  return inserted.length > 0;
}

/** Keeps each user's KEEP_EDITIONS latest editions. */
export async function purgeOldDigests() {
  const rows = await sql`
    DELETE FROM weekly_digests d USING (
      SELECT user_id, edition, row_number() OVER (PARTITION BY user_id ORDER BY edition DESC) AS rank
      FROM weekly_digests
    ) ranked
    WHERE d.user_id = ranked.user_id AND d.edition = ranked.edition AND ranked.rank > ${KEEP_EDITIONS}
    RETURNING 1`;
  return rows.length;
}
