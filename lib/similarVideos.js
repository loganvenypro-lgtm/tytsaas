/**
 * Nearest neighbours among the CLIP vectors of video_embeddings (worker/jobs/embeddings.js).
 * Two backends, picked from the column type the migration created:
 *   - pgvector: HNSW indexes, the filters run in the same query (iterative scan)
 *   - memory:   without pgvector, the API keeps a copy of the vectors (refreshed every
 *               few minutes) and scans it; fine for a sample, install pgvector for the full base
 * Vectors are unit length, so cosine similarity is a dot product.
 */
import { sql } from "./sql.js";
import { CLIP_MODEL } from "./clip.js";

const REFRESH_MS = 5 * 60_000;
// Memory backend: neighbours kept before the SQL filters (language, format…) apply.
const MEMORY_CANDIDATES = 3000;

let backendInfo;
/** "pgvector" or "memory", and whether pgvector can keep scanning past filtered-out rows (0.8+). */
export function backend() {
  backendInfo ??= (async () => {
    const [column] = await sql`
      select format_type(atttypid, atttypmod) as type from pg_attribute
      where attrelid = 'video_embeddings'::regclass and attname = 'thumbnail'`;
    if (!column?.type.startsWith("vector")) return { name: "memory" };
    const [ext] = await sql`select extversion from pg_extension where extname = 'vector'`;
    const [major, minor] = (ext?.extversion ?? "0.0").split(".").map(Number);
    return { name: "pgvector", iterativeScan: major > 0 || minor >= 8 };
  })().catch((err) => {
    backendInfo = null;
    throw err;
  });
  return backendInfo;
}

const vectorLiteral = (v) => `[${Array.from(v).join(",")}]`;

/**
 * Up to `limit` videos closest to the query, within `where` (a fragment on
 * `videos v JOIN channels c`): [{ id, similarity }], most similar first.
 * `query.thumbnail` is compared with thumbnails and `query.title` with titles;
 * with both, similarity is the mean of the two (the "topic" search).
 */
export async function nearest(query, where, limit) {
  const { name, iterativeScan } = await backend();
  return name === "pgvector" ? nearestPgvector(query, where, limit, iterativeScan) : nearestMemory(query, where, limit);
}

async function nearestPgvector(query, where, limit, iterativeScan) {
  const filtered = sql`
    from video_embeddings e
    join videos v on v.youtube_video_id = e.youtube_video_id
    join channels c on c.id = v.channel_id
    where e.model = ${CLIP_MODEL} and ${where}`;
  const knn = (column, vector) => sql`
    select e.youtube_video_id as id, 1 - (e.${sql(column)} <=> ${vectorLiteral(vector)}::vector) as similarity
    ${filtered} and e.${sql(column)} is not null
    order by e.${sql(column)} <=> ${vectorLiteral(vector)}::vector
    limit ${limit}`;

  return sql.begin(async (tx) => {
    // Keep walking the graph when filters reject the closest rows, instead of returning too few.
    if (iterativeScan) await tx`set local hnsw.iterative_scan = relaxed_order`;
    await tx`set local hnsw.ef_search = ${Math.max(100, limit * 2)}`;
    if (query.thumbnail && query.title) {
      const t = vectorLiteral(query.thumbnail);
      const q = vectorLiteral(query.title);
      return tx`
        with candidates as ((${knn("thumbnail", query.thumbnail)}) union (${knn("title", query.title)}))
        select e.youtube_video_id as id,
          ((1 - (e.thumbnail <=> ${t}::vector)) + (1 - (e.title <=> ${q}::vector))) / 2 as similarity
        from candidates x
        join video_embeddings e on e.youtube_video_id = x.id
        where e.thumbnail is not null
        order by similarity desc
        limit ${limit}`;
    }
    return query.thumbnail ? tx`${knn("thumbnail", query.thumbnail)}` : tx`${knn("title", query.title)}`;
  });
}

// --- Memory backend -------------------------------------------------------

const memory = { vectors: new Map(), loadedAt: 0, since: new Date(0), loading: null };

async function memoryIndex() {
  if (Date.now() - memory.loadedAt < REFRESH_MS) return memory.vectors;
  memory.loading ??= (async () => {
    const startedAt = new Date();
    const rows = await sql`
      select youtube_video_id as id, thumbnail, title
      from video_embeddings
      where model = ${CLIP_MODEL} and embedded_at >= ${memory.since}`;
    for (const r of rows) {
      memory.vectors.set(r.id, {
        thumbnail: r.thumbnail ? Float32Array.from(r.thumbnail) : null,
        title: r.title ? Float32Array.from(r.title) : null,
      });
    }
    memory.since = startedAt;
    memory.loadedAt = Date.now();
  })().finally(() => {
    memory.loading = null;
  });
  await memory.loading;
  return memory.vectors;
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

async function nearestMemory(query, where, limit) {
  const vectors = await memoryIndex();
  const scored = [];
  for (const [id, v] of vectors) {
    if (query.thumbnail && !v.thumbnail) continue;
    let similarity;
    if (query.thumbnail && query.title) similarity = (dot(query.thumbnail, v.thumbnail) + dot(query.title, v.title)) / 2;
    else if (query.thumbnail) similarity = dot(query.thumbnail, v.thumbnail);
    else if (v.title) similarity = dot(query.title, v.title);
    else continue;
    scored.push({ id, similarity });
  }
  scored.sort((a, b) => b.similarity - a.similarity);
  const top = scored.slice(0, MEMORY_CANDIDATES);
  if (!top.length) return [];

  const allowed = await sql`
    select v.youtube_video_id as id
    from videos v join channels c on c.id = v.channel_id
    where v.youtube_video_id = any(${top.map((t) => t.id)}::text[]) and ${where}`;
  const keep = new Set(allowed.map((r) => r.id));
  return top.filter((t) => keep.has(t.id)).slice(0, limit);
}

/** Stored vectors of a video, or null when the worker hasn't embedded it yet. */
export async function storedVectors(videoId) {
  const [row] = await sql`
    select thumbnail::real[] as thumbnail, title::real[] as title
    from video_embeddings where youtube_video_id = ${videoId} and model = ${CLIP_MODEL}`;
  if (!row) return null;
  return {
    thumbnail: row.thumbnail ? Float32Array.from(row.thumbnail) : null,
    title: row.title ? Float32Array.from(row.title) : null,
  };
}

/** Save vectors computed on request, as the worker would have. */
export async function storeVectors(videoId, { thumbnail, title }) {
  const literal = (v) => (v ? `{${Array.from(v).join(",")}}` : null);
  await sql`
    insert into video_embeddings (youtube_video_id, model, thumbnail, title, thumbnail_version, title_version)
    select v.youtube_video_id, ${CLIP_MODEL}, ${literal(thumbnail)}::real[], ${literal(title)}::real[],
      v.thumbnail_variants, v.title_variants
    from videos v where v.youtube_video_id = ${videoId}
    on conflict (youtube_video_id) do update set
      model = excluded.model, thumbnail = excluded.thumbnail, title = excluded.title,
      thumbnail_version = excluded.thumbnail_version, title_version = excluded.title_version, embedded_at = now()`;
}

/** How much of the base has vectors. */
export async function coverage() {
  const [row] = await sql`
    select (select count(*)::int from video_embeddings where model = ${CLIP_MODEL}) as embedded,
      (select count(*)::int from videos) as total`;
  return row;
}
