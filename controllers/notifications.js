import { sql } from "../lib/sql.js";

/**
 * GET /api/notifications: what the bell in the top bar shows. Unread alert
 * matches (one item per alert) and pending team invitations sent to the user's
 * email, newest first. Items leave the list once read, accepted or declined.
 */
export async function list(req, res) {
  const [alerts, invitations] = await Promise.all([
    sql`
      SELECT a.id, a.name, count(*)::int AS count, max(m.matched_at) AS at,
        (array_agg(v.title ORDER BY m.matched_at DESC))[1] AS latest_title
      FROM alert_matches m
      JOIN alert_rules a ON a.id = m.alert_id
      LEFT JOIN videos v ON v.youtube_video_id = m.video_id
      WHERE a.user_id = ${req.user.id} AND m.read_at IS NULL
      GROUP BY a.id, a.name`,
    sql`
      SELECT i.id, i.role, i."createdAt" AS at, o.name AS team, u.name AS inviter
      FROM "invitation" i
      JOIN "organization" o ON o.id = i."organizationId"
      LEFT JOIN "user" u ON u.id = i."inviterId"
      WHERE lower(i.email) = lower(${req.user.email}) AND i.status = 'pending' AND i."expiresAt" > now()`,
  ]);

  const items = [
    ...alerts.map((a) => ({
      type: "alert",
      id: a.id,
      title: a.name,
      count: a.count,
      detail: a.latest_title ?? null,
      at: a.at,
      href: "/alerts",
    })),
    ...invitations.map((i) => ({
      type: "invitation",
      id: i.id,
      title: i.team,
      inviter: i.inviter ?? null,
      role: i.role ?? "member",
      at: i.at,
      href: `/invite/${i.id}`,
    })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));

  res.json({ items, total: alerts.reduce((sum, a) => sum + a.count, 0) + invitations.length });
}
