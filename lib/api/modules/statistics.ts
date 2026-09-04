/**
 * 学习统计模块接口
 * 对应后端 /api/Statistics 路由
 */
import type {
  MonthCompletion,
  MonthlyData,
  StatisticsLearn,
} from "@/types/task";
import type { WordStats } from "@/types/word";

import request from "../request";

type CompactDailyItem = [day: number, count: number];

/** StatisticsLearnCountTwo 返回的紧凑月度结构 */
interface MonthlyCompactRaw {
  /** 月份基准，格式 yyyyMM，如 202407 */
  ym: number;
  /** 当月学习总数 */
  total: number;
  /** 月度任务总数；0 表示未配置任务 */
  taskCnt: number;
  /**
   * 排除周末模式
   * 0 = 不排除，1 = 排除周六，2 = 排除周日，3 = 排除双休
   */
  taskWeekend: number;
  /** 当月每日学习明细：[当月第几天, 数量] */
  items: CompactDailyItem[];
}

/**
 * StatisticsLearnCountTwo 接口完整响应
 */
interface StatisticsLearnCountTwoResponse {
  success: boolean;
  msg?: string;
  data: MonthlyCompactRaw[];
}

function parseYm(ym: number): { year: number; month: number } {
  return {
    year: Math.floor(ym / 100),
    month: ym % 100,
  };
}

function toStatisticsLearn(
  year: number,
  month: number,
  item: CompactDailyItem,
): StatisticsLearn {
  const [day, count] = item;

  return {
    year,
    month,
    day,
    count,
  };
}

/**
 * 将后端原始月度分组转换为前端 TaskCalendar 使用的 MonthlyData
 */
export function mapMonthlyData(raw: MonthlyCompactRaw): MonthlyData {
  const { year, month } = parseYm(raw.ym);
  const taskCount = raw.taskCnt ?? 0;

  return {
    year,
    month,
    statisticsLearns: raw.items.map((item) =>
      toStatisticsLearn(year, month, item),
    ),
    task: taskCount > 0
      ? {
          count: taskCount,
          weekend: (raw.taskWeekend ?? 0) as 0 | 1 | 2 | 3,
        }
      : null,
  };
}

/** 计算单个月份的完成百分比 */
function calcPercent(raw: MonthlyCompactRaw): number | null {
  const taskCount = raw.taskCnt ?? 0;

  if (taskCount <= 0) return null;
  const percent = Math.round((raw.total / taskCount) * 100);

  return Math.max(0, Math.min(100, percent));
}

// ─── 协商缓存 + localStorage 本地缓存 ───────────────────────────────
// 与后端 ETag 配合：
// 1. 首次请求后把 ETag 与转换后的结果写入 localStorage；
// 2. 后续请求带上 If-None-Match；服务端命中后返回 304（axios 默认会抛错），
//    此时复用 localStorage 缓存，避免下载/解析整个响应体。
const STATS_CACHE_KEY = "stats:monthly:v2";
const STATS_ETAG_KEY = "stats:monthly:etag:v2";

interface CachedStats {
  monthly: MonthlyData[];
  yearStats: MonthCompletion[];
}

function readCache(): { etag: string | null; data: CachedStats | null } {
  if (typeof window === "undefined") return { etag: null, data: null };
  try {
    const etag = localStorage.getItem(STATS_ETAG_KEY);
    const raw = localStorage.getItem(STATS_CACHE_KEY);
    const data = raw ? (JSON.parse(raw) as CachedStats) : null;

    return { etag, data };
  } catch {
    return { etag: null, data: null };
  }
}

function writeCache(etag: string | null, data: CachedStats): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(data));
    if (etag) localStorage.setItem(STATS_ETAG_KEY, etag);
    else localStorage.removeItem(STATS_ETAG_KEY);
    window.dispatchEvent(new CustomEvent("stats:updated"));
  } catch {
    /* 容量满 / 隐私模式等异常忽略，回退到无缓存 */
  }
}

/** 读取上次本地缓存的统计数据（用于首屏即时渲染） */
export function getCachedMonthlyStatistics(): CachedStats | null {
  return readCache().data;
}

/** 退出登录等场景下清空本地缓存 */
export function clearMonthlyStatisticsCache(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STATS_CACHE_KEY);
  localStorage.removeItem(STATS_ETAG_KEY);
}

function transform(list: MonthlyCompactRaw[]): CachedStats {
  return {
    monthly: list.map(mapMonthlyData),
    yearStats: list.map((raw) => {
      const { year, month } = parseYm(raw.ym);

      return {
        year,
        month,
        percent: calcPercent(raw),
      };
    }),
  };
}

/**
 * 拉取所有月份学习统计（用户起始日期之后），转为 MonthlyData[]
 */
export async function getMonthlyStatistics(): Promise<MonthlyData[]> {
  const { monthly } = await getMonthlyStatisticsWithYearStats();

  return monthly;
}

/** 同时返回 MonthlyData[] 与各月完成百分比，避免重复请求 */
export async function getMonthlyStatisticsWithYearStats(): Promise<CachedStats> {
  const { etag: cachedEtag, data: cachedData } = readCache();

  try {
    const res = await request.get<StatisticsLearnCountTwoResponse>(
      "/Statistics/StatisticsLearnCountTwo",
      {
        headers: cachedEtag ? { "If-None-Match": cachedEtag } : undefined,
        // 让 304 进入 success 分支，由我们自己复用缓存
        validateStatus: (s) => s === 304 || (s >= 200 && s < 300),
      },
    );

    // 304 Not Modified：服务端数据未变，复用本地缓存
    if (res.status === 304 && cachedData) {
      return cachedData;
    }

    const list = res.data?.data ?? [];
    const transformed = transform(list);
    const newEtag =
      (res.headers?.etag as string | undefined) ??
      (res.headers?.ETag as string | undefined) ??
      null;

    writeCache(newEtag, transformed);

    return transformed;
  } catch (err) {
    // 网络异常时若有缓存仍然返回，避免空白体验；无缓存才抛错
    if (cachedData) return cachedData;
    throw err;
  }
}

/**
 * 保存/更新月度学习任务（对应后端 SaveLearntask 接口）
 * 成功后清除本地 ETag 缓存，确保下次调用 getMonthlyStatisticsWithYearStats 能取到最新数据
 */
export async function saveLearntask(params: {
  count: number;
  year: number;
  month: number;
  weekend: 0 | 1 | 2 | 3;
}): Promise<void> {
  const dateStr = `${params.year}-${String(params.month).padStart(2, "0")}-01`;

  await request.post("/Statistics/SaveLearntask", null, {
    params: {
      id: 0,
      count: params.count,
      date: dateStr,
      weekend: params.weekend,
    },
  });

  // 清除 ETag，确保下次请求强制从服务端拉取最新数据
  if (typeof window !== "undefined") {
    localStorage.removeItem(STATS_ETAG_KEY);
  }
}

/**
 * 获取学习统计 KPI 数据（对应后端 GetStudyStatistics 接口）
 * 支持 ETag 协商缓存 + localStorage 本地缓存：
 *   1. 首次请求从服务端拉取，写入本地缓存；
 *   2. 后续请求携带 If-None-Match，服务端未变化时返回 304，复用本地缓存；
 *   3. 网络异常时若有缓存仍返回，避免白屏。
 * ETag 键使用 "stats:kpi:etag:v1"，与月统计接口的 STATS_ETAG_KEY 相互独立。
 */
const KPI_CACHE_KEY = "stats:kpi:v1";
const KPI_ETAG_KEY = "stats:kpi:etag:v1";

function readKpiCache(): { etag: string | null; data: WordStats | null } {
  if (typeof window === "undefined") return { etag: null, data: null };
  try {
    const etag = localStorage.getItem(KPI_ETAG_KEY);
    const raw = localStorage.getItem(KPI_CACHE_KEY);
    const data = raw ? (JSON.parse(raw) as WordStats) : null;

    return { etag, data };
  } catch {
    return { etag: null, data: null };
  }
}

function writeKpiCache(etag: string | null, data: WordStats): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KPI_CACHE_KEY, JSON.stringify(data));
    if (etag) localStorage.setItem(KPI_ETAG_KEY, etag);
    else localStorage.removeItem(KPI_ETAG_KEY);
  } catch {
    /* 容量满 / 隐私模式等异常忽略 */
  }
}

/**
 * 根据后端下发的 minDate / lastDate / lastCount，结合今天日期实时计算
 * todayCount 与 growthRate，确保即使从缓存读取也不会返回过期数值。
 */
function computeKpiRealtime(data: WordStats): WordStats {
  const today = new Date();

  today.setHours(0, 0, 0, 0);

  const lastDate = data.lastDate ? new Date(data.lastDate) : null;

  if (lastDate) lastDate.setHours(0, 0, 0, 0);

  const minDate = data.minDate ? new Date(data.minDate) : null;

  if (minDate) minDate.setHours(0, 0, 0, 0);

  if (minDate && lastDate) {
    const days = Math.round((today.getTime() - minDate.getTime()) / 86_400_000);
    const average = days > 0 ? data.masteredCount / days : 0;
    const todayCount =
      lastDate.getTime() === today.getTime() ? (data.lastCount ?? 0) : 0;
    const growthRate =
      average === 0
        ? 0
        : Math.round(((todayCount - average) / average) * 10000) / 100;

    return { ...data, todayCount, growthRate };
  }

  return data;
}

/** 读取上次本地缓存的 KPI 数据（用于首屏即时渲染） */
export function getCachedStudyStatistics(): WordStats | null {
  const data = readKpiCache().data;

  return data ? computeKpiRealtime(data) : null;
}

export async function getStudyStatistics(): Promise<WordStats> {
  const { etag: cachedEtag, data: cachedData } = readKpiCache();

  try {
    const res = await request.get<{
      success: boolean;
      studyStatistics: WordStats;
    }>("/Statistics/GetStudyStatistics", {
      headers: cachedEtag ? { "If-None-Match": cachedEtag } : undefined,
      validateStatus: (s) => s === 304 || (s >= 200 && s < 300),
    });

    // 304 Not Modified：服务端数据未变，复用本地缓存
    if (res.status === 304 && cachedData) {
      return computeKpiRealtime(cachedData);
    }

    const data = res.data.studyStatistics;
    const newEtag =
      (res.headers?.etag as string | undefined) ??
      (res.headers?.ETag as string | undefined) ??
      null;

    writeKpiCache(newEtag, data);

    return computeKpiRealtime(data);
  } catch (err) {
    if (cachedData) return computeKpiRealtime(cachedData);
    throw err;
  }
}
