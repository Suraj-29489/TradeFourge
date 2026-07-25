"use client";

import React from "react";
import Link from "next/link";
import { Zap, MessageSquare, Github, Globe, Shield } from "lucide-react";

export const LandingFooter: React.FC = () => {
  return (
    <footer className="bg-[#080A0E] border-t border-white/10 pt-16 pb-12 relative z-10 text-gray-400 text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-600 text-white shadow-md">
                <Zap className="w-5 h-5" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white font-mono">
                TRADE<span className="text-purple-400">FOURGE</span>
              </span>
            </Link>

            <p className="text-gray-400 text-xs max-w-sm leading-relaxed font-sans">
              Institutional-grade trading analytics, AI insights, and position audits built for modern forex, futures, and crypto traders.
            </p>

            <div className="flex items-center gap-2.5 pt-1">
              <a
                href="https://discord.com"
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-xl bg-[#131622] hover:bg-purple-600/20 border border-white/10 hover:border-purple-500/30 text-gray-400 hover:text-purple-300 transition-colors"
                aria-label="Discord Community"
              >
                <MessageSquare className="w-4 h-4" />
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-xl bg-[#131622] hover:bg-purple-600/20 border border-white/10 hover:border-purple-500/30 text-gray-400 hover:text-purple-300 transition-colors"
                aria-label="GitHub Repository"
              >
                <Github className="w-4 h-4" />
              </a>
              <a
                href="#roadmap"
                className="p-2.5 rounded-xl bg-[#131622] hover:bg-purple-600/20 border border-white/10 hover:border-purple-500/30 text-gray-400 hover:text-purple-300 transition-colors"
                aria-label="Platform Status"
              >
                <Globe className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Column 1: Platform & Features */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Features</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/dashboard" className="hover:text-purple-300 transition-colors">Mission Control</Link></li>
              <li><Link href="/performance" className="hover:text-purple-300 transition-colors">Performance Lab</Link></li>
              <li><Link href="/journal" className="hover:text-purple-300 transition-colors">Trade Log</Link></li>
              <li><Link href="/reports" className="hover:text-purple-300 transition-colors">Audit Reports</Link></li>
              <li><Link href="/upload" className="hover:text-purple-300 transition-colors">CSV Upload Engine</Link></li>
            </ul>
          </div>

          {/* Column 2: Resources & Product */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Product</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#pricing" className="hover:text-purple-300 transition-colors">Pricing Plans</a></li>
              <li><a href="#roadmap" className="hover:text-purple-300 transition-colors">Product Roadmap</a></li>
              <li><a href="#faq" className="hover:text-purple-300 transition-colors">Documentation</a></li>
              <li><a href="#blog" className="hover:text-purple-300 transition-colors">Trading Blog</a></li>
              <li><a href="#status" className="hover:text-purple-300 transition-colors">System Status</a></li>
            </ul>
          </div>

          {/* Column 3: Legal & Support */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Legal & Contact</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#privacy" className="hover:text-purple-300 transition-colors">Privacy Policy</a></li>
              <li><a href="#terms" className="hover:text-purple-300 transition-colors">Terms of Service</a></li>
              <li><a href="#contact" className="hover:text-purple-300 transition-colors">Contact Support</a></li>
              <li><a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-purple-300 transition-colors">GitHub Repository</a></li>
              <li><a href="https://discord.com" target="_blank" rel="noreferrer" className="hover:text-purple-300 transition-colors">Discord Community</a></li>
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
