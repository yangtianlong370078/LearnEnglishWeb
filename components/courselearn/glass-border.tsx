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

export default function GlassBorder() {
  return (
    <span
      ref={registerGlassSurface}
      aria-hidden="true"
      className="glass-border"
    >
      <span className="glass-border-glow" />
    </span>
  );
}
