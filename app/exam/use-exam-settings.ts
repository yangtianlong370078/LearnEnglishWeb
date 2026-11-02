"use client";

import type {
  ExamAccentType,
  ExamAsrModelType,
  ExamSettings,
} from "./settings-types";
import { DEFAULT_EXAM_SETTINGS } from "./settings-types";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "exam:settings";

function readSettings(): ExamSettings {
  if (typeof window === "undefined") return DEFAULT_EXAM_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_EXAM_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ExamSettings>;

    return {
      ...DEFAULT_EXAM_SETTINGS,
      ...parsed,
      // 修正历史/异常值
      dictationPlayCount:
        typeof parsed.dictationPlayCount === "number" &&
        parsed.dictationPlayCount > 0
          ? Math.min(Math.floor(parsed.dictationPlayCount), 10)
          : DEFAULT_EXAM_SETTINGS.dictationPlayCount,
      retryCount:
        typeof parsed.retryCount === "number" && parsed.retryCount > 0
          ? Math.min(Math.floor(parsed.retryCount), 10)
          : DEFAULT_EXAM_SETTINGS.retryCount,
    };
  } catch {
    return DEFAULT_EXAM_SETTINGS;
  }
}

/**
 * 考试设置 Hook（localStorage 持久化）
 */
export function useExamSettings() {
  const [settings, setSettings] = useState<ExamSettings>(DEFAULT_EXAM_SETTINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(readSettings());
    setHydrated(true);
  }, []);

  const update = useCallback((patch: Partial<ExamSettings>) => {
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

  const setAccent = useCallback(
    (v: ExamAccentType) => update({ accent: v }),
    [update],
  );

  const setDictationPlayCount = useCallback(
    (v: number) =>
      update({ dictationPlayCount: Math.max(1, Math.min(10, Math.floor(v))) }),
    [update],
  );

  const setRetryCount = useCallback(
    (v: number) => update({ retryCount: Math.max(1, Math.min(10, v)) }),
    [update],
  );

  const setAsrModelType = useCallback(
    (v: ExamAsrModelType) => update({ asrModelType: v }),
    [update],
  );

  return {
    settings,
    hydrated,
    setAccent,
    setDictationPlayCount,
    setRetryCount,
    setAsrModelType,
  };
}
