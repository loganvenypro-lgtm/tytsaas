import { Suspense } from "react"

import { BreakoutExplorer } from "@/components/breakout-creators/breakout-explorer"

export default function BreakoutCreatorsPage() {
  // The explorer reads its filters from the URL (useSearchParams)
  return (
    <Suspense>
      <BreakoutExplorer />
    </Suspense>
  )
}
