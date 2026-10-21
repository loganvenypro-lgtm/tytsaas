import { sql } from "../lib/sql.js";
import { classifyChannel, nicheTsQuery, titleMatchesNiche } from "../lib/nicheClassifier.js";
import { mode, topKeywords } from "../lib/titleKeywords.js";
import { VIDEO_COLUMNS, toVideoJson } from "../lib/videoRows.js";

const num = (value) => (value != null ? Number(value) : null);

/**
 * Personalised home: the creator's channel (chosen at onboarding), hits in their
 * niche, what their competitors are doing, and the pulse of the whole database.
 * PostgreSQL only, so it never spends YouTube quota.
 */
export async function home(req, res) {
  const [user] = await sql`SELECT name, youtube_channel_id, competitor_channel_ids FROM "user" WHERE id = ${req.user.id}`;
  const myChannelId = user?.youtube_channel_id ?? null;
  const myCompetitorIds = (user?.competitor_channel_ids ?? []).filter((id) => id !== myChannelId);

  // My competitors: the ones chosen at onboarding, else every tracked channel
  const competitorSource = myCompetitorIds.length
    ? sql`FROM channels c WHERE c.youtube_channel_id = ANY(${myCompetitorIds})`
    : sql`FROM tracked_channels tc JOIN channels c ON c.youtube_channel_id = tc.channel_id WHERE c.youtube_channel_id <> ${myChannelId ?? ""}`;

  const [myChannel] = myChannelId
    ? await sql`
        SELECT c.*,
          (SELECT count(*) FROM videos v WHERE v.channel_id = c.id AND v.published_at > now() - interval '30 days')::int AS uploads_30d
        FROM channels c WHERE c.youtube_channel_id = ${myChannelId}`
    : [];

  // Niche = topic classified from my recent titles, plus their keywords, main category and language
  let niche = null;
  let keywords = [];
  let category = null;
  let language = null;
  let myVideos = [];
  if (myChannel) {
    myVideos = await sql`
      SELECT ${VIDEO_COLUMNS}
      FROM videos v JOIN channels c ON c.id = v.channel_id
      WHERE v.channel_id = ${myChannel.id}
      ORDER BY v.published_at DESC
      LIMIT 40`;
    const titles = myVideos.map((v) => v.title);
    keywords = topKeywords(titles, 10);
    niche = classifyChannel({ titles, name: myChannel.name });
    category = mode(myVideos.map((v) => num(v.category_id)));
    language = mode(myVideos.map((v) => (v.language ?? "").split("-")[0].toLowerCase() || null));
  }

  const query = keywords.length ? keywords.join(" | ") : null;
  // Recommend the creator's own format (Shorts vs long-form)
  const isShortsCreator = myVideos.length ? myVideos.filter((v) => v.is_short).length / myVideos.length >= 0.5 : null;
  const myInternalId = myChannel?.id ?? "";
  const nicheId = niche?.id ?? null;
  const nicheQuery = nicheTsQuery(nicheId);

  // With a classified niche, candidates must use its vocabulary and each title is
  // re-checked on its own: the YouTube category alone is far too broad. My keywords only rank the results.
  const nicheHits = async () => {
    const rows = await sql`
      SELECT ${VIDEO_COLUMNS}
      FROM videos v JOIN channels c ON c.id = v.channel_id
      WHERE v.relevance_score IS NOT NULL
        AND v.published_at > now() - interval '14 days'
        AND v.channel_id <> ${myInternalId}
        AND to_tsvector('simple', v.title) @@ to_tsquery('simple', ${nicheQuery})
      ORDER BY
        ${query ? sql`ts_rank(to_tsvector('simple', v.title), to_tsquery('simple', ${query})) * 1000 +` : sql``}
        ${language ? sql`(CASE WHEN split_part(lower(v.language), '-', 1) = ${language} THEN 50 ELSE 0 END) +` : sql``}
        v.relevance_score DESC
      LIMIT 120`;
    const onNiche = rows.filter((r) => titleMatchesNiche(r.title, nicheId));
    const sameFormat = onNiche.filter((r) => isShortsCreator === null || Boolean(r.is_short) === isShortsCreator);
    const otherFormat = onNiche.filter((r) => !sameFormat.includes(r));
    return [...sameFormat, ...otherFormat].slice(0, 8);
  };

  const [forYou, competitors, competitorHits, [deltas], [pulse], [lastScan]] = await Promise.all([
    // Hits in my niche, or without a channel yet, the best hits of the week
    nicheQuery
      ? nicheHits()
      : sql`
          SELECT ${VIDEO_COLUMNS}
          FROM videos v JOIN channels c ON c.id = v.channel_id
          WHERE v.relevance_score IS NOT NULL
            AND v.published_at > now() - interval '7 days'
            AND v.channel_id <> ${myInternalId}
            ${isShortsCreator !== null ? sql`AND v.is_short = ${isShortsCreator}` : sql``}
            ${
              query || category != null
                ? sql`AND (
                    ${query ? sql`to_tsvector('simple', v.title) @@ to_tsquery('simple', ${query})` : sql`FALSE`}
                    OR ${category != null ? sql`(v.category_id = ${category} ${language ? sql`AND split_part(lower(v.language), '-', 1) = ${language}` : sql``})` : sql`FALSE`}
                  )`
                : sql``
            }
          ORDER BY
            ${query ? sql`ts_rank(to_tsvector('simple', v.title), to_tsquery('simple', ${query})) * 1000 +` : sql``}
            v.relevance_score DESC
          LIMIT 8`,
    sql`
      SELECT
        c.youtube_channel_id, c.name, c.handle, c.thumbnail_url, c.subscriber_count, c.trend_score, c.recent_ratio,
        best.youtube_video_id AS best_video_id, best.title AS best_title, best.view_count AS best_views,
        best.outlier_multiplier AS best_multiplier, best.published_at AS best_published_at
      FROM (SELECT c.* ${competitorSource}) c
      LEFT JOIN LATERAL (
        SELECT v.youtube_video_id, v.title, v.view_count, v.outlier_multiplier, v.published_at
        FROM videos v
        WHERE v.channel_id = c.id AND v.published_at > now() - interval '14 days'
        ORDER BY v.outlier_multiplier DESC NULLS LAST
        LIMIT 1
      ) best ON true
      ORDER BY
        ${myCompetitorIds.length ? sql`array_position(${myCompetitorIds}::text[], c.youtube_channel_id::text),` : sql``}
        c.trend_score DESC NULLS LAST
      LIMIT 8`,
    sql`
      SELECT ${VIDEO_COLUMNS}
      FROM (SELECT c.* ${competitorSource}) c
      JOIN videos v ON v.channel_id = c.id
      WHERE v.published_at > now() - interval '14 days'
        AND v.outlier_multiplier >= 2
      ORDER BY v.outlier_multiplier DESC
      LIMIT 4`,
    myChannelId
      ? sql`
          SELECT
            (array_agg(total_views ORDER BY captured_at DESC))[1]
              - (array_agg(total_views ORDER BY captured_at DESC) FILTER (WHERE captured_at <= now() - interval '20 hours'))[1] AS views_24h,
            (array_agg(subscriber_count ORDER BY captured_at DESC))[1]
              - (array_agg(subscriber_count ORDER BY captured_at DESC) FILTER (WHERE captured_at <= now() - interval '20 hours'))[1] AS subs_24h
          FROM channel_stat_snapshots
          WHERE youtube_channel_id = ${myChannelId} AND captured_at > now() - interval '4 days'`
      : Promise.resolve([undefined]),
    // What the scanner saw over the last 24 hours, for the whole database
    sql`
      SELECT
        (SELECT count(*) FROM videos WHERE published_at > now() - interval '24 hours')::int AS videos_24h,
        (SELECT count(*) FROM videos WHERE published_at > now() - interval '24 hours' AND outlier_multiplier >= 3)::int AS outliers_24h,
        (SELECT count(*) FROM channels WHERE discovered_at > now() - interval '24 hours')::int AS new_channels_24h,
        (SELECT count(*) FROM channels WHERE rss_error_count < 5)::int AS channels`,
    sql`SELECT max(finished_at) AS at FROM scan_runs WHERE status = 'ok'`,
  ]);

  const latest = myVideos[0];
  const bestRecent = [...myVideos]
    .filter((v) => new Date(v.published_at).getTime() > Date.now() - 30 * 86_400_000)
    .sort((a, b) => Number(b.outlier_multiplier ?? 0) - Number(a.outlier_multiplier ?? 0))[0];

  res.json({
    userName: user?.name ?? req.user.name,
    myChannel: myChannel
      ? {
          id: myChannel.youtube_channel_id,
          name: myChannel.name,
          handle: myChannel.handle ?? null,
          avatar: myChannel.thumbnail_url ?? null,
          subscribers: num(myChannel.subscriber_count),
          totalViews: num(myChannel.total_views),
          trendScore: num(myChannel.trend_score),
          recentRatio: num(myChannel.recent_ratio),
          outlierRate: num(myChannel.outlier_rate),
          uploads30d: Number(myChannel.uploads_30d ?? 0),
          subs24h: num(deltas?.subs_24h),
          views24h: num(deltas?.views_24h),
          latestVideo: latest ? toVideoJson(latest) : null,
          bestRecentVideo: bestRecent ? toVideoJson(bestRecent) : null,
        }
      : null,
    niche: { id: nicheId, label: niche?.id ? niche.label : null, keywords, category, language },
    forYou: forYou.map(toVideoJson),
    competitors: competitors.map((c) => ({
      id: c.youtube_channel_id,
      name: c.name,
      handle: c.handle ?? null,
      avatar: c.thumbnail_url ?? null,
      subscribers: num(c.subscriber_count),
      trendScore: num(c.trend_score),
      recentRatio: num(c.recent_ratio),
      bestVideo: c.best_video_id
        ? {
            id: c.best_video_id,
            title: c.best_title,
            views: Number(c.best_views ?? 0),
            multiplier: num(c.best_multiplier),
            publishedAt: new Date(c.best_published_at).toISOString(),
          }
        : null,
    })),
    competitorHits: competitorHits.map(toVideoJson),
    pulse: {
      videos24h: pulse.videos_24h,
      outliers24h: pulse.outliers_24h,
      newChannels24h: pulse.new_channels_24h,
      channels: pulse.channels,
    },
    updatedAt: lastScan?.at ? new Date(lastScan.at).toISOString() : null,
  });
}
