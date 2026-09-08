"use client";

import type { LearnWord } from "@/types/courselearn";

import { useEffect, useRef, useState } from "react";
import { Button, InputGroup, Modal } from "@heroui/react";
import { Xmark } from "@gravity-ui/icons";

import WordDetail from "@/components/common/word-detail";
import { post } from "@/lib/api";
import { CnEnIcon, EditIcon, EnCnIcon } from "./mode-icons";

/**
 * 页面级共享的单词【详情】弹窗：每页仅此一个实例。
 * word 为空视为关闭；卡片点击【详情】时把目标 word 传入即可。
 */
export function WordDetailModal({
  word,
  onOpenChange,
}: {
  word: LearnWord | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = word !== null;
  // 记住最近一次打开的目标，让关闭退出动画期间仍能显示内容
  const [displayWord, setDisplayWord] = useState<LearnWord | null>(null);

  useEffect(() => {
    if (word) setDisplayWord(word);
  }, [word]);

  return (
    <Modal.Backdrop
      className="!bg-transparent"
      isOpen={open}
      onOpenChange={onOpenChange}
    >
      <Modal.Container className="w-full max-w-lg rounded-2xl">
        <Modal.Dialog className="backdrop-blur-xl backdrop-saturate-150 bg-white/70 dark:bg-zinc-900/70 shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_8px_32px_rgb(0_0_0/0.12)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_8px_32px_rgb(0_0_0/0.4)]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="text-2xl font-semibold">
              {displayWord?.en ?? ""}
            </Modal.Heading>
          </Modal.Header>
          {/* 仅展示详情，不包含「加入生词本」逻辑 */}
          <div className="m-0 py-4">
            {displayWord && (
              <WordDetail key={displayWord.en} word={displayWord.en} />
            )}
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/**
 * 页面级共享的单词【编辑/修改】弹窗：每页仅此一个实例。
 * word 为空视为关闭；打开时自动把该单词的 en / cn 预写入输入框。
 */
export function WordEditModal({
  word,
  onOpenChange,
  onSaved,
}: {
  word: LearnWord | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (lexiconId: number, en: string, cn: string) => void;
}) {
  const open = word !== null;
  const [editEn, setEditEn] = useState("");
  const [editCn, setEditCn] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  // 记录上次开关状态：每次「打开」瞬间预写入目标单词，
  // 避免仅依赖 word 引用变化时「取消后再次编辑同一单词」不重置表单
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current && word) {
      setEditEn(word.en);
      setEditCn(word.cn);
    }
    prevOpenRef.current = open;
  }, [open, word]);

  const handleSaveEdit = async () => {
    if (!word) return;

    const en = editEn.trim();
    const cn = editCn.trim();

    if (!en || !cn) return;

    setEditSaving(true);
    try {
      await post<void>("/Word/updc", null, {
        params: { id: word.lexiconId, en, cn },
      });
      onSaved(word.lexiconId, en, cn);
      onOpenChange(false);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[word-modal] 保存单词失败:", err);
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <Modal.Backdrop
      isDismissable={false}
      isOpen={open}
      variant="blur"
      onOpenChange={onOpenChange}
    >
      <Modal.Container placement="center" size="md">
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
              <EditIcon className="size-5" />
            </Modal.Icon>
            <Modal.Heading>编辑/修改单词</Modal.Heading>
            <p className="mt-1.5 text-sm leading-5 text-muted">
              修改单词的英文与中文释义后保存即可生效
            </p>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-5 py-2">
            <div className="grid grid-cols-[80px_1fr] items-center py-2 gap-3">
              <label
                className="text-sm text-foreground"
                htmlFor="word-en-input"
              >
                英文单词
              </label>
              <InputGroup
                style={
                  {
                    "--field-border": "var(--border)",
                  } as React.CSSProperties
                }
                variant="secondary"
              >
                <InputGroup.Prefix>
                  <EnCnIcon className="size-4 text-muted" />
                </InputGroup.Prefix>
                <InputGroup.Input
                  className="w-full max-w-[280px]"
                  id="word-en-input"
                  placeholder="输入英文单词"
                  value={editEn}
                  onChange={(e) => setEditEn(e.target.value)}
                />
                {editEn.length > 0 && (
                  <button
                    aria-label="清空内容"
                    className="inline-flex items-center justify-center px-2 hover:opacity-70"
                    type="button"
                    onClick={() => setEditEn("")}
                  >
                    <Xmark className="size-4" />
                  </button>
                )}
              </InputGroup>
            </div>
            <div className="grid grid-cols-[80px_1fr] items-center py-2 gap-3">
              <label
                className="text-sm text-foreground"
                htmlFor="word-cn-input"
              >
                中文释义
              </label>
              <InputGroup
                style={
                  {
                    "--field-border": "var(--border)",
                  } as React.CSSProperties
                }
                variant="secondary"
              >
                <InputGroup.Prefix>
                  <CnEnIcon className="size-4 text-muted" />
                </InputGroup.Prefix>
                <InputGroup.Input
                  className="w-full max-w-[280px]"
                  id="word-cn-input"
                  placeholder="输入中文释义"
                  value={editCn}
                  onChange={(e) => setEditCn(e.target.value)}
                />
                {editCn.length > 0 && (
                  <button
                    aria-label="清空内容"
                    className="inline-flex items-center justify-center px-2 hover:opacity-70"
                    type="button"
                    onClick={() => setEditCn("")}
                  >
                    <Xmark className="size-4" />
                  </button>
                )}
              </InputGroup>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary">
              取消
            </Button>
            <Button
              isDisabled={
                editSaving ||
                editEn.trim().length === 0 ||
                editCn.trim().length === 0
              }
              onPress={handleSaveEdit}
            >
              {editSaving ? "保存中..." : "保存"}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
