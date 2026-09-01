"use client";

import type {
  CourseLearnSettings,
  LearnMode,
  LearnWord,
} from "@/types/courselearn";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Card } from "@heroui/react";
import { Xmark } from "@gravity-ui/icons";

import ConfettiBurst from "./confetti";
import RingProgress from "./ring-progress";
import { CnEnIcon, EnCnIcon, MicrophoneIcon, SpeakerIcon } from "./mode-icons";
import {
  MODE_FIELD,
  MODE_LABEL,
  MODE_ORDER,
  MODE_THEME,
  buildAudioUrl,
  getAudioDurationMs,
  includesIgnoreCase,
  normalizeWord,
  progressPercent,
} from "./lib";
import { startXunfeiRecognition, type XunfeiSession } from "./xunfei";
import { courseLearnApi } from "@/lib/api";

/** 卡片对外暴露的命令句柄，供全局流程驱动 */
export interface WordCardHandle {
  /** 聚焦输入框（英-中 / 中-英 模式） */
  focusInput: () => void;
  /** 启动当前模式的活动（听写播放 / 语音录制） */
  start: () => void;
  /** 停止当前活动 */
  stop: () => void;
  /** 被其它卡片抢占：立即停止听写播放与录音，并清空听写输入 */
  interrupt: () => void;
  /** 重置卡片状态 */
  reset: () => void;
}

interface WordCardProps {
  word: LearnWord;
  index: number;
  settings: CourseLearnSettings;
  /** 翻译开关 */
  translationOn: boolean;
  /** 练习开关 */
  practiceOn: boolean;
  /** 全局学习模式，非空时强制该模式且禁用卡片按钮 */
  globalMode: LearnMode | null;
  /** 本地学习模式变化时上报给父级（用于联动翻译按钮禁用） */
  onLocalModeChange?: (mode: LearnMode | null) => void;
  /** 判定结果回调：由父级累加练习次数与生成记录 */
  onResult: (word: LearnWord, mode: LearnMode, correct: boolean) => void;
  /** 请求切换到下一张卡片 */
  onAdvance: (index: number) => void;
  /** 用户与本卡片交互时通知父级（更新「当前卡片」指针） */
  onFocusRequest: (index: number) => void;
  /** 本卡启动听写播放/语音识别前通知父级，父级负责中断其它卡片的活动 */
  onExclusiveStart: (index: number) => void;
}

type ResultState = "idle" | "correct" | "wrong";
type SpeakerState = "idle" | "playing" | "waiting";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function WordCardInner(
  {
    word,
    index,
    settings,
    translationOn,
    practiceOn,
    globalMode,
    onLocalModeChange,
    onResult,
    onAdvance,
    onFocusRequest,
    onExclusiveStart,
  }: WordCardProps,
  ref: React.Ref<WordCardHandle>,
) {
  const localModeState = useState<LearnMode | null>(null);
  const [localMode, setLocalMode] = localModeState;
  const effectiveMode: LearnMode | null = globalMode ?? localMode;

  // 本地模式的最新值 + 同步上报父级
  const localModeRef = useRef<LearnMode | null>(null);

  const setLocalModeAndNotify = useCallback(
    (next: LearnMode | null) => {
      if (localModeRef.current === next) return;
      localModeRef.current = next;
      setLocalMode(next);
      onLocalModeChange?.(next);
    },
    [onLocalModeChange, setLocalMode],
  );

  const [inputValue, setInputValue] = useState("");
  const [resultState, setResultState] = useState<ResultState>("idle");
  const [speakerState, setSpeakerState] = useState<SpeakerState>("idle");
  const [micState, setMicState] = useState<"idle" | "recording">("idle");
  const [confettiKey, setConfettiKey] = useState(0);
  const [shaking, setShaking] = useState(false);
  // 颜色过渡开关：显示结果时为 false（瞬间出现，与动画同步）；
  // 清空输入淡出为默认色时为 true（渐变过渡）
  const [colorTransition, setColorTransition] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dictationRunRef = useRef(0);
  const micTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const xunfeiRef = useRef<XunfeiSession | null>(null);
  const resultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputValueRef = useRef("");
  const resultStateRef = useRef<ResultState>(resultState);

  inputValueRef.current = inputValue;
  resultStateRef.current = resultState;

  // 卸载清理
  useEffect(() => {
    return () => {
      dictationRunRef.current += 1;
      if (micTimerRef.current) clearTimeout(micTimerRef.current);
      if (resultTimerRef.current) clearTimeout(resultTimerRef.current);
      audioRef.current?.pause();
      mediaRecorderRef.current?.state === "recording" &&
        mediaRecorderRef.current.stop();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      xunfeiRef.current?.stop();
    };
  }, []);

  const stopActivity = useCallback(() => {
    dictationRunRef.current += 1;
    audioRef.current?.pause();
    setSpeakerState("idle");
    if (micTimerRef.current) {
      clearTimeout(micTimerRef.current);
      micTimerRef.current = null;
    }
    if (mediaRecorderRef.current?.state === "recording") {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        /* noop */
      }
    }
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    xunfeiRef.current?.stop();
    xunfeiRef.current = null;
    setMicState("idle");
  }, []);

  // 全局模式或翻译变化时，重置本卡活动与输入
  useEffect(() => {
    stopActivity();
    setInputValue("");
    setResultState("idle");
    // 切换全局模式时清空本地模式
    if (globalMode) setLocalModeAndNotify(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalMode]);

  const flashResult = useCallback(
    (mode: LearnMode, correct: boolean) => {
      // 颜色瞬间出现（与动画同步），不用过渡
      setColorTransition(false);
      // 背景色保留，直到切换学习模式或清空输入才清除
      setResultState(correct ? "correct" : "wrong");
      if (correct) {
        setConfettiKey((k) => k + 1);
      } else {
        setShaking(true);
      }
      // 开启【翻译】或【练习】时不记录次数、不改变学习进度
      if (!translationOn && !practiceOn) {
        onResult(word, mode, correct);
      }
    },
    [onResult, practiceOn, translationOn, word],
  );

  /** 渐变淡出为默认背景色 */
  const fadeToDefault = useCallback(() => {
    setColorTransition(true);
    setResultState("idle");
  }, []);

  /** 清空输入并淡出为默认色 */
  const clearInputAndFade = useCallback(() => {
    setInputValue("");
    fadeToDefault();
  }, [fadeToDefault]);

  // ── 英-中 / 中-英 输入校验 ────────────────────────────────
  /** 执行一次校验并触发结果特效；无输入则跳过。返回是否已校验 */
  const runValidation = useCallback(
    (mode: "en-cn" | "cn-en") => {
      const value = inputValueRef.current;

      if (!value.trim()) return false;

      const correct =
        mode === "en-cn"
          ? includesIgnoreCase(word.cn, value)
          : normalizeWord(value) === normalizeWord(word.en);

      flashResult(mode, correct);

      return true;
    },
    [flashResult, word.cn, word.en],
  );

  /** 空格键：校验后按练习开关决定「清空留本卡」或「切换下一张」 */
  const validateTextInput = useCallback(
    (mode: "en-cn" | "cn-en") => {
      // 防作弊：关闭【翻译】和【练习】时，若卡片已是成功/失败色（非默认色），或者【翻译】开关开启、练习开关关闭
      // 按空格不再校验，仅清空输入并淡出为默认色，光标留在本卡
      if (
        (!translationOn &&
        !practiceOn &&
        resultStateRef.current !== "idle")||
        (!practiceOn&&translationOn&&resultStateRef.current !== "idle")
      ) {
        clearInputAndFade();
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }

      if (!runValidation(mode)) return;

      if (practiceOn ) {
        // 练习：空格校验后清空输入，光标留在本卡
        setInputValue("");
          requestAnimationFrame(() => inputRef.current?.focus());
       
      } else {
        // 非练习：不清空本卡输入，直接切换到下一张
        onAdvance(index);
      }
    },
    [clearInputAndFade, index, onAdvance, practiceOn, runValidation, translationOn],
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      const mode = effectiveMode;

      if (mode !== "en-cn" && mode !== "cn-en") return;

      // 中文输入法合成期：空格用于确认候选词，不触发校验
      if (e.nativeEvent.isComposing) return;

      if (e.key === " ") {
        e.preventDefault();
        validateTextInput(mode);
      } else if (e.key === "Enter") {
        e.preventDefault();
        // 练习模式下回车：先触发校验，再切换到下一张（不清空本卡输入）
        if (practiceOn) {
          runValidation(mode);
          onAdvance(index);
        }
      }
    },
    [effectiveMode, index, onAdvance, practiceOn, runValidation, validateTextInput],
  );

  // ── 听写：循环播放 ────────────────────────────────────────
  const runDictation = useCallback(async () => {
    const runId = dictationRunRef.current + 1;

    dictationRunRef.current = runId;
    const url = buildAudioUrl(word.en, settings.accent);
    const durationMs = await getAudioDurationMs(url);
    const count = Math.max(1, settings.dictationCount);

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;

    audio.src = url;

    const playOnce = () =>
      new Promise<void>((resolve) => {
        const onEnded = () => {
          audio.removeEventListener("ended", onEnded);
          audio.removeEventListener("error", onEnded);
          resolve();
        };

        audio.addEventListener("ended", onEnded);
        audio.addEventListener("error", onEnded);
        try {
          audio.currentTime = 0;
        } catch {
          /* noop */
        }
        void audio.play().catch(() => onEnded());
      });

    for (let i = 0; i < count; i++) {
      if (dictationRunRef.current !== runId) return;
      setSpeakerState("playing");
      await playOnce();
      if (dictationRunRef.current !== runId) return;
      // 每次播放完毕都等待（本条语音时长 + 1 秒），含最后一次
      setSpeakerState("waiting");
      await wait(durationMs + 1000);
      if (dictationRunRef.current !== runId) return;
    }

    setSpeakerState("idle");
    const correct =
      normalizeWord(inputValueRef.current) === normalizeWord(word.en);

    flashResult("dictation", correct);
    // 不清空本卡输入，保留供回看
    if (globalMode === "dictation") {
      onAdvance(index);
    }
  }, [
    flashResult,
    globalMode,
    index,
    onAdvance,
    settings.accent,
    settings.dictationCount,
    word.en,
  ]);

  const toggleDictation = useCallback(() => {
    onFocusRequest(index);
    if (speakerState !== "idle") {
      // 播放/等待中再次点击 → 立即中断为关闭态
      stopActivity();

      return;
    }
    // 同一时间只允许一个单词播放：中断其它卡片的播放/录音
    onExclusiveStart(index);
    // 光标定位到本卡输入框
    requestAnimationFrame(() => inputRef.current?.focus());
    void runDictation();
  }, [index, onExclusiveStart, onFocusRequest, runDictation, speakerState, stopActivity]);

  // ── 语音：录音 + 识别 ─────────────────────────────────────
  const runSpeech = useCallback(async () => {
    const url = buildAudioUrl(word.en, settings.accent);
    const durationMs = await getAudioDurationMs(url);
    const recordMs = durationMs + 1000;

    setMicState("recording");

    if (settings.asrModelType === "2") {
      // 讯飞前端直连
      try {
        const session = await startXunfeiRecognition(word.en);

        xunfeiRef.current = session;
        micTimerRef.current = setTimeout(() => session.stop(), recordMs);
        const correct = await session.result;

        if (micTimerRef.current) clearTimeout(micTimerRef.current);
        micTimerRef.current = null;
        xunfeiRef.current = null;
        setMicState("idle");
        flashResult("speech", correct);
      } catch {
        setMicState("idle");
        flashResult("speech", false);
      }

      return;
    }

    // 其它模型：录音后走后端 Whisper
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        const blob = new Blob(chunks, { type: "audio/webm" });

        try {
          const correct = await courseLearnApi.recognizeSpeech(
            blob,
            word.en,
            settings.asrModelType,
          );

          setMicState("idle");
          flashResult("speech", correct);
        } catch {
          setMicState("idle");
          flashResult("speech", false);
        }
      };
      recorder.start();
      micTimerRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, recordMs);
    } catch {
      setMicState("idle");
      flashResult("speech", false);
    }
  }, [flashResult, settings.accent, settings.asrModelType, word.en]);

  const toggleSpeech = useCallback(() => {
    onFocusRequest(index);
    if (micState === "recording") {
      // 提前结束录音
      if (settings.asrModelType === "2") {
        xunfeiRef.current?.stop();
      } else if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (micTimerRef.current) {
        clearTimeout(micTimerRef.current);
        micTimerRef.current = null;
      }

      return;
    }
    // 同一时间只允许一个单词录音识别：中断其它卡片的录音/播放
    onExclusiveStart(index);
    void runSpeech();
  }, [index, micState, onExclusiveStart, onFocusRequest, runSpeech, settings.asrModelType]);

  // ── 卡片按钮：本地模式切换（单选互斥） ───────────────────
  const handleModeButton = useCallback(
    (mode: LearnMode) => {
      if (globalMode) return; // 全局激活时卡片按钮禁用
      onFocusRequest(index);
      stopActivity();
      setInputValue("");
      setResultState("idle");
      setLocalModeAndNotify(localModeRef.current === mode ? null : mode);
    },
    [globalMode, index, onFocusRequest, setLocalModeAndNotify, stopActivity],
  );

  // ── 命令句柄 ─────────────────────────────────────────────
  useImperativeHandle(
    ref,
    () => ({
      focusInput: () => {
        const el = inputRef.current;

        if (!el) return;
        el.focus();
        el.select();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      },
      start: () => {
        if (effectiveMode === "dictation") {
          if (speakerState === "idle") void runDictation();
        } else if (effectiveMode === "speech") {
          if (micState === "idle") void runSpeech();
        }
      },
      stop: stopActivity,
      interrupt: () => {
        const wasDictating = speakerState !== "idle";

        stopActivity();
        // 被抢占的听写卡片：清空输入框内容
        if (wasDictating) clearInputAndFade();
      },
      reset: () => {
        stopActivity();
        setInputValue("");
        setResultState("idle");
      },
    }),
    [
      clearInputAndFade,
      effectiveMode,
      micState,
      runDictation,
      runSpeech,
      speakerState,
      stopActivity,
    ],
  );

  // 当输入模式激活时自动聚焦（仅当有全局模式或本地模式切换）
  useEffect(() => {
    if (effectiveMode === "en-cn" || effectiveMode === "cn-en") {
      // 本地模式切换时聚焦
      if (!globalMode) requestAnimationFrame(() => inputRef.current?.focus());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localMode]);

  const cardStateClass =
    resultState === "correct"
      ? "cardfilter  cl-card-correct "
      : resultState === "wrong"
        ? "cardfilter  cl-card-wrong"
        : "word-search-glass !bg-transparent";

const cardStateSubClass =
    resultState === "correct"
      ? ""
      : resultState === "wrong"
        ? ""
        : "bg-white/15 dark:bg-black/15";

  const showSecondary = translationOn;

  return (
    <Card
      className={`p-0 group relative overflow-visible  ${
        colorTransition
          ? "transition-[background-color,border-color,box-shadow] duration-500 ease-out"
          : ""
      } ${cardStateClass}`}
    >
      <ConfettiBurst fireKey={confettiKey} />

      {/* 校验结果角标：右上徽章（对勾 / 叉号描边绘制动画） */}
      {resultState !== "idle" && (
        <span
          aria-hidden="true"
          className={`cl-result-badge ${
            resultState === "correct" ? "is-correct" : "is-wrong"
          }`}
        >
          <svg fill="none" viewBox="0 0 24 24">
            {resultState === "correct" ? (
              <path
                d="M5 12.5l4.5 4.5L19 7.5"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.8"
              />
            ) : (
              <>
                <path
                  d="M7.5 7.5l9 9"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2.8"
                />
                <path
                  className="cl-badge-cross-2"
                  d="M16.5 7.5l-9 9"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2.8"
                />
              </>
            )}
          </svg>
        </span>
      )}

      <div
        className={`${shaking ? "cl-shake" : ""}   rounded-3xl ${cardStateSubClass}`}
        onAnimationEnd={() => setShaking(false)}
      >
        <Card.Content className="flex flex-col h-[220px]! p-[20px] justify-between ">
          {/* 主体：按模式渲染 */}
          <div className="flex flex-col justify-center gap-2 mb-3 h-full items-center text-center">
            {renderBody()}
          </div>

          {/* 四个学习按钮 + 环形进度 */}
          <div className="flex items-center mb-1 justify-center gap-3">
            {MODE_ORDER.map((mode) => {
              const field = MODE_FIELD[mode];
              const percent = progressPercent(word[field]);
              const active = effectiveMode === mode;
              const theme = MODE_THEME[mode];

              return (
                <button
                  key={mode}
                  aria-label={MODE_LABEL[mode]}
                  aria-pressed={active}
                  className={`cl-mode-btn inline-flex flex-col items-center gap-1 transition-all duration-300 ${
                    globalMode
                      ? `cursor-not-allowed ${globalMode === mode ? "" : "opacity-40"}`
                      : "cursor-pointer"
                  }`}
                  disabled={!!globalMode}
                  style={
                    {
                      "--cl-ring": theme.from,
                      "--cl-ring2": theme.to,
                      "--cl-soft": theme.soft,
                    } as React.CSSProperties
                  }
                  type="button"
                  onClick={() => handleModeButton(mode)}
                >
                  <RingProgress
                    className={`transition-transform duration-300 ${
                      active ? "scale-105" : ""
                    }`}
                    color="var(--cl-ring)"
                    colorTo="var(--cl-ring2)"
                    percent={percent}
                    size={46}
                    strokeWidth={3.5}
                  >
                    <span
                      className={`cl-mode-icon ${active ? "is-active" : ""}`}
                    >
                      {mode === "dictation" ? (
                        <SpeakerIcon className="size-4" />
                      ) : mode === "speech" ? (
                        <MicrophoneIcon className="size-4" />
                      ) : mode === "cn-en" ? (
                        <CnEnIcon className="size-4" />
                      ) : (
                        <EnCnIcon className="size-4" />
                      )}
                    </span>
                  </RingProgress>
                </button>
              );
            })}
          </div>
        </Card.Content>
      </div>
    </Card>
  );

  // ── 主体渲染 ─────────────────────────────────────────────
  function renderBody() {
    if (!effectiveMode) {
      return (
        <>
          <span className="text-2xl font-bold text-foreground">{word.en}</span>
          <span className="text-sm text-muted">{word.cn}</span>
        </>
      );
    }

    if (effectiveMode === "en-cn") {
      return (
        <>
          <span className="text-2xl font-bold text-foreground">{word.en}</span>
          {showSecondary && (
            <span className="text-sm text-muted">{word.cn}</span>
          )}
          {renderInput("输入中文释义，空格校验")}
        </>
      );
    }

    if (effectiveMode === "cn-en") {
      return (
        <>
          <span className="text-xl font-semibold text-foreground">
            {word.cn}
          </span>
          {showSecondary && (
            <span className="text-sm text-muted">{word.en}</span>
          )}
          {renderInput("输入英文单词，空格校验")}
        </>
      );
    }

    if (effectiveMode === "dictation") {
      return (
        <>
          <button
            aria-label={
              speakerState === "idle" ? "播放发音" : "停止播放"
            }
            className={`cl-speaker-btn mb-1 ${
              speakerState === "playing"
                ? "is-playing"
                : speakerState === "waiting"
                  ? "is-waiting"
                  : ""
            }`}
            type="button"
            onClick={toggleDictation}
          >
            <SpeakerIcon
              className={`size-7 ${
                speakerState === "playing"
                  ? "cl-speaker-playing"
                  : speakerState === "waiting"
                    ? "cl-speaker-waiting"
                    : ""
              }`}
            />
          </button>
          {/* <span
            className={`text-[11px] font-medium tracking-wide transition-colors ${
              speakerState === "playing"
                ? "text-accent"
                : speakerState === "waiting"
                  ? "text-muted"
                  : "text-muted"
            }`}
          >
            {speakerState === "playing"
              ? "播放中 · 再次点击停止"
              : speakerState === "waiting"
                ? "等待下次播放…"
                : "点击喇叭开始听写"}
          </span> */}
          {renderInput("听到后输入单词")}
        </>
      );
    }

    // speech
    return (
      <>
        <span className="text-2xl font-bold text-foreground">{word.en}</span>
        {/* {showSecondary && <span className="text-sm text-muted">{word.cn}</span>} */}


        
        <button
          aria-label={
            micState === "recording" ? "结束录音" : "开始语音识别"
          }
          className={` mt-[12px]!  ${
            micState === "recording" ? " cl-mic-btn is-recording" : "cl-speaker-btn"
          }`}
          type="button"
          onClick={toggleSpeech}
        >
          


  {micState === "recording" ? (
          <span aria-hidden="true" className="cl-wave">
            <span />
            <span />
            <span />
            <span />
            <span />
          </span>
        ) : <MicrophoneIcon className="size-7 " />}


        </button>


       


        {/* <span
          className={`text-[11px] font-medium tracking-wide transition-colors ${
            micState === "recording" ? "text-danger" : "text-muted"
          }`}
        >
          {micState === "recording" ? "录音中 · 点击结束" : "点击麦克风朗读单词"}
        </span> */}
      </>
    );
  }

  function renderInput(placeholder: string) {
    return (
      <div className="relative mt-1 max-w-[240px]  w-full ">
        <input
          ref={inputRef}
          aria-label="学习输入"
          autoComplete="off"
          className="w-full rounded-3xl border border-black/10 bg-white/40 px-8 py-2 text-center text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent/40 focus:bg-white/50 dark:border-white/10 dark:bg-white/5 dark:focus:bg-white/10"
          placeholder={placeholder}
          spellCheck={false}
          type="text"
          value={inputValue}
          onChange={(e) => {
            const v = e.target.value;

            setInputValue(v);
            // 手动清空输入时，卡片背景渐变淡出为默认色
            if (v === "") fadeToDefault();
          }}
          onFocus={() => onFocusRequest(index)}
          onKeyDown={handleInputKeyDown}
        />
        {inputValue ? (
          <button
            aria-label="清空输入"
            className="absolute right-2 top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-full bg-black/10 text-muted transition-colors hover:bg-black/20 hover:text-foreground dark:bg-white/10 dark:hover:bg-white/20"
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              clearInputAndFade();
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
          >
            <Xmark className="size-3" />
          </button>
        ) : null}
      </div>
    );
  }
}

const WordCard = forwardRef(WordCardInner);

WordCard.displayName = "WordCard";

export default WordCard;
