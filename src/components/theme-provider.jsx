"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "theme";
const ThemeContext = createContext({
  theme: "dark",
  setTheme: () => {},
  ready: false,
});

function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children, defaultTheme = "dark" }) {
  const [theme, setThemeState] = useState(defaultTheme);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const next = stored === "light" || stored === "dark" ? stored : defaultTheme;
    setThemeState(next);
    applyTheme(next);
    setReady(true);
  }, [defaultTheme]);

  const setTheme = useCallback((next) => {
    const value = next === "light" ? "light" : "dark";
    setThemeState(value);
    applyTheme(value);
    localStorage.setItem(STORAGE_KEY, value);
  }, []);

  const value = useMemo(() => ({ theme, setTheme, ready }), [theme, setTheme, ready]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
