"use client";

import type {
  ListeningAfterPlay,
  ListeningLanguage,
  ListeningMode,
  ListeningSettings,
} from "@/types/listening";

import { useCallback, useEffect, useState } from "react";

export const LISTENING_SETTINGS_KEY = "listening:settings";
export const LISTENING_PLAYBACK_RATES = [
  0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 2,
] as const;

export const DEFAULT_LISTENING_SETTINGS: ListeningSettings = {
  language: "bi",
  mode: "continuous",
  afterPlay: "stop",
  skipIntro: false,
  autoFollow: true,
  playbackRate: 1,
  shadowRepeatCount: 2,
  shadowGap: 1.5,
};

const LANGUAGES: ListeningLanguage[] = ["en", "bi", "cn"];
const MODES: ListeningMode[] = ["continuous", "single", "dictation", "shadow"];
const AFTER_PLAY: ListeningAfterPlay[] = ["stop", "repeat", "next", "all"];

function enumValue<T extends string>(
  value: unknown,
  allowed: T[],
  fallback: T,
): T {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

function numberValue(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  step: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;

  const clamped = Math.min(maximum, Math.max(minimum, value));

  return Math.round(clamped / step) * step;
}

function readSettings(): ListeningSettings {
  if (typeof window === "undefined") return DEFAULT_LISTENING_SETTINGS;

  try {
    const raw = window.localStorage.getItem(LISTENING_SETTINGS_KEY);

    if (!raw) return DEFAULT_LISTENING_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<ListeningSettings>;
    const playbackRate =
      typeof parsed.playbackRate === "number" &&
      LISTENING_PLAYBACK_RATES.includes(
        parsed.playbackRate as (typeof LISTENING_PLAYBACK_RATES)[number],
      )
        ? parsed.playbackRate
        : DEFAULT_LISTENING_SETTINGS.playbackRate;

    return {
      language: enumValue(
        parsed.language,
        LANGUAGES,
        DEFAULT_LISTENING_SETTINGS.language,
      ),
      mode: enumValue(parsed.mode, MODES, DEFAULT_LISTENING_SETTINGS.mode),
      afterPlay: enumValue(
        parsed.afterPlay,
        AFTER_PLAY,
        DEFAULT_LISTENING_SETTINGS.afterPlay,
      ),
      skipIntro:
        typeof parsed.skipIntro === "boolean"
          ? parsed.skipIntro
          : DEFAULT_LISTENING_SETTINGS.skipIntro,
      autoFollow:
        typeof parsed.autoFollow === "boolean"
          ? parsed.autoFollow
          : DEFAULT_LISTENING_SETTINGS.autoFollow,
      playbackRate,
      shadowRepeatCount: numberValue(
        parsed.shadowRepeatCount,
        DEFAULT_LISTENING_SETTINGS.shadowRepeatCount,
        1,
        10,
        1,
      ),
      shadowGap: numberValue(
        parsed.shadowGap,
        DEFAULT_LISTENING_SETTINGS.shadowGap,
        0,
        5,
        0.5,
      ),
    };
  } catch {
    return DEFAULT_LISTENING_SETTINGS;
  }
}

export function useListeningSettings() {
  const [settings, setSettings] = useState<ListeningSettings>(
    DEFAULT_LISTENING_SETTINGS,
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(readSettings());
    setHydrated(true);
  }, []);

  const updateSettings = useCallback((patch: Partial<ListeningSettings>) => {
    setSettings((previous) => {
      const next = { ...previous, ...patch };

      try {
        window.localStorage.setItem(
          LISTENING_SETTINGS_KEY,
          JSON.stringify(next),
        );
      } catch {
        // 隐私模式或存储已满时仍保留本次会话设置。
      }

      return next;
    });
  }, []);

  return { settings, hydrated, updateSettings };
}
