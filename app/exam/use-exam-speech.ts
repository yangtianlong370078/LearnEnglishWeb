"use client";

import type { AccentType, AsrModelType } from "@/types/courselearn";

import { useCallback, useEffect, useRef, useState } from "react";

import { examApi } from "./api";

import {
  buildAudioUrl,
  getAudioDurationMs,
} from "@/components/courselearn/lib";
import { startXunfeiRecognition } from "@/components/courselearn/xunfei";
import type { XunfeiSession } from "@/components/courselearn/xunfei";

/** 考试语音识别：手动开始/提前结束，切题或交卷时可作废旧任务。 */
export function useExamSpeech() {
  const [isRecording, setIsRecording] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const runRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const xunfeiRef = useRef<XunfeiSession | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    runRef.current += 1;
    clearTimer();
    const recorder = recorderRef.current;

    recorderRef.current = null;
    if (recorder?.state === "recording") {
      try {
        recorder.stop();
      } catch {
        // 已停止的录音器无需重复处理。
      }
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    // 停止讯飞会话
    if (xunfeiRef.current) {
      xunfeiRef.current.stop();
      xunfeiRef.current = null;
    }
    setIsRecording(false);
    setIsRecognizing(false);
  }, [clearTimer]);

  useEffect(() => cancel, [cancel]);

  const stopRecording = useCallback(() => {
    clearTimer();
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    // 讯飞会话也需要停止
    if (xunfeiRef.current) {
      xunfeiRef.current.stop();
    }
    setIsRecording(false);
  }, [clearTimer]);

  const recognize = useCallback(
    async (
      word: string,
      accent: AccentType,
      asrModelType: AsrModelType,
    ): Promise<boolean | null> => {
      cancel();
      const runId = runRef.current;
      const url = buildAudioUrl(encodeURIComponent(word), accent);
      const duration = await getAudioDurationMs(url);
      const recordMs = duration + 1000;

      // 讯飞语音：前端直连
      if (asrModelType === "2") {
        try {
          setIsRecording(true);
          const session = await startXunfeiRecognition(word);

          if (runRef.current !== runId) {
            session.stop();
            return null;
          }

          xunfeiRef.current = session;
          timerRef.current = setTimeout(() => session.stop(), recordMs);
          const correct = await session.result;

          if (runRef.current !== runId) return null;
          clearTimer();
          xunfeiRef.current = null;
          setIsRecording(false);
          return correct;
        } catch {
          if (runRef.current !== runId) return null;
          setIsRecording(false);
          return false;
        }
      }

      // 其他模型：录音后走后端 Whisper
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (runRef.current !== runId) {
        stream.getTracks().forEach((track) => track.stop());
        return null;
      }

      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorderRef.current = recorder;
      setIsRecording(true);

      return new Promise<boolean | null>((resolve, reject) => {
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => {
          clearTimer();
          stream.getTracks().forEach((track) => track.stop());
          setIsRecording(false);
          reject(new Error("录音失败，请检查麦克风后重试"));
        };
        recorder.onstop = () => {
          clearTimer();
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          recorderRef.current = null;
          setIsRecording(false);
          if (runRef.current !== runId) {
            resolve(null);
            return;
          }

          setIsRecognizing(true);
          const blob = new Blob(chunks, {
            type: recorder.mimeType || "audio/webm",
          });

          void examApi
            .recognizeSpeech(blob, word, asrModelType)
            .then((correct) => {
              if (runRef.current !== runId) resolve(null);
              else resolve(correct);
            })
            .catch((reason: unknown) => {
              if (runRef.current === runId) reject(reason);
              else resolve(null);
            })
            .finally(() => {
              if (runRef.current === runId) setIsRecognizing(false);
            });
        };

        recorder.start();
        timerRef.current = setTimeout(() => {
          if (recorder.state === "recording") recorder.stop();
        }, recordMs);
      });
    },
    [cancel, clearTimer],
  );

  return { recognize, stopRecording, cancel, isRecording, isRecognizing };
}
