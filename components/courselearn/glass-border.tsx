"use client";

/**
 * 液态玻璃边框，分两层使用：
 *
 * - `GlassWarp`：铺满卡片的毛玻璃层（absolute inset-0），
 *   `backdrop-filter: blur+saturate`。必须作为卡片的第一个子元素渲染（位于内容之下），
 *   且卡片自身不能带 backdrop-filter / isolation / transform 等 Backdrop Root
 *   触发属性（否则子层采样不到页面背景，毛玻璃失效）。
 * - `GlassBorder`：两层白色渐变描边（渲染在卡片内容之上），
 *   玻璃质感来自 GlassWarp 的模糊透过渐变透明部分自然显现。
 *
 * 为什么不用 mix-blend-mode（源码的 screen/overlay 混合）：
 * 1) 卡片必须保持 isolation: auto（见上），此时混合会穿透到根层叠上下文
 *    与整页内容混合，触发 Chromium/Blink 合成器 Bug（页面顶部透明色块、
 *    hover 闪烁）；
 * 2) 用 isolation: isolate 壳约束混合，overlay 对透明背景的混合结果为黑色，
 *    会把玻璃盖成浑浊边；
 * 3) 给卡片加 backdrop-filter 约束混合，Blink 中 backdrop-filter 与
 *    mix-blend-mode 后代冲突，卡片毛玻璃被跳过且合成层不稳定（仍闪）。
 * 而两层渐变源均为纯白色：screen(任意底色, 白) ≡ 白色直绘，overlay 在亮玻璃上
 * 也约等于直绘——普通 source-over 合成在亮色模式下与混合效果几乎一致，
 * 暗色模式下仅略亮，且玻璃始终透过渐变透明区可见。
 *
 * 注：liquid-glass-react 的 SVG 位移折射方案（feImage data: URI + feDisplacementMap）
 * 已移除——Chromium 对 feImage 内联 data: URI 支持有缺陷（控制台报 net::ERR_INVALID_URL），
 * 且该滤镜从未被引用（死代码）。
 */

const RING_MASK = "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)";

interface GlassWarpProps {
  /** 玻璃模糊量（与原卡片毛玻璃一致） */
  blurPx?: number;
  /** 玻璃饱和度（%，与原卡片毛玻璃一致） */
  saturation?: number;
}

/** 液态玻璃 warp 层：铺满卡片的毛玻璃层（渲染在卡片内容之下） */
export function GlassWarp({ blurPx = 8, saturation = 150 }: GlassWarpProps) {
  const backdrop = `blur(${blurPx}px) saturate(${saturation}%) `;

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0"
      style={{
        borderRadius: "inherit",
        WebkitBackdropFilter: backdrop,
        backdropFilter: backdrop,
      }}
    />
  );
}

/** 液态玻璃描边层：高亮高饱和玻璃环 + 乳白高光（渲染在卡片内容之上） */
export default function GlassBorder() {
  return (
    <>
      {/* 玻璃环：backdrop-filter 对环区下方的 warp 玻璃再提亮、提饱和，
          把背景"高亮高饱和"地透上来（替代源码 screen/overlay 混合叠加的效果）。
          纯黑背景下提亮几乎无效 → 边框隐去，只剩下方乳白高光的轻微乳白边；
          彩色背景下色彩被提亮提饱和透上来。无 mix-blend-mode，不触发合成器 Bug。
          强度调优：saturate 控制提饱和，brightness 控制提亮 */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: "inherit",
          padding: "1px",
          WebkitMask: RING_MASK,
          WebkitMaskComposite: "xor",
          mask: RING_MASK,
          maskComposite: "exclude",
          WebkitBackdropFilter: "saturate(200%) brightness(1.3)",
          backdropFilter: "saturate(200%) brightness(1.3)",
        }}
      />

      {/* 乳白高光：轻微乳白色边框 + 边缘立体感（191.369deg 扫向底部） */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: "inherit",
          padding: "1px",
          opacity: 0.2,
          transition: "all 0.2s ease-out 0s",
          WebkitMask: RING_MASK,
          WebkitMaskComposite: "xor",
          mask: RING_MASK,
          maskComposite: "exclude",
          boxShadow:
            "rgba(255, 255, 255, 0.35) 0px 0px 0px 0.5px inset, rgba(255, 255, 255, 0.18) 0px 1px 3px inset, rgba(0, 0, 0, 0.35) 0px 1px 4px",
          background:
            "linear-gradient(191.369deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.494) 46.0257%, rgba(255, 255, 255, 0.965) 83.3676%, rgba(255, 255, 255, 0) 100%)",
        }}
      />
    </>
  );
}
