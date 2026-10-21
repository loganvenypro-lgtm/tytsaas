// DiceBear avatars (https://www.dicebear.com/how-to-use/http-api/).
// Keep in sync with lib/avatar.js in the backend, which only accepts these URLs.

const DICEBEAR_BASE = "https://api.dicebear.com/9.x"
const BACKGROUNDS = ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf", "d1f4e0"]

// Styles offered in Settings > Profile (labels in t.settings.avatarStyles)
export const AVATAR_STYLES = [
  { id: "notionists" },
  { id: "avataaars" },
  { id: "lorelei" },
  { id: "micah" },
  { id: "adventurer" },
  { id: "personas" },
  { id: "fun-emoji" },
  { id: "bottts" },
] as const

export type AvatarStyle = (typeof AVATAR_STYLES)[number]["id"]

/** Same seed => same avatar, so a stable seed (the email) keeps a user's picture consistent. */
export function getDicebearAvatar(seed: string, style: AvatarStyle = AVATAR_STYLES[0].id): string {
  const params = new URLSearchParams({
    seed: seed.trim().toLowerCase() || "outlr",
    backgroundColor: BACKGROUNDS.join(","),
    backgroundType: "solid",
  })
  return `${DICEBEAR_BASE}/${style}/svg?${params.toString()}`
}

/** The user's picture, or their default avatar when they have none. */
export function resolveAvatar(user: { image?: string | null; email: string }): string {
  return user.image || getDicebearAvatar(user.email)
}

/** Style and seed of a saved DiceBear URL, to reopen the picker where the user left it. */
export function parseAvatar(url: string | null | undefined, email: string): { style: AvatarStyle; seed: string } {
  try {
    const parsed = new URL(url ?? "")
    const style = parsed.pathname.split("/")[2]
    const known = AVATAR_STYLES.find((s) => s.id === style)
    return { style: known?.id ?? AVATAR_STYLES[0].id, seed: parsed.searchParams.get("seed") ?? email }
  } catch {
    return { style: AVATAR_STYLES[0].id, seed: email }
  }
}

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10)
}
