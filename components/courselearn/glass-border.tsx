"use client";

import { useGlassEnhance } from "@/lib/glass-enhance";
import { registerGlassSurface } from "@/lib/glass-surface-source";

/** Blur and border colour effects are painted by separate CSS pseudo-elements. */
/* 内容层奶白底色：内缩 1.5px 避开描边环区，light:bg-white/15  dark:bg-black/10 dark:bg-white/5 dark:bg-[hsla(0,0%,50%,0.05)]!
          让边框环直接透出 warp 玻璃（更"裸透"的液态玻璃边框）  */
export function GlassWarp() {
  const glassEnhance = useGlassEnhance();

  return (
    <>
    <span
      ref={registerGlassSurface}
      aria-hidden="true"
      className="glass-warp"
    />

        {glassEnhance && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute  yyk"
            style={{ inset: "1px", borderRadius: "calc(var(--card-radius-zdy) - 1px)" }}
          />
        )}
        </>
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
