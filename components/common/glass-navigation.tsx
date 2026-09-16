"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { GlassWarp } from "@/components/courselearn/glass-border";
import { registerGlassNavigation } from "@/lib/glass-navigation-source";

export default function GlassNavigation() {
  const anchor = useRef<HTMLSpanElement>(null);
  const pathname = usePathname();

  useLayoutEffect(() => {
    const nav = anchor.current?.parentElement;

    if (nav) return registerGlassNavigation(nav);
  }, [pathname]);

  return (
    <>
      <span ref={anchor} hidden />
      <GlassWarp />
    </>
  );
}
