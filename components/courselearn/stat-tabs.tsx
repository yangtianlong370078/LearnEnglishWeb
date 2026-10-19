"use client";

import type { LearnStatus } from "@/types/courselearn";

import { useEffect, useLayoutEffect, useRef } from "react";

import GlassCard from "@/components/common/glass-card";
interface StatTabsProps {
  active: LearnStatus;
  brs: number;
  wlj: number;
  yzw: number;
  /** 卡片飞入对应 Tab 后的数字徽章放大闪烁信号（key 变化触发重播） */
  pulse?: { zt: LearnStatus; key: number } | null;
  onChange: (zt: LearnStatus) => void;
}

const TABS: { zt: LearnStatus; label: string; key: "brs" | "wlj" | "yzw" }[] = [
  { zt: 1, label: "不认识", key: "brs" },
  { zt: 2, label: "学习中", key: "wlj" },
  { zt: 3, label: "已掌握", key: "yzw" },
];

/**
 * 三个居中状态 Tab（不认识 / 学习中 / 已掌握），带对应数量。
 * 选中背景是独立指示器：点击后从原选中位置平滑滑动到新位置。
 *
 * 动画走 FLIP + WAAPI transform：位置/尺寸瞬时就位（不经主线程过渡），
 * 再用 transform 从旧视觉位置补间到新位置。transform 动画由浏览器合成
 * 线程执行，数据加载等主线程繁忙时也不会卡顿。
 */
export default function StatTabs({
  active,
  brs,
  wlj,
  yzw,
  pulse,
  onChange,
}: StatTabsProps) {
  const counts = { brs, wlj, yzw };
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const badgeRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const pillRef = useRef<HTMLSpanElement>(null);
  /** 是否已完成首次测量（首次直接就位，不播放滑动动画） */
  const measuredRef = useRef(false);

  // 卡片飞抵对应 Tab 后：数字徽章放大闪烁。
  // 用 WAAPI 且仅 transform/opacity（合成线程属性）：该动画触发时正值
  // 列表 FLIP 补位窗口，主线程繁忙，CSS/filter 动画会丢帧到看不见。
  useEffect(() => {
    if (!pulse) return;
    const index = TABS.findIndex((t) => t.zt === pulse.zt);
    const badge = badgeRefs.current[index];

    if (!badge) return;
    badge.animate(
      [
        { transform: "scale(1)", opacity: 1 },
        { transform: "scale(1.5)", opacity: 0.65, offset: 0.35 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration: 550, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" },
    );
  }, [pulse]);

  // 选中项 / 数量（影响按钮宽度）变化时移动指示器；resize 时无动画归位
  useLayoutEffect(() => {
    const measure = (animate: boolean) => {
      const index = TABS.findIndex((t) => t.zt === active);
      const button = buttonRefs.current[index];
      const pill = pillRef.current;

      if (!button || !pill) return;

      if (animate && measuredRef.current) {
        // FLIP - First：记录指示器当前视觉位置（含进行中的动画）
        const prev = pill.getBoundingClientRect();
        const btnRect = button.getBoundingClientRect();

        // 取消未完成的动画，以当前视觉位置作为新补间的起点
        pill.getAnimations().forEach((a) => a.cancel());
        // Last：位置/尺寸瞬时就位（无过渡，不占用主线程帧）
        pill.style.left = `${button.offsetLeft}px`;
        pill.style.top = `${button.offsetTop}px`;
        pill.style.width = `${btnRect.width}px`;
        pill.style.height = `${btnRect.height}px`;

        // Invert & Play：从旧视觉位置/尺寸补间到新位置（合成线程动画）
        const dx = prev.left - btnRect.left;
        const dy = prev.top - btnRect.top;
        const sx = btnRect.width ? prev.width / btnRect.width : 1;
        const sy = btnRect.height ? prev.height / btnRect.height : 1;

        if (dx || dy || Math.abs(sx - 1) > 0.001 || Math.abs(sy - 1) > 0.001) {
          pill.animate(
            [
              {
                transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
              },
              { transform: "none" },
            ],
            { duration: 300, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" },
          );
        }
      } else {
        // 首次测量 / 窗口尺寸变化：直接就位，不播放动画
        pill.style.left = `${button.offsetLeft}px`;
        pill.style.top = `${button.offsetTop}px`;
        pill.style.width = `${button.offsetWidth}px`;
        pill.style.height = `${button.offsetHeight}px`;
        pill.getAnimations().forEach((a) => a.cancel());
      }
      pill.style.visibility = "visible";
      measuredRef.current = true;
    };

    measure(true);
    const onResize = () => measure(false);

    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, [active, brs, wlj, yzw]);

  return (
    <div className="flex justify-center">
      <GlassCard className="flex flex-row p-2 rounded-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* 选中态滑动指示器：位于按钮文字之下、玻璃层之上；
            origin-top-left 保证 scale 补间以左上角为基准对齐旧位置 */}
        <span
          ref={pillRef}
          aria-hidden="true"
          className="invisible absolute left-0 top-0 origin-top-left rounded-full bg-white shadow-md shadow-black/[0.06] will-change-transform dark:bg-white/15 dark:shadow-black/20"
        />
        {TABS.map((tab, i) => {
          const isActive = active === tab.zt;

          return (
            <button
              key={tab.zt}
              ref={(el) => {
                buttonRefs.current[i] = el;
              }}
              aria-pressed={isActive}
              data-stat-tab={tab.zt}
              className={`inline-flex relative z-[1] shrink-0 items-center gap-2 whitespace-nowrap rounded-full pl-3 pr-2 py-2 text-sm font-medium transition-colors duration-300 ${
                isActive
                  ? "text-foreground"
                  : "text-muted hover:bg-white/40 hover:text-foreground dark:hover:bg-white/5"
              }`}
              type="button"
              onClick={() => onChange(tab.zt)}
            >
              {tab.label}
              <span
                ref={(el) => {
                  badgeRefs.current[i] = el;
                }}
                className={`inline-flex min-w-[22px] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums transition-colors duration-300 ${
                  isActive
                    ? "bg-accent text-accent-foreground shadow-sm shadow-accent/40"
                    : "bg-black/5 text-muted dark:bg-white/10"
                }`}
              >
                {counts[tab.key].toLocaleString()}
              </span>
            </button>
          );
        })}
      </GlassCard>
    </div>
  );
}
