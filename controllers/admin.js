import { sql } from "../lib/sql.js";
import { parsePage } from "../lib/admin.js";

// Never sent to the browser, even to admins
const HIDDEN_COLUMNS = new Set(["password", "token", "accessToken", "refreshToken", "idToken", "key_hash"]);
// Newest rows first when the table has one of these
const SORT_COLUMNS = ["createdAt", "created_at", "captured_at", "added_at", "started_at", "first_seen_at", "detected_at", "rejected_at", "sent_at", "day"];

/** Headline counters for the admin home. */
export async function overview(req, res) {
  const [counts] = await sql`
    SELECT
      (SELECT count(*) FROM "user")::int AS users,
      (SELECT count(*) FROM "user" WHERE youtube_channel_id IS NOT NULL)::int AS "onboardedUsers",
      (SELECT count(*) FROM "user" WHERE "createdAt" > now() - interval '7 days')::int AS "newUsers7d",
      (SELECT count(*) FROM onboarding_analyses)::int AS onboardings,
      (SELECT count(*) FROM onboarding_analyses WHERE error IS NULL)::int AS "onboardingsOk",
      (SELECT count(*) FROM saved_folders)::int AS folders,
      (SELECT count(*) FROM saved_folder_items)::int AS "folderItems",
      (SELECT count(*) FROM tracked_channels)::int AS "trackedChannels",
      (SELECT count(*) FROM channels)::int AS channels,
      (SELECT count(*) FROM videos)::int AS videos,
      (SELECT count(*) FROM channel_alerts)::int AS alerts,
      (SELECT count(*) FROM (
        SELECT 1 FROM video_variants WHERE NOT (kind = 'thumbnail' AND value = '0')
        GROUP BY youtube_video_id, kind HAVING count(*) > 1
      ) t)::int AS "abTests"`;

  const recentUsers = await sql`
    SELECT id, email, name, role, "createdAt" FROM "user" ORDER BY "createdAt" DESC LIMIT 5`;
  const recentScans = await sql`
    SELECT id, started_at AS "startedAt", finished_at AS "finishedAt", status FROM scan_runs ORDER BY started_at DESC LIMIT 5`;

  res.json({
    counts,
    recentUsers,
    recentScans,
    posthogUrl: process.env.POSTHOG_PROJECT_URL || "https://us.posthog.com",
  });
}

/** Every account with its channel, competitors, folders and onboarding count. */
export async function users(req, res) {
  const { q } = parsePage(req.query);
  const like = `%${q}%`;

  const rows = await sql`
    SELECT u.id, u.email, u.name, u.image AS avatar, u.plan, u.role, u.banned, u."createdAt", u."updatedAt",
           u.youtube_channel_id AS "channelId", c.name AS "channelName", c.thumbnail_url AS "channelAvatar",
           c.subscriber_count AS "channelSubscribers",
           COALESCE((
             SELECT json_agg(json_build_object('id', x.id, 'name', cc.name, 'avatar', cc.thumbnail_url) ORDER BY x.ord)
             FROM unnest(u.competitor_channel_ids) WITH ORDINALITY AS x(id, ord)
             LEFT JOIN channels cc ON cc.youtube_channel_id = x.id
           ), '[]') AS competitors,
           (SELECT count(*) FROM saved_folders f WHERE f.user_id = u.id)::int AS folders,
           (SELECT count(*) FROM saved_folder_items i JOIN saved_folders f ON f.id = i.folder_id WHERE f.user_id = u.id)::int AS "folderItems",
           (SELECT count(*) FROM onboarding_analyses o WHERE o.user_id = u.id)::int AS onboardings
    FROM "user" u
    LEFT JOIN channels c ON c.youtube_channel_id = u.youtube_channel_id
    WHERE ${q ? sql`(u.email ILIKE ${like} OR u.name ILIKE ${like} OR u.id ILIKE ${like} OR c.name ILIKE ${like})` : sql`true`}
    ORDER BY u."createdAt" DESC`;

  res.json({ users: rows });
}

/** Onboarding analyses: competitors found by the engine and the AI's explanation. */
export async function onboardings(req, res) {
  const { q, size, offset } = parsePage(req.query, 25);
  const like = `%${q}%`;
  const where = q
    ? sql`(u.email ILIKE ${like} OR o.input_channel ILIKE ${like} OR o.reference->>'title' ILIKE ${like} OR o.competitors::text ILIKE ${like})`
    : sql`true`;

  const [{ total }] = await sql`
    SELECT count(*)::int AS total FROM onboarding_analyses o LEFT JOIN "user" u ON u.id = o.user_id WHERE ${where}`;
  const rows = await sql`
    SELECT o.id, o.user_id AS "userId", u.email, u.name, o.input_channel AS "inputChannel", o.niche, o.role,
           o.reference, o.competitors, o.insights, o.error, o.duration_ms AS "durationMs", o.created_at AS "createdAt"
    FROM onboarding_analyses o LEFT JOIN "user" u ON u.id = o.user_id
    WHERE ${where}
    ORDER BY o.created_at DESC
    LIMIT ${size} OFFSET ${offset}`;

  res.json({ total, rows });
}

/** Every user's saved folders with their items. */
export async function folders(req, res) {
  const { q } = parsePage(req.query);
  const like = `%${q}%`;

  const rows = await sql`
    SELECT f.id, f.name, f.created_at AS "createdAt", f.updated_at AS "updatedAt",
           u.id AS "userId", u.email, u.name AS "userName",
           COALESCE((
             SELECT json_agg(json_build_object('type', i.item_type, 'id', i.item_id, 'snapshot', i.snapshot, 'addedAt', i.added_at) ORDER BY i.added_at DESC)
             FROM saved_folder_items i WHERE i.folder_id = f.id
           ), '[]') AS items
    FROM saved_folders f JOIN "user" u ON u.id = f.user_id
    WHERE ${q ? sql`(f.name ILIKE ${like} OR u.email ILIKE ${like} OR EXISTS (
      SELECT 1 FROM saved_folder_items i WHERE i.folder_id = f.id AND i.snapshot::text ILIKE ${like}))` : sql`true`}
    ORDER BY f.updated_at DESC`;

  res.json({ folders: rows });
}

/** Channels followed on /tracking, and the channels users picked at onboarding. */
export async function tracked(req, res) {
  const { q } = parsePage(req.query);
  const like = `%${q}%`;

  const trackedRows = await sql`
    SELECT t.id, t.channel_id AS "channelId", t.name, t.handle, t.avatar, t.subscribers, t.total_views AS "totalViews",
           t.video_count AS "videoCount", t.tags, t.notes, t.baseline_views AS "baselineViews",
           t.last_checked_at AS "lastCheckedAt", t.added_at AS "addedAt", f.name AS "folderName"
    FROM tracked_channels t LEFT JOIN folders f ON f.id::text = t.folder_id::text
    WHERE ${q ? sql`(t.name ILIKE ${like} OR t.handle ILIKE ${like} OR t.channel_id ILIKE ${like})` : sql`true`}
    ORDER BY t.added_at DESC`;

  // Chosen at onboarding, as "my channel" or as a competitor
  const picked = await sql`
    SELECT x.id AS "channelId", c.name, c.thumbnail_url AS avatar, c.subscriber_count AS subscribers,
           count(*) FILTER (WHERE x.kind = 'own')::int AS "asOwn",
           count(*) FILTER (WHERE x.kind = 'competitor')::int AS "asCompetitor"
    FROM (
      SELECT youtube_channel_id AS id, 'own' AS kind FROM "user" WHERE youtube_channel_id IS NOT NULL
      UNION ALL
      SELECT unnest(competitor_channel_ids), 'competitor' FROM "user"
    ) x LEFT JOIN channels c ON c.youtube_channel_id = x.id
    WHERE ${q ? sql`(c.name ILIKE ${like} OR x.id ILIKE ${like})` : sql`true`}
    GROUP BY x.id, c.name, c.thumbnail_url, c.subscriber_count
    ORDER BY count(*) DESC`;

  res.json({ tracked: trackedRows, picked });
}

/**
 * Videos whose title or thumbnail changed after publishing (more than one row in
 * video_variants): the A/B tests and post-publish edits the scanner detected.
 */
export async function abTests(req, res) {
  const { q, size, offset } = parsePage(req.query, 30);
  const kind = req.query.kind;
  const like = `%${q}%`;
  const kindFilter = kind === "title" || kind === "thumbnail" ? sql`AND kind = ${kind}` : sql``;
  const search = q ? sql`AND (v.title ILIKE ${like} OR c.name ILIKE ${like} OR t.youtube_video_id ILIKE ${like})` : sql``;

  const base = sql`
    WITH tests AS (
      SELECT youtube_video_id, kind, count(*)::int AS variants, max(first_seen_at) AS last_change
      -- ETag "0" is the CDN's answer for an auto-generated frame, not a version
      FROM video_variants WHERE NOT (kind = 'thumbnail' AND value = '0') ${kindFilter}
      GROUP BY youtube_video_id, kind HAVING count(*) > 1
    )
    SELECT t.*, v.title, v.thumbnail_url, v.view_count, v.outlier_multiplier, v.published_at,
           c.name AS channel_name, c.youtube_channel_id
    FROM tests t
    LEFT JOIN videos v ON v.youtube_video_id = t.youtube_video_id
    LEFT JOIN channels c ON c.id = v.channel_id
    WHERE true ${search}`;

  const [{ total }] = await sql`SELECT count(*)::int AS total FROM (${base}) x`;
  const tests = await sql`SELECT * FROM (${base}) x ORDER BY last_change DESC LIMIT ${size} OFFSET ${offset}`;

  const ids = tests.map((t) => t.youtube_video_id);
  const variants = ids.length
    ? await sql`
        SELECT youtube_video_id, kind, value, set_at, first_seen_at, last_seen_at, image IS NOT NULL AS has_image
        FROM video_variants
        WHERE youtube_video_id = ANY(${ids}) AND NOT (kind = 'thumbnail' AND value = '0') ${kindFilter}
        ORDER BY COALESCE(set_at, first_seen_at)`
    : [];
  // The newest version is still the one on YouTube: shown live until the worker saves it.
  const latest = new Map(variants.map((v) => [`${v.youtube_video_id}:${v.kind}`, v.value]));

  res.json({
    total,
    tests: tests.map((t) => ({
      videoId: t.youtube_video_id,
      kind: t.kind,
      variants: t.variants,
      lastChange: t.last_change,
      title: t.title,
      thumbnail: t.thumbnail_url,
      views: t.view_count,
      multiplier: t.outlier_multiplier,
      publishedAt: t.published_at,
      channelName: t.channel_name,
      channelId: t.youtube_channel_id,
      history: variants
        .filter((v) => v.youtube_video_id === t.youtube_video_id && v.kind === t.kind)
        .map((v) => ({
          value: v.value,
          setAt: v.set_at,
          firstSeenAt: v.first_seen_at,
          lastSeenAt: v.last_seen_at,
          image: v.has_image
            ? `/api/admin/thumbnails?video=${encodeURIComponent(v.youtube_video_id)}&etag=${encodeURIComponent(v.value)}`
            : v.kind === "thumbnail" && latest.get(`${v.youtube_video_id}:${v.kind}`) === v.value
              ? `https://i.ytimg.com/vi/${encodeURIComponent(v.youtube_video_id)}/mqdefault.jpg`
              : null,
        })),
    })),
  });
}

/** The saved picture of one thumbnail version (video_variants.image). */
export async function thumbnail(req, res) {
  const video = String(req.query.video ?? "");
  const etag = String(req.query.etag ?? "");

  const [row] = await sql`
    SELECT image FROM video_variants
    WHERE youtube_video_id = ${video} AND kind = 'thumbnail' AND value = ${etag} AND image IS NOT NULL`;
  if (!row) return res.status(404).json({ error: "Image introuvable." });

  res.set({
    "Content-Type": "image/jpeg",
    // A version never changes once saved
    "Cache-Control": "private, max-age=31536000, immutable",
  });
  res.send(row.image);
}

/** Public PostgreSQL tables with their row count and size. */
export async function tables(req, res) {
  const rows = await sql`
    SELECT c.relname AS name, pg_total_relation_size(c.oid)::bigint AS bytes
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname`;

  // Exact counts are cheap at this scale and the estimate is -1 on never-analyzed tables
  const withCounts = await Promise.all(
    rows.map(async (t) => {
      const [{ count }] = await sql`SELECT count(*)::int AS count FROM ${sql(t.name)}`;
      return { name: t.name, rows: count, bytes: Number(t.bytes) };
    })
  );

  res.json({ tables: withCounts });
}

/** One page of rows of a public table, optionally filtered by a text search over the whole row. */
export async function tableRows(req, res) {
  const { name } = req.params;
  const { page, size, offset, q } = parsePage(req.query);

  // The name only reaches SQL once it matches a real table
  const columns = await sql`
    SELECT column_name AS name, data_type AS type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${name} ORDER BY ordinal_position`;
  if (columns.length === 0) return res.status(404).json({ error: "Table inconnue." });

  // Binary columns (thumbnail images) are left out: shown on the A/B tests tab instead
  const shown = columns.filter((c) => !HIDDEN_COLUMNS.has(c.name) && c.type !== "bytea");
  const visible = shown.map((c) => c.name);
  const sortColumn = SORT_COLUMNS.find((s) => visible.includes(s));
  const table = sql(name);
  // Search the visible columns only, so hidden values can't be guessed through it
  const where = q ? sql`WHERE ROW(${sql(visible)})::text ILIKE ${`%${q}%`}` : sql``;
  const order = sortColumn ? sql`ORDER BY ${sql(sortColumn)} DESC NULLS LAST` : sql``;

  const [{ total }] = await sql`SELECT count(*)::int AS total FROM ${table} t ${where}`;
  const rows = await sql`SELECT ${sql(visible)} FROM ${table} t ${where} ${order} LIMIT ${size} OFFSET ${offset}`;

  res.json({ name, columns: shown, total, page, size, rows });
}
