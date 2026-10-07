// A parameterized title is a sentence this repository writes for a reader: it names the behavior a case
// checks, never the task number that caused it. The scan reads the test files a branch brings, which
// asks for the branch's base — by whichever name the checkout carries it, because a pull request
// checkout is detached at one commit and knows the base only as a remote-tracking ref. Where no base
// resolves, the scan takes every test file in the tree instead of none, so the shape of a checkout can
// never decide how much of the rule runs.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const TEST_FILE = /^tests\/.*\.(?:test|spec|case)\.[cm]?[jt]sx?$/;

function git(args: string[]): string | undefined {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return undefined; // this checkout cannot answer that question
  }
}

// The base a branch diverged from, as this checkout names it: a working clone has `main`, a pull
// request checkout has only `origin/main`. A name with no merge base against HEAD is no base, since
// the three-dot diff below could not have used it either.
function baseRef(): string | undefined {
  return ["main", "origin/main", "origin/HEAD"].find(
    (candidate) => git(["merge-base", candidate, "HEAD"]) !== undefined,
  );
}

function scannedTestFiles(): string[] {
  const base = baseRef();
  const changed =
    base === undefined
      ? undefined
      : git(["diff", "--name-only", "--diff-filter=AM", `${base}...HEAD`]);
  if (changed === undefined)
    return (readdirSync("tests", { recursive: true, encoding: "utf8" }) as string[])
      .map((file) => `tests/${file}`)
      .filter((file) => TEST_FILE.test(file));
  return changed
    .trim()
    .split("\n")
    .filter((file) => TEST_FILE.test(file));
}

function testRoot(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isCallExpression(expression) || ts.isPropertyAccessExpression(expression))
    return testRoot(expression.expression);
  return undefined;
}

test("parameterized test titles introduced by this branch name behavior rather than a task", () => {
  const files = scannedTestFiles();
  const taskNamed: string[] = [];
  for (const file of files) {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest);
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ["test", "it", "describe"].includes(testRoot(node.expression) ?? "")
      ) {
        const title = node.arguments[0];
        const text =
          title &&
          (ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title)
            ? title.text
            : ts.isTemplateExpression(title)
              ? title.head.text
              : undefined);
        if (text && /^T-?\d{4}\b/.test(text)) {
          const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
          taskNamed.push(`${file}:${line}: ${text}`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.deepEqual(taskNamed, [], taskNamed.join("\n"));
});
