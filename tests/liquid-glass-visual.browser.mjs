/** Pixel comparison against the pre-optimization renderer on the same GPU.
 * No application server or user data is needed. A deterministic detailed source
 * tests refraction, corners, clipping, dispersion and pixel-budget scaling.
 * Reuses complete card canvases through forward/reverse scrolling and checks
 * full-tile copy compositing clears pixels outside each new GPU crop.
 * LIQUID_VISUAL_BASE_REV defaults to the reviewed pre-optimization commit.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ts from "typescript";
import { loadPlaywright } from "./liquid-glass.browser.mjs";

const baseline =
  process.env.LIQUID_VISUAL_BASE_REV ??
  "2eb4e2053bfef93a81c6c175bc3e82b98ce35cbe";
const output =
  process.env.LIQUID_VISUAL_OUTPUT ??
  path.join(os.tmpdir(), "liquid-glass-visual-20260924");
const compile = (text) =>
  ts.transpileModule(text, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
const sources = {};
for (const version of ["before", "after"]) {
  sources[version] = {};
  for (const name of ["liquid-glass-geometry", "liquid-glass-renderer"]) {
    const filename = `lib/${name}.ts`;
    sources[version][name] = compile(
      version === "before"
        ? execFileSync("git", ["show", `${baseline}:${filename}`], {
            encoding: "utf8",
          })
        : readFileSync(filename, "utf8"),
    );
  }
}
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_EXECUTABLE ??
    (existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe")
      ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
      : undefined),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await mkdir(output, { recursive: true });
const report = {
  baseline,
  browser: browser.version(),
  cases: [],
  passed: false,
};
try {
  await page.setContent(
    '<body style="margin:0;background:#10131b;color:white;font:16px sans-serif"></body>',
  );
  const result = await page.evaluate(async (sources) => {
    const factories = {};
    for (const [version, modules] of Object.entries(sources)) {
      const geometry = {};
      new Function("exports", modules["liquid-glass-geometry"])(geometry);
      const renderer = {};
      new Function("exports", "require", modules["liquid-glass-renderer"])(
        renderer,
        (name) => {
          if (name === "./liquid-glass-geometry") return geometry;
          throw new Error(`Unexpected renderer dependency: ${name}`);
        },
      );
      factories[version] = renderer.createLiquidGlassRenderer;
    }
    const source = document.createElement("canvas");
    source.width = 1440;
    source.height = 900;
    const paint = source.getContext("2d");
    const gradient = paint.createLinearGradient(0, 0, 1440, 900);
    gradient.addColorStop(0, "#182139");
    gradient.addColorStop(0.45, "#7ead91");
    gradient.addColorStop(1, "#d9454a");
    paint.fillStyle = gradient;
    paint.fillRect(0, 0, 1440, 900);
    for (let y = 0; y < 900; y += 37) {
      paint.fillStyle = y % 74 ? "#ddbd67" : "#243c86";
      paint.fillRect(0, y, 1440, 5);
    }
    for (let x = 0; x < 1440; x += 53) {
      paint.fillStyle = x % 106 ? "#dfb6c7" : "#263347";
      paint.fillRect(x, 0, 3, 900);
    }
    const image = new Image();
    image.src = source.toDataURL();
    await image.decode();
    const baselineOptions = {
      maxDpr: 1,
      maxPixels: 1_500_000,
      edgeWidthPx: 20,
      edgeInsetPx: 1,
      refractionPx: 38,
      fresnelStrength: 0,
      dispersionPx: 1.25,
      bendPeak: 0.1,
      bendSharpness: 2.7,
      disableDispersion: false,
    };
    const results = [];
    const scenarios = [
      {
        name: "desktop",
        viewport: { width: 1440, height: 900, dpr: 1 },
        options: {},
      },
      {
        name: "mobile",
        viewport: { width: 390, height: 844, dpr: 3 },
        options: { maxPixels: 500_000, disableDispersion: true },
      },
      {
        name: "budget",
        viewport: { width: 1440, height: 900, dpr: 2 },
        options: { maxPixels: 300_000 },
      },
      {
        name: "fresnel",
        viewport: { width: 1440, height: 900, dpr: 1 },
        options: { fresnelStrength: 0.12 },
      },
    ];
    for (const scenario of scenarios) {
      const renderers = Object.fromEntries(
        Object.entries(factories).map(([version, factory]) => [
          version,
          factory(document, { ...baselineOptions, ...scenario.options }, () => {
            throw new Error("Context lost");
          }),
        ]),
      );
      for (const renderer of Object.values(renderers))
        renderer.setBackground(image);
      const cards = { before: new Map(), after: new Map() };
      const { width, height } = scenario.viewport;
      const positions = [0, 17.25, 97.5, 270, 510.75, 270, 97.5, 17.25, 0];
      for (const [frame, position] of positions.entries()) {
        const items = [
          {
            id: 1,
            x: -27.25,
            y: 15.5 - position,
            width: 307.5,
            height: 211.25,
            radius: 24,
          },
          {
            id: 2,
            x: width - 254.25,
            y: 64.25 - position,
            width: 310.5,
            height: 270.25,
            radius: 42,
          },
          {
            id: 3,
            x: 42.75,
            y: height - 130.5 - position,
            width: width - 70.5,
            height: 258.75,
            radius: 31,
          },
          {
            id: 4,
            x: 13.5,
            y: 260.25 - position,
            width: width - 35.25,
            height: 285.5,
            radius: 0,
          },
        ].filter((item) => item.y < height && item.y + item.height > 0);
        const snapshots = {};
        const copyPixels = {};
        const fragmentPixels = {};
        let clearedPixelsChecked = 0;
        let stalePixels = 0;
        for (const [version, renderer] of Object.entries(renderers)) {
          const output = document.createElement("canvas");
          output.width = width;
          output.height = height;
          const ctx = output.getContext("2d");
          const tiles = renderer.render(items, scenario.viewport);
          copyPixels[version] = 0;
          fragmentPixels[version] = 0;
          for (const tile of tiles) {
            const item = items.find((item) => item.id === tile.id);
            let card = cards[version].get(tile.id);
            if (!card) {
              card = document.createElement("canvas");
              cards[version].set(tile.id, card);
            }
            const fullWidth = tile.fullPixelWidth ?? tile.width;
            const fullHeight = tile.fullPixelHeight ?? tile.height;
            if (card.width !== fullWidth) card.width = fullWidth;
            if (card.height !== fullHeight) card.height = fullHeight;
            const copy = card.getContext("2d");
            if (frame === 0) {
              // A sentinel makes transparent clearing observable even before
              // this card has a previous rendered image.
              copy.fillStyle = "#ff00ff";
              copy.fillRect(0, 0, fullWidth, fullHeight);
            }
            const destination = tile.destinationPixels ?? {
              x: 0,
              y: 0,
              width: tile.width,
              height: tile.height,
            };
            copy.globalCompositeOperation = "copy";
            copy.drawImage(
              renderer.canvas,
              tile.x - destination.x,
              tile.y - destination.y,
              fullWidth,
              fullHeight,
              0,
              0,
              fullWidth,
              fullHeight,
            );
            if (version === "after") {
              const pixels = copy.getImageData(
                0,
                0,
                fullWidth,
                fullHeight,
              ).data;
              for (let y = 0; y < fullHeight; y++) {
                for (let x = 0; x < fullWidth; x++) {
                  if (
                    x >= destination.x &&
                    x < destination.x + destination.width &&
                    y >= destination.y &&
                    y < destination.y + destination.height
                  )
                    continue;
                  clearedPixelsChecked++;
                  if (pixels[(y * fullWidth + x) * 4 + 3] !== 0) stalePixels++;
                }
              }
            }
            // Match a canvas filling its original DOM card (CSS 100% x 100%).
            // Full-tile copying preserves the full-coverage Canvas fast path;
            // atlas clear leaves transparent pixels outside the GPU crop.
            ctx.drawImage(card, item.x, item.y, item.width, item.height);
            copyPixels[version] += fullWidth * fullHeight;
            fragmentPixels[version] += tile.width * tile.height;
          }
          snapshots[version] = {
            canvas: output,
            data: ctx.getImageData(0, 0, width, height).data,
          };
        }
        let sum = 0,
          max = 0,
          changed = 0,
          significant = 0;
        const a = snapshots.before.data,
          b = snapshots.after.data;
        for (let offset = 0; offset < a.length; offset += 4) {
          let pixel = 0;
          for (let c = 0; c < 4; c++) {
            const difference = Math.abs(a[offset + c] - b[offset + c]);
            sum += difference;
            pixel = Math.max(pixel, difference);
          }
          max = Math.max(max, pixel);
          if (pixel) changed++;
          if (pixel > 3) significant++;
        }
        const row = {
          name: `${scenario.name}/${frame}/${position}`,
          pixels: width * height,
          changedPixels: changed,
          maxChannelDifference: max,
          meanChannelDifference: sum / a.length,
          significantPercent: (100 * significant) / (width * height),
          copyPixels,
          fragmentPixels,
          clearedPixelsChecked,
          stalePixels,
        };
        results.push(row);
        if (scenario.name === "desktop" && position === 97.5) {
          for (const version of ["before", "after"]) {
            const label = document.createElement("div");
            label.textContent = version;
            document.body.append(label, snapshots[version].canvas);
          }
        }
      }
      for (const renderer of Object.values(renderers)) renderer.dispose();
    }
    return results;
  }, sources);
  report.cases = result;
  await page.screenshot({
    path: path.join(output, "before-after.png"),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  for (const row of result) {
    assert.ok(
      row.meanChannelDifference <= 0.15 && row.significantPercent <= 0.2,
      `${row.name}: mean=${row.meanChannelDifference}, >3=${row.significantPercent}%`,
    );
    assert.equal(
      row.copyPixels.after,
      row.copyPixels.before,
      `${row.name}: full-tile copying retains baseline pixel area`,
    );
    assert.ok(
      row.fragmentPixels.after <= row.fragmentPixels.before,
      `${row.name}: viewport clipping must not increase rasterized area`,
    );
    assert.equal(
      row.stalePixels,
      0,
      `${row.name}: cropped copies must clear old pixels`,
    );
  }
  report.passed = true;
} finally {
  await writeFile(
    path.join(output, "results.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  console.log(`Visual results: ${output}`);
}
