import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: isGitHubPages ? "export" : undefined,
  trailingSlash: true,
  basePath: isGitHubPages ? "/wimmelbuchgenerator" : undefined,
  assetPrefix: isGitHubPages ? "/wimmelbuchgenerator/" : undefined,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
