"use client";

import { Button, Popover, Card, Chip, ButtonGroup } from "@heroui/react";

import { ReactNode, useMemo, useState } from "react";

import { ChevronLeft, ChevronRight } from "@gravity-ui/icons";

import BarChartComparisonDemo from "@/components/bar-chart-comparison-demo";
import AreaChartMultiAreaDemo from "@/components/area-chart-multi-area-demo";

export interface MonthValue {
  year: number;
  month: number; // 1-12
}

export interface MonthCompletion {
  year: number;
  month: number; // 1-12
  /** Completion percentage 0-100. `null` means no data ("-"). */
  percent: number | null;
}

interface JeDatePickerProps {
  value?: MonthValue;
  defaultValue?: MonthValue;
  onChange?: (value: MonthValue) => void;
  /** Optional per-month statistics rendered below each month label. */
  stats?: MonthCompletion[];
  /** Minimum / maximum selectable year. */
  minYear?: number;
  maxYear?: number;
  /** Label shown on the trigger button. Receives the current value. */
  formatTrigger?: (v: MonthValue) => string;
  className?: string;
  /** Custom trigger element rendered inside Popover.Trigger. */
  children?: ReactNode;
  /** Called when user clicks “详情” to request switching back to month view. */
  onShowMonthView?: () => void;
  /** Render content directly (no Popover) when true. Default false. */
  inline?: boolean;
}

const DEFAULT_TRIGGER_FORMAT = (v: MonthValue) => `${v.year}年${v.month}月`;

function getPercentColor(p: number | null | undefined): string {
  if (p === null || p === undefined) return "text-default-400";
  if (p === 0) return "text-danger";
  //if (p < 50) return "text-warning";
  if (p < 100) return "text-warning";
  return "text-success";
}

function formatPercent(p: number | null | undefined): string {
  if (p === null || p === undefined) return "-";
  return `${p}%`;
}

export default function TaskYearCalendar({
  value,
  defaultValue,
  onChange,
  stats,
  minYear = 1970,
  maxYear = 2100,
  formatTrigger = DEFAULT_TRIGGER_FORMAT,
  className,
  children,
  onShowMonthView,
  inline = false,
}: JeDatePickerProps) {
  const today = useMemo(() => new Date(), []);
  const initial: MonthValue = value ??
    defaultValue ?? { year: today.getFullYear(), month: today.getMonth() + 1 };

  const [inner, setInner] = useState<MonthValue>(initial);
  const current = value ?? inner;

  // Panel-local navigation state (year being browsed) + draft selection
  const [open, setOpen] = useState(false);
  const [panelYear, setPanelYear] = useState<number>(current.year);
  const [draft, setDraft] = useState<MonthValue>(current);

  const statsMap = useMemo(() => {
    const m = new Map<string, number | null>();
    stats?.forEach((s) => m.set(`${s.year}-${s.month}`, s.percent));
    return m;
  }, [stats]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setPanelYear(current.year);
      setDraft(current);
    }
  };

  const commit = (v: MonthValue) => {
    if (value === undefined) setInner(v);
    onChange?.(v);
  };

  const handleConfirm = () => {
    commit(draft);
    setOpen(false);
  };

  const handleThisMonth = () => {
    const v = { year: today.getFullYear(), month: today.getMonth() + 1 };
    setPanelYear(v.year);
    setDraft(v);
    commit(v);
    setOpen(false);
  };

  const canPrev = panelYear > minYear;
  const canNext = panelYear < maxYear;

  const content = (
    <Card className="" variant="secondary">
      <Card.Header className="flex-row items-center justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div className="flex flex-col gap-2">
              <ButtonGroup variant="primary">
                <Button onPress={() => canPrev && setPanelYear((y) => y - 1)}>
                  <ChevronLeft />
                </Button>
                <Button>
                  <ButtonGroup.Separator />
                  <div className="text-sm font-medium text-default-700">
                    {panelYear}年
                  </div>
                </Button>
                <Button onPress={() => canNext && setPanelYear((y) => y + 1)}>
                  <ButtonGroup.Separator />
                  <ChevronRight />
                </Button>
              </ButtonGroup>
            </div>
          </div>
          <div className="w-[88px]" aria-hidden />
        </div>
      </Card.Header>

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="w-full rounded-2xl">
          {/* Months grid */}
          <div className="grid grid-cols-3 gap-1 p-3">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const selected = draft.year === panelYear && draft.month === m;
              const isThisMonth =
                panelYear === today.getFullYear() && m === today.getMonth() + 1;
              const percent = statsMap.get(`${panelYear}-${m}`);
              return (
                <div key={m} className="flex justify-center">
                  <button
                    aria-pressed={selected}
                    className={[
                      "relative flex w-16 flex-col items-center gap-0.5 rounded-[var(--radius)] border px-2 py-2 text-sm",
                      "transition-all duration-200 ease-out",
                      "focus-visible:ring-accent/40 focus-visible:ring-2 focus-visible:outline-none",
                      selected
                        ? "border-accent/50 bg-accent/10 text-accent font-semibold"
                        : "border-transparent text-default-700 hover:border-default-200 hover:bg-default-100",
                    ].join(" ")}
                    type="button"
                    onClick={() => setDraft({ year: panelYear, month: m })}
                  >
                    <span
                      className={`tabular-nums ${
                        selected
                          ? "text-accent"
                          : isThisMonth
                            ? "text-primary"
                            : ""
                      }`}
                    >
                      {m}月
                    </span>
                    <span
                      className={`text-[11px] tabular-nums ${
                        selected ? "text-accent/80" : getPercentColor(percent)
                      }`}
                    >
                      {formatPercent(percent)}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer actions */}
          <div className="flex  gap-3 px-2 py-2">
           
            <Button
              onPress={() => {
                handleConfirm();
                onShowMonthView?.();
              }}
            >
              详情
            </Button>

             <Button variant="secondary" onPress={handleThisMonth}>
              本月
            </Button>
          </div>
        </Card>

        <AreaChartMultiAreaDemo />
      </div>
    </Card>
  );

  if (inline) return content;

  return (
    <Popover isOpen={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger>
        {children ?? (
          <Button className={className} size="sm" variant="primary">
            {formatTrigger(current)}
          </Button>
        )}
      </Popover.Trigger>
      <Popover.Content className="w-auto p-0">
        <Popover.Dialog className="p-0">{content}</Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
