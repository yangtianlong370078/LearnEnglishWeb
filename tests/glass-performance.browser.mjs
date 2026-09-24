/**
 * Three-mode production benchmark. Run node tests/glass-performance.browser.mjs.
 * Fictional APIs only; isolated server defaults to 8094. Mobile is emulation.
 * GLASS_PERF_ROUNDS=3, GLASS_PERF_PROFILES=desktop,mobile,mobile-cpu4,
 * GLASS_PERF_PAGES=courselearn,learnwords, GLASS_PERF_OUTPUT=... are optional.
 * GLASS_PERF_RESUME=1 preserves completed samples and skips their keys.
 * GLASS_PERF_DIAGNOSTIC_ONLY=1 adds settled desktop idle / coverage diagnostics;
 * combine it with RESUME=1 to retain the primary matrix.
 * rAF delivery is measured, not presented GPU FPS. No intentional slow draws.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const baseURL = process.env.LIQUID_GLASS_BASE_URL ?? "http://127.0.0.1:8094";
process.env.LIQUID_GLASS_BASE_URL = baseURL;
assert.notEqual(new URL(baseURL).port, "8090");
const { loadPlaywright, createContext, counters } = await import(
  "./liquid-glass.browser.mjs"
);
const output =
  process.env.GLASS_PERF_OUTPUT ??
  "docs/glass-performance-2026-09-24-data.json";
const rounds = Number(process.env.GLASS_PERF_ROUNDS ?? 3);
const requestedProfiles = (
  process.env.GLASS_PERF_PROFILES ?? "desktop,mobile,mobile-cpu4"
).split(",");
const pages = (process.env.GLASS_PERF_PAGES ?? "courselearn,learnwords").split(
  ",",
);
const profiles = [
  {
    name: "desktop",
    viewport: { width: 1440, height: 900 },
    dpr: 1,
    mobile: false,
    cpu: 1,
  },
  {
    name: "mobile",
    viewport: { width: 390, height: 844 },
    dpr: 2,
    mobile: true,
    cpu: 1,
  },
  {
    name: "mobile-cpu4",
    viewport: { width: 390, height: 844 },
    dpr: 2,
    mobile: true,
    cpu: 4,
  },
].filter((p) => requestedProfiles.includes(p.name));

function instrument({ mode }) {
  localStorage.setItem("glass-mode", mode);
  const state = (window.__glassPerf = {
    started: performance.now(),
    firstVisibleMs: null,
    firstDataMs: null,
    wallpaperReadyMs: null,
    firstLiquidCanvasMs: null,
    firstLiquidCopyMs: null,
    prewarmReplyMs: null,
    prewarmDecodedMs: null,
    decodedBlobs: 0,
    workerJobs: [],
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
          if (event.data?.base && event.data?.border)
            state.prewarmReplyMs = performance.now();
        });
      }
      postMessage(...args) {
        if (args[0]?.blurPx != null)
          state.workerJobs.push({
            blurPx: args[0].blurPx,
            start: performance.now(),
          });
        return super.postMessage(...args);
      }
    };
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
    beforeCounts = await counters(page);
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
  };
}

async function settle(page, name, mode) {
  await page.waitForFunction(() =>
    document.documentElement.hasAttribute("data-glass-wallpaper-ready"),
  );
  if (name === "courselearn")
    await page.getByText("journey", { exact: true }).waitFor();
  else await page.getByRole("button", { name: /测试自建分类/ }).waitFor();
  if (mode === "liquid") {
    await page.waitForFunction(
      () =>
        document.documentElement.dataset.glassMode === "liquid" &&
        window.__liquidBench?.copies > 0,
      undefined,
      { timeout: 15000 },
    );
  }
  await page.waitForFunction(() => performance.now() >= 2700);
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

function diagnoseMotion() {
  const state = (window.__glassDiag = {
    moving: new Map(),
    events: [],
    activeChanges: [],
  });
  const label = (element) =>
    `${element.tagName}.${String(element.className).slice(0, 160)}`;
  for (const type of [
    "transitionrun",
    "transitionend",
    "transitioncancel",
    "animationstart",
    "animationend",
    "animationcancel",
  ])
    document.addEventListener(
      type,
      (event) => {
        const element = event.target;
        if (
          !(element instanceof Element) ||
          (!element.closest(".glass-warp") &&
            !element.querySelector(".glass-warp"))
        )
          return;
        if (
          event instanceof TransitionEvent &&
          !/^(transform|translate|scale|width|height|max-height|grid-template-rows|top|left|margin.*)$/.test(
            event.propertyName,
          )
        )
          return;
        const property =
          event instanceof TransitionEvent
            ? `transition:${event.propertyName}`
            : `animation:${event.animationName}`;
        if (type === "transitionrun" || type === "animationstart") {
          const keys = state.moving.get(element) ?? new Set();
          keys.add(property);
          state.moving.set(element, keys);
        } else {
          const keys = state.moving.get(element);
          keys?.delete(property);
          if (!keys?.size) state.moving.delete(element);
        }
        state.events.push({
          time: performance.now(),
          type,
          property,
          target: label(element),
          moving: state.moving.size,
          scrollY,
        });
      },
      true,
    );
  new MutationObserver((records) => {
    if (
      !records.some(
        (r) =>
          r.attributeName === "data-liquid-glass-active" ||
          r.attributeName === "data-liquid-glass-throttled",
      )
    )
      return;
    const root = document.documentElement,
      active = Number(root.dataset.liquidGlassActive ?? 0);
    if (state.activeChanges.at(-1)?.active === active) return;
    let eligibleVisible = null;
    if (!active)
      eligibleVisible = [...document.querySelectorAll(".glass-warp")].filter(
        (e) => {
          if (
            e.closest(".login-scene, .navbar-root, .cl-navbar, .modal__dialog")
          )
            return false;
          const r = e.getBoundingClientRect();
          return (
            r.width >= 4 &&
            r.height >= 4 &&
            r.right > 0 &&
            r.bottom > 0 &&
            r.left < root.clientWidth &&
            r.top < innerHeight &&
            r.width * r.height <= root.clientWidth * innerHeight * 1.5
          );
        },
      ).length;
    state.activeChanges.push({
      time: performance.now(),
      active,
      scrollY,
      eligibleVisible,
      hidden: document.hidden,
      throttled: root.hasAttribute("data-liquid-glass-throttled"),
      moving: [...state.moving]
        .filter(([e]) => e.isConnected)
        .map(([e, keys]) => ({ target: label(e), keys: [...keys] })),
    });
  }).observe(document, {
    attributes: true,
    subtree: true,
    attributeFilter: [
      "data-liquid-glass-active",
      "data-liquid-glass-throttled",
    ],
  });
}

async function supplemental(browser) {
  const results = [];
  const profile = profiles.find((p) => p.name === "desktop");
  if (!profile) return results;
  for (const route of ["courselearn", "learnwords"])
    for (const mode of ["glass", "liquid"]) {
      const { context } = await createContext(browser, profile);
      try {
        await context.addInitScript(instrument, { mode });
        await context.addInitScript(diagnoseMotion);
        const page = await context.newPage(),
          session = await context.newCDPSession(page);
        await session.send("Performance.enable");
        await page.goto(
          `${baseURL}/${route}${route === "courselearn" ? "?kc=100&name=performance" : ""}`,
          { waitUntil: "domcontentloaded" },
        );
        await settle(page, route, mode);
        await page.evaluate(() => {
          window.__glassPerf.startupDone = true;
        });
        if (route === "learnwords") {
          await page.getByRole("button", { name: /测试自建分类/ }).click();
          await page.getByText("测试课程 12", { exact: true }).waitFor();
        }
        const result = { profile: profile.name, route, mode };
        if (route === "learnwords" && mode === "liquid") {
          await page.waitForTimeout(400);
          result.earlyIdle = await measure(page, session, () =>
            page.waitForTimeout(1000),
          );
          const range = await page.evaluate(() =>
            Math.min(1400, document.documentElement.scrollHeight - innerHeight),
          );
          result.earlyScroll = await measure(page, session, async () => {
            await scrollGesture(page, session, profile, range, -1);
            await scrollGesture(page, session, profile, range, 1);
          });
        }
        await page.waitForTimeout(4000);
        result.beforeIdle = await page.evaluate(() => ({
          time: performance.now(),
          runningAnimations: document
            .getAnimations()
            .filter((a) => a.playState === "running").length,
          moving: [...window.__glassDiag.moving].filter(([e]) => e.isConnected)
            .length,
          active: Number(
            document.documentElement.dataset.liquidGlassActive ?? 0,
          ),
        }));
        result.settledIdle = await measure(page, session, () =>
          page.waitForTimeout(1200),
        );
        result.motion = await page.evaluate(() => ({
          events: window.__glassDiag.events,
          activeChanges: window.__glassDiag.activeChanges,
        }));
        results.push(result);
        console.log(
          `Settled ${route}/${mode}: ${result.settledIdle.taskMs.toFixed(1)}ms/${result.settledIdle.elapsedMs.toFixed(1)}ms, draws${result.settledIdle.draws}, runningAnimations${result.beforeIdle.runningAnimations}`,
        );
      } finally {
        await context.close();
      }
    }
  return results;
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
    const key = `${row.profile}/${row.route}/${row.mode}`;
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
  baseURL,
  browser: browser.version(),
  host: {
    platform: os.platform(),
    release: os.release(),
    cpus: os.cpus()[0]?.model,
    logicalCPUs: os.cpus().length,
    ramGiB: os.totalmem() / 1024 ** 3,
  },
  gpu: system.gpu,
  profiles,
  rounds,
  methodology: {
    theme:
      "magnificent photo/dark; card and glass 8px, liquid 4px; saved preference present before navigation",
    network:
      "localhost production build; fictional 12-word/18-course APIs; external requests blocked; Playwright routing disables HTTP cache, so reload measures reentry in same context, not a true HTTP-cache-warm load",
    startup:
      "Fresh browser context per sample; firstVisibleMs is first rAF with visible app shell, firstDataMs detects fixture content, FCP browser metric; early tasks start before 2500ms. OS/browser shared caches may remain warm.",
    workload:
      "Sequential, one active page. Modes rotate card/glass/liquid, glass/liquid/card, liquid/card/glass. 2.7s minimum entry settling then 1s idle (learnwords 400ms after expansion, may include animation settling), two gestures ~2s each; mobile trusted CDP dispatchTouchEvent swipe spanning60%viewport with100ms hold before release, desktop synthesizeScrollGesture mouse wheel; desktop pointer~2s. Same fixtures/coordinates per mode; actual durations recorded.",
    interpretation:
      "rAF intervals describe JS callback delivery and do not measure presented/compositor GPU FPS. Main task time is renderer main-thread work, not total CPU. Heap excludes GPU textures and decoded image cache. Mobile and CPU4 are desktop emulations, not physical phone/thermal/battery tests.",
  },
  samples: [],
  summary: [],
  passed: false,
};
await mkdir(path.dirname(output), { recursive: true });
if (process.env.GLASS_PERF_RESUME === "1") {
  const previous = JSON.parse(await readFile(output, "utf8"));
  report.samples = previous.samples;
  for (const key of [
    "excludedPilotSamples",
    "excludedPilotReason",
    "touchInputProbe",
    "supplemental",
  ])
    if (previous[key] !== undefined) report[key] = previous[key];
  report.previousBatches = [
    ...(previous.previousBatches ?? []),
    {
      startedAt: previous.startedAt,
      finishedAt: previous.finishedAt,
      failure: previous.failure ?? null,
      sampleCount: previous.samples.length,
    },
  ];
}
async function save() {
  report.summary = summarize(report.samples);
  await writeFile(output, JSON.stringify(report, null, 2));
}
try {
  console.log(
    `GPU: ${JSON.stringify(system.gpu.devices)}. Beginning sequential measurements.`,
  );
  for (const profile of profiles.filter(
    () => process.env.GLASS_PERF_DIAGNOSTIC_ONLY !== "1",
  ))
    for (const name of pages.filter(
      (name) => profile.cpu === 1 || name === "courselearn",
    ))
      for (let round = 0; round < rounds; round++) {
        const modes = ["card", "glass", "liquid"];
        for (let offset = 0; offset < modes.length; offset++) {
          const mode = modes[(round + offset) % 3];
          if (
            report.samples.some(
              (row) =>
                row.profile === profile.name &&
                row.route === name &&
                row.mode === mode &&
                row.round === round + 1,
            )
          )
            continue;
          const { context, requests } = await createContext(browser, profile);
          try {
            await context.addInitScript(instrument, { mode });
            const page = await context.newPage(),
              errors = [];
            page.on("pageerror", (error) => errors.push(error.message));
            const session = await context.newCDPSession(page);
            await session.send("Performance.enable");
            if (profile.cpu > 1)
              await session.send("Emulation.setCPUThrottlingRate", {
                rate: profile.cpu,
              });
            const row = {
              profile: profile.name,
              route: name,
              mode,
              round: round + 1,
            };
            await page.goto(
              `${baseURL}/${name}${name === "courselearn" ? "?kc=100&name=performance" : ""}`,
              { waitUntil: "domcontentloaded" },
            );
            await settle(page, name, mode);
            row.cold = await startupSnapshot(page);
            assert.equal(
              row.cold.mode,
              mode,
              "Requested mode is active, no silent fallback",
            );
            await page.evaluate(() => {
              window.__glassPerf.startupDone = true;
            });
            if (name === "learnwords") {
              await page.getByRole("button", { name: /测试自建分类/ }).click();
              await page.getByText("测试课程 12", { exact: true }).waitFor();
            }
            await page.waitForTimeout(400);
            row.idle = await measure(page, session, () =>
              page.waitForTimeout(1000),
            );
            await page.evaluate(() =>
              scrollTo({ top: 0, behavior: "instant" }),
            );
            const range = await page.evaluate(() =>
              Math.min(
                1400,
                document.documentElement.scrollHeight - innerHeight,
              ),
            );
            assert.ok(range > 50, "Real scrollable content required");
            const gesture = (direction) =>
              scrollGesture(page, session, profile, range, direction);
            row.scroll = await measure(page, session, async () => {
              await gesture(-1);
              await gesture(1);
            });
            row.scroll.distancePx = profile.mobile
              ? Math.min(range, Math.floor(profile.viewport.height * 0.6))
              : range;
            row.scroll.input = profile.mobile
              ? "CDP dispatchTouchEvent"
              : "CDP synthesizeScrollGesture mouse";
            assert.ok(
              row.scroll.maxScrollY - row.scroll.minScrollY > 40,
              "Native gesture actually scrolls",
            );
            await page.waitForTimeout(350);
            if (!profile.mobile)
              row.pointer = await measure(page, session, async () => {
                const start = Date.now();
                for (let step = 0; step < 120; step++) {
                  const x = Math.round(
                      80 + ((profile.viewport.width - 160) * step) / 119,
                    ),
                    y = Math.round(
                      profile.viewport.height * 0.55 +
                        Math.sin(step / 12) * 180,
                    );
                  await page.mouse.move(x, y);
                  await page.waitForTimeout(
                    Math.max(0, start + ((step + 1) * 1000) / 60 - Date.now()),
                  );
                }
              });
            const mem = await metrics(session),
              dom = await session.send("Memory.getDOMCounters"),
              counts = await counters(page);
            row.memory = {
              jsHeapMiB: mem.JSHeapUsedSize / 1024 ** 2,
              nodes: dom.nodes,
              documents: dom.documents,
              listeners: dom.jsEventListeners,
              canvases: counts.canvases,
              contexts: counts.liveContexts,
            };
            await page.reload({ waitUntil: "domcontentloaded" });
            await settle(page, name, mode);
            row.reload = await startupSnapshot(page);
            assert.equal(row.reload.mode, mode);
            assert.deepEqual(errors, [], "No browser exceptions");
            assert.deepEqual(
              requests.unknownAPI,
              [],
              "Only known API fixtures",
            );
            assert.deepEqual(requests.blockedWrites, [], "No data writes");
            if (mode !== "liquid") assert.equal(row.scroll.draws, 0);
            row.errors = errors;
            report.samples.push(row);
            console.log(
              `${profile.name}/${name}/${mode} round${round + 1}: FCP ${row.cold.fcpMs}ms, wallpaper ${row.cold.wallpaperReadyMs?.toFixed(0)}ms, scroll ${row.scroll.rafHz.toFixed(1)}rAF/s p95 ${row.scroll.p95Ms.toFixed(1)}ms task ${row.scroll.taskMs.toFixed(0)}ms draws ${row.scroll.draws} throttle ${row.scroll.throttledFramesPercent.toFixed(1)}%`,
            );
            await save();
          } finally {
            await context.close();
          }
        }
      }
  if (process.env.GLASS_PERF_DIAGNOSTIC_ONLY === "1")
    report.supplemental = await supplemental(browser);
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
