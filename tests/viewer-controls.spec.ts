// Run with tsx --test against REVIEW_GALLERY_URL and an installed PLAYWRIGHT_MODULE.
// The exported Gallery uses the real web zoom adapter; this is not native-device proof.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(`${process.cwd()}/package.json`);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

test("viewer scrolls every keyboard-focused control fully into view in short landscape", async () => {
  assert.ok(process.env.REVIEW_GALLERY_URL, "supply the locally served Gallery URL");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 568, height: 320 },
      reducedMotion: "reduce",
    });
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    page.on("pageerror", (error: Error) => errors.push(String(error)));
    await page.goto(process.env.REVIEW_GALLERY_URL, { waitUntil: "networkidle" });
    await page.getByTestId("gallery-language").locator("select").selectOption("pt");
    await page.getByTestId("gallery-case").locator("select").selectOption("photo-viewer/middle");
    const close = page.getByRole("button", { name: "Fechar", exact: true });
    await close.waitFor();
    await close.focus();
    const controls = [
      "Mover para a esquerda",
      "Mover para a direita",
      "Mover para cima",
      "Mover para baixo",
      "Reduzir",
      "Ampliar",
      "Repor",
    ];
    const visited = new Set<string>();
    for (let step = 0; step < 16 && visited.size < controls.length; step++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
      if (!controls.includes(focused)) continue;
      const button = page.getByRole("button", { name: focused, exact: true });
      const bounds = await button.boundingBox();
      // Browser scroll offsets round to CSS pixels; layout widths can be fractional.
      assert.ok(
        bounds &&
          bounds.width >= 44 &&
          bounds.height >= 44 &&
          Math.round(bounds.x) >= 0 &&
          Math.round(bounds.x + bounds.width) <= 568 &&
          bounds.y >= 0 &&
          bounds.y + bounds.height <= 320,
        `${focused}: the complete focused control must be onscreen`,
      );
      visited.add(focused);
    }
    assert.deepEqual([...visited], controls, "Tab reaches all controls in their visible order");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() =>
      document
        .querySelector<HTMLElement>('[data-testid="root"]')
        ?.style.transform.includes("scale(2)"),
    );
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() =>
      document
        .querySelector<HTMLElement>('[data-testid="root"]')
        ?.style.transform.includes("scale(1)"),
    );
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
