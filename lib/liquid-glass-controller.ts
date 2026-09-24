import type { LiquidGlassItem } from "./liquid-glass-renderer";

import { cancelGlassFrame, scheduleGlassFrame } from "./glass-frame";
import { subscribeGlassSurfaceChanges } from "./glass-surface-source";
import { createLiquidGlassRenderer } from "./liquid-glass-renderer";

import { liquidGlassConfig as config } from "@/config/liquid-glass";

type Surface = {
  id: number;
  layer: HTMLElement;
  radius: number;
  styleDirty: boolean;
  canvas?: HTMLCanvasElement;
  context?: CanvasRenderingContext2D;
};

// These surfaces intentionally sample a different source (login / page content).
const excluded = ".login-scene, .navbar-root, .cl-navbar, .modal__dialog";

/** Loaded ahead of hydration for a saved liquid preference. */
export function createLiquidGlassController(
  document: Document,
  onUnavailable: () => void,
) {
  const view = document.defaultView!;
  const root = document.documentElement;
  const mobile = view.matchMedia(
    `(max-width: ${config.mobileBreakpointPx}px), (pointer: coarse)`,
  );
  const budget = mobile.matches ? config.mobile : config.desktop;
  const renderer = createLiquidGlassRenderer(
    document,
    {
      ...budget,
      edgeWidthPx: config.edgeWidthPx,
      edgeInsetPx: config.edgeInsetPx,
      refractionPx: config.refractionPx,
      fresnelStrength: config.fresnelStrength,
      dispersionPx: config.dispersionPx,
      bendPeak: config.edgeBendPeak,
      bendSharpness: config.edgeBendSharpness,
      disableDispersion: mobile.matches
        ? config.disableDispersionMobile
        : config.disableDispersionDesktop,
    },
    () => queueMicrotask(fail),
  );
  const surfaces = new Map<HTMLElement, Surface>();
  const visible = new Set<HTMLElement>();
  const moving = new Map<Element, Set<string>>();
  const style = document.createElement("style");

  // Keep the canvas between ::before (wallpaper) and ::after (existing tint).
  // No stylesheet selectors or extra DOM layers exist in the other modes.
  style.textContent = `
    .liquid-glass-surface { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
    body[data-glass-modal-open] .liquid-glass-surface,
    [data-glass-navigation-active] > .glass-warp > .liquid-glass-surface { display: none; }
  `;
  document.head.append(style);
  let disposed = false;
  let sequence = 0;
  let hostsDirty = true;
  let sourceUrl = "";
  let sourceVersion = 0;
  let sourceReady = false;
  let pendingImage: HTMLImageElement | undefined;
  let previousSignature = "";
  let scrolling = false;
  let throttled = false;
  let slowFrames = 0;
  let previousFrame = 0;
  let scrollTimer = 0;

  const resize = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const surface = surfaces.get(entry.target as HTMLElement);

      if (surface) surface.styleDirty = true;
    }
    schedule();
  });
  const intersection = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const layer = entry.target as HTMLElement;

      if (entry.isIntersecting) {
        visible.add(layer);
        const surface = surfaces.get(layer);

        if (surface) surface.styleDirty = true;
      } else visible.delete(layer);
    }
    schedule();
  });

  function removeCanvas(surface: Surface) {
    if (!surface.canvas) return;
    surface.canvas.remove();
    surface.canvas.width = surface.canvas.height = 0;
    surface.canvas = undefined;
    surface.context = undefined;
  }

  function clear() {
    for (const surface of Array.from(surfaces.values())) removeCanvas(surface);
    previousSignature = "";
    if (root.getAttribute("data-liquid-glass-active") !== "0")
      root.setAttribute("data-liquid-glass-active", "0");
  }

  function collect() {
    const layers = new Set(
      Array.from(document.querySelectorAll<HTMLElement>(".glass-warp")).filter(
        (layer) => !layer.closest(excluded),
      ),
    );

    for (const [layer, surface] of Array.from(surfaces)) {
      if (layers.has(layer)) continue;
      removeCanvas(surface);
      surfaces.delete(layer);
      visible.delete(layer);
      intersection.unobserve(layer);
      resize.unobserve(layer);
    }
    for (const layer of Array.from(layers)) {
      if (surfaces.has(layer)) continue;
      surfaces.set(layer, {
        id: ++sequence,
        layer,
        radius: 0,
        styleDirty: true,
      });
      // The first render must not wait for IntersectionObserver delivery.
      // measure() still rejects offscreen and zero-size surfaces.
      visible.add(layer);
      intersection.observe(layer);
      resize.observe(layer);
    }
    hostsDirty = false;
  }

  function updateSource() {
    const value = root.hasAttribute("data-glass-wallpaper-ready")
      ? root.style.getPropertyValue("--glass-cached-base")
      : "";
    const url = value.match(/^url\(["']?(.*?)["']?\)$/)?.[1] ?? "";

    if (url === sourceUrl) return;
    sourceUrl = url;
    sourceReady = false;
    const version = ++sourceVersion;

    if (pendingImage) pendingImage.onload = pendingImage.onerror = null;
    clear();
    if (!url) return;
    const image = new Image();

    pendingImage = image;
    image.onload = () => {
      if (disposed || version !== sourceVersion) return;
      try {
        renderer.setBackground(image);
        sourceReady = true;
        pendingImage = undefined;
        schedule();
      } catch {
        fail();
      }
    };
    image.onerror = fail;
    image.src = url;
  }

  function measure() {
    if (disposed) return () => {};
    if (hostsDirty) collect();
    const start = view.performance.now();
    const viewport = {
      width: root.clientWidth,
      height: view.innerHeight,
      dpr: view.devicePixelRatio,
    };
    const items: LiquidGlassItem[] = [];

    for (const element of Array.from(moving.keys())) {
      if (!element.isConnected) moving.delete(element);
    }
    const suspended =
      !sourceReady ||
      document.hidden ||
      throttled ||
      moving.size > 0 ||
      document.body.hasAttribute("data-glass-modal-open");

    if (!suspended) {
      // IO selects candidates. All reads happen in the shared read phase,
      // never inside the scroll handler or interleaved with canvas writes.
      for (const layer of Array.from(visible)) {
        if (items.length >= budget.maxCards) break;
        const surface = surfaces.get(layer);

        if (!surface || !layer.isConnected) continue;
        const rect = layer.getBoundingClientRect();

        if (
          rect.width < 4 ||
          rect.height < 4 ||
          rect.right <= 0 ||
          rect.bottom <= 0 ||
          rect.left >= viewport.width ||
          rect.top >= viewport.height
        )
          continue;
        // Very large accordion backgrounds cost pixels with little benefit;
        // their child cards still qualify and the parent keeps ordinary glass.
        if (rect.width * rect.height > viewport.width * viewport.height * 1.5)
          continue;
        if (surface.styleDirty) {
          const computed = view.getComputedStyle(layer);

          surface.radius = parseFloat(computed.borderTopLeftRadius) || 0;
          surface.styleDirty = false;
        }
        items.push({
          id: surface.id,
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
          radius: Math.min(surface.radius, rect.width / 2, rect.height / 2),
        });
      }
    }

    return () => {
      if (disposed) return;
      if (suspended || !items.length) {
        clear();

        return;
      }
      const signature = JSON.stringify([viewport, sourceVersion, items]);

      if (signature === previousSignature) return;
      try {
        const tiles = renderer.render(items, viewport);
        const selected = new Map(tiles.map((tile) => [tile.id, tile]));

        // Copies stay in this task; preserveDrawingBuffer is deliberately off.
        for (const surface of Array.from(surfaces.values())) {
          const tile = selected.get(surface.id);

          if (!tile) {
            removeCanvas(surface);
            continue;
          }
          if (!surface.canvas) {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            if (!context) throw new Error("Liquid glass canvas unavailable");
            canvas.className = "liquid-glass-surface";
            canvas.setAttribute("aria-hidden", "true");
            surface.layer.append(canvas);
            surface.canvas = canvas;
            surface.context = context;
          }
          const canvas = surface.canvas;
          const context = surface.context!;

          if (canvas.width !== tile.width) canvas.width = tile.width;
          if (canvas.height !== tile.height) canvas.height = tile.height;
          context.globalCompositeOperation = "copy";
          context.drawImage(
            renderer.canvas,
            tile.x,
            tile.y,
            tile.width,
            tile.height,
            0,
            0,
            canvas.width,
            canvas.height,
          );
        }
        root.setAttribute("data-liquid-glass-active", String(tiles.length));
        previousSignature = signature;
        const elapsed = view.performance.now() - start;
        const interval = previousFrame ? start - previousFrame : 0;

        previousFrame = start;
        if (config.adaptive.enabled && scrolling) {
          const slow =
            elapsed > config.adaptive.workBudgetMs ||
            (interval > config.adaptive.slowFrameMs && interval < 250);

          slowFrames = slow ? slowFrames + 1 : 0;
          if (slowFrames >= config.adaptive.consecutiveSlowFrames) {
            throttled = true;
            root.setAttribute("data-liquid-glass-throttled", "");
            clear();
          }
        }
      } catch {
        fail();
      }
    };
  }

  function schedule() {
    if (!disposed) scheduleGlassFrame(view, measure);
  }

  function onScroll() {
    scrolling = true;
    view.clearTimeout(scrollTimer);
    scrollTimer = view.setTimeout(() => {
      scrolling = throttled = false;
      slowFrames = previousFrame = 0;
      root.removeAttribute("data-liquid-glass-throttled");
      schedule();
    }, config.adaptive.scrollEndDelayMs);
    if (!throttled) schedule();
  }

  function invalidateStyles() {
    for (const surface of Array.from(surfaces.values()))
      surface.styleDirty = true;
    previousSignature = "";
    schedule();
  }

  function motion(event: Event) {
    const element = event.target;

    if (!(element instanceof Element)) return;
    if (
      !element.closest(".glass-warp") &&
      !element.querySelector(".glass-warp")
    )
      return;
    let key: string;

    if (event instanceof TransitionEvent) {
      if (
        !/^(transform|translate|scale|width|height|max-height|grid-template-rows|top|left|margin.*)$/.test(
          event.propertyName,
        )
      )
        return;
      key = `transition:${event.propertyName}`;
    } else key = `animation:${(event as AnimationEvent).animationName}`;
    if (event.type === "transitionrun" || event.type === "animationstart") {
      const keys = moving.get(element) ?? new Set<string>();

      keys.add(key);
      moving.set(element, keys);
    } else {
      const keys = moving.get(element);

      keys?.delete(key);
      if (!keys?.size) moving.delete(element);
    }
    invalidateStyles();
  }

  const rootObserver = new MutationObserver((records) => {
    updateSource();
    if (records.some((record) => record.attributeName === "class"))
      invalidateStyles();
  });
  const overlayObserver = new MutationObserver(schedule);
  const unsubscribe = subscribeGlassSurfaceChanges(document, () => {
    hostsDirty = true;
    schedule();
  });
  const motionEvents = [
    "transitionrun",
    "transitionend",
    "transitioncancel",
    "animationstart",
    "animationend",
    "animationcancel",
  ];

  rootObserver.observe(root, {
    attributes: true,
    attributeFilter: ["style", "class", "data-glass-wallpaper-ready"],
  });
  overlayObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-glass-modal-open"],
  });
  resize.observe(document.body);
  view.addEventListener("scroll", onScroll, { passive: true, capture: true });
  view.addEventListener("resize", invalidateStyles);
  document.addEventListener("visibilitychange", schedule);
  for (const event of motionEvents)
    document.addEventListener(event, motion, true);
  // Rebuild with the mobile/desktop shader variant and budget when crossing.
  mobile.addEventListener("change", onDeviceChange);

  function onDeviceChange() {
    view.dispatchEvent(new Event("glass-mode-change"));
  }

  function fail() {
    if (disposed) return;
    dispose();
    onUnavailable();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    sourceVersion++;
    if (pendingImage) pendingImage.onload = pendingImage.onerror = null;
    pendingImage = undefined;
    cancelGlassFrame(view, measure);
    view.clearTimeout(scrollTimer);
    view.removeEventListener("scroll", onScroll, true);
    view.removeEventListener("resize", invalidateStyles);
    document.removeEventListener("visibilitychange", schedule);
    for (const event of motionEvents)
      document.removeEventListener(event, motion, true);
    mobile.removeEventListener("change", onDeviceChange);
    rootObserver.disconnect();
    overlayObserver.disconnect();
    intersection.disconnect();
    resize.disconnect();
    unsubscribe();
    clear();
    surfaces.clear();
    visible.clear();
    moving.clear();
    renderer.dispose();
    style.remove();
    root.removeAttribute("data-liquid-glass-active");
    root.removeAttribute("data-liquid-glass-throttled");
  }

  updateSource();
  schedule();

  return dispose;
}
