"use client";

import type { Key } from "@heroui/react";

import { ChevronRight } from "@gravity-ui/icons";
import { Button, ListBox, Modal, Separator, Spinner } from "@heroui/react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { InlineSelect } from "@heroui-pro/react";
import { runAfterTransition } from "@react-aria/utils";

import { setGlassTheme } from "@/lib/glass-wallpaper-cache";
import { getGlassMode, setGlassMode, useGlassMode } from "@/lib/glass-enhance";
import ModalBackdrop from "@/components/common/modal-backdrop";
import {
  BACKGROUND_THEME_STORAGE_KEY,
  DEFAULT_BACKGROUND_THEME,
  DEFAULT_WALLPAPERS,
  getStoredBackgroundTheme,
  getStoredWallpaperName,
  getWallpaperUrl,
  hasStoredWallpaper,
  setStoredWallpaper,
  type WallpaperMode,
} from "@/lib/theme-preferences";

const GLASS_MODES = [
  { value: "card", label: "卡片" },
  { value: "glass", label: "玻璃" },
  { value: "liquid", label: "液态玻璃" },
] as const;

const finishPopoverTransitionCleanup = () => {};

function releasePopoverTransitions(node: HTMLDivElement | null) {
  if (node) return;

  // React Aria 3.48 can retain an unmounted element when several CSS
  // transitions cancel together: its once-only cancel listener removes just
  // the first property from the global transition map. Its public scheduler
  // prunes detached elements on the next frame, after this ref is released.
  // Keep the callback shared so an unrelated active transition cannot build
  // up closures. The existing transitions and focus behavior stay intact.
  runAfterTransition(finishPopoverTransitionCleanup);
}

function applyBackgroundTheme(themeId: string) {
  // Release liquid resources immediately, including a pending dynamic import.
  if (themeId !== DEFAULT_BACKGROUND_THEME && getGlassMode() === "liquid")
    setGlassMode("glass");
  try {
    localStorage.setItem(BACKGROUND_THEME_STORAGE_KEY, themeId);
  } catch {
    // The selected background still applies for this session.
  }

  return setGlassTheme(document, { background: themeId }, () => {
    document.documentElement.setAttribute("data-bg-theme", themeId);
  });
}

export default function InlineSelectCustomIndicatorDemo() {
  const [role, setRole] = useState<Key | null>(DEFAULT_BACKGROUND_THEME);
  const glassMode = useGlassMode();
  const modeGroupId = useId();
  const cancelTheme = useRef<(() => void) | undefined>(undefined);
  const [wallpapers, setWallpapers] =
    useState<Record<WallpaperMode, string>>(DEFAULT_WALLPAPERS);
  const [picker, setPicker] = useState<WallpaperMode | null>(null);
  const [pickerImages, setPickerImages] = useState<{
    mode: WallpaperMode;
    images: string[];
  } | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);
  const pickerCache = useRef(new Map<WallpaperMode, string[]>());

  useEffect(() => {
    const storedTheme = getStoredBackgroundTheme();

    setRole(storedTheme);
    setWallpapers({
      light: getStoredWallpaperName("light"),
      dark: getStoredWallpaperName("dark"),
    });
    // The head script already restored the background before the first paint.
    // Only apply here as a fallback; mounting a picker must not delay the theme.
    if (document.documentElement.getAttribute("data-bg-theme") !== storedTheme)
      cancelTheme.current = applyBackgroundTheme(storedTheme);

    return () => cancelTheme.current?.();
  }, []);

  const openPicker = (mode: WallpaperMode) => {
    setPicker(mode);
    const cached = pickerCache.current.get(mode);

    if (cached) {
      setPickerImages({ mode, images: cached });

      return;
    }
    setPickerImages(null);
    setPickerLoading(true);
    fetch(`/api/wallpapers?mode=${mode}`)
      .then((res) => (res.ok ? res.json() : { images: [] }))
      .then((data: { images?: string[] }) => {
        const images = Array.isArray(data.images) ? data.images : [];

        pickerCache.current.set(mode, images);
        setPickerImages({ mode, images });
      })
      .catch(() => setPickerImages({ mode, images: [] }))
      .finally(() => setPickerLoading(false));
  };

  const handlePick = (name: string) => {
    if (!picker) return;
    setStoredWallpaper(picker, name);
    setWallpapers((current) => ({ ...current, [picker]: name }));
    setPicker(null);
  };

  const handleThemeChange = (key: Key | null) => {
    const themeId = String(key ?? DEFAULT_BACKGROUND_THEME);

    setRole(themeId);
    cancelTheme.current?.();
    cancelTheme.current = applyBackgroundTheme(themeId);
    // 首次切到“图片”且当前模式尚未选过图：直接打开选择弹窗。
    if (themeId === DEFAULT_BACKGROUND_THEME) {
      const mode: WallpaperMode = document.documentElement.classList.contains(
        "dark",
      )
        ? "dark"
        : "light";

      if (!hasStoredWallpaper(mode)) openPicker(mode);
    }
  };

  return (
    <>
      <InlineSelect
        aria-label="背景主题"
        className="!bg-transparent"
        value={role}
        onChange={handleThemeChange}
      >
        <div aria-hidden="true" className="glass-overlay" />
        <InlineSelect.Trigger>
          <InlineSelect.Value />
          <InlineSelect.Indicator>
            <ChevronRight />
          </InlineSelect.Indicator>
        </InlineSelect.Trigger>
        <div aria-hidden="true" className="glass-overlay" />

        <InlineSelect.Popover
          ref={releasePopoverTransitions}
          className="w-[260px]"
        >
          <fieldset className="m-0 min-w-0 border-0 p-2">
            <legend className="sr-only">卡片效果</legend>
            <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-1">
              {GLASS_MODES.map(({ value, label }) => (
                <label
                  key={value}
                  className="relative cursor-[var(--cursor-interactive)]"
                >
                  <input
                    checked={glassMode === value}
                    className="peer sr-only"
                    disabled={
                      value === "liquid" && role !== DEFAULT_BACKGROUND_THEME
                    }
                    name={modeGroupId}
                    type="radio"
                    value={value}
                    onChange={() => setGlassMode(value)}
                  />
                  <span className="flex min-h-10 items-center justify-center rounded-full px-2 text-sm font-medium whitespace-nowrap text-muted transition-all duration-300 hover:bg-black/5 hover:text-foreground peer-checked:bg-accent/15 peer-checked:text-accent peer-checked:shadow-sm peer-checked:shadow-accent/20 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:cursor-not-allowed peer-disabled:opacity-40 dark:hover:bg-white/5 dark:peer-checked:bg-white/15 dark:peer-checked:text-foreground dark:peer-checked:shadow-black/20">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <Separator />
          <ListBox>
            <ListBox.Item id="defalut" textValue="默认">
              默认
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="magnificent" textValue="图片">
              图片
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
          <Separator />
          <div className="flex flex-col gap-1 p-2">
            <p className="px-1 text-xs font-medium text-muted">背景图片</p>
            {(["light", "dark"] as const).map((mode) => (
              <div key={mode} className="flex items-center gap-1">
                <button
                  className="flex min-w-0 flex-1 cursor-[var(--cursor-interactive)] items-center gap-2 rounded-lg px-1 py-1 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  title={wallpapers[mode]}
                  type="button"
                  onClick={() => openPicker(mode)}
                >
                  <span className="relative block h-7 w-11 shrink-0 overflow-hidden rounded-md">
                    <Image
                      fill
                      alt=""
                      className="object-cover"
                      sizes="44px"
                      src={getWallpaperUrl(mode, wallpapers[mode])}
                    />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">
                    {mode === "light" ? "浅色" : "深色"} · {wallpapers[mode]}
                  </span>
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => openPicker(mode)}
                >
                  选择
                </Button>
              </div>
            ))}
          </div>
        </InlineSelect.Popover>
      </InlineSelect>
      <ModalBackdrop
        containerClassName="w-full max-w-2xl rounded-3xl"
        isOpen={picker !== null}
        onOpenChange={(open) => {
          if (!open) setPicker(null);
        }}
      >
        <Modal.CloseTrigger />
        <Modal.Header>
          <Modal.Heading className="text-lg font-semibold">
            选择{picker === "dark" ? "深色" : "浅色"}模式背景图
          </Modal.Heading>
        </Modal.Header>
        <div className="py-4">
          {pickerLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : picker &&
            pickerImages?.mode === picker &&
            pickerImages.images.length ? (
            <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
              {pickerImages.images.map((name) => (
                <button
                  key={name}
                  className={`cursor-[var(--cursor-interactive)] rounded-xl p-1 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${
                    wallpapers[picker] === name ? "ring-2 ring-accent" : ""
                  }`}
                  type="button"
                  onClick={() => handlePick(name)}
                >
                  <span className="relative block aspect-video w-full overflow-hidden rounded-lg">
                    <Image
                      fill
                      alt={name}
                      className="object-cover"
                      sizes="(max-width: 640px) 45vw, 220px"
                      src={getWallpaperUrl(picker, name)}
                    />
                  </span>
                  <span className="mt-1 block truncate px-1 text-xs text-muted">
                    {name}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted">
              /images/{picker ?? "light"}/ 目录下暂无图片
            </p>
          )}
        </div>
      </ModalBackdrop>
    </>
  );
}
