// The fifteen gallery pages are the unit the design bar is reviewed in: a
// reviewer opens /gallery/<id> and sees a screen. Every case id a page names has
// to exist in the kit's own vocabulary, or the page refuses at boot and the
// review sees a notice instead of a component — which is what this suite caught
// the first time it was written. Copy is checked in both languages because the
// pages print the kit's words.
import assert from "node:assert/strict";
import test from "node:test";
import { deriveCopy } from "../src/core/copy";
import {
  deriveGalleryPage,
  galleryPageIds,
  galleryPages,
  pageFamily,
} from "../src/core/galleryPages";
import { kitCaseIds, kitExamples } from "../src/core/kitGallery";
import type { Presentation } from "../src/core/presentation";

const english: Presentation = {
  copy: deriveCopy("en"),
  locale: "en-GB",
  timeZone: "UTC",
  now: "2026-08-14T12:00:00Z",
  weekStartsOn: 1,
  motion: "reduced",
};
const portuguese: Presentation = { ...english, copy: deriveCopy("pt"), locale: "pt-PT" };

const fifteen = [
  "list",
  "table",
  "media",
  "home",
  "sheet",
  "navigate",
  "search",
  "form",
  "steps",
  "states",
  "player",
  "commerce",
  "schedule",
  "maps",
  "charts",
];

test("the fifteen pages are the fifteen the review opens, in this order", () => {
  assert.deepEqual(galleryPageIds, fifteen);
});

test("every page derives in both languages, with the specimens it names", () => {
  for (const language of [english, portuguese])
    for (const id of fifteen) {
      const result = deriveGalleryPage(id, language);
      assert.ok(result.ok, `${id}: ${result.ok ? "" : JSON.stringify(result.issues)}`);
      const page = result.value;
      assert.equal(page.id, id);
      assert.equal(page.testID, `gallery-page:${id}`);
      assert.ok(page.cases.length >= 1 && page.cases.length <= 6, `${id}: ${page.cases.length}`);
      // The lead is one of the page's cases: the composition shows it first and
      // would show it twice if it stood outside the list.
      assert.ok(page.cases.includes(page.lead), `${id}: lead ${page.lead} is not a case`);
      assert.equal(new Set(page.cases).size, page.cases.length, `${id}: a case twice`);
    }
});

test("no page names a specimen the kit does not have", () => {
  for (const [id, spec] of Object.entries(galleryPages))
    for (const caseId of spec.cases)
      assert.ok(
        (kitCaseIds as readonly string[]).includes(caseId),
        `${id} names ${caseId}, which kitCaseIds does not hold`,
      );
});

test("every family the kit owns is shown by exactly one page", () => {
  const owned = new Map<string, string[]>();
  for (const [id, spec] of Object.entries(galleryPages))
    for (const caseId of spec.cases)
      owned.set(pageFamily(caseId), [...(owned.get(pageFamily(caseId)) ?? []), id]);
  for (const [family, pages] of owned)
    assert.equal(new Set(pages).size, 1, `${family} is shown by ${pages.join(" and ")}`);
  const kitFamilies = new Set((kitCaseIds as readonly string[]).map(pageFamily));
  for (const family of kitFamilies) assert.ok(owned.has(family), `${family} is on no page`);
  for (const family of owned.keys())
    assert.ok(kitFamilies.has(family), `${family} is not a kit family`);
});

test("a page id the list does not hold refuses naming the page", () => {
  const result = deriveGalleryPage("signin", english);
  assert.ok(!result.ok);
  assert.deepEqual(
    (result as { ok: false; issues: readonly { path: string }[] }).issues.map((i) => i.path),
    ["page"],
  );
});

/**
 * The media screen leads with one picture, and that picture's own ratio decides how
 * much of a phone's first screen is left for the words and the act beneath it. A
 * picture taller than it is wide measured 537 of the 844 px a phone shows, so the
 * screen kept its own state control below the fold. A wall of matches still
 * demonstrates pictures of more than one shape: the mix is the specimen's point.
 */
test("the picture a phone screen leads with leaves its fold to the screen", () => {
  const lead = kitExamples(english, "media-hero/default");
  if (!lead.ok) throw new Error(JSON.stringify(lead.issues));
  const item = lead.value.hero.item;
  assert.ok(item.width >= item.height, `the lead picture is ${item.width}x${item.height}`);
  const wall = kitExamples(english, "photo-gallery/mixed-ratios");
  if (!wall.ok) throw new Error(JSON.stringify(wall.issues));
  const ratios = new Set(wall.value.media.items.map((i) => i.width / i.height));
  assert.ok(ratios.size > 1, "a wall of matches shows pictures of more than one shape");
});
