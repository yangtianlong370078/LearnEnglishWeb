"use client";

import type { ListeningLesson, ListeningLrcDocument } from "@/types/listening";

import { ArrowLeft, CircleExclamation } from "@gravity-ui/icons";
import { Button, Spinner } from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import GlassCard from "@/components/common/glass-card";
import LessonDrawer from "@/components/listening/lesson-drawer";
import LessonList from "@/components/listening/lesson-list";
import ListeningHeader from "@/components/listening/listening-header";
import {
  findCurrentLineIndex,
  findFirstContentIndex,
  getLineEnd,
  parseLrc,
} from "@/components/listening/lrc";
import LrcView from "@/components/listening/lrc-view";
import PlayerControls from "@/components/listening/player-controls";
import ListeningSettingsModal from "@/components/listening/settings-modal";
import { useListeningSettings } from "@/components/listening/use-listening-settings";
import { saveRecentListening } from "@/components/listening/use-recent-listening";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { listeningApi } from "@/lib/api";

function errorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error && reason.message ? reason.message : fallback;
}

function ListeningLearnClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const favoritesMode = searchParams.get("scope") === "favorites";
  const subCourseId = useMemo(() => {
    const value = Number(searchParams.get("subCourseId"));

    return Number.isInteger(value) && value > 0 ? value : 0;
  }, [searchParams]);
  const requestedLessonId = useMemo(() => {
    const value = Number(searchParams.get("lessonId"));

    return Number.isInteger(value) && value > 0 ? value : 0;
  }, [searchParams]);
  const parentCourseId = useMemo(() => {
    const value = Number(searchParams.get("courseId"));

    return Number.isInteger(value) && value > 0 ? value : 0;
  }, [searchParams]);
  const courseName = searchParams.get("name")?.trim() || "听力学习";
  const parentCourseName = searchParams.get("courseName")?.trim() || "听力课程";
  const { settings, updateSettings } = useListeningSettings();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const [lessons, setLessons] = useState<ListeningLesson[]>([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [lessonsError, setLessonsError] = useState<string | null>(null);
  const [lessonsReloadVersion, setLessonsReloadVersion] = useState(0);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [favoritePendingLessonId, setFavoritePendingLessonId] = useState<
    number | null
  >(null);
  const [favoriteActionError, setFavoriteActionError] = useState<string | null>(
    null,
  );

  const [lrcDocument, setLrcDocument] = useState<ListeningLrcDocument | null>(
    null,
  );
  const [lrcLoading, setLrcLoading] = useState(false);
  const [lrcError, setLrcError] = useState<string | null>(null);
  const [lrcReloadVersion, setLrcReloadVersion] = useState(0);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileLessonsOpen, setMobileLessonsOpen] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const playbackRafRef = useRef<number | null>(null);
  const pendingAutoPlayRef = useRef(false);
  const singleAwaitingRef = useRef<number | null>(null);
  const introAppliedForRef = useRef<number | null>(null);
  const shadowTimerRef = useRef<number | null>(null);
  const shadowTargetIndexRef = useRef<number | null>(null);
  const shadowCompletedRef = useRef(0);
  const shadowPendingRef = useRef(false);
  const shadowGenerationRef = useRef(0);

  const clearShadowTimer = useCallback(() => {
    shadowGenerationRef.current += 1;
    shadowPendingRef.current = false;
    if (shadowTimerRef.current !== null) {
      window.clearTimeout(shadowTimerRef.current);
      shadowTimerRef.current = null;
    }
  }, []);

  const resetShadow = useCallback(() => {
    clearShadowTimer();
    shadowCompletedRef.current = 0;
  }, [clearShadowTimer]);

  const returnToCourses = useCallback(() => {
    pendingAutoPlayRef.current = false;
    singleAwaitingRef.current = null;
    clearShadowTimer();

    const audio = audioRef.current;

    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }

    setPlaying(false);
    router.push("/listening");
  }, [clearShadowTimer, router]);

  useEffect(() => {
    if (isDesktop) setMobileLessonsOpen(false);
  }, [isDesktop]);

  const currentLessonIndex = lessons.findIndex(
    (lesson) => lesson.id === selectedLessonId,
  );
  const currentLesson =
    currentLessonIndex >= 0 ? lessons[currentLessonIndex] : null;
  const currentLessonId = currentLesson?.id ?? null;
  const previousLesson =
    currentLessonIndex > 0 ? lessons[currentLessonIndex - 1] : null;
  const nextLesson =
    currentLessonIndex >= 0 && currentLessonIndex < lessons.length - 1
      ? lessons[currentLessonIndex + 1]
      : null;
  const lines = useMemo(() => lrcDocument?.lines ?? [], [lrcDocument]);
  const audioSrc = currentLesson
    ? listeningApi.getAudioUrl(currentLesson.subCourseId, currentLesson.id)
    : "";

  useEffect(() => {
    let ignore = false;

    pendingAutoPlayRef.current = false;
    setSelectedLessonId(null);
    setLessons([]);
    setLrcDocument(null);
    setFavoriteActionError(null);

    if (!favoritesMode && !subCourseId) {
      setLessonsLoading(false);
      setLessonsError("缺少有效的子课程编号");

      return () => {
        ignore = true;
      };
    }

    setLessonsLoading(true);
    setLessonsError(null);
    const request = favoritesMode
      ? listeningApi.getFavorites()
      : listeningApi.getLessons(subCourseId);

    request
      .then((data) => {
        if (ignore) return;
        const ordered = favoritesMode
          ? data
          : [...data].sort(
              (first, second) =>
                first.sortOrder - second.sortOrder || first.id - second.id,
            );
        const initialLesson =
          ordered.find((lesson) => lesson.id === requestedLessonId) ??
          ordered[0];

        setLessons(ordered);
        setSelectedLessonId(initialLesson?.id ?? null);
      })
      .catch((reason: unknown) => {
        if (ignore) return;
        setLessonsError(
          errorMessage(
            reason,
            favoritesMode ? "收藏章节加载失败" : "章节加载失败",
          ),
        );
      })
      .finally(() => {
        if (!ignore) setLessonsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [favoritesMode, requestedLessonId, subCourseId, lessonsReloadVersion]);

  useEffect(() => {
    let ignore = false;

    if (!currentLessonId) {
      setLrcDocument(null);
      setLrcError(null);
      setLrcLoading(false);

      return () => {
        ignore = true;
      };
    }

    setLrcLoading(true);
    setLrcError(null);
    setLrcDocument(null);
    listeningApi
      .getLessonLrc(currentLessonId)
      .then((text) => {
        if (!ignore) setLrcDocument(parseLrc(text));
      })
      .catch((reason: unknown) => {
        if (!ignore) setLrcError(errorMessage(reason, "LRC 字幕加载失败"));
      })
      .finally(() => {
        if (!ignore) setLrcLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [currentLessonId, lrcReloadVersion]);

  useEffect(() => {
    singleAwaitingRef.current = null;
    introAppliedForRef.current = null;
    shadowTargetIndexRef.current = null;
    resetShadow();
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setCurrentLineIndex(0);
    setPlayerError(null);
  }, [selectedLessonId, resetShadow]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) return;

    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, [audioSrc]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = settings.playbackRate;
    }
  }, [settings.playbackRate, audioSrc]);

  useEffect(() => {
    return () => resetShadow();
  }, [resetShadow]);

  useEffect(() => {
    singleAwaitingRef.current = null;
    shadowTargetIndexRef.current = null;
    resetShadow();
  }, [settings.mode, resetShadow]);

  useEffect(() => {
    if (settings.mode !== "shadow" || lines.length === 0) return;

    const firstContentIndex = findFirstContentIndex(lines);
    const start = lines[firstContentIndex]?.start ?? 0;
    const audio = audioRef.current;

    shadowTargetIndexRef.current = firstContentIndex;
    shadowCompletedRef.current = 0;
    if (audio && Number.isFinite(audio.duration)) audio.currentTime = start;
    setCurrentTime(start);
    setCurrentLineIndex(firstContentIndex);
  }, [lines, settings.mode]);

  const seekTo = useCallback(
    (time: number) => {
      const audio = audioRef.current;
      const audioDuration = audio?.duration;
      const upperBound =
        typeof audioDuration === "number" && Number.isFinite(audioDuration)
          ? audioDuration
          : Number.POSITIVE_INFINITY;
      const nextTime = Math.max(0, Math.min(time, upperBound));

      const lineIndex = findCurrentLineIndex(lines, nextTime);

      singleAwaitingRef.current = null;
      resetShadow();
      if (settings.mode === "shadow") {
        shadowTargetIndexRef.current = Math.max(0, lineIndex);
      }
      if (audio) audio.currentTime = nextTime;
      setCurrentTime(nextTime);
      setCurrentLineIndex(lineIndex);
    },
    [lines, resetShadow, settings.mode],
  );

  const safePlay = useCallback(async () => {
    const audio = audioRef.current;

    if (!audio || !currentLesson) return;

    setPlayerError(null);
    try {
      await audio.play();
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError")
        return;
      setPlaying(false);
      setPlayerError(
        errorMessage(reason, "无法播放音频，请检查浏览器播放权限或音频服务"),
      );
    }
  }, [currentLesson]);

  const getShadowSegment = useCallback(
    (index: number) => {
      const start = lines[index]?.start ?? 0;
      const nextStart = lines[index + 1]?.start;
      const rawEnd = nextStart ?? duration;
      const end =
        nextStart === undefined ? rawEnd : Math.max(start, rawEnd - 0.01);

      return { start, end };
    },
    [duration, lines],
  );

  const queueShadowReplay = useCallback(
    (delaySeconds: number, restartTime: number) => {
      clearShadowTimer();
      const generation = shadowGenerationRef.current;

      shadowTimerRef.current = window.setTimeout(
        () => {
          shadowTimerRef.current = null;
          if (generation !== shadowGenerationRef.current) return;

          const audio = audioRef.current;
          const targetIndex = shadowTargetIndexRef.current;

          if (!audio || targetIndex === null) return;
          shadowPendingRef.current = false;
          audio.currentTime = Math.max(0, restartTime);
          setCurrentTime(Math.max(0, restartTime));
          setCurrentLineIndex(targetIndex);
          void safePlay();
        },
        Math.max(0, delaySeconds) * 1000,
      );
    },
    [clearShadowTimer, safePlay],
  );

  const handleShadowSegmentEnd = useCallback(() => {
    const currentIndex = shadowTargetIndexRef.current;

    if (currentIndex === null || lines.length === 0) return;

    clearShadowTimer();
    const { start, end } = getShadowSegment(currentIndex);
    const sentenceDuration = Math.max(0, end - start);
    const replayGap = sentenceDuration + settings.shadowGap;
    const completed = shadowCompletedRef.current + 1;

    if (completed < settings.shadowRepeatCount) {
      shadowCompletedRef.current = completed;
      queueShadowReplay(replayGap, start);

      return;
    }

    shadowCompletedRef.current = 0;
    const nextIndex = currentIndex + 1;

    if (nextIndex < lines.length) {
      shadowTargetIndexRef.current = nextIndex;
      setCurrentLineIndex(nextIndex);
      queueShadowReplay(0, lines[nextIndex]?.start ?? 0);

      return;
    }

    setPlaying(false);
  }, [
    clearShadowTimer,
    getShadowSegment,
    lines,
    queueShadowReplay,
    settings.shadowGap,
    settings.shadowRepeatCount,
  ]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;

    if (!audio || !currentLesson) return;

    if (playing) {
      clearShadowTimer();
      audio.pause();

      return;
    }

    if (settings.mode === "shadow") {
      const targetIndex = shadowTargetIndexRef.current;

      clearShadowTimer();
      if (targetIndex !== null) {
        const { start } = getShadowSegment(targetIndex);

        audio.currentTime = start;
        setCurrentTime(start);
        setCurrentLineIndex(targetIndex);
        void safePlay();

        return;
      }
    }

    const awaitingIndex = singleAwaitingRef.current;

    if (settings.mode === "single" && awaitingIndex !== null) {
      const nextIndex = awaitingIndex + 1;

      singleAwaitingRef.current = null;
      if (nextIndex < lines.length) {
        seekTo(lines[nextIndex].start);
      }
    }

    void safePlay();
  }, [
    clearShadowTimer,
    currentLesson,
    getShadowSegment,
    lines,
    playing,
    safePlay,
    seekTo,
    settings.mode,
  ]);

  const syncAudioTime = useCallback(() => {
    const audio = audioRef.current;

    if (!audio) return;

    const time = audio.currentTime;
    const lineIndex = findCurrentLineIndex(lines, time);
    const shadowTargetIndex = shadowTargetIndexRef.current;
    const displayedLineIndex =
      settings.mode === "shadow" && shadowTargetIndex !== null
        ? shadowTargetIndex
        : lineIndex;

    setCurrentTime(time);
    setCurrentLineIndex(displayedLineIndex);

    if (settings.mode === "shadow") {
      if (
        audio.paused ||
        shadowTargetIndex === null ||
        shadowPendingRef.current
      ) {
        return;
      }

      const { start, end } = getShadowSegment(shadowTargetIndex);

      if (!Number.isFinite(end) || end <= start) return;

      const userAgent = navigator.userAgent || "";
      const isAppleLike =
        /iPad|iPhone|iPod/.test(userAgent) ||
        (/Macintosh/.test(userAgent) && "ontouchend" in document);
      const rate = Math.max(0.5, Math.min(3, settings.playbackRate || 1));
      const guardAhead =
        (isAppleLike ? 0.12 : 0.09) + (rate - 1) * (isAppleLike ? 0.03 : 0.02);
      const stopAt = Math.max(start, end - guardAhead);

      if (time >= stopAt) {
        shadowPendingRef.current = true;
        audio.pause();
        handleShadowSegmentEnd();
      }

      return;
    }

    if (
      settings.mode !== "single" ||
      audio.paused ||
      lineIndex < 0 ||
      singleAwaitingRef.current !== null
    ) {
      return;
    }

    const line = lines[lineIndex];
    const audioDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const end = getLineEnd(lines, lineIndex, audioDuration);

    if (!Number.isFinite(end) || end <= line.start) return;

    // 稍微提前停下，避免浏览器事件延迟把下一句的开头播放出来。
    const stopAt = Math.max(line.start, end - 0.055);

    if (time >= stopAt) {
      singleAwaitingRef.current = lineIndex;
      audio.pause();
      audio.currentTime = stopAt;
      setCurrentTime(stopAt);
      setCurrentLineIndex(lineIndex);
    }
  }, [
    getShadowSegment,
    handleShadowSegmentEnd,
    lines,
    settings.mode,
    settings.playbackRate,
  ]);

  useEffect(() => {
    if (!playing) return;

    const tick = () => {
      syncAudioTime();
      if (audioRef.current && !audioRef.current.paused) {
        playbackRafRef.current = window.requestAnimationFrame(tick);
      } else {
        playbackRafRef.current = null;
      }
    };

    playbackRafRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (playbackRafRef.current !== null) {
        window.cancelAnimationFrame(playbackRafRef.current);
        playbackRafRef.current = null;
      }
    };
  }, [playing, syncAudioTime]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !currentLesson || lrcLoading || duration <= 0) return;

    if (
      settings.skipIntro &&
      !playing &&
      introAppliedForRef.current !== currentLesson.id
    ) {
      const firstContentIndex = findFirstContentIndex(lines);
      const start = lines[firstContentIndex]?.start ?? 0;

      introAppliedForRef.current = currentLesson.id;
      if (start > 0) seekTo(start);
    }

    if (pendingAutoPlayRef.current) {
      pendingAutoPlayRef.current = false;
      const shadowTargetIndex = shadowTargetIndexRef.current;

      if (settings.mode === "shadow" && shadowTargetIndex !== null) {
        const start = lines[shadowTargetIndex]?.start ?? 0;

        audio.currentTime = start;
        setCurrentTime(start);
        setCurrentLineIndex(shadowTargetIndex);
      }
      void safePlay();
    }
  }, [
    currentLesson,
    duration,
    lines,
    lrcLoading,
    playing,
    safePlay,
    seekTo,
    settings.mode,
    settings.skipIntro,
  ]);

  const selectLesson = useCallback(
    (lessonId: number, autoPlay = false) => {
      const lesson = lessons.find((item) => item.id === lessonId);

      if (lesson) {
        saveRecentListening({
          courseId: lesson.courseId ?? parentCourseId,
          courseName: lesson.courseName ?? parentCourseName,
          subCourseId: lesson.subCourseId,
          subCourseName: lesson.subCourseName ?? courseName,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
        });
      }

      resetShadow();
      if (lessonId === selectedLessonId) {
        if (autoPlay) {
          const firstContentIndex = findFirstContentIndex(lines);
          const start =
            settings.mode === "shadow" || settings.skipIntro
              ? (lines[firstContentIndex]?.start ?? 0)
              : 0;

          seekTo(start);
          void safePlay();
        }

        return;
      }

      pendingAutoPlayRef.current = autoPlay;
      audioRef.current?.pause();
      setSelectedLessonId(lessonId);
    },
    [
      courseName,
      lessons,
      lines,
      parentCourseId,
      parentCourseName,
      resetShadow,
      safePlay,
      seekTo,
      selectedLessonId,
      settings.mode,
      settings.skipIntro,
    ],
  );

  const toggleFavorite = useCallback(
    async (lessonId: number) => {
      if (favoritePendingLessonId !== null) return;

      const lesson = lessons.find((item) => item.id === lessonId);

      if (!lesson) return;

      setFavoritePendingLessonId(lessonId);
      setFavoriteActionError(null);
      try {
        const result = lesson.isFavorited
          ? await listeningApi.unfavoriteLesson(lessonId)
          : await listeningApi.favoriteLesson(lessonId);
        const removedIndex = lessons.findIndex((item) => item.id === lessonId);
        const nextLessons =
          favoritesMode && !result.isFavorited
            ? lessons.filter((item) => item.id !== lessonId)
            : lessons.map((item) =>
                item.id === lessonId
                  ? { ...item, isFavorited: result.isFavorited }
                  : item,
              );

        setLessons(nextLessons);
        if (
          favoritesMode &&
          !result.isFavorited &&
          selectedLessonId === lessonId
        ) {
          const nextSelected =
            nextLessons[Math.min(removedIndex, nextLessons.length - 1)] ??
            nextLessons[0];

          setSelectedLessonId(nextSelected?.id ?? null);
        }
      } catch (reason) {
        setFavoriteActionError(
          errorMessage(reason, "收藏操作失败，请稍后重试"),
        );
      } finally {
        setFavoritePendingLessonId(null);
      }
    },
    [favoritePendingLessonId, favoritesMode, lessons, selectedLessonId],
  );

  const playLine = useCallback(
    (lineIndex: number) => {
      const line = lines[lineIndex];

      if (!line) return;
      seekTo(line.start);
      if (settings.mode === "shadow") {
        shadowTargetIndexRef.current = lineIndex;
        setCurrentLineIndex(lineIndex);
      }
      void safePlay();
    },
    [lines, safePlay, seekTo, settings.mode],
  );

  const handleEnded = useCallback(() => {
    if (settings.mode === "shadow") {
      setPlaying(false);
      if (!shadowPendingRef.current) {
        shadowPendingRef.current = true;
        handleShadowSegmentEnd();
      }

      return;
    }

    singleAwaitingRef.current = null;
    setPlaying(false);

    if (settings.afterPlay === "repeat") {
      const firstContentIndex = findFirstContentIndex(lines);
      const start = settings.skipIntro
        ? (lines[firstContentIndex]?.start ?? 0)
        : 0;

      seekTo(start);
      void safePlay();

      return;
    }

    if (settings.afterPlay === "next" && nextLesson) {
      selectLesson(nextLesson.id, true);

      return;
    }

    if (settings.afterPlay === "all") {
      const target = nextLesson ?? lessons[0];

      if (target) selectLesson(target.id, true);
    }
  }, [
    handleShadowSegmentEnd,
    lessons,
    lines,
    nextLesson,
    safePlay,
    seekTo,
    selectLesson,
    settings.afterPlay,
    settings.mode,
    settings.skipIntro,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;

      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          Boolean(
            target.closest("input, textarea, select, button, [role='dialog']"),
          ))
      ) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        togglePlay();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        seekTo(currentTime - 5);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        seekTo(currentTime + 5);
      } else if (event.key === "PageUp" && previousLesson) {
        event.preventDefault();
        selectLesson(previousLesson.id);
      } else if (event.key === "PageDown" && nextLesson) {
        event.preventDefault();
        selectLesson(nextLesson.id);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    currentTime,
    nextLesson,
    previousLesson,
    seekTo,
    selectLesson,
    togglePlay,
  ]);

  return (
    <div className="mx-auto flex h-dvh w-full max-w-7xl flex-col overflow-hidden px-0">
      <ListeningHeader
        courseName={
          favoritesMode
            ? currentLesson
              ? `${currentLesson.courseName ?? "听力课程"} · ${currentLesson.subCourseName ?? "我的收藏"}`
              : "我的收藏"
            : courseName
        }
        lessonTitle={currentLesson?.title}
        lessonsOpen={mobileLessonsOpen}
        onBack={returnToCourses}
        onToggleLessons={() => setMobileLessonsOpen((open) => !open)}
      />

      {!subCourseId && !favoritesMode ? (
        <main className="flex min-h-0 flex-1 items-center justify-center p-5">
          <GlassCard className="w-full max-w-lg">
            <div
              className="relative z-[1] flex flex-col items-center gap-4 p-8 text-center"
              role="alert"
            >
              <CircleExclamation className="size-8 text-danger" />
              <div>
                <h2 className="font-semibold">无法打开听力课程</h2>
                <p className="mt-1 text-sm text-muted">
                  链接中缺少有效的子课程编号
                </p>
              </div>
              <Button
                variant="secondary"
                onPress={() => router.push("/listening")}
              >
                <ArrowLeft className="size-4" />
                返回课程列表
              </Button>
            </div>
          </GlassCard>
        </main>
      ) : (
        <main className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] gap-3 p-3 sm:p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:grid-rows-1">
          <LessonList
            className="hidden lg:block"
            error={lessonsError}
            favoriteActionError={favoriteActionError}
            favoritePendingLessonId={favoritePendingLessonId}
            favoritesMode={favoritesMode}
            id="listening-lesson-list-desktop"
            lessons={lessons}
            loading={lessonsLoading}
            playing={playing}
            selectedLessonId={selectedLessonId}
            onRetry={() => setLessonsReloadVersion((version) => version + 1)}
            onSelect={selectLesson}
            onToggleFavorite={toggleFavorite}
          />
          <LrcView
            autoFollow={settings.autoFollow}
            currentLineIndex={currentLineIndex}
            document={lrcDocument}
            error={lrcError}
            language={settings.language}
            lessonTitle={currentLesson?.title}
            loading={lrcLoading || (lessonsLoading && !currentLesson)}
            mode={settings.mode}
            onRetry={() => setLrcReloadVersion((version) => version + 1)}
            onSeek={playLine}
          />
        </main>
      )}

      {subCourseId || favoritesMode ? (
        <LessonDrawer
          error={lessonsError}
          favoriteActionError={favoriteActionError}
          favoritePendingLessonId={favoritePendingLessonId}
          favoritesMode={favoritesMode}
          isOpen={mobileLessonsOpen}
          lessons={lessons}
          loading={lessonsLoading}
          playing={playing}
          selectedLessonId={selectedLessonId}
          onOpenChange={setMobileLessonsOpen}
          onRetry={() => setLessonsReloadVersion((version) => version + 1)}
          onSelect={selectLesson}
          onToggleFavorite={toggleFavorite}
        />
      ) : null}

      {/* 字幕由可交互的 LRC 视图提供，不使用原生 track。 */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        key={currentLesson?.id ?? "empty"}
        ref={audioRef}
        className="hidden"
        preload="metadata"
        src={audioSrc || undefined}
        onDurationChange={(event) => {
          const nextDuration = event.currentTarget.duration;

          if (Number.isFinite(nextDuration)) setDuration(nextDuration);
        }}
        onEnded={handleEnded}
        onError={() => {
          if (currentLesson)
            setPlayerError("音频加载失败，请稍后重试或选择其他章节");
        }}
        onLoadedMetadata={(event) => {
          const nextDuration = event.currentTarget.duration;

          setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
          syncAudioTime();
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onSeeked={syncAudioTime}
        onTimeUpdate={syncAudioTime}
      />

      <PlayerControls
        autoFollow={settings.autoFollow}
        currentTime={currentTime}
        disabled={!currentLesson || (!subCourseId && !favoritesMode)}
        duration={duration}
        error={playerError}
        hasNext={Boolean(nextLesson)}
        hasPrevious={Boolean(previousLesson)}
        mode={settings.mode}
        playbackRate={settings.playbackRate}
        playing={playing}
        onNext={() => nextLesson && selectLesson(nextLesson.id)}
        onOpenSettings={() => setSettingsOpen(true)}
        onPlaybackRateChange={(playbackRate) =>
          updateSettings({ playbackRate })
        }
        onPrevious={() => previousLesson && selectLesson(previousLesson.id)}
        onSeek={seekTo}
        onToggleFollow={() =>
          updateSettings({ autoFollow: !settings.autoFollow })
        }
        onTogglePlay={togglePlay}
      />

      <ListeningSettingsModal
        isOpen={settingsOpen}
        settings={settings}
        onOpenChange={setSettingsOpen}
        onSettingsChange={updateSettings}
      />
    </div>
  );
}

export default function ListeningLearnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center">
          <Spinner aria-label="听力学习页加载中" size="lg" />
        </div>
      }
    >
      <ListeningLearnClient />
    </Suspense>
  );
}
