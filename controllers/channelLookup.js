import { sql } from "../lib/sql.js";
import { NICHE_BY_ID } from "../lib/taxonomy/index.js";
import { blendedRpm, summarizeVideos } from "../lib/monetization.js";
import { createBudget, youtubeApi } from "../lib/youtube.js";
import { parseChannelInput, youtubeLookups } from "./onboarding.js";

const num = (value) => (value != null ? Number(value) : null);
const iso = (value) => (value ? new Date(value).toISOString() : null);
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const SEARCH_LIMIT = 24;
const LATEST_VIDEOS = 10;
// Snapshots are purged after 30 days (YouTube API policy), so 28 days is the longest window.
const PERIOD_DAYS = 28;

const nicheJson = (id) => (id && NICHE_BY_ID[id] ? { id, label: NICHE_BY_ID[id].label } : null);

const searchJson = (r) => ({
  id: r.youtube_channel_id,
  name: r.name,
  handle: r.handle ?? null,
  avatar: r.thumbnail_url ?? null,
  subscribers: num(r.subscriber_count),
  totalViews: num(r.total_views),
  videoCount: num(r.video_count),
  country: r.country ?? null,
  niche: nicheJson(r.niche),
  inDatabase: true,
});

/**
 * GET /api/channels/lookup?q=: channels of the database by name, @handle, UC id or
 * channel link. When the database has none and the query names one channel (@handle
 * or UC id), one channels.list call (1 quota unit) says whether it exists, so the
 * page can tell "not analysed yet" from "doesn't exist".
 */
export async function lookup(req, res) {
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 200) : "";
  if (q.length < 2) return res.json({ channels: [], external: null });
  const { id, handle, name } = parseChannelInput(q);
  const like = `%${(handle ?? name).replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

  const rows = await sql`
    SELECT youtube_channel_id, name, handle, thumbnail_url, subscriber_count, total_views, video_count, country, niche
    FROM channels
    WHERE ${id ? sql`youtube_channel_id = ${id}` : sql`name ILIKE ${like} OR handle ILIKE ${like}`}
    ORDER BY (lower(name) = lower(${name}) OR lower(handle) = lower(${`@${handle ?? name}`})) DESC,
      subscriber_count DESC NULLS LAST
    LIMIT ${SEARCH_LIMIT}`;
  if (rows.length || (!id && !handle) || !process.env.YOUTUBE_API_KEY || youtubeLookups.hit(req.user.id)) {
    return res.json({ channels: rows.map(searchJson), external: null });
  }

  try {
    const data = await youtubeApi(
      "channels",
      { part: "snippet,statistics", ...(id ? { id } : { forHandle: `@${handle}` }) },
      createBudget(1),
    );
    const item = data.items?.[0];
    res.json({
      channels: [],
      external: item
        ? {
            id: item.id,
            name: item.snippet.title,
            handle: item.snippet.customUrl ?? null,
            avatar: item.snippet.thumbnails?.default?.url ?? null,
            subscribers: item.statistics.hiddenSubscriberCount ? null : num(item.statistics.subscriberCount),
            totalViews: num(item.statistics.viewCount),
            videoCount: num(item.statistics.videoCount),
            country: item.snippet.country ?? null,
            niche: null,
            inDatabase: false,
          }
        : null,
    });
  } catch (err) {
    console.error("[channels] lookup:", err.message);
    res.json({ channels: [], external: null });
  }
}

/** Revenue range in USD for `views` at an RPM range. */
const revenue = (views, rpm) =>
  views != null ? { low: (views * rpm[0]) / 1000, typical: (views * rpm[1]) / 1000, high: (views * rpm[2]) / 1000 } : null;

/**
 * One point per day (the day's last snapshot) with what the channel gained since the
 * previous point, per day when snapshots skipped days.
 */
function dailySeries(snapshots) {
  const byDay = new Map();
  for (const s of snapshots) byDay.set(new Date(s.captured_at).toISOString().slice(0, 10), s);
  const days = [...byDay].sort(([a], [b]) => a.localeCompare(b));
  return days.map(([date, s], i) => {
    const prev = i > 0 ? days[i - 1][1] : null;
    const span = prev ? Math.max((new Date(s.captured_at) - new Date(prev.captured_at)) / DAY, 0.5) : null;
    const gain = (now, before) => (prev && now != null && before != null ? Math.round((Number(now) - Number(before)) / span) : null);
    return {
      date,
      totalViews: num(s.total_views),
      subscribers: num(s.subscriber_count),
      // The view counter only grows; a lower reading is YouTube's cache, not lost views.
      views: prev ? Math.max(0, gain(s.total_views, prev.total_views)) : null,
      subscribersGained: gain(s.subscriber_count, prev?.subscriber_count),
    };
  });
}

/**
 * Views gained over the last `hours`, from readings sorted oldest first: the latest
 * reading against the one closest to `hours` earlier (0.75 to 1.5 times the window
 * apart, so 48 h is never a doubled 24 h), scaled to the window. null without such a pair.
 */
function gainOver(readings, hours) {
  const latest = readings.at(-1);
  if (!latest) return null;
  const window = hours * HOUR;
  const target = latest.at - window;
  const earlier = readings
    .filter((r) => latest.at - r.at >= window * 0.75 && latest.at - r.at <= window * 1.5)
    .sort((a, b) => Math.abs(a.at - target) - Math.abs(b.at - target))[0];
  if (!earlier) return null;
  return Math.round((Math.max(0, latest.views - earlier.views) * window) / (latest.at - earlier.at));
}

/** A video's view readings (snapshots, then its row's own last count), oldest first. */
function videoReadings(snapshots, v) {
  const readings = snapshots.map((s) => ({ at: new Date(s.captured_at).getTime(), views: Number(s.view_count) }));
  if (v.last_stats_at) readings.push({ at: new Date(v.last_stats_at).getTime(), views: Number(v.view_count) });
  return readings.sort((a, b) => a.at - b.at);
}

/**
 * Views of the last 24 and 48 hours per video, from the worker's view snapshots
 * (no quota spent here). A video younger than the window has all its views in it.
 */
function recentViews(v, readings, now) {
  const age = now - new Date(v.published_at).getTime();
  const views = Number(v.view_count ?? 0);
  return {
    views24h: age <= DAY ? views : gainOver(readings, 24),
    views48h: age <= 2 * DAY ? views : gainOver(readings, 48),
  };
}

async function recentViewsById(videos, now) {
  const ids = videos.map((v) => v.youtube_video_id);
  if (!ids.length) return new Map();
  const snapshots = await sql`
    SELECT youtube_video_id, captured_at, view_count
    FROM video_stat_snapshots
    WHERE youtube_video_id = ANY(${ids}) AND captured_at > now() - interval '4 days'
    ORDER BY captured_at`;
  const byVideo = Map.groupBy(snapshots, (s) => s.youtube_video_id);
  return new Map(videos.map((v) => [v.youtube_video_id, recentViews(v, videoReadings(byVideo.get(v.youtube_video_id) ?? [], v), now)]));
}

/** RPM ranges by format for one channel: its niche and language set the long-form rate. */
function rpms(channel) {
  const market = { niche: channel.niche, lang: channel.lang };
  return { long: blendedRpm({ ...market, shortsViewShare: 0 }), short: blendedRpm({ ...market, shortsViewShare: 1 }) };
}

/** A video row as the channel page lists it. */
function videoJson(v, rates, recent) {
  const views = Number(v.view_count ?? 0);
  const rpm = v.is_short ? rates.short : rates.long;
  return {
    id: v.youtube_video_id,
    title: v.title,
    thumbnail: v.thumbnail_url || `https://i.ytimg.com/vi/${v.youtube_video_id}/hqdefault.jpg`,
    publishedAt: iso(v.published_at),
    duration: v.duration_formatted ?? null,
    isShort: Boolean(v.is_short),
    isLivestream: Boolean(v.is_livestream),
    views,
    likes: num(v.like_count),
    comments: num(v.comment_count),
    views24h: recent?.views24h ?? null,
    views48h: recent?.views48h ?? null,
    multiplier: num(v.outlier_multiplier),
    abTest: { thumbnails: num(v.thumbnail_variants) ?? 1, titles: num(v.title_variants) ?? 1 },
    rpm: rpm[1],
    revenue: revenue(views, rpm),
  };
}

const VIDEO_FIELDS = sql`
  youtube_video_id, title, thumbnail_url, published_at, view_count, like_count, comment_count, duration_formatted,
  duration_seconds, is_short, is_livestream, outlier_multiplier, last_stats_at, thumbnail_variants, title_variants`;

/** Ranks a list by views (1 = most viewed), keeping its order. */
const ranked = (videos) => {
  const order = [...videos].sort((a, b) => b.views - a.views);
  return videos.map((v) => ({ ...v, rank: order.indexOf(v) + 1 }));
};

/**
 * GET /api/channels/:channelId/profile: everything the database knows about one
 * channel (no YouTube quota): header stats with their rank among the analysed
 * channels, gains over the last 28 days and the daily history (channel snapshots,
 * kept 30 days), its views of the last 24 and 48 h, the 10 latest videos of each
 * format ranked against each other with their own 24/48 h views, and revenue
 * estimates (RPM by niche, market and Shorts share).
 */
export async function profile(req, res) {
  const channelId = String(req.params.channelId ?? "");
  if (!/^UC[\w-]{22}$/.test(channelId)) return res.status(400).json({ error: "Chaîne invalide." });

  const [c] = await sql`
    SELECT id, youtube_channel_id, name, handle, thumbnail_url, description, country, channel_created_at,
      subscriber_count, total_views, video_count, median_views, uploads_per_week, outlier_rate, niche, sub_niche, lang,
      ypp_status, est_daily_views, est_monthly_revenue_low, est_monthly_revenue_high, last_stats_at, terminated_at
    FROM channels WHERE youtube_channel_id = ${channelId}`;
  if (!c) return res.status(404).json({ error: "Cette chaîne n'est pas encore dans la base." });

  const now = Date.now();
  const [ranks, snapshots, stored, latest, uploads] = await Promise.all([
    sql`
      SELECT
        (SELECT count(*) FROM channels WHERE terminated_at IS NULL)::int AS total,
        (SELECT count(*) + 1 FROM channels WHERE terminated_at IS NULL AND subscriber_count > ${c.subscriber_count ?? 0})::int AS subscribers,
        (SELECT count(*) + 1 FROM channels WHERE terminated_at IS NULL AND total_views > ${c.total_views ?? 0})::int AS views`,
    sql`
      SELECT captured_at, subscriber_count, total_views
      FROM channel_stat_snapshots
      WHERE youtube_channel_id = ${channelId}
      ORDER BY captured_at`,
    sql`
      SELECT view_count, duration_seconds, is_short, is_livestream, published_at
      FROM videos WHERE channel_id = ${c.id}`,
    // The 10 latest videos of each format: YouTube Studio ranks a video against its own format.
    sql`
      SELECT * FROM (
        SELECT ${VIDEO_FIELDS}, row_number() OVER (PARTITION BY is_short ORDER BY published_at DESC) AS n
        FROM videos WHERE channel_id = ${c.id}
      ) v WHERE n <= ${LATEST_VIDEOS}
      ORDER BY published_at DESC`,
    // Uploads over the chart's longest period, marked on it.
    sql`
      SELECT youtube_video_id, title, published_at, is_short
      FROM videos WHERE channel_id = ${c.id} AND published_at > now() - interval '31 days'
      ORDER BY published_at
      LIMIT 200`,
  ]);

  // RPM ranges: the channel's own mix for channel-wide views, long-form or Shorts for one video.
  const summary = summarizeVideos(
    stored.map((v) => ({
      views: v.view_count,
      durationSeconds: v.duration_seconds,
      isShort: v.is_short,
      isLivestream: v.is_livestream,
      publishedAt: v.published_at,
    })),
    now,
  );
  const channelRpm = blendedRpm({ niche: c.niche, lang: c.lang, shortsViewShare: summary.shortsViewShare });
  const rates = rpms(c);

  // Gains over the window the snapshots cover (up to 28 days, at least 20 hours).
  const window = snapshots.filter((s) => now - new Date(s.captured_at).getTime() <= PERIOD_DAYS * DAY + 12 * HOUR);
  const first = window[0];
  const last = window.at(-1);
  const spanDays = first && last ? (new Date(last.captured_at) - new Date(first.captured_at)) / DAY : 0;
  const measured = spanDays >= 20 / 24;
  const periodViews = measured ? Math.max(0, Number(last.total_views) - Number(first.total_views)) : null;

  const recent = await recentViewsById(latest, now);
  const videos = latest.map((v) => videoJson(v, rates, recent.get(v.youtube_video_id)));

  // Whole channel over the last 24 and 48 hours, from its total view counter.
  const channelReadings = snapshots.map((s) => ({ at: new Date(s.captured_at).getTime(), views: Number(s.total_views) }));

  const split = { long: { videos: 0, views: 0 }, short: { videos: 0, views: 0 } };
  for (const v of stored) {
    const side = v.is_short ? split.short : split.long;
    side.videos++;
    side.views += Number(v.view_count ?? 0);
  }
  const oldest = stored.reduce((min, v) => Math.min(min, new Date(v.published_at).getTime()), Infinity);

  res.json({
    channel: {
      id: c.youtube_channel_id,
      name: c.name,
      handle: c.handle ?? null,
      avatar: c.thumbnail_url ?? null,
      description: c.description ?? null,
      country: c.country ?? null,
      createdAt: iso(c.channel_created_at),
      subscribers: num(c.subscriber_count),
      totalViews: num(c.total_views),
      videoCount: num(c.video_count),
      medianViews: num(c.median_views),
      uploadsPerWeek: num(c.uploads_per_week),
      outlierRate: num(c.outlier_rate),
      niche: nicheJson(c.niche),
      lang: c.lang ?? null,
      updatedAt: iso(c.last_stats_at),
      terminatedAt: iso(c.terminated_at),
    },
    ranks: { total: ranks[0].total, subscribers: c.subscriber_count != null ? ranks[0].subscribers : null, totalViews: ranks[0].views },
    period: {
      days: measured ? Math.round(spanDays * 10) / 10 : null,
      views: periodViews,
      subscribers: measured && last.subscriber_count != null && first.subscriber_count != null
        ? Number(last.subscriber_count) - Number(first.subscriber_count)
        : null,
      revenue: revenue(periodViews, channelRpm),
    },
    history: dailySeries(snapshots),
    uploads: uploads.map((v) => ({ id: v.youtube_video_id, title: v.title, publishedAt: iso(v.published_at), isShort: Boolean(v.is_short) })),
    monetization: {
      status: c.ypp_status ?? null,
      rpm: { low: channelRpm[0], typical: channelRpm[1], high: channelRpm[2] },
      longRpm: rates.long[1],
      shortRpm: rates.short[1],
      dailyViews: num(c.est_daily_views),
      monthlyRevenue:
        c.est_monthly_revenue_low != null ? { low: num(c.est_monthly_revenue_low), high: num(c.est_monthly_revenue_high) } : null,
    },
    recent: { views24h: gainOver(channelReadings, 24), views48h: gainOver(channelReadings, 48) },
    latest: { long: ranked(videos.filter((v) => !v.isShort)), short: ranked(videos.filter((v) => v.isShort)) },
    split: { ...split, storedVideos: stored.length, since: Number.isFinite(oldest) ? new Date(oldest).toISOString() : null },
  });
}

const VIDEOS_PAGE = 24;
const VIDEO_SORTS = {
  recent: sql`published_at DESC`,
  views: sql`view_count DESC NULLS LAST, published_at DESC`,
  multiplier: sql`outlier_multiplier DESC NULLS LAST, published_at DESC`,
};

/**
 * GET /api/channels/:channelId/videos?format=long|short&sort=recent|views|multiplier&page=
 * Every video of the channel in the database, one format at a time.
 */
export async function channelVideos(req, res) {
  const channelId = String(req.params.channelId ?? "");
  if (!/^UC[\w-]{22}$/.test(channelId)) return res.status(400).json({ error: "Chaîne invalide." });
  const short = req.query.format === "short";
  const sort = VIDEO_SORTS[req.query.sort] ?? VIDEO_SORTS.recent;
  const page = Math.max(0, Math.min(200, Number.parseInt(req.query.page, 10) || 0));

  const [c] = await sql`SELECT id, niche, lang FROM channels WHERE youtube_channel_id = ${channelId}`;
  if (!c) return res.status(404).json({ error: "Cette chaîne n'est pas encore dans la base." });
  const [rows, [{ total }]] = await Promise.all([
    sql`
      SELECT ${VIDEO_FIELDS} FROM videos
      WHERE channel_id = ${c.id} AND is_short = ${short}
      ORDER BY ${sort}
      LIMIT ${VIDEOS_PAGE} OFFSET ${page * VIDEOS_PAGE}`,
    sql`SELECT count(*)::int AS total FROM videos WHERE channel_id = ${c.id} AND is_short = ${short}`,
  ]);
  const rates = rpms(c);
  const recent = await recentViewsById(rows, Date.now());
  res.json({
    items: rows.map((v) => videoJson(v, rates, recent.get(v.youtube_video_id))),
    total,
    page,
    hasMore: (page + 1) * VIDEOS_PAGE < total,
  });
}

/**
 * GET /api/channels/videos/:videoId: one video's numbers, its view history (worker
 * snapshots, kept 30 days), its views of the last 24 and 48 hours, its rank against
 * the 9 videos of the same format released before it (YouTube Studio's comparison)
 * and its estimated revenue. Title and thumbnail tests come from /api/videos/:id/variants.
 */
export async function videoStats(req, res) {
  const videoId = String(req.params.videoId ?? "");
  if (!/^[\w-]{11}$/.test(videoId)) return res.status(400).json({ error: "Vidéo invalide." });

  const [v] = await sql`
    SELECT ${VIDEO_FIELDS}, baseline_views, views_per_hour, engagement_rate, channel_id
    FROM videos WHERE youtube_video_id = ${videoId}`;
  if (!v) return res.status(404).json({ error: "Cette vidéo n'est pas encore dans la base." });
  const [c] = await sql`SELECT youtube_channel_id, name, thumbnail_url, niche, lang FROM channels WHERE id = ${v.channel_id}`;

  const [snapshots, peers] = await Promise.all([
    sql`
      SELECT captured_at, view_count, like_count, comment_count
      FROM video_stat_snapshots WHERE youtube_video_id = ${videoId}
      ORDER BY captured_at`,
    sql`
      SELECT ${VIDEO_FIELDS} FROM videos
      WHERE channel_id = ${v.channel_id} AND is_short = ${v.is_short} AND published_at <= ${v.published_at}
      ORDER BY published_at DESC
      LIMIT ${LATEST_VIDEOS}`,
  ]);

  const now = Date.now();
  const rates = rpms(c ?? {});
  const video = videoJson(v, rates, recentViews(v, videoReadings(snapshots, v), now));
  const multiplier = num(v.outlier_multiplier);
  res.json({
    video: {
      ...video,
      usualViews: num(v.baseline_views) ?? (multiplier && multiplier > 0 ? Math.round(video.views / multiplier) : null),
      viewsPerHour: v.views_per_hour != null ? Math.round(Number(v.views_per_hour)) : null,
      engagementRate: num(v.engagement_rate),
    },
    channel: c ? { id: c.youtube_channel_id, name: c.name, avatar: c.thumbnail_url ?? null } : null,
    history: snapshots.map((s) => ({
      at: iso(s.captured_at),
      views: Number(s.view_count),
      likes: num(s.like_count),
      comments: num(s.comment_count),
    })),
    ranking: ranked(peers.map((p) => videoJson(p, rates, null))),
  });
}
