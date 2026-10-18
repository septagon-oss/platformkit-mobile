// A record with a picture opens on it: the field `coverField` names is the picture, and a
// field declared `present: "images"` is a gallery of them. Three rules decide what the rest
// of the page may draw — the picture is drawn at the highest place that draws it and nowhere
// below, the record asks for exactly the bytes it draws, and a file this phone holds no words
// for is drawn but never opened.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog, type Entry, type Field } from "../src/core/catalog";
import {
  fileMeta,
  headerCover,
  recordCover,
  recordInformation,
  recordMedia,
  recordSections,
  visiblePictures,
} from "../src/core/derive";
import { feedback, presentation } from "./fakes/presentation";

const catalog = parseCatalog(JSON.parse(readFileSync("testdata/catalog.pictures.json", "utf8")));
const content = catalog.resources.find((r) => r.entity === "content")!;
const people = catalog.resources.find((r) => r.entity === "user")!;
const COVER = "03fcde99-d7e5-456e-ab15-8680a4450b13";
const FIRST = "11111111-1111-4111-8111-111111111111";
const SECOND = "22222222-2222-4222-8222-222222222222";
const THIRD = "33333333-3333-4333-8333-333333333333";
const frame = { width: 390, height: 300 };
const nothing = { states: {}, files: {} };

const row = {
  id: COVER,
  slug: "field-notes",
  title: "Field notes",
  coverImageId: COVER,
  status: "published",
  kind: "post",
};

test("a record whose cover field holds a file opens on that file", () => {
  const files = { [COVER]: fileMeta({ width: 1600, height: 900, alt: "A notebook on grass" }) };
  const cover = recordCover(content, row, { ...nothing, files }, frame);
  assert.equal(headerCover(content, row), true);
  assert.equal(cover?.field.name, "coverImageId", "the declared field is the one drawn");
  assert.equal(cover?.picture.item.width, 1600, "the stored frame, not the strip's width");
  assert.equal(cover?.picture.item.height, 900);
  assert.equal(cover?.picture.item.description, "A notebook on grass", "the file's own caption");
  assert.equal(cover?.picture.slot.fit, "cover");
});

test("a record with no cover picture answers none, and its header stays as it was", () => {
  const bare = { ...row, coverImageId: "" };
  assert.equal(recordCover(content, bare, nothing, frame), undefined);
  assert.equal(headerCover(content, bare), false, "an absent picture is not a failure");
});

test("a file the server carried no frame for is drawn in the frame the phone declared", () => {
  const cover = recordCover(content, row, { ...nothing, files: { [COVER]: fileMeta({}) } }, frame);
  assert.equal(cover?.picture.item.width, 390);
  assert.equal(cover?.picture.item.height, 300);
  assert.equal(Number.isSafeInteger(cover?.picture.item.height), true);
});

test("a decorative file is drawn and never opened, and one with no caption is too", () => {
  const ornament = recordCover(
    content,
    row,
    {
      ...nothing,
      files: { [COVER]: fileMeta({ width: 10, height: 10, decorative: true, alt: "x" }) },
    },
    frame,
  );
  assert.equal(ornament?.picture.item.decorative, true);
  const uncaptioned = recordCover(
    content,
    row,
    { ...nothing, files: { [COVER]: fileMeta({ width: 10, height: 10 }) } },
    frame,
  );
  assert.equal(uncaptioned?.picture.item.decorative, true, "this phone holds no words for it");
  assert.equal(uncaptioned?.picture.item.description, "");
});

/** galleries is the same entry with a gallery of three declared, filed in `section` when named. */
function withGallery(section?: string): Entry {
  const field: Field = {
    name: "shots",
    type: "list",
    elem: "uuid",
    present: "images",
    ...(section === undefined ? {} : { hints: { section } }),
  };
  return {
    ...content,
    fields: [...content.fields, field],
    hints: {
      ...content.hints,
      ...(section === undefined ? {} : { sections: [{ key: section, label: "Gallery" }] }),
    },
  };
}
const shotRow = { ...row, shots: [FIRST, SECOND, THIRD] };

test("a gallery draws its pictures in the order the row holds them, in the block the document filed", () => {
  const unfiled = recordMedia(withGallery(), shotRow, nothing, frame, feedback);
  assert.equal(unfiled.length, 1);
  assert.deepEqual(
    unfiled[0]!.pictures.map((picture) => picture.item.id),
    [FIRST, SECOND, THIRD],
  );
  assert.equal(unfiled[0]!.block, "", "a field filed nowhere belongs to the overview");
  assert.equal(unfiled[0]!.count, "3 photos");

  const filed = recordMedia(withGallery("frames"), shotRow, nothing, frame, feedback);
  assert.equal(filed[0]!.block, "frames", "the block the document named, never a new one");
  // A block that holds nothing but a gallery is still a block, in declared order.
  const blocks = recordSections(withGallery("frames"), shotRow, feedback, undefined, {
    pictures: nothing,
    frame,
  });
  assert.deepEqual(
    blocks.map((b) => b.key),
    ["frames", ""],
    "declared first, overview last",
  );
  assert.deepEqual(
    blocks[0]!.items.map((i) => i.field.name),
    [],
    "the block holds only its gallery",
  );
  assert.equal(blocks[0]!.strips.length, 1);
  assert.deepEqual(
    blocks[1]!.items.map((i) => i.field.name),
    ["slug", "kind"],
    "the facts the document filed nowhere, and neither the cover's nor the gallery's field",
  );
});

test("a gallery declared over something that is no list of files keeps its ordinary row", () => {
  const broken: Entry = {
    ...content,
    fields: [
      ...content.fields,
      { name: "shots", type: "text", present: "images" },
      { name: "albums", type: "list", elem: "int", present: "images" },
    ],
  };
  assert.deepEqual(
    recordMedia(broken, { ...row, shots: "a, b", albums: [1, 2] }, nothing, frame, feedback),
    [],
  );
  const rows = [
    ...recordSections(broken, { ...row, shots: "a, b", albums: [1, 2] }, feedback).flatMap(
      (block) => block.items,
    ),
    ...recordInformation(broken, { ...row, shots: "a, b", albums: [1, 2] }, feedback),
  ].map((item) => item.field.name);
  assert.ok(rows.includes("shots"), "a defect in the document deletes nobody's data");
});

test("the cover and every gallery are drawn once: no row below repeats them, valued or not", () => {
  for (const entry of [withGallery(), withGallery("frames")]) {
    for (const held of [shotRow, { ...row, coverImageId: "", shots: [] }]) {
      const drawn = [
        ...recordSections(entry, held, feedback, undefined, { pictures: nothing, frame }).flatMap(
          (block) => block.items,
        ),
        ...recordInformation(entry, held, feedback),
      ].map((item) => item.field.name);
      assert.equal(
        drawn.includes("coverImageId") || drawn.includes("shots"),
        false,
        "no identifier of a picture is printed as a fact about the record",
      );
    }
  }
});

test("a record asks for the bytes it draws, and nothing held behind a disclosure", () => {
  const entry = withGallery();
  const kept: Entry = {
    ...entry,
    fields: [
      ...entry.fields,
      { ...people.fields[0]!, name: "keeper", hints: { visibility: "detail" } },
    ],
  };
  const asked = visiblePictures(kept, [shotRow], {}, "detail", presentation, false);
  assert.deepEqual(asked, [COVER, FIRST, SECOND, THIRD], "the cover first, then each gallery");
  assert.equal(
    visiblePictures(kept, [shotRow], {}, "detail", presentation, true).length,
    asked.length,
    "opening the record's own information asks for no new bytes here",
  );
});
