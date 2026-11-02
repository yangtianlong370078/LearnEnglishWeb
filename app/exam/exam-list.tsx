"use client";

import type { ExamMode, ExamStatistics, ExamSummary } from "./types";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Clock, Plus, TrashBin } from "@gravity-ui/icons";
import { Button, Spinner, toast } from "@heroui/react";

import { examApi } from "./api";
import { CreateExamModal, ExamConfirmModal } from "./exam-modals";
import ExamModeIcon from "./mode-icon";
import { EXAM_MODES, EXAM_MODE_META, errorMessage } from "./utils";

import PaginationBar from "@/components/courselearn/pagination-bar";
import GlassCard from "@/components/common/glass-card";

const PAGE_SIZE = 12;

function ExamCard({
  exam,
  onOpen,
  onDelete,
}: {
  exam: ExamSummary;
  onOpen: (mode: ExamMode) => void;
  onDelete: () => void;
}) {
  return (
    <GlassCard className="group overflow-visible p-5 transition-shadow duration-300 hover:shadow-xl hover:shadow-accent/10">
      <div className="relative z-[1]">
        <div className="flex items-start justify-between gap-3 pr-8">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-foreground">
              {exam.name}
            </h2>
            <p className="mt-1 text-xs text-muted">{exam.createtime}</p>
          </div>
        </div>
        <button
          aria-label={`删除${exam.name}`}
          className="absolute -right-2 -top-2 z-10 inline-flex size-8 items-center justify-center rounded-full bg-white/60 text-muted opacity-70 transition-all hover:bg-danger-soft hover:text-danger hover:opacity-100 group-hover:opacity-100 dark:bg-white/10"
          title="删除试题"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <TrashBin className="size-4" />
        </button>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-1 dark:bg-white/[0.06]">
            <BookOpen className="size-3.5" />
            {exam.examcount} 个单词
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-1 dark:bg-white/[0.06]">
            <Clock className="size-3.5" />
            {exam.limittime} 分钟
          </span>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 rounded-2xl bg-black/[0.025] p-2 dark:bg-white/[0.035]">
          {EXAM_MODES.map((mode) => {
            const meta = EXAM_MODE_META[mode];
            const completed = exam[meta.completedKey];
            const score = exam[meta.scoreKey];

            return (
              <button
                key={mode}
                aria-label={`以${meta.label}模式打开${exam.name}`}
                className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl py-1 transition-colors hover:bg-black/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:hover:bg-white/[0.06]"
                title={`进入${meta.label}模式`}
                type="button"
                onClick={() => onOpen(mode)}
              >
                <span
                  className="inline-flex size-10 items-center justify-center rounded-2xl bg-[var(--cl-soft)] text-[var(--cl-ring3)] dark:text-[var(--cl-ring0)]"
                  style={
                    {
                      "--cl-ring0": meta.theme.light,
                      "--cl-ring3": meta.theme.dark,
                      "--cl-soft": meta.theme.soft,
                    } as React.CSSProperties
                  }
                >
                  <ExamModeIcon className="size-5" mode={mode} />
                </span>
                <span className="text-[11px] text-muted">{meta.label}</span>
                <span className="text-sm font-bold tabular-nums text-foreground">
                  {completed ? score : "-"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}

export default function ExamList() {
  const router = useRouter();
  const [items, setItems] = useState<ExamSummary[]>([]);
  const [statistics, setStatistics] = useState<ExamStatistics | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExamSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, stats] = await Promise.all([
        examApi.list(page, PAGE_SIZE),
        examApi.statistics(),
      ]);

      setItems(list.data);
      setTotal(list.total);
      setStatistics(stats);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreate = async (count: number, duration: number) => {
    setCreating(true);
    try {
      await examApi.create(count, duration);
      toast.success("试题创建成功");
      setCreateOpen(false);
      if (page !== 1) setPage(1);
      else await loadData();
    } catch (reason) {
      toast.danger(errorMessage(reason));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await examApi.remove(deleteTarget.id);
      toast.success("试题已删除");
      setDeleteTarget(null);
      if (items.length === 1 && page > 1) setPage((value) => value - 1);
      else await loadData();
    } catch (reason) {
      toast.danger(errorMessage(reason));
    } finally {
      setDeleting(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-6"
      data-glass-navigation-content=""
    >
      <GlassCard className="p-5 md:p-6">
        <div className="relative z-[1] flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              试题
            </h1>
            <div className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-4 md:min-w-[540px]">
              <div>
                <p className="text-xs text-muted">试题总数</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {statistics?.totalExams ?? "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">考核单词</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {statistics?.totalWords ?? "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">已完成模式</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {statistics?.completedModes ?? "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">平均得分</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  {statistics ? statistics.averageScore : "-"}
                </p>
              </div>
            </div>
          </div>
          <Button className="shrink-0" onPress={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            创建试题
          </Button>
        </div>
      </GlassCard>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <GlassCard className="p-10 text-center">
          <div className="relative z-[1] flex flex-col items-center gap-4">
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
            <Button variant="secondary" onPress={() => void loadData()}>
              重新加载
            </Button>
          </div>
        </GlassCard>
      ) : items.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <div className="relative z-[1]">
            <BookOpen className="mx-auto size-10 text-muted" />
            <p className="mt-4 font-medium text-foreground">还没有试题</p>
            <p className="mt-1 text-sm text-muted">
              点击右上角“创建试题”开始第一次考核
            </p>
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((exam) => (
            <ExamCard
              key={exam.id}
              exam={exam}
              onDelete={() => setDeleteTarget(exam)}
              onOpen={(mode) =>
                router.push(`/exam/${exam.id}?mode=${mode}`)
              }
            />
          ))}
        </div>
      )}

      {!loading && !error && items.length > 0 ? (
        <PaginationBar
          pageIndex={page}
          totalPages={totalPages}
          onChange={setPage}
        />
      ) : null}

      <CreateExamModal
        isOpen={createOpen}
        saving={creating}
        onConfirm={(count, duration) => void handleCreate(count, duration)}
        onOpenChange={setCreateOpen}
      />
      <ExamConfirmModal
        danger
        confirmText="确认删除"
        description={`删除【${deleteTarget?.name ?? ""}】后，四种模式的考试成绩和答案都会一并删除，且无法恢复。`}
        isOpen={deleteTarget !== null}
        pending={deleting}
        title="删除试题"
        onConfirm={() => void handleDelete()}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
