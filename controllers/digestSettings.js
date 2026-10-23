import { sql } from "../lib/sql.js";
import { digestSettingsJson, nextEditionAt, parseDigestSettings } from "../lib/digestSettings.js";

async function load(userId) {
  const [row] = await sql`SELECT * FROM digest_settings WHERE user_id = ${userId}`;
  return digestSettingsJson(row);
}

const withNext = (settings) => ({ settings, nextEditionAt: settings.enabled ? nextEditionAt(settings) : null });

/** GET /api/digest-settings: when the user's recap comes out, and what it shows. */
export async function get(req, res) {
  res.json(withNext(await load(req.user.id)));
}

/** PUT /api/digest-settings: any of the fields; the others keep their value. */
export async function update(req, res) {
  const settings = parseDigestSettings(req.body, await load(req.user.id));
  if (!settings) return res.status(400).json({ error: "Réglages invalides." });
  if (!settings.sections.length) return res.status(400).json({ error: "Garde au moins une partie dans le récap." });
  await sql`
    INSERT INTO digest_settings (user_id, enabled, frequency, weekday, month_day, hour, timezone, sections, email)
    VALUES (${req.user.id}, ${settings.enabled}, ${settings.frequency}, ${settings.weekday}, ${settings.monthDay},
            ${settings.hour}, ${settings.timezone}, ${settings.sections}, ${settings.email})
    ON CONFLICT (user_id) DO UPDATE SET
      enabled = excluded.enabled, frequency = excluded.frequency, weekday = excluded.weekday,
      month_day = excluded.month_day, hour = excluded.hour, timezone = excluded.timezone,
      sections = excluded.sections, email = excluded.email, updated_at = now()`;
  res.json(withNext(settings));
}
