// An explicit empty preview is an answer, so a supported policy never asks the legacy heuristic.
import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import { listPreview, recordHeader } from "../src/core/derive";
import { invoiceBlock, invoiceDocument } from "./fakes/policy";
import { feedback } from "./fakes/presentation";

test("a supported policy with no preview draws no inferred record summary", () => {
  const block = invoiceBlock();
  block.titles.preview = "";
  const entry = parseCatalog(invoiceDocument(block)).resources[0]!;
  assert.ok(entry.resolved);
  assert.equal(listPreview(entry, "record"), undefined);
  const header = recordHeader(
    entry,
    { id: "invoice-42", reference: "INV-42", memo: "Keep in the record body" },
    feedback,
    () => "Untitled",
  );
  assert.equal(header.summary, undefined);
});
