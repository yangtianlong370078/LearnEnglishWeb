"use client";

import type { ListeningLesson } from "@/types/listening";
import type { ReactNode } from "react";

import {
  ArrowRotateLeft,
  Bookmark,
  BookmarkFill,
  BookOpen,
  CircleExclamation,
  ListUl,
} from "@gravity-ui/icons";
import { Button, Chip, ScrollShadow, Skeleton, Spinner } from "@heroui/react";

import GlassCard from "@/components/common/glass-card";
import ListeningWave from "@/components/listening/listening-wave";

interface LessonListProps {
  lessons: ListeningLesson[];
  selectedLessonId: number | null;
  playing: boolean;
  loading: boolean;
  error: string | null;
  className?: string;
  id?: string;
  mobileDrawer?: boolean;
  showHeader?: boolean;
  headerAction?: ReactNode;
  favoritesMode?: boolean;
  favoritePendingLessonId?: number | null;
  favoriteActionError?: string | null;
  onRetry: () => void;
  onSelect: (lessonId: number) => void;
  onToggleFavorite: (lessonId: number) => void;
}

export default function LessonList({
  lessons,
  selectedLessonId,
  playing,
  loading,
  error,
  className = "",
  id = "listening-lesson-list",
  mobileDrawer = false,
  showHeader = true,
  headerAction,
  favoritesMode = false,
  favoritePendingLessonId = null,
  favoriteActionError = null,
  onRetry,
  onSelect,
  onToggleFavorite,
}: LessonListProps) {
  return (
    <GlassCard
      className={`min-h-0 overflow-hidden ${className}`}
      data-glass-incremental-resize=""
      data-glass-no-promotion=""
    >
      <div className="relative z-[1] flex h-full min-h-0 flex-col" id={id}>
        {showHeader && (
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-black/5 px-3 dark:border-white/5">
            {favoritesMode ? (
              <BookmarkFill className="size-4 text-accent" />
            ) : (
              <ListUl className="size-4 text-muted" />
            )}
            <h2 className="text-sm font-semibold">
              {favoritesMode ? "我的收藏" : "章节列表"}
            </h2>
            {!loading && !error && (
              <Chip
                className={headerAction ? "" : "ml-auto"}
                size="sm"
                variant="soft"
              >
                {lessons.length}
              </Chip>
            )}
            {headerAction && (
              <div className="ml-auto flex size-9 shrink-0 items-center justify-center">
                {headerAction}
              </div>
            )}
          </div>
        )}

        {favoriteActionError && (
          <p
            className="shrink-0 border-b border-danger/10 bg-danger/5 px-3 py-2 text-xs text-danger"
            role="alert"
          >
            {favoriteActionError}
          </p>
        )}

        {loading ? (
          <div
            className={`flex gap-2 overflow-hidden p-3 ${mobileDrawer ? "flex-col" : "lg:flex-col"}`}
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton
                key={index}
                className={`h-14 rounded-xl ${mobileDrawer ? "min-w-0" : "min-w-48 lg:h-16 lg:min-w-0"}`}
              />
            ))}
          </div>
        ) : error ? (
          <div
            className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center"
            role="alert"
          >
            <CircleExclamation className="size-5 text-danger" />
            <p className="line-clamp-2 text-xs text-muted">{error}</p>
            <Button size="sm" variant="secondary" onPress={onRetry}>
              <ArrowRotateLeft className="size-3.5" />
              重试
            </Button>
          </div>
        ) : lessons.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-5 text-center text-sm text-muted">
            {favoritesMode ? (
              <Bookmark className="size-6" />
            ) : (
              <BookOpen className="size-6" />
            )}
            {favoritesMode
              ? "暂无收藏章节，可先在课程章节中添加收藏"
              : "暂无章节"}
          </div>
        ) : (
          <ScrollShadow
            aria-label={favoritesMode ? "收藏章节" : "课程章节"}
            className={`flex min-h-0 flex-1 gap-2 overflow-y-auto p-3 ${
              mobileDrawer
                ? "flex-col"
                : "overflow-x-auto lg:flex-col lg:overflow-x-hidden"
            }`}
          >
            {lessons.map((lesson, index) => {
              const selected = lesson.id === selectedLessonId;

              return (
                <div
                  key={lesson.id}
                  className={`group flex shrink-0 items-center gap-1 rounded-xl px-2 py-2 transition-colors ${
                    mobileDrawer
                      ? "w-full min-w-0"
                      : "min-w-52 lg:min-w-0 lg:w-full"
                  } ${
                    selected
                      ? "bg-accent/15 text-accent ring-1 ring-accent/20"
                      : "bg-white/20 hover:bg-white/40 dark:bg-black/10 dark:hover:bg-white/10"
                  }`}
                >
                  <button
                    aria-current={selected ? "true" : undefined}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-0.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    type="button"
                    onClick={() => onSelect(lesson.id)}
                  >
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums ${
                        selected
                          ? "bg-accent text-accent-foreground"
                          : "bg-black/5 text-muted dark:bg-white/10"
                      }`}
                    >
                      {selected && playing ? (
                        <ListeningWave className="size-5" />
                      ) : (
                        String(index + 1).padStart(2, "0")
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-medium leading-5">
                        {lesson.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted">
                        {favoritesMode
                          ? `${lesson.courseName ?? "听力课程"} · ${lesson.subCourseName ?? "未知册次"}`
                          : lesson.filename || `第 ${index + 1} 课`}
                      </span>
                    </span>
                  </button>
                  <Button
                    isIconOnly
                    aria-label={lesson.isFavorited ? "取消收藏" : "收藏章节"}
                    className={
                      lesson.isFavorited
                        ? "shrink-0 text-accent"
                        : "shrink-0 text-muted"
                    }
                    isDisabled={favoritePendingLessonId === lesson.id}
                    size="sm"
                    variant="ghost"
                    onPress={() => onToggleFavorite(lesson.id)}
                  >
                    {favoritePendingLessonId === lesson.id ? (
                      <Spinner size="sm" />
                    ) : lesson.isFavorited ? (
                      <BookmarkFill className="size-4" />
                    ) : (
                      <Bookmark className="size-4" />
                    )}
                  </Button>
                </div>
              );
            })}
          </ScrollShadow>
        )}
      </div>
    </GlassCard>
  );
}
