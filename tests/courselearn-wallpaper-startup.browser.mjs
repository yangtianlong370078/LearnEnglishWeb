/** CSS fallback -> decoded cache on the real courselearn page.
 * COURSELEARN_STARTUP_BASE_URL=http://127.0.0.1:8096 node tests/courselearn-wallpaper-startup.browser.mjs
 * Use an isolated server; all APIs are mocked by the shared fixture.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import sharp from "sharp";

const baseURL =
  process.env.COURSELEARN_STARTUP_BASE_URL ?? "http://127.0.0.1:8096";
assert.notEqual(new URL(baseURL).port, "8090");
process.env.LIQUID_GLASS_BASE_URL = baseURL;
const { loadPlaywright, createContext } = await import(
  "./liquid-glass.browser.mjs"
);
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  ignoreDefaultArgs: ["--hide-scrollbars"],
  executablePath:
    process.env.CHROME_EXECUTABLE ??
    (existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe")
      ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
      : undefined),
});

try {
  for (const viewport of [
    { width: 1440, height: 960 },
    { width: 390, height: 844 },
  ]) {
    for (const theme of ["light", "dark"]) {
      const { context, requests } = await createContext(browser, {
        viewport,
        dpr: 1,
        mobile: false,
      });
      await context.addInitScript((theme) => {
        localStorage.setItem("theme", theme);
        localStorage.setItem("glass-mode", "glass");
        window.waitingTextures = [];
        window.holdTextures = true;
        const decode = HTMLImageElement.prototype.decode;
        HTMLImageElement.prototype.decode = async function (...args) {
          await decode.apply(this, args);
          if (this.src.startsWith("blob:") && window.holdTextures)
            await new Promise((resolve) =>
              window.waitingTextures.push(resolve),
            );
        };
      }, theme);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (/hydrati|Minified React error #(?:418|423|425)/i.test(message.text()))
          errors.push(message.text());
      });
      await page.goto(`${baseURL}/courselearn?kc=100&name=Startup`, {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
      await page
        .getByText("journey", { exact: true })
        .waitFor({ timeout: 120_000 });
      await page.waitForFunction(() => window.waitingTextures.length >= 2);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      assert.equal(
        await page.evaluate(() =>
          document.documentElement.hasAttribute("data-glass-wallpaper-ready"),
        ),
        false,
      );
      const regions = await page.evaluate(() =>
        [...document.querySelectorAll("main .glass-warp")]
          .map((layer) => {
            const rect = layer.getBoundingClientRect();
            // Only sample the interior: the CSS and Canvas blur kernels differ
            // slightly at clipped rims. Controls and text stay in the same place.
            const left = Math.ceil(rect.left + 24),
              top = Math.ceil(rect.top + 24);
            const right = Math.floor(Math.min(rect.right - 24, innerWidth));
            const bottom = Math.floor(Math.min(rect.bottom - 24, innerHeight));
            return { left, top, width: right - left, height: bottom - top };
          })
          .filter(
            (region) =>
              region.top >= 0 && region.width > 0 && region.height > 0,
          ),
      );
      assert.ok(
        regions.length >= 2,
        "Actual course cards and toolbars are visible before cache completion",
      );
      const before = await sharp(await page.screenshot())
        .removeAlpha()
        .raw()
        .toBuffer();
      await page.evaluate(() => {
        window.holdTextures = false;
        window.waitingTextures.splice(0).forEach((resolve) => resolve());
      });
      await page.waitForFunction(() =>
        document.documentElement.hasAttribute("data-glass-wallpaper-ready"),
      );
      await page.waitForTimeout(150);
      const after = await sharp(await page.screenshot())
        .removeAlpha()
        .raw()
        .toBuffer();
      let difference = 0,
        channels = 0;
      for (const region of regions) {
        for (let y = region.top; y < region.top + region.height; y++) {
          for (let x = region.left; x < region.left + region.width; x++) {
            const offset = (y * viewport.width + x) * 3;
            for (let channel = 0; channel < 3; channel++) {
              difference += Math.abs(
                before[offset + channel] - after[offset + channel],
              );
              channels++;
            }
          }
        }
      }
      const meanDifference = difference / channels;
      console.log(
        `${theme} ${viewport.width}x${viewport.height}: mean channel difference ${meanDifference.toFixed(3)}`,
      );
      assert.ok(
        meanDifference < 1,
        "Courselearn cache completion must preserve the visible wallpaper",
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(requests.unknownAPI, []);
      await context.close();
    }
  }
} finally {
  await browser.close();
}
