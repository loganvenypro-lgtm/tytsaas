// Shared by the server (reading the cookie) and the client (the language picker)

export const LOCALES = ["fr", "en"] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = "fr"
export const LOCALE_COOKIE = "locale"

// Tag passed to Intl for numbers and dates
export const INTL_LOCALES: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-US",
}

// Each language named in itself, so it is recognisable whatever the current language
export const LOCALE_NAMES: Record<Locale, string> = {
  fr: "Français",
  en: "English",
}

/** Remembers the language on this device (browser only); the root layout reads it on the next render. */
export function saveLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value)
}
