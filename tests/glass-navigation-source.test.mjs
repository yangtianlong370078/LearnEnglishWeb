import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Exercise the real controller without adding a browser or DOM dependency.
// The fake DOM exposes only the selection, tree and geometry APIs it consumes.
const source = ts.transpileModule(
  readFileSync(
    new URL("../lib/glass-navigation-source.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;

class Element {
  nodeType = 1;
  children = [];
  parentElement = null;
  attributes = new Set();
  className = "";
  style = {};
  dataset = {};
  bounds = { top: 0, bottom: 150, width: 300, height: 150 };
  boundsReads = 0;
  queryCount = 0;
  classList = { contains: (name) => this.className.split(" ").includes(name) };

  constructor(name, document) {
    this.name = name;
    this.ownerDocument = document;
  }

  setAttribute(name) {
    this.attributes.add(name);
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  hasAttribute(name) {
    return this.attributes.has(name);
  }
  toggleAttribute(name, enabled) {
    if (enabled) this.attributes.add(name);
    else this.attributes.delete(name);
  }
  append(node) {
    node.remove();
    node.parentElement = this;
    this.children.push(node);
  }
  prepend(node) {
    this.append(node);
    this.children.unshift(this.children.pop());
  }
  remove() {
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter(
        (node) => node !== this,
      );
      this.parentElement = null;
    }
  }
  matches(selector) {
    return selector.split(",").some((part) => {
      part = part.trim();
      if (part.startsWith(".")) return this.classList.contains(part.slice(1));
      if (part.startsWith("[")) return this.hasAttribute(part.slice(1, -1));
      return this.name === part;
    });
  }
  querySelectorAll(selector) {
    this.queryCount++;
    const result = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (child.matches(selector)) result.push(child);
        visit(child);
      }
    };
    visit(this);
    return result;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  closest(selector) {
    for (let node = this; node; node = node.parentElement)
      if (node.matches(selector)) return node;
    return null;
  }
  getBoundingClientRect() {
    this.boundsReads++;
    return { ...this.bounds };
  }
}

function setup() {
  const jobs = new Set();
  const observers = [];
  const activeFilters = new Map();
  const listeners = new Map();
  let surfaceChanged;
  const view = {
    scrollY: 100,
    addEventListener(name, handler) {
      listeners.set(name, handler);
    },
    removeEventListener(name) {
      listeners.delete(name);
    },
  };
  const document = { defaultView: view };
  const element = (name) => new Element(name, document);
  document.createElement = element;
  document.body = element("body");
  document.documentElement = element("html");
  const shell = element("shell");
  shell.className = "app-shell";
  const nav = element("nav");
  nav.bounds = { top: 0, bottom: 60, width: 800, height: 60 };
  const main = element("main");
  document.body.append(shell);
  shell.append(nav);
  shell.append(main);

  class Observer {
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }
    observe(target, options) {
      this.target = target;
      this.options = options;
    }
    disconnect() {
      this.disconnected = true;
    }
  }
  const modules = {
    "./glass-navigation-filter": {
      createGlassNavigationFilter(host) {
        const filter = {
          update(bounds, header) {
            filter.bounds = { ...bounds };
            filter.header = { ...header };
          },
          dispose() {
            activeFilters.delete(host);
          },
        };
        activeFilters.set(host, filter);
        return filter;
      },
    },
    "./glass-surface-source": {
      subscribeGlassSurfaceChanges(_document, callback) {
        surfaceChanged = callback;
        return () => {
          surfaceChanged = null;
        };
      },
    },
    "./glass-frame": {
      scheduleGlassFrame(_view, job) {
        jobs.add(job);
      },
      cancelGlassFrame(_view, job) {
        jobs.delete(job);
      },
    },
    "@/config/glass": {
      getGlassBlurPadding: (mode) => (mode === "liquid" ? 16 : 32),
    },
  };
  const exports = {};
  runInNewContext(source, {
    exports,
    require(name) {
      assert.ok(modules[name], `Unexpected import: ${name}`);
      return modules[name];
    },
    MutationObserver: Observer,
    ResizeObserver: Observer,
  });
  const dispose = exports.registerGlassNavigation(nav);
  const content = observers.find(
    (observer) => observer.target === main && observer.options?.subtree,
  );
  const flush = () => {
    const measures = [...jobs];
    jobs.clear();
    const paints = measures.map((measure) => measure());
    paints.forEach((paint) => paint());
  };
  const host = (name, parent = main, kind = "plain") => {
    const node = element(name);
    if (kind === "plain") node.setAttribute("data-glass-navigation-content");
    else {
      const warp = element("span");
      warp.className = "glass-warp";
      node.append(warp);
    }
    parent.append(node);
    return node;
  };
  const mutate = (records) => {
    content.callback(records);
    flush();
  };
  return {
    element,
    main,
    nav,
    host,
    flush,
    mutate,
    activeFilters,
    dispose,
    jobs,
    observers,
    changeMode(mode) {
      document.documentElement.dataset.glassMode = mode;
      observers
        .find((observer) => observer.target === document.documentElement)
        .callback([]);
      flush();
    },
    surfaceChanged: () => surfaceChanged(),
    scroll: () => {
      listeners.get("scroll")();
      flush();
    },
  };
}

const childList = (addedNodes = [], removedNodes = []) => ({
  type: "childList",
  addedNodes,
  removedNodes,
});
const attributes = () => ({
  type: "attributes",
  attributeName: "data-glass-navigation-content",
});

test("switching glass modes updates navigation padding without scrolling", () => {
  const h = setup();
  const card = h.host("card");
  card.bounds.top = 84;
  h.flush();
  assert.equal(h.activeFilters.has(card), true);
  h.changeMode("liquid");
  assert.equal(h.activeFilters.has(card), false);
  h.changeMode("card");
  assert.equal(h.activeFilters.has(card), true);
  assert.equal(h.main.queryCount, 1, "mode changes retain the host cache");
  h.dispose();
});

test("ordinary content replacements reuse hosts but still apply current geometry", () => {
  const h = setup();
  const card = h.host("card");
  h.flush();
  assert.equal(h.main.queryCount, 1);
  for (let index = 0; index < 20; index++) {
    const decoration = h.element("icon");
    card.append(decoration);
    card.bounds.top = -index;
    h.mutate([childList([decoration], [{ nodeType: 3 }])]);
    assert.equal(h.activeFilters.get(card).bounds.top, -index);
  }
  assert.equal(
    h.main.queryCount,
    1,
    "content changes must not re-query the entire main",
  );
  assert.equal(
    card.boundsReads,
    21,
    "every mutation batch must still measure live bounds",
  );
  card.bounds = { ...card.bounds, top: 500, bottom: 650 };
  h.mutate([childList([{ nodeType: 3 }], [])]);
  assert.equal(
    h.activeFilters.has(card),
    false,
    "content-only layout shifts must release old filters",
  );
  h.dispose();
});

test("added and removed subtrees update plain and glass hosts", () => {
  const h = setup();
  h.flush();
  const wrapper = h.element("wrapper");
  const plain = h.host("plain", wrapper);
  const glass = h.host("glass", wrapper, "glass");
  h.main.append(wrapper);
  h.mutate([childList([wrapper])]);
  assert.deepEqual([...h.activeFilters.keys()], [plain, glass]);
  assert.equal(h.main.queryCount, 2);
  wrapper.remove();
  h.mutate([childList([], [wrapper])]);
  assert.equal(h.activeFilters.size, 0);
  assert.equal(h.main.queryCount, 3);
  h.dispose();
});

test("moving a host's ancestor into and out of another host preserves top-level filtering", () => {
  const h = setup();
  const wrapper = h.element("wrapper");
  h.main.append(wrapper);
  const inner = h.host("inner", wrapper, "glass");
  const outer = h.host("outer");
  h.flush();
  assert.deepEqual([...h.activeFilters.keys()], [inner, outer]);
  outer.append(wrapper);
  h.mutate([childList([], [wrapper]), childList([wrapper])]);
  assert.deepEqual([...h.activeFilters.keys()], [outer]);
  h.main.append(wrapper);
  h.mutate([childList([], [wrapper]), childList([wrapper])]);
  assert.deepEqual([...h.activeFilters.keys()], [outer, inner]);
  assert.equal(h.main.queryCount, 3);
  h.dispose();
});

test("marker attribute toggles replace nested candidates even when geometry is unchanged", () => {
  const h = setup();
  const wrapper = h.element("wrapper");
  h.main.append(wrapper);
  const inner = h.host("inner", wrapper);
  h.flush();
  wrapper.setAttribute("data-glass-navigation-content");
  h.mutate([attributes()]);
  assert.deepEqual([...h.activeFilters.keys()], [wrapper]);
  wrapper.removeAttribute("data-glass-navigation-content");
  h.mutate([attributes()]);
  assert.deepEqual([...h.activeFilters.keys()], [inner]);
  assert.equal(h.main.queryCount, 3);
  h.dispose();
});

test("a marker is detected on the changed node itself and on late attribute changes", () => {
  const h = setup();
  h.flush();
  const direct = h.host("direct");
  h.mutate([childList([direct])]);
  assert.equal(h.activeFilters.has(direct), true);
  direct.remove();
  direct.removeAttribute("data-glass-navigation-content");
  // Mutation records are delivered together after both operations. The removed
  // node no longer matches, so the observed attribute record must invalidate.
  h.mutate([childList([], [direct]), attributes()]);
  assert.equal(h.activeFilters.size, 0);
  h.dispose();
});

test("surface registration remains a separate invalidation path and cleanup cancels pending work", () => {
  const h = setup();
  h.flush();
  const card = h.host("card", h.main, "glass");
  h.surfaceChanged();
  h.flush();
  assert.equal(h.activeFilters.has(card), true);
  h.scroll();
  assert.equal(
    h.main.queryCount,
    2,
    "ordinary scrolling must retain the candidate cache",
  );
  h.surfaceChanged();
  assert.equal(h.jobs.size, 1);
  h.dispose();
  assert.equal(h.jobs.size, 0);
  assert.equal(h.activeFilters.size, 0);
  assert.ok(h.observers.every((observer) => observer.disconnected));
});
