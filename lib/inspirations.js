// Validation for the channels a user follows for inspiration (controllers/inspirations.js).

export const TAG_MAX = 32;
export const TAGS_PER_CHANNEL = 12;
export const NOTES_MAX = 4000;

/** Outlier thresholds the page offers (videos at least N times the channel's usual views). */
export const MULTIPLIERS = [2, 3, 5, 10];
export const PERIODS = [30, 90, 365];

/** A YouTube channel id (UC…), or null. */
export function parseChannelId(raw) {
  return typeof raw === "string" && /^UC[\w-]{22}$/.test(raw) ? raw : null;
}

/**
 * Tags sent by the client: trimmed, inner spaces collapsed, duplicates dropped
 * (case-insensitive, the first spelling wins). Null when not an array, when a
 * tag is too long or when there are too many.
 */
export function parseTags(raw) {
  if (!Array.isArray(raw)) return null;
  const tags = [];
  const seen = new Set();
  for (const value of raw) {
    if (typeof value !== "string") return null;
    const tag = value.trim().replace(/\s+/g, " ");
    if (!tag) continue;
    if (tag.length > TAG_MAX) return null;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags.length <= TAGS_PER_CHANNEL ? tags : null;
}

/** Notes: trimmed, empty becomes null (cleared). Undefined when invalid. */
export function parseNotes(raw) {
  if (raw === null) return null;
  if (typeof raw !== "string") return undefined;
  const notes = raw.trim();
  if (notes.length > NOTES_MAX) return undefined;
  return notes || null;
}

/** `{ tags?, notes? }` edits; null when nothing valid was sent. */
export function parsePatch(raw) {
  if (!raw || typeof raw !== "object") return null;
  const patch = {};
  if (raw.tags !== undefined) {
    const tags = parseTags(raw.tags);
    if (!tags) return null;
    patch.tags = tags;
  }
  if (raw.notes !== undefined) {
    const notes = parseNotes(raw.notes);
    if (notes === undefined) return null;
    patch.notes = notes;
  }
  return Object.keys(patch).length ? patch : null;
}

/** List options from the query string, falling back to the defaults. */
export function parseListQuery(query = {}) {
  const multiplier = Number(query.minMultiplier);
  const period = Number(query.period);
  const format = query.format === "short" || query.format === "long" ? query.format : "all";
  return {
    minMultiplier: MULTIPLIERS.includes(multiplier) ? multiplier : 3,
    period: PERIODS.includes(period) ? period : 90,
    format,
  };
}
