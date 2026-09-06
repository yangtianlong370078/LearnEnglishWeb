/**
 * 课程学习模块共享常量与工具函数
 */
import type {
  AccentType,
  LearnFieldKey,
  LearnMode,
  NumberUpdateRecord,
} from "@/types/courselearn";

import { OSS_BASE_URL } from "@/lib/api/config";

/** 四种学习模式对应的练习次数字段 */
export const MODE_FIELD: Record<LearnMode, LearnFieldKey> = {
  "en-cn": "yzNumber",
  "cn-en": "zyNumber",
  dictation: "txNumber",
  speech: "fyNumber",
};

/** 四种学习模式中文标签 */
export const MODE_LABEL: Record<LearnMode, string> = {
  "en-cn": "英-中",
  "cn-en": "中-英",
  dictation: "听写",
  speech: "语音",
};

/** 学习模式顺序（用于工具栏与卡片按钮渲染） */
export const MODE_ORDER: LearnMode[] = [
  "en-cn",
  "cn-en",
  "dictation",
  "speech",
];

/** 四种学习模式主题色：from→to 激活渐变，soft 关闭态底色 */
export const MODE_THEME: Record<
  LearnMode,
  { from: string; to: string; soft: string }
> = {
  "en-cn": { from: "#37a6ff", to: "#166bd8", soft: "rgba(38, 132, 255, 0.3)" },
  "cn-en": { from: "#8f80ff", to: "#5a48d8", soft: "rgba(122, 100, 255, 0.3)" },
  dictation: { from: "#3fd0c9", to: "#0d9d97", soft: "rgba(32, 196, 188, 0.3)" },
  speech: { from: "#ffb54d", to: "#f2801f", soft: "rgba(255, 166, 51, 0.32)" },
};

/**
 * 【备用配色】翻译 / 练习工具按钮主题色：from→to 激活渐变，soft 关闭态底色。
 * 当前工具按钮采用白色系配色，此主题保留备用（可配合 cl-global-btn 使用）。
 */
export const TOOL_THEME = {
  translation: { from: "#f472b6", to: "#d63384", soft: "rgba(244, 114, 182, 0.3)" },
  practice: { from: "#3ddc97", to: "#0e9f6e", soft: "rgba(61, 220, 151, 0.3)" },
} as const;

/**
 * 「音频类」学习模式（听写 / 语音）判定。
 * 全局或任一单词卡开启该类模式时，【翻译】功能须关闭且不可点击。
 */
export function isAudioMode(mode: LearnMode | null | undefined): boolean {
  return mode === "dictation" || mode === "speech";
}

/**
 * 练习次数字段 → 后端 updcnoV2 的整型 type。
 * 对应后端 ModifyNumberAsync：1=zynumber 2=yznumber 3=txnumber 4=fynumber。
 */
export const FIELD_SAVE_TYPE: Record<LearnFieldKey, number> = {
  zyNumber: 1,
  yzNumber: 2,
  txNumber: 3,
  fyNumber: 4,
};

/** 进度环最大有效值（超过按满算） */
export const PROGRESS_CAP = 10;
/** 练习次数硬上限（后端 clamp 0-15） */
export const NUMBER_MAX = 15;

/** 计算进度百分比：取 0-10 映射为 0-100，>10 记为 10 */
export function progressPercent(value: number): number {
  const v = Math.max(0, Math.min(PROGRESS_CAP, value));

  return (v / PROGRESS_CAP) * 100;
}

/** 拼接单词发音 OSS 地址 */
export function buildAudioUrl(word: string, accent: AccentType): string {
  return `${OSS_BASE_URL}/learnEnglish/${accent}/${word}.mp3`;
}

/** 生成一条练习记录（no 已 clamp 0-15，type 转为后端整型） */
export function buildRecord(
  lexiconId: number,
  newValue: number,
  field: LearnFieldKey,
): NumberUpdateRecord {
  return {
    id: lexiconId,
    no: Math.max(0, Math.min(NUMBER_MAX, newValue)),
    type: FIELD_SAVE_TYPE[field],
  };
}

/** 计算判定后的新练习次数：正确 +1，错误 -3 */
export function nextNumber(current: number, correct: boolean): number {
  const delta = correct ? 1 : -3;

  return Math.max(0, Math.min(NUMBER_MAX, current + delta));
}

/** 大小写/空白无关的包含判断 */
export function includesIgnoreCase(haystack: string, needle: string): boolean {
  const a = haystack.trim().toLowerCase();
  const b = needle.trim().toLowerCase();

  if (!b) return false;

  return a.includes(b);
}

/** 归一化英文单词用于全等比较（去空白、小写） */
export function normalizeWord(text: string): string {
  return text.trim().toLowerCase();
}

/** 音频时长缓存（毫秒），键为音频 URL */
const durationCache = new Map<string, number>();

/**
 * 获取音频时长（毫秒）。加载失败时回退为 fallbackMs。
 */
export function getAudioDurationMs(
  url: string,
  fallbackMs = 1500,
): Promise<number> {
  const cached = durationCache.get(url);

  if (cached != null) return Promise.resolve(cached);

  return new Promise((resolve) => {
    const audio = new Audio();
    let settled = false;

    const done = (ms: number) => {
      if (settled) return;
      settled = true;
      durationCache.set(url, ms);
      resolve(ms);
    };

    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const ms =
        Number.isFinite(audio.duration) && audio.duration > 0
          ? Math.round(audio.duration * 1000)
          : fallbackMs;

      done(ms);
    };
    audio.onerror = () => done(fallbackMs);
    // 兜底超时，避免元数据长期不返回
    setTimeout(() => done(fallbackMs), 4000);
    audio.src = url;
  });
}
