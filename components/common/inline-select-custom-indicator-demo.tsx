"use client";

import type { Key } from "@heroui/react";

import { ChevronRight } from "@gravity-ui/icons";
import { ListBox, Separator } from "@heroui/react";
import { useEffect, useId, useRef, useState } from "react";
import { InlineSelect } from "@heroui-pro/react";
import { runAfterTransition } from "@react-aria/utils";

import { setGlassTheme } from "@/lib/glass-wallpaper-cache";
import { getGlassMode, setGlassMode, useGlassMode } from "@/lib/glass-enhance";
import {
  BACKGROUND_THEME_STORAGE_KEY,
  DEFAULT_BACKGROUND_THEME,
  getStoredBackgroundTheme,
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

  useEffect(() => {
    const storedTheme = getStoredBackgroundTheme();

    setRole(storedTheme);
    // The head script already restored the background before the first paint.
    // Only apply here as a fallback; mounting a picker must not delay the theme.
    if (document.documentElement.getAttribute("data-bg-theme") !== storedTheme)
      cancelTheme.current = applyBackgroundTheme(storedTheme);

    return () => cancelTheme.current?.();
  }, []);

  const handleThemeChange = (key: Key | null) => {
    const themeId = String(key ?? DEFAULT_BACKGROUND_THEME);

    setRole(themeId);
    cancelTheme.current?.();
    cancelTheme.current = applyBackgroundTheme(themeId);
  };

  return (
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
        className="w-[240px]"
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
      </InlineSelect.Popover>
    </InlineSelect>
  );
}
