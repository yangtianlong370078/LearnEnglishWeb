"use client";

import type { Key } from "@heroui/react";

import { ChevronRight } from "@gravity-ui/icons";
import { ListBox, Separator } from "@heroui/react";
import { useEffect, useId, useRef, useState } from "react";
import { InlineSelect } from "@heroui-pro/react";

import { setGlassTheme } from "@/lib/glass-wallpaper-cache";
import { getGlassMode, setGlassMode, useGlassMode } from "@/lib/glass-enhance";

const STORAGE_KEY = "background-theme";
const DEFAULT_THEME_ID = "magnificent";
const GLASS_MODES = [
  { value: "card", label: "卡片" },
  { value: "glass", label: "玻璃" },
  { value: "liquid", label: "液态玻璃" },
] as const;

function applyBackgroundTheme(themeId: string) {
  // Release liquid resources immediately, including a pending dynamic import.
  if (themeId !== DEFAULT_THEME_ID && getGlassMode() === "liquid")
    setGlassMode("glass");
  localStorage.setItem(STORAGE_KEY, themeId);

  return setGlassTheme(document, { background: themeId }, () => {
    document.documentElement.setAttribute("data-bg-theme", themeId);
  });
}

export default function InlineSelectCustomIndicatorDemo() {
  const [role, setRole] = useState<Key | null>(DEFAULT_THEME_ID);
  const glassMode = useGlassMode();
  const modeGroupId = useId();
  const cancelTheme = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    const storedTheme = localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_ID;

    setRole(storedTheme);
    cancelTheme.current = applyBackgroundTheme(storedTheme);

    return () => cancelTheme.current?.();
  }, []);

  const handleThemeChange = (key: Key | null) => {
    const themeId = String(key ?? DEFAULT_THEME_ID);

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

      <InlineSelect.Popover className="w-[240px]">
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
                  disabled={value === "liquid" && role !== DEFAULT_THEME_ID}
                  name={modeGroupId}
                  type="radio"
                  value={value}
                  onChange={() => setGlassMode(value)}
                />
                <span className="flex min-h-10 items-center justify-center rounded-lg px-2 text-sm whitespace-nowrap text-muted peer-checked:bg-surface-secondary peer-checked:text-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:cursor-not-allowed peer-disabled:opacity-40">
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
