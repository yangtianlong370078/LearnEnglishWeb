export type LiquidGlassItem = {
  id: number;
  /** Card bounds in CSS pixels, relative to the layout viewport. */
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
};

export type LiquidGlassTile = {
  id: number;
  /** Source rectangle in the shared canvas, in physical pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LiquidGlassVisibleTile = LiquidGlassTile & {
  /** Complete card size in CSS pixels; unchanged by viewport clipping. */
  fullWidth: number;
  fullHeight: number;
  /** Keep each card canvas at its complete atlas resolution while scrolling. */
  fullPixelWidth: number;
  fullPixelHeight: number;
  /** Exact destination pixel rectangle within that complete card canvas. */
  destinationPixels: { x: number; y: number; width: number; height: number };
  /** Destination within the complete card, in local CSS pixels. */
  destination: { x: number; y: number; width: number; height: number };
};

// Quantized overscan reuses crop geometry through nearby scroll frames.
const CLIP_STEP = 32;

/** Clip on the existing atlas pixel grid, preserving its sampling resolution.
 * A physical pixel of overscan keeps linear filtering away from the clipped
 * boundary; outward quantization reuses the crop through nearby scroll frames.
 * The complete card bounds still determine refraction and corners.
 */
export function clipLiquidGlassTile(
  item: LiquidGlassItem,
  tile: LiquidGlassTile,
  viewport: { width: number; height: number },
): LiquidGlassVisibleTile | null {
  if (
    item.x >= viewport.width ||
    item.y >= viewport.height ||
    item.x + item.width <= 0 ||
    item.y + item.height <= 0
  )
    return null;

  const scaleX = tile.width / item.width;
  const scaleY = tile.height / item.height;
  const left = Math.max(
    0,
    Math.floor((Math.floor(-item.x * scaleX) - 1) / CLIP_STEP) * CLIP_STEP,
  );
  const top = Math.max(
    0,
    Math.floor((Math.floor(-item.y * scaleY) - 1) / CLIP_STEP) * CLIP_STEP,
  );
  const right = Math.min(
    tile.width,
    Math.ceil((Math.ceil((viewport.width - item.x) * scaleX) + 1) / CLIP_STEP) *
      CLIP_STEP,
  );
  const bottom = Math.min(
    tile.height,
    Math.ceil(
      (Math.ceil((viewport.height - item.y) * scaleY) + 1) / CLIP_STEP,
    ) * CLIP_STEP,
  );

  return {
    id: tile.id,
    x: tile.x + left,
    y: tile.y + top,
    width: right - left,
    height: bottom - top,
    fullWidth: item.width,
    fullHeight: item.height,
    fullPixelWidth: tile.width,
    fullPixelHeight: tile.height,
    destinationPixels: {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    },
    destination: {
      x: left / scaleX,
      y: top / scaleY,
      width: (right - left) / scaleX,
      height: (bottom - top) / scaleY,
    },
  };
}

type Atlas = { width: number; height: number; tiles: LiquidGlassTile[] };

const GUTTER = 1;

function packAtScale(items: readonly LiquidGlassItem[], scale: number) {
  return items
    .map((item) => ({
      id: item.id,
      width: Math.max(1, Math.ceil(item.width * scale)),
      height: Math.max(1, Math.ceil(item.height * scale)),
    }))
    .sort((a, b) => b.height - a.height || b.width - a.width);
}

function shelves(
  sizes: ReturnType<typeof packAtScale>,
  targetWidth: number,
): Atlas {
  const tiles: LiquidGlassTile[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  let width = 1;

  for (const size of sizes) {
    const paddedWidth = size.width + GUTTER * 2;
    const paddedHeight = size.height + GUTTER * 2;

    if (x && x + paddedWidth > targetWidth) {
      y += rowHeight;
      x = 0;
      rowHeight = 0;
    }
    tiles.push({ ...size, x: x + GUTTER, y: y + GUTTER });
    x += paddedWidth;
    width = Math.max(width, x);
    rowHeight = Math.max(rowHeight, paddedHeight);
  }

  return { width, height: Math.max(1, y + rowHeight), tiles };
}

/** Pack disjoint card images, reducing resolution to enforce the GPU budget.
 * Sorting affects packing only; the returned tiles retain the caller's order.
 */
export function packLiquidGlassAtlas(
  items: readonly LiquidGlassItem[],
  requestedScale: number,
  maxPixels: number,
  maxDimension: number,
): Atlas {
  if (
    !Number.isFinite(requestedScale) ||
    requestedScale <= 0 ||
    !Number.isFinite(maxPixels) ||
    maxPixels < 1 ||
    !Number.isFinite(maxDimension) ||
    maxDimension < 1
  ) {
    throw new Error("Invalid liquid glass atlas budget");
  }
  if (!items.length) return { width: 1, height: 1, tiles: [] };

  const ids = new Set<number>();

  for (const item of items) {
    if (
      !Object.values(item).every(Number.isFinite) ||
      item.width <= 0 ||
      item.height <= 0 ||
      item.radius < 0 ||
      ids.has(item.id)
    ) {
      throw new Error("Invalid liquid glass card bounds");
    }
    ids.add(item.id);
  }
  // Each tile needs at least one pixel and its transparent sampling gutter.
  if (maxPixels < items.length * 9 || maxDimension < 3) {
    throw new Error("Liquid glass atlas budget is too small");
  }

  const dimension = Math.floor(maxDimension);
  let scale = requestedScale;

  for (let attempt = 0; attempt < 24; attempt++) {
    const sizes = packAtScale(items, scale);
    const largestWidth = Math.max(...sizes.map((size) => size.width + 2));
    const area = sizes.reduce(
      (total, size) => total + (size.width + 2) * (size.height + 2),
      0,
    );
    const preferredWidth = Math.sqrt(area);
    const candidates = [
      largestWidth,
      preferredWidth * 0.75,
      preferredWidth,
      preferredWidth * 1.5,
      preferredWidth * 2,
      dimension,
    ].map((width) => shelves(sizes, Math.min(dimension, Math.ceil(width))));
    const score = (atlas: Atlas) =>
      Math.max(
        (atlas.width * atlas.height) / maxPixels,
        (atlas.width / dimension) ** 2,
        (atlas.height / dimension) ** 2,
      );

    candidates.sort((a, b) => score(a) - score(b));
    const best = candidates[0];

    if (
      best.width <= dimension &&
      best.height <= dimension &&
      best.width * best.height <= maxPixels
    ) {
      const byId = new Map(best.tiles.map((tile) => [tile.id, tile]));

      return { ...best, tiles: items.map((item) => byId.get(item.id)!) };
    }
    // The margin also accounts for integer rounding and transparent gutters.
    scale *= Math.min(0.8, 0.95 / Math.sqrt(score(best)));
  }

  throw new Error("Cannot fit liquid glass cards within the GPU budget");
}
