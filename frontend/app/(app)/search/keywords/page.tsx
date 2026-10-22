import { Suspense } from "react"

import { KeywordsExplorer } from "@/components/keywords/keywords-explorer"

export default function KeywordsPage() {
  // The explorer reads its keyword and filters from the URL (useSearchParams)
  return (
    <Suspense>
      <KeywordsExplorer />
    </Suspense>
  )
}
