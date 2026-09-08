// Export a committed application without relying on its checkout. The receipt
// records source provenance; running the included checks is a separate step.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, lstatSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual, parseArgs } from "node:util";

const RECEIPT = "SOURCE.json";
const AUTOMATION = new Set([".github", ".gitea"]);
const GENERATED = new Set([".git", "node_modules", ".expo", "android", "ios", "dist", "out"]);
const GROUPS = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"];
type Document = Record<string, unknown>;

function object(value: unknown, at: string): Document {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${at}: expected an object`);
  return value as Document;
}

const hash = (data: Buffer): string => createHash("sha256").update(data).digest("hex");

function git(root: string, ...args: string[]): Buffer {
  return execFileSync("git", ["-C", root, ...args], { maxBuffer: 64 * 1024 * 1024 });
}

function lockedDependencies(pkg: Document, lock: Document): void {
  if (lock.lockfileVersion !== 3) throw new Error("package-lock.json: expected lockfileVersion 3");
  if (pkg.workspaces) throw new Error("package.json: workspaces require a separate checkout");
  const packages = object(lock.packages, "package-lock.json packages");
  const root = object(packages[""], "package-lock.json root");
  for (const key of ["name", "version", ...GROUPS]) {
    if (!isDeepStrictEqual(pkg[key], root[key]))
      throw new Error(`package-lock.json: ${key} differs from package.json; run npm install`);
  }
  for (const group of GROUPS) {
    for (const [name, spec] of Object.entries(object(pkg[group] ?? {}, group))) {
      if (
        typeof spec !== "string" ||
        /^(file:|link:|workspace:|\.|\/|~\/|[A-Za-z]:[\\/])/.test(spec)
      )
        throw new Error(`${name}: dependency must resolve from the registry, not a local path`);
      if (!packages[`node_modules/${name}`] && group !== "peerDependencies")
        throw new Error(`${name}: missing from package-lock.json`);
    }
  }
  for (const [name, value] of Object.entries(packages)) {
    if (name === "") continue;
    const dep = object(value, name);
    if (!name.startsWith("node_modules/") || dep.link)
      throw new Error(`${name}: linked or workspace package is not self-contained`);
    if (typeof dep.version !== "string" || !/^\d+\.\d+\.\d+(?:[-+][\w.+-]+)?$/.test(dep.version))
      throw new Error(`${name}: missing exact package version`);
    if (typeof dep.resolved !== "string" || !/^https:\/\//.test(dep.resolved))
      throw new Error(`${name}: expected a published HTTPS package URL`);
    const url = new URL(dep.resolved);
    if (url.username || url.password) throw new Error(`${name}: package URL contains credentials`);
    if (typeof dep.integrity !== "string" || !/^sha512-[A-Za-z0-9+/]{86}==$/.test(dep.integrity))
      throw new Error(`${name}: missing SHA-512 package integrity`);
  }
}

interface SourceFile {
  readonly path: string;
  readonly mode: number;
  readonly data: Buffer;
}

function committedFiles(root: string, revision: string): SourceFile[] {
  return git(root, "ls-tree", "-rz", "--full-tree", revision)
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .flatMap((entry): SourceFile[] => {
      const tab = entry.indexOf("\t");
      const [mode, type, oid] = entry.slice(0, tab).split(" ");
      const name = entry.slice(tab + 1);
      const parts = name.split("/");
      if (AUTOMATION.has(parts[0]!)) return [];
      if (
        GENERATED.has(parts[0]!) ||
        name.startsWith("e2e/out/") ||
        parts.some((p) => !p || p === ".." || p === ".git" || p === "node_modules") ||
        name.includes("\\")
      )
        throw new Error(`${name}: generated or unsafe source path`);
      if (parts.some((p) => p.startsWith(".env") || p === ".npmrc") || name === RECEIPT)
        throw new Error(`${name}: local configuration or reserved receipt path`);
      if (type !== "blob" || (mode !== "100644" && mode !== "100755"))
        throw new Error(`${name}: symlinks and submodules cannot be delivered as source`);
      return [
        {
          path: name,
          mode: mode === "100755" ? 0o755 : 0o644,
          data: git(root, "cat-file", "blob", oid!),
        },
      ];
    });
}

/** Export only the named commit, even when tracked or untracked working files differ. */
export function exportSource(root: string, revision: string, output: string): string {
  root = realpathSync(root);
  if (git(root, "rev-parse", "--show-toplevel").toString().trim() !== root)
    throw new Error("Run the exporter from the repository root");
  if (!/^[0-9a-f]{40}$/.test(revision))
    throw new Error("revision must be a full 40-character commit ID");
  if (git(root, "rev-parse", "--verify", `${revision}^{commit}`).toString().trim() !== revision)
    throw new Error("revision must identify a commit, not a tag object");
  const destination = path.resolve(output);
  const parent = realpathSync(path.dirname(destination));
  if (parent === root || parent.startsWith(root + path.sep))
    throw new Error("Export outside the source repository");
  const target = path.join(parent, path.basename(destination));
  if (lstatSync(target, { throwIfNoEntry: false }))
    throw new Error(`Output already exists: ${target}`);

  const files = committedFiles(root, revision);
  const readJSON = (name: string): Document => {
    const file = files.find((f) => f.path === name);
    if (!file) throw new Error(`${name}: missing from committed source`);
    return object(JSON.parse(file.data.toString("utf8")), name);
  };
  const pkg = readJSON("package.json");
  lockedDependencies(pkg, readJSON("package-lock.json"));
  const receipt =
    JSON.stringify(
      {
        schema: "platformkit.mobile-source.v1",
        source: { name: pkg.name, version: pkg.version, revision },
        excluded: [...AUTOMATION],
        files: files.map((f) => ({
          path: f.path,
          mode: f.mode.toString(8),
          bytes: f.data.length,
          sha256: hash(f.data),
        })),
      },
      null,
      2,
    ) + "\n";

  mkdirSync(target);
  try {
    for (const file of files) {
      const dest = path.join(target, file.path);
      mkdirSync(path.dirname(dest), { recursive: true });
      writeFileSync(dest, file.data, { flag: "wx", mode: file.mode });
      chmodSync(dest, file.mode);
    }
    writeFileSync(path.join(target, RECEIPT), receipt, { flag: "wx" });
  } catch (error) {
    rmSync(target, { recursive: true, force: true });
    throw error;
  }
  return `${target}: ${files.length} files from ${revision}; ${RECEIPT} records their SHA-256 hashes`;
}

if (process.argv[1]?.endsWith("source.ts")) {
  try {
    const { values } = parseArgs({
      options: { revision: { type: "string" }, output: { type: "string" } },
    });
    if (!values.revision || !values.output)
      throw new Error(
        "Usage: npm run source -- --revision <full-commit-id> --output /tmp/mobile-source",
      );
    console.log(exportSource(process.cwd(), values.revision, values.output));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
