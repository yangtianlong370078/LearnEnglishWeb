"use client";

import { useEffect, useState } from "react";
import { Label, Meter } from "@heroui/react";
import { statisticsApi } from "@/lib/api";
import type { MonthlyData } from "@/types/task";

function calcTodayTaskCount(monthly: MonthlyData, today: Date): number {
  const taskTotal = monthly.task?.count ?? 0;
  if (taskTotal === 0) return 0;

  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDay = today.getDate();
  const weekendMode = monthly.task?.weekend ?? 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const weekendDays = new Set<number>();
  if (weekendMode > 0) {
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(year, month, d).getDay();
      const include =
        (weekendMode === 1 && dow === 6) ||
        (weekendMode === 2 && dow === 0) ||
        (weekendMode === 3 && (dow === 0 || dow === 6));
      if (include) weekendDays.add(d);
    }
  }

  if (weekendDays.has(todayDay)) return 0;

  const workingDayCount = Math.max(1, daysInMonth - weekendDays.size);
  const quotient = Math.floor(taskTotal / workingDayCount);
  let remainder = taskTotal % workingDayCount;

  // 按序遍历到今天，将跳过的周末日累计到 remainder
  for (let d = 1; d < todayDay; d++) {
    if (weekendDays.has(d)) remainder++;
  }

  return quotient + (remainder >= todayDay ? 1 : 0);
}

export function MaterBasic() {
  const [todayTask, setTodayTask] = useState<number>(0);
  const [doneCount, setDoneCount] = useState<number>(0);

  useEffect(() => {
    function sync() {
      const cached = statisticsApi.getCachedMonthlyStatistics();
      if (!cached) return;
      const today = new Date();
      const monthly = cached.monthly.find(
        (m) => m.year === today.getFullYear() && m.month === today.getMonth() + 1,
      );
      if (!monthly) return;
      setTodayTask(calcTodayTaskCount(monthly, today));
      const todayLearn = monthly.statisticsLearns.find(
        (s) => s.day === today.getDate(),
      );
      setDoneCount(todayLearn?.count ?? 0);
    }
    sync();
    window.addEventListener("stats:updated", sync);
    return () => window.removeEventListener("stats:updated", sync);
  }, []);

  if (todayTask === 0) {
    return <span className="text-sm text-muted">今日未设置任务</span>;
  }

  const percent = Math.min(Math.round((doneCount / todayTask) * 100), 100);

  return (
    <Meter aria-label="今日任务" className="w-64" value={percent}>
      <Label>今日任务：{doneCount}/{todayTask}</Label>
      <Meter.Output />
      <Meter.Track>
        <Meter.Fill />
      </Meter.Track>
    </Meter>
  );
}