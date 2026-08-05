"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useCompanion } from "@/lib/companion/provider";
import { CompanionBridge } from "@/lib/companion/bridge";
import {
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Cpu,
  Globe,
  Send,
  ArrowDown,
  Clock,
  AlertTriangle,
  Zap,
} from "lucide-react";

interface DiagnosticCheck {
  label: string;
  status: "pass" | "fail" | "pending" | "warning";
  value: string;
  detail?: string;
}

export default function DiagnosticsPage() {
  const companion = useCompanion();
  const bridge = CompanionBridge.getInstance();

  const [checks, setChecks] = useState<DiagnosticCheck[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [pingLog, setPingLog] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toISOString().slice(11, 23);
    setPingLog((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 100));
  }, []);

  const runDiagnostics = useCallback(async () => {
    setIsRunning(true);
    setPingLog([]);
    const results: DiagnosticCheck[] = [];

    // 1. Website Loaded
    results.push({
      label: "Website Loaded",
      status: "pass",
      value: typeof window !== "undefined" ? window.location.origin : "SSR",
    });
    addLog("✓ Website loaded: " + (typeof window !== "undefined" ? window.location.origin : "SSR"));

    // 2. chrome.runtime Available
    const hasChromeRuntime = bridge.hasChromeRuntime();
    results.push({
      label: "chrome.runtime Available",
      status: hasChromeRuntime ? "pass" : "fail",
      value: hasChromeRuntime ? "Yes" : "No",
      detail: hasChromeRuntime
        ? "chrome.runtime.sendMessage is accessible via externally_connectable"
        : "chrome.runtime is not available. Extension may not be installed or origin not in externally_connectable.",
    });
    addLog(hasChromeRuntime ? "✓ chrome.runtime available" : "✗ chrome.runtime NOT available");

    // 3. Extension ID
    const extensionId = bridge.getExtensionId();
    results.push({
      label: "Extension ID Detected",
      status: extensionId ? "pass" : "fail",
      value: extensionId || "Not found",
      detail: extensionId
        ? "Extension ID read from data-tradefourge-extension-id DOM attribute (set by injector.js)"
        : "DOM attribute data-tradefourge-extension-id is missing. injector.js content script may not be running on this origin.",
    });
    addLog(extensionId ? `✓ Extension ID: ${extensionId}` : "✗ Extension ID NOT found");

    // 4. PING / PONG Handshake
    if (extensionId && hasChromeRuntime) {
      addLog("→ Sending PING to extension...");
      const pingStart = Date.now();
      try {
        const response = await bridge.send("PING", undefined, 5000);
        const latency = Date.now() - pingStart;
        const version = response?.version || "unknown";

        results.push({
          label: "Background Connected (PONG)",
          status: "pass",
          value: `v${version} — ${latency}ms`,
          detail: `Handshake completed. Background service worker responded in ${latency}ms.`,
        });
        addLog(`✓ PONG received — version: ${version}, latency: ${latency}ms`);

        // Check Exness tab count from PONG response
        const exnessCount = response?.exnessTabsCount ?? "unknown";
        results.push({
          label: "Exness Tabs Detected",
          status: typeof exnessCount === "number" && exnessCount > 0 ? "pass" : "warning",
          value: String(exnessCount),
          detail:
            typeof exnessCount === "number" && exnessCount > 0
              ? `Background found ${exnessCount} active Exness tab(s).`
              : "No Exness tabs detected. Open my.exness.com to enable account discovery.",
        });
        addLog(
          typeof exnessCount === "number" && exnessCount > 0
            ? `✓ ${exnessCount} Exness tab(s) detected`
            : "⚠ No Exness tabs detected"
        );
      } catch (err: any) {
        const latency = Date.now() - pingStart;
        results.push({
          label: "Background Connected (PONG)",
          status: "fail",
          value: `Failed (${latency}ms)`,
          detail: err?.message || "PING timed out. Background service worker did not respond.",
        });
        addLog(`✗ PING failed after ${latency}ms: ${err?.message || "timeout"}`);

        results.push({
          label: "Exness Tabs Detected",
          status: "fail",
          value: "N/A",
          detail: "Cannot check — background is unreachable.",
        });
      }
    } else {
      results.push({
        label: "Background Connected (PONG)",
        status: "fail",
        value: "Skipped",
        detail: "Cannot send PING — extension ID or chrome.runtime not available.",
      });
      results.push({
        label: "Exness Tabs Detected",
        status: "fail",
        value: "Skipped",
        detail: "Cannot check — extension not connected.",
      });
      addLog("✗ Skipping PING — prerequisites not met");
    }

    // 5. Content Script Injected (check DOM attribute from injector.js)
    const injectorPresent = !!document.documentElement.getAttribute("data-tradefourge-extension-id");
    results.push({
      label: "Content Script Injected (injector.js)",
      status: injectorPresent ? "pass" : "fail",
      value: injectorPresent ? "Yes" : "No",
      detail: injectorPresent
        ? "injector.js content script is running on this page."
        : "injector.js is not injected. This origin may not be in manifest content_scripts.matches.",
    });

    // 6. Last Message Sent/Received from companion context
    results.push({
      label: "Last Error",
      status: companion.lastError ? "fail" : "pass",
      value: companion.lastError ? `${companion.lastError.code}: ${companion.lastError.message}` : "None",
    });

    // 7. Connection State Summary
    results.push({
      label: "Connection State",
      status: companion.isConnected ? "pass" : "fail",
      value: companion.connectionState,
      detail: companion.isConnected
        ? `Connected to TradeFourge Companion v${companion.version}`
        : "Not connected. Run the handshake test above.",
    });

    results.push({
      label: "Handshake Latency",
      status: companion.latency > 0 ? "pass" : "pending",
      value: companion.latency > 0 ? `${companion.latency}ms` : "N/A",
    });

    setChecks(results);
    setLastRun(new Date().toLocaleTimeString());
    setIsRunning(false);
  }, [bridge, companion, addLog]);

  useEffect(() => {
    // Auto-run on mount after a short delay to let injector.js stamp the DOM
    const timer = setTimeout(() => {
      runDiagnostics();
    }, 800);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statusIcon = (status: DiagnosticCheck["status"]) => {
    switch (status) {
      case "pass":
        return <CheckCircle2 className="diagnostic-icon pass" />;
      case "fail":
        return <XCircle className="diagnostic-icon fail" />;
      case "warning":
        return <AlertTriangle className="diagnostic-icon warning" />;
      case "pending":
        return <Clock className="diagnostic-icon pending" />;
    }
  };

  return (
    <div className="diagnostics-page">
      <div className="diagnostics-header">
        <div className="diagnostics-title-row">
          <Activity size={24} />
          <h1>Companion Diagnostics</h1>
        </div>
        <p className="diagnostics-subtitle">
          Runtime verification of the TradeFourge ↔ Companion Extension communication pipeline
        </p>
        <div className="diagnostics-actions">
          <button
            className="diagnostics-btn primary"
            onClick={runDiagnostics}
            disabled={isRunning}
          >
            {isRunning ? (
              <><RefreshCw size={16} className="spin" /> Running...</>
            ) : (
              <><Zap size={16} /> Run Diagnostics</>
            )}
          </button>
          <button
            className="diagnostics-btn secondary"
            onClick={() => companion.checkExtension()}
          >
            <Send size={16} /> Send PING
          </button>
          {lastRun && <span className="diagnostics-timestamp">Last run: {lastRun}</span>}
        </div>
      </div>

      {/* ── Check Results ── */}
      <div className="diagnostics-grid">
        {checks.map((check, i) => (
          <div key={i} className={`diagnostic-card ${check.status}`}>
            <div className="diagnostic-card-header">
              {statusIcon(check.status)}
              <span className="diagnostic-label">{check.label}</span>
            </div>
            <div className="diagnostic-value">{check.value}</div>
            {check.detail && <div className="diagnostic-detail">{check.detail}</div>}
          </div>
        ))}
      </div>

      {/* ── Connection Summary ── */}
      <div className="diagnostics-section">
        <h2>
          {companion.isConnected ? <Wifi size={18} /> : <WifiOff size={18} />}
          Connection Summary
        </h2>
        <div className="diagnostics-summary-grid">
          <div className="summary-item">
            <span className="summary-label">Status</span>
            <span className={`summary-value ${companion.isConnected ? "connected" : "disconnected"}`}>
              {companion.isConnected ? "🟢 Companion Connected" : "🔴 Disconnected"}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Version</span>
            <span className="summary-value">{companion.version || "—"}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Browser</span>
            <span className="summary-value">{companion.browser}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Latency</span>
            <span className="summary-value">{companion.latency > 0 ? `${companion.latency}ms` : "—"}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Health</span>
            <span className="summary-value">{companion.health}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Accounts</span>
            <span className="summary-value">{companion.accountsCount}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Extension ID</span>
            <span className="summary-value mono">{bridge.getExtensionId() || "—"}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">chrome.runtime</span>
            <span className={`summary-value ${bridge.hasChromeRuntime() ? "connected" : "disconnected"}`}>
              {bridge.hasChromeRuntime() ? "✓ Available" : "✗ Unavailable"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Live Log ── */}
      <div className="diagnostics-section">
        <h2>
          <Cpu size={18} />
          Runtime Log
        </h2>
        <div className="diagnostics-log">
          {pingLog.length === 0 ? (
            <div className="log-empty">No log entries yet. Run diagnostics to see runtime output.</div>
          ) : (
            pingLog.map((entry, i) => (
              <div key={i} className={`log-entry ${entry.includes("✗") ? "error" : entry.includes("⚠") ? "warning" : entry.includes("✓") ? "success" : ""}`}>
                {entry}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Companion Logs ── */}
      {companion.logs.length > 0 && (
        <div className="diagnostics-section">
          <h2>
            <Globe size={18} />
            Companion Event Log
          </h2>
          <div className="diagnostics-log">
            {companion.logs.slice(0, 20).map((log) => (
              <div key={log.id} className={`log-entry ${log.severity.toLowerCase()}`}>
                [{log.timestamp}] [{log.severity}] {log.event}: {log.description}
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .diagnostics-page {
          padding: 2rem;
          max-width: 960px;
          margin: 0 auto;
        }
        .diagnostics-header {
          margin-bottom: 2rem;
        }
        .diagnostics-title-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
          color: var(--color-text-primary, #e2e8f0);
        }
        .diagnostics-title-row h1 {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0;
        }
        .diagnostics-subtitle {
          color: var(--color-text-secondary, #94a3b8);
          font-size: 0.875rem;
          margin: 0 0 1rem 0;
        }
        .diagnostics-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .diagnostics-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          border: none;
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .diagnostics-btn.primary {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff;
        }
        .diagnostics-btn.primary:hover {
          filter: brightness(1.1);
        }
        .diagnostics-btn.primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .diagnostics-btn.secondary {
          background: rgba(99, 102, 241, 0.15);
          color: #a5b4fc;
          border: 1px solid rgba(99, 102, 241, 0.3);
        }
        .diagnostics-btn.secondary:hover {
          background: rgba(99, 102, 241, 0.25);
        }
        .diagnostics-timestamp {
          font-size: 0.75rem;
          color: var(--color-text-secondary, #64748b);
        }

        .diagnostics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .diagnostic-card {
          background: var(--color-surface-secondary, rgba(30, 41, 59, 0.6));
          border: 1px solid var(--color-border, rgba(148, 163, 184, 0.1));
          border-radius: 12px;
          padding: 1rem;
          transition: border-color 0.2s ease;
        }
        .diagnostic-card.pass {
          border-left: 3px solid #22c55e;
        }
        .diagnostic-card.fail {
          border-left: 3px solid #ef4444;
        }
        .diagnostic-card.warning {
          border-left: 3px solid #f59e0b;
        }
        .diagnostic-card.pending {
          border-left: 3px solid #64748b;
        }
        .diagnostic-card-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .diagnostic-label {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--color-text-primary, #e2e8f0);
        }
        .diagnostic-value {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text-primary, #cbd5e1);
          margin-bottom: 0.25rem;
          word-break: break-all;
          font-family: "SF Mono", "Fira Code", monospace;
        }
        .diagnostic-detail {
          font-size: 0.75rem;
          color: var(--color-text-secondary, #64748b);
          line-height: 1.4;
        }

        .diagnostics-section {
          margin-bottom: 2rem;
        }
        .diagnostics-section h2 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text-primary, #e2e8f0);
          margin: 0 0 1rem 0;
        }

        .diagnostics-summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 0.75rem;
        }
        .summary-item {
          background: var(--color-surface-secondary, rgba(30, 41, 59, 0.6));
          border: 1px solid var(--color-border, rgba(148, 163, 184, 0.1));
          border-radius: 8px;
          padding: 0.75rem 1rem;
        }
        .summary-label {
          display: block;
          font-size: 0.6875rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-secondary, #64748b);
          margin-bottom: 0.25rem;
        }
        .summary-value {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--color-text-primary, #e2e8f0);
        }
        .summary-value.connected {
          color: #22c55e;
        }
        .summary-value.disconnected {
          color: #ef4444;
        }
        .summary-value.mono {
          font-family: "SF Mono", "Fira Code", monospace;
          font-size: 0.75rem;
          word-break: break-all;
        }

        .diagnostics-log {
          background: var(--color-surface-secondary, rgba(15, 23, 42, 0.8));
          border: 1px solid var(--color-border, rgba(148, 163, 184, 0.1));
          border-radius: 8px;
          padding: 1rem;
          max-height: 300px;
          overflow-y: auto;
          font-family: "SF Mono", "Fira Code", monospace;
          font-size: 0.75rem;
          line-height: 1.6;
        }
        .log-entry {
          color: var(--color-text-secondary, #94a3b8);
          padding: 0.125rem 0;
        }
        .log-entry.success {
          color: #22c55e;
        }
        .log-entry.error {
          color: #ef4444;
        }
        .log-entry.warning {
          color: #f59e0b;
        }
        .log-entry.info {
          color: #94a3b8;
        }
        .log-empty {
          color: var(--color-text-secondary, #475569);
          font-style: italic;
        }

        :global(.diagnostic-icon) {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
        }
        :global(.diagnostic-icon.pass) {
          color: #22c55e;
        }
        :global(.diagnostic-icon.fail) {
          color: #ef4444;
        }
        :global(.diagnostic-icon.warning) {
          color: #f59e0b;
        }
        :global(.diagnostic-icon.pending) {
          color: #64748b;
        }
        :global(.spin) {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
