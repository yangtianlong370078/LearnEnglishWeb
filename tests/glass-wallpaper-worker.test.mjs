import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const helperUrl = new URL("../lib/glass-wallpaper-worker.ts", import.meta.url);
const source = ts.transpileModule(
  readFileSync(helperUrl, "utf8").replaceAll(
    "import.meta.url",
    JSON.stringify(helperUrl.href),
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;

function setup({ supported = true } = {}) {
  const workers = [];
  const bitmaps = [];
  const exports = {};

  runInNewContext(source, {
    exports,
    URL,
    DOMException,
    OffscreenCanvas: supported ? class {} : undefined,
    Worker: class {
      constructor(url) {
        assert.ok(url.pathname.endsWith("glass-wallpaper.worker.ts"));
        this.messages = [];
        workers.push(this);
      }
      terminate() {
        this.terminated = true;
      }
      postMessage(request, transfers) {
        this.messages.push({ request, transfers });
      }
    },
    createImageBitmap(image) {
      return new Promise((resolve, reject) => {
        const bitmap = {
          closed: false,
          close() {
            this.closed = true;
          },
        };
        bitmaps.push({ image, bitmap, resolve: () => resolve(bitmap), reject });
      });
    },
  });

  return {
    helper: exports.createGlassWallpaperWorker(),
    workers,
    bitmaps,
    flush: () => new Promise((resolve) => setImmediate(resolve)),
  };
}

const options = {
  width: 800,
  height: 600,
  scale: 1,
  dark: true,
  blurPx: 4,
  blurPadding: 16,
  saturation: 140,
  borderSaturation: 165,
  borderBrightness: 1.28,
  losslessWallpaper: false,
};

test("preparation starts lazily and transfers the existing photo", async () => {
  const env = setup();
  assert.equal(env.workers.length, 0);
  const image = {};
  const pending = env.helper.render(image, options);
  assert.equal(env.workers.length, 1);
  assert.equal(env.bitmaps[0].image, image);
  env.bitmaps[0].resolve();
  await env.flush();
  const worker = env.workers[0];
  const { request, transfers } = worker.messages[0];
  assert.equal(request.image, env.bitmaps[0].bitmap);
  assert.equal(transfers[0], request.image);
  assert.equal(request.blurPx, options.blurPx);
  const base = new Blob(["base"]);
  const border = new Blob(["border"]);
  worker.onmessage({ data: { id: request.id, base, border } });
  const result = await pending;
  assert.equal(result.base, base);
  assert.equal(result.border, border);
  env.helper.dispose();
  assert.equal(worker.terminated, true);
});

test("cancel closes a bitmap that finishes preparation after cancellation", async () => {
  const env = setup();
  const pending = env.helper.render({}, options);
  const canceled = assert.rejects(pending, { name: "AbortError" });
  env.helper.cancel();
  await canceled;
  env.bitmaps[0].resolve();
  await env.flush();
  assert.equal(env.workers[0].terminated, true);
  assert.equal(env.bitmaps[0].bitmap.closed, true);
  assert.equal(env.workers[0].messages.length, 0);
});

test("a new request terminates obsolete work and ignores its late response", async () => {
  const env = setup();
  const first = env.helper.render({}, options);
  const canceled = assert.rejects(first, { name: "AbortError" });
  env.bitmaps[0].resolve();
  await env.flush();
  const second = env.helper.render({}, { ...options, width: 1200 });
  await canceled;
  assert.equal(env.workers[0].terminated, true);
  env.workers[0].onmessage({
    data: { id: 1, base: "obsolete", border: "obsolete" },
  });
  env.workers[0].onerror();
  env.workers[0].onmessageerror();
  env.bitmaps[1].resolve();
  await env.flush();
  const worker = env.workers[1];
  assert.equal(worker.messages[0].request.width, 1200);
  worker.onmessage({ data: { id: 2, base: "current", border: "current" } });
  assert.equal((await second).base, "current");
  env.helper.dispose();
});

test("worker failures reject preparation and release the worker", async () => {
  const env = setup();
  const pending = env.helper.render({}, options);
  const failed = assert.rejects(pending, /OffscreenCanvas filters/);
  env.bitmaps[0].resolve();
  await env.flush();
  env.workers[0].onmessage({
    data: { id: 1, error: "OffscreenCanvas filters are unavailable" },
  });
  await failed;
  assert.equal(env.workers[0].terminated, true);
});

test("dispose aborts pending work and prevents further worker creation", async () => {
  const env = setup();
  const pending = env.helper.render({}, options);
  const canceled = assert.rejects(pending, { name: "AbortError" });
  env.helper.dispose();
  await canceled;
  await assert.rejects(env.helper.render({}, options), { name: "AbortError" });
  assert.equal(env.workers.length, 1);
  env.bitmaps[0].resolve();
  await env.flush();
  assert.equal(env.bitmaps[0].bitmap.closed, true);
});

test("unsupported browsers skip optional worker preparation", () => {
  const env = setup({ supported: false });
  assert.equal(env.helper, undefined);
  assert.equal(env.workers.length, 0);
});

test("ambient preparation sends the full CSS palette without allocating an image bitmap", async () => {
  const env = setup();
  const ambient = {
    base: "rgb(30 40 50)",
    colors: ["red", "green", "blue", "white"],
  };
  const pending = env.helper.render(undefined, { ...options, ambient });
  const worker = env.workers[0];
  const { request, transfers } = worker.messages[0];
  assert.equal(env.bitmaps.length, 0);
  assert.equal(request.ambient, ambient);
  assert.equal(request.image, undefined);
  assert.equal(transfers.length, 0);
  worker.onmessage({
    data: { id: request.id, base: "base", border: "border" },
  });
  assert.equal((await pending).base, "base");
  env.helper.dispose();
});

const rendererSource = ts.transpileModule(
  readFileSync(
    new URL("../lib/glass-wallpaper.worker.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;

function setupRenderer({ filterSupported = true, encodeFailure = false } = {}) {
  const buffers = [];
  const scope = {};
  const replies = [];
  scope.postMessage = (response) => replies.push(response);
  runInNewContext(rendererSource, {
    exports: {},
    self: scope,
    OffscreenCanvas: class {
      constructor(width, height) {
        this.width = width;
        this.height = height;
        this.initialSize = [width, height];
        this.calls = [];
        const record =
          (name) =>
          (...args) =>
            this.calls.push([name, ...args]);
        this.context = {
          ...(filterSupported ? { filter: "none" } : {}),
          scale: record("scale"),
          translate: record("translate"),
          drawImage: record("drawImage"),
          fillRect: record("fillRect"),
          save: record("save"),
          restore: record("restore"),
          createLinearGradient: () => ({ addColorStop: record("linearStop") }),
          createRadialGradient: () => ({ addColorStop: record("radialStop") }),
          createPattern: () => ({}),
          createImageData: (w, h) => ({
            data: new Uint8ClampedArray(w * h * 4),
          }),
          putImageData: record("noise"),
        };
        buffers.push(this);
      }
      getContext() {
        return this.context;
      }
      convertToBlob(encoding) {
        this.encoding = encoding;
        if (encodeFailure) return Promise.reject(new Error("encode failed"));
        return Promise.resolve(this);
      }
    },
  });
  return {
    buffers,
    replies,
    async render(request) {
      scope.onmessage({ data: request });
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(replies.length, 1);
      return replies[0];
    },
  };
}

test("worker photo rendering preserves full DPR, padded edge pixels, tint and encoded quality", async () => {
  for (const blurPx of [4, 8]) {
    const env = setupRenderer();
    const image = {
      width: 1920,
      height: 1080,
      closed: false,
      close() {
        this.closed = true;
      },
    };
    const response = await env.render({
      ...options,
      id: 1,
      image,
      scale: 3,
      blurPx,
    });
    assert.equal(response.error, undefined);
    const [source, expanded, base, tile, border] = env.buffers;
    assert.deepEqual(source.initialSize, [2400, 1800]);
    assert.deepEqual(expanded.initialSize, [2496, 1896]);
    assert.equal(
      expanded.calls.filter(([name]) => name === "drawImage").length,
      9,
    );
    assert.equal(base.context.filter, `blur(${blurPx * 3}px) saturate(140%)`);
    assert.equal(border.context.filter, "saturate(165%) brightness(1.28)");
    assert.deepEqual(base.initialSize, source.initialSize);
    assert.deepEqual(border.initialSize, source.initialSize);
    assert.equal(base.encoding.type, "image/jpeg");
    assert.equal(base.encoding.quality, 0.98);
    assert.equal(border.encoding.type, "image/jpeg");
    assert.ok(
      source.calls.some(
        (call) => call[0] === "linearStop" && call[2] === "rgb(5 10 24 / 0.32)",
      ),
    );
    assert.deepEqual(tile.initialSize, [128, 128]);
    assert.equal(image.closed, true);
    assert.ok(env.buffers.every((buffer) => buffer.width === 0));
  }
});

test("ambient backgrounds preserve all four gradient colors and always encode losslessly", async () => {
  const env = setupRenderer();
  const colors = [1, 2, 3, 4].map((i) => `rgb(${i} 20 30 / 0.5)`);
  const response = await env.render({
    ...options,
    id: 1,
    ambient: { base: "rgb(1 2 3)", colors },
  });
  assert.equal(response.error, undefined);
  const [source, , base, , border] = env.buffers;
  const stops = source.calls.filter(([name]) => name === "radialStop");
  assert.equal(stops.length, 8);
  assert.deepEqual(
    stops.filter(([, stop]) => stop === 0).map(([, , color]) => color),
    [...colors].reverse(),
  );
  assert.deepEqual(
    stops.filter(([, stop]) => stop > 0).map(([, , color]) => color),
    [...colors].reverse().map((color) => color.replace("0.5", "0")),
  );
  assert.equal(base.encoding.type, "image/png");
  assert.equal(border.encoding.type, "image/png");
  assert.ok(env.buffers.every((buffer) => buffer.width === 0));
});

test("render failures close the source bitmap and release every allocated drawing buffer", async () => {
  for (const settings of [
    { filterSupported: false },
    { encodeFailure: true },
  ]) {
    const env = setupRenderer(settings);
    const image = {
      width: 1920,
      height: 1080,
      closed: false,
      close() {
        this.closed = true;
      },
    };
    const response = await env.render({ ...options, id: 1, image });
    assert.ok(response.error);
    assert.equal(image.closed, true);
    assert.ok(env.buffers.every((buffer) => buffer.width === 0));
  }
});
