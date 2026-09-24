import { createGlassWallpaperWorker } from "./glass-wallpaper-worker";

import {
  getGlassBlurPadding,
  getGlassBlurPx,
  glassConfig,
} from "@/config/glass";

type Wallpaper = {
  base: string;
  border: string;
  blurPx: number;
  // Keep the decoded resources alive for cached theme changes, including the
  // first CSS paint after an object URL is installed.
  decoded: HTMLImageElement[];
};
const images = new Map<string, Promise<HTMLImageElement>>();

type GlassThemeChange = { dark?: boolean; background?: string };
type ThemeRequest = { change: GlassThemeChange; commit: () => void };
type ThemeCoordinator = (
  change: GlassThemeChange,
  commit: () => void,
) => () => void;
const coordinators = new WeakMap<Document, ThemeCoordinator>();

/** Prepare matching glass textures before committing the page's theme.
 * The returned cleanup cancels this caller's still-pending request only.
 */
export function setGlassTheme(
  document: Document,
  change: GlassThemeChange,
  commit: () => void,
) {
  const coordinate = coordinators.get(document);

  if (coordinate) return coordinate(change, commit);
  commit();

  return () => {};
}

function decodeImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.decoding = "async";
    image.onload = () => {
      if (typeof image.decode === "function") {
        void image.decode().then(() => resolve(image), reject);
      } else resolve(image);
    };
    image.onerror = reject;
    image.src = url;
  });
}

function loadImage(url: string) {
  let pending = images.get(url);

  if (!pending) {
    pending = decodeImage(url).catch((error) => {
      images.delete(url);
      throw error;
    });
    images.set(url, pending);
  }

  return pending;
}

function canvasBlob(canvas: HTMLCanvasElement, lossy: boolean) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Cannot render glass wallpaper"));
      },
      lossy ? "image/jpeg" : "image/png",
      0.98,
    ),
  );
}

async function decodeWallpaper(base: Blob, border: Blob, blurPx: number) {
  const baseUrl = URL.createObjectURL(base);
  const borderUrl = URL.createObjectURL(border);

  try {
    const decoded = await Promise.all([
      decodeImage(baseUrl),
      decodeImage(borderUrl),
    ]);

    return { base: baseUrl, border: borderUrl, blurPx, decoded };
  } catch (error) {
    URL.revokeObjectURL(baseUrl);
    URL.revokeObjectURL(borderUrl);
    throw error;
  }
}

/** Neutral-gray noise tile used to dither smooth gradients. */
function ditherTile(document: Document) {
  const tile = document.createElement("canvas");
  const size = 128;

  tile.width = size;
  tile.height = size;
  const context = tile.getContext("2d")!;
  const pixels = context.createImageData(size, size);

  for (let i = 0; i < pixels.data.length; i += 4) {
    // ±3 levels around the overlay-neutral midpoint: invisible grain, yet
    // enough to decorrelate 8-bit gradient steps the saturate filters would
    // otherwise stretch into visible bands.
    const value = 128 + Math.round((Math.random() * 2 - 1) * 3);

    pixels.data[i] = value;
    pixels.data[i + 1] = value;
    pixels.data[i + 2] = value;
    pixels.data[i + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);

  return tile;
}

/** One shared, viewport-sized wallpaper blur; never captures page content. */
export function createGlassWallpaperCache(document: Document) {
  const view = document.defaultView!;
  const root = document.documentElement;
  const cache = new Map<string, Wallpaper>();
  const requests = new Set<ThemeRequest>();
  let requestedKey = "";
  let activeKey = "";
  let activeBlurPx: number | undefined;
  let timer = 0;
  let disposed = false;
  let warmupFrame = 0;
  let warmupIdle = 0;
  let warmupTimer = 0;
  let canUseWorker = true;

  type Job = {
    key: string;
    cancelled: boolean;
    foreground: boolean;
    worker?: ReturnType<typeof createGlassWallpaperWorker>;
  };
  let activeJob: Job | undefined;

  async function render(
    width: number,
    height: number,
    scale: number,
    dark: boolean,
    photo: boolean,
    blurPx: number,
    blurPadding: number,
    job: Job,
  ): Promise<Wallpaper | undefined> {
    // Do not allocate full-size drawing buffers while a photo is loading, and
    // do not start convolution if a newer request has superseded this one.
    const image = photo
      ? await loadImage(`/images/bg01_${dark ? "dark" : "light"}.jpeg`)
      : undefined;

    if (disposed || job.cancelled) return;
    const buffers: HTMLCanvasElement[] = [];
    const canvas = () => {
      const buffer = document.createElement("canvas");

      buffers.push(buffer);

      return buffer;
    };

    try {
      const source = canvas();

      source.width = Math.ceil(width * scale);
      source.height = Math.ceil(height * scale);
      const context = source.getContext("2d");

      if (!context || !("filter" in context)) return;

      context.scale(scale, scale);

      if (image) {
        const ratio = Math.max(width / image.width, height / image.height);

        context.drawImage(
          image,
          (width - image.width * ratio) / 2,
          (height - image.height * ratio) / 2,
          image.width * ratio,
          image.height * ratio,
        );
        const tint = context.createLinearGradient(0, 0, 0, height);

        tint.addColorStop(
          0,
          dark ? "rgb(5 10 24 / 0.16)" : "rgb(255 255 255 / 0.04)",
        );
        tint.addColorStop(
          1,
          dark ? "rgb(5 10 24 / 0.32)" : "rgb(255 255 255 / 0.12)",
        );
        context.fillStyle = tint;
        context.fillRect(0, 0, width, height);
      } else {
        const styles = view.getComputedStyle(root);
        const palette = `--glass-${dark ? "dark" : "light"}-ambient`;

        context.fillStyle = styles.getPropertyValue(`${palette}-base`).trim();
        context.fillRect(0, 0, width, height);
        const geometry = dark
          ? [
              [0.12, 0.18, 0.9, 0.85, 0.62],
              [0.78, 0.14, 0.8, 0.68, 0.58],
              [0.78, 0.82, 0.75, 0.72, 0.58],
              [0.18, 0.84, 0.68, 0.66, 0.58],
            ]
          : [
              [0.12, 0.18, 0.8, 0.75, 0.6],
              [0.78, 0.14, 0.7, 0.58, 0.58],
              [0.78, 0.82, 0.65, 0.62, 0.58],
              [0.18, 0.84, 0.58, 0.56, 0.58],
            ];

        for (let i = 3; i >= 0; i--) {
          const [cx, cy, rx, ry, stop] = geometry[i];

          context.save();
          context.translate(cx * width, cy * height);
          context.scale(rx * width, ry * height);
          const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);

          gradient.addColorStop(
            0,
            styles.getPropertyValue(`${palette}-${i + 1}`).trim(),
          );
          gradient.addColorStop(
            stop,
            styles
              .getPropertyValue(`${palette}-${i + 1}`)
              .trim()
              .replace(/\/[^)]+\)/, "/ 0)"),
          );
          context.fillStyle = gradient;
          context.fillRect(-2, -2, 4, 4);
          context.restore();
        }
      }

      // Repeat edge pixels before convolution, as in the modal source filter.
      const pad = Math.ceil(blurPadding * scale);
      const expanded = canvas();

      expanded.width = source.width + 2 * pad;
      expanded.height = source.height + 2 * pad;
      const input = expanded.getContext("2d")!;
      const w = source.width,
        h = source.height;

      input.drawImage(source, pad, pad);
      input.drawImage(source, 0, 0, w, 1, pad, 0, w, pad);
      input.drawImage(source, 0, h - 1, w, 1, pad, pad + h, w, pad);
      input.drawImage(source, 0, 0, 1, h, 0, pad, pad, h);
      input.drawImage(source, w - 1, 0, 1, h, pad + w, pad, pad, h);
      for (const [sx, sy, dx, dy] of [
        [0, 0, 0, 0],
        [w - 1, 0, w + pad, 0],
        [0, h - 1, 0, h + pad],
        [w - 1, h - 1, w + pad, h + pad],
      ]) {
        input.drawImage(source, sx, sy, 1, 1, dx, dy, pad, pad);
      }
      const base = canvas();

      base.width = w;
      base.height = h;
      const paint = base.getContext("2d")!;

      paint.filter = `blur(${blurPx * scale}px) saturate(${glassConfig.saturation}%)`;
      paint.drawImage(expanded, -pad, -pad);
      // Dither after the blur so its grain survives: 8-bit radial gradients
      // band, and the saturate filters widen those steps into visible bands.
      // Mid-gray noise under the overlay blend is neutral but breaks the steps.
      paint.globalCompositeOperation = "overlay";
      const tile = ditherTile(document);

      buffers.push(tile);
      paint.fillStyle = paint.createPattern(tile, "repeat")!;
      paint.fillRect(0, 0, w, h);
      paint.globalCompositeOperation = "source-over";
      const border = canvas();

      border.width = w;
      border.height = h;
      const rim = border.getContext("2d")!;

      rim.filter = `saturate(${glassConfig.borderSaturation}%) brightness(${glassConfig.borderBrightness})`;
      rim.drawImage(base, 0, 0);
      // Release drawing buffers promptly; only the completed image resources
      // survive between updates. Do not create URLs until both encodes succeed.
      source.width = 0;
      expanded.width = 0;
      const lossy = !glassConfig.losslessWallpaper && photo;
      const [baseBlob, borderBlob] = await Promise.all([
        canvasBlob(base, lossy),
        canvasBlob(border, lossy),
      ]).finally(() => {
        base.width = 0;
        border.width = 0;
      });

      if (!disposed && !job.cancelled)
        return decodeWallpaper(baseBlob, borderBlob, blurPx);
    } finally {
      for (const buffer of buffers) buffer.width = 0;
    }
  }

  function release(entry: Wallpaper) {
    URL.revokeObjectURL(entry.base);
    URL.revokeObjectURL(entry.border);
  }

  function publish(key: string, result: Wallpaper) {
    // Both textures are decoded before changing either CSS variable. Preserve
    // the last good wallpaper throughout a refresh instead of briefly enabling
    // the per-card CSS blur fallback.
    root.style.setProperty("--glass-cached-base", `url("${result.base}")`);
    root.style.setProperty("--glass-cached-border", `url("${result.border}")`);
    root.setAttribute("data-glass-wallpaper-ready", "");
    activeKey = key;
    activeBlurPx = result.blurPx;
    cache.delete(key);
    cache.set(key, result);
    schedulePrewarm();
  }

  function trim() {
    for (const [key, entry] of Array.from(cache)) {
      if (cache.size <= 2) break;
      if (key === activeKey) continue;
      cache.delete(key);
      release(entry);
    }
  }

  function getTarget(mode = root.dataset.glassMode) {
    const width = root.clientWidth;
    const height = view.innerHeight;
    const scale = view.devicePixelRatio;
    let dark = root.classList.contains("dark");
    let background = root.dataset.bgTheme;

    for (const { change } of Array.from(requests)) {
      dark = change.dark ?? dark;
      background = change.background ?? background;
    }
    const photo = background === "magnificent";
    const blurPx = getGlassBlurPx(mode);
    const blurPadding = getGlassBlurPadding(mode);
    const key = [width, height, scale, dark, photo, blurPx].join(",");

    return { width, height, scale, dark, photo, blurPx, blurPadding, key };
  }

  function cancelPreparation(keepKey?: string) {
    view.cancelAnimationFrame(warmupFrame);
    if (warmupIdle) view.cancelIdleCallback(warmupIdle);
    view.clearTimeout(warmupTimer);
    warmupFrame = warmupIdle = warmupTimer = 0;
    if (!activeJob || activeJob.key === keepKey) return;
    activeJob.cancelled = true;
    // Termination interrupts synchronous OffscreenCanvas work as well as an
    // encode in progress. A late bitmap/decode cannot populate the cache.
    activeJob.worker?.dispose();
    activeJob.worker = undefined;
    activeJob = undefined;
  }

  function schedulePrewarm() {
    if (disposed || !canUseWorker || activeJob) return;
    cancelPreparation();
    // The requested texture paints before speculative work is eligible. There
    // is exactly one render job, so foreground work never queues behind it.
    warmupFrame = view.requestAnimationFrame(() => {
      warmupFrame = 0;
      if (view.requestIdleCallback) {
        warmupIdle = view.requestIdleCallback(() => {
          warmupIdle = 0;
          prewarmOtherMode();
        });
      } else {
        warmupTimer = view.setTimeout(() => {
          warmupTimer = 0;
          prewarmOtherMode();
        }, 100);
      }
    });
  }

  async function prepare(target: ReturnType<typeof getTarget>, job: Job) {
    if (canUseWorker) {
      const renderer = createGlassWallpaperWorker();

      if (renderer) {
        job.worker = renderer;
        let blobs;

        try {
          const image = target.photo
            ? await loadImage(
                `/images/bg01_${target.dark ? "dark" : "light"}.jpeg`,
              )
            : undefined;

          if (disposed || job.cancelled) return;
          const styles = target.photo ? undefined : view.getComputedStyle(root);
          const palette = `--glass-${target.dark ? "dark" : "light"}-ambient`;

          blobs = await renderer.render(image, {
            ...target,
            saturation: glassConfig.saturation,
            borderSaturation: glassConfig.borderSaturation,
            borderBrightness: glassConfig.borderBrightness,
            losslessWallpaper: glassConfig.losslessWallpaper,
            ambient: styles
              ? {
                  base: styles.getPropertyValue(`${palette}-base`).trim(),
                  colors: [1, 2, 3, 4].map((index) =>
                    styles.getPropertyValue(`${palette}-${index}`).trim(),
                  ),
                }
              : undefined,
          });
        } catch {
          if (disposed || job.cancelled) return;
          // Unsupported worker filters/CSP/bitmap transfer must not prevent a
          // selected mode from loading. Retry only required work in Canvas.
          canUseWorker = false;
        } finally {
          if (job.worker === renderer) {
            renderer.dispose();
            job.worker = undefined;
          }
        }
        if (disposed || job.cancelled) return;
        if (blobs)
          return decodeWallpaper(blobs.base, blobs.border, target.blurPx);
      } else canUseWorker = false;
    }
    if (!job.foreground || disposed || job.cancelled) return;

    return render(
      target.width,
      target.height,
      target.scale,
      target.dark,
      target.photo,
      target.blurPx,
      target.blurPadding,
      job,
    );
  }

  function startJob(target: ReturnType<typeof getTarget>, foreground: boolean) {
    const job: Job = { key: target.key, cancelled: false, foreground };

    activeJob = job;
    void prepare(target, job)
      .then((result) => {
        if (disposed || job.cancelled) {
          if (result) release(result);

          return;
        }
        if (result) {
          cache.set(job.key, result);
          commitRequests(job.key, result);
          trim();
        } else if (job.foreground) commitRequests(job.key);
      })
      // Preserve the last good texture if encoding/decoding fails. Theme
      // controls still commit with the existing CSS source fallback.
      .catch(() => {
        if (disposed || job.cancelled) return;
        if (job.foreground) commitRequests(job.key);
        // A speculative decode failure must not start an endless idle retry
        // loop. A future foreground request still has the Canvas fallback.
        else canUseWorker = false;
      })
      .finally(() => {
        if (activeJob !== job) return;
        activeJob = undefined;
        if (!disposed && activeKey === getTarget().key) schedulePrewarm();
      });
  }

  function prewarmOtherMode() {
    if (disposed || !canUseWorker || activeJob || requests.size) return;
    const current = getTarget();

    // Liquid mode is only available with the photo background.
    if (
      !current.photo ||
      current.key !== activeKey ||
      !root.hasAttribute("data-glass-wallpaper-ready")
    )
      return;
    const alternate = getTarget(
      current.blurPx === glassConfig.liquidBlurPx ? "glass" : "liquid",
    );

    if (alternate.key === current.key || cache.has(alternate.key)) return;
    startJob(alternate, false);
  }

  function commitRequests(key: string, result?: Wallpaper) {
    if (disposed || key !== requestedKey) return;
    // Dimensions can change before the browser dispatches its resize event.
    // Recheck at commit time as well as when scheduling a render.
    if (key !== getTarget().key) {
      requestedKey = "";
      update();

      return;
    }
    const committing = Array.from(requests);

    requests.clear();
    // Root theme attributes and both already-decoded textures are installed in
    // one task: the browser cannot paint a new page theme with an old texture.
    for (const request of committing) request.commit();
    if (result) publish(key, result);
    else if (committing.length) {
      // Allocation/decode failure must not leave theme controls stuck. The
      // existing source fallback can still display the requested theme.
      root.removeAttribute("data-glass-wallpaper-ready");
      activeKey = "";
    }
  }

  function update() {
    if (disposed) return;
    const target = getTarget();
    const { blurPx, key } = target;

    // A new foreground request supersedes speculative work for another size,
    // theme, or mode. Selecting the in-flight prewarm itself reuses its task.
    if (key !== requestedKey) cancelPreparation(key);
    if (activeJob?.key === key) activeJob.foreground = true;

    // A mode change must use its own blur immediately. The CSS source fallback
    // already has the new radius while a matching texture renders and decodes.
    if (activeBlurPx !== blurPx)
      root.removeAttribute("data-glass-wallpaper-ready");

    // Other root classes (for example scrollbar state) do not change the
    // wallpaper. Mode changes reuse any matching in-flight preparation.
    if (
      key === requestedKey &&
      ((key === activeKey && !requests.size) || activeJob?.key === key)
    )
      return;
    requestedKey = key;
    const cached = cache.get(key);

    if (cached) {
      if (
        key !== activeKey ||
        requests.size ||
        !root.hasAttribute("data-glass-wallpaper-ready")
      )
        commitRequests(key, cached);

      return;
    }
    if (activeJob?.key === key) return;
    startJob(target, true);
  }

  const coordinate: ThemeCoordinator = (change, commit) => {
    if (!root.hasAttribute("data-glass-wallpaper-ready")) {
      commit();

      return () => {};
    }
    for (const existing of Array.from(requests)) {
      if (
        (change.dark !== undefined && existing.change.dark !== undefined) ||
        (change.background !== undefined &&
          existing.change.background !== undefined)
      )
        requests.delete(existing);
    }
    const request = { change, commit };

    requests.add(request);
    update();

    return () => {
      if (!requests.delete(request) || disposed) return;
      requestedKey = "";
      // React runs an old effect's cleanup immediately before its replacement.
      // Defer reconciliation so cancellation cannot commit an intermediate
      // combination of the remaining callers' theme requests.
      queueMicrotask(update);
    };
  };

  coordinators.set(document, coordinate);

  function resize() {
    cancelPreparation();
    requestedKey = "";
    view.clearTimeout(timer);
    timer = view.setTimeout(update, 100);
  }

  const observer = new MutationObserver(update);

  observer.observe(root, {
    attributes: true,
    attributeFilter: ["class", "data-bg-theme", "data-glass-mode"],
  });
  view.addEventListener("resize", resize);
  update();

  return () => {
    disposed = true;
    cancelPreparation();
    if (coordinators.get(document) === coordinate)
      coordinators.delete(document);
    // A route may remove the final glass surface while its theme provider stays
    // mounted. Its valid selection must still take effect without this cache.
    for (const request of Array.from(requests)) request.commit();
    requests.clear();
    view.clearTimeout(timer);
    observer.disconnect();
    view.removeEventListener("resize", resize);
    root.removeAttribute("data-glass-wallpaper-ready");
    root.style.removeProperty("--glass-cached-base");
    root.style.removeProperty("--glass-cached-border");
    for (const entry of Array.from(cache.values())) {
      release(entry);
    }
    cache.clear();
  };
}
