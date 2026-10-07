// The card's transport is measured, not admired: the one control that answers is
// drawn larger than the two skips beside it, its glyph with it, and the line sits
// under the scrubber it belongs to instead of crowding one corner of the card.
// Jest pins the disc the control asks for; this measures what the served page
// draws at both required widths.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

const measure = () => {
  const inGlyph = (text) => {
    const code = text.codePointAt(0) ?? 0;
    return code >= 0xe000 && code <= 0xf8ff;
  };
  const bounds = (id) => {
    const element = document.querySelector(`[data-testid="${id}"]`);
    if (!element) return undefined;
    const rect = element.getBoundingClientRect();
    let glyph;
    for (const node of element.querySelectorAll("*")) {
      const own = Array.from(node.childNodes)
        .filter((node) => node.nodeType === 3)
        .map((node) => node.textContent)
        .join("");
      if (own.length === 1 && inGlyph(own)) {
        const mark = node.getBoundingClientRect();
        glyph = { left: mark.left, width: mark.width, height: mark.height };
      }
    }
    return { left: rect.left, width: rect.width, height: rect.height, centre: rect.left + rect.width / 2, glyph };
  };
  return {
    card: bounds("gallery-player"),
    track: bounds("kit-player-track"),
    back: bounds("gallery-player-back"),
    toggle: bounds("gallery-player-toggle"),
    forward: bounds("gallery-player-forward"),
  };
};

for (const width of [390, 1440]) {
  test(`the player card at ${width}px makes its one answer the dominant control`, async () => {
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
      await page.goto(`${process.env.GALLERY_BASE_URL}/gallery/player`, {
        waitUntil: "networkidle",
      });
      await page.getByTestId("gallery-page:player").waitFor({ state: "visible" });
      const drawn = await page.evaluate(measure);
      console.log(JSON.stringify({ viewport: width, ...drawn }));
      for (const part of ["card", "track", "back", "toggle", "forward"]) {
        assert.ok(drawn[part], `the card draws its ${part}`);
      }
      assert.ok(drawn.toggle.width > drawn.back.width, "the answer is drawn larger");
      assert.ok(drawn.toggle.width > drawn.forward.width, "and larger than the skip ahead");
      assert.equal(drawn.back.width, drawn.forward.width, "the two skips are one control");
      assert.ok(drawn.toggle.height > drawn.back.height, "with the height to match");
      assert.ok(drawn.toggle.glyph.width > drawn.back.glyph.width, "and a glyph to match");
      const line = (drawn.back.left + drawn.forward.left + drawn.forward.width) / 2;
      assert.ok(
        Math.abs(line - (drawn.track.left + drawn.track.width / 2)) < 1,
        `the transport line centres on the scrubber: ${JSON.stringify({ line, track: drawn.track })}`,
      );
    } finally {
      await browser.close();
    }
  });
}
