"use client";

import type { WordCardHandle } from "@/components/courselearn/word-card";
import type {
  LearnMode,
  LearnStatus,
  LearnWord,
  NumberUpdateRecord,
  WordsResponse,
} from "@/types/courselearn";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Spinner } from "@heroui/react";

import CourseLearnNavbar from "@/components/courselearn/course-learn-navbar";
import GlobalToolbar from "@/components/courselearn/global-toolbar";
import PaginationBar from "@/components/courselearn/pagination-bar";
import SettingsModal from "@/components/courselearn/settings-modal";
import StatTabs from "@/components/courselearn/stat-tabs";
import WordCard from "@/components/courselearn/word-card";
import {
  MODE_FIELD,
  buildRecord,
  isAudioMode,
  nextNumber,
} from "@/components/courselearn/lib";
import { useCourseLearnSettings } from "@/components/courselearn/use-course-learn-settings";
import { courseLearnApi } from "@/lib/api";

const PAGE_SIZE = 12;

function toStatus(value: string | null): LearnStatus {
  const n = Number(value);

  return n === 2 || n === 3 ? (n as LearnStatus) : 1;
}

function CourseLearnClient() {
  const searchParams = useSearchParams();

  const kc = useMemo(() => {
    const n = Number(searchParams.get("kc"));

    // 内置集合（生词本/强化学习区等）使用负数 id，仅排除 0 与非法值
    return Number.isFinite(n) && n !== 0 ? n : 1;
  }, [searchParams]);
  const initialName = useMemo(
    () => searchParams.get("name") ?? "",
    [searchParams],
  );

  const settingsHook = useCourseLearnSettings();
  const { settings } = settingsHook;

  const [zt, setZt] = useState<LearnStatus>(() =>
    toStatus(searchParams.get("zt")),
  );
  const [pageIndex, setPageIndex] = useState(1);

  const [resp, setResp] = useState<WordsResponse | null>(null);
  const [words, setWords] = useState<LearnWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [globalMode, setGlobalMode] = useState<LearnMode | null>(null);
  /** 各单词卡的本地学习模式（key 为卡片索引），用于联动翻译按钮 */
  const [localModes, setLocalModes] = useState<
    Record<number, LearnMode | null>
  >({});
  const [translationOn, setTranslationOn] = useState(false);
  const [practiceOn, setPracticeOn] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [, setCurrentIndex] = useState(0);
  /** 数据版本号：仅在新一页数据加载完成时自增，用于触发「聚焦首卡」，
   *  避免计分导致的 words 原地更新反复触发聚焦而把光标抢回首卡 */
  const [dataVersion, setDataVersion] = useState(0);

  const cardRefs = useRef<Array<WordCardHandle | null>>([]);
  const recordsRef = useRef<Map<string, NumberUpdateRecord>>(new Map());
  const globalModeRef = useRef<LearnMode | null>(null);

  globalModeRef.current = globalMode;

  const courseName = resp ? initialName || `课程 ${kc}` : initialName;

  // ── 记录保存 ─────────────────────────────────────────────
  const flushRecords = useCallback(() => {
    const map = recordsRef.current;

    if (map.size === 0) return;
    const records = Array.from(map.values());

    map.clear();
    void courseLearnApi.saveNumberRecords(records);
  }, []);

  // ── 数据加载 ─────────────────────────────────────────────
  useEffect(() => {
    let ignore = false;

    setLoading(true);
    setError(null);
    courseLearnApi
      .queryWords({ kc, zt, index: pageIndex, pageSize: PAGE_SIZE })
      .then((data) => {
        if (ignore) return;
        setResp(data);
        setWords(data.data ?? []);
        cardRefs.current = [];
        setCurrentIndex(0);
        setLocalModes({});
        setDataVersion((v) => v + 1);
      })
      .catch((err: Error) => {
        if (ignore) return;
        // eslint-disable-next-line no-console
        console.error("[courselearn] 加载单词失败:", err);
        setError(err?.message ?? "加载失败");
        setResp(null);
        setWords([]);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [kc, zt, pageIndex]);

  // ── 页面不可见 / 失焦 / 关闭 时保存 ───────────────────────
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushRecords();
    };
    const onBlur = () => flushRecords();
    const onPageHide = () => flushRecords();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("pagehide", onPageHide);
      flushRecords();
    };
  }, [flushRecords]);

  // ── 切换 Tab（状态）：先保存再切换 ───────────────────────
  const handleZtChange = useCallback(
    (nextZt: LearnStatus) => {
      if (nextZt === zt) return;
      flushRecords();
      setGlobalMode(null);
      setPageIndex(1);
      setZt(nextZt);
    },
    [flushRecords, zt],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      flushRecords();
      setGlobalMode(null);
      setPageIndex(page);
    },
    [flushRecords],
  );

  // ── 判定结果：累加练习次数并生成记录 ─────────────────────
  const handleResult = useCallback(
    (word: LearnWord, mode: LearnMode, correct: boolean) => {
      const field = MODE_FIELD[mode];

      setWords((prev) => {
        const next = prev.map((w) =>
          w.lexiconId === word.lexiconId
            ? { ...w, [field]: nextNumber(w[field], correct) }
            : w,
        );
        const updated = next.find((w) => w.lexiconId === word.lexiconId);

        if (updated) {
          recordsRef.current.set(
            `${word.lexiconId}:${field}`,
            buildRecord(word.lexiconId, updated[field], field),
          );
        }

        return next;
      });
    },
    [],
  );

  // ── 切换到下一张卡片（全局流程） ─────────────────────────
  const handleAdvance = useCallback((index: number) => {
    const next = index + 1;

    if (next >= cardRefs.current.length) return;
    setCurrentIndex(next);
    const mode = globalModeRef.current;

    requestAnimationFrame(() => {
      const handle = cardRefs.current[next];

      if (!handle) return;
      if (mode === "en-cn" || mode === "cn-en") {
        handle.focusInput();
      } else if (mode === "dictation") {
        // 光标与播放一起切换到下一张
        handle.focusInput();
        handle.start();
      }
    });
  }, []);

  const handleFocusRequest = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  // ── 听写/语音互斥：某张卡片启动活动时，中断其它卡片的播放与录音 ──
  const handleExclusiveStart = useCallback((index: number) => {
    cardRefs.current.forEach((handle, i) => {
      if (i !== index) handle?.interrupt();
    });
  }, []);

  const handleGlobalModeChange = useCallback((mode: LearnMode | null) => {
    setGlobalMode(mode);
    setCurrentIndex(0);
  }, []);

  // 单词卡本地模式上报
  const handleLocalModeChange = useCallback(
    (index: number, mode: LearnMode | null) => {
      setLocalModes((prev) =>
        prev[index] === mode ? prev : { ...prev, [index]: mode },
      );
    },
    [],
  );

  // 全局或任一单词卡开启【听写】/【语音】时，翻译须关闭且不可点击
  const translationLocked =
    isAudioMode(globalMode) || Object.values(localModes).some(isAudioMode);

  useEffect(() => {
    if (translationLocked) setTranslationOn(false);
  }, [translationLocked]);

  // 全局英-中 / 中-英 激活或新一页数据加载时，聚焦第一张卡片输入框。
  // 注意：依赖 dataVersion 而非 words，避免计分更新 words 时把光标抢回首卡。
  useEffect(() => {
    if (globalMode === "en-cn" || globalMode === "cn-en") {
      const id = requestAnimationFrame(() => cardRefs.current[0]?.focusInput());

      return () => cancelAnimationFrame(id);
    }
  }, [globalMode, dataVersion]);

  const totalPages = resp ? Math.max(1, Math.ceil(resp.total / PAGE_SIZE)) : 0;

  return (
    <div className="flex min-h-screen flex-col">
      <CourseLearnNavbar
        courseName={courseName}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6">
        <StatTabs
          active={zt}
          brs={resp?.brs ?? 0}
          wlj={resp?.wlj ?? 0}
          yzw={resp?.yzw ?? 0}
          onChange={handleZtChange}
        />

        <GlobalToolbar
          globalMode={globalMode}
          practiceOn={practiceOn}
          translationDisabled={translationLocked}
          translationOn={translationOn}
          onGlobalModeChange={handleGlobalModeChange}
          onTogglePractice={() => setPracticeOn((v) => !v)}
          onToggleTranslation={() => setTranslationOn((v) => !v)}
        />

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-sm text-danger">{error}</p>
            <button
              className="rounded-xl bg-gradient-to-br from-accent to-accent/80 px-5 py-2 text-sm font-medium text-accent-foreground shadow-md shadow-accent/30 transition-all duration-300 hover:-translate-y-px hover:shadow-lg"
              type="button"
              onClick={() => setPageIndex((p) => p)}
            >
              重新加载
            </button>
          </div>
        ) : words.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-20 text-sm text-muted">
            暂无单词
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {words.map((word, index) => (
              <WordCard
                key={`${word.lexiconId}-${index}`}
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                globalMode={globalMode}
                index={index}
                practiceOn={practiceOn}
                settings={settings}
                translationOn={translationOn}
                word={word}
                onAdvance={handleAdvance}
                onExclusiveStart={handleExclusiveStart}
                onFocusRequest={handleFocusRequest}
                onLocalModeChange={(mode) => handleLocalModeChange(index, mode)}
                onResult={handleResult}
              />
            ))}
          </div>
        )}

        {!loading && !error && words.length > 0 && (
          <PaginationBar
            pageIndex={pageIndex}
            totalPages={totalPages}
            onChange={handlePageChange}
          />
        )}
      </main>

      <SettingsModal
        isOpen={settingsOpen}
        settings={settings}
        onAccentChange={settingsHook.setAccent}
        onAsrModelChange={settingsHook.setAsrModelType}
        onAutoSpeakChange={settingsHook.setAutoSpeak}
        onDictationCountChange={settingsHook.setDictationCount}
        onHideMeaningChange={settingsHook.setHideMeaning}
        onOpenChange={setSettingsOpen}
      />
    </div>
  );
}

export default function CourseLearnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <CourseLearnClient />
    </Suspense>
  );
}
