"use client";

import { useSyncExternalStore } from "react";

import { glassConfig } from "@/config/glass";

const LEGACY_STORAGE_KEY = "glass-enhance";
const STORAGE_KEY = "glass-mode";

export const GLASS_MODE_CHANGE_EVENT = "glass-mode-change";
export type GlassMode = "card" | "glass" | "liquid";

function isGlassMode(value: string | null): value is GlassMode {
  return value === "card" || value === "glass" || value === "liquid";
}

function allowedGlassMode(mode: GlassMode): GlassMode {
  if (mode !== "liquid") return mode;

  let background = document.documentElement.getAttribute("data-bg-theme");

  try {
    // The selection is saved before the matching wallpaper finishes loading.
    background = localStorage.getItem("background-theme") ?? background;
  } catch {
    // Use the applied theme when persistent storage is unavailable.
  }

  return (background ?? "magnificent") === "magnificent" ? mode : "glass";
}

/** 关闭玻璃加强时归零、开启时恢复配置值的 CSS 变量。 */
function applyEnhanceVariables(enabled: boolean) {
  const style = document.documentElement.style;
  const { borderGlow, borderGlowSizePx, borderHighlight } = glassConfig;

  const values: Record<string, string> = enabled
    ? {
        "--glass-border-glow-top": String(borderGlow.top),
        "--glass-border-glow-right": String(borderGlow.right),
        "--glass-border-glow-bottom": String(borderGlow.bottom),
        "--glass-border-glow-left": String(borderGlow.left),
        "--glass-border-glow-size-top": `${borderGlowSizePx.top}px`,
        "--glass-border-glow-size-right": `${borderGlowSizePx.right}px`,
        "--glass-border-glow-size-bottom": `${borderGlowSizePx.bottom}px`,
        "--glass-border-glow-size-left": `${borderGlowSizePx.left}px`,
        "--glass-border-highlight-intensity": String(borderHighlight.intensity),
      }
    : {
        "--glass-border-glow-top": "0",
        "--glass-border-glow-right": "0",
        "--glass-border-glow-bottom": "0",
        "--glass-border-glow-left": "0",
        "--glass-border-glow-size-top": "0px",
        "--glass-border-glow-size-right": "0px",
        "--glass-border-glow-size-bottom": "0px",
        "--glass-border-glow-size-left": "0px",
        "--glass-border-highlight-intensity": "0",
      };

  for (const [name, value] of Object.entries(values)) {
    style.setProperty(name, value);
  }
}

export function getGlassMode(): GlassMode {
  if (typeof window === "undefined") return "glass";

  const applied = document.documentElement.getAttribute("data-glass-mode");

  if (isGlassMode(applied)) return allowedGlassMode(applied);

  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (isGlassMode(stored)) return allowedGlassMode(stored);

    // Preserve the previous switch preference on the first visit after upgrade.
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);

    return legacy === null || legacy === "on" ? "glass" : "card";
  } catch {
    return "glass";
  }
}

export function setGlassMode(mode: GlassMode) {
  mode = allowedGlassMode(mode);
  const root = document.documentElement;
  const enabled = mode !== "card";
  const enhance = enabled ? "on" : "off";

  try {
    localStorage.setItem(STORAGE_KEY, mode);
    localStorage.setItem(LEGACY_STORAGE_KEY, enhance);
  } catch {
    // The current session still works when persistent storage is unavailable.
  }

  root.setAttribute("data-glass-mode", mode);
  if (root.getAttribute("data-glass-enhance") !== enhance) {
    root.setAttribute("data-glass-enhance", enhance);
    applyEnhanceVariables(enabled);
  }
  window.dispatchEvent(
    new CustomEvent<GlassMode>(GLASS_MODE_CHANGE_EVENT, { detail: mode }),
  );
}

function subscribeGlassMode(onChange: () => void) {
  window.addEventListener(GLASS_MODE_CHANGE_EVENT, onChange);

  return () => window.removeEventListener(GLASS_MODE_CHANGE_EVENT, onChange);
}

export function useGlassMode(): GlassMode {
  return useSyncExternalStore(subscribeGlassMode, getGlassMode, () => "glass");
}

export function getGlassEnhance(): boolean {
  return getGlassMode() !== "card";
}

export function setGlassEnhance(enabled: boolean) {
  setGlassMode(enabled ? "glass" : "card");
}

export function useGlassEnhance(): boolean {
  // Glass and liquid share the same existing DOM/CSS layers. A mode change
  // between them must not rerender every card just to keep those layers on.
  return useSyncExternalStore(subscribeGlassMode, getGlassEnhance, () => true);
}
