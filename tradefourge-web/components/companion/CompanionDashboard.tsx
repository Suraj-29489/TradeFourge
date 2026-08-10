import React, { useState } from "react";
import { useCompanionAccount, type SyncResult } from "@/context/CompanionAccountContext";
import { useAccounts } from "@/context/AccountsContext";
import { AccountImportWizardModal } from "@/components/accounts/AccountImportWizardModal";
import { SyncDiagnosticsModal } from "@/components/companion/SyncDiagnosticsModal";
import {
  Zap,
  Radio,
  RefreshCw,
  Activity,
  Loader2,
  Inbox,
  Clock,
  AlertCircle,
  Database,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export const CompanionDashboard: React.FC = () => {
  const {
    accounts,
    currentAccount,
    connectionStatus,
    isDiscovering,
    discoveryError,
    rawDiscoveredList,
    extensionInfo,
    switchAccount,
    discoverAccounts,
    importSelectedAccounts,
    syncAccountHistory,
    reconnect,
  } = useCompanionAccount();

  const { accounts: existingDbAccounts } = useAccounts();
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStage, setSyncStage] = useState("Connecting to Exness...");
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const handleOpenDiscoveryWizard = async () => {
    setIsWizardOpen(true);
    await discoverAccounts();
  };

  const handleFetchData = async () => {
    if (!currentAccount) return;
    setIsSyncModalOpen(true);
    setIsSyncing(true);
    setSyncResult(null);

    setSyncStage("Connecting to Exness...");
    await new Promise((res) => setTimeout(res, 200));

    setSyncStage("Fetching historical orders...");
    await new Promise((res) => setTimeout(res, 300));

    const res = await syncAccountHistory(currentAccount.accountNumber);

    setSyncStage("Processing records & updating store...");
    await new Promise((res) => setTimeout(res, 200));

    setSyncResult(res);
    setIsSyncing(false);
  };

  const [timeRange, setTimeRange] = useState<"7D" | "30D" | "90D" | "ALL">("30D");

  // Chart data from current TFC account stats — only show actual balance/equity if available
  const equityData = currentAccount && currentAccount.equity !== null && currentAccount.equity > 0
    ? [
        { date: "Current", equity: currentAccount.equity },
      ]
    : [];

  return (
    <div className="space-y-6 font-mono text-gray-200 max-w-7xl mx-auto w-full pb-12">
      {/* ── TOP CONTROLS & DASHBOARD HEADER ───────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-[#0F141C] border border-white/[0.08] shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-bold text-gray-400">TradeForge Companion v5.5</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              connectionStatus === "Connected" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
            }`}>
              ● {connectionStatus === "Connected" ? "Connected" : "Waiting for live data"}
            </span>
          </div>

          <h1 className="text-xl font-extrabold text-white font-sans tracking-tight">
            {currentAccount ? `${currentAccount.broker} (${currentAccount.accountNumber})` : "TradeForge Companion"}
          </h1>
        </div>

        {/* Account Switcher & FETCH DATA Action Button */}
        {accounts.length > 0 && (
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-400 font-mono">Account:</label>
              <select
                value={currentAccount?.id ?? ""}
                onChange={(e) => switchAccount(e.target.value)}
                className="px-3.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white font-mono font-bold text-xs focus:outline-none focus:border-blue-500 transition-colors"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id} className="bg-[#0F141C] text-white">
                    {acc.broker} • #{acc.accountNumber} ({acc.balance !== null ? `${acc.balance} ${acc.currency || "USC"}` : "Not detected"})
                  </option>
                ))}
              </select>
            </div>

            {currentAccount && (
              <button
                onClick={handleFetchData}
                disabled={isSyncing}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-mono font-bold text-xs transition-colors flex items-center gap-1.5 shadow-lg shadow-blue-500/20 disabled:opacity-50"
              >
                <Database className="w-3.5 h-3.5" />
                <span>{isSyncing ? "FETCHING..." : "FETCH DATA"}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── DISCONNECTED / CLEAN SCANNER STATE (If no account exists) ───── */}
      {!currentAccount || accounts.length === 0 ? (
        <div className="p-8 sm:p-12 rounded-3xl bg-[#0F141C] border border-white/[0.08] text-center space-y-8 shadow-2xl w-full">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-inner">
            {isDiscovering ? (
              <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
            ) : (
              <Radio className="w-8 h-8 text-blue-400" />
            )}
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h2 className="text-2xl font-bold font-sans text-white tracking-tight">
              TradeForge Companion Scanner
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed font-sans">
              Waiting for live trading data. Open your Exness terminal page to stream live account balance, equity, and order history.
            </p>
          </div>

          {/* Discovery Error Alert Banner */}
          {discoveryError && (
            <div className="max-w-xl mx-auto p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-left flex items-start gap-3 shadow-inner">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="block text-white font-bold">Discovery Notice</strong>
                <p className="leading-relaxed text-[11px] text-amber-200/90">{discoveryError}</p>
              </div>
            </div>
          )}

          {/* Extension Status Box */}
          <div className="max-w-xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-3 text-left text-xs bg-white/[0.02] p-4 rounded-2xl border border-white/[0.06]">
            <div>
              <span className="text-[10px] text-gray-500 uppercase font-bold block">Browser</span>
              <strong className="text-gray-200">{extensionInfo.browser}</strong>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 uppercase font-bold block">Runtime</span>
              <strong className="text-gray-200">{extensionInfo.version}</strong>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 uppercase font-bold block">Status</span>
              <strong className={connectionStatus === "Connected" ? "text-emerald-400" : "text-amber-400"}>
                {connectionStatus === "Connected" ? "Connected" : "Waiting for live data"}
              </strong>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 uppercase font-bold block">Last Scan</span>
              <strong className="text-gray-300">{extensionInfo.lastScan}</strong>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4 flex-wrap pt-2">
            <button
              onClick={handleOpenDiscoveryWizard}
              disabled={isDiscovering}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/20 inline-flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 font-mono"
            >
              {isDiscovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-white" />}
              <span>{isDiscovering ? "Discovering Accounts..." : "Scan & Discover Accounts"}</span>
            </button>

            <button
              onClick={reconnect}
              className="px-6 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-gray-300 font-bold text-xs inline-flex items-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Detection</span>
            </button>
          </div>
        </div>
      ) : (
        /* ── LIVE ACCOUNT METRIC CARDS ────────────── */
        <div className="space-y-6">
          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Card 1: Balance */}
            <div className="p-4 rounded-2xl bg-[#0F141C] border border-white/[0.08] space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Balance</span>
              <p className="text-lg font-extrabold text-white">
                {currentAccount.balance !== undefined && currentAccount.balance !== null
                  ? currentAccount.currency === "USC"
                    ? `${currentAccount.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })} USC`
                    : `${currentAccount.currency === "EUR" ? "€" : "$"}${currentAccount.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                  : "--"}
              </p>
              <span className="text-[10px] text-gray-500 block">Currency: {currentAccount.currency || "Not detected"}</span>
            </div>

            {/* Card 2: Equity */}
            <div className="p-4 rounded-2xl bg-[#0F141C] border border-white/[0.08] space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Equity</span>
              <p className="text-lg font-extrabold text-emerald-400">
                {currentAccount.equity !== undefined && currentAccount.equity !== null
                  ? currentAccount.currency === "USC"
                    ? `${currentAccount.equity.toLocaleString("en-US", { minimumFractionDigits: 2 })} USC`
                    : `${currentAccount.currency === "EUR" ? "€" : "$"}${currentAccount.equity.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                  : "--"}
              </p>
              <span className="text-[10px] text-emerald-500/80 block">
                {connectionStatus === "Connected" ? "● Live Stream Active" : "● Last Known Value"}
              </span>
            </div>

            {/* Card 3: Free Margin */}
            <div className="p-4 rounded-2xl bg-[#0F141C] border border-white/[0.08] space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Free Margin</span>
              <p className="text-lg font-extrabold text-white">
                {currentAccount.freeMargin !== undefined && currentAccount.freeMargin !== null
                  ? currentAccount.currency === "USC"
                    ? `${currentAccount.freeMargin.toLocaleString("en-US", { minimumFractionDigits: 2 })} USC`
                    : `${currentAccount.currency === "EUR" ? "€" : "$"}${currentAccount.freeMargin.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                  : "--"}
              </p>
              <span className="text-[10px] text-gray-500 block">Margin: {currentAccount.margin > 0 ? `${currentAccount.margin}` : "--"}</span>
            </div>

            {/* Card 4: Profit Today */}
            <div className="p-4 rounded-2xl bg-[#0F141C] border border-white/[0.08] space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Profit Today</span>
              <p className={`text-lg font-extrabold ${currentAccount.profitToday >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {currentAccount.profitToday !== 0 ? `${currentAccount.profitToday >= 0 ? "+" : ""}${currentAccount.currency === "USC" ? `${currentAccount.profitToday.toFixed(2)} USC` : `$${currentAccount.profitToday.toFixed(2)}`}` : "--"}
              </p>
              <span className="text-[10px] text-gray-500 block">Closed Today</span>
            </div>

            {/* Card 5: Floating PnL */}
            <div className="p-4 rounded-2xl bg-[#0F141C] border border-white/[0.08] space-y-1">
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider block">Floating PnL</span>
              <p className={`text-lg font-extrabold ${currentAccount.floatingPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {currentAccount.floatingPnL !== 0 ? `${currentAccount.floatingPnL >= 0 ? "+" : ""}${currentAccount.currency === "USC" ? `${currentAccount.floatingPnL.toFixed(2)} USC` : `$${currentAccount.floatingPnL.toFixed(2)}`}` : "--"}
              </p>
              <span className="text-[10px] text-gray-500 block">Open Positions</span>
            </div>

            {/* Card 6: Account Identity */}
            <div className="p-4 rounded-2xl bg-[#0F141C] border border-white/[0.08] space-y-1">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Server & Type</span>
              <p className="text-xs font-bold text-white truncate">{currentAccount.server || "Not detected"}</p>
              <span className="text-[10px] text-blue-400 font-bold block">{currentAccount.accountType || "Not detected"} • {currentAccount.leverage || "Not detected"}</span>
            </div>
          </div>

          {/* Equity Trajectory Chart */}
          <div className="p-6 rounded-2xl bg-[#0F141C] border border-white/[0.08] space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div>
                <h2 className="text-base font-bold text-white font-sans flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-400" />
                  Live Companion Equity Trajectory
                </h2>
                <p className="text-xs text-gray-400 font-sans">
                  Real-time equity valuation synchronized from connected broker terminal
                </p>
              </div>

              {/* Time Range Filter Buttons */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs shrink-0 font-mono">
                {(["7D", "30D", "90D", "ALL"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={`px-3 py-1.5 rounded-lg transition-all font-bold ${
                      timeRange === r ? "bg-blue-600 text-white shadow-sm" : "text-gray-400 hover:text-white"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Recharts Area Chart or Empty State */}
            {equityData.length > 0 ? (
              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityData}>
                    <defs>
                      <linearGradient id="tfcEquityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1F293D" vertical={false} />
                    <XAxis dataKey="date" stroke="#6B7280" tickLine={false} fontSize={11} />
                    <YAxis stroke="#6B7280" tickLine={false} fontSize={11} domain={["auto", "auto"]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0B0F19",
                        borderColor: "#1E293B",
                        borderRadius: "12px",
                        color: "#FFFFFF",
                        fontSize: "12px",
                      }}
                    />
                    <Area type="monotone" dataKey="equity" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#tfcEquityGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 w-full flex flex-col items-center justify-center text-gray-500 text-xs space-y-2 border border-dashed border-white/[0.08] rounded-xl">
                <Clock className="w-6 h-6 text-gray-600 animate-pulse" />
                <span>Waiting for live equity updates from Exness stream...</span>
              </div>
            )}
          </div>

          {/* Recent Synced Trades Table */}
          <div className="p-6 rounded-2xl bg-[#0F141C] border border-white/[0.08] space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="text-sm font-bold text-white font-sans">Recent Terminal Executions</h3>
              <span className="text-[10px] text-gray-400 font-mono">
                {currentAccount.trades.length > 0 ? `Showing latest ${currentAccount.trades.length} trades` : "No live trades received"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-white/[0.08] text-gray-400 text-[10px] uppercase">
                    <th className="py-2.5 px-3">Ticket</th>
                    <th className="py-2.5 px-3">Symbol</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Lots</th>
                    <th className="py-2.5 px-3">Open / Close</th>
                    <th className="py-2.5 px-3 text-right">Profit ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {currentAccount.trades.length > 0 ? (
                    currentAccount.trades.map((tr) => (
                      <tr key={tr.ticket} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-3 text-gray-400 font-bold">#{tr.ticket}</td>
                        <td className="py-3 px-3 text-white font-extrabold">{tr.symbol}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tr.type === "BUY" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                            {tr.type}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-gray-200">{tr.lots}</td>
                        <td className="py-3 px-3 text-gray-400">{tr.openPrice} → {tr.closePrice}</td>
                        <td className={`py-3 px-3 text-right font-extrabold ${tr.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {tr.profit >= 0 ? "+" : ""}${tr.profit.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-500">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <Inbox className="w-5 h-5 text-gray-600" />
                          <span>No live trades received</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Account Discovery & Selection Import Wizard Modal */}
      <AccountImportWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        discoveredAccounts={rawDiscoveredList}
        existingAccounts={existingDbAccounts}
        isDiscovering={isDiscovering}
        discoveryError={discoveryError}
        onRunDiscovery={discoverAccounts}
        onImportSelected={async (selectedList) => {
          await importSelectedAccounts(selectedList);
        }}
      />

      {/* Sync Diagnostics & Progress Modal */}
      <SyncDiagnosticsModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        isSyncing={isSyncing}
        syncStage={syncStage}
        result={syncResult}
      />
    </div>
  );
};
