/** Paired liquid-glass optimization benchmark. Sequential runs only.
 * Baseline8094 / optimized8095; 3 counterbalanced rounds, PC/mobile emulation.
 * Use GLASS_OPT_ROUNDS/GLASS_OPT_PROFILES/GLASS_OPT_PAGES/GLASS_OPT_OUTPUT as needed.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const variants = [
  {
    name: "before",
    url: process.env.GLASS_OPT_BEFORE ?? "http://127.0.0.1:8094",
  },
  {
    name: "after",
    url: process.env.GLASS_OPT_AFTER ?? "http://127.0.0.1:8095",
  },
];
for (const variant of variants) {
  assert.notEqual(new URL(variant.url).port, "8090");
  process.env.LIQUID_GLASS_BASE_URL = variant.url;
  // This fixture module captures its origin at import time; distinct module
  // instances keep mocks and external-request blocking correct for each server.
  variant.fixture = await import(
    `./liquid-glass.browser.mjs?optimization=${variant.name}`
  );
}
const { loadPlaywright, counters } = variants[0].fixture;
const output =
  process.env.GLASS_OPT_OUTPUT ??
  "docs/glass-optimization-2026-09-24-performance.json";
const rounds = Number(process.env.GLASS_OPT_ROUNDS ?? 3);
const profiles = [
  {
    name: "desktop",
    viewport: { width: 1440, height: 900 },
    dpr: 1,
    mobile: false,
  },
  {
    name: "mobile",
    viewport: { width: 390, height: 844 },
    dpr: 2,
    mobile: true,
  },
].filter((profile) =>
  (process.env.GLASS_OPT_PROFILES ?? "desktop,mobile")
    .split(",")
    .includes(profile.name),
);
const routes = (process.env.GLASS_OPT_PAGES ?? "courselearn,learnwords").split(
  ",",
);

function instrument({ mode, currentBlurPx }) {
  localStorage.setItem("glass-mode", mode);
  const state = (window.__glassPerf = {
    started: performance.now(),
    firstVisibleMs: null,
    firstDataMs: null,
    wallpaperReadyMs: null,
    firstLiquidCanvasMs: null,
    firstLiquidCopyMs: null,
    prewarmReplyMs: null,
    currentReplyMs: null,
    prewarmDecodedMs: null,
    decodedBlobs: 0,
    workerJobs: [],
    workerReplies: [],
    currentDecodedMs: null,
    copyPixels: 0,
    copyCanvasPixels: 0,
    canvasResizes: 0,
    surfaceResizes: 0,
    mainThreadEncodes: 0,
    longtasks: [],
    startupDone: false,
  });
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        state.longtasks.push({
          start: entry.startTime,
          duration: entry.duration,
        });
    }).observe({ type: "longtask", buffered: true });
  } catch {}
  const originalDecode = HTMLImageElement.prototype.decode;
  HTMLImageElement.prototype.decode = async function (...args) {
    const result = await originalDecode.apply(this, args);
    if (this.src.startsWith("blob:")) {
      state.decodedBlobs++;
      if (state.decodedBlobs === 2) state.currentDecodedMs = performance.now();
      if (state.decodedBlobs === 4) state.prewarmDecodedMs = performance.now();
    }
    return result;
  };
  if (window.Worker) {
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(...args) {
        super(...args);
        this.addEventListener("message", (event) => {
          if (event.data?.base && event.data?.border) {
            const time = performance.now();
            const job = this.wallpaperJob;
            if (job?.kind === "current") state.currentReplyMs = time;
            else if (job?.kind === "alternate") state.prewarmReplyMs = time;
            state.workerReplies.push({
              time,
              id: event.data.id,
              blurPx: job?.blurPx,
              kind: job?.kind,
            });
          }
        });
      }
      postMessage(...args) {
        if (args[0]?.blurPx != null) {
          this.wallpaperJob = {
            blurPx: args[0].blurPx,
            kind: args[0].blurPx === currentBlurPx ? "current" : "alternate",
            start: performance.now(),
            ready: document.documentElement.hasAttribute(
              "data-glass-wallpaper-ready",
            ),
          };
          state.workerJobs.push(this.wallpaperJob);
        }
        return super.postMessage(...args);
      }
    };
  }
  const originalCopy = CanvasRenderingContext2D.prototype.drawImage;
  const originalEncode = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function (...args) {
    state.mainThreadEncodes++;
    return originalEncode.apply(this, args);
  };
  CanvasRenderingContext2D.prototype.drawImage = function (...args) {
    if (window.__liquidBench?.contexts.some((gl) => gl.canvas === args[0])) {
      const width =
        args.length === 9
          ? args[7]
          : args.length === 5
            ? args[3]
            : args[0].width;
      const height =
        args.length === 9
          ? args[8]
          : args.length === 5
            ? args[4]
            : args[0].height;
      state.copyPixels += width * height;
      state.copyCanvasPixels += this.canvas.width * this.canvas.height;
    }
    return originalCopy.apply(this, args);
  };
  for (const property of ["width", "height"]) {
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLCanvasElement.prototype,
      property,
    );
    Object.defineProperty(HTMLCanvasElement.prototype, property, {
      ...descriptor,
      set(value) {
        if (value !== descriptor.get.call(this)) {
          state.canvasResizes++;
          if (this.classList.contains("liquid-glass-surface"))
            state.surfaceResizes++;
        }
        descriptor.set.call(this, value);
      },
    });
  }
  const capture = () => {
    const root = document.documentElement;
    if (!root) return;
    if (
      state.wallpaperReadyMs === null &&
      root.hasAttribute("data-glass-wallpaper-ready")
    )
      state.wallpaperReadyMs = performance.now();
    if (
      state.firstLiquidCanvasMs === null &&
      document.querySelector(".liquid-glass-surface")
    )
      state.firstLiquidCanvasMs = performance.now();
  };
  const observer = new MutationObserver(capture);
  observer.observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-glass-wallpaper-ready"],
  });
  const frame = () => {
    if (state.startupDone) {
      observer.disconnect();
      return;
    }
    if (state.firstVisibleMs === null) {
      const element = document.querySelector(".app-shell");
      if (element) {
        const box = element.getBoundingClientRect(),
          style = getComputedStyle(element);
        if (
          box.width > 0 &&
          box.height > 0 &&
          style.display !== "none" &&
          style.visibility === "visible" &&
          Number(style.opacity) > 0
        )
          state.firstVisibleMs = performance.now();
      }
    }
    if (
      state.firstDataMs === null &&
      (document.body?.textContent.includes("journey") ||
        document.body?.textContent.includes("测试自建分类"))
    )
      state.firstDataMs = performance.now();
    if (state.firstLiquidCopyMs === null && window.__liquidBench?.copies > 0)
      state.firstLiquidCopyMs = performance.now();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

async function startupSnapshot(page) {
  return page.evaluate(() => {
    const state = window.__glassPerf;
    const navigation = performance.getEntriesByType("navigation")[0];
    const tasks = state.longtasks.filter((t) => t.start < 2500);
    return {
      firstVisibleMs: state.firstVisibleMs,
      firstDataMs: state.firstDataMs,
      fcpMs:
        performance.getEntriesByName("first-contentful-paint")[0]?.startTime ??
        null,
      wallpaperReadyMs: state.wallpaperReadyMs,
      firstLiquidCanvasMs: state.firstLiquidCanvasMs,
      firstLiquidCopyMs: state.firstLiquidCopyMs,
      prewarmReplyMs: state.prewarmReplyMs,
      prewarmDecodedMs: state.prewarmDecodedMs,
      workerJobs: state.workerJobs,
      workerReplies: state.workerReplies,
      currentDecodedMs: state.currentDecodedMs,
      currentReplyMs: state.currentReplyMs,
      mainThreadEncodes: state.mainThreadEncodes,
      domInteractiveMs: navigation.domInteractive,
      domContentLoadedMs: navigation.domContentLoadedEventEnd,
      loadMs: navigation.loadEventEnd,
      responseStartMs: navigation.responseStart,
      earlyLongTasks: tasks.length,
      earlyLongTaskMs: tasks.reduce((s, t) => s + t.duration, 0),
      earlyBlockingMs: tasks.reduce(
        (s, t) => s + Math.max(0, t.duration - 50),
        0,
      ),
      resources: performance
        .getEntriesByType("resource")
        .filter((r) => !r.name.startsWith("blob:"))
        .map((r) => ({
          name: new URL(r.name).pathname,
          transferSize: r.transferSize,
          encodedBodySize: r.encodedBodySize,
          duration: r.duration,
        })),
      mode: document.documentElement.dataset.glassMode,
      active: Number(document.documentElement.dataset.liquidGlassActive ?? 0),
    };
  });
}

const metrics = async (session) =>
  Object.fromEntries(
    (await session.send("Performance.getMetrics")).metrics.map(
      ({ name, value }) => [name, value],
    ),
  );

async function measure(page, session, action) {
  const before = await metrics(session),
    beforeCounts = await counters(page),
    beforeExtra = await page.evaluate(() => ({
      copyPixels: window.__glassPerf.copyPixels,
      copyCanvasPixels: window.__glassPerf.copyCanvasPixels,
      canvasResizes: window.__glassPerf.canvasResizes,
      surfaceResizes: window.__glassPerf.surfaceResizes,
      surfaceCanvasPixels: [
        ...document.querySelectorAll(".liquid-glass-surface"),
      ].reduce((sum, canvas) => sum + canvas.width * canvas.height, 0),
    }));
  await page.evaluate(() => {
    const sample = (window.__glassPerfStage = {
      running: true,
      previous: 0,
      values: [],
      start: performance.now(),
      active: 0,
      throttled: 0,
      total: 0,
      minY: scrollY,
      maxY: scrollY,
    });
    const frame = (now) => {
      if (!sample.running) return;
      if (sample.previous) sample.values.push(now - sample.previous);
      sample.previous = now;
      sample.total++;
      sample.active += Number(
        Number(document.documentElement.dataset.liquidGlassActive ?? 0) > 0,
      );
      sample.throttled += Number(
        document.documentElement.hasAttribute("data-liquid-glass-throttled"),
      );
      sample.minY = Math.min(sample.minY, scrollY);
      sample.maxY = Math.max(sample.maxY, scrollY);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  await action();
  const result = await page.evaluate(() => {
    const state = window.__glassPerfStage;
    state.running = false;
    const sorted = [...state.values].sort((a, b) => a - b),
      mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;
    const tasks = window.__glassPerf.longtasks.filter(
      (t) => t.start >= state.start,
    );
    return {
      frames: sorted.length,
      meanMs: mean,
      rafHz: 1000 / mean,
      p95Ms: sorted[Math.floor(sorted.length * 0.95)],
      maxMs: sorted.at(-1),
      over25msPercent:
        (100 * sorted.filter((v) => v > 25).length) / sorted.length,
      over50msPercent:
        (100 * sorted.filter((v) => v > 50).length) / sorted.length,
      longTasks: tasks.length,
      longTaskMs: tasks.reduce((s, t) => s + t.duration, 0),
      activeFramesPercent: (100 * state.active) / state.total,
      throttledFramesPercent: (100 * state.throttled) / state.total,
      minScrollY: state.minY,
      maxScrollY: state.maxY,
      finalScrollY: scrollY,
      copyPixelsTotal: window.__glassPerf.copyPixels,
      copyCanvasPixelsTotal: window.__glassPerf.copyCanvasPixels,
      canvasResizesTotal: window.__glassPerf.canvasResizes,
      surfaceResizesTotal: window.__glassPerf.surfaceResizes,
      surfaceCanvasPixels: [
        ...document.querySelectorAll(".liquid-glass-surface"),
      ].reduce((sum, canvas) => sum + canvas.width * canvas.height, 0),
    };
  });
  const after = await metrics(session),
    afterCounts = await counters(page);
  assert.ok(result.frames >= 10, "Enough frame samples");
  return {
    ...result,
    elapsedMs: (after.Timestamp - before.Timestamp) * 1000,
    taskMs: (after.TaskDuration - before.TaskDuration) * 1000,
    scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
    layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
    styleMs: (after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000,
    draws: afterCounts.draws - beforeCounts.draws,
    copies: afterCounts.copies - beforeCounts.copies,
    uploads: afterCounts.uploads - beforeCounts.uploads,
    copyPixels: result.copyPixelsTotal - beforeExtra.copyPixels,
    copyCanvasPixels:
      result.copyCanvasPixelsTotal - beforeExtra.copyCanvasPixels,
    taskMsPerDraw:
      afterCounts.draws > beforeCounts.draws
        ? ((after.TaskDuration - before.TaskDuration) * 1000) /
          (afterCounts.draws - beforeCounts.draws)
        : null,
    copyPixelsPerCopy:
      afterCounts.copies > beforeCounts.copies
        ? (result.copyPixelsTotal - beforeExtra.copyPixels) /
          (afterCounts.copies - beforeCounts.copies)
        : null,
    copyAreaSavingsPercent:
      result.copyCanvasPixelsTotal > beforeExtra.copyCanvasPixels
        ? 100 *
          (1 -
            (result.copyPixelsTotal - beforeExtra.copyPixels) /
              (result.copyCanvasPixelsTotal - beforeExtra.copyCanvasPixels))
        : null,
    surfaceCanvasPixelsBefore: beforeExtra.surfaceCanvasPixels,
    surfaceCanvasPixelsAfter: result.surfaceCanvasPixels,
    canvasResizes: result.canvasResizesTotal - beforeExtra.canvasResizes,
    surfaceResizes: result.surfaceResizesTotal - beforeExtra.surfaceResizes,
  };
}

async function scrollGesture(page, session, profile, range, direction) {
  if (!profile.mobile)
    return session.send("Input.synthesizeScrollGesture", {
      x: Math.round(profile.viewport.width * 0.75),
      y: Math.round(profile.viewport.height * 0.6),
      yDistance: direction * range,
      speed: Math.max(80, Math.round(range / 2)),
      gestureSourceType: "mouse",
      preventFling: true,
    });
  // Chrome's synthesized touch gesture can finish without scrolling in headless
  // mode. Trusted CDP touch contacts exercise the real touch scrolling pipeline.
  const x = Math.round(profile.viewport.width * 0.75);
  const distance = Math.min(range, Math.floor(profile.viewport.height * 0.6));
  const top = Math.round(profile.viewport.height * 0.2),
    bottom = top + distance;
  const from = direction < 0 ? bottom : top;
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: from }],
  });
  const start = Date.now();
  const pending = [];
  for (let step = 1; step <= 120; step++) {
    // Awaiting each acknowledgement serially limits event delivery to roughly
    // 30Hz in headless Chrome and can itself trigger the slow-frame safeguard.
    // Send on a wall-clock schedule, then join acknowledgements before release.
    pending.push(
      session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: from + (direction * distance * step) / 120 }],
      }),
    );
    await new Promise((resolve) =>
      setTimeout(
        resolve,
        Math.max(0, start + (step * 2000) / 120 - Date.now()),
      ),
    );
  }
  await Promise.all(pending);
  // Stop before release to keep the recorded range deterministic (no fling).
  await page.waitForTimeout(100);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}

function median(values) {
  const sorted = values
    .filter((v) => typeof v === "number" && Number.isFinite(v))
    .sort((a, b) => a - b);
  return sorted.length
    ? (sorted[Math.floor((sorted.length - 1) / 2)] +
        sorted[Math.ceil((sorted.length - 1) / 2)]) /
        2
    : null;
}
function summarize(samples) {
  const groups = new Map();
  for (const row of samples) {
    const key = `${row.profile}/${row.route}/${row.variant}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups].map(([key, rows]) => {
    const result = { key, runs: rows.length };
    for (const section of [
      "cold",
      "reload",
      "idle",
      "scroll",
      "pointer",
      "memory",
    ]) {
      const sectionKeys = new Set(
        rows.flatMap((r) => Object.keys(r[section] ?? {})),
      );
      result[section] = {};
      for (const field of sectionKeys)
        if (rows.some((r) => typeof r[section]?.[field] === "number"))
          result[section][field] = median(rows.map((r) => r[section]?.[field]));
    }
    return result;
  });
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_EXECUTABLE ??
    (existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe")
      ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
      : undefined),
  args: [
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
  ],
});
const browserSession = await browser.newBrowserCDPSession();
const system = await browserSession.send("SystemInfo.getInfo");
const report = {
  startedAt: new Date().toISOString(),
  variants: variants.map(({ name, url }) => ({ name, url })),
  browser: browser.version(),
  host: {
    platform: os.platform(),
    release: os.release(),
    cpu: os.cpus()[0]?.model,
    logicalCPUs: os.cpus().length,
    ramGiB: os.totalmem() / 1024 ** 3,
  },
  gpu: system.gpu,
  profiles,
  rounds,
  methodology: {
    theme:
      "Saved liquid, dark, magnificent photo, full device DPR; identical 12-word/18-course API fixtures.",
    isolation:
      "Sequential one-page tests, before/after order reversed on each round; fresh context per sample. Playwright routing disables HTTP cache. OS/shared browser caches may be warm. No real backend reads or writes.",
    settling:
      "Wait for current and alternate wallpaper decode, expand course category, then wait at least 3.2 seconds before a 500ms idle sample and two ~2-second native scroll gestures.",
    input:
      "PC native CDP synthesizeScrollGesture; mobile CDP trusted touch positions scheduled at60Hz without serial acknowledgement waits; 100ms hold before touch release to prevent fling.",
    interpretation:
      "rAF frequency is JS frame callback delivery, not presented GPU FPS. TaskDuration is renderer main-thread work; worker/GPU total CPU is not measured. Mobile is desktop CPU/GPU emulation, not real phone thermal/battery performance.",
    pixels:
      "copyPixels sums the actual drawImage destination rectangle area, including crop offsets, not the full target canvas. copyCanvasPixels sums full canvas area for those same copy calls, for per-copy normalization only. surfaceCanvasPixelsBefore/After separately snapshot live per-card backing area;4 bytes/pixel is an RGBA8 lower-level estimate, not measured RAM/VRAM. Canvas resizes count changes to width/height setters, not all compositor allocation.",
  },
  samples: [],
  summary: [],
  passed: false,
};
await mkdir(path.dirname(output), { recursive: true });
if (process.env.GLASS_OPT_RESUME === "1") {
  const previous = JSON.parse(await readFile(output, "utf8"));
  report.samples = previous.samples;
  report.previousBatches = [
    ...(previous.previousBatches ?? []),
    {
      startedAt: previous.startedAt,
      finishedAt: previous.finishedAt,
      sampleCount: previous.samples.length,
      failure: previous.failure ?? null,
    },
  ];
}
async function save() {
  report.summary = summarize(report.samples);
  await writeFile(output, JSON.stringify(report, null, 2));
}
try {
  console.log(`GPU ${JSON.stringify(system.gpu.devices)}`);
  for (const profile of profiles)
    for (const route of routes)
      for (let round = 0; round < rounds; round++)
        for (const variant of round % 2 === 0
          ? variants
          : [...variants].reverse()) {
          if (
            report.samples.some(
              (row) =>
                row.profile === profile.name &&
                row.route === route &&
                row.round === round + 1 &&
                row.variant === variant.name,
            )
          )
            continue;
          const { context, requests } = await variant.fixture.createContext(
            browser,
            profile,
          );
          try {
            await context.addInitScript(instrument, {
              mode: "liquid",
              currentBlurPx: 4,
            });
            const page = await context.newPage();
            const errors = [];
            page.on("pageerror", (error) => errors.push(error.message));
            const session = await context.newCDPSession(page);
            await session.send("Performance.enable");
            await page.goto(
              `${variant.url}/${route}${route === "courselearn" ? "?kc=100&name=performance" : ""}`,
              { waitUntil: "domcontentloaded" },
            );
            await page.waitForFunction(
              () =>
                document.documentElement.hasAttribute(
                  "data-glass-wallpaper-ready",
                ) &&
                window.__glassPerf.decodedBlobs >= 4 &&
                window.__liquidBench?.copies > 0,
              undefined,
              { timeout: 20000 },
            );
            if (route === "courselearn")
              await page.getByText("journey", { exact: true }).waitFor();
            else
              await page
                .getByRole("button", { name: /测试自建分类/ })
                .waitFor();
            const row = {
              profile: profile.name,
              route,
              variant: variant.name,
              mode: "liquid",
              round: round + 1,
            };
            row.cold = await startupSnapshot(page);
            assert.equal(row.cold.mode, "liquid");
            await page.evaluate(() => {
              window.__glassPerf.startupDone = true;
            });
            if (route === "learnwords") {
              await page.getByRole("button", { name: /测试自建分类/ }).click();
              await page.getByText("测试课程 12", { exact: true }).waitFor();
            }
            await page.waitForTimeout(3200);
            await page.evaluate(() =>
              scrollTo({ top: 0, behavior: "instant" }),
            );
            await page.waitForTimeout(200);
            row.beforeScroll = await page.evaluate(() => ({
              active: Number(
                document.documentElement.dataset.liquidGlassActive ?? 0,
              ),
              throttled: document.documentElement.hasAttribute(
                "data-liquid-glass-throttled",
              ),
              runningAnimations: document
                .getAnimations()
                .filter((animation) => animation.playState === "running")
                .length,
              mode: document.documentElement.dataset.glassMode,
            }));
            assert.ok(
              row.beforeScroll.active > 0,
              "Liquid effect must be active after settling",
            );
            assert.equal(row.beforeScroll.throttled, false);
            row.idle = await measure(page, session, () =>
              page.waitForTimeout(500),
            );
            const range = await page.evaluate(() =>
              Math.min(
                1400,
                document.documentElement.scrollHeight - innerHeight,
              ),
            );
            assert.ok(range > 50, "Fixture has real scrollable content");
            row.scroll = await measure(page, session, async () => {
              await scrollGesture(page, session, profile, range, -1);
              await scrollGesture(page, session, profile, range, 1);
            });
            row.scroll.distancePx = profile.mobile
              ? Math.min(range, Math.floor(profile.viewport.height * 0.6))
              : range;
            row.scroll.input = profile.mobile
              ? "CDP dispatchTouchEvent"
              : "CDP synthesizeScrollGesture mouse";
            assert.ok(
              row.scroll.maxScrollY - row.scroll.minScrollY > 40,
              "Native input actually scrolls",
            );
            assert.ok(
              row.scroll.draws > 0 && row.scroll.copies > 0,
              "Measured scrolling renders liquid effect",
            );
            assert.equal(
              row.scroll.uploads,
              0,
              "Static wallpaper is not reuploaded while scrolling",
            );
            assert.deepEqual(errors, [], "No uncaught browser errors");
            assert.deepEqual(
              requests.unknownAPI,
              [],
              "Known fixture APIs only",
            );
            assert.deepEqual(requests.blockedWrites, [], "No backend writes");
            row.errors = errors;
            report.samples.push(row);
            await save();
            console.log(
              `${report.samples.length}/${profiles.length * routes.length * rounds * 2} ${profile.name}/${route}/${variant.name} round${round + 1}: FCP ${row.cold.fcpMs}ms wallpaper ${row.cold.wallpaperReadyMs.toFixed(0)}ms scroll ${row.scroll.rafHz.toFixed(1)}Hz p95 ${row.scroll.p95Ms.toFixed(1)}ms task ${row.scroll.taskMs.toFixed(0)}ms pixels ${(row.scroll.copyPixels / 1e6).toFixed(1)}M active ${row.scroll.activeFramesPercent.toFixed(1)}% throttle ${row.scroll.throttledFramesPercent.toFixed(1)}%`,
            );
          } finally {
            await context.close();
          }
        }
  report.passed = true;
} catch (error) {
  report.failure = { message: error.message, stack: error.stack };
  throw error;
} finally {
  report.finishedAt = new Date().toISOString();
  await save();
  await browser.close();
  console.log(`Report: ${output}`);
}
