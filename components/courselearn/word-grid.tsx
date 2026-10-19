"use client";

import type { ReactNode } from "react";

import { Spinner } from "@heroui/react";

/** 单词网格及其加载、失败、空列表状态。 */
export default function WordGrid({
  loading,
  error,
  empty,
  onRetry,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div
        className="flex flex-1 items-center justify-center py-20"
        data-glass-navigation-content=""
      >
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center"
        data-glass-navigation-content=""
      >
        <p className="text-sm text-danger">{error}</p>
        <button
          className="rounded-xl bg-gradient-to-br from-accent to-accent/80 px-5 py-2 text-sm font-medium text-accent-foreground shadow-md shadow-accent/30 transition-all duration-300 hover:-translate-y-px hover:shadow-lg"
          type="button"
          onClick={onRetry}
        >
          重新加载
        </button>
      </div>
    );
  }

  if (empty) {
    return (
      <div
        className="flex flex-1 items-center justify-center py-20 text-sm text-muted"
        data-glass-navigation-content=""
      >
        暂无单词
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
      data-cl-grid=""
    >
      {children}
    </div>
  );
}
