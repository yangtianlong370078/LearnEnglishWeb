import KpiWithChartInline from "@/components/kpi-with-chart-inline";
import TaskCalendar from "@/components/task-calendar";
import FullWidthSearch from "@/components/common/search-field";

export default function Home() {
  return (
    <div className="flex flex-col gap-4">
      {/* 搜索框 */}
      <FullWidthSearch />
      {/* KPI 区域 */}
      <KpiWithChartInline />

      {/* 数据统计看板：两栏并列 */}
      <div className="">
       
        <TaskCalendar />
      </div>
    </div>
  );
}
