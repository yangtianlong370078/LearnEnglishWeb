/**
 * Regression for detached theme-popover trees retained by React Aria's
 * transition registry when a multi-property transition is interrupted.
 *
 * Run against an isolated production server (never the user's port 8090):
 *   LIQUID_GLASS_BASE_URL=http://127.0.0.1:8094 node tests/theme-picker-lifecycle.browser.mjs
 * Uses fictional APIs; no backend writes. CDP counters include detached DOM
 * nodes, and GC snapshots measure neither decoded bitmaps nor GPU memory.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseURL = process.env.LIQUID_GLASS_BASE_URL ?? "http://127.0.0.1:8094";
process.env.LIQUID_GLASS_BASE_URL = baseURL;
assert.notEqual(new URL(baseURL).port, "8090");
const { loadPlaywright, createContext, openFixture, chooseMode } = await import(
  "./liquid-glass.browser.mjs"
);
const output =
  process.env.GLASS_PICKER_OUTPUT ??
  "docs/glass-picker-lifecycle-2026-09-24-data.json";
const rounds = Number(process.env.GLASS_PICKER_ROUNDS ?? 20);
assert.ok(Number.isInteger(rounds) && rounds >= 5);

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
const page = await context.newPage();
const session = await context.newCDPSession(page);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await session.send("HeapProfiler.enable");
await session.send("Performance.enable");
const report = {
  startedAt: new Date().toISOString(),
  baseURL,
  browser: browser.version(),
  rounds,
  checkpoints: [],
  errors,
  passed: false,
};

async function checkpoint(label) {
  await page.waitForTimeout(400);
  await session.send("HeapProfiler.collectGarbage");
  const dom = await session.send("Memory.getDOMCounters");
  const metrics = Object.fromEntries(
    (await session.send("Performance.getMetrics")).metrics.map(
      ({ name, value }) => [name, value],
    ),
  );
  const result = {
    label,
    nodes: dom.nodes,
    listeners: dom.jsEventListeners,
    jsHeapAfterGcMiB: metrics.JSHeapUsedSize / 1024 ** 2,
  };
  report.checkpoints.push(result);
  console.log(JSON.stringify(result));
  return result;
}

function assertPlateau(baseline, current) {
  // Allow a bounded amount of unrelated lazy initialization. The regression
  // retained 74 DOM nodes and 14 listeners on EVERY card/glass cycle.
  assert.ok(
    current.nodes - baseline.nodes <= 40,
    `Detached DOM grew: ${baseline.nodes} -> ${current.nodes}`,
  );
  assert.ok(
    current.listeners - baseline.listeners <= 4,
    `Listeners grew: ${baseline.listeners} -> ${current.listeners}`,
  );
}

async function openPicker() {
  await page
    .locator('[aria-haspopup="listbox"]')
    .filter({ hasText: /图片|默认/ })
    .first()
    .click();
  await page.getByRole("radio", { name: "玻璃", exact: true }).waitFor();
}

try {
  await openFixture(page, "courselearn");
  // Warm the exact interactions before measuring like-for-like glass state.
  await chooseMode(page, "card");
  await chooseMode(page, "glass");
  const baseline = await checkpoint("warmed-glass");

  // Close immediately after selection, while the 300ms visual transition is
  // still active. Waiting for it to finish before Escape hides the defect.
  for (let round = 1; round <= rounds; round++) {
    await chooseMode(page, "card");
    await chooseMode(page, "glass");
    if (round % 5 === 0)
      assertPlateau(baseline, await checkpoint(`after-${round}-cycles`));
  }

  // Keyboard activation must keep the radio semantics and selected styles.
  await openPicker();
  const card = page.getByRole("radio", { name: "卡片", exact: true });
  await card.focus();
  await page.keyboard.press("Space");
  await page.waitForFunction(
    () => document.documentElement.dataset.glassMode === "card",
  );
  assert.equal(await card.isChecked(), true);
  await page.keyboard.press("Escape");
  await page.getByRole("radio", { name: "卡片", exact: true }).waitFor({
    state: "detached",
  });
  await chooseMode(page, "glass");
  const afterKeyboard = await checkpoint("after-keyboard-and-close");
  assertPlateau(baseline, afterKeyboard);

  // Verify the fix did not disable or shorten the selected-state transition.
  await openPicker();
  const transition = await page
    .getByRole("radio", { name: "玻璃", exact: true })
    .evaluate((input) => {
      const style = getComputedStyle(input.nextElementSibling);
      return {
        property: style.transitionProperty,
        duration: style.transitionDuration,
      };
    });
  assert.equal(transition.property, "all");
  assert.equal(transition.duration, "0.3s");
  report.selectedStateTransition = transition;
  await page.keyboard.press("Escape");
  await page.getByRole("radio", { name: "玻璃", exact: true }).waitFor({
    state: "detached",
  });
  assertPlateau(baseline, await checkpoint("final-glass"));
  assert.deepEqual(errors, []);
  assert.deepEqual(requests.unknownAPI, []);
  assert.deepEqual(requests.blockedWrites, []);
  report.passed = true;
} catch (error) {
  report.failure = { message: error.message, stack: error.stack };
  throw error;
} finally {
  report.finishedAt = new Date().toISOString();
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2));
  await context.close();
  await browser.close();
  console.log(`Report: ${output}`);
}
