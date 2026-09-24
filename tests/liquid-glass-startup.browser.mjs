/**
 * Isolated production regression: node tests/liquid-glass-startup.browser.mjs
 * LIQUID_GLASS_STARTUP_BASE_URL defaults to http://127.0.0.1:8094 (never 8090).
 * Fictional API responses only. Optional LIQUID_GLASS_STARTUP_CASES filters cases.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const baseURL =
  process.env.LIQUID_GLASS_STARTUP_BASE_URL ??
  process.env.LIQUID_GLASS_BASE_URL ??
  "http://127.0.0.1:8094";
assert.notEqual(new URL(baseURL).port, "8090", "Use an isolated test server.");
process.env.LIQUID_GLASS_BASE_URL = baseURL;
const { loadPlaywright, createContext, chooseMode } = await import(
  "./liquid-glass.browser.mjs"
);
const config = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL("../config/glass.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  { exports: config },
);
const profile = {
  viewport: { width: 1440, height: 960 },
  dpr: 1,
  mobile: false,
};

function instrumentStartup({ mode, blockWorker }) {
  localStorage.setItem("glass-mode", mode);
  const startup = (window.__liquidStartup = {
    frames: [],
    done: false,
    pendingObserved: false,
    toBlob: 0,
    blobs: [],
    decoded: [],
    workers: [],
    posts: [],
    replies: [],
  });
  const originalBlob = HTMLCanvasElement.prototype.toBlob;
  HTMLCanvasElement.prototype.toBlob = function (...args) {
    startup.toBlob++;
    return originalBlob.apply(this, args);
  };
  const originalURL = URL.createObjectURL;
  URL.createObjectURL = function (...args) {
    const url = originalURL.apply(this, args);
    startup.blobs.push(url);
    return url;
  };
  const originalDecode = HTMLImageElement.prototype.decode;
  HTMLImageElement.prototype.decode = async function (...args) {
    const result = await originalDecode.apply(this, args);
    if (this.src.startsWith("blob:")) startup.decoded.push(this.src);
    return result;
  };
  if (blockWorker)
    Object.defineProperty(window, "Worker", {
      value: undefined,
      configurable: true,
    });
  else if (window.Worker) {
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(...args) {
        super(...args);
        startup.workers.push({
          ready: document.documentElement.hasAttribute(
            "data-glass-wallpaper-ready",
          ),
          url: String(args[0]),
          toBlob: startup.toBlob,
        });
        this.addEventListener("message", (event) =>
          startup.replies.push({
            keys: Object.keys(event.data ?? {}),
            error: event.data?.error ?? null,
          }),
        );
      }
      postMessage(...args) {
        const data = args[0];
        startup.posts.push({
          keys: Object.keys(data ?? {}),
          blurPx: data?.blurPx,
        });
        return super.postMessage(...args);
      }
    };
  }
  new MutationObserver((records) => {
    if (
      records.some(
        (record) => record.attributeName === "data-liquid-glass-pending",
      )
    )
      startup.pendingObserved = true;
  }).observe(document, {
    attributes: true,
    attributeFilter: ["data-liquid-glass-pending"],
    subtree: true,
  });
  const inViewport = (element) => {
    const rect = element.getBoundingClientRect();
    return (
      rect.width >= 4 &&
      rect.height >= 4 &&
      rect.right > 0 &&
      rect.bottom > 0 &&
      rect.left < innerWidth &&
      rect.top < innerHeight
    );
  };
  const visible = (element) => {
    const style = getComputedStyle(element);
    return (
      style.visibility === "visible" &&
      style.display !== "none" &&
      Number(style.opacity) > 0 &&
      inViewport(element)
    );
  };
  window.__readLiquidStartup = () => {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    const layers = [...document.querySelectorAll(".glass-warp")].filter(
      (layer) =>
        !layer.closest(
          ".login-scene, .navbar-root, .cl-navbar, .modal__dialog",
        ) && inViewport(layer),
    );
    return {
      mode: root.dataset.glassMode,
      pending: root.hasAttribute("data-liquid-glass-pending"),
      contentVisible: [...document.querySelectorAll(".app-shell > *")].some(
        visible,
      ),
      eligible: layers.length,
      visibleEligible: layers.filter(visible).length,
      canvases: document.querySelectorAll(".liquid-glass-surface").length,
      active: Number(root.dataset.liquidGlassActive ?? 0),
      copies: window.__liquidBench?.copies ?? 0,
      blur: style.getPropertyValue("--app-glass-blur").trim(),
      padding: style.getPropertyValue("--glass-blur-padding").trim(),
      wallpaperReady: root.hasAttribute("data-glass-wallpaper-ready"),
      texture: root.style.getPropertyValue("--glass-cached-base"),
    };
  };
  let previous = "";
  const frame = () => {
    if (document.querySelector(".app-shell")) {
      const state = window.__readLiquidStartup();
      const signature = JSON.stringify(state);
      if (signature !== previous) {
        startup.frames.push({ ...state, time: performance.now() });
        previous = signature;
      }
    }
    if (!startup.done) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

async function fixture(browser, options = {}) {
  const { context, requests } = await createContext(browser, profile, options);
  await context.addInitScript(instrumentStartup, {
    mode: options.mode ?? "liquid",
    blockWorker: options.blockWorker ?? false,
  });
  const intercepted = { bundles: 0, wallpapers: 0 };
  if (options.blockBundles || options.delayBundles)
    await context.route("**/_next/**/*.js", async (route) => {
      intercepted.bundles++;
      if (options.blockBundles) return route.abort();
      await new Promise((resolve) => setTimeout(resolve, options.delayBundles));
      return route.fallback();
    });
  if (options.failWallpaper || options.delayWallpaper)
    await context.route("**/images/bg01_*.jpeg", async (route) => {
      intercepted.wallpapers++;
      if (options.failWallpaper) return route.abort();
      await new Promise((resolve) =>
        setTimeout(resolve, options.delayWallpaper),
      );
      return route.fallback();
    });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/hydrati|Minified React error #(?:418|423|425)/i.test(message.text()))
      errors.push(message.text());
  });
  await page.goto(`${baseURL}${options.pathname ?? "/learnwords"}`, {
    waitUntil: "domcontentloaded",
  });
  return { context, page, requests, intercepted, errors };
}

function assertBlur(state, mode, label) {
  assert.equal(state.mode, mode, `${label}: selected mode`);
  assert.equal(
    state.blur,
    `${config.getGlassBlurPx(mode)}px`,
    `${label}: configured blur radius`,
  );
  assert.equal(
    state.padding,
    `${config.getGlassBlurPadding(mode)}px`,
    `${label}: configured blur padding`,
  );
}

async function assertImmediateContent(run, label) {
  await run.page.waitForFunction(
    () => window.__liquidStartup.frames.length > 0,
  );
  const samples = await run.page.evaluate(() => ({
    frames: window.__liquidStartup.frames,
    pendingObserved: window.__liquidStartup.pendingObserved,
  }));
  assert.equal(
    samples.pendingObserved,
    false,
    `${label}: no pending gate attribute`,
  );
  for (const state of samples.frames) {
    assert.equal(state.pending, false, `${label}: no pending frame`);
    assert.equal(
      state.contentVisible,
      true,
      `${label}: content visible from first rendered frame`,
    );
    if (state.eligible > 0)
      assert.ok(
        state.visibleEligible > 0,
        `${label}: actual learning cards visible`,
      );
  }
  assert.deepEqual(run.errors, [], `${label}: no hydration/runtime errors`);
  return samples.frames;
}

async function waitReady(page, mode) {
  await page.waitForFunction(
    (mode) => {
      const state = window.__readLiquidStartup();
      return (
        state.mode === mode &&
        !state.pending &&
        state.contentVisible &&
        state.wallpaperReady &&
        (mode !== "liquid" ||
          (state.active > 0 && state.canvases > 0 && state.copies > 0))
      );
    },
    mode,
    { timeout: 20_000 },
  );
  const state = await page.evaluate(() => window.__readLiquidStartup());
  assertBlur(state, mode, "ready");
  return state;
}

async function startupCheck(browser, label, options = {}) {
  const run = await fixture(browser, options);
  try {
    if (options.blockBundles) {
      const frames = await assertImmediateContent(run, label);
      for (const state of frames)
        assertBlur(state, options.mode ?? "liquid", label);
      assert.ok(run.intercepted.bundles > 0);
      assert.equal(
        frames[0].canvases,
        0,
        "Content appears without React or liquid rendering",
      );
    } else if (options.failWallpaper) {
      await run.page.waitForLoadState("networkidle");
      const frames = await assertImmediateContent(run, label);
      assert.ok(run.intercepted.wallpapers > 0);
      assert.ok(
        frames.some((state) => !state.wallpaperReady),
        "Failed wallpaper never blocks content",
      );
    } else if (options.pathname === "/login") {
      await run.page.waitForLoadState("networkidle");
      await assertImmediateContent(run, label);
    } else {
      await waitReady(
        run.page,
        options.blockWebGL ? "glass" : (options.mode ?? "liquid"),
      );
      const frames = await assertImmediateContent(run, label);
      if (options.delayWallpaper || options.delayBundles) {
        assert.ok(
          options.delayWallpaper
            ? run.intercepted.wallpapers
            : run.intercepted.bundles,
        );
        assert.ok(
          frames.some((state) => state.contentVisible && state.canvases === 0),
          "Content is visible before liquid finishes preparing",
        );
      }
    }
    console.log(`PASS ${label}`);
    return run;
  } catch (error) {
    console.error(
      label,
      await run.page.evaluate(() => ({
        state: window.__readLiquidStartup(),
        samples: window.__liquidStartup,
      })),
    );
    await run.context.close();
    throw error;
  }
}

async function counters(page) {
  return page.evaluate(() => {
    const state = window.__liquidStartup;
    return {
      toBlob: state.toBlob,
      blobs: state.blobs.length,
      posts: state.posts.length,
      replies: state.replies.length,
    };
  });
}

async function switchCheck(run, prewarm) {
  const { page } = run;
  const initialMode = await page.evaluate(
    () => document.documentElement.dataset.glassMode,
  );
  const initial = await waitReady(page, initialMode);
  const alternateMode = initialMode === "liquid" ? "glass" : "liquid";
  if (
    prewarm &&
    config.getGlassBlurPx("liquid") !== config.getGlassBlurPx("glass")
  ) {
    await page.waitForFunction(
      () => {
        const state = window.__liquidStartup;
        return (
          state.posts.length > 0 &&
          state.replies.length === state.posts.length &&
          state.blobs.length >= 4 &&
          state.blobs.every((url) => state.decoded.includes(url))
        );
      },
      undefined,
      { timeout: 20_000 },
    );
    const worker = await page.evaluate(() => ({
      workers: window.__liquidStartup.workers,
      replies: window.__liquidStartup.replies,
    }));
    assert.ok(
      worker.workers.length > 0,
      "Alternate blur is prepared by a Worker",
    );
    assert.ok(
      worker.workers.every((instance) => instance.ready),
      "Worker starts only after current wallpaper is published",
    );
    assert.ok(
      worker.replies.every((reply) => !reply.error),
      "Prewarm Worker succeeds",
    );
    assert.equal(
      (await counters(page)).toBlob,
      worker.workers[0].toBlob,
      "Preparing the alternate blur does not encode on the main thread",
    );
    assert.equal(
      (await page.evaluate(() => window.__readLiquidStartup())).texture,
      initial.texture,
      "Preparing the inactive radius leaves the current wallpaper intact",
    );
  }
  const before = await counters(page);
  await chooseMode(page, alternateMode);
  const alternate = await waitReady(page, alternateMode);
  if (alternateMode === "glass") assert.equal(alternate.canvases, 0);
  if (config.getGlassBlurPx("liquid") !== config.getGlassBlurPx("glass"))
    assert.notEqual(
      alternate.texture,
      initial.texture,
      "Each radius uses its own texture",
    );
  await chooseMode(page, "card");
  assertBlur(
    await page.evaluate(() => window.__readLiquidStartup()),
    "card",
    `${alternateMode} → card`,
  );
  await chooseMode(page, initialMode);
  const restored = await waitReady(page, initialMode);
  assert.equal(
    restored.texture,
    initial.texture,
    `Returning to ${initialMode} reuses its cached texture`,
  );
  const after = await counters(page);
  if (prewarm)
    assert.deepEqual(
      after,
      before,
      "Switches after prewarm do not encode, create blobs, or submit Worker jobs",
    );
  else {
    assert.equal(after.posts, 0, "Unsupported Worker skips prewarming");
    if (config.getGlassBlurPx("liquid") !== config.getGlassBlurPx("glass"))
      assert.ok(
        after.toBlob > before.toBlob,
        "Unsupported Worker retains on-demand rendering",
      );
  }
  await assertImmediateContent(run, "mode switches");
  console.log(
    `PASS ${prewarm ? "Worker prewarm and cached" : "unsupported Worker on-demand"} mode switches from ${initialMode}`,
  );
}

const cases = [
  ...["card", "glass", "liquid"].map((mode) => [
    `blocked-${mode}`,
    `saved ${mode} with JavaScript blocked`,
    { mode, blockBundles: true },
  ]),
  [
    "wallpaper-delay",
    "delayed wallpaper keeps content visible",
    { delayWallpaper: 1_200 },
  ],
  [
    "js-delay",
    "delayed JavaScript keeps content visible",
    { delayBundles: 1_200 },
  ],
  [
    "wallpaper-failure",
    "failed wallpaper keeps content visible",
    { failWallpaper: true },
  ],
  ["no-webgl", "WebGL failure keeps content visible", { blockWebGL: true }],
  ["login", "login content is immediately visible", { pathname: "/login" }],
  ["prewarm", "liquid with background prewarming", {}],
  ["prewarm-glass", "glass with background prewarming", { mode: "glass" }],
  ["no-worker", "liquid without Worker support", { blockWorker: true }],
];
const requested = process.env.LIQUID_GLASS_STARTUP_CASES?.split(",");
const { chromium } = await loadPlaywright();
const chrome =
  process.env.CHROME_EXECUTABLE ??
  (existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe")
    ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : undefined);
const browser = await chromium.launch({
  headless: true,
  executablePath: chrome,
});
try {
  for (const [id, label, options] of cases) {
    if (requested && !requested.includes(id)) continue;
    const run = await startupCheck(browser, label, options);
    try {
      if (id.startsWith("prewarm") || id === "no-worker")
        await switchCheck(run, id.startsWith("prewarm"));
    } finally {
      await run.context.close();
    }
  }
  console.log("Immediate content and wallpaper prewarm regressions passed.");
} finally {
  await browser.close();
}
