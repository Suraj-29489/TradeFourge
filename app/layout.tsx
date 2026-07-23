import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppLayout } from "@/components/layout/AppLayout";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Trading Journal - Professional Terminal & Performance Analytics",
  description: "Production-grade trading journal inspired by TradeZella, Edgewonk & TraderSync with dark Bloomberg Apple aesthetic.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} bg-[#080B11] text-gray-100 antialiased selection:bg-brand-600 selection:text-white`}>
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
