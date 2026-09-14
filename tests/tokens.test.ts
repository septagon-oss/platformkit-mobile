import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import {
  COMMAND,
  FIXTURE,
  OUTPUT,
  SOURCE,
  UPSTREAM,
  camel,
  provenance,
  record,
  render,
  sha256,
} from "../scripts/tokens";
import { palette } from "../src/ui/tokens";

const fixture = (): string => readFileSync(FIXTURE, "utf8");
const doc = (): unknown => JSON.parse(fixture());
const source = () => provenance(JSON.parse(readFileSync(SOURCE, "utf8")));

interface Token {
  readonly name: string;
  readonly type: string;
  readonly value: string;
}
interface Export {
  readonly schema: string;
  readonly themes: readonly { readonly mode: string; readonly tokens: readonly Token[] }[];
}

test("the generated palette is what the fixture renders to", () => {
  assert.equal(
    readFileSync(OUTPUT, "utf8"),
    render(doc()),
    `${OUTPUT} is stale: run npm run tokens`,
  );
});

test("the fixture is the export its provenance describes", () => {
  const known = source();
  assert.equal(
    known.sha256,
    sha256(fixture()),
    `${FIXTURE} changed without ${SOURCE}: run npm run tokens -- --upstream <commit>`,
  );
  // The record names the public repository and the projection that made the
  // fixture, so the next refresh is the same command at another commit.
  assert.equal(known.upstream.repository, UPSTREAM);
  assert.equal(known.upstream.command, COMMAND);
  assert.match(known.upstream.commit, /^[0-9a-f]{40}$/);
});

test("every colour role in both modes is the fixture's, by name, not two of them", () => {
  const { themes } = doc() as Export;
  for (const mode of ["light", "dark"] as const) {
    const theme = themes.find((t) => t.mode === mode)!;
    const colours = theme.tokens.filter((t) => t.type === "color");
    assert.equal(colours.length, 22, `${mode}: the export carries 22 colour roles`);
    assert.deepEqual(
      Object.fromEntries(colours.map((t) => [camel(t.name), t.value])),
      { ...palette[mode] },
      `${mode}: ${OUTPUT} does not read the fixture's colours`,
    );
  }
  // Two roles a reviewer can recognise by eye, so a wrong export is caught
  // even when it is internally consistent.
  assert.equal(palette.light.accentDefault, "#0f5d4e");
  assert.equal(palette.light.statusDangerBg, "#fbe5e2");
  assert.notEqual(palette.light.surfaceCanvas, palette.dark.surfaceCanvas);
});

test("a provenance record that cannot vouch for the fixture is refused by name", () => {
  const good = record(fixture(), "5fc585926ce9a7d31af131f26a08ae9e967a591d");
  assert.deepEqual(provenance(good), good);
  assert.throws(() => provenance({ ...good, schema: "other" }), /schema is not/);
  assert.throws(() => provenance({ ...good, fixture: "elsewhere.json" }), /fixture is not/);
  assert.throws(() => provenance({ ...good, sha256: "abc" }), /hex SHA-256/);
  assert.throws(
    () => provenance({ ...good, upstream: { ...good.upstream, commit: "5fc5859" } }),
    /full commit ID/,
  );
  assert.throws(
    () => provenance({ ...good, upstream: { ...good.upstream, repository: "git@host:repo" } }),
    /https URL/,
  );
  assert.throws(
    () => provenance({ ...good, upstream: { ...good.upstream, command: "" } }),
    /command is empty/,
  );
  assert.throws(() => record(fixture(), "HEAD"), /full 40-character/);
});

test("names lose the prefix and a trailing bg becomes a word", () => {
  assert.equal(camel("--pk-color-surface-canvas"), "surfaceCanvas");
  assert.equal(camel("--pk-color-status-okbg"), "statusOkBg");
  assert.equal(camel("--pk-color-focus"), "focus");
});

test("a document a phone cannot render from is refused by the name of what is wrong", () => {
  const good = doc() as { schema: string; themes: { mode: string; tokens: unknown[] }[] };
  assert.throws(() => render({ ...good, schema: "other" }), /schema is not/);
  const missingDark = { ...good, themes: good.themes.filter((t) => t.mode !== "dark") };
  assert.throws(() => render(missingDark), /no dark theme/);
  const short = structuredClone(good);
  short.themes[1]!.tokens = short.themes[1]!.tokens.filter(
    (t) => (t as { name: string }).name !== "--pk-color-focus",
  );
  assert.throws(() => render(short), /dark lacks --pk-color-focus/);
});

test("the generator refuses a fixture whose provenance was not refreshed with it", (t) => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "pk-mobile-tokens-test-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  for (const dir of ["testdata", "src/ui"])
    mkdirSync(path.join(temporary, dir), { recursive: true });
  const edited = fixture().replace("#0f5d4e", "#0f5d4f");
  writeFileSync(path.join(temporary, FIXTURE), edited);
  writeFileSync(path.join(temporary, SOURCE), readFileSync(SOURCE));
  const run = (...args: string[]) =>
    execFileSync(
      process.execPath,
      [
        "--import",
        createRequire(import.meta.url).resolve("tsx"),
        path.resolve("scripts/tokens.ts"),
        ...args,
      ],
      { cwd: temporary, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  assert.throws(
    () => run(),
    (e: unknown) =>
      e instanceof Error &&
      /is not the export .* describes/.test(String((e as { stderr?: string }).stderr)),
  );
  assert.equal(
    readFileSync(path.join(temporary, FIXTURE), "utf8"),
    edited,
    "a refused run writes nothing",
  );
  run("--upstream", "0123456789abcdef0123456789abcdef01234567");
  const written = provenance(JSON.parse(readFileSync(path.join(temporary, SOURCE), "utf8")));
  assert.equal(written.sha256, sha256(edited));
  assert.equal(written.upstream.commit, "0123456789abcdef0123456789abcdef01234567");
  assert.match(readFileSync(path.join(temporary, OUTPUT), "utf8"), /accentDefault: "#0f5d4f"/);
});

test("a consumer script named tokens.ts imports the generator without running its CLI", (t) => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "pk-mobile-tokens-test-"));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const script = path.join(temporary, "tokens.ts");
  const generator = pathToFileURL(path.resolve("scripts/tokens.ts")).href;
  writeFileSync(
    script,
    `import { render } from ${JSON.stringify(generator)};\nprocess.stdout.write(typeof render);\n`,
  );
  assert.equal(
    execFileSync(
      process.execPath,
      ["--import", createRequire(import.meta.url).resolve("tsx"), script],
      {
        cwd: temporary,
        encoding: "utf8",
      },
    ),
    "function",
  );
});
