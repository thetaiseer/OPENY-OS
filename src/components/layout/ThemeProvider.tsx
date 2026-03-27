"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";

type Theme = "dark" | "light";
const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void }>({ theme: "dark", toggleTheme: () => {} });

export function useTheme() { return useContext(ThemeContext); }

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const saved = localStorage.getItem("openy-theme") as Theme | null;
    if (saved && saved !== theme) {
      if (saved === "light") document.documentElement.classList.add("light");
      else document.documentElement.classList.remove("light");
      setTheme(saved);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("openy-theme", next);
      if (next === "light") document.documentElement.classList.add("light");
      else document.documentElement.classList.remove("light");
      return next;
    });
  };
  
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
