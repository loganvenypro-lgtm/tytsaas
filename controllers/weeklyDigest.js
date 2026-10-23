import { sql } from "../lib/sql.js";
import { digestSettingsJson, nextEditionAt } from "../lib/digestSettings.js";

/**
 * GET /api/weekly-digest: the user's latest recap (weekly or monthly), as the worker built it
 * on their schedule (lib/digestSettings.js). Never recomputed here: the user gets the
 * same edition until the next one, whenever they open it. 404 until their first edition.
 */
export async function weeklyDigest(req, res) {
  const [row] = await sql`
    SELECT edition::text AS edition, frequency, period_start, period_end, data
    FROM weekly_digests
    WHERE user_id = ${req.user.id}
    ORDER BY edition DESC
    LIMIT 1`;
  if (!row) return res.status(404).json({ error: "Pas encore de récap cette semaine." });
  const [settings] = await sql`SELECT * FROM digest_settings WHERE user_id = ${req.user.id}`;
  const schedule = digestSettingsJson(settings);
  res.json({
    edition: row.edition,
    frequency: row.frequency,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    nextEditionAt: schedule.enabled ? nextEditionAt(schedule) : null,
    ...row.data,
  });
}
