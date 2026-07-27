"use client";
// components/trades/AddTradeModal.tsx
// Production manual trade entry modal saving directly to Supabase `trades` table.

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { createTrade } from "@/lib/supabase/trades";
import { fetchTradingAccounts } from "@/lib/supabase/accounts";
import { createClient } from "@/lib/supabase/client";
import type { NewCloudTrade, TradingAccount, TradeSide, TradeSession } from "@/types/database";
import {
  TrendingUp, TrendingDown, DollarSign, Clock, FileText, Camera, Tag,
  AlertCircle, Check, Loader2, Sparkles
} from "lucide-react";

interface AddTradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const COMMON_SYMBOLS = ["XAUUSD", "EURUSD", "GBPUSD", "BTCUSD", "ETHUSD", "US30", "NAS100", "USDJPY", "AUDUSD", "USDCAD"];
const SESSIONS: TradeSession[] = ["London", "New York", "Tokyo", "Sydney", "London/NY Overlap", "Other"];

export function AddTradeModal({ isOpen, onClose, onSuccess }: AddTradeModalProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Form Fields
  const [accountId, setAccountId] = useState<string>("");
  const [ticket, setTicket] = useState("");
  const [symbol, setSymbol] = useState("XAUUSD");
  const [side, setSide] = useState<TradeSide>("BUY");
  const [volume, setVolume] = useState<number>(0.1);

  // Prices
  const [openPrice, setOpenPrice] = useState<string>("");
  const [closePrice, setClosePrice] = useState<string>("");
  const [stopLoss, setStopLoss] = useState<string>("");
  const [takeProfit, setTakeProfit] = useState<string>("");

  // Times
  const [openTime, setOpenTime] = useState<string>(new Date().toISOString().slice(0, 16));
  const [closeTime, setCloseTime] = useState<string>(new Date().toISOString().slice(0, 16));

  // Financials
  const [profit, setProfit] = useState<string>("0");
  const [commission, setCommission] = useState<string>("0");
  const [swap, setSwap] = useState<string>("0");
  const [riskAmount, setRiskAmount] = useState<string>("");
  const [rewardAmount, setRewardAmount] = useState<string>("");

  // Categorization & Journal
  const [strategy, setStrategy] = useState("");
  const [setup, setSetup] = useState("");
  const [session, setSession] = useState<TradeSession>("London");
  const [marketCondition, setMarketCondition] = useState("");
  const [notes, setNotes] = useState("");
  const [emotions, setEmotions] = useState("");
  const [lessons, setLessons] = useState("");
  const [mistakes, setMistakes] = useState("");
  const [confidenceRating, setConfidenceRating] = useState<number>(4);

  // Image upload
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (!isOpen) return;
    async function loadUserAccounts() {
      setLoadingAccounts(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data } = await fetchTradingAccounts(user.id);
        if (data && data.length > 0) {
          setAccounts(data);
          const defaultAcc = data.find(a => a.is_default) || data[0];
          setAccountId(defaultAcc.id);
        }
      }
      setLoadingAccounts(false);
    }
    loadUserAccounts();
  }, [isOpen]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setScreenshotPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      setErrorToast("Authentication required to add trade.");
      return;
    }
    if (!symbol.trim()) {
      setErrorToast("Symbol is required.");
      return;
    }

    setSubmitting(true);
    setErrorToast(null);
    setSuccessToast(null);

    try {
      let uploadedScreenshotUrl: string | null = null;

      // Upload screenshot if selected
      if (screenshotFile) {
        const fileExt = screenshotFile.name.split('.').pop();
        const filePath = `${userId}/${Date.now()}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage
          .from('trade-screenshots')
          .upload(filePath, screenshotFile, { upsert: true });

        if (!uploadErr) {
          const { data: pubData } = supabase.storage
            .from('trade-screenshots')
            .getPublicUrl(filePath);
          uploadedScreenshotUrl = pubData.publicUrl;
        }
      }

      const numProfit = parseFloat(profit) || 0;
      const numComm = parseFloat(commission) || 0;
      const numSwap = parseFloat(swap) || 0;
      const numOpenPrice = openPrice ? parseFloat(openPrice) : null;
      const numClosePrice = closePrice ? parseFloat(closePrice) : null;
      const numSL = stopLoss ? parseFloat(stopLoss) : null;
      const numTP = takeProfit ? parseFloat(takeProfit) : null;
      const numRisk = riskAmount ? parseFloat(riskAmount) : null;
      const numReward = rewardAmount ? parseFloat(rewardAmount) : null;

      // Compute RR
      let calculatedRR: number | null = null;
      if (numRisk && numReward && numRisk > 0) {
        calculatedRR = parseFloat((numReward / numRisk).toFixed(2));
      } else if (numProfit > 0 && numRisk && numRisk > 0) {
        calculatedRR = parseFloat((numProfit / numRisk).toFixed(2));
      }

      // Compute Hold Seconds
      let durationSeconds: number | null = null;
      if (openTime && closeTime) {
        const oTime = new Date(openTime).getTime();
        const cTime = new Date(closeTime).getTime();
        if (cTime > oTime) {
          durationSeconds = Math.round((cTime - oTime) / 1000);
        }
      }

      // Determine outcome
      let outcome: "WIN" | "LOSS" | "BREAKEVEN" = "BREAKEVEN";
      const totalNet = numProfit + numComm + numSwap;
      if (totalNet > 0.01) outcome = "WIN";
      else if (totalNet < -0.01) outcome = "LOSS";

      const newTrade: NewCloudTrade = {
        account_id: accountId || null,
        ticket: ticket.trim() || null,
        symbol: symbol.trim().toUpperCase(),
        side,
        volume: Number(volume) || 0.01,
        open_price: numOpenPrice,
        close_price: numClosePrice,
        stop_loss: numSL,
        take_profit: numTP,
        open_time: openTime ? new Date(openTime).toISOString() : null,
        close_time: closeTime ? new Date(closeTime).toISOString() : null,
        duration_seconds: durationSeconds,
        profit: numProfit,
        commission: numComm,
        swap: numSwap,
        risk_amount: numRisk,
        rr_ratio: calculatedRR,
        outcome,
        source: "manual",
        session: session || null,
        strategy: strategy.trim() || null,
        notes: notes.trim() || null,
        emotions: emotions.trim() || null,
        lessons: lessons.trim() || null,
        mistakes: mistakes.trim() || null,
        magic_number: null,
      };

      const { data, error } = await createTrade(userId, newTrade);

      setSubmitting(false);

      if (error) {
        setErrorToast(error);
      } else if (data) {
        setSuccessToast("Trade logged successfully to cloud journal!");
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 600);
      }
    } catch (err: any) {
      setSubmitting(false);
      setErrorToast(err?.message || "Failed to save trade.");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Log Manual Position" size="xl">
      <form onSubmit={handleSubmit} className="space-y-5 text-xs font-mono">
        {errorToast && (
          <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorToast}</span>
          </div>
        )}

        {successToast && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Section 1: Account & Core Direction */}
        <div className="p-4 rounded-xl bg-dark-card border border-dark-border space-y-3">
          <div className="flex items-center justify-between border-b border-dark-border pb-2">
            <span className="font-bold text-white uppercase text-[11px] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Account & Direction
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-gray-400 block mb-1">Trading Account</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-dark-bg border border-dark-border text-white text-xs focus:border-purple-500"
              >
                <option value="">No Account (Unassigned)</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_name} ({acc.broker})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-gray-400 block mb-1">Symbol / Instrument</label>
              <input
                type="text"
                required
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                list="common-symbols"
                className="w-full px-3 py-2 rounded-xl bg-dark-bg border border-dark-border text-white font-bold text-xs focus:border-purple-500"
              />
              <datalist id="common-symbols">
                {COMMON_SYMBOLS.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>

            <div>
              <label className="text-gray-400 block mb-1">Position Side</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSide("BUY")}
                  className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1 border transition-all ${
                    side === "BUY" || side === "LONG"
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-glow"
                      : "bg-dark-bg text-gray-400 border-dark-border"
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" /> BUY
                </button>
                <button
                  type="button"
                  onClick={() => setSide("SELL")}
                  className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1 border transition-all ${
                    side === "SELL" || side === "SHORT"
                      ? "bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-glow"
                      : "bg-dark-bg text-gray-400 border-dark-border"
                  }`}
                >
                  <TrendingDown className="w-3.5 h-3.5" /> SELL
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Execution & Prices */}
        <div className="p-4 rounded-xl bg-dark-card border border-dark-border space-y-3">
          <span className="font-bold text-white uppercase text-[11px] block border-b border-dark-border pb-2">
            Execution Parameters & Financials
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-gray-400 block mb-1">Volume (Lot Size)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-dark-bg border border-dark-border text-white text-xs focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-gray-400 block mb-1">Entry Price</label>
              <input
                type="number"
                step="any"
                value={openPrice}
                onChange={(e) => setOpenPrice(e.target.value)}
                placeholder="1.08500"
                className="w-full px-3 py-2 rounded-xl bg-dark-bg border border-dark-border text-white text-xs focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-gray-400 block mb-1">Exit Price</label>
              <input
                type="number"
                step="any"
                value={closePrice}
                onChange={(e) => setClosePrice(e.target.value)}
                placeholder="1.09100"
                className="w-full px-3 py-2 rounded-xl bg-dark-bg border border-dark-border text-white text-xs focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-gray-400 block mb-1">Net Realized Profit ($)</label>
              <input
                type="number"
                step="0.01"
                required
                value={profit}
                onChange={(e) => setProfit(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl bg-dark-bg border text-xs font-bold focus:border-purple-500 ${
                  parseFloat(profit) > 0 ? "text-emerald-400 border-emerald-500/40" : parseFloat(profit) < 0 ? "text-rose-400 border-rose-500/40" : "text-white border-dark-border"
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div>
              <label className="text-gray-400 block mb-1">Stop Loss (SL)</label>
              <input
                type="number"
                step="any"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-dark-bg border border-dark-border text-rose-400 text-xs focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-gray-400 block mb-1">Take Profit (TP)</label>
              <input
                type="number"
                step="any"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-dark-bg border border-dark-border text-emerald-400 text-xs focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-gray-400 block mb-1">Commission ($)</label>
              <input
                type="number"
                step="0.01"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-dark-bg border border-dark-border text-gray-300 text-xs focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-gray-400 block mb-1">Swap ($)</label>
              <input
                type="number"
                step="0.01"
                value={swap}
                onChange={(e) => setSwap(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-dark-bg border border-dark-border text-gray-300 text-xs focus:border-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Time & Risk */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-dark-card border border-dark-border space-y-3">
            <span className="font-bold text-white uppercase text-[11px] block border-b border-dark-border pb-2">
              Time Timestamps
            </span>
            <div className="space-y-2">
              <div>
                <label className="text-gray-400 block mb-1">Open Time</label>
                <input
                  type="datetime-local"
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-dark-bg border border-dark-border text-white text-xs focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Close Time</label>
                <input
                  type="datetime-local"
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-dark-bg border border-dark-border text-white text-xs focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-dark-card border border-dark-border space-y-3">
            <span className="font-bold text-white uppercase text-[11px] block border-b border-dark-border pb-2">
              Risk & Reward
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-gray-400 block mb-1">Risk Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={riskAmount}
                  onChange={(e) => setRiskAmount(e.target.value)}
                  placeholder="100"
                  className="w-full px-3 py-2 rounded-xl bg-dark-bg border border-dark-border text-white text-xs focus:border-purple-500"
                />
              </div>
              <div>
                <label className="text-gray-400 block mb-1">Reward Potential ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={rewardAmount}
                  onChange={(e) => setRewardAmount(e.target.value)}
                  placeholder="250"
                  className="w-full px-3 py-2 rounded-xl bg-dark-bg border border-dark-border text-white text-xs focus:border-purple-500"
                />
              </div>
            </div>
            <div>
              <label className="text-gray-400 block mb-1">Session</label>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value as TradeSession)}
                className="w-full px-3 py-2 rounded-xl bg-dark-bg border border-dark-border text-white text-xs focus:border-purple-500"
              >
                {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Section 4: Journal Notes & Media */}
        <div className="p-4 rounded-xl bg-dark-card border border-dark-border space-y-3">
          <span className="font-bold text-white uppercase text-[11px] block border-b border-dark-border pb-2">
            Strategy & Journal Psychology
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 block mb-1">Strategy Name</label>
              <input
                type="text"
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
                placeholder="e.g. Fair Value Gap Model"
                className="w-full px-3 py-2 rounded-xl bg-dark-bg border border-dark-border text-white text-xs focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-gray-400 block mb-1">Setup / Confluence</label>
              <input
                type="text"
                value={setup}
                onChange={(e) => setSetup(e.target.value)}
                placeholder="e.g. 15m Liquidity Sweep + Break of Structure"
                className="w-full px-3 py-2 rounded-xl bg-dark-bg border border-dark-border text-white text-xs focus:border-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="text-gray-400 block mb-1">Trade Notes & Reflections</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Key execution insights, entry trigger, emotions..."
              className="w-full px-3 py-2 rounded-xl bg-dark-bg border border-dark-border text-white text-xs focus:border-purple-500"
            />
          </div>

          {/* Screenshot Upload */}
          <div>
            <label className="text-gray-400 block mb-1">Chart Screenshot (Optional)</label>
            <div className="flex items-center gap-3">
              <label className="px-3 py-2 rounded-xl bg-dark-bg border border-dark-border hover:bg-dark-hover cursor-pointer text-gray-300 flex items-center gap-2">
                <Camera className="w-4 h-4 text-purple-400" />
                <span>Upload Image</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
              {screenshotFile && (
                <span className="text-purple-400 font-bold">{screenshotFile.name}</span>
              )}
            </div>
            {screenshotPreview && (
              <img src={screenshotPreview} alt="Preview" className="mt-2 max-h-32 rounded-xl border border-dark-border object-cover" />
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-dark-card border border-dark-border text-gray-300 font-bold hover:bg-dark-hover"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-glow flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>Log Trade</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
