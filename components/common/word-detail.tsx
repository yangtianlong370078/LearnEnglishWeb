"use client";

import { useEffect, useRef, useState } from "react";
import { Chip, ScrollShadow, Skeleton } from "@heroui/react";
import { wordApi } from "@/lib/api";
import { OSS_BASE_URL } from "@/lib/api/config";
import type { LexiconDetail } from "@/types/word";

interface WordDetailProps {
  word: string;
  onDataLoaded?: (hasData: boolean) => void;
}

const ACTIVE_CONTROL_COLOR = "#0485f7";

function HighlightWord({ text, word }: { text: string; word: string }) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === word.toLowerCase() ? (
          <span key={i} className="font-semibold zs text-primary">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function SpeakerIcon({ playing }: { playing: boolean }) {
  const stroke = playing ? ACTIVE_CONTROL_COLOR : "currentColor";
  const activeStyle = playing ? { color: ACTIVE_CONTROL_COLOR, stroke: ACTIVE_CONTROL_COLOR } : undefined;

  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 transition-all duration-200"
      style={activeStyle}
    >
      <polygon
        points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
        stroke={stroke}
        style={activeStyle}
      />
      <path
        d="M15.54 8.46a5 5 0 0 1 0 7.07"
        className={playing ? "animate-pulse" : ""}
        stroke={stroke}
        style={
          playing
            ? { ...activeStyle, animationDelay: "0s", animationDuration: "1s" }
            : { opacity: 0.25 }
        }
      />
      <path
        d="M19.07 4.93a10 10 0 0 1 0 14.14"
        className={playing ? "animate-pulse" : ""}
        stroke={stroke}
        style={
          playing
            ? { ...activeStyle, animationDelay: "0.3s", animationDuration: "1s" }
            : { opacity: 0 }
        }
      />
    </svg>
  );
}

function LoopIcon({ active }: { active: boolean }) {
  const stroke = active ? ACTIVE_CONTROL_COLOR : "currentColor";
  const activeStyle = active ? { color: ACTIVE_CONTROL_COLOR, stroke: ACTIVE_CONTROL_COLOR } : undefined;

  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 transition-all duration-200"
      style={activeStyle}
    >
      <polyline points="17 1 21 5 17 9" stroke={stroke} style={activeStyle} />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" stroke={stroke} style={activeStyle} />
      <polyline points="7 23 3 19 7 15" stroke={stroke} style={activeStyle} />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" stroke={stroke} style={activeStyle} />
    </svg>
  );
}

export default function WordDetail({ word, onDataLoaded }: WordDetailProps) {
  const [detail, setDetail] = useState<LexiconDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingType, setPlayingType] = useState<"en" | "us" | null>(null);
  const [loopEn, setLoopEn] = useState(false);
  const [loopUs, setLoopUs] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioRunIdRef = useRef(0);
  const loopEnRef = useRef(false);
  const loopUsRef = useRef(false);

  useEffect(() => {
    if (!word) return;
    setLoading(true);
    setError(null);
    setDetail(null);
    setPlayingType(null);
    setLoopEn(false);
    setLoopUs(false);
    loopEnRef.current = false;
    loopUsRef.current = false;
    stopAudio();
    wordApi
      .getWordDetail(word)
      .then((data) => {
        setDetail(data);
        onDataLoaded?.(data !== null);
      })
      .catch((e: Error) => {
        setError(e.message ?? "加载失败");
        onDataLoaded?.(false);
      })
      .finally(() => setLoading(false));
  }, [word, onDataLoaded]);

  useEffect(() => {
    return () => {
      stopAudio();
      audioRef.current = null;
    };
  }, []);

  function getAudio() {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = "auto";
    }
    return audioRef.current;
  }

  function resetAudioHandlers(audio: HTMLAudioElement) {
    audio.onended = null;
    audio.onerror = null;
  }

  function startAudio(type: "en" | "us", loop: boolean) {
    const w = (detail?.word ?? word).toLowerCase();
    const url =
      type === "en"
        ? `${OSS_BASE_URL}/learnEnglish/Speech_EN/${w}.mp3`
        : `${OSS_BASE_URL}/learnEnglish/Speech_US/${w}.mp3`;

    const runId = audioRunIdRef.current + 1;
    audioRunIdRef.current = runId;
    const audio = getAudio();
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
      if (audioRunIdRef.current !== runId) return;
      setPlayingType(null);
      turnOffLoop(type);
    };

    audio.onended = () => {
      if (audioRunIdRef.current !== runId || audio.loop) return;
      setPlayingType(null);
    };
    audio.onerror = clearState;
    audio.play().catch(clearState);
  }

  function stopAudio() {
    audioRunIdRef.current += 1;
    const audio = audioRef.current;
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
  }

  function turnOffLoop(type: "en" | "us") {
    if (type === "en") {
      setLoopEn(false);
      loopEnRef.current = false;
    } else {
      setLoopUs(false);
      loopUsRef.current = false;
    }
  }

  function handlePlayClick(type: "en" | "us") {
    if (playingType === type) {
      stopAudio();
      turnOffLoop(type);
      return;
    }
    if (playingType) {
      turnOffLoop(playingType);
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

  if (loading) {
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

  if (error) {
    return <div className="p-8 text-sm text-default-500">{error}</div>;
  }

  if (!detail) {
    return (
      <div className="p-8 text-sm text-default-500">
        单词不存在，请检查是否输入错误
      </div>
    );
  }

  return (
    <div className="w-full">
      <ScrollShadow className="max-h-[450px]">
        {/* 音标行 */}
        <div className="flex flex-wrap gap-3">
          {/* 英式发音 */}
          <div className="inline-flex items-center gap-0.5 rounded-full border border-default-200 bg-transparent px-3 py-2 text-sm text-default-700 dark:border-default-700 dark:text-default-300">
            <button
              type="button"
              onClick={() => handlePlayClick("en")}
              className="inline-flex cursor-pointer select-none items-center gap-1 outline-none"
            >
              <span className="text-sm">英</span>
              {detail.britishPhonetic && (
                <span className="text-sm">[ {detail.britishPhonetic} ]</span>
              )}
              <SpeakerIcon playing={playingType === "en"} />
            </button>
            <span className="h-3 w-px shrink-0 bg-default-200 dark:bg-default-700" />
            <button
              type="button"
              onClick={() => handleLoopToggle("en")}
              className="cursor-pointer select-none outline-none"
              title={loopEn ? "关闭循环" : "开启循环"}
            >
              <LoopIcon active={loopEn} />
            </button>
          </div>

          {/* 美式发音 */}
          <div className="inline-flex items-center gap-0.5 rounded-full border border-default-200 bg-transparent px-3 py-2 text-sm text-default-700 dark:border-default-700 dark:text-default-300">
            <button
              type="button"
              onClick={() => handlePlayClick("us")}
              className="inline-flex cursor-pointer select-none items-center gap-1 outline-none"
            >
              <span className="text-sm">美</span>
              {detail.americanPhonetic && (
                <span className="text-sm">[ {detail.americanPhonetic} ]</span>
              )}
              <SpeakerIcon playing={playingType === "us"} />
            </button>
            <span className="h-3 w-px shrink-0 bg-default-200 dark:bg-default-700" />
            <button
              type="button"
              onClick={() => handleLoopToggle("us")}
              className="cursor-pointer select-none outline-none"
              title={loopUs ? "关闭循环" : "开启循环"}
            >
              <LoopIcon active={loopUs} />
            </button>
          </div>
        </div>

        {/* 正文 */}
        <div className=" ">
          {/* 释义 */}
          <div className="flex flex-col gap-2 pt-3">
            {detail.translation?.map((item, idx) => (
              <div key={idx} className="text-base font-medium leading-6">
                {item}
              </div>
            ))}

          </div>

          {detail.frequence > 0 && (
            <Chip size="sm" color="accent" variant="soft" className="mt-3 px-4 py-1 text-xs">
              高考 {detail.frequence} 次
            </Chip>
          )}

          {/* 例句 */}
          {detail.sampleSentences && detail.sampleSentences.length > 0 && (
            <div>
              <p className="mb-2 mt-3 text-sm text-default-500">例句</p>
              <div className="space-y-3">
                {detail.sampleSentences.map((sentence, idx) => (
                  <div key={idx} className="flex items-baseline gap-3">
                    <span className="min-w-5 text-base text-default-400">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="mb-1 text-base font-medium leading-snug">
                        <HighlightWord text={sentence.en} word={detail.word} />
                      </p>
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
