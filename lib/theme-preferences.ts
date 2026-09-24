export const THEME_STORAGE_KEY = "theme";
export const BACKGROUND_THEME_STORAGE_KEY = "background-theme";
export const DEFAULT_THEME = "system";
export const DEFAULT_BACKGROUND_THEME = "magnificent";

const THEMES = ["light", "dark", "system"] as const;
const BACKGROUND_THEMES = ["defalut", "magnificent"] as const;

export type Theme = (typeof THEMES)[number];

function readPreference(key: string): string | null {
  try {
    return typeof window === "undefined"
      ? null
      : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getStoredTheme(defaultTheme: Theme = DEFAULT_THEME): Theme {
  const stored = readPreference(THEME_STORAGE_KEY);

  return THEMES.find((theme) => theme === stored) ?? defaultTheme;
}

export function getStoredBackgroundTheme() {
  const stored = readPreference(BACKGROUND_THEME_STORAGE_KEY);

  return (
    BACKGROUND_THEMES.find((theme) => theme === stored) ??
    DEFAULT_BACKGROUND_THEME
  );
}

// Run directly in <head>: no React, bundle download, or wallpaper decoding is
// needed to select the first paint's colors and background. Only static config
// is embedded; saved preferences are read and validated in the browser.
export const themeBootstrapScript = `(() => {
  const root = document.documentElement;
  const read = (key) => {
    try { return window.localStorage.getItem(key); } catch { return null; }
  };
  const savedTheme = read(${JSON.stringify(THEME_STORAGE_KEY)});
  const theme = ${JSON.stringify(THEMES)}.includes(savedTheme)
    ? savedTheme : ${JSON.stringify(DEFAULT_THEME)};
  const dark = theme === "dark" || (theme === "system" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches);
  const savedBackground = read(${JSON.stringify(BACKGROUND_THEME_STORAGE_KEY)});
  const background = ${JSON.stringify(BACKGROUND_THEMES)}.includes(savedBackground)
    ? savedBackground : ${JSON.stringify(DEFAULT_BACKGROUND_THEME)};
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  root.setAttribute("data-bg-theme", background);
  const savedMode = read("glass-mode");
  const legacy = read("glass-enhance");
  let mode = ["card", "glass", "liquid"].includes(savedMode)
    ? savedMode : (legacy === null || legacy === "on" ? "glass" : "card");
  if (mode === "liquid" && background !== "magnificent") mode = "glass";
  root.setAttribute("data-glass-mode", mode);
  if (mode === "liquid") {
    const preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "image";
    preload.href = "/images/bg01_" + (dark ? "dark" : "light") + ".jpeg";
    document.head.append(preload);
  }
})();`;
