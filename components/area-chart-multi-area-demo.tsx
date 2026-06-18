"use client";

import type { MonthlyData } from "@/types";

import { useMemo } from "react";
import { Card } from "@heroui/react";
import { AreaChart } from "@heroui-pro/react";

export interface AreaChartMultiAreaDemoProps {
  /** 缓存的全部月度数据（来自 StatisticsLearnCountTwo 接口） */
  monthlyList?: MonthlyData[];
  /** 要展示的年份，默认当前年 */
  year?: number;
}

interface MonthChartItem {
  [key: string]: string | number;
  month: string;
  /** 当月已完成数量（statisticsLearns 求和） */
  done: number;
  /** 当月任务总数（无任务则为 0） */
  task: number;
}

function buildYearData(
  year: number,
  monthlyList: MonthlyData[],
): MonthChartItem[] {
  const indexed = new Map<number, MonthlyData>();

  monthlyList.forEach((m) => {
    if (m.year === year) indexed.set(m.month, m);
  });

  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const data = indexed.get(month);
    const done =
      data?.statisticsLearns.reduce((sum, s) => sum + (s.count ?? 0), 0) ?? 0;
    const task = data?.task?.count ?? 0;

    return { month: String(month), done, task };
  });
}

export default function AreaChartMultiAreaDemo({
  monthlyList = [],
  year,
}: AreaChartMultiAreaDemoProps = {}) {
  const currentYear = year ?? new Date().getFullYear();

  const chartData = useMemo(
    () => buildYearData(currentYear, monthlyList),
    [currentYear, monthlyList],
  );

  const totals = useMemo(() => {
    let done = 0;
    let task = 0;

    chartData.forEach((d) => {
      done += d.done;
      task += d.task;
    });
    const rate = task > 0 ? Math.floor((done / task) * 100) : 0;

    return { done, task, rate };
  }, [chartData]);

  return (
    <Card className="w-full  rounded-2xl">
      <Card.Header className="flex-row items-center justify-between">
        <Card.Title className="text-base">{currentYear}年任务明细</Card.Title>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className="size-3 rounded-full"
              style={{ backgroundColor: "var(--chart-3)" }}
            />
            <span className="text-muted text-xs">已学习</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="size-3 rounded-full"
              style={{ backgroundColor: "var(--chart-1)" }}
            />
            <span className="text-muted text-xs">任务量</span>
          </div>
        </div>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <div className="flex flex-col">
          <span className="text-foreground text-lg font-semibold">
            {totals.done.toLocaleString()} / {totals.task.toLocaleString()}
            <span className="text-muted ml-2 text-sm font-normal">
              （{totals.rate}%）
            </span>
          </span>
          <span className="text-muted text-xs">年任务完成率</span>
        </div>
        <AreaChart data={chartData} height={200}>
          <defs>
            <linearGradient id="organic-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.2} />
              <stop
                offset="100%"
                stopColor="var(--chart-3)"
                stopOpacity={0.02}
              />
            </linearGradient>
            <linearGradient id="paidads-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.2} />
              <stop
                offset="100%"
                stopColor="var(--chart-1)"
                stopOpacity={0.02}
              />
            </linearGradient>
          </defs>
          <AreaChart.Grid vertical={false} />
          <AreaChart.XAxis
            dataKey="month"
            tickFormatter={(v: string) => `${v}月`}
            tickMargin={8}
          />
          <AreaChart.YAxis
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`
            }
            width={36}
          />
          <AreaChart.Area
            dataKey="done"
            dot={false}
            fill="url(#organic-fill)"
            name="已学习"
            stroke="var(--chart-3)"
            strokeWidth={2}
            type="monotone"
          />
          <AreaChart.Area
            dataKey="task"
            dot={false}
            fill="url(#paidads-fill)"
            name="任务量"
            stroke="var(--chart-1)"
            strokeWidth={2}
            type="monotone"
          />
          <AreaChart.Tooltip content={<AreaChart.TooltipContent />} />
        </AreaChart>
      </Card.Content>
    </Card>
  );
}
