import crypto from "node:crypto";
import { APIError } from "better-auth/api";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { TEAM_NAME_MAX, parseTeamName, teamSlug } from "../lib/teams.js";

// Members, invitations, roles and the active team go through Better Auth's
// organization routes (/api/auth/organization/*); these cover what it leaves to the app.

/** The workspace the requests work in: `{ teamId, role }`, teamId null for the personal space. */
export function workspace(req, res) {
  const { teamId, role } = req.workspace;
  res.json({ teamId, role });
}

/**
 * Create a team (`{ name }`): the user becomes its owner and works in it right
 * away. Better Auth needs a unique slug, made here from the name.
 */
export async function create(req, res) {
  const name = parseTeamName(req.body?.name);
  if (!name) return res.status(400).json({ error: `Le nom doit faire entre 1 et ${TEAM_NAME_MAX} caractères.` });
  try {
    const team = await auth.api.createOrganization({
      body: { name, slug: teamSlug(name, crypto.randomBytes(3).toString("hex")) },
      headers: fromNodeHeaders(req.headers),
    });
    res.status(201).json({ team: { id: team.id, name: team.name, slug: team.slug } });
  } catch (err) {
    if (err instanceof APIError) return res.status(400).json({ error: err.message });
    throw err;
  }
}
