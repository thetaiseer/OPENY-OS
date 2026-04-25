'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { motionTiming } from '@/lib/motion';

type Theme = 'light' | 'dark';
interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}
const ThemeContext = createContext<ThemeContextType | null>(null);

function applyThemeToDocument(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.classList.toggle('dark', theme === 'dark');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null;
    const initial = saved === 'light' || saved === 'dark' ? saved : 'dark';
    setTheme(initial);
    applyThemeToDocument(initial);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      document.documentElement.classList.add('theme-transition');
      window.setTimeout(() => {
        document.documentElement.classList.remove('theme-transition');
      }, motionTiming.page * 1000);
      localStorage.setItem('theme', next);
      applyThemeToDocument(next);
      return next;
    });
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
