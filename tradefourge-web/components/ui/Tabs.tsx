"use client";

import React from "react";
import { cn } from "@/utils/cn";

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
  return (
    <div className={cn("flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.07] font-mono text-xs", className)}>
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
                ? "bg-white/10 text-white shadow-sm border border-white/10 font-bold"
                : "text-gray-400 hover:text-gray-200 hover:bg-white/5",
              tab.disabled && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-gray-400"
            )}
          >
            {Icon && <Icon className={cn("w-3.5 h-3.5", isActive ? "text-blue-400" : "text-gray-400")} />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  "px-1.5 py-0.5 text-[9px] rounded-full font-mono font-bold",
                  isActive ? "bg-blue-500/20 text-blue-300" : "bg-white/10 text-gray-400"
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
