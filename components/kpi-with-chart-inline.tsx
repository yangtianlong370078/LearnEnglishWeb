"use client";

import {SquareChartBar, Target} from "@gravity-ui/icons";
import {KPI, TrendChip} from "@heroui-pro/react";

const sparklineUp = [
  {value: 30},
  {value: 35},
  {value: 28},
  {value: 42},
  {value: 38},
  {value: 45},
  {value: 50},
  {value: 48},
  {value: 55},
  {value: 60},
  {value: 58},
  {value: 65},
];

const sparklineDown = [
  {value: 65},
  {value: 60},
  {value: 62},
  {value: 55},
  {value: 58},
  {value: 52},
  {value: 50},
  {value: 48},
  {value: 45},
  {value: 42},
  {value: 44},
  {value: 40},
];

export default function KpiWithChartInline() {
  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
      <KPI>
        <KPI.Header>
          <Target className="text-muted size-4" />
          <KPI.Title>Total Clicks</KPI.Title>
        </KPI.Header>
        <KPI.Content className="grid-cols-[1fr_1fr] items-end">
          <div className="flex flex-col gap-1">
            <KPI.Value className="text-3xl" maximumFractionDigits={0} value={2441} />
            <div className="flex items-center gap-1.5">
              <TrendChip trend="up" variant="tertiary">
                3.5%
                <TrendChip.Suffix>last 30d</TrendChip.Suffix>
              </TrendChip>
            </div>
          </div>
          <KPI.Chart color="var(--color-accent)" data={sparklineUp} height={70} strokeWidth={1.5} />
        </KPI.Content>
      </KPI>

      <KPI>
        <KPI.Header>
          <SquareChartBar className="text-muted size-4" />
          <KPI.Title>Bounce Rate</KPI.Title>
        </KPI.Header>
        <KPI.Content className="grid-cols-[1fr_1fr] items-end">
          <div className="flex flex-col gap-1">
            <KPI.Value
              className="text-3xl"
              maximumFractionDigits={1}
              style="percent"
              value={0.423}
            />
            <div className="flex items-center gap-1.5">
              <TrendChip trend="down" variant="tertiary">
                5.9%
                <TrendChip.Suffix>vs last 7d</TrendChip.Suffix>
              </TrendChip>
            </div>
          </div>
          <KPI.Chart
            color="var(--color-danger)"
            data={sparklineDown}
            height={70}
            strokeWidth={1.5}
          />
        </KPI.Content>
      </KPI>
    </div>
  );
}
