"use client";

import type { Key } from "@heroui/react";

import { ChevronRight } from "@gravity-ui/icons";
import { ListBox } from "@heroui/react";
import { useEffect, useState } from "react";
import { InlineSelect } from "@heroui-pro/react";

const STORAGE_KEY = "background-theme";
const DEFAULT_THEME_ID = "defalut";

function applyBackgroundTheme(themeId: string) {
  document.documentElement.setAttribute("data-bg-theme", themeId);
  localStorage.setItem(STORAGE_KEY, themeId);
}

export default function InlineSelectCustomIndicatorDemo() {
  const [role, setRole] = useState<Key | null>(DEFAULT_THEME_ID);

  useEffect(() => {
    const storedTheme = localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_ID;

    setRole(storedTheme);
    applyBackgroundTheme(storedTheme);
  }, []);

  const handleThemeChange = (key: Key | null) => {
    const themeId = String(key ?? DEFAULT_THEME_ID);

    setRole(themeId);
    applyBackgroundTheme(themeId);
  };

  return (
    <InlineSelect
      aria-label="背景主题"
      selectedKey={role}
      onSelectionChange={handleThemeChange}
    >
      <InlineSelect.Trigger>
        <InlineSelect.Value />
        <InlineSelect.Indicator>
          <ChevronRight />
        </InlineSelect.Indicator>
      </InlineSelect.Trigger>
      <InlineSelect.Popover className="w-[124px]">
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
