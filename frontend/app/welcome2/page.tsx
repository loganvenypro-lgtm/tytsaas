import type { LandingData } from "@/components/landing/landing-page"
import { LandingPageV2 } from "@/components/landing/landing-page-v2"

const EMPTY: LandingData = {
  stats: { videos: 0, channels: 0, views: 0, bigOutliers: 0, freshWeek: 0, updatedAt: null },
  videos: [],
  breakouts: [],
  niches: [],
  creators: [],
}

/** Same feed as /welcome; the backend caches it for an hour. */
async function getLandingData(): Promise<LandingData> {
  try {
    const res = await fetch(`${process.env.BACKEND_URL}/api/landing`, { cache: "no-store" })
    if (res.ok) return await res.json()
  } catch {
    // Backend down: the page still renders, without the live sections
  }
  return EMPTY
}

/** /welcome2: the dark red redesign of the public landing page. */
export default async function Welcome2Page() {
  return <LandingPageV2 data={await getLandingData()} />
}
