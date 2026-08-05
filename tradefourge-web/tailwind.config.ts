import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#7C3AED",
          50: "#F5F3FF",
          100: "#EDE9FE",
          200: "#DDD6FE",
          300: "#C4B5FD",
          400: "#A78BFA",
          500: "#8B5CF6",
          600: "#7C3AED",
          700: "#6D28D9",
          800: "#5B21B6",
          900: "#4C1D95",
        },
        profit: {
          DEFAULT: "#10B981",
          glow: "rgba(16, 185, 129, 0.1)",
          border: "rgba(16, 185, 129, 0.2)",
          text: "#34D399",
        },
        loss: {
          DEFAULT: "#EF4444",
          glow: "rgba(239, 68, 68, 0.1)",
          border: "rgba(239, 68, 68, 0.2)",
          text: "#F87171",
        },
        dark: {
          bg: "rgb(var(--dark-bg) / <alpha-value>)",
          card: "rgb(var(--dark-card) / <alpha-value>)",
          hover: "rgb(var(--dark-hover) / <alpha-value>)",
          border: "var(--dark-border)",
          subtle: "rgb(var(--dark-subtle) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      boxShadow: {
        glow: "0 4px 12px -2px rgba(0, 0, 0, 0.3)",
        "profit-glow": "0 4px 12px -2px rgba(0, 0, 0, 0.3)",
        "loss-glow": "0 4px 12px -2px rgba(0, 0, 0, 0.3)",
        card: "0 10px 30px -10px rgba(0, 0, 0, 0.5)",
      },
    },
  },
  plugins: [],
};

export default config;
