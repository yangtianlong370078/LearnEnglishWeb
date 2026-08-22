/**
 * 课程学习模块类型定义
 * 对应后端 /api/Word/Words、/api/Word/updcnoV2、/api/Whisper/Recognize
 */

/** 学习状态：1 不认识 / 2 学习中 / 3 已掌握 */
export type LearnStatus = 1 | 2 | 3;

/** 单条单词数据（/api/Word/Words 返回项） */
export interface LearnWord {
  id: number;
  lexiconId: number;
  en: string;
  cn: string;
  isCollect: number;
  numberSum: number;
  /** 中-英 练习次数 */
  zyNumber: number;
  /** 英-中 练习次数 */
  yzNumber: number;
  /** 听写 练习次数 */
  txNumber: number;
  /** 语音 练习次数 */
  fyNumber: number;
  myWord?: boolean;
}

/** /api/Word/Words 完整响应结构 */
export interface WordsResponse {
  success: boolean;
  data: LearnWord[];
  total: number;
  pageIndex: number;
  pageSize: number;
  /** 不认识数量 */
  brs: number;
  /** 学习中数量 */
  wlj: number;
  /** 已掌握数量 */
  yzw: number;
}

/** 查询参数 */
export interface WordsQueryParams {
  kc: number;
  zt: LearnStatus;
  index: number;
  pageSize: number;
}

/** 四种学习模式对应的练习次数字段名 */
export type LearnFieldKey = "yzNumber" | "zyNumber" | "txNumber" | "fyNumber";

/** 四种学习模式标识 */
export type LearnMode = "en-cn" | "cn-en" | "dictation" | "speech";

/** 练习次数更新记录（提交给 /api/Word/updcnoV2 的 data 字段）
 *  注意：后端 ModifyNumberAsync 以整型 type 区分字段：
 *  1=zynumber(中-英) 2=yznumber(英-中) 3=txnumber(听写) 4=fynumber(语音) */
export interface NumberUpdateRecord {
  id: number;
  no: number;
  type: number;
}

/** 语音识别模型类型 */
export type AsrModelType = "1" | "2" | "3" | "4";

/** 首选口音 */
export type AccentType = "Speech_US" | "Speech_EN";

/** 课程学习设置 */
export interface CourseLearnSettings {
  /** 自动发音（单词详情用） */
  autoSpeak: boolean;
  /** 隐藏释义（单词详情用） */
  hideMeaning: boolean;
  /** 首选口音 */
  accent: AccentType;
  /** 听写播放次数 */
  dictationCount: number;
  /** 语音识别模型 */
  asrModelType: AsrModelType;
}

/** /api/Whisper/Recognize 返回结构 */
export interface WhisperRecognizeResult {
  result: boolean;
  scoring: number;
  success: boolean;
}
