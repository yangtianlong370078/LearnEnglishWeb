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

const source = compile("../lib/glass-enhance.ts");
const configuration = {};
runInNewContext(compile("../config/glass.ts"), { exports: configuration });

function setup({
  stored = {},
  readThrows = false,
  writeThrows = false,
  ssr = false,
} = {}) {
  const storage = new Map(Object.entries(stored));
  const attributes = new Map();
  const variables = new Map();
  const writes = [];
  const listeners = new Map();
  const events = [];
  const stores = [];
  const exports = {};
  const environment = {
    exports,
    require(name) {
      if (name === "@/config/glass") return configuration;
      assert.equal(name, "react");
      return {
        useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
          stores.push({ subscribe, getSnapshot, getServerSnapshot });
          return ssr ? getServerSnapshot() : getSnapshot();
        },
      };
    },
  };

  if (!ssr) {
    Object.assign(environment, {
      document: {
        documentElement: {
          getAttribute: (name) => attributes.get(name) ?? null,
          setAttribute: (name, value) => attributes.set(name, value),
          style: {
            setProperty(name, value) {
              writes.push([name, value]);
              variables.set(name, value);
            },
          },
        },
      },
      localStorage: {
        getItem(name) {
          if (readThrows) throw new Error("Storage access denied");
          return storage.get(name) ?? null;
        },
        setItem(name, value) {
          if (writeThrows) throw new Error("Storage quota exceeded");
          storage.set(name, value);
        },
      },
      CustomEvent: class {
        constructor(type, { detail }) {
          this.type = type;
          this.detail = detail;
        }
      },
      window: {
        dispatchEvent(event) {
          events.push(event);
          for (const handler of listeners.get(event.type) ?? []) handler(event);
        },
        addEventListener(name, handler) {
          const handlers = listeners.get(name) ?? new Set();
          handlers.add(handler);
          listeners.set(name, handlers);
        },
        removeEventListener(name, handler) {
          listeners.get(name)?.delete(handler);
        },
      },
    });
  }

  runInNewContext(source, environment);
  return {
    api: exports,
    storage,
    attributes,
    variables,
    writes,
    events,
    stores,
  };
}

test("the previous on/off preference migrates without changing the selected appearance", () => {
  for (const [legacy, expected] of [
    [null, "glass"],
    ["on", "glass"],
    ["off", "card"],
  ]) {
    const h = setup({
      stored: legacy === null ? {} : { "glass-enhance": legacy },
    });
    assert.equal(h.api.getGlassMode(), expected);
    h.api.setGlassMode(h.api.getGlassMode());
    assert.equal(h.storage.get("glass-mode"), expected);
    assert.equal(h.attributes.get("data-glass-mode"), expected);
    assert.equal(h.api.getGlassEnhance(), expected !== "card");
  }
});

test("saved modes take precedence over the legacy switch and survive a new session", () => {
  for (const mode of ["card", "glass", "liquid"]) {
    const h = setup({ stored: { "glass-enhance": "off", "glass-mode": mode } });
    assert.equal(h.api.getGlassMode(), mode);
    h.api.setGlassMode(mode);
    const reloaded = setup({ stored: Object.fromEntries(h.storage) });
    assert.equal(reloaded.api.getGlassMode(), mode);
    assert.equal(reloaded.api.getGlassEnhance(), mode !== "card");
  }
  const invalid = setup({
    stored: { "glass-mode": "obsolete", "glass-enhance": "off" },
  });
  assert.equal(invalid.api.getGlassMode(), "card");
});

test("a default background normalizes a saved liquid preference before initialization", () => {
  const h = setup({
    stored: { "background-theme": "defalut", "glass-mode": "liquid" },
  });

  assert.equal(h.api.getGlassMode(), "glass");
  assert.equal(h.api.useGlassMode(), "glass");
  h.api.setGlassMode(h.api.getGlassMode());
  assert.equal(h.storage.get("glass-mode"), "glass");
  assert.equal(h.attributes.get("data-glass-mode"), "glass");
  assert.equal(h.attributes.get("data-glass-enhance"), "on");
});

test("requesting liquid on the default background applies and publishes glass", () => {
  const h = setup({ stored: { "background-theme": "defalut" } });
  h.api.setGlassMode("liquid");

  assert.equal(h.api.getGlassMode(), "glass");
  assert.equal(h.api.getGlassEnhance(), true);
  assert.equal(h.attributes.get("data-glass-mode"), "glass");
  assert.equal(h.attributes.get("data-glass-enhance"), "on");
  assert.equal(h.storage.get("glass-mode"), "glass");
  assert.equal(h.storage.get("glass-enhance"), "on");
  assert.equal(h.events.at(-1).type, h.api.GLASS_MODE_CHANGE_EVENT);
  assert.equal(h.events.at(-1).detail, "glass");
});

test("the image background permits selecting and restoring liquid", () => {
  const h = setup({
    stored: { "background-theme": "magnificent", "glass-mode": "liquid" },
  });
  assert.equal(h.api.getGlassMode(), "liquid");
  h.api.setGlassMode("liquid");
  assert.equal(h.attributes.get("data-glass-mode"), "liquid");
  assert.equal(h.storage.get("glass-mode"), "liquid");
  assert.equal(h.events.at(-1).detail, "liquid");
});

test("the selected background takes precedence while the applied background is catching up", () => {
  for (const [selected, applied, expected] of [
    ["defalut", "magnificent", "glass"],
    ["magnificent", "defalut", "liquid"],
  ]) {
    const h = setup({
      stored: { "background-theme": selected, "glass-mode": "liquid" },
    });
    h.attributes.set("data-bg-theme", applied);
    h.attributes.set("data-glass-mode", "liquid");

    assert.equal(h.api.getGlassMode(), expected);
    h.api.setGlassMode("liquid");
    assert.equal(h.attributes.get("data-glass-mode"), expected);
    assert.equal(h.storage.get("glass-mode"), expected);
    assert.equal(h.events.at(-1).detail, expected);
  }
});

test("the applied background is used when its stored preference is absent or unreadable", () => {
  for (const readThrows of [false, true]) {
    for (const [theme, expected] of [
      ["defalut", "glass"],
      ["magnificent", "liquid"],
    ]) {
      const h = setup({ readThrows });
      h.attributes.set("data-bg-theme", theme);
      h.attributes.set("data-glass-mode", "liquid");

      assert.equal(h.api.getGlassMode(), expected);
      h.api.setGlassMode("liquid");
      assert.equal(h.attributes.get("data-glass-mode"), expected);
      assert.equal(h.events.at(-1).detail, expected);
    }
  }
});

test("returning to an image background requires explicitly selecting liquid again", () => {
  const h = setup({ stored: { "background-theme": "magnificent" } });
  h.api.setGlassMode("liquid");

  h.storage.set("background-theme", "defalut");
  assert.equal(h.api.getGlassMode(), "glass");
  h.api.setGlassMode(h.api.getGlassMode());
  h.storage.set("background-theme", "magnificent");
  assert.equal(h.api.getGlassMode(), "glass");
  assert.equal(h.storage.get("glass-mode"), "glass");

  const reloaded = setup({ stored: Object.fromEntries(h.storage) });
  assert.equal(reloaded.api.getGlassMode(), "glass");
  reloaded.api.setGlassMode("liquid");
  assert.equal(reloaded.api.getGlassMode(), "liquid");
});

test("card mode stays available and unchanged on either background", () => {
  for (const theme of ["defalut", "magnificent"]) {
    const h = setup({
      stored: { "background-theme": theme, "glass-mode": "card" },
    });
    assert.equal(h.api.getGlassMode(), "card");
    h.api.setGlassMode("card");
    assert.equal(h.api.getGlassEnhance(), false);
    assert.equal(h.attributes.get("data-glass-mode"), "card");
    assert.equal(h.attributes.get("data-glass-enhance"), "off");
    assert.equal(h.events.at(-1).detail, "card");
  }
});

test("card, glass and liquid transitions preserve existing enhancement variables", () => {
  const h = setup();
  h.api.setGlassMode("glass");
  const enhancedVariables = [...h.variables];
  const enhancedWriteCount = h.writes.length;
  assert.equal(
    h.variables.get("--glass-border-highlight-intensity"),
    String(configuration.glassConfig.borderHighlight.intensity),
  );

  h.api.setGlassMode("liquid");
  assert.equal(h.api.getGlassEnhance(), true);
  assert.equal(h.attributes.get("data-glass-enhance"), "on");
  assert.equal(
    h.writes.length,
    enhancedWriteCount,
    "liquid must retain the glass CSS without repainting those variables",
  );

  h.api.setGlassMode("card");
  assert.equal(h.api.getGlassEnhance(), false);
  assert.equal(h.attributes.get("data-glass-enhance"), "off");
  assert.ok(
    [...h.variables.values()].every(
      (value) => value === "0" || value === "0px",
    ),
  );

  h.api.setGlassMode("liquid");
  assert.deepEqual(
    [...h.variables],
    enhancedVariables,
    "liquid restores the same border configuration as glass",
  );
  h.api.setGlassMode("glass");
  assert.deepEqual([...h.variables], enhancedVariables);
});

test("mode subscribers see the applied state, while the enhancement snapshot stays true for glass and liquid", () => {
  const h = setup();
  h.api.useGlassMode();
  h.api.useGlassEnhance();
  const [modeStore, enhanceStore] = h.stores;
  const observed = [];
  const unsubscribe = modeStore.subscribe(() =>
    observed.push([
      modeStore.getSnapshot(),
      enhanceStore.getSnapshot(),
      h.attributes.get("data-glass-mode"),
    ]),
  );

  h.api.setGlassMode("glass");
  h.api.setGlassMode("liquid");
  h.api.setGlassMode("card");
  assert.deepEqual(observed, [
    ["glass", true, "glass"],
    ["liquid", true, "liquid"],
    ["card", false, "card"],
  ]);
  assert.deepEqual(
    h.events.map(({ type, detail }) => [type, detail]),
    [
      [h.api.GLASS_MODE_CHANGE_EVENT, "glass"],
      [h.api.GLASS_MODE_CHANGE_EVENT, "liquid"],
      [h.api.GLASS_MODE_CHANGE_EVENT, "card"],
    ],
  );
  unsubscribe();
  h.api.setGlassMode("glass");
  assert.equal(
    observed.length,
    3,
    "unmounted subscribers must receive no further changes",
  );
});

test("blocked localStorage reads use glass and do not prevent changing modes", () => {
  const h = setup({ readThrows: true });
  assert.equal(h.api.getGlassMode(), "glass");
  h.api.setGlassMode("card");
  assert.equal(h.api.getGlassMode(), "card");
  assert.equal(h.api.getGlassEnhance(), false);
  h.api.setGlassMode("liquid");
  assert.equal(h.api.getGlassMode(), "liquid");
  assert.equal(h.api.getGlassEnhance(), true);
});

test("blocked localStorage writes keep the session state and fallback functional", () => {
  const h = setup({ stored: { "glass-mode": "liquid" }, writeThrows: true });
  h.api.setGlassMode("glass");
  assert.equal(
    h.api.getGlassMode(),
    "glass",
    "a WebGL fallback must supersede the saved liquid preference for this session",
  );
  assert.equal(h.storage.get("glass-mode"), "liquid");
  h.api.setGlassMode("card");
  assert.equal(h.api.getGlassMode(), "card");
  assert.equal(h.api.getGlassEnhance(), false);
  assert.equal(h.events.at(-1).detail, "card");
});

test("the legacy setters still select the corresponding card and glass modes", () => {
  const h = setup();
  h.api.setGlassMode("liquid");
  h.api.setGlassEnhance(false);
  assert.equal(h.api.getGlassMode(), "card");
  assert.equal(h.storage.get("glass-enhance"), "off");
  h.api.setGlassEnhance(true);
  assert.equal(h.api.getGlassMode(), "glass");
  assert.equal(h.storage.get("glass-enhance"), "on");
});

test("server rendering has stable snapshots without browser globals", () => {
  const h = setup({ ssr: true });
  assert.equal(h.api.getGlassMode(), "glass");
  assert.equal(h.api.getGlassEnhance(), true);
  assert.equal(h.api.useGlassMode(), "glass");
  assert.equal(h.api.useGlassEnhance(), true);
});
