import fs from "node:fs";
import path from "node:path";

// The JSON databases carried over from Outlr (gitignored, see data/)
export const DATA_DIR = path.join(process.cwd(), "data");

// Parsed files, reused until the file changes on disk (some weigh tens of MB)
const cache = new Map();

export function listJsonFiles() {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const stat = fs.statSync(path.join(DATA_DIR, f));
      return { name: f, bytes: stat.size, updatedAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Reads one data/*.json file; null when the name is not one of them. */
export function readJsonFile(name) {
  if (!listJsonFiles().some((f) => f.name === name)) return null;
  const file = path.join(DATA_DIR, name);
  const { mtimeMs } = fs.statSync(file);
  const hit = cache.get(name);
  if (hit && hit.mtimeMs === mtimeMs) return hit.data;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  cache.set(name, { mtimeMs, data });
  return data;
}

export function describe(value) {
  if (Array.isArray(value)) return `${value.length} éléments`;
  if (value && typeof value === "object") return `${Object.keys(value).length} clés`;
  return typeof value;
}
