"use client";

import React from "react";
import { useTheme } from "@/context/ThemeContext";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  hoverEffect = false,
  className = "",
  ...props
}) => {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <div
      className={`p-6 rounded-2xl transition-all duration-200 ${
        isLight
          ? "bg-white border border-slate-200 shadow-sm text-slate-900"
          : "bg-[#0F1420] border border-white/10 shadow-xl text-white"
      } ${
        hoverEffect
          ? isLight
            ? "hover:border-emerald-500/40 hover:shadow-md hover:-translate-y-0.5"
            : "hover:border-blue-500/30 hover:shadow-2xl hover:-translate-y-0.5"
          : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = "", ...props }) => {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <div className={`flex items-center justify-between border-b pb-4 mb-4 ${isLight ? "border-slate-200" : "border-white/10"} ${className}`} {...props}>
      {children}
    </div>
  );
};

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ children, className = "", ...props }) => {
  const { theme } = useTheme();
  const isLight = theme === "light";

  return (
    <h3 className={`text-sm font-extrabold tracking-wide uppercase font-mono ${isLight ? "text-slate-900" : "text-white"} ${className}`} {...props}>
      {children}
    </h3>
  );
};
