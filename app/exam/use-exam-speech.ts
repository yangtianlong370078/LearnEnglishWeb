"use client";

import type { AccentType } from "@/types/courselearn";

import { useCallback, useEffect, useRef, useState } from "react";

import { examApi } from "./api";

import {
  buildAudioUrl,
  getAudioDurationMs,
} from "@/components/courselearn/lib";

/** 考试语音识别：手动开始/提前结束，切题或交卷时可作废旧任务。 */
export function useExamSpeech() {
  const [isRecording, setIsRecording] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const runRef = useRef(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setIsRecording(false);
    setIsRecognizing(false);
  }, [clearTimer]);

  useEffect(() => cancel, [cancel]);

  const stopRecording = useCallback(() => {
    clearTimer();
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    setIsRecording(false);
  }, [clearTimer]);

  const recognize = useCallback(
    async (word: string, accent: AccentType): Promise<boolean | null> => {
      cancel();
      const runId = runRef.current;
      const url = buildAudioUrl(encodeURIComponent(word), accent);
      const duration = await getAudioDurationMs(url);
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
            .recognizeSpeech(blob, word)
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
        }, duration + 1000);
      });
    },
    [cancel, clearTimer],
  );

  return { recognize, stopRecording, cancel, isRecording, isRecognizing };
}
