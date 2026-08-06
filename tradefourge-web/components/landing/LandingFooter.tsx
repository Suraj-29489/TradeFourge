"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MessageSquare, Github, Linkedin, Twitter, ArrowRight, ShieldCheck } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export const LandingFooter: React.FC = () => {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const { theme } = useTheme();
  const isLight = theme === "light";

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
    }
  };

  return (
    <footer className="relative z-10 font-mono">
      {/* Soft Transition Gradient Bar Above Footer */}
      <div className={`h-24 w-full border-t transition-colors ${
        isLight
          ? "bg-gradient-to-b from-[#F8FAFC] via-slate-200 to-[#080A0E] border-slate-200"
          : "bg-gradient-to-b from-[#0B0D13] via-[#090B10] to-[#080A0E] border-white/10"
      }`} />

      {/* Main Grounded Dark Footer */}
      <div className="bg-[#080A0E] pb-16 pt-6 text-gray-400 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          {/* Main Footer Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8 lg:gap-10">
            
            {/* Brand Info & Newsletter */}
            <div className="lg:col-span-2 space-y-5">
              <Link href="/" className="inline-block group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo_full.png"
                  alt="TradeFourge Logo"
                  className="h-9 w-auto object-contain transition-transform group-hover:scale-105"
                />
              </Link>

              <p className="text-gray-400 text-xs max-w-sm leading-relaxed font-sans">
                Institutional trading analytics, AI insights, and audited trade logs for modern forex, futures, and crypto traders.
              </p>

              {/* Newsletter Field UI */}
              <div className="space-y-2 pt-1 max-w-sm">
                <span className="text-xs font-mono font-bold text-white block">
                  Subscribe to Trading Market Insights
                </span>
                {!subscribed ? (
                  <form onSubmit={handleSubscribe} className="flex gap-2 font-sans">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="trader@domain.com"
                      className="flex-1 px-3.5 py-2 rounded-xl bg-[#131622] border border-white/10 text-white placeholder-gray-500 font-mono text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0 shadow-md"
                    >
                      <span>Join</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> Subscribed to Market Intelligence!
                  </div>
                )}
              </div>

              {/* Social Icons with Hover Glow & Lift */}
              <div className="flex items-center gap-2.5 pt-2">
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 rounded-xl bg-[#131622] border border-white/10 text-gray-300 hover:text-emerald-400 hover:border-emerald-500/50 hover:-translate-y-1 hover:rotate-3 hover:shadow-[0_0_15px_rgba(22,163,74,0.3)] transition-all duration-250"
                  aria-label="GitHub"
                >
                  <Github className="w-4 h-4" />
                </a>
                <a
                  href="https://discord.com"
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 rounded-xl bg-[#131622] border border-white/10 text-gray-300 hover:text-emerald-400 hover:border-emerald-500/50 hover:-translate-y-1 hover:rotate-3 hover:shadow-[0_0_15px_rgba(22,163,74,0.3)] transition-all duration-250"
                  aria-label="Discord"
                >
                  <MessageSquare className="w-4 h-4" />
                </a>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 rounded-xl bg-[#131622] border border-white/10 text-gray-300 hover:text-emerald-400 hover:border-emerald-500/50 hover:-translate-y-1 hover:rotate-3 hover:shadow-[0_0_15px_rgba(22,163,74,0.3)] transition-all duration-250"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="w-4 h-4" />
                </a>
                <a
                  href="https://x.com"
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 rounded-xl bg-[#131622] border border-white/10 text-gray-300 hover:text-emerald-400 hover:border-emerald-500/50 hover:-translate-y-1 hover:rotate-3 hover:shadow-[0_0_15px_rgba(22,163,74,0.3)] transition-all duration-250"
                  aria-label="X / Twitter"
                >
                  <Twitter className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Column 1: Product */}
            <div className="space-y-3 font-sans">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Product</h4>
              <ul className="space-y-2 text-xs">
                <li><a href="#features" className="hover:text-emerald-400 transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-emerald-400 transition-colors">Pricing</a></li>
                <li><a href="#ai-showcase" className="hover:text-emerald-400 transition-colors">AI Intelligence</a></li>
                <li><a href="#roadmap" className="hover:text-emerald-400 transition-colors">Roadmap</a></li>
              </ul>
            </div>

            {/* Column 2: Company */}
            <div className="space-y-3 font-sans">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Company</h4>
              <ul className="space-y-2 text-xs">
                <li><a href="#why-us" className="hover:text-emerald-400 transition-colors">About Us</a></li>
                <li><a href="#faq" className="hover:text-emerald-400 transition-colors">Contact</a></li>
                <li><a href="#roadmap" className="hover:text-emerald-400 transition-colors">Careers <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-300 px-1 py-0.5 rounded border border-emerald-500/30 ml-1">Hiring</span></a></li>
              </ul>
            </div>

            {/* Column 3: Resources */}
            <div className="space-y-3 font-sans">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Resources</h4>
              <ul className="space-y-2 text-xs">
                <li><a href="#faq" className="hover:text-emerald-400 transition-colors">Documentation</a></li>
                <li><a href="#faq" className="hover:text-emerald-400 transition-colors">Blog</a></li>
                <li><a href="#roadmap" className="hover:text-emerald-400 transition-colors">Changelog</a></li>
              </ul>
            </div>

            {/* Column 4: Legal */}
            <div className="space-y-3 font-sans">
              <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Legal</h4>
              <ul className="space-y-2 text-xs">
                <li><a href="#privacy" className="hover:text-emerald-400 transition-colors">Privacy Policy</a></li>
                <li><a href="#terms" className="hover:text-emerald-400 transition-colors">Terms of Service</a></li>
                <li><a href="#cookies" className="hover:text-emerald-400 transition-colors">Cookie Policy</a></li>
              </ul>
            </div>

          </div>

          {/* Bottom Copyright Bar */}
          <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-gray-400">
            <div>
              © 2026 TradeFourge Inc. All rights reserved.
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                v5.5.0
              </span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 font-semibold">All Systems Operational</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
