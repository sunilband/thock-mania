import { spawnSync } from "node:child_process";
import { createSerwistRoute } from "@serwist/turbopack";

// A revision versions precached pages so outdated responses aren't reused.
const revision =
    spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).stdout?.trim() ||
    crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
    createSerwistRoute({
        additionalPrecacheEntries: [{ url: "/", revision }],
        swSrc: "app/sw.ts",
        // Use platform-independent `esbuild-wasm` everywhere. The native
        // `esbuild` package needs per-platform binaries, which can be missing
        // on Vercel (Linux) when the lockfile is generated on Windows.
        useNativeEsbuild: false,
    });
