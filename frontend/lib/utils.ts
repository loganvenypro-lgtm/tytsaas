export { cn } from "cn"

/** A same-site path to go to after signing in (`?next=`), or "/" when missing or pointing elsewhere. */
export function safeNextPath(raw: unknown): string {
  return typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/"
}

/** Appends `?next=` to an auth page link, unless next is the home page. */
export const withNext = (path: string, next: string) => (next === "/" ? path : `${path}?next=${encodeURIComponent(next)}`)
