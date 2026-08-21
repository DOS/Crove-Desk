import type { NextConfig } from "next"
import { PHASE_DEVELOPMENT_SERVER } from "next/constants"

const backendBaseUrl =
  process.env.NEXT_API_BASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  "http://127.0.0.1:8083"
const productionBasePath = ""

export default function nextConfig(phase: string): NextConfig {
  const config: NextConfig = {
    output: "export",
    basePath: productionBasePath,
    assetPrefix: `${productionBasePath}/`,
    trailingSlash: false,
    devIndicators: false,
    reactStrictMode: false,
  }

  if (phase !== PHASE_DEVELOPMENT_SERVER) {
    return config
  }

  return {
    ...config,
    async rewrites() {
      return [
        {
          source: "/support/help/:slug+",
          destination: "/support/help",
        },
        {
          source: "/support/questions/:id(\\d+)",
          destination: "/support/questions/detail?id=:id",
        },
        {
          source: "/api/:path*",
          destination: `${backendBaseUrl}/api/:path*`,
        },
        {
          source: "/storage/:path*",
          destination: `${backendBaseUrl}/storage/:path*`,
        },
      ]
    },
  }
}
