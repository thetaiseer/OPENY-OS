'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'dim';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function normalizeTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'light' ? 'light' : 'dark';
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const normalized = normalizeTheme(theme);
  root.dataset.theme = normalized;
  root.classList.toggle('dark', normalized === 'dark');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null;
    const initial: Theme = saved === 'light' || saved === 'dark' || saved === 'dim' ? saved : 'dark';
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    localStorage.setItem('theme', next);
    applyTheme(next);
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
