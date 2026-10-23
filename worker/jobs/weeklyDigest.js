/**
 * Recaps: builds each user's edition once it is out on their schedule (weekly or
 * monthly, their day and hour, their timezone: lib/digestSettings.js), and emails
 * it to those who asked. Runs every tick but only does work for users whose
 * current edition doesn't exist yet, so a crash or a new account is caught up on
 * the next tick. Users who turned the recap off are skipped. No YouTube quota.
 */
import { sql } from "../../lib/sql.js";
import { currentEditionFor, digestSettingsJson } from "../../lib/digestSettings.js";
import { sendDigestEmail } from "../../lib/emails.js";
import { purgeOldDigests, saveWeeklyDigest } from "../../lib/weeklyDigest.js";

// Each user is a handful of indexed queries; caps a tick if the user base grows a lot
const MAX_USERS_PER_RUN = 500;

export async function runWeeklyDigest() {
  const rows = await sql`
    SELECT u.id, u.email, u.name, s.*,
      (SELECT max(d.edition)::text FROM weekly_digests d WHERE d.user_id = u.id) AS last_edition
    FROM "user" u
    LEFT JOIN digest_settings s ON s.user_id = u.id
    WHERE s.enabled IS NOT FALSE
    ORDER BY u."createdAt"`;

  const now = new Date();
  const due = [];
  for (const row of rows) {
    const settings = digestSettingsJson(row.user_id ? row : null);
    const edition = currentEditionFor(settings, now);
    // Editions are dated, so anything newer than the last one stored is due
    if (!row.last_edition || edition.edition > row.last_edition) due.push({ user: row, settings, edition });
    if (due.length === MAX_USERS_PER_RUN) break;
  }

  let built = 0;
  let emailed = 0;
  let failed = 0;
  for (const { user, settings, edition } of due) {
    try {
      const created = await saveWeeklyDigest(user.id, edition, settings.sections);
      if (!created) continue;
      built++;
      if (settings.email) {
        sendDigestEmail(user, edition.frequency);
        emailed++;
      }
    } catch (err) {
      failed++;
      console.error(`  [weekly-digest] ${user.id}:`, err.message);
    }
  }
  const purged = built ? await purgeOldDigests() : 0;
  return { built, emailed, failed, purged, more: due.length === MAX_USERS_PER_RUN };
}
