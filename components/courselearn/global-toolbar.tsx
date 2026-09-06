"use client";

import type { LearnMode } from "@/types/courselearn";
import GlassBorder, { GlassWarp } from "./glass-border";
import { MODE_LABEL, MODE_ORDER, MODE_THEME, isAudioMode } from "./lib";
import {
  CnEnIcon,
  EnCnIcon,
  MicrophoneIcon,
  PracticeIcon,
  SpeakerIcon,
  TranslateIcon,
} from "./mode-icons";

interface GlobalToolbarProps {
  globalMode: LearnMode | null;
  translationOn: boolean;
  /** 全局学习按钮未开启，或全局【听写】/【语音】开启时为 true，翻译按钮禁用 */
  translationDisabled: boolean;
  /** 全局学习按钮未开启时为 true，练习按钮禁用 */
  practiceDisabled: boolean;
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
  practiceDisabled,
  practiceOn,
  onGlobalModeChange,
  onToggleTranslation,
  onTogglePractice,
}: GlobalToolbarProps) {
  const translationTitle = !globalMode
    ? "请先开启全局学习按钮"
    : translationDisabled
      ? "听写 / 语音模式下不可开启翻译"
      : undefined;

  return (
    <div className="yinyinkuan flex p-2  cl-glass-idle rounded-3xl  flex-col gap-3  sm:flex-row sm:items-center sm:justify-between">

      <GlassWarp />
      {/* 左侧：4 个学习模式（单选） */}
      <div className="flex flex-wrap items-center z-[1] justify-center gap-2">
        {MODE_ORDER.map((mode) => {
          const active = globalMode === mode;
          const theme = MODE_THEME[mode];

          return (
            <button
              key={mode}
              aria-pressed={active}
              className={`cl-global-btn inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-all duration-300 ${
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

      {/* 右侧：翻译 / 练习（多选）；全局【听写】/【语音】开启时隐藏【翻译】 */}
      <div className="flex items-center z-[1] justify-center gap-2">
        {!isAudioMode(globalMode) && (
          <button
            aria-disabled={translationDisabled}
            aria-pressed={translationOn}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-all duration-300 ${
              translationDisabled
                ? "cursor-not-allowed bg-white/40 text-muted opacity-60 dark:bg-white/5"
                : translationOn
                  ? "bg-white text-foreground shadow-md ring-1 ring-black/5 hover:shadow-lg dark:bg-white/35 dark:text-white dark:shadow-none dark:ring-white/40"
                  : "bg-white/60 text-foreground/75 hover:-translate-y-px hover:bg-white/80 hover:shadow-sm dark:bg-white/10 dark:text-foreground/90 dark:hover:bg-white/15 dark:hover:shadow-none"
            }`}
            disabled={translationDisabled}
            title={translationTitle}
            type="button"
            onClick={onToggleTranslation}
          >
            <TranslateIcon className="size-4" />
            翻译
          </button>
        )}
        <button
          aria-disabled={practiceDisabled}
          aria-pressed={practiceOn}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-all duration-300 ${
            practiceDisabled
              ? "cursor-not-allowed bg-white/40 text-muted opacity-60 dark:bg-white/5"
              : practiceOn
                ? "bg-white text-foreground shadow-md ring-1 ring-black/5 hover:shadow-lg dark:bg-white/35 dark:text-white dark:shadow-none dark:ring-white/40"
                : "bg-white/60 text-foreground/75 hover:-translate-y-px hover:bg-white/80 hover:shadow-sm dark:bg-white/10 dark:text-foreground/90 dark:hover:bg-white/15 dark:hover:shadow-none"
          }`}
          disabled={practiceDisabled}
          title={practiceDisabled ? "请先开启全局学习按钮" : undefined}
          type="button"
          onClick={onTogglePractice}
        >
          <PracticeIcon className="size-4" />
          练习
        </button>
      </div>

       <GlassBorder />
    </div>
  );
}
