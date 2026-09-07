// fingerprint.ts answers "does this change need a new binary?" as a reviewed
// diff rather than a guess. `npm run fingerprint` writes fingerprint.json: the
// hash of everything a binary is built from (the Expo config, the native
// modules in the lockfile, config plugins) and the sources that hash came from.
// `npm run check:fingerprint` recomputes it and fails when the committed file
// is stale, naming what changed, so a native change is visible in review and
// the workflow that builds binaries knows when to run. The CLI's own
// `fingerprint:diff` prints a difference and exits 0, which is why this is a
// script.
import {
  createFingerprintAsync,
  diffFingerprints,
  SourceSkips,
  type Fingerprint,
} from "@expo/fingerprint";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const FILE = "fingerprint.json";

// What the binary is not built from. android/ and ios/ are prebuild output and
// ignored by git here, so a developer who ran `expo run:android` must not get a
// different hash from CI; scripts/ holds build settings, not the native
// surface; the file itself would be circular.
const ignorePaths = [
  "android/**",
  "ios/**",
  "dist/**",
  ".expo/**",
  "e2e/**",
  "scripts/**",
  "**/fingerprint.json",
];

export function compute(root: string): Promise<Fingerprint> {
  // The fingerprint is the release identity at no particular version: a tag
  // changes the version and the build numbers, not what the binary is made
  // of, and a verification profile is the same native project under another
  // package.
  delete process.env.PK_VERSION;
  delete process.env.PK_PROFILE;
  return createFingerprintAsync(root, {
    ignorePaths,
    // npm scripts do not define the binary either.
    sourceSkips: SourceSkips.ExpoConfigVersions | SourceSkips.PackageJsonScriptsAll,
  });
}

export function render(fp: Fingerprint): string {
  return JSON.stringify(fp, null, 2) + "\n";
}

async function committed(root: string): Promise<Fingerprint | undefined> {
  try {
    return JSON.parse(await readFile(path.join(root, FILE), "utf8")) as Fingerprint;
  } catch {
    return undefined;
  }
}

/** describe is one changed source as a reviewer reads it. */
function describe(item: ReturnType<typeof diffFingerprints>[number]): string {
  const source =
    item.op === "removed"
      ? item.removedSource
      : item.op === "added"
        ? item.addedSource
        : item.afterSource;
  const where = "filePath" in source ? source.filePath : source.id;
  return `${item.op} ${source.type} ${where}`;
}

async function main(args: readonly string[]): Promise<number> {
  const root = process.cwd();
  const current = await compute(root);
  if (!args.includes("--check")) {
    await writeFile(path.join(root, FILE), render(current));
    console.log(`${FILE}: ${current.hash}`);
    return 0;
  }
  const known = await committed(root);
  if (known?.hash === current.hash) {
    console.log(`${FILE}: ${current.hash} is current`);
    return 0;
  }
  console.error(
    known
      ? `${FILE}: the native project changed (${known.hash} -> ${current.hash}); run npm run fingerprint and say why in the commit.`
      : `${FILE}: missing; run npm run fingerprint.`,
  );
  if (known)
    for (const item of diffFingerprints(known, current)) console.error("  " + describe(item));
  return 1;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(2);
  },
);
