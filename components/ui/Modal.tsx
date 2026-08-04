"use client";
// components/ui/Modal.tsx
// TradeFourge v3.9 — Institutional Modal Primitive (Raycast/Linear Style Dialogs)

import React, { useEffect } from "react";
import { X } from "lucide-react";

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
        className="fixed inset-0 bg-black/65 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />
      <div
        className={`relative z-10 w-full ${chosenWidthClass} p-6 rounded-2xl bg-[#0F1420] border border-white/10 shadow-2xl space-y-4 font-mono text-xs text-white`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <div className="font-extrabold text-sm text-white uppercase tracking-wide flex items-center gap-2">
                {title}
              </div>
              {description && (
                <div className="text-[11px] text-gray-400 font-normal mt-0.5">
                  {description}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors self-start"
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
