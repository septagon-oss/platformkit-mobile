import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  check,
  lookupLatest,
  provenance,
  proxyPath,
  raw,
  readSource,
  report,
  type LatestLookup,
} from "../scripts/catalog";
import { CatalogError, parseCatalog, SUPPORTED_CATALOG_VERSION } from "../src/core/catalog";

const fixture = () =>
  JSON.parse(readFileSync(new URL("../testdata/catalog.json", import.meta.url).pathname, "utf8"));

test("the golden catalog parses", () => {
  const c = parseCatalog(fixture());
  assert.equal(c.resources.length, 3);
  const note = c.resources[0]!;
  assert.equal(note.module, "note");
  assert.equal(note.entity, "note");
  assert.equal(note.path, "/api/v1/note/notes");
  assert.equal(note.writable, true);
  assert.deepEqual(note.immutable, ["status"]);
  assert.equal(note.fields[0]!.name, "id");
  assert.equal(note.fields[0]!.readOnly, true);
  const status = note.fields.find((f) => f.name === "status")!;
  assert.deepEqual(status.enum, ["open", "done"]);
  assert.equal(status.default, "open");
  assert.equal(c.resources[1]!.writable, false);
  // The doors beyond the five: one about a row, with an argument, and one
  // about the collection, without.
  assert.deepEqual(
    note.commands.map((cmd) => cmd.verb),
    ["publish", "archive"],
  );
  const publish = note.commands[0]!;
  assert.equal(publish.summary, "Publish a note");
  assert.equal(publish.collection, undefined);
  assert.deepEqual(
    publish.fields.map((f) => f.name),
    ["at"],
  );
  assert.equal(note.commands[1]!.collection, true);
  assert.deepEqual(note.commands[1]!.fields, []);
  // A resource with none carries none, and so does a server too old to say.
  assert.deepEqual(c.resources[1]!.commands, []);
  // And a singleton is told from a collection, which is what keeps a screen
  // from offering a New button no route serves.
  assert.equal(note.singleton, false);
  const settings = c.resources[2]!;
  assert.equal(settings.singleton, true);
  assert.equal(settings.path, "/api/v1/note/settings");
});

test("a command a server spells wrongly is refused by the name of what is wrong", () => {
  const doc = fixture();
  doc.resources[0].commands[0].verb = 7;
  assert.throws(
    () => parseCatalog(doc),
    (e: unknown) =>
      e instanceof CatalogError && e.message.includes("resources[0].commands[0].verb"),
  );
  const other = fixture();
  other.resources[0].commands = {};
  assert.throws(
    () => parseCatalog(other),
    (e: unknown) => e instanceof CatalogError && e.message.includes("resources[0].commands"),
  );
});

test("a malformed document is refused by name", () => {
  assert.throws(
    () => parseCatalog({ resources: [{ module: "x" }] }),
    (e: unknown) => e instanceof CatalogError && /resources\[0\]\.entity/.test(e.message),
  );
  assert.throws(
    () =>
      parseCatalog({
        resources: [
          {
            module: "x",
            entity: "y",
            path: "/p",
            fields: [{ name: "a", type: "money" }],
            writable: true,
          },
        ],
      }),
    (e: unknown) => e instanceof CatalogError && /type/.test(e.message),
  );
  assert.throws(() => parseCatalog(null), CatalogError);
});

test("the stamp decides what the build does with the answer", () => {
  // The golden file is the contract this build was written against, so its shape is
  // in range by definition — and if the copy ever stops saying so, the copy changed.
  assert.equal(parseCatalog(fixture()).version, 2);

  // A server old enough not to stamp is a server this shell was built against, and
  // refusing it would turn an older deployment into a broken app. The commands
  // rule already had that reasoning; the stamp needed it stated too.
  const unstamped = fixture();
  delete unstamped.catalogVersion;
  assert.equal(parseCatalog(unstamped).version, 0);
});

test("a shape newer than this build renders is refused rather than drawn from what it recognises", () => {
  // The failure this prevents is quiet: a field this build has never read is a field
  // it drops, and the person sees a screen missing the column they came for. The
  // message has to carry both numbers, because "the app is out of date" is only
  // actionable when you can tell by how much.
  assert.throws(
    () => parseCatalog({ catalogVersion: SUPPORTED_CATALOG_VERSION + 1, resources: [] }),
    (e: unknown) =>
      e instanceof CatalogError &&
      e.message.includes(`${SUPPORTED_CATALOG_VERSION + 1}`) &&
      e.message.includes(`${SUPPORTED_CATALOG_VERSION}`),
  );
});

test("a stamp that is not a whole version is refused, not repaired", () => {
  // "1" and 1.5 are not near-misses to be coerced: a server writing the stamp another
  // way is a server that changed what the field means, which is the very event the
  // field exists to report.
  for (const stamp of ["1", 1.5, 0, -1, null, true, {}, []]) {
    assert.throws(
      () => parseCatalog({ catalogVersion: stamp, resources: [] }),
      (e: unknown) => e instanceof CatalogError && e.message.includes("catalogVersion"),
      `stamp ${JSON.stringify(stamp)} was accepted`,
    );
  }
});

test("the stamp is read before the body, so a newer server is named as a newer server", () => {
  // With both wrong, an error about resources would send someone to the wrong file.
  assert.throws(
    () => parseCatalog({ catalogVersion: SUPPORTED_CATALOG_VERSION + 2, resources: "nope" }),
    (e: unknown) => e instanceof CatalogError && e.message.includes("catalogVersion"),
  );
});

const PINNED = "7fc4b0abd547f4e30ad4e5b8b87ef6cc34138bb0";

test("the copy names the commit it was fetched from, and the bytes still match it", async () => {
  // Every screen is derived from this fixture, so "copied by hand" has to stay a
  // checked claim: the hash is why editing the copy to make a test pass fails instead.
  // The revision is main, which is where the version-2 stamp lives; no tag carries it
  // yet, so the record names a commit, which cannot move under the bytes the way a
  // branch would, and provenance() reads it as its own tag.
  await assert.match(await check(), /matches 7fc4b0ab/);
  const source = await readSource();
  assert.equal(source.upstream.commit, PINNED);
  assert.equal(source.upstream.tag, PINNED);
  assert.equal(
    raw(source),
    `https://raw.githubusercontent.com/septagon-oss/platformkit/${PINNED}/ui/screens/testdata/catalog.json`,
  );
});

test("a provenance record that cannot vouch for the copy is refused by name", () => {
  // Each refusal closes a way the check could be made decorative: point the record at
  // another host, at a ref that can move, at a file outside the repository, or at a
  // command that describes different bytes than the ones recorded.
  const good = {
    schema: "platformkit.catalog-source.v1",
    fixture: "testdata/catalog.json",
    sha256: "a".repeat(64),
    upstream: {
      repository: "https://github.com/septagon-oss/platformkit",
      commit: "b".repeat(40),
      tag: "v1.1.0",
      path: "ui/screens/testdata/catalog.json",
      command: `curl -fsSL https://raw.githubusercontent.com/septagon-oss/platformkit/${"b".repeat(40)}/ui/screens/testdata/catalog.json`,
    },
  };
  const refuse = (mutate: (s: Record<string, unknown>) => void, said: string) => {
    const bad = structuredClone(good);
    mutate(bad as unknown as Record<string, unknown>);
    assert.throws(
      () => provenance(bad),
      (e: unknown) => e instanceof Error && e.message.includes(said),
    );
  };
  assert.doesNotThrow(() => provenance(good));
  refuse((s) => {
    s.schema = "something.else";
  }, "schema is not");
  refuse((s) => {
    s.fixture = "testdata/other.json";
  }, "fixture is not");
  refuse((s) => {
    s.sha256 = "not-a-hash";
  }, "sha256");
  refuse((s) => {
    (s.upstream as Record<string, unknown>).repository =
      "http://github.com/septagon-oss/platformkit";
  }, "https URL");
  refuse((s) => {
    (s.upstream as Record<string, unknown>).commit = "v1.1.0";
  }, "full commit ID");
  refuse((s) => {
    (s.upstream as Record<string, unknown>).path = "../../etc/passwd";
  }, "plain repository path");
  refuse((s) => {
    (s.upstream as Record<string, unknown>).command = "curl -fsSL https://elsewhere.example/cat";
  }, "does not name the recorded commit");
  assert.throws(
    () =>
      raw({
        ...provenance(good),
        upstream: { ...provenance(good).upstream, repository: "https://example.org/a/b" },
      }),
    /no raw file source/,
  );
});

test("the two provenance records have not forked in the fields they share", () => {
  // The design tokens already record where they came from. Two records naming the same
  // idea differently is how one of them stops meaning anything, and the difference
  // would show up in the next person's grep rather than in a failing build.
  const read = (name: string) =>
    readFileSync(new URL(`../testdata/${name}`, import.meta.url).pathname, "utf8");
  const tokens = read("design-tokens.source.json");
  const catalog = read("catalog.source.json");
  const shared = (v: string) => Object.keys(JSON.parse(v) as Record<string, unknown>);
  assert.deepEqual(
    shared(tokens).filter((k) => ["schema", "fixture", "sha256"].includes(k)),
    ["schema", "fixture", "sha256"],
  );
  assert.deepEqual(
    shared(catalog).filter((k) => ["schema", "fixture", "sha256"].includes(k)),
    ["schema", "fixture", "sha256"],
  );
  const upstream = (v: string) =>
    Object.keys((JSON.parse(v).upstream ?? {}) as Record<string, unknown>).filter((k) =>
      ["repository", "commit", "command"].includes(k),
    );
  assert.deepEqual(upstream(tokens), upstream(catalog));
});

test("the drift report says the six things it can say, and only the true one", async () => {
  // This is the scheduled half, so its branches are chosen here rather than waited
  // for: a report nobody has watched speak is the unconnected mechanism this change
  // exists to remove. Six outcomes, because "no newer version" and "I could not tell
  // you" are different answers and used to be the same line.
  const source = await readSource();
  const ours = Buffer.from('{"catalogVersion":1}');
  const lines = (latest?: LatestLookup) => report(source, ours, ours, latest).join("\n");

  assert.match(lines(), /^ok  testdata\/catalog\.json still matches 7fc4b0ab/);
  assert.match(lines(), /^ok .*\nok  7fc4b0abd547f4e30ad4e5b8b87ef6cc34138bb0 is the version/m);
  assert.match(
    report(source, ours, Buffer.from('{"catalogVersion":2}')).join("\n"),
    /^DRIFT .*differs from 7fc4b0ab/,
  );
  assert.match(
    lines({ state: "ahead", version: "v1.2.0", bytes: Buffer.from('{"catalogVersion":2}') }),
    /DRIFT v1\.2\.0 is published and its catalog differs/,
  );
  assert.match(
    lines({ state: "ahead", version: "v1.2.0", bytes: ours }),
    /note  v1\.2\.0 is published; its catalog is the same shape/,
  );
  // The line that shipped green without asking: an unreachable proxy must never be
  // reported as the second "ok", because that is how a schedule becomes a placebo.
  const unknown = lines({
    state: "unreachable",
    detail: "https://proxy.golang.org/… answered 404",
  });
  assert.match(unknown, /note  cannot tell whether a newer version is published: .*404/);
  assert.equal(/^ok .*\nok /m.test(unknown), false, "a failed lookup cannot report two oks");
});

test("the proxy is asked about the module path, not the repository path", async () => {
  // What actually shipped for one revision: `new URL(repo).pathname` alone, so the
  // proxy was asked about a module called `septagon-oss/platformkit`, answered 404,
  // and the report said "ok, latest". The host is part of a Go module path.
  const source = await readSource();
  assert.equal(proxyPath(source), "github.com/septagon-oss/platformkit");
  assert.equal(
    await lookupLatest(source).then((l) => l.state),
    "latest",
    "the live proxy resolves this module; a 404 here means the path is wrong again",
  );
});

// ---------------------------------------------------------------------------
// Version 2: the three addresses a document may name, and the five words it
// may narrow the write doors to.
// ---------------------------------------------------------------------------

const controlPlane = () =>
  JSON.parse(
    readFileSync(
      new URL("../testdata/catalog.control-plane.json", import.meta.url).pathname,
      "utf8",
    ),
  );

test("the copy is a version-2 document and adds no key this build ignores", () => {
  const c = parseCatalog(fixture());
  assert.equal(c.version, 2);
  assert.deepEqual(
    c.resources.map((e) => `${e.module}/${e.entity}`),
    ["note/note", "note/tag", "note/setting"],
  );
  // `screen` is the web workspace's page address. Every one of the kernel's own
  // three resources names /app/note/notes, which no router could serve as three
  // screens, so the phone's routes stay its own file tree. The key is in the
  // bytes and not in the entry: reading it is a decision somebody has to make.
  assert.ok(
    readFileSync(new URL("../testdata/catalog.json", import.meta.url).pathname, "utf8").includes(
      '"screen": "/app/note/notes"',
    ),
  );
  assert.equal("screen" in c.resources[0]!, false);
});

test("an entry keeps the write address it was given, and one that has none keeps its own", () => {
  const c = parseCatalog(controlPlane());
  const priceLists = c.resources[3]!;
  assert.equal(priceLists.path, "/api/v1/pricing/price-lists");
  assert.equal(priceLists.writePath, "/api/v1/ops/pricing/price-lists");
  assert.deepEqual(priceLists.operations, ["list", "read", "create", "update"]);
  assert.equal(priceLists.commands[0]!.path, "/api/v1/ops/pricing/price-lists/{id}/retire");
  // A singleton's PUT may live on another surface too, so it carries the field
  // for the same reason a collection does.
  assert.equal(c.resources[4]!.singleton, true);
  assert.equal(c.resources[4]!.writePath, "/api/v1/ops/pricing/currency");
  // And the resources the kernel itself published say nothing, which means
  // path — never "you may not write", which is what the field's absence is
  // often mistaken for.
  assert.equal(c.resources[0]!.writePath, undefined);
  assert.equal(c.resources[0]!.operations, undefined);
});

test("the extension fixture is the pinned copy plus the case it does not carry", () => {
  // One fixture is the kernel's bytes, the other is this repository's, and the
  // relation between them is asserted rather than remembered: the extension is
  // the copy with entries added to it, so it cannot quietly drift off the
  // document every screen is derived from.
  assert.equal(controlPlane().catalogVersion, 2);
  assert.deepEqual(
    parseCatalog(controlPlane()).resources.slice(0, 3),
    parseCatalog(fixture()).resources,
  );
});

test("an address without a leading slash is refused naming its own field", () => {
  for (const bad of ["api/v1/x", "", "note/notes"]) {
    for (const key of ["path", "write_path"]) {
      const doc = fixture();
      doc.resources[0][key] = bad;
      assert.throws(
        () => parseCatalog(doc),
        (e: unknown) => e instanceof CatalogError && e.message.includes(`resources[0].${key}`),
        `${key} = ${JSON.stringify(bad)} was accepted`,
      );
    }
    const command = fixture();
    command.resources[0].commands[0].path = bad;
    assert.throws(
      () => parseCatalog(command),
      (e: unknown) =>
        e instanceof CatalogError &&
        e.message.includes("resources[0].commands[0].path") &&
        e.message.includes("not an absolute path"),
      `command path = ${JSON.stringify(bad)} was accepted`,
    );
  }
});

test("an address that is not a string is refused as the wrong kind of thing", () => {
  for (const bad of [42, ["a"], {}, true, null]) {
    const doc = fixture();
    doc.resources[0].write_path = bad;
    assert.throws(
      () => parseCatalog(doc),
      (e: unknown) =>
        e instanceof CatalogError &&
        e.message.includes("resources[0].write_path") &&
        e.message.includes("is not a string"),
      `write_path = ${JSON.stringify(bad)} was accepted`,
    );
  }
});

test("operations holds the five words, and a sixth is refused by number and by name", () => {
  const doc = fixture();
  doc.resources[0].operations = ["list", "read", "create", "update"];
  assert.deepEqual(parseCatalog(doc).resources[0]!.operations, [
    "list",
    "read",
    "create",
    "update",
  ]);
  // An empty list is the server's own spelling of "all five" (kit/rest reads a
  // nil and an empty slice the same way), so the parser keeps it rather than
  // inventing a set the document did not print.
  const empty = fixture();
  empty.resources[0].operations = [];
  assert.deepEqual(parseCatalog(empty).resources[0]!.operations, []);
  // A word this build has no door for is the event catalogVersion exists to
  // catch; the message says which member and what the vocabulary is.
  for (const [operations, why] of [
    [
      ["list", "read", "remove"],
      /operations\[2\] is "remove", not one of list, read, create, update, delete/,
    ],
    [["read", "read"], /operations names "read" twice/],
    ["list", /operations is not a list of strings/],
    [{ 0: "list" }, /operations is not a list of strings/],
  ] as const) {
    const bad = fixture();
    bad.resources[0].operations = operations;
    assert.throws(
      () => parseCatalog(bad),
      (e: unknown) => e instanceof CatalogError && why.test(e.message),
      `${JSON.stringify(operations)} was accepted`,
    );
  }
});

test("a v2 document carrying the keys this build does not act on still parses", () => {
  // Every one of these is listed in the brief as a key the phone sees in a
  // version-2 document and decides to ignore. The decision is only real while a
  // case refuses a parse that starts acting on one; if this test ever fails
  // because the entry grew the field, the decision has moved and this says so.
  const doc = fixture();
  doc.resources[0].screen = "/app/note/notes";
  doc.resources[0].fields[1].maxLength = 80;
  doc.resources[0].fields[1].present = "badge";
  doc.resources[0].fields[1].display = true;
  doc.resources[0].fields[2].widget = "richtext";
  const c = parseCatalog(doc);
  const note = c.resources[0]!;
  assert.equal("screen" in note, false, "screen reached the entry");
  for (const f of note.fields) {
    for (const ignored of ["maxLength", "present", "display"]) {
      assert.equal(ignored in f, false, `${ignored} reached a field`);
    }
  }
  // A widget the phone has no control for is still the widget the server named.
  assert.equal(note.fields[2]!.widget, "richtext");
});
