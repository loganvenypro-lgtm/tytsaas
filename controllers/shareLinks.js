import crypto from "node:crypto";
import { APIError } from "better-auth/api";
import { auth } from "../lib/auth.js";
import { sql } from "../lib/sql.js";
import { canManageTeam, inWorkspace } from "../lib/teams.js";

// Share links (share_links): a folder link opens the folder read-only for
// anyone, signed in or not; a team link is a reusable invitation that any
// signed-in user can accept to join as a member.

const KINDS = ["folder", "team"];
const newToken = () => crypto.randomBytes(18).toString("base64url");

function linkJson(r) {
  return r ? { token: r.token, enabled: r.enabled, updatedAt: r.updated_at } : null;
}

/**
 * Whether the request may manage the share link of this object: a folder of
 * the current workspace, or the active team for its owners and admins.
 */
async function canShare(req, kind, targetId) {
  if (kind === "folder") {
    const [row] = await sql`SELECT 1 FROM saved_folders WHERE id = ${targetId} AND ${inWorkspace(req.workspace)}`;
    return Boolean(row);
  }
  return req.workspace.teamId === targetId && canManageTeam(req.workspace.role);
}

async function guard(req, res) {
  const { kind, targetId } = req.params;
  if (!KINDS.includes(kind)) {
    res.status(400).json({ error: "Type de lien invalide." });
    return false;
  }
  if (!(await canShare(req, kind, targetId))) {
    res.status(404).json({ error: "Introuvable." });
    return false;
  }
  return true;
}

/** GET /share/:kind/:targetId: `{ link }`, null when never created. */
export async function get(req, res) {
  if (!(await guard(req, res))) return;
  const [row] = await sql`
    SELECT token, enabled, updated_at FROM share_links WHERE kind = ${req.params.kind} AND target_id = ${req.params.targetId}`;
  res.json({ link: linkJson(row) });
}

/**
 * POST /share/:kind/:targetId: create or re-enable the link. With
 * `{ regenerate: true }` it gets a new token and the old link stops working.
 */
export async function enable(req, res) {
  if (!(await guard(req, res))) return;
  const { kind, targetId } = req.params;
  const regenerate = req.body?.regenerate === true;
  const [row] = await sql`
    INSERT INTO share_links (kind, target_id, token, created_by)
    VALUES (${kind}, ${targetId}, ${newToken()}, ${req.user.id})
    ON CONFLICT (kind, target_id) DO UPDATE SET
      enabled = true,
      updated_at = now(),
      token = ${regenerate ? sql`excluded.token` : sql`share_links.token`}
    RETURNING token, enabled, updated_at`;
  res.json({ link: linkJson(row) });
}

/** DELETE /share/:kind/:targetId: disable the link (it can be re-enabled with the same token). */
export async function disable(req, res) {
  if (!(await guard(req, res))) return;
  const [row] = await sql`
    UPDATE share_links SET enabled = false, updated_at = now()
    WHERE kind = ${req.params.kind} AND target_id = ${req.params.targetId}
    RETURNING token, enabled, updated_at`;
  res.json({ link: linkJson(row) });
}

async function enabledLink(token) {
  if (typeof token !== "string" || !/^[\w-]{10,64}$/.test(token)) return null;
  const [row] = await sql`SELECT kind, target_id FROM share_links WHERE token = ${token} AND enabled`;
  return row ?? null;
}

/**
 * GET /shared/:token (public): what the link shows. A folder comes with its
 * items (live stats like the folder page) but without the ideation notes,
 * which stay private to the workspace; a team only with its name and size.
 */
export async function open(req, res) {
  const link = await enabledLink(req.params.token);
  if (!link) return res.status(404).json({ error: "Ce lien n'existe pas ou a été désactivé." });

  if (link.kind === "team") {
    const [team] = await sql`
      SELECT o.name, (SELECT count(*) FROM "member" m WHERE m."organizationId" = o.id)::int AS members
      FROM "organization" o WHERE o.id = ${link.target_id}`;
    if (!team) return res.status(404).json({ error: "Ce lien n'existe pas ou a été désactivé." });
    return res.json({ kind: "team", team: { id: link.target_id, name: team.name, memberCount: team.members } });
  }

  const [folder] = await sql`
    SELECT f.name, f.updated_at AS "updatedAt", o.name AS "teamName", u.name AS "ownerName"
    FROM saved_folders f
    LEFT JOIN "organization" o ON o.id = f.organization_id
    LEFT JOIN "user" u ON u.id = f.user_id
    WHERE f.id = ${link.target_id}`;
  if (!folder) return res.status(404).json({ error: "Ce lien n'existe pas ou a été désactivé." });
  const rows = await sql`
    SELECT i.item_type, i.item_id, i.snapshot, i.added_at,
           v.view_count, v.outlier_multiplier, v.is_short,
           c.subscriber_count, c.thumbnail_url AS channel_avatar, c.handle
    FROM saved_folder_items i
    LEFT JOIN videos v ON i.item_type = 'video' AND v.youtube_video_id = i.item_id
    LEFT JOIN channels c ON i.item_type = 'channel' AND c.youtube_channel_id = i.item_id
    WHERE i.folder_id = ${link.target_id}
    ORDER BY i.added_at DESC`;
  const items = rows.map((r) => ({
    type: r.item_type,
    id: r.item_id,
    snapshot: {
      ...r.snapshot,
      ...(r.view_count != null && { views: Number(r.view_count) }),
      ...(r.outlier_multiplier != null && { multiplier: Number(r.outlier_multiplier) }),
      ...(r.is_short != null && { isShort: r.is_short }),
      ...(r.subscriber_count != null && { subscribers: Number(r.subscriber_count) }),
      ...(r.channel_avatar && { thumbnail: r.channel_avatar }),
      ...(r.handle && { handle: r.handle }),
    },
    addedAt: r.added_at,
  }));
  res.json({
    kind: "folder",
    folder: { name: folder.name, updatedAt: folder.updatedAt, owner: folder.teamName ?? folder.ownerName ?? null },
    items,
  });
}

/**
 * POST /shared/:token/join (signed in): join the team of a team link as a
 * member. Already a member is fine; the client then switches to the team.
 */
export async function join(req, res) {
  const link = await enabledLink(req.params.token);
  if (!link || link.kind !== "team") return res.status(404).json({ error: "Ce lien n'existe pas ou a été désactivé." });
  const teamId = link.target_id;
  const [member] = await sql`SELECT 1 FROM "member" WHERE "organizationId" = ${teamId} AND "userId" = ${req.user.id}`;
  if (!member) {
    try {
      await auth.api.addMember({ body: { userId: req.user.id, organizationId: teamId, role: "member" } });
    } catch (err) {
      if (err instanceof APIError) return res.status(400).json({ error: err.message });
      throw err;
    }
  }
  res.json({ teamId, alreadyMember: Boolean(member) });
}
