"use client";

import { useMemo } from "react";

interface ConfettiBurstProps {
  /** 每次该值变化即触发一轮撒花；为 0 时不渲染 */
  fireKey: number;
}

const COLORS = [
  "var(--chart-1, #37bdf8)",
  "var(--chart-2, #f7768e)",
  "var(--chart-3, #a78bfa)",
  "var(--chart-4, #34d399)",
  "#fbbf24",
];

const PIECE_COUNT = 22;

/**
 * 撒花特效：绝对定位覆盖父卡片，纸屑向四周飞散并可溢出（父级需 overflow-visible）。
 * 通过 fireKey 变化重新挂载触发动画。
 */
export default function ConfettiBurst({ fireKey }: ConfettiBurstProps) {
  const pieces = useMemo(() => {
    return Array.from({ length: PIECE_COUNT }).map((_, i) => {
      const angle = (Math.PI * 2 * i) / PIECE_COUNT + Math.random() * 0.4;
      // 半径覆盖到卡片外约 50%
      const distance = 90 + Math.random() * 90;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance - 20;
      const rot = 240 + Math.random() * 360;
      const scale = 0.7 + Math.random() * 0.9;
      const delay = Math.random() * 0.08;

      return {
        color: COLORS[i % COLORS.length],
        style: {
          "--tx": `${tx.toFixed(1)}px`,
          "--ty": `${ty.toFixed(1)}px`,
          "--rot": `${rot.toFixed(0)}deg`,
          "--s": scale.toFixed(2),
          animationDelay: `${delay.toFixed(2)}s`,
        } as React.CSSProperties,
      };
    });
    // fireKey 变化时重算，保证每轮方向不同
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fireKey]);

  if (!fireKey) return null;

  return (
    <div
      key={fireKey}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 overflow-visible"
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="cl-confetti-piece"
          style={{ ...p.style, backgroundColor: p.color }}
        />
      ))}
    </div>
  );
}
