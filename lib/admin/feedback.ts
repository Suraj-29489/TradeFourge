/**
 * Feedback Inbox Manager Service
 * TradeFourge v5.1 — Owner Workspace / Admin Controls
 */

export type FeedbackCategory = "Bug Report" | "Feature Request" | "General Feedback";
export type FeedbackStatus = "Open" | "In Progress" | "Completed";

export interface FeedbackItem {
  id: string;
  userEmail: string;
  category: FeedbackCategory;
  title: string;
  description: string;
  status: FeedbackStatus;
  createdAt: string;
}

const STORAGE_KEY = "tf_admin_feedback_v1";

const DEFAULT_FEEDBACK: FeedbackItem[] = [
  {
    id: "fb-101",
    userEmail: "trader_alex@example.com",
    category: "Feature Request",
    title: "Multi-Account Analytics Comparison View",
    description: "Ability to compare equity curves side-by-side across two distinct accounts.",
    status: "In Progress",
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: "fb-102",
    userEmail: "samuel_p@example.com",
    category: "Bug Report",
    title: "CSV Parser timezone offset on MetaTrader 4 export",
    description: "MetaTrader 4 timestamps display +2 hours offset on midnight trades.",
    status: "Open",
    createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
  },
  {
    id: "fb-103",
    userEmail: "elena_trade@example.com",
    category: "General Feedback",
    title: "Love the offline CSV privacy mode!",
    description: "The instant performance lab and local privacy speed is phenomenal.",
    status: "Completed",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
];

export function getFeedbackList(): FeedbackItem[] {
  if (typeof window === "undefined") return DEFAULT_FEEDBACK;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FEEDBACK;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_FEEDBACK;
  } catch {
    return DEFAULT_FEEDBACK;
  }
}

export function submitFeedback(
  userEmail: string,
  category: FeedbackCategory,
  title: string,
  description: string
): FeedbackItem {
  const item: FeedbackItem = {
    id: `fb-${Date.now()}`,
    userEmail,
    category,
    title,
    description,
    status: "Open",
    createdAt: new Date().toISOString(),
  };

  const current = getFeedbackList();
  const updated = [item, ...current];
  saveFeedback(updated);
  return item;
}

export function updateFeedbackStatus(id: string, status: FeedbackStatus): FeedbackItem[] {
  const current = getFeedbackList();
  const updated = current.map((item) => (item.id === id ? { ...item, status } : item));
  saveFeedback(updated);
  return updated;
}

export function deleteFeedback(id: string): FeedbackItem[] {
  const current = getFeedbackList();
  const updated = current.filter((item) => item.id !== id);
  saveFeedback(updated);
  return updated;
}

function saveFeedback(items: FeedbackItem[]): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }
}
