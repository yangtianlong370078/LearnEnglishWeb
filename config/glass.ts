import type { CSSProperties } from "react";

/** 全站玻璃效果：修改后刷新页面；生产环境需要重新构建。 */
export const glassConfig = {
  /** 模糊半径，单位 px，取非负数。卡片、导航栏和弹窗共用。 */
  blurPx: 2,
  /** 基础饱和度，单位 %，100 表示不增强。 */
  saturation: 140,
  /** 边框额外饱和度，单位 %，叠加在基础饱和度上。 */
  borderSaturation: 165,
  /** 边框亮度倍数，1 表示原亮度，1.3 表示 130%。 */
  borderBrightness: 1.28,
  /**
   * 四边内发光强度，分别取 0–1；0 关闭该边内发光。
   * 每条边的强度延伸至两端圆角，沿圆弧平滑过渡到相邻边的强度。
   * 发光沿用边框色；上、左略亮，形成柔和的迎光面。top: 0.12, right: 0.16, bottom: 0.32, left: 0.32   
   */
  borderGlow: { top: 0.32, right: 0.32, bottom: 0.32, left: 0.32 },
  /** 内发光从四条边各自向内扩散的距离，单位 px，可逐边调整；圆角取相邻两边的较大值。 */
  borderGlowSizePx: { top: 20, right: 20, bottom: 20, left: 20 },
  /**
   * 细薄的白色方向性高光，独立于四边内发光。
   * angleDeg：渐变角度（deg），135 为左上迎光，增加 180 可翻转方向。180为正上往下扫光
   * intensity：整体强度，0–1；0 关闭高光，1 保持完整的默认高光。
   */
  borderHighlight: { angleDeg: 360, intensity: 0.3},
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
    "--glass-border-glow-top": String(glassConfig.borderGlow.top),
    "--glass-border-glow-right": String(glassConfig.borderGlow.right),
    "--glass-border-glow-bottom": String(glassConfig.borderGlow.bottom),
    "--glass-border-glow-left": String(glassConfig.borderGlow.left),
    "--glass-border-glow-size-top": `${glassConfig.borderGlowSizePx.top}px`,
    "--glass-border-glow-size-right": `${glassConfig.borderGlowSizePx.right}px`,
    "--glass-border-glow-size-bottom": `${glassConfig.borderGlowSizePx.bottom}px`,
    "--glass-border-glow-size-left": `${glassConfig.borderGlowSizePx.left}px`,
    "--glass-border-highlight-angle": `${glassConfig.borderHighlight.angleDeg}deg`,
    "--glass-border-highlight-intensity": String(
      glassConfig.borderHighlight.intensity,
    ),
    "--glass-blur-padding": `${glassBlurPadding}px`,
  };
