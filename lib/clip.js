/**
 * CLIP (ViT-B/32) run locally with transformers.js / ONNX Runtime on the CPU:
 * no API key, no per-call cost, and thumbnails come from i.ytimg.com, so
 * embedding never spends YouTube quota. Images and texts land in the same
 * 512-d space, so a title or a typed concept can be matched against thumbnails.
 *
 * The model (~150 MB with 8-bit weights) is downloaded from Hugging Face on
 * first use into .cache/transformers, then loaded lazily: the API only pays
 * for it the first time someone asks for similar videos.
 */
import { fileURLToPath } from "node:url";

const MODEL_ID = process.env.CLIP_MODEL || "Xenova/clip-vit-base-patch32";
const DTYPE = process.env.CLIP_DTYPE || "q8";
export const CLIP_DIMS = 512;
// Stored next to every vector: vectors from another model or precision are not comparable.
export const CLIP_MODEL = `${MODEL_ID}@${DTYPE}`;

let library;
let vision;
let text;

async function load() {
  if (!library) {
    library = await import("@huggingface/transformers");
    library.env.cacheDir = fileURLToPath(new URL("../.cache/transformers", import.meta.url));
  }
  return library;
}

function visionModel() {
  vision ??= (async () => {
    const { AutoProcessor, CLIPVisionModelWithProjection } = await load();
    const [processor, model] = await Promise.all([
      AutoProcessor.from_pretrained(MODEL_ID),
      CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, { dtype: DTYPE }),
    ]);
    return { processor, model };
  })().catch((err) => {
    vision = null;
    throw err;
  });
  return vision;
}

function textModel() {
  text ??= (async () => {
    const { AutoTokenizer, CLIPTextModelWithProjection } = await load();
    const [tokenizer, model] = await Promise.all([
      AutoTokenizer.from_pretrained(MODEL_ID),
      CLIPTextModelWithProjection.from_pretrained(MODEL_ID, { dtype: DTYPE }),
    ]);
    return { tokenizer, model };
  })().catch((err) => {
    text = null;
    throw err;
  });
  return text;
}

/** Unit-length rows of a [n, 512] tensor: cosine similarity becomes a dot product. */
function normalizedRows(tensor) {
  const [n, dims] = tensor.dims;
  return Array.from({ length: n }, (_, i) => {
    const row = Float32Array.from(tensor.data.subarray(i * dims, (i + 1) * dims));
    let norm = 0;
    for (const x of row) norm += x * x;
    norm = Math.sqrt(norm) || 1;
    for (let k = 0; k < dims; k++) row[k] /= norm;
    return row;
  });
}

/** 16:9 thumbnail at 320x180, no black bars (hqdefault is letterboxed 4:3). */
export const thumbnailUrl = (videoId) => `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`;

/** A decoded thumbnail, or null when YouTube has none (deleted or private video). */
export async function fetchThumbnail(videoId) {
  const res = await fetch(thumbnailUrl(videoId), { signal: AbortSignal.timeout(10_000) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Thumbnail ${videoId}: HTTP ${res.status}`);
  const { RawImage } = await load();
  return RawImage.fromBlob(await res.blob());
}

/**
 * Embeddings of decoded images. CLIP sees a 224x224 square: the 16:9 picture is
 * squeezed into it rather than center-cropped, which would cut off the text and
 * faces thumbnails often put on the sides.
 */
export async function embedImages(images) {
  if (!images.length) return [];
  const { processor, model } = await visionModel();
  const squares = await Promise.all(images.map((image) => image.resize(224, 224)));
  const { image_embeds } = await model(await processor(squares));
  return normalizedRows(image_embeds);
}

export async function embedTexts(texts) {
  if (!texts.length) return [];
  const { tokenizer, model } = await textModel();
  // CLIP reads at most 77 tokens
  const inputs = tokenizer(texts, { padding: true, truncation: true, max_length: 77 });
  const { text_embeds } = await model(inputs);
  return normalizedRows(text_embeds);
}
