import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
   allowedDevOrigins: ['192.168.1.8'],
  turbopack: {},
  reactStrictMode: true,
  reactCompiler: isProd,

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
    ],
  },

  experimental: {
    inlineCss: isProd,
    optimizePackageImports: [
      "@phosphor-icons/react",
      "motion",
      "class-variance-authority",
    ],
  },

  ...(isProd && {
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

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
  reloadOnOnline: true,
});

export default withSerwist(nextConfig);
