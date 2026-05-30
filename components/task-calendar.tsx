"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Label,
  Card,
  ButtonGroup,
  Modal,
  NumberField,
  Checkbox,
  CheckboxGroup,
  useOverlayState,
} from "@heroui/react";

import RadialChartWithLegend from "@/components/radial-chart-with-legend";

import { ChevronLeft, ChevronRight, Gear, Plus } from "@gravity-ui/icons";

import JeDatePicker from "./task-year-calendar";
import type { MonthCompletion, MonthValue, MonthlyData } from "@/types";

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
      label = doneCount > 0 ? `${taskCount}/${doneCount}` : String(taskCount);
      if (isWeekend) {
        status = "weekend";
      } else if (isPast || isToday) {
        if (doneCount >= taskCount) status = "done";
        else if (doneCount === 0) status = "missed";
        else status = "warn";
      } else {
        status = "pending";
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
  pending: "bg-[#FF6B3D] text-white",
  weekend: "bg-[#1FB89A] text-white",
  done: "bg-[#1FB89A] text-white",
  missed: "bg-[#FF6B3D] text-white",
  warn: "bg-[#F5B400] text-white",
  empty: "",
};

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}

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
              ? "font-extrabold text-primary underline decoration-2 underline-offset-2"
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
          className={`flex h-6 items-center justify-center rounded-md px-1 text-[11px] font-medium tabular-nums shadow-sm transition-transform hover:scale-[1.03] ${STATUS_BAR[cell.status]}`}
          title={`任务: ${cell.taskCount} / 完成: ${cell.doneCount}`}
        >
          {cell.label}
        </div>
      ) : (
        <div className="h-6" />
      )}
    </div>
  );
}

function CreateTaskButton() {
  const state = useOverlayState();
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [weekend, setWeekend] = useState<string[]>([]);

  const handleSave = () => {
    // TODO: 将 wordCount / weekend 传出去
    state.close();
  };

  return (
    <>
      <Button variant="primary" onPress={state.open}>
        <Plus />
        任务
      </Button>
      <Modal state={state}>
        <Modal.Backdrop variant="blur" isDismissable={false}>
          <Modal.Container placement="center" size="md">
            <Modal.Dialog>
              <Modal.Header>
                
                <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
                <Gear className="size-5" />
              </Modal.Icon>
              <Modal.Heading>设置任务</Modal.Heading>
              <p className="mt-1.5 text-sm leading-5 text-muted">
                填写任务单词数量，平均分配至本月任务天数，存在余数时，从首日开始逐日顺次补加 1，直至任务全部分配完成。
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
                    aria-label="单词数量"
                    minValue={0}
                    fullWidth
                    value={wordCount ?? NaN}
                    onChange={(v) => setWordCount(Number.isNaN(v) ? null : v)}
                    style={
                      {
                        "--field-border": "var(--border)",
                      } as React.CSSProperties
                    }
                  >
                    <NumberField.Group className="w-full flex">
                      <NumberField.Input
                        id="task-word-count"
                        placeholder="输入任务单词数量"
                        className="w-full"
                      />
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
                    <Checkbox value="sat" className="m-0" variant="secondary">
                      <Checkbox.Control className="size-5 rounded-full before:rounded-full">
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <Checkbox.Content>
                        <Label>周六</Label>
                      </Checkbox.Content>
                    </Checkbox>
                    <Checkbox value="sun" className="m-0" variant="secondary">
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
              <Button onPress={handleSave}>保存</Button>
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
}: {
  value?: MonthValue;
  onChange?: (v: MonthValue) => void;
  onShowYearView?: (stats: MonthCompletion[]) => void;
  /** 来自接口的月度数据，未传入时使用示例数据 */
  monthlyData?: MonthlyData;
  /** 年历各月完成情况，未传入时展示空 */
  yearStats?: MonthCompletion[];
} = {}) {
  const today = useMemo(() => new Date(), []);
  const [innerCursor, setInnerCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const cursor = value ? new Date(value.year, value.month - 1, 1) : innerCursor;
  const setCursor = (next: Date | ((prev: Date) => Date)) => {
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
  };

  // 月度数据：使用外部传入的接口数据，无则回退示例数据
  const data: MonthlyData = useMemo(() => {
    if (monthlyData) return monthlyData;
    const y = cursor.getFullYear();
    const m = cursor.getMonth() + 1;
    return {
      year: y,
      month: m,
      task: { count: 50, weekend: 3 },
      statisticsLearns: [
        { year: y, month: m, day: 1, count: 2 },
        { year: y, month: m, day: 2, count: 2 },
        { year: y, month: m, day: 3, count: 2 },
        { year: y, month: m, day: 4, count: 2 },
        { year: y, month: m, day: 6, count: 2 },
        { year: y, month: m, day: 7, count: 2 },
        { year: y, month: m, day: 8, count: 2 },
        { year: y, month: m, day: 9, count: 2 },
        { year: y, month: m, day: 10, count: 2 },
        { year: y, month: m, day: 11, count: 2 },
        { year: y, month: m, day: 13, count: 2 },
        { year: y, month: m, day: 20, count: 32 },
        { year: y, month: m, day: 22, count: 3 },
        { year: y, month: m, day: 28, count: 1 },
      ],
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
    <Card className="" variant="secondary">
      <Card.Header className="flex-row items-center justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div className="flex flex-col gap-2">
              <ButtonGroup variant="primary">
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
              </ButtonGroup>
            </div>

            <Button
              className="ml-1"
              isDisabled={isCurrentMonth}
              size="sm"
              variant="ghost"
              onPress={goToday}
            >
              今天
            </Button>
          </div>
          {/* <div className="w-[88px]" aria-hidden /> */}
        </div>

        <div className="flex items-center gap-2">
          <CreateTaskButton />
        </div>

        {/* <div className="flex items-center gap-2">
            <Chip color="success" size="sm" variant="soft">
              已完成 {totals.done}
            </Chip>
            <Chip color="warning" size="sm" variant="soft">
              待完成 {Math.max(0, totals.task - totals.done)}
            </Chip>
          </div> */}
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

          <div className="grid grid-cols-7 gap-2">
            {(() => {
              const rows: DayInfo[][] = [];
              for (let r = 0; r < cells.length / 7; r++) {
                rows.push(cells.slice(r * 7, r * 7 + 7));
              }
              return rows
                .filter((row) => row.some((c) => c.inMonth))
                .flat()
                .map((cell, i) => (
                  <DayCell
                    key={i}
                    cell={cell}
                    isToday={cell.date.toDateString() === today.toDateString()}
                  />
                ));
            })()}
          </div>
        </Card>

        {/* <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-1 text-[11px] text-default-500">
          <Legend color="#FF6B3D" label="待完成" />
          <Legend color="#F5B400" label="部分完成" />
          <Legend color="#1FB89A" label="已完成 / 休" />
        </div> */}

        <RadialChartWithLegend />
      </div>
    </Card>
  );
}
