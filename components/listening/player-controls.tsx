"use client";

import type { ListeningMode } from "@/types/listening";
import type { Key } from "@heroui/react";

import {
  BackwardStep,
  ForwardStep,
  Gear,
  PauseFill,
  PlayFill,
  Text,
} from "@gravity-ui/icons";
import { Button, ListBox, Select, Slider } from "@heroui/react";

import GlassCard from "@/components/common/glass-card";
import { formatListeningTime } from "@/components/listening/lrc";
import { LISTENING_PLAYBACK_RATES } from "@/components/listening/use-listening-settings";

interface PlayerControlsProps {
  playing: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  autoFollow: boolean;
  mode: ListeningMode;
  disabled: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  error: string | null;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSeek: (time: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  onToggleFollow: () => void;
  onOpenSettings: () => void;
}

const MODE_LABELS: Record<ListeningMode, string> = {
  continuous: "连续播放",
  single: "单句精听",
  dictation: "听写模式",
  shadow: "跟读模式",
};

const CONTROL_BUTTON_CLASS =
  "size-10 min-w-10 rounded-full border border-white/65 bg-white/45 text-foreground/70 shadow-[0_3px_10px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-px hover:border-accent/30 hover:bg-white/80 hover:text-accent active:scale-95 dark:border-white/15 dark:bg-white/[0.055] dark:text-foreground/75 dark:hover:bg-white/10";

const COMPACT_CONTROL_BUTTON_CLASS =
  "size-[30px] min-w-[30px] rounded-full border border-white/55 bg-white/35 text-foreground/65 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all duration-200 hover:border-accent/30 hover:bg-white/75 hover:text-accent active:scale-95 dark:border-white/10 dark:bg-white/[0.04] dark:text-foreground/70 dark:hover:bg-white/10";

export default function PlayerControls({
  playing,
  currentTime,
  duration,
  playbackRate,
  autoFollow,
  mode,
  disabled,
  hasPrevious,
  hasNext,
  error,
  onTogglePlay,
  onPrevious,
  onNext,
  onSeek,
  onPlaybackRateChange,
  onToggleFollow,
  onOpenSettings,
}: PlayerControlsProps) {
  const renderCompactPlaybackRate = () => (
    <Select
      aria-label="播放速度"
      className="size-[30px] min-w-[30px]"
      isDisabled={disabled}
      selectedKey={String(playbackRate)}
      variant="secondary"
      onSelectionChange={(key: Key | null) => {
        const rate = Number(key);

        if (Number.isFinite(rate)) onPlaybackRateChange(rate);
      }}
    >
      <Select.Trigger
        className="size-[30px] min-h-[30px] min-w-[30px] flex-none justify-center rounded-full border border-white/55 bg-white/35 p-0 font-semibold tabular-nums text-foreground/65 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all duration-200 hover:border-accent/30 hover:bg-white/75 hover:text-accent dark:border-white/10 dark:bg-white/[0.04] dark:text-foreground/70 dark:hover:bg-white/10"
        style={{
          fontSize: 10,
          height: 30,
          lineHeight: "30px",
          minHeight: 30,
          minWidth: 30,
          width: 30,
        }}
      >
        <Select.Value
          className="flex-none text-center"
          style={{ fontSize: 10, lineHeight: "30px" }}
        />
      </Select.Trigger>
      <Select.Popover className="w-24">
        <ListBox>
          {LISTENING_PLAYBACK_RATES.map((rate) => (
            <ListBox.Item
              key={String(rate)}
              id={String(rate)}
              style={{ fontSize: 12, lineHeight: "40px" }}
              textValue={`${rate}X`}
            >
              {rate}X<ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );

  const renderCompactFollowButton = () => (
    <Button
      isIconOnly
      aria-label={autoFollow ? "关闭歌词跟随" : "开启歌词跟随"}
      aria-pressed={autoFollow}
      className={
        autoFollow
          ? "size-[30px] min-w-[30px] rounded-full border border-accent/70 bg-accent text-accent-foreground shadow-sm shadow-accent/20 transition-all duration-200 hover:bg-accent/90 hover:text-accent-foreground active:scale-95 dark:border-accent/70 dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/90"
          : `${COMPACT_CONTROL_BUTTON_CLASS} text-muted`
      }
      size="sm"
      variant={autoFollow ? "primary" : "ghost"}
      onPress={onToggleFollow}
    >
      <Text className="size-3.5" />
    </Button>
  );

  const renderCompactSettingsButton = () => (
    <Button
      isIconOnly
      aria-label="播放设置"
      className={`${COMPACT_CONTROL_BUTTON_CLASS} text-muted`}
      size="sm"
      variant="ghost"
      onPress={onOpenSettings}
    >
      <Gear className="size-3.5" />
    </Button>
  );
 
  return (
    <footer className="relative z-20 h-[140px]  shrink-0 px-3 pb-3 sm:h-[140px] sm:px-5 sm:pb-4">
      <GlassCard className="h-full overflow-hidden" data-glass-no-promotion="">
        <div className="relative z-[1] mx-auto flex h-full  flex-col justify-center gap-3 px-3 py-3 sm:px-5">
          <div className="flex items-center gap-3 sm:gap-4">
            <span className="w-11 text-right text-[11px] font-medium tabular-nums tracking-tight text-foreground/65 sm:text-xs">
              {formatListeningTime(currentTime)}
            </span>
            <Slider
              aria-label="播放进度"
              className="min-w-0 flex-1"
              isDisabled={disabled || duration <= 0}
              maxValue={duration > 0 ? duration : 1}
              minValue={0}
              step={0.1}
              value={Math.min(currentTime, duration > 0 ? duration : 0)}
              onChange={(value) => {
                const next = Array.isArray(value) ? value[0] : value;

                if (typeof next === "number") onSeek(next);
              }}
            >
              <Slider.Track className="h-2.5 bg-black/[0.08] shadow-inner dark:bg-white/10">
                <Slider.Fill className="bg-gradient-to-r from-accent/65 to-accent" />
                <Slider.Thumb className="bg-transparent shadow-none [&::after]:size-3.5 [&::after]:rounded-full [&::after]:bg-white [&::after]:shadow-[0_0_0_3px_var(--accent),0_2px_8px_rgba(0,0,0,0.2)]" />
              </Slider.Track>
            </Slider>
            <span className="w-11 text-[11px] font-medium tabular-nums tracking-tight text-muted sm:text-xs">
              {formatListeningTime(duration)}
            </span>
          </div>

          {error ? (
            <span
              className="min-w-0 truncate text-center text-[10px] text-danger sm:hidden"
              role="alert"
            >
              {error}
            </span>
          ) : null}

          <div className="flex w-full items-center justify-between sm:hidden">
            <div className="flex shrink-0 items-center">
              {renderCompactPlaybackRate()}
            </div>

            <div className="flex items-center justify-center gap-3 sm:gap-3">
              <Button
                isIconOnly
                aria-label="上一课"
                className={CONTROL_BUTTON_CLASS}
                isDisabled={!hasPrevious}
                size="sm"
                variant="ghost"
                onPress={onPrevious}
              >
                <BackwardStep className="size-[16px]" />
              </Button>
              <Button
                isIconOnly
                aria-label={playing ? "暂停" : "播放"}
                className="size-14 min-w-10 rounded-full border border-accent/70 bg-gradient-to-br from-accent to-accent/80 text-accent-foreground shadow-md shadow-accent/25 transition-all duration-200 hover:-translate-y-px hover:shadow-lg hover:shadow-accent/30 active:scale-95"
                isDisabled={disabled}
                variant="primary"
                onPress={onTogglePlay}
              >
                {playing ? (
                  <PauseFill className="size-[16px]" />
                ) : (
                  <PlayFill className="size-[16px] translate-x-px" />
                )}
              </Button>
              <Button
                isIconOnly
                aria-label="下一课"
                className={CONTROL_BUTTON_CLASS}
                isDisabled={!hasNext}
                size="sm"
                variant="ghost"
                onPress={onNext}
              >
                <ForwardStep className="size-[16px]" />
              </Button>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-1.5">
              {renderCompactFollowButton()}
              {renderCompactSettingsButton()}
            </div>
          </div>

          <div className="hidden mt-1 sm:mt-1 sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:gap-4">
            <div className="flex min-w-0 items-center">
              <span
                className={`hidden max-w-full items-center gap-2 truncate rounded-full px-2.5 py-1.5 text-xs sm:inline-flex ${
                  error
                    ? "bg-danger/5 text-danger"
                    : "bg-black/[0.025] text-muted dark:bg-white/[0.035]"
                }`}
                role={error ? "alert" : undefined}
              >
                <span
                  className={`size-1.5 shrink-0 rounded-full ring-4 ${
                    error
                      ? "bg-danger ring-danger/10"
                      : "bg-accent ring-accent/10"
                  }`}
                />
                <span className="truncate">{error || MODE_LABELS[mode]}</span>
              </span>
              <span
                className="min-w-0 truncate text-[10px] text-danger sm:hidden"
                role={error ? "alert" : undefined}
              >
                {error}
              </span>
            </div>

            <div className="flex items-center justify-center gap-5 sm:gap-5">
              <Button
                isIconOnly
                aria-label="上一课"
                className={CONTROL_BUTTON_CLASS}
                isDisabled={!hasPrevious}
                size="sm"
                variant="ghost"
                onPress={onPrevious}
              >
                <BackwardStep className="size-[16px]" />
              </Button>
              <Button
                isIconOnly
                aria-label={playing ? "暂停" : "播放"}
                className="size-14 min-w-10 rounded-full border border-accent/70 bg-gradient-to-br from-accent to-accent/80 text-accent-foreground shadow-md shadow-accent/25 transition-all duration-200 hover:-translate-y-px hover:shadow-lg hover:shadow-accent/30 active:scale-95"
                isDisabled={disabled}
                variant="primary"
                onPress={onTogglePlay}
              >
                {playing ? (
                  <PauseFill className="size-[18px]" />
                ) : (
                  <PlayFill className="size-[18px] translate-x-px" />
                )}
              </Button>
              <Button
                isIconOnly
                aria-label="下一课"
                className={CONTROL_BUTTON_CLASS}
                isDisabled={!hasNext}
                size="sm"
                variant="ghost"
                onPress={onNext}
              >
                <ForwardStep className="size-[16px]" />
              </Button>
            </div>

            <div className="flex min-w-0 items-center justify-center gap-3 sm:justify-self-end sm:gap-1.5">
              <Select
                aria-label="播放速度"
                className="size-10 min-w-10"
                isDisabled={disabled}
                selectedKey={String(playbackRate)}
                variant="secondary"
                onSelectionChange={(key: Key | null) => {
                  const rate = Number(key);

                  if (Number.isFinite(rate)) onPlaybackRateChange(rate);
                }}
              >
                <Select.Trigger
                  className="size-10 min-h-10 min-w-10 flex-none justify-center rounded-full border border-white/65 bg-white/45 p-0 font-semibold tabular-nums text-foreground/70 shadow-[0_3px_10px_rgba(15,23,42,0.05)] transition-all duration-200 hover:border-accent/30 hover:bg-white/80 hover:text-accent dark:border-white/15 dark:bg-white/[0.055] dark:text-foreground/75 dark:hover:bg-white/10"
                  style={{
                    fontSize: 12,
                    height: 40,
                    lineHeight: "40px",
                    minHeight: 40,
                    minWidth: 40,
                    width: 40,
                  }}
                >
                  <Select.Value
                    className="flex-none text-center"
                    style={{ fontSize: 12, lineHeight: "40px" }}
                  />
                </Select.Trigger>
                <Select.Popover className="w-24">
                  <ListBox>
                    {LISTENING_PLAYBACK_RATES.map((rate) => (
                      <ListBox.Item
                        key={String(rate)}
                        id={String(rate)}
                        textValue={`${rate}X`}
                      >
                        {rate}X<ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
              <Button
                isIconOnly
                aria-label={autoFollow ? "关闭歌词跟随" : "开启歌词跟随"}
                aria-pressed={autoFollow}
                className={
                  autoFollow
                    ? "size-10 min-w-10 rounded-full border border-accent/70 bg-accent text-accent-foreground shadow-md shadow-accent/25 transition-all duration-200 hover:-translate-y-px hover:bg-accent/90 hover:text-accent-foreground active:scale-95 dark:border-accent/70 dark:bg-accent dark:text-accent-foreground dark:hover:bg-accent/90"
                    : `${CONTROL_BUTTON_CLASS} text-muted`
                }
                size="sm"
                variant={autoFollow ? "primary" : "ghost"}
                onPress={onToggleFollow}
              >
                <Text className="size-[18px]" />
              </Button>
              <Button
                isIconOnly
                aria-label="播放设置"
                className={`${CONTROL_BUTTON_CLASS} text-muted`}
                size="sm"
                variant="ghost"
                onPress={onOpenSettings}
              >
                <Gear className="size-[18px]" />
              </Button>
            </div>
          </div>
        </div>
      </GlassCard>
    </footer>
  );
}
