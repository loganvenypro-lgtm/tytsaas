import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyVideo, classifyChannel, detectFormat, detectHooks, detectLanguage, normalizeLanguage, topicSlugs, titleMatchesNiche,
} from "../lib/classifier.js";
import { NICHES, NICHE_BY_ID, FORMATS, HOOKS } from "../lib/taxonomy/index.js";
import { NICHE_RPM } from "../lib/taxonomy/monetization.js";

test("videos land in the right niche and sub-niche", () => {
  const cases = [
    ["How I made $10,000/month with dropshipping on Shopify", "business_ecommerce", "dropshipping"],
    ["Bitcoin price prediction: crypto crash coming?", "finance_investing", "crypto"],
    ["I Survived 100 Days in Minecraft Hardcore", "gaming", "minecraft"],
    ["Le meilleur investissement immobilier en 2026", "finance_investing", "real_estate"],
    ["TOP 10 Scariest True Crime Cases", "true_crime", null],
  ];
  for (const [title, niche, subNiche] of cases) {
    const result = classifyVideo({ title, durationSeconds: 600 });
    assert.equal(result.niche, niche, title);
    assert.equal(result.subNiche, subNiche, title);
    assert.ok(result.confidence > 0 && result.confidence <= 1, title);
  }
});

test("a vague title inherits a clear-cut channel's niche, a weak channel gives nothing", () => {
  const vague = { title: "Watch this before it's too late", durationSeconds: 600 };
  assert.equal(classifyVideo(vague).niche, null);
  const inherited = classifyVideo(vague, { niche: "finance_investing", subNiche: "crypto", confidence: 0.8, lang: "en" });
  assert.equal(inherited.niche, "finance_investing");
  assert.equal(inherited.subNiche, "crypto");
  assert.equal(inherited.lang, "en");
  assert.equal(classifyVideo(vague, { niche: "finance_investing", confidence: 0.2 }).niche, null);
});

test("a channel is classified from its titles, not one stuffed title", () => {
  const titles = ["Bitcoin to 200k?", "Ethereum news today", "Best altcoins to buy now", "Solana memecoins explained", "Crypto market crash"];
  const channel = classifyChannel({ name: "Crypto Daily", videos: titles.map((title) => ({ title })) });
  assert.equal(channel.niche, "finance_investing");
  assert.equal(channel.subNiche, "crypto");
  assert.ok(channel.confidence >= 0.8);
  assert.equal(channel.shortShare, 0);

  const mixed = classifyChannel({
    name: "Random vlogs",
    videos: [
      { title: "my morning routine" },
      { title: "bitcoin bitcoin crypto ethereum altcoins trading forex" },
      { title: "day in my life" },
      { title: "packing for holidays" },
      { title: "what I eat in a day" },
    ],
  });
  assert.notEqual(mixed.niche, "finance_investing");
});

test("formats: livestreams and shorts", () => {
  assert.equal(detectFormat({ title: "Live", durationSeconds: 7200, isLivestream: true }), "livestream");
  assert.equal(detectFormat({ title: "TOP 10 Scariest Cases", durationSeconds: 900 }), "listicle");
  assert.equal(detectFormat({ title: "I Survived 100 Days in Minecraft", durationSeconds: 1800 }), "challenge");
});

test("title hooks", () => {
  assert.deepEqual(detectHooks("TOP 10 Scariest True Crime Cases").sort(), ["all_caps", "list", "number"]);
  assert.ok(detectHooks("Why is everyone quitting?").includes("question"));
  assert.ok(detectHooks("I made $1,000 in a day").includes("money"));
  assert.deepEqual(detectHooks("simple title"), []);
});

test("languages", () => {
  assert.equal(detectLanguage("Comment gagner de l argent avec la bourse quand on est débutant"), "fr");
  assert.equal(normalizeLanguage("en-US"), "en");
  assert.equal(normalizeLanguage("zxx"), null);
  assert.equal(normalizeLanguage(null), null);
  assert.deepEqual(topicSlugs(["https://en.wikipedia.org/wiki/Video_game_culture"]), ["Video_game_culture"]);
});

test("titleMatchesNiche needs the niche to win on the title itself", () => {
  assert.equal(titleMatchesNiche("Bitcoin crash: is crypto over?", "finance_investing"), true);
  assert.equal(titleMatchesNiche("Bitcoin crash: is crypto over?", "gaming"), false);
});

test("taxonomy is consistent: unique ids, labels in both languages, an RPM per niche", () => {
  const ids = NICHES.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const niche of NICHES) {
    assert.ok(niche.label.en && niche.label.fr, niche.id);
    assert.ok(NICHE_RPM[niche.id], `RPM for ${niche.id}`);
    const [low, typical, high] = NICHE_RPM[niche.id];
    assert.ok(low < typical && typical < high, niche.id);
    const subIds = niche.subNiches.map((s) => s.id);
    assert.equal(new Set(subIds).size, subIds.length, niche.id);
    for (const [src] of niche.terms) assert.doesNotThrow(() => new RegExp(src, "iu"), `${niche.id}: ${src}`);
  }
  assert.equal(Object.keys(NICHE_RPM).filter((id) => !NICHE_BY_ID[id]).length, 0, "RPM for unknown niche");
  for (const list of [FORMATS, HOOKS]) {
    assert.equal(new Set(list.map((x) => x.id)).size, list.length);
  }
});
