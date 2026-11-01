/** 听力学习模块接口，对应后端 /api/listening。 */
import type {
  ListeningCourse,
  ListeningFavoriteLesson,
  ListeningFavoriteState,
  ListeningLesson,
} from "@/types/listening";

import { del, get, put } from "../request";

const BASE_URL = "/listening";

export function getCourses(): Promise<ListeningCourse[]> {
  return get<ListeningCourse[]>(`${BASE_URL}/courses`);
}

export function getLessons(subCourseId: number): Promise<ListeningLesson[]> {
  return get<ListeningLesson[]>(
    `${BASE_URL}/sub-courses/${subCourseId}/lessons`,
  );
}

export function getLessonLrc(lessonId: number): Promise<string> {
  return get<string>(`${BASE_URL}/lessons/${lessonId}/lrc`);
}

export function favoriteLesson(
  lessonId: number,
): Promise<ListeningFavoriteState> {
  return put<ListeningFavoriteState>(
    `${BASE_URL}/lessons/${lessonId}/favorite`,
  );
}

export function unfavoriteLesson(
  lessonId: number,
): Promise<ListeningFavoriteState> {
  return del<ListeningFavoriteState>(
    `${BASE_URL}/lessons/${lessonId}/favorite`,
  );
}

export function getFavoriteCount(): Promise<{ count: number }> {
  return get<{ count: number }>(`${BASE_URL}/favorites/count`);
}

export function getFavorites(): Promise<ListeningFavoriteLesson[]> {
  return get<ListeningFavoriteLesson[]>(`${BASE_URL}/favorites`);
}

/** 直接交给 audio 元素，保留浏览器 Range 请求能力。 */
export function getAudioUrl(subCourseId: number, lessonId: number): string {
  return `/api/listening/audio/${subCourseId}/${lessonId}`;
}
