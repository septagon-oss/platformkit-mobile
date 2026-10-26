// What a person sees of a finite choice is decided by the server and drawn by one of three
// molecules. These cases hold the two things every appearance owes whoever is using the phone:
// each answer is a control whose role says whether one answer or many are being asked for, and
// whose name is the answer's own word; and the thing they tap is big enough to aim at. Both are
// checked for both cardinalities, over the answers of the pinned capture.
import { expect, test, jest } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import React from "react";
import { parseCatalog, type Field } from "../../src/core/catalog";
import { deriveChoices, type Choice, type ChoiceGroupModel } from "../../src/core/derive";
import { ChoiceChips } from "../../src/ui/molecules/ChoiceChips";
import { ChoiceFigure } from "../../src/ui/molecules/ChoiceFigure";
import { ChoiceTiles } from "../../src/ui/molecules/ChoiceTiles";
import { hit } from "../../src/ui/scale";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";
import { svgNodes } from "../fakes/svg";

const value = <T,>(result: { ok: true; value: T } | { ok: false; issues: unknown }): T => {
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};

/**
 * setOf is one answer set of the pinned capture at one cardinality, with the answers a person
 * already holds. The capture declares many answers; a single-answer question is the same bytes
 * read with the other cardinality, which is what a kernel that declared `one` would answer.
 */
function setOf(
  appearance: string,
  many: boolean,
  held: readonly string[],
): { readonly choice: NonNullable<Field["choice"]>; readonly held: readonly string[] } {
  const catalog = parseCatalog(JSON.parse(readFileSync("testdata/catalog.choices.json", "utf8")));
  const read = catalog.resources
    .flatMap((e) => e.fields)
    .find((f) => f.choice?.appearance === appearance)?.choice;
  if (read === undefined) throw new Error(`${appearance} is not in the capture`);
  const asked = held.slice(0, many ? held.length : 1);
  return { choice: { ...read, many }, held: asked };
}

function modelOf(read: NonNullable<Field["choice"]>, selectedIds: readonly string[]) {
  return value(
    deriveChoices(
      {
        id: "shapes",
        label: "Shapes",
        choices: read.answers.map((a): Choice => ({
          id: a.id,
          label: a.label,
          enabled: true,
          ...(a.picture === undefined ? {} : { picture: a.picture }),
          ...(a.exclusive === undefined ? {} : { exclusive: a.exclusive }),
        })),
        required: read.answerless === undefined,
        ...(read.many ? { many: true as const, selectedIds } : { selectedId: selectedIds[0]! }),
        ...(read.maximum === undefined ? {} : { maximum: read.maximum }),
        ...(read.reason === undefined ? {} : { reason: read.reason }),
        ...(read.artwork === undefined ? {} : { artwork: read.artwork }),
      },
      presentation,
    ),
  );
}

async function drawn(
  model: ChoiceGroupModel,
  onChange: (ids: readonly string[]) => void,
  appearance: string,
  onTick?: () => void,
) {
  const tick = onTick === undefined ? {} : { onTick };
  return render(
    <ThemeProvider mode="light">
      {appearance === "tiles" ? (
        <ChoiceTiles model={model} onChange={onChange} testID="shapes" {...tick} />
      ) : appearance === "figure" ? (
        <ChoiceFigure model={model} onChange={onChange} testID="shapes" {...tick} />
      ) : (
        <ChoiceChips
          model={model}
          onChange={onChange}
          testID="shapes"
          swatch={appearance === "swatch"}
          {...tick}
        />
      )}
    </ThemeProvider>,
  );
}

/** The style an element carries, flattened the way the platform flattens it. */
const flat = (node: { props?: { style?: unknown } }): Record<string, unknown> =>
  Array.isArray(node.props?.style)
    ? Object.assign({}, ...(node.props?.style as object[]))
    : ((node.props?.style as Record<string, unknown>) ?? {});

interface Node {
  readonly children?: readonly (Node | string)[];
  readonly props?: Record<string, unknown>;
}

/** The path from the drawn root to the node the predicate picks out, root first. */
function trailTo(
  node: Node,
  pick: (n: Node) => boolean,
  trail: readonly Node[] = [],
): readonly Node[] {
  const here = [...trail, node];
  if (pick(node)) return here;
  for (const child of node.children ?? []) {
    if (typeof child === "string") continue;
    const found = trailTo(child, pick, here);
    if (found.length > 0) return found;
  }
  return [];
}

for (const appearance of ["tiles", "chips", "swatch", "figure"]) {
  test(`${appearance}: one answer is asked as radios, each named by its answer`, async () => {
    const asked = setOf(appearance, false, ["round"]);
    await drawn(modelOf(asked.choice, asked.held), () => {}, appearance);
    const offered = screen.getAllByRole("radio");
    expect(offered).toHaveLength(3);
    for (const label of ["Round", "Square", "No preference"])
      expect(screen.getByRole("radio", { name: label })).toBeOnTheScreen();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  test(`${appearance}: many answers are asked as checkboxes, each named by its answer`, async () => {
    const asked = setOf(appearance, true, ["round", "square"]);
    await drawn(modelOf(asked.choice, asked.held), () => {}, appearance);
    for (const label of ["Round", "Square", "No preference"])
      expect(screen.getByRole("checkbox", { name: label })).toBeOnTheScreen();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  test(`${appearance}: every answer is big enough for a finger and says what the question is`, async () => {
    const asked = setOf(appearance, true, ["round"]);
    const tree = (
      await drawn(modelOf(asked.choice, asked.held), () => {}, appearance)
    ).toJSON() as unknown;
    expect(JSON.stringify(tree)).toContain("Shapes");
    // The line a person taps is the answer's own element and the box that holds it: whatever
    // stands between them belongs to the atom, not to the appearance.
    const answer = (n: Node): boolean =>
      n.props?.accessibilityLabel === "Round" &&
      (n.props?.accessibilityRole === "checkbox" || n.props?.accessibilityRole === "radio");
    const boxes = trailTo(tree as Node, answer)
      .map(flat)
      .filter((style) => typeof style.minHeight === "number");
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) expect(box.minHeight as number).toBeGreaterThanOrEqual(hit);
  });
}

test("every change is handed back whole, and each one is felt once", async () => {
  const changes: (readonly string[])[] = [];
  const ticks = jest.fn();
  const asked = setOf("tiles", true, ["round"]);
  const model = modelOf(asked.choice, asked.held);
  await drawn(model, (ids) => changes.push(ids), "tiles", ticks);
  await act(async () => fireEvent.press(screen.getByRole("checkbox", { name: "Square" })));
  expect(changes[0]).toEqual(["round", "square"]);
  await act(async () => fireEvent.press(screen.getByRole("checkbox", { name: "No preference" })));
  // The exclusive answer ("No preference") is the whole answer: nothing else is held with it.
  expect(changes[1]).toEqual(["none"]);
  expect(ticks).toHaveBeenCalledTimes(2);
  // The answer a single-answer question already holds is not a change: nothing is handed back,
  // and nothing is felt.
  const one = setOf("tiles", false, ["round"]);
  const held: (readonly string[])[] = [];
  await drawn(modelOf(one.choice, one.held), (ids) => held.push(ids), "tiles");
  await act(async () => fireEvent.press(screen.getByRole("radio", { name: "Round" })));
  expect(held).toEqual([]);
});

test("the sentence the server refuses an empty answer with is drawn while none is held", async () => {
  const asked = setOf("chips", true, []);
  await drawn(modelOf(asked.choice, asked.held), () => {}, "chips");
  expect(screen.getByText("Keep one shape.")).toBeOnTheScreen();
  const heldOne = setOf("chips", true, ["round"]);
  const held = modelOf(heldOne.choice, heldOne.held);
  await render(
    <ThemeProvider mode="light">
      <ChoiceChips model={held} onChange={() => {}} />
    </ThemeProvider>,
  );
  expect(screen.queryByText("Keep one shape.")).toBeNull();
});

test("a swatch draws the colour the answer was declared with, beside its word", async () => {
  const asked = setOf("swatch", true, ["round"]);
  const tree = JSON.stringify(
    (await drawn(modelOf(asked.choice, asked.held), () => {}, "swatch")).toJSON(),
  );
  expect(tree).toContain("#112233");
  expect(tree).toContain("#AABBCC");
  expect(screen.getByRole("checkbox", { name: "Round" })).toBeOnTheScreen();
});

test("the figure appearance draws the compiled artwork and keeps its answers readable", async () => {
  const asked = setOf("figure", true, ["round"]);
  const tree = (await drawn(modelOf(asked.choice, asked.held), () => {}, "figure")).toJSON();
  expect(svgNodes(tree).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("checkbox")).toHaveLength(3);
});
