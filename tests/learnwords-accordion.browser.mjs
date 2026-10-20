/** Run against an isolated server using LIQUID_GLASS_BASE_URL (default :8093).
 * Uses the existing fictional course fixtures; no real API calls are allowed.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import {
  chooseMode,
  counters,
  createContext,
  imageDifference,
  loadPlaywright,
  openFixture,
} from "./liquid-glass.browser.mjs";

async function checkCourseReentry(page) {
  // Keep both collapsed course sections visible, then perform every operation
  // without scrolling. The featured section moves solely through layout.
  await page.evaluate(() => {
    const mine = document.querySelector("[data-glass-incremental-resize]");
    window.scrollTo({
      top: window.scrollY + mine.getBoundingClientRect().top - 120,
      behavior: "instant",
    });
  });
  await page.waitForTimeout(800);
  const clip = await page.evaluate(() => {
    const featured = document.querySelectorAll(
      "[data-glass-incremental-resize]",
    )[1];
    const rect = featured.getBoundingClientRect();
    return {
      x: Math.floor(rect.left),
      y: Math.ceil(rect.top + 32),
      width: 4,
      height: Math.floor(rect.height - 64),
    };
  });
  const before = await page.screenshot({ clip });
  const result = await page.evaluate(async () => {
    const [mine, featured] = document.querySelectorAll(
      "[data-glass-incremental-resize]",
    );
    const trigger = mine.querySelector(".accordion__trigger");
    const border = featured.querySelector(":scope > .glass-border");
    const originalSetProperty = border.style.setProperty;
    const writes = [];
    const scrollY = window.scrollY;
    const uploads = window.__liquidBench.uploads;
    const cycles = [];
    border.style.setProperty = function (name, value, priority) {
      if (name === "--glass-repaint-nudge")
        writes.push({ previous: this.getPropertyValue(name), value });
      return originalSetProperty.call(this, name, value, priority);
    };
    try {
      for (let i = 0; i < 3; i++) {
        trigger.click();
        await new Promise((resolve) => setTimeout(resolve, 700));
        const offscreen = featured.getBoundingClientRect().top >= innerHeight;
        writes.length = 0;
        trigger.click();
        await new Promise((resolve) => setTimeout(resolve, 700));
        cycles.push({
          offscreen,
          returned: featured.getBoundingClientRect().bottom <= innerHeight,
          writes: [...writes],
          scrollY: window.scrollY,
          sourceY: parseFloat(
            featured.style.getPropertyValue("--liquid-glass-source-y"),
          ),
          y: featured.getBoundingClientRect().top,
        });
      }
    } finally {
      delete border.style.setProperty;
    }
    return { cycles, scrollY, uploads: window.__liquidBench.uploads - uploads };
  });
  for (const cycle of result.cycles) {
    assert.ok(
      cycle.offscreen,
      "My Courses pushes Featured Courses out of view",
    );
    assert.ok(cycle.returned, "Featured Courses returns after collapse");
    assert.equal(cycle.scrollY, result.scrollY, "Re-entry needs no scrolling");
    assert.equal(
      cycle.sourceY,
      -cycle.y,
      "Re-entry aligns the border wallpaper without scrolling",
    );
    for (const write of cycle.writes)
      assert.notEqual(
        write.value,
        write.previous,
        "Every repaint changes the actual border value",
      );
  }
  const difference = await imageDifference(
    before,
    await page.screenshot({ clip }),
  );
  assert.ok(
    difference.maxChannelDifference <= 3,
    `Returning border matches its initial wallpaper: ${JSON.stringify(difference)}`,
  );
  assert.equal(
    result.uploads,
    0,
    "Re-entry reuses the existing wallpaper texture",
  );
}

function trackCanvasPublication() {
  const state = (window.__accordionFrames = {
    visibleResizes: 0,
    partialPaints: 0,
  });
  for (const dimension of ["width", "height"]) {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLCanvasElement.prototype,
      dimension,
    );
    Object.defineProperty(HTMLCanvasElement.prototype, dimension, {
      ...descriptor,
      set(value) {
        if (this.isConnected && this.closest("[data-glass-incremental-resize]"))
          state.visibleResizes++;
        descriptor.set.call(this, value);
      },
    });
  }
  const clearRect = CanvasRenderingContext2D.prototype.clearRect;
  CanvasRenderingContext2D.prototype.clearRect = function (...args) {
    if (args[1] > 0 && this.canvas.closest("[data-glass-incremental-resize]"))
      state.partialPaints++;
    return clearRect.apply(this, args);
  };
}

async function checkRetainedPixels(page, category) {
  const trigger = page.getByRole("button", { name: new RegExp(category) });
  await trigger.evaluate((button) => {
    const host = button.closest("[data-glass-incremental-resize]");
    window.scrollTo({
      top: window.scrollY + host.getBoundingClientRect().top - 150,
      behavior: "instant",
    });
  });
  await page.waitForTimeout(600);
  const host = page
    .locator("[data-glass-incremental-resize]")
    .filter({ has: trigger });
  const box = await host.boundingBox();
  // Readback can switch Chromium's canvas backend. Warm it before taking
  // the visual baseline so the test itself cannot change compositing midway.
  await host.evaluate(async (host) => {
    const context = host
      .querySelector(":scope > .glass-warp > canvas")
      .getContext("2d");
    for (let i = 0; i < 3; i++) {
      context.getImageData(30, 1, 120, 20);
      await new Promise(requestAnimationFrame);
    }
  });
  const clip = {
    x: box.x + 40,
    y: box.y + 1,
    width: Math.min(800, box.width - 80),
    height: 22,
  };
  const before = await page.screenshot({ clip });
  const animationStyle = await page.addStyleTag({
    content:
      "[data-glass-incremental-resize] .accordion__panel { transition-duration: 1500ms !important; }",
  });
  const capture = trigger.evaluate(async (button) => {
    const host = button.closest("[data-glass-incremental-resize]");
    const canvas = host.querySelector(":scope > .glass-warp > canvas");
    const width = canvas.width,
      height = canvas.height;
    const getPixels = () =>
      canvas.getContext("2d").getImageData(30, 1, Math.min(120, width - 60), 20)
        .data;
    getPixels();
    await new Promise(requestAnimationFrame);
    const original = getPixels();
    let frames = 0,
      changedPixels = 0,
      missing = 0,
      canvasChanges = 0;
    const heights = new Set();
    const observer = new ResizeObserver(() => {
      frames++;
      heights.add(host.getBoundingClientRect().height);
      const current = host.querySelector(":scope > .glass-warp > canvas");
      if (!current) {
        missing++;
        return;
      }
      if (
        canvas !== current ||
        canvas.width !== width ||
        canvas.height !== height
      ) {
        canvasChanges++;
        return;
      }
      const pixels = getPixels();
      for (let i = 0; i < pixels.length; i++)
        if (pixels[i] !== original[i]) changedPixels++;
    });
    observer.observe(host);
    try {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 1800));
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 1800));
    } finally {
      observer.disconnect();
    }
    return {
      frames,
      heights: heights.size,
      changedPixels,
      missing,
      canvasChanges,
    };
  });
  const screenshots = [];
  for (let i = 0; i < 9; i++) {
    await page.waitForTimeout(260);
    screenshots.push(
      await imageDifference(before, await page.screenshot({ clip })),
    );
  }
  const samples = await capture;
  await animationStyle.evaluate((style) => style.remove());
  assert.ok(
    samples.heights > 3,
    "Measure pixels during actual height animation",
  );
  assert.equal(
    samples.changedPixels,
    0,
    "Retain original liquid pixels exactly during height animation",
  );
  assert.equal(
    samples.missing,
    0,
    "Liquid glass stays present throughout the animation",
  );
  assert.equal(
    samples.canvasChanges,
    0,
    "Keep the same canvas and backing dimensions",
  );
  for (const difference of screenshots)
    assert.ok(
      difference.maxChannelDifference <= 3,
      `Stationary edge remains visually stable: ${JSON.stringify(difference)}`,
    );
  return {
    ...samples,
    maximumScreenshotDelta: Math.max(
      ...screenshots.map((d) => d.maxChannelDifference),
    ),
  };
}

async function checkInterruptedAnimationAndScroll(page) {
  const host = page.locator("[data-glass-incremental-resize]").first();
  const trigger = host.locator(".accordion__trigger").first();
  await trigger.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  // Reverse the transition before completion, then leave the list expanded.
  await trigger.evaluate(async (button) => {
    for (let i = 0; i < 7; i++) {
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
  });
  await page.waitForTimeout(600);
  assert.equal(await trigger.getAttribute("aria-expanded"), "true");
  const snapshot = async () =>
    host.evaluate((host) => {
      const canvas = host.querySelector(":scope > .glass-warp > canvas");
      const rect = host.getBoundingClientRect();
      const scale = canvas.width / canvas.getBoundingClientRect().width;
      const origin = parseFloat(canvas.style.top) || 0;
      const top = Math.max(0, -rect.top);
      return {
        png: canvas.toDataURL(),
        region: {
          x: 0,
          y: Math.ceil((top - origin) * scale),
          width: canvas.width,
          height: Math.floor(
            (Math.min(rect.height, innerHeight - rect.top) - top) * scale,
          ),
        },
      };
    });
  for (const position of ["top", "bottom"]) {
    await host.evaluate((host, position) => {
      const rect = host.getBoundingClientRect();
      window.scrollTo({
        top:
          window.scrollY +
          (position === "top"
            ? rect.top - 120
            : rect.bottom - innerHeight + 60),
        behavior: "instant",
      });
    }, position);
    await page.waitForTimeout(500);
    const retained = await snapshot();
    // Rebuild a reference at the same position to detect stale side/bottom
    // pixels from interrupted transitions or newly visible viewport rows.
    await page.evaluate(() =>
      document.body.setAttribute("data-glass-modal-open", ""),
    );
    await page.waitForFunction(
      () => !document.querySelector(".liquid-glass-surface"),
    );
    await page.evaluate(() =>
      document.body.removeAttribute("data-glass-modal-open"),
    );
    await page.waitForTimeout(500);
    const fresh = await snapshot();
    const decode = (png) => Buffer.from(png.split(",")[1], "base64");
    const difference = await imageDifference(
      decode(retained.png),
      decode(fresh.png),
      [retained.region],
    );
    assert.ok(
      difference.maxChannelDifference <= 3,
      `Retained ${position} pixels match a fresh render: ${JSON.stringify(difference)}`,
    );
  }
  await trigger.evaluate((button) => button.click());
  await page.waitForTimeout(600);
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
      viewport: { width: 1440, height: 1000 },
      dpr: 1,
      mobile: false,
    },
    {
      name: "mobile-light",
      viewport: { width: 390, height: 844 },
      dpr: 2,
      mobile: true,
    },
  ]) {
    const { context, requests } = await createContext(browser, profile);
    await context.addInitScript(trackCanvasPublication);
    if (profile.mobile)
      await context.addInitScript(() => localStorage.setItem("theme", "light"));
    try {
      const page = await context.newPage();
      page.setDefaultNavigationTimeout(120_000);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await openFixture(page, "learnwords");
      await page
        .getByRole("button", { name: /测试自建分类/ })
        .evaluate((b) => b.click());
      await page.waitForTimeout(500);

      for (const mode of ["liquid", "glass", "card"]) {
        await chooseMode(page, mode);
        if (mode === "liquid") {
          await checkCourseReentry(page);
          for (const category of ["测试自建分类", "测试精选分类"])
            console.log(
              JSON.stringify({
                profile: profile.name,
                category,
                retainedPixels: await checkRetainedPixels(page, category),
              }),
            );
          await checkInterruptedAnimationAndScroll(page);
        }
        for (const category of ["测试自建分类", "测试精选分类"]) {
          const trigger = page.getByRole("button", {
            name: new RegExp(category),
          });
          await trigger.scrollIntoViewIfNeeded();
          await page.waitForTimeout(400);
          let animatedFrames = 0;
          for (const expanded of [true, false]) {
            const sample = await trigger.evaluate(async (button) => {
              const host = button.closest("[data-glass-incremental-resize]");
              const beforeHeight = host.getBoundingClientRect().height;
              const uploads = window.__liquidBench.uploads;
              button.click();
              const heights = [];
              const start = performance.now();
              while (performance.now() - start < 700) {
                await new Promise(requestAnimationFrame);
                heights.push(host.getBoundingClientRect().height);
              }
              const afterHeight = host.getBoundingClientRect().height;
              return {
                expanded: button.getAttribute("aria-expanded") === "true",
                uploads: window.__liquidBench.uploads - uploads,
                animatedFrames: heights.filter(
                  (height) =>
                    Math.abs(height - beforeHeight) > 1 &&
                    Math.abs(height - afterHeight) > 1,
                ).length,
              };
            });
            assert.equal(sample.expanded, expanded);
            assert.equal(
              sample.uploads,
              0,
              "Reuse the existing wallpaper texture",
            );
            animatedFrames += sample.animatedFrames;
            results.push({ profile: profile.name, mode, category, ...sample });
          }
          assert.ok(
            animatedFrames > 0,
            "Keep the expand/collapse height animation",
          );
        }
        if (mode === "liquid") {
          const frames = await page.evaluate(() => window.__accordionFrames);
          assert.equal(
            frames.visibleResizes,
            0,
            "Never clear a presented canvas by resizing it",
          );
          assert.ok(
            frames.partialPaints > 0,
            "Exercise actual partial bottom-band updates",
          );
          await page.waitForTimeout(700);
          const before = await counters(page);
          await page.waitForTimeout(500);
          const after = await counters(page);
          assert.equal(after.draws, before.draws, "No idle rendering loop");
          assert.equal(after.copies, before.copies, "No idle canvas copies");
        }
      }
      assert.deepEqual(errors, []);
      assert.deepEqual(requests.blockedWrites, []);
      assert.deepEqual(requests.unknownAPI, []);
    } finally {
      await context.close();
    }
  }
  console.log(JSON.stringify({ passed: results.length, results }, null, 2));
} finally {
  await browser.close();
}
