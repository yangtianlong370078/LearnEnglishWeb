/**
 * Production browser regression/scroll benchmark with fictional API responses.
 * Start an isolated production server, then run:
 *   node tests/liquid-glass.browser.mjs
 * Optional: LIQUID_GLASS_BASE_URL (default http://127.0.0.1:8093),
 * PLAYWRIGHT_MODULE, CHROME_EXECUTABLE, LIQUID_GLASS_OUTPUT,
 * LIQUID_GLASS_PAGES=courselearn,learnwords, LIQUID_GLASS_ROUNDS=2,
 * LIQUID_GLASS_PROFILES=desktop,mobile,
 * LIQUID_GLASS_FUNCTIONAL_ONLY=1, LIQUID_GLASS_SOFTWARE=1.
 * No real API request is allowed through. Mobile is desktop emulation.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const baseURL = process.env.LIQUID_GLASS_BASE_URL ?? "http://127.0.0.1:8093";
assert.notEqual(
  new URL(baseURL).port,
  "8090",
  "Use an isolated server; 8090 belongs to the user.",
);
const output =
  process.env.LIQUID_GLASS_OUTPUT ??
  path.join(os.tmpdir(), `liquid-glass-${Date.now()}`);
const requestedPages = (
  process.env.LIQUID_GLASS_PAGES ?? "courselearn,learnwords"
).split(",");
const rounds = Number(process.env.LIQUID_GLASS_ROUNDS ?? 2);
const functionalOnly = process.env.LIQUID_GLASS_FUNCTIONAL_ONLY === "1";
const requestedProfiles = (
  process.env.LIQUID_GLASS_PROFILES ?? "desktop,mobile"
).split(",");
const configExports = {};
runInNewContext(
  ts.transpileModule(readFileSync(new URL("../config/liquid-glass.ts", import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports: configExports },
);

async function imageDifference(before, after, regions) {
  const { default: sharp } = await import("sharp");
  const a = await sharp(before)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const b = await sharp(after).ensureAlpha().raw().toBuffer();
  let changedPixels = 0,
    maxChannelDifference = 0,
    comparedPixels = 0,
    sum = 0;
  let left = a.info.width,
    top = a.info.height,
    right = -1,
    bottom = -1;
  for (let i = 0; i < a.data.length; i += 4) {
    const x = (i / 4) % a.info.width,
      y = Math.floor(i / 4 / a.info.width);
    if (
      regions &&
      !regions.some((r) => {
        const px = x + 0.5,
          py = y + 0.5;
        if (px < r.x || py < r.y || px >= r.x + r.width || py >= r.y + r.height)
          return false;
        const radius = Math.min(r.radius ?? 0, r.width / 2, r.height / 2);
        const dx = Math.max(
          r.x + radius - px,
          0,
          px - (r.x + r.width - radius),
        );
        const dy = Math.max(
          r.y + radius - py,
          0,
          py - (r.y + r.height - radius),
        );
        return dx * dx + dy * dy <= radius * radius;
      })
    )
      continue;
    comparedPixels++;
    let changed = false;
    for (let channel = 0; channel < 3; channel++) {
      const delta = Math.abs(a.data[i + channel] - b[i + channel]);
      sum += delta;
      maxChannelDifference = Math.max(maxChannelDifference, delta);
      changed ||= delta > 0;
    }
    if (changed) {
      changedPixels++;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  return {
    changedPixels,
    comparedPixels,
    maxChannelDifference,
    meanChannelDifference: sum / (comparedPixels * 3),
    bounds: changedPixels ? [left, top, right, bottom] : null,
  };
}

async function loadPlaywright() {
  if (process.env.PLAYWRIGHT_MODULE)
    return import(
      pathToFileURL(path.resolve(process.env.PLAYWRIGHT_MODULE)).href
    );
  try {
    return await import("playwright");
  } catch {
    const npmCache = path.join(
      process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"),
      "npm-cache",
      "_npx",
    );
    const folders = await readdir(npmCache).catch(() => []);
    for (const folder of folders) {
      const entry = path.join(
        npmCache,
        folder,
        "node_modules",
        "playwright",
        "index.mjs",
      );
      if (existsSync(entry)) return import(pathToFileURL(entry).href);
    }
    throw new Error(
      "Install playwright or set PLAYWRIGHT_MODULE to its index.mjs.",
    );
  }
}

const course = (id, name) => ({
  courseId: id,
  courseName: name,
  isMyCourse: true,
  wordsCount: 180,
  notDoneCount: 40,
  doneCount: 60,
  notLearned: 80,
  percentage: "33.3",
});
const courses = Array.from({ length: 18 }, (_, i) =>
  course(i + 100, `测试课程 ${i + 1}`),
);
const categoryContent = {
  categoryInfos: [
    {
      id: 2,
      name: "测试精选分类",
      isMy: false,
      isLearn: true,
      courseInfos: courses.slice(12),
    },
  ],
  myCategoryInfos: [
    {
      id: 1,
      name: "测试自建分类",
      isMy: true,
      isLearn: true,
      courseInfos: courses.slice(0, 12),
    },
  ],
  newWord: course(-1, "生词本"),
  strengthenWord: course(-2, "强化区"),
  lastCourse: course(100, "最近课程"),
};
const words = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  lexiconId: i + 1,
  en: [
    "apple",
    "book",
    "cloud",
    "dream",
    "earth",
    "forest",
    "garden",
    "happy",
    "island",
    "journey",
    "kind",
    "light",
  ][i],
  cn: `测试释义 ${i + 1}`,
  isCollect: 0,
  numberSum: 0,
  zyNumber: 0,
  yzNumber: 0,
  txNumber: 0,
  fyNumber: 0,
  myWord: true,
}));

function instrumentBrowser({ blockWebGL }) {
  const bench = (window.__liquidBench = {
    draws: 0,
    copies: 0,
    uploads: 0,
    contexts: [],
    maxInstances: 0,
  });
  const originalContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...args) {
    if (blockWebGL && (type === "webgl2" || type === "webgl")) return null;
    const context = originalContext.call(this, type, ...args);
    if (type === "webgl2" && context && !bench.contexts.includes(context))
      bench.contexts.push(context);
    return context;
  };
  if (window.WebGL2RenderingContext) {
    const prototype = WebGL2RenderingContext.prototype;
    const originalDraw = prototype.drawArraysInstanced;
    prototype.drawArraysInstanced = function (...args) {
      bench.draws++;
      bench.maxInstances = Math.max(bench.maxInstances, args[3]);
      return originalDraw.apply(this, args);
    };
    const originalUpload = prototype.texImage2D;
    prototype.texImage2D = function (...args) {
      bench.uploads++;
      return originalUpload.apply(this, args);
    };
  }
  const originalCopy = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (...args) {
    if (bench.contexts.some((context) => context.canvas === args[0]))
      bench.copies++;
    return originalCopy.apply(this, args);
  };
  localStorage.setItem("token", "fictional-browser-test-token");
  localStorage.setItem("theme", "dark");
  localStorage.setItem("background-theme", "magnificent");
  if (!localStorage.getItem("glass-mode"))
    localStorage.setItem("glass-mode", "glass");
}

async function createContext(browser, profile, { blockWebGL = false } = {}) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.dpr,
    isMobile: profile.mobile,
    hasTouch: profile.mobile,
    colorScheme: "dark",
    serviceWorkers: "block",
  });
  await context.addCookies([
    { name: "auth_token", value: "fictional-browser-test-token", url: baseURL },
  ]);
  await context.addInitScript(instrumentBrowser, { blockWebGL });
  const requests = {
    mocked: [],
    blockedWrites: [],
    unknownAPI: [],
    blockedExternal: [],
  };
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isAPI =
      /\/api\//i.test(url.pathname) ||
      /\/(Word|Course|Statistics|Task|Whisper)\//i.test(url.pathname);
    const fulfill = (body) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    if (isAPI) {
      requests.mocked.push(`${request.method()} ${url.pathname}`);
      if (request.method() !== "GET") {
        requests.blockedWrites.push(`${request.method()} ${url.pathname}`);
        return fulfill({ success: true, data: null });
      }
      if (/\/Word\/Words$/i.test(url.pathname))
        return fulfill({
          success: true,
          data: words,
          total: 12,
          pageIndex: 1,
          pageSize: 12,
          brs: 12,
          wlj: 0,
          yzw: 0,
        });
      if (/\/Course\/MyCategoryContent$/i.test(url.pathname))
        return fulfill({ success: true, data: categoryContent });
      if (/\/Course\/CategoryList$/i.test(url.pathname))
        return fulfill({ success: true, data: [] });
      requests.unknownAPI.push(url.pathname);
      return fulfill({ success: true, data: [] });
    }
    if (
      url.origin !== new URL(baseURL).origin &&
      !["data:", "blob:"].includes(url.protocol)
    ) {
      requests.blockedExternal.push(url.origin + url.pathname);
      return route.abort();
    }
    return route.continue();
  });
  return { context, requests };
}

async function openFixture(page, name) {
  await page.goto(
    `${baseURL}/${name}${name === "courselearn" ? "?kc=100&name=液态玻璃验证" : ""}`,
    { waitUntil: "networkidle" },
  );
  await page.waitForFunction(() =>
    document.documentElement.hasAttribute("data-glass-wallpaper-ready"),
  );
  if (name === "courselearn") {
    await page.getByText("journey", { exact: true }).waitFor();
  } else {
    await page.getByRole("button", { name: /测试自建分类/ }).click();
    await page.getByText("测试课程 12", { exact: true }).waitFor();
  }
  await page.waitForTimeout(1200);
}

async function chooseMode(page, mode) {
  const label = { card: "卡片", glass: "玻璃", liquid: "液态玻璃" }[mode];
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const radio = page.getByRole("radio", { name: label, exact: true });
  if (!(await radio.count())) {
    const labelled = page.getByRole("button", { name: /背景主题/ });
    if (await labelled.count()) await labelled.first().click();
    else
      await page
        .locator('[aria-haspopup="listbox"]')
        .filter({ hasText: /图片|默认/ })
        .first()
        .click();
  }
  await page.getByText(label, { exact: true }).last().click();
  await page.waitForFunction(
    (mode) => document.documentElement.dataset.glassMode === mode,
    mode,
  );
  await page.keyboard.press("Escape");
  if (mode === "liquid")
    await page.waitForFunction(
      () => document.querySelectorAll(".liquid-glass-surface").length > 0,
    );
  else
    await page.waitForFunction(
      () => document.querySelectorAll(".liquid-glass-surface").length === 0,
    );
  await page.waitForTimeout(700);
}

async function counters(page) {
  return page.evaluate(() => ({
    draws: window.__liquidBench.draws,
    copies: window.__liquidBench.copies,
    uploads: window.__liquidBench.uploads,
    maxInstances: window.__liquidBench.maxInstances,
    contexts: window.__liquidBench.contexts.length,
    liveContexts: window.__liquidBench.contexts.filter(
      (gl) => !gl.isContextLost(),
    ).length,
    canvases: document.querySelectorAll(".liquid-glass-surface").length,
    mode: document.documentElement.dataset.glassMode,
  }));
}

async function idleCheck(page, expectedLiquid, cap) {
  await page.waitForTimeout(700);
  const before = await counters(page);
  await page.waitForTimeout(500);
  const after = await counters(page);
  assert.equal(after.draws - before.draws, 0, "No WebGL draws while idle");
  assert.ok(after.canvases <= cap, "Active canvas budget respected");
  if (expectedLiquid)
    assert.ok(after.canvases > 0, "Liquid has visible surfaces");
  else {
    assert.equal(after.canvases, 0, "All liquid canvases removed on exit");
    assert.equal(after.liveContexts, 0, "WebGL context released on exit");
  }
  return { ...after, idleDraws: after.draws - before.draws };
}

async function functionalChecks(page, name, profile) {
  const results = {};
  assert.equal(
    (await counters(page)).contexts,
    0,
    "Glass must not create a WebGL context before opt-in",
  );
  await chooseMode(page, "liquid");
  results.liquid = await idleCheck(page, true, profile.cap);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.glassMode === "liquid" &&
      document.querySelector(".liquid-glass-surface"),
  );
  await page.waitForTimeout(1000);
  results.persisted = await counters(page);
  if (name === "learnwords") {
    await page.getByRole("button", { name: /测试自建分类/ }).click();
    await page.waitForTimeout(1000);
  }
  await page.screenshot({
    path: path.join(output, `${profile.name}-${name}-liquid.png`),
  });
  await chooseMode(page, "glass");
  await idleCheck(page, false, profile.cap);
  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.move(0, 0);
  await page.waitForTimeout(250);
  const glassBefore = await page.screenshot({
    path: path.join(output, `${profile.name}-${name}-glass-before.png`),
  });
  const cardRegions = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".yinyinkuan"), (element) => {
      const bounds = element.getBoundingClientRect();
      return {
        x: bounds.x * devicePixelRatio,
        y: bounds.y * devicePixelRatio,
        width: bounds.width * devicePixelRatio,
        height: bounds.height * devicePixelRatio,
        radius:
          (parseFloat(getComputedStyle(element).borderTopLeftRadius) || 0) *
          devicePixelRatio,
      };
    }),
  );
  await chooseMode(page, "liquid");
  await chooseMode(page, "glass");
  results.returnToGlass = await idleCheck(page, false, profile.cap);
  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.move(0, 0);
  await page.waitForTimeout(250);
  const glassAfter = await page.screenshot({
    path: path.join(output, `${profile.name}-${name}-glass-return.png`),
  });
  results.returnToGlass.identicalScreenshot = glassBefore.equals(glassAfter);
  results.returnToGlass.pixelDifference = await imageDifference(
    glassBefore,
    glassAfter,
  );
  results.returnToGlass.cardPixelDifference = await imageDifference(
    glassBefore,
    glassAfter,
    cardRegions,
  );
  results.returnToGlass.cardRegions = cardRegions;
  results.returnToGlass.rectangularPixelDifference = await imageDifference(
    glassBefore,
    glassAfter,
    cardRegions.map(({ radius, ...region }) => region),
  );
  assert.equal(
    results.returnToGlass.cardPixelDifference.changedPixels,
    0,
    "All glass card regions return pixel for pixel after liquid exits",
  );
  if (!results.returnToGlass.identicalScreenshot)
    console.log(
      `Visual comparison needs review (${profile.name}/${name}): ${JSON.stringify(results.returnToGlass.pixelDifference)}`,
    );
  results.protection = await protectionChecks(page);
  // Context loss can invalidate browser GPU rasters. Test this separately,
  // after the ordinary mode round-trip screenshots and protection checks.
  await page.evaluate(() =>
    window.__liquidBench.contexts
      .at(-1)
      .getExtension("WEBGL_lose_context")
      .loseContext(),
  );
  await page.waitForFunction(
    () =>
      document.documentElement.dataset.glassMode === "glass" &&
      !document.querySelector(".liquid-glass-surface"),
  );
  results.contextLoss = await idleCheck(page, false, profile.cap);
  return results;
}

async function protectionChecks(page) {
  await chooseMode(page, "liquid");
  await page.evaluate(() =>
    document.body.setAttribute("data-glass-modal-open", ""),
  );
  await page.waitForFunction(
    () => !document.querySelector(".liquid-glass-surface"),
  );
  await page.evaluate(() =>
    document.body.removeAttribute("data-glass-modal-open"),
  );
  await page.waitForFunction(
    () => !!document.querySelector(".liquid-glass-surface"),
  );
  const slow = await page.evaluate(async () => {
    const prototype = WebGL2RenderingContext.prototype;
    const original = prototype.drawArraysInstanced;
    prototype.drawArraysInstanced = function (...args) {
      const started = performance.now();
      while (performance.now() - started < 12) {
        /* Deliberate test-only slow GPU submission. */
      }
      return original.apply(this, args);
    };
    let result = { throttled: false, canvases: -1, updates: 0 };
    try {
      for (let i = 0; i < 60; i++) {
        scrollTo({ top: 2 * (i + 1), behavior: "instant" });
        await new Promise(requestAnimationFrame);
        if (
          document.documentElement.hasAttribute("data-liquid-glass-throttled")
        ) {
          result = {
            throttled: true,
            canvases: document.querySelectorAll(".liquid-glass-surface").length,
            updates: i + 1,
          };
          break;
        }
      }
    } finally {
      prototype.drawArraysInstanced = original;
    }
    return result;
  });
  assert.ok(
    slow.throttled,
    "Sustained slow liquid rendering triggers the scroll fallback",
  );
  assert.equal(
    slow.canvases,
    0,
    "Throttled mode releases every liquid output canvas",
  );
  await page.waitForFunction(
    () =>
      !document.documentElement.hasAttribute("data-liquid-glass-throttled") &&
      !!document.querySelector(".liquid-glass-surface"),
  );
  return {
    modalSuspension: true,
    modalRestore: true,
    slowFrames: slow,
    restoredAfterScroll: true,
  };
}

async function measureScroll(page, session, profile) {
  const metrics = async () =>
    Object.fromEntries(
      (await session.send("Performance.getMetrics")).metrics.map(
        ({ name, value }) => [name, value],
      ),
    );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(300);
  const range = await page.evaluate(() =>
    Math.min(1400, document.documentElement.scrollHeight - innerHeight),
  );
  assert.ok(range > 50, "Fixture must provide real scrolling");
  const gesture = (direction, duration) =>
    session.send("Input.synthesizeScrollGesture", {
      x: Math.round(profile.viewport.width * 0.75),
      y: Math.round(profile.viewport.height * 0.6),
      yDistance: direction * range,
      speed: Math.max(80, Math.round(range / duration)),
      gestureSourceType: "mouse",
      preventFling: true,
    });
  // Warm each mode with the same native wheel gesture before recording.
  await gesture(-1, 0.5);
  await gesture(1, 0.5);
  await page.waitForTimeout(250);
  const beforeCounts = await counters(page);
  const before = await metrics();
  await page.evaluate(() => {
    window.__liquidFrames = {
      values: [],
      running: true,
      previous: 0,
      maxActive: 0,
      sampledFrames: 0,
      activeFrames: 0,
      throttledFrames: 0,
      maxCanvasPixels: 0,
      canvasPixelSum: 0,
    };
    const frame = (now) => {
      const state = window.__liquidFrames;
      if (!state.running) return;
      if (state.previous) state.values.push(now - state.previous);
      state.previous = now;
      const root = document.documentElement;
      const active = Number(root.dataset.liquidGlassActive ?? 0);
      const pixels = Array.from(
        document.querySelectorAll(".liquid-glass-surface"),
        (canvas) => canvas.width * canvas.height,
      ).reduce((sum, value) => sum + value, 0);
      state.sampledFrames++;
      state.activeFrames += Number(active > 0);
      state.throttledFrames += Number(
        root.hasAttribute("data-liquid-glass-throttled"),
      );
      state.maxActive = Math.max(state.maxActive, active);
      state.maxCanvasPixels = Math.max(state.maxCanvasPixels, pixels);
      state.canvasPixelSum += pixels;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  await gesture(-1, 2);
  await gesture(1, 2);
  const sample = await page.evaluate(() => {
    const state = window.__liquidFrames;
    state.running = false;
    const sorted = [...state.values].sort((a, b) => a - b);
    return {
      frames: sorted.length,
      meanMs: sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
      p95Ms: sorted[Math.floor(sorted.length * 0.95)],
      over25msPercent:
        (sorted.filter((value) => value > 25).length / sorted.length) * 100,
      maxActive: state.maxActive,
      activeFramesPercent: (state.activeFrames / state.sampledFrames) * 100,
      throttledFramesPercent:
        (state.throttledFrames / state.sampledFrames) * 100,
      maxCanvasPixels: state.maxCanvasPixels,
      meanCanvasPixels: state.canvasPixelSum / state.sampledFrames,
      finalScrollY: window.scrollY,
    };
  });
  const after = await metrics();
  const afterCounts = await counters(page);
  assert.ok(sample.frames >= 20, "Enough frames for a meaningful sample");
  assert.ok(
    sample.maxActive <= profile.cap,
    "Active budget held while scrolling",
  );
  return {
    ...sample,
    distancePx: range,
    taskMs: (after.TaskDuration - before.TaskDuration) * 1000,
    scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
    layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
    styleMs: (after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000,
    elapsedMs: (after.Timestamp - before.Timestamp) * 1000,
    draws: afterCounts.draws - beforeCounts.draws,
    copies: afterCounts.copies - beforeCounts.copies,
    uploads: afterCounts.uploads - beforeCounts.uploads,
  };
}

export {
  loadPlaywright,
  createContext,
  openFixture,
  chooseMode,
  counters,
  imageDifference,
};

async function main() {
  await mkdir(output, { recursive: true });
  const { chromium } = await loadPlaywright();
  const chrome =
    process.env.CHROME_EXECUTABLE ??
    (existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe")
      ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
      : undefined);
  const browser = await chromium.launch({
    headless: true,
    executablePath: chrome,
    args:
      process.env.LIQUID_GLASS_SOFTWARE === "1"
        ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
        : [],
  });
  const report = {
    baseURL,
    createdAt: new Date().toISOString(),
    browser: browser.version(),
    softwareRequested: process.env.LIQUID_GLASS_SOFTWARE === "1",
    conditions:
      "Real application routes with 12 fictional words / 18 fictional courses. Native CDP wheel scrolling, two 2-second passes per sample after warmup. Mobile is desktop CPU/GPU emulation, not thermal/power measurement. rAF intervals are not directly presented GPU FPS. TaskDuration is renderer main-thread work, not total CPU usage.",
    results: [],
    unsupported: null,
  };
  const profiles = [
    {
      name: "desktop",
      viewport: { width: 1440, height: 900 },
      dpr: 1,
      mobile: false,
      cap: configExports.liquidGlassConfig.desktop.maxCards,
    },
    {
      name: "mobile",
      viewport: { width: 390, height: 844 },
      dpr: 2,
      mobile: true,
      cap: configExports.liquidGlassConfig.mobile.maxCards,
    },
  ].filter((profile) => requestedProfiles.includes(profile.name));
  try {
    const browserSession = await browser.newBrowserCDPSession();
    const systemInfo = await browserSession.send("SystemInfo.getInfo");
    report.gpu = {
      devices: systemInfo.gpu.devices,
      renderer: systemInfo.gpu.auxAttributes.glRenderer,
      featureStatus: systemInfo.gpu.featureStatus,
    };
    report.hardwareAccelerated =
      systemInfo.gpu.featureStatus.gpu_compositing === "enabled" &&
      !/swiftshader|software|llvmpipe/i.test(report.gpu.renderer);
    await browserSession.detach();
    console.log(
      `GPU: ${report.gpu.renderer}; hardware accelerated: ${report.hardwareAccelerated}`,
    );
    for (const profile of profiles) {
      for (const name of requestedPages) {
        const { context, requests } = await createContext(browser, profile);
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        try {
          await openFixture(page, name);
          const result = {
            profile,
            page: name,
            fixtures: { words: 12, courses: 18 },
            functional: await functionalChecks(page, name, profile),
            samples: [],
            requests,
            errors,
          };
          report.results.push(result);
          if (!functionalOnly && report.hardwareAccelerated) {
            const session = await context.newCDPSession(page);
            await session.send("Performance.enable");
            for (let round = 0; round < rounds; round++) {
              const modes =
                round % 2
                  ? ["liquid", "glass-return", "card", "glass"]
                  : ["card", "glass", "liquid", "glass-return"];
              for (const label of modes) {
                const mode = label === "glass-return" ? "glass" : label;
                await chooseMode(page, mode);
                const sample = {
                  round: round + 1,
                  mode: label,
                  ...(await measureScroll(page, session, profile)),
                };
                if (mode !== "liquid")
                  assert.equal(
                    sample.draws,
                    0,
                    "Ordinary modes must have zero WebGL draws",
                  );
                result.samples.push(sample);
                console.log(
                  `${profile.name} ${name} round ${round + 1} ${label}: mean ${sample.meanMs.toFixed(2)}ms, p95 ${sample.p95Ms.toFixed(2)}ms, task ${sample.taskMs.toFixed(1)}ms, draws ${sample.draws}`,
                );
              }
            }
            await session.detach();
          }
          assert.deepEqual(errors, [], "No page exceptions");
          assert.deepEqual(
            requests.unknownAPI,
            [],
            "All API fixtures are explicit",
          );
          assert.deepEqual(
            requests.blockedWrites,
            [],
            "The scenario must not attempt data writes",
          );
          await writeFile(
            path.join(output, "results.json"),
            JSON.stringify(report, null, 2),
          );
        } finally {
          await context.close();
        }
      }
    }
    const { context } = await createContext(browser, profiles[0], {
      blockWebGL: true,
    });
    try {
      const page = await context.newPage();
      await openFixture(page, "courselearn");
      const trigger = page.getByRole("button", { name: /背景主题/ });
      if (await trigger.count()) await trigger.first().click();
      else
        await page
          .locator('[aria-haspopup="listbox"]')
          .filter({ hasText: /图片|默认/ })
          .first()
          .click();
      await page.getByText("液态玻璃", { exact: true }).click();
      await page.waitForFunction(
        () =>
          document.documentElement.dataset.glassMode === "glass" &&
          !document.querySelector(".liquid-glass-surface"),
      );
      report.unsupported = await idleCheck(page, false, profiles[0].cap);
    } finally {
      await context.close();
    }
    report.functionalPassed = true;
    report.visualAllExact = report.results.every(
      (result) =>
        result.functional.returnToGlass.pixelDifference.changedPixels === 0,
    );
    report.cardVisualAllExact = report.results.every(
      (result) =>
        result.functional.returnToGlass.cardPixelDifference.changedPixels === 0,
    );
    report.passed = report.cardVisualAllExact;
  } catch (error) {
    report.passed = false;
    report.failure = { message: error.message, stack: error.stack };
    throw error;
  } finally {
    await writeFile(
      path.join(output, "results.json"),
      JSON.stringify(report, null, 2),
    );
    await browser.close();
    console.log(`Browser report: ${output}`);
  }
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
)
  await main();
