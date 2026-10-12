// publish.ts answers "may this tree be published, and under what name?" before
// anything is written to the registry. The registry keeps what it is given: a
// published version is never overwritten, so every refusal has to come before
// the one write and a refused run has to leave nothing behind. The (name,
// version) pair is the whole idempotency key — no receipt, no counter — and the
// tag `kit-v<version>` is the only thing that says which version a run is about.
//
// Three agreements are checked here, and nothing else: the manifest names a
// package the registry can hold (a scoped name, a semver version, nothing that
// says private), the changelog carries the entry that version's release is
// documented by and states the catalogue version that release renders, and the
// tag names exactly that version. `npm run check:publish` runs the first two on
// every check, so a version bump with no entry behind it is refused on the
// commit that bumped it, not on the day a tag is pushed. The tag arrives only
// with the publish run (.gitea/workflows/publish.yml), which is why it is an
// argument and not a guess: nothing here reads a Git ref, so the same command
// answers outside a checkout.
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { SUPPORTED_CATALOG_VERSION } from "../src/core/catalog";

export const CHANGELOG = "CHANGELOG.md";

// The tag namespace a publish is cut from. release.yml owns `v*`, which builds
// a binary and publishes nothing; Gitea anchors a ref glob, so neither glob can
// match the other's tags and one release may need one tag or both.
export const TAG_PREFIX = "kit-v";

// The grammar scripts/source.ts requires of every dependency's version, asked
// of this package's own: the registry's answer is an exact version too.
const VERSION = /^\d+\.\d+\.\d+$/;

// A version carrying a suffix: `-rc.1`, which npm publishes under a dist-tag of
// its own and refuses without one, or `+build.7`, which is build metadata. This
// release publishes the version a consumer pins and names no other tag, so such a
// version is refused where that can be said, rather than by npm after the pack.
const SUFFIXED = /^\d+\.\d+\.\d+[-+][\w.+-]+$/;

export interface Manifest {
  name?: unknown;
  version?: unknown;
  files?: unknown;
  private?: unknown;
  publishConfig?: unknown;
}

/**
 * publishable refuses a manifest the registry could not answer for.
 *
 * `private` is refused here and not by npm: `npm publish --dry-run` on npm
 * 12.2.0 exits 0 with `"private": true` still in the file, so the one gate that
 * notices is this one. A name with no scope is refused because the scope is what
 * binds a package to the organisation whose token publishes it — an unscoped
 * name lands wherever the job's registry points. A prerelease is refused for the
 * same reason npm would refuse it later, in a sentence that names the version.
 * And the changelog has to be in `files`, because npm adds only package.json,
 * README.md and LICENSE to an archive on its own: named there or not, the entry a
 * version documents itself by travels with it or not.
 */
export function publishable(manifest: Manifest): void {
  if ("private" in manifest)
    throw new Error(
      "package.json: private is set; a private package publishes no version, and npm's dry run will not tell you",
    );
  const name = manifest.name;
  if (typeof name !== "string" || !/^@[^/]+\/[^/]+$/.test(name))
    throw new Error(
      `package.json: ${JSON.stringify(name)} is not a scoped name; the scope is what binds the kit to the organisation that publishes it`,
    );
  const version = manifest.version;
  if (typeof version === "string" && SUFFIXED.test(version))
    throw new Error(
      `package.json: ${version} carries a prerelease or build suffix; npm publishes such a version under another dist-tag, and this release names no other`,
    );
  if (typeof version !== "string" || !VERSION.test(version))
    throw new Error(`package.json: ${JSON.stringify(version)} is not an exact version`);
  const files = manifest.files;
  if (!Array.isArray(files) || !files.includes(CHANGELOG))
    throw new Error(
      `${CHANGELOG}: the release entry has to travel with the package; add it to files`,
    );
}

/**
 * changelogEntry returns the section documenting `version`, or refuses.
 *
 * A heading matches only itself — `## 0.2.10` is no answer for 0.2.1 — and the
 * section has to name the catalogue version, because that number is what a
 * client reads to know whether this release renders the document shape its
 * server sends. `src/core/catalog.ts` owns that number; nothing here restates it.
 *
 * One section is read, the one for the version being published, because that is
 * the claim this write makes about the tree it comes from. An older section
 * describes a release this tree cannot vouch for: `## 0.1.0` states no catalogue
 * version, having never been published, and no guard is owed over it.
 */
export function changelogEntry(changelog: string, version: string, catalogVersion: number): void {
  const heading = `## ${version}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const start = changelog.search(new RegExp(`^${heading}( .*)?$`, "m"));
  if (start < 0)
    throw new Error(`${CHANGELOG}: no entry for ${version}; a release documents itself here`);
  const body = changelog.slice(start).split("\n## ")[0]!;
  const stated = body.match(/^[-*]?\s*catalogVersion:\s*(\d+)\s*$/m);
  if (!stated)
    throw new Error(
      `${CHANGELOG}: the ${version} entry states no catalogVersion, so it says nothing about what this release renders`,
    );
  if (Number(stated[1]) !== catalogVersion)
    throw new Error(
      `${CHANGELOG}: the ${version} entry states catalogVersion ${stated[1]}; this build renders ${catalogVersion}`,
    );
}

/** tagNamesVersion refuses a ref that is not the tag this version is released by. */
export function tagNamesVersion(tag: string, version: string): void {
  if (!tag.startsWith(TAG_PREFIX))
    throw new Error(
      `${tag}: a publish is cut from a ${TAG_PREFIX}* tag; the v* namespace belongs to release.yml, which builds a binary and publishes nothing`,
    );
  if (tag !== `${TAG_PREFIX}${version}`)
    throw new Error(
      `${tag}: the tag names ${tag.slice(TAG_PREFIX.length)}, package.json names ${version}`,
    );
}

/**
 * checkPublish reads the tree and answers for it, refusing with the first thing
 * wrong. The optional tag is the ref the publish run was cut from.
 */
export function checkPublish(root: string, tag?: string): string {
  const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as Manifest;
  publishable(manifest);
  const name = manifest.name as string;
  const version = manifest.version as string;
  changelogEntry(
    readFileSync(path.join(root, CHANGELOG), "utf8"),
    version,
    SUPPORTED_CATALOG_VERSION,
  );
  if (tag !== undefined) tagNamesVersion(tag, version);
  const where = tag === undefined ? "the manifest" : `the tag ${tag}`;
  return `${name}@${version} is publishable from ${where}; ${CHANGELOG} states it renders catalogVersion ${SUPPORTED_CATALOG_VERSION}`;
}

if (process.argv[1]?.endsWith("publish.ts")) {
  try {
    const { values } = parseArgs({
      options: { check: { type: "boolean", default: false }, tag: { type: "string" } },
    });
    if (!values.check)
      throw new Error(
        "Usage: npm run check:publish, or node --import tsx scripts/publish.ts --check [--tag kit-v<version>]",
      );
    if (values.tag === "") throw new Error("--tag names a tag or names nothing");
    console.log(checkPublish(process.cwd(), values.tag));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
