// DiceBear avatars (https://www.dicebear.com/how-to-use/http-api/).
// Keep in sync with frontend/lib/avatar.ts, which builds the same URLs.

const DICEBEAR_BASE = "https://api.dicebear.com/9.x";
const BACKGROUNDS = ["b6e3f4", "c0aede", "d1d4f9", "ffd5dc", "ffdfbf", "d1f4e0"];

export const AVATAR_STYLES = ["notionists", "avataaars", "lorelei", "micah", "adventurer", "personas", "fun-emoji", "bottts"];

/** Same seed => same avatar, so a stable seed (the email) keeps a user's picture consistent. */
export function getDicebearAvatar(seed, style = AVATAR_STYLES[0]) {
  const params = new URLSearchParams({
    seed: seed.trim().toLowerCase() || "outlr",
    backgroundColor: BACKGROUNDS.join(","),
    backgroundType: "solid",
  });
  return `${DICEBEAR_BASE}/${style}/svg?${params.toString()}`;
}

/** Only DiceBear URLs in one of our styles can be saved as a profile picture. */
export function isAllowedAvatarUrl(url) {
  try {
    const parsed = new URL(url);
    const [, version, style, format] = parsed.pathname.split("/");
    return (
      parsed.protocol === "https:" &&
      parsed.hostname === "api.dicebear.com" &&
      version === "9.x" &&
      AVATAR_STYLES.includes(style) &&
      format === "svg"
    );
  } catch {
    return false;
  }
}
