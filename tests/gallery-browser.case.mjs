// Browser cases run explicitly against an exported Gallery; no native-device result is implied.
// Set REVIEW_GALLERY_URL and PLAYWRIGHT_MODULE to the installed Playwright entry.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

async function gallery(run) {
  assert.ok(process.env.REVIEW_GALLERY_URL, "supply the locally served Gallery URL");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    page.setDefaultTimeout(5000);
    await page.goto(process.env.REVIEW_GALLERY_URL, { waitUntil: "networkidle" });
    await page.getByTestId("gallery-case").waitFor();
    await page.getByTestId("gallery-language").locator("select").selectOption("en");
    await run(page);
  } finally {
    await browser.close();
  }
}

test("the zoom adapter displays the selected ready Gallery media", async () => {
  await gallery(async (page) => {
    await page.getByTestId("gallery-case").locator("select").selectOption("photo-viewer/middle");
    await page.getByRole("button", { name: "Close", exact: true }).waitFor();
    const image = page.getByText("Landscape shape", { exact: true });
    // Give the actual zoom/layout adapter time to measure, including after its first render.
    await image.waitFor({ state: "visible", timeout: 3000 }).catch(() => undefined);
    const bounds = await image.boundingBox();
    console.log("Selected ready media bounds:", bounds);
    assert.ok(
      bounds && bounds.width > 0 && bounds.height > 0,
      "selected ready media must be visible",
    );
  });
});

test("disclosure exposes its expanded state in the browser accessibility tree", async () => {
  await gallery(async (page) => {
    await page
      .getByTestId("gallery-case")
      .locator("select")
      .selectOption("disclosure-section/default");
    const expand = page.getByRole("button", { name: "Expand", exact: true });
    await expand.focus();
    await page.keyboard.press("Space");
    const collapse = page.getByRole("button", { name: "Collapse", exact: true });
    await collapse.waitFor();
    assert.equal(await collapse.getAttribute("aria-expanded"), "true");
    await page.keyboard.press("Space");
    await expand.waitFor();
    assert.equal(await expand.getAttribute("aria-expanded"), "false");
  });
});
