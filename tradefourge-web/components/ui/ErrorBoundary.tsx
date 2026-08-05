"use client";
// components/ui/ErrorBoundary.tsx
// Production React Error Boundary for isolated error handling and crash prevention.

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary caught an error]:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-2xl bg-[#121624] border border-rose-500/30 text-white font-mono space-y-3 my-4 shadow-xl">
          <div className="flex items-center gap-3 text-rose-400">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h3 className="text-sm font-bold">
              {this.props.fallbackTitle || "Component Temporarily Unavailable"}
            </h3>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            {this.props.fallbackDescription ||
              "An isolated runtime error occurred in this module. The rest of the application remains functional."}
          </p>
          {this.state.error?.message && (
            <p className="text-[11px] p-2 rounded bg-black/40 border border-white/10 text-rose-300 font-mono overflow-x-auto">
              {this.state.error.message}
            </p>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-bold transition-all active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
