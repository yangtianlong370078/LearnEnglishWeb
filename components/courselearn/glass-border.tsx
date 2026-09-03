"use client";

/**
 * 液态玻璃边框，分两层使用：
 *
 * - `GlassWarp`：铺满卡片的毛玻璃层（absolute inset-0），
 *   `backdrop-filter: blur+saturate`。必须作为卡片的第一个子元素渲染（位于内容之下），
 *   且卡片自身不能带 backdrop-filter（否则卡片成为 Backdrop Root，
 *   子层 backdrop-filter 采样不到页面背景，毛玻璃失效）。
 * - `GlassBorder`：screen + overlay 渐变描边，渲染在卡片内容之上。
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
  const backdrop = `blur(${blurPx}px) saturate(${saturation}%)`;

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

/** 液态玻璃描边层：源码 Border layer 1/2（渲染在卡片内容之上） */
export default function GlassBorder() {
  return (
    <>
      {/* Border layer 1：screen 混合，高光固定（191.369deg 扫向底部） */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: "inherit",
          padding: "1.5px",
          mixBlendMode: "screen",
          opacity: 0.2,
          transition: "all 0.2s ease-out 0s",
          WebkitMask: RING_MASK,
          WebkitMaskComposite: "xor",
          mask: RING_MASK,
          maskComposite: "exclude",
          boxShadow:
            "rgba(255, 255, 255, 0.5) 0px 0px 0px 0.5px inset, rgba(255, 255, 255, 0.25) 0px 1px 3px inset, rgba(0, 0, 0, 0.35) 0px 1px 4px",
          background:
            "linear-gradient(191.369deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.494) 46.0257%, rgba(255, 255, 255, 0.965) 83.3676%, rgba(255, 255, 255, 0) 100%)",
        }}
      />

      {/* Border layer 2：overlay 混合，高光固定（99.2582deg 扫向右侧） */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: "inherit",
          padding: "1.5px",
          mixBlendMode: "overlay",
          transition: "all 0.2s ease-out 0s",
          WebkitMask: RING_MASK,
          WebkitMaskComposite: "xor",
          mask: RING_MASK,
          maskComposite: "exclude",
          boxShadow:
            "rgba(255, 255, 255, 0.5) 0px 0px 0px 0.5px inset, rgba(255, 255, 255, 0.25) 0px 1px 3px inset, rgba(0, 0, 0, 0.35) 0px 1px 4px",
          background:
            "linear-gradient(99.2582deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.557) 25.1936%, rgba(255, 255, 255, 0.957) 55.5915%, rgba(255, 255, 255, 0) 100%)",
        }}
      />
    </>
  );
}
