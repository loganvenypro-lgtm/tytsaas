import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DIGEST_SETTINGS, currentEditionFor, nextEditionAt, parseDigestSettings } from "../lib/digestSettings.js";

const weekly = { ...DEFAULT_DIGEST_SETTINGS, hour: 8 };

test("weekly: Monday 8:00 Paris, before and after the hour", () => {
  // Monday 2026-10-19, 07:30 Paris (05:30 UTC, summer time): last week's edition
  const before = currentEditionFor(weekly, new Date("2026-10-19T05:30:00Z"));
  assert.equal(before.edition, "2026-10-12");
  // 08:30 Paris: this Monday's edition, covering Monday 12 to Monday 19 at midnight
  const after = currentEditionFor(weekly, new Date("2026-10-19T06:30:00Z"));
  assert.equal(after.edition, "2026-10-19");
  assert.equal(after.periodStart.toISOString(), "2026-10-11T22:00:00.000Z");
  assert.equal(after.periodEnd.toISOString(), "2026-10-18T22:00:00.000Z");
  assert.equal(after.releasedAt.toISOString(), "2026-10-19T06:00:00.000Z");
});

test("weekly: another weekday and timezone", () => {
  const friday18NY = { ...weekly, weekday: 5, hour: 18, timezone: "America/New_York" };
  // Thursday 2026-10-22 in New York: last Friday's edition
  assert.equal(currentEditionFor(friday18NY, new Date("2026-10-22T15:00:00Z")).edition, "2026-10-16");
  assert.equal(nextEditionAt(friday18NY, new Date("2026-10-22T15:00:00Z")).toISOString(), "2026-10-23T22:00:00.000Z");
});

test("weekly: the period spans the DST change", () => {
  // Paris goes back to winter time on 2026-10-25: the period is 7 local days
  const e = currentEditionFor(weekly, new Date("2026-10-26T09:00:00Z"));
  assert.equal(e.edition, "2026-10-26");
  assert.equal(e.periodStart.toISOString(), "2026-10-18T22:00:00.000Z");
  assert.equal(e.periodEnd.toISOString(), "2026-10-25T23:00:00.000Z");
});

test("monthly: covers the month before the edition day", () => {
  const monthly = { ...weekly, frequency: "monthly", monthDay: 15 };
  const e = currentEditionFor(monthly, new Date("2026-10-22T12:00:00Z"));
  assert.equal(e.edition, "2026-10-15");
  assert.equal(e.periodStart.toISOString(), "2026-09-14T22:00:00.000Z");
  // Before the 15th: September's edition
  assert.equal(currentEditionFor(monthly, new Date("2026-10-10T12:00:00Z")).edition, "2026-09-15");
  // January's edition comes after December's
  assert.equal(currentEditionFor(monthly, new Date("2027-01-05T12:00:00Z")).edition, "2026-12-15");
  assert.equal(nextEditionAt(monthly, new Date("2026-12-20T12:00:00Z")).toISOString(), "2027-01-15T07:00:00.000Z");
});

test("parseDigestSettings validates and merges", () => {
  assert.equal(parseDigestSettings({ hour: 24 }), null);
  assert.equal(parseDigestSettings({ monthDay: 31 }), null);
  assert.equal(parseDigestSettings({ timezone: "Mars/Olympus" }), null);
  assert.equal(parseDigestSettings({ sections: ["nope"] }), null);
  const s = parseDigestSettings({ frequency: "monthly", sections: ["topVideos", "myChannel"], email: true });
  assert.deepEqual(s.sections, ["myChannel", "topVideos"]);
  assert.equal(s.frequency, "monthly");
  assert.equal(s.hour, DEFAULT_DIGEST_SETTINGS.hour);
});
