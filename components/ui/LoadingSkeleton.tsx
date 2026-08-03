"use client";
// components/ui/LoadingSkeleton.tsx
// TradeFourge v3.9 — Institutional Loading Skeleton Primitive (Vercel Shimmer Layout)

import React from "react";

export const SkeletonBox: React.FC<{ className?: string }> = ({ className = "h-4 w-full" }) => (
  <div className={`animate-pulse rounded-xl bg-white/5 border border-white/5 ${className}`} />
);

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 5 }) => {
  return (
    <div className="rounded-2xl bg-[#0F1420] border border-white/10 p-6 space-y-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <SkeletonBox className="h-5 w-48" />
        <SkeletonBox className="h-8 w-24" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="grid gap-3 flex-1" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {Array.from({ length: cols }).map((_, cIdx) => (
              <SkeletonBox key={cIdx} className="h-8 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const CardListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="p-5 rounded-2xl bg-[#0F1420] border border-white/10 space-y-3 shadow-xl">
          <SkeletonBox className="h-4 w-1/2" />
          <SkeletonBox className="h-8 w-3/4" />
          <SkeletonBox className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
};

export const StatGridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="p-4 rounded-2xl bg-[#0F1420] border border-white/10 space-y-2 shadow-xl">
          <SkeletonBox className="h-3 w-1/3" />
          <SkeletonBox className="h-7 w-2/3" />
        </div>
      ))}
    </div>
  );
};
