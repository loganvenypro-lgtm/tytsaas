import { Suspense } from "react"

import { TopVideosExplorer } from "@/components/top-videos/top-videos-explorer"

export default function TopVideosPage() {
  // The explorer reads its filters from the URL (useSearchParams)
  return (
    <Suspense>
      <TopVideosExplorer />
    </Suspense>
  )
}
