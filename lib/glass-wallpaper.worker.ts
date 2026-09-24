import type {
  GlassWallpaperWorkerRequest,
  GlassWallpaperWorkerResponse,
  GlassWallpaperWorkerResult,
} from "./glass-wallpaper-worker";

// Keep worker globals local instead of adding the WebWorker lib to the whole
// application's DOM type environment.
const scope = self as unknown as {
  onmessage: (event: MessageEvent<GlassWallpaperWorkerRequest>) => void;
  postMessage: (response: GlassWallpaperWorkerResponse) => void;
};

function getContext(canvas: OffscreenCanvas) {
  const context = canvas.getContext("2d");

  if (!context || !("filter" in context))
    throw new Error("OffscreenCanvas filters are unavailable");

  return context;
}

/** Matches the visible cache's tint, padded blur, dither and border filters. */
async function render({
  image,
  width,
  height,
  scale,
  dark,
  blurPx,
  blurPadding,
  saturation,
  borderSaturation,
  borderBrightness,
  losslessWallpaper,
}: GlassWallpaperWorkerRequest): Promise<GlassWallpaperWorkerResult> {
  const buffers: OffscreenCanvas[] = [];
  const canvas = (w: number, h: number) => {
    const result = new OffscreenCanvas(w, h);

    buffers.push(result);

    return result;
  };

  try {
    const w = Math.ceil(width * scale);
    const h = Math.ceil(height * scale);
    const source = canvas(w, h);
    const context = getContext(source);

    context.scale(scale, scale);
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

    const pad = Math.ceil(blurPadding * scale);
    const expanded = canvas(w + 2 * pad, h + 2 * pad);
    const input = getContext(expanded);

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
    const base = canvas(w, h);
    const paint = getContext(base);

    paint.filter = `blur(${blurPx * scale}px) saturate(${saturation}%)`;
    paint.drawImage(expanded, -pad, -pad);

    const tileSize = 128;
    const tile = canvas(tileSize, tileSize);
    const noise = getContext(tile);
    const pixels = noise.createImageData(tileSize, tileSize);

    for (let i = 0; i < pixels.data.length; i += 4) {
      const value = 128 + Math.round((Math.random() * 2 - 1) * 3);

      pixels.data[i] = value;
      pixels.data[i + 1] = value;
      pixels.data[i + 2] = value;
      pixels.data[i + 3] = 255;
    }
    noise.putImageData(pixels, 0, 0);
    paint.globalCompositeOperation = "overlay";
    paint.fillStyle = paint.createPattern(tile, "repeat")!;
    paint.fillRect(0, 0, w, h);
    paint.globalCompositeOperation = "source-over";

    const border = canvas(w, h);
    const rim = getContext(border);

    rim.filter = `saturate(${borderSaturation}%) brightness(${borderBrightness})`;
    rim.drawImage(base, 0, 0);
    source.width = 0;
    expanded.width = 0;
    const encodeOptions = {
      type: losslessWallpaper ? "image/png" : "image/jpeg",
      quality: 0.98,
    };
    const [baseBlob, borderBlob] = await Promise.all([
      base.convertToBlob(encodeOptions),
      border.convertToBlob(encodeOptions),
    ]);

    return { base: baseBlob, border: borderBlob };
  } finally {
    image.close();
    for (const buffer of buffers) buffer.width = 0;
  }
}

scope.onmessage = ({ data }) => {
  void render(data).then(
    (result) => scope.postMessage({ id: data.id, ...result }),
    (error: unknown) =>
      scope.postMessage({
        id: data.id,
        error: error instanceof Error ? error.message : String(error),
      }),
  );
};
