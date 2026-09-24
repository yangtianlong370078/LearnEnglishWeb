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

async function setup() {
  const jobs = new Set(),
    observers = [],
    events = new Map();
  const renderer = { draws: 0, uploads: 0, disposed: false, canvas: {} };
  let clock = 0;
  class Element {
    style = {};
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
  layers[1].bounds = { x: 180, y: 30, width: 150, height: 110 };
  const view = {
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
        for (const dimension of ["width", "height"]) {
          let value = 0;
          Object.defineProperty(element, dimension, {
            get: () => value,
            set(next) {
              value = next;
              element.resizes++;
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
          render(items) {
            renderer.draws++;
            return items.map((item) => {
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
        desktop: { maxCards: 20 },
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
