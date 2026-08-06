"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";

const FAQS = [
  {
    category: "Pricing",
    q: "How does TradeFourge pricing work?",
    a: "TradeFourge offers a free perpetual Starter tier and a Pro tier priced at $24/month (billed annually) or $29/month. You can upgrade, downgrade, or cancel your plan anytime without hidden fees.",
  },
  {
    category: "Refunds",
    q: "What is your refund policy?",
    a: "We offer a hassle-free 14-day money-back guarantee on all Pro subscriptions. If TradeFourge doesn't improve your trading discipline, simply contact our support team for a full refund—no questions asked.",
  },
  {
    category: "Security",
    q: "Is my financial and trade data secure?",
    a: "Yes. Security is our top priority. All synced cloud data is encrypted at rest using AES-256 and transmitted via SSL/TLS encryption. We operate read-only and never request broker withdrawal credentials.",
  },
  {
    category: "Brokers",
    q: "Which brokers and prop firms are supported?",
    a: "TradeFourge supports Exness, MetaTrader 4 (MT4), MetaTrader 5 (MT5), cTrader, Interactive Brokers, TradingView, and top prop funding evaluation exports including FTMO, FundedNext, and 5%ers.",
  },
  {
    category: "AI",
    q: "How does the AI Coach audit my trading edge?",
    a: "Our AI Engine analyzes historical trade executions to detect behavioral anomalies such as revenge sizing, over-trading post-loss, and off-peak execution hours, providing instant actionable recommendations.",
  },
  {
    category: "CSV",
    q: "How fast is the CSV trade log parser?",
    a: "Our client-side parser ingests thousands of trade rows in under 2 seconds. Simply drop your broker's CSV or HTML report to generate instant equity curves, win rate heatmaps, and profit factor stats.",
  },
  {
    category: "Cloud",
    q: "How does multi-device Cloud Backup work?",
    a: "Pro users enjoy automatic encrypted cloud backup and cross-device synchronization, allowing you to seamlessly analyze trading performance across desktop, laptop, tablet, and mobile browsers.",
  },
];

export const FAQSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-24 relative z-10 bg-[#0B0D13]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#131622] border border-white/10 text-gray-300 text-xs font-mono font-semibold uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5" /> Frequently Asked Questions
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Got Questions? <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-blue-400">
              We Have Answers.
            </span>
          </h2>
          <p className="text-gray-400 text-base sm:text-lg">
            Everything you need to know about TradeFourge pricing, security, AI auditing, and broker compatibility.
          </p>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-3">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.q}
                className="rounded-xl bg-[#131622] border border-white/10 overflow-hidden transition-colors hover:border-blue-500/30"
              >
                <button
                  onClick={() => toggle(index)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-white text-base focus:outline-none"
                >
                  <span className="flex items-center gap-3">
                    <span className="text-xs font-mono text-blue-400">
                      {index + 1 < 10 ? `0${index + 1}` : index + 1}.
                    </span>
                    <span>{faq.q}</span>
                    <span className="text-[10px] font-mono font-normal uppercase px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10 hidden sm:inline-block">
                      {faq.category}
                    </span>
                  </span>
                  <div
                    className={`p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 transition-transform duration-200 shrink-0 ${
                      isOpen ? "rotate-180 text-blue-400 bg-blue-600/20 border-blue-500/30" : ""
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="px-5 pb-5 text-xs text-gray-300 leading-relaxed border-t border-white/5 pt-3 font-sans">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
