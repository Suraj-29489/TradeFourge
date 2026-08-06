"use client";
// components/common/PersistenceErrorBoundary.tsx
// Production React Error Boundary for TradeFourge persistence architecture.
// Prevents application crashes, logs technical diagnostics, and renders a graceful recovery UI.

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw, ShieldAlert } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class PersistenceErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("[Persistence ErrorBoundary Caught Fatal Error]:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0B0F19] text-white flex items-center justify-center p-6 font-mono">
          <div className="max-w-md w-full p-6 rounded-2xl bg-[#111726] border border-rose-500/30 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 mx-auto flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-extrabold tracking-tight">System Recovered from Error</h2>
              <p className="text-xs text-gray-400">
                TradeFourge self-healing guard intercepted a runtime failure. Your trading data remains safe in Supabase cloud.
              </p>
            </div>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="p-3 rounded-xl bg-black/60 border border-rose-500/20 text-left text-[10px] text-rose-300 font-mono overflow-x-auto max-h-36">
                <p className="font-bold border-b border-rose-500/20 pb-1 mb-1">{this.state.error.name}: {this.state.error.message}</p>
                <pre className="whitespace-pre-wrap">{this.state.error.stack}</pre>
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center justify-center gap-2 transition-all shadow-glow"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload Platform Session</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
