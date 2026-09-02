"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "@gravity-ui/icons";

interface PaginationBarProps {
  pageIndex: number;
  totalPages: number;
  onChange: (page: number) => void;
}

/**
 * 分页栏：首页 / 上一页 / 当前页 / 下一页 / 尾页。
 */
export default function PaginationBar({
  pageIndex,
  totalPages,
  onChange,
}: PaginationBarProps) {
  const canPrev = pageIndex > 1;
  const canNext = pageIndex < totalPages;

  const btn =
    "inline-flex min-h-9 min-w-9 items-center justify-center rounded-full p-3 text-sm font-medium transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40";
  const idle =
    "bg-white/70 text-foreground hover:-translate-y-px hover:bg-white hover:shadow-sm dark:bg-white/10 dark:hover:bg-white/15";

  if (totalPages <= 0) return null;

  return (
    <div className="flex justify-center">
    <nav
      aria-label="分页"
      className="card card--default  flex-row p-2  word-search-glass rounded-full !bg-transparent flex-col gap-3  sm:flex-row sm:items-center sm:justify-between"
    >
      <button
        aria-label="首页"
        className={`${btn} ${idle}`}
        disabled={!canPrev}
        type="button"
        onClick={() => onChange(1)}
      >
        <ChevronsLeft className="size-4" />
      </button>
      <button
        aria-label="上一页"
        className={`${btn} ${idle}`}
        disabled={!canPrev}
        type="button"
        onClick={() => onChange(pageIndex - 1)}
      >
        <ChevronLeft className="size-4" />
      </button>

      <span className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground tabular-nums">
        {pageIndex} / {totalPages}
      </span>

      <button
        aria-label="下一页"
        className={`${btn} ${idle}`}
        disabled={!canNext}
        type="button"
        onClick={() => onChange(pageIndex + 1)}
      >
        <ChevronRight className="size-4" />
      </button>
      <button
        aria-label="尾页"
        className={`${btn} ${idle}`}
        disabled={!canNext}
        type="button"
        onClick={() => onChange(totalPages)}
      >
        <ChevronsRight className="size-4" />
      </button>
    </nav>
    </div>
  );
}
