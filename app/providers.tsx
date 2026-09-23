"use client";

import * as React from "react";
import { Toast } from "@heroui/react";

import { setGlassTheme } from "@/lib/glass-wallpaper-cache";
import LiquidGlassRuntime from "@/components/common/liquid-glass-runtime";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: {
    attribute?: "class";
    defaultTheme?: "light" | "dark" | "system";
    enableSystem?: boolean;
  };
}

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: React.Dispatch<React.SetStateAction<Theme>>;
}

const STORAGE_KEY = "theme";
const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getStoredTheme(defaultTheme: Theme): Theme {
  if (typeof window === "undefined") return defaultTheme;

  const stored = localStorage.getItem(STORAGE_KEY);

  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : defaultTheme;
}

function applyTheme(resolved: ResolvedTheme) {
  return setGlassTheme(document, { dark: resolved === "dark" }, () => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
    document.documentElement.style.colorScheme = resolved;
  });
}

export function Providers({ children, themeProps }: ProvidersProps) {
  const defaultTheme = themeProps?.defaultTheme ?? "system";
  const enableSystem = themeProps?.enableSystem ?? true;
  const [theme, setThemeState] = React.useState<Theme>(() =>
    getStoredTheme(defaultTheme),
  );
  const [systemTheme, setSystemTheme] =
    React.useState<ResolvedTheme>(getSystemTheme);
  const resolvedTheme =
    theme === "system" ? (enableSystem ? systemTheme : "light") : theme;

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setSystemTheme(getSystemTheme());

    handleChange();
    media.addEventListener("change", handleChange);

    return () => media.removeEventListener("change", handleChange);
  }, []);

  // 窗口缩放结束后，把所有 .yinyinkuan 卡片的宽度和高度调整为整数，
  // 消除小数尺寸导致的暗色描边发虚：
  // - 宽度：缩放开始时先还原内联宽度让布局自然响应，结束 150ms 后
  //   统一向下取整（只收窄 ≤1px，不与相邻卡片重叠）
  // - 高度：用 padding-bottom 向上进位（不裁剪内容，Accordion 展开时
  //   高度可自然增长），ResizeObserver 在尺寸变化（含展开动画结束）后
  //   重新收敛；补偿未改变 border-box（stretch 非主导项）时回退并锁定
  React.useEffect(() => {
    const list = () =>
      Array.from(document.querySelectorAll<HTMLElement>(".yinyinkuan"));

    // 每个元素当前已补偿的 padding-bottom / 高度锁定值
    const appliedPb = new WeakMap<HTMLElement, number>();
    const latchH = new WeakMap<HTMLElement, number>();

    const clearWidths = () => {
      for (const el of list()) if (el.style.width) el.style.width = "";
    };

    const snapWidths = () => {
      const els = list();

      // 先全部还原，测出自然宽度（批量读，避免读写交替）
      for (const el of els) if (el.style.width) el.style.width = "";

      const widths = els.map((el) => el.getBoundingClientRect().width);

      els.forEach((el, i) => {
        const snapped = Math.floor(widths[i]);

        if (widths[i] - snapped > 0.01) el.style.width = `${snapped}px`;
      });
    };

    const snapHeights = () => {
      for (const el of list()) {
        const applied = appliedPb.get(el) ?? 0;
        const raw = el.getBoundingClientRect().height - applied;
        const latch = latchH.get(el) ?? 0;

        // 高度被外部（stretch 行）主导：高度不变时保持锁定不补偿
        if (latch > 0) {
          if (Math.abs(raw - latch) <= 0.01) continue;
          latchH.delete(el);
        }

        const next = Math.max(0, Math.ceil(raw - 1e-3) - raw);

        if (Math.abs(next - applied) <= 0.01) continue;

        el.style.paddingBottom = `${next}px`;

        // 写入后同步重测：border-box 没跟随变化则回退并锁定，避免振荡
        if (Math.abs(el.getBoundingClientRect().height - (raw + next)) > 0.01) {
          el.style.paddingBottom = "0px";
          appliedPb.set(el, 0);
          latchH.set(el, el.getBoundingClientRect().height);
        } else {
          appliedPb.set(el, next);
        }
      }
    };

    let widthTimer = 0;
    let heightTimer = 0;

    const scheduleWidths = () => {
      window.clearTimeout(widthTimer);
      widthTimer = window.setTimeout(snapWidths, 150);
    };
    const scheduleHeights = () => {
      window.clearTimeout(heightTimer);
      heightTimer = window.setTimeout(snapHeights, 50);
    };

    const onResize = () => {
      clearWidths();
      scheduleWidths();
      scheduleHeights();
    };

    snapWidths();
    snapHeights();
    window.addEventListener("resize", onResize);

    // 高度变化（Accordion 展开动画、内容增删）结束后重新收敛；
    // 自身写入 padding 引起的回调会因补偿值不变而不再写入，回环自动终止
    const resizeObserver = new ResizeObserver(scheduleHeights);
    const observeAll = () => {
      for (const el of list()) resizeObserver.observe(el);
    };

    observeAll();

    // 新挂载的卡片：补充观察并重新取整
    const mutationObserver = new MutationObserver((records) => {
      // Absolute liquid-glass canvases do not affect card dimensions. Avoid
      // remeasuring every card when the renderer culls or restores a surface.
      if (
        records.every(
          (record) =>
            record.target instanceof Element &&
            record.target.classList.contains("glass-warp") &&
            [
              ...Array.from(record.addedNodes),
              ...Array.from(record.removedNodes),
            ].every(
              (node) =>
                node instanceof Element &&
                node.classList.contains("liquid-glass-surface"),
            ),
        )
      )
        return;
      observeAll();
      scheduleWidths();
      scheduleHeights();
    });

    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(widthTimer);
      window.clearTimeout(heightTimer);
      window.removeEventListener("resize", onResize);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);

    return applyTheme(resolvedTheme);
  }, [resolvedTheme, theme]);

  const setTheme = React.useCallback<
    React.Dispatch<React.SetStateAction<Theme>>
  >((value) => {
    setThemeState((current) =>
      typeof value === "function" ? value(current) : value,
    );
  }, []);

  const value = React.useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [resolvedTheme, setTheme, theme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <LiquidGlassRuntime />
      {children}
      <Toast.Provider placement="top" />
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = React.use(ThemeContext);

  if (!value) {
    throw new Error("useTheme must be used inside Providers");
  }

  return value;
}
