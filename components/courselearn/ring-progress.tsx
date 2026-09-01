"use client";

import type { ReactNode } from "react";
import { useId } from "react";

interface RingProgressProps {
  /** 百分比 0-100 */
  percent: number;
  /** 环直径（px） */
  size?: number;
  /** 环宽（px） */
  strokeWidth?: number;
  /** 进度渐变起始色 */
  color?: string;
  /** 进度渐变终点色（不传则单色） */
  colorTo?: string;
  /** 轨道颜色 */
  trackColor?: string;
  /** 环内内容 */
  children?: ReactNode;
  className?: string;
}

/**
 * 小型环形进度条：围绕中心内容渲染一圈进度环。
 * 渐变描边，进度变化平滑过渡。
 */
export default function RingProgress({
  percent,
  size = 44,
  strokeWidth = 3,
  color = "var(--accent)",
  colorTo,
  trackColor = "color-mix(in srgb, var(--foreground) 12%, transparent)",
  children,
  className,
}: RingProgressProps) {
  // useId 含冒号，url(#...) 引用前需清洗
  const gradientId = useId().replace(/:/g, "");
  const clamped = Math.max(0, Math.min(100, percent));
  // 半径向内收 0.75px，避免描边/圆角端点在 SVG 边缘被裁切
  const radius = (size - strokeWidth) / 2 - 0.75;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);
  const endColor = colorTo ?? color;
  const center = size / 2;
  const ease = "cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <span
      className={`relative inline-flex items-center justify-center ${className ?? ""}`}
      style={{ width: size, height: size }}
    >
      <svg
        className="absolute inset-0 -rotate-90"
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
      >
        <defs>
          <linearGradient
            id={gradientId}
            x1="0%"
            x2="100%"
            y1="0%"
            y2="100%"
          >
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={endColor} />
          </linearGradient>
        </defs>
        {/* 轨道 */}
        <circle
          cx={center}
          cy={center}
          fill="none"
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {clamped > 0 && (
          <circle
            cx={center}
            cy={center}
            fill="none"
            r={radius}
            stroke={`url(#${gradientId})`}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            style={{ transition: `stroke-dashoffset 0.6s ${ease}` }}
          />
        )}
      </svg>
      <span className="relative z-[1] inline-flex items-center justify-center">
        {children}
      </span>
    </span>
  );
}
