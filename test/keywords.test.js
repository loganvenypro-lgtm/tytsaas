import { test } from "node:test";
import assert from "node:assert/strict";
import { keywordQuery, relatedTerms } from "../controllers/keywords.js";

test("keywordQuery: plain keywords are phrases, search operators pass through", () => {
  assert.equal(keywordQuery("  dark   web "), '"dark web"');
  assert.equal(keywordQuery("minecraft"), '"minecraft"');
  assert.equal(keywordQuery('"north korea" OR china'), '"north korea" OR china');
  assert.equal(keywordQuery("minecraft -hardcore"), "minecraft -hardcore");
  // Hyphenated words are not exclusions
  assert.equal(keywordQuery("spider-man"), '"spider-man"');
  assert.equal(keywordQuery("   "), null);
  assert.equal(keywordQuery("!!"), null);
  assert.equal(keywordQuery(undefined), null);
  assert.equal(keywordQuery("x".repeat(200)).length, 82);
});

test("relatedTerms: frequent neighbours, never the keyword itself", () => {
  const titles = [
    "Minecraft Hardcore 100 Days",
    "I Survived 100 Days in Minecraft Hardcore",
    "Minecraft Hardcore but every mob is faster",
    "Minecraft Speedrun World Record",
  ];
  const terms = relatedTerms(titles, "Minecraft").map((t) => t.term);
  assert.ok(terms.includes("hardcore"));
  assert.ok(terms.includes("minecraft hardcore"));
  assert.ok(!terms.includes("minecraft"));
  assert.ok(!terms.includes("speedrun"), "below the minimum count");
});
