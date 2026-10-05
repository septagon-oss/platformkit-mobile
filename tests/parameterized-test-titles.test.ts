import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

function testRoot(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isCallExpression(expression) || ts.isPropertyAccessExpression(expression))
    return testRoot(expression.expression);
  return undefined;
}

test("parameterized test titles introduced by this branch name behavior rather than a task", () => {
  const files = execFileSync("git", ["diff", "--name-only", "--diff-filter=AM", "main...HEAD"], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((file) => /^tests\/.*\.(?:test|spec|case)\.[cm]?[jt]sx?$/.test(file));
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
