"use client";

import type {ReactNode} from "react";

import {Card} from "@heroui/react";

import {ChartTooltip, RadialChart} from "@heroui-pro/react";

const CHART_COLORS = ["var(--chart-4)", "var(--chart-3)", "var(--chart-2)", "var(--chart-1)"];

const storageData = [
  // {fill: "var(--chart-4)", name: "Documents", value: 42},
  {fill: "var(--chart-3)", name: "Media", value: 28},
  {fill: "var(--chart-2)", name: "System", value: 18},
];

interface RadialTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    payload?: Record<string, unknown>;
    value?: number | string;
  }>;
  valueFormatter?: (value: number | string) => ReactNode;
}

function RadialTooltip({payload, valueFormatter}: RadialTooltipProps) {
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

export default function RadialChartWithLegend() {
  return (
    <Card className="w-full rounded-2xl">
      <Card.Header>
        <Card.Title className="text-base">Storage Breakdown</Card.Title>
        <Card.Description className="text-muted text-xs">88 GB of 128 GB used</Card.Description>
      </Card.Header>
      <Card.Content className="grid place-items-center min-h-[320px]">
        <div className="relative shrink-0">
          <RadialChart
            data={storageData}
            height={220}
            innerRadius="50%"
            outerRadius="100%"
            width={220}
          >
            <RadialChart.Bar background barSize={16} cornerRadius={12} dataKey="value" />
            <RadialChart.Tooltip content={<RadialTooltip valueFormatter={(v) => `${v} GB`} />} />
          </RadialChart>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-foreground text-xl font-bold">88</span>
            <span className="text-muted text-xs">GB used</span>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 ">
          {storageData.map((entry, idx) => (
            <div key={entry.name} className="flex items-center gap-3">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{backgroundColor: CHART_COLORS[idx % CHART_COLORS.length]}}
              />
              <div className="flex flex-1 items-center justify-between">
                <span className="text-foreground text-sm">{entry.name}</span>
                <span className="text-foreground text-sm font-semibold">{entry.value} GB</span>
              </div>
            </div>
          ))}
        </div>
      </Card.Content>
    </Card>
  );
}
