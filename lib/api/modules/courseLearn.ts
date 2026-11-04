/**
 * 课程学习模块接口
 * 对应后端 /api/Word/Words、/api/Word/updcnoV2、/api/Whisper/Recognize
 */
import type {
  LearnStatus,
  NumberUpdateRecord,
  WhisperRecognizeResult,
  WordsQueryParams,
  WordsResponse,
} from "@/types/courselearn";

import request from "../request";

/** 兼容部分单词接口将 success 拼写为 succss 的响应。 */
function normalizeWordActionResponse(data: string) {
  const result = JSON.parse(data) as {
    success?: boolean;
    succss?: boolean;
    msg?: string;
  };

  return { ...result, success: result.success ?? result.succss };
}

/** 删除课程中的自定义单词，使用课程内容 id。 */
export async function deleteWord(courseContentId: number): Promise<void> {
  await request.post("/Word/deletedc", null, {
    params: { courseContentId },
  });
}

/** 加入或移除强化区。 */
export async function setCollect(
  lexiconId: number,
  isCollect: boolean,
): Promise<void> {
  await request.post("/Word/SetCollect", null, {
    params: { lexiconId, isCollect },
    transformResponse: normalizeWordActionResponse,
  });
}

/** 将单词转入指定学习状态。 */
export async function setWordStatus(
  lexiconId: number,
  zt: LearnStatus,
): Promise<void> {
  await request.post("/Word/szzt", null, {
    params: { lexiconId, zt },
    transformResponse: normalizeWordActionResponse,
  });
}

/**
 * 分页查询课程单词列表。
 * 该接口返回结构非标准（顶层含 total/brs/wlj/yzw），故直接取完整 response.data。
 */
export async function queryWords(
  params: WordsQueryParams,
): Promise<WordsResponse> {
  const res = await request.get<WordsResponse>("/Word/Words", { params });

  return res.data;
}

/**
 * 批量保存练习次数记录。
 * 后端以表单字段 data 接收 JSON 字符串，成功返回 success=true
 * （旧版后端返回 succss 拼写有误，通过 transformResponse 做兼容）。
 */
export async function saveNumberRecords(
  records: NumberUpdateRecord[],
): Promise<void> {
  if (records.length === 0) return;

  const form = new FormData();

  form.append("data", JSON.stringify(records));

  await request.post("/Word/updcnoV2", form, {
    // 清除实例默认的 application/json，让浏览器生成 multipart 边界，
    // 否则后端 [FromForm] string data 绑定失败导致接口调不通。
    headers: { "Content-Type": undefined },
    transformResponse: normalizeWordActionResponse,
  });
}

/**
 * 语音识别校验（非讯飞模型走后端）。
 * @returns 识别是否正确
 */
export async function recognizeSpeech(
  audioFile: Blob,
  word: string,
  type: string,
): Promise<boolean> {
  const form = new FormData();

  form.append("audioFile", audioFile, "recording.webm");
  form.append("word", word);
  form.append("type", type);

  const res = await request.post<WhisperRecognizeResult>(
    "/Whisper/Recognize",
    form,
    {
      // 清除实例默认的 application/json，让浏览器生成 multipart 边界。
      headers: { "Content-Type": undefined },
    },
  );

  return res.data?.result === true;
}
