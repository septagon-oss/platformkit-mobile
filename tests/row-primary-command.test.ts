// The row's command is the entry's declaration, read: which verb a swipe may run, and what an
// author's mistake costs. Every case is served bytes through the shipped `parseCatalog`, because the
// kernel refuses these same four declarations when it mounts the resource (`kit/rest/hints.go`) and a
// phone in a pocket may still be served them by an older one — the phone refuses what the server
// refuses, and refuses it with a line a developer hears rather than a swipe that cannot run.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog, type Entry } from "../src/core/catalog";

const golden = () =>
  JSON.parse(readFileSync(new URL("../testdata/catalog.json", import.meta.url).pathname, "utf8"));

/** The golden's first entry, as its author described it, plus what the parse said about that. */
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

/** One more verb of the entry, with what it says about itself. */
function withCommand(verb: string, presentation?: unknown, over: Record<string, unknown> = {}) {
  return (entry: Record<string, unknown>) => {
    const commands = entry.commands as Record<string, unknown>[];
    commands.push({ verb, summary: `Do the ${verb} thing`, presentation, ...over });
  };
}

function withPrimary(verb: string) {
  return (entry: Record<string, unknown>) => {
    entry.presentation = { ...(entry.presentation as object | undefined), primaryCommand: verb };
  };
}

const both =
  (...mutate: ((entry: Record<string, unknown>) => void)[]) =>
  (entry: Record<string, unknown>) => {
    for (const one of mutate) one(entry);
  };

test("a verb naming a record command that takes no argument is the verb a row swipes", () => {
  const { entry, lines } = served(both(withCommand("resolve"), withPrimary("resolve")));
  assert.equal(entry.hints?.primaryCommand, "resolve");
  assert.deepEqual(lines, []);
});

test("a verb that names no command of this entry is refused by name and costs the swipe", () => {
  const { entry, lines } = served(withPrimary("resolve"));
  assert.equal(entry.hints?.primaryCommand, undefined);
  assert.deepEqual(lines, [
    "resources[0].presentation.primaryCommand names no command of this entry: the row offers no swipe",
  ]);
});

test("a verb the kernel runs for its own reasons is never what a row runs", () => {
  const { entry, lines } = served(
    both(withCommand("resolve", { system: true }), withPrimary("resolve")),
  );
  assert.equal(entry.hints?.primaryCommand, undefined);
  assert.deepEqual(lines, [
    "resources[0].presentation.primaryCommand is a system command; no person is offered it: the row offers no swipe",
  ]);
});

test("a verb about the whole collection is not one a row runs", () => {
  const { entry, lines } = served(
    both(withCommand("purge", undefined, { collection: true }), withPrimary("purge")),
  );
  assert.equal(entry.hints?.primaryCommand, undefined);
  assert.deepEqual(lines, [
    "resources[0].presentation.primaryCommand runs on the collection: the row offers no swipe",
  ]);
});

test("a verb that takes an argument is not one a swipe sends", () => {
  const { entry, lines } = served(
    both(
      withCommand("resolve", undefined, {
        fields: [{ name: "reason", type: "string", doc: "Why" }],
      }),
      withPrimary("resolve"),
    ),
  );
  assert.equal(entry.hints?.primaryCommand, undefined);
  assert.deepEqual(lines, [
    "resources[0].presentation.primaryCommand takes arguments; a row's swipe sends none: the row offers no swipe",
  ]);
});

test("a declaration that is no word is refused as the kind of thing it is", () => {
  const { entry, lines } = served((e) => (e.presentation = { primaryCommand: 7 }));
  assert.equal(entry.hints?.primaryCommand, undefined);
  assert.deepEqual(lines, [
    "resources[0].presentation.primaryCommand is not a command of this entry: the default is used",
  ]);
});

test("an entry that names no row command keeps every other hint and says nothing", () => {
  const { entry, lines } = served((e) => {
    e.presentation = { singular: "Note", icon: "task", primaryCommand: "publish" };
  });
  // `publish` is the golden's own verb and it takes an argument, so the swipe goes and the
  // rest of what the entry declared stays exactly where it was.
  assert.equal(entry.hints?.primaryCommand, undefined);
  assert.equal(entry.hints?.singular, "Note");
  assert.equal(entry.hints?.icon, "task");
  assert.deepEqual(lines, [
    "resources[0].presentation.primaryCommand takes arguments; a row's swipe sends none: the row offers no swipe",
  ]);
});

test("a command that says it hurts is read as one that hurts", () => {
  const { entry } = served(withCommand("burn", { destructive: true }));
  assert.equal(entry.commands.find((c) => c.verb === "burn")?.hints?.destructive, true);
});

test("silence about hurting and a declared no are one reading, and neither is stored", () => {
  const declared = served(withCommand("burn", { destructive: false }));
  assert.equal(declared.lines.length, 0);
  assert.deepEqual(declared.entry.commands.find((c) => c.verb === "burn")?.hints, undefined);
});

test("a command that cannot say whether it hurts is asked before it runs", () => {
  const { entry, lines } = served(withCommand("burn", { destructive: "yes" }));
  assert.equal(entry.commands.find((c) => c.verb === "burn")?.hints?.destructive, true);
  assert.deepEqual(lines, [
    "resources[0].commands[2].presentation.destructive is not yes or no: the command is asked before it runs",
  ]);
});
