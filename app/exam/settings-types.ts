/**
 * 考试模块类型定义
 */

/** 听写口音类型 */
export type ExamAccentType = "Speech_US" | "Speech_EN";

/** 语音识别模型类型 */
export type ExamAsrModelType = "1" | "2" | "3" | "4";

/** 考试设置 */
export interface ExamSettings {
  /** 听写口音 */
  accent: ExamAccentType;
  /** 听写复读次数：1-10次 */
  dictationPlayCount: number;
  /** 错误重试次数：1-10次 */
  retryCount: number;
  /** 语音识别模型 */
  asrModelType: ExamAsrModelType;
}

/** 默认考试设置 */
export const DEFAULT_EXAM_SETTINGS: ExamSettings = {
  accent: "Speech_US",
  dictationPlayCount: 3,
  retryCount: 3,
  asrModelType: "2",
};
