// Validation of followed channels: ids, tags, notes and list options (lib/inspirations.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { NOTES_MAX, TAG_MAX, TAGS_PER_CHANNEL, parseChannelId, parseListQuery, parseNotes, parsePatch, parseTags } from "../lib/inspirations.js";

test("channel ids: YouTube UC ids only", () => {
  assert.equal(parseChannelId("UC0i1RDxEf_MbqzDoGcdOj0A"), "UC0i1RDxEf_MbqzDoGcdOj0A");
  assert.equal(parseChannelId("UC0i1RDxEf"), null);
  assert.equal(parseChannelId("@handle"), null);
  assert.equal(parseChannelId(42), null);
});

test("tags: trimmed, spaces collapsed, duplicates dropped case-insensitively", () => {
  assert.deepEqual(parseTags([" Docu  crime ", "docu crime", "", "Shorts"]), ["Docu crime", "Shorts"]);
  assert.deepEqual(parseTags([]), []);
  assert.equal(parseTags("Shorts"), null);
  assert.equal(parseTags([1]), null);
  assert.equal(parseTags(["x".repeat(TAG_MAX + 1)]), null);
  assert.equal(parseTags(Array.from({ length: TAGS_PER_CHANNEL + 1 }, (_, i) => `t${i}`)), null);
});

test("notes: trimmed, empty clears, too long is invalid", () => {
  assert.equal(parseNotes("  idée  "), "idée");
  assert.equal(parseNotes("   "), null);
  assert.equal(parseNotes(null), null);
  assert.equal(parseNotes(3), undefined);
  assert.equal(parseNotes("x".repeat(NOTES_MAX + 1)), undefined);
});

test("patch: at least one valid field", () => {
  assert.deepEqual(parsePatch({ tags: ["A"] }), { tags: ["A"] });
  assert.deepEqual(parsePatch({ notes: "" }), { notes: null });
  assert.equal(parsePatch({}), null);
  assert.equal(parsePatch({ tags: "A" }), null);
});

test("list options fall back to 3x over 90 days, all formats", () => {
  assert.deepEqual(parseListQuery({}), { minMultiplier: 3, period: 90, format: "all" });
  assert.deepEqual(parseListQuery({ minMultiplier: "5", period: "30", format: "short" }), { minMultiplier: 5, period: 30, format: "short" });
  assert.deepEqual(parseListQuery({ minMultiplier: "7", period: "12", format: "x" }), { minMultiplier: 3, period: 90, format: "all" });
});
