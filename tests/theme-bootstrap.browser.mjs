/**
 * Run against an isolated production server: node tests/theme-bootstrap.browser.mjs
 * THEME_BOOTSTRAP_BASE_URL defaults to http://127.0.0.1:8094; never use port 8090.
 * PLAYWRIGHT_MODULE and CHROME_EXECUTABLE are optional. All API traffic is mocked.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { loadPlaywright } from "./liquid-glass.browser.mjs";

const baseURL = process.env.THEME_BOOTSTRAP_BASE_URL ?? "http://127.0.0.1:8094";
const origin = new URL(baseURL).origin;
assert.notEqual(new URL(baseURL).port, "8090", "Use an isolated test server.");

const cases = [
  {
    name: "saved dark overrides light OS",
    theme: "dark",
    background: "magnificent",
    os: "light",
    mode: "dark",
    bg: "magnificent",
  },
  {
    name: "saved light overrides dark OS",
    theme: "light",
    background: "defalut",
    os: "dark",
    mode: "light",
    bg: "defalut",
  },
  {
    name: "system dark",
    theme: "system",
    background: "defalut",
    os: "dark",
    mode: "dark",
    bg: "defalut",
  },
  {
    name: "system light",
    theme: "system",
    background: "magnificent",
    os: "light",
    mode: "light",
    bg: "magnificent",
  },
  {
    name: "invalid preferences",
    theme: "obsolete",
    background: "obsolete",
    os: "dark",
    mode: "dark",
    bg: "magnificent",
  },
  {
    name: "missing preferences",
    os: "light",
    mode: "light",
    bg: "magnificent",
  },
];

const course = (courseId) => ({
  courseId,
  courseName: `Fictional course ${courseId}`,
  isMyCourse: true,
  wordsCount: 3,
  notDoneCount: 1,
  doneCount: 1,
  notLearned: 1,
  percentage: "33.3",
});

function observeAppearance() {
  const samples = (window.__themeSamples = { frames: [], paints: [] });
  const snapshot = () => {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    return {
      dark: root.classList.contains("dark"),
      colorScheme: style.colorScheme,
      background: root.dataset.bgTheme,
      appBackground: style.getPropertyValue("--app-background").trim(),
    };
  };
  window.__readAppearance = snapshot;
  const frame = () => {
    // Ignore empty parser frames before there is any application content.
    if (document.querySelector(".app-shell")) samples.frames.push(snapshot());
    if (samples.frames.length < 12) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries())
      samples.paints.push({ name: entry.name, appearance: snapshot() });
  }).observe({ type: "paint", buffered: true });
}

async function createContext(browser, preference, blockBundles) {
  const values = { token: "fictional-theme-test-token" };
  if (preference.theme !== undefined) values.theme = preference.theme;
  if (preference.background !== undefined)
    values["background-theme"] = preference.background;
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    colorScheme: preference.os,
    serviceWorkers: "block",
    storageState: {
      cookies: [],
      origins: [
        {
          origin,
          localStorage: Object.entries(values).map(([name, value]) => ({
            name,
            value,
          })),
        },
      ],
    },
  });
  await context.addCookies([
    { name: "auth_token", value: "fictional-theme-test-token", url: origin },
  ]);
  await context.addInitScript(observeAppearance);
  const requests = { blockedBundles: 0, mockedAPI: 0 };
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (
      /\/api(?:\/|$)|\/(?:Word|Course|Statistics|Task|Whisper)\//i.test(
        url.pathname,
      )
    ) {
      requests.mockedAPI++;
      const data = /\/Course\/MyCategoryContent$/i.test(url.pathname)
        ? {
            categoryInfos: [],
            myCategoryInfos: [],
            newWord: course(-1),
            strengthenWord: course(-2),
            lastCourse: course(1),
          }
        : [];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data }),
      });
    }
    if (blockBundles && /^\/_next\/.*\.js$/i.test(url.pathname)) {
      requests.blockedBundles++;
      return route.abort();
    }
    if (url.origin !== origin) return route.abort();
    return route.continue();
  });
  return { context, requests };
}

function assertAppearance(actual, expected, label) {
  assert.equal(actual.dark, expected.mode === "dark", `${label}: root .dark`);
  assert.equal(actual.colorScheme, expected.mode, `${label}: color-scheme`);
  assert.equal(actual.background, expected.bg, `${label}: data-bg-theme`);
  if (expected.bg === "magnificent") {
    assert.ok(
      actual.appBackground.includes(`/images/bg01_${expected.mode}.jpeg`),
      `${label}: selected wallpaper`,
    );
    assert.ok(
      !actual.appBackground.includes(
        `bg01_${expected.mode === "dark" ? "light" : "dark"}.jpeg`,
      ),
      `${label}: no opposite wallpaper`,
    );
  } else {
    assert.match(
      actual.appBackground,
      /radial-gradient\(/,
      `${label}: default gradient`,
    );
    const palette =
      expected.mode === "dark"
        ? /oklch\((?:0?\.12|12%)[\s]+0?\.008[\s]+240\)/
        : /oklch\((?:0?\.95|95%)[\s]+0?\.006[\s]+240\)/;
    assert.match(
      actual.appBackground,
      palette,
      `${label}: default ${expected.mode} palette`,
    );
    assert.doesNotMatch(
      actual.appBackground,
      /url\(/,
      `${label}: no photo background`,
    );
  }
}

async function firstPaintCheck(browser, pathname, preference) {
  const { context, requests } = await createContext(browser, preference, true);
  try {
    const page = await context.newPage();
    await page.goto(`${baseURL}${pathname}`, { waitUntil: "load" });
    assert.equal(
      new URL(page.url()).pathname,
      pathname,
      "Fixture must not redirect",
    );
    await page.waitForFunction(
      () =>
        window.__themeSamples.frames.length >= 2 &&
        window.__themeSamples.paints.length > 0,
    );
    const samples = await page.evaluate(() => window.__themeSamples);
    const label = `${pathname}: ${preference.name}`;
    assert.ok(
      requests.blockedBundles > 0,
      "React bundles must be blocked for this proof",
    );
    for (const sample of samples.frames)
      assertAppearance(sample, preference, `${label}, frame`);
    for (const sample of samples.paints)
      assertAppearance(
        sample.appearance,
        preference,
        `${label}, ${sample.name}`,
      );
    assertAppearance(
      await page.evaluate(() => window.__readAppearance()),
      preference,
      label,
    );
    console.log(`PASS before hydration: ${label}`);
  } finally {
    await context.close();
  }
}

async function waitForAppearance(page, expected) {
  await page.waitForFunction(({ mode, bg }) => {
    const root = document.documentElement;
    return (
      root.classList.contains("dark") === (mode === "dark") &&
      root.dataset.bgTheme === bg &&
      root.style.colorScheme === mode
    );
  }, expected);
  assertAppearance(
    await page.evaluate(() => window.__readAppearance()),
    expected,
    "hydrated appearance",
  );
}

async function chooseBackground(page, label) {
  const trigger = page.getByRole("button", { name: /背景主题/ });
  if (await trigger.count()) await trigger.first().click();
  else
    await page
      .locator('[aria-haspopup="listbox"]')
      .filter({ hasText: /图片|默认/ })
      .first()
      .click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

async function hydrationCheck(browser, pathname, preference) {
  const { context, requests } = await createContext(browser, preference, false);
  try {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (/hydrati|Minified React error #(?:418|423|425)/i.test(message.text()))
        errors.push(message.text());
    });
    await page.goto(`${baseURL}${pathname}`, { waitUntil: "networkidle" });
    await waitForAppearance(page, preference);
    const samples = await page.evaluate(() => window.__themeSamples);
    assert.ok(samples.frames.length > 0 && samples.paints.length > 0);
    for (const sample of samples.frames)
      assertAppearance(
        sample,
        preference,
        `${pathname}: initial hydration frame`,
      );
    for (const sample of samples.paints)
      assertAppearance(
        sample.appearance,
        preference,
        `${pathname}: initial ${sample.name}`,
      );
    if (pathname === "/login") {
      await page.locator("#password + button").click();
      await page.waitForFunction(
        () => document.querySelector("#password")?.type === "text",
      );
    } else {
      assert.ok(
        requests.mockedAPI > 0,
        "Learning data must come from the fixture",
      );
      await page.getByLabel("Light", { exact: true }).click();
      await waitForAppearance(page, { mode: "light", bg: preference.bg });
      await page.getByLabel("Dark", { exact: true }).click();
      await waitForAppearance(page, { mode: "dark", bg: preference.bg });
      await page.getByLabel("System", { exact: true }).click();
      await waitForAppearance(page, { mode: preference.os, bg: preference.bg });
      const opposite = preference.os === "dark" ? "light" : "dark";
      await page.emulateMedia({ colorScheme: opposite });
      await waitForAppearance(page, { mode: opposite, bg: preference.bg });
      await chooseBackground(page, "默认");
      await waitForAppearance(page, { mode: opposite, bg: "defalut" });
      await chooseBackground(page, "图片");
      await waitForAppearance(page, { mode: opposite, bg: "magnificent" });
      await page.getByLabel("Dark", { exact: true }).click();
      await waitForAppearance(page, { mode: "dark", bg: "magnificent" });
      await chooseBackground(page, "默认");
      await waitForAppearance(page, { mode: "dark", bg: "defalut" });
      await page.reload({ waitUntil: "networkidle" });
      await waitForAppearance(page, { mode: "dark", bg: "defalut" });
      const stored = await page.evaluate(() => [
        localStorage.getItem("theme"),
        localStorage.getItem("background-theme"),
      ]);
      assert.deepEqual(
        stored,
        ["dark", "defalut"],
        "User changes persist through reload",
      );
    }
    assert.deepEqual(errors, [], `${pathname}: no hydration or runtime errors`);
    console.log(`PASS hydrated: ${pathname}, ${preference.name}`);
  } finally {
    await context.close();
  }
}

const { chromium } = await loadPlaywright();
const chrome =
  process.env.CHROME_EXECUTABLE ??
  (existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe")
    ? "C:/Program Files/Google/Chrome/Application/chrome.exe"
    : undefined);
const browser = await chromium.launch({
  headless: true,
  executablePath: chrome,
});
try {
  for (const pathname of ["/login", "/learnwords"])
    for (const preference of cases)
      await firstPaintCheck(browser, pathname, preference);
  for (const pathname of ["/login", "/learnwords"])
    for (const preference of cases.slice(0, 2))
      await hydrationCheck(browser, pathname, preference);
  console.log(
    "Theme bootstrap: 12 first-paint cases and 4 hydration cases passed.",
  );
} finally {
  await browser.close();
}
