/** Scroll continuity regression with real learnwords fixtures on an isolated
 * production server; LIQUID_GLASS_BASE_URL defaults to :8093.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import {
  chooseMode,
  createContext,
  loadPlaywright,
  openFixture,
} from "./liquid-glass.browser.mjs";

async function checkWheelSync(page, target) {
  await page.evaluate((target) => {
    const host =
      target === "courses"
        ? document.querySelector("[data-glass-incremental-resize]")
        : document.querySelector("[data-glass-continuous-scroll]");
    const canvas = host.querySelector(".glass-warp > .liquid-glass-surface");
    const layer = canvas.parentElement;
    const originalCopy = CanvasRenderingContext2D.prototype.drawImage;
    const originalDraw = WebGL2RenderingContext.prototype.drawArraysInstanced;
    let painted = layer.getBoundingClientRect();
    let previousY = painted.y;
    let running = true;
    const probe = (window.__wheelGlassProbe = { phase: "normal", samples: [] });
    CanvasRenderingContext2D.prototype.drawImage = function (...args) {
      const result = originalCopy.apply(this, args);
      if (this.canvas === canvas) painted = layer.getBoundingClientRect();
      return result;
    };
    WebGL2RenderingContext.prototype.drawArraysInstanced = function (...args) {
      if (probe.phase === "pressure") {
        const start = performance.now();
        while (performance.now() - start < 12) {
          /* Force adaptive protection. */
        }
      }
      return originalDraw.apply(this, args);
    };
    const frame = () => {
      if (!running) return;
      const rect = layer.getBoundingClientRect();
      const moved = rect.y !== previousY;
      previousY = rect.y;
      const phase = probe.phase;
      // Observe after all rAF paints, including the controller's shared job.
      setTimeout(() => {
        if (!running || !moved) return;
        probe.samples.push({
          phase,
          error: Math.max(
            Math.abs(painted.x - rect.x),
            Math.abs(painted.y - rect.y),
          ),
          borderError:
            target === "courses"
              ? Math.abs(
                  parseFloat(
                    host.style.getPropertyValue("--liquid-glass-source-y"),
                  ) + rect.y,
                )
              : 0,
          sameCanvas: layer.querySelector(".liquid-glass-surface") === canvas,
          throttled: document.documentElement.hasAttribute(
            "data-liquid-glass-throttled",
          ),
        });
      }, 0);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    probe.stop = () => {
      running = false;
      CanvasRenderingContext2D.prototype.drawImage = originalCopy;
      WebGL2RenderingContext.prototype.drawArraysInstanced = originalDraw;
      return probe.samples;
    };
  }, target);
  let samples;
  try {
    await page.mouse.move(200, 400);
    for (const phase of ["normal", "pressure"]) {
      await page.evaluate(
        (phase) => (window.__wheelGlassProbe.phase = phase),
        phase,
      );
      for (let i = 0; i < 24; i++) {
        await page.mouse.wheel(
          0,
          (target === "courses" ? 20 : 8) * (i < 12 ? 1 : -1),
        );
        await page.waitForTimeout(30);
      }
    }
    await page.waitForTimeout(80);
  } finally {
    samples = await page.evaluate(() => window.__wheelGlassProbe.stop());
  }
  for (const phase of ["normal", "pressure"])
    assert.ok(
      samples.filter((sample) => sample.phase === phase).length >= 8,
      `Exercise moving wheel frames: ${phase}`,
    );
  assert.ok(
    samples.some((sample) => sample.throttled),
    "Wheel input exercises slow-frame protection",
  );
  assert.ok(
    samples.every((sample) => sample.sameCanvas),
    "Wheel input keeps the same glass canvas",
  );
  assert.ok(
    samples.every((sample) => sample.error === 0),
    `Glass samples match the card position in every moving wheel frame: ${JSON.stringify(samples.filter((sample) => sample.error !== 0))}`,
  );
  assert.ok(
    samples.every((sample) => sample.borderError === 0),
    "Moving borders sample the current background in the same frame",
  );
  return {
    movingFrames: samples.length,
    maxPositionError: Math.max(...samples.map((sample) => sample.error)),
  };
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
const results = [];
try {
  for (const profile of [
    {
      name: "desktop-dark",
      viewport: { width: 1440, height: 900 },
      dpr: 1,
      mobile: false,
    },
    {
      name: "mobile-light",
      viewport: { width: 390, height: 844 },
      dpr: 3,
      mobile: true,
    },
  ]) {
    const { context, requests } = await createContext(browser, profile);
    if (profile.mobile)
      await context.addInitScript(() => localStorage.setItem("theme", "light"));
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    try {
      await openFixture(page, "learnwords");
      await chooseMode(page, "liquid");
      for (const target of ["summary", "courses"]) {
        if (target === "courses") {
          await page
            .locator("[data-glass-incremental-resize]")
            .first()
            .evaluate((host) => {
              scrollTo({
                top: scrollY + host.getBoundingClientRect().top - 120,
                behavior: "instant",
              });
            });
          await page.waitForTimeout(500);
        }
        const result = await page.evaluate(async (target) => {
          const root = document.documentElement;
          const host =
            target === "courses"
              ? document.querySelector("[data-glass-incremental-resize]")
              : document;
          const canvas = host.querySelector(
            ".glass-warp > .liquid-glass-surface",
          );
          const offset = scrollY;
          const distance = target === "courses" ? 192 : 64;
          const layer = canvas.parentElement;
          const source = root.style.getPropertyValue("--glass-cached-base");
          const uploads = window.__liquidBench.uploads;
          let removed = 0;
          const observer = new MutationObserver((records) => {
            for (const record of records)
              for (const node of record.removedNodes)
                if (node === canvas) removed++;
          });
          observer.observe(layer, { childList: true });
          const samples = [];
          const frame = () => new Promise(requestAnimationFrame);
          const original = WebGL2RenderingContext.prototype.drawArraysInstanced;
          const sample = (phase) =>
            samples.push({
              phase,
              sameCanvas:
                layer.querySelector(".liquid-glass-surface") === canvas,
              throttled: root.hasAttribute("data-liquid-glass-throttled"),
              sourceUnchanged:
                root.style.getPropertyValue("--glass-cached-base") === source,
            });
          try {
            for (let i = 0; i < 24; i++) {
              scrollTo({
                top: offset + (i % 2 ? distance : 0),
                behavior: "instant",
              });
              await frame();
              sample("normal");
            }
            WebGL2RenderingContext.prototype.drawArraysInstanced = function (
              ...args
            ) {
              const start = performance.now();
              while (performance.now() - start < 12) {
                /* Test-only slow submission. */
              }
              return original.apply(this, args);
            };
            for (let i = 0; i < 36; i++) {
              scrollTo({
                top: offset + (i % 2 ? distance : 0),
                behavior: "instant",
              });
              await frame();
              sample("pressure");
            }
            WebGL2RenderingContext.prototype.drawArraysInstanced = original;
            await new Promise((resolve) => setTimeout(resolve, 120));
            sample("before-scroll-end");
            const pixels = canvas.toDataURL();
            await new Promise((resolve) => setTimeout(resolve, 300));
            sample("after-scroll-end");
            const draws = window.__liquidBench.draws;
            await new Promise((resolve) => setTimeout(resolve, 150));
            return {
              samples,
              removed,
              identicalSettledPixels: pixels === canvas.toDataURL(),
              uploads: window.__liquidBench.uploads - uploads,
              idleDraws: window.__liquidBench.draws - draws,
              ended: !root.hasAttribute("data-liquid-glass-throttled"),
            };
          } finally {
            WebGL2RenderingContext.prototype.drawArraysInstanced = original;
            observer.disconnect();
          }
        }, target);
        assert.ok(
          result.samples.some((sample) => sample.throttled),
          "Exercise real slow-frame protection",
        );
        assert.ok(
          result.samples.every((sample) => sample.sameCanvas),
          "Keep liquid glass visible in every sampled frame",
        );
        assert.ok(result.samples.every((sample) => sample.sourceUnchanged));
        assert.equal(
          result.removed,
          0,
          "Never replace the presented canvas when scrolling stops",
        );
        assert.equal(
          result.identicalSettledPixels,
          true,
          "Scroll end preserves the already painted pixels",
        );
        assert.equal(result.uploads, 0, "No wallpaper reload during scrolling");
        assert.equal(result.idleDraws, 0);
        assert.equal(result.ended, true);
        const wheel = await checkWheelSync(page, target);
        assert.deepEqual(errors, []);
        assert.deepEqual(requests.unknownAPI, []);
        assert.deepEqual(requests.blockedWrites, []);
        results.push({
          profile: profile.name,
          target,
          ...result,
          wheel,
          samples: result.samples.length,
        });
      }
    } finally {
      await context.close();
    }
  }
  console.log(JSON.stringify({ passed: true, results }, null, 2));
} finally {
  await browser.close();
}
