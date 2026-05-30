"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import KpiWithChartInline from "@/components/kpi-with-chart-inline";
import TaskCalendar from "@/components/task-calendar";
import FullWidthSearch from "@/components/common/search-field";
import TaskYearCalendar from "@/components/task-year-calendar";
import type {
  MonthCompletion,
  MonthValue,
} from "@/components/task-year-calendar";

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
  // 动画结束后清掉 willChange / filter，避免 GPU 合成层导致的文字模糊
  const [animating, setAnimating] = useState(false);

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
      <KpiWithChartInline />

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
                value={monthValue}
                onChange={setMonthValue}
                onShowYearView={(stats) => {
                  setYearStats(stats);
                  setView("year");
                }}
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
