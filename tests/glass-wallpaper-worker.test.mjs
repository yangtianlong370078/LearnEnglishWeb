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
        const bitmap = { closed: false, close() { this.closed = true; } };
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

test("inactive preparation starts lazily and transfers the existing photo", async () => {
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
