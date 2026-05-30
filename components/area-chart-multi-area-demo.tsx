"use client";

import {Card} from "@heroui/react";

import {AreaChart} from "@heroui-pro/react";

const trafficData = [
  {month: "1", organic: 2000, paidAds: 1000},
  {month: "2", organic: 5000, paidAds: 3000},
  {month: "3", organic: 8000, paidAds: 5000},
  {month: "4", organic: 7000, paidAds: 6000},
  {month: "5", organic: 9500, paidAds: 4000},
  {month: "6", organic: 8000, paidAds: 9500},
  {month: "7", organic: 12000, paidAds: 7000},
  {month: "8", organic: 11000, paidAds: 6500},
  {month: "9", organic: 14000, paidAds: 8000},
  {month: "10", organic: 13000, paidAds: 9000},
  {month: "11", organic: 16000, paidAds: 10000},
  {month: "12", organic: 15000, paidAds: 9500},
];

export default function AreaChartMultiAreaDemo() {
  return (
    <Card className="w-full  rounded-2xl">
      <Card.Header className="flex-row items-center justify-between">
        <Card.Title className="text-base">年度任务明细</Card.Title>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-full" style={{backgroundColor: "var(--chart-3)"}} />
            <span className="text-muted text-xs">新学单词</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-full" style={{backgroundColor: "var(--chart-1)"}} />
            <span className="text-muted text-xs">任务单词</span>
          </div>
        </div>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <div className="flex flex-col">
          <span className="text-foreground text-lg font-semibold">231,856</span>
          <span className="text-muted text-xs">任务完成率</span>
        </div>
        <AreaChart data={trafficData} height={200}>
          <defs>
            <linearGradient id="organic-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="paidads-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <AreaChart.Grid vertical={false} />
          <AreaChart.XAxis dataKey="month" tickMargin={8} />
          <AreaChart.YAxis
            tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
            width={30}
          />
          <AreaChart.Area
            dataKey="organic"
            dot={false}
            fill="url(#organic-fill)"
            name="Organic"
            stroke="var(--chart-3)"
            strokeWidth={2}
            type="monotone"
          />
          <AreaChart.Area
            dataKey="paidAds"
            dot={false}
            fill="url(#paidads-fill)"
            name="Paid Ads"
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
