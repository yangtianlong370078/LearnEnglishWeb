"use client";

import { Gear } from "@gravity-ui/icons";
import { Button } from "@heroui/react";

interface CourseLearnNavbarProps {
  courseName: string;
  onOpenSettings: () => void;
}

/**
 * 课程学习顶部导航（吸顶），显示课程名称，右侧设置按钮。
 */
export default function CourseLearnNavbar({
  courseName,
  onOpenSettings,
}: CourseLearnNavbarProps) {
  return (
    <div className="cl-navbar w-full px-6 py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <h1 className="line-clamp-1 text-lg font-semibold text-foreground">
          {courseName || "课程学习"}
        </h1>
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


 
  );
}
