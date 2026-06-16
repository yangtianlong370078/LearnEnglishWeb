"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Chip, ScrollShadow, Skeleton } from "@heroui/react";
import { wordApi } from "@/lib/api";
import { OSS_BASE_URL } from "@/lib/api/config";
import type { LexiconDetail } from "@/types/word";

interface WordDetailProps {
  word: string;
}

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

export default function WordDetail({ word }: WordDetailProps) {
  const [detail, setDetail] = useState<LexiconDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingType, setPlayingType] = useState<"en" | "us" | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!word) return;
    setLoading(true);
    setError(null);
    setDetail(null);
    wordApi
      .getWordDetail(word)
      .then(setDetail)
      .catch((e: Error) => setError(e.message ?? "加载失败"))
      .finally(() => setLoading(false));
  }, [word]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  function playAudio(type: "en" | "us") {
    const w = (detail?.word ?? word).toLowerCase();
    const url =
      type === "en"
        ? `${OSS_BASE_URL}/learnEnglish/Speech_EN/${w}.mp3`
        : `${OSS_BASE_URL}/learnEnglish/Speech_US/${w}.mp3`;

    audioRef.current?.pause();

    if (playingType === type) {
      audioRef.current = null;
      setPlayingType(null);
      return;
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingType(type);
    audio.play().catch(() => setPlayingType(null));
    audio.onended = () => setPlayingType(null);
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
          <Button
            variant={playingType === "en" ? "primary" : "tertiary"}
            size="sm"
            onPress={() => playAudio("en")}
            className="gap-1"
          >
            <span className="text-sm">英</span>
            {detail.britishPhonetic && (
              <span className="text-sm">[ {detail.britishPhonetic} ]</span>
            )}
            <span className="text-xs">{playingType === "en" ? "■" : "▶"}</span>
          </Button>
          <Button
            variant={playingType === "us" ? "primary" : "tertiary"}
            size="sm"
            onPress={() => playAudio("us")}
            className="gap-1"
          >
            <span className="text-sm">美</span>
            {detail.americanPhonetic && (
              <span className="text-sm">[ {detail.americanPhonetic} ]</span>
            )}
            <span className="text-xs">{playingType === "us" ? "■" : "▶"}</span>
          </Button>
        </div>

        {/* 正文 */}
        <div className=" ">
          {/* 释义 */}
          <div className="py-3">
            {detail.translation?.map((item, idx) => (
              <p key={idx} className="text-base font-medium leading-6">
                {item}
              </p>
            ))}
            {detail.frequence > 0 && (
              <Chip size="sm" color="accent" variant="soft" className="my-3">
                高考 {detail.frequence} 次
              </Chip>
            )}
          </div>

          {/* 例句 */}
          {detail.sampleSentences && detail.sampleSentences.length > 0 && (
            <div>
              <p className="mb-2 text-sm text-default-500">例句</p>
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
