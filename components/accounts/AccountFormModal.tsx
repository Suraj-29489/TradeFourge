"use client";
// components/accounts/AccountFormModal.tsx
// Create / Edit trading account form with validation.

import React, { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Modal } from "@/components/ui/Modal";
import { Lock } from "lucide-react";
import { generateDisplayAccountId } from "@/lib/supabase/frontend-store";
import type { TradingAccount, NewTradingAccount, AccountPlatform, AccountType } from "@/types/database";

const PLATFORMS: AccountPlatform[] = [
  "MetaTrader 5",
  "MetaTrader 4",
  "cTrader",
  "DXTrade",
  "TradeLocker",
  "Exness Terminal",
  "Other",
];

const ACCOUNT_TYPES: AccountType[] = ["Live", "Demo", "Prop", "Contest"];

const CURRENCIES = ["USD", "USC", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "INR", "SGD", "AED"];

const schema = z.object({
  account_name:     z.string().min(1, "Account name is required").max(100),
  broker:           z.string().min(1, "Broker is required").max(100),
  platform:         z.enum(["MetaTrader 4", "MetaTrader 5", "cTrader", "DXTrade", "TradeLocker", "Exness Terminal", "Other"]),
  account_number:   z.string().optional(),
  account_type:     z.enum(["Live", "Demo", "Prop", "Contest"]),
  currency:         z.string().min(1),
  leverage:         z.string().optional(),
  starting_balance: z.number().min(0),
  current_balance:  z.number().min(0),
  is_default:       z.boolean(),
  notes:            z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface AccountFormModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: NewTradingAccount) => Promise<void>;
  account?: TradingAccount | null; // null = create mode
  isLoading?: boolean;
}

export function AccountFormModal({
  open,
  onClose,
  onSubmit,
  account,
  isLoading,
}: AccountFormModalProps) {
  const isEdit = !!account;

  const generatedDisplayId = useMemo(() => {
    return generateDisplayAccountId();
  }, [open, account]);

  const activeDisplayId = account?.display_id || account?.account_number || generatedDisplayId;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      account_name:     "",
      broker:           "",
      platform:         "MetaTrader 5",
      account_number:   "",
      account_type:     "Live",
      currency:         "USD",
      leverage:         "",
      starting_balance: 0,
      current_balance:  0,
      is_default:       false,
      notes:            "",
    },
  });

  // Populate form when editing
  useEffect(() => {
    if (account) {
      reset({
        account_name:     account.account_name,
        broker:           account.broker,
        platform:         account.platform,
        account_number:   account.account_number ?? "",
        account_type:     account.account_type,
        currency:         account.currency,
        leverage:         account.leverage ?? "",
        starting_balance: account.starting_balance,
        current_balance:  account.current_balance,
        is_default:       account.is_default,
        notes:            account.notes ?? "",
      });
    } else {
      reset({
        account_name:     "",
        broker:           "",
        platform:         "MetaTrader 5",
        account_number:   "",
        account_type:     "Live",
        currency:         "USD",
        leverage:         "",
        starting_balance: 0,
        current_balance:  0,
        is_default:       false,
        notes:            "",
      });
    }
  }, [account, reset, open]);

  const handleFormSubmit = async (values: FormValues) => {
    try {
      await onSubmit({
        ...values,
        display_id:       activeDisplayId,
        account_number:   values.account_number || activeDisplayId,
        leverage:         values.leverage || null,
        notes:            values.notes || null,
        is_active:        true,
      } as any);
      onClose();
    } catch (err) {
      console.error("AccountFormModal submit error:", err);
    }
  };

  const inputClass =
    "w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-white/10 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500 transition-colors font-mono";
  const labelClass = "block text-xs font-mono text-gray-400 mb-1.5";
  const errorClass = "text-[10px] text-rose-400 mt-1 font-mono";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Trading Account" : "Add Trading Account"}
      description={isEdit ? "Update your account details" : "Connect a new broker account to your journal"}
      size="lg"
    >
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        {/* Read-Only Auto-Generated Display ID */}
        <div>
          <label className={labelClass}>Account Display ID (Auto-Generated & Read-Only)</label>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-purple-500/30 text-xs font-mono text-purple-300 font-bold select-none cursor-not-allowed">
            <Lock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>{activeDisplayId}</span>
            <span className="ml-auto text-[9px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold uppercase tracking-wider">
              Immutable
            </span>
          </div>
        </div>

        {/* Row 1: Name + Broker */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Account Name *</label>
            <input
              {...register("account_name")}
              placeholder="e.g. Exness Pro #1"
              className={inputClass}
            />
            {errors.account_name && (
              <p className={errorClass}>{errors.account_name.message}</p>
            )}
          </div>
          <div>
            <label className={labelClass}>Broker *</label>
            <input
              {...register("broker")}
              placeholder="e.g. Exness, ICMarkets"
              className={inputClass}
            />
            {errors.broker && (
              <p className={errorClass}>{errors.broker.message}</p>
            )}
          </div>
        </div>

        {/* Row 2: Platform + Account Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Platform *</label>
            <select {...register("platform")} className={inputClass}>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Account Type *</label>
            <select {...register("account_type")} className={inputClass}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 3: Account Number + Leverage */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Account Number</label>
            <input
              {...register("account_number")}
              placeholder="Optional"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Leverage</label>
            <input
              {...register("leverage")}
              placeholder="e.g. 1:500"
              className={inputClass}
            />
          </div>
        </div>

        {/* Row 4: Currency + Starting Balance + Current Balance */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Currency *</label>
            <select {...register("currency")} className={inputClass}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c === "USC" ? "USC (US Cent)" : c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Starting Balance</label>
            <input
              {...register("starting_balance", { valueAsNumber: true })}
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Current Balance</label>
            <input
              {...register("current_balance", { valueAsNumber: true })}
              type="number"
              step="0.01"
              min="0"
              className={inputClass}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className={labelClass}>Notes</label>
          <textarea
            {...register("notes")}
            placeholder="Optional notes about this account..."
            rows={2}
            className={`${inputClass} resize-none`}
          />
        </div>

        {/* Set as Default */}
        <label className="flex items-center gap-3 cursor-pointer select-none group">
          <div className="relative">
            <input
              {...register("is_default")}
              type="checkbox"
              className="sr-only"
            />
            <div className="w-4 h-4 rounded bg-dark-card border border-white/20 group-hover:border-purple-500 transition-colors flex items-center justify-center">
              {/* We render this via CSS in the real component; here it's functional */}
            </div>
          </div>
          <input {...register("is_default")} type="checkbox" className="accent-purple-500 w-4 h-4 rounded" />
          <span className="text-xs font-mono text-gray-300">
            Set as default account
          </span>
        </label>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-mono text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || isLoading}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-sm font-mono transition-all shadow-glow"
          >
            {isSubmitting || isLoading
              ? isEdit ? "Saving..." : "Creating..."
              : isEdit ? "Save Changes" : "Add Account"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
