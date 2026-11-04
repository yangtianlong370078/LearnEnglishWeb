"use client";

import type { AnswerState, ExamContent, ExamMode, ScoringMode } from "./types";

import { useEffect, useState } from "react";
import { Xmark } from "@gravity-ui/icons";

import ExamModeIcon from "./mode-icon";

import GlassCard from "@/components/common/glass-card";
import ResultPetalBadge from "@/components/common/result-petal-badge";
import ConfettiBurst from "@/components/courselearn/confetti";

export interface ExamFeedback {
  key: number;
  correct: boolean;
}

interface ExamQuestionCardProps {
  word: ExamContent;
  index: number;
  mode: ExamMode;
  phase: "idle" | "running" | "completed";
  scoring: ScoringMode;
  answer: AnswerState;
  active: boolean;
  submitting: boolean;
  maxAttempts: number;
  feedback?: ExamFeedback | null;
  dictationPlay: number;
  dictationPlayCount: number;
  dictationPlaying: boolean;
  speechRecording: boolean;
  speechRecognizing: boolean;
  onInput: (value: string) => void;
  onTextSubmit: () => void;
  onSpeech: () => void;
  onDictationRetry: () => void;
  onActivate: () => void;
}

export default function ExamQuestionCard({
  word,
  index,
  mode,
  phase,
  scoring,
  answer,
  active,
  submitting,
  maxAttempts,
  feedback,
  dictationPlay,
  dictationPlayCount,
  dictationPlaying,
  speechRecording,
  speechRecognizing,
  onInput,
  onTextSubmit,
  onSpeech,
  onDictationRetry,
  onActivate,
}: ExamQuestionCardProps) {
  const [shaking, setShaking] = useState(false);
  const running = phase === "running";
  const completed = phase === "completed";
  const dictationWaiting =
    running && active && !answer.completed && !dictationPlaying;
  const correct = completed
    ? word.isOk === true
    : running && scoring === "realtime"
      ? feedback
        ? feedback.correct
        : answer.completed
          ? answer.correct
          : undefined
      : undefined;

  useEffect(() => {
    if (feedback && !feedback.correct) setShaking(true);
  }, [feedback]);
  const resultBadge =
    completed && typeof word.isOk === "boolean"
      ? { key: word.id, correct: word.isOk }
      : feedback;
  const resultClass =
    correct === true
      ? "cl-card-correct"
      : correct === false
        ? "cl-card-wrong"
        : "";
  const standardAnswer = mode === "en-cn" ? word.cn : word.en;
  const primary =
    mode === "cn-en"
      ? word.cn
      : mode === "dictation" && !completed
        ? ""
        : word.en;
  const translation =
    mode === "cn-en" ? word.en : mode === "dictation" ? word.cn : word.cn;
  const inputDisabled =
    submitting ||
    (mode === "dictation" && (!active || answer.completed)) ||
    (running && scoring === "realtime" && answer.completed);

  return (
    <GlassCard
      className={`overflow-visible p-0 transition-shadow duration-300 ${
        active && running
          ? "shadow-lg shadow-accent/15 ring-2 ring-accent/30"
          : ""
      } ${shaking ? "cl-shake" : ""}`}
      data-glass-motion-ignore={shaking ? "" : undefined}
      onAnimationEnd={() => setShaking(false)}
      onClick={onActivate}
    >
      <ConfettiBurst fireKey={feedback?.correct ? feedback.key : 0} />
      <span className="sr-only" role="status">
        {correct === true ? "回答正确" : correct === false ? "回答错误" : ""}
      </span>
      {resultBadge ? (
        <ResultPetalBadge
          key={resultBadge.key}
          className="courselearn-result-badge"
          correct={resultBadge.correct}
        />
      ) : null}

      <div
        className={`relative z-[1] flex min-h-[160px] flex-col rounded-3xl p-3 ${resultClass}`}
      >
        <div className="flex min-h-6 items-center justify-end text-xs text-muted">
          {running ? (
            <span className="tabular-nums">
              {mode === "dictation"
                ? `已读 ${dictationPlay}/${dictationPlayCount}`
                : `已试 ${answer.attempts}/${maxAttempts}`}
            </span>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-2 pb-3 text-center">
          {primary ? (
            <span
              className={`${mode === "cn-en" ? "text-xl font-semibold" : "text-2xl font-bold"} break-words text-foreground`}
            >
              {primary}
            </span>
          ) : null}
          {completed ? (
            <span className="text-sm text-muted">{translation}</span>
          ) : null}

          {mode === "dictation" && !completed ? (
            <div className="flex flex-col items-center gap-2">
              <button
                aria-label="播放或重试听写发音"
                className={`cl-mic-btn disabled:cursor-not-allowed disabled:opacity-60 ${
                  dictationPlaying
                    ? "is-playing"
                    : dictationWaiting
                      ? "is-waiting"
                      : ""
                }`}
                disabled={
                  !running ||
                  !active ||
                  answer.completed ||
                  submitting ||
                  dictationPlay > 0
                }
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDictationRetry();
                }}
              >
                <ExamModeIcon
                  className={`size-6 ${
                    dictationPlaying
                      ? "cl-speaker-playing"
                      : dictationWaiting
                        ? "cl-speaker-waiting"
                        : ""
                  }`}
                  mode="dictation"
                />
              </button>
              {running ? (
                <span className="text-xs text-muted">
                  {dictationPlaying
                    ? `第 ${dictationPlay}/${dictationPlayCount} 次朗读`
                    : "请准备听写"}
                </span>
              ) : null}
            </div>
          ) : null}

          {mode === "speech" && running ? (
            <>
              <button
                aria-label={speechRecording ? "结束录音" : "开始语音识别"}
                className={`cl-mic-btn mt-1 disabled:cursor-not-allowed disabled:opacity-45 ${
                  speechRecording ? "is-recording" : ""
                }`}
                disabled={
                  submitting ||
                  !active ||
                  answer.completed ||
                  answer.attempts >= maxAttempts ||
                  speechRecognizing
                }
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSpeech();
                }}
              >
                {speechRecording ? (
                  <span aria-hidden="true" className="cl-wave">
                    <span />
                    <span />
                    <span />
                    <span />
                    <span />
                  </span>
                ) : (
                  <ExamModeIcon className="size-6" mode="speech" />
                )}
              </button>
              <span className="text-xs text-muted">
                {speechRecognizing
                  ? "正在识别…"
                  : speechRecording
                    ? "录音中，点击可提前结束"
                    : answer.attempts > 0 && !answer.completed
                      ? `还可尝试 ${maxAttempts - answer.attempts} 次`
                      : "点击麦克风朗读单词"}
              </span>
            </>
          ) : null}

          {running && mode !== "speech" ? (
            <div className="relative mt-1 w-full max-w-[240px]">
              <input
                aria-label={`第${index + 1}题答案`}
                autoComplete="off"
                className="w-full rounded-3xl border border-black/10 bg-white/40 px-8 py-2 text-center text-sm text-foreground outline-none transition-colors focus:border-accent/40 focus:bg-white/60 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:focus:bg-white/10"
                disabled={inputDisabled}
                placeholder={
                  mode === "en-cn"
                    ? "输入中文释义，空格提交"
                    : mode === "cn-en"
                      ? "输入英文单词，空格提交"
                      : "听到后输入单词"
                }
                spellCheck={false}
                type="text"
                value={answer.value}
                onChange={(event) => onInput(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (mode === "dictation" || event.nativeEvent.isComposing)
                    return;
                  if (event.key === " ") {
                    event.preventDefault();
                    if (!inputDisabled) {
                      if (feedback && !feedback.correct) onInput("");
                      else onTextSubmit();
                    }
                  }
                }}
              />
              {mode !== "dictation" && answer.value && !inputDisabled ? (
                <button
                  aria-label="清空输入"
                  className="absolute right-2 top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-full bg-black/10 text-muted transition-colors hover:bg-black/20 hover:text-foreground dark:bg-white/10 dark:hover:bg-white/20"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onInput("");
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                >
                  <Xmark className="size-3" />
                </button>
              ) : null}
            </div>
          ) : null}

          {completed ? (
            <div className="mt-1 flex max-w-full flex-col items-center gap-1 text-xs">
              <span className="break-words text-foreground/85">
                正确答案：<strong>{standardAnswer}</strong>
              </span>
              {word.isOk === false ? (
                <span className="break-words text-danger">
                  你的答案：{word.answer || "未作答"}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </GlassCard>
  );
}
