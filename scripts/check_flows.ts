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

/** screenClaims reads what each flow says it proves: every `# screen: app/…` line in its header, in file order. */
export function screenClaims(root: string): Map<string, string[]> {
  const named = new Map<string, string[]>();
  const at = path.join(root, FLOWS);
  for (const f of readdirSync(at)
    .filter((n) => n.endsWith(".yaml"))
    .sort()) {
    const text = header(readFileSync(path.join(at, f), "utf8"));
    named.set(
      f,
      [...text.matchAll(CLAIM)].map((m) => m[1]!),
    );
  }
  return named;
}

export function checkFlows(root: string): string[] {
  const problems: string[] = [];
  const ids = knownIDs(root);
  const flowsAt = path.join(root, FLOWS);
  for (const f of readdirSync(flowsAt).filter((n) => n.endsWith(".yaml"))) {
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
  const problems = checkFlows(process.cwd());
  for (const p of problems) console.error(p);
  if (problems.length === 0)
    console.log(
      `${FLOWS}: every id is a testID a component sets and every route screen is named by a flow`,
    );
  process.exit(problems.length === 0 ? 0 : 1);
}
