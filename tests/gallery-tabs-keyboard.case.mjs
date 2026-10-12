import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

async function withTabs(run) {
  assert.ok(process.env.GALLERY_BASE_URL, "supply the served gallery origin");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${process.env.GALLERY_BASE_URL}/gallery?case=tab-bar/three`, {
      waitUntil: "networkidle",
    });
    const bar = page.getByTestId("gallery-tabs");
    await bar.waitFor({ state: "visible" });
    await run(page, bar.getByRole("tab"));
  } finally {
    await browser.close();
  }
}

test("the selected tab is the tablist's single sequential keyboard stop", async () => {
  await withTabs(async (_page, tabs) => {
    assert.equal(await tabs.count(), 3);
    const stops = await tabs.evaluateAll((elements) =>
      elements
        .filter((element) => element.tabIndex === 0)
        .map((element) => ({
          name: element.getAttribute("aria-label"),
          selected: element.getAttribute("aria-selected"),
        })),
    );
    assert.equal(stops.length, 1, JSON.stringify(stops));
    assert.equal(stops[0].selected, "true");
  });
});

test("arrow keys move focus between tabs and wrap at the end", async () => {
  await withTabs(async (page, tabs) => {
    assert.equal(await tabs.count(), 3);
    await tabs.nth(1).focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(
      await tabs.nth(2).evaluate((element) => element === document.activeElement),
      true,
      "Right from the middle destination must focus the last destination",
    );
    await page.keyboard.press("ArrowRight");
    assert.equal(await tabs.nth(0).evaluate((element) => element === document.activeElement), true);
    await page.keyboard.press("ArrowLeft");
    assert.equal(await tabs.nth(2).evaluate((element) => element === document.activeElement), true);
  });
});
