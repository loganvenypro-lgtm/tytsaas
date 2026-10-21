import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";

/** Express guard for signed-in routes: 401 without a session, else req.user is set. */
export async function requireUser(req, res, next) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return res.status(401).json({ error: "Non authentifié." });
  req.user = session.user;
  next();
}

/**
 * Express guard for /api/admin: 401 without a session, 403 unless the user's
 * role is admin. The role comes from the database on every request, so
 * revoking it takes effect without a new login.
 */
export async function requireAdmin(req, res, next) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) return res.status(401).json({ error: "Non authentifié." });
  if (session.user.role !== "admin") {
    return res.status(403).json({ error: "Accès réservé aux administrateurs." });
  }
  req.admin = session.user;
  next();
}

export function parsePage(query, defaultSize = 50) {
  const page = Math.max(1, Number(query.page) || 1);
  const size = Math.min(200, Math.max(1, Number(query.size) || defaultSize));
  const q = typeof query.q === "string" ? query.q.trim() : "";
  return { page, size, offset: (page - 1) * size, q };
}
