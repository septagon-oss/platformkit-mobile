// references.ts verifies the bar this kit is measured against, and the record of
// what the kit draws against it. Each row is one chosen screen and one photograph:
//
//   the bar    — a Mobbin screen, named by id, app, screen name and URL, held at
//                `source` in the reviewer's reference store. Mobbin licences a
//                screenshot to its subscriber and this is public source, so no
//                third-party byte is committed here; `store_sha256` and
//                `store_bytes` say what the store's bytes are, and `verify` below
//                proves it still holds exactly those.
//   what we do — the kit's own screen for the same pattern, photographed at the
//                measure the review photographs at, committed beside this manifest
//                as `ours_file`. `sha256` and `bytes` vouch for *that* file, so
//                every row has bytes a person who cloned this repository can open.
//
// `npm run check:references` always checks the committed photographs — that half
// needs no store — and reads the store's half when `PKIT999_REFS` is set,
// refusing by naming the id and the path when a file is missing or its bytes
// differ from what the manifest promises. It never downloads, never writes, and
// it is not part of `npm run check`: a person who cloned this repository has no
// reference store, and a bar nobody can look at must not turn a build red — it
// says so on one line instead. Recapture the photographs with
// tests/references-capture.case.mjs, which refuses a page that no longer draws
// the specimen its row points at.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const MANIFEST = path.join("design", "references", "refs.json");
export const SOURCE_ROOT_ENV = "PKIT999_REFS";
export const SCHEMA = "pkit-mobile-references/2";

export interface ReferenceEntry {
  readonly id: string;
  readonly component: string;
  readonly platform: string;
  /** The bar, as Mobbin publishes it. */
  readonly mobbin_url: string;
  readonly app: string;
  readonly screen: string;
  /** source is relative to the reference store's root, which only the caller knows. */
  readonly source: string;
  /** sha256 and byte count of the store's bytes at `source`, not of anything committed. */
  readonly store_sha256: string;
  readonly store_bytes: number;
  /** Why this screen is the bar for the pattern. */
  readonly why: string;
  /** What the kit draws today against it, in prose. */
  readonly ours: string;
  /** ours_case names the kit's own specimen that prose describes, as the gallery's picker offers it. */
  readonly ours_case: string;
  /** ours_open says the specimen is a surface a person opens, so a photograph has to open it. */
  readonly ours_open?: true;
  /** ours_block narrows a row's picture to one block of that screen, named by the testID it sets. */
  readonly ours_block?: string;
  /** ours_file is the photograph committed under design/references, and sha256/bytes are its own. */
  readonly ours_file: string;
  readonly sha256: string;
  readonly bytes: number;
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
  if (manifest.schema !== SCHEMA)
    issues.push(`schema: unknown reference manifest "${manifest.schema}"`);
  const seen = new Set<string>();
  const seenFiles = new Set<string>();
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
      "ours_case",
      "ours_file",
    ] as const)
      if (!entry[field]?.trim()) issues.push(`${at}: ${field} is empty`);
    // The chosen screen's bytes live in the store; the kit's own bytes live here.
    for (const field of ["store_sha256", "sha256"] as const)
      if (!/^[0-9a-f]{64}$/.test(entry[field])) issues.push(`${at}: ${field} is not 64 hex digits`);
    for (const field of ["store_bytes", "bytes"] as const)
      if (!Number.isSafeInteger(entry[field]) || entry[field] <= 0)
        issues.push(`${at}: ${field} is not a positive whole number`);
    if (path.isAbsolute(entry.source) || entry.source.startsWith(".."))
      issues.push(`${at}: source must sit inside the store, not escape it (${entry.source})`);
    if (!entry.ours_case.includes("/"))
      issues.push(`${at}: ours_case names a kit specimen as family/state (${entry.ours_case})`);
    if (entry.ours_file !== path.basename(entry.ours_file) || !entry.ours_file.endsWith(".png"))
      issues.push(
        `${at}: ours_file is one png beside this manifest, not a path (${entry.ours_file})`,
      );
    if (seenFiles.has(entry.ours_file)) issues.push(`${at}: ours_file ${entry.ours_file} repeated`);
    seenFiles.add(entry.ours_file);
    if (entry.ours_open !== undefined && entry.ours_open !== true)
      issues.push(`${at}: ours_open is either true or absent`);
    if (entry.ours_block !== undefined && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(entry.ours_block))
      issues.push(`${at}: ours_block is one block name, no path (${entry.ours_block})`);
  }
  return issues;
}

/** verify reads the bar's bytes from the store and compares them to the promise. */
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
    if (digest !== entry.store_sha256)
      issues.push(`${entry.id}: ${file} is ${digest}, not the manifest's ${entry.store_sha256}`);
    if (bytes.length !== entry.store_bytes)
      issues.push(
        `${entry.id}: ${file} is ${bytes.length} bytes, not the manifest's ${entry.store_bytes}`,
      );
  }
  return issues;
}

/**
 * verifyLocal reads the kit's own photographs from design/references. Every row
 * promises a person who cloned this repository can see what the kit draws today;
 * that is only true while the committed bytes are the bytes the manifest names,
 * and it needs no reference store to check.
 */
export async function verifyLocal(
  manifest: ReferenceManifest,
  directory = path.dirname(MANIFEST),
): Promise<readonly string[]> {
  const issues: string[] = [];
  for (const entry of manifest.entries) {
    const file = path.join(directory, entry.ours_file);
    let bytes: Buffer;
    try {
      bytes = await readFile(file);
    } catch {
      issues.push(`${entry.id}: ${file} is not committed beside the manifest`);
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

export async function readManifest(file = MANIFEST): Promise<ReferenceManifest> {
  return JSON.parse(await readFile(file, "utf8")) as ReferenceManifest;
}

export async function main(argv: readonly string[]): Promise<number> {
  const checking = argv.includes("--check");
  const manifest = await readManifest();
  const issues = [...shapeIssues(manifest)];
  if (manifest.source_root_env !== SOURCE_ROOT_ENV)
    issues.push(
      `source_root_env: ${manifest.source_root_env} — this script reads ${SOURCE_ROOT_ENV} and no other variable`,
    );
  issues.push(...(await verifyLocal(manifest)));
  const root = process.env.PKIT999_REFS;
  if (root) issues.push(...(await verify(manifest, root)));
  if (issues.length > 0) {
    console.error(`references: refused\n${issues.map((i) => ` - ${i}`).join("\n")}`);
    return 1;
  }
  const photographs = manifest.entries.length;
  if (!root)
    console.log(
      `references: ${photographs} photographs committed, ${manifest.entries.length} bars named; ` +
        `${manifest.source_root_env} is not set, so the bar's own bytes were not looked at`,
    );
  else console.log(`references: ${manifest.entries.length} bars verified under ${root}`);
  if (!checking && !root) console.log(`${MANIFEST}: shape and committed photographs checked`);
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
