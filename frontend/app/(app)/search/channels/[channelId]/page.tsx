import { Suspense } from "react"

import { ChannelProfileView } from "@/components/channel-search/channel-profile-view"

export default async function ChannelProfilePage({ params }: { params: Promise<{ channelId: string }> }) {
  const { channelId } = await params
  // The view reads its tab from the URL (useSearchParams)
  return (
    <Suspense>
      <ChannelProfileView channelId={channelId} />
    </Suspense>
  )
}
