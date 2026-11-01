"use client";

import type {
  ListeningLanguage,
  ListeningLrcDocument,
  ListeningMode,
} from "@/types/listening";

import {
  ArrowRotateLeft,
  CircleExclamation,
  FileText,
  Headphones,
} from "@gravity-ui/icons";
import { Button, ScrollShadow, Skeleton } from "@heroui/react";
import { useEffect, useRef } from "react";

import GlassCard from "@/components/common/glass-card";
import { formatListeningTime } from "@/components/listening/lrc";

interface LrcViewProps {
  document: ListeningLrcDocument | null;
  lessonTitle?: string;
  loading: boolean;
  error: string | null;
  currentLineIndex: number;
  language: ListeningLanguage;
  mode: ListeningMode;
  autoFollow: boolean;
  onRetry: () => void;
  onSeek: (lineIndex: number) => void;
}

export default function LrcView({
  document,
  lessonTitle,
  loading,
  error,
  currentLineIndex,
  language,
  mode,
  autoFollow,
  onRetry,
  onSeek,
}: LrcViewProps) {
  const lineRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const lines = document?.lines ?? [];
  const displayedLines =
    mode === "single" && currentLineIndex >= 0
      ? lines.slice(currentLineIndex, currentLineIndex + 1)
      : lines;

  useEffect(() => {
    if (!autoFollow || currentLineIndex < 0) return;

    lineRefs.current[currentLineIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [autoFollow, currentLineIndex]);

  return (
    <GlassCard
      className="min-h-0 overflow-hidden"
      data-glass-incremental-resize=""
      data-glass-no-promotion=""
    >
      <div className="relative z-[1] flex h-full min-h-0 flex-col">
        <div className="flex min-h-14 shrink-0 items-center gap-3 border-b border-black/5 px-4 py-2.5 sm:px-5 dark:border-white/5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
            {mode === "dictation" ? (
              <Headphones className="size-4" />
            ) : (
              <FileText className="size-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-foreground">
              {lessonTitle || "课文内容"}
            </h2>
            <p className="truncate text-xs text-muted">
              {mode === "dictation"
                ? "听写模式 · 字幕已隐藏"
                : mode === "single"
                  ? "单句模式 · 每句结束自动暂停"
                  : mode === "shadow"
                    ? "跟读模式 · 逐句重复并留出复述时间"
                    : document?.metadata.artist || document?.metadata.title
                      ? [document.metadata.artist, document.metadata.title]
                          .filter(Boolean)
                          .join(" · ")
                      : "点击任意句子，从该句开始播放"}
            </p>
          </div>
          {lines.length > 0 && (
            <span className="shrink-0 text-xs tabular-nums text-muted">
              {Math.max(0, currentLineIndex + 1)} / {lines.length}
            </span>
          )}
        </div>

        {loading ? (
          <div
            aria-label="字幕加载中"
            className="flex-1 space-y-4 overflow-hidden p-5 sm:p-7"
          >
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-4/5 rounded-md" />
                <Skeleton className="h-3 w-3/5 rounded-md" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
            role="alert"
          >
            <CircleExclamation className="size-7 text-danger" />
            <div>
              <p className="text-sm font-medium text-foreground">
                字幕加载失败
              </p>
              <p className="mt-1 text-xs text-muted">{error}</p>
            </div>
            <Button size="sm" variant="secondary" onPress={onRetry}>
              <ArrowRotateLeft className="size-4" />
              重新加载
            </Button>
          </div>
        ) : !document || lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted">
            <FileText className="size-8" />
            <div>
              <p className="text-sm font-medium text-foreground">
                暂无有效字幕
              </p>
              <p className="mt-1 text-xs">仍可收听音频，或选择其他章节</p>
            </div>
          </div>
        ) : (
          <ScrollShadow
            aria-label="LRC 课文字幕"
            className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-3 py-5 sm:px-6 sm:py-7"
          >
            <div
              className={`mx-auto max-w-3xl ${mode === "single" ? "flex min-h-full items-center" : "space-y-2"}`}
            >
              {displayedLines.map((line) => {
                const isCurrent = line.index === currentLineIndex;
                const showEnglish = language !== "cn" && Boolean(line.en);
                const showChinese = language !== "en" && Boolean(line.cn);

                return (
                  <button
                    key={line.index}
                    ref={(element) => {
                      lineRefs.current[line.index] = element;
                    }}
                    aria-current={isCurrent ? "true" : undefined}
                    aria-label={
                      mode === "dictation"
                        ? `重听第 ${line.index + 1} 句，${formatListeningTime(line.start)}`
                        : `从 ${formatListeningTime(line.start)} 播放：${line.en} ${line.cn}`
                    }
                    className={`group relative w-full rounded-2xl px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent sm:px-5 ${
                      isCurrent
                        ? "bg-accent/12 shadow-sm ring-1 ring-accent/25"
                        : "hover:bg-black/[0.035] dark:hover:bg-white/[0.055]"
                    } ${mode === "single" ? "py-6 sm:py-8" : ""}`}
                    type="button"
                    onClick={() => onSeek(line.index)}
                  >
                    <span className="mb-1.5 flex items-center gap-2 text-[11px] tabular-nums text-muted">
                      <span>{formatListeningTime(line.start)}</span>
                      {isCurrent && (
                        <span className="font-medium text-accent">
                          {mode === "dictation" ? "正在听写" : "当前句"}
                        </span>
                      )}
                    </span>

                    {mode === "dictation" ? (
                      <span
                        aria-hidden="true"
                        className="flex h-12 items-center gap-2"
                      >
                        <span className="h-3 flex-1 rounded-full bg-foreground/10" />
                        <span className="h-3 w-1/4 rounded-full bg-foreground/[0.07]" />
                      </span>
                    ) : (
                      <span className="block">
                        {showEnglish && (
                          <span
                            className={`block leading-7 ${
                              isCurrent
                                ? "text-base font-semibold text-accent sm:text-lg"
                                : "text-base text-foreground/90"
                            }`}
                          >
                            {line.en}
                          </span>
                        )}
                        {showChinese && (
                          <span
                            className={`mt-1 block text-sm leading-6 ${
                              isCurrent ? "text-accent/80" : "text-muted"
                            }`}
                          >
                            {line.cn}
                          </span>
                        )}
                        {!showEnglish && !showChinese && (
                          <span className="block text-sm italic text-muted">
                            当前语言无对应字幕
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollShadow>
        )}
      </div>
    </GlassCard>
  );
}
