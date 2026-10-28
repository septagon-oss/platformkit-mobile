// The server decides what a finite choice draws and what its answers are; the phone reads that
// decision from the entry's `resolved` section and re-derives none of it. These cases hold both
// halves: what a well-formed section becomes, and that a malformed one costs the member that is
// wrong — never the field, the entry or the screen — while naming itself once.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CatalogError, parseCatalog } from "../src/core/catalog";

const bytes = (name: string): Buffer =>
  readFileSync(new URL(`../testdata/${name}`, import.meta.url));

// Read as the bytes they are: these cases bend one member of the document and hand it to the
// parser, which is what every catalogue case in this suite does.
const capture = () => JSON.parse(bytes("catalog.choices.json").toString("utf8"));

/** The entry the capture draws with one appearance, as this build read it. */
const drawnAs = (appearance: string) => {
  const catalog = parseCatalog(capture());
  const entry = catalog.resources.find(
    (e) => e.fields.find((f) => f.choice?.appearance === appearance) !== undefined,
  );
  return entry?.fields.find((f) => f.choice?.appearance === appearance)?.choice;
};

test("the copy is the bytes the record names, at the commit it names", () => {
  const record = JSON.parse(bytes("catalog.choices.source.json").toString("utf8"));
  assert.equal(record.schema, "platformkit.catalog-capture.v1");
  assert.equal(record.fixture, "testdata/catalog.choices.json");
  assert.equal(
    record.sha256,
    createHash("sha256").update(bytes("catalog.choices.json")).digest("hex"),
  );
  // The commit this copy was taken from prints an unset `resolved` member by saying nothing, which
  // is what the phone's strict generated read of a served catalogue needs (README, "The server's
  // resolved policy"); an older capture printed those absences as `null` and was refused.
  assert.equal(record.upstream.commit, "2499b3679005623b1bc73e2b2cf7ae88d81da004");
  assert.equal(record.upstream.path, "ui/screens/testdata/catalog-choices.json");
  assert.match(
    record.upstream.command,
    /raw\.githubusercontent\.com\/septagon-oss\/platformkit\/2499b3679005623b1bc73e2b2cf7ae88d81da004\/ui\/screens\/testdata\/catalog-choices\.json$/,
  );
});

test("the same question drawn four ways arrives as four appearances", () => {
  for (const appearance of ["tiles", "chips", "swatch", "figure"] as const) {
    const choice = drawnAs(appearance);
    assert.ok(choice, `${appearance} was not read`);
    assert.equal(choice.appearance, appearance);
    assert.equal(choice.many, true);
    assert.equal(choice.answers.length, 3);
    assert.deepEqual(
      choice.answers.map((a: { id: string }) => a.id),
      ["round", "square", "none"],
    );
    // The order the server answered in is the order a person reads: ungrouped answers,
    // then the block, then the exclusive "No preference" answer last.
    assert.equal(choice.answers[2]?.exclusive, true);
    assert.equal(choice.answers[1]?.group, "corners");
    assert.deepEqual(choice.groups, [{ key: "corners", label: "Corners" }]);
  }
});

test("an answer's colour, a maximum that replaces and an empty the server refuses are all read", () => {
  const choice = drawnAs("tiles");
  assert.equal(choice?.answers[0]?.picture?.colour, "#112233");
  assert.deepEqual(choice?.maximum, { count: 2, replacesOldest: true });
  assert.equal(choice?.answerless, undefined);
  assert.equal(choice?.reason, "Keep one shape.");
});

test("the figure appearance carries the compiled artwork and the answers its marks name", () => {
  const choice = drawnAs("figure");
  assert.ok(choice?.artwork, "the figure arrived with no artwork");
  assert.match(choice!.artwork.svg, /^<svg/);
  assert.deepEqual(choice!.artwork.answers, ["round", "square"]);
});

test("a field the section names as a plain field keeps the reading its schema gives it", () => {
  const doc = capture();
  doc.resources[0].resolved.fields[0].kind = "text";
  doc.resources[0].resolved.fields[0].control = "text";
  const field = parseCatalog(doc).resources[0]!.fields[0]!;
  assert.equal(field.choice, undefined);
  assert.equal("choice" in field, false);
});

test("an appearance this build cannot draw is drawn as chips and says so once", () => {
  const notices: [string, string][] = [];
  const doc = capture();
  doc.resources[0].resolved.fields[0].control = "kalidoscope";
  const choice = parseCatalog(doc, (at, why) => notices.push([at, why])).resources[0]!.fields[0]!
    .choice;
  assert.equal(choice?.appearance, "chips");
  assert.deepEqual(notices, [
    ["resources[0].resolved.fields[0].control", 'is "kalidoscope": the choice is drawn as chips'],
  ]);
});

test("a cardinality that is neither word asks for one answer and says so", () => {
  const notices: string[] = [];
  const doc = capture();
  doc.resources[0].resolved.fields[0].choice.cardinality = "some";
  const choice = parseCatalog(doc, (at) => notices.push(at)).resources[0]!.fields[0]!.choice;
  assert.equal(choice?.many, false);
  assert.deepEqual(notices, ["resources[0].resolved.fields[0].choice.cardinality"]);
});

test("a figure whose artwork is missing says so and keeps its answers", () => {
  // The kernel refuses the pairing when it mounts the resource, so a figure with no artwork is
  // a contradiction rather than an appearance: the surface stays the one the server named and
  // the answers stay readable, because an answer with no drawing is still an answer.
  const notices: string[] = [];
  const doc = capture();
  doc.resources[3].resolved.fields[0].figure = null;
  const choice = parseCatalog(doc, (at) => notices.push(at)).resources[3]!.fields[0]!.choice;
  assert.equal(choice?.appearance, "figure");
  assert.equal(choice?.artwork, undefined);
  assert.equal(choice?.answers.length, 3);
  assert.deepEqual(notices, ["resources[3].resolved.fields[0].figure"]);
});

test("an answer list that reads empty costs the choice and not the field", () => {
  const notices: string[] = [];
  const doc = capture();
  doc.resources[0].resolved.fields[0].options = [{ label: "No id" }];
  const field = parseCatalog(doc, (at) => notices.push(at)).resources[0]!.fields[0]!;
  assert.equal(field.choice, undefined);
  assert.equal(field.name, "shapes");
  // An answer that reads as nothing makes the list read as empty, which is a member the section
  // cannot be trusted on: the entry's whole policy is refused at its own path first, then each
  // unusable answer of this field is named.
  assert.deepEqual(notices, [
    "resources[0].resolved",
    "resources[0].resolved.fields[0].options[0]",
    "resources[0].resolved.fields[0].options",
  ]);
});

test("a choice naming a field the entry does not have is not read", () => {
  const notices: string[] = [];
  const doc = capture();
  doc.resources[0].resolved.fields[0].name = "phantom";
  const field = parseCatalog(doc, (at) => notices.push(at)).resources[0]!.fields[0]!;
  assert.equal(field.choice, undefined);
  // The same phantom name is two answers: the section is refused whole because it points outside
  // this entry, and this field's choice is dropped because no field of it carries that name.
  assert.deepEqual(notices, ["resources[0].resolved", "resources[0].resolved.fields[0].name"]);
});

test("a server with no resolved section says nothing and is answered in full", () => {
  const notices: string[] = [];
  const doc = capture();
  for (const resource of doc.resources) delete resource.resolved;
  const catalog = parseCatalog(doc, (at) => notices.push(at));
  assert.equal(catalog.resources.length, 4);
  assert.equal(catalog.resources[0]!.fields[0]!.choice, undefined);
  assert.deepEqual(notices, []);
});

test("a resolved section that is not an object costs every reading and names itself once", () => {
  const notices: string[] = [];
  const doc = capture();
  doc.resources[0].resolved = "yes";
  parseCatalog(doc, (at) => notices.push(at));
  assert.deepEqual(notices, ["resources[0].resolved"]);
});

test("a colour is the one artwork this build draws, and any other says so", () => {
  const notices: string[] = [];
  const doc = capture();
  doc.resources[0].resolved.fields[0].options[0].picture = { kind: "file", value: "abc" };
  const choice = parseCatalog(doc, (at) => notices.push(at)).resources[0]!.fields[0]!.choice;
  assert.equal(choice?.answers[0]?.picture, undefined);
  assert.equal(choice?.answers[1]?.picture?.colour, "#AABBCC");
  assert.deepEqual(notices, ["resources[0].resolved.fields[0].options[0].picture"]);
});

test("a hint that is wrong about one answer leaves the rest of the choice standing", () => {
  const notices: string[] = [];
  const doc = capture();
  doc.resources[0].resolved.fields[0].choice.groups = "corners";
  doc.resources[0].resolved.fields[0].choice.maximum = { count: 0 };
  const choice = parseCatalog(doc, (at) => notices.push(at)).resources[0]!.fields[0]!.choice;
  assert.equal(choice?.groups, undefined);
  assert.equal(choice?.maximum, undefined);
  assert.equal(choice?.answers.length, 3);
  assert.deepEqual(notices, [
    "resources[0].resolved.fields[0].choice.maximum",
    "resources[0].resolved.fields[0].choice.groups",
  ]);
});

test("a document whose resolved section is malformed in another way is still parsed", () => {
  // The section is presentation: nothing in it may refuse a catalogue, which is what
  // `additionalProperties: false` would do if it reached a strict schema.
  const doc = capture();
  doc.resources[0].resolved.policyVersion = "not a number";
  doc.resources[0].resolved.fields[0].reading = { precision: "two" };
  assert.equal(parseCatalog(doc).resources.length, 4);
  const strict = capture();
  strict.resources[0].fields = "none";
  assert.throws(() => parseCatalog(strict), CatalogError);
});
