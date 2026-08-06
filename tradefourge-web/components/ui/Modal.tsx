"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export interface ModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | string;
}

export const Modal: React.FC<ModalProps> = ({
  open,
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "md",
  size,
}) => {
  const isModalOpen = open ?? isOpen ?? false;
  const { theme } = useTheme();
  const isLight = theme === "light";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isModalOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isModalOpen, onClose]);

  if (!isModalOpen) return null;

  const effectiveSize = (size as any) || maxWidth;

  const maxWidthClasses: Record<string, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  };

  const chosenWidthClass = maxWidthClasses[effectiveSize] || maxWidthClasses["md"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />
      <div
        className={`relative z-10 w-full ${chosenWidthClass} p-6 rounded-2xl border shadow-2xl space-y-4 font-mono text-xs ${
          isLight
            ? "bg-white border-slate-200 text-slate-900"
            : "bg-[#0F1420] border-white/10 text-white"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className={`flex items-center justify-between border-b pb-3 ${isLight ? "border-slate-200" : "border-white/10"}`}>
            <div>
              <div className={`font-extrabold text-sm uppercase tracking-wide flex items-center gap-2 ${isLight ? "text-slate-900" : "text-white"}`}>
                {title}
              </div>
              {description && (
                <div className={`text-[11px] font-normal mt-0.5 ${isLight ? "text-slate-500" : "text-gray-400"}`}>
                  {description}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className={`p-1 rounded-lg transition-colors self-start ${
                isLight ? "text-slate-400 hover:text-slate-900 hover:bg-slate-100" : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div>{children}</div>
      </div>
    </div>
  );
};
