"use client";

import type { RecentListeningLesson } from "@/types/listening";

import { useEffect, useState } from "react";

import { storage } from "@/utils/storage";

export const RECENT_LISTENING_KEY = "listening:recent-lesson:v1";

type RecentListeningInput = Omit<RecentListeningLesson, "lastLearnedAt">;

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function readRecentListening(): RecentListeningLesson | null {
  const value =
    storage.get<Partial<RecentListeningLesson>>(RECENT_LISTENING_KEY);

  if (
    !value ||
    !isNonNegativeInteger(value.courseId) ||
    !isPositiveInteger(value.subCourseId) ||
    !isPositiveInteger(value.lessonId) ||
    typeof value.courseName !== "string" ||
    typeof value.subCourseName !== "string" ||
    typeof value.lessonTitle !== "string" ||
    typeof value.lastLearnedAt !== "string" ||
    !Number.isFinite(Date.parse(value.lastLearnedAt))
  ) {
    return null;
  }

  return value as RecentListeningLesson;
}

export function saveRecentListening(lesson: RecentListeningInput): void {
  storage.set<RecentListeningLesson>(RECENT_LISTENING_KEY, {
    ...lesson,
    lastLearnedAt: new Date().toISOString(),
  });
}

export function useRecentListening() {
  const [recentLesson, setRecentLesson] =
    useState<RecentListeningLesson | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setRecentLesson(readRecentListening());
    setHydrated(true);

    const onStorage = (event: StorageEvent) => {
      if (event.key === RECENT_LISTENING_KEY) {
        setRecentLesson(readRecentListening());
      }
    };

    window.addEventListener("storage", onStorage);

    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { recentLesson, hydrated };
}
