import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(
  readFileSync(
    new URL("../lib/glass-surface-source.ts", import.meta.url),
    "utf8",
  ),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;

function setup() {
  const timers = new Map();
  const jobs = new Set();
  const observers = [];
  let sequence = 0;
  let released = false;

  function style() {
    const values = new Map();
    return {
      writes: [],
      getPropertyValue: (name) => values.get(name) ?? "",
      getPropertyPriority: () => "",
      setProperty(name, value) {
        this.writes.push({ name, before: values.get(name) ?? "", value });
        values.set(name, value);
      },
      removeProperty: (name) => values.delete(name),
    };
  }

  class Observer {
    targets = new Set();
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }
    observe(target) {
      this.targets.add(target);
    }
    unobserve(target) {
      this.targets.delete(target);
    }
    disconnect() {
      this.targets.clear();
    }
  }

  const document = {
    documentElement: { style: style() },
    body: {},
    defaultView: {
      setTimeout(callback) {
        const id = ++sequence;
        timers.set(id, callback);
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
      addEventListener() {},
      removeEventListener() {},
    },
  };
  const exports = {};
  runInNewContext(code, {
    exports,
    ResizeObserver: Observer,
    IntersectionObserver: Observer,
    require(name) {
      if (name === "./glass-wallpaper-cache")
        return {
          createGlassWallpaperCache: () => () => {
            released = true;
          },
        };
      if (name === "./glass-frame")
        return {
          scheduleGlassFrame: (_view, job) => jobs.add(job),
          cancelGlassFrame: (_view, job) => jobs.delete(job),
        };
      throw new Error(`Unexpected dependency ${name}`);
    },
  });

  const releases = [];
  const hosts = Array.from({ length: 2 }, () => {
    const host = {};
    host.layers = ["glass-warp", "glass-border"].map((className) => ({
      parentElement: host,
      ownerDocument: document,
      style: style(),
      classList: { contains: (name) => name === className },
      toggleAttribute() {},
    }));
    for (const layer of host.layers)
      releases.push(exports.registerGlassSurface(layer));
    return host;
  });
  const intersection = observers.find((observer) =>
    observer.targets.has(hosts[0]),
  );
  const layout = observers.find((observer) =>
    observer.targets.has(document.body),
  );

  return {
    hosts,
    timers,
    jobs,
    get released() {
      return released;
    },
    visible(host, isIntersecting) {
      intersection.callback([{ target: host, isIntersecting }]);
    },
    layout() {
      layout.callback([]);
    },
    flush() {
      const callbacks = [...timers.values()];
      timers.clear();
      callbacks.forEach((callback) => callback());
    },
    dispose() {
      releases.forEach((release) => release());
    },
  };
}

test("returning course borders invalidate their own cached wallpaper without scrolling", () => {
  const h = setup();
  const [mine, featured] = h.hosts;
  const property = "--glass-repaint-nudge";
  h.visible(mine, true);
  h.visible(featured, true);
  h.flush();

  for (const hiddenUpdates of [1, 2, 3]) {
    const previous = featured.layers.map((layer) =>
      layer.style.getPropertyValue(property),
    );
    h.visible(featured, false);
    for (let i = 0; i < hiddenUpdates; i++) {
      h.layout();
      h.flush();
    }
    assert.deepEqual(
      featured.layers.map((layer) => layer.style.getPropertyValue(property)),
      previous,
      "Offscreen courses do not receive repaint work",
    );

    h.visible(featured, true);
    h.flush();
    featured.layers.forEach((layer, index) => {
      assert.notEqual(
        layer.style.getPropertyValue(property),
        previous[index],
        "Re-entry must change the actual value, regardless of offscreen updates",
      );
    });
    assert.equal(
      featured.layers[0].style.getPropertyValue(property),
      featured.layers[1].style.getPropertyValue(property),
      "The glass background and border stay aligned",
    );
  }
  h.dispose();
});

test("layout repaint work stays debounced and is cancelled when surfaces unmount", () => {
  const h = setup();
  h.visible(h.hosts[0], true);
  for (let i = 0; i < 10; i++) h.layout();
  assert.equal(h.timers.size, 1);
  h.dispose();
  assert.equal(h.timers.size, 0);
  assert.equal(h.jobs.size, 0);
  assert.equal(h.released, true);
});
