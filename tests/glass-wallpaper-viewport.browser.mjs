/** Real CSS, surface controller and wallpaper worker; no app server or APIs.
 * node tests/glass-wallpaper-viewport.browser.mjs
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";
import sharp from "sharp";

import { loadPlaywright } from "./liquid-glass.browser.mjs";

const origin = "https://wallpaper.test";
const read = (file) =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const compile = (file) =>
  ts.transpileModule(
    read(file).replaceAll(
      "import.meta.url",
      JSON.stringify(`${origin}/${file}`),
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;
const modules = Object.fromEntries(
  [
    ["@/config/glass", "config/glass.ts"],
    ["./glass-frame", "lib/glass-frame.ts"],
    ["./glass-wallpaper-worker", "lib/glass-wallpaper-worker.ts"],
    ["./glass-wallpaper-cache", "lib/glass-wallpaper-cache.ts"],
    ["./glass-surface-source", "lib/glass-surface-source.ts"],
  ].map(([name, file]) => [name, compile(file)]),
);
const worker = ts
  .transpileModule(read("lib/glass-wallpaper.worker.ts"), {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  })
  .outputText.replace("export {};", "");
const styles = ["styles/background-themes.css", "styles/glass.css"]
  .map(read)
  .join("\n");
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  ignoreDefaultArgs: ["--hide-scrollbars"],
  executablePath:
    process.env.CHROME_EXECUTABLE ??
    (existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe")
      ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
      : undefined),
  args: ["--disable-features=OverlayScrollbar,FluentOverlayScrollbar"],
});

async function snapshot(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    const background = getComputedStyle(
      document.querySelector(".app-shell"),
      "::before",
    );
    const glass = getComputedStyle(
      document.querySelector(".glass-warp"),
      "::before",
    );
    return {
      clientWidth: root.clientWidth,
      innerWidth,
      innerHeight,
      width: background.width,
      height: background.height,
      glassSize: glass.backgroundSize,
      glassPosition: glass.backgroundPosition,
      base: root.style.getPropertyValue("--glass-cached-base"),
      created: window.textureCount,
      jobs: window.wallpaperJobs,
      horizontalOverflow: root.scrollWidth > root.clientWidth,
    };
  });
}

async function pixelDifference(beforeImage, afterImage) {
  const before = await sharp(beforeImage).removeAlpha().raw().toBuffer();
  const after = await sharp(afterImage).removeAlpha().raw().toBuffer();
  assert.equal(before.length, after.length);
  let difference = 0;
  for (let i = 0; i < before.length; i++)
    difference += Math.abs(before[i] - after[i]);
  return difference / before.length;
}

try {
  for (const viewport of [
    { width: 1200, height: 700 },
    { width: 700, height: 900 },
  ]) {
    for (const [theme, dark] of [
      ["defalut", false],
      ["magnificent", false],
      ["magnificent", true],
    ]) {
      const context = await browser.newContext({ viewport });
      await context.route(`${origin}/**`, (route) => {
        const pathname = new URL(route.request().url()).pathname;
        if (pathname.startsWith("/images/"))
          return route.fulfill({
            contentType: "image/jpeg",
            body: readFileSync(
              new URL(`../public${pathname}`, import.meta.url),
            ),
          });
        if (pathname.endsWith("glass-wallpaper.worker.ts"))
          return route.fulfill({
            contentType: "text/javascript",
            body: worker,
          });
        return route.fulfill({
          contentType: "text/html",
          body: `<!doctype html>
          <html class="${dark ? "dark" : ""}" data-bg-theme="${theme}" data-glass-mode="glass"><head><style>${styles}
          body { margin: 0; } .app-shell { isolation: isolate; }
          .glass-surface { position: absolute; top: 100px; left: 100px; width: 300px; height: 180px; }
          </style></head><body><div class="app-shell"><div class="glass-surface">
          <div class="glass-warp"></div></div></div></body></html>`,
        });
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(origin);
      await page.evaluate((sources) => {
        const loaded = {};
        function require(name) {
          if (!loaded[name]) {
            const exports = (loaded[name] = {});
            new Function("exports", "require", sources[name])(exports, require);
          }
          return loaded[name];
        }
        for (const [name, value] of Object.entries(
          require("@/config/glass").glassCssVariables,
        ))
          document.documentElement.style.setProperty(name, value);
        window.textureCount = 0;
        window.wallpaperJobs = [];
        const create = URL.createObjectURL;
        URL.createObjectURL = function (blob) {
          window.textureCount++;
          return create.call(this, blob);
        };
        const post = Worker.prototype.postMessage;
        Worker.prototype.postMessage = function (request, ...args) {
          if (request.blurPx != null)
            window.wallpaperJobs.push({
              width: request.width,
              height: request.height,
              blurPx: request.blurPx,
            });
          return post.call(this, request, ...args);
        };
        window.register = () =>
          require("./glass-surface-source").registerGlassSurface(
            document.querySelector(".glass-warp"),
          );
      }, modules);
      // Check the source fallback's cover and centering before cache startup.
      const fallback = await snapshot(page);
      const glassClip = { x: 124, y: 124, width: 252, height: 132 };
      const fallbackPixels = await page.screenshot({ clip: glassClip });
      await page.evaluate(() => {
        document.querySelector(".app-shell").style.height = "2000px";
      });
      const overflowingFallback = await snapshot(page);
      assert.ok(
        overflowingFallback.clientWidth < fallback.clientWidth,
        "Exercise a classic scrollbar",
      );
      assert.equal(overflowingFallback.width, `${viewport.width}px`);
      assert.equal(overflowingFallback.glassSize, fallback.glassSize);
      assert.equal(overflowingFallback.glassPosition, fallback.glassPosition);
      await page.evaluate(() => {
        document.querySelector(".app-shell").style.height = "";
        window.release = window.register();
      });
      await page.waitForFunction(
        (count) =>
          document.documentElement.hasAttribute("data-glass-wallpaper-ready") &&
          window.textureCount === count,
        theme === "magnificent" ? 4 : 2,
      );
      const initial = await snapshot(page);
      const cachedPixels = await page.screenshot({ clip: glassClip });
      const startupDifference = await pixelDifference(
        fallbackPixels,
        cachedPixels,
      );
      console.log({ theme, dark, viewport, startupDifference });
      assert.ok(
        startupDifference < 1,
        "Cache publication preserves the source image's scale, position and colors",
      );
      const pixels = await page.screenshot({
        clip: { x: 0, y: 0, width: 500, height: 80 },
      });
      for (const height of ["2000px", "", "2000px", ""]) {
        await page.evaluate((height) => {
          document.querySelector(".app-shell").style.height = height;
          window.dispatchEvent(new Event("resize"));
        }, height);
        await page.waitForTimeout(150);
        const current = await snapshot(page);
        assert.equal(current.width, initial.width);
        assert.equal(current.height, initial.height);
        assert.equal(current.glassSize, initial.glassSize);
        assert.equal(current.base, initial.base);
        assert.equal(current.created, initial.created);
        assert.deepEqual(current.jobs, initial.jobs);
        assert.equal(current.horizontalOverflow, false);
        const scrollDifference = await pixelDifference(
          pixels,
          await page.screenshot({
            clip: { x: 0, y: 0, width: 500, height: 80 },
          }),
        );
        assert.ok(
          scrollDifference < 0.1,
          `Scrollbar background difference: ${scrollDifference}`,
        );
      }
      await page.setViewportSize({
        width: viewport.width + 100,
        height: viewport.height + 50,
      });
      await page.waitForFunction(
        (old) =>
          document.documentElement.style.getPropertyValue(
            "--glass-cached-base",
          ) !== old,
        initial.base,
      );
      const resized = await snapshot(page);
      assert.equal(resized.width, `${viewport.width + 100}px`);
      assert.equal(resized.height, `${viewport.height + 50}px`);
      assert.equal(resized.jobs.at(-1).width, viewport.width + 100);
      assert.equal(resized.jobs.at(-1).height, viewport.height + 50);
      assert.deepEqual(errors, []);
      await page.evaluate(() => window.release());
      await context.close();
      console.log(
        `Passed ${theme} ${viewport.width}x${viewport.height}: stable pixels/cache, responsive window resize`,
      );
    }
  }
} finally {
  await browser.close();
}
