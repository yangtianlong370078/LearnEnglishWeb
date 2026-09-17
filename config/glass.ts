import type { CSSProperties } from "react";

/** 全站玻璃效果：修改后刷新页面；生产环境需要重新构建。 */
export const glassConfig = {
  /** 模糊半径，单位 px，取非负数。卡片、导航栏和弹窗共用。 */
  blurPx: 8,
  /** 基础饱和度，单位 %，100 表示不增强。 */
  saturation: 140,
  /** 边框额外饱和度，单位 %，叠加在基础饱和度上。 */
  borderSaturation: 180,
  /** 边框亮度倍数，1 表示原亮度，1.3 表示 130%。 */
  borderBrightness: 1.4,
  /** 边框内发光强度，0–1 的透明度；发光颜色与边框色相同，圆角与四边一致。 */
  borderGlow: 0.25,
  /** 内发光从四条边各自向内扩散的距离，单位 px，可逐边调整；圆角取相邻两边的较大值。 */
  borderGlowSizePx: { top: 6, right: 6, bottom: 6, left: 6 },
  /**
   * 缓存纹理是否使用无损压缩：
   * true：全部使用 PNG，避免 JPEG 压缩失真。
   * false：图片背景使用质量 0.98 的 JPEG，减少编码开销；
   * 渐变背景仍使用 PNG，避免平滑渐变出现色块。
   */
  losslessWallpaper: false,
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
    "--glass-border-glow": String(glassConfig.borderGlow),
    "--glass-border-glow-size-top": `${glassConfig.borderGlowSizePx.top}px`,
    "--glass-border-glow-size-right": `${glassConfig.borderGlowSizePx.right}px`,
    "--glass-border-glow-size-bottom": `${glassConfig.borderGlowSizePx.bottom}px`,
    "--glass-border-glow-size-left": `${glassConfig.borderGlowSizePx.left}px`,
    "--glass-blur-padding": `${glassBlurPadding}px`,
  };
