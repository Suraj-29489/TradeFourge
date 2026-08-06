"use client";

import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = "", showLabel = false }) => {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`relative inline-flex items-center gap-2 p-2 sm:px-3 sm:py-2 rounded-xl transition-all duration-200 border select-none focus:outline-none font-mono text-xs ${
        isLight
          ? "bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200 hover:border-emerald-500/50 shadow-sm"
          : "bg-white/[0.04] border-white/10 text-gray-300 hover:text-white hover:border-blue-500/50 hover:bg-white/[0.08]"
      } ${className}`}
      title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
      aria-label="Toggle dark/light theme"
    >
      <div className="relative w-4 h-4 flex items-center justify-center shrink-0">
        {isLight ? (
          <Sun className="w-4 h-4 text-emerald-600 animate-in fade-in zoom-in duration-200" />
        ) : (
          <Moon className="w-4 h-4 text-blue-400 animate-in fade-in zoom-in duration-200" />
        )}
      </div>

      {showLabel && (
        <span className="hidden sm:inline-block font-sans font-medium">
          {isLight ? "Light Mode" : "Dark Mode"}
        </span>
      )}
    </button>
  );
};
