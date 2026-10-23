// Remembers where a visitor came from (referrer, UTM, ?ref=) in the tyt_src cookie.
// The backend reads it at sign-in and posts it to Discord (lib/signInWebhook.js).
// "first" is the very first visit and never changes; "last" is the latest visit
// that came from somewhere (a referrer from another site or campaign parameters).

const COOKIE = "tyt_src"
const MAX_AGE = 180 * 24 * 60 * 60

type Touch = {
  referrer?: string
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  ref?: string
  landing: string
  at: string
}

const clip = (value: string | null) => (value ? value.slice(0, 200) : undefined)

function readCookie(): { first?: Touch; last?: Touch } {
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE}=`))
  if (!raw) return {}
  try {
    return JSON.parse(decodeURIComponent(raw.slice(COOKIE.length + 1)))
  } catch {
    return {}
  }
}

export function rememberVisitSource() {
  try {
    const params = new URLSearchParams(location.search)
    const referrer = document.referrer && new URL(document.referrer).host !== location.host ? document.referrer : null
    const touch: Touch = {
      referrer: clip(referrer),
      utm_source: clip(params.get("utm_source")),
      utm_medium: clip(params.get("utm_medium")),
      utm_campaign: clip(params.get("utm_campaign")),
      ref: clip(params.get("ref")),
      landing: location.pathname.slice(0, 200),
      at: new Date().toISOString(),
    }
    const fromSomewhere = Boolean(touch.referrer || touch.utm_source || touch.ref)
    const saved = readCookie()
    if (saved.first && !fromSomewhere) return

    const value = { first: saved.first ?? touch, last: fromSomewhere ? touch : saved.last }
    const secure = location.protocol === "https:" ? "; Secure" : ""
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax${secure}`
  } catch {
    // A malformed referrer or blocked cookies must never break the page
  }
}
