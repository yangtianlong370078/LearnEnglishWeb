import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(
  readFileSync(new URL("../app/providers.tsx", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
).outputText;

function setup() {
  const effects = [],
    registered = new Set(),
    timers = new Map(),
    events = new Map(),
    observers = [];
  let nextTimer = 0,
    surfaceChanged;
  const card = {
    style: { width: "", paddingBottom: "" },
    naturalWidth: 315.6,
    classList: { contains: (name) => name === "yinyinkuan" },
    getBoundingClientRect() {
      return {
        width: parseFloat(this.style.width) || this.naturalWidth,
        height: 52,
      };
    },
  };
  const document = {
    // Server HTML exists before the boundary's refs commit.
    querySelectorAll: () => [card],
    body: {},
  };
  const window = {
    matchMedia: () => ({ matches: false }),
    addEventListener: (name, callback) => events.set(name, callback),
    removeEventListener: (name) => events.delete(name),
    setTimeout: (callback) => {
      const id = ++nextTimer;
      timers.set(id, callback);
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  class Observer {
    observed = new Set();
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }
    observe(node) {
      this.observed.add(node);
    }
    disconnect() {
      this.observed.clear();
    }
  }
  const modules = {
    react: {
      createContext: () => ({ Provider: {} }),
      useState: (initial) => [
        typeof initial === "function" ? initial() : initial,
        () => {},
      ],
      useEffect: (effect) => effects.push(effect),
      useCallback: (callback) => callback,
      useMemo: (factory) => factory(),
    },
    "react/jsx-runtime": { jsx: () => null, jsxs: () => null },
    "@heroui/react": { Toast: { Provider: {} } },
    "@/lib/glass-wallpaper-cache": { setGlassTheme() {} },
    "@/components/common/liquid-glass-runtime": {},
    "@/lib/theme-preferences": {
      DEFAULT_THEME: "light",
      getStoredTheme: () => "light",
    },
    "@/lib/glass-surface-source": {
      getRegisteredGlassHosts: () => [...registered],
      subscribeGlassSurfaceChanges(_document, listener) {
        surfaceChanged = listener;
        return () => {
          surfaceChanged = undefined;
        };
      },
    },
  };
  const exports = {};
  runInNewContext(source, {
    exports,
    document,
    window,
    require: (name) => {
      assert.ok(modules[name], name);
      return modules[name];
    },
    ResizeObserver: Observer,
    MutationObserver: Observer,
    Element: class {},
  });
  exports.Providers({ children: null });
  const dispose = effects[1]();
  const flush = () => {
    const callbacks = [...timers.values()];
    timers.clear();
    callbacks.forEach((callback) => callback());
  };
  return {
    card,
    timers,
    observers,
    events,
    flush,
    dispose,
    mount() {
      registered.add(card);
      surfaceChanged();
    },
    unmount() {
      registered.delete(card);
      surfaceChanged();
    },
    subscribed: () => Boolean(surfaceChanged),
  };
}

test("size correction leaves server cards untouched until their Suspense refs commit", () => {
  const h = setup();
  assert.equal(h.card.style.width, "");
  assert.equal(h.card.style.paddingBottom, "");
  assert.equal(h.observers[0].observed.has(h.card), false);
  // DOM changes and resize events are not proof of hydration.
  h.observers[1].callback([{ target: {} }]);
  h.events.get("resize")();
  h.flush();
  assert.equal(h.card.style.width, "");
  h.mount();
  assert.equal(h.observers[0].observed.has(h.card), true);
  h.flush();
  assert.equal(h.card.style.width, "315px");
  h.card.naturalWidth = 480.8;
  h.events.get("resize")();
  assert.equal(h.card.style.width, "");
  h.flush();
  assert.equal(h.card.style.width, "480px");
  h.dispose();
  assert.equal(h.subscribed(), false);
  assert.equal(h.timers.size, 0);
  assert.equal(h.events.size, 0);
});

test("cards removed before a scheduled correction are excluded", () => {
  const h = setup();
  h.mount();
  h.unmount();
  h.flush();
  assert.equal(h.card.style.width, "");
  h.dispose();
});
