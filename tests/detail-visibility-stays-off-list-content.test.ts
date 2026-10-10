import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog, type FieldVisibility } from "../src/core/catalog";
import { deriveCatalogList } from "../src/core/catalogList";
import { noOrder, recordHeader, recordInformation } from "../src/core/derive";
import { presentation } from "./fakes/presentation";

const paragraph = "Read the inspection instructions on the record page.";

function listAndRecord(visibility: FieldVisibility, hints: Record<string, unknown>) {
  const document = JSON.parse(
    readFileSync(new URL("../testdata/catalog.json", import.meta.url), "utf8"),
  );
  const resource = document.resources[0];
  const body = resource.fields.find((field: { name: string }) => field.name === "body");
  body.presentation = { visibility };
  resource.presentation = hints;
  const entry = parseCatalog(document, (path, reason) => {
    assert.fail(`${path}: ${reason}`);
  }).resources[0]!;
  const row = { id: "record-7", title: "Inspection", body: paragraph };
  const list = deriveCatalogList(
    {
      entry,
      rows: [row],
      total: 1,
      loading: false,
      refreshing: false,
      more: false,
      error: "",
      order: noOrder,
      canCreate: false,
    },
    presentation,
  );
  assert.equal(list.ok, true);
  if (!list.ok) throw new Error("list derivation failed");
  assert.equal(list.value.sections[0]!.rows[0]!.id, row.id);
  assert.ok(
    recordInformation(entry, row, presentation).some(
      (item) => item.field.name === "body" && item.value === paragraph,
    ) ||
      recordHeader(entry, row, presentation, presentation.copy.kit.untitled).summary === paragraph,
    "a record still answers the paragraph: as its own row, or as the line under its name",
  );
  return list.value.sections[0]!.rows[0]!;
}

for (const [name, hints] of [
  ["default preview", {}],
  ["declared preview", { previewField: "body" }],
  ["declared summary cell", { summaryFields: ["body"] }],
] as const) {
  test(`a detail-only field stays off the list's ${name}`, () => {
    const shown = listAndRecord("shown", hints);
    assert.ok(JSON.stringify(shown).includes(paragraph), "shown content reaches the row");
    const detail = listAndRecord("detail", hints);
    assert.equal(
      JSON.stringify(detail).includes(paragraph),
      false,
      `detail visibility must keep the paragraph off the list: ${JSON.stringify(detail)}`,
    );
  });
}
