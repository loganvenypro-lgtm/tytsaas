import { INTL_LOCALES, type Locale } from "./config"
import en from "./messages/en"
import fr, { type Messages } from "./messages/fr"

export * from "./config"
export type { Messages }

const MESSAGES: Record<Locale, Messages> = { fr, en }

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale]
}

/** Number, date and language-name formatting bound to one locale. */
export function createFormatters(locale: Locale) {
  const tag = INTL_LOCALES[locale]
  const compactFormat = new Intl.NumberFormat(tag, { notation: "compact", compactDisplay: "short", maximumFractionDigits: 1 })
  let languageNames: Intl.DisplayNames | null = null

  return {
    compact(number?: number | null): string {
      if (number === undefined || number === null || isNaN(number)) return "0"
      return compactFormat.format(number)
    },
    date(value: string | Date, options: Intl.DateTimeFormatOptions): string {
      return new Intl.DateTimeFormat(tag, options).format(new Date(value))
    },
    /** "en" → "Anglais" / "English"; unknown codes come back upper-cased. */
    language(code: string): string {
      if (code === "zxx") return MESSAGES[locale].common.noSpeech
      try {
        languageNames ??= new Intl.DisplayNames([tag], { type: "language" })
        const name = languageNames.of(code)
        if (name && name !== code) return name.charAt(0).toLocaleUpperCase(tag) + name.slice(1)
      } catch {
        // Invalid language tag
      }
      return code.toUpperCase()
    },
    /**
     * "il y a 3 j" / "3d ago". `from` is the smallest unit shown: below it the text
     * is "à l'instant" (minute), "il y a moins d'1 h" (hour) or "aujourd'hui" (day).
     */
    ago(value: string | Date, from: "minute" | "hour" | "day" = "minute"): string {
      const time = MESSAGES[locale].time
      const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000))
      if (minutes < 60 && from === "minute") return minutes < 1 ? time.justNow : time.minutesAgo(minutes)
      if (minutes < 60 && from === "hour") return time.lessThanHourAgo
      const hours = Math.floor(minutes / 60)
      if (hours < 24 && from !== "day") return time.hoursAgo(hours)
      const days = Math.floor(hours / 24)
      if (days < 1) return time.today
      if (days < 30) return time.daysAgo(days)
      if (days < 365) return time.monthsAgo(Math.round(days / 30))
      return time.yearsAgo(Math.round(days / 365))
    },
  }
}

export type Formatters = ReturnType<typeof createFormatters>
