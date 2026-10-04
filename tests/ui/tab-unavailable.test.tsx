// A tab bar is a control, and a control the kit draws can be unavailable: the
// destination stays where the person expects it, says why it cannot be opened,
// and pressing it selects nothing. The specification names this state for the
// tab item beside Button and the search strip ("state.disabled + the supplied
// reason in text; zero callbacks"). The field the input carries is written here
// as `unavailable`; a fix that names it differently renames it here too.
import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { deriveTabs, type TabsInput } from "../../src/core/navigation";
import { TabBar } from "../../src/ui/molecules/TabBar";
import { ThemeProvider, themeFor } from "../../src/ui/theme";
import { presentation } from "../fakes/presentation";

test("an unavailable tab says why, wears the disabled state and selects nothing", async () => {
  const onSelect = jest.fn();
  const input = {
    tabs: [
      { id: "today", label: "Today" },
      { id: "billing", label: "Billing", unavailable: "Ask an owner for access" },
      { id: "you", label: "You" },
    ],
    selected: "today",
  } as TabsInput;
  const derived = deriveTabs(input, presentation);
  if (!derived.ok) throw new Error(JSON.stringify(derived.issues));
  await render(
    <ThemeProvider mode="light">
      <TabBar model={derived.value} onSelect={onSelect} testID="tabs" />
    </ThemeProvider>,
  );
  const billing = screen.getByTestId("tabs:billing");
  expect(billing).toBeDisabled();
  expect(billing).toHaveStyle({ backgroundColor: themeFor("light").state.disabled.fill });
  expect(screen.getByText("Ask an owner for access")).toBeOnTheScreen();
  await fireEvent.press(billing);
  expect(onSelect).not.toHaveBeenCalled();
});
