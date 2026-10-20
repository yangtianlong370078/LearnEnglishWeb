import type {
  LiquidGlassItem,
  LiquidGlassRenderer,
  LiquidGlassViewport,
} from "./liquid-glass-renderer";

type Options = {
  maxDpr: number;
  maxPixels: number;
  edgeWidthPx: number;
  edgeInsetPx: number;
};

/** A viewport-sized backing store, never stretched to an accordion's height.
 * Height changes replace only the old bottom lens and the newly revealed rows.
 * Scrolling / source changes still repaint the visible wallpaper normally.
 */
export function createLiquidGlassResizeSurface(
  document: Document,
  layer: HTMLElement,
  renderer: LiquidGlassRenderer,
  options: Options,
) {
  const host = layer.parentElement;
  let canvas: HTMLCanvasElement | undefined;
  let context: CanvasRenderingContext2D | undefined;
  let previous: LiquidGlassItem | undefined;
  let previousViewport = "";
  let previousOrigin = 0;
  let previousScale = 0;

  function release(buffer: HTMLCanvasElement) {
    buffer.remove();
    buffer.width = buffer.height = 0;
  }

  return {
    update(item: LiquidGlassItem, viewport: LiquidGlassViewport) {
      // Sample the border wallpaper with explicit local offsets. Chromium's
      // fixed-background cache can otherwise reuse a stale rim after resizing
      // or offscreen re-entry, even when the retained liquid pixels are stable.
      if (!previous || previous.x !== item.x)
        host?.style.setProperty("--liquid-glass-source-x", `${-item.x}px`);
      if (!previous || previous.y !== item.y)
        host?.style.setProperty("--liquid-glass-source-y", `${-item.y}px`);
      // Reserve visible rows plus scroll overscan, independent of list length.
      // Round the scale once per viewport / width, never as height animates.
      const capacity = viewport.height + 64;
      const budgetScale = Math.sqrt(
        options.maxPixels / ((item.width + 2) * (capacity + 2)),
      );
      const scale = Math.min(
        viewport.dpr,
        options.maxDpr,
        Math.max(1 / 16, Math.floor(budgetScale * 16) / 16),
        budgetScale,
      );
      const width = Math.max(1, Math.ceil(item.width * scale));
      const height = Math.max(1, Math.floor(capacity * scale));
      const origin = Math.max(0, Math.floor(-item.y / 32) * 32 - 32);
      const viewportKey = `${viewport.width},${viewport.height},${viewport.dpr}`;
      const old = canvas;
      const allocate =
        !canvas ||
        canvas.width !== width ||
        canvas.height !== height ||
        previousScale !== scale;
      let target = canvas;
      let targetContext = context;

      if (allocate) {
        target = document.createElement("canvas");
        targetContext = target.getContext("2d") ?? undefined;
        if (!targetContext) throw new Error("Liquid glass canvas unavailable");
        target.className = "liquid-glass-surface";
        target.setAttribute("aria-hidden", "true");
        target.width = width;
        target.height = height;
        target.style.width = `${width / scale}px`;
        target.style.height = `${height / scale}px`;
      }

      const last = previous;
      const heightOnly =
        !allocate &&
        last !== undefined &&
        last.x === item.x &&
        last.y === item.y &&
        last.width === item.width &&
        last.radius === item.radius &&
        previousViewport === viewportKey &&
        previousOrigin === origin &&
        previousScale === scale;

      if (heightOnly && last.height === item.height) return;
      // Rounded corners and the bottom lens must move with the actual edge.
      // Everything above this band is geometrically identical and stays intact.
      const band =
        Math.max(item.radius, options.edgeInsetPx + options.edgeWidthPx + 1) +
        2 / scale;
      const top = Math.max(
        origin,
        heightOnly
          ? Math.floor((Math.min(last.height, item.height) - band) * scale) /
              scale
          : origin,
      );
      const bottom = Math.min(
        origin + height / scale,
        Math.ceil(item.height * scale) / scale,
      );

      if (bottom > top) {
        const region = {
          x: 0,
          y: top,
          width: width / scale,
          height: bottom - top,
        };
        const tile = renderer.render([item], { ...viewport, dpr: scale }, [
          region,
        ])[0];

        // Clear only the dirty rectangle (including transparent old edge pixels).
        // A full-canvas "copy" would also erase the unchanged, retained rows.
        const destinationY = Math.round((top - origin) * scale);
        const destinationHeight = Math.round((bottom - top) * scale);

        targetContext!.clearRect(0, destinationY, width, destinationHeight);
        targetContext!.drawImage(
          renderer.canvas,
          tile.x,
          tile.y,
          tile.width,
          tile.height,
          0,
          destinationY,
          width,
          destinationHeight,
        );
      }
      if (allocate || previousOrigin !== origin)
        target!.style.top = `${origin}px`;
      if (allocate) {
        layer.append(target!);
        host?.setAttribute("data-liquid-glass-resize-active", "");
        if (old) release(old);
        canvas = target;
        context = targetContext;
      }
      previous = item;
      previousViewport = viewportKey;
      previousOrigin = origin;
      previousScale = scale;
    },
    dispose() {
      if (canvas) release(canvas);
      host?.removeAttribute("data-liquid-glass-resize-active");
      host?.style.removeProperty("--liquid-glass-source-x");
      host?.style.removeProperty("--liquid-glass-source-y");
      canvas = undefined;
      context = undefined;
      previous = undefined;
    },
  };
}
