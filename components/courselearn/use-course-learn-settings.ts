"use client";

import type {
  AccentType,
  AsrModelType,
  CourseLearnSettings,
} from "@/types/courselearn";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "courselearn:settings";

export const DEFAULT_SETTINGS: CourseLearnSettings = {
  autoSpeak: false,
  hideMeaning: false,
  accent: "Speech_US",
  dictationCount: 3,
  asrModelType: "2",
};

function readSettings(): CourseLearnSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<CourseLearnSettings>;

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      // 修正历史/异常值
      dictationCount:
        typeof parsed.dictationCount === "number" && parsed.dictationCount > 0
          ? Math.min(Math.floor(parsed.dictationCount), 20)
          : DEFAULT_SETTINGS.dictationCount,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * 课程学习设置 Hook（localStorage 持久化）。
 */
export function useCourseLearnSettings() {
  const [settings, setSettings] = useState<CourseLearnSettings>(DEFAULT_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(readSettings());
    setHydrated(true);
  }, []);

  const update = useCallback((patch: Partial<CourseLearnSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };

      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // 忽略写入失败
      }

      return next;
    });
  }, []);

  const setAutoSpeak = useCallback(
    (v: boolean) => update({ autoSpeak: v }),
    [update],
  );
  const setHideMeaning = useCallback(
    (v: boolean) => update({ hideMeaning: v }),
    [update],
  );
  const setAccent = useCallback(
    (v: AccentType) => update({ accent: v }),
    [update],
  );
  const setDictationCount = useCallback(
    (v: number) => update({ dictationCount: Math.max(1, Math.min(20, v)) }),
    [update],
  );
  const setAsrModelType = useCallback(
    (v: AsrModelType) => update({ asrModelType: v }),
    [update],
  );

  return {
    settings,
    hydrated,
    setAutoSpeak,
    setHideMeaning,
    setAccent,
    setDictationCount,
    setAsrModelType,
  };
}
