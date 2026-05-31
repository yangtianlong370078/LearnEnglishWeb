/**
 * 学习统计模块接口
 * 对应后端 /api/Statistics 路由
 */
import request from "../request";
import type {
  MonthCompletion,
  MonthlyData,
  StatisticsLearn,
} from "@/types/task";

/** 后端返回的每日学习记录原始结构 */
interface StatisticsLearnRaw {
  /** ISO 日期字符串，如 2026-05-01T00:00:00 */
  date: string;
  count: number;
}

/** 后端返回的月度任务原始结构 */
interface LearnTaskRaw {
  id: number;
  userid: number;
  /** 月度任务起始日期（每月 1 号） */
  startdate: string;
  /** 月度任务总单词数；0 表示未配置任务 */
  count: number;
  /**
   * 排除周末模式
   * 0 = 不排除，1 = 排除周六，2 = 排除周日，3 = 排除双休
   */
  weekend: number;
}

/** 月度统计分组原始结构 */
interface MonthlyCategoryRaw {
  /** 该月份 1 号 ISO 日期 */
  date: string;
  totalcount: number;
  statisticsLearns: StatisticsLearnRaw[];
  task: LearnTaskRaw;
}

/**
 * StatisticsLearnCountTwo 接口完整响应
 * 注意：此接口未走通用 { success, data } 包装，data 直接铺在 categorys 字段。
 */
interface StatisticsLearnCountTwoResponse {
  success: boolean;
  msg?: string;
  categorys: MonthlyCategoryRaw[];
}

function parseDate(iso: string): Date {
  // 后端无时区信息的 DateTime 字符串，按本地时区解析即可
  return new Date(iso);
}

function toStatisticsLearn(item: StatisticsLearnRaw): StatisticsLearn {
  const d = parseDate(item.date);

  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    count: item.count,
  };
}

/**
 * 将后端原始月度分组转换为前端 TaskCalendar 使用的 MonthlyData
 */
export function mapMonthlyData(raw: MonthlyCategoryRaw): MonthlyData {
  const d = parseDate(raw.date);
  const taskCount = raw.task?.count ?? 0;
  const weekend = (raw.task?.weekend ?? 0) as 0 | 1 | 2 | 3;

  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    statisticsLearns: raw.statisticsLearns.map(toStatisticsLearn),
    task: taskCount > 0 || raw.task ? { count: taskCount, weekend } : null,
  };
}

/** 计算单个月份的完成百分比 */
function calcPercent(raw: MonthlyCategoryRaw): number | null {
  const taskCount = raw.task?.count ?? 0;

  if (taskCount <= 0) return null;
  const percent = Math.round((raw.totalcount / taskCount) * 100);

  return Math.max(0, Math.min(100, percent));
}

/**
 * 拉取所有月份学习统计（用户起始日期之后），转为 MonthlyData[]
 */
export async function getMonthlyStatistics(): Promise<MonthlyData[]> {
  const res = await request.get<StatisticsLearnCountTwoResponse>(
    "/Statistics/StatisticsLearnCountTwo",
  );
  const list = res.data?.categorys ?? [];

  return list.map(mapMonthlyData);
}

/** 同时返回 MonthlyData[] 与各月完成百分比，避免重复请求 */
export async function getMonthlyStatisticsWithYearStats(): Promise<{
  monthly: MonthlyData[];
  yearStats: MonthCompletion[];
}> {
  const res = await request.get<StatisticsLearnCountTwoResponse>(
    "/Statistics/StatisticsLearnCountTwo",
  );
  const list = res.data?.categorys ?? [];

  return {
    monthly: list.map(mapMonthlyData),
    yearStats: list.map((raw) => {
      const d = parseDate(raw.date);

      return {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        percent: calcPercent(raw),
      };
    }),
  };
}
