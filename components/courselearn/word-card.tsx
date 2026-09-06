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
import { Button, Card, InputGroup, Modal } from "@heroui/react";
import { Xmark } from "@gravity-ui/icons";

import ConfettiBurst from "./confetti";
import GlassBorder, { GlassWarp } from "./glass-border";
import RingProgress from "./ring-progress";
import {
  CnEnIcon,
  DetailIcon,
  EditIcon,
  EnCnIcon,
  MicrophoneIcon,
  PracticeIcon,
  SpeakerIcon,
  TranslateIcon,
} from "./mode-icons";
import {
  MODE_FIELD,
  MODE_LABEL,
  MODE_ORDER,
  MODE_THEME,
  buildAudioUrl,
  getAudioDurationMs,
  includesIgnoreCase,
  isAudioMode,
  normalizeWord,
  progressPercent,
} from "./lib";
import { startXunfeiRecognition, type XunfeiSession } from "./xunfei";
import { courseLearnApi, post } from "@/lib/api";
import WordDetail from "@/components/common/word-detail";

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
  /** 全局翻译开关（全局学习按钮开启时接管卡片开关） */
  translationOn: boolean;
  /** 全局练习开关（全局学习按钮开启时接管卡片开关） */
  practiceOn: boolean;
  /** 全局学习模式，非空时强制该模式且禁用卡片按钮 */
  globalMode: LearnMode | null;
  /** 判定结果回调：由父级累加练习次数与生成记录 */
  onResult: (word: LearnWord, mode: LearnMode, correct: boolean) => void;
  /** 请求切换到下一张卡片 */
  onAdvance: (index: number) => void;
  /** 用户与本卡片交互时通知父级（更新「当前卡片」指针） */
  onFocusRequest: (index: number) => void;
  /** 本卡启动听写播放/语音识别前通知父级，父级负责中断其它卡片的活动 */
  onExclusiveStart: (index: number) => void;
  /** 编辑保存成功后通知父级更新列表中的单词 */
  onWordUpdated?: (lexiconId: number, en: string, cn: string) => void;
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
    onResult,
    onAdvance,
    onFocusRequest,
    onExclusiveStart,
    onWordUpdated,
  }: WordCardProps,
  ref: React.Ref<WordCardHandle>,
) {
  const [localMode, setLocalMode] = useState<LearnMode | null>(null);
  const effectiveMode: LearnMode | null = globalMode ?? localMode;

  // 卡片级【翻译】/【练习】开关：全局学习按钮开启时被全局开关接管
  const [localTranslationOn, setLocalTranslationOn] = useState(false);
  const [localPracticeOn, setLocalPracticeOn] = useState(false);
  const effectiveTranslationOn = globalMode ? translationOn : localTranslationOn;
  const effectivePracticeOn = globalMode ? practiceOn : localPracticeOn;

  const [inputValue, setInputValue] = useState("");
  const [resultState, setResultState] = useState<ResultState>("idle");
  const [speakerState, setSpeakerState] = useState<SpeakerState>("idle");
  const [micState, setMicState] = useState<"idle" | "recording">("idle");
  const [confettiKey, setConfettiKey] = useState(0);
  const [shaking, setShaking] = useState(false);

  // 单词详情弹窗（无学习按钮激活时右上角【详情】）
  const [detailOpen, setDetailOpen] = useState(false);
  // 编辑/修改弹窗（无学习按钮激活时右上角【编辑/修改】）
  const [editOpen, setEditOpen] = useState(false);
  const [editEn, setEditEn] = useState("");
  const [editCn, setEditCn] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  // 颜色过渡开关：显示结果时为 false（瞬间出现，与动画同步）；
  // 清空输入淡出为默认色时为 true（渐变过渡）
  const [colorTransition, setColorTransition] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const dictationRunRef = useRef(0);
  // 语音流程代际标记：stopActivity/提前停止时 +1，作废未完成的录音与识别
  const speechRunRef = useRef(0);
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
      speechRunRef.current += 1;
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
    speechRunRef.current += 1;
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
    mediaRecorderRef.current = null;
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
    // 全局学习按钮开启时：清空本地模式，并重置卡片级【翻译】/【练习】为关闭
    if (globalMode) {
      setLocalMode(null);
      setLocalTranslationOn(false);
      setLocalPracticeOn(false);
    }
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
      if (!effectiveTranslationOn && !effectivePracticeOn) {
        onResult(word, mode, correct);
      }
    },
    [effectivePracticeOn, effectiveTranslationOn, onResult, word],
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
        (!effectiveTranslationOn &&
        !effectivePracticeOn &&
        resultStateRef.current !== "idle")||
        (!effectivePracticeOn&&effectiveTranslationOn&&resultStateRef.current !== "idle")
      ) {
        clearInputAndFade();
        requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }

      if (!runValidation(mode)) return;

      if (effectivePracticeOn ) {
        // 练习：空格校验后清空输入，光标留在本卡
        setInputValue("");
          requestAnimationFrame(() => inputRef.current?.focus());

      } else {
        // 非练习：不清空本卡输入，直接切换到下一张
        onAdvance(index);
      }
    },
    [clearInputAndFade, effectivePracticeOn, effectiveTranslationOn, index, onAdvance, runValidation],
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
        if (effectivePracticeOn) {
          runValidation(mode);
          onAdvance(index);
        }
      }
    },
    [effectiveMode, effectivePracticeOn, index, onAdvance, runValidation, validateTextInput],
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
    const runId = speechRunRef.current + 1;

    speechRunRef.current = runId;
    const url = buildAudioUrl(word.en, settings.accent);
    const durationMs = await getAudioDurationMs(url);

    // 等待音频元数据期间已被中断（切换模式/被抢占）：直接退出
    if (speechRunRef.current !== runId) return;
    const recordMs = durationMs + 1000;

    setMicState("recording");

    if (settings.asrModelType === "2") {
      // 讯飞前端直连
      try {
        const session = await startXunfeiRecognition(word.en);

        if (speechRunRef.current !== runId) {
          // 等待建连期间已被中断：关闭会话，不再录音与判定
          session.stop();
          return;
        }
        xunfeiRef.current = session;
        micTimerRef.current = setTimeout(() => session.stop(), recordMs);
        const correct = await session.result;

        if (speechRunRef.current !== runId) return;
        if (micTimerRef.current) clearTimeout(micTimerRef.current);
        micTimerRef.current = null;
        xunfeiRef.current = null;
        setMicState("idle");
        flashResult("speech", correct);
      } catch {
        if (speechRunRef.current !== runId) return;
        setMicState("idle");
        flashResult("speech", false);
      }

      return;
    }

    // 其它模型：录音后走后端 Whisper
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (speechRunRef.current !== runId) {
        // 等待麦克风授权期间已被中断：释放轨道，不再录音
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
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
        setMicState("idle");
        // 已被中断（切换模式/被抢占）：不识别、不判定
        if (speechRunRef.current !== runId) return;
        const blob = new Blob(chunks, { type: "audio/webm" });

        try {
          const correct = await courseLearnApi.recognizeSpeech(
            blob,
            word.en,
            settings.asrModelType,
          );

          if (speechRunRef.current !== runId) return;
          flashResult("speech", correct);
        } catch {
          if (speechRunRef.current !== runId) return;
          flashResult("speech", false);
        }
      };
      recorder.start();
      micTimerRef.current = setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, recordMs);
    } catch {
      if (speechRunRef.current !== runId) return;
      setMicState("idle");
      flashResult("speech", false);
    }
  }, [flashResult, settings.accent, settings.asrModelType, word.en]);

  const toggleSpeech = useCallback(() => {
    onFocusRequest(index);
    if (micState === "recording") {
      // 提前结束录音：先立即解除录音态 UI，再停止底层录制
      setMicState("idle");
      if (settings.asrModelType === "2") {
        if (xunfeiRef.current) {
          // 会话已建立：停止后会话 result 仍会完成识别判定
          xunfeiRef.current.stop();
        } else {
          // 会话尚未建立（等待建连）：作废本次运行，await 返回后自动退出
          speechRunRef.current += 1;
        }
      } else if (mediaRecorderRef.current?.state === "recording") {
        // 录音中：停止后 onstop 仍会将已录内容送识别判定
        mediaRecorderRef.current.stop();
      } else {
        // 录音器尚未创建（等待麦克风授权）：作废本次运行
        speechRunRef.current += 1;
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
      setLocalMode((prev) => (prev === mode ? null : mode));
      // 切换学习按钮时重置卡片级【翻译】/【练习】为关闭
      setLocalTranslationOn(false);
      setLocalPracticeOn(false);
    },
    [globalMode, index, onFocusRequest, stopActivity],
  );

  // ── 编辑/修改弹窗 ───────────────────────────────────────
  const openEditModal = useCallback(() => {
    setEditEn(word.en);
    setEditCn(word.cn);
    setEditOpen(true);
  }, [word.en, word.cn]);

  const handleSaveEdit = useCallback(async () => {
    const en = editEn.trim();
    const cn = editCn.trim();

    if (!en || !cn) return;

    setEditSaving(true);
    try {
      await post<void>("/Word/updc", null, {
        params: { id: word.lexiconId, en, cn },
      });
      setEditOpen(false);
      onWordUpdated?.(word.lexiconId, en, cn);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[word-card] 保存单词失败:", err);
    } finally {
      setEditSaving(false);
    }
  }, [editEn, editCn, onWordUpdated, word.lexiconId]);

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
        : "cl-glass-idle";

  const showSecondary = effectiveTranslationOn;

  // 卡片【翻译】可点击条件：无全局模式接管 且 本地非听写/语音模式
  const cardTranslationDisabled = !!globalMode || isAudioMode(localMode);
  // 全局学习按钮开启时，卡片【翻译】/【练习】仅跟随全局开关展示，不可点击
  const cardPracticeDisabled = !!globalMode;
  // 全局或本卡开启【听写】/【语音】时，隐藏本卡【翻译】按钮（仅影响本卡）
  const hideCardTranslation = isAudioMode(effectiveMode);

  return (
    <div
      className={`yinyinkuan rounded-3xl p-0 group relative overflow-visible ${
        shaking ? "cl-shake" : ""
      } ${
        colorTransition
          ? "transition-[background-color,border-color,box-shadow] duration-500 ease-out"
          : ""
      } ${cardStateClass}`}
      onAnimationEnd={() => setShaking(false)}
    >
      <ConfettiBurst fireKey={confettiKey} />

      {/* 液态玻璃 warp 层（位于内容之下）：整卡毛玻璃，
          把边框后面的背景提亮提饱和透上来（仅默认态，避免干扰对错着色） */}
      {resultState === "idle" && <GlassWarp />}

      {/* 内容层奶白底色：内缩 1.5px 避开描边环区，light:bg-white/15  dark:bg-black/10
          让边框环直接透出 warp 玻璃（更"裸透"的液态玻璃边框） */}
      {resultState === "idle" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute light:bg-white/15 "
          style={{ inset: "1px", borderRadius: "calc(1.5rem - 1px)" }}
        />
      )}

      {/* 校验结果角标：左上徽章（对勾 / 叉号描边绘制动画），避开右上角的翻译/练习按钮 */}
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

      {/* 内容层需 relative z-[1]：absolute 定位的 warp 玻璃层会盖住 static 内容 */}
      <div className="relative z-[1] rounded-3xl">
        {/* 无学习按钮激活时：右上角显示【编辑/修改】与【详情】图标按钮 */}
        {!effectiveMode && (
          <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1.5">
            <button
              aria-label="编辑/修改"
              className="inline-flex size-7 items-center justify-center rounded-full bg-white/60 text-foreground/75 transition-all duration-300 hover:-translate-y-px hover:bg-white/80 hover:shadow-sm dark:bg-white/10 dark:text-foreground/90 dark:hover:bg-white/15 dark:hover:shadow-none"
              title="编辑/修改"
              type="button"
              onClick={openEditModal}
            >
              <EditIcon className="size-3" />
            </button>
            <button
              aria-label="详情"
              className="inline-flex size-7 items-center justify-center rounded-full bg-white/60 text-foreground/75 transition-all duration-300 hover:-translate-y-px hover:bg-white/80 hover:shadow-sm dark:bg-white/10 dark:text-foreground/90 dark:hover:bg-white/15 dark:hover:shadow-none"
              title="详情"
              type="button"
              onClick={() => setDetailOpen(true)}
            >
              <DetailIcon className="size-3.5" />
            </button>
          </div>
        )}

        {/* 卡片级【翻译】/【练习】图标按钮：有学习按钮激活时显示；
            全局学习按钮开启时仅跟随全局开关展示，不可点击 */}
        {effectiveMode && (
          <div className="absolute right-2.5 top-2.5 z-10 flex items-center gap-1.5">
            {!hideCardTranslation && (
              <button
                aria-label="翻译"
                aria-pressed={effectiveTranslationOn}
                className={`inline-flex size-7 items-center justify-center rounded-full transition-all duration-300 ${
                  effectiveTranslationOn
                    ? `bg-white text-foreground shadow-md ring-1 ring-black/5 dark:bg-white/35 dark:text-white dark:shadow-none dark:ring-white/40 ${
                        cardTranslationDisabled
                          ? "cursor-not-allowed"
                          : "hover:shadow-lg"
                      }`
                    : cardTranslationDisabled
                      ? "cursor-not-allowed bg-white/40 text-muted opacity-60 dark:bg-white/5"
                      : "bg-white/60 text-foreground/75 hover:-translate-y-px hover:bg-white/80 hover:shadow-sm dark:bg-white/10 dark:text-foreground/90 dark:hover:bg-white/15 dark:hover:shadow-none"
                }`}
                disabled={cardTranslationDisabled}
                title={
                  globalMode
                    ? "全局学习模式下跟随全局【翻译】开关"
                    : isAudioMode(localMode)
                      ? "听写 / 语音模式下不可开启翻译"
                      : "翻译"
                }
                type="button"
                onClick={() => setLocalTranslationOn((v) => !v)}
              >
                <TranslateIcon className="size-3.5" />
              </button>
            )}
            <button
              aria-label="练习"
              aria-pressed={effectivePracticeOn}
              className={`inline-flex size-7 items-center justify-center rounded-full transition-all duration-300 ${
                effectivePracticeOn
                  ? `bg-white text-foreground shadow-md ring-1 ring-black/5 dark:bg-white/35 dark:text-white dark:shadow-none dark:ring-white/40 ${
                      cardPracticeDisabled
                        ? "cursor-not-allowed"
                        : "hover:shadow-lg"
                    }`
                  : cardPracticeDisabled
                    ? "cursor-not-allowed bg-white/40 text-muted opacity-60 dark:bg-white/5"
                    : "bg-white/60 text-foreground/75 hover:-translate-y-px hover:bg-white/80 hover:shadow-sm dark:bg-white/10 dark:text-foreground/90 dark:hover:bg-white/15 dark:hover:shadow-none"
              }`}
              disabled={cardPracticeDisabled}
              title={globalMode ? "全局学习模式下跟随全局【练习】开关" : "练习"}
              type="button"
              onClick={() => setLocalPracticeOn((v) => !v)}
            >
              <PracticeIcon className="size-3.5" />
            </button>
          </div>
        )}
        <Card.Content className="flex flex-col h-[220px]! rounded-3xl p-[20px] justify-between ">
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

      {/* 液态玻璃描边层（位于内容之上）：源码的 screen/overlay 两层渐变描边 */}
      {resultState === "idle" && <GlassBorder />}

      {/* 单词详情弹窗：仅展示详情，不包含「加入生词本」逻辑 */}
      <Modal.Backdrop
        className="!bg-transparent"
        isOpen={detailOpen}
        onOpenChange={setDetailOpen}
      >
        <Modal.Container className="w-full max-w-lg rounded-2xl">
          <Modal.Dialog className="backdrop-blur-xl backdrop-saturate-150 bg-white/70 dark:bg-zinc-900/70 shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_8px_32px_rgb(0_0_0/0.12)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_8px_32px_rgb(0_0_0/0.4)]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="text-2xl font-semibold">
                {word.en}
              </Modal.Heading>
            </Modal.Header>
            <div className="m-0 py-4">
              <WordDetail key={word.en} word={word.en} />
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* 编辑/修改弹窗：预写入单词 en / cn，校验非空后保存 */}
      <Modal.Backdrop
        isDismissable={false}
        isOpen={editOpen}
        variant="blur"
        onOpenChange={setEditOpen}
      >
        <Modal.Container placement="center" size="md">
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
                <EditIcon className="size-5" />
              </Modal.Icon>
              <Modal.Heading>编辑/修改单词</Modal.Heading>
              <p className="mt-1.5 text-sm leading-5 text-muted">
                修改单词的英文与中文释义后保存即可生效
              </p>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-5 py-2">
              <div className="grid grid-cols-[80px_1fr] items-center py-2 gap-3">
                <label
                  className="text-sm text-foreground"
                  htmlFor="word-en-input"
                >
                  英文单词
                </label>
                <InputGroup
                  style={
                    {
                      "--field-border": "var(--border)",
                    } as React.CSSProperties
                  }
                  variant="secondary"
                >
                  <InputGroup.Prefix>
                    <EnCnIcon className="size-4 text-muted" />
                  </InputGroup.Prefix>
                  <InputGroup.Input
                    className="w-full max-w-[280px]"
                    id="word-en-input"
                    placeholder="输入英文单词"
                    value={editEn}
                    onChange={(e) => setEditEn(e.target.value)}
                  />
                  {editEn.length > 0 && (
                    <button
                      aria-label="清空内容"
                      className="inline-flex items-center justify-center px-2 hover:opacity-70"
                      type="button"
                      onClick={() => setEditEn("")}
                    >
                      <Xmark className="size-4" />
                    </button>
                  )}
                </InputGroup>
              </div>
              <div className="grid grid-cols-[80px_1fr] items-center py-2 gap-3">
                <label
                  className="text-sm text-foreground"
                  htmlFor="word-cn-input"
                >
                  中文释义
                </label>
                <InputGroup
                  style={
                    {
                      "--field-border": "var(--border)",
                    } as React.CSSProperties
                  }
                  variant="secondary"
                >
                  <InputGroup.Prefix>
                    <CnEnIcon className="size-4 text-muted" />
                  </InputGroup.Prefix>
                  <InputGroup.Input
                    className="w-full max-w-[280px]"
                    id="word-cn-input"
                    placeholder="输入中文释义"
                    value={editCn}
                    onChange={(e) => setEditCn(e.target.value)}
                  />
                  {editCn.length > 0 && (
                    <button
                      aria-label="清空内容"
                      className="inline-flex items-center justify-center px-2 hover:opacity-70"
                      type="button"
                      onClick={() => setEditCn("")}
                    >
                      <Xmark className="size-4" />
                    </button>
                  )}
                </InputGroup>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                取消
              </Button>
              <Button
                isDisabled={
                  editSaving ||
                  editEn.trim().length === 0 ||
                  editCn.trim().length === 0
                }
                onPress={handleSaveEdit}
              >
                {editSaving ? "保存中..." : "保存"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
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
            className={`cl-mic-btn mb-2 ${
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
              className={`size-6 ${
                speakerState === "playing"? "cl-speaker-playing": speakerState === "waiting" ? "cl-speaker-waiting": ""
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
            micState === "recording" ? " cl-mic-btn is-recording" : "cl-mic-btn"
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
        ) : <MicrophoneIcon className="size-6 " />}


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
