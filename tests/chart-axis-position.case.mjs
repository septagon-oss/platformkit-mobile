import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

test("chart hour labels align with the measurements they describe at both widths", async () => {
  assert.ok(process.env.GALLERY_BASE_URL, "supply the served gallery origin");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    const mismatches = [];
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      await page.goto(`${process.env.GALLERY_BASE_URL}/gallery/charts`, {
        waitUntil: "networkidle",
      });
      const specimen = page.getByTestId("gallery-page:charts");
      await specimen.waitFor({ state: "visible" });
      const plot = specimen.getByTestId("kit-chart-axis").first().locator("..");
      const points = await plot.locator("svg circle").evaluateAll((circles) =>
        circles.slice(0, 3).map((circle) => {
          const point = circle.ownerSVGElement.createSVGPoint();
          point.x = circle.cx.baseVal.value;
          point.y = circle.cy.baseVal.value;
          return point.matrixTransform(circle.getScreenCTM()).x;
        }),
      );
      assert.equal(points.length, 3, "the supplied chart has three rendered measurements");
      // The text alternative identifies the actual x value of each measurement.
      const data = await specimen.getByRole("button").allTextContents();
      const hours = data
        .filter((label) => /^Visitors per hour, /.test(label))
        .map((label) => label.match(/^Visitors per hour, (\d+):/)?.[1]);
      assert.equal(hours.length, points.length, "each plotted value has its text alternative");
      for (const [index, hour] of hours.entries()) {
        assert.ok(hour, "the text alternative names the measurement's hour");
        const tick = plot.getByText(hour, { exact: true });
        await tick.waitFor({ state: "visible" });
        // Measure the drawn text, not the wider flex cell holding that text.
        const bounds = await tick.evaluate((element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          const box = range.getBoundingClientRect();
          return { x: box.x, width: box.width };
        });
        assert.ok(bounds.width > 0, `hour ${hour} has a visible axis label`);
        const center = bounds.x + bounds.width / 2;
        if (Math.abs(center - points[index]) > 2) {
          mismatches.push({ width, hour, point: points[index], label: center });
        }
      }
      await page.close();
    }
    assert.deepEqual(
      mismatches,
      [],
      "ticks and plotted measurements must share one horizontal scale",
    );
  } finally {
    await browser.close();
  }
});
