// A gallery of components owns no photography, so it draws its own specimens.
// What makes a drawn poster read as a specimen rather than noise is that it is
// derived: the same id draws the same composition everywhere it appears, the
// composition stays inside the slot it is drawn in, and a slot the page is about
// carries the kit's own colour rather than three shades of grey.
import assert from "node:assert/strict";
import test from "node:test";
import { kitCaseIds } from "../src/core/kitGallery";
import { posterFor } from "../src/core/media";

const mediaIds = kitCaseIds
  .filter((id) => id.startsWith("media-hero/") || id.startsWith("photo-gallery/"))
  .map((id) => id.replace("/", "-"));

test("the same specimen draws the same poster every time it is asked for", () => {
  for (const id of mediaIds) assert.deepEqual(posterFor(id), posterFor(id), id);
});

test("every mark of a drawn poster stays inside the slot it is drawn in", () => {
  for (const id of [...mediaIds, "media-hero/loading", "photo-viewer-middle", "masonry-two"]) {
    const poster = posterFor(id);
    assert.ok(poster.marks.length > 0, id);
    for (const mark of poster.marks) {
      assert.ok(mark.left >= 0 && mark.left + mark.width <= 1, `${id}: ${mark.id} horizontally`);
      assert.ok(
        mark.top >= 0 && mark.top + (mark.height ?? mark.width) <= 1,
        `${id}: ${mark.id} vertically`,
      );
    }
  }
});

test("a specimen's poster says which one it is by holding the kit's own colour", () => {
  for (const id of mediaIds) {
    const poster = posterFor(id);
    assert.ok(
      poster.marks.some((mark) => mark.tone === "accent"),
      `${id}: ${poster.layout}`,
    );
  }
});

test("the set of specimens draws more than one composition", () => {
  const layouts = new Set(mediaIds.map((id) => posterFor(id).layout));
  assert.ok(layouts.size >= 3, [...layouts].join(", "));
});
