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
const { packLiquidGlassAtlas } = exports;
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
