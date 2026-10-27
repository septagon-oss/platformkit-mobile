// An empty sort declaration means none; a populated declaration supplies the exact offered queries.
import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import { sortOptions } from "../src/core/derive";
import { invoiceBlock, invoiceDocument } from "./fakes/policy";
import { feedback } from "./fakes/presentation";

test("an empty resolved sort list offers no invented timestamp order", () => {
  const block = invoiceBlock();
  block.list.sorts = [];
  block.list.defaultSort = "";
  const entry = parseCatalog(invoiceDocument(block)).resources[0]!;
  assert.ok(entry.resolved);
  assert.deepEqual(sortOptions(entry, feedback), []);
});

test("a resolved sort list preserves each declared query and its own label", () => {
  const block = invoiceBlock();
  block.list.sorts = [{ query: "-total", label: "Amount due", field: "total", desc: true }];
  const entry = parseCatalog(invoiceDocument(block)).resources[0]!;
  assert.ok(entry.resolved);
  assert.deepEqual(sortOptions(entry, feedback), [
    { value: "-total", label: "Amount due, high to low" },
  ]);
});
