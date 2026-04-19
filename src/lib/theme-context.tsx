'use client';

import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { ThemeProvider as NextThemeProvider, useTheme as useNextTheme } from 'next-themes';

export type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function normalizeTheme(theme: Theme): 'light' | 'dark' {
  return theme === 'light' ? 'light' : 'dark';
}

function ThemeContextBridge({ children }: { children: React.ReactNode }) {
  const { theme: rawTheme, resolvedTheme, setTheme: setNextTheme } = useNextTheme();

  const theme = useMemo<Theme>(() => {
    const current = resolvedTheme ?? rawTheme ?? 'dark';
    return current === 'light' ? 'light' : 'dark';
  }, [rawTheme, resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    setNextTheme(normalizeTheme(next));
  }, [setNextTheme]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [setTheme, theme]);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [setTheme, theme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider
      attribute="data-theme"
      defaultTheme="dark"
      enableSystem={false}
      themes={['light', 'dark']}
      disableTransitionOnChange
    >
      <ThemeContextBridge>{children}</ThemeContextBridge>
    </NextThemeProvider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
