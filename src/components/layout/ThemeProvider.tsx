"use client";
import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";
const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void }>({ theme: "dark", toggleTheme: () => {} });

export function useTheme() { return useContext(ThemeContext); }

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  
  useEffect(() => {
    const saved = localStorage.getItem("openy-theme") as Theme | null;
    if (saved) {
      setTheme(saved);
      if (saved === "light") document.documentElement.classList.add("light");
    }
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
