/**
 * 单词模块接口
 * 对应后端 /api/Word 路由
 */
import { get, post, put, del } from "../request";
import type { LexiconDetail, Word, WordQueryParams, WordStats } from "@/types/word";
import type { PageData } from "@/types/api";

/** 获取单词 KPI 统计 */
export function getWordStats() {
  return get<WordStats>("/Word/stats");
}

/** 分页查询单词列表 */
export function getWordList(params: WordQueryParams) {
  return get<PageData<Word>>("/Word/list", params as unknown as Record<string, unknown>);
}

/** 获取单词详情 */
export function getWordById(id: number) {
  return get<Word>(`/Word/${id}`);
}

/** 新增单词 */
export function createWord(data: Omit<Word, "id" | "createdAt" | "lastStudiedAt">) {
  return post<Word>("/Word", data);
}

/** 更新单词状态 */
export function updateWordStatus(id: number, status: Word["status"]) {
  return put<void>(`/Word/${id}/status`, { status });
}

/** 删除单词 */
export function deleteWord(id: number) {
  return del<void>(`/Word/${id}`);
}

/** 获取单词词典详情（对应后端 lexiconDeatil 接口） */
export function getWordDetail(word: string) {
  return get<LexiconDetail>("/Word/lexiconDeatil", { word });
}
