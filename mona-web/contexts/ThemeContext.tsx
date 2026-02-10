"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (isDark: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_KEY = "mona_dark_mode";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize from localStorage (default to dark mode for new users)
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check localStorage first — only override default if user has a saved preference
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setIsDarkMode(stored === "true");
    }
    // New users get dark mode by default (no else branch needed)
    setIsInitialized(true);
  }, []);

  // Update document class when dark mode changes
  useEffect(() => {
    if (!isInitialized) return;

    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    // Persist to localStorage
    localStorage.setItem(STORAGE_KEY, String(isDarkMode));
  }, [isDarkMode, isInitialized]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  const setDarkMode = useCallback((isDark: boolean) => {
    setIsDarkMode(isDark);
  }, []);

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, setDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
