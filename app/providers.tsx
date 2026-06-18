"use client";

import * as React from "react";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: {
    attribute?: "class";
    defaultTheme?: "light" | "dark" | "system";
    enableSystem?: boolean;
  };
}

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
}

const STORAGE_KEY = "theme";
const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getStoredTheme(defaultTheme: Theme): Theme {
  if (typeof window === "undefined") return defaultTheme;

  const stored = localStorage.getItem(STORAGE_KEY);

  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : defaultTheme;
}

function applyTheme(theme: Theme, enableSystem: boolean) {
  const resolved =
    theme === "system" && enableSystem ? getSystemTheme() : theme;

  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
}

export function Providers({ children, themeProps }: ProvidersProps) {
  const defaultTheme = themeProps?.defaultTheme ?? "system";
  const enableSystem = themeProps?.enableSystem ?? true;
  const [theme, setThemeState] = React.useState<Theme>(() =>
    getStoredTheme(defaultTheme),
  );
  const [systemTheme, setSystemTheme] =
    React.useState<ResolvedTheme>(getSystemTheme);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setSystemTheme(getSystemTheme());

    handleChange();
    media.addEventListener("change", handleChange);

    return () => media.removeEventListener("change", handleChange);
  }, []);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
    applyTheme(theme, enableSystem);
  }, [enableSystem, theme]);

  const setTheme = React.useCallback<
    React.Dispatch<React.SetStateAction<Theme>>
  >((value) => {
    setThemeState((current) =>
      typeof value === "function" ? value(current) : value,
    );
  }, []);

  const resolvedTheme =
    theme === "system" && enableSystem ? systemTheme : (theme as ResolvedTheme);
  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [resolvedTheme, setTheme, theme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = React.use(ThemeContext);

  if (!value) {
    throw new Error("useTheme must be used inside Providers");
  }

  return value;
}
