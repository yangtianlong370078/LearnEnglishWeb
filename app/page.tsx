import KpiWithChartInline from "@/components/kpi-with-chart-inline";
import RadialChartWithLegend from "@/components/radial-chart-with-legend";
import TaskCalendar from "@/components/task-calendar";

export default function Home() {
  return (
    <div className="flex flex-col gap-6">
      {/* KPI 区域 */}
      <KpiWithChartInline />

      {/* 数据统计看板：两栏并列 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RadialChartWithLegend />
        <TaskCalendar />
      </div>
    </div>
  );
}
