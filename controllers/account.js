import { sql } from "../lib/sql.js";
import { ANALYTICS_SCOPE, YOUTUBE_SCOPE } from "../lib/youtubeOAuth.js";

const YOUTUBE_SCOPES = [YOUTUBE_SCOPE, ANALYTICS_SCOPE];

/** Revokes the grant at Google (the refresh token revokes all of it). Never throws. */
async function revokeAtGoogle(token) {
  if (!token) return;
  try {
    const res = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(10_000),
    });
    // 400 invalid_token: already revoked or expired, nothing left to do
    if (!res.ok && res.status !== 400) console.error("Google revoke:", res.status, (await res.text()).slice(0, 200));
  } catch (err) {
    console.error("Google revoke:", err.message);
  }
}

/**
 * Revokes every Google grant of the user that carries a YouTube scope, then drops
 * the tokens and those scopes. The account rows stay, so a Google sign-in still works.
 */
async function revokeYouTubeAccess(userId) {
  const rows = await sql`
    SELECT id, scope, "accessToken", "refreshToken" FROM account
    WHERE "userId" = ${userId} AND "providerId" = 'google'`;
  for (const row of rows) {
    const scopes = (row.scope ?? "").split(/[\s,]+/).filter(Boolean);
    if (!scopes.some((s) => YOUTUBE_SCOPES.includes(s))) continue;
    await revokeAtGoogle(row.refreshToken ?? row.accessToken);
    await sql`
      UPDATE account SET "accessToken" = NULL, "refreshToken" = NULL, "idToken" = NULL,
        "accessTokenExpiresAt" = NULL, "refreshTokenExpiresAt" = NULL,
        scope = ${scopes.filter((s) => !YOUTUBE_SCOPES.includes(s)).join(",")}, "updatedAt" = now()
      WHERE id = ${row.id}`;
  }
}

/**
 * POST /api/account/youtube/disconnect: revokes Returbe's YouTube access at Google
 * and deletes what came from it (Analytics cache, revival reports, the linked channel).
 * Public data about the channel stays in the shared index like any other channel.
 */
export async function disconnectYouTube(req, res) {
  const userId = req.user.id;
  await revokeYouTubeAccess(userId);
  await sql`DELETE FROM my_channel_cache WHERE user_id = ${userId}`;
  await sql`DELETE FROM video_revival_reports WHERE user_id = ${userId}`;
  await sql`
    UPDATE "user" SET youtube_channel_id = NULL, youtube_linked_at = NULL, youtube_synced_at = NULL
    WHERE id = ${userId}`;
  res.json({ ok: true });
}

/**
 * DELETE /api/account: revokes Google access, deletes the teams the user is alone in,
 * then the user; everything else they own goes with it (ON DELETE CASCADE).
 */
export async function deleteAccount(req, res) {
  const userId = req.user.id;
  await revokeYouTubeAccess(userId);
  await sql.begin(async (tx) => {
    await tx`
      DELETE FROM "organization" o
      WHERE EXISTS (SELECT 1 FROM "member" m WHERE m."organizationId" = o.id AND m."userId" = ${userId})
        AND NOT EXISTS (SELECT 1 FROM "member" m WHERE m."organizationId" = o.id AND m."userId" <> ${userId})`;
    await tx`DELETE FROM "user" WHERE id = ${userId}`;
  });
  res.json({ ok: true });
}

/**
 * GET /api/account/sessions: the user's signed-in devices, newest activity first.
 * Ids only: a session token never reaches the browser.
 */
export async function listSessions(req, res) {
  const rows = await sql`
    SELECT id, "createdAt", "updatedAt", "ipAddress", "userAgent" FROM session
    WHERE "userId" = ${req.user.id} AND "expiresAt" > now()
    ORDER BY "updatedAt" DESC`;
  res.json({ sessions: rows.map((s) => ({ ...s, current: s.id === req.sessionId })) });
}

/** DELETE /api/account/sessions/:sessionId: signs that device out (not the current one: that's sign-out). */
export async function revokeSession(req, res) {
  if (req.params.sessionId === req.sessionId) return res.status(400).json({ error: "Utilise la déconnexion pour cet appareil." });
  const { count } = await sql`DELETE FROM session WHERE id = ${req.params.sessionId} AND "userId" = ${req.user.id}`;
  if (!count) return res.status(404).json({ error: "Session introuvable." });
  res.json({ ok: true });
}
