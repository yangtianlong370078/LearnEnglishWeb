"use client";

import type {
  MonthCompletion,
  MonthValue,
} from "@/components/task-year-calendar";
import type { MonthlyData } from "@/types/task";
import type { WordStats } from "@/types/word";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Card } from "@heroui/react";

import KpiWithChartInline from "@/components/kpi-with-chart-inline";
import TaskCalendar from "@/components/task-calendar";
import FullWidthSearch from "@/components/common/search-field";
import TaskYearCalendar from "@/components/task-year-calendar";
import { statisticsApi } from "@/lib/api";


export default function Home() {
  const today = new Date();
  const [view, setView] = useState<"month" | "year">("month");
  const [monthValue, setMonthValue] = useState<MonthValue>({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  });
  const [yearStats, setYearStats] = useState<MonthCompletion[] | undefined>(
    undefined,
  );
  const [monthlyList, setMonthlyList] = useState<MonthlyData[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [studyStats, setStudyStats] = useState<WordStats | undefined>(
    undefined,
  );

  // 拉取后端学习统计数据（StatisticsLearnCountTwo）
  // 1) 进入页面立即用 localStorage 缓存渲染（stale）；
  // 2) 同时后台请求最新数据（revalidate），ETag 命中 304 时无 body 传输。
  const refreshStats = () => {
    statisticsApi
      .getMonthlyStatisticsWithYearStats()
      .then((res) => {
        setMonthlyList(res.monthly);
        setYearStats(res.yearStats);
      })
      .catch((err) => {
        // 失败时仅打印日志，若已有缓存则保持显示
        // eslint-disable-next-line no-console
        console.error("加载学习统计失败:", err);
      })
      .finally(() => {
        setStatsLoading(false);
      });
  };

  useEffect(() => {
    const cachedStats = statisticsApi.getCachedMonthlyStatistics();

    if (cachedStats) {
      setMonthlyList(cachedStats.monthly);
      setYearStats(cachedStats.yearStats);
      setStatsLoading(false);
    }

    const cachedKpi = statisticsApi.getCachedStudyStatistics();

    if (cachedKpi) setStudyStats(cachedKpi);

    refreshStats();

    statisticsApi
      .getStudyStatistics()
      .then(setStudyStats)
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("加载学习 KPI 失败:", err);
      });
  }, []);

  // 当前选中月份对应的 MonthlyData
  const currentMonthly = useMemo(
    () =>
      monthlyList.find(
        (m) => m.year === monthValue.year && m.month === monthValue.month,
      ),
    [monthlyList, monthValue],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* 搜索框 */}
      <FullWidthSearch />

      {/* KPI 区域 */}
      <KpiWithChartInline monthlyList={monthlyList} stats={studyStats} />

      {/* 数据统计看板：月/年视图平滑切换 */}
      <div className="relative isolate">
        <div className="flex flex-col gap-1.5 px-4 pb-2">
          <span className="text-foreground text-base font-semibold">
            任务日历
          </span>
          <span className="text-xs whitespace-nowrap text-muted">
            {view === "year"
              ? "按年查看每月任务量与完成情况"
              : "按月查看每日任务量与完成情况"}
          </span>
        </div>
         <Card
          className=" backdrop-blur-xl backdrop-saturate-150"
          // variant="secondary"
          variant="transparent"
        > 
        {/* <LiquidGlass displacementScale={64}
  blurAmount={0.1}
  saturation={130}
  aberrationIntensity={2}
  elasticity={0}
  cornerRadius={35}
  padding="8px 16px"> */}
          <AnimatePresence initial={false} mode="wait">
            {view === "month" ? (
              <motion.div
                key="month"
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                initial={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <TaskCalendar
                  isLoading={statsLoading}
                  monthlyData={currentMonthly}
                  value={monthValue}
                  yearStats={yearStats}
                  onChange={setMonthValue}
                  onShowYearView={(stats) => {
                    setYearStats(stats);
                    setView("year");
                  }}
                  onTaskSaved={() => {
                    refreshStats();
                    statisticsApi
                      .getStudyStatistics()
                      .then(setStudyStats)
                      .catch((err) => {
                        // eslint-disable-next-line no-console
                        console.error("刷新学习 KPI 失败:", err);
                      });
                  }}
                />
              </motion.div>
            ) : (
              <motion.div
                key="year"
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.2 } }}
                initial={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <TaskYearCalendar
                  inline
                  monthlyList={monthlyList}
                  stats={yearStats}
                  value={monthValue}
                  onChange={setMonthValue}
                  onShowMonthView={() => setView("month")}
                />
              </motion.div>
            )}
          </AnimatePresence>
        {/* </LiquidGlass> */}
        </Card> 
      </div>
    </div>
  );
}
