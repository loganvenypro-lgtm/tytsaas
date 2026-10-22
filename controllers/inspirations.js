import crypto from "node:crypto";
import { sql } from "../lib/sql.js";
import { inWorkspace } from "../lib/teams.js";
import { NOTES_MAX, TAGS_PER_CHANNEL, TAG_MAX, parseChannelId, parseListQuery, parsePatch, parseTags } from "../lib/inspirations.js";

const num = (value) => (value != null ? Number(value) : null);
const iso = (value) => (value ? new Date(value).toISOString() : null);

const VIDEOS_PER_CHANNEL = 8;
const PATCH_ERROR = `Tags (${TAGS_PER_CHANNEL} max, ${TAG_MAX} caractères chacun) ou notes (${NOTES_MAX} caractères max) invalides.`;

// Outlr's imports (tracked_channels rows not added by a follow here)
const OUTLR_ROWS = sql`tc.id NOT LIKE 'insp\\_%'`;

/**
 * Competitors live in "user".competitor_channel_ids too (onboarding writes it,
 * the home page reads it): rows follow that list, keeping their tags and notes.
 * Only in the personal space: a team's competitors are its own list.
 */
async function syncCompetitors(ws) {
  if (ws.teamId) return;
  const { userId } = ws;
  await sql`
    WITH u AS (SELECT competitor_channel_ids AS ids FROM "user" WHERE id = ${userId}),
    removed AS (
      DELETE FROM inspiration_channels f USING u
      WHERE ${inWorkspace(ws, "f")} AND f.kind = 'competitor' AND NOT (f.channel_id = ANY(u.ids))
    )
    INSERT INTO inspiration_channels (user_id, kind, channel_id)
    SELECT ${userId}, 'competitor', id FROM u, unnest(u.ids) AS id
    ON CONFLICT DO NOTHING`;
}

/** A video `v` that counts as an outlier at the chosen threshold and format (livestreams left out). */
function outlierWhere({ minMultiplier, format }) {
  const formatWhere = format === "short" ? sql`AND v.is_short` : format === "long" ? sql`AND NOT v.is_short` : sql``;
  return sql`v.outlier_multiplier >= ${minMultiplier} AND NOT v.is_livestream ${formatWhere}`;
}

/** The latest outliers of each channel over the period. */
async function latestOutliers(internalIds, options) {
  if (!internalIds.length) return [];
  return sql`
    SELECT * FROM (
      SELECT v.channel_id, v.youtube_video_id, v.title, v.thumbnail_url, v.view_count, v.outlier_multiplier,
        v.published_at, v.is_short, v.duration_formatted,
        row_number() OVER (PARTITION BY v.channel_id ORDER BY v.published_at DESC) AS rank
      FROM videos v
      WHERE v.channel_id IN ${sql(internalIds)}
        AND v.published_at > now() - make_interval(days => ${options.period})
        AND ${outlierWhere(options)}
    ) ranked
    WHERE rank <= ${VIDEOS_PER_CHANNEL}`;
}

const videoJson = (v, seenAt) => ({
  id: v.youtube_video_id,
  title: v.title,
  thumbnail: v.thumbnail_url || `https://i.ytimg.com/vi/${v.youtube_video_id}/hqdefault.jpg`,
  views: Number(v.view_count ?? 0),
  multiplier: num(v.outlier_multiplier),
  publishedAt: iso(v.published_at),
  isShort: Boolean(v.is_short),
  duration: v.duration_formatted ?? null,
  isNew: seenAt ? new Date(v.published_at) > new Date(seenAt) : false,
});

const statsSelect = (outlier, period, seenAt) => sql`
  LEFT JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE ${outlier})::int AS outliers,
      count(*) FILTER (WHERE ${outlier} AND v.published_at > ${seenAt})::int AS new_outliers,
      max(v.outlier_multiplier) FILTER (WHERE ${outlier}) AS best_multiplier,
      max(v.published_at) FILTER (WHERE ${outlier}) AS last_outlier_at,
      max(v.published_at) AS last_upload_at,
      count(*)::int AS uploads
    FROM videos v
    WHERE v.channel_id = c.id AND v.published_at > now() - make_interval(days => ${period})
  ) s ON true`;

const channelJson = (r) => ({
  id: r.youtube_channel_id,
  name: r.name,
  handle: r.handle ?? null,
  avatar: r.thumbnail_url ?? null,
  subscribers: num(r.subscriber_count),
  medianViews: num(r.median_views),
  uploadsPerWeek: num(r.uploads_per_week),
  outlierRate: num(r.outlier_rate),
  niche: r.niche ?? null,
  subNiche: r.sub_niche ?? null,
  style: r.primary_format ?? null,
  isShortsChannel: Number(r.short_share) >= 0.5,
  language: r.lang ?? null,
  country: r.country ?? null,
  terminated: Boolean(r.terminated_at),
  outliers: Number(r.outliers ?? 0),
  newOutliers: Number(r.new_outliers ?? 0),
  bestMultiplier: num(r.best_multiplier),
  lastOutlierAt: iso(r.last_outlier_at),
  lastUploadAt: iso(r.last_upload_at),
  uploads: Number(r.uploads ?? 0),
});

const CHANNEL_COLUMNS = sql`
  c.id, c.youtube_channel_id, c.name, c.handle, c.thumbnail_url, c.subscriber_count, c.median_views, c.uploads_per_week,
  c.outlier_rate, c.niche, c.sub_niche, c.primary_format, c.short_share, c.lang, c.country, c.terminated_at,
  s.outliers, s.new_outliers, s.best_multiplier, s.last_outlier_at, s.last_upload_at, s.uploads`;

/**
 * The channels the user follows (inspirations or competitors), each with its
 * outliers over the period (latest first), how many came out since the last
 * visit, and the user's tags and notes. Outliers are the worker's
 * outlier_multiplier (views vs the channel's usual views); livestreams are left
 * out. Competitors also get the user's own channel, to compare with.
 * PostgreSQL only, no YouTube quota. Tag and text filters run in the browser.
 */
export const list = (kind) => async (req, res) => {
  const options = parseListQuery(req.query);
  if (kind === "competitor") await syncCompetitors(req.workspace);
  const outlier = outlierWhere(options);

  const rows = await sql`
    SELECT f.tags, f.notes, f.followed_at, f.seen_at, ${CHANNEL_COLUMNS}
    FROM inspiration_channels f
    JOIN channels c ON c.youtube_channel_id = f.channel_id
    ${statsSelect(outlier, options.period, sql`f.seen_at`)}
    WHERE ${inWorkspace(req.workspace, "f")} AND f.kind = ${kind}`;

  const videos = await latestOutliers(rows.map((r) => r.id), options);
  const byChannel = new Map();
  for (const v of videos) byChannel.set(v.channel_id, [...(byChannel.get(v.channel_id) ?? []), v]);

  const [{ importable }] = await sql`
    SELECT count(*)::int AS importable FROM tracked_channels tc
    WHERE ${OUTLR_ROWS} AND EXISTS (SELECT 1 FROM channels c WHERE c.youtube_channel_id = tc.channel_id)
      AND NOT EXISTS (SELECT 1 FROM inspiration_channels f
        WHERE ${inWorkspace(req.workspace, "f")} AND f.kind = ${kind} AND f.channel_id = tc.channel_id)`;

  // My channel, with the same stats, for the side-by-side comparison
  let me = null;
  if (kind === "competitor") {
    const [row] = await sql`
      SELECT ${CHANNEL_COLUMNS}
      FROM "user" u
      JOIN channels c ON c.youtube_channel_id = u.youtube_channel_id
      ${statsSelect(outlier, options.period, sql`now()`)}
      WHERE u.id = ${req.user.id}`;
    me = row ? channelJson(row) : null;
  }

  const channels = rows.map((r) => ({
    ...channelJson(r),
    tags: r.tags ?? [],
    notes: r.notes ?? null,
    followedAt: iso(r.followed_at),
    seenAt: iso(r.seen_at),
    videos: (byChannel.get(r.id) ?? []).map((v) => videoJson(v, r.seen_at)),
  }));

  res.json({ channels, me, importable, ...options });
};

/** YouTube ids of the followed channels, by kind, for the "Follow" menus elsewhere in the app. */
export async function ids(req, res) {
  await syncCompetitors(req.workspace);
  const rows = await sql`SELECT kind, channel_id FROM inspiration_channels WHERE ${inWorkspace(req.workspace)}`;
  const out = { inspiration: [], competitor: [] };
  for (const r of rows) out[r.kind]?.push(r.channel_id);
  res.json(out);
}

/** Channels of the database matching a name, @handle or channel id, to follow one. */
export async function searchChannels(req, res) {
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  if (q.length < 2) return res.json({ channels: [] });
  const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const rows = await sql`
    SELECT youtube_channel_id, name, handle, thumbnail_url, subscriber_count, niche
    FROM channels
    WHERE youtube_channel_id = ${q} OR name ILIKE ${like} OR handle ILIKE ${like}
    ORDER BY (lower(name) = lower(${q}) OR lower(handle) = lower(${q.startsWith("@") ? q : `@${q}`})) DESC,
      subscriber_count DESC NULLS LAST
    LIMIT 8`;
  res.json({
    channels: rows.map((r) => ({
      id: r.youtube_channel_id,
      name: r.name,
      handle: r.handle ?? null,
      avatar: r.thumbnail_url ?? null,
      subscribers: num(r.subscriber_count),
      niche: r.niche ?? null,
    })),
  });
}

/**
 * Puts a followed channel on the worker's watch list (tracked_channels), so its
 * feed is read first and its fresh videos refreshed more often. RSS is free;
 * the extra stats refreshes cost a few units per day per channel.
 */
async function watch(tx, channelIds) {
  for (const channelId of channelIds) {
    await tx`
      INSERT INTO tracked_channels (id, channel_id, name, handle, avatar, subscribers, total_views, video_count, tags, notes)
      SELECT ${`insp_${crypto.randomBytes(6).toString("hex")}`}, c.youtube_channel_id, c.name, c.handle, c.thumbnail_url,
        LEAST(coalesce(c.subscriber_count, 0), 2147483647), coalesce(c.total_views, 0), LEAST(coalesce(c.video_count, 0), 2147483647),
        '{Inspiration}', NULL
      FROM channels c WHERE c.youtube_channel_id = ${channelId}
      ON CONFLICT (channel_id) DO NOTHING`;
  }
}

/** Keeps "user".competitor_channel_ids in step with the personal competitor rows. */
async function writeCompetitorIds(tx, ws) {
  if (ws.teamId) return;
  await tx`
    UPDATE "user" SET competitor_channel_ids = coalesce((
      SELECT array_agg(channel_id ORDER BY followed_at) FROM inspiration_channels
      WHERE ${inWorkspace(ws)} AND kind = 'competitor'), '{}')
    WHERE id = ${ws.userId}`;
}

/** Follow a channel the database knows (`{ channelId, tags? }`). Following it again keeps its tags and notes. */
export const follow = (kind) => async (req, res) => {
  const channelId = parseChannelId(req.body?.channelId);
  if (!channelId) return res.status(400).json({ error: "Chaîne invalide." });
  const tags = req.body?.tags !== undefined ? parseTags(req.body.tags) : [];
  if (!tags) return res.status(400).json({ error: PATCH_ERROR });

  const [known] = await sql`SELECT 1 FROM channels WHERE youtube_channel_id = ${channelId}`;
  if (!known) return res.status(404).json({ error: "Cette chaîne n'est pas encore dans la base." });

  if (kind === "competitor") await syncCompetitors(req.workspace);
  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO inspiration_channels (user_id, organization_id, kind, channel_id, tags)
      VALUES (${req.user.id}, ${req.workspace.teamId}, ${kind}, ${channelId}, ${tags})
      ON CONFLICT DO NOTHING`;
    if (kind === "competitor") await writeCompetitorIds(tx, req.workspace);
    await watch(tx, [channelId]);
  });
  res.status(201).json({ followed: true });
};

/**
 * Unfollow. The channel leaves the worker's watch list too when this feature
 * added it there and nobody follows it any more; Outlr's imports stay.
 */
export const unfollow = (kind) => async (req, res) => {
  const channelId = parseChannelId(req.params.channelId);
  if (!channelId) return res.status(400).json({ error: "Chaîne invalide." });
  if (kind === "competitor") await syncCompetitors(req.workspace);
  await sql.begin(async (tx) => {
    await tx`DELETE FROM inspiration_channels WHERE ${inWorkspace(req.workspace)} AND kind = ${kind} AND channel_id = ${channelId}`;
    if (kind === "competitor") await writeCompetitorIds(tx, req.workspace);
    await tx`
      DELETE FROM tracked_channels tc
      WHERE tc.channel_id = ${channelId} AND tc.id LIKE 'insp\\_%'
        AND NOT EXISTS (SELECT 1 FROM inspiration_channels f WHERE f.channel_id = tc.channel_id)
        AND NOT EXISTS (SELECT 1 FROM "user" u WHERE tc.channel_id = ANY(u.competitor_channel_ids))`;
  });
  res.json({ followed: false });
};

/** Edit a followed channel's tags and/or notes. */
export const update = (kind) => async (req, res) => {
  const channelId = parseChannelId(req.params.channelId);
  const patch = parsePatch(req.body);
  if (!channelId || !patch) return res.status(400).json({ error: PATCH_ERROR });

  const [row] = await sql`
    UPDATE inspiration_channels SET
      tags = ${patch.tags !== undefined ? sql`${patch.tags}` : sql`tags`},
      notes = ${patch.notes !== undefined ? sql`${patch.notes}` : sql`notes`}
    WHERE ${inWorkspace(req.workspace)} AND kind = ${kind} AND channel_id = ${channelId}
    RETURNING tags, notes`;
  if (!row) return res.status(404).json({ error: "Tu ne suis pas cette chaîne." });
  res.json({ tags: row.tags, notes: row.notes });
};

/** The page was seen: outliers published until now stop being "new". */
export const markSeen = (kind) => async (req, res) => {
  await sql`UPDATE inspiration_channels SET seen_at = now() WHERE ${inWorkspace(req.workspace)} AND kind = ${kind}`;
  res.json({ ok: true });
};

/** Follow the channels imported from Outlr (tracked_channels), with their tags and notes. */
export const importOutlr = (kind) => async (req, res) => {
  if (kind === "competitor") await syncCompetitors(req.workspace);
  const rows = await sql.begin(async (tx) => {
    const inserted = await tx`
      INSERT INTO inspiration_channels (user_id, organization_id, kind, channel_id, tags, notes)
      SELECT ${req.user.id}, ${req.workspace.teamId}, ${kind}, tc.channel_id, coalesce(tc.tags, '{}'),
        -- Outlr wrote 'Découvert dans la niche ""' when it had no niche: nothing to keep
        CASE WHEN tc.notes ~ '^\\s*Découvert dans la niche\\s*""\\s*$' THEN NULL ELSE nullif(left(trim(tc.notes), ${NOTES_MAX}), '') END
      FROM tracked_channels tc
      WHERE ${OUTLR_ROWS} AND EXISTS (SELECT 1 FROM channels c WHERE c.youtube_channel_id = tc.channel_id)
      ON CONFLICT DO NOTHING
      RETURNING channel_id`;
    if (kind === "competitor") await writeCompetitorIds(tx, req.workspace);
    return inserted;
  });
  res.status(201).json({ imported: rows.length });
};
