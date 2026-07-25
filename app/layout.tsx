import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "TradeFourge — Advanced Trading Intelligence & Analytics",
  description: "Institutional-grade multi-journal trading analytics platform with equity curves, AI insights, calendar heatmaps, and professional audit reports.",
  icons: {
    icon: "/favicon.ico",
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
        className={`${inter.variable} antialiased selection:bg-purple-600 selection:text-white`}
        style={{ backgroundColor: "var(--body-bg)", color: "var(--body-text)" }}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
