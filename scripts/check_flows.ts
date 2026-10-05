// check_flows.ts is what CI can prove about the device flows without a
// device: each flow names the verification profile's package, every element it
// looks up by id is a testID some component actually sets, and every route
// screen is named by the flow that proves it. What it cannot prove is that the
// flows pass; that is `make e2e-android` on a machine with an emulator, and the
// README says so.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const FLOWS = "e2e/flows";
const APP = "app";
const SOURCES = ["src", "app"];
const APP_ID = "dev.septagon.platformkit.ci";
/** A flow names its screens in its own header comment, one path per line. */
const CLAIM = /^# screen: (app\/\S+)$/gm;
/** STEPS is the divider a Maestro flow puts between its configuration and its journey. */
const STEPS = /^---\s*$/;
/**
 * FLOW_FILE is the extension test Maestro's own directory walk uses
 * (maestro.orchestra.workspace.FiltersKt.isFlowFile): a journey with the other
 * spelling is run by Maestro and invisible to a gate that reads `.yaml` only.
 */
const FLOW_FILE = /\.ya?ml$/;
/** workspaceConfig is the file Maestro reads as the workspace's configuration rather than as a journey. */
const WORKSPACE_CONFIG = new Set(["config.yaml", "config.yml"]);
/**
 * READABLE are the fields of Maestro's own workspace configuration
 * (maestro.orchestra.model.MaestroWorkspaceConfig) this gate can apply: a
 * label, and the two path filters it can match against a set of file names.
 * `tags` is deliberately absent — a tag lives in each flow's own header, so a
 * tag filter is answered by reading every flow as Maestro would, and a gate that
 * pretended otherwise would count coverage on journeys it never planned. So the
 * one rule below refuses any field it cannot apply, by its name.
 */
const READABLE = new Set(["name", "flows", "excludeFlows"]);
/** The two fields the plan is built from. */
const FILTERS = ["flows", "excludeFlows"] as const;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? files(path.join(dir, d.name)) : [path.join(dir, d.name)],
  );
}

/** knownIDs are the testIDs the source sets: literal ones whole, templated ones by their prefix. */
function knownIDs(root: string): {
  readonly whole: Set<string>;
  readonly prefixes: string[];
} {
  const whole = new Set<string>();
  const prefixes: string[] = [];
  for (const dir of SOURCES) {
    const at = path.join(root, dir);
    // A source root that is not there sets no id; the fixture tree a test
    // builds holds only what the rule it is proving needs.
    if (!existsSync(at)) continue;
    for (const f of files(at)) {
      if (!/\.tsx?$/.test(f)) continue;
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/testID="([^"]+)"/g)) whole.add(m[1]!);
      for (const m of src.matchAll(/testID=\{`([^`$]*)\$\{/g)) prefixes.push(m[1]!);
    }
  }
  return { whole, prefixes };
}

/**
 * routeFiles are the screens a journey can be about: every route file under
 * app/. A layout is exempt because it draws no screen of its own — it composes
 * the navigators and names the modal headers, and the screen it draws belongs
 * to the child route's claim.
 */
export function routeFiles(root: string): string[] {
  const at = path.join(root, APP);
  if (!existsSync(at)) return [];
  return files(at)
    .filter((f) => f.endsWith(".tsx") && path.basename(f) !== "_layout.tsx")
    .map((f) => path.relative(root, f).split(path.sep).join("/"))
    .sort();
}

/**
 * header is the text above that divider: a flow's comments and its
 * configuration. The claim is read from here and nowhere else, because a
 * `# screen:` line written among the steps is a remark about one step — and a
 * screen covered by a remark is a screen no journey ever reaches.
 */
function header(text: string): string {
  const lines = text.split(/\r?\n/);
  const steps = lines.findIndex((line) => STEPS.test(line));
  return (steps < 0 ? lines : lines.slice(0, steps)).join("\n");
}

/**
 * flowFiles are the journeys a `maestro test e2e/flows` run will execute, as
 * paths under e2e/flows: every yaml file at either spelling in that directory
 * itself — the workspace's own configuration aside — narrowed by what that
 * configuration says to run. One directory, because that is what Maestro plans:
 * its workspace planner keeps what the `flows:` glob matches, and the default
 * glob is `*` — a name in the workspace, not a path below it (measured against
 * maestro-cli-2.8.0: planned with no configuration file, a workspace holding
 * home.yaml, extra.yml and nested/deep.yaml yields the first two).
 *
 * The narrowing matters as much as the walk. `maestro test e2e/flows` reads
 * `config.yaml` from that directory whether or not anyone told it to, so a
 * workspace that names a subset runs a subset — and a gate that counted the
 * files beside it would report a screen covered by a journey no run takes.
 * The set here is what the coverage rule counts and what the CI job hands to
 * `maestro check-syntax`, so the runner, the gate and the job read one list — a
 * flow outside it is a journey no rule answers for, which is why a folder that
 * holds one is refused below.
 */
export function flowFiles(root: string): string[] {
  return workspacePlan(root).files;
}

/**
 * workspacePlan applies the flow directory's own configuration the way
 * Maestro's planner does, and says what it could not apply. A selection it
 * cannot read is a refusal, never an empty plan: a gate that guessed would
 * count coverage on a set of journeys it does not know it is not running.
 */
export function workspacePlan(root: string): { files: string[]; problems: string[] } {
  const all = journeys(root);
  const at = path.join(root, FLOWS);
  const named = [...WORKSPACE_CONFIG].filter((c) => existsSync(path.join(at, c)));
  if (named.length === 0) return { files: all, problems: [] };
  if (named.length > 1)
    return {
      files: all,
      problems: [
        `${named[0]}: ${named.join(" and ")} both configure this workspace, and which one Maestro reads is not a guess this gate gets to make`,
      ],
    };
  const config = named[0]!;
  const text = readFileSync(path.join(at, config), "utf8");
  const problems: string[] = [];
  for (const field of fields(text))
    if (!READABLE.has(field))
      problems.push(
        `${config}: ${field} is no workspace field this gate can read, so it cannot name the journeys Maestro plans`,
      );
  let files = all;
  for (const field of FILTERS) {
    const list = filterList(text, field);
    if (list.problem) problems.push(`${config}: ${list.problem}`);
    if (!list.entries) continue;
    for (const entry of list.entries)
      if (!all.some((f) => matches(entry, f)))
        problems.push(`${config}: ${field} names ${entry}, which is no journey in ${FLOWS}`);
    files =
      field === "flows"
        ? files.filter((f) => list.entries!.some((e) => matches(e, f)))
        : files.filter((f) => !list.entries!.some((e) => matches(e, f)));
  }
  return { files, problems };
}

/** journeys are the yaml files in the flow directory itself, configuration aside, before any selection narrows them. */
function journeys(root: string): string[] {
  const at = path.join(root, FLOWS);
  if (!existsSync(at)) return [];
  return readdirSync(at, { withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => d.name)
    .filter((f) => FLOW_FILE.test(f) && !WORKSPACE_CONFIG.has(f))
    .sort();
}

/** fields are the configuration's top-level keys: a word at column zero followed by a colon. */
function fields(text: string): string[] {
  return [...text.matchAll(/^([A-Za-z][\w-]*):/gm)].map((m) => m[1]!);
}

/**
 * filterList reads one of the two path filters: a block list of `- name` lines
 * or the flow form `[name, name]`, each entry optionally quoted. Anything else
 * after the key — a scalar, a nested map, an entry that is not an entry — is
 * said back as the problem, because a filter the gate cannot read is a filter it
 * cannot apply, and a plan built without it is a plan nobody runs.
 */
function filterList(text: string, field: string): { entries?: string[]; problem?: string } {
  const lines = text.split(/\r?\n/);
  const at = lines.findIndex((line) => line.startsWith(`${field}:`));
  if (at < 0) return {};
  const rest = lines[at]!.slice(field.length + 1).trim();
  if (rest.startsWith("[") && rest.endsWith("]") && !rest.slice(1, -1).includes("["))
    return { entries: split(rest.slice(1, -1)) };
  if (rest !== "" && !rest.startsWith("#"))
    return { problem: `${field} is no list this gate can read: ${rest}` };
  const entries: string[] = [];
  for (const line of lines.slice(at + 1)) {
    if (/^\s*(#.*)?$/.test(line)) continue;
    const item = /^\s+-\s+(.*\S)(?:\s+#.*)?$/.exec(line);
    // The list ends where the next field begins; anything else in its place is a
    // shape the gate will not guess at.
    if (!item)
      return /^[A-Za-z]/.test(line)
        ? { entries }
        : { problem: `${field} holds "${line.trim()}", which is no list entry` };
    entries.push(item[1]!.replace(/^["']|['"]$/g, ""));
  }
  return { entries };
}

/** split reads the entries of `[a, b]`, quoted or not, and drops the blanks. */
function split(list: string): string[] {
  return list
    .split(",")
    .map((e) => e.trim().replace(/^["']|['"]$/g, ""))
    .filter((e) => e !== "");
}

/**
 * matches answers whether one filter entry takes a journey: a plain name by
 * equality, a glob with `*` and `?` stopping at a `/` and `**` crossing one —
 * the shapes a path filter spells, and the reason a nested entry is worth
 * spelling: it matches nothing here, because this gate walks one directory, so
 * the entry that names it is refused above as naming no journey.
 */
function matches(entry: string, file: string): boolean {
  if (!/[*?]/.test(entry)) return entry === file;
  let source = "";
  for (let i = 0; i < entry.length; i += 1) {
    const c = entry[i]!;
    if (c === "*") {
      const across = entry[i + 1] === "*";
      if (across) i += 1;
      source += across ? ".*" : "[^/]*";
    } else if (c === "?") source += "[^/]";
    else source += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${source}$`).test(file);
}

/**
 * flowFolders are the folders under e2e/flows that hold a journey, each named
 * with a trailing slash. A journey one folder down is planned by no run this
 * repository configures: its steps never execute, so the screens it claims are
 * screens no device journey reaches. Counting it would make the coverage number a
 * promise about a file nobody runs, and refusing an empty folder would name a
 * journey that is not there, so the gate refuses the folder exactly when a flow
 * file sits inside it.
 */
function flowFolders(root: string): string[] {
  const at = path.join(root, FLOWS);
  if (!existsSync(at)) return [];
  const held = (f: string): boolean =>
    files(path.join(at, f)).some((nested) => {
      const name = path.basename(nested);
      return FLOW_FILE.test(name) && !WORKSPACE_CONFIG.has(name);
    });
  return readdirSync(at, { withFileTypes: true })
    .filter((d) => d.isDirectory() && held(d.name))
    .map((d) => `${d.name}/`)
    .sort();
}

/** screenClaims reads what each flow says it proves: every `# screen: app/…` line in its header, in file order. */
export function screenClaims(root: string): Map<string, string[]> {
  const named = new Map<string, string[]>();
  const at = path.join(root, FLOWS);
  for (const f of flowFiles(root)) {
    const text = header(readFileSync(path.join(at, f), "utf8"));
    named.set(
      f,
      [...text.matchAll(CLAIM)].map((m) => m[1]!),
    );
  }
  return named;
}

export function checkFlows(root: string): string[] {
  const ids = knownIDs(root);
  const flowsAt = path.join(root, FLOWS);
  // First what the workspace itself says to run: a selection the gate cannot
  // read makes every count below a count of the wrong set.
  const plan = workspacePlan(root);
  const problems: string[] = [...plan.problems];
  // Then the shape of the directory: a folder in it is where journeys go to be
  // skipped, and every count below would otherwise include what they claim.
  for (const dir of flowFolders(root))
    problems.push(
      `${dir}: a journey in a folder is one Maestro never plans — its default workspace glob is * — so what sits here runs nowhere`,
    );
  for (const f of plan.files) {
    const text = readFileSync(path.join(flowsAt, f), "utf8");
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
  // The set of journeys is only complete if a flow says which screen it is
  // about: a journey nobody can attribute is invisible to the coverage the
  // mobile pillar counts, so the rule reads both ways.
  const claims = screenClaims(root);
  const routes = new Set(routeFiles(root));
  const named = new Set<string>([...claims.values()].flat());
  for (const route of routes)
    if (!named.has(route)) problems.push(`${route}: no device flow names it`);
  for (const [flow, screens] of claims) {
    if (screens.length === 0) problems.push(`${flow}: names no screen`);
    for (const screen of screens)
      if (!routes.has(screen)) problems.push(`${flow}: no route screen ${screen}`);
  }
  return problems;
}

if (process.argv[1]?.endsWith("check_flows.ts")) {
  // --list answers with the journeys a directory run would take, one path per
  // line, so the CI job that checks each file's syntax walks the same set.
  if (process.argv[2] === "--list") {
    for (const f of flowFiles(process.cwd())) console.log(`${FLOWS}/${f}`);
    process.exit(0);
  }
  const problems = checkFlows(process.cwd());
  for (const p of problems) console.error(p);
  if (problems.length === 0)
    console.log(
      `${FLOWS}: every id is a testID a component sets and every route screen is named by a flow`,
    );
  process.exit(problems.length === 0 ? 0 : 1);
}
