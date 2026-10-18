// An empty screen is drawn: the picture a model names arrives above the model's
// own words, in the model's own order, and adds nothing to what the screen says
// out loud. The rise that greets a person on a device that asks for motion happens
// once per appearance; a device that asks for none is handed a still picture.
import { describe, expect, jest, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import React from "react";
import { Animated } from "react-native";
import {
  deriveState,
  illustrations,
  type IllustrationName,
  type StateInput,
  type StateModel,
} from "../../src/core/derive";
import { Illustration } from "../../src/ui/atoms/Illustration";
import { StateView } from "../../src/ui/molecules/StateView";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

interface Node {
  readonly type?: string;
  readonly props?: Record<string, unknown>;
  readonly children?: readonly (Node | string)[];
}

function nodesOf(node: Node | string | null | undefined, out: Node[] = []): Node[] {
  if (!node || typeof node === "string") return out;
  out.push(node);
  for (const child of node.children ?? []) nodesOf(child, out);
  return out;
}

const drawnOf = (tree: Node | null) =>
  nodesOf(tree)
    .filter((node) => node.type === "RNSVGPath")
    .map((node) => node.props?.d);

/** spoken is every label this tree offers a screen reader, however the platform spells it. */
const spoken = (tree: Node | null) =>
  nodesOf(tree)
    .flatMap((node) => [node.props?.accessibilityLabel, node.props?.["aria-label"]])
    .filter((label): label is string => typeof label === "string");

const modelOf = (input: StateInput): StateModel => {
  const result = deriveState(input, presentation);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};

const show = (model: StateModel) =>
  render(
    <ThemeProvider mode="light">
      <StateView model={model} onAction={() => undefined} />
    </ThemeProvider>,
  );

const partsOf = (name: IllustrationName) => illustrations[name].parts.map((part) => part.d);

describe("an empty state drawn from its model", () => {
  test("the picture the model names is the picture on the screen, above the model's words", async () => {
    const model = modelOf({ kind: "empty", illustration: "document" });
    const { toJSON } = await show(model);
    expect(drawnOf(toJSON() as Node | null)).toEqual(partsOf("document"));
    expect(screen.getByText(model.title)).toBeOnTheScreen();
    expect(screen.getByText(model.body)).toBeOnTheScreen();
    await screen.unmount();
  });

  test("a list a filter emptied draws the magnifier, whatever the entry asked for", async () => {
    const { toJSON } = await show(modelOf({ kind: "empty", illustration: "filtered" }));
    expect(drawnOf(toJSON() as Node | null)).toEqual(partsOf("filtered"));
    await screen.unmount();
  });

  test("a model that names no picture is drawn with the generic one", async () => {
    const model = modelOf({ kind: "empty" });
    expect(model.illustration).toBe("empty");
    const { toJSON } = await show(model);
    expect(drawnOf(toJSON() as Node | null)).toEqual(partsOf("empty"));
    await screen.unmount();
  });

  test("the picture says nothing of its own: the screen is still titled and bodied, once", async () => {
    const model = modelOf({ kind: "empty", illustration: "money", title: "No invoices yet" });
    const { toJSON } = await show(model);
    expect(spoken(toJSON() as Node | null)).toEqual([model.announcementText]);
    expect(model.announcementText.split(". ").length).toBe(2);
    expect(
      nodesOf(toJSON() as Node | null)
        .filter((node) => node.type === "RNSVGSvgView")
        .map((node) => spoken(node)),
    ).toEqual([[]]);
    await screen.unmount();
  });
});

describe("the first appearance of a picture", () => {
  const started = () => {
    const handle = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
    return { handle, timing: jest.spyOn(Animated, "timing").mockReturnValue(handle as never) };
  };

  test("reduced motion never starts a rise and is drawn still", async () => {
    const { timing } = started();
    try {
      await render(
        <ThemeProvider mode="light">
          <Illustration name="plan" testID="picture" />
        </ThemeProvider>,
      );
      expect(timing).not.toHaveBeenCalled();
      expect(screen.getByTestId("picture")).toHaveStyle({ opacity: 1 });
      await screen.unmount();
    } finally {
      timing.mockRestore();
    }
  });

  test("a device that asks for motion gets one rise of 300 ms, and no second one for a re-render", async () => {
    const { handle, timing } = started();
    try {
      const picture = (
        <ThemeProvider mode="light">
          <Illustration name="plan" motion="normal" testID="picture" />
        </ThemeProvider>
      );
      await render(picture);
      expect(timing).toHaveBeenCalledTimes(1);
      expect(timing.mock.calls[0]?.[1]).toMatchObject({
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      });
      await screen.rerender(picture);
      expect(timing).toHaveBeenCalledTimes(1);
      expect(handle.start).toHaveBeenCalledTimes(1);
      await screen.unmount();
      expect(handle.stop).toHaveBeenCalledTimes(1);
    } finally {
      timing.mockRestore();
    }
  });
});
