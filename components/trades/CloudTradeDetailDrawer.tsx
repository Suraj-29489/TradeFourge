"use client";
// components/trades/CloudTradeDetailDrawer.tsx
// Full-featured cloud trade detail drawer with notes, tags, images, checklist, and delete functionality.

import React, { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { createClient } from "@/lib/supabase/client";
import { updateTrade, deleteTrade } from "@/lib/supabase/trades";
import { addTagToTrade, removeTagFromTrade, fetchUserTags, createTag } from "@/lib/supabase/trade-tags";
import { uploadTradeImage, deleteTradeImage } from "@/lib/supabase/trade-images";
import type { CloudTradeWithRelations, TradeTag, TradeImage } from "@/types/database";
import {
  X, TrendingUp, TrendingDown, FileText, Camera, Tag as TagIcon,
  Trash2, CheckCircle2, AlertCircle, Edit3, Save, Plus, Loader2, Sparkles, Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CloudTradeDetailDrawerProps {
  trade: CloudTradeWithRelations | null;
  onClose: () => void;
  onRefresh?: () => void;
}

export function CloudTradeDetailDrawer({ trade, onClose, onRefresh }: CloudTradeDetailDrawerProps) {
  const { format: formatCurrency } = useCurrencyFormatter();
  const supabase = createClient();

  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "notes" | "tags" | "images">("details");
  const [deleting, setDeleting] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  // Edit Notes state
  const [notes, setNotes] = useState("");
  const [emotions, setEmotions] = useState("");
  const [lessons, setLessons] = useState("");
  const [mistakes, setMistakes] = useState("");

  // Tags state
  const [tradeTags, setTradeTags] = useState<TradeTag[]>([]);
  const [availableTags, setAvailableTags] = useState<TradeTag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [addingTag, setAddingTag] = useState(false);

  // Images state
  const [images, setImages] = useState<TradeImage[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    }
    loadUser();
  }, []);

  useEffect(() => {
    if (!trade) return;
    setNotes(trade.notes || "");
    setEmotions(trade.emotions || "");
    setLessons(trade.lessons || "");
    setMistakes(trade.mistakes || "");
    setTradeTags(trade.tags || []);
    setImages(trade.images || []);

    if (userId) {
      loadAllTags(userId);
    }
  }, [trade, userId]);

  const loadAllTags = async (uId: string) => {
    const { data } = await fetchUserTags(uId);
    if (data) setAvailableTags(data);
  };

  if (!trade) return null;

  const isWin = trade.outcome === "WIN";
  const isLoss = trade.outcome === "LOSS";
  const isBuy = trade.side === "BUY" || trade.side === "LONG";

  const handleSaveNotes = async () => {
    if (!userId) return;
    setSavingNotes(true);
    await updateTrade(trade.id, userId, {
      notes: notes.trim() || null,
      emotions: emotions.trim() || null,
      lessons: lessons.trim() || null,
      mistakes: mistakes.trim() || null,
    });
    setSavingNotes(false);
    if (onRefresh) onRefresh();
  };

  const handleAddExistingTag = async (tagId: string) => {
    if (!userId) return;
    await addTagToTrade(trade.id, tagId);
    const added = availableTags.find(t => t.id === tagId);
    if (added && !tradeTags.some(t => t.id === tagId)) {
      setTradeTags([...tradeTags, added]);
    }
    if (onRefresh) onRefresh();
  };

  const handleCreateAndAddTag = async () => {
    if (!userId || !newTagName.trim()) return;
    setAddingTag(true);
    const colors = ["#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#3B82F6"];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const { data: tag } = await createTag(userId, { name: newTagName.trim(), color: randomColor });
    if (tag) {
      await addTagToTrade(trade.id, tag.id);
      setTradeTags([...tradeTags, tag]);
      setAvailableTags([...availableTags, tag]);
      setNewTagName("");
    }
    setAddingTag(false);
    if (onRefresh) onRefresh();
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!userId) return;
    await removeTagFromTrade(trade.id, tagId);
    setTradeTags(tradeTags.filter(t => t.id !== tagId));
    if (onRefresh) onRefresh();
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploadingImage(true);
    const { data: img } = await uploadTradeImage(trade.id, userId, file, "chart");
    setUploadingImage(false);
    if (img) {
      setImages([...images, img]);
      if (onRefresh) onRefresh();
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!userId) return;
    await deleteTradeImage(imageId, userId);
    setImages(images.filter(i => i.id !== imageId));
    if (onRefresh) onRefresh();
  };

  const handleDeleteTradeClick = async () => {
    if (!userId) return;
    if (confirm(`Are you sure you want to delete trade ${trade.ticket || trade.id}?`)) {
      setDeleting(true);
      await deleteTrade(trade.id, userId);
      setDeleting(false);
      if (onRefresh) onRefresh();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Drawer Slide */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="relative z-10 w-full max-w-xl bg-[#0F1523] border-l border-white/10 h-full overflow-y-auto p-6 space-y-6 flex flex-col justify-between shadow-2xl text-xs font-mono"
        >
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-xl border ${
                    isBuy
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                  }`}
                >
                  {isBuy ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                </div>

                <div>
                  <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                    {trade.symbol}
                    <span className="text-xs px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                      {trade.side}
                    </span>
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Ticket #{trade.ticket || trade.id.slice(0, 8)} • Source: {trade.source}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleDeleteTradeClick}
                  disabled={deleting}
                  className="p-2 rounded-xl text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Delete Trade"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PnL Card */}
            <div
              className={`p-4 rounded-2xl border ${
                isWin
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : isLoss
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                  : "bg-gray-500/10 border-gray-400/30 text-gray-400"
              }`}
            >
              <span className="text-[10px] uppercase tracking-wider text-gray-400 block mb-1">
                Realized Net Profit
              </span>
              <div className="text-2xl font-extrabold tracking-tight flex items-baseline justify-between">
                <span>
                  {trade.net_profit >= 0 ? "+" : ""}
                  {formatCurrency(trade.net_profit)}
                </span>
                <span className="text-xs font-semibold text-purple-400">
                  {trade.rr_ratio !== null ? `${trade.rr_ratio} R` : "R:R N/A"}
                </span>
              </div>
            </div>

            {/* Tabs Header */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
              <button
                onClick={() => setActiveTab("details")}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                  activeTab === "details" ? "bg-purple-600/30 text-white font-bold border border-purple-500/40" : "text-gray-400 hover:text-white"
                }`}
              >
                Parameters
              </button>
              <button
                onClick={() => setActiveTab("notes")}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                  activeTab === "notes" ? "bg-purple-600/30 text-white font-bold border border-purple-500/40" : "text-gray-400 hover:text-white"
                }`}
              >
                Journal & Psych
              </button>
              <button
                onClick={() => setActiveTab("tags")}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                  activeTab === "tags" ? "bg-purple-600/30 text-white font-bold border border-purple-500/40" : "text-gray-400 hover:text-white"
                }`}
              >
                Tags ({tradeTags.length})
              </button>
              <button
                onClick={() => setActiveTab("images")}
                className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                  activeTab === "images" ? "bg-purple-600/30 text-white font-bold border border-purple-500/40" : "text-gray-400 hover:text-white"
                }`}
              >
                Media ({images.length})
              </button>
            </div>

            {/* Tab 1: Execution Parameters */}
            {activeTab === "details" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-gray-400 block text-[10px]">VOLUME</span>
                    <span className="text-white font-bold">{trade.volume} Lot</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-gray-400 block text-[10px]">ENTRY PRICE</span>
                    <span className="text-white font-bold">{trade.open_price ?? "—"}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-gray-400 block text-[10px]">EXIT PRICE</span>
                    <span className="text-white font-bold">{trade.close_price ?? "—"}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-gray-400 block text-[10px]">STOP LOSS</span>
                    <span className="text-rose-400 font-bold">{trade.stop_loss ?? "—"}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-gray-400 block text-[10px]">TAKE PROFIT</span>
                    <span className="text-emerald-400 font-bold">{trade.take_profit ?? "—"}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-gray-400 block text-[10px]">COMMISSION</span>
                    <span className="text-gray-300 font-bold">{formatCurrency(trade.commission)}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-gray-400 block text-[10px]">SWAP</span>
                    <span className="text-gray-300 font-bold">{formatCurrency(trade.swap)}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-gray-400 block text-[10px]">RISK AMOUNT</span>
                    <span className="text-purple-300 font-bold">{trade.risk_amount ? formatCurrency(trade.risk_amount) : "—"}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-gray-400 block text-[10px]">STRATEGY</span>
                    <span className="text-purple-300 font-bold">{trade.strategy || "—"}</span>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2 text-[11px]">
                  <div className="flex justify-between text-gray-400">
                    <span>Opened:</span>
                    <span className="text-white font-bold">
                      {trade.open_time ? format(parseISO(trade.open_time), "yyyy-MM-dd HH:mm:ss") : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Closed:</span>
                    <span className="text-white font-bold">
                      {trade.close_time ? format(parseISO(trade.close_time), "yyyy-MM-dd HH:mm:ss") : "—"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Journal & Psychology */}
            {activeTab === "notes" && (
              <div className="space-y-3">
                <div>
                  <label className="text-gray-400 block mb-1">Execution Notes</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Why did you take this trade? Strategy confluences..."
                    className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Emotions & Psychology</label>
                  <input
                    type="text"
                    value={emotions}
                    onChange={(e) => setEmotions(e.target.value)}
                    placeholder="e.g. Patient, Calm, FOMO, Hesitant..."
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-gray-400 block mb-1">Lessons Learned</label>
                  <input
                    type="text"
                    value={lessons}
                    onChange={(e) => setLessons(e.target.value)}
                    placeholder="What can be improved next time?"
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:border-purple-500"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-1.5"
                  >
                    {savingNotes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save Journal Notes</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 3: Tag Management */}
            {activeTab === "tags" && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {tradeTags.map(tag => (
                    <span key={tag.id} className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1.5 font-bold">
                      <TagIcon className="w-3 h-3 text-purple-400" />
                      {tag.name}
                      <button onClick={() => handleRemoveTag(tag.id)} className="hover:text-rose-400 ml-1">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {tradeTags.length === 0 && (
                    <span className="text-gray-500 italic">No tags attached yet.</span>
                  )}
                </div>

                <div className="pt-3 border-t border-white/10 space-y-2">
                  <label className="text-gray-400 block">Add Tag</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="New tag name..."
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white"
                    />
                    <button
                      onClick={handleCreateAndAddTag}
                      disabled={addingTag || !newTagName.trim()}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-1 disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>

                  {availableTags.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[10px] text-gray-500 block mb-1">EXISTING TAGS:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {availableTags.map(tag => (
                          <button
                            key={tag.id}
                            onClick={() => handleAddExistingTag(tag.id)}
                            className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-gray-300 text-[10px] border border-white/10"
                          >
                            + {tag.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 4: Image Attachments */}
            {activeTab === "images" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Screenshots & Charts</span>
                  <label className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Upload Image</span>
                    <input type="file" accept="image/*" onChange={handleUploadImage} className="hidden" disabled={uploadingImage} />
                  </label>
                </div>

                {uploadingImage && (
                  <div className="p-4 rounded-xl bg-white/5 text-center text-purple-400 flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Uploading image to storage...
                  </div>
                )}

                <div className="space-y-3">
                  {images.map(img => (
                    <div key={img.id} className="relative group rounded-xl border border-white/10 overflow-hidden bg-black/40">
                      <img src={img.public_url} alt="Trade Chart" className="w-full max-h-64 object-cover" />
                      <button
                        onClick={() => handleDeleteImage(img.id)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-rose-600/80 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete image"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {images.length === 0 && !uploadingImage && (
                    <div className="p-8 text-center text-gray-500 border border-dashed border-white/10 rounded-xl">
                      No charts attached yet. Upload a screenshot above.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-white/10 text-center text-[10px] text-gray-500">
            Account: {trade.account?.account_name || "Unassigned"} • Broker: {trade.account?.broker || "—"}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
