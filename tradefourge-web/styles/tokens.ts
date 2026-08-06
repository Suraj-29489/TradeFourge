// styles/tokens.ts
// TradeFourge Institutional Design Tokens & Semantic Color Palette

export const TOKENS = {
  colors: {
    primary: {
      DEFAULT: "#2563EB", // Blue 600
      hover: "#3B82F6",   // Blue 500
      light: "rgba(37, 99, 235, 0.10)",
      border: "rgba(59, 130, 246, 0.30)",
      text: "#60A5FA",    // Blue 400
    },
    success: {
      DEFAULT: "#10B981", // Emerald 500
      light: "rgba(16, 185, 129, 0.10)",
      border: "rgba(16, 185, 129, 0.30)",
      text: "#34D399",
    },
    danger: {
      DEFAULT: "#F43F5E", // Rose 500
      light: "rgba(244, 63, 94, 0.10)",
      border: "rgba(244, 63, 94, 0.30)",
      text: "#FB7185",
    },
    warning: {
      DEFAULT: "#F59E0B", // Amber 500
      light: "rgba(245, 158, 11, 0.10)",
      border: "rgba(245, 158, 11, 0.30)",
      text: "#FBBF24",
    },
    muted: {
      DEFAULT: "#6B7280", // Gray 500
      text: "#9CA3AF",
    },
    background: {
      app: "#080B11",
      surface: "#090D14",
      card: "#0F141C",
      hover: "rgba(255, 255, 255, 0.04)",
      border: "rgba(255, 255, 255, 0.08)",
    },
  },
  typography: {
    fontSans: "font-sans",
    fontMono: "font-mono",
  },
  radius: {
    card: "rounded-2xl",
    button: "rounded-xl",
    badge: "rounded-full",
  },
  transitions: {
    default: "transition-all duration-150 ease-in-out",
  },
};
