"use client";

import type { MonthCompletion, MonthValue, MonthlyData } from "@/types";

import { useCallback, useMemo, useState } from "react";
import {
  Button,
  Chip,
  Label,
  Card,
  ButtonGroup,
  Modal,
  NumberField,
  Checkbox,
  CheckboxGroup,
  Skeleton,
  Spinner,
  useOverlayState,
} from "@heroui/react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleCheckFill,
  CircleExclamationFill,
  CircleMinusFill,
  Gear,
  Plus,
} from "@gravity-ui/icons";

import RadialChartWithLegend from "@/components/radial-chart-with-legend";
import { saveLearntask } from "@/lib/api/modules/statistics";

type DayStatus = "pending" | "weekend" | "done" | "missed" | "warn" | "empty";

interface DayInfo {
  date: Date;
  inMonth: boolean;
  taskCount: number;
  doneCount: number;
  isWeekend: boolean;
  isFuture: boolean;
  status: DayStatus;
  label: string;
}

const WEEK_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

function isSameYM(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function buildGrid(
  cursor: Date,
  data: MonthlyData | undefined,
  today: Date,
): DayInfo[] {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const daysInMonth = last.getDate();

  const firstWeekIdx = (first.getDay() + 6) % 7;

  const taskTotal = data?.task?.count ?? 0;
  const weekendMode = data?.task?.weekend ?? 0;

  const weekendDays = new Set<number>();

  if (weekendMode > 0) {
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month, d).getDay();
      const include =
        (weekendMode === 1 && dow === 6) ||
        (weekendMode === 2 && dow === 0) ||
        (weekendMode === 3 && (dow === 0 || dow === 6));

      if (include) weekendDays.add(d);
    }
  }

  const workingDayCount = Math.max(1, daysInMonth - weekendDays.size);
  const quotient = taskTotal > 0 ? Math.floor(taskTotal / workingDayCount) : 0;
  let remainder = taskTotal > 0 ? taskTotal % workingDayCount : 0;

  const learnMap = new Map<string, number>();

  data?.statisticsLearns.forEach((s) => {
    learnMap.set(`${s.year}-${s.month}-${s.day}`, s.count);
  });

  const cells: DayInfo[] = [];

  for (let i = 0; i < firstWeekIdx; i++) {
    const d = new Date(year, month, -(firstWeekIdx - 1 - i));

    cells.push({
      date: d,
      inMonth: false,
      taskCount: 0,
      doneCount: 0,
      isWeekend: false,
      isFuture: d > today,
      status: "empty",
      label: "",
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const dateKey = `${year}-${month + 1}-${day}`;
    const doneCount = learnMap.get(dateKey) ?? 0;
    const isWeekend = weekendDays.has(day);

    let taskCount = 0;

    if (taskTotal > 0) {
      if (isWeekend) {
        taskCount = 0;
        remainder++;
      } else {
        taskCount = quotient + (remainder >= day ? 1 : 0);
      }
    }

    const isPast =
      d < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isToday = d.toDateString() === today.toDateString();
    const isFuture = d > today && !isToday;

    let status: DayStatus = "empty";
    let label = "";

    if (taskTotal === 0) {
      if (doneCount > 0) {
        status = "done";
        label = String(doneCount);
      }
    } else {
      label = doneCount > 0 ? `${doneCount}/${taskCount}` : String(taskCount);
      if (isWeekend) {
        status = "weekend";
      } else if (isPast || isToday) {
        if (doneCount >= taskCount) status = "done";
        else if (doneCount === 0) status = "missed";
        else status = "warn";
      } else if (taskCount > 0) {
        status = "pending";
      } else {
        // 未来日期但无任务量，则不显示
        status = "empty";
        label = "";
      }
    }

    cells.push({
      date: d,
      inMonth: true,
      taskCount,
      doneCount,
      isWeekend,
      isFuture,
      status,
      label,
    });
  }

  while (cells.length % 7 !== 0 || cells.length < 42) {
    const offset = cells.length - (firstWeekIdx + daysInMonth) + 1;
    const d = new Date(year, month + 1, offset);

    cells.push({
      date: d,
      inMonth: false,
      taskCount: 0,
      doneCount: 0,
      isWeekend: false,
      isFuture: d > today,
      status: "empty",
      label: "",
    });
  }

  return cells;
}

const STATUS_BAR: Record<DayStatus, string> = {
  pending: "bg-black/5 text-[#5e5e5e] dark:bg-white/5 dark:text-white/40",
  weekend: "bg-black/5 text-[#5e5e5e] dark:bg-white/5 dark:text-white/40",
  done: "bg-[#1FB89A] text-white",
  missed: "bg-[#FF6B3D] text-white",
  warn: "bg-[#F5B400] text-white",
  empty: "",
};

// const STATUS_Type: Record<DayStatus, string> = {
//   pending: "default",
//   weekend: "default",
//   done: "success",
//   missed: "danger",
//   warn: "warning",
//   empty: "",
// };

function DayCell({ cell, isToday }: { cell: DayInfo; isToday: boolean }) {
  const dimmed = !cell.inMonth;
  const showBar = cell.status !== "empty" && cell.label !== "";

  return (
    <div
      className={[
        "flex min-h-[60px] flex-col gap-0 rounded-lg ",
        dimmed ? "opacity-40" : "",
        isToday ? "today-bg" : "",
      ].join(" ")}
    >
      <div className="flex justify-center">
        <span
          className={[
            "flex h-7 w-7 items-center justify-center rounded-full text-sm tabular-nums",
            isToday
              ? " underline  text-primary font-extrabold decoration-2 underline-offset-2"
              : cell.isWeekend
                ? "font-semibold text-default-500"
                : "font-semibold text-default-800",
          ].join(" ")}
        >
          {cell.date.getDate()}
        </span>
      </div>
      {showBar ? (
        <div 
          className={`flex h-6 items-center  justify-center rounded-2xl px-1 text-[12px] font-medium tabular-nums taytask transition-transform hover:scale-[1.03] ${STATUS_BAR[cell.status]}`}
          title={`学习:${cell.doneCount} / 任务:${cell.taskCount}`}
        >
          {cell.label}
        </div>

        // <Chip
        //   color={STATUS_Type[cell.status]}
        //   size="md"
        //   variant="soft"
        //   className="flex justify-center"
        // >
        //   {cell.label}
        // </Chip>
      ) : (
        <div className="h-5" />
      )}
    </div>
  );
}

function weekendToArray(w: 0 | 1 | 2 | 3): string[] {
  if (w === 1) return ["sat"];
  if (w === 2) return ["sun"];
  if (w === 3) return ["sat", "sun"];

  return [];
}

function arrayToWeekend(arr: string[]): 0 | 1 | 2 | 3 {
  const hasSat = arr.includes("sat");
  const hasSun = arr.includes("sun");

  if (hasSat && hasSun) return 3;
  if (hasSat) return 1;
  if (hasSun) return 2;

  return 0;
}

interface CreateTaskButtonProps {
  taskCount?: number;
  weekendMode?: 0 | 1 | 2 | 3;
  cursorDate: Date;
  onSaved?: () => void;
  totalTask?: number;
  totalDone?: number;
}

function CreateTaskButton({
  taskCount = 0,
  weekendMode = 0,
  cursorDate,
  onSaved,
  totalTask = 0,
  totalDone = 0,
}: CreateTaskButtonProps) {
  const today = new Date();
  const isBeforeCurrentMonth =
    cursorDate.getFullYear() < today.getFullYear() ||
    (cursorDate.getFullYear() === today.getFullYear() &&
      cursorDate.getMonth() < today.getMonth());
  const state = useOverlayState();
  const [wordCount, setWordCount] = useState<number | null>(() =>
    taskCount > 0 ? taskCount : null,
  );
  const [weekend, setWeekend] = useState<string[]>(() =>
    weekendToArray(weekendMode),
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveLearntask({
        count: wordCount ?? 0,
        year: cursorDate.getFullYear(),
        month: cursorDate.getMonth() + 1,
        weekend: arrayToWeekend(weekend),
      });
      state.close();
      onSaved?.();
    } finally {
      setIsSaving(false);
    }
  };

  if (isBeforeCurrentMonth) {
    if (totalTask > 0 && totalDone >= totalTask) {
      return (
        <Chip
          className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
          size="lg"
        >
          <CircleCheckFill className="mr-1 inline-block size-3.5" />
          已完成
        </Chip>
      );
    }
    if (totalTask > 0 && totalDone < totalTask) {
      return (
        <Chip
          className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
          size="lg"
        >
          <CircleExclamationFill className="mr-1 inline-block size-3.5" />
          未完成
        </Chip>
      );
    }

    return (
      <Chip
        className="bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400"
        size="lg"
      >
        <CircleMinusFill className="mr-1 inline-block size-3.5" />
        无任务
      </Chip>
    );
  }

  return (
    <>
      <ButtonGroup
        className="[&>button]:md:h-10 [&>button]:md:px-4 [&>button]:md:text-base"
        size="sm"
        variant="primary"
      >
        <Button onPress={state.open}>
          {taskCount > 0 ? <Gear /> : <Plus />}
          任务
        </Button>
      </ButtonGroup>

      <Modal state={state}>
        <Modal.Backdrop isDismissable={false} variant="blur">
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
                  <Gear className="size-5" />
                </Modal.Icon>
                <Modal.Heading>设置任务</Modal.Heading>
                <p className="mt-1.5 text-sm leading-5 text-muted">
                  填写任务单词数量，平均分配至本月任务天数，存在余数时，从首日开始逐日顺次补加
                  1，直至任务全部分配完成。
                </p>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-5 py-2">
                <div className="grid grid-cols-[80px_1fr] items-center py-2 gap-3">
                  <label
                    className="text-sm text-foreground"
                    htmlFor="task-word-count"
                  >
                    单词数量
                  </label>

                  <NumberField
                    fullWidth
                    aria-label="单词数量"
                    maxValue={999}
                    minValue={0}
                    style={
                      {
                        "--field-border": "var(--border)",
                      } as React.CSSProperties
                    }
                    value={wordCount ?? NaN}
                    variant="secondary"
                    onChange={(v) => setWordCount(Number.isNaN(v) ? null : v)}
                  >
                    <NumberField.Group className="w-full flex">
                      <NumberField.Input
                        className="w-full"
                        id="task-word-count"
                        placeholder="输入任务单词数量"
                      />

                      {wordCount !== null && (
                        <button
                          aria-label="清空任务单词数量"
                          className="inline-flex items-center justify-center px-2 hover:opacity-70"
                          type="button"
                          onClick={() => setWordCount(null)}
                        >
                          <svg
                            height="16"
                            viewBox="0 0 16 16"
                            width="16"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              clipRule="evenodd"
                              d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14M6.53 5.47a.75.75 0 0 0-1.06 1.06L6.94 8L5.47 9.47a.75.75 0 1 0 1.06 1.06L8 9.06l1.47 1.47a.75.75 0 1 0 1.06-1.06L9.06 8l1.47-1.47a.75.75 0 1 0-1.06-1.06L8 6.94z"
                              fill="currentColor"
                              fillRule="evenodd"
                            />
                          </svg>
                        </button>
                      )}
                    </NumberField.Group>
                  </NumberField>
                </div>
                <div className="grid grid-cols-[80px_1fr] items-center gap-3">
                  <span className="text-sm text-foreground">排除周末</span>
                  <CheckboxGroup
                    aria-label="排除周末"
                    className="flex flex-row gap-4"
                    value={weekend}
                    onChange={setWeekend}
                  >
                    <Checkbox className="m-0" value="sat" variant="secondary">
                      <Checkbox.Control className="size-5 rounded-full before:rounded-full">
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <Checkbox.Content>
                        <Label>周六</Label>
                      </Checkbox.Content>
                    </Checkbox>
                    <Checkbox className="m-0" value="sun" variant="secondary">
                      <Checkbox.Control className="size-5 rounded-full before:rounded-full">
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <Checkbox.Content>
                        <Label>周日</Label>
                      </Checkbox.Content>
                    </Checkbox>
                  </CheckboxGroup>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button slot="close" variant="secondary">
                  取消
                </Button>
                <Button isDisabled={isSaving} onPress={handleSave}>
                  {isSaving ? "保存中..." : "保存"}
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}

export default function TaskCalendar({
  value,
  onChange,
  onShowYearView,
  monthlyData,
  yearStats,
  isLoading = false,
  onTaskSaved,
}: {
  value?: MonthValue;
  onChange?: (v: MonthValue) => void;
  onShowYearView?: (stats: MonthCompletion[]) => void;
  /** 来自接口的月度数据，未传入时以空数据渲染 */
  monthlyData?: MonthlyData;
  /** 年历各月完成情况，未传入时展示空 */
  yearStats?: MonthCompletion[];
  /** 是否正在加载数据，为 true 时显示骨架屏动画 */
  isLoading?: boolean;
  /** 任务保存成功后的回调，通常用于触发父组件刷新数据 */
  onTaskSaved?: () => void;
} = {}) {
  const today = useMemo(() => new Date(), []);
  const [innerCursor, setInnerCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const cursor = useMemo(
    () => (value ? new Date(value.year, value.month - 1, 1) : innerCursor),
    [innerCursor, value],
  );
  const setCursor = useCallback(
    (next: Date | ((prev: Date) => Date)) => {
      const resolved =
        typeof next === "function" ? (next as (p: Date) => Date)(cursor) : next;

      if (value) {
        onChange?.({
          year: resolved.getFullYear(),
          month: resolved.getMonth() + 1,
        });
      } else {
        setInnerCursor(resolved);
      }
    },
    [cursor, onChange, value],
  );

  // 月度数据：仅使用接口数据，无数据时返回空结构
  const data: MonthlyData = useMemo(() => {
    if (monthlyData) return monthlyData;

    return {
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
      task: null,
      statisticsLearns: [],
    };
  }, [monthlyData, cursor]);

  const cells = useMemo(
    () => buildGrid(cursor, data, today),
    [cursor, data, today],
  );

  const goPrev = () =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  const goNext = () =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  const goToday = () =>
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));

  const monthLabel = `${cursor.getFullYear()}年${cursor.getMonth() + 1}月`;
  const isCurrentMonth = isSameYM(cursor, today);

  // stats summary
  const totals = useMemo(() => {
    let task = 0;
    let done = 0;

    cells.forEach((c) => {
      if (!c.inMonth) return;
      task += c.taskCount;
      done += c.doneCount;
    });

    return { task, done };
  }, [cells]);

  return (
    <div className="flex flex-col gap-4">
      <Card.Header className="flex-row items-center justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div className="flex flex-col gap-2">
              <ButtonGroup
                className="[&>button]:md:h-10 [&>button]:md:px-4 [&>button]:md:text-base"
                size="sm"
                variant="primary"
              >
                <Button onPress={goPrev}>
                  <ChevronLeft />
                </Button>

                <Button
                  aria-label="选择月份"
                  onPress={() => onShowYearView?.(yearStats ?? [])}
                >
                  <ButtonGroup.Separator />
                  <span className="text-sm font-medium">{monthLabel}</span>
                </Button>
                <Button onPress={goNext}>
                  <ButtonGroup.Separator />
                  <ChevronRight />
                </Button>

                {!isCurrentMonth && (
                  <Button aria-label="回到本月" onPress={goToday}>
                    <ButtonGroup.Separator />
                    <Calendar />
                  </Button>
                )}
              </ButtonGroup>
            </div>

            {/* <Button
              className="ml-1"
              isDisabled={isCurrentMonth}
              size="sm"
              variant="ghost"
              onPress={goToday}
            >
              今天
            </Button> */}
          </div>
          {/* <div className="w-[88px]" aria-hidden /> */}
        </div>

        <div className="flex items-center gap-2">
          <CreateTaskButton
            key={`${cursor.getFullYear()}-${cursor.getMonth()}-${data.task?.count ?? 0}-${data.task?.weekend ?? 0}`}
            cursorDate={cursor}
            taskCount={data.task?.count}
            totalDone={totals.done}
            totalTask={totals.task}
            weekendMode={data.task?.weekend}
            onSaved={onTaskSaved}
          />
        </div>
      </Card.Header>

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="w-full rounded-2xl">
          <div className="mb-2 grid grid-cols-7 gap-2">
            {WEEK_LABELS.map((w) => (
              <div
                key={w}
                className="text-center text-xs font-medium tracking-wide text-default-500"
              >
                {w}
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="relative">
              <div aria-hidden className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div
                    key={`calendar-skeleton-${i}`}
                    className="flex flex-col gap-1"
                  >
                    <Skeleton className="mx-auto h-7 w-7 rounded-full" />
                    <Skeleton className="h-6 w-full rounded-md" />
                  </div>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <Spinner aria-label="加载中" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {(() => {
                const rows: DayInfo[][] = [];

                for (let r = 0; r < cells.length / 7; r++) {
                  rows.push(cells.slice(r * 7, r * 7 + 7));
                }

                return rows
                  .filter((row) => row.some((c) => c.inMonth))
                  .flat()
                  .map((cell) => (
                    <DayCell
                      key={cell.date.toISOString()}
                      cell={cell}
                      isToday={
                        cell.date.toDateString() === today.toDateString()
                      }
                    />
                  ));
              })()}
            </div>
          )}
        </Card>

        {/* <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-1 text-[11px] text-default-500">
          <Legend color="#FF6B3D" label="待完成" />
          <Legend color="#F5B400" label="部分完成" />
          <Legend color="#1FB89A" label="已完成 / 休" />
        </div> */}

        {isLoading ? (
          <Card className="flex items-center justify-center rounded-2xl">
            <Skeleton className="h-48 w-48 rounded-full" />
          </Card>
        ) : (
          <RadialChartWithLegend
            monthValue={{
              year: cursor.getFullYear(),
              month: cursor.getMonth() + 1,
            }}
            monthlyData={data}
          />
        )}
      </div>
    </div>
  );
}
