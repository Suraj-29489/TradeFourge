"use client";

import React from "react";
import { cn } from "@/utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, rightIcon, className, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5 font-mono text-xs">
        {label && (
          <label className="block text-[11px] font-medium text-gray-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-gray-400 pointer-events-none">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full px-3.5 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white placeholder-gray-500 font-mono text-xs transition-all duration-150 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              error && "border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/50",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="text-[10px] text-rose-400 font-mono">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
