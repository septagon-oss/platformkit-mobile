// A gallery of components owns no photography, so it draws its own specimens.
// What makes a drawn poster read as a specimen rather than noise is that it is
// derived: the same id draws the same composition everywhere it appears, the
// composition stays inside the slot it is drawn in, and a slot the page is about
// carries the kit's own colour rather than three shades of grey.
import assert from "node:assert/strict";
import test from "node:test";
import { kitCaseIds, kitExamples } from "../src/core/kitGallery";
import { posterFor } from "../src/core/media";
import { sceneFor, sceneNames } from "../src/core/kitScenes";
import { presentation } from "./fakes/presentation";

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

// A specimen that names a scene is promising a place, not a pattern: the geometry
// has to be there, inside the slot, and the copy that captions it has to be the
// specimen's own, so nothing is named a room and drawn as a circle.
test("a scene a specimen names is drawn, in its slot, in the kit's colour", () => {
  for (const name of sceneNames) {
    const scene = sceneFor(name);
    assert.ok(scene, name);
    assert.ok(scene!.marks.length > 3, `${name}: a place is more than a few shapes`);
    assert.ok(
      scene!.marks.some((mark) => mark.tone === "accent"),
      `${name}: the kit's own colour is in the picture`,
    );
    for (const mark of scene!.marks) {
      assert.ok(mark.left >= 0 && mark.left + mark.width <= 1, `${name}: ${mark.id} horizontally`);
      assert.ok(
        mark.top >= 0 && mark.top + (mark.height ?? mark.width) <= 1,
        `${name}: ${mark.id} vertically`,
      );
    }
  }
});

test("every scene a specimen names is a scene that can be drawn", () => {
  const named: string[] = [];
  for (const caseId of kitCaseIds) {
    const examples = kitExamples(presentation, caseId, {});
    if (!examples.ok) continue;
    const model = examples.value as { media?: { items?: { scene?: string }[] } };
    for (const item of model.media?.items ?? []) if (item.scene) named.push(item.scene);
  }
  assert.ok(named.length > 0, "a specimen should name a scene to draw");
  for (const name of named) assert.ok(sceneFor(name), `${name}: no geometry is drawn for it`);
});
