"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "glass-enhance";
const CHANGE_EVENT = "glass-enhance-change";

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
