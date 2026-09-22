"use client";

import type { KPIRootProps } from "@heroui-pro/react";

import { KPI as HeroKPI } from "@heroui-pro/react";
import { twMerge } from "tailwind-merge";

import GlassBorder, { GlassWarp } from "@/components/courselearn/glass-border";

/** 玻璃 KPI 卡片基础类名（液态玻璃底 + 圆角 + 描边环） */
export const GLASS_KPI_CLASS = "yinyinkuan rounded-3xl cl-glass-idle";

function GlassKPIRoot({ children, className, ...props }: KPIRootProps) {
  return (
    <HeroKPI className={twMerge(GLASS_KPI_CLASS, className)} {...props}>
      <GlassWarp />
      {children}
      <GlassBorder />
    </HeroKPI>
  );
}

/**
 * 液态玻璃 KPI 卡片：内部已渲染 GlassWarp / GlassBorder 玻璃层，
 * 只封装基础 className，使用方通过 className 按需扩展；
 * 复合子组件（Header / Content / Value / Chart 等）与原 KPI 一致。
 */
const GlassKPI = Object.assign(GlassKPIRoot, HeroKPI);

export default GlassKPI;
