import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  turbopack: {},
  reactStrictMode: true,
  reactCompiler: isProd,

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
