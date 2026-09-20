"use client";

import type { ComponentPropsWithRef, ReactNode, RefCallback } from "react";

import { Modal } from "@heroui/react";
import clsx from "clsx";
import { useCallback } from "react";
import { ModalOverlay } from "react-aria-components/Modal";
import { twMerge } from "tailwind-merge";

import GlassBorder, { GlassWarp } from "@/components/courselearn/glass-border";
import { registerGlassBackdrop } from "@/lib/glass-backdrop-stack";

type ModalContainerProps = ComponentPropsWithRef<typeof Modal.Container>;

/** 玻璃弹窗 Dialog 层默认类名（液态玻璃底 + 高光阴影） */
const GLASS_DIALOG_CLASS =
  "yinyinkuan cl-glass-idle p-0 app-glass-dialog ";

/** 玻璃弹窗内容区默认类名（奶白底色 + 圆角裁切 + 内边距） */
const GLASS_CONTENT_CLASS =
  "rounded-3xl relative z-[1] overflow-hidden p-5 !bg-white/[0.3] dark:!bg-black/[0.15]";

/**
 * The stationary pseudo-element paints the scrim. The mounted overlay stack
 * blurs the page's own paint; React Aria handles portals, dismissal, scroll
 * locking and the dialog's focus lifecycle.
 *
 * 液态玻璃弹窗：组件内部已渲染 Modal.Container / Modal.Dialog 与全部玻璃层
 * （GlassWarp、内容容器、GlassBorder），使用方只需控制开关并书写内容区。
 */
export default function ModalBackdrop({
  children,
  className,
  isDismissable = true,
  onClick,
  onPointerDown,
  ref,
  placement,
  size,
  scroll,
  containerClassName,
  dialogClassName,
  contentClassName,
  ...props
}: Omit<ComponentPropsWithRef<typeof ModalOverlay>, "children"> & {
  /** 弹窗内容区（玻璃层由组件内部渲染） */
  children?: ReactNode;
  /** 对齐方式，透传给 Modal.Container */
  placement?: ModalContainerProps["placement"];
  /** 尺寸，透传给 Modal.Container */
  size?: ModalContainerProps["size"];
  /** 滚动模式，透传给 Modal.Container */
  scroll?: ModalContainerProps["scroll"];
  /** 追加到 Modal.Container 的类名（如自定义宽度） */
  containerClassName?: string;
  /** 追加到 Modal.Dialog 的类名 */
  dialogClassName?: string;
  /** 追加到内容容器的类名（可覆盖默认内边距，如 p-2） */
  contentClassName?: string;
}) {
  const backdropRef = useCallback<RefCallback<HTMLDivElement>>(
    (element) => {
      if (!element) return;

      const unregister = registerGlassBackdrop(element);
      const refCleanup = typeof ref === "function" ? ref(element) : undefined;

      if (ref && typeof ref !== "function") ref.current = element;

      return () => {
        unregister();
        if (typeof refCleanup === "function") refCleanup();
        else if (typeof ref === "function") ref(null);
        else if (ref) ref.current = null;
      };
    },
    [ref],
  );

  return (
    <ModalOverlay
      {...props}
      ref={backdropRef}
      className={(renderProps) =>
        clsx(
          "app-modal-backdrop",
          typeof className === "function" ? className(renderProps) : className,
        )
      }
      data-slot="app-modal-backdrop"
      isDismissable={isDismissable}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(event);
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        // An ignored scrim click must not move focus to body, where the
        // dialog's Escape handler cannot receive keyboard events.
        if (!isDismissable && event.target === event.currentTarget) {
          event.preventDefault();
        }
      }}
    >
      <Modal.Container
        className={containerClassName}
        placement={placement}
        scroll={scroll}
        size={size}
      >
        <Modal.Dialog className={clsx(GLASS_DIALOG_CLASS, dialogClassName)}>
          <GlassWarp />

          <div className={twMerge(GLASS_CONTENT_CLASS, contentClassName)}>
            {children}
          </div>
          {/* 液态玻璃描边层（位于内容之上） */}
          <GlassBorder />
        </Modal.Dialog>
      </Modal.Container>
    </ModalOverlay>
  );
}
