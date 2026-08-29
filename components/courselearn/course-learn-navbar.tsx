"use client";

import { Display, Gear, Moon, Sun } from "@gravity-ui/icons";
import { Button } from "@heroui/react";
import { Segment } from "@heroui-pro/react";
import { useSyncExternalStore } from "react";

import { useTheme } from "@/app/providers";
import InlineSelectCustomIndicatorDemo from "@/components/common/inline-select-custom-indicator-demo";

interface CourseLearnNavbarProps {
  courseName: string;
  onOpenSettings: () => void;
}

function subscribeMounted(onStoreChange: () => void) {
  onStoreChange();

  return () => {};
}

function isTheme(value: string): value is "light" | "dark" | "system" {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * 课程学习顶部导航（吸顶），显示课程名称，右侧主题切换 + 设置按钮。
 */
export default function CourseLearnNavbar({
  courseName,
  onOpenSettings,
}: CourseLearnNavbarProps) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeMounted,
    () => true,
    () => false,
  );

  return (
    <div className="cl-navbar w-full px-6 py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <h1 className="line-clamp-1 bg-gradient-to-r from-foreground via-foreground to-foreground/60 bg-clip-text text-lg font-semibold tracking-tight text-transparent">
          {courseName || "课程学习"}
        </h1>

        <div className="flex items-center gap-2">

          <Segment
            // @ts-expect-error suppressHydrationWarning 由 HeroUI V3 Segment 支持但类型尚未暴露
            suppressHydrationWarning
            className="gap-0 !bg-white/50 dark:!bg-black/30"
            selectedKey={mounted ? (theme ?? "system") : "system"}
            size="sm"
            onSelectionChange={(key) => {
              const nextTheme = String(key);

              if (isTheme(nextTheme)) setTheme(nextTheme);
            }}
          >
            <Segment.Item
              aria-label="浅色模式"
              className="size-[28px] px-0"
              id="light"
            >
              <Sun className="size-3.5" />
            </Segment.Item>
            <Segment.Item
              aria-label="深色模式"
              className="size-[28px] px-0"
              id="dark"
            >
              <Moon className="size-3.5" />
            </Segment.Item>
            <Segment.Item
              aria-label="跟随系统"
              className="size-[28px] px-0"
              id="system"
            >
              <Display className="size-3.5" />
            </Segment.Item>
          </Segment>
          <InlineSelectCustomIndicatorDemo />
          <Button
            isIconOnly
            aria-label="学习设置"
            variant="secondary"
            onPress={onOpenSettings}
          >
            <Gear />
          </Button>
        </div>
      </div>
    </div>
  );
}
