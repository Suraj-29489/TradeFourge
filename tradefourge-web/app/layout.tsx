import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "TradeFourge — Institutional Trading Analytics & AI Intelligence",
  description:
    "TradeFourge is an institutional-grade multi-journal trading analytics terminal with equity curves, real-time AI Coach insights, calendar heatmaps, and audited performance statements.",
  applicationName: "TradeFourge",
  keywords: [
    "TradeFourge",
    "Trading Analytics",
    "Forex Journal",
    "Trading Journal",
    "Prop Firm Journal",
    "AI Trading Coach",
    "Equity Curve Audit",
  ],
  authors: [{ name: "TradeFourge Inc." }],
  creator: "TradeFourge",
  publisher: "TradeFourge",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "TradeFourge — Advanced Trading Intelligence Terminal",
    description:
      "Transform your trading history into institutional performance analytics, AI pattern audits, and audited investor reports.",
    siteName: "TradeFourge",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TradeFourge — Advanced Trading Intelligence Terminal",
    description:
      "Institutional trading analytics, AI pattern auditing, and trade log management built for disciplined traders.",
    creator: "@tradefourge",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('tj_theme');
                  if (t === 'light' || t === 'dark') {
                    document.documentElement.setAttribute('data-theme', t);
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${inter.variable} antialiased selection:bg-blue-600 selection:text-white`}
        style={{ backgroundColor: "var(--body-bg)", color: "var(--body-text)" }}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
