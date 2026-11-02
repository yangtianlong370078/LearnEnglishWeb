"use client";

import { ArrowLeft, Headphones, ListUl } from "@gravity-ui/icons";
import { Button } from "@heroui/react";

import GlassCard from "@/components/common/glass-card";

interface ListeningHeaderProps {
  courseName: string;
  lessonTitle?: string;
  lessonsOpen: boolean;
  onBack: () => void;
  onToggleLessons: () => void;
}

export default function ListeningHeader({
  courseName,
  lessonTitle,
  lessonsOpen,
  onBack,
  onToggleLessons,
}: ListeningHeaderProps) {
  return (
    <header className="relative z-20 flex h-[68px] shrink-0 mt-3 px-3 pt-3 sm:px-5">
      <GlassCard
        className="min-w-0 flex-1 rounded-3xl"
        data-glass-no-promotion=""
      >
        <div className="relative z-[1] flex h-full items-center gap-2 px-2 sm:gap-3 sm:px-3">
          <Button
            isIconOnly
            aria-label="返回听力课程"
            size="sm"
            variant="ghost"
            onPress={onBack}
          >
            <ArrowLeft className="size-5" />
          </Button>
          <div className="hidden size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground sm:flex">
            <Headphones className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">
              {courseName || "听力学习"}
            </h1>
            <p className="truncate text-xs text-muted">
              {lessonTitle || "正在准备课程内容"}
            </p>
          </div>
          <Button
            isIconOnly
            aria-controls="listening-lesson-list"
            aria-expanded={lessonsOpen}
            aria-label={lessonsOpen ? "收起章节列表" : "展开章节列表"}
            className="lg:hidden"
            size="sm"
            variant="secondary"
            onPress={onToggleLessons}
          >
            <ListUl className="size-4" />
          </Button>
        </div>
      </GlassCard>
    </header>
  );
}
