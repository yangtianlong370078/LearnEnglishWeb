"use client";

import type { ScoringMode } from "./types";

import { useEffect, useState } from "react";
import { Button, Modal } from "@heroui/react";
import { Clock, FilePlus, Play, TrashBin } from "@gravity-ui/icons";

import { EXAM_DURATIONS } from "./utils";

import ModalBackdrop from "@/components/common/modal-backdrop";

const durationButton =
  "rounded-xl border px-3 py-2 text-sm font-medium transition-colors";

function DurationPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div
      aria-label="考试时长"
      className="grid grid-cols-4 gap-2"
      role="radiogroup"
    >
      {EXAM_DURATIONS.map((duration) => (
        <button
          key={duration}
          aria-checked={value === duration}
          className={`${durationButton} ${
            value === duration
              ? "border-accent/40 bg-accent text-accent-foreground shadow-sm"
              : "border-black/10 bg-white/45 text-foreground hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          }`}
          role="radio"
          type="button"
          onClick={() => onChange(duration)}
        >
          {duration}分钟
        </button>
      ))}
    </div>
  );
}

export function CreateExamModal({
  isOpen,
  saving,
  onOpenChange,
  onConfirm,
}: {
  isOpen: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (count: number, duration: number) => void;
}) {
  const [count, setCount] = useState(20);
  const [duration, setDuration] = useState(20);

  useEffect(() => {
    if (isOpen) {
      setCount(20);
      setDuration(20);
    }
  }, [isOpen]);

  const valid = Number.isInteger(count) && count >= 5 && count <= 50;

  return (
    <ModalBackdrop
      isDismissable={!saving}
      isOpen={isOpen}
      placement="center"
      size="md"
      onOpenChange={onOpenChange}
    >
      <Modal.Header>
        <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
          <FilePlus className="size-5" />
        </Modal.Icon>
        <Modal.Heading>创建试题</Modal.Heading>
        <p className="mt-1.5 text-sm text-muted">
          将从已掌握且今日未考核的单词中抽取试题
        </p>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-5 py-2">
        <label className="flex flex-col gap-2 text-sm font-medium">
          考核单词数
          <input
            className="w-full rounded-xl border border-black/10 bg-white/50 px-3 py-2.5 text-foreground outline-none focus:border-accent/50 dark:border-white/10 dark:bg-white/5"
            max={50}
            min={5}
            type="number"
            value={count}
            onChange={(event) => setCount(Number(event.target.value))}
          />
          <span className={`text-xs ${valid ? "text-muted" : "text-danger"}`}>
            请输入 5-50 个单词，最多 50 个
          </span>
        </label>
        <div className="flex flex-col gap-2 text-sm font-medium">
          考试时长
          <DurationPicker value={duration} onChange={setDuration} />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button isDisabled={saving} slot="close" variant="secondary">
          取消
        </Button>
        <Button
          isDisabled={!valid || saving}
          isPending={saving}
          onPress={() => onConfirm(count, duration)}
        >
          创建
        </Button>
      </Modal.Footer>
    </ModalBackdrop>
  );
}

export function StartExamModal({
  isOpen,
  defaultDuration,
  restarting,
  starting,
  onOpenChange,
  onConfirm,
}: {
  isOpen: boolean;
  defaultDuration: number;
  restarting: boolean;
  starting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (scoring: ScoringMode, duration: number) => void;
}) {
  const [scoring, setScoring] = useState<ScoringMode>("realtime");
  const [duration, setDuration] = useState(defaultDuration);

  useEffect(() => {
    if (isOpen) {
      setScoring("realtime");
      setDuration(
        EXAM_DURATIONS.includes(
          defaultDuration as (typeof EXAM_DURATIONS)[number],
        )
          ? defaultDuration
          : 20,
      );
    }
  }, [defaultDuration, isOpen]);

  return (
    <ModalBackdrop
      isDismissable={!starting}
      isOpen={isOpen}
      placement="center"
      size="md"
      onOpenChange={onOpenChange}
    >
      <Modal.Header>
        <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
          {restarting ? (
            <Clock className="size-5" />
          ) : (
            <Play className="size-5" />
          )}
        </Modal.Icon>
        <Modal.Heading>{restarting ? "重新考试" : "开始考试"}</Modal.Heading>
        <p className="mt-1.5 text-sm text-muted">
          开始后本模式将锁定，交卷后才能切换其他模式
        </p>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-5 py-2">
        <div className="flex flex-col gap-2 text-sm font-medium">
          计分方式
          <div
            aria-label="计分方式"
            className="grid grid-cols-2 gap-2"
            role="radiogroup"
          >
            {(
              [
                ["realtime", "实时计算", "逐题校验并更新分数"],
                ["onSubmit", "交卷后计算", "交卷后统一显示结果"],
              ] as const
            ).map(([value, label, description]) => (
              <button
                key={value}
                aria-checked={scoring === value}
                className={`rounded-2xl border p-3 text-left transition-colors ${
                  scoring === value
                    ? "border-accent/45 bg-accent/10 text-foreground"
                    : "border-black/10 bg-white/35 hover:bg-white/60 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                }`}
                role="radio"
                type="button"
                onClick={() => setScoring(value)}
              >
                <span className="block text-sm font-semibold">{label}</span>
                <span className="mt-1 block text-xs font-normal text-muted">
                  {description}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm font-medium">
          考试时长
          <DurationPicker value={duration} onChange={setDuration} />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button isDisabled={starting} slot="close" variant="secondary">
          取消
        </Button>
        <Button
          isDisabled={starting}
          isPending={starting}
          onPress={() => onConfirm(scoring, duration)}
        >
          {restarting ? "重考" : "开始"}
        </Button>
      </Modal.Footer>
    </ModalBackdrop>
  );
}

export function ExamConfirmModal({
  isOpen,
  title,
  description,
  confirmText,
  danger = false,
  pending,
  onOpenChange,
  onConfirm,
}: {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText: string;
  danger?: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <ModalBackdrop
      isDismissable={!pending}
      isOpen={isOpen}
      placement="center"
      size="md"
      onOpenChange={onOpenChange}
    >
      <Modal.Header>
        {danger ? (
          <Modal.Icon className="bg-danger-soft text-danger">
            <TrashBin className="size-5" />
          </Modal.Icon>
        ) : null}
        <Modal.Heading>{title}</Modal.Heading>
        <p className="mt-1.5 text-sm leading-6 text-muted">{description}</p>
      </Modal.Header>
      <Modal.Footer>
        <Button isDisabled={pending} slot="close" variant="secondary">
          取消
        </Button>
        <Button
          isDisabled={pending}
          isPending={pending}
          variant={danger ? "danger" : "primary"}
          onPress={onConfirm}
        >
          {confirmText}
        </Button>
      </Modal.Footer>
    </ModalBackdrop>
  );
}
