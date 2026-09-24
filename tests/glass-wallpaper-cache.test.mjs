import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function compile(relativePath) {
  return ts.transpileModule(
    readFileSync(new URL(relativePath, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;
}

const source = compile("../lib/glass-wallpaper-cache.ts");
const configuration = {};
runInNewContext(compile("../config/glass.ts"), { exports: configuration });

// Control asynchronous image decoding so a mode can change while its texture
// is still pending. Canvas records the actual convolution passed by the cache.
function setup({
  mode = "glass",
  scale = 1,
  background = "magnificent",
  workerSupported = true,
  idleSupported = true,
  sameRadius = false,
} = {}) {
  const config = {};
  runInNewContext(compile("../config/glass.ts"), { exports: config });
  if (sameRadius) config.glassConfig.liquidBlurPx = config.glassConfig.blurPx;
  const attributes = new Set();
  const variables = new Map();
  const filters = [];
  const decodes = [];
  const revoked = [];
  const created = [];
  const frames = new Map();
  const idleCallbacks = new Map();
  const timers = new Map();
  const listeners = new Map();
  const workerCalls = [];
  const workerState = { created: 0, disposed: 0 };
  let nextTask = 0;
  function createWorker() {
    const instance = { disposed: false };
    return {
      render(image, options) {
        return new Promise((resolve, reject) => {
          const call = { image, options, instance, settled: false };
          call.resolve = (result) => {
            call.settled = true;
            resolve(result);
          };
          call.reject = (error) => {
            call.settled = true;
            reject(error);
          };
          workerCalls.push(call);
        });
      },
      // Keep stale results controllable to model replies/decodes already queued
      // when termination invalidates the job.
      dispose() {
        instance.disposed = true;
        workerState.disposed++;
      },
    };
  }
  const root = {
    clientWidth: 800,
    dataset: { bgTheme: background, glassMode: mode },
    dark: false,
    classList: { contains: () => root.dark },
    setAttribute: (name) => attributes.add(name),
    removeAttribute: (name) => attributes.delete(name),
    hasAttribute: (name) => attributes.has(name),
    style: {
      setProperty: (name, value) => variables.set(name, value),
      removeProperty: (name) => variables.delete(name),
    },
  };
  let update;
  let observedOptions;
  let nextUrl = 0;
  const document = {
    documentElement: root,
    defaultView: {
      innerHeight: 600,
      devicePixelRatio: scale,
      addEventListener: (name, callback) => listeners.set(name, callback),
      removeEventListener: (name) => listeners.delete(name),
      setTimeout(callback, delay) {
        const id = ++nextTask;
        timers.set(id, { callback, delay });
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
      requestAnimationFrame(callback) {
        const id = ++nextTask;
        frames.set(id, callback);
        return id;
      },
      cancelAnimationFrame: (id) => frames.delete(id),
      ...(idleSupported
        ? {
            requestIdleCallback(callback) {
              const id = ++nextTask;
              idleCallbacks.set(id, callback);
              return id;
            },
            cancelIdleCallback: (id) => idleCallbacks.delete(id),
          }
        : {}),
      getComputedStyle: () => ({
        getPropertyValue: () => "rgb(255 255 255 / 0.5)",
      }),
    },
    createElement(name) {
      assert.equal(name, "canvas");
      const context = {
        filter: "none",
        scale() {},
        save() {},
        restore() {},
        translate() {},
        drawImage() {},
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} }),
        fillRect() {},
        createImageData: () => ({ data: new Uint8ClampedArray(4) }),
        putImageData() {},
        createPattern: () => ({}),
      };
      return {
        getContext: () => context,
        toBlob(callback) {
          if (context.filter.startsWith("blur(")) filters.push(context.filter);
          callback({});
        },
      };
    },
  };
  const exports = {};
  runInNewContext(source, {
    exports,
    require(name) {
      if (name === "./glass-wallpaper-worker")
        return {
          createGlassWallpaperWorker() {
            workerState.created++;
            return workerSupported ? createWorker() : undefined;
          },
        };
      assert.equal(name, "@/config/glass");
      return config;
    },
    queueMicrotask,
    Image: class {
      width = 1920;
      height = 1080;
      set src(url) {
        this.url = url;
        queueMicrotask(() => this.onload());
      }
      decode() {
        if (this.url.startsWith("/images/")) return Promise.resolve();
        return new Promise((resolve, reject) =>
          decodes.push({ resolve, reject }),
        );
      }
    },
    URL: {
      createObjectURL: () => {
        const url = `blob:test-${++nextUrl}`;
        created.push(url);
        return url;
      },
      revokeObjectURL: (url) => revoked.push(url),
    },
    MutationObserver: class {
      constructor(callback) {
        update = callback;
      }
      observe(_target, options) {
        observedOptions = options;
      }
      disconnect() {}
    },
  });
  const dispose = exports.createGlassWallpaperCache(document);
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  async function runCallbacks(collection) {
    const callbacks = [...collection.values()];
    collection.clear();
    for (const callback of callbacks) callback();
    await flush();
  }
  return {
    filters,
    root,
    variables,
    decodes,
    revoked,
    created,
    workerCalls,
    workerState,
    frames,
    idleCallbacks,
    timers,
    listeners,
    observedOptions,
    dispose,
    flush,
    runFrames: () => runCallbacks(frames),
    runIdle: () => runCallbacks(idleCallbacks),
    async runTimers(delay) {
      const callbacks = [];
      for (const [id, timer] of timers) {
        if (delay !== undefined && timer.delay !== delay) continue;
        timers.delete(id);
        callbacks.push(timer.callback);
      }
      for (const callback of callbacks) callback();
      await flush();
    },
    ready: () => attributes.has("data-glass-wallpaper-ready"),
    async finishTexture({ fail = false } = {}) {
      await flush();
      const foreground = workerCalls.findLast(
        (call) => !call.settled && !call.instance.disposed,
      );
      if (foreground) {
        foreground.resolve({ base: {}, border: {} });
        await flush();
      }
      const pending = decodes.splice(0);
      assert.ok(pending.length, "a rendered texture must be awaiting decode");
      for (const item of pending) {
        if (fail) item.reject(new Error("Image decode failed"));
        else item.resolve();
      }
      await flush();
    },
    changeMode(mode) {
      root.dataset.glassMode = mode;
      update();
    },
    refresh: () => update(),
    resize(width, height = 600) {
      root.clientWidth = width;
      document.defaultView.innerHeight = height;
      listeners.get("resize")();
    },
    changeTheme(change, commit) {
      return exports.setGlassTheme(document, change, commit);
    },
  };
}

const expectedFilter = (mode, scale = 1) =>
  `blur(${configuration.getGlassBlurPx(mode) * scale}px) saturate(${configuration.glassConfig.saturation}%)`;

async function startPrewarm(h) {
  const before = h.workerCalls.length;
  await h.runFrames();
  await h.runIdle();
  assert.equal(h.workerCalls.length, before + 1);
  return h.workerCalls.at(-1);
}

test("the requested mode renders first off-thread at full device resolution", async () => {
  for (const [mode, scale] of [
    ["glass", 1],
    ["liquid", 2],
    ["card", 3],
  ]) {
    const h = setup({ mode, scale });
    await h.flush();
    assert.equal(h.workerCalls.length, 1);
    const { options, image } = h.workerCalls[0];
    assert.equal(options.width, 800);
    assert.equal(options.height, 600);
    assert.equal(options.scale, scale);
    assert.equal(options.blurPx, configuration.getGlassBlurPx(mode));
    assert.equal(options.blurPadding, configuration.getGlassBlurPadding(mode));
    assert.equal(options.saturation, configuration.glassConfig.saturation);
    assert.equal(
      options.borderSaturation,
      configuration.glassConfig.borderSaturation,
    );
    assert.equal(
      options.borderBrightness,
      configuration.glassConfig.borderBrightness,
    );
    assert.equal(
      options.losslessWallpaper,
      configuration.glassConfig.losslessWallpaper,
    );
    assert.equal(image.url, "/images/bg01_light.jpeg");
    assert.deepEqual(
      h.filters,
      [],
      "foreground convolution must leave the main thread",
    );
    assert.equal(h.ready(), false);
    assert.equal(h.frames.size, 0);
    await h.finishTexture();
    assert.equal(h.ready(), true);
    assert.equal(h.workerState.disposed, 1);
    assert.equal(h.workerCalls.length, 1);
    await h.runFrames();
    assert.equal(h.workerCalls.length, 1);
    assert.equal(h.idleCallbacks.size, 1);
    await h.runIdle();
    assert.equal(h.workerCalls.length, 2);
    assert.equal(
      h.workerCalls[1].options.blurPx,
      configuration.getGlassBlurPx(mode === "liquid" ? "glass" : "liquid"),
    );
    h.dispose();
  }
});

test("decoded alternate textures are reused immediately and card shares glass radius", async () => {
  const h = setup();
  await h.finishTexture();
  const standard = h.variables.get("--glass-cached-base");
  await startPrewarm(h);
  await h.finishTexture();
  assert.equal(h.variables.get("--glass-cached-base"), standard);
  assert.equal(h.created.length - h.revoked.length, 4);
  h.changeMode("liquid");
  assert.equal(h.ready(), true);
  assert.notEqual(h.variables.get("--glass-cached-base"), standard);
  h.changeMode("card");
  assert.equal(h.variables.get("--glass-cached-base"), standard);
  h.changeMode("glass");
  await h.runFrames();
  await h.runIdle();
  assert.equal(h.workerCalls.length, 2);
  assert.deepEqual(h.filters, []);
  h.dispose();
  assert.deepEqual(new Set(h.revoked), new Set(h.created));
});

test("selecting an in-flight alternate promotes the same job without duplicate rendering", async () => {
  const h = setup();
  await h.finishTexture();
  const standard = h.variables.get("--glass-cached-base");
  const job = await startPrewarm(h);
  h.changeMode("liquid");
  await h.flush();
  assert.equal(h.ready(), false);
  assert.equal(job.instance.disposed, false);
  assert.equal(h.workerCalls.length, 2);
  await h.finishTexture();
  assert.equal(h.ready(), true);
  assert.notEqual(h.variables.get("--glass-cached-base"), standard);
  h.dispose();
});

test("a new foreground mode cancels the obsolete foreground job and ignores its late result", async () => {
  const h = setup();
  await h.flush();
  const stale = h.workerCalls[0];
  h.changeMode("liquid");
  assert.equal(stale.instance.disposed, true);
  await h.flush();
  assert.equal(h.workerCalls.length, 2);
  await h.finishTexture();
  const current = h.variables.get("--glass-cached-base");
  const allocated = h.created.length;
  stale.resolve({ base: {}, border: {} });
  await h.flush();
  assert.equal(h.created.length, allocated);
  assert.equal(h.variables.get("--glass-cached-base"), current);
  assert.equal(
    h.filters.length,
    0,
    "cancellation must not trigger a Canvas fallback",
  );
  h.dispose();
});

test("rapid mode reversal restores cached content and prevents canceled work entering the cache", async () => {
  const h = setup();
  await h.finishTexture();
  const standard = h.variables.get("--glass-cached-base");
  h.changeMode("liquid");
  await h.flush();
  const stale = h.workerCalls.at(-1);
  h.changeMode("glass");
  assert.equal(h.ready(), true);
  assert.equal(h.variables.get("--glass-cached-base"), standard);
  stale.resolve({ base: {}, border: {} });
  await h.flush();
  assert.equal(h.created.length, 2);
  h.changeMode("liquid");
  assert.equal(h.ready(), false);
  await h.finishTexture();
  assert.equal(h.ready(), true);
  assert.equal(h.workerCalls.length, 3);
  h.dispose();
});

test("theme changes commit atomically with their decoded matching texture", async () => {
  const h = setup({ mode: "liquid" });
  await h.finishTexture();
  const light = h.variables.get("--glass-cached-base");
  let committed = false;
  h.changeTheme({ dark: true }, () => {
    committed = true;
    h.root.dark = true;
  });
  await h.flush();
  assert.equal(committed, false);
  assert.equal(h.ready(), true);
  assert.equal(h.variables.get("--glass-cached-base"), light);
  assert.equal(h.workerCalls.at(-1).image.url, "/images/bg01_dark.jpeg");
  await h.finishTexture();
  assert.equal(committed, true);
  assert.notEqual(h.variables.get("--glass-cached-base"), light);
  h.dispose();
});

test("resize interrupts current work immediately and batches successive sizes into one latest render", async () => {
  for (const stage of ["foreground", "prewarm"]) {
    const h = setup();
    if (stage === "prewarm") {
      await h.finishTexture();
      await startPrewarm(h);
    } else await h.flush();
    const stale = h.workerCalls.at(-1);
    const before = h.workerCalls.length;
    h.resize(900);
    assert.equal(stale.instance.disposed, true);
    h.resize(1000);
    h.resize(1200, 700);
    assert.equal(h.timers.size, 1);
    assert.equal(h.workerCalls.length, before);
    await h.runTimers(100);
    assert.equal(h.workerCalls.length, before + 1);
    assert.equal(h.workerCalls.at(-1).options.width, 1200);
    assert.equal(h.workerCalls.at(-1).options.height, 700);
    await h.finishTexture();
    const current = h.variables.get("--glass-cached-base");
    await startPrewarm(h);
    await h.finishTexture();
    const allocated = h.created.length;
    stale.resolve({ base: {}, border: {} });
    await h.flush();
    assert.equal(h.created.length, allocated);
    assert.equal(h.created.length - h.revoked.length, 4);
    assert.equal(h.variables.get("--glass-cached-base"), current);
    h.dispose();
  }
});

test("cancellation during decode releases URLs and never evicts the two current-size entries", async () => {
  const h = setup();
  await h.flush();
  h.workerCalls[0].resolve({ base: {}, border: {} });
  await h.flush();
  const staleDecodes = h.decodes.splice(0);
  assert.equal(staleDecodes.length, 2);
  const staleUrls = [...h.created];
  h.resize(1024);
  await h.runTimers(100);
  await h.finishTexture();
  const current = h.variables.get("--glass-cached-base");
  await startPrewarm(h);
  await h.finishTexture();
  for (const decode of staleDecodes) decode.resolve();
  await h.flush();
  assert.ok(staleUrls.every((url) => h.revoked.includes(url)));
  assert.equal(h.created.length - h.revoked.length, 4);
  assert.equal(h.variables.get("--glass-cached-base"), current);
  h.dispose();
});

test("worker failures fall back once on the foreground and preserve exact Canvas parameters", async () => {
  for (const promote of [false, true]) {
    const h = setup({ scale: 2 });
    if (promote) {
      await h.finishTexture();
      await startPrewarm(h);
      h.changeMode("liquid");
    } else await h.flush();
    h.workerCalls
      .at(-1)
      .reject(new Error("OffscreenCanvas filters are unavailable"));
    await h.finishTexture();
    assert.equal(h.ready(), true);
    assert.deepEqual(h.filters, [
      expectedFilter(promote ? "liquid" : "glass", 2),
    ]);
    await h.runFrames();
    await h.runIdle();
    assert.equal(h.workerCalls.length, promote ? 2 : 1);
    h.dispose();
  }
});

test("failed speculative work preserves the visible mode and later uses Canvas on demand", async () => {
  const h = setup();
  await h.finishTexture();
  const current = h.variables.get("--glass-cached-base");
  const job = await startPrewarm(h);
  job.reject(new Error("worker blocked"));
  await h.flush();
  assert.equal(h.ready(), true);
  assert.equal(h.variables.get("--glass-cached-base"), current);
  assert.equal(h.filters.length, 0);
  h.changeMode("liquid");
  await h.finishTexture();
  assert.equal(h.ready(), true);
  assert.deepEqual(h.filters, [expectedFilter("liquid")]);
  h.dispose();
});

test("unsupported workers retain Canvas rendering and do not prewarm on the main thread", async () => {
  const h = setup({ workerSupported: false });
  await h.finishTexture();
  await h.runFrames();
  await h.runIdle();
  h.changeMode("liquid");
  await h.finishTexture();
  assert.equal(h.ready(), true);
  assert.deepEqual(h.filters, [
    expectedFilter("glass"),
    expectedFilter("liquid"),
  ]);
  assert.equal(h.workerState.created, 1);
  h.dispose();
});

test("ambient colors use worker rendering while incompatible backgrounds and equal radii skip prewarm", async () => {
  for (const options of [{ sameRadius: true }, { background: "defalut" }]) {
    const h = setup(options);
    await h.finishTexture();
    await h.runFrames();
    await h.runIdle();
    assert.equal(h.workerCalls.length, 1);
    if (options.background) {
      assert.equal(h.workerCalls[0].image, undefined);
      assert.equal(h.workerCalls[0].options.ambient.colors.length, 4);
      assert.equal(
        h.workerCalls[0].options.ambient.base,
        "rgb(255 255 255 / 0.5)",
      );
    }
    assert.deepEqual(h.filters, []);
    h.dispose();
  }
});

test("decode failure releases its URLs, preserves the mode fallback, and allows later recovery", async () => {
  const h = setup();
  await h.finishTexture();
  const standard = h.variables.get("--glass-cached-base");
  h.changeMode("liquid");
  await h.finishTexture({ fail: true });
  assert.equal(h.ready(), false);
  assert.equal(h.revoked.length, 2);
  h.changeMode("glass");
  assert.equal(h.ready(), true);
  assert.equal(h.variables.get("--glass-cached-base"), standard);
  h.dispose();
});

test("disposal cancels foreground, scheduled and speculative work without late publication", async () => {
  for (const stage of ["foreground", "frame", "idle", "worker", "decode"]) {
    const h = setup();
    if (stage !== "foreground") await h.finishTexture();
    else await h.flush();
    if (["idle", "worker", "decode"].includes(stage)) await h.runFrames();
    if (["worker", "decode"].includes(stage)) await h.runIdle();
    const job = h.workerCalls.at(-1);
    if (stage === "decode") {
      job.resolve({ base: {}, border: {} });
      await h.flush();
    }
    h.dispose();
    assert.equal(h.frames.size, 0);
    assert.equal(h.idleCallbacks.size, 0);
    assert.equal(h.timers.size, 0);
    assert.equal(job.instance.disposed, true);
    if (!job.settled) job.resolve({ base: {}, border: {} });
    for (const decode of h.decodes.splice(0)) decode.resolve();
    await h.flush();
    assert.equal(h.ready(), false);
    assert.equal(h.variables.size, 0);
    assert.deepEqual(new Set(h.revoked), new Set(h.created));
  }
});

test("without idle callbacks only alternate preparation waits for the frame and timer", async () => {
  const h = setup({ idleSupported: false });
  await h.flush();
  assert.equal(h.workerCalls.length, 1);
  await h.finishTexture();
  await h.runFrames();
  assert.equal(h.workerCalls.length, 1);
  assert.equal(h.timers.size, 1);
  await h.runTimers(100);
  assert.equal(h.workerCalls.length, 2);
  assert.equal(h.ready(), true);
  h.dispose();
});

test("unchanged root state reuses the static wallpaper and scrolling has no cache work", async () => {
  const h = setup();
  await h.finishTexture();
  await startPrewarm(h);
  await h.finishTexture();
  const current = h.variables.get("--glass-cached-base");
  for (let i = 0; i < 20; i++) h.refresh();
  await h.runFrames();
  await h.runIdle();
  assert.equal(h.workerCalls.length, 2);
  assert.equal(h.created.length, 4);
  assert.equal(h.variables.get("--glass-cached-base"), current);
  assert.equal(h.listeners.has("scroll"), false);
  h.dispose();
});

test("a failed speculative decode does not loop or disturb current content", async () => {
  const h = setup();
  await h.finishTexture();
  const current = h.variables.get("--glass-cached-base");
  await startPrewarm(h);
  await h.finishTexture({ fail: true });
  for (let i = 0; i < 3; i++) {
    await h.runFrames();
    await h.runIdle();
  }
  assert.equal(h.workerCalls.length, 2);
  assert.equal(h.frames.size, 0);
  assert.equal(h.idleCallbacks.size, 0);
  assert.equal(h.ready(), true);
  assert.equal(h.variables.get("--glass-cached-base"), current);
  h.changeMode("liquid");
  await h.finishTexture();
  assert.equal(h.ready(), true);
  assert.deepEqual(h.filters, [expectedFilter("liquid")]);
  h.dispose();
});
