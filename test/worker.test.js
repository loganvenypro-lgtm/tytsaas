// Pure helpers of the worker: monetization estimates, discovery ROI, RSS parsing,
// quota budgets and Discord formatting.
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateMonetization, summarizeVideos, yppStatus, blendedRpm, averageViewShare } from "../lib/monetization.js";
import { allocateSources, roiPerHundredUnits } from "../worker/jobs/discovery.js";
import { parseRssFeed, createBudget, subBudget, parseIsoDuration } from "../lib/youtube.js";
import { outlierTier, onePerChannel, delta } from "../lib/discord.js";

const NOW = Date.parse("2026-10-22T00:00:00Z");
const daysAgo = (d) => new Date(NOW - d * 86_400_000).toISOString();

test("YPP thresholds: full, expanded, not yet, hidden", () => {
  assert.equal(yppStatus({ subscribers: 1000, watchHours: 4000, shortsViews90d: 0, uploads90d: 0 }), "eligible");
  assert.equal(yppStatus({ subscribers: 1000, watchHours: 0, shortsViews90d: 10_000_000, uploads90d: 0 }), "eligible");
  assert.equal(yppStatus({ subscribers: 999, watchHours: 1e6, shortsViews90d: 0, uploads90d: 9 }), "early");
  assert.equal(yppStatus({ subscribers: 600, watchHours: 3000, shortsViews90d: 0, uploads90d: 2 }), "not_eligible");
  assert.equal(yppStatus({ subscribers: null, watchHours: 1e6, shortsViews90d: 0, uploads90d: 9 }), null);
});

test("watch hours: views × duration × watched share, last 12 months only", () => {
  const videos = [
    { views: 100_000, durationSeconds: 600, isShort: false, isLivestream: false, publishedAt: daysAgo(30) },
    { views: 1_000_000, durationSeconds: 600, isShort: false, isLivestream: false, publishedAt: daysAgo(400) },
    { views: 5_000_000, durationSeconds: 30, isShort: true, isLivestream: false, publishedAt: daysAgo(10) },
  ];
  const s = summarizeVideos(videos, NOW);
  assert.equal(s.watchHours, Math.round((100_000 * 600 * averageViewShare(600)) / 3600));
  assert.equal(s.shortsViews90d, 5_000_000);
  assert.equal(s.uploads90d, 2);
});

test("lower bounds prove eligibility but never 'not yet'", () => {
  const few = [{ views: 1000, durationSeconds: 600, isShort: false, isLivestream: false, publishedAt: daysAgo(5) }];
  const base = { subscribers: 50_000, niche: "gaming", lang: "en" };
  assert.equal(estimateMonetization({ ...base, dailyViews: 10, historyComplete: false }, few, NOW).status, null);
  assert.equal(estimateMonetization({ ...base, dailyViews: null, historyComplete: true }, few, NOW).status, null);
  assert.equal(estimateMonetization({ ...base, dailyViews: 10, historyComplete: true }, few, NOW).status, "not_eligible");
  // 20k views/day on long videos is far above 4,000 hours a year, even with a partial history.
  const big = estimateMonetization({ ...base, dailyViews: 20_000, historyComplete: false }, few, NOW);
  assert.equal(big.status, "eligible");
  assert.ok(big.monthlyRevenueLow > 0 && big.monthlyRevenueHigh > big.monthlyRevenueLow);
});

test("revenue only for full YPP, RPM blended by market and Shorts share", () => {
  assert.deepEqual(blendedRpm({ niche: "finance_investing", lang: "en", shortsViewShare: 0 }), [8, 14, 30]);
  const fr = blendedRpm({ niche: "finance_investing", lang: "fr", shortsViewShare: 0 });
  assert.equal(fr[1], 8.4);
  const shorts = blendedRpm({ niche: "finance_investing", lang: "en", shortsViewShare: 1 });
  assert.deepEqual(shorts, [0.03, 0.06, 0.1]);
  const early = estimateMonetization(
    { subscribers: 600, niche: "gaming", lang: "en", dailyViews: 50_000, historyComplete: true },
    [1, 2, 3].map((d) => ({ views: 10, durationSeconds: 60, isShort: false, isLivestream: false, publishedAt: daysAgo(d) })),
    NOW,
  );
  assert.equal(early.status, "early");
  assert.equal(early.monthlyRevenueLow, null);
});

test("discovery ROI: the best source gets the most, every source keeps a floor", () => {
  const roi = [
    { source: "description", perHundredUnits: roiPerHundredUnits(92, 42) },
    { source: "featured", perHundredUnits: roiPerHundredUnits(3, 51) },
    { source: "search", perHundredUnits: roiPerHundredUnits(10, 405) },
  ];
  const plan = allocateSources(roi, 1000, 0.1);
  assert.ok(plan.description > plan.featured && plan.description > plan.search);
  assert.ok(plan.featured >= 80 && plan.search >= 80);
  assert.ok(plan.description + plan.featured + plan.search <= 1000);
  // No history: equal shares.
  const fresh = allocateSources([], 900, 0.1);
  assert.deepEqual(fresh, { description: 300, featured: 300, search: 300 });
  // A new source isn't worthless: 1 useful per 100 units by default.
  assert.equal(roiPerHundredUnits(0, 0), 1);
});

test("sub-budgets count against their parent and stop at either limit", () => {
  const parent = createBudget(10);
  const slice = subBudget(parent, 6);
  slice.spent += 4;
  assert.equal(parent.spent, 4);
  assert.equal(slice.left, 2);
  assert.equal(slice.canAfford(3), false);
  parent.spent += 5;
  assert.equal(slice.left, 1);
  assert.equal(slice.canAfford(2), false);
});

test("RSS feed parsing: live views, Shorts links, entities", () => {
  const xml = `<feed><author><name>Tom &amp; Jerry</name></author>
    <entry><yt:videoId>abc123def45</yt:videoId><title>Episode &#39;1&#39; &quot;live&quot;</title>
      <link rel="alternate" href="https://www.youtube.com/shorts/abc123def45"/>
      <published>2026-10-20T10:00:00+00:00</published>
      <media:group><media:description>Desc</media:description>
      <media:thumbnail url="https://i1.ytimg.com/vi/abc123def45/hqdefault.jpg" width="480" height="360"/>
      <media:community><media:statistics views="12345"/></media:community></media:group></entry>
    <entry><yt:videoId>zzz</yt:videoId><title>No date</title></entry></feed>`;
  const feed = parseRssFeed(xml);
  assert.equal(feed.channelName, "Tom & Jerry");
  assert.equal(feed.entries.length, 1);
  const [e] = feed.entries;
  assert.equal(e.title, `Episode '1' "live"`);
  assert.equal(e.views, 12345);
  assert.equal(e.isShort, true);
  assert.equal(e.description, "Desc");
});

test("ISO durations", () => {
  assert.deepEqual(parseIsoDuration("PT1H2M3S"), { seconds: 3723, formatted: "1:02:03" });
  assert.deepEqual(parseIsoDuration("PT45S"), { seconds: 45, formatted: "0:45" });
  assert.equal(parseIsoDuration("P1DT1S").seconds, 86_401);
});

test("Discord: tiers, one video per channel, deltas", () => {
  assert.deepEqual([2.9, 3, 9.9, 10, 25].map(outlierTier), [0, 1, 1, 2, 3]);
  const videos = [{ youtube_channel_id: "a", n: 1 }, { youtube_channel_id: "a", n: 2 }, { youtube_channel_id: "b", n: 3 }];
  assert.deepEqual(onePerChannel(videos, 5).map((v) => v.n), [1, 3]);
  assert.equal(delta(110, null), "");
  assert.match(delta(110, 100), /^ \(\+10 · \+10\.0 %\)$/);
});
