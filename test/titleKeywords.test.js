import { test } from "node:test";
import assert from "node:assert/strict";
import { titleTerms } from "../lib/titleKeywords.js";
import { textTopic } from "../lib/classifier.js";

test("title terms: hype words never count alone, topical bigrams do", () => {
  const terms = titleTerms([
    "The Hunt for the First Dark Web King",
    "The Dark Web’s New Deadliest Drug",
    "Inside the Dark World of Poker Cheating",
    "The Darkest Secret of North Korea",
  ]);
  assert.equal(terms.get("dark web"), 2);
  assert.equal(terms.get("north korea"), 1);
  assert.equal(terms.get("web"), 2);
  for (const generic of ["dark", "darkest", "deadliest", "secret", "world", "dark world"]) assert.equal(terms.has(generic), false, generic);
  // Words split by a dropped "s" ("Web’s New") are not adjacent in PostgreSQL's tsvector either.
  assert.equal(terms.has("web new"), false);
});

test("textTopic gives unclassified titles a topic hint", () => {
  assert.equal(textTopic("The Unsolved Murder in Room 1046")?.niche, "true_crime");
  assert.equal(textTopic("How China's Biggest Scammer Got Caught")?.subNiche, "scams_fraud");
  assert.equal(textTopic("The Strangest Place on the Internet"), null);
});
