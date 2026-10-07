// A staged task is one stage at a time. The gallery draws a page's other states
// beside the screen they belong to, and a column that shows every state at once
// is a wall of variants rather than a screen with states: three "Step 1 of 2"
// cards, one admission fact written four times. One example per family stands in
// the column openly, and the rest open under the disclosure the phone already
// uses. This measures the served page, in the browser a person looks at it in.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const launches = [];
const open = () =>
  chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });

const stageCards = (page) => page.locator('[data-testid="stepper-verbs"]').count();

// On a desk the column shows one example of each family beside the screen; on a
// phone the fold holds the screen alone and one press brings its family's whole
// set. The count that matters is the fold's, and the one thing both widths share
// is that the remaining examples are asked for, never dropped.
for (const [width, height, shutStages, openedStages] of [
  [1440, 900, 2, 3],
  [390, 844, 1, 3],
]) {
  test(`the steps page holds one stage per state on screen at ${width}px and reveals the rest on request`, async () => {
    assert.ok(process.env.GALLERY_BASE_URL, "supply the served gallery origin");
    const browser = await open();
    launches.push(browser);
    try {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto(`${process.env.GALLERY_BASE_URL}/gallery/steps`, {
        waitUntil: "networkidle",
      });
      const specimen = page.getByTestId("gallery-page:steps");
      await specimen.waitFor({ state: "visible" });

      // The page's own stage, plus the one example of each family that stands in
      // the state column openly.
      assert.equal(
        await stageCards(page),
        shutStages,
        `the fold should hold the screen and only the states shown beside it at ${width}px`,
      );

      const reveal = page.getByTestId("gallery-page-later-states").first();
      await reveal.waitFor({ state: "visible" });
      await reveal.click();
      // The remaining stage is now on the screen: nothing was dropped, only
      // asked for.
      assert.equal(
        await stageCards(page),
        openedStages,
        `the disclosure should bring the page's remaining stages onto the screen at ${width}px`,
      );
      await page.close();
    } finally {
      await browser.close();
    }
  });
}
