import { sql } from "../lib/sql.js";
import { NICHE_BY_ID } from "../lib/taxonomy/index.js";
import { VIDEO_COLUMNS, toVideoJson } from "../lib/videoRows.js";

const num = (value) => (value != null ? Number(value) : null);

/**
 * GET /api/weekly-digest: the creator's last 7 days, shown in the weekly popup.
 * Their channel's week, the videos that performed best in their niche (else among
 * their competitors, else everywhere), and the channels that just appeared in it.
 * PostgreSQL only, so it never spends YouTube quota.
 */
export async function weeklyDigest(req, res) {
  const [user] = await sql`SELECT youtube_channel_id, competitor_channel_ids FROM "user" WHERE id = ${req.user.id}`;
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
      WHERE v.published_at > now() - interval '7 days'
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
          WHERE niche = ${nicheId} AND discovered_at > now() - interval '7 days'
            AND rss_error_count < 5 AND id <> ${myInternalId}
          ORDER BY trend_score DESC NULLS LAST, subscriber_count DESC NULLS LAST
          LIMIT 3`
      : Promise.resolve([]),
    myChannel
      ? sql`
          SELECT ${VIDEO_COLUMNS}
          FROM videos v JOIN channels c ON c.id = v.channel_id
          WHERE v.channel_id = ${myChannel.id} AND v.published_at > now() - interval '7 days'
          ORDER BY v.outlier_multiplier DESC NULLS LAST`
      : Promise.resolve([]),
    myChannelId
      ? sql`
          SELECT
            (array_agg(total_views ORDER BY captured_at DESC))[1]
              - (array_agg(total_views ORDER BY captured_at DESC) FILTER (WHERE captured_at <= now() - interval '7 days'))[1] AS views_7d,
            (array_agg(subscriber_count ORDER BY captured_at DESC))[1]
              - (array_agg(subscriber_count ORDER BY captured_at DESC) FILTER (WHERE captured_at <= now() - interval '7 days'))[1] AS subs_7d
          FROM channel_stat_snapshots
          WHERE youtube_channel_id = ${myChannelId} AND captured_at > now() - interval '10 days'`
      : Promise.resolve([undefined]),
  ]);

  // Without a niche or competitors, the week's best hits everywhere
  const topVideos = nicheHits.length
    ? nicheHits
    : competitorHits.length
      ? competitorHits
      : await weekHits(sql`TRUE`);

  res.json({
    niche: nicheId ? { id: nicheId, label: NICHE_BY_ID[nicheId].label } : null,
    topVideosSource: nicheHits.length ? "niche" : competitorHits.length ? "competitors" : "all",
    myChannel: myChannel
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
    topVideos: topVideos.map(toVideoJson),
    // Competitor hits are shown apart only when the niche already fills topVideos
    competitorHits: nicheHits.length ? competitorHits.slice(0, 2).map(toVideoJson) : [],
    risingChannels: risingChannels.map((c) => ({
      id: c.youtube_channel_id,
      name: c.name,
      handle: c.handle ?? null,
      avatar: c.thumbnail_url ?? null,
      subscribers: num(c.subscriber_count),
    })),
  });
}
