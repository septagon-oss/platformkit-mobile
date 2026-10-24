// A catalogue entry whose server resolved a supported policy is read through that policy in every
// reader; an absent, newer or malformed block leaves the entry drawn as it always was, and says so once.
import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import {
  display,
  enumLabel,
  enumTone,
  fieldLabel,
  finishedValues,
  formControls,
  label,
  listColumns,
  noun,
  sortOptions,
  statusField,
} from "../src/core/derive";
import { feedback } from "./fakes/presentation";
import { invoiceBlock, invoiceDocument } from "./fakes/policy";

const read = (doc: unknown) => {
  const notices: string[] = [];
  const entry = parseCatalog(doc, (at, why) => notices.push(`${at} ${why}`)).resources[0]!;
  return { entry, notices };
};
const untitled = () => "untitled";

test("a supported block names the resource, its fields and its closed set in the server's words", () => {
  const { entry, notices } = read(invoiceDocument());
  assert.deepEqual(notices, []);
  assert.deepEqual(noun(entry), { singular: "Fatura", plural: "Faturas" });
  const [, reference, , status] = entry.fields;
  assert.equal(fieldLabel(reference!), "Referência");
  assert.equal(enumLabel(status!, "paid"), "Liquidada");
  assert.equal(enumTone(status!, "open"), "warning");
  assert.equal(
    enumLabel(status!, "void"),
    "Void",
    "a value the block does not list reads as today",
  );
  assert.deepEqual(finishedValues(entry), ["paid"]);
  assert.equal(statusField(entry)?.name, "status");
});

test("a supported block decides the title, the missing word, the columns, the form and the sort sheet", () => {
  const { entry } = read(invoiceDocument());
  const memo = entry.fields.find((f) => f.name === "memo")!;
  assert.equal(display(memo, null, feedback), "sem nota");
  assert.equal(label(entry, { id: "i1", reference: "  ", memo: "Maio" }, untitled), "Maio");
  assert.equal(label(entry, { id: "i1", reference: "", memo: "" }, untitled), "i1");
  assert.equal(label(entry, {}, untitled), "Sem título");
  assert.deepEqual(
    listColumns(entry).map((f) => f.name),
    ["total", "reference", "status"],
  );
  assert.deepEqual(
    formControls(entry, undefined, true).map((c) => c.field.name),
    ["status", "reference", "total"],
  );
  assert.deepEqual(
    formControls(entry, { id: "i1" }, false).map((c) => c.field.name),
    ["reference"],
  );
  // The sheet is the block's: its queries, in its order, with no direction the block
  // did not state and no timestamp row for a block that names no timestamp order.
  assert.deepEqual(
    sortOptions(entry, feedback).map((o) => o.value),
    ["total", "-total", "reference"],
  );
});

const readsAsToday = (doc: unknown, why: RegExp) => {
  const { entry, notices } = read(doc);
  assert.equal(notices.length, 1, notices.join("\n"));
  assert.match(notices[0]!, why);
  assert.equal(entry.resolved, undefined);
  assert.equal(
    entry.fields.some((f) => f.policy !== undefined),
    false,
  );
  assert.deepEqual(noun(entry), { singular: "Invoice", plural: "Invoices" });
  assert.equal(fieldLabel(entry.fields[1]!), "Reference");
  assert.deepEqual(
    listColumns(entry).map((f) => f.name),
    ["reference", "total", "status", "memo"],
  );
};

test("a catalogue with no resolved block draws as it always did and says nothing", () => {
  const { entry, notices } = read(invoiceDocument(null));
  assert.deepEqual(notices, []);
  assert.deepEqual(noun(entry), { singular: "Invoice", plural: "Invoices" });
});

test("a block newer than this build reads, or with no whole version, costs the entry its policy", () => {
  readsAsToday(invoiceDocument({ ...invoiceBlock(), policyVersion: 2 }), /newer than this build/);
  readsAsToday(invoiceDocument({ ...invoiceBlock(), policyVersion: 0 }), /whole version/);
  readsAsToday(invoiceDocument({ ...invoiceBlock(), policyVersion: 1.5 }), /whole version/);
});

test("a block missing a member a reader needs costs the whole entry, not the one reader", () => {
  const { titles: _titles, ...withoutTitles } = invoiceBlock();
  readsAsToday(invoiceDocument(withoutTitles), /malformed at titles/);
  readsAsToday(invoiceDocument("nothing"), /not an object/);
});

test("a block naming a field the entry does not hold, or leaving one undescribed, is refused", () => {
  const unknownTitle = invoiceBlock();
  unknownTitle.titles.listCandidates = ["nope"];
  readsAsToday(invoiceDocument(unknownTitle), /unknown field nope/);
  const undescribed = invoiceBlock();
  undescribed.fields = undescribed.fields.slice(0, 4);
  readsAsToday(invoiceDocument(undescribed), /does not describe the field memo/);
});

test("a block carrying members this build does not know is still supported", () => {
  const { entry, notices } = read(invoiceDocument({ ...invoiceBlock(), seal: { by: "later" } }));
  assert.deepEqual(notices, []);
  assert.equal(noun(entry).singular, "Fatura");
});
