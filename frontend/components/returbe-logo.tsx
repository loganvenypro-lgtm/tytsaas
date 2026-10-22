import * as React from "react"

import { cn } from "@/lib/utils"

// The Returbe "R": a red gradient letter whose counter is a play triangle.
// Drawn on a 100×100 grid; the hole is cut with evenodd so the page shows through.
export function ReturbeMark({ className, ...props }: React.ComponentProps<"svg">) {
  // useId returns characters like ":" or "«" that break url(#…) references.
  const id = `returbe${React.useId().replace(/[^\w-]/g, "")}`
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={cn("shrink-0", className)} {...props}>
      <defs>
        <linearGradient id={`${id}-body`} x1="0.15" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#FF1F26" />
          <stop offset="1" stopColor="#C8000F" />
        </linearGradient>
        <linearGradient id={`${id}-leg`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#A8000C" />
          <stop offset="0.45" stopColor="#E3061A" />
          <stop offset="1" stopColor="#FF2A33" />
        </linearGradient>
      </defs>
      <path
        fillRule="evenodd"
        fill={`url(#${id}-body)`}
        d="M7 0H67A31 31 0 0 1 74.3 61.2L100 100H69Q64 100 61.5 96.2L32 52V100H13Q0 100 0 87V7Q0 0 7 0ZM32 20L59.5 33Q64 35 59.5 37.1L32 49Z"
      />
      <path fill={`url(#${id}-leg)`} d="M32 49L48 42.2L74.3 61.2L100 100H69Q64 100 61.5 96.2L32 52Z" />
    </svg>
  )
}
