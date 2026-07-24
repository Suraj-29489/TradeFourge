"use client";

import React, { useState } from "react";
import { useJournalStore } from "@/lib/store/useJournalStore";
import { Journal } from "@/lib/engine/types";
import {
  CheckSquare, Square, Trash2, Combine, Download, CheckCheck,
  X, RefreshCw, Pencil, Check, Calendar, BarChart2, Database,
  Cpu, DollarSign, AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

/* ─── Single Journal Row ───────────────────────────────────────────────────── */

function JournalRow({
  journal,
  isSelected,
  onToggle,
  onDelete,
  onRename,
}: {
  journal: Journal;
  isSelected: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(journal.displayName);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleRename = () => {
    if (editName.trim()) onRename(editName.trim());
    setEditing(false);
  };

  const dateFrom = journal.dateFrom ? format(new Date(journal.dateFrom), "dd MMM yy") : "—";
  const dateTo   = journal.dateTo   ? format(new Date(journal.dateTo),   "dd MMM yy") : "—";

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 ${
        isSelected
          ? "border-brand-500/40 bg-brand-600/8"
          : "border-dark-border hover:border-dark-subtle"
      } bg-dark-card`}
    >
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className="mt-0.5 flex-shrink-0 text-brand-400 hover:text-brand-300 transition-colors"
        title={isSelected ? "Deselect journal" : "Select journal"}
      >
        {isSelected
          ? <CheckSquare className="w-5 h-5" />
          : <Square className="w-5 h-5 text-gray-500" />
        }
      </button>

      {/* Details */}
      <div className="flex-1 min-w-0">
        {/* Name row */}
        {editing ? (
          <div className="flex items-center gap-2 mb-1">
            <input
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setEditing(false); }}
              className="flex-1 text-sm font-semibold bg-dark-hover border border-brand-500/40 rounded-lg px-2 py-0.5 text-gray-100 outline-none"
            />
            <button onClick={handleRename} className="text-emerald-400 hover:text-emerald-300"><Check className="w-4 h-4" /></button>
            <button onClick={() => setEditing(false)} className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm font-semibold text-gray-100 truncate max-w-xs">
              {journal.displayName}
            </span>
            <button
              onClick={() => setEditing(true)}
              className="text-gray-600 hover:text-gray-300 transition-colors flex-shrink-0"
              title="Rename"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {journal.isCentAccount && (
              <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                USC÷100
              </span>
            )}
          </div>
        )}

        {/* Metadata grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5 text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <BarChart2 className="w-3 h-3" />{journal.tradeCount} trades
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />{dateFrom} → {dateTo}
          </span>
          <span className="flex items-center gap-1">
            <Cpu className="w-3 h-3" />{journal.broker} · {journal.accountType}
          </span>
          <span className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" />{journal.isCentAccount ? "USC (Cent)" : "USD"}
          </span>
          <span className="flex items-center gap-1 text-gray-600">
            <Database className="w-3 h-3" />
            {format(new Date(journal.uploadDate), "dd MMM yyyy HH:mm")}
          </span>
          {journal.lastKnownBalance !== null && (
            <span className="flex items-center gap-1 text-emerald-500">
              Balance: ${journal.lastKnownBalance.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {confirmDelete ? (
          <>
            <button
              onClick={onDelete}
              className="px-2 py-1 rounded text-xs font-bold bg-loss/20 text-red-400 border border-loss/30 hover:bg-loss/30 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-2 py-1 rounded text-xs text-gray-500 hover:text-gray-300"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-loss/10 transition-all"
            title="Delete journal"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Main Journal Manager ─────────────────────────────────────────────────── */

export function JournalManager() {
  const journals           = useJournalStore(s => s.journals);
  const selectedJournalIds = useJournalStore(s => s.selectedJournalIds);
  const toggleJournal      = useJournalStore(s => s.toggleJournal);
  const selectAll          = useJournalStore(s => s.selectAll);
  const clearSelection     = useJournalStore(s => s.clearSelection);
  const selectLatest       = useJournalStore(s => s.selectLatest);
  const deleteJournal      = useJournalStore(s => s.deleteJournal);
  const renameJournal      = useJournalStore(s => s.renameJournal);
  const combineJournals    = useJournalStore(s => s.combineJournals);

  const [checkedForCombine, setCheckedForCombine] = useState<Set<string>>(new Set());
  const [combining, setCombining] = useState(false);
  const [combineName, setCombineName] = useState("");

  if (journals.length === 0) return null;

  const toggleCombineCheck = (id: string) => {
    setCheckedForCombine(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCombine = async () => {
    if (checkedForCombine.size < 2) return;
    const name = combineName.trim() || `Combined Journal (${checkedForCombine.size})`;
    await combineJournals(Array.from(checkedForCombine), name);
    setCheckedForCombine(new Set());
    setCombining(false);
    setCombineName("");
  };

  const selectedCount = selectedJournalIds.length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-gray-200">
            Journals
          </h3>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-brand-600/20 text-brand-400 border border-brand-500/30">
            {journals.length}
          </span>
          {selectedCount > 0 && (
            <span className="text-[10px] text-gray-500">
              {selectedCount} active
            </span>
          )}
        </div>

        {/* Bulk actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => selectLatest()}
            className="px-2 py-1 rounded-lg text-[11px] text-gray-400 hover:text-gray-200 hover:bg-dark-hover border border-dark-border transition-all flex items-center gap-1"
            title="Select only the most recently uploaded journal"
          >
            <RefreshCw className="w-3 h-3" /> Latest
          </button>
          <button
            onClick={() => selectAll()}
            className="px-2 py-1 rounded-lg text-[11px] text-gray-400 hover:text-gray-200 hover:bg-dark-hover border border-dark-border transition-all flex items-center gap-1"
          >
            <CheckCheck className="w-3 h-3" /> All
          </button>
          <button
            onClick={() => clearSelection()}
            className="px-2 py-1 rounded-lg text-[11px] text-gray-400 hover:text-gray-200 hover:bg-dark-hover border border-dark-border transition-all flex items-center gap-1"
          >
            <X className="w-3 h-3" /> None
          </button>
          {journals.length >= 2 && (
            <button
              onClick={() => { setCombining(!combining); setCheckedForCombine(new Set()); }}
              className={`px-2 py-1 rounded-lg text-[11px] border transition-all flex items-center gap-1 ${
                combining
                  ? "bg-brand-600/20 text-brand-300 border-brand-500/40"
                  : "text-gray-400 hover:text-gray-200 hover:bg-dark-hover border-dark-border"
              }`}
            >
              <Combine className="w-3 h-3" /> Merge
            </button>
          )}
        </div>
      </div>

      {/* Combine panel */}
      {combining && (
        <div className="p-3 rounded-xl border border-brand-500/30 bg-brand-600/5 space-y-2">
          <p className="text-xs text-brand-300 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            Check journals below to merge, then click Combine.
          </p>
          <div className="flex gap-2">
            <input
              placeholder="Combined journal name…"
              value={combineName}
              onChange={e => setCombineName(e.target.value)}
              className="flex-1 text-xs bg-dark-hover border border-dark-border rounded-lg px-3 py-1.5 text-gray-200 outline-none focus:border-brand-500/50"
            />
            <button
              onClick={handleCombine}
              disabled={checkedForCombine.size < 2}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Combine {checkedForCombine.size > 0 ? `(${checkedForCombine.size})` : ""}
            </button>
            <button onClick={() => { setCombining(false); setCheckedForCombine(new Set()); }} className="text-xs text-gray-500 hover:text-gray-300 px-2">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Journal list */}
      <div className="space-y-2">
        {journals.map(j => (
          <div key={j.id} className="flex items-center gap-2">
            {/* Combine checkbox */}
            {combining && (
              <button
                onClick={() => toggleCombineCheck(j.id)}
                className="flex-shrink-0 text-brand-400"
              >
                {checkedForCombine.has(j.id)
                  ? <CheckSquare className="w-4 h-4" />
                  : <Square className="w-4 h-4 text-gray-600" />
                }
              </button>
            )}
            <div className="flex-1">
              <JournalRow
                journal={j}
                isSelected={selectedJournalIds.includes(j.id)}
                onToggle={() => toggleJournal(j.id)}
                onDelete={() => deleteJournal(j.id)}
                onRename={name => renameJournal(j.id, name)}
              />
            </div>
          </div>
        ))}
      </div>

      {selectedCount === 0 && (
        <div className="text-center text-xs text-gray-600 py-2">
          No journals selected — select at least one to see data
        </div>
      )}
    </div>
  );
}
