import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppLayout } from "@/components/layout/AppLayout";
import { Analytics } from '@vercel/analytics/next';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Yamada Trading Journal — Professional Performance Analytics",
  description: "Production-grade multi-journal trading analytics with equity curves, calendar heatmaps, and professional PDF reports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark">
      {/*
        Inline script to apply theme BEFORE React hydration (prevents flash).
        Reads from localStorage and sets data-theme on <html> synchronously.
      */}
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
      <body className={`${inter.variable} antialiased selection:bg-brand-600 selection:text-white`}
            style={{ backgroundColor: "var(--body-bg)", color: "var(--body-text)" }}>
        <AppLayout>{children}</AppLayout>
        <Analytics />
      </body>
    </html>
  );
}
