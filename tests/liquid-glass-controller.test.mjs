import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(
  readFileSync(
    new URL("../lib/liquid-glass-controller.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;

const resizeModule = {};
runInNewContext(
  ts.transpileModule(
    readFileSync(new URL("../lib/liquid-glass-resize.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText,
  { exports: resizeModule },
);

async function setup({ incrementalResize = false } = {}) {
  const jobs = new Set(),
    observers = [],
    events = new Map();
  const renderer = { draws: 0, uploads: 0, disposed: false, canvas: {} };
  let clock = 0;
  class Element {
    style = {
      setProperty(name, value) { this[name] = value; },
      removeProperty(name) { delete this[name]; },
    };
    attributes = new Map();
    children = [];
    isConnected = true;
    className = "";
    bounds = { x: 20, y: 20, width: 120, height: 100 };
    classList = {
      contains: (name) => this.className.split(" ").includes(name),
    };
    setAttribute(name, value = "") {
      this.attributes.set(name, value);
    }
    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    }
    hasAttribute(name) {
      return this.attributes.has(name);
    }
    removeAttribute(name) {
      this.attributes.delete(name);
    }
    append(node) {
      this.children.push(node);
      node.parent = this;
    }
    replaceChild(node, previous) {
      assert.ok(node.copies > 0, "Paint the replacement before publishing it");
      assert.ok(
        this.children.includes(previous),
        "Keep the previous frame until replacement",
      );
      this.children[this.children.indexOf(previous)] = node;
      node.parent = this;
      previous.parent = undefined;
    }
    remove() {
      if (this.parent)
        this.parent.children = this.parent.children.filter(
          (node) => node !== this,
        );
    }
    closest() {
      return null;
    }
    querySelector() {
      return null;
    }
    getBoundingClientRect() {
      const b = this.bounds;
      return {
        ...b,
        left: b.x,
        top: b.y,
        right: b.x + b.width,
        bottom: b.y + b.height,
      };
    }
  }
  class Observer {
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }
    observe(target) {
      this.target = target;
    }
    unobserve() {}
    disconnect() {
      this.disconnected = true;
    }
  }
  const root = new Element(),
    body = new Element(),
    head = new Element();
  let source = 'url("blob:wallpaper-1")';
  root.clientWidth = 400;
  root.style.getPropertyValue = () => source;
  root.setAttribute("data-glass-wallpaper-ready", "");
  const layers = [new Element(), new Element()];
  if (incrementalResize) {
    layers[0].parentElement = new Element();
    layers[0].parentElement.setAttribute("data-glass-incremental-resize", "");
  }
  layers[1].bounds = { x: 180, y: 30, width: 150, height: 110 };
  const view = {
    innerWidth: 400,
    innerHeight: 600,
    devicePixelRatio: 1,
    performance: { now: () => ++clock },
    matchMedia: () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }),
    addEventListener: (name, fn) => events.set(name, fn),
    removeEventListener: (name) => events.delete(name),
    clearTimeout() {},
    setTimeout: () => 1,
    getComputedStyle: () => ({ borderTopLeftRadius: "24px" }),
  };
  const document = {
    defaultView: view,
    documentElement: root,
    body,
    head,
    hidden: false,
    querySelectorAll: () => layers,
    addEventListener: (name, fn) => events.set(name, fn),
    removeEventListener: (name) => events.delete(name),
    createElement(name) {
      const element = new Element();
      if (name === "canvas") {
        element.copies = 0;
        element.styleWrites = 0;
        element.resizes = 0;
        element.visibleResizes = 0;
        for (const dimension of ["width", "height"]) {
          let value = 0;
          Object.defineProperty(element, dimension, {
            get: () => value,
            set(next) {
              value = next;
              element.resizes++;
              if (element.parent?.children.includes(element))
                element.visibleResizes++;
            },
          });
        }
        element.style = new Proxy(
          {},
          {
            set(target, key, value) {
              element.styleWrites++;
              // Model the browser's finite-precision CSSOM serialization.
              target[key] = String(value).endsWith("%")
                ? `${Number(parseFloat(value).toFixed(4))}%`
                : value;
              return true;
            },
          },
        );
        element.getContext = () => ({
          clearRect(...args) {
            element.lastClear = args;
          },
          drawImage(...args) {
            element.copies++;
            element.lastCopy = args;
            element.composite = this.globalCompositeOperation;
          },
        });
      }
      return element;
    },
  };
  const modules = {
    "./liquid-glass-resize": resizeModule,
    "./glass-frame": {
      scheduleGlassFrame: (_view, job) => jobs.add(job),
      cancelGlassFrame: (_view, job) => jobs.delete(job),
    },
    "./glass-surface-source": { subscribeGlassSurfaceChanges: () => () => {} },
    "./liquid-glass-renderer": {
      createLiquidGlassRenderer() {
        return {
          canvas: renderer.canvas,
          setBackground() {
            renderer.uploads++;
          },
          dispose() {
            renderer.disposed = true;
          },
          render(items, viewport, regions) {
            renderer.draws++;
            return items.map((item, index) => {
              if (regions) {
                const region = regions[index];
                return {
                  x: 1,
                  y: 1,
                  width: Math.round(region.width * viewport.dpr),
                  height: Math.round(region.height * viewport.dpr),
                };
              }
              const clip = Math.max(0, -item.x);
              return {
                id: item.id,
                x: 1 + clip,
                y: 1,
                width: item.width - clip,
                height: item.height,
                fullWidth: item.width,
                fullHeight: item.height,
                fullPixelWidth: item.width,
                fullPixelHeight: item.height,
                destinationPixels: {
                  x: clip,
                  y: 0,
                  width: item.width - clip,
                  height: item.height,
                },
                destination: {
                  x: clip,
                  y: 0,
                  width: item.width - clip,
                  height: item.height,
                },
              };
            });
          },
        };
      },
    },
    "@/config/liquid-glass": {
      liquidGlassConfig: {
        mobileBreakpointPx: 768,
        desktop: { maxCards: 20, maxDpr: 1, maxPixels: 1_500_000 },
        edgeWidthPx: 20,
        edgeInsetPx: 1,
        adaptive: { enabled: false, scrollEndDelayMs: 160 },
      },
    },
  };
  class Image {
    set src(value) {
      this.url = value;
      queueMicrotask(() => this.onload?.());
    }
  }
  const exports = {};
  runInNewContext(code, {
    exports,
    require: (name) => modules[name],
    Element,
    Image,
    MutationObserver: Observer,
    ResizeObserver: Observer,
    IntersectionObserver: Observer,
    TransitionEvent: class {},
    queueMicrotask,
  });
  const dispose = exports.createLiquidGlassController(document, () =>
    assert.fail("Unexpected fallback"),
  );
  const flush = () => {
    const work = [...jobs];
    jobs.clear();
    work.map((job) => job()).forEach((paint) => paint());
  };
  await Promise.resolve();
  flush();
  return {
    root,
    body,
    layers,
    renderer,
    dispose,
    jobs,
    flush,
    scroll() {
      events.get("scroll")();
      flush();
    },
    async changeSource() {
      source = 'url("blob:wallpaper-2")';
      observers.find((observer) => observer.target === root).callback([]);
      await Promise.resolve();
      flush();
    },
    modal(open) {
      if (open) body.setAttribute("data-glass-modal-open", "");
      else body.removeAttribute("data-glass-modal-open");
      events.get("scroll")();
      flush();
    },
  };
}

test("scroll reuses the static texture and skips copies for unchanged fixed cards", async () => {
  const h = await setup();
  const first = h.layers[0].children[0],
    fixed = h.layers[1].children[0];
  assert.equal(h.renderer.uploads, 1);
  assert.equal(first.copies, 1);
  assert.equal(fixed.copies, 1);
  h.layers[0].bounds.y += 17;
  h.scroll();
  assert.equal(h.renderer.draws, 2);
  assert.equal(first.copies, 2);
  assert.equal(fixed.copies, 1);
  assert.equal(
    h.renderer.uploads,
    1,
    "Scrolling never recaptures the static background",
  );
  h.scroll();
  assert.equal(
    h.renderer.draws,
    2,
    "Unchanged geometry never submits another draw",
  );
  await h.changeSource();
  assert.equal(h.renderer.uploads, 2, "A new wallpaper is uploaded once");
  assert.equal(
    h.layers[1].children[0].copies,
    1,
    "New source repaints the fixed card too",
  );
  h.dispose();
});

test("scrollbar width changes reuse the same liquid wallpaper viewport", async () => {
  const h = await setup();
  const draws = h.renderer.draws;
  h.root.clientWidth = 385;
  h.scroll();
  assert.equal(h.renderer.draws, draws);
  assert.equal(h.renderer.uploads, 1);
  h.dispose();
});

test("visible crops keep full card buffers and use a full-canvas copy", async () => {
  const h = await setup();
  const canvas = h.layers[0].children[0];
  const resizes = canvas.resizes;
  h.layers[0].bounds.x = -30;
  h.scroll();
  assert.equal(canvas.width, 120);
  assert.equal(canvas.height, 100);
  assert.deepEqual(canvas.lastCopy.slice(1), [1, 1, 120, 100, 0, 0, 120, 100]);
  assert.equal(canvas.composite, "copy", "Replace the previous card pixels");
  assert.equal(canvas.resizes, resizes);
  assert.equal(canvas.styleWrites, 0);
  h.layers[0].bounds.y = -120;
  h.scroll();
  assert.equal(h.layers[0].children.length, 0);
  assert.equal(canvas.width, 0, "An offscreen card releases its pixel buffer");
  assert.equal(h.root.getAttribute("data-liquid-glass-active"), "1");
  h.dispose();
});

test("modal suspension and disposal release canvases and repaint on resume", async () => {
  const h = await setup();
  h.modal(true);
  assert.ok(h.layers.every((layer) => layer.children.length === 0));
  h.modal(false);
  assert.ok(h.layers.every((layer) => layer.children.length === 1));
  h.dispose();
  assert.equal(h.renderer.disposed, true);
  assert.ok(h.layers.every((layer) => layer.children.length === 0));
  assert.equal(h.root.getAttribute("data-liquid-glass-active"), null);
  assert.equal(h.jobs.size, 0);
});

test("changing crops do not resize or reposition card canvases while scrolling", async () => {
  const h = await setup();
  const canvas = h.layers[0].children[0];
  const resizes = canvas.resizes;
  for (let step = 0; step < 5; step++) {
    h.layers[0].bounds.x = -40 - step;
    h.layers[0].bounds.y += 1;
    h.scroll();
  }
  assert.equal(canvas.resizes, resizes);
  assert.equal(canvas.styleWrites, 0);
  assert.equal(canvas.copies, 6);
  h.dispose();
});

test("accordion height changes retain the canvas and repaint only the changed bottom band", async () => {
  const h = await setup({ incrementalResize: true });
  const first = h.layers[0].children[0];
  const fixed = h.layers[1].children[0];
  const host = h.layers[0].parentElement;
  assert.equal(host.style["--liquid-glass-source-y"], "-20px");
  assert.ok(host.hasAttribute("data-liquid-glass-resize-active"));
  assert.equal(
    first.visibleResizes,
    0,
    "Initial painting also happens off-DOM",
  );

  h.layers[0].bounds.height += 40;
  h.scroll();
  assert.equal(h.layers[0].children[0], first);
  assert.equal(first.height, 664, "Reserve viewport rows once, not list height");
  assert.equal(first.visibleResizes, 0);
  assert.ok(first.lastClear[1] > 0, "Retain the original top pixels");
  assert.equal(first.lastClear[1] + first.lastClear[3], 140);
  assert.equal(h.layers[0].children.length, 1, "Only one canvas is presented");

  h.layers[0].bounds.height += 40;
  h.scroll();
  assert.equal(h.layers[0].children[0], first, "Keep the presented canvas");
  assert.equal(first.height, 664);
  assert.equal(first.visibleResizes, 0);
  assert.equal(h.renderer.draws, 4, "Only the accordion draws on height changes");
  assert.equal(
    h.layers[1].children[0],
    fixed,
    "Other surfaces keep their canvas",
  );
  assert.equal(fixed.copies, 1, "Unchanged surfaces need no additional copy");
  assert.equal(h.renderer.uploads, 1);

  h.layers[0].bounds.height = 10_000;
  h.scroll();
  assert.equal(first.height, 664, "Long lists keep a bounded pixel buffer");
  assert.equal(h.layers[0].children[0], first, "Keep liquid above the old area cutoff");
  const fullDraws = h.renderer.draws;
  h.layers[0].bounds.height += 100;
  h.scroll();
  assert.equal(h.renderer.draws, fullDraws, "Offscreen extensions need no drawing");
  h.layers[0].bounds.height = 120;
  h.scroll();
  assert.ok(first.lastClear[1] > 0);
  assert.equal(first.lastClear[1] + first.lastClear[3], 120);

  h.layers[0].bounds.y += 10;
  h.scroll();
  assert.equal(
    h.layers[0].children[0],
    first,
    "Scrolling refreshes the same fixed-size canvas",
  );
  assert.equal(first.lastClear[1], 0, "Movement refreshes all visible samples");
  assert.equal(host.style["--liquid-glass-source-y"], "-30px");
  const draws = h.renderer.draws;
  h.scroll();
  assert.equal(
    h.renderer.draws,
    draws,
    "Unchanged frames still skip rendering",
  );

  h.modal(true);
  assert.equal(first.width, 0, "Suspension releases the reserved buffer");
  assert.equal(host.hasAttribute("data-liquid-glass-resize-active"), false);
  assert.equal(host.style["--liquid-glass-source-y"], undefined);
  h.modal(false);
  const resumed = h.layers[0].children[0];
  h.layers[0].bounds.height += 40;
  h.scroll();
  const final = h.layers[0].children[0];
  h.dispose();
  assert.equal(resumed.width, 0);
  assert.equal(final.width, 0);
});
