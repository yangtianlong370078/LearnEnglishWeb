"use client";

import type { ListeningLesson } from "@/types/listening";
import type { RefCallback } from "react";

import { Xmark } from "@gravity-ui/icons";
import { Drawer } from "@heroui/react";
import { useCallback } from "react";

import GlassBorder, { GlassWarp } from "@/components/courselearn/glass-border";
import LessonList from "@/components/listening/lesson-list";
import { registerGlassBackdrop } from "@/lib/glass-backdrop-stack";

interface LessonDrawerProps {
  isOpen: boolean;
  lessons: ListeningLesson[];
  selectedLessonId: number | null;
  playing: boolean;
  loading: boolean;
  error: string | null;
  favoritesMode?: boolean;
  favoritePendingLessonId?: number | null;
  favoriteActionError?: string | null;
  onOpenChange: (open: boolean) => void;
  onRetry: () => void;
  onSelect: (lessonId: number) => void;
  onToggleFavorite: (lessonId: number) => void;
}

export default function LessonDrawer({
  isOpen,
  lessons,
  selectedLessonId,
  playing,
  loading,
  error,
  favoritesMode = false,
  favoritePendingLessonId = null,
  favoriteActionError = null,
  onOpenChange,
  onRetry,
  onSelect,
  onToggleFavorite,
}: LessonDrawerProps) {
  const backdropRef = useCallback<RefCallback<HTMLDivElement>>((element) => {
    if (!element) return;

    return registerGlassBackdrop(element);
  }, []);

  return (
    <Drawer.Backdrop
      ref={backdropRef}
      className="app-modal-backdrop"
      data-slot="app-modal-backdrop"
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      <Drawer.Content className="p-3 sm:p-4 lg:hidden" placement="left">
        <Drawer.Dialog
          aria-label="课程章节"
          className="modal__dialog yinyinkuan cl-glass-idle app-glass-dialog relative flex h-full w-[calc(86vw-0.75rem)] max-w-80 flex-col overflow-hidden rounded-3xl p-0 shadow-2xl sm:w-[calc(86vw-1rem)]"
        >
          <GlassWarp />
          <Drawer.Body className="relative rounded-3xl z-[1] min-h-0 flex-1 !bg-white/[0.3] p-0 dark:!bg-black/[0.15]">
            <LessonList
              mobileDrawer
              className="h-full rounded-none"
              error={error}
              favoriteActionError={favoriteActionError}
              favoritePendingLessonId={favoritePendingLessonId}
              favoritesMode={favoritesMode}
              headerAction={
                <Drawer.CloseTrigger
                  aria-label="关闭章节列表"
                  className="inline-flex size-8 items-center top-[10px] right-[12px] justify-center rounded-full text-muted transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
                >
                  <Xmark className="size-4" />
                </Drawer.CloseTrigger>
              }
              lessons={lessons}
              loading={loading}
              playing={playing}
              selectedLessonId={selectedLessonId}
              onRetry={onRetry}
              onSelect={(lessonId) => {
                onSelect(lessonId);
                onOpenChange(false);
              }}
              onToggleFavorite={onToggleFavorite}
            />
          </Drawer.Body>
          <GlassBorder />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
