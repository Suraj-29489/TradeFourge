"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Copy,
  ExternalLink,
  Sliders,
  Sparkles,
  Calendar,
  Tag,
  Smile,
  X,
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Quote,
  Code,
  Undo,
  Redo,
  Check,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchTradeJournals,
  createTradeJournal,
  updateTradeJournal,
  deleteTradeJournal,
  TradeJournalFilters,
} from "@/lib/supabase/journals";
import { fetchTrades } from "@/lib/supabase/trades";
import type { TradeJournal, CloudTradeWithRelations, NewTradeJournal } from "@/types/database";
import { useTheme } from "@/context/ThemeContext";

const MOOD_OPTIONS = [
  { label: "Calm", emoji: "🙂" },
  { label: "Confident", emoji: "😎" },
  { label: "Neutral", emoji: "😐" },
  { label: "Frustrated", emoji: "😤" },
  { label: "Angry", emoji: "😡" },
  { label: "Fear", emoji: "😔" },
  { label: "Focused", emoji: "🚀" },
  { label: "Tired", emoji: "😴" },
];

const CATEGORY_OPTIONS = [
  "General Market Journal",
  "Morning Plan",
  "Weekly Goals",
  "Market Review",
  "Mindset & Psychology",
  "Trading Mistakes",
  "Sunday Planning",
  "Monthly Review",
  "Trade Execution",
  "Post-Trade Retrospective",
];

const TAG_SUGGESTIONS = [
  "FOMO",
  "Discipline",
  "Revenge Trade",
  "Patience",
  "SMC",
  "ICT",
  "Scalp",
  "Swing",
  "London",
  "New York",
  "News",
  "Breakout",
  "Liquidity Sweep",
  "Risk Management",
];

export const TradingJournalManager: React.FC = () => {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [journals, setJournals] = useState<TradeJournal[]>([]);
  const [userTrades, setUserTrades] = useState<CloudTradeWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [journalType, setJournalType] = useState<"general" | "trade">("general");
  const [selectedTradeId, setSelectedTradeId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("General Market Journal");
  const [mood, setMood] = useState("Calm");
  const [confidence, setConfidence] = useState(80);
  const [sessionName, setSessionName] = useState("London/NY Overlap");
  const [selectedTags, setSelectedTags] = useState<string[]>(["Discipline"]);
  const [customTagInput, setCustomTagInput] = useState("");
  const [content, setContent] = useState("");

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterMood, setFilterMood] = useState("ALL");
  const [filterTag, setFilterTag] = useState("ALL");

  // Modal State for Viewing Full Journal
  const [viewingJournal, setViewingJournal] = useState<TradeJournal | null>(null);

  // Load User & Trades & Journals
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const [jRes, tRes] = await Promise.all([
          fetchTradeJournals(user.id),
          fetchTrades(user.id, {}, 1, 100, "close_time", false),
        ]);
        if (jRes.data) setJournals(jRes.data);
        if (tRes.data?.data) setUserTrades(tRes.data.data);
      }
    } catch (err) {
      console.error("Failed to load journal records:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Word counter
  const wordCount = useMemo(() => {
    const text = content.replace(/<[^>]*>/g, " ").trim();
    return text ? text.split(/\s+/).length : 0;
  }, [content]);

  const handleTagToggle = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleAddCustomTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && customTagInput.trim()) {
      e.preventDefault();
      const newTag = customTagInput.trim();
      if (!selectedTags.includes(newTag)) {
        setSelectedTags([...selectedTags, newTag]);
      }
      setCustomTagInput("");
    }
  };

  const handleSaveJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !userId) return;

    setSaving(true);
    try {
      const payload: NewTradeJournal = {
        title: title.trim(),
        content,
        category,
        mood,
        confidence,
        tags: selectedTags,
        session: sessionName,
        trade_id: journalType === "trade" && selectedTradeId ? selectedTradeId : null,
      };

      if (isEditing && editingId) {
        await updateTradeJournal(editingId, userId, payload);
      } else {
        await createTradeJournal(userId, payload);
      }

      resetForm();
      await loadData();
    } catch (err) {
      console.error("Failed to save journal:", err);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setIsEditing(false);
    setEditingId(null);
    setTitle("");
    setContent("");
    setCategory("General Market Journal");
    setMood("Calm");
    setConfidence(80);
    setJournalType("general");
    setSelectedTradeId("");
    setSelectedTags(["Discipline"]);
  };

  const handleEditClick = (j: TradeJournal) => {
    setIsEditing(true);
    setEditingId(j.id);
    setTitle(j.title);
    setContent(j.content);
    setCategory(j.category);
    setMood(j.mood);
    setConfidence(j.confidence);
    setSelectedTags(j.tags || []);
    setSessionName(j.session || "London/NY Overlap");
    if (j.trade_id) {
      setJournalType("trade");
      setSelectedTradeId(j.trade_id);
    } else {
      setJournalType("general");
      setSelectedTradeId("");
    }
  };

  const handleDeleteClick = async (id: string) => {
    if (!userId || !confirm("Are you sure you want to delete this journal entry?")) return;
    await deleteTradeJournal(id, userId);
    await loadData();
  };

  const handleDuplicateClick = async (j: TradeJournal) => {
    if (!userId) return;
    const payload: NewTradeJournal = {
      title: `${j.title} (Copy)`,
      content: j.content,
      category: j.category,
      mood: j.mood,
      confidence: j.confidence,
      tags: j.tags,
      session: j.session,
      trade_id: j.trade_id,
    };
    await createTradeJournal(userId, payload);
    await loadData();
  };

  // Basic Rich Text Helper Functions
  const applyFormat = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
  };

  // Filtered Journals List
  const filteredJournals = useMemo(() => {
    return journals.filter((j) => {
      if (filterCategory !== "ALL" && j.category !== filterCategory) return false;
      if (filterMood !== "ALL" && j.mood !== filterMood) return false;
      if (filterTag !== "ALL" && !j.tags?.includes(filterTag)) return false;
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const matchTitle = j.title.toLowerCase().includes(q);
        const matchContent = j.content.toLowerCase().includes(q);
        const matchCategory = j.category.toLowerCase().includes(q);
        if (!matchTitle && !matchContent && !matchCategory) return false;
      }
      return true;
    });
  }, [journals, filterCategory, filterMood, filterTag, searchQuery]);

  return (
    <div className="space-y-8 font-mono">
      {/* ── NEW DEDICATED JOURNAL EDITOR CARD ───────────────────────────────── */}
      <div className={`p-6 sm:p-8 rounded-3xl border shadow-sm transition-colors ${
        isLight ? "bg-white border-[#E5E7EB] text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${
                isLight ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"
              }`}>
                Institutional Journaling Module
              </span>
            </div>
            <h2 className={`text-2xl font-black font-sans tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
              {isEditing ? "Edit Trading Journal" : "Trading Journal"}
            </h2>
            <p className={`text-xs font-sans ${isLight ? "text-slate-500" : "text-gray-400"}`}>
              Record your market thoughts, psychology, lessons, and execution notes.
            </p>
          </div>

          {isEditing && (
            <button
              onClick={resetForm}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                isLight ? "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700" : "bg-white/5 hover:bg-white/10 border-white/10 text-gray-300"
              }`}
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSaveJournal} className="space-y-6 pt-6">
          {/* Top Control Bar: Journal Type & Linked Trade */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`text-xs font-bold block mb-1.5 ${isLight ? "text-slate-700" : "text-gray-300"}`}>
                Journal Entry Type
              </label>
              <select
                value={journalType}
                onChange={(e) => setJournalType(e.target.value as "general" | "trade")}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-sans font-bold focus:outline-none ${
                  isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-[#080B11] border-white/10 text-white"
                }`}
              >
                <option value="general">General Market Journal</option>
                <option value="trade">Trade Linked Journal</option>
              </select>
            </div>

            {journalType === "trade" && (
              <div>
                <label className={`text-xs font-bold block mb-1.5 ${isLight ? "text-slate-700" : "text-gray-300"}`}>
                  Select Linked Trade
                </label>
                <select
                  value={selectedTradeId}
                  onChange={(e) => setSelectedTradeId(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-sans font-bold focus:outline-none ${
                    isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-[#080B11] border-white/10 text-white"
                  }`}
                >
                  <option value="">-- Choose a Trade --</option>
                  {userTrades.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.symbol} {t.side} • {t.outcome} (${t.net_profit > 0 ? `+${t.net_profit}` : t.net_profit}) • {new Date(t.close_time || t.open_time || Date.now()).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Title & Category Input Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className={`text-xs font-bold block mb-1.5 ${isLight ? "text-slate-700" : "text-gray-300"}`}>
                Journal Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Morning Execution Plan & EURUSD NY Breakout Analysis..."
                className={`w-full px-4 py-2.5 rounded-xl border text-xs font-sans focus:outline-none ${
                  isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-[#080B11] border-white/10 text-white"
                }`}
              />
            </div>

            <div>
              <label className={`text-xs font-bold block mb-1.5 ${isLight ? "text-slate-700" : "text-gray-300"}`}>
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-sans font-bold focus:outline-none ${
                  isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-[#080B11] border-white/10 text-white"
                }`}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mood, Confidence, & Session Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 rounded-2xl border bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10">
            {/* Mood Selector */}
            <div className="space-y-2">
              <label className={`text-xs font-bold block ${isLight ? "text-slate-700" : "text-gray-300"}`}>
                Trader Mood / Mindset
              </label>
              <div className="flex flex-wrap gap-1.5">
                {MOOD_OPTIONS.map((m) => (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => setMood(m.label)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 transition-all ${
                      mood === m.label
                        ? isLight
                          ? "bg-emerald-500/10 border-emerald-600 text-emerald-800 shadow-sm"
                          : "bg-blue-600/20 border-blue-500 text-blue-300"
                        : isLight
                        ? "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                        : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                    }`}
                  >
                    <span>{m.emoji}</span>
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Confidence Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className={isLight ? "text-slate-700" : "text-gray-300"}>Setup Confidence</span>
                <span className={isLight ? "text-emerald-700" : "text-emerald-400"}>{confidence}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={confidence}
                onChange={(e) => setConfidence(parseInt(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            {/* Session Selector */}
            <div className="space-y-2">
              <label className={`text-xs font-bold block ${isLight ? "text-slate-700" : "text-gray-300"}`}>
                Market Session
              </label>
              <select
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl border text-xs font-sans font-bold focus:outline-none ${
                  isLight ? "bg-white border-slate-200 text-slate-900" : "bg-[#080B11] border-white/10 text-white"
                }`}
              >
                <option value="London">London Session</option>
                <option value="New York">New York Session</option>
                <option value="London/NY Overlap">London/NY Overlap</option>
                <option value="Tokyo">Tokyo Session</option>
                <option value="Sydney">Sydney Session</option>
                <option value="Off-Hours">Off-Hours / Weekend</option>
              </select>
            </div>
          </div>

          {/* Tags Selector */}
          <div className="space-y-2">
            <label className={`text-xs font-bold block ${isLight ? "text-slate-700" : "text-gray-300"}`}>
              Tags & Strategy Themes
            </label>
            <div className="flex flex-wrap gap-1.5 items-center">
              {TAG_SUGGESTIONS.map((tag) => {
                const selected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagToggle(tag)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                      selected
                        ? isLight
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-blue-600 text-white border-blue-600"
                        : isLight
                        ? "bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
                        : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}

              <input
                type="text"
                placeholder="+ Add Tag (Press Enter)"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={handleAddCustomTag}
                className={`px-3 py-1 rounded-lg border text-xs font-sans focus:outline-none ${
                  isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-[#080B11] border-white/10 text-white"
                }`}
              />
            </div>
          </div>

          {/* Notion-Style Clean Rich Text Editor Container */}
          <div className={`rounded-2xl border overflow-hidden ${
            isLight ? "bg-white border-[#E5E7EB]" : "bg-[#080B11] border-white/10"
          }`}>
            {/* Formatting Toolbar */}
            <div className={`p-2 border-b flex flex-wrap items-center gap-1 text-xs font-sans ${
              isLight ? "bg-slate-50 border-slate-200 text-slate-700" : "bg-white/5 border-white/10 text-gray-300"
            }`}>
              <button
                type="button"
                onClick={() => applyFormat("bold")}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-white/10 font-bold"
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormat("italic")}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-white/10 italic"
                title="Italic"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormat("formatBlock", "<h1>")}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-white/10"
                title="Heading 1"
              >
                <Heading1 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormat("formatBlock", "<h2>")}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-white/10"
                title="Heading 2"
              >
                <Heading2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormat("insertUnorderedList")}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-white/10"
                title="Bullet List"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormat("insertOrderedList")}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-white/10"
                title="Numbered List"
              >
                <ListOrdered className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormat("formatBlock", "<blockquote>")}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-white/10"
                title="Quote"
              >
                <Quote className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormat("undo")}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-white/10 ml-auto"
                title="Undo"
              >
                <Undo className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => applyFormat("redo")}
                className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-white/10"
                title="Redo"
              >
                <Redo className="w-4 h-4" />
              </button>
            </div>

            {/* Rich Text Editor Textarea */}
            <textarea
              required
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your market observations, entry thesis, mistakes, and execution notes here..."
              className={`w-full p-4 text-xs font-sans focus:outline-none resize-y ${
                isLight ? "bg-white text-slate-900 placeholder:text-slate-400" : "bg-[#080B11] text-white placeholder:text-gray-500"
              }`}
            />

            {/* Editor Footer / Word Counter */}
            <div className={`px-4 py-2 border-t flex items-center justify-between text-[11px] font-mono ${
              isLight ? "bg-slate-50 border-slate-200 text-slate-500" : "bg-white/5 border-white/10 text-gray-400"
            }`}>
              <span>Word Count: <strong>{wordCount}</strong> words</span>
              <span>Cloud Auto-Save Ready</span>
            </div>
          </div>

          {/* Submit Action Row */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className={`px-6 py-3 rounded-xl font-bold text-xs flex items-center gap-2 transition-all active:scale-95 text-white ${
                isLight ? "bg-emerald-600 hover:bg-emerald-700 shadow-md" : "bg-blue-600 hover:bg-blue-500 shadow-md"
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{saving ? "Saving..." : isEditing ? "Update Journal Entry" : "Save Journal Entry"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* ── JOURNAL TIMELINE SECTION ─────────────────────────────────────────── */}
      <div className={`p-6 sm:p-8 rounded-3xl border shadow-sm space-y-6 transition-colors ${
        isLight ? "bg-white border-[#E5E7EB] text-slate-900" : "bg-[#0F141C] border-white/[0.08] text-white"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-white/10">
          <div>
            <h3 className={`text-xl font-extrabold font-sans tracking-tight ${isLight ? "text-slate-900" : "text-white"}`}>
              Journal Timeline
            </h3>
            <p className={`text-xs font-sans ${isLight ? "text-slate-500" : "text-gray-400"}`}>
              {filteredJournals.length} saved journal entry records
            </p>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isLight ? "text-slate-400" : "text-gray-400"}`} />
              <input
                type="text"
                placeholder="Search journals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-9 pr-3 py-1.5 rounded-xl border text-xs font-sans focus:outline-none ${
                  isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-[#080B11] border-white/10 text-white"
                }`}
              />
            </div>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-sans font-bold focus:outline-none ${
                isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-[#080B11] border-white/10 text-white"
              }`}
            >
              <option value="ALL">All Categories</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={filterMood}
              onChange={(e) => setFilterMood(e.target.value)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-sans font-bold focus:outline-none ${
                isLight ? "bg-slate-50 border-slate-200 text-slate-900" : "bg-[#080B11] border-white/10 text-white"
              }`}
            >
              <option value="ALL">All Moods</option>
              {MOOD_OPTIONS.map((m) => (
                <option key={m.label} value={m.label}>{m.emoji} {m.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Timeline Cards */}
        {filteredJournals.length === 0 ? (
          <div className="py-12 text-center text-xs font-sans text-slate-500 dark:text-gray-400 space-y-2">
            <BookOpen className="w-8 h-8 mx-auto text-slate-400 opacity-60" />
            <p>No journal entries found matching filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredJournals.map((j) => {
              const moodObj = MOOD_OPTIONS.find((m) => m.label === j.mood);
              return (
                <div
                  key={j.id}
                  className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-4 ${
                    isLight
                      ? "bg-slate-50 border-slate-200 hover:border-emerald-500/40 hover:bg-slate-100/80"
                      : "bg-[#080B11] border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${
                        isLight ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" : "bg-blue-500/10 text-blue-300 border-blue-500/20"
                      }`}>
                        {j.category}
                      </span>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-gray-400">
                        <span>{moodObj?.emoji} {j.mood}</span>
                        <span>•</span>
                        <span>{new Date(j.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <h4
                      onClick={() => setViewingJournal(j)}
                      className={`text-base font-bold font-sans cursor-pointer hover:underline ${
                        isLight ? "text-slate-900" : "text-white"
                      }`}
                    >
                      {j.title}
                    </h4>

                    {j.trade && (
                      <div className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                        isLight ? "bg-white border-slate-200 text-slate-700" : "bg-white/5 border-white/10 text-gray-300"
                      }`}>
                        <span className="font-bold flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                          {j.trade.symbol} {j.trade.side}
                        </span>
                        <span className={`font-mono font-bold ${j.trade.net_profit && j.trade.net_profit > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                          ${j.trade.net_profit?.toFixed(2)}
                        </span>
                      </div>
                    )}

                    <p className={`text-xs font-sans line-clamp-3 leading-relaxed ${
                      isLight ? "text-slate-600" : "text-gray-400"
                    }`}>
                      {j.content.replace(/<[^>]*>/g, " ")}
                    </p>

                    {j.tags && j.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {j.tags.map((t) => (
                          <span
                            key={t}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isLight ? "bg-slate-200 text-slate-700" : "bg-white/10 text-gray-300"
                            }`}
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className={`pt-3 border-t flex items-center justify-between text-xs ${
                    isLight ? "border-slate-200" : "border-white/10"
                  }`}>
                    <button
                      onClick={() => setViewingJournal(j)}
                      className={`font-bold flex items-center gap-1 ${
                        isLight ? "text-emerald-700 hover:text-emerald-800" : "text-blue-400 hover:text-blue-300"
                      }`}
                    >
                      <span>Read Full Entry</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDuplicateClick(j)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isLight ? "text-slate-500 hover:text-slate-900 hover:bg-slate-200" : "text-gray-400 hover:text-white hover:bg-white/10"
                        }`}
                        title="Duplicate Entry"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleEditClick(j)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isLight ? "text-slate-500 hover:text-slate-900 hover:bg-slate-200" : "text-gray-400 hover:text-white hover:bg-white/10"
                        }`}
                        title="Edit Entry"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(j.id)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                        title="Delete Entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── FULL JOURNAL VIEWER MODAL ────────────────────────────────────────── */}
      {viewingJournal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className={`relative w-full max-w-2xl p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto ${
            isLight ? "bg-white border-[#E5E7EB] text-slate-900" : "bg-[#0F141C] border-white/10 text-white"
          }`}>
            <button
              onClick={() => setViewingJournal(null)}
              className={`absolute top-6 right-6 p-2 rounded-xl transition-colors ${
                isLight ? "bg-slate-100 hover:bg-slate-200 text-slate-500" : "bg-white/5 hover:bg-white/10 text-gray-400"
              }`}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-2 border-b pb-4 border-slate-200 dark:border-white/10 pr-12">
              <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold ${
                isLight ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" : "bg-blue-500/10 text-blue-300 border-blue-500/20"
              }`}>
                {viewingJournal.category}
              </span>
              <h3 className={`text-2xl font-black font-sans ${isLight ? "text-slate-900" : "text-white"}`}>
                {viewingJournal.title}
              </h3>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-gray-400">
                <span>Mood: {viewingJournal.mood}</span>
                <span>•</span>
                <span>Confidence: {viewingJournal.confidence}%</span>
                <span>•</span>
                <span>{new Date(viewingJournal.created_at).toLocaleString()}</span>
              </div>
            </div>

            <div className={`text-sm font-sans whitespace-pre-wrap leading-relaxed ${
              isLight ? "text-slate-800" : "text-gray-200"
            }`}>
              {viewingJournal.content}
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {viewingJournal.tags?.map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-gray-300">
                    #{t}
                  </span>
                ))}
              </div>
              <button
                onClick={() => setViewingJournal(null)}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white ${
                  isLight ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-500"
                }`}
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
