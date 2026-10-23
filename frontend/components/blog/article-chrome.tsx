"use client"

import { useEffect, useState } from "react"

import { cn } from "@/lib/utils"

/** Thin bar under the header showing how far the reader is in the article. */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <div aria-hidden className="fixed inset-x-0 top-16 z-40 h-0.5">
      <div className="h-full origin-left bg-gradient-to-r from-[#C8000F] to-[#FF2A33]" style={{ transform: `scaleX(${progress})` }} />
    </div>
  )
}

/** Sticky table of contents; the section being read is highlighted. */
export function TableOfContents({ title, headings }: { title: string; headings: { id: string; text: string }[] }) {
  const [active, setActive] = useState(headings[0]?.id)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: "-80px 0px -70% 0px" }
    )
    for (const { id } of headings) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [headings])

  if (!headings.length) return null
  return (
    <nav aria-label={title}>
      <p className="text-sm font-semibold text-slate-950">{title}</p>
      <ul className="mt-3 space-y-1 border-l border-slate-200">
        {headings.map(({ id, text }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className={cn(
                "-ml-px block border-l-2 py-1 pl-4 text-sm leading-6 transition-colors",
                active === id ? "border-[#E3061A] text-slate-950" : "border-transparent text-slate-500 hover:text-slate-950"
              )}
            >
              {text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
