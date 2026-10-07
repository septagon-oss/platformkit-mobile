// Two measures a screenshot of the bar is judged by: every destination wears a
// mark, so no cell stands alone as bare text beside its neighbours, and a count
// sits against the mark it counts rather than the far corner of a wide cell.
// Jest cannot lay the bar out, so this runs against the served gallery at both
// required widths.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const measure = () => {
  const inMark = (text) => {
    const code = text.codePointAt(0) ?? 0;
    return code >= 0xe000 && code <= 0xf8ff;
  };
  const box = (element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  };
  const centreX = (rect) => rect.left + rect.width / 2;
  const cells = [];
  for (const element of document.querySelectorAll('[data-testid^="gallery-tabs:"]')) {
    if (element.dataset.testid.includes("note-")) continue;
    let mark;
    for (const node of element.querySelectorAll("*")) {
      const own = Array.from(node.childNodes)
        .filter((node) => node.nodeType === 3)
        .map((node) => node.textContent)
        .join("");
      if (own.length === 1 && inMark(own)) mark = box(node);
    }
    const countElement = element.querySelector('[data-testid="kit-tab-count"]');
    const count = countElement ? box(countElement) : undefined;
    cells.push({
      id: element.dataset.testid,
      mark,
      count,
      cell: box(element),
      markToCount:
        count && mark ? Math.abs(centreX(count) - centreX(mark)) : undefined,
    });
  }
  return cells;
};

for (const width of [390, 1440]) {
  test(`the bar at ${width}px marks every destination and anchors each count to its mark`, async () => {
    assert.ok(process.env.GALLERY_BASE_URL, "supply the served gallery origin");
    const browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
    try {
      const page = await browser.newPage({
        viewport: { width, height: width === 390 ? 844 : 900 },
        reducedMotion: "reduce",
      });
      await page.goto(`${process.env.GALLERY_BASE_URL}/gallery/navigate`, {
        waitUntil: "networkidle",
      });
      await page.getByTestId("gallery-page:navigate").waitFor({ state: "visible" });
      const cells = await page.evaluate(measure);
      console.log(JSON.stringify({ viewport: width, cells }));
      assert.ok(cells.length >= 3, "the page draws its tab bars");
      assert.deepEqual(
        cells.filter((cell) => !cell.mark || cell.mark.width <= 0).map((cell) => cell.id),
        [],
        "every destination of the bar wears a mark",
      );
      for (const cell of cells.filter((found) => found.count)) {
        // The count belongs to one mark: it may not be further away than that
        // mark's own width, which is what makes it read as the destination's and
        // not as something the cell keeps in its corner.
        assert.ok(
          cell.markToCount <= cell.mark.width,
          `${cell.id}: ${JSON.stringify({ markToCount: cell.markToCount, mark: cell.mark })}`,
        );
        assert.ok(
          cell.count.left >= cell.cell.left &&
            cell.count.left + cell.count.width <= cell.cell.left + cell.cell.width,
          `${cell.id}: the count stays inside its destination`,
        );
      }
      assert.ok(
        cells.some((cell) => cell.count),
        "the bar shows a count, so the anchor is measured and not vacuous",
      );
    } finally {
      await browser.close();
    }
  });
}
