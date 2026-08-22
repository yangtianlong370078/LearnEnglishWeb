"use client";

import type { LearnStatus } from "@/types/courselearn";

interface StatTabsProps {
  active: LearnStatus;
  brs: number;
  wlj: number;
  yzw: number;
  onChange: (zt: LearnStatus) => void;
}

const TABS: { zt: LearnStatus; label: string; key: "brs" | "wlj" | "yzw" }[] = [
  { zt: 1, label: "不认识", key: "brs" },
  { zt: 2, label: "学习中", key: "wlj" },
  { zt: 3, label: "已掌握", key: "yzw" },
];

/**
 * 三个居中状态 Tab（不认识 / 学习中 / 已掌握），带对应数量。
 */
export default function StatTabs({
  active,
  brs,
  wlj,
  yzw,
  onChange,
}: StatTabsProps) {
  const counts = { brs, wlj, yzw };

  return (
    <div className="flex justify-center">
      <div className="inline-flex items-center gap-1 rounded-2xl bg-black/[0.04] p-1 dark:bg-white/[0.06]">
        {TABS.map((tab) => {
          const isActive = active === tab.zt;

          return (
            <button
              key={tab.zt}
              aria-pressed={isActive}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                isActive
                  ? "bg-white text-foreground shadow-sm dark:bg-white/15"
                  : "text-muted hover:text-foreground"
              }`}
              type="button"
              onClick={() => onChange(tab.zt)}
            >
              {tab.label}
              <span
                className={`inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "bg-black/5 text-muted dark:bg-white/10"
                }`}
              >
                {counts[tab.key].toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
