// Teams (Better Auth's organization plugin): the workspace a request works in,
// and the checks shared by lib/auth.js and the controllers.
import { sql } from "./sql.js";

export const TEAM_ROLES = ["owner", "admin", "member"];
export const TEAM_NAME_MAX = 60;

/**
 * The workspace of a request: the user's personal space (`teamId` null) or
 * the active team, when the user is still one of its members. `role` is the
 * user's role in that team.
 */
export function pickWorkspace(userId, activeTeamId, memberRole) {
  if (!activeTeamId || !TEAM_ROLES.includes(memberRole)) return { userId, teamId: null, role: null };
  return { userId, teamId: activeTeamId, role: memberRole };
}

/**
 * Reads the session's active team and checks the membership in the database
 * on every request, so a removed member falls back to their personal space at
 * once.
 */
export async function resolveWorkspace(user, session) {
  const teamId = session?.activeOrganizationId ?? null;
  if (!teamId) return pickWorkspace(user.id, null, null);
  const [member] = await sql`
    SELECT role FROM "member" WHERE "organizationId" = ${teamId} AND "userId" = ${user.id}`;
  return pickWorkspace(user.id, teamId, member?.role);
}

/**
 * SQL condition selecting the rows of the workspace in a table with user_id and
 * organization_id (saved_folders, inspiration_channels). `alias` is the table's
 * alias in the query, if any.
 */
export function inWorkspace(ws, alias) {
  const col = (name) => sql(alias ? `${alias}.${name}` : name);
  return ws.teamId
    ? sql`${col("organization_id")} = ${ws.teamId}`
    : sql`${col("user_id")} = ${ws.userId} AND ${col("organization_id")} IS NULL`;
}

/** Owners and admins invite, remove members and rename the team. */
export const canManageTeam = (role) => role === "owner" || role === "admin";

/** A team name, trimmed, or null when empty or too long. */
export function parseTeamName(raw) {
  const name = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
  return name && name.length <= TEAM_NAME_MAX ? name : null;
}

/** The URL slug Better Auth requires (unique): the name in ASCII, plus a random suffix. */
export function teamSlug(name, suffix) {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "team"}-${suffix}`;
}
