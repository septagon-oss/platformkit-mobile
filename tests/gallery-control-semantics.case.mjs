import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

async function gallery(id, run) {
  assert.ok(process.env.GALLERY_BASE_URL, "supply the served gallery origin");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${process.env.GALLERY_BASE_URL}/gallery?case=${id}`, {
      waitUntil: "networkidle",
    });
    await page.getByTestId("gallery-case").waitFor({ state: "visible" });
    await run(page);
  } finally {
    await browser.close();
  }
}

test("tabs expose which destination is selected to browser assistive technology", async () => {
  await gallery("tab-bar/three", async (page) => {
    const tabs = page.getByRole("tablist").getByRole("tab");
    assert.equal(await tabs.count(), 3);
    assert.deepEqual(
      await tabs.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-selected"))),
      ["false", "true", "false"],
    );
  });
});

test("an unavailable destination exposes its disabled state in the browser", async () => {
  await gallery("tab-bar/unavailable", async (page) => {
    const tabs = page.getByRole("tablist").getByRole("tab");
    assert.equal(await tabs.count(), 3);
    assert.equal(await tabs.nth(1).getAttribute("aria-disabled"), "true");
  });
});

test("an adjustable quantity exposes its displayed value to browser assistive technology", async () => {
  await gallery("quantity-control/middle", async (page) => {
    const quantity = page.getByRole("slider");
    await quantity.waitFor({ state: "visible" });
    const displayed = (await quantity.innerText()).trim();
    assert.ok(Number.isFinite(Number(displayed)));
    assert.equal(await quantity.getAttribute("aria-valuenow"), displayed);
  });
});
