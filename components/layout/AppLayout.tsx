"use client";

import React, { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { motion, AnimatePresence } from "framer-motion";

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden text-gray-100 font-sans terminal-grid"
         style={{ backgroundColor: "var(--body-bg)", color: "var(--body-text)" }}>
      {/* Sidebar handles both Desktop (md:flex) and Mobile Drawer (md:hidden) */}
      <ErrorBoundary fallbackTitle="Sidebar Navigation Error">
        <Sidebar
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />
      </ErrorBoundary>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <ErrorBoundary fallbackTitle="Navbar Navigation Error">
          <Navbar onOpenMobileNav={() => setMobileNavOpen(true)} />
        </ErrorBoundary>
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 lg:p-8 space-y-4 sm:space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="max-w-7xl mx-auto w-full space-y-6"
            >
              <ErrorBoundary fallbackTitle="Page Content Error">
                {children}
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};
