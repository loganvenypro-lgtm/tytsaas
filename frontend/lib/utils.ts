export { cn } from "cn"

/** A same-site path to go to after signing in (`?next=`), or "/" when missing or pointing elsewhere. */
export function safeNextPath(raw: unknown): string {
  if (typeof raw !== "string" || !raw.startsWith("/")) return "/"
  // Resolved the way the browser will: it drops tabs and newlines and reads "\" as "/",
  // so "/\t/evil.com" would become "//evil.com". Only a path that stays on this origin passes.
  const base = "http://same-origin.invalid"
  try {
    const url = new URL(raw, base)
    return url.origin === base ? url.pathname + url.search + url.hash : "/"
  } catch {
    return "/"
  }
}

/** Appends `?next=` to an auth page link, unless next is the home page. */
export const withNext = (path: string, next: string) => (next === "/" ? path : `${path}?next=${encodeURIComponent(next)}`)
