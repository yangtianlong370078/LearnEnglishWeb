import { createGlassWallpaperCache } from "./glass-wallpaper-cache";
import { cancelGlassFrame, scheduleGlassFrame } from "./glass-frame";

const controllers = new WeakMap<
  Document,
  ReturnType<typeof createController>
>();
const surfaceListeners = new WeakMap<Document, Set<() => void>>();

/** Notify navigation when React replaces surfaces without changing layout. */
export function subscribeGlassSurfaceChanges(
  document: Document,
  listener: () => void,
) {
  let listeners = surfaceListeners.get(document);

  if (!listeners) {
    listeners = new Set();
    surfaceListeners.set(document, listeners);
  }
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
    if (!listeners.size) surfaceListeners.delete(document);
  };
}

function notifySurfaceChanges(document: Document) {
  for (const listener of Array.from(surfaceListeners.get(document) ?? []))
    listener();
}

function createController(document: Document) {
  const view = document.defaultView!;
  const root = document.documentElement;
  const viewportProperties = [
    "--glass-viewport-width",
    "--glass-viewport-height",
  ];
  const previousViewport = viewportProperties.map((name) => ({
    name,
    value: root.style.getPropertyValue(name),
    priority: root.style.getPropertyPriority(name),
  }));
  const releaseWallpaper = createGlassWallpaperCache(document);
  const surfaces = new Map<HTMLElement, Set<HTMLElement>>();
  const borderRadii = new Map<HTMLElement, string>();
  const pendingBorders = new Set<HTMLElement>();
  const visible = new WeakSet<HTMLElement>();
  const resize = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const layer = entry.target as HTMLElement;

      if (borderRadii.has(layer)) pendingBorders.add(layer);
    }
    schedule();
  });
  const intersection = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const host = entry.target as HTMLElement;

        if (entry.isIntersecting) {
          visible.add(host);
          // A surface re-entering without scrolling (accordion collapse) can
          // reveal a stale fixed-wallpaper raster; refresh it once layout
          // settles. Scroll-driven entries debounce away until scrolling ends.
          scheduleRepaint();
        } else visible.delete(host);
        for (const layer of Array.from(surfaces.get(host) ?? []))
          layer.toggleAttribute("data-glass-visible", entry.isIntersecting);
      }
    },
    { rootMargin: "64px" },
  );
  let disposed = false;
  let viewport = "";

  // Pure layout shifts (accordion expand/collapse) move visible surfaces
  // without scrolling, and the browser may keep their fixed wallpaper raster
  // cached at the old viewport position. After layout settles, alternate a
  // sub-pixel background-position nudge so those layers repaint in place.
  let repaintTimer = 0;
  let repaintOdd = false;

  function repaintVisibleLayers() {
    repaintTimer = 0;
    if (disposed) return;
    repaintOdd = !repaintOdd;
    const nudge = repaintOdd ? "0.0156px" : "0px";

    for (const [host, layers] of Array.from(surfaces)) {
      if (!visible.has(host)) continue;
      for (const layer of Array.from(layers))
        layer.style.setProperty("--glass-repaint-nudge", nudge);
    }
  }

  function scheduleRepaint() {
    if (repaintTimer) view.clearTimeout(repaintTimer);
    repaintTimer = view.setTimeout(repaintVisibleLayers, 80);
  }

  // Accordion panels change the page height; scroll-driven repaints already
  // cover the rest, so body size is the only extra signal this cache needs.
  const layoutShift = new ResizeObserver(scheduleRepaint);

  layoutShift.observe(document.body);

  function measure() {
    const width = document.documentElement.clientWidth;
    const height = view.innerHeight;
    const radii = Array.from(pendingBorders, (layer) => {
      const styles = view.getComputedStyle(layer);
      const radius = parseFloat(styles.borderTopLeftRadius) || 0;
      // These absolute layers have no padding or border. Computed dimensions
      // remain in local CSS pixels even when an ancestor is scaled.
      const layerWidth = parseFloat(styles.width) || layer.clientWidth;
      const layerHeight = parseFloat(styles.height) || layer.clientHeight;
      const clamped = Math.max(
        0,
        Math.min(radius, layerWidth / 2, layerHeight / 2),
      );

      return { layer, value: `${clamped}px` };
    });

    pendingBorders.clear();

    return () => {
      if (disposed) return;
      if (`${width},${height}` !== viewport) {
        viewport = `${width},${height}`;
        root.style.setProperty("--glass-viewport-width", `${width}px`);
        root.style.setProperty("--glass-viewport-height", `${height}px`);
      }
      for (const { layer, value } of radii) {
        if (!borderRadii.has(layer) || borderRadii.get(layer) === value)
          continue;
        borderRadii.set(layer, value);
        layer.style.setProperty("--glass-border-radius", value);
      }
    };
  }

  function schedule() {
    scheduleGlassFrame(view, measure);
  }

  function resizeViewport() {
    // Responsive styles can change the radius without resizing a layer.
    for (const layer of Array.from(borderRadii.keys()))
      pendingBorders.add(layer);
    schedule();
  }

  // CSS fixes the source to the viewport. Only visibility changes toggle
  // layer caching; radius geometry is read only on registration or resize,
  // never on scrolling or pointer movement.
  view.addEventListener("resize", resizeViewport);

  return {
    add(layer: HTMLElement) {
      const host = layer.parentElement!;
      let surface = surfaces.get(host);

      if (!surface) {
        surface = new Set();
        surfaces.set(host, surface);
        intersection.observe(host);
      }
      surface.add(layer);
      if (layer.classList.contains("glass-border")) {
        borderRadii.set(layer, "");
        pendingBorders.add(layer);
        resize.observe(layer);
      }
      layer.toggleAttribute("data-glass-visible", visible.has(host));
      schedule();
      notifySurfaceChanges(document);

      return () => {
        surface.delete(layer);
        if (borderRadii.delete(layer)) {
          pendingBorders.delete(layer);
          resize.unobserve(layer);
          layer.style.removeProperty("--glass-border-radius");
        }
        if (!surface.size) {
          surfaces.delete(host);
          intersection.unobserve(host);
          visible.delete(host);
        }
        notifySurfaceChanges(document);
        if (!surfaces.size) {
          disposed = true;
          cancelGlassFrame(view, measure);
          view.clearTimeout(repaintTimer);
          layoutShift.disconnect();
          view.removeEventListener("resize", resizeViewport);
          resize.disconnect();
          pendingBorders.clear();
          intersection.disconnect();
          releaseWallpaper();
          for (const { name, value, priority } of previousViewport) {
            if (value) root.style.setProperty(name, value, priority);
            else root.style.removeProperty(name);
          }
          controllers.delete(document);
        }
      };
    },
  };
}

export function registerGlassSurface(layer: HTMLElement | null) {
  if (!layer) return;
  const document = layer.ownerDocument;
  let controller = controllers.get(document);

  if (!controller) {
    controller = createController(document);
    controllers.set(document, controller);
  }

  return controller.add(layer);
}
