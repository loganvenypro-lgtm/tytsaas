import { test, after } from "node:test";
import assert from "node:assert/strict";
import "../lib/env.js";
import { sql } from "../lib/sql.js";
import { applyFilters, applySort, parsePage, describeSpec } from "../lib/filterSpec.js";
import { VIDEO_SPEC } from "../controllers/videos.js";
import { CHANNEL_SPEC } from "../controllers/channels.js";

after(() => sql.end({ timeout: 1 }));

test("unknown and invalid values are dropped, valid ones are reported as applied", () => {
  const { applied } = applyFilters(VIDEO_SPEC, {
    niche: "gaming,not_a_niche",
    hooks: "question,nope",
    category: "20,abc",
    country: "FR,france",
    minViews: "1000",
    maxViews: "oops",
    relevant: "false",
    q: "  minecraft  ",
  });
  assert.deepEqual(applied.niche, ["gaming"]);
  assert.deepEqual(applied.hooks, ["question"]);
  assert.deepEqual(applied.category, [20]);
  assert.deepEqual(applied.country, ["FR"]);
  assert.equal(applied.minViews, 1000);
  assert.equal(applied.maxViews, undefined);
  assert.equal(applied.relevant, false);
  assert.equal(applied.q, "minecraft");
});

test("choice filters fall back to their default, sorts to the spec default", () => {
  const { applied } = applyFilters(VIDEO_SPEC, { format: "nonsense" });
  const format = VIDEO_SPEC.filters.find((f) => f.key === "format");
  assert.equal(applied.format, format.default);
  assert.equal(applySort(VIDEO_SPEC, { sort: "nonsense" }).sort, VIDEO_SPEC.defaultSort);
  assert.equal(applySort(CHANNEL_SPEC, { sort: "revenue" }).sort, "revenue");
});

test("pages are clamped", () => {
  assert.equal(parsePage({ page: "-3" }, 20).page, 0);
  assert.equal(parsePage({ page: "2" }, 20).offset, 40);
});

test("describeSpec exposes every filter with params, options and counts", () => {
  const counts = { niche: new Map([["gaming", 12]]) };
  const description = describeSpec(VIDEO_SPEC, counts);
  assert.equal(description.filters.length, VIDEO_SPEC.filters.length);
  const views = description.filters.find((f) => f.key === "views");
  assert.deepEqual(views.params, ["minViews", "maxViews"]);
  const niche = description.filters.find((f) => f.key === "niche");
  assert.equal(niche.options.find((o) => o.value === "gaming").count, 12);
  assert.equal(niche.options.find((o) => o.value === "music").count, 0);
  const ypp = describeSpec(CHANNEL_SPEC).filters.find((f) => f.key === "ypp");
  assert.deepEqual(ypp.options.map((o) => o.value), ["eligible", "early", "not_eligible"]);
});

/** Sample query string that turns every filter of a spec on. */
function everything(spec) {
  const query = {};
  for (const f of spec.filters) {
    const cap = f.key.charAt(0).toUpperCase() + f.key.slice(1);
    if (f.type === "range") Object.assign(query, { [`min${cap}`]: "1", [`max${cap}`]: "1000000" });
    else if (f.type === "bool") query[f.key] = "true";
    else if (f.type === "text") query[f.key] = "test";
    else if (f.type === "choice") query[f.key] = f.options.at(-1).value;
    else if (f.key === "country") query[f.key] = "FR";
    else if (f.options) query[f.key] = String(f.options()[0].value);
  }
  return query;
}

// Runs every filter and sort against PostgreSQL: a broken SQL fragment fails here, not in production.
test("every video filter and sort is valid SQL", { skip: !process.env.DATABASE_URL }, async () => {
  const { where } = applyFilters(VIDEO_SPEC, everything(VIDEO_SPEC));
  for (const sort of VIDEO_SPEC.sorts) {
    await sql`
      select v.id from videos v join channels c on c.id = v.channel_id
      where ${where} order by ${sort.orderBy} limit 1`;
  }
});

test("every channel filter and sort is valid SQL", { skip: !process.env.DATABASE_URL }, async () => {
  const { where } = applyFilters(CHANNEL_SPEC, everything(CHANNEL_SPEC));
  // Same shape as the breakout query: c = channels, r = 30-day aggregates, snapshot deltas.
  for (const sort of CHANNEL_SPEC.sorts) {
    await sql`
      select c.id
      from channels c
      join (
        select channel_id, 0::float8 as views_7d, 0 as uploads_7d, 0 as outliers_30d, 0::real as best_multiplier,
          0::float8 as short_share, null::smallint as category_id, null::text as language
        from videos group by channel_id
      ) r on r.channel_id = c.id
      cross join (select 0::bigint as views_24h, 0::bigint as views_prev_24h, 0::int as subs_24h) snap
      where ${where} order by ${sort.orderBy} limit 1`;
  }
});
