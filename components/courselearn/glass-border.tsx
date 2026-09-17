"use client";

import { registerGlassSurface } from "@/lib/glass-surface-source";

/** Blur and border colour effects are painted by separate CSS pseudo-elements. */
export function GlassWarp() {
  return (
    <span
      ref={registerGlassSurface}
      aria-hidden="true"
      className="glass-warp"
    />
  );
}

/** The corner glow bends around the arc at the same width as the sides, so
   the mask needs the host's real radius (clamped like the renderer does). */
function trackBorderRadius(el: HTMLElement | null) {
  if (!el) return;
  const update = () => {
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    const { width, height } = el.getBoundingClientRect();
    const clamped = Math.max(0, Math.min(radius, width / 2, height / 2));
    el.style.setProperty("--glass-border-radius", `${clamped}px`);
  };
  update();
  const observer = new ResizeObserver(update);
  observer.observe(el);
  return () => observer.disconnect();
}

export default function GlassBorder() {
  return (
    <span
      ref={(el) => {
        const release = registerGlassSurface(el);
        const untrack = trackBorderRadius(el);
        return () => {
          untrack?.();
          release?.();
        };
      }}
      aria-hidden="true"
      className="glass-border"
    />
  );
}
