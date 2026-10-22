import { LandingPage, type LandingData } from "@/components/landing/landing-page"

const EMPTY: LandingData = {
  stats: { videos: 0, channels: 0, views: 0, bigOutliers: 0, freshWeek: 0, updatedAt: null },
  videos: [],
  breakouts: [],
  niches: [],
  creators: [],
}

/** Live numbers and real outliers; the backend caches them for an hour. */
async function getLandingData(): Promise<LandingData> {
  try {
    const res = await fetch(`${process.env.BACKEND_URL}/api/landing`, { cache: "no-store" })
    if (res.ok) return await res.json()
  } catch {
    // Backend down: the page still renders, without the live sections
  }
  return EMPTY
}

/** /welcome: the public landing page, the entry point for signed-out visitors. */
export default async function WelcomePage() {
  return <LandingPage data={await getLandingData()} />
}
