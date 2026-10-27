// A sentence a person reads is a key in the copy table, so that the same screen
// answers in the language the session arrived with. `src/core/copy.ts` and
// `src/core/kitCopy.ts` are the mechanism — every rule in them reads `copy.words`
// — and the table carries English and Portuguese. A sentence written into a
// derivation instead answers in English whatever the person speaks, so it belongs
// to the table and nowhere else. The rule is walked as a syntax tree rather than
// scanned line by line, because a comment can otherwise hide a string, and because
// the machine position that makes a literal a protocol fact and not a sentence is a
// fact about the node's surroundings.
//
// A sentence is two word-runs with a space between them: what a person reads.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

/** The files that are the words, in both languages, and the kit's own examples. */
const COPY_TABLE = [
  "src/core/copy.ts",
  "src/core/kitCopy.ts",
  "src/core/kitGallery.ts",
  "src/core/stateGallery.ts",
  "src/core/kitScenes.ts",
];

/** Sentences the phone keeps outside the table, each named with the site that consumes it. */
const ALLOWED: readonly {
  readonly file: string;
  readonly says: string;
  readonly because: string;
}[] = [
  {
    file: "src/core/outbox.ts",
    says: "This request is too large for this phone to keep.",
    because:
      "returned by bodyRefusal and thrown by every caller: the phone's own limit, no locale reads it",
  },
  {
    file: "src/core/outbox.ts",
    says: "An idempotency key is printable ASCII of at most 200 characters.",
    because: "returned by keyRefusal and thrown by every caller",
  },
  {
    file: "src/core/prose.ts",
    says: "code fence",
    because: "the name of a markdown construct the reader refuses, not a sentence it shows",
  },
];

/** The two product files that hold a rule of their own over what a person is told. */
const PRODUCT = ["src/screens/useCommand.ts", "src/route.tsx"];

const SOURCES = [
  ...(readdirSync("src/core", { recursive: true, encoding: "utf8" }) as string[])
    .filter((file) => file.endsWith(".ts"))
    .map((file) => `src/core/${file}`),
  ...PRODUCT,
].sort();

const SENTENCE = /[A-Za-z][A-Za-z'-]{1,}\s+[A-Za-z]/;

const words = (node: ts.Node): string | null =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
    ? node.text
    : ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)
      ? node.text
      : null;

/** A template's parts are one literal to a person, so they are judged as the whole template. */
const wholeTemplate = (node: ts.Node): ts.Node => {
  let n = node;
  while (
    n.parent &&
    (ts.isTemplateSpan(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n))
  ) {
    n = n.parent;
  }
  return n;
};

const compared = (node: ts.Node): boolean => {
  const parent = node.parent;
  if (!parent) return false;
  if (
    ts.isBinaryExpression(parent) &&
    [
      ts.SyntaxKind.EqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsToken,
      ts.SyntaxKind.EqualsEqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsEqualsToken,
    ].includes(parent.operatorToken.kind)
  ) {
    return true;
  }
  if (ts.isCaseClause(parent) || parent.kind === ts.SyntaxKind.DefaultClause) return true;
  if (ts.isCallExpression(parent)) {
    return (
      ts.isPropertyAccessExpression(parent.expression) &&
      ["startsWith", "endsWith", "includes", "test", "match", "indexOf"].includes(
        parent.expression.name.text,
      )
    );
  }
  return false;
};

/** A reason that leaves by the `notice` channel reaches a developer, never a screen. */
const inHintChain = (node: ts.Node): boolean => {
  for (let cur: ts.Node | undefined = node.parent; cur; cur = cur.parent) {
    if (ts.isArrowFunction(cur) || ts.isFunctionLike(cur)) {
      if (cur.parameters.some((p) => ts.isIdentifier(p.name) && p.name.text === "notice")) {
        return true;
      }
    }
  }
  return false;
};

/**
 * machinePosition answers where the literal sits in code: a place that makes it a
 * protocol fact or a developer's diagnostic rather than a person's sentence.
 */
function machinePosition(node: ts.Node): string | null {
  const whole = wholeTemplate(node);
  const parent = whole.parent;
  if (parent) {
    if (ts.isThrowStatement(parent)) return "thrown";
    if (
      ts.isNewExpression(parent) &&
      (parent.arguments as readonly ts.Node[] | undefined)?.some((a) => a === whole)
    )
      return "thrown";
    if (compared(whole)) return "compared";
    if (
      (ts.isVariableDeclaration(parent) || ts.isPropertyAssignment(parent)) &&
      ts.isIdentifier(parent.name) &&
      /^[A-Z][A-Z0-9_]*$/.test(parent.name.text) &&
      parent.initializer === whole
    ) {
      return "a protocol constant";
    }
  }
  if (inHintChain(node)) return "the notice channel";
  return null;
}

function sentencesIn(file: string): readonly string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.ESNext,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    const text = words(node);
    if (text !== null && SENTENCE.test(text.trim()) && !machinePosition(node)) {
      const at = source.getLineAndCharacterOfPosition(node.getStart());
      const allowed = ALLOWED.some((row) => row.file === file && row.says === text);
      if (!allowed) found.push(`${file}:${at.line + 1} ${JSON.stringify(text)}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

test("every sentence a person reads is a key in the copy table, not a literal in the code", () => {
  const written = SOURCES.filter((file) => !COPY_TABLE.includes(file)).flatMap(sentencesIn);
  assert.deepEqual(
    written,
    [],
    "these sentences answer in English whatever language the person arrived with; they belong in src/core/copy.ts",
  );
});
