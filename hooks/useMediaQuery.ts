"use client";

import { useEffect, useState } from "react";

/**
 * 响应式媒体查询 Hook
 * @param query 例如 "(min-width: 640px)"
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);

    setMatches(mql.matches);

    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);

    mql.addEventListener("change", handler);

    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
