"use client";

import type { LexiconDetail } from "@/types/word";

import { useEffect, useRef, useState } from "react";
import { Chip, ScrollShadow, Skeleton, Spinner } from "@heroui/react";

import { wordApi } from "@/lib/api";
import { OSS_BASE_URL } from "@/lib/api/config";

interface WordDetailProps {
  word: string;
  onDataLoaded?: (hasData: boolean) => void;
}

const ACTIVE_CONTROL_COLOR = "#0485f7";

function resetAudioHandlers(audio: HTMLAudioElement) {
  audio.onended = null;
  audio.onerror = null;
}

function HighlightWord({ text, word }: { text: string; word: string }) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === word.toLowerCase() ? (
          <span key={`${part}-${i}`} className="font-semibold zs text-primary">
            {part}
          </span>
        ) : (
          <span key={`${part}-${i}`}>{part}</span>
        ),
      )}
    </>
  );
}

function SpeakerIcon({ playing }: { playing: boolean }) {
  const stroke = playing ? ACTIVE_CONTROL_COLOR : "currentColor";
  const activeStyle = playing
    ? { color: ACTIVE_CONTROL_COLOR, stroke: ACTIVE_CONTROL_COLOR }
    : undefined;

  return (
    <svg
      className="shrink-0 transition-all duration-200 inline-block ml-2"
      fill="none"
      height="18"
      stroke={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      style={activeStyle}
      viewBox="0 0 24 24"
      width="18"
    >
      <polygon
        points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
        stroke={stroke}
        style={activeStyle}
      />
      <path
        className={playing ? "animate-pulse" : ""}
        d="M15.54 8.46a5 5 0 0 1 0 7.07"
        stroke={stroke}
        style={
          playing
            ? { ...activeStyle, animationDelay: "0s", animationDuration: "1s" }
            : { opacity: 0.25 }
        }
      />
      <path
        className={playing ? "animate-pulse" : ""}
        d="M19.07 4.93a10 10 0 0 1 0 14.14"
        stroke={stroke}
        style={
          playing
            ? {
                ...activeStyle,
                animationDelay: "0.3s",
                animationDuration: "1s",
              }
            : { opacity: 0 }
        }
      />
    </svg>
  );
}

function LoopIcon({ active }: { active: boolean }) {
  const stroke = active ? ACTIVE_CONTROL_COLOR : "currentColor";
  const activeStyle = active
    ? { color: ACTIVE_CONTROL_COLOR, stroke: ACTIVE_CONTROL_COLOR }
    : undefined;

  return (
    <svg
      className="shrink-0 transition-all duration-200"
      fill="none"
      height="14"
      stroke={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      style={activeStyle}
      viewBox="0 0 24 24"
      width="14"
    >
      <polyline points="17 1 21 5 17 9" stroke={stroke} style={activeStyle} />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" stroke={stroke} style={activeStyle} />
      <polyline points="7 23 3 19 7 15" stroke={stroke} style={activeStyle} />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" stroke={stroke} style={activeStyle} />
    </svg>
  );
}

export default function WordDetail({ word, onDataLoaded }: WordDetailProps) {
  const [loadState, setLoadState] = useState<{
    detail: LexiconDetail | null;
    loading: boolean;
    error: string | null;
  }>({
    detail: null,
    loading: true,
    error: null,
  });
  const [playingType, setPlayingType] = useState<"en" | "us" | "wd" | null>(
    null,
  );
  const [speechState, setSpeechState] = useState<
    "idle" | "loading" | "playing"
  >("idle");
  const [activeSentenceKey, setActiveSentenceKey] = useState<string | null>(
    null,
  );
  const [loopEn, setLoopEn] = useState(false);
  const [loopUs, setLoopUs] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioRunIdRef = useRef(0);
  const audioDisposedRef = useRef(false);
  const audioAbortControllerRef = useRef<AbortController | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const loopEnRef = useRef(false);
  const loopUsRef = useRef(false);
  const onDataLoadedRef = useRef(onDataLoaded);

  onDataLoadedRef.current = onDataLoaded;

  useEffect(() => {
    if (!word) return;
    let ignore = false;

    setSpeechState("idle");
    setActiveSentenceKey(null);

    wordApi
      .getWordDetail(word)
      .then((data) => {
        if (ignore) return;
        setLoadState({ detail: data, loading: false, error: null });
        onDataLoadedRef.current?.(data !== null);
      })
      .catch((e: Error) => {
        if (ignore) return;
        setLoadState({
          detail: null,
          loading: false,
          error: e.message ?? "加载失败",
        });
        onDataLoadedRef.current?.(false);
      });

    return () => {
      ignore = true;
    };
  }, [word]);

  useEffect(() => {
    const audio = new Audio();

    audioDisposedRef.current = false;
    audio.preload = "auto";
    audioRef.current = audio;
    return () => {
      audioDisposedRef.current = true;
      cleanupPendingSpeech();
      audio.pause();
      resetAudioHandlers(audio);
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
    };
  }, []);

  function getAudio() {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = "auto";
    }

    return audioRef.current;
  }

  function cleanupPendingSpeech() {
    audioAbortControllerRef.current?.abort();
    audioAbortControllerRef.current = null;

    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }
  }

  function startAudio(type: "en" | "us", loop: boolean) {
    const { detail } = loadState;
    const w = (detail?.word ?? word).toLowerCase();
    const url =
      type === "en"
        ? `${OSS_BASE_URL}/learnEnglish/Speech_EN/${w}.mp3`
        : `${OSS_BASE_URL}/learnEnglish/Speech_US/${w}.mp3`;

    const runId = audioRunIdRef.current + 1;

    audioRunIdRef.current = runId;
    const audio = getAudio();

    cleanupPendingSpeech();
    audio.pause();
    resetAudioHandlers(audio);
    if (audio.src !== url) {
      audio.src = url;
    }
    try {
      audio.currentTime = 0;
    } catch {
      // Some mobile browsers do not allow seeking until metadata is loaded.
    }
    audio.loop = loop;
    setPlayingType(type);

    const clearState = () => {
      if (audioDisposedRef.current || audioRunIdRef.current !== runId) return;
      setPlayingType(null);
      turnOffLoop(type);
    };

    audio.onended = () => {
      if (
        audioDisposedRef.current ||
        audioRunIdRef.current !== runId ||
        audio.loop
      )
        return;
      setPlayingType(null);
    };
    audio.onerror = clearState;
    audio.play().catch(clearState);
  }

  async function startSpeakAudio(text: string, sentenceKey: string) {
    const content = text.trim();

    if (!content) {
      setPlayingType(null);
      setSpeechState("idle");
      setActiveSentenceKey(null);
      return;
    }

    const runId = audioRunIdRef.current + 1;

    audioRunIdRef.current = runId;
    const audio = getAudio();

    cleanupPendingSpeech();
    audio.pause();
    resetAudioHandlers(audio);
    setPlayingType("wd");
    setSpeechState("loading");
    setActiveSentenceKey(sentenceKey);

    const abortController = new AbortController();

    audioAbortControllerRef.current = abortController;

    const clearState = () => {
      if (audioDisposedRef.current || audioRunIdRef.current !== runId) return;
      cleanupPendingSpeech();
      setPlayingType(null);
      setSpeechState("idle");
      setActiveSentenceKey(null);
    };

    try {
      const blob = await wordApi.getSpeechAudio(
        content,
        undefined,
        abortController.signal,
      );

      if (
        audioDisposedRef.current ||
        audioRunIdRef.current !== runId ||
        abortController.signal.aborted
      ) {
        return;
      }

      const objectUrl = URL.createObjectURL(blob);

      audioObjectUrlRef.current = objectUrl;
      audio.loop = false;
      audio.src = objectUrl;
      setSpeechState("playing");
      try {
        audio.currentTime = 0;
      } catch {
        // Ignore browsers that cannot seek a freshly loaded blob yet.
      }
      audio.onended = () => {
        if (audioDisposedRef.current || audioRunIdRef.current !== runId) return;
        cleanupPendingSpeech();
        setPlayingType(null);
        setSpeechState("idle");
        setActiveSentenceKey(null);
      };
      audio.onerror = clearState;
      await audio.play().catch(clearState);
    } catch {
      if (!abortController.signal.aborted) {
        clearState();
      }
    } finally {
      if (audioAbortControllerRef.current === abortController) {
        audioAbortControllerRef.current = null;
      }
    }
  }

  function stopAudio() {
    audioRunIdRef.current += 1;
    const audio = audioRef.current;

    cleanupPendingSpeech();
    if (audio) {
      audio.pause();
      resetAudioHandlers(audio);
      try {
        audio.currentTime = 0;
      } catch {
        // Ignore browsers that cannot seek the current resource.
      }
    }
    setPlayingType(null);
    setSpeechState("idle");
    setActiveSentenceKey(null);
  }

  function turnOffLoop(type: "en" | "us" | "wd") {
    if (type === "en") {
      setLoopEn(false);
      loopEnRef.current = false;
    } else if (type === "us") {
      setLoopUs(false);
      loopUsRef.current = false;
    } else {
      // Handle "wd" loop if needed
    }
  }

  function handlePlayClick(
    type: "en" | "us" | "wd",
    speakText?: string,
    sentenceKey?: string,
  ) {
    if (playingType === type) {
      if (type !== "wd" || activeSentenceKey === sentenceKey) {
        stopAudio();
        turnOffLoop(type);

        return;
      }

      stopAudio();
    }
    if (playingType) {
      turnOffLoop(playingType);
    }

    if (type === "wd") {
      void startSpeakAudio(
        speakText ?? loadState.detail?.word ?? word,
        sentenceKey ?? speakText ?? loadState.detail?.word ?? word,
      );
      return;
    }

    const shouldLoop = type === "en" ? loopEnRef.current : loopUsRef.current;

    startAudio(type, shouldLoop);
  }

  function handleLoopToggle(type: "en" | "us") {
    if (type === "en") {
      const newLoop = !loopEn;

      setLoopEn(newLoop);
      loopEnRef.current = newLoop;
      if (newLoop) {
        setLoopUs(false);
        loopUsRef.current = false;
        startAudio("en", true);
      } else {
        if (playingType === "en") stopAudio();
      }
    } else {
      const newLoop = !loopUs;

      setLoopUs(newLoop);
      loopUsRef.current = newLoop;
      if (newLoop) {
        setLoopEn(false);
        loopEnRef.current = false;
        startAudio("us", true);
      } else {
        if (playingType === "us") stopAudio();
      }
    }
  }

  if (loadState.loading) {
    return (
      <div className="w-full space-y-4 p-5">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <div className="flex gap-3">
          <Skeleton className="h-7 w-28 rounded-lg" />
          <Skeleton className="h-7 w-28 rounded-lg" />
        </div>
        <div className="space-y-2 pt-2">
          <Skeleton className="h-5 w-full rounded-lg" />
          <Skeleton className="h-5 w-4/5 rounded-lg" />
          <Skeleton className="h-5 w-3/5 rounded-lg" />
        </div>
      </div>
    );
  }

  if (loadState.error) {
    return (
      <div className="p-8 text-sm text-default-500">{loadState.error}</div>
    );
  }

  const { detail } = loadState;

  if (!detail) {
    return (
      <div className="p-8 text-sm text-default-500">
        单词不存在，请检查是否输入错误
      </div>
    );
  }

  function getSentenceKey(sentence: { en: string; cn?: string | null }) {
    return `${sentence.en}-${sentence.cn ?? ""}`;
  }

  return (
    <div className="w-full">
      <ScrollShadow className="max-h-[450px]">
        {/* 音标行 */}
        <div className="flex flex-wrap gap-3">
          {/* 英式发音 */}
          <div className="inline-flex items-center gap-0.5 rounded-full wordfy bg-transparent px-3 py-2 text-sm text-default-700 dark:border-default-700 dark:text-default-300">
            <button
              className="inline-flex cursor-pointer select-none items-center gap-1 outline-none"
              type="button"
              onClick={() => handlePlayClick("en")}
            >
              <span className="text-sm">英</span>
              {detail.britishPhonetic && (
                <span className="text-sm">[ {detail.britishPhonetic} ]</span>
              )}
              <SpeakerIcon playing={playingType === "en"} />
            </button>
            <span className="h-3 w-px shrink-0 bg-default-200 dark:bg-default-700" />
            <button
              className="cursor-pointer select-none outline-none"
              title={loopEn ? "关闭循环" : "开启循环"}
              type="button"
              onClick={() => handleLoopToggle("en")}
            >
              <LoopIcon active={loopEn} />
            </button>
          </div>

          {/* 美式发音 */}
          <div className="inline-flex items-center gap-0.5 rounded-full wordfy bg-transparent px-3 py-2 text-sm text-default-700 dark:border-default-700 dark:text-default-300">
            <button
              className="inline-flex cursor-pointer select-none items-center gap-1 outline-none"
              type="button"
              onClick={() => handlePlayClick("us")}
            >
              <span className="text-sm">美</span>
              {detail.americanPhonetic && (
                <span className="text-sm">[ {detail.americanPhonetic} ]</span>
              )}
              <SpeakerIcon playing={playingType === "us"} />
            </button>
            <span className="h-3 w-px shrink-0 bg-default-200 dark:bg-default-700" />
            <button
              className="cursor-pointer select-none outline-none"
              title={loopUs ? "关闭循环" : "开启循环"}
              type="button"
              onClick={() => handleLoopToggle("us")}
            >
              <LoopIcon active={loopUs} />
            </button>
          </div>
        </div>

        {/* 正文 */}
        <div className=" ">
          {/* 释义 */}
          <div className="flex flex-col gap-2 pt-4">
            {detail.translation?.map((item) => (
              <div key={item} className="text-base font-medium leading-6">
                {item}
              </div>
            ))}
          </div>

          {detail.frequence > 0 && (
            <Chip
              className="mt-4 px-4 py-1 text-xs"
              color="accent"
              size="sm"
              variant="soft"
            >
              高考 {detail.frequence} 次
            </Chip>
          )}

          {/* 例句 */}
          {detail.sampleSentences && detail.sampleSentences.length > 0 && (
            <div>
              <p className="mb-2 mt-4 text-sm text-muted text-default-500">
                例句
              </p>
              <div className="space-y-3">
                {detail.sampleSentences.map((sentence, idx) => (
                  <div
                    key={`${sentence.en}-${sentence.cn ?? ""}`}
                    className="flex items-baseline gap-2"
                  >
                    <span className="min-w-5 text-base text-default-400 text-center">
                      {idx + 1}
                    </span>

                    <div>
                      {(() => {
                        const sentenceKey = getSentenceKey(sentence);
                        const isActive = activeSentenceKey === sentenceKey;
                        const isLoading = isActive && speechState === "loading";
                        const isPlaying = isActive && speechState === "playing";

                        return (
                          <button
                            className="inline-flex cursor-pointer select-none items-center gap-1 outline-none"
                            type="button"
                            onClick={() =>
                              handlePlayClick("wd", sentence.en, sentenceKey)
                            }
                          >
                            <p className="mb-1 text-base font-medium leading-snug text-left leading-[22px]">
                              <HighlightWord
                                text={sentence.en}
                                word={detail.word}
                              />

                              {isLoading && (
                                <span className="inline-flex align-middle items-center ml-2 h-[20px]">
                                  <Spinner
                                    size="sm"
                                    className="inline-block"
                                  />
                                </span>
                              )}
                              {!isLoading && (
                                <span className="inline-flex align-middle h-[20px]">
                                  <SpeakerIcon playing={isPlaying} />
                                </span>
                              )}
                            </p>
                          </button>
                        );
                      })()}
                      {sentence.cn && (
                        <p className="text-sm leading-relaxed text-default-500">
                          {sentence.cn}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollShadow>
    </div>
  );
}
