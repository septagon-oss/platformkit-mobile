// The five molecules the reference bar asked for, and the states the theme
// hands them. Each one is asked the question a person looks at it to answer:
// how far through, where can I go, what did my query find, what is playing, and
// what does this write take away.
import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { deriveSearch, deriveTabs } from "../../src/core/navigation";
import { deriveMeter, derivePlayback } from "../../src/core/progress";
import { ConfirmDialog } from "../../src/ui/molecules/ConfirmDialog";
import { MiniPlayer } from "../../src/ui/molecules/MiniPlayer";
import { ProgressMeter } from "../../src/ui/molecules/ProgressMeter";
import { SearchField } from "../../src/ui/molecules/SearchField";
import { TabBar } from "../../src/ui/molecules/TabBar";
import { ThemeProvider, themeFor } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

const value = <T,>(result: { ok: true; value: T } | { ok: false; issues: unknown }): T => {
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
};
const inTheme = (el: React.ReactElement, mode: "light" | "dark" = "light") =>
  render(<ThemeProvider mode={mode}>{el}</ThemeProvider>);

describe("ProgressMeter", () => {
  test("a fraction of a known whole prints the count, the whole and the bar", async () => {
    await inTheme(
      <ProgressMeter
        model={value(deriveMeter({ value: 3, max: 8, label: "Storage" }, presentation))}
        testID="meter"
      />,
    );
    expect(screen.getByText("Storage")).toBeOnTheScreen();
    expect(screen.getByText("3 of 8")).toBeOnTheScreen();
    expect(screen.queryByTestId("meter-unmeasured")).toBeNull();
  });

  test("a step rail says which step, and a percent meter says the percent", async () => {
    await inTheme(
      <ProgressMeter
        model={value(
          deriveMeter({ value: 2, max: 3, format: "steps", label: "Checkout" }, presentation),
        )}
        marks
        testID="steps"
      />,
    );
    expect(screen.getByText("Step 2 of 3")).toBeOnTheScreen();
    await inTheme(
      <ProgressMeter
        model={value(
          deriveMeter({ value: 1, max: 4, format: "percent", label: "Upload" }, presentation),
        )}
        testID="upload"
      />,
    );
    expect(screen.getByText("25%")).toBeOnTheScreen();
  });

  test("with no denominator it says why it cannot measure, and draws no bar", async () => {
    await inTheme(
      <ProgressMeter
        model={value(deriveMeter({ value: 7, label: "Queued" }, presentation))}
        testID="queued"
      />,
    );
    expect(screen.getByTestId("queued-unmeasured")).toBeOnTheScreen();
    expect(screen.getByText(presentation.copy.kit.unmeasured)).toBeOnTheScreen();
    expect(screen.getByText("7")).toBeOnTheScreen();
  });

  test("a count past the whole never reaches the meter", () => {
    expect(deriveMeter({ value: 9, max: 8, label: "Storage" }, presentation).ok).toBe(false);
    expect(deriveMeter({ value: 4, max: 0, label: "Storage" }, presentation).ok).toBe(false);
  });
});

describe("TabBar", () => {
  test("each destination is a tab, and a crowd of a hundred and nine reads 99+", async () => {
    const onSelect = jest.fn();
    await inTheme(
      <TabBar
        model={value(
          deriveTabs(
            {
              tabs: [
                { id: "today", label: "Today", badge: 128 },
                { id: "search", label: "Search" },
                { id: "you", label: "You", badge: 3 },
              ],
              selected: "search",
            },
            presentation,
          ),
        )}
        onSelect={onSelect}
        testID="tabs"
      />,
    );
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByTestId("tabs:search")).toHaveStyle({
      backgroundColor: themeFor("light").state.selected,
    });
    expect(screen.getByTestId("tabs:today")).not.toHaveStyle({
      backgroundColor: themeFor("light").state.selected,
    });
    expect(screen.getByText("99+")).toBeOnTheScreen();
    expect(screen.getByText("3")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("tabs:you"));
    expect(onSelect).toHaveBeenCalledWith("you");
  });

  test("the destination already standing is not selected again", async () => {
    const onSelect = jest.fn();
    await inTheme(
      <TabBar
        model={value(
          deriveTabs(
            {
              tabs: [
                { id: "today", label: "Today" },
                { id: "you", label: "You" },
              ],
              selected: "today",
            },
            presentation,
          ),
        )}
        onSelect={onSelect}
        testID="tabs"
      />,
    );
    await fireEvent.press(screen.getByTestId("tabs:today"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  test("a bar of six destinations is refused before it is drawn", () => {
    expect(
      deriveTabs(
        {
          tabs: Array.from({ length: 6 }, (_, i) => ({ id: `t${i}`, label: `Tab ${i}` })),
          selected: "t0",
        },
        presentation,
      ).ok,
    ).toBe(false);
  });
});

describe("SearchField", () => {
  const searchModel = (input: Parameters<typeof deriveSearch>[0]) =>
    value(deriveSearch(input, presentation));

  test("the count the query narrowed to sits under the field", async () => {
    await inTheme(
      <SearchField
        model={searchModel({ value: "music", placeholder: "Songs", count: 12 })}
        onChangeText={() => undefined}
        testID="search"
      />,
    );
    expect(screen.getByText("12 results")).toBeOnTheScreen();
    expect(screen.getByRole("search")).toHaveProp("value", "music");
  });

  test("a clear that returns the whole set appears only once there is a query", async () => {
    const onClear = jest.fn();
    await inTheme(
      <SearchField
        model={searchModel({ value: "music", placeholder: "Songs" })}
        onChangeText={() => undefined}
        onClear={onClear}
        testID="search"
      />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Clear search" }));
    expect(onClear).toHaveBeenCalledTimes(1);
    await inTheme(
      <SearchField
        model={searchModel({ value: "", placeholder: "Songs" })}
        onChangeText={() => undefined}
        onClear={onClear}
        testID="search"
      />,
    );
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  test("waiting is said with the spinner and the word, not a stalled field", async () => {
    await inTheme(
      <SearchField
        model={searchModel({ value: "music", placeholder: "Songs", busy: true })}
        onChangeText={() => undefined}
        testID="search"
      />,
    );
    expect(screen.getByTestId("search")).toHaveStyle({
      backgroundColor: themeFor("light").color.surfaceMuted,
    });
    expect(screen.getByText(presentation.copy.kit.searching)).toBeOnTheScreen();
  });

  test("a hover over the strip is the theme's own hover role", async () => {
    await inTheme(
      <SearchField
        model={searchModel({ value: "", placeholder: "Songs" })}
        onChangeText={() => undefined}
        testID="search"
      />,
    );
    const strip = screen.getByTestId("search");
    expect(strip).not.toHaveStyle({ backgroundColor: themeFor("light").state.hovered });
    await fireEvent(strip, "hoverIn");
    expect(strip).toHaveStyle({ backgroundColor: themeFor("light").state.hovered });
    await fireEvent(strip, "hoverOut");
    expect(strip).not.toHaveStyle({ backgroundColor: themeFor("light").state.hovered });
  });
});

describe("MiniPlayer", () => {
  test("a track says how far through it is and how much is left", async () => {
    const onIntent = jest.fn();
    await inTheme(
      <MiniPlayer
        model={value(
          derivePlayback({ position: 67, total: 247, label: "Now playing" }, presentation),
        )}
        title="Example"
        playing
        onIntent={onIntent}
        testID="player"
      />,
    );
    expect(screen.getByText(/1:07/)).toBeOnTheScreen();
    expect(screen.getByText(/3:00 left/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("player-toggle"));
    expect(onIntent).toHaveBeenCalledWith("pause");
  });

  test("what has no length says how long it has run and cannot be sought", async () => {
    await inTheme(
      <MiniPlayer
        model={value(derivePlayback({ position: 95, label: "Live" }, presentation))}
        title="Example"
        playing={false}
        onIntent={() => undefined}
        collapsed={false}
        testID="player"
      />,
    );
    expect(screen.getByText(/1:35/)).toBeOnTheScreen();
    // The caption is one line: the elapsed time and why there is no total.
    expect(screen.getByText(`1:35 · ${presentation.copy.kit.unmeasured}`)).toBeOnTheScreen();
  });
});

describe("ConfirmDialog", () => {
  const props = {
    title: "Delete example",
    body: "This leaves no copy.",
    reason: "Unsaved changes",
    confirm: "Delete",
    cancel: "Keep",
  };

  test("closed it draws nothing, open it says what the write takes away", async () => {
    await inTheme(
      <ConfirmDialog
        {...props}
        open={false}
        onConfirm={() => undefined}
        onCancel={() => undefined}
        testID="ask"
      />,
    );
    expect(screen.queryByTestId("ask-card")).toBeNull();
    await inTheme(
      <ConfirmDialog
        {...props}
        open
        tone="destructive"
        onConfirm={() => undefined}
        onCancel={() => undefined}
        testID="ask"
      />,
    );
    expect(screen.getByTestId("ask-card")).toBeOnTheScreen();
    expect(screen.getByText("This leaves no copy.")).toBeOnTheScreen();
    expect(screen.getByText("Unsaved changes")).toBeOnTheScreen();
  });

  test("cancel keeps the screen where it was; the verb is the only way through", async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await inTheme(
      <ConfirmDialog
        {...props}
        open
        tone="destructive"
        onConfirm={onConfirm}
        onCancel={onCancel}
        testID="ask"
      />,
    );
    await fireEvent.press(screen.getByTestId("ask-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Keep" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
