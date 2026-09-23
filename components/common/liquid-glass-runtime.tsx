"use client";

import { useEffect } from "react";

import {
  getGlassMode,
  GLASS_MODE_CHANGE_EVENT,
  setGlassMode,
} from "@/lib/glass-enhance";

/** Only the small mode listener exists outside liquid mode. */
export default function LiquidGlassRuntime() {
  useEffect(() => {
    let generation = 0;
    let release: (() => void) | undefined;

    const sync = () => {
      const current = ++generation;

      release?.();
      release = undefined;
      if (getGlassMode() !== "liquid") return;

      void import("@/lib/liquid-glass-controller")
        .then(({ createLiquidGlassController }) => {
          if (current !== generation) return;
          release = createLiquidGlassController(document, () => {
            if (current === generation) setGlassMode("glass");
          });
        })
        .catch(() => {
          if (current === generation) setGlassMode("glass");
        });
    };

    // Also initialize standalone routes which do not mount the theme picker.
    setGlassMode(getGlassMode());
    window.addEventListener(GLASS_MODE_CHANGE_EVENT, sync);
    sync();

    return () => {
      generation++;
      window.removeEventListener(GLASS_MODE_CHANGE_EVENT, sync);
      release?.();
    };
  }, []);

  return null;
}
