/** 听力课程分组。 */
export interface ListeningCourse {
  id: number;
  name: string;
  folderPrefix: string;
  subCourses: ListeningSubCourse[];
}

/** 听力子课程（册次）。 */
export interface ListeningSubCourse {
  id: number;
  courseId: number;
  name: string;
  folderName: string;
  sortOrder: number;
  lessonCount: number;
}

/** 听力课文章节。 */
export interface ListeningLesson {
  id: number;
  subCourseId: number;
  title: string;
  filename: string;
  sortOrder: number;
  isFavorited: boolean;
  courseId?: number;
  courseName?: string;
  subCourseName?: string;
}

/** 收藏章节及其完整课程层级。 */
export interface ListeningFavoriteLesson extends ListeningLesson {
  favoriteId: number;
  courseId: number;
  courseName: string;
  subCourseName: string;
  createDate: string;
}

export interface ListeningFavoriteState {
  lessonId: number;
  isFavorited: boolean;
}

/** 当前浏览器最近一次主动学习的章节。 */
export interface RecentListeningLesson {
  courseId: number;
  courseName: string;
  subCourseId: number;
  subCourseName: string;
  lessonId: number;
  lessonTitle: string;
  lastLearnedAt: string;
}

export type ListeningLanguage = "en" | "bi" | "cn";
export type ListeningMode = "continuous" | "single" | "dictation" | "shadow";
export type ListeningAfterPlay = "stop" | "repeat" | "next" | "all";

/** listening 独立学习设置，持久化到 listening:settings。 */
export interface ListeningSettings {
  language: ListeningLanguage;
  mode: ListeningMode;
  afterPlay: ListeningAfterPlay;
  skipIntro: boolean;
  autoFollow: boolean;
  playbackRate: number;
  shadowRepeatCount: number;
  shadowGap: number;
}

/** LRC 元数据；raw 保留文件中的全部元数据字段。 */
export interface ListeningLrcMetadata {
  title?: string;
  artist?: string;
  album?: string;
  by?: string;
  offset?: string;
  raw: Record<string, string>;
}

/** 一条 LRC 字幕，index 始终表示其在原文件中的顺序。 */
export interface ListeningLrcLine {
  index: number;
  start: number;
  end: number;
  en: string;
  cn: string;
  raw: string;
}

export interface ListeningLrcDocument {
  metadata: ListeningLrcMetadata;
  lines: ListeningLrcLine[];
  raw: string;
}
