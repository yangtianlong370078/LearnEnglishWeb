import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function loadModule(name, dependencies = {}) {
  const compiled = ts.transpileModule(
    readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;
  const exports = {};

  runInNewContext(compiled, {
    exports,
    require: (dependency) => {
      if (!(dependency in dependencies))
        throw new Error(`Unexpected dependency ${dependency}`);

      return dependencies[dependency];
    },
  });

  return exports;
}

const geometry = loadModule("liquid-glass-geometry");
const { createLiquidGlassRenderer } = loadModule("liquid-glass-renderer", {
  "./liquid-glass-geometry": geometry,
});

function createGraphicsStub() {
  const calls = [];
  const gl = new Proxy(
    {
      NO_ERROR: 0,
      MAX_TEXTURE_SIZE: 1,
      MAX_VIEWPORT_DIMS: 2,
      MAX_RENDERBUFFER_SIZE: 3,
      isContextLost: () => false,
      getError: () => 0,
      getShaderParameter: () => true,
      getProgramParameter: () => true,
      getParameter: (parameter) => (parameter === 2 ? [4096, 4096] : 4096),
      getExtension: () => null,
    },
    {
      get(target, name) {
        if (name in target) return target[name];
        if (typeof name === "string" && name === name.toUpperCase())
          return name;

        return (...args) => {
          calls.push({ name, args });

          return {};
        };
      },
    },
  );
  const canvas = {
    width: 300,
    height: 150,
    getContext: (name) => {
      assert.equal(name, "webgl2");
      return gl;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  const document = {
    createElement: (tag) => {
      assert.equal(tag, "canvas");
      return canvas;
    },
  };

  return { canvas, calls, document };
}

const options = {
  maxDpr: 1,
  maxPixels: 1_500_000,
  edgeWidthPx: 20,
  edgeInsetPx: 1,
  refractionPx: 38,
  fresnelStrength: 0,
  dispersionPx: 1.25,
  bendPeak: 0.1,
  bendSharpness: 2.7,
  disableDispersion: false,
};

test("scrolling clips pixels without reallocating the atlas or uploading the static background again", () => {
  const { canvas, calls, document } = createGraphicsStub();
  const renderer = createLiquidGlassRenderer(document, options, () => {});
  const background = { naturalWidth: 800, naturalHeight: 600 };
  const viewport = { width: 800, height: 600, dpr: 1 };
  const item = { id: 1, x: 20, y: 20, width: 320, height: 500, radius: 18 };

  renderer.setBackground(background);
  const full = renderer.render([item], viewport)[0];
  const atlasWidth = canvas.width;
  const atlasHeight = canvas.height;
  const allocationCount = calls.filter(
    ({ name }) => name === "bufferData",
  ).length;
  const viewportCount = calls.filter(({ name }) => name === "viewport").length;

  for (let y = -300; y >= -450; y -= 15) {
    renderer.setBackground(background);
    const clipped = renderer.render([{ ...item, y }], viewport)[0];

    assert.ok(clipped.height < full.height);
    assert.equal(
      clipped.destination.height / clipped.height,
      full.destination.height / full.height,
    );
    assert.equal(canvas.width, atlasWidth);
    assert.equal(canvas.height, atlasHeight);
  }
  assert.equal(calls.filter(({ name }) => name === "texImage2D").length, 1);
  assert.equal(
    calls.filter(({ name }) => name === "bufferData").length,
    allocationCount,
  );
  assert.equal(
    calls.filter(({ name }) => name === "viewport").length,
    viewportCount,
  );
  renderer.setBackground({ naturalWidth: 800, naturalHeight: 600 });
  assert.equal(calls.filter(({ name }) => name === "texImage2D").length, 2);
  renderer.dispose();
  renderer.dispose();
  assert.equal(calls.filter(({ name }) => name === "deleteTexture").length, 1);
});
