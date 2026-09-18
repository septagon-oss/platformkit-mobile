import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { check, provenance, raw, readSource, report } from "../scripts/catalog";
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
  assert.equal(parseCatalog(fixture()).version, 1);

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

test("the copy names a published commit, and the bytes still match it", async () => {
  // Every screen is derived from this fixture, so "copied by hand" has to stay a
  // checked claim: the hash is why editing the copy to make a test pass fails instead.
  await assert.match(await check(), /matches v1\.1\.0/);
  const source = await readSource();
  assert.equal(source.upstream.tag, "v1.1.0");
  assert.equal(
    raw(source),
    "https://raw.githubusercontent.com/septagon-oss/platformkit/893cf2ae79a7f5b6a9b8618fd3586e237fea85ea/ui/screens/testdata/catalog.json",
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

test("the drift report says the four things it can say, and only the true one", async () => {
  // This is the scheduled half, so its branches are chosen here rather than waited
  // for: a report nobody has watched speak is the unconnected mechanism this change
  // exists to remove.
  const source = await readSource();
  const ours = Buffer.from('{"catalogVersion":1}');
  const against = (bytes: Buffer) => report(source, ours, bytes).join("\n");
  const newer = (version: string, bytes: Buffer) =>
    report(source, ours, ours, { version, bytes }).join("\n");

  assert.match(against(ours), /^ok  testdata\/catalog\.json still matches v1\.1\.0/);
  assert.match(against(Buffer.from('{"catalogVersion":2}')), /^DRIFT .*differs from v1\.1\.0/);
  assert.match(
    newer("v1.2.0", Buffer.from('{"catalogVersion":2}')),
    /DRIFT v1\.2\.0 is published and its catalog differs/,
  );
  assert.match(newer("v1.2.0", ours), /note  v1\.2\.0 is published; its catalog is the same shape/);
});
