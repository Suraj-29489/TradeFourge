import React, { useState } from "react";
import { useCompanionAccount } from "@/context/CompanionAccountContext";
import { useAccounts } from "@/context/AccountsContext";
import { AccountImportWizardModal } from "@/components/accounts/AccountImportWizardModal";
import {
  Wallet,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Star,
  Zap,
  Radio,
  Plus,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";

export const CompanionAccountsView: React.FC = () => {
  const {
    accounts,
    currentAccount,
    switchAccount,
    removeAccount,
    setDefaultAccount,
    refreshConnection,
    discoverAccounts,
    importSelectedAccounts,
    rawDiscoveredList,
    isDiscovering,
    discoveryError,
  } = useCompanionAccount();

  const { accounts: existingDbAccounts } = useAccounts();
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const handleOpenDiscoveryWizard = async () => {
    setIsWizardOpen(true);
    await discoverAccounts();
  };

  return (
    <div className="space-y-6 font-mono text-xs max-w-7xl mx-auto w-full text-gray-200 pb-12">
      {/* Top Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white font-sans flex items-center gap-2">
            <Wallet className="w-6 h-6 text-blue-400" />
            <span>Accounts</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Manage your Companion accounts.
          </p>
        </div>

        <button
          onClick={handleOpenDiscoveryWizard}
          disabled={isDiscovering}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-all shrink-0 disabled:opacity-50"
        >
          <Zap className="w-4 h-4 fill-white" />
          <span>{isDiscovering ? "Discovering..." : "Scan & Discover Accounts"}</span>
        </button>
      </div>

      {/* Discovery Error Alert Banner */}
      {discoveryError && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3 shadow-inner font-mono">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="block text-white font-bold">Discovery Notice</strong>
            <p className="leading-relaxed text-[11px] text-amber-200/90">{discoveryError}</p>
          </div>
        </div>
      )}

      {/* Account Cards List */}
      {accounts.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#0F141C] border border-white/[0.08] text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
            <Radio className="w-8 h-8" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-xl font-bold font-sans text-white">No Companion Accounts Discovered</h3>
            <p className="text-xs text-gray-400 font-sans">
              Click &quot;Scan & Discover Accounts&quot; to detect your active Exness trading accounts. Ensure you are logged into my.exness.com in another browser tab.
            </p>
          </div>
          <button
            onClick={handleOpenDiscoveryWizard}
            disabled={isDiscovering}
            className="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm inline-flex items-center gap-2 disabled:opacity-50 font-mono"
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>{isDiscovering ? "Discovering..." : "Scan & Discover Accounts"}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {accounts.map((account) => {
          const isCurrent = currentAccount?.id === account.id;

          return (
            <div
              key={account.id}
              className={`p-6 rounded-2xl border transition-all space-y-4 shadow-sm ${
                isCurrent
                  ? "bg-blue-500/10 border-blue-500/60 shadow-lg shadow-blue-500/5"
                  : "bg-[#0F141C] border-white/[0.08] hover:border-white/[0.15]"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Account Info Left */}
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${
                      isCurrent
                        ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                        : "bg-white/[0.03] border-white/[0.08] text-gray-400"
                    }`}
                  >
                    <Radio className="w-6 h-6" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold text-white font-sans">
                        {account.broker}
                      </span>
                      {isCurrent ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-blue-400" />
                          <span>Active Account</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-white/[0.04] text-gray-400 border border-white/[0.08] text-[10px] font-bold">
                          Connected Account
                        </span>
                      )}
                      {account.isDefault && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold flex items-center gap-1">
                          <Star className="w-3 h-3 fill-amber-400" /> Default
                        </span>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 pt-0.5">
                      <span>Server: <strong className="text-gray-200">{account.server || "Not detected"}</strong></span>
                      <span>·</span>
                      <span>Account Number: <strong className="text-gray-200">#{account.accountNumber}</strong></span>
                      <span>·</span>
                      <span>Account Type: <strong className="text-gray-200">{account.accountType || "Not detected"}</strong></span>
                      <span>·</span>
                      <span>Leverage: <strong className="text-gray-200">{account.leverage || "Not detected"}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Financial Balance & Actions Right */}
                <div className="flex items-center gap-6 justify-between lg:justify-end border-t lg:border-t-0 border-white/[0.08] pt-3 lg:pt-0">
                  <div className="text-right">
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider">Current Balance</div>
                    <p className="text-lg font-extrabold text-white font-mono">
                      {account.balance !== undefined && account.balance !== null
                        ? `${account.currency === "USC" ? "" : "$"}${account.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}${account.currency === "USC" ? " USC" : ""}`
                        : "Not detected"}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {!isCurrent && (
                      <button
                        onClick={() => switchAccount(account.id)}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors shadow-sm"
                      >
                        Select Account
                      </button>
                    )}

                    <button
                      onClick={refreshConnection}
                      title="Refresh Connection"
                      className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.08] transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>

                    {!account.isDefault && (
                      <button
                        onClick={() => setDefaultAccount(account.id)}
                        title="Set as Default Account"
                        className="p-2 rounded-xl text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 border border-white/[0.08] transition-colors"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={() => removeAccount(account.id)}
                      title="Remove Account"
                      className="p-2 rounded-xl text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/[0.08] transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
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
    </div>
  );
};
