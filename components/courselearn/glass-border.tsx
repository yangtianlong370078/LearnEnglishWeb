"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * 液态玻璃边框（移植自 liquid-glass-react，standard 模式），分两层使用：
 *
 * - `GlassWarp`：铺满卡片的玻璃层（absolute inset-0），`filter: url(#id)` 位移折射
 *   + `backdrop-filter: blur+saturate`。必须作为卡片的第一个子元素渲染（位于内容之下），
 *   且卡片自身不能带 backdrop-filter（否则卡片成为 Backdrop Root，
 *   子层 backdrop-filter 采样不到页面背景，折射失效）。
 *   卡片中心区域由滤镜保持原样，仅边缘产生折射/色差。
 * - `GlassBorder`：源码的 Border layer 1/2（screen + overlay 渐变描边），
 *   渲染在卡片内容之上。
 *
 * 位移贴图与渐变角度均为静态，不跟随鼠标。
 *
 * 注意：SVG 滤镜中的 feImage 百分比尺寸会相对所在 <svg> 的视口解析，
 * 因此 <svg> 必须带有卡片的实测宽高（与参考库的 glassSize 一致），
 * 否则 feImage 尺寸为 0，位移贴图为空，滤镜整体失效。
 */

// standard 模式位移贴图（源自 liquid-glass-react src/utils.ts）
const DISPLACEMENT_MAP =
  "data:image/jpeg;base64,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GgkoxZGgxZFQFQlYnQHRdPfj/10KCSCKESCNiVkViPSLpD0h6I0Q0I0A2IoBWBIJIBKBIJoJIJ2R2J0JWBUJ0JUB0XTv479dFZDYiglYigkhEgjZFQjRFQjRFQjQigFYigHYigmgEgmglYlYnQlQlYlQHQlQnQ9P/kf1yVkNiNCNkNiVENiNiViNEViNkVCVgKCViViViSCViSCVgdCViVCViVCdgVCVCdD1D+U/XBWQ2I0I2Q2JUQ2I0JWQ0I2JUQ2JUI2JUI2J0JWJWJWA2R0BWJ0I2JUJ0P//EABkQAQEBAQEBAAAAAAAAAAAAAAECABEDEP/aAAgBAQABAgB1atWrVq1atWrVq1atWrVq1atWrVq+OrVq1atWrVq1atWrVq1atXxVppppppdWrVq1atWrVq1NNNNNNNNNNNPVWmmmmms6tWrVq1atWpppppppppppppp6q0000uc51atWrVq1ammmmmmmmmmmmmt1Vpppc5znVq1atWrVqaaaaaaaaaaaaaeqtNLnOc51atWrVq1ammmmmmmmmmmmmnqrS5znOc6tWrVq16222mmmmmmlVppp6tKuc5znOrVq1a9TbbbbTTTTTSq000qtLnOc5zq1atWrVrb1tttttttttNNKqqqqrWrK5VWmmm2230bbbbbbaaaXOc5zlVa1KuVVppptttt9G22222mmlzlVznK6tWVVWmmmm2222222222mlznOc5znLWppVVWmmm22222229bTWrOc5znKtatStK0rTbTTbbbberXr1as5znOc5aVpppppWlabaabbbb1ta9WrVnOc5znU0rTTTTTTTTTbTTbbbTWvVq1as5znOdTTStNNNNNNNNNNtNNtttN6tWvVq1ZznOrU00rTTTTTTTTTTTTTbTWvVq1atWrOc6tTTTStNNNNNNNNNNtNNtNa9WrVq1Z1Z1NNNNNK1q1NNNNNNNNNNNtNatWrVq1atWrU00000rWrVq1atWrVq1alaaa1atWrVq1NNNammmmla1atWrVq1aterVq16tWrVnVqa1NK1qaaaVX/xAAWEAADAAAAAAAAAAAAAAAAAAAhgJD/2gAIAQEAAz8AaExf/8QAGhEBAQEBAQEBAAAAAAAAAAAAAQISEQADEP/aAAgBAgEBAgDx48ePHjx48ePHjx48ePHjx48ePHj86IiIiIiInjx48ePHjx48IiIiIj0oooooooooRERER73ve60UUUUUUVrWiiiiiihERERER73ve97ooooorRWiiiiihKERERER73ve973RRRRWtFFFFFFCIiIiIiPe973ve973pRRWiiiiiiiiiiihEe973ve973RRRRRRRRRRZZZZZZZZZWta1rWta1rRRRRRRRRZZZZZZZZZZZZe9a1rWta1rWitaKLLLLLLLLLLLLLLLLLLLL3rWta1rWtFbLLLLLLLLLLLLLLLLLLLL3vWta1rWita1ssssssss+hZZZZZZZZe961rWta0Vre97LLLLLLLLLLLPoWWWWWXrWta1oorWta3ssss+hZZZZ9Cyyyyyyyyiita1orWta1ve9llllllllllllllllFFa0VorWta1ve9llllllllllllFFFaK1rWta1rWiyyyyyyyyyyyyiiiiiiitFFa1rWta0UUUUUWUUUUUUUUUUUVoooorWta1rWtaKKKKKKmiiiiiiiiiiiiiiitd73ve61oSiiipoqaKKKKKKKKKK0UUUVrve973vREREZoSihEooooorRRRRWtd73ve9EREREREoSiiiiitFllllla73ve9ERERERESiiiiiitH0PoWWWWVrXe96IiIiMoiJRRRRRRWjwlFFllllFFd6IiIiIlCUUUUUUUUUePHjx48ePHjx48ePHjx48IiUUUUUUJRRRX//xAAWEQADAAAAAAAAAAAAAAAAAAABYJD/2gAIAQIBAz8AtEV7/8QAFxEBAQEBAAAAAAAAAAAAAAAAAAECEP/aAAgBAwEBAgCtNNNNNNNNNNNNNNNNNNNNNNNNNNNNNcrTTTTTTTTTTTTTTTTTTTTTTTTTTTTTXKrTTTTTTTU00000000000000000001FVpppppqampqaaaaaaaaaaaaaaaaaaaa5Vaaaaampqampqammmmmmmmmmmlaaaaaaiq0001NTU1NTU1NTTTTTTTTTTSqqtNNNcqtNNSyzU1LNTU1NTTTTTTTTTSqqq001ytNLLLLNTU1NTU1NTbbbTTTTTSqqq001ytNLLLLLNTU1NTU3NttttNNNNNKqq001KrSyyyyyzU1NTU3Nzc3NttttNNNKqqqqrSqqyyyyyzU1NTU3Nzc3NttttNNNKqqqqqqssssss1NTU3Nzc3NzbbbbTTTSqqqqqqrLLLLLNTU1Nzc3Nzc22220000qqqqqqqq0022223NTU1NTUsssssssqqqqqqrTTTTTbbbTc3NTU1NTUsssssqqqqqqqq0000222023NTU1NTUsssssqqqqqqqq000000003NTU1NTU1LLLLLNKrTSqqqqtNNNNNNtNNTU1NSzUssss00qq0qqqqrTTTTTTTTTU1NTUs1LLLNNNKrTTTSqqq00000000001NTU1LNTU0000qtNNNKqqqtNNNNNNNNTU1NTUs1NNNNNKss1NNNK00qtK0000001NNTU0s000000qq000001NKrStNNNNK1NNNNStNNNNNKqtNNNNNNNK0000000rU0000rTTTTTTTTTTTTTTTTStNNNNKr/xAAUEQEAAAAAAAAAAAAAAAAAAACg/9oACAEDAQM/AAAf/9k=";

const RING_MASK = "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)";

interface GlassWarpProps {
  /** 折射位移强度（源码默认 70，演示站为 100） */
  displacementScale?: number;
  /** 边缘色差强度（源码默认 2） */
  aberrationIntensity?: number;
  /** 玻璃模糊量（与原卡片毛玻璃一致） */
  blurPx?: number;
  /** 玻璃饱和度（%，与原卡片毛玻璃一致） */
  saturation?: number;
}

/** 液态玻璃 warp 层：铺满卡片，中心清晰、边缘折射提饱和（渲染在卡片内容之下） */
export function GlassWarp({
  displacementScale = 70,
  aberrationIntensity = 2,
  blurPx = 8,
  saturation = 150,
}: GlassWarpProps) {
  const filterId = useId();
  const warpRef = useRef<HTMLSpanElement | null>(null);
  // <svg> 视口需要卡片实测尺寸，否则 feImage 的 100% 解析为 0，滤镜失效
  const [size, setSize] = useState({ width: 352, height: 236 });

  // 折射通过 backdrop-filter: url(#id) 直接扭曲背景实现（Chromium 支持）；
  // 不支持 url() 的浏览器（Firefox/Safari）退化为仅模糊提饱和
  const plainBackdrop = `blur(${blurPx}px) saturate(${saturation}%)`;
  const [backdrop, setBackdrop] = useState(plainBackdrop);

  useEffect(() => {
    if (
      typeof CSS !== "undefined" &&
      CSS.supports?.("backdrop-filter", "blur(1px)")
    ) {
      setBackdrop(` ${plainBackdrop}`);
    }
  }, [filterId, plainBackdrop]);

  useEffect(() => {
    const host = warpRef.current?.parentElement;

    if (!host) return;

    const update = () => {
      const rect = host.getBoundingClientRect();

      setSize({ width: rect.width, height: rect.height });
    };

    update();
    const observer = new ResizeObserver(update);

    observer.observe(host);

    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* 边缘折射滤镜（SourceGraphic = warp 层的毛玻璃输出，中心保持原样、边缘位移+色差） */}
      <svg
        aria-hidden="true"
        height={size.height}
        style={{ position: "absolute" }}
        width={size.width}
      >
        <defs>
          <filter
            colorInterpolationFilters="sRGB"
            height="170%"
            id={filterId}
            width="170%"
            x="-35%"
            y="-35%"
          >
            <feImage
              height="100%"
              href={DISPLACEMENT_MAP}
              preserveAspectRatio="xMidYMid slice"
              result="DISPLACEMENT_MAP"
              width="100%"
              x="0"
              y="0"
            />
            {/* 用位移贴图本身生成边缘蒙版 */}
            <feColorMatrix
              in="DISPLACEMENT_MAP"
              result="EDGE_INTENSITY"
              type="matrix"
              values="0.3 0.3 0.3 0 0
                 0.3 0.3 0.3 0 0
                 0.3 0.3 0.3 0 0
                 0 0 0 1 0"
            />
            <feComponentTransfer in="EDGE_INTENSITY" result="EDGE_MASK">
              <feFuncA
                tableValues={`0 ${aberrationIntensity * 0.05} 1`}
                type="discrete"
              />
            </feComponentTransfer>

            {/* 中心区域保留未位移图像 */}
            <feOffset dx="0" dy="0" in="SourceGraphic" result="CENTER_ORIGINAL" />

            {/* R 通道位移 */}
            <feDisplacementMap
              in="SourceGraphic"
              in2="DISPLACEMENT_MAP"
              result="RED_DISPLACED"
              scale={-displacementScale}
              xChannelSelector="R"
              yChannelSelector="B"
            />
            <feColorMatrix
              in="RED_DISPLACED"
              result="RED_CHANNEL"
              type="matrix"
              values="1 0 0 0 0
                 0 0 0 0 0
                 0 0 0 0 0
                 0 0 0 1 0"
            />

            {/* G 通道位移（轻微偏移产生色差） */}
            <feDisplacementMap
              in="SourceGraphic"
              in2="DISPLACEMENT_MAP"
              result="GREEN_DISPLACED"
              scale={-displacementScale - aberrationIntensity * 0.05}
              xChannelSelector="R"
              yChannelSelector="B"
            />
            <feColorMatrix
              in="GREEN_DISPLACED"
              result="GREEN_CHANNEL"
              type="matrix"
              values="0 0 0 0 0
                 0 1 0 0 0
                 0 0 0 0 0
                 0 0 0 1 0"
            />

            {/* B 通道位移（更大偏移） */}
            <feDisplacementMap
              in="SourceGraphic"
              in2="DISPLACEMENT_MAP"
              result="BLUE_DISPLACED"
              scale={-displacementScale - aberrationIntensity * 0.1}
              xChannelSelector="R"
              yChannelSelector="B"
            />
            <feColorMatrix
              in="BLUE_DISPLACED"
              result="BLUE_CHANNEL"
              type="matrix"
              values="0 0 0 0 0
                 0 0 0 0 0
                 0 0 1 0 0
                 0 0 0 1 0"
            />

            {/* screen 混合三通道形成色差 */}
            <feBlend in="GREEN_CHANNEL" in2="BLUE_CHANNEL" mode="screen" result="GB_COMBINED" />
            <feBlend in="RED_CHANNEL" in2="GB_COMBINED" mode="screen" result="RGB_COMBINED" />

            {/* 轻微模糊柔化色差 */}
            <feGaussianBlur
              in="RGB_COMBINED"
              result="ABERRATED_BLURRED"
              stdDeviation={Math.max(0.1, 0.5 - aberrationIntensity * 0.1)}
            />

            {/* 边缘应用折射色差，中心保持清晰 */}
            <feComposite in="ABERRATED_BLURRED" in2="EDGE_MASK" operator="in" result="EDGE_ABERRATION" />
            <feComponentTransfer in="EDGE_MASK" result="INVERTED_MASK">
              <feFuncA tableValues="1 0" type="table" />
            </feComponentTransfer>
            <feComposite in="CENTER_ORIGINAL" in2="INVERTED_MASK" operator="in" result="CENTER_CLEAN" />
            <feComposite in="EDGE_ABERRATION" in2="CENTER_CLEAN" operator="over" />
          </filter>
        </defs>
      </svg>

      {/* warp 层：毛玻璃 + 边缘折射（位于卡片内容之下） */}
      <span
        ref={warpRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          borderRadius: "inherit",
          WebkitBackdropFilter: backdrop,
          backdropFilter: backdrop,
        }}
      />
    </>
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
