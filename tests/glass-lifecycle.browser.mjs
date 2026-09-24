/**
 * Short lifecycle stress, not a long-duration leak proof.
 * node tests/glass-lifecycle.browser.mjs
 * Production server defaults to 8094, fictional APIs from the browser fixture.
 * GLASS_LIFECYCLE_ROUNDS=40 and GLASS_LIFECYCLE_OUTPUT=... are optional.
 * GLASS_LIFECYCLE_MODE=card runs the same UI cycle as a non-WebGL control.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseURL = process.env.LIQUID_GLASS_BASE_URL ?? "http://127.0.0.1:8094";
process.env.LIQUID_GLASS_BASE_URL = baseURL;
assert.notEqual(new URL(baseURL).port, "8090");
const { loadPlaywright, createContext, openFixture, chooseMode, counters } =
  await import("./liquid-glass.browser.mjs");
const rounds = Number(process.env.GLASS_LIFECYCLE_ROUNDS ?? 40);
const targetMode = process.env.GLASS_LIFECYCLE_MODE ?? "liquid";
assert.ok(["liquid", "card"].includes(targetMode));
const output =
  process.env.GLASS_LIFECYCLE_OUTPUT ??
  "docs/glass-lifecycle-2026-09-24-data.json";
const profile = {
  name: "desktop",
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  mobile: false,
};

function instrumentLifecycle() {
  const state = (window.__glassLife = {
    objects: new Map(),
    created: 0,
    revoked: 0,
    workersCreated: 0,
    workersTerminated: 0,
    workersActive: 0,
    maxObjects: 0,
    contextsCreated: 0,
  });
  const create = URL.createObjectURL,
    revoke = URL.revokeObjectURL;
  URL.createObjectURL = function (value) {
    const url = create.call(this, value);
    state.objects.set(url, { size: value.size ?? 0, type: value.type ?? "" });
    state.created++;
    state.maxObjects = Math.max(state.maxObjects, state.objects.size);
    return url;
  };
  URL.revokeObjectURL = function (url) {
    if (state.objects.delete(url)) state.revoked++;
    return revoke.call(this, url);
  };
  const context = HTMLCanvasElement.prototype.getContext;
  const seen = new WeakSet();
  HTMLCanvasElement.prototype.getContext = function (type, ...args) {
    const result = context.call(this, type, ...args);
    if (type === "webgl2" && result && !seen.has(result)) {
      seen.add(result);
      state.contextsCreated++;
    }
    return result;
  };
  if (window.Worker) {
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(...args) {
        super(...args);
        state.workersCreated++;
        state.workersActive++;
        this.__lifecycleTerminated = false;
      }
      terminate() {
        if (!this.__lifecycleTerminated) {
          this.__lifecycleTerminated = true;
          state.workersTerminated++;
          state.workersActive--;
        }
        return super.terminate();
      }
    };
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
const { context, requests } = await createContext(browser, profile);
await context.addInitScript(instrumentLifecycle);
const page = await context.newPage(),
  session = await context.newCDPSession(page),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await session.send("Performance.enable");
await session.send("HeapProfiler.enable");
const report = {
  startedAt: new Date().toISOString(),
  baseURL,
  browser: browser.version(),
  profile,
  rounds,
  targetMode,
  methodology: `One page, fictional courselearn data,${rounds} glass→${targetMode}→glass cycles (${rounds * 2} switches),8 rAF scroll steps per visit,viewport changes at10/20/30,GC only at like-for-like glass checkpoints. DOM/JS heap excludes GPU/decoded bitmap memory. Test-owned historical WebGL strong references cleared after checking each mode exit; active blob map stores metadata only; fixture records request strings outside the browser, and minor instrument metadata can grow. This checks short-run reuse/release, not long-term leaks, physical mobile battery, or hours of usage.`,
  checkpoints: [],
  cycles: [],
  errors,
  passed: false,
};

async function checkpoint(label) {
  await page.waitForFunction(() => window.__glassLife.workersActive === 0);
  await page.evaluate(() => {
    window.__liquidBench.contexts = window.__liquidBench.contexts.filter(
      (gl) => !gl.isContextLost(),
    );
  });
  await session.send("HeapProfiler.collectGarbage");
  const metrics = Object.fromEntries(
    (await session.send("Performance.getMetrics")).metrics.map(
      ({ name, value }) => [name, value],
    ),
  );
  const dom = await session.send("Memory.getDOMCounters");
  const state = await page.evaluate(() => {
    const s = window.__glassLife;
    return {
      mode: document.documentElement.dataset.glassMode,
      wallpaperReady: document.documentElement.hasAttribute(
        "data-glass-wallpaper-ready",
      ),
      blobCount: s.objects.size,
      blobEncodedBytes: [...s.objects.values()].reduce(
        (sum, b) => sum + b.size,
        0,
      ),
      blobsCreated: s.created,
      blobsRevoked: s.revoked,
      maxBlobs: s.maxObjects,
      workersCreated: s.workersCreated,
      workersTerminated: s.workersTerminated,
      workersActive: s.workersActive,
      contextsCreated: s.contextsCreated,
      viewport: { width: innerWidth, height: innerHeight },
      canvases: document.querySelectorAll(".liquid-glass-surface").length,
      liveContexts: window.__liquidBench.contexts.filter(
        (gl) => !gl.isContextLost(),
      ).length,
    };
  });
  const result = {
    label,
    elapsedMs: Date.now() - started,
    jsHeapAfterGcMiB: metrics.JSHeapUsedSize / 1024 ** 2,
    nodes: dom.nodes,
    listeners: dom.jsEventListeners,
    ...state,
  };
  report.checkpoints.push(result);
  console.log(JSON.stringify(result));
}

const started = Date.now();
try {
  await openFixture(page, "courselearn");
  await checkpoint("initial-glass");
  // Establish comparable warmed JS/runtime state before baseline GC.
  await chooseMode(page, targetMode);
  await chooseMode(page, "glass");
  assert.equal((await counters(page)).liveContexts, 0);
  await page.evaluate(() => {
    window.__liquidBench.contexts.length = 0;
  });
  await checkpoint("warmed-glass-baseline");
  for (let round = 1; round <= rounds; round++) {
    await chooseMode(page, targetMode);
    await page.evaluate(async () => {
      for (let step = 0; step < 8; step++) {
        scrollTo({ top: step % 2 ? 0 : 150, behavior: "instant" });
        await new Promise(requestAnimationFrame);
      }
    });
    const liquid = await counters(page);
    assert.equal(liquid.mode, targetMode);
    if (targetMode === "liquid") assert.ok(liquid.canvases > 0);
    else assert.equal(liquid.canvases, 0);
    assert.equal(liquid.liveContexts, targetMode === "liquid" ? 1 : 0);
    let resize = null;
    if ([10, 20, 30].includes(round)) {
      const texture = await page.evaluate(() =>
        document.documentElement.style.getPropertyValue("--glass-cached-base"),
      );
      const viewport =
        round === 20 ? profile.viewport : { width: 1400, height: 860 };
      await page.setViewportSize(viewport);
      await page.waitForFunction(
        (previous) =>
          document.documentElement.style.getPropertyValue(
            "--glass-cached-base",
          ) !== previous,
        texture,
      );
      resize = { viewport, cacheReplaced: true };
    }
    await chooseMode(page, "glass");
    const glass = await counters(page);
    assert.equal(glass.canvases, 0, "Liquid canvases released on every exit");
    assert.equal(glass.liveContexts, 0, "WebGL context released on every exit");
    report.cycles.push({
      round,
      targetCanvases: liquid.canvases,
      targetLiveContexts: liquid.liveContexts,
      glassCanvases: glass.canvases,
      glassLiveContexts: glass.liveContexts,
      resize,
    });
    // The reused counter fixture otherwise retains every historical context.
    await page.evaluate(() => {
      window.__liquidBench.contexts.length = 0;
    });
    if (round % 10 === 0) await checkpoint(`after-${round}-cycles-glass`);
  }
  await page.setViewportSize(profile.viewport);
  await page.waitForTimeout(1000);
  await checkpoint("restored-viewport-glass");
  await chooseMode(page, targetMode);
  report.finalLiquid = await counters(page);
  if (targetMode === "liquid") assert.ok(report.finalLiquid.canvases > 0);
  else assert.equal(report.finalLiquid.canvases, 0);
  assert.equal(
    report.finalLiquid.liveContexts,
    targetMode === "liquid" ? 1 : 0,
  );
  await chooseMode(page, "glass");
  await checkpoint("final-glass-after-last-release");
  assert.deepEqual(errors, []);
  assert.deepEqual(requests.unknownAPI, []);
  assert.deepEqual(requests.blockedWrites, []);
  report.passed = true;
} catch (error) {
  report.failure = { message: error.message, stack: error.stack };
  throw error;
} finally {
  report.finishedAt = new Date().toISOString();
  report.elapsedMs = Date.now() - started;
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2));
  await context.close();
  await browser.close();
  console.log(`Report: ${output}`);
}
