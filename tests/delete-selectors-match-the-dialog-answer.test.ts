// Maestro text selectors are regex source, not JavaScript regex literals. Its
// YamlCommandReader preserves the scalar and StringUtils.toRegexSafe compiles it
// unchanged. In particular, slash wrappers are literal characters. Keep the raw
// YAML value when checking the answer; stripping slashes would hide a broken tap.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseAllDocuments } from "yaml";
import { kitEnglish } from "../src/core/kitCopy";

for (const name of ["create", "detail", "edit", "list", "record", "verb"]) {
  test(`${name} delete selector matches the dialog answer as raw regex source`, () => {
    const documents = parseAllDocuments(readFileSync(`e2e/flows/${name}.yaml`, "utf8"));
    const steps = documents[1]!.toJSON() as { tapOn?: string | { id?: string; text?: string } }[];
    const opens = steps.findIndex(
      (step) => typeof step.tapOn === "object" && step.tapOn.id === "delete",
    );
    assert.ok(opens >= 0, `${name}: the journey must open the delete question`);
    const answer = steps.slice(opens + 1).find((step) => step.tapOn !== undefined)?.tapOn;
    const source = typeof answer === "string" ? answer : answer?.text;
    assert.equal(typeof source, "string", `${name}: the question needs an answer selector`);
    // Translate Java's inline case flag only; preserve every other character of
    // the selector. These flows use syntax shared by Java and JavaScript regexes.
    const regex = new RegExp(source!.replaceAll("(?i)", ""), "is");
    for (const noun of ["note", "task item"]) {
      const label = kitEnglish.deleteAction(noun);
      for (const drawn of [label, label.toUpperCase()]) {
        assert.equal(
          regex.exec(drawn)?.[0],
          drawn,
          `${name}: raw selector ${JSON.stringify(source)} cannot tap ${JSON.stringify(drawn)}`,
        );
      }
    }
    assert.equal(regex.test(kitEnglish.deleteQuestion("Renew licence")), false);
    assert.equal(regex.test(kitEnglish.deleteWarning), false);
  });
}
