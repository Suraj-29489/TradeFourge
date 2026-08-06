"use client";

import React from "react";
import { cn } from "@/utils/cn";
import { useTheme } from "@/context/ThemeContext";

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ElementType;
  badge?: string | number;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className }) => {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <div className={cn(
      "flex items-center gap-1 p-1 rounded-xl font-mono text-xs border",
      isLight ? "bg-slate-100 border-slate-200" : "bg-white/[0.03] border-white/[0.07]",
      className
    )}>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 select-none",
              isActive
                ? isLight
                  ? "bg-white text-emerald-800 shadow-sm border border-slate-200 font-bold"
                  : "bg-white/10 text-white shadow-sm border border-white/10 font-bold"
                : isLight
                ? "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                : "text-gray-400 hover:text-gray-200 hover:bg-white/5",
              tab.disabled && "opacity-40 cursor-not-allowed hover:bg-transparent"
            )}
          >
            {Icon && <Icon className={cn("w-3.5 h-3.5", isActive ? (isLight ? "text-emerald-600" : "text-blue-400") : isLight ? "text-slate-500" : "text-gray-400")} />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  "px-1.5 py-0.5 text-[9px] rounded-full font-mono font-bold",
                  isActive
                    ? isLight ? "bg-emerald-500/15 text-emerald-700" : "bg-blue-500/20 text-blue-300"
                    : isLight ? "bg-slate-200 text-slate-600" : "bg-white/10 text-gray-400"
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
