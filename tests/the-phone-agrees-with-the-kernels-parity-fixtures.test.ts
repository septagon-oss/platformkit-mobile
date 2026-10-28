// Each of the kernel's reviewed parity cases is drawn by the phone's production models through the
// resolved policy the case states, and the titles, cells, labels, tones, columns, form order and sort
// order the phone reaches are the ones the case says every client must reach.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog, type Entry } from "../src/core/catalog";
import {
  display,
  enumLabel,
  enumTone,
  fieldLabel,
  formControls,
  label,
  listColumns,
  listRow,
  noun,
  sortOptions,
  statusField,
} from "../src/core/derive";
import { feedback } from "./fakes/presentation";
import { parityEntry } from "./fakes/parityEntry";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const DIRECTORY = "tests/parity";
const fixtures = readdirSync(DIRECTORY).filter(
  (n) => n.endsWith(".json") && n !== "parity.source.json",
);
const untitled = () => "untitled";

function entryOf(fixture: Json): Entry {
  const notices: string[] = [];
  const doc = {
    catalogVersion: 3,
    resources: [parityEntry(fixture as { input: Json; expected: Json })],
  };
  const entry = parseCatalog(doc, (at, why) => notices.push(`${at} ${why}`)).resources[0]!;
  assert.deepEqual(
    notices.filter((n) => n.includes(".resolved")),
    [],
    `${fixture.name}: the block its case states is a supported policy`,
  );
  assert.notEqual(entry.resolved, undefined);
  return entry;
}

const fieldOf = (entry: Entry, name: string) => entry.fields.find((f) => f.name === name)!;

function agreesOnWords(entry: Entry, resolved: Json): void {
  if (resolved.identity?.singular !== undefined)
    assert.equal(noun(entry).singular, resolved.identity.singular);
  if (resolved.identity?.plural !== undefined)
    assert.equal(noun(entry).plural, resolved.identity.plural);
  for (const stated of resolved.fields ?? []) {
    const field = fieldOf(entry, stated.name);
    if (stated.label !== undefined) assert.equal(fieldLabel(field), stated.label);
    for (const option of stated.options ?? []) {
      if (option.label !== undefined) assert.equal(enumLabel(field, option.value), option.label);
      if (option.tone !== undefined) assert.equal(enumTone(field, option.value), option.tone);
    }
    const reading = stated.reading ?? {};
    if (reading.true !== undefined && field.type === "bool")
      assert.equal(display(field, true, feedback), reading.true);
    if (reading.false !== undefined && field.type === "bool")
      assert.equal(display(field, false, feedback), reading.false);
    if (reading.missing !== undefined && field.type === "string")
      assert.equal(display(field, null, feedback), reading.missing);
  }
  if (resolved.titles?.status) assert.equal(statusField(entry)?.name, resolved.titles.status);
}

function agreesOnOrder(entry: Entry, resolved: Json): void {
  const names = (fields: readonly { name: string }[]) => fields.map((f) => f.name);
  const drawn = (n: string) => n !== "id" && fieldOf(entry, n).type !== "picture";
  if (resolved.layout?.columns)
    assert.deepEqual(names(listColumns(entry)), resolved.layout.columns.filter(drawn));
  if (resolved.layout?.create)
    assert.deepEqual(
      names(formControls(entry, undefined, true).map((c) => c.field)),
      resolved.layout.create.filter(
        (n: string) => !fieldOf(entry, n).readOnly && drawn(n) && !entry.immutable.includes(n),
      ),
    );
  if (resolved.list?.sorts) {
    const offered = sortOptions(entry, feedback)
      .slice(2)
      .map((o) => o.value);
    const stated: string[] = resolved.list.sorts.map((s: Json) => s.query);
    let at = 0;
    for (const value of offered) {
      at = stated.indexOf(value, at);
      assert.notEqual(at, -1, `${value} is offered in an order the case does not state`);
    }
  }
}

function agreesOnRows(entry: Entry, rows: Json, held: Json[]): void {
  for (const row of held) {
    const stated = rows[row.id];
    if (stated === undefined) continue;
    assert.equal(listRow(entry, row, feedback, untitled).title, stated.listTitle);
    assert.equal(label(entry, row, untitled, "record"), stated.recordTitle);
    for (const [name, text] of Object.entries(stated.cells ?? {})) {
      assert.equal(display(fieldOf(entry, name), row[name], feedback), text, `${row.id}.${name}`);
      const cell = listRow(entry, row, feedback, untitled).cells.find((c) => c.id === name);
      if (cell !== undefined) assert.equal(cell.value, text, `${row.id}.${name} as drawn`);
    }
  }
}

for (const name of fixtures) {
  const fixture = JSON.parse(readFileSync(`${DIRECTORY}/${name}`, "utf8")) as Json;
  test(`the phone reaches the kernel's ${fixture.name} case in ${fixture.input.language}`, () => {
    assert.equal(`${fixture.name}.json`, name);
    const entry = entryOf(fixture);
    agreesOnWords(entry, fixture.expected.resolved);
    agreesOnOrder(entry, fixture.expected.resolved);
    // A case about a command or a field states no rows, so it agrees on none.
    agreesOnRows(entry, fixture.expected.rows ?? {}, fixture.input.rows ?? []);
  });
}
