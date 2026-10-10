// A form asks only what a person can answer (0085). Three rules decide what a sheet
// holds and in what order it holds it, and all three are answers of the core: the set
// is `formControls`' — a hidden field is neither offered nor sent — the grouping is
// the entry's declared `sections`, and the order inside a block is the field the
// record is called by, then required, then optional. Help is the author's line alone:
// the developer's `doc` describes a wire member and is never drawn or announced.
//
// The comma rules are the same fact seen from the two doors: a list stores its items
// comma-joined, so one item can never hold the separator. The box refuses an entry
// that does, and a save refuses a held value that does not spell its own items, so no
// half-spelled list ever reaches the server.
//
// Every case below is served bytes through the shipped `parseCatalog` — the conformance
// fake is the parser this repository ships — with the mutations named where they are
// used. The hinted fixture this repository serves is T-0328's; it carries no
// `source`/`source_ref` and no field doc'd "Lifecycle state", so the acceptance cases
// add those names by mutation and are read as what they are.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog, type Entry } from "../src/core/catalog";
import {
  commandSections,
  deriveCopy,
  entryHoldsSeparator,
  formControls,
  formSections,
  joinList,
  orderControls,
  problems,
  splitList,
  valueHoldsSeparator,
  values,
  type Control,
  type FormWords,
  type Row,
} from "../src/core/derive";

const kit = deriveCopy("en").kit;
/** The words a screen hands `problems`; a phone hands the reader's own bundle. */
const words: FormWords = kit;

const bytes = (name: string) =>
  JSON.parse(readFileSync(new URL(`../testdata/${name}`, import.meta.url).pathname, "utf8"));

/**
 * hinted is T-0328's served hinted document, mutated as a case says, through the
 * parser a screen uses. A case that expects no hint defect fails on the first notice;
 * one that expects a notice says which, because a mutation the parser is *meant* to
 * notice is a promise kept, not a mistake to ignore.
 */
function hinted(
  mutate: (resource: Record<string, unknown>) => void = () => undefined,
  expect = "",
): Entry {
  const doc = bytes("catalog.hints.json");
  mutate(doc.resources[0]);
  const seen: string[] = [];
  const entry = parseCatalog(doc, (at, why) => seen.push(`${at}: ${why}`)).resources[0]!;
  if (expect === "")
    assert.deepEqual(seen, [], "a mutation the parser refused is not the document a case is about");
  else
    assert.ok(
      seen.some((n) => n.includes(expect)),
      seen.join("\n") || "no notice was raised",
    );
  return entry;
}

/**
 * plain is the document a server answers today, which declares no hint at all, and
 * `unhinted` is that document mutated as a case says. The reorder case needs it:
 * with nothing filed, every field of the entry is in the sheet's one block, which is
 * the only shape where "required before optional" moves a field at all.
 */
function unhinted(mutate: (resource: Record<string, unknown>) => void = () => undefined): Entry {
  const doc = bytes("catalog.json");
  mutate(doc.resources[0]);
  return parseCatalog(doc, (at, why) => {
    assert.fail(`${at}: ${why}`);
  }).resources[0]!;
}

const plain = unhinted();

const names = (controls: readonly Control[]) => controls.map((c) => c.field.name).join(", ");
const order = (blocks: ReturnType<typeof formSections>) =>
  blocks
    .map((b) => `[${b.key || "-"}] ${b.label || "-"}: ${names(b.controls)}${mark(b)}`)
    .join(" | ");
/** The required fields of a block, so an order claim says which of them it is about. */
const mark = (block: ReturnType<typeof formSections>[number]) => {
  const required = block.controls.filter((c) => c.required).map((c) => c.field.name);
  return required.length === 0 ? "" : ` (${required.join(",")} are)`;
};

/** A `pinned` the document makes required, which is what moves it above an optional `body`. */
const pinRequired = (r: Record<string, unknown>) => {
  const fields = r.fields as Record<string, unknown>[];
  fields.find((f) => f.name === "pinned")!.required = true;
};

/** A field named at the top of the form the way a real workspace names one. */
const hideSourceAndRef = (r: Record<string, unknown>) => {
  const fields = r.fields as Record<string, unknown>[];
  fields.push(
    { name: "source", type: "string", presentation: { visibility: "hidden" } },
    {
      name: "sourceRef",
      type: "string",
      doc: "Reference into the source system",
      presentation: { visibility: "hidden" },
    },
  );
};

/** `status` is the field a lifecycle owns: immutable, and doc'd with the developer's words. */
const statusDoc = (r: Record<string, unknown>) => {
  const fields = r.fields as Record<string, unknown>[];
  fields.find((f) => f.name === "status")!.doc = "Lifecycle state";
};

const taskRow: Row = {
  id: "9f0c1b2a-0000-4000-8000-0000000000c2",
  title: "Renew the shared drive licence",
  body: "The licence expires on Friday.",
  status: "open",
  rank: 7,
  pinned: true,
  tags: ["work"],
};

test("a form leads with the field the record is called by, then required, then optional", () => {
  // Schema order is `title, body, rank, pinned, tags`; `pinned` required is the
  // mutation no schema-order rule can answer, because it belongs above `body`.
  const blocks = formSections(unhinted(pinRequired), undefined, true, kit.overview);
  assert.deepEqual(
    blocks.flatMap((b) => b.controls.map((c) => `${c.field.name}${c.required ? "*" : ""}`)),
    ["title*", "pinned*", "body", "rank", "tags"],
  );
});

test("a declared block keeps its fields and its place; a block with none draws nothing", () => {
  const create = formSections(hinted(), undefined, true, kit.overview);
  assert.deepEqual(
    create.map((b) => `${b.key || "-"}=${b.label}`),
    ["content=Content", "-=Overview"],
    "an edit-only block draws no heading on a create",
  );
  const edit = formSections(hinted(), taskRow, false, kit.overview);
  assert.deepEqual(
    edit.map((b) => b.key),
    ["content", "details", ""],
  );
});

test("a field the entry filed nowhere lands in the last block, named the overview word it was given", () => {
  const blocks = formSections(hinted(), undefined, true, "Overview");
  const last = blocks[blocks.length - 1]!;
  assert.equal(last.key, "");
  assert.equal(last.label, "Overview");
  assert.equal(names(last.controls), "pinned, tags");
  assert.deepEqual(
    formSections(hinted(), undefined, true, "Visão geral").at(-1)!.label,
    "Visão geral",
    "the word is the caller's bundle's, not a string written here",
  );
});

test("an entry that declares no sections gets one block with no heading", () => {
  const blocks = formSections(plain, undefined, true, kit.overview);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]!.label, "", "the sheet is the group: an unfiled form says no heading");
  assert.equal(names(blocks[0]!.controls), "title, body, rank, pinned, tags");
});

test("the identity field leads its block even when it is optional", () => {
  const optionalTitle = (r: Record<string, unknown>) => {
    const fields = r.fields as Record<string, unknown>[];
    delete fields.find((f) => f.name === "title")!.required;
    fields.find((f) => f.name === "body")!.required = true;
  };
  const [content] = formSections(hinted(optionalTitle), undefined, true, kit.overview);
  assert.equal(names(content!.controls), "title, body", "identity outranks required");
});

test("an identity field never moves out of the block its entry filed it in", () => {
  const refilled = (r: Record<string, unknown>) => {
    const fields = r.fields as Record<string, unknown>[];
    delete fields.find((f) => f.name === "title")!.required;
    fields.find((f) => f.name === "title")!.presentation = { section: "details" };
  };
  assert.deepEqual(
    formSections(hinted(refilled), undefined, true, kit.overview).map(
      (b) => `${b.key || "-"}:${names(b.controls)}`,
    ),
    ["content:body", "details:title", "-:pinned, tags"],
  );
});

test("the order a sheet asks in changes nothing it writes", () => {
  const held = { title: "Kept", body: "", pinned: "true", tags: "one, two", status: "done" };
  for (const [mutate, notice] of [
    [() => undefined, ""],
    [pinRequired, ""],
    [hideSourceAndRef, ""],
    [
      (r: Record<string, unknown>) => {
        const fields = r.fields as Record<string, unknown>[];
        fields.find((f) => f.name === "rank")!.required = true;
      },
      // Hiding a field *and* requiring it is the exception below, and the parser
      // notices it once in the developer's channel.
      "names a required field",
    ],
  ] as [(r: Record<string, unknown>) => void, string][]) {
    for (const create of [true, false]) {
      const entry = hinted(mutate, notice);
      const blocks = formSections(entry, create ? undefined : taskRow, create, kit.overview);
      const flat = blocks.flatMap((b) => b.controls);
      assert.deepEqual(
        values(flat, held),
        values(formControls(entry, create ? undefined : taskRow, create), held),
        `${create ? "create" : "edit"} body moved by the order`,
      );
      assert.deepEqual(
        problems(flat, held, words),
        problems(formControls(entry, create ? undefined : taskRow, create), held, words),
        "the same contents refuse the same way",
      );
    }
  }
});

test("a command's argument is a field like any other: its help is the author's line", () => {
  // The served document's `at` carries only a `doc`, so its sheet says nothing; the
  // mutation gives it a hint, which is what a person reads under the field.
  const argument = (help: string) => {
    const entry = hinted((r) => {
      const command = (r.commands as Record<string, unknown>[]).find((c) => c.verb === "publish")!;
      (command.fields as Record<string, unknown>[])[0]!.presentation = help === "" ? {} : { help };
    });
    return commandSections(entry.commands.find((c) => c.verb === "publish")!).flatMap(
      (b) => b.controls,
    );
  };
  assert.equal(argument("")[0]!.help, "");
  assert.equal(
    argument("Publishes at the moment you name.")[0]!.help,
    "Publishes at the moment you name.",
  );
});

test("a command's argument keeps the order the document gave it, required first, unnamed", () => {
  const [block] = commandSections(hinted().commands.find((c) => c.verb === "publish")!);
  assert.equal(block!.key, "");
  assert.equal(block!.label, "");
  assert.deepEqual(
    commandSections({
      verb: "publish",
      fields: [
        { name: "note", type: "string" },
        { name: "at", type: "string", required: true },
      ],
    }).flatMap((b) => b.controls.map((c) => c.field.name)),
    ["at", "note"],
    "required first, and no identity to lead with",
  );
  assert.deepEqual(
    orderControls([] as readonly Control[], "title"),
    [],
    "an argument with no fields is a confirmation, not a sheet",
  );
});

test("help is the author's line, and the developer's doc is never drawn or announced", () => {
  const [title] = formSections(hinted(statusDoc), taskRow, false, kit.overview).flatMap(
    (b) => b.controls,
  );
  assert.equal(title!.field.name, "title");
  assert.equal(title!.help, "What the record is about.", "the hint reads the form");
  const said = formSections(hinted(statusDoc), taskRow, false, kit.overview)
    .flatMap((b) => b.controls)
    .map((c) => c.help)
    .join(" ");
  assert.equal(said.includes("Lifecycle state"), false, "the wire's prose is not a person's help");
  assert.equal(said.includes("Comma separated."), false, "a token box does not say comma");
  // The same field in the document that declares nothing: silent, and still readable.
  assert.equal(
    formControls(plain, undefined, true).find((c) => c.field.name === "title")!.help,
    "",
    "the doc fallback is gone: an undeclared field says nothing until an author writes a hint",
  );
});

test("a hidden field is not offered and not sent; a required one stays and says so", () => {
  const entry = hinted(hideSourceAndRef);
  const offered = formSections(entry, undefined, true, kit.overview).flatMap((b) => b.controls);
  assert.deepEqual(
    offered.filter((c) => c.field.name === "source" || c.field.name === "sourceRef"),
    [],
    "a hidden fact is neither drawn nor named",
  );
  assert.deepEqual(
    Object.keys(values(offered, {})),
    ["title", "pinned", "tags"],
    "a create body names no hidden field",
  );
  assert.deepEqual(Object.keys(values(offered, {})).includes("rank"), false);

  // House rule 8: the write that takes the last path away is the one this build
  // never makes. A hidden field the document requires stays in the sheet, marked
  // required — the parser already named the pair once, in the developer's channel.
  const forced = hinted((r) => {
    hideSourceAndRef(r);
    const fields = r.fields as Record<string, unknown>[];
    fields.find((f) => f.name === "rank")!.required = true;
  }, "names a required field");
  const stays = formSections(forced, undefined, true, kit.overview)
    .flatMap((b) => b.controls)
    .find((c) => c.field.name === "rank")!;
  assert.equal(stays.required, true, "the exception is a rule, not an accident");
  assert.equal(stays.help, "Order among the records.", "its help is the author's, if declared");
});

test("joinList is the one spelling, and read back through splitList it is itself", () => {
  assert.equal(joinList(["alpha", "beta"]), "alpha, beta");
  assert.equal(joinList(["  ", "beta", ""]), "beta");
  assert.deepEqual(splitList(joinList(["alpha", "beta"])), ["alpha", "beta"]);
});

test("a value that holds the separator in one item is refused, and one that spells its items is not", () => {
  // The box's own door: text a person means as one word.
  // The comma is asked of the text, not of what splitting would leave: "alpha,"
  // splits to one word and stores neither the empty item it asked for nor the comma.
  for (const typed of [
    "work, home",
    "work,home",
    "work , home",
    "work,,home",
    "alpha,",
    ",alpha",
    ",",
    "alpha,,",
  ])
    assert.equal(entryHoldsSeparator(typed), true, `${typed} holds the separator`);
  for (const typed of ["work", " work ", "work home", ""])
    assert.equal(entryHoldsSeparator(typed), false, `${typed} is one`);

  // The save's door: a whole held value that does not read back as its items.
  for (const raw of ["a,b", "a, b,c", "1,2", "a ,b", "a,,b"])
    assert.equal(valueHoldsSeparator(raw), true, `${raw} hides a comma in one item`);
  for (const raw of [
    "",
    "alpha",
    "alpha, beta",
    "alpha, beta, ",
    "alpha, b, ",
    "alpha, beta, work",
  ])
    assert.equal(valueHoldsSeparator(raw), false, `${raw} spells its own items`);
});

test("a save the comma refuses names the field, and the item type never answers for it", () => {
  const field = (elem?: "int" | "float"): readonly Control[] =>
    formSections(
      {
        ...plain,
        fields: [{ name: "tags", type: "list", ...(elem === undefined ? {} : { elem }) }],
      },
      undefined,
      true,
      kit.overview,
    ).flatMap((b) => b.controls);
  assert.deepEqual(problems(field(), { tags: "a,b" }, words), { tags: kit.commaInValue });
  assert.deepEqual(problems(field("int"), { tags: "1,2" }, words), { tags: kit.commaInValue });
  // A genuine type error keeps the sentence it has always had.
  // `1, nope` spells its two items the way storage joins them, so what is wrong with
  // it is one item's type, and the sentence says that instead.
  assert.deepEqual(problems(field("int"), { tags: "1, nope" }, words), {
    tags: "contains a value that does not match its item type",
  });
  assert.deepEqual(problems(field("int"), { tags: "nope" }, words), {
    tags: "contains a value that does not match its item type",
  });
  assert.deepEqual(problems(field(), { tags: "alpha, beta" }, words), {});
});
