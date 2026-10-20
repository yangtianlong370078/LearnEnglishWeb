/** Background ownership regression against an isolated production server.
 * LIQUID_GLASS_BASE_URL defaults to :8093; APIs use the fictional fixture.
 * Image tracking uses WeakRef so the test cannot keep decoded sources alive.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  chooseMode,
  createContext,
  loadPlaywright,
  openFixture,
} from "./liquid-glass.browser.mjs";

const output =
  process.env.GLASS_WALLPAPER_LIFECYCLE_OUTPUT ??
  path.join(os.tmpdir(), "glass-wallpaper-lifecycle.json");
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_EXECUTABLE ??
    (existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe")
      ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
      : undefined),
});
const { context, requests } = await createContext(browser, {
  viewport: { width: 1440, height: 900 },
  dpr: 1,
  mobile: false,
});
await context.addInitScript(() => {
  const state = (window.__wallpaperLife = {
    images: [],
    urls: new Set(),
    workers: 0,
  });
  const OriginalImage = window.Image;
  window.Image = class extends OriginalImage {
    constructor(...args) {
      super(...args);
      state.images.push(new WeakRef(this));
    }
  };
  const create = URL.createObjectURL,
    revoke = URL.revokeObjectURL;
  URL.createObjectURL = function (blob) {
    const url = create.call(this, blob);
    state.urls.add(url);
    return url;
  };
  URL.revokeObjectURL = function (url) {
    state.urls.delete(url);
    return revoke.call(this, url);
  };
  const OriginalWorker = window.Worker;
  window.Worker = class extends OriginalWorker {
    released = false;
    constructor(...args) {
      super(...args);
      state.workers++;
    }
    terminate() {
      if (!this.released) {
        this.released = true;
        state.workers--;
      }
      return super.terminate();
    }
  };
});
const page = await context.newPage();
const session = await context.newCDPSession(page);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const report = { checkpoints: [], errors, passed: false };

async function waitForTexture(previous) {
  await page.waitForFunction((previous) => {
    const root = document.documentElement;
    return (
      root.hasAttribute("data-glass-wallpaper-ready") &&
      root.style.getPropertyValue("--glass-cached-base") !== previous
    );
  }, previous);
  // Include the alternate-mode idle prewarm before checking the stable limit.
  await page.waitForTimeout(500);
  await page.waitForFunction(() => window.__wallpaperLife.workers === 0);
}

async function checkpoint(label, photos = 2, textures = 5) {
  await session.send("HeapProfiler.collectGarbage");
  const state = await page.evaluate(() => {
    const life = window.__wallpaperLife;
    life.images = life.images.filter((image) => image.deref());
    const urls = life.images.map(
      (ref) => ref.deref()?.getAttribute("src") ?? "",
    );
    window.__liquidBench.contexts = window.__liquidBench.contexts.filter(
      (gl) => !gl.isContextLost(),
    );
    return {
      photos: urls.filter((url) => url.startsWith("/images/")).length,
      textures: urls.filter((url) => url.startsWith("blob:")).length,
      blobs: life.urls.size,
      workers: life.workers,
      liveContexts: window.__liquidBench.contexts.length,
    };
  });
  assert.ok(state.photos <= photos, `${label}: source photo limit`);
  assert.ok(state.textures <= textures, `${label}: decoded texture limit`);
  assert.ok(state.blobs <= 4, `${label}: two texture pairs`);
  assert.equal(state.workers, 0);
  report.checkpoints.push({ label, ...state });
}

async function switchBackground(background) {
  const previous = await page.evaluate(() =>
    document.documentElement.style.getPropertyValue("--glass-cached-base"),
  );
  await page
    .locator('[aria-haspopup="listbox"]')
    .filter({ hasText: /图片|默认/ })
    .first()
    .click();
  await page
    .getByText(background === "magnificent" ? "图片" : "默认", {
      exact: true,
    })
    .last()
    .click();
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    (background) => document.documentElement.dataset.bgTheme === background,
    background,
  );
  await waitForTexture(previous);
}

try {
  await openFixture(page, "courselearn");
  await checkpoint("initial-glass", 2, 4);
  await chooseMode(page, "liquid");
  for (const mode of ["dark", "light"]) {
    if (mode === "light") {
      await page.getByLabel("浅色模式", { exact: true }).click();
      await page.waitForFunction(
        () => !document.documentElement.classList.contains("dark"),
      );
    }
    const files = (
      await readdir(new URL(`../public/images/${mode}/`, import.meta.url))
    )
      .filter((name) => /\.(jpeg|jpg|png)$/i.test(name))
      .slice(0, 6);
    assert.equal(files.length, 6);
    for (const file of files) {
      const previous = await page.evaluate(
        ({ mode, file }) => {
          const root = document.documentElement;
          const previous = root.style.getPropertyValue("--glass-cached-base");
          localStorage.setItem(`wallpaper-${mode}`, file);
          root.style.setProperty(
            `--wallpaper-url-${mode}`,
            `url("/images/${mode}/${file}")`,
          );
          root.setAttribute(`data-wallpaper-${mode}`, file);
          return previous;
        },
        { mode, file },
      );
      await waitForTexture(previous);
      await checkpoint(`${mode}/${file}`);
    }
  }
  for (let i = 0; i < 12; i++) {
    const previous = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue("--glass-cached-base"),
    );
    await page
      .getByLabel(i % 2 ? "浅色模式" : "深色模式", { exact: true })
      .click();
    await waitForTexture(previous);
    await checkpoint(`theme-${i + 1}`);
  }
  await chooseMode(page, "glass");
  await checkpoint("exit-liquid", 2, 4);
  assert.equal(report.checkpoints.at(-1).liveContexts, 0);
  for (let i = 0; i < 4; i++) {
    await switchBackground("defalut");
    await checkpoint(`ambient-${i + 1}`, 0, 4);
    await switchBackground("magnificent");
    await checkpoint(`photo-${i + 1}`, 2, 4);
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(requests.unknownAPI, []);
  assert.deepEqual(requests.blockedWrites, []);
  report.passed = true;
  console.log(JSON.stringify(report, null, 2));
} finally {
  await writeFile(output, JSON.stringify(report, null, 2));
  await context.close();
  await browser.close();
  console.log(`Report: ${output}`);
}
