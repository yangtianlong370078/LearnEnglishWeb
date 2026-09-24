import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(
  readFileSync(new URL("../lib/theme-preferences.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;

function setup({
  stored = {},
  systemDark = false,
  blockedStorage = false,
} = {}) {
  const storage = new Map(Object.entries(stored));
  const classes = new Set(["app-root", "dark"]);
  const attributes = new Map();
  const styles = new Map();
  const style = {
    setProperty: (name, value) => styles.set(name, String(value)),
    getPropertyValue: (name) => styles.get(name) ?? "",
  };
  const headNodes = [];
  const timers = [];
  const events = [];
  const document = {
    documentElement: {
      classList: {
        contains: (name) => classes.has(name),
        add: (...names) => names.forEach((name) => classes.add(name)),
        remove: (...names) => names.forEach((name) => classes.delete(name)),
        toggle(name, force) {
          const enabled = force ?? !classes.has(name);
          if (enabled) classes.add(name);
          else classes.delete(name);
          return enabled;
        },
      },
      getAttribute: (name) => attributes.get(name) ?? null,
      setAttribute: (name, value) => attributes.set(name, String(value)),
      hasAttribute: (name) => attributes.has(name),
      removeAttribute: (name) => attributes.delete(name),
      style,
    },
    head: {
      append: (...nodes) => headNodes.push(...nodes),
      appendChild: (node) => headNodes.push(node),
    },
    createElement(tagName) {
      return {
        tagName,
        setAttribute(name, value) {
          this[name] = String(value);
        },
      };
    },
    get body() {
      throw new Error("The body is not available while parsing the head");
    },
  };
  const localStorage = {
    getItem: (name) => storage.get(name) ?? null,
    setItem() {
      throw new Error("Restoring appearance must not overwrite saved settings");
    },
  };
  const window = {
    document,
    setTimeout(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    },
    dispatchEvent: (event) => events.push(event),
    matchMedia(query) {
      assert.equal(query, "(prefers-color-scheme: dark)");
      return { matches: systemDark };
    },
    get localStorage() {
      if (blockedStorage) throw new Error("Storage access denied");
      return localStorage;
    },
  };
  const environment = {
    window,
    document,
    CustomEvent: class {
      constructor(type, { detail } = {}) {
        this.type = type;
        this.detail = detail;
      }
    },
    matchMedia: window.matchMedia,
    get localStorage() {
      return window.localStorage;
    },
  };
  const api = {};
  // Keep bootstrap execution separate so it cannot accidentally depend on
  // module imports or module-scope helpers unavailable in the inline script.
  const moduleEnvironment = Object.create(environment);
  moduleEnvironment.exports = api;
  runInNewContext(source, moduleEnvironment);

  return {
    api,
    storage,
    classes,
    attributes,
    style,
    headNodes,
    timers,
    events,
    bootstrap() {
      assert.equal(typeof api.themeBootstrapScript, "string");
      runInNewContext(api.themeBootstrapScript, environment);
    },
  };
}

function assertAppearance(harness, mode, background) {
  assert.equal(harness.classes.has("dark"), mode === "dark");
  assert.equal(harness.classes.has("app-root"), true);
  assert.equal(harness.style.colorScheme, mode);
  assert.equal(harness.attributes.get("data-bg-theme"), background);
}

test("saved light and dark modes override the system before the body exists", () => {
  for (const [theme, systemDark] of [
    ["dark", false],
    ["light", true],
  ]) {
    for (const background of ["defalut", "magnificent"]) {
      const h = setup({
        stored: { theme, "background-theme": background },
        systemDark,
      });
      h.bootstrap();
      assertAppearance(h, theme, background);
      assert.equal(h.api.getStoredTheme(), theme);
      assert.equal(h.api.getStoredBackgroundTheme(), background);
    }
  }
});

test("system mode resolves both system preferences synchronously", () => {
  for (const systemDark of [false, true]) {
    const h = setup({ stored: { theme: "system" }, systemDark });
    h.bootstrap();
    assertAppearance(h, systemDark ? "dark" : "light", "magnificent");
    assert.equal(h.api.getStoredTheme(), "system");
  }
});

test("missing and invalid preferences use the same defaults during bootstrap and hydration", () => {
  for (const stored of [
    {},
    { theme: "", "background-theme": "" },
    { theme: "obsolete", "background-theme": "obsolete" },
  ]) {
    for (const systemDark of [false, true]) {
      const h = setup({ stored, systemDark });
      h.bootstrap();
      assertAppearance(h, systemDark ? "dark" : "light", "magnificent");
      assert.equal(h.api.DEFAULT_THEME, "system");
      assert.equal(h.api.DEFAULT_BACKGROUND_THEME, "magnificent");
      assert.equal(h.api.getStoredTheme(), h.api.DEFAULT_THEME);
      assert.equal(
        h.api.getStoredBackgroundTheme(),
        h.api.DEFAULT_BACKGROUND_THEME,
      );
      assert.deepEqual(Object.fromEntries(h.storage), stored);
    }
  }
});

test("unavailable localStorage still applies system appearance and default background", () => {
  for (const systemDark of [false, true]) {
    const h = setup({ blockedStorage: true, systemDark });
    h.bootstrap();
    assertAppearance(h, systemDark ? "dark" : "light", "magnificent");
    assert.equal(h.api.getStoredTheme(), "system");
    assert.equal(h.api.getStoredTheme("dark"), "dark");
    assert.equal(h.api.getStoredBackgroundTheme(), "magnificent");
    assert.equal(h.attributes.get("data-glass-mode"), "glass");
    assert.equal(h.attributes.has("data-liquid-glass-pending"), false);
    assert.equal(h.timers.length, 0);
  }
});

test("saved glass modes and the legacy switch are restored before page content exists", () => {
  for (const [stored, expected] of [
    [{}, "glass"],
    [{ "glass-enhance": "on" }, "glass"],
    [{ "glass-enhance": "off" }, "card"],
    [{ "glass-enhance": "obsolete" }, "card"],
    [{ "glass-mode": "obsolete" }, "glass"],
    [{ "glass-mode": "obsolete", "glass-enhance": "off" }, "card"],
    [{ "glass-mode": "card", "glass-enhance": "on" }, "card"],
    [{ "glass-mode": "glass", "glass-enhance": "off" }, "glass"],
  ]) {
    const h = setup({ stored });
    h.bootstrap();
    assert.equal(h.attributes.get("data-glass-mode"), expected);
    assert.equal(h.attributes.has("data-liquid-glass-pending"), false);
    assert.equal(h.timers.length, 0, "ordinary modes never wait for liquid");
    assert.deepEqual(Object.fromEntries(h.storage), stored);
  }
});

test("saved liquid preloads the selected photo without delaying content or scheduling a timeout", () => {
  for (const theme of ["light", "dark"]) {
    const stored = {
      theme,
      "background-theme": "magnificent",
      "glass-mode": "liquid",
      "glass-enhance": "off",
    };
    const h = setup({ stored, systemDark: theme === "light" });
    h.bootstrap();
    assertAppearance(h, theme, "magnificent");
    assert.equal(h.attributes.get("data-glass-mode"), "liquid");
    assert.equal(h.attributes.has("data-liquid-glass-pending"), false);
    const preloads = h.headNodes.filter(
      (node) =>
        node.tagName === "link" &&
        node.rel === "preload" &&
        node.as === "image",
    );
    assert.equal(preloads.length, 1);
    assert.equal(preloads[0].href, `/images/bg01_${theme}.jpeg`);
    assert.equal(h.timers.length, 0);
    assert.deepEqual(Object.fromEntries(h.storage), stored);
  }
});

test("liquid compatibility uses the validated background selection", () => {
  for (const [background, expectedMode, expectedBackground] of [
    ["defalut", "glass", "defalut"],
    ["magnificent", "liquid", "magnificent"],
    ["obsolete", "liquid", "magnificent"],
    ["", "liquid", "magnificent"],
  ]) {
    const h = setup({
      stored: { "glass-mode": "liquid", "background-theme": background },
    });
    h.bootstrap();
    assert.equal(h.attributes.get("data-bg-theme"), expectedBackground);
    assert.equal(h.attributes.get("data-glass-mode"), expectedMode);
    assert.equal(h.attributes.has("data-liquid-glass-pending"), false);
    assert.equal(h.timers.length, 0);
    assert.equal(h.storage.get("glass-mode"), "liquid");
  }
});

test("liquid bootstrap leaves content available even when no renderer ever starts", () => {
  const stored = { "glass-mode": "liquid", "background-theme": "magnificent" };
  const h = setup({ stored });
  h.bootstrap();
  assert.equal(h.attributes.has("data-liquid-glass-pending"), false);
  assert.equal(h.attributes.get("data-glass-mode"), "liquid");
  assert.equal(h.timers.length, 0);
  assert.deepEqual(Object.fromEntries(h.storage), stored);
  assert.equal(h.events.length, 0);
});

test("server rendering reads stable defaults without browser globals", () => {
  const api = {};
  runInNewContext(source, { exports: api });
  assert.equal(api.getStoredTheme(), "system");
  assert.equal(api.getStoredTheme("light"), "light");
  assert.equal(api.getStoredTheme("dark"), "dark");
  assert.equal(api.getStoredBackgroundTheme(), "magnificent");
});
