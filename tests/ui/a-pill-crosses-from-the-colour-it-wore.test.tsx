// A pill whose state moved while it was on screen crosses from the pair it wore to the pair it
// reached: the pair it left is laid over the pill, fully on, hidden from a reader and answering no
// press, and it is gone once the crossing ends — leaving the tree a pill that drew the reached state
// from the start draws. The word is never doubled at any point of the crossing. A reader who asked for
// less motion, and a pill re-drawn in the state it already wore, start no crossing at all. Jest's
// Animated finishes every timing at once, so each case holds the crossing open by answering
// `Animated.timing` itself and ends it by hand; every colour is read off a pill in the same tree.
import { describe, expect, jest, test } from "@jest/globals";
import { act, render, screen, within } from "@testing-library/react-native";
import React from "react";
import { Animated, StyleSheet } from "react-native";
import { Badge, type BadgeTone } from "../../src/ui/atoms/Badge";
import { ThemeProvider } from "../../src/ui/theme";

interface Node {
  readonly type: string;
  readonly props: Record<string, unknown>;
  readonly children: readonly (Node | string)[] | null;
}

type Ended = (result: { finished: boolean }) => void;

/** held answers `Animated.timing` with a crossing that runs until the case ends it. */
function held() {
  const ends: Ended[] = [];
  const handle = {
    start: jest.fn((ended?: Ended) => {
      if (ended) ends.push(ended);
    }),
    stop: jest.fn(),
    reset: jest.fn(),
  };
  const timing = jest.spyOn(Animated, "timing").mockReturnValue(handle as never);
  return { timing, ends };
}

/** pills draws the moving pill beside one that never left `Open` and one that drew `Done` at once. */
const pills = (moving: { label: string; tone: BadgeTone }, motion: "normal" | "reduced") => (
  <ThemeProvider mode="light">
    <Badge label={moving.label} tone={moving.tone} motion={motion} testID="moving" />
    <Badge label="Open" tone="info" motion={motion} testID="left" />
    <Badge label="Done" tone="ok" motion={motion} testID="reached" />
  </ThemeProvider>
);

/** nodes is every drawn node under the given ones, depth first. */
const nodes = (from: readonly (Node | string)[]): Node[] =>
  from.flatMap((node) => (typeof node === "string" ? [] : [node, ...nodes(node.children ?? [])]));

/** pill is the drawn node of one pill, read off the rendered tree. */
function pill(id: string): Node {
  const json = screen.toJSON() as Node | Node[] | null;
  const found = nodes(Array.isArray(json) ? json : json ? [json] : []).find(
    (node) => node.props.testID === id,
  );
  if (!found) throw new Error(`no pill ${id} in the tree`);
  return found;
}

const background = (node: Node) =>
  (StyleSheet.flatten(node.props.style as never) as { backgroundColor?: string }).backgroundColor;

/** layers are the nodes inside a pill that a reader is never told about. */
const layers = (id: string) =>
  (pill(id).children ?? []).filter(
    (child): child is Node =>
      typeof child !== "string" && child.props.accessibilityElementsHidden === true,
  );

describe("a pill crosses from the colour it wore", () => {
  test("a moved pill wears the pair it left over the pair it reached until its crossing ends", async () => {
    const { timing, ends } = held();
    try {
      const shown = await render(pills({ label: "Open", tone: "info" }, "normal"));
      expect(timing).not.toHaveBeenCalled();
      await shown.rerender(pills({ label: "Done", tone: "ok" }, "normal"));

      expect(timing).toHaveBeenCalledTimes(1);
      const asked = timing.mock.calls[0]?.[1] as { duration: number; useNativeDriver: boolean };
      expect(asked.duration).toBeLessThanOrEqual(250);
      expect(asked.useNativeDriver).toBe(true);

      // Mid-crossing: the pill already wears the reached pair underneath, the pair it left lies over
      // it at full strength, and that layer is silent, untouchable and named by no journey.
      expect(background(pill("moving"))).toBe(background(pill("reached")));
      const [over, ...more] = layers("moving");
      expect(more).toHaveLength(0);
      expect(over).toBeDefined();
      expect(background(over!)).toBe(background(pill("left")));
      expect(background(over!)).not.toBe(background(pill("reached")));
      expect(StyleSheet.flatten(over!.props.style as never)).toMatchObject({ opacity: 1 });
      expect(over!.props.pointerEvents).toBe("none");
      expect(over!.props.testID).toBeUndefined();
      expect(over!.children ?? []).toHaveLength(0);
      const moving = screen.getByTestId("moving");
      expect(within(moving).getAllByText("Done")).toHaveLength(1);
      expect(within(moving).queryByText("Open")).toBeNull();

      expect(ends).toHaveLength(1);
      await act(async () => ends[0]!({ finished: true }));
      expect(layers("moving")).toHaveLength(0);
      expect(JSON.stringify(pill("moving"))).toEqual(
        JSON.stringify(pill("reached")).replace(/"reached"/, '"moving"'),
      );
      await screen.unmount();
    } finally {
      timing.mockRestore();
    }
  });

  test("a pill whose reader asked for less motion starts no crossing and lays nothing over itself", async () => {
    const { timing } = held();
    try {
      const shown = await render(pills({ label: "Open", tone: "info" }, "reduced"));
      await shown.rerender(pills({ label: "Done", tone: "ok" }, "reduced"));
      expect(timing).not.toHaveBeenCalled();
      expect(layers("moving")).toHaveLength(0);
      expect(background(pill("moving"))).toBe(background(pill("reached")));
      await screen.unmount();
    } finally {
      timing.mockRestore();
    }
  });

  test("a pill re-drawn in the state it already wore starts no crossing", async () => {
    const { timing } = held();
    try {
      const shown = await render(pills({ label: "Done", tone: "ok" }, "normal"));
      await shown.rerender(pills({ label: "Done", tone: "ok" }, "normal"));
      expect(timing).not.toHaveBeenCalled();
      expect(layers("moving")).toHaveLength(0);
      await screen.unmount();
    } finally {
      timing.mockRestore();
    }
  });
});
