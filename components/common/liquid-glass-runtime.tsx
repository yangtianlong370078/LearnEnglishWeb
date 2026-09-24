"use client";

import { useEffect } from "react";

import {
  getGlassMode,
  GLASS_MODE_CHANGE_EVENT,
  setGlassMode,
} from "@/lib/glass-enhance";

let controllerModule:
  | Promise<typeof import("@/lib/liquid-glass-controller")>
  | undefined;

function loadController() {
  return (controllerModule ??= import("@/lib/liquid-glass-controller").catch(
    (error) => {
      controllerModule = undefined;
      throw error;
    },
  ));
}

// Start fetching as soon as this bundle runs, while React is still hydrating.
if (
  typeof document !== "undefined" &&
  document.documentElement.getAttribute("data-glass-mode") === "liquid"
) {
  void loadController().catch(() => {});
}

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

      void loadController()
        .then(({ createLiquidGlassController }) => {
          if (current !== generation) return;
          release = createLiquidGlassController(document, () => {
            if (current === generation)
              setGlassMode("glass", { persist: false });
          });
        })
        .catch(() => {
          if (current === generation) setGlassMode("glass", { persist: false });
        });
    };

    // Also initialize standalone routes which do not mount the theme picker.
    // Restore the DOM/enhancement state without changing the saved preference.
    setGlassMode(getGlassMode(), { persist: false });
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
