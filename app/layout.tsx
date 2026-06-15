import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist_Mono, Space_Grotesk } from "next/font/google";

import "./globals.css";
import { AuthProvider } from "@/components/auth/auth-provider";
import {
  generateAnonAvatarUrl,
  generateAnonName,
} from "@/lib/anonymous-identity";
import { AppChrome } from "@/components/layout/app-chrome";
import { SettingsProvider } from "@/components/settings/settings-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";
import { GoogleAnalytics } from '@next/third-parties/google'

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default:
      "Thock Mania — Free Typing Test with Mechanical Keyboard Sounds | WPM & Accuracy",
    template: "%s | Thock Mania",
  },
  description: siteConfig.description,
  keywords: [
    "typing test",
    "free typing test",
    "typing speed test",
    "online typing test",
    "wpm test",
    "words per minute test",
    "typing practice",
    "typing trainer",
    "typing speed",
    "check typing speed",
    "type test",
    "keyboard test",
    "mechanical keyboard sounds",
    "keyboard sound test",
    "typing sound",
    "monkeytype alternative",
    "Thock Mania",
  ],
  authors: [{ name: siteConfig.creator, url: siteConfig.creatorUrl }],
  creator: siteConfig.creator,
  publisher: siteConfig.creator,
  metadataBase: new URL(siteConfig.url),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title:
      "Thock Mania — Free Typing Test with Mechanical Keyboard Sounds | WPM & Accuracy",
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: "/og.webp",
        width: 1353,
        height: 861,
        alt: "Thock Mania — typing test with mechanical keyboard sounds, on-screen keyboard, and real-time WPM tracking",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Thock Mania — Typing Test with Mechanical Keyboard Sounds",
    description:
      "A satisfying typing test with realistic mechanical keyboard sounds. Track your WPM and accuracy in real-time.",
    images: ["/og.webp"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "technology",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: siteConfig.name,
  url: siteConfig.url,
  description: siteConfig.description,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Any",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  author: {
    "@type": "Person",
    name: siteConfig.creator,
    url: siteConfig.creatorUrl,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read anonymous UID from cookie (set by middleware) and resolve identity server-side
  const cookieStore = await cookies();
  const anonUid = cookieStore.get("kz-anon-uid")?.value ?? "";
  const anonDisplayName = anonUid ? generateAnonName(anonUid) : "Anonymous";
  const anonAvatarUrl = anonUid ? generateAnonAvatarUrl(anonUid) : "";

  return (
    <html
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        spaceGrotesk.variable
      )}
      lang="en"
      suppressHydrationWarning
    >
      {/* Blocking script: apply saved accent before first paint to prevent flash */}
      <head>
        <link
          as="fetch"
          crossOrigin="anonymous"
          href="/sounds/sound.ogg"
          rel="preload"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var a=localStorage.getItem("tc-accent");if(a)document.documentElement.setAttribute("data-accent",a);var t=localStorage.getItem("theme");if(t==="dark"||t==="light"){document.documentElement.classList.add(t)}else if(!t||t==="system"){if(window.matchMedia("(prefers-color-scheme: dark)").matches){document.documentElement.classList.add("dark")}}}catch(e){}})()`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          type="application/ld+json"
        />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider
            anonAvatarUrl={anonAvatarUrl}
            anonDisplayName={anonDisplayName}
          >
            <SettingsProvider>
              <AppChrome>{children}</AppChrome>
            </SettingsProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
      <GoogleAnalytics gaId="G-SQJJCVP529" />
    </html>
  );
}
