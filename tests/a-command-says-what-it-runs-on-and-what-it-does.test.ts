// What a person is told about one command, said once for the dialog, the sheet
// and the sentence said afterwards. The title is the command's own word and the
// answer is that same word, so a button never carries a sentence. The sentence
// under the title is what running it does — the declared consequence, else the
// summary where that is not already the title — and the developer's description
// of the wire member is never spoken to a person. A command nobody described
// stays a bare confirm: an explicit question with no invented sentence about what
// it does. Every case is served bytes through the shipped parser, hinted and
// unhinted, in both languages the phone says.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCatalog, type Command } from "../src/core/catalog";
import { commandTitle, commandWording, copyForLocale } from "../src/core/derive";
import { unresolved } from "./fakes/unresolved";

const english = copyForLocale("en");
const portuguese = copyForLocale("pt-PT");

const golden = () =>
  unresolved(
    JSON.parse(readFileSync(new URL("../testdata/catalog.json", import.meta.url).pathname, "utf8")),
  );

const served_verbs: Record<string, { summary: string; description: string }> = {
  archive: {
    summary: "Archive every resolved note",
    description: "Takes what is finished out of the way.",
  },
  publish: {
    summary: "Publish a note",
    description: "Makes the note visible. Publishing a published note changes nothing.",
  },
  resolve: { summary: "Resolve a task", description: "Whoever opened it says it is done." },
};

/**
 * command is the pinned golden's note with one command read as the kernel serves
 * it: its summary and description as the document spells them, and its
 * `presentation` set to what is given — or absent, which is how the reference
 * kernel serves every command today. `resolve` is the reference resource's own
 * verb, which this fixture does not mount, so it joins as the kernel describes it.
 */
function command(verb: string, presentation?: unknown): Command {
  const doc = golden();
  const note = doc.resources[0];
  const own = note.commands.find((c: { verb: string }) => c.verb === verb);
  if (own === undefined)
    note.commands.push({
      verb,
      summary: served_verbs[verb]!.summary,
      description: served_verbs[verb]!.description,
      fields: [],
    });
  const target = note.commands.find((c: { verb: string }) => c.verb === verb);
  if (presentation === undefined) delete target.presentation;
  else target.presentation = presentation;
  return parseCatalog(doc).resources[0]!.commands.find((c) => c.verb === verb)!;
}

test("a command that declares nothing is asked in its own words, answered short, and says nothing it does not know", () => {
  const archive = command("archive");
  const wording = commandWording(archive, "", english);
  assert.equal(wording.title, commandTitle(archive), "the title stays the one reading");
  assert.equal(wording.title, "Archive every resolved note");
  // The summary is the title, so there is no second sentence to say under it.
  assert.equal(wording.consequence, "");
  assert.equal(wording.button, "Archive", "a button is a word, not the summary");
  assert.equal(wording.success, "Archive done");
  assert.equal(wording.actsOn, "", "a command about the list acts on no record");
  const publish = commandWording(command("publish"), "", english);
  assert.equal(publish.button, "Publish");
  assert.equal(publish.consequence, "", "the summary is the title here too");
  assert.equal(publish.success, "Publish done");
  for (const w of [wording, publish])
    for (const said of [w.title, w.button, w.consequence, w.success])
      assert.ok(!said.includes("out of the way"), `${said} quotes the developer's prose`);
});

test("a declared consequence, answer and success are the words a person is told", () => {
  const resolve = command("resolve", {
    label: "Resolve",
    summary: "Resolve a task",
    confirmation: { title: "Resolve?", body: "The task stops being open.", confirmLabel: "Yes" },
    successMessage: "The task is resolved.",
  });
  const wording = commandWording(resolve, "Replace the gasket", english);
  assert.deepEqual(wording, {
    title: "Resolve",
    button: "Resolve",
    actsOn: "Replace the gasket",
    consequence: "The task stops being open.",
    success: "The task is resolved.",
  });
});

test("a labelled command whose document says no consequence moves the summary under the title", () => {
  // This is the reference kernel's shape: a label, a summary, no confirmation.
  const resolve = command("resolve", { label: "Resolve", summary: "Resolve a task" });
  const wording = commandWording(resolve, "Replace the gasket", english);
  assert.equal(wording.title, "Resolve");
  assert.equal(wording.consequence, "Resolve a task");
  assert.equal(wording.success, "Resolve done");
});

test("the title never repeats as the consequence, and the description never appears, in either language", () => {
  const cases = [
    command("archive", undefined),
    command("publish", undefined),
    command("resolve", { label: "Resolve", summary: "Resolve a task" }),
    command("resolve", { summary: "Resolve a task" }),
  ];
  for (const c of cases)
    for (const copy of [english, portuguese]) {
      const wording = commandWording(c, "Record", copy);
      assert.notEqual(wording.consequence, wording.title, c.verb);
      const prose = c.description ?? "";
      for (const said of [wording.title, wording.button, wording.consequence, wording.success]) {
        assert.ok(!said.includes(prose), `${said} quotes the developer's prose`);
        assert.ok(!said.includes("Makes the note visible"), `${said} quotes the developer's prose`);
      }
    }
});

test("a success with no declared sentence is the kit's own frame, in the phone's language", () => {
  const archive = command("archive", undefined);
  assert.equal(commandWording(archive, "", english).success, "Archive done");
  assert.equal(commandWording(archive, "", portuguese).success, "Archive concluído");
  const declared = command("archive", { successMessage: "Out of the way." });
  assert.equal(commandWording(declared, "", portuguese).success, "Out of the way.");
});
