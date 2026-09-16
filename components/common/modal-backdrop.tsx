"use client";

import type { ComponentPropsWithRef, RefCallback } from "react";

import clsx from "clsx";
import { useCallback } from "react";
import { ModalOverlay } from "react-aria-components/Modal";

import { registerGlassBackdrop } from "@/lib/glass-backdrop-stack";

type ModalBackdropProps = ComponentPropsWithRef<typeof ModalOverlay>;

/**
 * The stationary pseudo-element paints the scrim. The mounted overlay stack
 * blurs the page's own paint; React Aria handles portals, dismissal, scroll
 * locking and the dialog's focus lifecycle.
 */
export default function ModalBackdrop({
  className,
  isDismissable = true,
  onClick,
  onPointerDown,
  ref,
  ...props
}: ModalBackdropProps) {
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
    />
  );
}
