// Each user's recap schedule (digest_settings): weekly or monthly, on which day,
// at what hour in their timezone, which sections, and whether to email it.
// The date math is pure so it can be tested without a database.

export const DIGEST_SECTIONS = ["myChannel", "topVideos", "competitorHits", "risingChannels"];

export const DEFAULT_DIGEST_SETTINGS = {
  enabled: true,
  frequency: "weekly",
  weekday: 1,
  monthDay: 1,
  hour: Number(process.env.WEEKLY_DIGEST_HOUR) || 8,
  timezone: "Europe/Paris",
  sections: DIGEST_SECTIONS,
  email: false,
};

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

export function isValidTimezone(tz) {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Settings sent by the client, merged over `current`; null when a field is invalid. */
export function parseDigestSettings(raw, current = DEFAULT_DIGEST_SETTINGS) {
  if (!raw || typeof raw !== "object") return null;
  const next = { ...current };
  if (raw.enabled !== undefined) {
    if (typeof raw.enabled !== "boolean") return null;
    next.enabled = raw.enabled;
  }
  if (raw.frequency !== undefined) {
    if (raw.frequency !== "weekly" && raw.frequency !== "monthly") return null;
    next.frequency = raw.frequency;
  }
  if (raw.weekday !== undefined) {
    if (!isInt(raw.weekday, 0, 6)) return null;
    next.weekday = raw.weekday;
  }
  if (raw.monthDay !== undefined) {
    if (!isInt(raw.monthDay, 1, 28)) return null;
    next.monthDay = raw.monthDay;
  }
  if (raw.hour !== undefined) {
    if (!isInt(raw.hour, 0, 23)) return null;
    next.hour = raw.hour;
  }
  if (raw.timezone !== undefined) {
    if (!isValidTimezone(raw.timezone)) return null;
    next.timezone = raw.timezone;
  }
  if (raw.sections !== undefined) {
    if (!Array.isArray(raw.sections) || raw.sections.some((s) => !DIGEST_SECTIONS.includes(s))) return null;
    next.sections = DIGEST_SECTIONS.filter((s) => raw.sections.includes(s));
  }
  if (raw.email !== undefined) {
    if (typeof raw.email !== "boolean") return null;
    next.email = raw.email;
  }
  return next;
}

/** A digest_settings row in the API's shape; the defaults when there is none. */
export function digestSettingsJson(row) {
  if (!row) return { ...DEFAULT_DIGEST_SETTINGS };
  return {
    enabled: row.enabled,
    frequency: row.frequency,
    weekday: row.weekday,
    monthDay: row.month_day,
    hour: row.hour,
    timezone: row.timezone,
    sections: row.sections,
    email: row.email,
  };
}

/** The wall-clock date and time of `instant` in `timeZone`, as numbers. */
function localParts(instant, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(instant)
      .map((p) => [p.type, Number(p.value)]),
  );
  return parts;
}

/** The instant at which the wall clock of `timeZone` reads y-m-d h:00. */
export function zonedTime(y, m, d, h, timeZone) {
  const guess = Date.UTC(y, m - 1, d, h);
  // Offset of the zone at that moment, applied twice to settle around DST changes
  let instant = guess;
  for (let i = 0; i < 2; i++) {
    const p = localParts(new Date(instant), timeZone);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    instant += guess - shown;
  }
  return new Date(instant);
}

const ymd = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
// Calendar arithmetic on plain dates (UTC is only a carrier here)
const shiftDays = (y, m, d, days) => {
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
};
const shiftMonths = (y, m, months) => {
  const t = new Date(Date.UTC(y, m - 1 + months, 1));
  return [t.getUTCFullYear(), t.getUTCMonth() + 1];
};

/** The day (y, m, d) of the latest edition date on or before the local day y-m-d. */
function lastEditionDay(settings, y, m, d) {
  if (settings.frequency === "monthly") {
    if (d >= settings.monthDay) return [y, m, settings.monthDay];
    const [py, pm] = shiftMonths(y, m, -1);
    return [py, pm, settings.monthDay];
  }
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return shiftDays(y, m, d, -((weekday - settings.weekday + 7) % 7));
}

/**
 * The latest edition that is out at `now` for these settings: its date in the
 * user's timezone, and the period it covers, from the previous edition day at
 * 00:00 to its own day at 00:00 (local time). An edition comes out at `hour`.
 */
export function currentEditionFor(settings, now = new Date()) {
  const tz = settings.timezone;
  const p = localParts(now, tz);
  // Before the hour, today's edition isn't out yet: count from yesterday
  const [ty, tm, td] = p.hour >= settings.hour ? [p.year, p.month, p.day] : shiftDays(p.year, p.month, p.day, -1);
  const [y, m, d] = lastEditionDay(settings, ty, tm, td);
  const [sy, sm, sd] = settings.frequency === "monthly" ? [...shiftMonths(y, m, -1), d] : shiftDays(y, m, d, -7);
  return {
    edition: ymd(y, m, d),
    frequency: settings.frequency,
    periodStart: zonedTime(sy, sm, sd, 0, tz),
    periodEnd: zonedTime(y, m, d, 0, tz),
    releasedAt: zonedTime(y, m, d, settings.hour, tz),
  };
}

/** When the next edition comes out after `now`. */
export function nextEditionAt(settings, now = new Date()) {
  const { edition } = currentEditionFor(settings, now);
  const [y, m, d] = edition.split("-").map(Number);
  const [ny, nm, nd] = settings.frequency === "monthly" ? [...shiftMonths(y, m, 1), d] : shiftDays(y, m, d, 7);
  return zonedTime(ny, nm, nd, settings.hour, settings.timezone);
}
