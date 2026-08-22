"use client";

import type { ReactNode } from "react";
import {
  EllipsisVertical,
  Pencil,
  SquarePlus,
  TrashBin,
} from "@gravity-ui/icons";
import {
  Card,
  Dropdown,
  Button,
  Header,
  Label,
  Description,
  Kbd,
  Separator,
} from "@heroui/react";

import { ChartTooltip, PieChart } from "@heroui-pro/react";

import { useMediaQuery } from "@/hooks/useMediaQuery";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
];

export type PieChartMenuMode = "none" | "full" | "remove";

export interface PieChartWithBreakdownDemoProps {
  /** 课程 id（编辑时回传） */
  courseId?: number;
  /** 课程名称（显示在标题） */
  courseName?: string;
  /** 已掌握 */
  doneCount?: number;
  /** 学习中 */
  notDoneCount?: number;
  /** 不认识 */
  notLearned?: number;
  /**
   * 菜单显示模式：
   * - "none": 不显示 Dropdown
   * - "full": 显示 编辑 + 删除
   * - "remove": 仅显示 移除
   */
  menuMode?: PieChartMenuMode;
  /** 点击编辑时回调，回传当前课程 id 与名称 */
  onEdit?: (courseId: number, courseName: string) => void;
  /** 点击删除/移除时回调，回传当前课程 id 与名称 */
  onDelete?: (courseId: number, courseName: string) => void;
}

interface PieTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    payload?: { fill?: string };
    value?: number | string;
  }>;
  valueFormatter?: (value: number | string) => ReactNode;
}

function PieTooltip({ active, payload, valueFormatter }: PieTooltipProps) {
  const entry = payload?.[0];

  if (!active || !entry) return null;

  return (
    <ChartTooltip>
      <ChartTooltip.Item>
        <ChartTooltip.Indicator color={entry.payload?.fill} />
        <ChartTooltip.Label>{entry.name}</ChartTooltip.Label>
        <ChartTooltip.Value>
          {valueFormatter ? valueFormatter(entry.value ?? "") : entry.value}
        </ChartTooltip.Value>
      </ChartTooltip.Item>
    </ChartTooltip>
  );
}

export default function PieChartWithBreakdownDemo({
  courseId = 0,
  courseName = "课程名称",
  doneCount = 0,
  notDoneCount = 0,
  notLearned = 0,
  menuMode = "full",
  onEdit,
  onDelete,
}: PieChartWithBreakdownDemoProps = {}) {
  const rawData = [
    { name: "已掌握", value: doneCount },
    { name: "学习中", value: notDoneCount },
    { name: "不认识", value: notLearned },
  ];
  const total = rawData.reduce((sum, d) => sum + d.value, 0);
  const isEmpty = total === 0;
  // 图表只渲染 value > 0 的项，避免 0 值切片造成的渲染异常；
  // 全 0 时渲染一个占位切片以显示空状态圆环
  const planData = isEmpty
    ? [{ name: "暂无数据", value: 1 }]
    : rawData.filter((d) => d.value > 0);
  const hasMultipleSlices = planData.length > 1;
  // 只有当所有非零项的占比都 >= 5% 时才启用大圆角，避免小切片被圆角吃掉
  const allSlicesAboveThreshold =
    total > 0 && planData.every((d) => d.value / total >= 0.05);
  const cornerRadius = allSlicesAboveThreshold ? 12 : 0;
  // 圆角模式下用小的负 paddingAngle，让相邻切片轻微重叠以隐藏两侧独立的圆角接缝
  // 避免出现"珍珠项链"效果；无圆角时保持 0，切片端到端连接
  const paddingAngle = allSlicesAboveThreshold ? -14 : -1;
  const isDesktop = useMediaQuery("(min-width: 640px)");

  return (
    <>
      <Card.Header className="gap-0 ">
        <div className="flex items-center justify-between  ">
          <div className="card__title text-base font-semibold">
            {courseName}
          </div>

          {menuMode !== "none" && (
            <Dropdown>
              <Button
                size={isDesktop ? "md" : "sm"}
                isIconOnly
                aria-label="菜单"
                className="bg-black/10 dark:bg-white/10"
                variant="secondary"
              >
                <EllipsisVertical className="outline-none" />
              </Button>
              <Dropdown.Popover className="!min-w-[150px] !max-w-[150px] md:!min-w-[150px]">
                <Dropdown.Menu
                  onAction={(key) => {
                    if (key === "edit-file") {
                      onEdit?.(courseId, courseName);
                    } else if (key === "delete-file") {
                      onDelete?.(courseId, courseName);
                    }
                  }}
                >
                  <Dropdown.Section>
                    <Header>操作</Header>

                    {menuMode === "full" && (
                      <Dropdown.Item id="edit-file" textValue="编辑">
                        <div className="flex items-start justify-center pt-px">
                          <Pencil className="size-4 shrink-0 text-muted" />
                        </div>
                        <div className="flex flex-col">
                          <Label>编辑</Label>
                        </div>
                      </Dropdown.Item>
                    )}
                    <Dropdown.Item
                      id="delete-file"
                      textValue={menuMode === "remove" ? "移除" : "删除"}
                    >
                      <div className="flex items-start justify-center pt-px">
                        <TrashBin className="size-4 shrink-0 text-muted" />
                      </div>
                      <div className="flex flex-col">
                        <Label>{menuMode === "remove" ? "移除" : "删除"}</Label>
                      </div>
                    </Dropdown.Item>
                  </Dropdown.Section>
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          )}
        </div>
      </Card.Header>
      <Card.Content
        className={`flex flex-row items-center ${menuMode !== "none" ? "justify-between" : "justify-end"} gap-1`}
      >
        <div className="flex flex-1 flex-col gap-3 max-w-[180px] min-w-[120px] ">
          <div className="relative shrink-0 w-[110px] h-[110px]">
            <PieChart height={110} width={110} className="">
              <PieChart.Pie
                cornerRadius={cornerRadius}
                cx="50%"
                cy="50%"
                data={planData}
                dataKey="value"
                innerRadius="74%"
                minAngle={hasMultipleSlices ? 4 : 0}
                nameKey="name"
                outerRadius="100%"
                paddingAngle={paddingAngle}
                strokeWidth={0}
              >
                {planData.map((_, idx) => (
                  <PieChart.Cell
                    key={idx}
                    fill={
                      isEmpty
                        ? "color-mix(in srgb, var(--foreground) 12%, transparent)"
                        : CHART_COLORS[idx % CHART_COLORS.length]
                    }
                  />
                ))}
              </PieChart.Pie>
              {!isEmpty && <PieChart.Tooltip content={<PieTooltip />} />}
            </PieChart>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-foreground text-xl font-bold">
                {total.toLocaleString()}
              </span>
              <span className="text-muted text-[10px]">总数</span>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 max-w-[200px] min-w-[150px] ">
          {rawData.map((entry, idx) => {
            const pct =
              total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0.0";

            return (
              <div key={entry.name} className="flex items-center gap-3 w-full">
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{
                    backgroundColor: CHART_COLORS[idx % CHART_COLORS.length],
                  }}
                />
                <div className="flex flex-1 items-center justify-between">
                  <span className="text-foreground text-sm">{entry.name}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-foreground text-sm font-semibold">
                      {entry.value}
                    </span>
                    <span className="text-muted text-xs">({pct}%)</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card.Content>
    </>
  );
}
