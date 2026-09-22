"use client";

import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

import { twMerge } from "tailwind-merge";

import GlassBorder, { GlassWarp } from "@/components/courselearn/glass-border";

/** 玻璃卡片基础类名（液态玻璃底 + 圆角 + 描边环） */
export const GLASS_CARD_CLASS =
  "relative yinyinkuan rounded-3xl cl-glass-idle";

interface GlassCardProps extends ComponentPropsWithoutRef<"div"> {
  /** 渲染标签，默认 div（如分页栏可传 "nav"） */
  as?: ElementType;
  children?: ReactNode;
}

/**
 * 液态玻璃卡片：内部已渲染 GlassWarp / GlassBorder 玻璃层，
 * 只封装基础 className，使用方通过 className 按需扩展。
 */
export default function GlassCard({
  as: Tag = "div",
  className,
  children,
  ...props
}: GlassCardProps) {
  return (
    <Tag className={twMerge(GLASS_CARD_CLASS, className)} {...props}>
      <GlassWarp />
      {children}
      <GlassBorder />
    </Tag>
  );
}
