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
      <div className="card card--default  flex-row p-2  word-search-glass rounded-full !bg-transparent flex-col gap-3  sm:flex-row sm:items-center sm:justify-between">
        {TABS.map((tab) => {
          const isActive = active === tab.zt;

          return (
            <button
              key={tab.zt}
              aria-pressed={isActive}
              className={`inline-flex items-center gap-2 rounded-full pl-3 pr-2 py-2 text-sm font-medium transition-all duration-300 ${
                isActive
                  ? "bg-white text-foreground shadow-md shadow-black/[0.06] dark:bg-white/15 dark:shadow-black/20"
                  : "text-muted hover:bg-white/40 hover:text-foreground dark:hover:bg-white/5"
              }`}
              type="button"
              onClick={() => onChange(tab.zt)}
            >
              {tab.label}
              <span
                className={`inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums transition-all duration-300 ${
                  isActive
                    ? "bg-accent text-accent-foreground shadow-sm shadow-accent/40"
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
