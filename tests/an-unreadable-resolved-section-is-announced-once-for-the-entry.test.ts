// One entry's `resolved` section has two readers: the policy (`./catalogPolicy`), which adopts the
// block whole or not at all, and the finite choice (`./choice`), which joins each field's answers by
// name. A section neither can read is one broken member, so what this case holds is the saying: the
// entry refuses its policy exactly once, no reader says the same thing twice, nothing is said about
// another entry, and the entry is drawn as it was before the section existed. The shapes are the
// spellings of "no readable section" a server or a bad re-pin can print.
import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalog } from "../src/core/catalog";
import { invoiceBlock, invoiceDocument } from "./fakes/policy";

const SECTION = "resources[0].resolved";
const REFUSAL = ": the entry is drawn without the server's policy";

// The document with one entry whose `resolved` is exactly `section`; `ABSENT` leaves the member off.
const ABSENT = Symbol("absent");
const documentWith = (section: unknown) => {
  const doc = invoiceDocument(null) as Record<string, unknown>;
  const entry = (doc.resources as Record<string, unknown>[])[0]!;
  if (section !== ABSENT) entry.resolved = section;
  return doc;
};

const read = (section: unknown) => {
  const notices: string[] = [];
  const entry = parseCatalog(documentWith(section), (at, why) => notices.push(`${at} ${why}`))
    .resources[0]!;
  return { entry, notices };
};
const refused = (notices: readonly string[]) =>
  notices.filter((n) => n.startsWith(`${SECTION} `) && n.endsWith(REFUSAL));
// The path is the whole of a notice before its first space: two notices on one path are one fact
// said twice, which is what the section's two readers drift into when each guards the other's fact.
const paths = (notices: readonly string[]) => notices.map((n) => n.slice(0, n.indexOf(" ")));

const unreadable: readonly [string, unknown][] = [
  ["printed as a word", "yes"],
  ["printed as a list", []],
  ["printed as a number", 7],
  ["printed as null", null],
  ["printed as an empty object", {}],
];

for (const [when, section] of unreadable) {
  test(`a resolved section ${when} is refused in one sentence and draws as today`, () => {
    const { entry, notices } = read(section);
    assert.equal(refused(notices).length, 1, notices.join("\n"));
    assert.match(
      refused(notices)[0]!,
      /^resources\[0\]\.resolved .+: the entry is drawn without the server's policy$/,
    );
    assert.deepEqual(
      notices.filter((n) => !n.startsWith(SECTION)),
      [],
      "a section this build cannot read leaves nothing but itself to answer for",
    );
    assert.equal(new Set(paths(notices)).size, paths(notices).length, notices.join("\n"));
    assert.equal(entry.resolved, undefined);
    assert.equal(
      entry.fields.some((f) => f.policy !== undefined),
      false,
      "a refused block attaches no field's words",
    );
  });
}

test("a resolved section the server left off says nothing", () => {
  const { entry, notices } = read(ABSENT);
  assert.deepEqual(notices, [], "an older server is not worth a word");
  assert.equal(entry.resolved, undefined);
});

// A section both readers can look at but neither can adopt is still one broken member: the policy
// says so once at the section's own path, and the choice reader may say its own part once beside it.
// What may not happen is one path answered twice, which is what two readers of one section drift to.
test("a resolved section whose members neither reader adopts is announced once per path", () => {
  const { entry, notices } = read({ ...invoiceBlock(), fields: "nope" });
  assert.equal(refused(notices).length, 1, notices.join("\n"));
  assert.deepEqual(
    notices.filter((n) => !n.startsWith(SECTION)),
    [],
    notices.join("\n"),
  );
  assert.equal(new Set(paths(notices)).size, paths(notices).length, notices.join("\n"));
  assert.equal(entry.resolved, undefined);
});
