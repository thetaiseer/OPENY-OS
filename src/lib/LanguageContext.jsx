"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState } from

"react";
import { en, ar } from "./translations";

// ── Types ─────────────────────────────────────────────────────











// ── Helpers ───────────────────────────────────────────────────

const dictionaries = { en, ar };

function resolve(obj, path) {
  const keys = path.split(".");
  let cur = obj;
  for (const k of keys) {
    if (cur && typeof cur === "object" && k in cur) {
      cur = cur[k];
    } else {
      return path;
    }
  }
  return typeof cur === "string" ? cur : path;
}

// ── Context ───────────────────────────────────────────────────

const LanguageContext = createContext({
  language: "en",
  setLanguage: () => {},
  t: (k) => k,
  dir: "ltr",
  isRTL: false
});

// ── Provider ──────────────────────────────────────────────────

export function LanguageProvider({ children }) {
  const [language, setLang] = useState("en");
  const initialized = useRef(false);

  // Restore persisted language on first render
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const saved = localStorage.getItem("openy-lang");
    if (saved && saved !== language) {
      applyLanguage(saved);
      setLang(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLanguage = useCallback((lang) => {
    localStorage.setItem("openy-lang", lang);
    applyLanguage(lang);
    setLang(lang);
  }, []);

  const t = useCallback(
    (key) => resolve(dictionaries[language], key),
    [language]
  );

  const dir = language === "ar" ? "rtl" : "ltr";
  const isRTL = language === "ar";

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir, isRTL }}>
      {children}
    </LanguageContext.Provider>);

}

// ── DOM helper (called outside React render) ──────────────────

function applyLanguage(lang) {
  const html = document.documentElement;
  html.setAttribute("lang", lang);
  html.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
}

// ── Hooks ─────────────────────────────────────────────────────

export function useLanguage() {
  return useContext(LanguageContext);
}