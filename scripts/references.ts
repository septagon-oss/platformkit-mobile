// references.ts verifies the bar this kit is measured against. The reference
// screens live in a store the reviewer's tooling owns; Mobbin licences a
// screenshot to its subscriber, and this is public source, so what is committed
// here is design/references/refs.json — one row per screen, with the path it
// lives at in that store, its sha256 and its byte count — and no image byte.
// `npm run check:references` resolves each row under $PKIT999_REFS and refuses,
// naming the id and the path, when the file is missing or its bytes differ from
// what the manifest promises. It never downloads, never copies, never writes,
// and it is not part of `npm run check`: a person who cloned this repository
// has no reference store, and a bar nobody can look at must not turn a green
// build red — it says so on one line instead.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const MANIFEST = path.join("design", "references", "refs.json");
export const SOURCE_ROOT_ENV = "PKIT999_REFS";

export interface ReferenceEntry {
  readonly id: string;
  readonly component: string;
  readonly platform: string;
  /** source is relative to the reference store's root, which only the caller knows. */
  readonly source: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly mobbin_url: string;
  readonly app: string;
  readonly screen: string;
  readonly why: string;
  readonly ours: string;
}

export interface ReferenceManifest {
  readonly schema: string;
  readonly source_root_env: string;
  readonly note?: string;
  readonly entries: readonly ReferenceEntry[];
}

/** shapeIssues names every way a row fails to be a row, without touching the store. */
export function shapeIssues(manifest: ReferenceManifest): readonly string[] {
  const issues: string[] = [];
  if (manifest.schema !== "pkit-mobile-references/1")
    issues.push(`schema: unknown reference manifest "${manifest.schema}"`);
  const seen = new Set<string>();
  for (const entry of manifest.entries) {
    const at = entry.id || "(no id)";
    if (seen.has(entry.id)) issues.push(`${at}: id repeated`);
    seen.add(entry.id);
    if (!/^R\d+$/.test(entry.id)) issues.push(`${at}: id is not R<n>`);
    for (const field of [
      "component",
      "platform",
      "source",
      "mobbin_url",
      "app",
      "screen",
      "why",
      "ours",
    ] as const)
      if (!entry[field]?.trim()) issues.push(`${at}: ${field} is empty`);
    if (!/^[0-9a-f]{64}$/.test(entry.sha256)) issues.push(`${at}: sha256 is not 64 hex digits`);
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes <= 0)
      issues.push(`${at}: bytes is not a positive whole number`);
    if (path.isAbsolute(entry.source) || entry.source.startsWith(".."))
      issues.push(`${at}: source must sit inside the store, not escape it (${entry.source})`);
  }
  return issues;
}

/** verify reads each row's bytes from the store and compares them to the promise. */
export async function verify(
  manifest: ReferenceManifest,
  root: string,
): Promise<readonly string[]> {
  const issues: string[] = [];
  for (const entry of manifest.entries) {
    const file = path.join(root, entry.source);
    let bytes: Buffer;
    try {
      bytes = await readFile(file);
    } catch {
      issues.push(`${entry.id}: ${file} is not in the reference store`);
      continue;
    }
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== entry.sha256)
      issues.push(`${entry.id}: ${file} is ${digest}, not the manifest's ${entry.sha256}`);
    if (bytes.length !== entry.bytes)
      issues.push(
        `${entry.id}: ${file} is ${bytes.length} bytes, not the manifest's ${entry.bytes}`,
      );
  }
  return issues;
}

export async function main(argv: readonly string[]): Promise<number> {
  const checking = argv.includes("--check");
  const manifest = JSON.parse(await readFile(MANIFEST, "utf8")) as ReferenceManifest;
  const issues = [...shapeIssues(manifest)];
  if (manifest.source_root_env !== SOURCE_ROOT_ENV)
    issues.push(
      `source_root_env: ${manifest.source_root_env} — this script reads ${SOURCE_ROOT_ENV} and no other variable`,
    );
  const root = process.env.PKIT999_REFS;
  if (root) issues.push(...(await verify(manifest, root)));
  else if (checking)
    issues.push(
      `${manifest.source_root_env} is not set, so the ${manifest.entries.length} screens this kit is measured against cannot be looked at`,
    );
  if (issues.length > 0) {
    console.error(`references: refused\n${issues.map((i) => ` - ${i}`).join("\n")}`);
    return 1;
  }
  if (!checking) {
    console.log(`${MANIFEST}: ${manifest.entries.length} rows, shape checked only`);
    return 0;
  }
  console.log(`references: ${manifest.entries.length} verified under ${root}`);
  return 0;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e: unknown) => {
      console.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    },
  );
}
