export const THEME_STORAGE_KEY = "theme";
export const BACKGROUND_THEME_STORAGE_KEY = "background-theme";
export const DEFAULT_THEME = "system";
export const DEFAULT_BACKGROUND_THEME = "magnificent";

const THEMES = ["light", "dark", "system"] as const;
const BACKGROUND_THEMES = ["defalut", "magnificent"] as const;

export type Theme = (typeof THEMES)[number];

export const WALLPAPER_STORAGE_KEYS = {
  light: "wallpaper-light",
  dark: "wallpaper-dark",
} as const;
export const DEFAULT_WALLPAPERS = {
  light: "bg01_light.jpeg",
  dark: "bg01_dark.jpeg",
} as const;

export type WallpaperMode = keyof typeof DEFAULT_WALLPAPERS;

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

/** 文件名只允许单层名称，阻止路径穿越。 */
export function sanitizeWallpaperName(name: string | null): string | null {
  if (
    !name ||
    name.includes("/") ||
    name.includes("\\") ||
    name.includes("..")
  )
    return null;

  return name;
}

export function getStoredWallpaperName(mode: WallpaperMode): string {
  return (
    sanitizeWallpaperName(readPreference(WALLPAPER_STORAGE_KEYS[mode])) ??
    DEFAULT_WALLPAPERS[mode]
  );
}

/** 是否已显式选择过图片（区别于默认值回退）。 */
export function hasStoredWallpaper(mode: WallpaperMode): boolean {
  return (
    sanitizeWallpaperName(readPreference(WALLPAPER_STORAGE_KEYS[mode])) !== null
  );
}

export function getWallpaperUrl(
  mode: WallpaperMode,
  name: string = getStoredWallpaperName(mode),
) {
  return `/images/${mode}/${name}`;
}

/** 持久化选择，并通知壁纸缓存（MutationObserver）与 CSS 兜底背景。 */
export function setStoredWallpaper(mode: WallpaperMode, name: string) {
  const clean = sanitizeWallpaperName(name) ?? DEFAULT_WALLPAPERS[mode];

  try {
    localStorage.setItem(WALLPAPER_STORAGE_KEYS[mode], clean);
  } catch {
    // 存储不可用时仅本次会话生效。
  }
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  root.style.setProperty(
    `--wallpaper-url-${mode}`,
    `url("${getWallpaperUrl(mode, clean)}")`,
  );
  // 壁纸缓存观察该属性；当前模式匹配时会触发重新渲染。
  root.setAttribute(`data-wallpaper-${mode}`, clean);
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
  const sanitizeWallpaper = (name) =>
    typeof name === "string" && name &&
    !name.includes("/") && !name.includes("\\\\") && !name.includes("..")
      ? name : null;
  const wallpaper = {
    light: sanitizeWallpaper(read(${JSON.stringify(WALLPAPER_STORAGE_KEYS.light)}))
      || ${JSON.stringify(DEFAULT_WALLPAPERS.light)},
    dark: sanitizeWallpaper(read(${JSON.stringify(WALLPAPER_STORAGE_KEYS.dark)}))
      || ${JSON.stringify(DEFAULT_WALLPAPERS.dark)},
  };
  root.setAttribute("data-wallpaper-light", wallpaper.light);
  root.setAttribute("data-wallpaper-dark", wallpaper.dark);
  root.style.setProperty("--wallpaper-url-light",
    "url(\\"/images/light/" + wallpaper.light + "\\")");
  root.style.setProperty("--wallpaper-url-dark",
    "url(\\"/images/dark/" + wallpaper.dark + "\\")");
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
    preload.href = "/images/" + (dark
      ? "dark/" + wallpaper.dark
      : "light/" + wallpaper.light);
    document.head.append(preload);
  }
})();`;
