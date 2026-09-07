// check_flows.ts is what CI can prove about the device flows without a
// device: each flow names the verification profile's package, and every
// element it looks up by id is a testID some component actually sets. What it
// cannot prove is that the flows pass; that is `make e2e-android` on a
// machine with an emulator, and the README says so.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const FLOWS = "e2e/flows";
const SOURCES = ["src", "app"];
const APP_ID = "dev.septagon.platformkit.ci";

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? files(path.join(dir, d.name)) : [path.join(dir, d.name)],
  );
}

/** knownIDs are the testIDs the source sets: literal ones whole, templated ones by their prefix. */
function knownIDs(): { readonly whole: Set<string>; readonly prefixes: string[] } {
  const whole = new Set<string>();
  const prefixes: string[] = [];
  for (const dir of SOURCES) {
    for (const f of files(dir)) {
      if (!/\.tsx?$/.test(f)) continue;
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/testID="([^"]+)"/g)) whole.add(m[1]!);
      for (const m of src.matchAll(/testID=\{`([^`$]*)\$\{/g)) prefixes.push(m[1]!);
    }
  }
  return { whole, prefixes };
}

function check(): string[] {
  const problems: string[] = [];
  const ids = knownIDs();
  for (const f of readdirSync(FLOWS).filter((n) => n.endsWith(".yaml"))) {
    const text = readFileSync(path.join(FLOWS, f), "utf8");
    if (!new RegExp(`^\\s*APP_ID: ${APP_ID.replace(/\./g, "\\.")}$`, "m").test(text))
      problems.push(`${f}: does not name ${APP_ID} as APP_ID`);
    for (const m of text.matchAll(/^\s*id: "([^"]+)"$/gm)) {
      const id = m[1]!;
      const dynamic = id.indexOf("${");
      const ok =
        dynamic < 0 ? ids.whole.has(id) : ids.prefixes.some((p) => p === id.slice(0, dynamic));
      if (!ok) problems.push(`${f}: no component sets testID ${id}`);
    }
  }
  return problems;
}

const problems = check();
for (const p of problems) console.error(p);
if (problems.length === 0) console.log(`${FLOWS}: every id is a testID a component sets`);
process.exit(problems.length === 0 ? 0 : 1);
