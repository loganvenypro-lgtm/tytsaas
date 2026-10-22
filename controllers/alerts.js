import crypto from "node:crypto";
import { sql } from "../lib/sql.js";
import { sendDiscord } from "../lib/discord.js";
import { VIDEO_COLUMNS, toVideoJson } from "../lib/videoRows.js";
import { alertDiscordPayload, alertWhere, isNarrow, maskWebhook, parseRule } from "../lib/alerts.js";

const MAX_ALERTS = 20;
const PREVIEW_SIZE = 20;
const FEED_SIZE = 60;
const NARROW_ERROR = "Ajoute au moins un critère (mots-clés, niche, seuil…) ou limite l'alerte à tes concurrents ou inspirations.";

function alertJson(r) {
  return {
    id: r.id,
    name: r.name,
    filters: r.filters ?? {},
    source: r.source,
    frequency: r.frequency,
    discordWebhook: maskWebhook(r.discord_webhook),
    enabled: r.enabled,
    createdAt: r.created_at,
    lastCheckedAt: r.last_checked_at,
    lastSentAt: r.last_sent_at,
    unread: Number(r.unread ?? 0),
    matches: Number(r.matches ?? 0),
  };
}

const ALERT_COLUMNS = sql`
  a.*,
  (SELECT count(*) FROM alert_matches m WHERE m.alert_id = a.id AND m.read_at IS NULL)::int AS unread,
  (SELECT count(*) FROM alert_matches m WHERE m.alert_id = a.id)::int AS matches`;

/** The user's alerts, oldest first (the order they were set up in). */
export async function list(req, res) {
  const rows = await sql`SELECT ${ALERT_COLUMNS} FROM alert_rules a WHERE a.user_id = ${req.user.id} ORDER BY a.created_at`;
  res.json({ alerts: rows.map(alertJson) });
}

/** Unread matches of every alert, for the sidebar badge. */
export async function unread(req, res) {
  const [{ count }] = await sql`
    SELECT count(*)::int AS count FROM alert_matches m JOIN alert_rules a ON a.id = m.alert_id
    WHERE a.user_id = ${req.user.id} AND m.read_at IS NULL`;
  res.json({ count });
}

/** The videos a rule matches right now (fastest first), without saving anything. */
export async function preview(req, res) {
  const { rule, error } = parseRule(req.body?.rule ?? req.body);
  if (error) return res.status(400).json({ error });
  if (!isNarrow(rule)) return res.json({ items: [], total: 0, narrow: false });
  const where = alertWhere(rule, req.user.id);
  const [items, [{ total }]] = await Promise.all([
    sql`
      SELECT ${VIDEO_COLUMNS} FROM videos v JOIN channels c ON c.id = v.channel_id
      WHERE ${where}
      ORDER BY v.views_per_hour DESC NULLS LAST
      LIMIT ${PREVIEW_SIZE}`,
    sql`SELECT count(*)::int AS total FROM videos v JOIN channels c ON c.id = v.channel_id WHERE ${where}`,
  ]);
  res.json({ items: items.map(toVideoJson), total, narrow: true });
}

/**
 * Create an alert. What it already matches is recorded as seen, so it only
 * alerts on videos that show up from now on (the preview showed the rest).
 */
export async function create(req, res) {
  const { rule, error } = parseRule(req.body);
  if (error) return res.status(400).json({ error });
  if (!isNarrow(rule)) return res.status(400).json({ error: NARROW_ERROR });
  const [{ count }] = await sql`SELECT count(*)::int AS count FROM alert_rules WHERE user_id = ${req.user.id}`;
  if (count >= MAX_ALERTS) return res.status(400).json({ error: `${MAX_ALERTS} alertes maximum.` });

  const id = `alr_${crypto.randomBytes(8).toString("hex")}`;
  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO alert_rules (id, user_id, name, filters, source, frequency, discord_webhook, enabled, last_checked_at)
      VALUES (${id}, ${req.user.id}, ${rule.name}, ${tx.json(rule.filters)}, ${rule.source}, ${rule.frequency},
        ${rule.discordWebhook ?? null}, ${rule.enabled ?? true}, now())`;
    await tx`
      INSERT INTO alert_matches (alert_id, video_id, notified_at, read_at)
      SELECT ${id}, v.youtube_video_id, now(), now()
      FROM videos v JOIN channels c ON c.id = v.channel_id
      WHERE ${alertWhere(rule, req.user.id)}
      ON CONFLICT DO NOTHING`;
  });
  const [row] = await sql`SELECT ${ALERT_COLUMNS} FROM alert_rules a WHERE a.id = ${id}`;
  res.status(201).json({ alert: alertJson(row) });
}

/** Edit an alert. A new filter or source starts over: what it matches now counts as seen. */
export async function update(req, res) {
  const { rule, error } = parseRule(req.body, { partial: true });
  if (error) return res.status(400).json({ error });
  const [current] = await sql`SELECT * FROM alert_rules WHERE id = ${req.params.alertId} AND user_id = ${req.user.id}`;
  if (!current) return res.status(404).json({ error: "Alerte introuvable." });

  const next = { filters: rule.filters ?? current.filters, source: rule.source ?? current.source };
  if (!isNarrow(next)) return res.status(400).json({ error: NARROW_ERROR });
  const rematch = rule.filters !== undefined || rule.source !== undefined;

  await sql.begin(async (tx) => {
    await tx`
      UPDATE alert_rules SET
        name = ${rule.name ?? current.name},
        filters = ${tx.json(next.filters)},
        source = ${next.source},
        frequency = ${rule.frequency ?? current.frequency},
        discord_webhook = ${rule.discordWebhook !== undefined ? rule.discordWebhook : current.discord_webhook},
        enabled = ${rule.enabled ?? current.enabled},
        updated_at = now()
      WHERE id = ${current.id}`;
    if (rematch) {
      await tx`
        INSERT INTO alert_matches (alert_id, video_id, notified_at, read_at)
        SELECT ${current.id}, v.youtube_video_id, now(), now()
        FROM videos v JOIN channels c ON c.id = v.channel_id
        WHERE ${alertWhere(next, req.user.id)}
        ON CONFLICT DO NOTHING`;
    }
  });
  const [row] = await sql`SELECT ${ALERT_COLUMNS} FROM alert_rules a WHERE a.id = ${current.id}`;
  res.json({ alert: alertJson(row) });
}

export async function remove(req, res) {
  const { count } = await sql`DELETE FROM alert_rules WHERE id = ${req.params.alertId} AND user_id = ${req.user.id}`;
  if (!count) return res.status(404).json({ error: "Alerte introuvable." });
  res.json({ ok: true });
}

/** Matched videos, newest match first: every alert, or one (`?alert=`), optionally unread only. */
export async function feed(req, res) {
  const alertId = typeof req.query.alert === "string" && req.query.alert ? req.query.alert : null;
  const unreadOnly = req.query.unread === "true";
  const rows = await sql`
    SELECT ${VIDEO_COLUMNS}, m.alert_id, m.matched_at, m.read_at, a.name AS alert_name
    FROM alert_matches m
    JOIN alert_rules a ON a.id = m.alert_id
    JOIN videos v ON v.youtube_video_id = m.video_id
    JOIN channels c ON c.id = v.channel_id
    WHERE a.user_id = ${req.user.id}
      ${alertId ? sql`AND a.id = ${alertId}` : sql``}
      ${unreadOnly ? sql`AND m.read_at IS NULL` : sql``}
    ORDER BY m.matched_at DESC, v.views_per_hour DESC NULLS LAST
    LIMIT ${FEED_SIZE}`;
  res.json({
    items: rows.map((r) => ({
      ...toVideoJson(r),
      alert: { id: r.alert_id, name: r.alert_name },
      matchedAt: r.matched_at,
      unread: r.read_at == null,
    })),
  });
}

/** Mark matches as read: one alert (`{ alertId }`) or all of them. */
export async function markRead(req, res) {
  const alertId = typeof req.body?.alertId === "string" ? req.body.alertId : null;
  await sql`
    UPDATE alert_matches m SET read_at = now()
    FROM alert_rules a
    WHERE a.id = m.alert_id AND a.user_id = ${req.user.id} AND m.read_at IS NULL
      ${alertId ? sql`AND a.id = ${alertId}` : sql``}`;
  res.json({ ok: true });
}

/** Sends a sample of the alert's current videos to its Discord webhook. */
export async function testDiscord(req, res) {
  const [rule] = await sql`SELECT * FROM alert_rules WHERE id = ${req.params.alertId} AND user_id = ${req.user.id}`;
  if (!rule) return res.status(404).json({ error: "Alerte introuvable." });
  if (!rule.discord_webhook) return res.status(400).json({ error: "Cette alerte n'a pas de webhook Discord." });
  const videos = await sql`
    SELECT ${VIDEO_COLUMNS} FROM videos v JOIN channels c ON c.id = v.channel_id
    WHERE ${alertWhere(rule, req.user.id)}
    ORDER BY v.views_per_hour DESC NULLS LAST
    LIMIT 3`;
  const ok = await sendDiscord(rule.discord_webhook, alertDiscordPayload(rule, videos, { test: true }));
  if (!ok) return res.status(502).json({ error: "Discord a refusé le message. Vérifie le webhook." });
  res.json({ ok: true });
}
