import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

// A quantity stepper is read as one line — less, how many, more — so the value
// sits between its two controls. At a phone's width the home page's product
// card must keep all three on one row; two controls on two rows strand the value.
test("home gallery keeps a quantity's decrease, value and increase on one row at 390", async () => {
  const baseURL = process.env.GALLERY_BASE_URL;
  assert.ok(baseURL, "supply the served gallery origin");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${baseURL}/gallery/home`, { waitUntil: "networkidle" });
    await page.getByTestId("gallery-page:home").waitFor({ state: "visible" });
    const adjustable = page.getByRole("slider", { name: "Quantity" }).first();
    await adjustable.waitFor({ state: "visible" });
    const row = adjustable.locator("xpath=..");
    const controls = row.locator(":scope > [role='button']");
    assert.equal(await controls.count(), 2, "the value stands between two controls");
    const boxes = [
      await controls.nth(0).boundingBox(),
      await adjustable.boundingBox(),
      await controls.nth(1).boundingBox(),
    ];
    const middles = boxes.map((box) => box.y + box.height / 2);
    const spread = Math.max(...middles) - Math.min(...middles);
    assert.ok(spread < 4, `decrease, value and increase share one row (spread ${spread}px)`);
  } finally {
    await browser.close();
  }
});
