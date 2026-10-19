"use client";

import type { LearnStatus, LearnWord } from "@/types/courselearn";

import { useCallback, useRef, useState } from "react";

import { courseLearnApi } from "@/lib/api";

/** 单词菜单的请求、错误提示与共享删除确认状态。 */
export function useWordActions(
  flushRecords: () => void,
  reloadWords: () => void,
) {
  const [actionPending, setActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteWord, setDeleteWord] = useState<LearnWord | null>(null);
  const actionInFlightRef = useRef(false);

  const resetActions = useCallback(() => {
    setDeleteWord(null);
    setActionError(null);
  }, []);

  const handleOpenDelete = useCallback((word: LearnWord) => {
    if (word.myWord !== true) return;
    setActionError(null);
    setDeleteWord(word);
  }, []);

  const handleDeleteOpenChange = useCallback((open: boolean) => {
    if (!open && !actionInFlightRef.current) setDeleteWord(null);
  }, []);

  // 操作完成后重新查询当前页面，保持卡片、Tab 数量与分页同步。
  const runWordAction = useCallback(
    async (action: () => Promise<void>) => {
      if (actionInFlightRef.current) return false;
      actionInFlightRef.current = true;
      setActionPending(true);
      setActionError(null);
      flushRecords();
      try {
        await action();
        reloadWords();

        return true;
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "操作失败，请重试");

        return false;
      } finally {
        actionInFlightRef.current = false;
        setActionPending(false);
      }
    },
    [flushRecords, reloadWords],
  );

  const handleToggleCollect = useCallback(
    (word: LearnWord) => {
      void runWordAction(() =>
        courseLearnApi.setCollect(word.lexiconId, word.isCollect === 0),
      );
    },
    [runWordAction],
  );

  const handleChangeStatus = useCallback(
    (word: LearnWord, status: LearnStatus) => {
      void runWordAction(() =>
        courseLearnApi.setWordStatus(word.lexiconId, status),
      );
    },
    [runWordAction],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (deleteWord?.myWord !== true) return;
    const deleted = await runWordAction(() =>
      courseLearnApi.deleteWord(deleteWord.courseContentId),
    );

    if (deleted) setDeleteWord(null);
  }, [deleteWord, runWordAction]);

  return {
    actionPending,
    actionError,
    deleteWord,
    resetActions,
    handleOpenDelete,
    handleDeleteOpenChange,
    handleToggleCollect,
    handleChangeStatus,
    handleConfirmDelete,
  };
}
