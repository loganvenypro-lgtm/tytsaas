// Validation for the user's folders (controllers/folders.js).

export const FOLDER_NAME_MAX = 80;

const str = (value, max) => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);
const numOrNull = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** A folder name, trimmed, or null when empty or too long. */
export function parseFolderName(raw) {
  const name = typeof raw === "string" ? raw.trim() : "";
  return name && name.length <= FOLDER_NAME_MAX ? name : null;
}

/**
 * A video or channel sent by the client, or null when invalid. Only known
 * snapshot fields are kept, and empty ones are dropped to keep the JSON small.
 */
export function parseItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const { type, id, snapshot } = raw;
  if (type !== "video" && type !== "channel") return null;
  if (typeof id !== "string" || !/^[\w-]{6,64}$/.test(id)) return null;
  const s = snapshot && typeof snapshot === "object" ? snapshot : {};

  const clean = {
    title: str(s.title, 300) ?? id,
    thumbnail: str(s.thumbnail, 600),
    channelId: str(s.channelId, 64),
    channelName: str(s.channelName, 200),
    views: numOrNull(s.views),
    multiplier: numOrNull(s.multiplier),
    publishedAt: str(s.publishedAt, 40),
    isShort: typeof s.isShort === "boolean" ? s.isShort : null,
    handle: str(s.handle, 120),
    subscribers: numOrNull(s.subscribers),
  };
  for (const key of Object.keys(clean)) if (clean[key] == null) delete clean[key];
  return { type, id, snapshot: clean };
}
