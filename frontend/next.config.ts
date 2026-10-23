import type { NextConfig } from "next"
import createMDX from "@next/mdx"

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // PostHog, served from our domain
      { source: "/ingest/static/:path*", destination: "https://us-assets.i.posthog.com/static/:path*" },
      { source: "/ingest/array/:path*", destination: "https://us-assets.i.posthog.com/array/:path*" },
      { source: "/ingest/:path*", destination: "https://us.i.posthog.com/:path*" },
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL}/api/:path*`,
      },
    ]
  },
}

// Blog articles (content/blog/*.mdx); plugins named as strings so Turbopack can load them
const withMDX = createMDX({
  options: { remarkPlugins: ["remark-gfm"], rehypePlugins: ["rehype-slug"] },
})

export default withMDX(nextConfig)
