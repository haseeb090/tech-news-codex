"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export const publicThemes = [
  { id: "synthwave", label: "Synthwave" },
  { id: "aurora", label: "Aurora" },
  { id: "paper", label: "Paper Glow" },
  { id: "midnight", label: "Midnight Glass" },
  { id: "ember", label: "Ember Grid" },
  { id: "reef", label: "Electric Reef" },
] as const;

export type PublicThemeId = (typeof publicThemes)[number]["id"];

interface ThemeContextValue {
  theme: PublicThemeId;
  setTheme: (theme: PublicThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const storageKey = "rubix-signal-theme";
const legacyStorageKey = "tech-radar-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<PublicThemeId>(() => {
    if (typeof window === "undefined") return "synthwave";
    const stored =
      (window.localStorage.getItem(storageKey) as PublicThemeId | null) ||
      (window.localStorage.getItem(legacyStorageKey) as PublicThemeId | null);
    if (stored && publicThemes.some((item) => item.id === stored)) {
      return stored;
    }
    return "synthwave";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(storageKey, theme);
    window.localStorage.removeItem(legacyStorageKey);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};
