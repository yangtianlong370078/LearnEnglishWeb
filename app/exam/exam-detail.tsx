"use client";

import type {
  AnswerState,
  ExamContent,
  ExamDetail,
  ExamMode,
  ExamModeCount,
  ExamSession,
} from "./types";
import type { ExamFeedback } from "./exam-question-card";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClockArrowRotateLeft, Gear, Play } from "@gravity-ui/icons";
import { Button, Spinner, toast } from "@heroui/react";

import { examApi } from "./api";
import ExamModeIcon from "./mode-icon";
import ExamQuestionCard from "./exam-question-card";
import ExamSettingsModal from "./exam-settings-modal";
import { ExamConfirmModal, StartExamModal } from "./exam-modals";
import { useExamSpeech } from "./use-exam-speech";
import { useExamSettings } from "./use-exam-settings";
import {
  EXAM_MODES,
  EXAM_MODE_META,
  emptyAnswer,
  errorMessage,
  formatRemaining,
  isAnswerCorrect,
  scoreOf,
} from "./utils";

import {
  buildAudioUrl,
  getAudioDurationMs,
} from "@/components/courselearn/lib";
import GlassCard from "@/components/common/glass-card";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function playOnce(audio: HTMLAudioElement, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
    const handleEnded = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("发音播放失败，请检查网络后点击喇叭重试"));
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);
    if (audio.src !== url) audio.src = url;
    try {
      audio.currentTime = 0;
    } catch {
      // 音频元数据尚未就绪时，play 会自动从起点播放。
    }
    void audio.play().catch(handleError);
  });
}

const SCORE_PETAL_PATH =
  "M52 3C55.93 3 59.69 6.96 63.78 8.05C67.86 9.14 73.1 7.6 76.5 9.56C79.9 11.53 81.18 16.84 84.17 19.83C87.16 22.82 92.47 24.1 94.44 27.5C96.4 30.9 94.86 36.14 95.95 40.22C97.04 44.31 101 48.07 101 52C101 55.93 97.04 59.69 95.95 63.78C94.86 67.86 96.4 73.1 94.44 76.5C92.47 79.9 87.16 81.18 84.17 84.17C81.18 87.16 79.9 92.47 76.5 94.44C73.1 96.4 67.86 94.86 63.78 95.95C59.69 97.04 55.93 101 52 101C48.07 101 44.31 97.04 40.22 95.95C36.14 94.86 30.9 96.4 27.5 94.44C24.1 92.47 22.82 87.16 19.83 84.17C16.84 81.18 11.53 79.9 9.56 76.5C7.6 73.1 9.14 67.86 8.05 63.78C6.96 59.69 3 55.93 3 52C3 48.07 6.96 44.31 8.05 40.22C9.14 36.14 7.6 30.9 9.56 27.5C11.53 24.1 16.84 22.82 19.83 19.83C22.82 16.84 24.1 11.53 27.5 9.56C30.9 7.6 36.14 9.14 40.22 8.05C44.31 6.96 48.07 3 52 3Z";

const SCORE_BADGE_TONES = {
  neutral: {
    petalColors: ["#94a3b8", "#f8fafc", "#a8b3c2", "#e2e8f0", "#94a3b8"],
    glow: "rgba(100, 116, 139, 0.22)",
    accent: "#94a3b8",
    text: "text-slate-600 dark:text-slate-300",
  },
  low: {
    petalColors: ["#8f3047", "#f3b3bd", "#c4566d", "#fff0f2", "#8f3047"],
    glow: "rgba(190, 74, 98, 0.3)",
    accent: "#c4566d",
    text: "text-[#9f354e] dark:text-[#ffb3c0]",
  },
  medium: {
    petalColors: ["#9a661f", "#f7dfa4", "#c4933f", "#fff4cf", "#9a661f"],
    glow: "rgba(196, 147, 63, 0.3)",
    accent: "#c4933f",
    text: "text-[#8a5a17] dark:text-[#f5d58a]",
  },
  high: {
    petalColors: ["#176f63", "#b8ead9", "#3b9b83", "#e3fff3", "#176f63"],
    glow: "rgba(59, 155, 131, 0.3)",
    accent: "#3b9b83",
    text: "text-[#167264] dark:text-[#8fe0c6]",
  },
} as const;

function CurrentScoreBadge({ score }: { score: number | null }) {
  const toneName =
    score === null
      ? "neutral"
      : score < 60
        ? "low"
        : score < 80
          ? "medium"
          : "high";
  const tone = SCORE_BADGE_TONES[toneName];

  return (
    <div
      aria-atomic="true"
      aria-label={
        score === null
          ? "当前分数暂未显示"
          : `当前分数 ${score} 分，满分 100 分`
      }
      aria-live="polite"
      className="relative grid size-[104px] shrink-0 place-items-center"
      role="status"
    >
      <svg
        aria-hidden="true"
        className="absolute inset-2 size-[88px] opacity-70 blur-xl"
        viewBox="0 0 104 104"
      >
        <path d={SCORE_PETAL_PATH} fill={tone.glow} />
      </svg>
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full overflow-visible drop-shadow-[0_8px_6px_rgba(15,23,42,0.14)]"
        viewBox="0 0 104 104"
      >
        <defs>
          <linearGradient
            gradientUnits="userSpaceOnUse"
            id={`score-petal-gradient-${toneName}`}
            x1="16"
            x2="88"
            y1="10"
            y2="96"
          >
            {tone.petalColors.map((color, index) => (
              <stop
                key={`${color}-${index}`}
                offset={index / (tone.petalColors.length - 1)}
                stopColor={color}
              />
            ))}
          </linearGradient>
        </defs>
        <path
          d={SCORE_PETAL_PATH}
          fill={`url(#score-petal-gradient-${toneName})`}
        />
        <g transform="translate(52 52) scale(0.94) translate(-52 -52)">
          <path
            className="fill-white/95 stroke-white/80 dark:fill-[#17181c] dark:stroke-white/10"
            d={SCORE_PETAL_PATH}
            strokeWidth="1"
          />
        </g>
        <g transform="translate(52 52) scale(0.82) translate(-52 -52)">
          <path
            d={SCORE_PETAL_PATH}
            fill="none"
            stroke={tone.accent}
            strokeDasharray="2 3"
            strokeLinecap="round"
            strokeOpacity="0.3"
            strokeWidth="0.8"
          />
        </g>
      </svg>
      <svg
        aria-hidden="true"
        className="absolute right-[13px] top-[11px] size-3 opacity-80"
        viewBox="0 0 12 12"
      >
        <path
          d="M6 0C6.7 3.6 8.4 5.3 12 6C8.4 6.7 6.7 8.4 6 12C5.3 8.4 3.6 6.7 0 6C3.6 5.3 5.3 3.6 6 0Z"
          fill={tone.accent}
        />
      </svg>
      <div className="relative flex flex-col items-center text-center">
        <span className="text-[10px] font-medium tracking-[0.16em] text-muted">
          当前分数
        </span>
        <div className={`mt-1 flex items-baseline ${tone.text}`}>
          <span className="text-[34px] font-bold leading-none tracking-[-0.04em] tabular-nums">
            {score ?? "-"}
          </span>
          {score !== null ? (
            <span className="ml-1 text-[10px] font-semibold">分</span>
          ) : null}
        </div>
        <span
          aria-hidden="true"
          className="mt-1.5 h-px w-5 opacity-60"
          style={{ background: tone.accent }}
        />
        <span className="mt-1 text-[9px] font-medium tracking-wider text-muted">
          满分 100
        </span>
      </div>
    </div>
  );
}

export default function ExamDetailPage({
  examId,
  initialMode = "en-cn",
}: {
  examId: number;
  initialMode?: ExamMode;
}) {
  const router = useRouter();
  const {
    settings,
    setAccent,
    setDictationPlayCount,
    setRetryCount,
    setAsrModelType,
  } = useExamSettings();
  const speech = useExamSpeech();
  const [exam, setExam] = useState<ExamDetail | null>(null);
  const [items, setItems] = useState<ExamContent[]>([]);
  const [mode, setMode] = useState<ExamMode>(initialMode);
  const [contentCompleted, setContentCompleted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [startOpen, setStartOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedback, setFeedback] = useState<Record<number, ExamFeedback>>({});
  const [dictation, setDictation] = useState({
    itemId: 0,
    play: 0,
    playing: false,
  });

  const itemsRef = useRef<ExamContent[]>([]);
  const answersRef = useRef<Record<number, AnswerState>>({});
  const currentIndexRef = useRef(0);
  const sessionRef = useRef<ExamSession | null>(null);
  const modeRef = useRef<ExamMode>(initialMode);
  const submittingRef = useRef(false);
  const autoSubmitRef = useRef(false);
  const contentRequestRef = useRef(0);
  const dictationRunRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const submitExamRef = useRef<(auto?: boolean) => Promise<void>>(
    async () => {},
  );
  const runDictationRef = useRef<
    (index: number, config: ExamSession) => Promise<void>
  >(async () => {});

  itemsRef.current = items;
  answersRef.current = answers;
  currentIndexRef.current = currentIndex;
  sessionRef.current = session;
  modeRef.current = mode;
  submittingRef.current = submitting;

  const updateAnswer = useCallback((id: number, value: AnswerState) => {
    answersRef.current = { ...answersRef.current, [id]: value };
    setAnswers(answersRef.current);
  }, []);

  const showFeedback = useCallback((id: number, correct: boolean) => {
    setFeedback((previous) => ({
      ...previous,
      [id]: { key: Date.now() + id, correct },
    }));
  }, []);

  const loadContent = useCallback(
    async (nextMode: ExamMode) => {
      const requestId = ++contentRequestRef.current;

      setContentLoading(true);
      setError(null);
      setItems([]);
      setContentCompleted(false);
      setAnswers({});
      answersRef.current = {};
      try {
        const response = await examApi.content(
          examId,
          EXAM_MODE_META[nextMode].type,
        );

        if (contentRequestRef.current !== requestId) return;
        setItems(response.data);
        setContentCompleted(response.completed || response.isexam);
        setAnswers({});
        setCurrentIndex(0);
        setFeedback({});
      } catch (reason) {
        if (contentRequestRef.current === requestId)
          setError(errorMessage(reason));
      } finally {
        if (contentRequestRef.current === requestId) setContentLoading(false);
      }
    },
    [examId],
  );

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, content] = await Promise.all([
        examApi.detail(examId),
        examApi.content(examId, EXAM_MODE_META[initialMode].type),
      ]);

      setExam(detail);
      setItems(content.data);
      setContentCompleted(content.completed || content.isexam);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [examId, initialMode]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const changeMode = (nextMode: ExamMode) => {
    if (session || starting || nextMode === mode) return;
    speech.cancel();
    dictationRunRef.current += 1;
    audioRef.current?.pause();
    modeRef.current = nextMode;
    setMode(nextMode);
    void loadContent(nextMode);
  };

  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const seconds = Math.max(
        0,
        Math.ceil((session.deadline - Date.now()) / 1000),
      );

      setRemaining(seconds);
      if (seconds === 0 && !autoSubmitRef.current) {
        autoSubmitRef.current = true;
        void submitExamRef.current(true);
      }
    };

    tick();
    const timer = setInterval(tick, 1000);

    return () => clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    window.addEventListener("beforeunload", beforeUnload);

    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    cardRefs.current[currentIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    if (mode !== "speech") {
      requestAnimationFrame(() => {
        cardRefs.current[currentIndex]?.querySelector("input")?.focus();
      });
    }
  }, [currentIndex, session]);

  useEffect(() => {
    return () => {
      dictationRunRef.current += 1;
      contentRequestRef.current += 1;
      audioRef.current?.pause();
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, []);

  const liveScore = useMemo(() => {
    const correct = items.filter(
      (item) => answers[item.id]?.correct === true,
    ).length;

    return scoreOf(correct, items.length);
  }, [answers, items]);

  const advanceAfterAudio = useCallback(
    (index: number, config: ExamSession) => {
      if (index >= itemsRef.current.length - 1) {
        void submitExamRef.current(true);

        return;
      }

      setCurrentIndex(index + 1);
      if (modeRef.current === "dictation") {
        void runDictationRef.current(index + 1, config);
      }
    },
    [],
  );

  const runDictation = useCallback(
    async (index: number, config: ExamSession) => {
      const item = itemsRef.current[index];

      if (!item || !sessionRef.current) return;
      const runId = ++dictationRunRef.current;
      const url = buildAudioUrl(encodeURIComponent(item.en), settings.accent);
      const duration = await getAudioDurationMs(url);

      if (!audioRef.current) audioRef.current = new Audio();
      const audio = audioRef.current;

      try {
        for (let play = 1; play <= settings.dictationPlayCount; play += 1) {
          if (dictationRunRef.current !== runId || !sessionRef.current) return;
          setDictation({ itemId: item.id, play, playing: true });
          await playOnce(audio, url);
          if (dictationRunRef.current !== runId || !sessionRef.current) return;
          setDictation({ itemId: item.id, play, playing: false });
          await wait(duration + 1000);
        }
      } catch (reason) {
        if (dictationRunRef.current === runId && sessionRef.current) {
          setDictation({ itemId: 0, play: 0, playing: false });
          toast.danger(errorMessage(reason));
        }

        return;
      }

      if (dictationRunRef.current !== runId || !sessionRef.current) return;
      const answer = answersRef.current[item.id] ?? emptyAnswer();
      const correct = isAnswerCorrect("dictation", item, answer);

      updateAnswer(item.id, { ...answer, completed: true, correct });
      if (config.scoring === "realtime") showFeedback(item.id, correct);
      setDictation({ itemId: 0, play: 0, playing: false });
      await wait(350);
      if (sessionRef.current) advanceAfterAudio(index, config);
    },
    [
      advanceAfterAudio,
      settings.accent,
      settings.dictationPlayCount,
      showFeedback,
      updateAnswer,
    ],
  );

  runDictationRef.current = runDictation;

  const submitExam = useCallback(
    async (auto = false) => {
      const config = sessionRef.current;

      if (!config || submittingRef.current) return;

      setSubmitConfirm(false);
      setSubmitting(true);
      submittingRef.current = true;
      dictationRunRef.current += 1;
      audioRef.current?.pause();
      speech.cancel();
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);

      const currentItems = itemsRef.current;
      const currentAnswers = answersRef.current;
      const currentMode = modeRef.current;
      const correctCount = currentItems.filter((item) =>
        isAnswerCorrect(currentMode, item, currentAnswers[item.id]),
      ).length;
      const wrongAnswers = currentItems
        .filter(
          (item) =>
            !isAnswerCorrect(currentMode, item, currentAnswers[item.id]),
        )
        .map((item) => {
          const answer = currentAnswers[item.id];

          return {
            examdetailid: item.id,
            answer:
              currentMode === "speech"
                ? answer?.attempts
                  ? "发音未通过"
                  : "未作答"
                : (answer?.value ?? ""),
          };
        });

      try {
        await examApi.submit(
          examId,
          EXAM_MODE_META[currentMode].type,
          config.duration,
          scoreOf(correctCount, currentItems.length),
          wrongAnswers,
        );
      } catch (reason) {
        toast.danger(errorMessage(reason));
        submittingRef.current = false;
        setSubmitting(false);
        if (currentMode === "dictation" && sessionRef.current) {
          void runDictationRef.current(currentIndexRef.current, config);
        }

        return;
      }

      // 交卷成功后立即结束本地考试，成绩刷新失败也不能诱导用户重复提交。
      sessionRef.current = null;
      setSession(null);
      setContentCompleted(true);
      setContentLoading(true);
      setItems([]);
      itemsRef.current = [];
      setAnswers({});
      answersRef.current = {};
      setCurrentIndex(0);
      setFeedback({});
      setDictation({ itemId: 0, play: 0, playing: false });
      toast.success(auto ? "已自动交卷" : "交卷成功");

      try {
        const [detail, content] = await Promise.all([
          examApi.detail(examId),
          examApi.content(examId, EXAM_MODE_META[currentMode].type),
        ]);

        setExam(detail);
        setItems(content.data);
      } catch {
        setError("交卷已成功，但成绩刷新失败，请点击重新加载");
      } finally {
        setContentLoading(false);
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [examId, speech],
  );

  submitExamRef.current = submitExam;

  const startExam = async (
    scoring: "realtime" | "onSubmit",
    duration: number,
  ) => {
    if (!exam || items.length === 0) return;
    setStarting(true);
    try {
      if (contentCompleted) {
        await examApi.restart(examId, EXAM_MODE_META[mode].type);
      }

      speech.cancel();
      dictationRunRef.current += 1;
      const initialAnswers = Object.fromEntries(
        items.map((item) => [item.id, emptyAnswer()]),
      );
      const config: ExamSession = {
        scoring,
        duration,
        deadline: Date.now() + duration * 60_000,
      };

      answersRef.current = initialAnswers;
      sessionRef.current = config;
      autoSubmitRef.current = false;
      setAnswers(initialAnswers);
      setSession(config);
      setContentCompleted(false);
      setCurrentIndex(0);
      setRemaining(duration * 60);
      setFeedback({});
      setStartOpen(false);
      if (mode === "dictation") void runDictationRef.current(0, config);
    } catch (reason) {
      toast.danger(errorMessage(reason));
    } finally {
      setStarting(false);
    }
  };

  const validateText = (item: ExamContent, index: number) => {
    const config = sessionRef.current;
    const answer = answersRef.current[item.id];

    if (!config || !answer?.value.trim()) return;
    if (config.scoring === "realtime" && answer.completed) return;

    const correct = isAnswerCorrect(mode, item, answer);
    const attempts = (answer.attempts ?? 0) + 1;
    const completed = correct || attempts >= settings.retryCount;

    updateAnswer(item.id, { ...answer, completed, correct, attempts });
    if (config.scoring === "realtime") showFeedback(item.id, correct);
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);

    // 只有完成（正确或达到最大重试次数）才自动跳转下一题
    if (completed && index < itemsRef.current.length - 1) {
      advanceTimerRef.current = setTimeout(
        () => setCurrentIndex(index + 1),
        300,
      );
    }
  };

  const recognizeSpeech = async (item: ExamContent, index: number) => {
    const config = sessionRef.current;
    const answer = answersRef.current[item.id] ?? emptyAnswer();

    if (
      !config ||
      index !== currentIndex ||
      answer.completed ||
      answer.attempts >= settings.retryCount
    )
      return;
    if (speech.isRecording) {
      speech.stopRecording();

      return;
    }

    let correct = false;

    try {
      const result = await speech.recognize(
        item.en,
        settings.accent,
        settings.asrModelType,
      );

      if (result === null) return;
      correct = result;
    } catch (reason) {
      toast.danger(errorMessage(reason));

      return;
    }

    if (!sessionRef.current || modeRef.current !== "speech") return;
    const latest = answersRef.current[item.id] ?? answer;
    const attempts = latest.attempts + 1;
    const completed = correct || attempts >= settings.retryCount;

    updateAnswer(item.id, { ...latest, correct, attempts, completed });
    if (config.scoring === "realtime") showFeedback(item.id, correct);
    if (completed) {
      await wait(400);
      if (sessionRef.current) advanceAfterAudio(index, config);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error && !exam) {
    return (
      <GlassCard className="mx-auto max-w-xl p-10 text-center">
        <div className="relative z-[1] flex flex-col items-center gap-4">
          <p className="text-danger" role="alert">
            {error}
          </p>
          <Button onPress={() => void loadPage()}>重新加载</Button>
        </div>
      </GlassCard>
    );
  }

  if (!exam) return null;

  const meta = EXAM_MODE_META[mode];
  const modeCount = exam[meta.countKey] as ExamModeCount;
  const completed = contentCompleted || modeCount.isCompleted;
  const savedScore = exam[meta.scoreKey] as number;
  const phase = session ? "running" : completed ? "completed" : "idle";
  const shownScore = session
    ? session.scoring === "realtime"
      ? liveScore
      : null
    : completed
      ? Math.floor(savedScore)
      : null;

  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-5"
      data-glass-navigation-content=""
    >
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" onPress={() => router.push("/exam")}>
          <ArrowLeft className="size-4" />
          返回试题
        </Button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">{exam.count} 个单词</span>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => setSettingsOpen(true)}
          >
            <Gear className="size-4" />
          </Button>
        </div>
      </div>

      <GlassCard className="p-4 md:p-5">
        <div className="relative z-[1] flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <h1 className="mb-4 text-xl font-bold text-foreground">
              {exam.name}
            </h1>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {EXAM_MODES.map((itemMode) => {
                const itemMeta = EXAM_MODE_META[itemMode];
                const active = itemMode === mode;

                return (
                  <button
                    key={itemMode}
                    aria-pressed={active}
                    className={`flex items-center justify-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed ${
                      active
                        ? "border-white/60 text-white shadow-md ring-1 ring-black/5 dark:ring-white/20"
                        : "border-black/10 bg-white/40 text-foreground hover:bg-white/65 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                    } ${session && !active ? "opacity-40" : ""}`}
                    disabled={Boolean(session) || starting}
                    style={
                      active
                        ? {
                            background: `linear-gradient(135deg, ${itemMeta.theme.from}, ${itemMeta.theme.to})`,
                          }
                        : undefined
                    }
                    title={session ? "交卷后才能切换模式" : itemMeta.label}
                    type="button"
                    onClick={() => changeMode(itemMode)}
                  >
                    <ExamModeIcon className="size-4 shrink-0" mode={itemMode} />
                    {itemMeta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 xl:justify-end">
            <CurrentScoreBadge score={shownScore} />
            {session ? (
              <div className="flex flex-col items-end gap-2">
                <span
                  className={`rounded-full bg-black/[0.05] px-3 py-1.5 text-sm font-semibold tabular-nums dark:bg-white/[0.07] ${remaining <= 60 ? "text-danger" : "text-foreground"}`}
                >
                  倒计时 {formatRemaining(remaining)}
                </span>
                <Button
                  isDisabled={submitting}
                  isPending={submitting}
                  onPress={() => setSubmitConfirm(true)}
                >
                  交卷
                </Button>
              </div>
            ) : (
              <Button
                isDisabled={contentLoading || items.length === 0}
                onPress={() => setStartOpen(true)}
              >
                {completed ? (
                  <ClockArrowRotateLeft className="size-4" />
                ) : (
                  <Play className="size-4" />
                )}
                {completed ? "重考" : "开始考试"}
              </Button>
            )}
          </div>
        </div>
      </GlassCard>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted">
        <span>
          {session
            ? `${session.scoring === "realtime" ? "实时计算" : "交卷后计算"} · ${meta.label}模式已锁定`
            : completed
              ? "已交卷，显示答案与对错"
              : `默认考试时长 ${exam.limitTime} 分钟`}
        </span>
        {session ? (
          <span>
            第 {Math.min(currentIndex + 1, items.length)} / {items.length} 题
            {mode === "speech" || mode === "dictation"
              ? " · 全部完成自动交卷"
              : ""}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="flex flex-wrap items-center gap-3 px-1">
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
          {!session && !contentLoading && items.length === 0 ? (
            <Button
              size="sm"
              variant="secondary"
              onPress={() => {
                setError(null);
                void loadContent(mode);
                void examApi
                  .detail(examId)
                  .then(setExam)
                  .catch(() => undefined);
              }}
            >
              重新加载
            </Button>
          ) : null}
        </div>
      ) : null}
      {contentLoading ? (
        <div className="flex min-h-56 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : items.length === 0 ? (
        <GlassCard className="p-10 text-center">
          <p className="relative z-[1] text-sm text-muted">
            该模式下暂无试题内容
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              ref={(element) => {
                cardRefs.current[index] = element;
              }}
            >
              <ExamQuestionCard
                active={index === currentIndex}
                answer={answers[item.id] ?? emptyAnswer()}
                dictationPlay={
                  dictation.itemId === item.id ? dictation.play : 0
                }
                dictationPlayCount={settings.dictationPlayCount}
                dictationPlaying={
                  dictation.itemId === item.id && dictation.playing
                }
                feedback={feedback[item.id]}
                index={index}
                maxAttempts={settings.retryCount}
                mode={mode}
                phase={phase}
                scoring={session?.scoring ?? "realtime"}
                speechRecognizing={
                  speech.isRecognizing && index === currentIndex
                }
                speechRecording={speech.isRecording && index === currentIndex}
                submitting={submitting}
                word={item}
                onActivate={() => {
                  if (session && mode !== "dictation" && mode !== "speech")
                    setCurrentIndex(index);
                }}
                onDictationRetry={() => {
                  const config = sessionRef.current;

                  if (config) void runDictationRef.current(index, config);
                }}
                onInput={(value) => {
                  const previous = answersRef.current[item.id] ?? emptyAnswer();

                  updateAnswer(item.id, { ...previous, value });
                }}
                onSpeech={() => void recognizeSpeech(item, index)}
                onTextSubmit={() => validateText(item, index)}
              />
            </div>
          ))}
        </div>
      )}

      <StartExamModal
        defaultDuration={exam.limitTime}
        isOpen={startOpen}
        restarting={completed}
        starting={starting}
        onConfirm={(scoring, duration) => void startExam(scoring, duration)}
        onOpenChange={setStartOpen}
      />
      <ExamConfirmModal
        confirmText="确认交卷"
        description="交卷后将显示本题型的最终分数与答案，之后才能切换其他模式。未作答题目按错误计算。"
        isOpen={submitConfirm}
        pending={submitting}
        title="确认交卷"
        onConfirm={() => void submitExamRef.current(false)}
        onOpenChange={setSubmitConfirm}
      />
      <ExamSettingsModal
        isOpen={settingsOpen}
        settings={settings}
        onAccentChange={setAccent}
        onAsrModelChange={setAsrModelType}
        onDictationPlayCountChange={setDictationPlayCount}
        onOpenChange={setSettingsOpen}
        onRetryCountChange={setRetryCount}
      />
    </div>
  );
}
