// A slot whose availability was withdrawn cannot be selected, kept selected or confirmed until
// a usable snapshot returns and echoes its own version.
import React from "react";
import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { deriveCopy, deriveSlots, deriveState, type SlotPickerInput } from "../../src/core/derive";
import { SlotPicker } from "../../src/ui/organisms/SlotPicker";
import { ThemeProvider } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

test.each([
  { language: "en", mode: "light" },
  { language: "en", mode: "dark" },
  { language: "pt", mode: "light" },
  { language: "pt", mode: "dark" },
] as const)(
  "$language/$mode slot withdrawal suppresses selection until a usable snapshot returns",
  async ({ language, mode }) => {
    const p = { ...presentation, copy: deriveCopy(language), now: "2027-05-07T08:00:00Z" };
    const onSelect = jest.fn();
    const onClear = jest.fn();
    const onDate = jest.fn();
    const onRefresh = jest.fn();
    const input: SlotPickerInput = {
      dates: ["2027-05-07"],
      selectedDate: "2027-05-07",
      quantity: 2,
      content: {
        phase: "ready",
        refresh: "idle",
        value: {
          availabilityVersion: "snapshot-41",
          validUntil: "2027-05-07T08:30:00Z",
          slots: [
            {
              id: "late-morning",
              start: "2027-05-07T11:15:00Z",
              end: "2027-05-07T11:45:00Z",
              state: "open",
              capacity: { kind: "known", total: 6, remaining: 2 },
            },
          ],
        },
      },
    };
    const view = (value: SlotPickerInput, now = p.now) => {
      const derived = deriveSlots(value, { ...p, now });
      if (!derived.ok) throw new Error(JSON.stringify(derived.issues));
      return (
        <ThemeProvider mode={mode}>
          <SlotPicker
            model={derived.value}
            onSelect={onSelect}
            onDate={onDate}
            onClear={onClear}
            onRefresh={onRefresh}
          />
        </ThemeProvider>
      );
    };
    await render(view(input));
    await fireEvent.press(screen.getByRole("radio"));
    expect(onSelect.mock.calls).toEqual([
      [{ slotId: "late-morning", availabilityVersion: "snapshot-41", quantity: 2 }],
    ]);
    onSelect.mockClear();
    const selected = { ...input, selectedSlotId: "late-morning" };
    await screen.rerender(view(selected, "2027-05-07T08:30:00Z"));
    const expired = screen.getByRole("radio");
    expect(expired).toBeDisabled();
    await fireEvent.press(expired);
    expect(onSelect).not.toHaveBeenCalled();

    for (const code of ["forbidden", "not-found"] as const) {
      const state = deriveState(
        {
          kind: "error",
          issue: {
            code,
            path: "availability",
            recovery: "immutable",
            message: p.copy.kit.unavailable,
          },
        },
        p,
      );
      if (!state.ok) throw new Error(JSON.stringify(state.issues));
      await screen.rerender(view({ ...selected, content: { phase: "error", state: state.value } }));
      // The date button establishes reachability independently of a refusal's copy.
      expect(screen.getByRole("button", { selected: true })).toBeEnabled();
      expect(screen.queryByRole("radio", { includeHiddenElements: true })).toBeNull();
      expect(onSelect).not.toHaveBeenCalled();
      expect(onRefresh).not.toHaveBeenCalled();
    }

    if (input.content.phase !== "ready") throw new Error("fixture must contain a snapshot");
    await screen.rerender(
      view({
        ...input,
        content: {
          ...input.content,
          value: { ...input.content.value, availabilityVersion: "snapshot-44" },
        },
      }),
    );
    const recovered = screen.getByRole("radio");
    expect(recovered).toBeEnabled();
    expect(onSelect).not.toHaveBeenCalled();
    await fireEvent.press(recovered);
    expect(onSelect.mock.calls).toEqual([
      [{ slotId: "late-morning", availabilityVersion: "snapshot-44", quantity: 2 }],
    ]);
    expect(onClear).not.toHaveBeenCalled();
    expect(onDate).not.toHaveBeenCalled();
  },
);
