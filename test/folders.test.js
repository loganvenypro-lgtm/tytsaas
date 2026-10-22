// Validation of folder names and saved items (lib/savedFolders.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFolderName, parseItem, FOLDER_NAME_MAX } from "../lib/savedFolders.js";

test("folder names: trimmed, 1 to 80 characters", () => {
  assert.equal(parseFolderName("  Idées  "), "Idées");
  assert.equal(parseFolderName("   "), null);
  assert.equal(parseFolderName(42), null);
  assert.equal(parseFolderName("x".repeat(FOLDER_NAME_MAX)), "x".repeat(FOLDER_NAME_MAX));
  assert.equal(parseFolderName("x".repeat(FOLDER_NAME_MAX + 1)), null);
});

test("items: known types and ids only, unknown or empty snapshot fields dropped", () => {
  assert.equal(parseItem({ type: "playlist", id: "PL123456" }), null);
  assert.equal(parseItem({ type: "video", id: "bad id!" }), null);
  assert.equal(parseItem(null), null);

  const item = parseItem({
    type: "video",
    id: "dQw4w9WgXcQ",
    snapshot: { title: "  Hello ", views: 1200, multiplier: Number.NaN, channelName: "", isShort: false, evil: "<script>" },
  });
  assert.deepEqual(item, { type: "video", id: "dQw4w9WgXcQ", snapshot: { title: "Hello", views: 1200, isShort: false } });

  // A missing title falls back to the id so the card always has a label.
  assert.deepEqual(parseItem({ type: "channel", id: "UCabcdef123" }), {
    type: "channel",
    id: "UCabcdef123",
    snapshot: { title: "UCabcdef123" },
  });
});
