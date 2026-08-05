"use client";

import { create } from "zustand";

export type ConnectionMode = "companion" | "csv" | "mt5";

interface ConnectionModeState {
  selectedMode: ConnectionMode;
  isConnectionHubOpen: boolean;
  
  setSelectedMode: (mode: ConnectionMode) => void;
  openConnectionHub: () => void;
  closeConnectionHub: () => void;
}

export const useConnectionModeStore = create<ConnectionModeState>((set) => ({
  selectedMode:
    typeof window !== "undefined"
      ? (localStorage.getItem("tf_connection_mode") as ConnectionMode) || "companion"
      : "companion",
  isConnectionHubOpen: false,

  setSelectedMode: (mode) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("tf_connection_mode", mode);
    }
    set({ selectedMode: mode });
  },

  openConnectionHub: () => set({ isConnectionHubOpen: true }),
  closeConnectionHub: () => set({ isConnectionHubOpen: false }),
}));
