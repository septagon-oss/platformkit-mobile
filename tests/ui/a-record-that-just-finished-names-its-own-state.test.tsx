// What the record owes the person when their own write moved its state into one the entry calls
// finished: one line, in the record's own words, drawn whether or not anything is allowed to move.
// The organism draws what the screen composes and composes nothing of its own — no overlay appears
// without a `finishing` prop, no burst appears without a renderer, and every row the record always
// drew stays drawn under the line. The words come from the entry's noun and the author's own word for
// the state, both read off the served catalog, so nothing here spells a sentence out a second time.
import React from "react";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import { View } from "react-native";
import { parseCatalog, type Entry } from "../../src/core/catalog";
import {
  deriveCopy,
  deriveDisclosure,
  deriveFeedback,
  finishedWord,
  noun,
  statusPill,
  statusTone,
  type Presentation,
} from "../../src/core/derive";
import { ResourceDetail } from "../../src/ui/organisms/ResourceDetail";
import type { BadgeTone } from "../../src/ui/atoms/Badge";
import type { Finishing, FinishingProps } from "../../src/ui/organisms/ResourceDetail";
import { ThemeProvider } from "../../src/ui/theme";

const catalog = parseCatalog(JSON.parse(readFileSync("testdata/catalog.pictures.json", "utf8")));
const task = catalog.resources.find((r) => r.entity === "task")!;
const row = {
  id: "task-1",
  title: "Fix the door",
  description: "The front door lock sticks.",
  status: "resolved",
  priority: "high",
};
const copy = deriveCopy("en");
const words = (e: Entry, at: Record<string, unknown>, motion: "normal" | "reduced") =>
  finishedWord(noun(e).singular, statusPill(e, at, shown(motion))?.label ?? "", copy);

/** shown is the record's own formatting, in the one motion preference the case asks for. */
function shown(motion: "normal" | "reduced"): Presentation {
  return {
    locale: "en-GB",
    timeZone: "UTC",
    ownZone: "UTC",
    now: "2026-07-18T09:00:00Z",
    weekStartsOn: 1,
    motion,
    copy,
  };
}
const feedback = (motion: "normal" | "reduced") => deriveFeedback(copy, motion, shown(motion));
const information = (motion: "normal" | "reduced") => {
  const model = deriveDisclosure(
    {
      id: "record-information",
      title: copy.kit.recordInformation,
      summary: copy.kit.recordInformationHolds,
      reveals: copy.kit.recordInformationContent,
      expanded: false,
      depth: 1,
      enabled: true,
    },
    shown(motion),
  );
  if (!model.ok) throw new Error(JSON.stringify(model.issues));
  return { model: model.value, onExpanded: () => undefined };
};

/** Every testID the record drew, so a case can say what changed and what did not. */
const drawn = () =>
  (JSON.stringify(screen.toJSON()).match(/"testID":"([^"]+)"/g) ?? [])
    .map((found) => found.slice('"testID":"'.length, -1))
    .filter((id) => id !== "resource-detail")
    .sort();

/** moment is the record's finishing prop, holding the tone aside when the entry declared none. */
const moment = (
  seen: { words: string; state?: BadgeTone; burst?: Finishing },
  onEnd: () => void = () => undefined,
) => ({
  words: seen.words,
  ...(seen.state === undefined ? {} : { state: seen.state }),
  ...(seen.burst === undefined ? {} : { burst: seen.burst }),
  onEnd,
});

const burst = jest.fn((props: FinishingProps) => {
  calls.push(props);
  return <View testID="burst" />;
});
let calls: FinishingProps[] = [];

beforeEach(() => {
  burst.mockClear();
  calls = [];
});

async function record(
  over: Partial<React.ComponentProps<typeof ResourceDetail>> = {},
  motion: "normal" | "reduced" = "normal",
) {
  await render(
    <ThemeProvider mode="light">
      <ResourceDetail
        feedback={feedback(motion)}
        entry={task}
        row={row}
        error=""
        onRetry={() => undefined}
        information={information(motion)}
        {...over}
      />
    </ThemeProvider>,
  );
}

describe("a record that just finished names its own state", () => {
  test("the line says what the record became, in the entry's own two words", async () => {
    await record({
      finishing: moment({
        words: words(task, row, "normal"),
        state: statusTone(task, row, shown("normal")) ?? "neutral",
      }),
    });
    expect(screen.getByTestId("record-finished")).toHaveTextContent("Task resolved");
    expect(screen.getByTestId("record-finished").props.accessibilityLiveRegion).toBe("polite");
  });

  test("the record under the line is the record it always drew", async () => {
    await record();
    const before = drawn();
    expect(before).toContain("field-priority");
    await record({
      finishing: { words: "Task resolved", state: "ok", onEnd: () => undefined },
    });
    expect(drawn()).toEqual([...before, "record-finished"].sort());
  });

  test("a record that reached nothing draws no line at all", async () => {
    await record();
    expect(screen.queryByTestId("record-finished")).toBeNull();
    expect(screen.queryByTestId("burst")).toBeNull();
  });

  test("the burst is drawn over the record and asked for nothing but its own ending", async () => {
    const ended = jest.fn();
    await record({
      finishing: moment(
        {
          words: "Task resolved",
          state: statusTone(task, row, shown("normal")) ?? "neutral",
          burst,
        },
        ended,
      ),
    });
    expect(screen.getByTestId("burst")).toBeOnTheScreen();
    expect(calls).toHaveLength(1);
    expect(calls[0]!.tone).toBe("ok");
    expect(calls[0]!.motion).toBe("normal");
    // The drawn thing asks for nothing: no press, no focus, no dismissal — only its one call.
    expect(ended).not.toHaveBeenCalled();
    expect(screen.getByTestId("record-finished")).toHaveTextContent("Task resolved");
    expect(screen.getByTestId("field-priority")).toBeOnTheScreen();
  });

  test("a product that ships no burst renderer keeps the line and the whole record", async () => {
    // This is the still product, and it is also every reduced-motion reader: the screens compose
    // `finishing` with no burst, so no overlay is drawn and the sentence is all there is.
    await record(
      { finishing: { words: "Task resolved", state: "ok", onEnd: () => undefined } },
      "reduced",
    );
    expect(screen.getByTestId("record-finished")).toBeOnTheScreen();
    expect(screen.queryByTestId("burst")).toBeNull();
    expect(burst).not.toHaveBeenCalled();
    expect(screen.getByTestId("field-priority")).toBeOnTheScreen();
  });

  test("the pill the line is about changed, and nothing beside it did", async () => {
    // The header pill carries the state the entry declares, in the tone that entry chose; the
    // moment arrives with that same pill, not with a second one beside it.
    await record();
    expect(screen.getAllByText("Resolved")).toHaveLength(1);
    await record({ finishing: { words: "Task resolved", state: "ok", onEnd: () => undefined } });
    expect(screen.getAllByText("Resolved")).toHaveLength(1);
    expect(screen.getAllByText("Task resolved")).toHaveLength(1);
  });
});
