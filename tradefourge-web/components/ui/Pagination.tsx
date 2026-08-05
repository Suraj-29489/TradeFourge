"use client";
// components/ui/Pagination.tsx
// Reusable pagination controls.

import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/utils/cn";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className,
}: PaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-dark-border text-xs font-mono text-gray-400",
        className
      )}
    >
      {/* Count */}
      <div>
        {total === 0
          ? "No results"
          : `Showing ${from}–${to} of ${total.toLocaleString()}`}
      </div>

      <div className="flex items-center gap-4">
        {/* Page size */}
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="px-2 py-1 rounded-lg bg-dark-card border border-dark-border text-gray-300 focus:outline-none focus:border-brand-500"
            >
              {pageSizeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(1)}
            disabled={page === 1}
            className="p-1.5 rounded-lg bg-dark-card border border-dark-border disabled:opacity-30 hover:bg-dark-hover transition-colors"
            aria-label="First page"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg bg-dark-card border border-dark-border disabled:opacity-30 hover:bg-dark-hover transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5 inline" /> Prev
          </button>

          <span className="px-3 py-1.5 font-bold text-white">
            {page} / {totalPages}
          </span>

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-3 py-1.5 rounded-lg bg-dark-card border border-dark-border disabled:opacity-30 hover:bg-dark-hover transition-colors"
          >
            Next <ChevronRight className="w-3.5 h-3.5 inline" />
          </button>
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
            className="p-1.5 rounded-lg bg-dark-card border border-dark-border disabled:opacity-30 hover:bg-dark-hover transition-colors"
            aria-label="Last page"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
