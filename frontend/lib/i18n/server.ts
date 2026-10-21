import { cache } from "react"
import { cookies, headers } from "next/headers"

import { DEFAULT_LOCALE, LOCALE_COOKIE, getMessages, isLocale, type Locale } from "@/lib/i18n"

/** The language picked in Paramètres, else the browser's first supported language. */
export const getLocale = cache(async (): Promise<Locale> => {
  const saved = (await cookies()).get(LOCALE_COOKIE)?.value
  if (isLocale(saved)) return saved

  const accepted = (await headers()).get("accept-language") ?? ""
  for (const part of accepted.split(",")) {
    const base = part.split(";")[0].trim().split("-")[0].toLowerCase()
    if (isLocale(base)) return base
  }
  return DEFAULT_LOCALE
})

export async function getT() {
  return getMessages(await getLocale())
}
