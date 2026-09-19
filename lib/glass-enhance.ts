"use client";

import { useEffect, useState } from "react";

import { glassConfig } from "@/config/glass";

const STORAGE_KEY = "glass-enhance";
const CHANGE_EVENT = "glass-enhance-change";

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

export function getGlassEnhance(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem(STORAGE_KEY);

  return stored === null ? true : stored === "on";
}

export function setGlassEnhance(enabled: boolean) {
  localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  document.documentElement.setAttribute(
    "data-glass-enhance",
    enabled ? "on" : "off",
  );
  applyEnhanceVariables(enabled);
  window.dispatchEvent(new CustomEvent<boolean>(CHANGE_EVENT, { detail: enabled }));
}

export function useGlassEnhance(): boolean {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(getGlassEnhance());
    const handler = (event: Event) =>
      setEnabled((event as CustomEvent<boolean>).detail);

    window.addEventListener(CHANGE_EVENT, handler);

    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, []);

  return enabled;
}
