"use client";

import type { LearnStatus, LearnWord } from "@/types/courselearn";

import { useCallback, useRef, useState } from "react";

import { courseLearnApi } from "@/lib/api";

/** 单词菜单操作类型：删除 / 强化区收藏切换 / 学习状态转移 */
export type WordActionKind = "delete" | "collect" | "status";

/** 单词菜单的请求、错误提示与共享删除确认状态。 */
export function useWordActions(
  flushRecords: () => void,
  /** 接口成功后由父级决定如何处理列表：静默刷新 + 离场动画，或就地更新 + 轻提示 */
  applyActionResult: (word: LearnWord, kind: WordActionKind) => Promise<void>,
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

  // 接口成功后交由 applyActionResult 处理列表（含静默刷新与离场动画），
  // 保持卡片、Tab 数量与分页同步。
  const runWordAction = useCallback(
    async (
      word: LearnWord,
      kind: WordActionKind,
      action: () => Promise<void>,
      onActionSuccess?: () => void,
    ) => {
      if (actionInFlightRef.current) return false;
      actionInFlightRef.current = true;
      setActionPending(true);
      setActionError(null);
      flushRecords();
      try {
        await action();
        // 接口已成功后立即回调（如关闭删除弹窗），再做列表刷新与离场动画
        onActionSuccess?.();
        await applyActionResult(word, kind);

        return true;
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "操作失败，请重试");

        return false;
      } finally {
        actionInFlightRef.current = false;
        setActionPending(false);
      }
    },
    [flushRecords, applyActionResult],
  );

  const handleToggleCollect = useCallback(
    (word: LearnWord) => {
      void runWordAction(word, "collect", () =>
        courseLearnApi.setCollect(word.lexiconId, word.isCollect === 0),
      );
    },
    [runWordAction],
  );

  const handleChangeStatus = useCallback(
    (word: LearnWord, status: LearnStatus) => {
      void runWordAction(word, "status", () =>
        courseLearnApi.setWordStatus(word.lexiconId, status),
      );
    },
    [runWordAction],
  );

  const handleConfirmDelete = useCallback(() => {
    if (deleteWord?.myWord !== true) return;
    const word = deleteWord;

    void runWordAction(
      word,
      "delete",
      () => courseLearnApi.deleteWord(word.courseContentId),
      () => setDeleteWord(null),
    );
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
