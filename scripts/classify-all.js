// Classifies every channel and video now (after a taxonomy change or a fresh import),
// instead of waiting for the worker's batches. Channels are classified a second
// time at the end so they benefit from their videos' detected language and format.
// Usage: npm run classify:all
import "../lib/env.js";
import { sql } from "../lib/sql.js";
import { runClassify } from "../worker/jobs/classify.js";

const t0 = Date.now();
const first = await runClassify({ full: true });
console.log("Pass 1:", first);
await sql`update channels set classified_at = null`;
await sql`update videos set classifier_version = null`;
const second = await runClassify({ full: true });
console.log("Pass 2 (with channel languages and formats from pass 1):", second);
console.log(`Done in ${Math.round((Date.now() - t0) / 1000)} s`);
await sql.end();
