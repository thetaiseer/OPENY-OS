'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'dim';
interface ThemeContextType { theme: Theme; setTheme: (t: Theme) => void; toggleTheme: () => void; }
const ThemeContext = createContext<ThemeContextType | null>(null);

function applyTheme(theme: Theme) {
  const el = document.documentElement;
  el.classList.remove('dark', 'dim');
  if (theme === 'dark') el.classList.add('dark');
  if (theme === 'dim') el.classList.add('dim');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null;
    const initial: Theme = (saved === 'light' || saved === 'dark' || saved === 'dim') ? saved : 'dark';
    setThemeState(initial);
    applyTheme(initial);
  }, []);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    localStorage.setItem('theme', next);
    applyTheme(next);
  };

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'dim' : 'light');
  };

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
