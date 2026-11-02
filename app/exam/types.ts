import type { LearnMode } from "@/types/courselearn";

export type ExamMode = LearnMode;
export type ScoringMode = "realtime" | "onSubmit";

export interface ExamModeCount {
  examId: number;
  isCompleted: boolean;
  type: number;
  count: number;
}

export interface ExamSummary {
  id: number;
  name: string;
  examcount: number;
  createtime: string;
  limittime: number;
  txScore: number;
  yzScore: number;
  zyScore: number;
  fyScore: number;
  txCompleted: boolean;
  yzCompleted: boolean;
  zyCompleted: boolean;
  fyCompleted: boolean;
}

export interface ExamDetail {
  id: number;
  name: string;
  userId: number;
  count: number;
  limitTime: number;
  createDate: string;
  txCount: ExamModeCount;
  yzCount: ExamModeCount;
  zyCount: ExamModeCount;
  fyCount: ExamModeCount;
  txScore: number;
  yzScore: number;
  zyScore: number;
  fyScore: number;
}

export interface ExamContent {
  id: number;
  lexiconId: number;
  en: string;
  cn: string;
  examId: number;
  type: number;
  isOk: boolean | null;
  answer: string;
  name: string;
  value: string;
  isEnAudio: number;
  isUsAudio: number;
}

export interface ExamStatistics {
  totalExams: number;
  totalWords: number;
  completedModes: number;
  averageScore: number;
}

export interface AnswerState {
  value: string;
  completed: boolean;
  correct?: boolean;
  attempts: number;
}

export interface ExamSession {
  scoring: ScoringMode;
  duration: number;
  deadline: number;
}

export interface ExamListResponse {
  success: boolean;
  data: ExamSummary[];
  total: number;
  pageIndex: number;
  pageSize: number;
}

export interface ExamContentResponse {
  success: boolean;
  data: ExamContent[];
  limittime: number;
  score: number;
  isexam: boolean;
  completed: boolean;
}

export interface ExamActionResponse {
  success?: boolean;
  succss?: boolean;
  msg?: string;
  wordCount?: number;
}
