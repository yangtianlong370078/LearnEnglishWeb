"use client";

import type { LearnMode } from "@/types/courselearn";

import { MODE_LABEL, MODE_ORDER, MODE_THEME } from "./lib";
import { CnEnIcon, EnCnIcon, MicrophoneIcon, SpeakerIcon } from "./mode-icons";

interface GlobalToolbarProps {
  globalMode: LearnMode | null;
  translationOn: boolean;
  /** 全局或任一单词卡开启【听写】/【语音】时为 true，翻译按钮禁用 */
  translationDisabled: boolean;
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
  translationDisabled,
  practiceOn,
  onGlobalModeChange,
  onToggleTranslation,
  onTogglePractice,
}: GlobalToolbarProps) {
  return (
    <div className="card card--default p-2  word-search-glass rounded-3xl !bg-transparent flex-col gap-3  sm:flex-row sm:items-center sm:justify-between">
      {/* 左侧：4 个学习模式（单选） */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {MODE_ORDER.map((mode) => {
          const active = globalMode === mode;
          const theme = MODE_THEME[mode];

          return (
            <button
              key={mode}
              aria-pressed={active}
              className={`cl-global-btn inline-flex items-center gap-1.5 rounded-3xl px-3 py-2 text-sm font-medium transition-all duration-300 ${
                active ? "is-active" : ""
              }`}
              style={
                {
                  "--cl-ring": theme.from,
                  "--cl-ring2": theme.to,
                  "--cl-soft": theme.soft,
                } as React.CSSProperties
              }
              type="button"
              onClick={() => onGlobalModeChange(active ? null : mode)}
            >
              {mode === "dictation" ? (
                <SpeakerIcon className="size-4" />
              ) : mode === "speech" ? (
                <MicrophoneIcon className="size-4" />
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
          aria-disabled={translationDisabled}
          aria-pressed={translationOn}
          className={`rounded-3xl px-3 py-2 text-sm font-medium transition-all duration-300 ${
            translationDisabled
              ? "cursor-not-allowed bg-white/40 text-muted opacity-60 dark:bg-white/5"
              : translationOn
                ? "bg-gradient-to-br from-success to-success/80 text-success-foreground shadow-md shadow-success/35"
                : "bg-white/70 text-foreground hover:-translate-y-px hover:bg-white hover:shadow-sm dark:bg-white/10 dark:hover:bg-white/15"
          }`}
          disabled={translationDisabled}
          title={translationDisabled ? "听写 / 语音模式下不可开启翻译" : undefined}
          type="button"
          onClick={onToggleTranslation}
        >
          翻译
        </button>
        <button
          aria-pressed={practiceOn}
          className={`rounded-3xl px-3 py-2 text-sm font-medium transition-all duration-300 ${
            practiceOn
              ? "bg-gradient-to-br from-success to-success/80 text-success-foreground shadow-md shadow-success/35"
              : "bg-white/70 text-foreground hover:-translate-y-px hover:bg-white hover:shadow-sm dark:bg-white/10 dark:hover:bg-white/15"
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
