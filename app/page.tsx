"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import KpiWithChartInline from "@/components/kpi-with-chart-inline";
import TaskCalendar from "@/components/task-calendar";
import FullWidthSearch from "@/components/common/search-field";
import TaskYearCalendar from "@/components/task-year-calendar";
import type {
  MonthCompletion,
  MonthValue,
} from "@/components/task-year-calendar";
import { statisticsApi } from "@/lib/api";
import type { MonthlyData } from "@/types/task";

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
  // 动画结束后清掉 willChange / filter，避免 GPU 合成层导致的文字模糊
  const [animating, setAnimating] = useState(false);

  // 拉取后端学习统计数据（StatisticsLearnCountTwo）
  // 1) 进入页面立即用 localStorage 缓存渲染（stale）；
  // 2) 同时后台请求最新数据（revalidate），ETag 命中 304 时无 body 传输。
  const refreshStats = (showLoading = false) => {
    if (showLoading) setStatsLoading(true);
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
    const cached = statisticsApi.getCachedMonthlyStatistics();
    if (cached) {
      setMonthlyList(cached.monthly);
      setYearStats(cached.yearStats);
      setStatsLoading(false); // 先把骨架屏关掉，再去后台校验
    } else {
      setStatsLoading(true);
    }
    refreshStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 当前选中月份对应的 MonthlyData
  const currentMonthly = useMemo(
    () =>
      monthlyList.find(
        (m) => m.year === monthValue.year && m.month === monthValue.month,
      ),
    [monthlyList, monthValue],
  );

  const sharedStyle = animating
    ? ({
        transformOrigin: "top center",
        willChange: "transform, opacity",
      } as const)
    : ({ transformOrigin: "top center" } as const);

  return (
    <div className="flex flex-col gap-4">
      {/* 搜索框 */}
      <FullWidthSearch />

      {/* KPI 区域 */}
      <KpiWithChartInline monthlyList={monthlyList} />

      {/* 数据统计看板：月/年视图平滑切换 */}
      <div className="relative isolate">
        <div className="flex flex-col gap-1.5 px-4 pb-2">
          <span className="text-foreground text-base font-semibold">
            任务日历
          </span>
          <span className="text-xs whitespace-nowrap text-muted">
            {view === "year" ? "按年查看每月任务量与完成情况" : "按月查看每日任务量与完成情况"}
          </span>
        </div>

        <AnimatePresence
          initial={false}
          mode="popLayout"
          onExitComplete={() => setAnimating(false)}
        >
          {view === "month" ? (
            <motion.div
              key="month"
              animate={{
                opacity: 1,
                scale: 1,
                transition: {
                  duration: 0.5,
                  ease: [0.22, 1, 0.36, 1],
                  opacity: { duration: 0.45, delay: 0.05 },
                },
              }}
              exit={{
                opacity: 0,
                scale: 1.04,
                transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] },
              }}
              initial={{ opacity: 0, scale: 0.96 }}
              style={sharedStyle}
              onAnimationStart={() => setAnimating(true)}
              onAnimationComplete={(def) => {
                // 入场动画完成后清掉合成层 hint,消除文字模糊
                if (
                  typeof def === "object" &&
                  def !== null &&
                  "opacity" in def
                ) {
                  setAnimating(false);
                }
              }}
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
                onTaskSaved={() => refreshStats()}
              />
            </motion.div>
          ) : (
            <motion.div
              key="year"
              animate={{
                opacity: 1,
                scale: 1,
                transition: {
                  duration: 0.5,
                  ease: [0.22, 1, 0.36, 1],
                  opacity: { duration: 0.45, delay: 0.05 },
                },
              }}
              exit={{
                opacity: 0,
                scale: 0.96,
                transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] },
              }}
              initial={{ opacity: 0, scale: 1.04 }}
              style={sharedStyle}
              onAnimationStart={() => setAnimating(true)}
              onAnimationComplete={(def) => {
                if (
                  typeof def === "object" &&
                  def !== null &&
                  "opacity" in def
                ) {
                  setAnimating(false);
                }
              }}
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
      </div>
    </div>
  );
}
