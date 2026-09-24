/** Compare complete production pages, including crops within full card canvases.
 * Start isolated baseline :8094 and optimized :8095 servers, then run this file.
 * GLASS_PAGE_BEFORE_URL / AFTER_URL / VISUAL_OUTPUT may override the defaults.
 * All APIs use fictional fixtures. Mobile is desktop-browser emulation.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const output =
  process.env.GLASS_PAGE_VISUAL_OUTPUT ??
  path.join(os.tmpdir(), "glass-page-visual-20260924");
const fixtures = {};
for (const [version, baseURL] of Object.entries({
  before: process.env.GLASS_PAGE_BEFORE_URL ?? "http://127.0.0.1:8094",
  after: process.env.GLASS_PAGE_AFTER_URL ?? "http://127.0.0.1:8095",
})) {
  assert.notEqual(
    new URL(baseURL).port,
    "8090",
    "Do not use the user's dev server",
  );
  process.env.LIQUID_GLASS_BASE_URL = baseURL;
  fixtures[version] = {
    baseURL,
    ...(await import(`./liquid-glass.browser.mjs?page-visual=${version}`)),
  };
}
const profiles = [
  {
    name: "desktop",
    viewport: { width: 1440, height: 900 },
    dpr: 1,
    mobile: false,
  },
  {
    name: "mobile",
    viewport: { width: 390, height: 844 },
    dpr: 2,
    mobile: true,
  },
];
const cases = profiles.flatMap((profile) =>
  ["courselearn", "learnwords"].flatMap((route) =>
    [0, 193].map((scroll) => ({
      name: `${profile.name}-${route}-dark-liquid-${scroll}`,
      profile,
      route,
      scroll,
      theme: "dark",
      background: "magnificent",
      mode: "liquid",
    })),
  ),
);
cases.push(
  {
    name: "desktop-light-photo-glass",
    profile: profiles[0],
    route: "courselearn",
    scroll: 0,
    theme: "light",
    background: "magnificent",
    mode: "glass",
  },
  {
    name: "desktop-light-ambient-card",
    profile: profiles[0],
    route: "learnwords",
    scroll: 0,
    theme: "light",
    background: "defalut",
    mode: "card",
  },
  {
    name: "desktop-dark-ambient-glass",
    profile: profiles[0],
    route: "courselearn",
    scroll: 0,
    theme: "dark",
    background: "defalut",
    mode: "glass",
  },
);

async function capture(browser, fixture, scenario, version) {
  const { context, requests } = await fixture.createContext(
    browser,
    scenario.profile,
  );
  const errors = [];
  try {
    await context.addInitScript(({ theme, background, mode }) => {
      const values = {
        theme,
        "background-theme": background,
        "glass-mode": mode,
      };
      // The shared fixture seeds dark/photo. Force these test preferences in
      // either init-script order; the page does not interact with the controls.
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        return setItem.call(
          this,
          key,
          this === localStorage && key in values ? values[key] : value,
        );
      };
      for (const [key, value] of Object.entries(values))
        localStorage.setItem(key, value);
    }, scenario);
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await fixture.openFixture(page, scenario.route);
    await page.mouse.move(1, 1);
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.evaluate(
      (top) => window.scrollTo({ top, behavior: "instant" }),
      scenario.scroll,
    );
    // Let scrolling, adaptive recovery and accordion transitions finish before
    // measuring stable visuals. This is a visual test, not a startup benchmark.
    await page.waitForTimeout(650);
    if (scenario.mode === "liquid")
      await page.waitForFunction(
        () => document.querySelectorAll(".liquid-glass-surface").length > 0,
      );
    const state = await page.evaluate(() => {
      const rect = (element) => {
        const bounds = element.getBoundingClientRect();
        return {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        };
      };
      return {
        theme: document.documentElement.classList.contains("dark")
          ? "dark"
          : "light",
        background: document.documentElement.dataset.bgTheme,
        mode: document.documentElement.dataset.glassMode,
        scroll: window.scrollY,
        ready: document.documentElement.hasAttribute(
          "data-glass-wallpaper-ready",
        ),
        layers: [...document.querySelectorAll(".glass-warp")].map(rect),
        canvases: [...document.querySelectorAll(".liquid-glass-surface")].map(
          (canvas) => ({
            ...rect(canvas),
            parent: rect(canvas.parentElement),
            widthPixels: canvas.width,
            heightPixels: canvas.height,
            placement: {
              left: canvas.style.left,
              top: canvas.style.top,
              width: canvas.style.width,
              height: canvas.style.height,
            },
          }),
        ),
      };
    });
    assert.equal(state.theme, scenario.theme);
    assert.equal(state.background, scenario.background);
    assert.equal(state.mode, scenario.mode);
    assert.equal(state.ready, true);
    if (scenario.scroll)
      assert.ok(state.scroll > 0, "Scrolled case must actually scroll");
    assert.deepEqual(errors, [], "No runtime errors");
    const filename = path.join(output, `${scenario.name}-${version}.png`);
    const screenshot = await page.screenshot({
      path: filename,
      animations: "disabled",
      caret: "hide",
    });
    return { screenshot, state, filename, requests };
  } finally {
    await context.close();
  }
}

async function compare(before, after, filename) {
  const a = await sharp(before)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const b = await sharp(after)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.deepEqual(a.info, b.info, "Screenshot dimensions must agree");
  let total = 0,
    significant = 0,
    maximum = 0,
    changed = 0;
  const heat = Buffer.alloc(a.data.length);
  const blockColumns = Math.ceil(a.info.width / 32);
  const blockCount = blockColumns * Math.ceil(a.info.height / 32);
  const blockSums = new Float64Array(blockCount);
  const blockCounts = new Uint32Array(blockCount);
  for (let i = 0; i < a.data.length; i += 4) {
    let pixel = 0;
    for (let c = 0; c < 3; c++) {
      const delta = Math.abs(a.data[i + c] - b.data[i + c]);
      total += delta;
      pixel = Math.max(pixel, delta);
      heat[i + c] = Math.min(255, delta * 8);
    }
    heat[i + 3] = 255;
    maximum = Math.max(maximum, pixel);
    if (pixel) changed++;
    if (pixel > 8) significant++;
    const x = (i / 4) % a.info.width,
      y = Math.floor(i / 4 / a.info.width);
    const block = Math.floor(y / 32) * blockColumns + Math.floor(x / 32);
    blockSums[block] += pixel;
    blockCounts[block]++;
  }
  await sharp(heat, { raw: a.info }).png().toFile(filename);
  const pixels = a.info.width * a.info.height;
  return {
    pixels,
    changedPixels: changed,
    maxChannelDifference: maximum,
    meanChannelDifference: total / (pixels * 3),
    significantPercent: (significant / pixels) * 100,
    worst32pxBlockMeanMaxDifference: Math.max(
      ...blockSums.map((sum, index) => sum / blockCounts[index]),
    ),
  };
}

await mkdir(output, { recursive: true });
const { chromium } = await fixtures.before.loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.CHROME_EXECUTABLE ??
    (existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe")
      ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
      : undefined),
});
const report = {
  createdAt: new Date().toISOString(),
  browser: browser.version(),
  servers: Object.fromEntries(
    Object.entries(fixtures).map(([key, fixture]) => [key, fixture.baseURL]),
  ),
  note: "Stable full-page viewport screenshots at device DPR. Independent random dither/JPEG may differ slightly. Significant pixel threshold is >8/255; geometry is checked independently. Heatmaps amplify differences 8x. Mobile is desktop emulation.",
  cases: [],
  passed: false,
};
try {
  for (const scenario of cases) {
    const before = await capture(browser, fixtures.before, scenario, "before");
    const after = await capture(browser, fixtures.after, scenario, "after");
    const difference = await compare(
      before.screenshot,
      after.screenshot,
      path.join(output, `${scenario.name}-difference.png`),
    );
    const geometryMatches =
      before.state.layers.length === after.state.layers.length &&
      before.state.layers.every((bounds, index) =>
        Object.keys(bounds).every(
          (key) =>
            Math.abs(bounds[key] - after.state.layers[index][key]) <= 0.1,
        ),
      );
    const row = {
      name: scenario.name,
      difference,
      geometryMatches,
      before: {
        state: before.state,
        screenshot: before.filename,
        requests: before.requests,
      },
      after: {
        state: after.state,
        screenshot: after.filename,
        requests: after.requests,
      },
      passed:
        geometryMatches &&
        Math.abs(before.state.scroll - after.state.scroll) <= 0.1 &&
        difference.meanChannelDifference <= 0.8 &&
        difference.significantPercent <= 0.2 &&
        difference.worst32pxBlockMeanMaxDifference <= 8,
    };
    report.cases.push(row);
    await writeFile(
      path.join(output, "report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(
      JSON.stringify({
        name: row.name,
        passed: row.passed,
        geometryMatches,
        ...difference,
      }),
    );
  }
  report.passed = report.cases.every((row) => row.passed);
  assert.ok(
    report.passed,
    "Full-page visual comparison failed; inspect screenshots and difference maps",
  );
} finally {
  await writeFile(
    path.join(output, "report.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
  console.log(`Visual artifacts: ${output}`);
}
