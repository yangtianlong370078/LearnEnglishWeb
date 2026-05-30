"use client";

import { SquareChartBar, Target } from "@gravity-ui/icons";
import { KPI, TrendChip, ChartTooltip, PieChart } from "@heroui-pro/react";
import type { ReactNode } from "react";
import type { WordStats } from "@/types";

const CHART_COLORS = [
  "var(--chart-4)",
  "var(--chart-3)",
  "var(--chart-2)",
  "var(--chart-1)",
];

/** 示例数据（未对接接口时使用） */
const DEMO_STATS: WordStats = {
  masteredCount: 19,
  learningCount: 10,
  reviewingCount: 9,
  totalCount: 38,
  weeklyStudied: 25,
  completionRate: 0.423,
};

const sparklineUp = [
  { value: 30 },
  { value: 35 },
  { value: 28 },
  { value: 42 },
  { value: 38 },
  { value: 45 },
  { value: 50 },
  { value: 48 },
  { value: 55 },
  { value: 60 },
  { value: 58 },
  { value: 65 },
];

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    payload?: { fill?: string };
    value?: number | string;
  }>;
  valueFormatter?: (value: number | string) => ReactNode;
}) {
  const entry = payload?.[0];
  if (!active || !entry) return null;
  return (
    <ChartTooltip>
      <ChartTooltip.Item>
        <ChartTooltip.Indicator color={entry.payload?.fill} />
        <ChartTooltip.Label>{entry.name}</ChartTooltip.Label>
        <ChartTooltip.Value>{entry.value}%</ChartTooltip.Value>
      </ChartTooltip.Item>
    </ChartTooltip>
  );
}

interface KpiWithChartInlineProps {
  /** 来自接口的统计数据，未传入时使用示例数据 */
  stats?: WordStats;
}

export default function KpiWithChartInline({ stats }: KpiWithChartInlineProps = {}) {
  const s = stats ?? DEMO_STATS;

  const pieData = [
    { name: "已掌握", value: s.masteredCount },
    { name: "未熟练", value: s.learningCount },
    { name: "强化中", value: s.reviewingCount },
  ];

  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
      <KPI>
        <KPI.Content className="grid-cols-[1fr_1fr] items-end">
          <div className="flex flex-col justify-between h-full gap-2 ">
            <KPI.Header className="w-max">
              <SquareChartBar className="text-muted size-4" />
              <KPI.Title>已学习统计</KPI.Title>
            </KPI.Header>

            <div className="flex flex-col gap-1">
              <KPI.Value
                className="text-3xl"
                maximumFractionDigits={1}
                style="percent"
                value={s.completionRate}
              />
              <div className="flex items-center gap-1.5">
                <TrendChip trend="down" variant="tertiary">
                  5.9%
                  <TrendChip.Suffix>本周已学{s.weeklyStudied}</TrendChip.Suffix>
                </TrendChip>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end w-full">
            <div className="flex items-center justify-center w-full gap-2 sm:gap-6">
              <PieChart
                height={104}
                width={104}
                className="flex items-center justify-center w-1/2 "
              >
                <PieChart.Pie
                  cx="50%"
                  cy="50%"
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={50}
                >
                  {pieData.map((_, idx) => (
                    <PieChart.Cell
                      key={idx}
                      fill={CHART_COLORS[idx % CHART_COLORS.length]}
                    />
                  ))}
                </PieChart.Pie>
                <PieChart.Tooltip content={<PieTooltip />} />
              </PieChart>

              <div className="flex flex-1 flex-col gap-3 w-max ">
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

      <KPI>
        <KPI.Header>
          <Target className="text-muted size-4" />
          <KPI.Title>学习曲线图</KPI.Title>
        </KPI.Header>
        <KPI.Content className="grid-cols-[1fr_1fr] items-end">
          <div className="flex flex-col gap-1">
            <KPI.Value
              className="text-3xl"
              maximumFractionDigits={0}
              value={s.totalCount}
            />
            <div className="flex items-center gap-1.5">
              <TrendChip trend="up" variant="tertiary">
                3.5%
                <TrendChip.Suffix>过去30天</TrendChip.Suffix>
              </TrendChip>
            </div>
          </div>
          <KPI.Chart
            color="var(--color-accent)"
            data={sparklineUp}
            height={70}
            strokeWidth={1.5}
          />
        </KPI.Content>
      </KPI>
    </div>
  );
}
