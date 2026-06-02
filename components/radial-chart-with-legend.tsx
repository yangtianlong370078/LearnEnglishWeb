"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";

import { Card } from "@heroui/react";
import { ChartTooltip, RadialChart } from "@heroui-pro/react";

import type { MonthValue, MonthlyData } from "@/types";



const CHART_COLOR_TIME = "var(--chart-2)";
const CHART_COLOR_TASK = "var(--chart-3)";

interface RadialTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    payload?: Record<string, unknown>;
    value?: number | string;
  }>;
  valueFormatter?: (value: number | string) => ReactNode;
}

function RadialTooltip({ payload, valueFormatter }: RadialTooltipProps) {
  const entry = payload?.[0];

  if (!entry?.payload) return null;

  const name = (entry.payload["name"] as string) ?? entry.name;
  const value = (entry.payload["value"] as number) ?? entry.value;
  const fill = entry.payload["fill"] as string;

  return (
    <ChartTooltip>
      <ChartTooltip.Item>
        <ChartTooltip.Indicator color={fill} />
        <ChartTooltip.Label>{name}</ChartTooltip.Label>
        <ChartTooltip.Value>
          {valueFormatter && value != null ? valueFormatter(value) : value}
        </ChartTooltip.Value>
      </ChartTooltip.Item>
    </ChartTooltip>
  );
}

function calcTimeProgress(selected: MonthValue, today: Date): number {
  const selYear = selected.year;
  const selMonth = selected.month;
  const curYear = today.getFullYear();
  const curMonth = today.getMonth() + 1;

  if (selYear > curYear || (selYear === curYear && selMonth > curMonth)) {
    return 0;
  }
  if (selYear < curYear || (selYear === curYear && selMonth < curMonth)) {
    return 100;
  }
  const daysInMonth = new Date(curYear, curMonth, 0).getDate();

  return Math.floor((today.getDate() / daysInMonth) * 100);
}

export interface RadialChartWithLegendProps {
  monthValue?: MonthValue;
  monthlyData?: MonthlyData;
}

export default function RadialChartWithLegend({
  monthValue,
  monthlyData,
}: RadialChartWithLegendProps = {}) {
  const today = useMemo(() => new Date(), []);

  const current: MonthValue = monthValue ?? {
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  };

  const totalCount = useMemo(
    () =>
      monthlyData?.statisticsLearns.reduce(
        (sum, s) => sum + (s.count ?? 0),
        0,
      ) ?? 0,
    [monthlyData],
  );

  const taskCount = monthlyData?.task?.count ?? 0;
  const hasTask = taskCount > 0;

  const timeProgress = useMemo(
    () => calcTimeProgress(current, today),
    [current, today],
  );

  const taskProgress = hasTask
    ? Math.min(100, Math.floor((totalCount / taskCount) * 100))
    : 0;

  const chartData = useMemo(() => {
    // RadialChart 中数组首项位于内环，末项位于外环。
    // 需求：外环=时间进度，内环=任务进度。
    const list: { fill: string; name: string; value: number }[] = [];

    if (hasTask) {
      list.push({
        fill: CHART_COLOR_TASK,
        name: "任务完成",
        value: taskProgress,
      });
    }
    list.push({ fill: CHART_COLOR_TIME, name: "时间进度", value: timeProgress });

    return list;
  }, [timeProgress, taskProgress, hasTask]);

  const remain = hasTask ? Math.max(0, taskCount - totalCount) : 0;
  const description = hasTask
    ? `任务${taskCount}；已学习${totalCount}；还剩${remain}`
    : `已学习${totalCount}；本月未设置任务`;

  return (
    <Card className="w-full rounded-2xl">
      <Card.Header>
        <Card.Title className="text-base">任务明细</Card.Title>
        <Card.Description className="text-muted text-xs">
          {description}
        </Card.Description>

       
      </Card.Header>
      <Card.Content className="grid place-items-center min-h-[320px]">
        <div className="relative shrink-0">
          <RadialChart
            data={chartData}
            height={220}
            innerRadius="50%"
            outerRadius="100%"
            width={220}
          >
            <RadialChart.AngleAxis angleAxisId={0} domain={[0, 100]} tick={false} type="number" />
            <RadialChart.Bar
              background
              angleAxisId={0}
              barSize={16}
              cornerRadius={12}
              dataKey="value"
            />
            <RadialChart.Tooltip
              content={<RadialTooltip valueFormatter={(v) => `${v} %`} />}
            />
          </RadialChart>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {hasTask ? (
              <>
                <span className="text-foreground text-xl font-bold">
                  {totalCount}/{taskCount}
                </span>
                <span className="text-muted text-xs">任务完成率</span>
              </>
            ) : (
              <>
                <span className="text-foreground text-xl font-bold">
                  {timeProgress}%
                </span>
                <span className="text-muted text-xs">时间进度</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3">
          {chartData.map((entry) => (
            <div key={entry.name} className="flex items-center gap-3">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: entry.fill }}
              />
              <div className="flex flex-1 items-center justify-between">
                <span className="text-foreground text-sm">{entry.name} </span>
                <span className="text-foreground text-sm font-semibold">
                  {entry.value}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card.Content>
    </Card>
  );
}