import type { AnswerState, ExamDetail, ExamMode, ExamSummary } from "./types";

import axios from "axios";

import { MODE_LABEL, MODE_THEME } from "@/components/courselearn/lib";

export const EXAM_DURATIONS = [5, 10, 20, 30, 40, 50, 60] as const;
export const EXAM_MODES: ExamMode[] = ["en-cn", "cn-en", "dictation", "speech"];

export const EXAM_MODE_META: Record<
  ExamMode,
  {
    label: string;
    type: number;
    scoreKey: keyof ExamSummary & keyof ExamDetail;
    completedKey: keyof ExamSummary;
    countKey: keyof ExamDetail;
    theme: (typeof MODE_THEME)[ExamMode];
  }
> = {
  "en-cn": {
    label: MODE_LABEL["en-cn"],
    type: 2,
    scoreKey: "yzScore",
    completedKey: "yzCompleted",
    countKey: "yzCount",
    theme: MODE_THEME["en-cn"],
  },
  "cn-en": {
    label: MODE_LABEL["cn-en"],
    type: 1,
    scoreKey: "zyScore",
    completedKey: "zyCompleted",
    countKey: "zyCount",
    theme: MODE_THEME["cn-en"],
  },
  dictation: {
    label: MODE_LABEL.dictation,
    type: 3,
    scoreKey: "txScore",
    completedKey: "txCompleted",
    countKey: "txCount",
    theme: MODE_THEME.dictation,
  },
  speech: {
    label: MODE_LABEL.speech,
    type: 4,
    scoreKey: "fyScore",
    completedKey: "fyCompleted",
    countKey: "fyCount",
    theme: MODE_THEME.speech,
  },
};

export function normalizeEnglish(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function isAnswerCorrect(
  mode: ExamMode,
  word: { en: string; cn: string },
  answer?: AnswerState,
): boolean {
  if (!answer) return false;
  if (mode === "speech") return answer.completed && answer.correct === true;

  const value = answer.value.trim();

  if (!value) return false;
  if (mode === "en-cn") {
    return word.cn.toLocaleLowerCase().includes(value.toLocaleLowerCase());
  }

  return normalizeEnglish(value) === normalizeEnglish(word.en);
}

export function scoreOf(correct: number, total: number): number {
  return total > 0 ? Math.floor((correct * 100) / total) : 0;
}

export function formatRemaining(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;

  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function emptyAnswer(): AnswerState {
  return { value: "", completed: false, attempts: 0 };
}

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | {
          msg?: string;
          title?: string;
          errors?: Record<string, string[]>;
        }
      | undefined;

    if (data?.msg) return data.msg;
    const validationMessage = data?.errors
      ? Object.values(data.errors).flat().filter(Boolean).join("；")
      : "";

    if (validationMessage) return validationMessage;
    if (data?.title) return data.title;
  }

  return error instanceof Error ? error.message : "操作失败，请稍后重试";
}
