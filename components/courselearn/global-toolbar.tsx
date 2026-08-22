"use client";

import type { LearnMode } from "@/types/courselearn";

import { Microphone, Volume } from "@gravity-ui/icons";

import { MODE_LABEL, MODE_ORDER } from "./lib";
import { CnEnIcon, EnCnIcon } from "./mode-icons";

interface GlobalToolbarProps {
  globalMode: LearnMode | null;
  translationOn: boolean;
  practiceOn: boolean;
  onGlobalModeChange: (mode: LearnMode | null) => void;
  onToggleTranslation: () => void;
  onTogglePractice: () => void;
}

/**
 * 全局功能开关区域：
 * - 左侧 4 个学习模式按钮（单选互斥，可再次点击关闭）
 * - 右侧 2 个设置开关（翻译 / 练习，可多选）
 */
export default function GlobalToolbar({
  globalMode,
  translationOn,
  practiceOn,
  onGlobalModeChange,
  onToggleTranslation,
  onTogglePractice,
}: GlobalToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-black/[0.03] p-2 dark:bg-white/[0.05] sm:flex-row sm:items-center sm:justify-between">
      {/* 左侧：4 个学习模式（单选） */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {MODE_ORDER.map((mode) => {
          const active = globalMode === mode;

          return (
            <button
              key={mode}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                active
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "bg-white/70 text-foreground hover:bg-white dark:bg-white/10 dark:hover:bg-white/15"
              }`}
              type="button"
              onClick={() => onGlobalModeChange(active ? null : mode)}
            >
              {mode === "dictation" ? (
                <Volume className="size-4" />
              ) : mode === "speech" ? (
                <Microphone className="size-4" />
              ) : mode === "cn-en" ? (
                <CnEnIcon className="size-4" />
              ) : (
                <EnCnIcon className="size-4" />
              )}
              {MODE_LABEL[mode]}
            </button>
          );
        })}
      </div>

      {/* 右侧：翻译 / 练习（多选） */}
      <div className="flex items-center justify-center gap-2">
        <button
          aria-pressed={translationOn}
          className={`rounded-xl px-3 py-2 text-sm font-medium transition-all ${
            translationOn
              ? "bg-success text-success-foreground shadow-sm"
              : "bg-white/70 text-foreground hover:bg-white dark:bg-white/10 dark:hover:bg-white/15"
          }`}
          type="button"
          onClick={onToggleTranslation}
        >
          翻译
        </button>
        <button
          aria-pressed={practiceOn}
          className={`rounded-xl px-3 py-2 text-sm font-medium transition-all ${
            practiceOn
              ? "bg-success text-success-foreground shadow-sm"
              : "bg-white/70 text-foreground hover:bg-white dark:bg-white/10 dark:hover:bg-white/15"
          }`}
          type="button"
          onClick={onTogglePractice}
        >
          练习
        </button>
      </div>
    </div>
  );
}
