// A generated record reads a richtext declaration without a product renderer.
// Markdown headings become native text while a plain text field keeps its syntax.
import { beforeEach, expect, jest, test } from "@jest/globals";
import { render, screen, waitFor, within } from "@testing-library/react-native";
import React from "react";
import type { Entry } from "../../src/core/catalog";
import { ResourceDetail } from "../../src/screens/ResourceDetail";
import { ThemeProvider } from "../../src/ui/theme";
import { reset } from "../fakes/router";
import { fakeApi, note, shell, shellValue } from "../fakes/shell";

jest.mock(
  "expo-router",
  () => jest.requireActual<typeof import("../fakes/router")>("../fakes/router").expoRouter,
);
jest.mock(
  "expo-router/react-navigation",
  () => jest.requireActual<typeof import("../fakes/router")>("../fakes/router").reactNavigation,
);
jest.mock("../../src/shell", () => ({
  useShell: () => jest.requireActual<typeof import("../fakes/shell")>("../fakes/shell").shell.value,
}));

beforeEach(reset);

const source = "## Care plan\n\nGive **fresh water** every morning.";

async function read(widget: "richtext" | "textarea", mode: "light" | "dark") {
  const entry: Entry = {
    ...note,
    hints: { ...note.hints, previewField: "status" },
    fields: note.fields.map((field) => (field.name === "body" ? { ...field, widget } : field)),
  };
  const api = fakeApi();
  api.get.mockResolvedValue({ id: "note-46", title: "Daily care", status: "open", body: source });
  shell.value = shellValue(api, { entry: () => entry });
  await render(
    <ThemeProvider mode={mode}>
      <ResourceDetail entry={entry} id="note-46" />
    </ThemeProvider>,
  );
  await waitFor(() => expect(api.get).toHaveBeenCalledWith(entry, "note-46"));
  await waitFor(() => expect(screen.getByTestId("field-body")).toBeOnTheScreen());
  return within(screen.getByTestId("field-body"));
}

test.each(["light", "dark"] as const)(
  "a generated richtext record draws native Markdown in %s mode",
  async (mode) => {
    const body = await read("richtext", mode);
    expect(body.getByText("Care plan")).toBeOnTheScreen();
    expect(body.getByText("fresh water")).toBeOnTheScreen();
    expect(body.queryByText(source)).toBeNull();
  },
);

test("a plain text record keeps Markdown punctuation as text", async () => {
  const body = await read("textarea", "light");
  expect(body.getByText(source)).toBeOnTheScreen();
});
