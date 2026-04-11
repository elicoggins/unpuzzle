import type { Metadata } from "next";
import Script from "next/script";
import { Space_Grotesk, JetBrains_Mono, Orbitron, Press_Start_2P, Audiowide } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { AccentProvider } from "@/components/accent-provider";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
});

const pressStart2P = Press_Start_2P({
  variable: "--font-press-start",
  weight: "400",
  subsets: ["latin"],
});

const audiowide = Audiowide({
  variable: "--font-audiowide",
  weight: "400",
  subsets: ["latin"],
});

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "unpuzzle",
  description: "Play good moves. Not perfect ones.",
  openGraph: {
    title: "unpuzzle",
    description: "Play good moves. Not perfect ones.",
    url: "https://elicoggins.github.io/unpuzzle/",
    siteName: "unpuzzle",
    images: [
      {
        url: `${BASE}/og-image.png`,
        width: 512,
        height: 512,
        alt: "unpuzzle",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "unpuzzle",
    description: "Play good moves. Not perfect ones.",
    images: [`${BASE}/og-image.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${orbitron.variable} ${pressStart2P.variable} ${audiowide.variable} h-full antialiased`}
    >
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-5WZZEF8W39"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-5WZZEF8W39');
          `}
        </Script>
      </head>
      <body className="min-h-full flex flex-col bg-bg-primary text-text-primary font-[family-name:var(--font-heading)]">
        <AccentProvider />
        <Nav />
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
