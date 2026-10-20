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
import { flushSync } from "react-dom";
import { useSearchParams } from "next/navigation";
import { Spinner, toast } from "@heroui/react";

import CourseLearnNavbar from "@/components/courselearn/course-learn-navbar";
import GlobalToolbar from "@/components/courselearn/global-toolbar";
import PaginationBar from "@/components/courselearn/pagination-bar";
import SettingsModal from "@/components/courselearn/settings-modal";
import StatTabs from "@/components/courselearn/stat-tabs";
import WordCard from "@/components/courselearn/word-card";
import WordGrid from "@/components/courselearn/word-grid";
import {
  WordDeleteModal,
  WordDetailModal,
  WordEditModal,
} from "@/components/courselearn/word-modal";
import {
  MODE_FIELD,
  buildRecord,
  isAudioMode,
  nextNumber,
} from "@/components/courselearn/lib";
import { useCourseLearnSettings } from "@/components/courselearn/use-course-learn-settings";
import {
  useWordActions,
  type WordActionKind,
  type WordActionMeta,
} from "@/components/courselearn/use-word-actions";
import { courseLearnApi } from "@/lib/api";
import { requestGlassRepaint } from "@/lib/glass-surface-source";

const PAGE_SIZE = 12;
/** 强化区内置课程 id：在此课程下「移除强化区」会让单词离开当前列表 */
const COLLECT_COURSE_ID = -100;
/** 离场动画时长：与 globals.css 的 .cl-card-leaving 保持一致 */
const LEAVE_ANIMATION_MS = 320;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const [reloadVersion, setReloadVersion] = useState(0);
  /** 静默刷新中：操作接口成功后重新拉取数据，但保留当前页面内容 */
  const [silentRefreshing, setSilentRefreshing] = useState(false);
  /** 正在播放「缩小渐隐」离场动画的单词 id */
  const [leavingId, setLeavingId] = useState<number | null>(null);
  /** 卡片飞抵后，对应状态 Tab 数字徽章的放大闪烁信号（key 变化触发重播） */
  const [tabPulse, setTabPulse] = useState<{ zt: LearnStatus; key: number } | null>(null);

  const [globalMode, setGlobalMode] = useState<LearnMode | null>(null);
  const [translationOn, setTranslationOn] = useState(false);
  const [practiceOn, setPracticeOn] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 页面级共享的详情 / 编辑弹窗目标：null 表示关闭，点击卡片按钮时写入对应单词
  const [detailWord, setDetailWord] = useState<LearnWord | null>(null);
  const [editWord, setEditWord] = useState<LearnWord | null>(null);
  const [, setCurrentIndex] = useState(0);
  /** 数据版本号：仅在新一页数据加载完成时自增，用于触发「聚焦首卡」，
   *  避免计分导致的 words 原地更新反复触发聚焦而把光标抢回首卡 */
  const [dataVersion, setDataVersion] = useState(0);

  const cardRefs = useRef<Array<WordCardHandle | null>>([]);
  const recordsRef = useRef<Map<string, NumberUpdateRecord>>(new Map());
  const globalModeRef = useRef<LearnMode | null>(null);
  /** 卡片网格容器：用于 FLIP 补位动画的位置测量 */
  const gridWrapRef = useRef<HTMLDivElement>(null);

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

  const reloadWords = useCallback(() => setReloadVersion((v) => v + 1), []);

  // ── 操作后的列表更新：FLIP 补位动画（「贪吃蛇」顶位效果） ──
  /** 换入新一页数据：先记录各卡片旧位置，同步提交后让位移卡片平滑滑动补位、新卡片淡入 */
  const swapWordsWithFlip = useCallback(
    (data: WordsResponse, nextWords: LearnWord[]) => {
      const grid = gridWrapRef.current?.querySelector<HTMLElement>("[data-cl-grid]");

      if (!grid) {
        cardRefs.current = [];
        setResp(data);
        setWords(nextWords);
        setLeavingId(null);

        return;
      }

      // First：更新前各卡片位置
      const before = new Map<number, DOMRect>();

      grid.querySelectorAll<HTMLElement>("[data-flip-id]").forEach((el) => {
        before.set(Number(el.dataset.flipId), el.getBoundingClientRect());
      });

      // Last：同步提交新列表，确保 DOM 已就位
      flushSync(() => {
        cardRefs.current = [];
        setResp(data);
        setWords(nextWords);
        setLeavingId(null);
      });

      // Invert & Play：仍在列表中的卡片从旧位置滑动到新位置，新卡片淡入。
      // 注意用 left/top 相对偏移而非 transform（同 cl-shake 的做法）：
      // transform 会把视口固定的玻璃壁纸重锚定到卡片，relative 偏移则让
      // 壁纸保持视口锚定，浏览器逐帧重绘，移动过程中背景实时正确（同滚动）。
      const ease = "cubic-bezier(0.22, 0.61, 0.36, 1)";
      const animations: Animation[] = [];

      grid.querySelectorAll<HTMLElement>("[data-flip-id]").forEach((el) => {
        const prev = before.get(Number(el.dataset.flipId));

        if (!prev) {
          // 新补位的卡片最后出场：先保持隐藏（fill: backwards 让延迟期间
          // 应用首帧），等其它卡片滑动补位结束后再淡入；
          // 仅淡入不用 scale（transform 会重锚定视口固定的玻璃壁纸）
          animations.push(
            el.animate([{ opacity: 0 }, { opacity: 1 }], {
              delay: 260,
              duration: 320,
              easing: ease,
              fill: "backwards",
            }),
          );

          return;
        }
        const now = el.getBoundingClientRect();
        const dx = prev.left - now.left;
        const dy = prev.top - now.top;

        if (dx === 0 && dy === 0) return;
        el.style.position = "relative";
        const animation = el.animate(
          [
            { left: `${dx}px`, top: `${dy}px` },
            { left: "0px", top: "0px" },
          ],
          { duration: 420, easing: ease },
        );

        animations.push(animation);
        // 结束后清理临时定位；动画被提前取消时也要还原
        void animation.finished
          .catch(() => {})
          .finally(() => {
            el.style.position = "";
          });
      });

      // 动画期间每帧触发一次玻璃重绘：液态玻璃 canvas 随卡片位置实时重画
      // （等同于滚动时的逐帧刷新），缓存壁纸模式的 nudge 亦兜底栅格缓存。
      if (animations.length) {
        let frame = requestAnimationFrame(function tick() {
          requestGlassRepaint(document);
          frame = requestAnimationFrame(tick);
        });

        void Promise.allSettled(animations.map((a) => a.finished)).then(() => {
          cancelAnimationFrame(frame);
          requestGlassRepaint(document);
        });
      }
    },
    [],
  );

  /** 状态转移离场动画：卡片边缩小边飞向顶部对应的状态 Tab。
   *  飞行用 transform（离场卡片允许壁纸随卡片走），fill: forwards 停在终点。
   *  返回是否成功播放；找不到卡片或 Tab 元素时返回 false 走缩小渐隐兜底。 */
  const flyCardToTab = useCallback(
    async (word: LearnWord, target: LearnStatus) => {
      const cardEl = gridWrapRef.current?.querySelector<HTMLElement>(
        `[data-flip-id="${word.lexiconId}"]`,
      );
      const tabEl = document.querySelector<HTMLElement>(
        `[data-stat-tab="${target}"]`,
      );

      if (!cardEl || !tabEl) return false;
      const from = cardEl.getBoundingClientRect();
      const to = tabEl.getBoundingClientRect();
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);

      cardEl.style.position = "relative";
      cardEl.style.zIndex = "30";
      cardEl.style.pointerEvents = "none";

      const animation = cardEl.animate(
        [
          { transform: "none", opacity: 1 },
          {
            transform: `translate(${dx * 0.92}px, ${dy * 0.92}px) scale(0.35)`,
            opacity: 0.9,
            offset: 0.72,
          },
          {
            transform: `translate(${dx}px, ${dy}px) scale(0.12)`,
            opacity: 0,
          },
        ],
        {
          duration: 540,
          easing: "cubic-bezier(0.5, 0, 0.84, 0.4)",
          fill: "forwards",
        },
      );

      try {
        await animation.finished;
      } catch {
        /* 动画被取消（如组件卸载）：直接继续后续流程 */
      }

      return true;
    },
    [],
  );

  /** 单词操作接口成功后的列表处理：
   *  - 非强化区课程的【加入/移除强化区】：就地更新收藏标记 + 轻提示，不刷新页面；
   *  - 转入状态：静默刷新后卡片边缩小边飞向对应 Tab，飞抵后 Tab 数字放大闪烁；
   *  - 删除 / 强化区课程内移除收藏：静默刷新，数据返回后卡片缩小渐隐，
   *    后续卡片平滑补位。 */
  const applyActionResult = useCallback(
    async (word: LearnWord, kind: WordActionKind, meta?: WordActionMeta) => {
      const leavesList =
        kind !== "collect" ||
        (kc === COLLECT_COURSE_ID && word.isCollect === 1);

      if (!leavesList) {
        setWords((prev) =>
          prev.map((w) =>
            w.lexiconId === word.lexiconId
              ? { ...w, isCollect: w.isCollect === 1 ? 0 : 1 }
              : w,
          ),
        );
        toast.success("操作成功", { timeout: 2000 });

        return;
      }

      setSilentRefreshing(true);
      try {
        const data = await courseLearnApi.queryWords({
          kc,
          zt,
          index: pageIndex,
          pageSize: PAGE_SIZE,
        });
        const lastPage = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

        if (pageIndex > lastPage) {
          // 本页已空（如删掉了本页最后一个单词）：退回整页加载跳转到末页
          setPageIndex(lastPage);

          return;
        }

        const nextWords = data.data ?? [];

        if (!nextWords.some((w) => w.lexiconId === word.lexiconId)) {
          // 第一步：离场动画——状态转移时飞向对应 Tab，删除/移除强化区原地缩小渐隐
          const target = kind === "status" ? meta?.status : undefined;
          const flown = target ? await flyCardToTab(word, target) : false;

          if (flown && target) {
            // 飞抵后：对应 Tab 的数字徽章放大闪烁一下
            setTabPulse({ zt: target, key: Date.now() });
          } else if (!flown) {
            setLeavingId(word.lexiconId);
            await wait(LEAVE_ANIMATION_MS);
          }
        }
        // 第二步：换入新数据，后续卡片 FLIP 滑动补位
        swapWordsWithFlip(data, nextWords);
        setCurrentIndex(0);
        setDataVersion((v) => v + 1);
      } catch {
        // 静默刷新失败：退回原整页刷新
        reloadWords();
      } finally {
        setSilentRefreshing(false);
      }
    },
    [kc, zt, pageIndex, reloadWords, swapWordsWithFlip, flyCardToTab],
  );

  const {
    actionPending,
    actionWordId,
    actionError,
    deleteWord,
    resetActions,
    handleOpenDelete,
    handleDeleteOpenChange,
    handleToggleCollect,
    handleChangeStatus,
    handleConfirmDelete,
  } = useWordActions(flushRecords, applyActionResult);

  // ── 数据加载 ─────────────────────────────────────────────
  useEffect(() => {
    let ignore = false;

    setLoading(true);
    setError(null);
    courseLearnApi
      .queryWords({ kc, zt, index: pageIndex, pageSize: PAGE_SIZE })
      .then((data) => {
        if (ignore) return;
        const lastPage = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

        if (pageIndex > lastPage) {
          setPageIndex(lastPage);

          return;
        }
        setResp(data);
        setWords(data.data ?? []);
        cardRefs.current = [];
        setCurrentIndex(0);
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
  }, [kc, zt, pageIndex, reloadVersion]);

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
      setDetailWord(null);
      setEditWord(null);
      resetActions();
      setPageIndex(1);
      setZt(nextZt);
    },
    [flushRecords, resetActions, zt],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      flushRecords();
      setGlobalMode(null);
      setDetailWord(null);
      setEditWord(null);
      resetActions();
      setPageIndex(page);
    },
    [flushRecords, resetActions],
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

  // ── 打开卡片右上角的详情 / 编辑弹窗（页面级共享，仅一个实例） ──
  const handleOpenDetail = useCallback((word: LearnWord) => {
    setDetailWord(word);
  }, []);

  const handleOpenEdit = useCallback((word: LearnWord) => {
    setEditWord(word);
  }, []);

  // ── 编辑弹窗保存成功后，就地更新列表数据 ──────────────────
  const handleWordUpdated = useCallback(
    (lexiconId: number, en: string, cn: string) => {
      setWords((prev) =>
        prev.map((w) => (w.lexiconId === lexiconId ? { ...w, en, cn } : w)),
      );
    },
    [],
  );

  // ── 听写/语音互斥：某张卡片启动活动时，中断其它卡片的播放与录音 ──
  const handleExclusiveStart = useCallback((index: number) => {
    cardRefs.current.forEach((handle, i) => {
      if (i !== index) handle?.interrupt();
    });
  }, []);

  const handleGlobalModeChange = useCallback((mode: LearnMode | null) => {
    setGlobalMode(mode);
    setCurrentIndex(0);
    if (mode) {
      // 开启全局学习按钮：重置全局【翻译】/【练习】为关闭
      //（各卡片的【翻译】/【练习】随 globalMode 变化自行重置）
      setTranslationOn(false);
      setPracticeOn(false);
    }
  }, []);

  // 全局【翻译】仅当全局学习按钮开启且非听写/语音模式时可点击
  const translationDisabled = !globalMode || isAudioMode(globalMode);

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

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-5 py-6">
        <StatTabs
          active={zt}
          brs={resp?.brs ?? 0}
          pulse={tabPulse}
          wlj={resp?.wlj ?? 0}
          yzw={resp?.yzw ?? 0}
          onChange={handleZtChange}
        />

        <GlobalToolbar
          globalMode={globalMode}
          practiceDisabled={!globalMode}
          practiceOn={practiceOn}
          translationDisabled={translationDisabled}
          translationOn={translationOn}
          onGlobalModeChange={handleGlobalModeChange}
          onTogglePractice={() => setPracticeOn((v) => !v)}
          onToggleTranslation={() => setTranslationOn((v) => !v)}
        />

        {actionError && !deleteWord && (
          <p className="text-sm text-danger" role="alert">
            {actionError}
          </p>
        )}

        <div ref={gridWrapRef}>
          <WordGrid
            empty={words.length === 0}
            error={error}
            loading={loading}
            onRetry={reloadWords}
          >
            {words.map((word, index) => (
              <div
                key={word.lexiconId}
                className={
                  leavingId === word.lexiconId ? "cl-card-leaving" : undefined
                }
                data-flip-id={word.lexiconId}
                // 离场缩小渐隐期间：玻璃 canvas 随卡片一起缩小，豁免全局
                // motion 挂起，避免动画触发所有卡片的液态玻璃重绘（同抖动）
                data-glass-motion-ignore={
                  leavingId === word.lexiconId ? "" : undefined
                }
              >
                <WordCard
                  ref={(el) => {
                    cardRefs.current[index] = el;
                  }}
                  actionsDisabled={actionWordId === word.lexiconId}
                  globalMode={globalMode}
                  index={index}
                  practiceOn={practiceOn}
                  settings={settings}
                  status={zt}
                  translationOn={translationOn}
                  word={word}
                  onAdvance={handleAdvance}
                  onExclusiveStart={handleExclusiveStart}
                  onFocusRequest={handleFocusRequest}
                  onChangeStatus={handleChangeStatus}
                  onOpenDetail={handleOpenDetail}
                  onOpenDelete={handleOpenDelete}
                  onOpenEdit={handleOpenEdit}
                  onResult={handleResult}
                  onToggleCollect={handleToggleCollect}
                />
              </div>
            ))}
          </WordGrid>
        </div>

        {/* 静默刷新指示：保留页面内容，仅浮动一个小加载标识 */}
        {silentRefreshing && (
          <div
            className="fixed right-5 top-20 z-50 flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-2 text-xs text-foreground/80 shadow-lg shadow-black/5 ring-1 ring-black/5 backdrop-blur-md dark:bg-white/10 dark:text-foreground/90 dark:ring-white/10"
            role="status"
          >
            <Spinner size="sm" />
            正在刷新…
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

      {/* 页面级共享弹窗：所有单词卡片共用同一实例，点击后传入目标单词 */}
      <WordDeleteModal
        error={actionError}
        isDeleting={actionPending}
        word={deleteWord}
        onConfirm={handleConfirmDelete}
        onOpenChange={handleDeleteOpenChange}
      />
      <WordDetailModal
        word={detailWord}
        onOpenChange={(open) => {
          if (!open) setDetailWord(null);
        }}
      />
      <WordEditModal
        word={editWord}
        onOpenChange={(open) => {
          if (!open) setEditWord(null);
        }}
        onSaved={handleWordUpdated}
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
