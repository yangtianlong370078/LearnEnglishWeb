"use client";
import type { ReactNode } from "react";
import type { WordStats } from "@/types";
import type { MonthlyData } from "@/types/task";

import { useMemo, useState } from "react";
import { SquareChartBar, Target } from "@gravity-ui/icons";
import {
  KPI,
  TrendChip,
  ChartTooltip,
  PieChart,
  Segment,
} from "@heroui-pro/react";
import { Skeleton } from "@heroui/react";

const CHART_COLORS = [
  "var(--chart-4)",
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-1)",
];

function PieTooltip({
  active,
  payload,
  total = 0,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    payload?: { fill?: string };
    value?: number | string;
  }>;
  total?: number;
  valueFormatter?: (value: number | string) => ReactNode;
}) {
  const entry = payload?.[0];
  if (!active || !entry) return null;
  const percent = total > 0 ? ((Number(entry.value) || 0) / total) * 100 : 0;
  return (
    <ChartTooltip>
      <ChartTooltip.Item className="flex items-center  gap-2">
        <ChartTooltip.Indicator color={entry.payload?.fill} />
        <ChartTooltip.Label className="min-w-[100px]">
          {entry.name} ({percent.toFixed(1)}%)
        </ChartTooltip.Label>
        <ChartTooltip.Value className="min-w-[40px] text-right">
          {entry.value} 个
        </ChartTooltip.Value>
      </ChartTooltip.Item>
    </ChartTooltip>
  );
}

interface KpiWithChartInlineProps {
  /** 来自接口的统计数据，未传入时展示骨架屏 */
  stats?: WordStats;
  /** 缓存的全部月度数据，用于计算近60天趋势 */
  monthlyList?: MonthlyData[];
}

const PERIOD_DAYS: Record<"7D" | "15D" | "30D", number> = {
  "7D": 7,
  "15D": 15,
  "30D": 30,
};

export default function KpiWithChartInline({
  stats,
  monthlyList,
}: KpiWithChartInlineProps = {}) {
  const [selectedPeriod, setSelectedPeriod] = useState<"7D" | "15D" | "30D">(
    "15D",
  );

  // 从 monthlyList 中提取每日 count，根据所选周期计算环比趋势
  const { lastTotal, prevTotal, sparklineData } = useMemo(() => {
    const days = PERIOD_DAYS[selectedPeriod];
    const todayDate = new Date();
    const todayStart = new Date(
      todayDate.getFullYear(),
      todayDate.getMonth(),
      todayDate.getDate(),
    );

    const countMap = new Map<string, number>();

    monthlyList?.forEach((m) => {
      m.statisticsLearns.forEach((sl) => {
        const key = `${sl.year}-${sl.month}-${sl.day}`;

        countMap.set(key, (countMap.get(key) ?? 0) + sl.count);
      });
    });

    let last = 0;
    let prev = 0;
    const points: Array<{ value: number }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(todayStart);

      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      const count = countMap.get(key) ?? 0;

      last += count;
      points.push({ value: count });
    }

    for (let i = days * 2 - 1; i >= days; i--) {
      const d = new Date(todayStart);

      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

      prev += countMap.get(key) ?? 0;
    }

    return { lastTotal: last, prevTotal: prev, sparklineData: points };
  }, [monthlyList, selectedPeriod]);

  const growthRate = useMemo(() => {
    if (lastTotal === 0) return 0;

    return parseFloat((((lastTotal - prevTotal) / lastTotal) * 100).toFixed(1));
  }, [lastTotal, prevTotal]);

  // 骨架屏：首次加载尚未获取到真实数据时展示
  if (!stats) {
    return (
      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        <Skeleton className="h-[160px] w-full rounded-xl" />
        <Skeleton className="h-[160px] w-full rounded-xl" />
      </div>
    );
  }

  const s = stats;
  const isUp = growthRate >= 0;

  const isTodayUp = s.growthRate >= 0;

  const pieTotal = s.masteredCount + s.unskilledCount + s.reinforcementCount;

  const pieData = [
    { name: "已掌握", value: s.masteredCount },
    { name: "未熟练", value: s.unskilledCount },
    { name: "强化中", value: s.reinforcementCount },
  ];

  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
        <KPI className=" backdrop-blur-xl backdrop-saturate-150">
          <KPI.Content className="grid-cols-[1fr_1fr] items-end">
            <div className="flex flex-col justify-between h-full gap-2 ">
              <KPI.Header className="w-max">
                <SquareChartBar className="text-muted size-4" />
                <KPI.Title>学习统计图</KPI.Title>
              </KPI.Header>

              <div className="flex flex-col gap-1">
                <KPI.Value
                  className="text-3xl"
                  maximumFractionDigits={0}
                  value={s.masteredCount + s.unskilledCount}
                />

                <div className="flex items-center ">
                  <span
                    className="trend-chip__suffix text-xs min-w-fit"
                    data-slot="trend-chip-suffix"
                  >
                    日均增长
                  </span>

                  <TrendChip
                    trend={isTodayUp ? "up" : "down"}
                    variant="tertiary"
                  >
                    {Math.abs(s.growthRate).toFixed(1)}%
                    {/* <TrendChip.Suffix>今天学习{s.todayCount}</TrendChip.Suffix> */}
                    {/* <TrendChip.Suffix>日均增长率</TrendChip.Suffix> */}
                  </TrendChip>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end w-full">
              <div className="flex items-center justify-center w-full gap-2 sm:gap-6">
                <PieChart
                  className="flex items-center justify-center w-1/2 "
                  height={104}
                  width={104}
                >
                  <PieChart.Pie
                    cx="50%"
                    cy="50%"
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={50}
                  >
                    {pieData.map((entry, idx) => (
                      <PieChart.Cell
                        key={entry.name}
                        fill={CHART_COLORS[idx % CHART_COLORS.length]}
                      />
                    ))}
                  </PieChart.Pie>
                  <PieChart.Tooltip content={<PieTooltip total={pieTotal} />} />
                </PieChart>

                <div className="flex flex-1 flex-col gap-3 w-max max-w-[100px]">
                  {pieData.map((entry, idx) => {
                    return (
                      <div key={entry.name} className="flex items-center gap-1">
                        <span
                          className="size-3 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              CHART_COLORS[idx % CHART_COLORS.length],
                          }}
                        />
                        <div className="flex flex-1 items-center justify-between">
                          <span className="text-foreground text-sm">
                            {entry.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-foreground text-sm font-semibold">
                              {entry.value}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </KPI.Content>
        </KPI>

        <KPI className=" backdrop-blur-xl backdrop-saturate-150 ">
          <KPI.Header className="justify-between">
            <div className="flex items-center gap-2">
              <Target className="text-muted size-4" />
              <KPI.Title>学习趋势图</KPI.Title>
            </div>
            {/* 
bg-[var(--background)] */}

            <Segment
              className="absolute right-3.5 top-3.5 bg-white/50 dark:bg-black/30 "
              selectedKey={selectedPeriod}
              size="sm"
              onSelectionChange={(value) => {
                setSelectedPeriod(value as "7D" | "15D" | "30D");
              }}
            >
              <Segment.Item id="7D">7天</Segment.Item>
              <Segment.Item id="15D">15天</Segment.Item>
              <Segment.Item id="30D">30天</Segment.Item>
            </Segment>
          </KPI.Header>
          <KPI.Content className="grid-cols-[1fr_1fr] items-end">
            <div className="flex flex-col gap-1">
              <KPI.Value
                className="text-3xl"
                maximumFractionDigits={0}
                value={lastTotal}
              />
              <div className="flex items-center ">
                <span
                  className="trend-chip__suffix text-xs min-w-fit"
                  data-slot="trend-chip-suffix"
                >
                  环比过去{PERIOD_DAYS[selectedPeriod]}天
                </span>

                <TrendChip trend={isUp ? "up" : "down"} variant="tertiary">
                  {Math.abs(growthRate).toFixed(1)}%
                  {/* <TrendChip.Suffix>环比过去{PERIOD_DAYS[selectedPeriod]}天</TrendChip.Suffix> */}
                </TrendChip>
              </div>
            </div>
            <KPI.Chart
              color={isUp ? "var(--color-accent)" : "var(--color-danger)"}
              data={sparklineData}
              height={70}
              strokeWidth={1.5}
            />
          </KPI.Content>
        </KPI>
    </div>
  );
}
