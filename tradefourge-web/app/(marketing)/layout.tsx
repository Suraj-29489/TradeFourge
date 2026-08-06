import React from "react";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#080B11] text-gray-100 selection:bg-blue-600 selection:text-white relative overflow-hidden">
      <LandingNav />
      <main>{children}</main>
      <LandingFooter />
    </div>
  );
}
