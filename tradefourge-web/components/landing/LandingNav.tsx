"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Zap, Menu, X, ArrowRight } from "lucide-react";

export const LandingNav: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#080B11]/80 backdrop-blur-md border-b border-white/10 shadow-2xl py-3"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center group shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo_full.png"
              alt="TradeFourge Logo"
              className="h-8 sm:h-9 w-auto object-contain transition-transform group-hover:scale-105"
            />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300 font-sans">
            <a href="#features" className="hover:text-blue-400 transition-colors">
              Features
            </a>
            <a href="#why-us" className="hover:text-blue-400 transition-colors">
              Why TradeFourge
            </a>
            <a href="#ai-showcase" className="hover:text-blue-400 transition-colors">
              AI Intelligence
            </a>
            <a href="#pricing" className="hover:text-blue-400 transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-blue-400 transition-colors">
              FAQ
            </a>
          </nav>

          {/* Desktop Right CTAs */}
          <div className="hidden md:flex items-center gap-4 font-sans">
            <Link
              href="/login"
              className="text-sm font-semibold text-gray-300 hover:text-white px-4 py-2 rounded-xl transition-colors"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="group relative px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-sm flex items-center gap-2 transition-all active:scale-95 overflow-hidden"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 p-5 rounded-2xl bg-[#0F141C]/95 border border-white/10 backdrop-blur-xl space-y-4 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200">
            <nav className="flex flex-col space-y-3 text-sm font-medium text-gray-300 font-sans">
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 hover:text-blue-400 border-b border-white/5"
              >
                Features
              </a>
              <a
                href="#why-us"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 hover:text-blue-400 border-b border-white/5"
              >
                Why TradeFourge
              </a>
              <a
                href="#ai-showcase"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 hover:text-blue-400 border-b border-white/5"
              >
                AI Intelligence
              </a>
              <a
                href="#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 hover:text-blue-400 border-b border-white/5"
              >
                Pricing
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 hover:text-blue-400 border-b border-white/5"
              >
                FAQ
              </a>
            </nav>

            <div className="pt-2 flex flex-col gap-3 font-sans">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold text-sm"
              >
                Login
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2"
              >
                <span>Get Started Free</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
