import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const compiled = ts.transpileModule(
  readFileSync(
    new URL("../lib/liquid-glass-geometry.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;
const exports = {};

runInNewContext(compiled, { exports });
const { clipLiquidGlassTile, packLiquidGlassAtlas } = exports;
const card = (id, width, height) => ({
  id,
  x: 20,
  y: -40,
  width,
  height,
  radius: 18,
});

function assertValid(atlas, items, budget, maxDimension) {
  assert.ok(atlas.width <= maxDimension);
  assert.ok(atlas.height <= maxDimension);
  assert.ok(atlas.width * atlas.height <= budget);
  assert.deepEqual(
    Array.from(atlas.tiles, (tile) => tile.id),
    items.map((item) => item.id),
  );
  for (const tile of atlas.tiles) {
    assert.ok(tile.width >= 1 && tile.height >= 1);
    assert.ok(tile.x >= 1 && tile.y >= 1);
    assert.ok(tile.x + tile.width < atlas.width);
    assert.ok(tile.y + tile.height < atlas.height);
    for (const other of atlas.tiles) {
      if (tile === other) continue;
      assert.ok(
        tile.x + tile.width + 1 <= other.x ||
          other.x + other.width + 1 <= tile.x ||
          tile.y + tile.height + 1 <= other.y ||
          other.y + other.height + 1 <= tile.y,
        `Tiles ${tile.id} and ${other.id} must not share sampled pixels`,
      );
    }
  }
}

test("atlas keeps overlapping DOM cards in disjoint tiles and preserves IDs", () => {
  const items = [card(7, 320, 180), card(3, 640, 460), card(9, 320, 90)];
  const atlas = packLiquidGlassAtlas(items, 1.5, 2_000_000, 4096);

  assertValid(atlas, items, 2_000_000, 4096);
  assert.equal(atlas.tiles[0].width, 480);
  assert.equal(atlas.tiles[0].height, 270);
});

test("large and tall cards obey physical memory and texture dimension limits", () => {
  const items = [
    card(0, 1800, 12000),
    ...Array.from({ length: 11 }, (_, index) => card(index + 1, 600, 800)),
  ];
  const atlas = packLiquidGlassAtlas(items, 3, 786_432, 2048);

  assertValid(atlas, items, 786_432, 2048);
  assert.ok(atlas.tiles[0].height < 12000);
});

test("portrait and landscape allocations remain bounded across card sizes", () => {
  for (const maxDimension of [128, 1024, 4096]) {
    for (const count of [1, 8, 12]) {
      for (const scale of [0.75, 1, 2, 4]) {
        const items = Array.from({ length: count }, (_, index) =>
          card(index, 80 + ((index * 307) % 1900), 40 + ((index * 521) % 5000)),
        );
        const budget = Math.min(500_000, maxDimension * maxDimension);

        assertValid(
          packLiquidGlassAtlas(items, scale, budget, maxDimension),
          items,
          budget,
          maxDimension,
        );
      }
    }
  }
});

test("invalid geometry and impossible budgets fail for the glass fallback", () => {
  assert.throws(() => packLiquidGlassAtlas([card(1, 0, 100)], 1, 1000, 1024));
  assert.throws(() => packLiquidGlassAtlas([card(1, NaN, 100)], 1, 1000, 1024));
  assert.throws(() =>
    packLiquidGlassAtlas([card(1, 20, 100), card(1, 40, 100)], 1, 1000, 1024),
  );
  assert.throws(() => packLiquidGlassAtlas([card(1, 100, 100)], 1, 8, 1024));
  assert.throws(() => packLiquidGlassAtlas([card(1, 100, 100)], 0, 1000, 1024));
  assert.equal(packLiquidGlassAtlas([], 1, 1000, 1024).tiles.length, 0);
});

test("viewport clipping preserves the complete card pixel grid and overscans edges", () => {
  const item = { ...card(1, 301.25, 600.5), x: -30.3, y: -401.7 };
  const atlas = packLiquidGlassAtlas([item], 0.75, 200_000, 1024);
  const original = atlas.tiles[0];
  const viewport = { width: 250, height: 180 };
  const clipped = clipLiquidGlassTile(item, original, viewport);
  const destination = clipped.destination;

  assert.equal(clipped.fullWidth, item.width);
  assert.equal(clipped.fullHeight, item.height);
  assert.equal(clipped.fullPixelWidth, original.width);
  assert.equal(clipped.fullPixelHeight, original.height);
  assert.deepEqual({ ...clipped.destinationPixels }, {
    x: clipped.x - original.x,
    y: clipped.y - original.y,
    width: clipped.width,
    height: clipped.height,
  });
  assert.ok(Object.values(clipped.destinationPixels).every(Number.isInteger));
  assert.ok(clipped.width * clipped.height < original.width * original.height);
  assert.equal(
    destination.x * (original.width / item.width),
    clipped.x - original.x,
  );
  assert.equal(
    destination.y * (original.height / item.height),
    clipped.y - original.y,
  );
  assert.ok(
    Math.abs(
      destination.width - clipped.width * (item.width / original.width),
    ) < 1e-10,
  );
  assert.ok(
    Math.abs(
      destination.height - clipped.height * (item.height / original.height),
    ) < 1e-10,
  );
  // The viewport is entirely covered, with a source pixel for filtering.
  assert.ok(item.x + destination.x <= -item.width / original.width);
  assert.ok(item.y + destination.y <= -item.height / original.height);
  assert.ok(
    item.x + destination.x + destination.width >=
      viewport.width + item.width / original.width,
  );
  assert.ok(
    item.y + destination.y + destination.height >=
      viewport.height + item.height / original.height,
  );
  // Every cropped output pixel still samples the same full-card local point.
  for (const [axis, sourceAxis, dimension] of [
    ["x", "x", "width"],
    ["y", "y", "height"],
  ]) {
    for (const pixel of [0, 1, clipped[dimension] - 1]) {
      const oldLocal =
        ((clipped[sourceAxis] - original[sourceAxis] + pixel + 0.5) /
          original[dimension]) *
        item[dimension];
      const newLocal =
        destination[axis] +
        ((pixel + 0.5) / clipped[dimension]) * destination[dimension];

      assert.ok(Math.abs(oldLocal - newLocal) < 1e-10);
    }
  }
});

test("clipping leaves fully visible cards intact and excludes wholly invisible cards", () => {
  const item = { ...card(1, 320, 180), x: 10, y: 10 };
  const atlas = packLiquidGlassAtlas([item], 1, 200_000, 1024);
  const tile = atlas.tiles[0];
  const viewport = { width: 400, height: 300 };
  const clipped = clipLiquidGlassTile(item, tile, viewport);

  for (const field of ["id", "x", "y", "width", "height"])
    assert.equal(clipped[field], tile[field]);
  assert.deepEqual(
    { ...clipped.destination },
    {
      x: 0,
      y: 0,
      width: item.width,
      height: item.height,
    },
  );
  for (const position of [{ x: -320 }, { x: 400 }, { y: -180 }, { y: 300 }])
    assert.equal(
      clipLiquidGlassTile({ ...item, ...position }, tile, viewport),
      null,
    );
});

test("nearby scroll frames reuse crop geometry while complete canvas dimensions stay fixed", () => {
  const item = { ...card(1, 320, 500), x: 20, y: 0 };
  const tile = packLiquidGlassAtlas([item], 1, 200_000, 1024).tiles[0];
  const sizes = new Set();

  for (let y = -1; y >= -64; y--) {
    const clipped = clipLiquidGlassTile({ ...item, y }, tile, {
      width: 800,
      height: 600,
    });

    sizes.add(clipped.height);
    assert.ok(y + clipped.destination.y <= -1);
    assert.equal(clipped.destination.height / clipped.height, 1);
    assert.equal(clipped.fullPixelWidth, tile.width);
    assert.equal(clipped.fullPixelHeight, tile.height);
    assert.equal(clipped.destinationPixels.y, clipped.y - tile.y);
  }
  assert.equal(sizes.size, 2);
});
