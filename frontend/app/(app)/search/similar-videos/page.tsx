import { Suspense } from "react"

import { SimilarVideosView } from "@/components/similar-videos/similar-videos-view"

export default function SimilarVideosPage() {
  // The view reads the video, mode and filters from the URL (useSearchParams)
  return (
    <Suspense>
      <SimilarVideosView />
    </Suspense>
  )
}
