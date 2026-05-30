"use client";

import {Card} from "@heroui/react";

import {BarChart} from "@heroui-pro/react";

const weeklyData = [
  {current: 120, day: "1月", previous: 90},
  {current: 180, day: "2月", previous: 150},
  {current: 150, day: "3月", previous: 170},
  {current: 210, day: "4月", previous: 140},
  {current: 190, day: "5月", previous: 160},
  {current: 80, day: "6月", previous: 100},
  {current: 60, day: "7月", previous: 70},
   {current: 150, day: "8月", previous: 40},
  {current: 210, day: "9月", previous: 90},
  {current: 190, day: "10月", previous: 70},
  {current: 80, day: "11月", previous: 100},
  {current: 60, day: "12月", previous: 140},
];

export default function BarChartComparisonDemo() {
  return (
    <Card className="w-full  rounded-2xl">
      <Card.Header className="flex-row items-center justify-between">
        <div>
          <Card.Title className="text-base">Weekly Orders</Card.Title>
          <Card.Description className="text-muted text-xs">This week vs last week</Card.Description>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-full" style={{backgroundColor: "var(--chart-3)"}} />
            <span className="text-muted text-xs">This week</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-full" style={{backgroundColor: "var(--chart-1)"}} />
            <span className="text-muted text-xs">Last week</span>
          </div>
        </div>
      </Card.Header>
      <Card.Content>
        <BarChart data={weeklyData} height={200}>
          <BarChart.Grid vertical={false} />
          <BarChart.XAxis dataKey="day" tickMargin={8} />
          <BarChart.YAxis width={30} />
          <BarChart.Bar
            barSize={12}
            dataKey="current"
            fill="var(--chart-3)"
            name="This week"
            radius={[4, 4, 0, 0]}
          />
          <BarChart.Bar
            barSize={12}
            dataKey="previous"
            fill="var(--chart-1)"
            name="Last week"
            radius={[4, 4, 0, 0]}
          />
          <BarChart.Tooltip content={<BarChart.TooltipContent />} />
        </BarChart>
      </Card.Content>
    </Card>
  );
}
