import { Suspense } from "react"

import { ChannelSearchView } from "@/components/channel-search/channel-search-view"

export default function ChannelSearchPage() {
  // The search reads its query from the URL (useSearchParams)
  return (
    <Suspense>
      <ChannelSearchView />
    </Suspense>
  )
}
