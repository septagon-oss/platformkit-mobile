import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { FIXTURE, OUTPUT, camel, render } from "../scripts/tokens";

const doc = (): unknown => JSON.parse(readFileSync(FIXTURE, "utf8"));

test("the generated palette is what the fixture renders to", () => {
  assert.equal(
    readFileSync(OUTPUT, "utf8"),
    render(doc()),
    `${OUTPUT} is stale: run npm run tokens`,
  );
});

test("two roles read the values the public repository's design package sets", () => {
  const out = render(doc());
  assert.match(out, /accentDefault: "#0f5d4e"/);
  assert.match(out, /statusDangerBg: "#fbe5e2"/);
  // The dark canvas is not the light one, or there is no dark theme to speak of.
  const canvases = [...out.matchAll(/surfaceCanvas: ("[^"]+")/g)].map((m) => m[1]);
  assert.equal(canvases.length, 2);
  assert.notEqual(canvases[0], canvases[1]);
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
