import React from "react";
import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { Text } from "react-native";
import {
  deriveActions,
  deriveChoices,
  deriveQuantity,
  deriveSurface,
  kitExamples,
  type MapCanvasProps,
  type Result,
} from "../../src/core/derive";
import { ActionBar } from "../../src/ui/molecules/ActionBar";
import { ChoiceChips } from "../../src/ui/molecules/ChoiceChips";
import { QuantityControl } from "../../src/ui/molecules/QuantityControl";
import { DataList } from "../../src/ui/organisms/DataList";
import { MapWithList } from "../../src/ui/organisms/MapWithList";
import { DetailSheet } from "../../src/ui/templates/DetailSheet";
import { MediaHero } from "../../src/ui/molecules/MediaHero";
import { Gallery } from "../../src/ui/gallery";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";
const ok = <T,>(result: Result<T>): T => {
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};
const theme = (node: React.ReactNode) => <ThemeProvider mode="light">{node}</ThemeProvider>;

test("busy actions suppress press and native accessibility activation until new props are ready", async () => {
  const action = jest.fn();
  const model = (state: "ready" | "busy") =>
    ok(
      deriveActions(
        { label: "Actions", actions: [{ id: "send", label: "Send", tone: "primary", state }] },
        presentation,
      ),
    );
  await render(theme(<ActionBar model={model("busy")} onAction={action} />));
  const button = screen.getByRole("button", { name: "Send" });
  await fireEvent.press(button);
  await fireEvent(button, "accessibilityAction", { nativeEvent: { actionName: "activate" } });
  expect(action).not.toHaveBeenCalled();
  await screen.rerender(theme(<ActionBar model={model("ready")} onAction={action} />));
  await fireEvent.press(screen.getByRole("button", { name: "Send" }));
  expect(action.mock.calls).toEqual([["send"]]);
});

test("controlled choice, clear and quantity emit only eligible changed targets", async () => {
  const change = jest.fn();
  const model = ok(
    deriveChoices(
      {
        id: "pick",
        label: "Pick",
        required: false,
        selectedId: "one",
        choices: [
          { id: "one", label: "One", enabled: true },
          { id: "two", label: "Two", enabled: false, reason: "Closed" },
        ],
      },
      presentation,
    ),
  );
  await render(theme(<ChoiceChips model={model} onChange={change} />));
  await fireEvent.press(screen.getByRole("radio", { name: "One" }));
  await fireEvent.press(screen.getByRole("radio", { name: "Two" }));
  expect(change).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Clear" }));
  expect(change.mock.calls).toEqual([[undefined]]);
  await screen.unmount();
  const quantity = ok(
    deriveQuantity(
      { value: 6, min: 2, max: 10, step: 2, state: "ready", label: "Quantity" },
      presentation,
    ),
  );
  await render(theme(<QuantityControl model={quantity} onChange={change} />));
  await fireEvent.press(screen.getByRole("button", { name: "Increase: Quantity" }));
  await fireEvent(screen.getByRole("adjustable"), "accessibilityAction", {
    nativeEvent: { actionName: "decrement" },
  });
  expect(change.mock.calls.slice(1)).toEqual([[8], [4]]);
});

test("selection and inline row actions do not activate the row", async () => {
  // The specimen that demonstrates selection, with nothing ticked yet — the grouped
  // specimen carries no tick boxes at all, since grouping and bulk selection are
  // two demonstrations and one screen does not make both points at once.
  const model = ok(kitExamples(presentation, "data-list/selection-some", { selectedIds: [] })).list,
    onOpen = jest.fn(),
    onSelection = jest.fn(),
    onRowAction = jest.fn();
  await render(
    theme(
      <DataList
        model={model}
        onOpen={onOpen}
        onSelection={onSelection}
        onRowAction={onRowAction}
      />,
    ),
  );
  await fireEvent.press(
    screen.getByRole("checkbox", { name: `Select: ${presentation.copy.kit.specimenPass}` }),
  );
  expect(onSelection.mock.calls).toEqual([[["row-1"]]]);
  expect(onOpen).not.toHaveBeenCalled();
  await fireEvent.press(screen.getAllByRole("button", { name: "Full details" })[0]!);
  expect(onRowAction.mock.calls).toEqual([["row-1", "inspect"]]);
  expect(onOpen).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("button", { name: `${presentation.copy.kit.specimenPass}, Quantity: 2` }),
  );
  expect(onOpen.mock.calls).toEqual([["row-1"]]);
});

test("dirty close remains controlled and blocked close emits nothing", async () => {
  const request = jest.fn();
  const model = (dismissal: "confirm" | "blocked") =>
    ok(
      deriveSurface(
        {
          open: true,
          title: "Details",
          close: { id: "close", label: "Close", tone: "plain", state: "ready" },
          dismissal,
          reason: "Unsaved",
          actions: [],
        },
        presentation,
      ),
    );
  await render(
    theme(
      <DetailSheet model={model("confirm")} onRequestClose={request}>
        <Text>Draft</Text>
      </DetailSheet>,
    ),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Close" }));
  expect(request.mock.calls).toEqual([["button"]]);
  expect(screen.getByText("Draft")).toBeOnTheScreen();
  await screen.rerender(
    theme(
      <DetailSheet model={model("blocked")} onRequestClose={request}>
        <Text>Draft</Text>
      </DetailSheet>,
    ),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Close" }));
  expect(request).toHaveBeenCalledTimes(1);
});

test("old map callbacks consult the latest model before selecting a removed marker", async () => {
  const example = ok(kitExamples(presentation, "map-with-list/points")).map.map;
  const onSelect = jest.fn(),
    onRevealPoints = jest.fn();
  let canvas: MapCanvasProps | undefined;
  const view = (removed: boolean) =>
    theme(
      <MapWithList
        model={{
          ...example,
          canRender: true,
          markers: removed ? [] : example.markers,
          rows: removed ? [] : example.rows,
        }}
        renderMap={(props) => {
          canvas = props;
          return <Text>Map</Text>;
        }}
        renderDetail={() => null}
        onMode={() => undefined}
        onSelect={onSelect}
        onRevealPoints={onRevealPoints}
        onClearSelection={() => undefined}
        onViewport={() => undefined}
        onAction={() => undefined}
        onRetry={() => undefined}
      />,
    );
  await render(view(false));
  const retained = canvas!;
  await screen.rerender(view(true));
  retained.onMarker("point-1");
  expect(onSelect).not.toHaveBeenCalled();
  expect(onRevealPoints).not.toHaveBeenCalled();
  await screen.rerender(view(false));
  await screen.unmount();
  retained.onMarker("point-1");
  expect(onSelect).not.toHaveBeenCalled();
});

test.each([
  "choice-chips/disabled-option",
  "activity/expanded",
  "stepper/write-unknown",
  "slot-picker/selection-lost",
  "price/large-int64",
  "pricing-tiers/missing-offer",
  "media-hero/error",
  "area-chart/gaps",
  "stat-tile/zero-baseline",
])("Gallery renders %s through its real model", async (caseId) => {
  await render(<Gallery presentation={presentation} initialCaseId={caseId} />);
  expect(screen.getByTestId("gallery")).toBeOnTheScreen();
});

test("a loading image keeps its renderer mounted so the native load can complete", async () => {
  const model = ok(kitExamples(presentation, "media-hero/loading")).hero;
  const image = jest.fn(() => <Text testID="image-adapter">Image adapter</Text>);
  await render(theme(<MediaHero model={model} renderImage={image} />));
  expect(image).toHaveBeenCalled();
  expect(screen.getByTestId("image-adapter", { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByTestId("image-adapter")).toBeNull();
  const ready = ok(kitExamples(presentation, "media-hero/default")).hero;
  await screen.rerender(theme(<MediaHero model={ready} renderImage={image} />));
  expect(screen.getByTestId("image-adapter")).toBeTruthy();
});

test("unsupported map providers retain the list without offering a retry", async () => {
  await render(
    <Gallery presentation={presentation} initialCaseId="map-with-list/provider-unsupported" />,
  );
  expect(
    within(screen.getByTestId("gallery-kit")).getByRole("button", {
      name: presentation.copy.kit.placePrintRoom,
    }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  await screen.rerender(
    <Gallery
      key="offline"
      presentation={presentation}
      initialCaseId="map-with-list/provider-offline"
    />,
  );
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
});
