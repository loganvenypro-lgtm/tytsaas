// Validation of alert rules and their Discord message (lib/alerts.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { alertDiscordPayload, isNarrow, maskWebhook, parseFilters, parseRule, parseWebhook } from "../lib/alerts.js";

const HOOK = "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_-0123456789";

test("webhooks: Discord webhook URLs only", () => {
  assert.equal(parseWebhook(HOOK), HOOK);
  assert.equal(parseWebhook(` ${HOOK} `), HOOK);
  assert.equal(parseWebhook(""), null);
  assert.equal(parseWebhook(null), null);
  assert.equal(parseWebhook("https://evil.com/api/webhooks/1/x"), undefined);
  assert.equal(parseWebhook("http://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz"), undefined);
  assert.equal(maskWebhook(HOOK), "…456789");
});

test("filters: known Top Videos params only, as strings", () => {
  assert.deepEqual(parseFilters({ q: " fortnite ", minVph: 5000, niche: "gaming", sort: "views", period: "all", evil: "x", language: "" }), {
    q: "fortnite",
    minVph: "5000",
    niche: "gaming",
  });
  assert.deepEqual(parseFilters(["q"]), {});
  assert.deepEqual(parseFilters({ q: { nested: true } }), {});
});

test("rules: defaults on create, partial edits, invalid values rejected", () => {
  assert.deepEqual(parseRule({ name: " >5K Fortnite ", filters: { q: "fortnite" } }).rule, {
    name: ">5K Fortnite",
    filters: { q: "fortnite" },
    source: "all",
    frequency: "instant",
  });
  assert.deepEqual(parseRule({ enabled: false }, { partial: true }).rule, { enabled: false });
  assert.ok(parseRule({ name: "" }).error);
  assert.ok(parseRule({ name: "x", source: "everyone" }).error);
  assert.ok(parseRule({ name: "x", frequency: "hourly" }).error);
  assert.ok(parseRule({ name: "x", discordWebhook: "https://example.com" }).error);
  assert.equal(parseRule({ name: "x", discordWebhook: HOOK }).rule.discordWebhook, HOOK);
});

test("a rule must narrow the videos down", () => {
  assert.equal(isNarrow({ filters: {}, source: "all" }), false);
  assert.equal(isNarrow({ filters: { format: "short", language: "fr" }, source: "all" }), false);
  assert.equal(isNarrow({ filters: { q: "minecraft" }, source: "all" }), true);
  assert.equal(isNarrow({ filters: { minVph: "5000" } }), true);
  assert.equal(isNarrow({ filters: {}, source: "competitors" }), true);
});

test("Discord message: at most 10 videos, the rest counted", () => {
  const video = (i) => ({
    youtube_video_id: `vid${i}`,
    title: `Video ${i}`,
    channel_name: "Chaîne",
    youtube_channel_id: "UC0000000000000000000000",
    subscriber_count: 12000,
    view_count: 50000,
    views_per_hour: 2100,
    outlier_multiplier: 4.2,
    published_at: "2026-10-20T10:00:00Z",
  });
  const payload = alertDiscordPayload({ name: "Fortnite" }, Array.from({ length: 12 }, (_, i) => video(i)), { total: 12 });
  assert.equal(payload.embeds.length, 10);
  assert.match(payload.content, /Fortnite · 12 nouvelles vidéos/);
  assert.match(payload.content, /\+2 autres/);
  assert.equal(payload.embeds[0].url, "https://youtu.be/vid0");
});
