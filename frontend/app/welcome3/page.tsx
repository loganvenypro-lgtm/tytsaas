import { Archivo } from "next/font/google"

import type { LandingData } from "@/components/landing/landing-page"
import { LandingPageV3 } from "@/components/landing/landing-page-v3"

// One family for the whole page: expanded widths for headlines and scores, normal width for reading
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-w3" })

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

/** /welcome3: the light redesign built around the ×score. */
export default async function Welcome3Page() {
  return <LandingPageV3 data={await getLandingData()} fontClass={archivo.variable} />
}
