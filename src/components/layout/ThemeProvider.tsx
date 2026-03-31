"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";


const ThemeContext = createContext<{ theme: string; toggleTheme: () => void; setTheme: (next: string) => void }>({ theme: "light", toggleTheme: () => {}, setTheme: () => {} });

export function useTheme() {return useContext(ThemeContext);}

function applyTheme(t) {
  if (t === "dark") document.documentElement.classList.add("dark");else
  document.documentElement.classList.remove("dark");
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState("light");
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const saved = localStorage.getItem("openy-theme");
    if (saved && saved !== theme) {
      applyTheme(saved);
      setThemeState(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTheme = (next) => {
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
    </ThemeContext.Provider>);

}