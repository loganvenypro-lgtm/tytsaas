import type { LandingData } from "@/components/landing/landing-page"

const ROWS = 7

/** Thumbnails of the landing's real outliers; none when the backend is down (plain background then). */
async function getThumbnails(): Promise<string[]> {
  try {
    const res = await fetch(`${process.env.BACKEND_URL}/api/landing`, { cache: "no-store" })
    if (!res.ok) return []
    const data: LandingData = await res.json()
    return [...new Set([...data.videos, ...data.breakouts].map((v) => v.thumbnail).filter(Boolean))]
  } catch {
    return []
  }
}

/**
 * Auth pages (login, signup, password reset): the form in a card over a wall of
 * thumbnails scrolling row by row, blurred and dimmed so it fills the screen
 * without competing with the form.
 */
export async function AuthShell({ children }: { children: React.ReactNode }) {
  const thumbnails = await getThumbnails()
  // Rows of at least 8 so a row is always wider than the screen once doubled
  const rows =
    thumbnails.length >= 8
      ? Array.from({ length: ROWS }, (_, r) => {
          const shift = Math.floor((thumbnails.length / ROWS) * r)
          return [...thumbnails.slice(shift), ...thumbnails.slice(0, shift)].slice(0, Math.max(8, Math.ceil(thumbnails.length / 2)))
        })
      : []

  return (
    <div className="relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background p-6 md:p-10">
      {rows.length > 0 && (
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-[-10%] flex -rotate-6 flex-col justify-center gap-4 blur-[6px] saturate-[1.15]">
            {rows.map((row, r) => (
              <div key={r} className="flex">
                <div
                  className={r % 2 ? "lp-marquee lp-marquee-reverse flex shrink-0 gap-4 pr-4" : "lp-marquee flex shrink-0 gap-4 pr-4"}
                  style={{ animationDuration: `${120 + r * 15}s` }}
                >
                  {[...row, ...row].map((src, i) => (
                    <img key={i} src={src} alt="" decoding="async" className="aspect-video w-56 shrink-0 rounded-xl object-cover sm:w-72" />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Dim the wall, more behind the card, so the form reads first in light and dark mode */}
          <div className="absolute inset-0 bg-background/35" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_30%_45%_at_50%_50%,var(--background)_0%,transparent_100%)] opacity-60" />
        </div>
      )}
      <div className="w-full max-w-sm rounded-2xl border bg-background/85 p-6 shadow-2xl backdrop-blur-xl md:p-8">{children}</div>
    </div>
  )
}
