import type {
  ExamActionResponse,
  ExamContentResponse,
  ExamDetail,
  ExamListResponse,
  ExamStatistics,
} from "./types";
import type { WhisperRecognizeResult } from "@/types/courselearn";

import request from "@/lib/api/request";

const ROOT = "/ExamV2";

export const examApi = {
  async list(index: number, pageSize = 12): Promise<ExamListResponse> {
    const res = await request.get<ExamListResponse>(`${ROOT}/ExamList`, {
      params: { index, pageSize },
    });

    return res.data;
  },

  async statistics(): Promise<ExamStatistics> {
    const res = await request.get<{ data: ExamStatistics }>(
      `${ROOT}/ExamStatistics`,
    );

    return res.data.data;
  },

  async detail(examId: number): Promise<ExamDetail> {
    const res = await request.get<{ data: ExamDetail }>(`${ROOT}/GetExam`, {
      params: { examid: examId },
    });

    return res.data.data;
  },

  async content(examId: number, type: number): Promise<ExamContentResponse> {
    const res = await request.get<ExamContentResponse>(
      `${ROOT}/ExamContentList`,
      { params: { id: examId, type } },
    );

    return res.data;
  },

  async create(examCount: number, limitTime: number): Promise<void> {
    await request.post<ExamActionResponse>(`${ROOT}/SaveExam`, null, {
      params: { examcount: examCount, limittime: limitTime },
    });
  },

  async remove(examId: number): Promise<void> {
    await request.post<ExamActionResponse>(`${ROOT}/DeleteExam`, null, {
      params: { examid: examId },
    });
  },

  async restart(examId: number, type: number): Promise<void> {
    await request.post<ExamActionResponse>(`${ROOT}/RestartExam`, null, {
      params: { examid: examId, type },
    });
  },

  async submit(
    examId: number,
    type: number,
    limitTime: number,
    score: number,
    wrongAnswers: Array<{ examdetailid: number; answer: string }>,
  ): Promise<void> {
    await request.post<ExamActionResponse>(`${ROOT}/InsertExamnswer`, {
      data: JSON.stringify(wrongAnswers),
      examid: examId,
      type,
      score,
      limittime: limitTime,
    });
  },

  async recognizeSpeech(
    audioFile: Blob,
    word: string,
    asrModelType: string,
  ): Promise<boolean> {
    const form = new FormData();

    form.append("audioFile", audioFile, "recording.webm");
    form.append("word", word);
    form.append("type", asrModelType);
    const res = await request.post<WhisperRecognizeResult>(
      "/Whisper/Recognize",
      form,
      {
        // 清除实例默认的 application/json，让浏览器生成 multipart 边界。
        headers: { "Content-Type": null },
      },
    );

    return res.data.result === true;
  },
};
