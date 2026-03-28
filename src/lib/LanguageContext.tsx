"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { en, ar } from "./translations";
import type { Translations } from "./translations";

// ── Types ─────────────────────────────────────────────────────

export type Language = "en" | "ar";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
  isRTL: boolean;
}

// ── Helpers ───────────────────────────────────────────────────

const dictionaries: Record<Language, Translations> = { en, ar };

function resolve(obj: unknown, path: string): string {
  const keys = path.split(".");
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur && typeof cur === "object" && k in (cur as object)) {
      cur = (cur as Record<string, unknown>)[k];
    } else {
      return path;
    }
  }
  return typeof cur === "string" ? cur : path;
}

// ── Context ───────────────────────────────────────────────────

const LanguageContext = createContext<LanguageContextValue>({
  language: "en",
  setLanguage: () => {},
  t: (k) => k,
  dir: "ltr",
  isRTL: false,
});

// ── Provider ──────────────────────────────────────────────────

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<Language>("en");
  const initialized = useRef(false);

  // Restore persisted language on first render
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const saved = localStorage.getItem("openy-lang") as Language | null;
    if (saved && saved !== language) {
      applyLanguage(saved);
      setLang(saved);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    localStorage.setItem("openy-lang", lang);
    applyLanguage(lang);
    setLang(lang);
  }, []);

  const t = useCallback(
    (key: string) => resolve(dictionaries[language], key),
    [language],
  );

  const dir = language === "ar" ? "rtl" : "ltr";
  const isRTL = language === "ar";

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ── DOM helper (called outside React render) ──────────────────

function applyLanguage(lang: Language) {
  const html = document.documentElement;
  html.setAttribute("lang", lang);
  html.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
}

// ── Hooks ─────────────────────────────────────────────────────

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
