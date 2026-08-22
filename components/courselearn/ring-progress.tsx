"use client";

import type { ReactNode } from "react";

interface RingProgressProps {
  /** 百分比 0-100 */
  percent: number;
  /** 环直径（px） */
  size?: number;
  /** 环宽（px） */
  strokeWidth?: number;
  /** 进度颜色（激活态可传主题色） */
  color?: string;
  /** 轨道颜色 */
  trackColor?: string;
  /** 环内内容 */
  children?: ReactNode;
  className?: string;
}

/**
 * 小型环形进度条：围绕中心内容渲染一圈进度环。
 */
export default function RingProgress({
  percent,
  size = 44,
  strokeWidth = 3,
  color = "var(--accent)",
  trackColor = "color-mix(in srgb, var(--foreground) 14%, transparent)",
  children,
  className,
}: RingProgressProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);

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
        <circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {clamped > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            fill="none"
            r={radius}
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            strokeWidth={strokeWidth}
            style={{ transition: "stroke-dashoffset 0.4s ease" }}
          />
        )}
      </svg>
      <span className="relative z-[1] inline-flex items-center justify-center">
        {children}
      </span>
    </span>
  );
}
