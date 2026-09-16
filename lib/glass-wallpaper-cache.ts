type Wallpaper = { base: string; border: string };
const images = new Map<string, Promise<HTMLImageElement>>();

function loadImage(url: string) {
  let pending = images.get(url);

  if (!pending) {
    pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = (error) => {
        images.delete(url);
        reject(error);
      };
      image.src = url;
    });
    images.set(url, pending);
  }

  return pending;
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Cannot render glass wallpaper"));
    }),
  );
}

/** One shared, viewport-sized wallpaper blur; never captures page content. */
export function createGlassWallpaperCache(document: Document) {
  const view = document.defaultView!;
  const root = document.documentElement;
  const cache = new Map<string, Wallpaper>();
  let generation = 0;
  let timer = 0;
  let disposed = false;

  async function update() {
    const version = ++generation;
    const width = root.clientWidth;
    const height = view.innerHeight;
    const scale = view.devicePixelRatio;
    const dark = root.classList.contains("dark");
    const photo = root.dataset.bgTheme === "magnificent";
    const key = [width, height, scale, dark, photo].join(",");
    let result = cache.get(key);

    if (!result) {
      const source = document.createElement("canvas");

      source.width = Math.ceil(width * scale);
      source.height = Math.ceil(height * scale);
      const context = source.getContext("2d")!;

      if (!("filter" in context)) return;

      context.scale(scale, scale);

      if (photo) {
        const image = await loadImage(
          `/images/bg01_${dark ? "dark" : "light"}.jpeg`,
        );

        if (disposed || version !== generation) return;
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

        context.fillStyle = styles
          .getPropertyValue("--glass-ambient-base")
          .trim();
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
            styles.getPropertyValue(`--glass-ambient-${i + 1}`).trim(),
          );
          gradient.addColorStop(
            stop,
            styles
              .getPropertyValue(`--glass-ambient-${i + 1}`)
              .trim()
              .replace(/\/[^)]+\)/, "/ 0)"),
          );
          context.fillStyle = gradient;
          context.fillRect(-2, -2, 4, 4);
          context.restore();
        }
      }

      // Repeat edge pixels before convolution, as in the modal source filter.
      const pad = Math.ceil(32 * scale);
      const expanded = document.createElement("canvas");

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
      const base = document.createElement("canvas");

      base.width = w;
      base.height = h;
      const paint = base.getContext("2d")!;

      paint.filter = `blur(${8 * scale}px) saturate(150%)`;
      paint.drawImage(expanded, -pad, -pad);
      const border = document.createElement("canvas");

      border.width = w;
      border.height = h;
      const rim = border.getContext("2d")!;

      rim.filter = "saturate(180%) brightness(1.5)";
      rim.drawImage(base, 0, 0);
      // Release the drawing buffers promptly; only the two encoded textures
      // survive between updates. Do not create URLs until both encodes succeed.
      source.width = 0;
      expanded.width = 0;
      const [baseBlob, borderBlob] = await Promise.all([
        canvasBlob(base),
        canvasBlob(border),
      ]).finally(() => {
        base.width = 0;
        border.width = 0;
      });
      const baseUrl = URL.createObjectURL(baseBlob);
      const borderUrl = URL.createObjectURL(borderBlob);

      result = { base: baseUrl, border: borderUrl };
      if (disposed || version !== generation) {
        URL.revokeObjectURL(baseUrl);
        URL.revokeObjectURL(borderUrl);

        return;
      }
      cache.set(key, result);
      if (cache.size > 2) {
        const oldest = cache.keys().next().value!;
        const entry = cache.get(oldest)!;

        URL.revokeObjectURL(entry.base);
        URL.revokeObjectURL(entry.border);
        cache.delete(oldest);
      }
    }
    if (disposed || version !== generation) return;
    root.style.setProperty("--glass-cached-base", `url("${result.base}")`);
    root.style.setProperty("--glass-cached-border", `url("${result.border}")`);
    root.setAttribute("data-glass-wallpaper-ready", "");
  }

  function schedule() {
    ++generation;
    root.removeAttribute("data-glass-wallpaper-ready");
    view.clearTimeout(timer);
    timer = view.setTimeout(() => {
      void update().catch(() => {});
    }, 100);
  }

  const observer = new MutationObserver(schedule);

  observer.observe(root, {
    attributes: true,
    attributeFilter: ["class", "data-bg-theme"],
  });
  view.addEventListener("resize", schedule);
  void update().catch(() => {});

  return () => {
    disposed = true;
    ++generation;
    view.clearTimeout(timer);
    observer.disconnect();
    view.removeEventListener("resize", schedule);
    root.removeAttribute("data-glass-wallpaper-ready");
    root.style.removeProperty("--glass-cached-base");
    root.style.removeProperty("--glass-cached-border");
    for (const entry of Array.from(cache.values())) {
      URL.revokeObjectURL(entry.base);
      URL.revokeObjectURL(entry.border);
    }
  };
}
