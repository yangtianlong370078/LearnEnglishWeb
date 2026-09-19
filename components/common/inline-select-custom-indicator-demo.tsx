"use client";

import type { Key } from "@heroui/react";

import { ChevronRight } from "@gravity-ui/icons";
import { ListBox, Separator, Switch } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { InlineSelect } from "@heroui-pro/react";

import { setGlassTheme } from "@/lib/glass-wallpaper-cache";
import {
  getGlassEnhance,
  setGlassEnhance,
} from "@/lib/glass-enhance";

const STORAGE_KEY = "background-theme";
const DEFAULT_THEME_ID = "magnificent";

function applyBackgroundTheme(themeId: string) {
  localStorage.setItem(STORAGE_KEY, themeId);

  return setGlassTheme(document, { background: themeId }, () => {
    document.documentElement.setAttribute("data-bg-theme", themeId);
  });
}

export default function InlineSelectCustomIndicatorDemo() {
  const [role, setRole] = useState<Key | null>(DEFAULT_THEME_ID);
  const [glassEnhance, setGlassEnhanceState] = useState(true);
  const cancelTheme = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    const storedTheme = localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_ID;

    setRole(storedTheme);
    cancelTheme.current = applyBackgroundTheme(storedTheme);
    const enhance = getGlassEnhance();

    setGlassEnhanceState(enhance);
    setGlassEnhance(enhance);

    return () => cancelTheme.current?.();
  }, []);

  const handleThemeChange = (key: Key | null) => {
    const themeId = String(key ?? DEFAULT_THEME_ID);

    setRole(themeId);
    cancelTheme.current?.();
    cancelTheme.current = applyBackgroundTheme(themeId);
  };

  const handleGlassEnhanceChange = (enabled: boolean) => {
    setGlassEnhanceState(enabled);
    setGlassEnhance(enabled);
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

      <InlineSelect.Popover className="w-[180px]">
        <div className="flex items-center justify-between gap-2 p-4">
          <span className="text-sm text-foreground">玻璃加强</span>
          <Switch
            aria-label="玻璃加强"
            isSelected={glassEnhance}
            
            onChange={handleGlassEnhanceChange}
          >
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
        </div>
        <Separator />
        <ListBox>
          <ListBox.Item id="defalut" textValue="光影">
            光影
            <ListBox.ItemIndicator />
          </ListBox.Item>
          <ListBox.Item id="magnificent" textValue="绚丽">
            绚丽
            <ListBox.ItemIndicator />
          </ListBox.Item>
        </ListBox>
      </InlineSelect.Popover>
    </InlineSelect>
  );
}
