/**
 * Announcement Manager Service
 * TradeFourge v5.1 — Owner Workspace / Admin Controls
 */

export type AnnouncementType = "Maintenance" | "New Version" | "Scheduled Downtime" | "New Feature";

export interface Announcement {
  id: string;
  type: AnnouncementType;
  title: string;
  message: string;
  active: boolean;
  createdAt: string;
}

const STORAGE_KEY = "tf_admin_announcements_v1";

const DEFAULT_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "ann-1",
    type: "New Version",
    title: "TradeFourge v5.1 Released",
    message: "Hybrid architecture active. Live broker sync & local CSV isolation are now live.",
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: "ann-2",
    type: "Maintenance",
    title: "Scheduled Maintenance Window",
    message: "Routine server upgrades scheduled for Sunday 02:00 UTC. Local CSV features will remain 100% available.",
    active: false,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

export function getAnnouncements(): Announcement[] {
  if (typeof window === "undefined") return DEFAULT_ANNOUNCEMENTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ANNOUNCEMENTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_ANNOUNCEMENTS;
  } catch {
    return DEFAULT_ANNOUNCEMENTS;
  }
}

export function getActiveAnnouncements(): Announcement[] {
  return getAnnouncements().filter((a) => a.active);
}

export function createAnnouncement(
  type: AnnouncementType,
  title: string,
  message: string
): Announcement {
  const newAnn: Announcement = {
    id: `ann-${Date.now()}`,
    type,
    title,
    message,
    active: true,
    createdAt: new Date().toISOString(),
  };

  const list = getAnnouncements();
  const updated = [newAnn, ...list];
  saveAnnouncements(updated);
  return newAnn;
}

export function toggleAnnouncement(id: string): Announcement[] {
  const list = getAnnouncements();
  const updated = list.map((a) => (a.id === id ? { ...a, active: !a.active } : a));
  saveAnnouncements(updated);
  return updated;
}

export function deleteAnnouncement(id: string): Announcement[] {
  const list = getAnnouncements();
  const updated = list.filter((a) => a.id !== id);
  saveAnnouncements(updated);
  return updated;
}

function saveAnnouncements(list: Announcement[]): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new Event("tf-announcements-changed"));
    } catch {}
  }
}
