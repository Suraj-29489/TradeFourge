"use client";
// components/ui/Card.tsx
// TradeFourge v3.7.8 — Institutional SaaS Card Primitive (Blue Accent)

import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  hoverEffect = false,
  className = "",
  ...props
}) => {
  return (
    <div
      className={`p-6 rounded-2xl bg-[#0F1420] border border-white/10 shadow-xl ${
        hoverEffect ? "transition-all hover:border-blue-500/30 hover:shadow-2xl hover:-translate-y-0.5" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = "", ...props }) => (
  <div className={`flex items-center justify-between border-b border-white/10 pb-4 mb-4 ${className}`} {...props}>
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ children, className = "", ...props }) => (
  <h3 className={`text-sm font-extrabold text-white tracking-wide uppercase font-mono ${className}`} {...props}>
    {children}
  </h3>
);
