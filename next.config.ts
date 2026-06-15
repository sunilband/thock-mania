import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  allowedDevOrigins: ['192.168.1.8'],
  turbopack: {},
  reactStrictMode: true,
  reactCompiler: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
    ],
  },

  experimental: {
    optimizePackageImports: [
      "@phosphor-icons/react",
      "motion",
      "class-variance-authority",
    ],
  },

  ...(true && {
    compiler: {
      removeConsole: {
        exclude: ["error"],
      },
    },
  }),
  logging: {
    fetches: {},
    // browserToTerminal: true,
  },
};

export default withSerwist(nextConfig);
