"use client";
// app/(app)/playbook/page.tsx
// TradeFourge v4.2 Strategy Playbook Library Workspace

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchPlaybooks, savePlaybook, deletePlaybook } from "@/lib/toolkit/playbook-service";
import type { PlaybookItem } from "@/types/database";
import {
  BookOpen,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Target,
  ShieldCheck,
  Layers,
  Sparkles,
} from "lucide-react";

export default function PlaybookPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [playbooks, setPlaybooks] = useState<PlaybookItem[]>([]);
  const [editingPlaybook, setEditingPlaybook] = useState<PlaybookItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form State
  const [strategyName, setStrategyName] = useState("");
  const [market, setMarket] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [entryRules, setEntryRules] = useState("");
  const [exitRules, setExitRules] = useState("");
  const [riskRules, setRiskRules] = useState("");
  const [checklist, setChecklist] = useState("");
  const [notes, setNotes] = useState("");

  const loadData = (uid: string) => {
    const data = fetchPlaybooks(uid);
    setPlaybooks(data);
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        loadData(user.id);
      }
    })();
  }, []);

  const openForm = (pb?: PlaybookItem) => {
    if (pb) {
      setEditingPlaybook(pb);
      setStrategyName(pb.strategy_name);
      setMarket(pb.market);
      setTimeframe(pb.timeframe);
      setEntryRules(pb.entry_rules.join("\n"));
      setExitRules(pb.exit_rules.join("\n"));
      setRiskRules(pb.risk_rules.join("\n"));
      setChecklist(pb.checklist.join("\n"));
      setNotes(pb.notes || "");
    } else {
      setEditingPlaybook(null);
      setStrategyName("");
      setMarket("Forex / Indices");
      setTimeframe("M5 / H1");
      setEntryRules("1. Trend Direction confirmed\n2. Market Structure Shift\n3. Retracement into FVG / Order Block");
      setExitRules("1. Target opposing liquidity high/low\n2. Partial profit at 1:2 R:R");
      setRiskRules("1. Max 1% risk per trade\n2. Stop Loss beyond swing high/low");
      setChecklist("Liquidity sweep executed\nClean R:R ratio >= 2.0\nNo high impact news");
      setNotes("");
    }
    setIsFormOpen(true);
  };

  const handleSave = () => {
    if (!userId || !strategyName) return;

    savePlaybook(userId, {
      id: editingPlaybook?.id,
      strategy_name: strategyName,
      market,
      timeframe,
      entry_rules: entryRules.split("\n").map((s) => s.trim()).filter(Boolean),
      exit_rules: exitRules.split("\n").map((s) => s.trim()).filter(Boolean),
      risk_rules: riskRules.split("\n").map((s) => s.trim()).filter(Boolean),
      checklist: checklist.split("\n").map((s) => s.trim()).filter(Boolean),
      notes,
    });

    setIsFormOpen(false);
    loadData(userId);
  };

  const handleDelete = (id: string) => {
    if (!userId) return;
    if (confirm("Delete this playbook strategy?")) {
      deletePlaybook(userId, id);
      loadData(userId);
    }
  };

  const inputClass =
    "w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-white/10 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500 font-mono";
  const labelClass = "block text-xs font-mono text-gray-400 mb-1";

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="p-6 rounded-2xl glass-card border border-dark-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-400" />
            <span>Trading Playbook Library</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Define, document, and master your trading strategies, entry/exit rules, and checklists
          </p>
        </div>

        <button
          onClick={() => openForm()}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-glow flex items-center gap-2 shrink-0 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Playbook Strategy</span>
        </button>
      </div>

      {/* Form Dialog / Modal Card if open */}
      {isFormOpen && (
        <div className="p-6 rounded-3xl glass-card border border-blue-500/30 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>{editingPlaybook ? "Edit Playbook Strategy" : "Create New Playbook Strategy"}</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Strategy Name *</label>
              <input
                type="text"
                value={strategyName}
                onChange={(e) => setStrategyName(e.target.value)}
                placeholder="e.g. ICT Silver Bullet"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Market / Assets</label>
              <input
                type="text"
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                placeholder="e.g. EURUSD, NQ, Gold"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Timeframe</label>
              <input
                type="text"
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                placeholder="e.g. M5 / H1 Context"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Entry Rules (1 per line)</label>
              <textarea
                value={entryRules}
                onChange={(e) => setEntryRules(e.target.value)}
                rows={4}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Exit Rules (1 per line)</label>
              <textarea
                value={exitRules}
                onChange={(e) => setExitRules(e.target.value)}
                rows={4}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Risk Rules & Allocation</label>
              <textarea
                value={riskRules}
                onChange={(e) => setRiskRules(e.target.value)}
                rows={4}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Pre-Trade Checklist Items (1 per line)</label>
            <textarea
              value={checklist}
              onChange={(e) => setChecklist(e.target.value)}
              rows={3}
              className={inputClass}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 rounded-xl text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!strategyName}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold disabled:opacity-50"
            >
              Save Strategy Playbook
            </button>
          </div>
        </div>
      )}

      {/* Playbook Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {playbooks.map((pb) => (
          <div
            key={pb.id}
            className="p-5 rounded-2xl glass-card border border-dark-border space-y-4 hover:border-blue-500/30 transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>{pb.strategy_name}</span>
                </h3>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-blue-300">
                  <span>{pb.market}</span>
                  <span>·</span>
                  <span>{pb.timeframe}</span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => openForm(pb)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(pb.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-rose-400 hover:bg-rose-400/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Rules Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5">
              <div className="p-3 rounded-xl bg-dark-card border border-white/5 space-y-1.5">
                <span className="text-[10px] text-emerald-400 font-bold block">ENTRY RULES</span>
                <ul className="space-y-1 text-gray-300">
                  {pb.entry_rules.map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-400 shrink-0">•</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3 rounded-xl bg-dark-card border border-white/5 space-y-1.5">
                <span className="text-[10px] text-blue-400 font-bold block">EXIT RULES</span>
                <ul className="space-y-1 text-gray-300">
                  {pb.exit_rules.map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-blue-400 shrink-0">•</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Checklist */}
            {pb.checklist && pb.checklist.length > 0 && (
              <div className="p-3 rounded-xl bg-dark-card border border-white/5 space-y-1.5">
                <span className="text-[10px] text-blue-400 font-bold block">PRE-TRADE CHECKLIST</span>
                <div className="flex flex-wrap gap-2">
                  {pb.checklist.map((item, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px] font-bold flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3 text-blue-400" />
                      <span>{item}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
