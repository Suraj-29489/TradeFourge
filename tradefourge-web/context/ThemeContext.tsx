"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    try {
      const savedTheme = localStorage.getItem("tj_theme") as Theme | null;
      const resolvedTheme: Theme = savedTheme === "light" || savedTheme === "dark" ? savedTheme : "dark";
      setThemeState(resolvedTheme);
      document.documentElement.setAttribute("data-theme", resolvedTheme);
      // Tailwind is configured with darkMode: "class", which only reacts to a
      // literal `dark` class on <html> — the data-theme attribute above does
      // NOT trigger Tailwind's dark: variant. Without this line, every dark:
      // class anywhere in the app silently never applies.
      document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    } catch (e) {
      // Fallback
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem("tj_theme", newTheme);
      document.documentElement.setAttribute("data-theme", newTheme);
      document.documentElement.classList.toggle("dark", newTheme === "dark");
    } catch (e) {
      // Fallback
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
