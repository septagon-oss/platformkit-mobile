// Rules this file holds about what a source entry must say to be savable.
// A saved declaration is read whole or not at all, and every member the kit cannot carry is
// named at its own document path — missing, blank or not a word — because a heart that simply
// never appears is a defect no author can find. The kernel's `listTitle` is not one of those
// members: it names a page the composition owns, which this phone already names from that
// entry's own declared words, so requiring it would refuse the control over a word no phone
// prints. The declaration points at the entry that holds the copies, and that entry has to
// carry both keeping writes in the two shapes the kit's writes take.
import assert from "node:assert/strict";
import test from "node:test";
import { parseCatalog, key, type Catalog, type HintNotice } from "../src/core/catalog";
import { commandOf, collectionCommands, rowCommands } from "../src/core/derive";
import { savable } from "../src/core/saved";

const whole = {
  save: "Save",
  saved: "Saved",
  remove: "Remove",
  listEntry: "look/copy",
};

/**
 * mounted is a savable source plus the entry holding this person's copies.
 *
 * `source` replaces the declaration the source publishes, `holder` the saved entry's own
 * commands, so a case changes one fact of the contract and leaves the rest as the kernel
 * prints it. Every notice the read writes comes back in `notices`, and a case that expects
 * none says so.
 */
function mounted(
  source: Record<string, unknown> | null = whole,
  holder: (c: Record<string, unknown>) => void = () => {},
): { catalog: Catalog; notices: string[] } {
  const notices: string[] = [];
  const notice: HintNotice = (at, why) => notices.push(`${at} ${why}`);
  const saved: Record<string, unknown> | undefined =
    source === null ? undefined : { filters: [], saved: source ?? undefined };
  const copy: Record<string, unknown> = {
    module: "look",
    entity: "copy",
    path: "/api/v1/look/copies",
    writable: true,
    fields: [
      { name: "id", type: "uuid", readOnly: true },
      { name: "sourceAvailability", type: "string", readOnly: true },
    ],
    commands: [
      {
        verb: "save",
        summary: "Keep a copy",
        collection: true,
        fields: [{ name: "source", type: "string", required: true }],
      },
      {
        verb: "unsave",
        summary: "Take one copy away",
        fields: [
          { name: "id", type: "uuid", required: true },
          { name: "expectedRevision", type: "int", required: true },
        ],
      },
    ],
    presentation: { filters: [], availabilityField: "sourceAvailability" },
  };
  holder(copy);
  const catalog = parseCatalog(
    {
      catalogVersion: 3,
      resources: [
        {
          module: "look",
          entity: "product",
          path: "/api/v1/look/products",
          writable: false,
          fields: [
            { name: "id", type: "uuid", readOnly: true },
            { name: "title", type: "string" },
          ],
          commands: [],
          presentation: saved === undefined ? { filters: [] } : saved,
        },
        copy,
      ],
    },
    notice,
  );
  return { catalog, notices };
}

const words = (extra: Record<string, unknown> = {}) => ({ ...whole, ...extra });

test("a source declaring its words and its list is savable and owes no notice", () => {
  const { catalog, notices } = mounted(words());
  const found = savable(catalog.resources[0]!, catalog.resources);
  assert.ok(found, "the declaration and the mounted catalogue agree");
  assert.equal(key(found.list), "look/copy");
  assert.deepEqual(found.words, words());
  assert.deepEqual(notices, [], "a contract that holds says nothing");
});

test("the kernel's `listTitle` changes nothing about what the heart prints", () => {
  const published = parseCatalog(
    {
      catalogVersion: 3,
      resources: [
        {
          module: "look",
          entity: "product",
          path: "/api/v1/look/products",
          writable: false,
          fields: [{ name: "id", type: "uuid", readOnly: true }],
          commands: [],
          presentation: {
            filters: [],
            saved: { ...words(), listTitle: "Saved looks" },
          },
        },
      ],
    },
    (at, why) => assert.fail(`${at} ${why}`),
  );
  assert.deepEqual(
    published.resources[0]!.hints?.saved,
    words(),
    "the word for a page this kit does not own is not read into the declaration, and its presence is not a defect",
  );
});

test("each member the kit requires is named when the document leaves it out", () => {
  for (const member of ["save", "saved", "remove", "listEntry"]) {
    const missing = Object.fromEntries(Object.entries(words()).filter(([k]) => k !== member));
    const { catalog, notices } = mounted(missing);
    assert.equal(catalog.resources[0]!.hints?.saved, undefined, `${member} is required`);
    assert.deepEqual(
      notices,
      [
        `resources[0].presentation.saved.${member} declares no ${
          member === "listEntry"
            ? '"module/entity" of the entry holding the copies'
            : member === "save"
              ? "word to keep a copy with"
              : member === "saved"
                ? "word to name a copy kept"
                : "word to name the copy taken away"
        }: nothing is savable`,
      ],
      `a declaration missing ${member} says which member it lacks`,
    );
  }
});

test("a declaration missing two members says both", () => {
  const { notices } = mounted({ save: "Save", listEntry: "look/copy" });
  assert.deepEqual(
    notices.map((n) => n.split(" ")[0]),
    ["resources[0].presentation.saved.saved", "resources[0].presentation.saved.remove"],
    "the whole declaration is refused, and each half of the refusal is its own line",
  );
});

test("a member that is not a word, or a word of nothing, is named as one", () => {
  for (const value of [7, "", "   "]) {
    const { catalog, notices } = mounted(words({ save: value }));
    assert.equal(catalog.resources[0]!.hints?.saved, undefined);
    assert.equal(notices.length, 1);
    assert.match(notices[0]!, /^resources\[0\]\.presentation\.saved\.save is not /);
  }
  const wrongType = mounted(words({ save: { word: "Save" } }));
  assert.match(wrongType.notices[0]!, /is not word to keep a copy with/);
});

test("a saved declaration on an entry that says nothing about being saved is silence", () => {
  const { catalog, notices } = mounted(null);
  assert.equal(catalog.resources[0]!.hints?.saved, undefined);
  assert.deepEqual(notices, [], "an entry that is not savable is the ordinary case");
  assert.equal(savable(catalog.resources[0]!, catalog.resources), undefined);
});

test("a declaration pointing at no entry of this catalogue names what it pointed at", () => {
  const { catalog, notices } = mounted(words({ listEntry: "look/copies" }));
  const said: string[] = [];
  assert.equal(
    savable(catalog.resources[0]!, catalog.resources, (at, why) => said.push(`${at} ${why}`)),
    undefined,
    "no heart is drawn",
  );
  assert.deepEqual(said, [
    'presentation.saved.listEntry names "look/copies", which no entry of this catalogue prints: no heart is drawn',
  ]);
  assert.deepEqual(notices, [], "the pointer resolves only against the whole mounted catalogue");
});

test("the entry that holds the copies must take the keep about the collection", () => {
  const { catalog } = mounted(words(), (entry) => {
    (entry.commands as Record<string, unknown>[])[0]!.collection = false;
  });
  const said: string[] = [];
  assert.equal(
    savable(catalog.resources[0]!, catalog.resources, (at, why) => said.push(`${at} ${why}`)),
    undefined,
    "no heart is drawn",
  );
  assert.deepEqual(said, [
    "look/copy.save is not a command about the collection carrying a source: no heart is drawn",
  ]);
});

test("and it must take the removal about one record", () => {
  const { catalog } = mounted(words(), (entry) => {
    (entry.commands as Record<string, unknown>[])[1]!.collection = true;
  });
  const said: string[] = [];
  assert.equal(
    savable(catalog.resources[0]!, catalog.resources, (at, why) => said.push(`${at} ${why}`)),
    undefined,
    "no heart is drawn",
  );
  assert.deepEqual(said, ["look/copy.unsave does not run on one record: no heart is drawn"]);
});

test("neither keeping write is ever offered as a form, a question or a swipe", () => {
  const { catalog } = mounted(words());
  const list = catalog.resources[1]!;
  assert.deepEqual(
    rowCommands(list).map((c) => c.verb),
    [],
  );
  assert.deepEqual(
    collectionCommands(list).map((c) => c.verb),
    [],
  );
  assert.ok(commandOf(list, "save", "collection"), "the address still resolves for the heart");
  assert.ok(commandOf(list, "unsave", "record"), "and for its removal");
});
