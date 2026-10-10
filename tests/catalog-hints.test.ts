// The presentation contract, read: what a hint changes, what it never changes,
// and what an author's mistake costs. Every case is served bytes through the
// shipped `parseCatalog`, never a hand-written interface, and every hinted shape
// is a mutation of the pinned golden — the kernel refuses a malformed hint at
// mount (`kit/rest/hints.go`), so these bytes decide the phone's robustness, not
// a server's behaviour. `testdata/catalog.json` itself declares nothing.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createApi } from "../src/effects/api";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog, type Entry, type Field } from "../src/core/catalog";
import {
  badgeTone,
  collectionCommands,
  commandOf,
  commandTitle,
  deriveCopy,
  detailItems,
  display,
  enumLabel,
  enumTone,
  failureSubject,
  fieldLabel,
  formControls,
  iconName,
  label,
  listCells,
  listColumns,
  listPreview,
  noun,
  nounPhrase,
  offered,
  onList,
  primary,
  rowCommands,
  statusField,
  values,
} from "../src/core/derive";
import { feedback } from "./fakes/presentation";

const golden = () =>
  JSON.parse(readFileSync(new URL("../testdata/catalog.json", import.meta.url).pathname, "utf8"));

/** One entry of the served golden, as the author described it, plus what the parse said. */
function served(mutate: (entry: Record<string, unknown>) => void): {
  readonly entry: Entry;
  readonly lines: readonly string[];
} {
  const doc = golden();
  mutate(doc.resources[0]);
  const lines: string[] = [];
  const catalog = parseCatalog(doc, (at, why) => lines.push(`${at} ${why}`));
  return { entry: catalog.resources[0]!, lines };
}

const withEntryHints = (hints: unknown) => served((e) => (e.presentation = hints));
const withFieldHint = (name: string, hints: unknown) =>
  served((e) => {
    const field = (e.fields as Record<string, unknown>[]).find((f) => f.name === name)!;
    field.presentation = hints;
  });

test("a hint enters as hints and never as the wire's own bytes", () => {
  const { entry, lines } = withEntryHints({
    singular: "Tarefa",
    icon: "task",
    statusField: "status",
  });
  assert.deepEqual(entry.hints, { singular: "Tarefa", icon: "task", statusField: "status" });
  assert.equal("presentation" in entry, false, "raw hint bytes reached the model");
  assert.deepEqual(lines, [], "a well-formed hint says nothing");
  // The entry this document says nothing about carries no hints at all — not an
  // empty bag, which is what makes the case above a fact rather than a decoration.
  const quiet = parseCatalog(golden()).resources[1]!;
  assert.equal("hints" in quiet, false);
});

test("for the served golden every reading answer is the one this build gave before hints", () => {
  const catalog = parseCatalog(golden(), (at, why) => {
    throw new Error(`an un-hinted document noticed ${at} ${why}`);
  });
  for (const e of catalog.resources) {
    assert.equal(noun(e).singular, human(e.entity));
    assert.equal(noun(e).plural, human(e.entity) + (e.entity.endsWith("s") ? "" : "s"));
    assert.equal(nounPhrase(e).singular, human(e.entity).toLowerCase());
    assert.equal(onList(e.fields.find((f) => f.name === "body")!), false, "hideList still hides");
    assert.equal(statusField(e), undefined, "no status is inferred from the first enum");
    assert.equal(iconName(e), undefined);
    assert.deepEqual(
      listCells(e).map((f) => f.name),
      listCells(e, 99)
        .map((f) => f.name)
        .slice(0, 3),
      "the limit still bounds the ranking",
    );
    for (const f of e.fields) assert.equal(fieldLabel(f), human(f.name));
    for (const c of e.commands) assert.equal(commandTitle(c), c.summary || human(c.verb));
    for (const c of e.commands) assert.equal(offered(c), true, "nothing is system by default");
    assert.equal(label(e, { id: "1", title: "x" }, untitled), "x");
  }
});

const human = (name: string): string => human_(name);
function human_(name: string): string {
  let out = "";
  for (let i = 0; i < name.length; i++) {
    const ch = name[i]!;
    if (i === 0) out += ch.toUpperCase();
    else if (ch >= "A" && ch <= "Z") out += " " + ch.toLowerCase();
    else if (ch === "_" || ch === "-") out += " ";
    else out += ch;
  }
  return out;
}
const untitled = deriveCopy("en").kit.untitled;

test("a declared noun reads where the humanised one used to, and is never re-cased", () => {
  const { entry } = withEntryHints({ singular: "Trabajo", plural: "Trabajos" });
  assert.deepEqual(noun(entry), { singular: "Trabajo", plural: "Trabajos" });
  assert.equal(noun(entry).plural, "Trabajos", "a declared plural is never made more plural");
  assert.equal(failureSubject(entry).singular, "Trabajo", "an author's case is kept");
  assert.equal(failureSubject(entry).plural, "Trabajos");
  // Un-hinted, the same sentence says the words this kit chose, in lower case.
  assert.equal(failureSubject(parseCatalog(golden()).resources[0]!).singular, "note");
  // An un-hinted entry with an accent is not the author's problem to fix either.
  const accented = withEntryHints({ plural: "Conteúdo" });
  assert.equal(noun(accented.entry).plural, "Conteúdo");
});

test("primaryField names the field; when it does not, the chain reads on", () => {
  const named = withEntryHints({ primaryField: "status" });
  assert.equal(primary(named.entry)!.name, "status");
  assert.equal(named.lines.length, 0);

  // An enum can be the row's title when the author says so — the chain before
  // hints would never have chosen one.
  const typed = withEntryHints({ primaryField: "tilte" });
  assert.equal(primary(typed.entry)!.name, "title");
  assert.deepEqual(typed.lines, [
    "resources[0].presentation.primaryField names no field of this entry: the default is used",
  ]);

  // A schema with nothing to read is titled as what it is, not by its identifier.
  const nameless = served((e) => {
    e.fields = [{ name: "rank", type: "int" }];
    e.presentation = { singular: "Counter" };
  });
  assert.equal(primary(nameless.entry), undefined);
  assert.equal(label(nameless.entry, { id: "9" }, untitled), "Untitled Counter");
  assert.equal(
    label(nameless.entry, { id: "9" }, deriveCopy("pt").kit.untitled),
    "Counter sem título",
  );
});

test("visibility decides the list, and beats hideList both ways", () => {
  const reclaimed = withFieldHint("body", { visibility: "shown" });
  assert.ok(
    listColumns(reclaimed.entry).some((f) => f.name === "body"),
    "shown reclaims the column hideList took",
  );
  for (const visibility of ["detail", "hidden"]) {
    const given = withFieldHint("status", { visibility });
    assert.equal(
      listColumns(given.entry).some((f) => f.name === "status"),
      false,
      `${visibility} gives up a column hideList left`,
    );
  }
  // The id is never a column: that rule is derive's, not a hint's.
  assert.equal(onList({ name: "id", type: "uuid", presentation: undefined } as never), true);
  const forced = withFieldHint("id", { visibility: "shown" });
  assert.ok(!listColumns(forced.entry).some((f) => f.name === "id"));
});

test("a hidden field leaves the form, unless the form needs it", () => {
  const hidden = withFieldHint("rank", { visibility: "hidden" });
  assert.ok(!formControls(hidden.entry, undefined, true).some((c) => c.field.name === "rank"));
  assert.deepEqual(hidden.lines, []);

  const required = withFieldHint("rank", { visibility: "hidden" });
  const doc = golden();
  const rank = (doc.resources[0].fields as Record<string, unknown>[]).find(
    (f) => f.name === "rank",
  )!;
  rank.required = true;
  rank.presentation = { visibility: "hidden" };
  const lines: string[] = [];
  const entry = parseCatalog(doc, (at, why) => lines.push(`${at} ${why}`)).resources[0]!;
  assert.ok(
    formControls(entry, undefined, true).some((c) => c.field.name === "rank"),
    "a required field keeps the person's path to a submittable create",
  );
  assert.deepEqual(lines, [
    "resources[0].fields[6].presentation.visibility names a required field: it stays in the form",
  ]);
  assert.equal(required.lines.length, 0);
});

test("a declared enum label and tone read where the value reads", () => {
  const { entry } = withFieldHint("status", {
    enumLabels: { open: "Em aberto" },
    enumTones: { open: "success" },
  });
  const status = entry.fields.find((f) => f.name === "status")!;
  assert.equal(enumLabel(status, "open"), "Em aberto");
  assert.equal(display(status, "open", feedback), "Em aberto");
  assert.equal(display(status, "done", feedback), "Done", "an unlabelled value is humanised");
  const control = formControls(entry, { status: "open" }, false).find(
    (c) => c.field.name === "status",
  )!;
  assert.deepEqual(control.options, [
    { value: "open", label: "Em aberto" },
    { value: "done", label: "Done" },
  ]);
  assert.deepEqual(detailItems(entry, { status: "open" }, feedback)[5]!.value, "Em aberto");
  assert.equal(badgeTone(enumTone(status, "open")), "ok");
  assert.equal(badgeTone(enumTone(status, "done")), "neutral", "nothing is inferred");
});

test("a system command is never offered and still resolves", () => {
  const { entry } = served((e) => {
    (e.commands as Record<string, unknown>[])[0]!.presentation = { system: true };
  });
  assert.deepEqual(
    rowCommands(entry).map((c) => c.verb),
    [],
    "publish is no choice",
  );
  assert.deepEqual(
    collectionCommands(entry).map((c) => c.verb),
    ["archive"],
  );
  // Someone already holding the address still reaches it: the kernel guards that door.
  assert.equal(commandOf(entry, "publish", "record")!.verb, "publish");
});

test("a command label wins, and its absence is today's answer", () => {
  const { entry } = served((e) => {
    (e.commands as Record<string, unknown>[])[0]!.presentation = { label: "Close" };
  });
  assert.equal(commandTitle(entry.commands[0]!), "Close");
  const quiet = parseCatalog(golden()).resources[0]!;
  assert.equal(commandTitle(quiet.commands[0]!), "Publish a note");
  assert.equal(commandTitle({ verb: "mark-paid", fields: [] }), "Mark paid");
});

test("every malformed hint falls back and names itself once", () => {
  const malformed: readonly [unknown, string][] = [
    [{ singular: 5 }, "resources[0].presentation.singular is not a word: the default is used"],
    [
      { summaryFields: "title" },
      "resources[0].presentation.summaryFields is not a list of field names: the default is used",
    ],
    [
      { summaryFields: ["title", "nope"] },
      "resources[0].presentation.summaryFields[1] names no field of this entry: it is not drawn",
    ],
    [
      // A name that is not a name is dropped, and the place it leaves behind still
      // belongs to the document: the sentence after it says which served entry was
      // none of this entry's fields.
      { summaryFields: ["title", 5, "nope"] },
      "resources[0].presentation.summaryFields[2] names no field of this entry: it is not drawn",
    ],
    [
      { sections: [{ key: "billing" }] },
      "resources[0].presentation.sections holds a block with no key and label: the record stays flat",
    ],
  ];
  // A hint object where no object is: the whole bag at that level is dropped, its
  // children unaffected — a string says nothing about how the entry reads.
  const notAnObject = withEntryHints("x");
  assert.equal("hints" in notAnObject.entry, false);
  assert.deepEqual(notAnObject.lines, [
    "resources[0].presentation is not a hint object: no hints are read",
  ]);
  for (const [hints, line] of malformed) {
    // A well-formed sibling rides along: half a bag of reading decisions is still
    // a bag, and losing a good `plural` because a sibling was the wrong kind of
    // value is the worse screen.
    const { entry, lines } = withEntryHints({ plural: "Tasks", ...record(hints) });
    assert.equal(entry.hints?.plural, "Tasks", `${JSON.stringify(hints)} lost its sibling`);
    assert.ok(
      lines.includes(line),
      `${JSON.stringify(hints)} noticed ${JSON.stringify(lines)}, not ${line}`,
    );
  }
  // A declared tone outside the tones this build draws is dropped with its key.
  const tone = withFieldHint("status", { enumTones: { open: "brand" } });
  assert.equal(enumTone(tone.entry.fields[6]!, "open"), "neutral");
  assert.ok(tone.lines.some((l) => l.endsWith("is not tones: the default is used")));
  // Declared cells that all name nothing fall back to the ranking: an empty row is
  // not an instruction the phone can draw.
  const allWrong = withEntryHints({ summaryFields: ["nope", "also-nope"] });
  assert.equal("summaryFields" in (allWrong.entry.hints ?? {}), false);
  assert.equal(allWrong.lines.length, 2);
  assert.deepEqual(listCells(allWrong.entry).length > 0, true);
  // Silence, not a defect: the reference server prints no key for a zero value.
  // An array where the object belongs is a defect (it is dropped, with one line);
  // a null or an empty bag is the server printing nothing, which is silence.
  for (const quiet of [null, {}]) {
    const { entry, lines } = withEntryHints(quiet);
    assert.deepEqual(lines, [], `${JSON.stringify(quiet)} was noticed`);
    assert.equal("hints" in entry, false);
  }
});

const record = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};

test("a field names a block the entry kept, not one it lost", () => {
  const titled = (e: Record<string, unknown>) => {
    (e.fields as Record<string, unknown>[]).find((f) => f.name === "title")!.presentation = {
      section: "main",
    };
  };
  const kept = served((e) => {
    e.presentation = { sections: [{ key: "main", label: "Main" }] };
    titled(e);
  });
  assert.equal(kept.entry.hints?.sections?.[0]?.key, "main");
  assert.equal(
    kept.entry.fields[3]?.hints?.section,
    "main",
    "the block the entry has is the block the field is in",
  );
  assert.deepEqual(kept.lines, [], "a declared pair says nothing");

  // `sections` is taken whole or not at all, so one block with no label leaves the
  // record flat — and a field left naming a block that no longer exists would group
  // a fact under a heading nobody declared. Both readers now ask the same question.
  const flat = served((e) => {
    e.presentation = { sections: [{ key: "main", label: "Main" }, { key: "extra" }] };
    titled(e);
  });
  assert.equal("sections" in (flat.entry.hints ?? {}), false, "one bad block costs the whole list");
  assert.equal(flat.entry.fields[3]?.hints?.section, undefined, "so no field keeps a pointer");
  assert.ok(
    flat.lines.includes(
      "resources[0].presentation.sections holds a block with no key and label: the record stays flat",
    ),
    `refused by block: ${JSON.stringify(flat.lines)}`,
  );
  assert.ok(
    flat.lines.includes(
      "resources[0].fields[3].presentation.section names no declared block: the field stays in the overview",
    ),
    `and by field: ${JSON.stringify(flat.lines)}`,
  );

  // A block kept once and repeated twice is one block, and the field is in it.
  const repeated = served((e) => {
    e.presentation = {
      sections: [
        { key: "main", label: "Main" },
        { key: "main", label: "Again" },
      ],
    };
    titled(e);
  });
  assert.deepEqual(
    repeated.entry.hints?.sections,
    [{ key: "main", label: "Main" }],
    "the first declaration is used",
  );
  assert.equal(repeated.entry.fields[3]?.hints?.section, "main");
});

test("no hint changes a request", () => {
  const plain = parseCatalog(golden()).resources[0]!;
  const { entry } = withEntryHints({
    singular: "Tarefa",
    plural: "Tarefas",
    primaryField: "title",
    previewField: "body",
    summaryFields: ["status", "rank"],
    statusField: "status",
    sections: [{ key: "main", label: "Main" }],
  });
  const row = { id: "1", title: "Buy milk", body: "Two litres", status: "open", rank: 2 };
  assert.deepEqual(
    values(formControls(entry, row, false), {}),
    values(formControls(plain, row, false), {}),
  );
  assert.equal(entry.path, plain.path);
  assert.equal(commandOf(entry, "archive", "collection")?.verb, "archive");
  assert.deepEqual(
    listCells(entry).map((f) => f.name),
    ["status", "rank"],
    "declared summary cells are the author's order, not the ranking",
  );
  assert.equal(listPreview(entry)!.name, "body");
});

const readBytes = (name: string): Buffer =>
  readFileSync(new URL(`../testdata/${name}`, import.meta.url).pathname);
const sha256 = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");
const hintsGolden = () => JSON.parse(readBytes("catalog.hints.json").toString("utf8"));
interface HintsRecord {
  readonly schema: string;
  readonly fixture: string;
  readonly sha256: string;
  readonly origin: { readonly kind: string; readonly base: string; readonly baseSha256: string };
}
interface HintsRecord {
  readonly schema: string;
  readonly fixture: string;
  readonly sha256: string;
  readonly origin: { readonly kind: string; readonly base: string; readonly baseSha256: string };
}
const hintsRecord = () =>
  JSON.parse(readBytes("catalog.hints.source.json").toString("utf8")) as HintsRecord;

/** A field with its reading decisions taken away: the shape the pinned document gives it. */
const unread = (f: Field): Omit<Field, "hints"> => {
  const { hints: _reading, ...rest } = f;
  return rest;
};

test("the hinted golden is the pinned copy plus what that copy does not yet declare", () => {
  // No kernel resource declares a hint yet, so this shape is this repository's
  // own declaration, written on top of the pinned bytes and recorded as such:
  // the record names the copy it extends and hashes both, so the relation is a
  // fact a test can refuse rather than a comment somebody remembered.
  const record = hintsRecord();
  assert.equal(record.schema, "platformkit.catalog-declared.v1");
  assert.equal(record.fixture, "testdata/catalog.hints.json");
  assert.equal(record.origin.kind, "this repository");
  assert.equal(record.origin.base, "testdata/catalog.json");
  assert.equal(record.sha256, sha256(readBytes("catalog.hints.json")));
  assert.equal(record.origin.baseSha256, sha256(readBytes("catalog.json")));

  const declared = parseCatalog(hintsGolden(), (at, why) => {
    throw new Error(`the declared fixture noticed ${at} ${why}`);
  });
  const pinned = parseCatalog(golden());
  assert.equal(declared.version, 2);
  assert.equal(declared.resources.length, pinned.resources.length);
  assert.equal("hints" in declared.resources[0]!, true);
  // Everything but the presentation objects is the pinned document, field for
  // field and command for command: the extension adds words, not facts.
  for (const [i, entry] of declared.resources.entries()) {
    assert.equal(entry.module, pinned.resources[i]!.module);
    assert.equal(entry.entity, pinned.resources[i]!.entity);
    assert.equal(entry.path, pinned.resources[i]!.path);
    assert.deepEqual(
      entry.fields.map(unread),
      pinned.resources[i]!.fields.map(unread),
      "a declared hint reached a field's own shape",
    );
    if (i > 0) assert.equal("hints" in entry, false, `resources[${i}] declares nothing`);
  }
  assert.equal(declared.resources[0]!.hints?.singular, "Note");
  assert.equal(statusField(declared.resources[0]!), declared.resources[0]!.fields[5]);
});

/** One served body, once, for the transport that owns the parse. */
const servedBy = (body: unknown) =>
  createApi("https://contract.test", async () => {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

test("a malformed hint never costs a screen, over the wire too", async () => {
  const doc = golden();
  doc.resources[0].presentation = { singular: 5, summaryFields: "title", icon: "rocket" };
  const lines: string[] = [];
  const catalog = await servedBy(doc).catalog((at, why) => lines.push(`${at} ${why}`));
  const entry = catalog.resources[0]!;
  // The workspace keeps every screen it had, with its fields, commands and address.
  assert.equal(catalog.resources.length, 3);
  assert.equal(entry.fields.length, 9);
  assert.equal(entry.commands.length, 2);
  assert.equal(entry.path, "/api/v1/note/notes");
  // The two defects named themselves; the glyph name is kept as the author wrote
  // it, because which glyphs this build ships is `ui/atoms/Icon.tsx`'s to say and
  // a name it does not hold draws the generic one.
  assert.equal(iconName(entry), "rocket");
  // The transport validates the body and then reads it, so the parse runs twice
  // per served body: what "logged once" guarantees is the collector's own rule
  // (`warnOnce` keys on path and reason), and this says the rule holds.
  assert.deepEqual([...new Set(lines)].sort(), [
    "resources[0].presentation.singular is not a word: the default is used",
    "resources[0].presentation.summaryFields is not a list of field names: the default is used",
  ]);
  assert.ok(lines.length > 2, "the body is parsed by the validator and by the read");
});

test("the strict generated operation still refuses what the phone forgives", async () => {
  const doc = golden();
  doc.resources[0].presentation = { singular: 5 };
  const api = servedBy(doc);
  await api.catalog();
  await assert.rejects(api.operations.appResources({}));
});
