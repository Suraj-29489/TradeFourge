"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Zap, MessageSquare, Github, Linkedin, Twitter, ArrowRight, ShieldCheck } from "lucide-react";

export const LandingFooter: React.FC = () => {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
    }
  };

  return (
    <footer className="bg-[#080A0E] border-t border-white/10 pt-16 pb-12 relative z-10 text-gray-400 text-sm">
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
                className="h-8 w-auto object-contain transition-transform group-hover:scale-105"
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
                    className="flex-1 px-3.5 py-2 rounded-xl bg-[#131622] border border-white/10 text-white placeholder-gray-500 font-mono text-xs focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shrink-0"
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

            {/* Social Icons */}
            <div className="flex items-center gap-2 pt-2">
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-xl bg-[#131622] hover:bg-blue-600/20 border border-white/10 hover:border-blue-500/30 text-gray-400 hover:text-blue-300 transition-colors"
                aria-label="GitHub"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="https://discord.com"
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-xl bg-[#131622] hover:bg-blue-600/20 border border-white/10 hover:border-blue-500/30 text-gray-400 hover:text-blue-300 transition-colors"
                aria-label="Discord"
              >
                <MessageSquare className="w-4 h-4" />
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-xl bg-[#131622] hover:bg-blue-600/20 border border-white/10 hover:border-blue-500/30 text-gray-400 hover:text-blue-300 transition-colors"
                aria-label="LinkedIn"
              >
                <Linkedin className="w-4 h-4" />
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-xl bg-[#131622] hover:bg-blue-600/20 border border-white/10 hover:border-blue-500/30 text-gray-400 hover:text-blue-300 transition-colors"
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
              <li><a href="#features" className="hover:text-blue-300 transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-blue-300 transition-colors">Pricing</a></li>
              <li><a href="#ai-showcase" className="hover:text-blue-300 transition-colors">AI Intelligence</a></li>
              <li><a href="#roadmap" className="hover:text-blue-300 transition-colors">Roadmap</a></li>
            </ul>
          </div>

          {/* Column 2: Company */}
          <div className="space-y-3 font-sans">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Company</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#why-us" className="hover:text-blue-300 transition-colors">About Us</a></li>
              <li><a href="#faq" className="hover:text-blue-300 transition-colors">Contact</a></li>
              <li><a href="#roadmap" className="hover:text-blue-300 transition-colors">Careers <span className="text-[9px] font-mono bg-blue-600/20 text-blue-300 px-1 py-0.5 rounded border border-blue-500/30 ml-1">Hiring</span></a></li>
            </ul>
          </div>

          {/* Column 3: Resources */}
          <div className="space-y-3 font-sans">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Resources</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#faq" className="hover:text-blue-300 transition-colors">Documentation</a></li>
              <li><a href="#faq" className="hover:text-blue-300 transition-colors">Blog</a></li>
              <li><a href="#roadmap" className="hover:text-blue-300 transition-colors">Changelog</a></li>
            </ul>
          </div>

          {/* Column 4: Legal */}
          <div className="space-y-3 font-sans">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Legal</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#privacy" className="hover:text-blue-300 transition-colors">Privacy Policy</a></li>
              <li><a href="#terms" className="hover:text-blue-300 transition-colors">Terms of Service</a></li>
              <li><a href="#cookies" className="hover:text-blue-300 transition-colors">Cookie Policy</a></li>
            </ul>
          </div>

        </div>

        {/* Bottom Copyright Bar */}
        <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-gray-500">
          <div>
            © {new Date().getFullYear()} TradeFourge Inc. All rights reserved.
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400">All Systems Operational v2.4.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
