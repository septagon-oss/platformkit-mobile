// parity.ts keeps tests/parity honest about where it came from. The fixtures are the kernel's own
// reviewed cases (ui/screens/testdata/parity), copied byte for byte; the phone's rendering is held
// against them, so a copy edited to make a test pass must fail here.
//
//   check  (offline, run by `npm run check`) each file hashes to what tests/parity/parity.source.json
//          records, and each fixture's own inputHash and expectedHash are the ones its input and
//          expected members compute to under the kernel's rule (parity/README.md): sha256 of the
//          compact JSON, keys sorted, HTML escaping off.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const DIRECTORY = "tests/parity";
export const SOURCE = `${DIRECTORY}/parity.source.json`;
const SOURCE_SCHEMA = "platformkit.parity-source.v1";

const sha256 = (data: string | Buffer): string => createHash("sha256").update(data).digest("hex");

/**
 * canonical is the compact JSON the kernel hashes: object keys sorted, no whitespace, no HTML escaping.
 * A number that is not a whole number is refused rather than guessed, since JavaScript and Go print
 * fractions and exponents differently and no fixture holds one.
 */
export function canonical(value: unknown): string {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error(`parity: ${value} is not a whole number`);
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object") {
    const members = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`);
    return `{${members.join(",")}}`;
  }
  throw new Error(`parity: cannot hash a ${typeof value}`);
}

/** hashOf is a fixture member as the fixture's provenance writes it: `sha256:<hex>`. */
export const hashOf = (member: unknown): string => `sha256:${sha256(canonical(member))}`;

interface Source {
  readonly schema: string;
  readonly upstream: {
    readonly repository: string;
    readonly commit: string;
    readonly path: string;
    readonly command: string;
  };
  readonly files: Readonly<Record<string, string>>;
}

/** checkParity answers the refusals; an empty list means every copy is the kernel's. */
export function checkParity(root: string): string[] {
  const problems: string[] = [];
  const source = JSON.parse(readFileSync(join(root, SOURCE), "utf8")) as Source;
  const up = source.upstream;
  if (source.schema !== SOURCE_SCHEMA) problems.push(`${SOURCE}: schema is not ${SOURCE_SCHEMA}`);
  if (!/^[0-9a-f]{40}$/.test(up?.commit ?? "") || !up.command.includes(up.commit))
    problems.push(`${SOURCE}: upstream.commit is not a full commit ID the command names`);
  const names = readdirSync(join(root, DIRECTORY)).filter((n) => n !== "parity.source.json");
  for (const name of names)
    if (source.files[name] === undefined) problems.push(`${DIRECTORY}/${name}: not in ${SOURCE}`);
  for (const [name, want] of Object.entries(source.files)) {
    let bytes: Buffer;
    try {
      bytes = readFileSync(join(root, DIRECTORY, name));
    } catch {
      problems.push(`${DIRECTORY}/${name}: recorded in ${SOURCE} but missing`);
      continue;
    }
    if (sha256(bytes) !== want)
      problems.push(`${DIRECTORY}/${name}: bytes differ from the kernel's copy`);
    if (!name.endsWith(".json")) continue;
    const fixture = JSON.parse(bytes.toString("utf8")) as {
      provenance: { inputHash: string; expectedHash: string };
      input: unknown;
      expected: unknown;
    };
    if (fixture.provenance.inputHash !== hashOf(fixture.input))
      problems.push(`${DIRECTORY}/${name}: inputHash is not the hash of its input`);
    if (fixture.provenance.expectedHash !== hashOf(fixture.expected))
      problems.push(`${DIRECTORY}/${name}: expectedHash is not the hash of its expected`);
  }
  return problems;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const problems = checkParity(process.cwd());
  for (const p of problems) console.error(p);
  if (problems.length > 0) process.exit(1);
  console.log(`${DIRECTORY}: every fixture is the kernel's copy and its hashes hold`);
}
