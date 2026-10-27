// Every field a policy reader names must exist before any part of the policy is adopted.
import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import { fieldLabel, formControls, listColumns, noun } from "../src/core/derive";
import { invoiceBlock, invoiceDocument } from "./fakes/policy";

function fallsBack(member: "status" | "preview"): void {
  const block = invoiceBlock();
  block.titles[member] = "unlistedField";
  const notices: string[] = [];
  const entry = parseCatalog(invoiceDocument(block), (at, why) => notices.push(`${at}: ${why}`))
    .resources[0]!;
  const legacy = parseCatalog(invoiceDocument(null)).resources[0]!;
  assert.equal(entry.resolved, undefined);
  assert.equal(
    entry.fields.some((field) => field.policy !== undefined),
    false,
  );
  assert.equal(notices.length, 1);
  assert.match(notices[0]!, /unlistedField/);
  assert.deepEqual(noun(entry), noun(legacy));
  assert.deepEqual(entry.fields.map(fieldLabel), legacy.fields.map(fieldLabel));
  assert.deepEqual(listColumns(entry), listColumns(legacy));
  assert.deepEqual(formControls(entry, undefined, true), formControls(legacy, undefined, true));
}

test("a policy whose status names no field falls back for the whole entry", () => {
  fallsBack("status");
});

test("a policy whose preview names no field falls back for the whole entry", () => {
  fallsBack("preview");
});
