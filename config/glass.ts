import type { CSSProperties } from "react";

/** 全站玻璃效果：修改后刷新页面；生产环境需要重新构建。 */
export const glassConfig = {
  /** 模糊半径，单位 px，取非负数。卡片、导航栏和弹窗共用。 */
  blurPx: 8,
  /** 基础饱和度，单位 %，100 表示不增强。 */
  saturation: 150,
  /** 边框额外饱和度，单位 %，叠加在基础饱和度上。 */
  borderSaturation: 180,
  /** 边框亮度倍数，1 表示原亮度，1.3 表示 130%。 */
  borderBrightness: 1.3,
} as const;

// 为模糊核留出四倍半径，防止调整模糊值后产生透明边缘。
// 至少保留 1px，让关闭模糊时的 Canvas 边缘采样仍有有效尺寸。
export const glassBlurPadding = Math.max(1, Math.ceil(glassConfig.blurPx * 4));

// 根布局在首屏 HTML 中输出变量；CSS 与 Canvas/SVG 共用上面的配置。
export const glassCssVariables: CSSProperties & Record<`--${string}`, string> =
  {
    "--app-glass-blur": `${glassConfig.blurPx}px`,
    "--app-glass-saturation": `${glassConfig.saturation}%`,
    "--glass-border-saturation": `${glassConfig.borderSaturation}%`,
    "--glass-border-brightness": String(glassConfig.borderBrightness),
    "--glass-blur-padding": `${glassBlurPadding}px`,
  };
