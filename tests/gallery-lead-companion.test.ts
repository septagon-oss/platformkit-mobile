// A page's lead is a screen, and a control on a screen is drawn with the thing it
// controls: a search field whose results are held behind a disclosure is a promise
// the page does not keep. `withLead` names what a lead is a control over, and this
// checks the rule that keeps it honest — it must be one of the page's own cases,
// never the lead itself, and never one of the states below the fold.
import assert from "node:assert/strict";
import test from "node:test";
import { deriveCopy } from "../src/core/copy";
import { deriveGalleryPage, galleryPageIds, galleryPages } from "../src/core/galleryPages";
import type { Presentation } from "../src/core/presentation";

const english: Presentation = {
  copy: deriveCopy("en"),
  locale: "en-GB",
  timeZone: "UTC",
  ownZone: "UTC",
  now: "2026-08-14T12:00:00Z",
  weekStartsOn: 1,
  motion: "reduced",
};

const page = (id: string) => {
  const result = deriveGalleryPage(id, english);
  assert.ok(result.ok, `${id}: ${result.ok ? "" : JSON.stringify(result.issues)}`);
  if (!result.ok) throw new Error("unreachable after the assertion above");
  return result.value;
};

test("every page names its lead's companions from its own cases", () => {
  for (const id of galleryPageIds) {
    const model = page(id);
    for (const caseId of model.withLead) {
      assert.ok(model.cases.includes(caseId), `${id}: ${caseId} is not one of its cases`);
      assert.notEqual(caseId, model.lead, `${id}: the lead is not its own companion`);
    }
  }
});

test("the search page draws its results with the field that asked for them", () => {
  const model = page("search");
  assert.deepEqual(model.withLead, ["masonry-wall/two-columns"]);
  // The wall is not one of the states a person has to open to find.
  const rest = model.cases.filter(
    (id) => id !== model.lead && !model.withLead.includes(id) && id !== "search-field/query",
  );
  assert.ok(!rest.includes("masonry-wall/two-columns"));
});

test("only a page whose lead controls something names a companion", () => {
  // A companion is drawn, not remembered: a page that names one and does not show
  // it would put the same specimen in the fold and behind the disclosure at once.
  const named = Object.entries(galleryPages)
    .filter(([, spec]) => (spec as { withLead?: readonly string[] }).withLead?.length)
    .map(([id]) => id)
    .sort();
  assert.deepEqual(named, ["navigate", "search"]);
  // The staged task needs no companion: what its stage asks for is drawn inside
  // the stepper, above the verbs that move past it, so a slot named beside the
  // lead would show the same choice twice on one screen.
  assert.deepEqual([...page("steps").withLead], []);
  assert.deepEqual([...page("navigate").withLead], ["summary-detail/default"]);
});
