import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? "playwright");

// The browser's own accessibility tree, not the DOM attribute: an attribute the
// role does not allow is written and never announced.
async function accessibleControls(id) {
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
    const cdp = await page.context().newCDPSession(page);
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");
    // Text runs carry the same names as the control they sit in; only a control
    // can be chosen.
    const controls = ["button", "tab", "radio", "option", "gridcell", "checkbox"];
    return nodes
      .filter((node) => !node.ignored && node.name?.value && controls.includes(node.role?.value))
      .map((node) => {
        const state = Object.fromEntries(
          (node.properties ?? []).map((property) => [property.name, property.value.value]),
        );
        const chosen =
          state.selected === true || state.checked === "true" || state.pressed === "true";
        return { name: node.name.value, chosen };
      });
  } finally {
    await browser.close();
  }
}

function chosenAmong(controls, names) {
  const present = controls.filter((control) => names.includes(control.name));
  assert.ok(present.length >= names.length, `the page draws ${names.join(", ")}`);
  return [...new Set(present.filter((control) => control.chosen).map((control) => control.name))];
}

test("a calendar's chosen view is announced as chosen by browser assistive technology", async () => {
  const controls = await accessibleControls("calendar/week");
  assert.deepEqual(chosenAmong(controls, ["Day", "Week", "Agenda"]), ["Week"]);
});

test("a map's chosen mode is announced as chosen by browser assistive technology", async () => {
  const controls = await accessibleControls("map-with-list/points");
  assert.deepEqual(chosenAmong(controls, ["Map", "List"]), ["Map"]);
});

test("a day strip's chosen day is announced as chosen by browser assistive technology", async () => {
  const controls = await accessibleControls("day-strip/current");
  const days = controls.filter((control) =>
    /^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d+$/.test(control.name),
  );
  assert.equal(days.length, 7);
  assert.equal(days.filter((day) => day.chosen).length, 1);
});
