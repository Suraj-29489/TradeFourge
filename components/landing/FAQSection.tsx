"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";

const FAQS = [
  {
    q: "What is TradeFourge and how does it help my trading?",
    a: "TradeFourge is an institutional-grade trading analytics and intelligence platform. It converts raw position CSV exports and broker API executions into real-time equity curves, win-rate metrics, risk-to-reward ratios, and AI-driven performance feedback to help you eliminate costly mistakes and scale your edge.",
  },
  {
    q: "How do I import my trade data into TradeFourge?",
    a: "You can import your trades in under 10 seconds by dragging and dropping your Exness MT4/MT5 position report, cTrader CSV, or NinjaTrader export file into our parser. Pro users can also enable automated real-time broker synchronization.",
  },
  {
    q: "Which brokers and trading platforms are supported?",
    a: "TradeFourge supports Exness, MetaTrader 4, MetaTrader 5, cTrader, TradingView, Interactive Brokers, TD Ameritrade, and top prop firms including FTMO, FundedNext, MFF, and 5%ers.",
  },
  {
    q: "Is my financial and trading data secure?",
    a: "Yes. Your privacy is paramount. In addition to client-side storage options, all synced cloud data is encrypted at rest using AES-256 and transmitted via SSL/TLS encryption. We never sell or share your trading data.",
  },
  {
    q: "How does the AI Coach analyze my trading edge?",
    a: "The AI Coach runs statistical pattern matching algorithms across your historical trades. It evaluates session-based win rates, risk-to-reward ratios, setup duration, and streak anomalies to detect revenge trading, over-leveraging, and optimal execution windows.",
  },
  {
    q: "Can I generate reports for prop firms or investor updates?",
    a: "Absolutely. TradeFourge includes 1-click PDF and Excel performance report generators that produce clean, professional audited statements complete with equity growth graphs, monthly breakdowns, and drawdown metrics.",
  },
  {
    q: "What is the difference between Free and Pro plans?",
    a: "The Free plan provides full access to manual CSV uploads, equity charts, calendar heatmaps, and basic reports. The Pro plan adds automated real-time broker sync, unlimited accounts, the AI Coach engine, Trader DNA behavioral profiling, and cloud backup.",
  },
  {
    q: "Can I cancel or switch plans at any time?",
    a: "Yes. There are no lock-in contracts. You can upgrade, downgrade, or cancel your subscription at any time directly from your TradeFourge settings page with one click.",
  },
  {
    q: "Does TradeFourge store my broker account passwords or API keys?",
    a: "No. TradeFourge operates with read-only API access and read-only CSV history parser inputs. We never request trading or withdrawal credentials for your broker accounts.",
  },
  {
    q: "What metrics does TradeFourge calculate for my strategy?",
    a: "TradeFourge automatically calculates Net Realized Profit, Profit Factor, Win Rate, Average Risk:Reward (RR), Trade Expectancy, Gross W/L, Max Drawdown, Win/Loss Streaks, Average Hold Time, and Commission/Swap totals.",
  },
  {
    q: "Can I use TradeFourge across multiple devices?",
    a: "Yes. TradeFourge is fully web-based and responsive across desktop monitors, laptops, tablets, and smartphones.",
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
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-purple-400">
              We Have Answers.
            </span>
          </h2>
          <p className="text-gray-400 text-base sm:text-lg">
            Everything you need to know about TradeFourge, data privacy, and supported platforms.
          </p>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-3">
          {FAQS.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div
                key={faq.q}
                className="rounded-xl bg-[#131622] border border-white/10 overflow-hidden transition-colors hover:border-purple-500/30"
              >
                <button
                  onClick={() => toggle(index)}
                  className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-white text-base focus:outline-none"
                >
                  <span className="flex items-center gap-3">
                    <span className="text-xs font-mono text-purple-400">
                      {index + 1 < 10 ? `0${index + 1}` : index + 1}.
                    </span>
                    {faq.q}
                  </span>
                  <div
                    className={`p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 transition-transform duration-200 shrink-0 ${
                      isOpen ? "rotate-180 text-purple-400 bg-purple-600/20 border-purple-500/30" : ""
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
