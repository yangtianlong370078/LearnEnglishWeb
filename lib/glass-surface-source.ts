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
  let disposed = false;
  let viewport = "";

  function measure() {
    const width = document.documentElement.clientWidth;
    const height = view.innerHeight;

    return () => {
      if (disposed) return;
      if (`${width},${height}` !== viewport) {
        viewport = `${width},${height}`;
        root.style.setProperty("--glass-viewport-width", `${width}px`);
        root.style.setProperty("--glass-viewport-height", `${height}px`);
      }
    };
  }

  function schedule() {
    scheduleGlassFrame(view, measure);
  }

  // CSS fixes the source to the viewport; scrolling requires no per-card
  // measurements, style writes, or intersection/animation observation.
  view.addEventListener("resize", schedule);

  return {
    add(layer: HTMLElement) {
      const host = layer.parentElement!;
      let surface = surfaces.get(host);

      if (!surface) {
        surface = new Set();
        surfaces.set(host, surface);
      }
      surface.add(layer);
      schedule();
      notifySurfaceChanges(document);

      return () => {
        surface.delete(layer);
        if (!surface.size) {
          surfaces.delete(host);
        }
        notifySurfaceChanges(document);
        if (!surfaces.size) {
          disposed = true;
          cancelGlassFrame(view, measure);
          view.removeEventListener("resize", schedule);
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
