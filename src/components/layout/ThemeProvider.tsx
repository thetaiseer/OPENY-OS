"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";

type Theme = "dark" | "light";
const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void; setTheme: (t: Theme) => void }>({ theme: "dark", toggleTheme: () => {}, setTheme: () => {} });

export function useTheme() { return useContext(ThemeContext); }

function applyTheme(t: Theme) {
  if (t === "light") document.documentElement.classList.add("light");
  else document.documentElement.classList.remove("light");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const saved = localStorage.getItem("openy-theme") as Theme | null;
    if (saved && saved !== theme) {
      applyTheme(saved);
      setThemeState(saved);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = (next: Theme) => {
    localStorage.setItem("openy-theme", next);
    applyTheme(next);
    setThemeState(next);
  };
  
  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };
  
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
