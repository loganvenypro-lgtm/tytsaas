import Link from "next/link"
import { ArrowRight, Info, Lightbulb, TriangleAlert } from "lucide-react"

import { ReturbeMark } from "@/components/returbe-logo"
import { getMessages, type Locale } from "@/lib/i18n"
import { getT } from "@/lib/i18n/server"
import { cn } from "@/lib/utils"

const TONES = {
  info: { icon: Info, className: "border-blue-200 bg-blue-50/60 [&_svg]:text-blue-600" },
  tip: { icon: Lightbulb, className: "border-emerald-200 bg-emerald-50/60 [&_svg]:text-emerald-600" },
  warning: { icon: TriangleAlert, className: "border-amber-200 bg-amber-50/70 [&_svg]:text-amber-600" },
}

/** <Callout tone="tip">…</Callout> in an article. */
export function Callout({ tone = "info", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  const { icon: Icon, className } = TONES[tone]
  return (
    <div className={cn("mt-8 flex gap-3 rounded-2xl border p-5 [&_p]:mt-0 [&_p]:text-base [&_p]:leading-7", className)}>
      <Icon className="mt-1 size-5 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

/** <Cta /> in an article, or at the end of every one: the landing page's final call to action, smaller. */
export async function Cta({ lang }: { lang?: Locale }) {
  const t = lang ? getMessages(lang) : await getT()
  return (
    <div className="relative mt-14 overflow-hidden rounded-3xl bg-slate-950 px-6 py-14 text-center text-white">
      <div aria-hidden className="lp-aurora absolute top-[calc(50%-10rem)] left-[calc(50%-18rem)] h-[20rem] w-[36rem] rounded-full opacity-80" />
      <div className="relative">
        <ReturbeMark className="mx-auto mb-6 size-10" />
        <p className="text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-3xl">{t.blog.ctaTitle}</p>
        <p className="mx-auto mt-3 max-w-md text-white/65">{t.blog.ctaText(t.brand)}</p>
        <Link
          href="/signup"
          className="lp-shine group relative mt-7 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 font-semibold text-slate-900 transition-all hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]"
        >
          {t.blog.ctaButton} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  )
}
