// A reference row points at a specimen, not at a sentence: ours_case has to be a
// case the gallery's own picker offers, and ours_block — the rare narrowing to one
// block of that screen — has to be a testID a component actually sets. A row that
// points nowhere would still carry a picture, of something else, which is how a
// design record quietly starts describing screens that were never drawn.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { deriveCopy } from "../src/core/copy";
import { kitCaseIds } from "../src/core/kitGallery";
import { stateExamples } from "../src/core/stateGallery";
import type { Presentation } from "../src/core/presentation";

const english: Presentation = {
  copy: deriveCopy("en"),
  locale: "en-GB",
  timeZone: "UTC",
  now: "2026-08-14T12:00:00Z",
  weekStartsOn: 1,
  motion: "reduced",
};

// The three values the case picker on /gallery is built from, in its own order.
const picker = ["primitives/default", ...kitCaseIds];

test("every reference row photographs a specimen the gallery offers", () => {
  const manifest = JSON.parse(readFileSync("design/references/refs.json", "utf8")) as {
    entries: readonly {
      id: string;
      component: string;
      ours_case: string;
      ours_file: string;
      ours_block?: string;
    }[];
  };
  const cases = stateExamples(english);
  assert.ok(cases.ok, "the gallery cannot list its own state examples");
  const offered = [...picker, ...cases.value.map(({ id }) => id)];
  for (const entry of manifest.entries) {
    assert.ok(
      offered.includes(entry.ours_case),
      `${entry.id} photographs ${entry.ours_case}, which the gallery's case picker does not offer`,
    );
    assert.equal(
      entry.ours_file,
      `${entry.id}-${entry.component}.png`,
      `${entry.id} names its picture for itself, not for the row it proves`,
    );
  }
});

test("a row that narrows to a block names a testID a component sets", () => {
  const gallery = readFileSync("src/ui/gallery.tsx", "utf8");
  const manifest = JSON.parse(readFileSync("design/references/refs.json", "utf8")) as {
    entries: readonly { id: string; ours_block?: string }[];
  };
  for (const entry of manifest.entries.filter((one) => one.ours_block !== undefined))
    assert.ok(
      gallery.includes(`testID="gallery-block:${entry.ours_block}"`),
      `${entry.id} names gallery-block:${entry.ours_block}, which no component sets`,
    );
});
