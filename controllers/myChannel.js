import { sql } from "../lib/sql.js";
import { NICHE_BY_ID } from "../lib/taxonomy/index.js";
import { AiRefusedError, aiEnabled, reviveVideoReport } from "../lib/ideationAI.js";
import { createBudget, youtubeApi, uploadsPlaylistId, QuotaExceededError } from "../lib/youtube.js";
import { ReconnectError, analyticsReport, cached, fetchMyChannel, reportRows, youtubeAccount } from "../lib/youtubeOAuth.js";
import { CHANNEL_PARTS, VIDEO_PARTS, saveApiChannels, saveApiVideos } from "../worker/store.js";

const num = (value) => (value != null ? Number(value) : null);
const iso = (value) => (value ? new Date(value).toISOString() : null);
const DAY_MS = 86_400_000;

// Uploads pulled by a sync: 10 pages of 50 (playlistItems + videos.list, 2 units a page)
const SYNC_MAX_PAGES = 10;
const SYNC_EVERY_HOURS = 12;
const ANALYTICS_CACHE_HOURS = 6;
const TRAFFIC_CACHE_HOURS = 24;
// Measures of an old video's views closer than this say nothing about its pace
const MIN_WINDOW_HOURS = 18;

/** The user's channel row (null when the user has none or the database doesn't know it yet). */
async function myChannel(userId) {
  const [row] = await sql`
    SELECT u.youtube_channel_id AS my_channel_id, u.youtube_linked_at, u.youtube_synced_at, c.*,
      (SELECT count(*)::int FROM videos v WHERE v.channel_id = c.id) AS videos_in_db
    FROM "user" u
    LEFT JOIN channels c ON c.youtube_channel_id = u.youtube_channel_id
    WHERE u.id = ${userId}`;
  return row;
}

const channelJson = (c) => ({
  id: c.youtube_channel_id,
  name: c.name,
  handle: c.handle ?? null,
  avatar: c.thumbnail_url ?? null,
  subscribers: num(c.subscriber_count),
  totalViews: num(c.total_views),
  videoCount: num(c.video_count),
  videosInDb: Number(c.videos_in_db ?? 0),
  medianViews: num(c.median_views),
  uploadsPerWeek: num(c.uploads_per_week),
  outlierRate: num(c.outlier_rate),
  niche: c.niche && NICHE_BY_ID[c.niche] ? { id: c.niche, label: NICHE_BY_ID[c.niche].label } : null,
  country: c.country ?? null,
  lastStatsAt: iso(c.last_stats_at),
});

const videoJson = (v) => {
  const ageDays = Math.max(1, (Date.now() - new Date(v.published_at).getTime()) / DAY_MS);
  return {
    id: v.youtube_video_id,
    title: v.title,
    thumbnail: v.thumbnail_url || `https://i.ytimg.com/vi/${v.youtube_video_id}/mqdefault.jpg`,
    views: Number(v.view_count ?? 0),
    multiplier: num(v.outlier_multiplier),
    publishedAt: iso(v.published_at),
    isShort: Boolean(v.is_short),
    duration: v.duration_formatted ?? null,
    viewsPerDay: Math.round(Number(v.view_count ?? 0) / ageDays),
  };
};

const VIDEO_COLUMNS = sql`v.youtube_video_id, v.title, v.thumbnail_url, v.view_count, v.outlier_multiplier,
  v.published_at, v.is_short, v.duration_formatted`;

/** Answers 404 with what is missing when the user has no channel the database knows. */
function requireChannel(row, res) {
  if (row?.id) return true;
  res.status(404).json({
    error: row?.my_channel_id ? "Ta chaîne n'est pas encore analysée." : "Aucune chaîne connectée.",
    code: row?.my_channel_id ? "not_synced" : "no_channel",
  });
  return false;
}

/**
 * GET /api/my-channel: which channel is the user's, how it was set (OAuth link
 * or onboarding) and what the Google link allows. Database only.
 */
export async function status(req, res) {
  const [row, connection] = await Promise.all([myChannel(req.user.id), youtubeAccount(req.user.id)]);
  const nextSync = row?.youtube_synced_at ? new Date(row.youtube_synced_at).getTime() + SYNC_EVERY_HOURS * 3_600_000 : null;
  res.json({
    channelId: row?.my_channel_id ?? null,
    channel: row?.id ? channelJson(row) : null,
    linkedAt: iso(row?.youtube_linked_at),
    syncedAt: iso(row?.youtube_synced_at),
    nextSyncAt: nextSync ? iso(nextSync) : null,
    canSync: Boolean(row?.my_channel_id) && (!nextSync || nextSync <= Date.now()),
    connection: { google: connection.google, youtube: connection.youtube, analytics: connection.analytics },
    aiEnabled: aiEnabled(),
  });
}

/**
 * Pulls the channel and its last uploads (up to 500) with the API key: about
 * 2 units per 50 videos, at most once per SYNC_EVERY_HOURS. Gives a channel the
 * worker doesn't scan yet (or only partly) its whole recent history at once;
 * the worker keeps it fresh after that.
 */
async function syncUploads(userId, channelId) {
  const budget = createBudget(1 + SYNC_MAX_PAGES * 2);
  const channels = await youtubeApi("channels", { part: CHANNEL_PARTS, id: channelId }, budget);
  const item = channels.items?.[0];
  if (!item) throw new Error("Chaîne introuvable sur YouTube.");
  await saveApiChannels([item], { discovered_via: "owner", discovered_at: new Date() });

  let pageToken;
  let videos = 0;
  for (let page = 0; page < SYNC_MAX_PAGES; page++) {
    const playlist = await youtubeApi(
      "playlistItems",
      { part: "contentDetails", playlistId: uploadsPlaylistId(channelId), maxResults: "50", ...(pageToken ? { pageToken } : {}) },
      budget,
    );
    const ids = (playlist.items ?? []).map((i) => i.contentDetails?.videoId).filter(Boolean);
    if (ids.length) {
      const data = await youtubeApi("videos", { part: VIDEO_PARTS, id: ids.join(","), maxResults: "50" }, budget);
      videos += (await saveApiVideos(data.items ?? [])).saved;
    }
    pageToken = playlist.nextPageToken;
    if (!pageToken) break;
  }
  await sql`UPDATE channels SET backfilled_at = coalesce(backfilled_at, now()) WHERE youtube_channel_id = ${channelId}`;
  await sql`UPDATE "user" SET youtube_synced_at = now() WHERE id = ${userId}`;
  return { videos, units: budget.spent };
}

/**
 * POST /api/my-channel/connect, after the Google link with the YouTube scope:
 * asks YouTube which channel the user picked (1 unit), makes it the user's
 * channel and starts the first sync in the background.
 */
export async function connect(req, res) {
  const account = await youtubeAccount(req.user.id);
  if (!account.youtube) {
    return res.status(409).json({ error: "Autorise d'abord l'accès à YouTube avec Google.", code: "scope" });
  }
  let item;
  try {
    item = await fetchMyChannel(req.user.id, account.accountId, CHANNEL_PARTS);
  } catch (err) {
    if (err instanceof ReconnectError) {
      return res.status(409).json({ error: "L'accès Google a expiré ou a été retiré. Reconnecte YouTube.", code: "reconnect" });
    }
    throw err;
  }
  if (!item) return res.status(404).json({ error: "Ce compte Google n'a pas de chaîne YouTube.", code: "no_youtube_channel" });

  await saveApiChannels([item], { discovered_via: "owner", discovered_at: new Date() });
  await sql`UPDATE "user" SET youtube_channel_id = ${item.id}, youtube_linked_at = now() WHERE id = ${req.user.id}`;

  const [row] = await sql`SELECT youtube_synced_at FROM "user" WHERE id = ${req.user.id}`;
  const due = !row.youtube_synced_at || Date.now() - new Date(row.youtube_synced_at).getTime() > SYNC_EVERY_HOURS * 3_600_000;
  if (due && process.env.YOUTUBE_API_KEY) {
    syncUploads(req.user.id, item.id).catch((err) => console.error("[my-channel] first sync:", err.message));
  }
  res.json({ channelId: item.id, name: item.snippet?.title ?? item.id, syncing: Boolean(due && process.env.YOUTUBE_API_KEY) });
}

/** POST /api/my-channel/sync: the user asks for a fresh pull of their uploads. */
export async function sync(req, res) {
  const row = await myChannel(req.user.id);
  if (!row?.my_channel_id) return res.status(404).json({ error: "Aucune chaîne connectée.", code: "no_channel" });
  if (row.youtube_synced_at && Date.now() - new Date(row.youtube_synced_at).getTime() < SYNC_EVERY_HOURS * 3_600_000) {
    return res.status(429).json({ error: "Ta chaîne a été synchronisée récemment.", code: "too_soon" });
  }
  if (!process.env.YOUTUBE_API_KEY) return res.status(503).json({ error: "YOUTUBE_API_KEY manque sur le serveur." });
  try {
    res.json(await syncUploads(req.user.id, row.my_channel_id));
  } catch (err) {
    if (err instanceof QuotaExceededError) return res.status(503).json({ error: "Le quota YouTube du jour est épuisé.", code: "quota" });
    throw err;
  }
}

/** Views and subscribers gained since the snapshot closest to `days` ago. */
function growth(history, days) {
  if (history.length < 2) return null;
  const last = history[history.length - 1];
  const target = Date.now() - days * DAY_MS;
  const before = [...history].reverse().find((h) => new Date(h.date).getTime() <= target + DAY_MS / 2);
  if (!before || before === last) return null;
  return {
    days: Math.round((new Date(last.date) - new Date(before.date)) / DAY_MS),
    views: last.views - before.views,
    subscribers: last.subscribers != null && before.subscribers != null ? last.subscribers - before.subscribers : null,
  };
}

/** The last 28 days of YouTube Analytics (views, watch time, subscribers), cached for a few hours. */
async function analyticsSummary(userId, accountId) {
  const day = (offset) => new Date(Date.now() - offset * DAY_MS).toISOString().slice(0, 10);
  const startDate = day(29);
  const endDate = day(1);
  return cached(userId, "analytics:28d", ANALYTICS_CACHE_HOURS, async () => {
    const metrics = "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost";
    const [totals, days] = await Promise.all([
      analyticsReport(userId, accountId, { startDate, endDate, metrics }),
      analyticsReport(userId, accountId, { startDate, endDate, metrics: "views,subscribersGained", dimensions: "day", sort: "day" }),
    ]);
    const t = reportRows(totals)[0] ?? {};
    return {
      startDate,
      endDate,
      views: num(t.views),
      minutesWatched: num(t.estimatedMinutesWatched),
      averageViewDuration: num(t.averageViewDuration),
      subscribersGained: num(t.subscribersGained),
      subscribersLost: num(t.subscribersLost),
      days: reportRows(days).map((d) => ({ date: d.day, views: num(d.views), subscribersGained: num(d.subscribersGained) })),
    };
  });
}

/**
 * GET /api/my-channel/overview: the channel's numbers from the database
 * (stats, daily snapshots, last and best videos) plus, when the user granted
 * it, 28 days of YouTube Analytics (cached).
 */
export async function overview(req, res) {
  const row = await myChannel(req.user.id);
  if (!requireChannel(row, res)) return;

  const [snapshots, [period], recent, best] = await Promise.all([
    sql`
      SELECT DISTINCT ON (captured_at::date) captured_at::date AS date, subscriber_count, total_views
      FROM channel_stat_snapshots
      WHERE youtube_channel_id = ${row.youtube_channel_id} AND captured_at > now() - interval '120 days'
      ORDER BY captured_at::date, captured_at DESC`,
    sql`
      SELECT count(*)::int AS uploads,
        count(*) FILTER (WHERE is_short)::int AS shorts,
        count(*) FILTER (WHERE outlier_multiplier >= 2)::int AS outliers,
        max(outlier_multiplier) AS best_multiplier,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY view_count) FILTER (WHERE NOT is_short) AS median_long,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY view_count) FILTER (WHERE is_short) AS median_short,
        max(published_at) AS last_upload_at
      FROM videos
      WHERE channel_id = ${row.id} AND published_at > now() - interval '90 days' AND NOT is_livestream`,
    sql`SELECT ${VIDEO_COLUMNS} FROM videos v WHERE v.channel_id = ${row.id} ORDER BY v.published_at DESC LIMIT 12`,
    sql`
      SELECT ${VIDEO_COLUMNS} FROM videos v
      WHERE v.channel_id = ${row.id} AND v.published_at > now() - interval '365 days' AND NOT v.is_livestream
      ORDER BY v.outlier_multiplier DESC NULLS LAST LIMIT 6`,
  ]);

  const history = snapshots.map((s) => ({
    date: new Date(s.date).toISOString().slice(0, 10),
    subscribers: num(s.subscriber_count),
    views: Number(s.total_views),
  }));

  let analytics = null;
  const account = await youtubeAccount(req.user.id);
  // Only for the channel the Google link returned: an onboarding channel may not be the user's
  if (account.analytics && row.youtube_linked_at) {
    try {
      analytics = { status: "ok", ...(await analyticsSummary(req.user.id, account.accountId)) };
    } catch (err) {
      console.error("[my-channel] analytics:", err.message);
      analytics = { status: err instanceof ReconnectError ? "reconnect" : "unavailable" };
    }
  }

  res.json({
    channel: channelJson(row),
    period: {
      days: 90,
      uploads: period.uploads,
      shorts: period.shorts,
      outliers: period.outliers,
      bestMultiplier: num(period.best_multiplier),
      medianLongViews: num(period.median_long) != null ? Math.round(period.median_long) : null,
      medianShortViews: num(period.median_short) != null ? Math.round(period.median_short) : null,
      lastUploadAt: iso(period.last_upload_at),
    },
    growth: { week: growth(history, 7), month: growth(history, 30) },
    history,
    recent: recent.map(videoJson),
    best: best.map(videoJson),
    analytics,
  });
}

/** Views per hour between the first and last snapshot taken while a version was live. */
function paceWhileLive(snaps, from, to) {
  const inside = snaps.filter((s) => s.at >= from && s.at <= to);
  if (inside.length < 2) return null;
  const first = inside[0];
  const last = inside[inside.length - 1];
  const hours = (last.at - first.at) / 3_600_000;
  // RSS and API counts can disagree by a little: a drop is noise, not a pace
  return hours >= 1 && last.views >= first.views ? Math.round((last.views - first.views) / hours) : null;
}

/**
 * GET /api/my-channel/ab-tests: the user's videos whose title or thumbnail
 * changed after publishing (video_variants), each version with how long it was
 * live and its views per hour meanwhile when snapshots allow it.
 */
export async function abTests(req, res) {
  const row = await myChannel(req.user.id);
  if (!requireChannel(row, res)) return;

  const videos = await sql`
    SELECT ${VIDEO_COLUMNS}, v.title_variants, v.thumbnail_variants
    FROM videos v
    WHERE v.channel_id = ${row.id} AND (v.title_variants > 1 OR v.thumbnail_variants > 1)
    ORDER BY v.published_at DESC
    LIMIT 60`;
  const ids = videos.map((v) => v.youtube_video_id);
  const [variants, snapshots] = ids.length
    ? await Promise.all([
        sql`
          SELECT youtube_video_id, kind, value, set_at, first_seen_at, last_seen_at, image IS NOT NULL AS has_image
          FROM video_variants
          -- ETag "0" is the CDN's answer for an auto-generated frame, not a version
          WHERE youtube_video_id IN ${sql(ids)} AND NOT (kind = 'thumbnail' AND value = '0')
          ORDER BY coalesce(set_at, first_seen_at)`,
        sql`
          SELECT youtube_video_id, captured_at, view_count FROM video_stat_snapshots
          WHERE youtube_video_id IN ${sql(ids)} ORDER BY captured_at`,
      ])
    : [[], []];

  const snapsBy = new Map();
  for (const s of snapshots) {
    const list = snapsBy.get(s.youtube_video_id) ?? [];
    list.push({ at: new Date(s.captured_at).getTime(), views: Number(s.view_count) });
    snapsBy.set(s.youtube_video_id, list);
  }

  const tests = videos
    .map((v) => {
      const versions = (kind) => {
        const list = variants.filter((x) => x.youtube_video_id === v.youtube_video_id && x.kind === kind);
        return list.map((x, i) => {
          const from = new Date(x.set_at ?? x.first_seen_at).getTime();
          const isCurrent = i === list.length - 1;
          const to = isCurrent ? Date.now() : new Date(list[i + 1].set_at ?? list[i + 1].first_seen_at).getTime();
          return {
            value: kind === "title" ? x.value : null,
            image:
              kind !== "thumbnail"
                ? null
                : x.has_image
                  ? `/api/videos/${encodeURIComponent(v.youtube_video_id)}/thumbnails/${encodeURIComponent(x.value)}.jpg`
                  : isCurrent
                    ? `https://i.ytimg.com/vi/${encodeURIComponent(v.youtube_video_id)}/mqdefault.jpg`
                    : null,
            from: iso(from),
            current: isCurrent,
            hoursLive: Math.max(0, Math.round((to - from) / 3_600_000)),
            viewsPerHour: paceWhileLive(snapsBy.get(v.youtube_video_id) ?? [], from, to),
          };
        });
      };
      const titles = versions("title");
      const thumbnails = versions("thumbnail");
      const lastChange = [...titles, ...thumbnails].filter((x) => x.from).map((x) => x.from).sort().at(-1) ?? null;
      return { video: videoJson(v), titles, thumbnails, lastChange };
    })
    // The counters can run ahead of the history (purged rows): keep what still shows a change
    .filter((t) => t.titles.length > 1 || t.thumbnails.length > 1)
    .sort((a, b) => (b.lastChange ?? "").localeCompare(a.lastChange ?? ""));

  res.json({ tests, videosInDb: Number(row.videos_in_db ?? 0) });
}

/**
 * The user's videos older than `minAgeDays` with their views over the latest
 * window of snapshots (closest to 48 h): views gained, the pace per day, and
 * that pace against the video's lifetime average (above 1 = it gets more views
 * now than on average since it came out).
 */
async function revivalRows(channel, { minAgeDays, videoId } = {}) {
  const rows = await sql`
    WITH mine AS (
      SELECT ${VIDEO_COLUMNS}, v.description, v.tags, v.duration_seconds, v.niche, v.sub_niche, v.lang,
        v.like_count, v.comment_count, v.title_variants, v.thumbnail_variants
      FROM videos v
      WHERE v.channel_id = ${channel.id} AND NOT v.is_livestream
        AND ${videoId ? sql`v.youtube_video_id = ${videoId}` : sql`v.published_at < now() - make_interval(days => ${minAgeDays})`}
    ),
    latest AS (
      SELECT DISTINCT ON (s.youtube_video_id) s.youtube_video_id, s.captured_at, s.view_count
      FROM video_stat_snapshots s JOIN mine m ON m.youtube_video_id = s.youtube_video_id
      WHERE s.captured_at > now() - interval '4 days'
      ORDER BY s.youtube_video_id, s.captured_at DESC
    ),
    base AS (
      SELECT DISTINCT ON (s.youtube_video_id) s.youtube_video_id, s.captured_at, s.view_count
      FROM video_stat_snapshots s JOIN latest l ON l.youtube_video_id = s.youtube_video_id
      WHERE s.captured_at <= l.captured_at - make_interval(hours => ${MIN_WINDOW_HOURS})
        AND s.captured_at >= l.captured_at - interval '8 days'
      ORDER BY s.youtube_video_id, abs(extract(epoch FROM s.captured_at - (l.captured_at - interval '48 hours')))
    )
    SELECT m.*, l.captured_at AS measured_at, l.view_count AS views_now, b.captured_at AS before_at, b.view_count AS views_before
    FROM mine m
    LEFT JOIN latest l ON l.youtube_video_id = m.youtube_video_id
    LEFT JOIN base b ON b.youtube_video_id = m.youtube_video_id`;

  return rows.map((r) => {
    const video = videoJson(r);
    if (!r.before_at) return { ...video, row: r, measured: false };
    const hours = (new Date(r.measured_at) - new Date(r.before_at)) / 3_600_000;
    const gained = Math.max(0, Number(r.views_now) - Number(r.views_before));
    const perDay = (gained / hours) * 24;
    const ageDays = Math.max(1, (new Date(r.measured_at) - new Date(r.published_at)) / DAY_MS);
    const lifetimePerDay = Number(r.views_now) / ageDays;
    return {
      ...video,
      row: r,
      measured: true,
      windowHours: Math.round(hours),
      gained,
      // Normalised to 48 h so videos measured over different windows compare
      views48h: Math.round(perDay * 2),
      lifetimePerDay: Math.round(lifetimePerDay),
      pace: lifetimePerDay > 0 ? Math.round((perDay / lifetimePerDay) * 100) / 100 : null,
      measuredAt: iso(r.measured_at),
    };
  });
}

const revivalJson = ({ row, measured, ...video }) => video;

/**
 * GET /api/my-channel/revivals?minAge=30: old videos still gaining views, from
 * the worker's snapshots (no quota here; the worker refreshes the user's old
 * videos daily, see worker/refreshPolicy.js).
 */
export async function revivals(req, res) {
  const minAge = [30, 90, 365].includes(Number(req.query.minAge)) ? Number(req.query.minAge) : 30;
  const row = await myChannel(req.user.id);
  if (!requireChannel(row, res)) return;

  const all = await revivalRows(row, { minAgeDays: minAge });
  const measured = all.filter((v) => v.measured && v.gained > 0).sort((a, b) => b.views48h - a.views48h);
  res.json({
    minAge,
    videos: measured.slice(0, 60).map(revivalJson),
    oldVideos: all.length,
    measuredVideos: all.filter((v) => v.measured).length,
    totalViews48h: measured.reduce((sum, v) => sum + v.views48h, 0),
    medianViews: num(row.median_views),
  });
}

/** Where a video's views came from over 28 days, and its top search terms (YouTube Analytics, cached a day). */
async function trafficSources(userId, accountId, videoId) {
  const day = (offset) => new Date(Date.now() - offset * DAY_MS).toISOString().slice(0, 10);
  return cached(userId, `traffic:${videoId}`, TRAFFIC_CACHE_HOURS, async () => {
    const range = { startDate: day(29), endDate: day(1) };
    const [sources, searches] = await Promise.all([
      analyticsReport(userId, accountId, {
        ...range,
        metrics: "views",
        dimensions: "insightTrafficSourceType",
        filters: `video==${videoId}`,
        sort: "-views",
      }),
      analyticsReport(userId, accountId, {
        ...range,
        metrics: "views",
        dimensions: "insightTrafficSourceDetail",
        filters: `video==${videoId};insightTrafficSourceType==YT_SEARCH`,
        sort: "-views",
        maxResults: "10",
      }),
    ]);
    return {
      sources: reportRows(sources).map((r) => ({ source: r.insightTrafficSourceType, views: num(r.views) })),
      searchTerms: reportRows(searches).map((r) => ({ term: r.insightTrafficSourceDetail, views: num(r.views) })),
    };
  });
}

const REPORT_REUSE_MINUTES = 10;

/**
 * POST /api/my-channel/videos/:videoId/report { locale, refresh? }: the AI's
 * plan to bring one of the user's videos back (Groq). Saved per video and
 * language: reopening it is free, a new one can be asked for after a few minutes.
 */
export async function report(req, res) {
  const { videoId } = req.params;
  const locale = req.body?.locale === "en" ? "en" : "fr";
  const row = await myChannel(req.user.id);
  if (!requireChannel(row, res)) return;

  const [saved] = await sql`
    SELECT report, created_at FROM video_revival_reports
    WHERE user_id = ${req.user.id} AND youtube_video_id = ${videoId} AND locale = ${locale}`;
  const fresh = saved && Date.now() - new Date(saved.created_at).getTime() < REPORT_REUSE_MINUTES * 60_000;
  if (saved && (!req.body?.refresh || fresh)) {
    return res.json({ report: saved.report, createdAt: iso(saved.created_at), cached: true });
  }
  if (!aiEnabled()) return res.status(503).json({ error: "L'IA n'est pas configurée sur ce serveur (GROQ_API_KEY).", code: "ai_disabled" });

  const [video] = await revivalRows(row, { videoId });
  if (!video) return res.status(404).json({ error: "Cette vidéo n'est pas sur ta chaîne." });
  const v = video.row;

  const [bestTitles, titleHistory] = await Promise.all([
    sql`
      SELECT title, outlier_multiplier FROM videos
      WHERE channel_id = ${row.id} AND published_at > now() - interval '2 years' AND youtube_video_id <> ${videoId}
        AND is_short = ${Boolean(v.is_short)}
      ORDER BY outlier_multiplier DESC NULLS LAST LIMIT 5`,
    sql`
      SELECT value FROM video_variants WHERE youtube_video_id = ${videoId} AND kind = 'title'
      ORDER BY coalesce(set_at, first_seen_at)`,
  ]);

  let traffic = null;
  const account = await youtubeAccount(req.user.id);
  if (account.analytics && row.youtube_linked_at) {
    traffic = await trafficSources(req.user.id, account.accountId, videoId).catch((err) => {
      console.error("[my-channel] traffic sources:", err.message);
      return null;
    });
  }

  const ageDays = Math.round((Date.now() - new Date(v.published_at).getTime()) / DAY_MS);
  const context = [
    `Title: ${v.title}`,
    titleHistory.length > 1 && `Previous titles: ${titleHistory.slice(0, -1).map((t) => `"${t.value}"`).join(", ")}`,
    v.thumbnail_variants > 1 && `Thumbnail changed ${v.thumbnail_variants - 1} time(s) since publishing`,
    `Format: ${v.is_short ? "YouTube Short" : `long-form video (${v.duration_formatted ?? "?"})`}`,
    `Published ${ageDays} days ago`,
    v.niche && `Niche: ${NICHE_BY_ID[v.niche]?.label?.en ?? v.niche}${v.sub_niche ? ` / ${v.sub_niche}` : ""}`,
    v.lang && `Language: ${v.lang}`,
    `Views: ${video.views}, likes: ${v.like_count ?? "?"}, comments: ${v.comment_count ?? "?"}`,
    video.multiplier != null && `Outlier score at launch pace: ${video.multiplier.toFixed(1)}x the channel's usual views`,
    row.median_views && `Channel: ${row.name}, ${row.subscriber_count ?? "?"} subscribers, usual views per video ${row.median_views}`,
    video.measured
      ? `Recent pace: ${video.views48h} views per 48 h (measured over ${video.windowHours} h), lifetime average ${video.lifetimePerDay} views per day, so ${video.pace}x its lifetime pace`
      : "Recent pace: not measured yet",
    v.tags?.length && `Tags: ${v.tags.slice(0, 15).join(", ")}`,
    v.description && `Description (start): ${v.description.slice(0, 600).replace(/\s+/g, " ")}`,
    bestTitles.length && `Channel's best recent titles (same format): ${bestTitles.map((b) => `"${b.title}" (${Number(b.outlier_multiplier ?? 1).toFixed(1)}x)`).join("; ")}`,
    traffic?.sources?.length && `Traffic sources, last 28 days: ${traffic.sources.map((s) => `${s.source} ${s.views}`).join(", ")}`,
    traffic?.searchTerms?.length && `Top YouTube search terms, last 28 days: ${traffic.searchTerms.map((s) => `"${s.term}" ${s.views}`).join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  let result;
  try {
    result = await reviveVideoReport({ locale, context });
  } catch (err) {
    if (err instanceof AiRefusedError) return res.status(422).json({ error: "L'IA n'a pas pu écrire de rapport pour cette vidéo." });
    console.error("[my-channel] AI report failed:", err);
    return res.status(502).json({ error: "L'IA est indisponible pour le moment. Réessaie dans un instant." });
  }
  const full = { ...result, traffic };
  const [stored] = await sql`
    INSERT INTO video_revival_reports (user_id, youtube_video_id, locale, report)
    VALUES (${req.user.id}, ${videoId}, ${locale}, ${sql.json(full)})
    ON CONFLICT (user_id, youtube_video_id, locale) DO UPDATE SET report = excluded.report, created_at = now()
    RETURNING created_at`;
  res.json({ report: full, createdAt: iso(stored.created_at), cached: false });
}
