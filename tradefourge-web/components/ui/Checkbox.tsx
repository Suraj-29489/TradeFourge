"use client";

import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/utils/cn";
import { useTheme } from "@/context/ThemeContext";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, className, checked, disabled, onChange, ...props }, ref) => {
    const { theme } = useTheme();
    const isLight = theme === "light";

    return (
      <label
        className={cn(
          "flex items-start gap-3 select-none cursor-pointer",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
      >
        <div className="relative flex items-center mt-0.5">
          <input
            type="checkbox"
            ref={ref}
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            className="sr-only peer"
            {...props}
          />
          <div
            className={cn(
              "w-4 h-4 rounded-md transition-all flex items-center justify-center border",
              isLight
                ? "border-slate-300 bg-white peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500/50"
                : "border-white/20 bg-white/[0.03] peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/50",
              checked && (isLight ? "bg-emerald-600 border-emerald-600 text-white" : "bg-blue-600 border-blue-600 text-white")
            )}
          >
            {checked && <Check className="w-3 h-3 stroke-[3]" />}
          </div>
        </div>
        {(label || description) && (
          <div className="space-y-0.5">
            {label && <div className={`text-xs font-mono font-medium ${isLight ? "text-slate-800" : "text-gray-200"}`}>{label}</div>}
            {description && <div className={`text-[11px] font-mono ${isLight ? "text-slate-500" : "text-gray-400"}`}>{description}</div>}
          </div>
        )}
      </label>
    );
  }
);

Checkbox.displayName = "Checkbox";
