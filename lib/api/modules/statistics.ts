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

/** 后端返回的月度任务原始结构（精简版：只含前端实际使用的字段） */
interface LearnTaskRaw {
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
  /** 未配置任务时为 null */
  task: LearnTaskRaw | null;
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

  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    statisticsLearns: raw.statisticsLearns.map(toStatisticsLearn),
    // 仅当后端确实下发了任务（task !== null）时才视为有任务，
    // 避免历史实现中“空任务 = count:0 的 MonthlyTask”造成误判
    task: raw.task
      ? {
          count: raw.task.count,
          weekend: (raw.task.weekend ?? 0) as 0 | 1 | 2 | 3,
        }
      : null,
  };
}

/** 计算单个月份的完成百分比 */
function calcPercent(raw: MonthlyCategoryRaw): number | null {
  const taskCount = raw.task?.count ?? 0;

  if (taskCount <= 0) return null;
  const percent = Math.round((raw.totalcount / taskCount) * 100);

  return Math.max(0, Math.min(100, percent));
}

// ─── 协商缓存 + localStorage 本地缓存 ───────────────────────────────
// 与后端 ETag 配合：
// 1. 首次请求后把 ETag 与转换后的结果写入 localStorage；
// 2. 后续请求带上 If-None-Match；服务端命中后返回 304（axios 默认会抛错），
//    此时复用 localStorage 缓存，避免下载/解析整个响应体。
const STATS_CACHE_KEY = "stats:monthly:v1";
const STATS_ETAG_KEY = "stats:monthly:etag:v1";

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

function transform(list: MonthlyCategoryRaw[]): CachedStats {
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

    const list = res.data?.categorys ?? [];
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
