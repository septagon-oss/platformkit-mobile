// Manual browser pin for the shared viewer: run it by hand with REVIEW_GALLERY_URL
// and PLAYWRIGHT_MODULE set. It is not part of npm run test, which has no browser.
// Exercises the real Zoom Toolkit adapter; this does not establish native-device behavior.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(`${process.cwd()}/package.json`);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

test("viewer reflows and resets zoom without losing media or keyboard navigation", async () => {
  assert.ok(process.env.REVIEW_GALLERY_URL, "supply the locally served Gallery URL");
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE ?? "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  try {
    for (const language of ["en", "pt"]) {
      for (const mode of ["light", "dark"]) {
        const page = await browser.newPage({
          viewport: { width: 390, height: 844 },
          reducedMotion: "reduce",
        });
        page.setDefaultTimeout(5000);
        const errors: string[] = [];
        page.on("pageerror", (error: Error) => errors.push(String(error)));
        await page.goto(process.env.REVIEW_GALLERY_URL, { waitUntil: "networkidle" });
        await page.getByTestId("gallery-language").locator("select").selectOption(language);
        await page.getByTestId("gallery-mode").locator("select").selectOption(mode);
        await page
          .getByTestId("gallery-case")
          .locator("select")
          .selectOption("photo-viewer/middle");
        const labels =
          language === "pt"
            ? {
                close: "Fechar",
                previous: "Anterior",
                next: "Seguinte",
                zoom: "Ampliar",
                reset: "Repor",
              }
            : {
                close: "Close",
                previous: "Previous",
                next: "Next",
                zoom: "Zoom in",
                reset: "Reset",
              };
        const button = (name: string) => page.getByRole("button", { name, exact: true });
        const activate = async (name: string) => {
          await button(name).focus();
          await page.keyboard.press("Enter");
        };
        const fitted = async () => {
          // Reach through the independent Close control, then wait for the correct layout.
          await button(labels.close).waitFor();
          await page.waitForFunction(() => {
            const child = document.querySelector('[data-testid="child"]');
            if (!child) return false;
            let clip = child.parentElement;
            while (clip && getComputedStyle(clip).overflow !== "hidden") clip = clip.parentElement;
            if (!clip) return false;
            const image = child.getBoundingClientRect();
            const frame = clip.getBoundingClientRect();
            return (
              image.width > 0 &&
              image.height > 0 &&
              image.left >= frame.left - 1 &&
              image.right <= frame.right + 1 &&
              image.top >= frame.top - 1 &&
              image.bottom <= frame.bottom + 1 &&
              frame.top >= 0 &&
              frame.bottom <= innerHeight
            );
          });
          for (const name of [labels.close, labels.previous, labels.next]) {
            assert.ok(
              await button(name).evaluate((element: HTMLElement) => {
                const box = element.getBoundingClientRect();
                const x = box.x + box.width / 2;
                const y = box.y + box.height / 2;
                return (
                  box.width >= 44 &&
                  box.height >= 44 &&
                  x >= 0 &&
                  x < innerWidth &&
                  y >= 0 &&
                  y < innerHeight &&
                  element.contains(document.elementFromPoint(x, y))
                );
              }),
              `${language}/${mode}: ${name} stays unobscured after reflow`,
            );
          }
          return page.getByTestId("child").boundingBox();
        };
        const portrait = await fitted();
        await activate(labels.zoom);
        await page.waitForFunction(() =>
          document
            .querySelector<HTMLElement>('[data-testid="root"]')
            ?.style.transform.includes("scale(2)"),
        );
        await page.setViewportSize({ width: 568, height: 320 });
        await activate(labels.reset);
        const landscape = await fitted();
        await activate(labels.zoom);
        await page.waitForFunction(() =>
          document
            .querySelector<HTMLElement>('[data-testid="root"]')
            ?.style.transform.includes("scale(2)"),
        );
        await activate(labels.previous);
        await page.waitForFunction(() =>
          document
            .querySelector<HTMLElement>('[data-testid="root"]')
            ?.style.transform.includes("scale(1)"),
        );
        assert.equal(await button(labels.previous).isEnabled(), false);
        assert.equal(await button(labels.next).isEnabled(), true);
        await fitted();
        await page.setViewportSize({ width: 320, height: 568 });
        await fitted();
        await activate(labels.next);
        await fitted();
        assert.equal(await button(labels.next).isEnabled(), false);
        await page.keyboard.press("Escape");
        await button(labels.close).waitFor({ state: "hidden" });
        assert.equal(await page.getByTestId("gallery-case").isVisible(), true);
        assert.deepEqual(errors, [], "reflow and keyboard interaction must not crash");
        console.log({ language, mode, portrait, landscape, keyboardNavigation: true });
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});
