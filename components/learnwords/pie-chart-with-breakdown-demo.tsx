"use client";

import type { ReactNode } from "react";
import { EllipsisVertical, Pencil, TrashBin } from "@gravity-ui/icons";
import {
  Card,
  Dropdown,
  Button,
  Header,
  Label,
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
export type PieChartVariant = "default" | "overview";

export interface PieChartWithBreakdownDemoProps {
  /** 课程 id（编辑时回传） */
  courseId?: number;
  /** 课程名称（显示在标题） */
  courseName?: string;
  /** 已掌握 */
  doneCount?: number;
  /** 未牢记 */
  notDoneCount?: number;
  /** 不认识 */
  notLearned?: number;
  /** 顶部概览卡使用的紧凑视觉变体 */
  variant?: PieChartVariant;
  /** 概览卡标题上方的辅助标签 */
  eyebrow?: string;
  /** 概览卡标题图标 */
  leadingIcon?: ReactNode;
  /** 概览卡无数据时的圆心文案 */
  emptyLabel?: string;
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
  total: number;
  valueFormatter?: (value: number | string) => ReactNode;
}

function PieTooltip({
  active,
  payload,
  total,
  valueFormatter,
}: PieTooltipProps) {
  const entry = payload?.[0];

  if (!active || !entry) return null;

  const value = Number(entry.value ?? 0);
  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";

  return (
    <ChartTooltip>
      <ChartTooltip.Item>
        <ChartTooltip.Indicator color={entry.payload?.fill} />
        <ChartTooltip.Label className="min-w-[100px]">
          {entry.name}
          <span className="ml-1 text-[11px] font-normal text-muted">
            ({pct}%)
          </span>
        </ChartTooltip.Label>
        <ChartTooltip.Value className="min-w-[40px] text-right">
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
  variant = "default",
  eyebrow,
  leadingIcon,
  emptyLabel = "暂无数据",
  menuMode = "full",
  onEdit,
  onDelete,
}: PieChartWithBreakdownDemoProps = {}) {
  const rawData = [
    { name: "已掌握", value: doneCount },
    { name: "未牢记", value: notDoneCount },
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
  const cornerRadius = allSlicesAboveThreshold ? 10 : 0;
  // 圆角模式下用小的负 paddingAngle，让相邻切片轻微重叠以隐藏两侧独立的圆角接缝
  // 避免出现"珍珠项链"效果；无圆角时保持 0，切片端到端连接
  const paddingAngle = allSlicesAboveThreshold ? -10 : -1;
  const isDesktop = useMediaQuery("(min-width: 640px)");

  if (variant === "overview") {
    const overviewChartColors = [
      "var(--summary-chart-1, var(--chart-1))",
      "var(--summary-chart-2, var(--chart-2))",
      "var(--summary-chart-3, var(--chart-3))",
    ];

    return (
      <>
        <Card.Header className="relative z-[1]  p-2">
          <div className="flex min-w-0 items-center gap-3.5">
            <div
              aria-hidden="true"
              className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full text-[var(--summary-ink)] dark:text-[var(--summary-accent)]"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--summary-accent) 24%, transparent)",
                boxShadow:
                  "inset 0 0 0 1px color-mix(in srgb, var(--summary-accent) 20%, transparent)",
              }}
            >
              {leadingIcon}
            </div>
            <div className="min-w-0">
              {eyebrow ? (
                <p className="mb-0.5 text-xs font-semibold text-[var(--summary-ink)] dark:text-[var(--summary-accent)]">
                  {eyebrow}
                </p>
              ) : null}
              <h2 className="line-clamp-2 text-[17px] font-semibold leading-6 text-foreground">
                {courseName}
              </h2>
            </div>
          </div>
        </Card.Header>

        <Card.Content className="relative z-[1] flex flex-1 flex-col items-center justify-center">
          <div className="relative size-[174px] shrink-0">
            <PieChart height={174} width={174}>
              <PieChart.Pie
                cornerRadius={cornerRadius}
                cx="50%"
                cy="50%"
                data={planData}
                dataKey="value"
                innerRadius="78%"
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
                        ? "color-mix(in srgb, var(--foreground) 10%, transparent)"
                        : overviewChartColors[idx % overviewChartColors.length]
                    }
                  />
                ))}
              </PieChart.Pie>
              {!isEmpty && (
                <PieChart.Tooltip content={<PieTooltip total={total} />} />
              )}
            </PieChart>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold leading-none tabular-nums text-foreground">
                {total.toLocaleString()}
              </span>
              <span className="mt-1.5 text-[11px] leading-none text-muted">
                {isEmpty ? emptyLabel : "总词数"}
              </span>
            </div>
          </div>
        </Card.Content>

        <div className=" p-2">
          <dl
            className="flex justify-evenly w-full  gap-1  rounded-2xl p-1.5"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--summary-accent) 9%, transparent)",
              boxShadow:
                "inset 0 0 0 1px color-mix(in srgb, var(--summary-accent) 8%, transparent)",
            }}
          >
            {rawData.map((entry, idx) => (
              <>
                <div
                  key={entry.name}
                  className="relative isolate flex min-w-0 cursor-pointer flex-col items-center justify-center bg-transparent p-2 transition-transform duration-300 ease-out before:pointer-events-none before:absolute before:-inset-x-5 before:-inset-y-3 before:-z-10 before:rounded-[50%] before:bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--summary-accent)_72%,transparent)_0%,color-mix(in_srgb,var(--summary-accent)_30%,transparent)_42%,transparent_74%)] before:opacity-0 before:blur-md before:transition-opacity before:duration-300 hover:-translate-y-1 hover:scale-[1.04] hover:!bg-transparent hover:before:opacity-100"
                >
                  <dt className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-muted">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          overviewChartColors[idx % overviewChartColors.length],
                      }}
                    />
                    {entry.name}
                  </dt>
                  <dd className="mt-1 text-base font-semibold leading-none tabular-nums text-foreground">
                    {entry.value.toLocaleString()}
                  </dd>
                </div>

                {idx < rawData.length - 1 && (
                  <Separator
                  key={idx}
                    orientation="vertical"
                    className="flex "
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--summary-accent) 9%, transparent)",
                      boxShadow:
                        "inset 0 0 0 1px color-mix(in srgb, var(--summary-accent) 8%, transparent)",
                    }}
                  />
                )}
              </>
            ))}
          </dl>
        </div>
      </>
    );
  }

  return (
    <>
      <Card.Header className="gap-0 p-2">
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
      <Card.Content className="flex flex-col items-center ">
        <div className="flex flex-1 flex-col   justify-center ">
          <div className="relative shrink-0 w-[190px] h-[190px]">
            <PieChart height={190} width={190}>
              <PieChart.Pie
                cornerRadius={cornerRadius}
                cx="50%"
                cy="50%"
                data={planData}
                dataKey="value"
                innerRadius="80%"
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
              {!isEmpty && (
                <PieChart.Tooltip content={<PieTooltip total={total} />} />
              )}
            </PieChart>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-foreground text-3xl font-bold">
                {total.toLocaleString()}
              </span>
              <span className="text-muted text-sm">总数</span>
            </div>
          </div>
        </div>
      </Card.Content>

      <div className="p-2">
        <dl
          className="flex justify-evenly w-full rounded-2xl p-1.5"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--foreground) 4%, transparent)",
            boxShadow:
              "inset 0 0 0 1px color-mix(in srgb, var(--foreground) 6%, transparent)",
          }}
        >
          {rawData.map((entry, idx) => {
            const pct =
              total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0.0";

            return (
              <>
                <div
                  key={entry.name}
                  className="relative isolate flex min-w-0 cursor-pointer flex-col items-center justify-center bg-transparent p-2 transition-transform duration-300 ease-out before:pointer-events-none before:absolute before:-inset-x-5 before:-inset-y-3 before:z-0 before:rounded-[50%] before:bg-[radial-gradient(ellipse_at_center,rgba(0,200,255,0.8)_0%,rgba(55,125,255,0.34)_42%,transparent_74%)] before:opacity-0 before:blur-md before:transition-opacity before:duration-300 before:content-[''] hover:-translate-y-1 hover:scale-[1.04] hover:!bg-transparent hover:before:opacity-100"
                >
                  <dt className="relative z-10 flex items-center gap-1.5 whitespace-nowrap text-[11px] text-muted">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          CHART_COLORS[idx % CHART_COLORS.length],
                      }}
                    />
                    {entry.name}
                  </dt>
                  <dd className="relative z-10 mt-1 text-base font-semibold leading-none tabular-nums text-foreground">
                    {entry.value.toLocaleString()}
                    {/* <span className="ml-1 text-[11px] font-normal text-muted">
                    ({pct}%)
                  </span> */}
                  </dd>
                </div>

                {idx < rawData.length - 1 && (
                  <Separator
                  key={idx}
                    orientation="vertical"
                    className="flex "
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--foreground) 4%, transparent)",
                      boxShadow:
                        "inset 0 0 0 1px color-mix(in srgb, var(--foreground) 6%, transparent)",
                    }}
                  />
                )}
              </>
            );
          })}
        </dl>
      </div>
    </>
  );
}
