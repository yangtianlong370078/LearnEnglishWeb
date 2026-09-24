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
  const workerState = { created: 0, cancelled: 0, disposed: 0 };
  let nextTask = 0;
  const worker = {
    render(image, options) {
      return new Promise((resolve, reject) =>
        workerCalls.push({ image, options, resolve, reject }),
      );
    },
    // Leave the result controllable after cancellation to exercise replies and
    // image decodes that were already queued when the work was superseded.
    cancel() {
      workerState.cancelled++;
    },
    dispose() {
      workerState.disposed++;
    },
  };
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
            return workerSupported ? worker : undefined;
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

test("each first wallpaper uses its configured mode radius at device scale", async () => {
  for (const [mode, scale] of [
    ["liquid", 1],
    ["liquid", 2],
    ["glass", 1],
    ["card", 2],
  ]) {
    const h = setup({ mode, scale });
    await h.flush();
    assert.deepEqual(h.filters, [expectedFilter(mode, scale)]);
    assert.equal(
      h.ready(),
      false,
      "textures must be decoded before publication",
    );
    await h.finishTexture();
    assert.equal(h.ready(), true);
    h.dispose();
  }
});

test("mode switches use the correct fallback until a matching texture is decoded", async () => {
  const h = setup();
  await h.finishTexture();
  const standard = h.variables.get("--glass-cached-base");
  assert.ok(h.observedOptions.attributeFilter.includes("data-glass-mode"));
  h.changeMode("liquid");
  assert.equal(h.ready(), false);
  await h.finishTexture();
  assert.equal(h.ready(), true);
  assert.notEqual(h.variables.get("--glass-cached-base"), standard);
  assert.deepEqual(h.filters, [
    expectedFilter("glass"),
    expectedFilter("liquid"),
  ]);
  h.changeMode("card");
  assert.equal(h.ready(), true);
  assert.equal(h.variables.get("--glass-cached-base"), standard);
  assert.equal(
    h.filters.length,
    2,
    "card and ordinary glass reuse one texture",
  );
  h.dispose();
});

test("rapid mode reversal restores the cached texture and rejects stale publication", async () => {
  const h = setup();
  await h.finishTexture();
  const standard = h.variables.get("--glass-cached-base");
  h.changeMode("liquid");
  await h.flush();
  h.changeMode("glass");
  assert.equal(h.ready(), true);
  assert.equal(h.variables.get("--glass-cached-base"), standard);
  await h.finishTexture();
  assert.equal(h.variables.get("--glass-cached-base"), standard);
  h.changeMode("liquid");
  assert.equal(h.ready(), true);
  assert.notEqual(h.variables.get("--glass-cached-base"), standard);
  assert.equal(h.filters.length, 2);
  h.dispose();
});

test("a failed new-mode texture keeps the correct CSS fallback and can recover", async () => {
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

test("theme changes continue to commit only with their matching decoded texture", async () => {
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
  await h.finishTexture();
  assert.equal(committed, true);
  assert.notEqual(h.variables.get("--glass-cached-base"), light);
  assert.deepEqual(h.filters, [
    expectedFilter("liquid"),
    expectedFilter("liquid"),
  ]);
  h.dispose();
});

async function startPrewarm(h) {
  await h.runFrames();
  await h.runIdle();
  assert.ok(
    h.workerCalls.length,
    "the alternate mode should render in a worker",
  );
  return h.workerCalls.at(-1);
}

async function finishPrewarm(h, job) {
  job.resolve({ base: {}, border: {} });
  await h.finishTexture();
}

test("the current mode publishes before a frame and idle callback may start alternate work", async () => {
  for (const mode of ["glass", "liquid"]) {
    const h = setup({ mode });
    await h.flush();
    assert.equal(h.ready(), false);
    assert.equal(h.frames.size, 0);
    assert.equal(h.workerState.created, 0);
    await h.finishTexture();
    assert.equal(h.ready(), true);
    assert.equal(h.workerState.created, 0);
    assert.equal(h.frames.size, 1);
    await h.runFrames();
    assert.equal(h.workerCalls.length, 0);
    assert.equal(h.idleCallbacks.size, 1);
    await h.runIdle();
    assert.equal(h.workerCalls.length, 1);
    const job = h.workerCalls[0];
    const alternate = mode === "liquid" ? "glass" : "liquid";
    assert.equal(job.options.blurPx, configuration.getGlassBlurPx(alternate));
    assert.equal(
      job.options.blurPadding,
      configuration.getGlassBlurPadding(alternate),
    );
    assert.equal(job.image.url, "/images/bg01_light.jpeg");
    assert.deepEqual(h.filters, [expectedFilter(mode)]);
    h.dispose();
  }
});

test("a warmed alternate never changes the displayed texture and later switches reuse both caches", async () => {
  const h = setup();
  await h.finishTexture();
  const standard = h.variables.get("--glass-cached-base");
  const job = await startPrewarm(h);
  await finishPrewarm(h, job);
  assert.equal(h.root.dataset.glassMode, "glass");
  assert.equal(h.variables.get("--glass-cached-base"), standard);
  assert.equal(h.ready(), true);
  assert.equal(h.created.length - h.revoked.length, 4);
  h.changeMode("liquid");
  assert.equal(h.ready(), true);
  assert.notEqual(h.variables.get("--glass-cached-base"), standard);
  h.changeMode("glass");
  assert.equal(h.variables.get("--glass-cached-base"), standard);
  await h.runFrames();
  await h.runIdle();
  assert.equal(h.workerCalls.length, 1);
  assert.deepEqual(h.filters, [expectedFilter("glass")]);
  h.dispose();
  assert.deepEqual(new Set(h.revoked), new Set(h.created));
});

test("selecting an in-flight alternate promotes its worker job without duplicate rendering", async () => {
  const h = setup();
  await h.finishTexture();
  const standard = h.variables.get("--glass-cached-base");
  const job = await startPrewarm(h);
  h.changeMode("liquid");
  await h.flush();
  assert.equal(h.ready(), false);
  assert.equal(h.workerState.cancelled, 0);
  assert.equal(h.workerCalls.length, 1);
  assert.equal(h.filters.length, 1);
  await finishPrewarm(h, job);
  assert.equal(h.ready(), true);
  assert.notEqual(h.variables.get("--glass-cached-base"), standard);
  assert.equal(h.root.dataset.glassMode, "liquid");
  assert.equal(h.filters.length, 1);
  h.dispose();
});

test("resize and theme changes cancel speculative work and ignore late worker results", async () => {
  for (const change of ["resize", "theme"]) {
    const h = setup();
    await h.finishTexture();
    const stale = await startPrewarm(h);
    if (change === "resize") {
      h.resize(1024);
      await h.runTimers(100);
    } else {
      h.changeTheme({ dark: true }, () => {
        h.root.dark = true;
      });
    }
    assert.equal(h.workerState.cancelled, 1);
    await h.finishTexture();
    const current = h.variables.get("--glass-cached-base");
    const replacement = await startPrewarm(h);
    assert.notEqual(replacement, stale);
    assert.equal(replacement.options.width, change === "resize" ? 1024 : 800);
    assert.equal(replacement.options.dark, change === "theme");
    await finishPrewarm(h, replacement);
    assert.equal(h.created.length - h.revoked.length, 4);
    const allocated = h.created.length;
    stale.resolve({ base: {}, border: {} });
    await h.flush();
    assert.equal(
      h.created.length,
      allocated,
      "stale blobs must not enter the cache",
    );
    assert.equal(h.decodes.length, 0);
    assert.equal(h.variables.get("--glass-cached-base"), current);
    h.changeMode("liquid");
    assert.equal(h.ready(), true);
    h.changeMode("glass");
    assert.equal(h.variables.get("--glass-cached-base"), current);
    assert.equal(
      h.filters.length,
      2,
      "late work must not evict either current-size mode",
    );
    h.dispose();
  }
});

test("a cancelled alternate decode releases its URLs without evicting current mode caches", async () => {
  const h = setup();
  await h.finishTexture();
  const stale = await startPrewarm(h);
  stale.resolve({ base: {}, border: {} });
  await h.flush();
  const staleDecodes = h.decodes.splice(0);
  assert.equal(staleDecodes.length, 2);
  const staleUrls = h.created.slice(-2);
  h.resize(1024);
  await h.runTimers(100);
  await h.finishTexture();
  const current = h.variables.get("--glass-cached-base");
  await finishPrewarm(h, await startPrewarm(h));
  for (const decode of staleDecodes) decode.resolve();
  await h.flush();
  assert.ok(staleUrls.every((url) => h.revoked.includes(url)));
  assert.equal(h.created.length - h.revoked.length, 4);
  assert.equal(h.variables.get("--glass-cached-base"), current);
  h.changeMode("liquid");
  assert.equal(h.ready(), true);
  h.changeMode("glass");
  assert.equal(h.variables.get("--glass-cached-base"), current);
  assert.equal(h.filters.length, 2);
  h.dispose();
});

test("disposing cancels scheduled and active background work and rejects late publication", async () => {
  for (const stage of ["frame", "idle", "worker", "decode"]) {
    const h = setup();
    await h.finishTexture();
    if (stage !== "frame") await h.runFrames();
    if (stage === "worker" || stage === "decode") await h.runIdle();
    const job = h.workerCalls[0];
    if (stage === "decode") {
      job.resolve({ base: {}, border: {} });
      await h.flush();
    }
    h.dispose();
    assert.equal(h.frames.size, 0);
    assert.equal(h.idleCallbacks.size, 0);
    assert.equal(h.timers.size, 0);
    if (job) {
      assert.equal(h.workerState.cancelled, 1);
      assert.equal(h.workerState.disposed, 1);
      if (stage === "worker") job.resolve({ base: {}, border: {} });
      for (const decode of h.decodes.splice(0)) decode.resolve();
    }
    await h.flush();
    assert.equal(h.ready(), false);
    assert.equal(h.variables.size, 0);
    assert.deepEqual(new Set(h.revoked), new Set(h.created));
  }
});

test("unsupported workers keep current and later foreground modes functional", async () => {
  const h = setup({ workerSupported: false });
  await h.finishTexture();
  const current = h.variables.get("--glass-cached-base");
  await h.runFrames();
  await h.runIdle();
  assert.equal(h.workerState.created, 1);
  assert.equal(h.ready(), true);
  assert.equal(h.variables.get("--glass-cached-base"), current);
  h.changeMode("liquid");
  await h.finishTexture();
  assert.equal(h.ready(), true);
  assert.deepEqual(h.filters, [
    expectedFilter("glass"),
    expectedFilter("liquid"),
  ]);
  await h.runFrames();
  await h.runIdle();
  assert.equal(h.workerState.created, 1);
  h.dispose();
});

test("a failed speculative worker preserves the current mode and a promoted job retries in Canvas", async () => {
  for (const promote of [false, true]) {
    const h = setup();
    await h.finishTexture();
    const current = h.variables.get("--glass-cached-base");
    const job = await startPrewarm(h);
    if (promote) h.changeMode("liquid");
    job.reject(new Error("OffscreenCanvas filtering unavailable"));
    await h.flush();
    assert.ok(h.workerState.disposed >= 1);
    if (!promote) {
      assert.equal(h.ready(), true);
      assert.equal(h.variables.get("--glass-cached-base"), current);
      assert.equal(h.filters.length, 1);
      h.changeMode("liquid");
    }
    await h.finishTexture();
    assert.equal(h.ready(), true);
    assert.notEqual(h.variables.get("--glass-cached-base"), current);
    assert.deepEqual(h.filters, [
      expectedFilter("glass"),
      expectedFilter("liquid"),
    ]);
    h.dispose();
  }
});

test("equal radii and incompatible backgrounds skip alternate generation", async () => {
  for (const options of [{ sameRadius: true }, { background: "defalut" }]) {
    const h = setup(options);
    await h.finishTexture();
    await h.runFrames();
    await h.runIdle();
    assert.equal(h.ready(), true);
    assert.equal(h.workerState.created, 0);
    assert.equal(h.filters.length, 1);
    h.dispose();
  }
});

test("browsers without idle callbacks defer speculative work until after the frame and timer", async () => {
  const h = setup({ idleSupported: false });
  await h.finishTexture();
  assert.equal(h.workerCalls.length, 0);
  await h.runFrames();
  assert.equal(h.workerCalls.length, 0);
  assert.equal(h.timers.size, 1);
  await h.runTimers(100);
  assert.equal(h.workerCalls.length, 1);
  assert.equal(h.ready(), true);
  h.dispose();
});
