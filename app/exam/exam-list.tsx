"use client";

import type { ReactNode } from "react";
import type { ExamMode, ExamStatistics, ExamSummary } from "./types";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Clock, File, Plus, TrashBin } from "@gravity-ui/icons";
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
  const completedCount = EXAM_MODES.filter(
    (mode) => exam[EXAM_MODE_META[mode].completedKey],
  ).length;

  return (
    <GlassCard className="group overflow-visible p-5 transition-shadow duration-300 hover:shadow-xl hover:shadow-accent/10">
      <div className="relative z-[1]">
        <div className="flex items-start justify-between gap-3 pr-8">
          <div className="min-w-0">
           
            <h2 className="truncate text-[17px] font-semibold leading-6 text-foreground">
              {exam.name}
            </h2>
            <p className="mt-1 text-[11px] text-muted">{exam.createtime}</p>
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

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="size-3.5 text-foreground/45" />
            {exam.examcount} 个单词
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5 text-foreground/45" />
            {exam.limittime} 分钟
          </span>
        </div>

        <div className="mt-5 border-t border-black/[0.06] pt-4 dark:border-white/[0.08]">
         
          <div className="grid grid-cols-4 gap-1">
            {EXAM_MODES.map((mode) => {
              const meta = EXAM_MODE_META[mode];
              const completed = exam[meta.completedKey];
              const score = exam[meta.scoreKey];

              return (
                <button
                  key={mode}
                  aria-label={`以${meta.label}模式打开${exam.name}`}
                  className="flex min-w-0 flex-col items-center gap-1.5 rounded-2xl px-1 py-2 transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-black/[0.035] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98] dark:hover:bg-white/[0.055]"
                  title={`进入${meta.label}模式`}
                  type="button"
                  onClick={() => onOpen(mode)}
                >
                  <span
                    className={`exam-mode-icon relative inline-flex size-10 items-center justify-center rounded-2xl text-[var(--cl-ring3)] dark:text-[var(--cl-ring0)] ${completed ? "" : "opacity-60 saturate-50"}`}
                    style={
                      {
                        "--cl-ring0": meta.theme.light,
                        "--cl-ring3": meta.theme.dark,
                        "--cl-soft": meta.theme.soft,
                      } as React.CSSProperties
                    }
                  >
                    <span aria-hidden="true" className="exam-mode-icon-inner" />
                    <ExamModeIcon
                      className="relative z-[1] size-5"
                      mode={mode}
                    />
                  </span>
                  <span className="text-[11px] text-muted">{meta.label}</span>
                  <span className="flex h-6 items-baseline justify-center gap-0.5 tabular-nums">
                    {completed ? (
                      <>
                        <span className="text-xl font-semibold leading-none text-foreground">
                          {score}
                        </span>
                        <span className="text-[10px] text-muted">分</span>
                      </>
                    ) : (
                      <span className="text-[10px] font-medium leading-6 text-muted">
                        待完成
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function StatisticItem({
  icon,
  label,
  value,
  unit,
  emphasized = false,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  unit: string;
  emphasized?: boolean;
}) {
  const scoreProgress =
    emphasized && typeof value === "number" && Number.isFinite(value)
      ? Math.min(100, Math.max(0, value)) / 100
      : 0;

  return (
    <div className="min-w-0 px-3 py-3 sm:px-4">
      <div className="flex min-h-7 items-center gap-2">
        <span
          aria-hidden="true"
          className={`inline-flex size-7 shrink-0 items-center justify-center rounded-lg ${emphasized ? "bg-accent/10 text-accent" : "bg-foreground/[0.055] text-foreground/55"}`}
        >
          {icon}
        </span>
        <p className="min-w-0 text-[11px] font-medium leading-4 text-muted">
          {label}
        </p>
      </div>
      <p
        className={`mt-3 flex items-baseline gap-1 text-[30px] font-semibold leading-none tracking-[-0.035em] tabular-nums ${emphasized ? "text-accent" : "text-foreground"}`}
      >
        {value}
        <span className="text-[10px] font-normal tracking-normal text-muted">
          {unit}
        </span>
      </p>
      {emphasized ? (
        <div
          aria-hidden="true"
          className="mt-3 h-1 overflow-hidden rounded-full bg-foreground/[0.07]"
        >
          <div
            className="h-full w-full origin-left rounded-full bg-accent/60 transition-transform duration-500 ease-out motion-reduce:transition-none"
            style={{ transform: `scaleX(${scoreProgress})` }}
          />
        </div>
      ) : null}
    </div>
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
        <div className="relative z-[1]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="inline-flex size-8 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <BookOpen className="size-4" />
                </span>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  试题
                </h1>
              </div>
              <p className="mt-2 text-xs text-muted">
                查看考试成果，继续未完成的试题
              </p>
            </div>
            <Button className="shrink-0" onPress={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              创建试题
            </Button>
          </div>
          <section
            aria-label="试题统计"
            className="mt-6 overflow-hidden rounded-[22px] border border-black/[0.055] bg-white/[0.24] dark:border-white/[0.08] dark:bg-white/[0.025]"
          >
            <div className="grid xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.7fr)]">
              <div className="border-b border-black/[0.055] p-3 sm:p-4 xl:border-b-0 xl:border-r dark:border-white/[0.07]">
                <div className="flex items-center gap-2 px-3 pt-1 sm:px-4">
                  <span className="size-1.5 rounded-full bg-foreground/30" />
                  <h2 className="text-[11px] font-semibold tracking-[0.12em] text-foreground/60">
                    学习积累
                  </h2>
                </div>
                <div className="mt-1 grid grid-cols-2 divide-x divide-black/[0.055] dark:divide-white/[0.07]">
                  <StatisticItem
                    icon={<File className="size-4" />}
                    label="试题总数"
                    unit="份"
                    value={statistics?.totalExams ?? "—"}
                  />
                  <StatisticItem
                    icon={<BookOpen className="size-4" />}
                    label="考核单词（去重复）"
                    unit="个"
                    value={statistics?.totalWords ?? "—"}
                  />
                </div>
              </div>

              <div className="p-3 sm:p-4">
                <div className="flex items-center justify-between gap-3 px-3 pt-1 sm:px-4">
                  <div className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-accent/70" />
                    <h2 className="text-[11px] font-semibold tracking-[0.12em] text-foreground/60">
                      平均得分
                    </h2>
                  </div>
                  <span className="text-[10px] text-muted">满分 100</span>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-y-2 sm:grid-cols-4">
                  <StatisticItem
                    emphasized
                    icon={<ExamModeIcon className="size-4" mode="en-cn" />}
                    label="英-中"
                    unit="分"
                    value={statistics ? statistics.enCnAverageScore : "—"}
                  />
                  <StatisticItem
                    emphasized
                    icon={<ExamModeIcon className="size-4" mode="cn-en" />}
                    label="中-英"
                    unit="分"
                    value={statistics ? statistics.cnEnAverageScore : "—"}
                  />
                  <StatisticItem
                    emphasized
                    icon={<ExamModeIcon className="size-4" mode="dictation" />}
                    label="听写"
                    unit="分"
                    value={statistics ? statistics.dictationAverageScore : "—"}
                  />
                  <StatisticItem
                    emphasized
                    icon={<ExamModeIcon className="size-4" mode="speech" />}
                    label="语音"
                    unit="分"
                    value={statistics ? statistics.speechAverageScore : "—"}
                  />
                </div>
              </div>
            </div>
          </section>
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
              onOpen={(mode) => router.push(`/exam/${exam.id}?mode=${mode}`)}
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
