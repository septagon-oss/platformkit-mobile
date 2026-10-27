// The list organism draws the kernel's reviewed parity cases from the policy each states: the record's
// title, the words of its cells and the sort sheet's rows are the ones the case says every client shows.
import React from "react";
import { describe, expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import { parseCatalog } from "../../src/core/catalog";
import { ResourceList } from "../../src/ui/organisms/ResourceList";
import { ThemeProvider } from "../../src/ui/theme";
import { parityEntry } from "../fakes/parityEntry";
import { presentation } from "../fakes/presentation";

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const none = () => undefined;
// A row is one accessible element, so its words are read through it rather than past it.
const said = { includeHiddenElements: true };
const fixture = (name: string): Json =>
  JSON.parse(readFileSync(`tests/parity/${name}.json`, "utf8")) as Json;

async function drawn(name: string, sheet: "none" | "sort" = "none"): Promise<void> {
  const f = fixture(name);
  const entry = parseCatalog({ catalogVersion: 3, resources: [parityEntry(f as never)] })
    .resources[0]!;
  await render(
    <ThemeProvider mode="light">
      <ResourceList
        presentation={presentation}
        entry={entry}
        rows={f.input.rows}
        total={f.input.rows.length}
        loading={false}
        refreshing={false}
        more={false}
        error=""
        order={{ sort: "", filters: {} }}
        sheet={sheet}
        onSheet={none}
        onOrder={none}
        onOpen={none}
        onMore={none}
        onRefresh={none}
      />
    </ThemeProvider>,
  );
}

describe("a list drawn from the resolved policy", () => {
  test("a Portuguese task is titled and its yes read in the server's words", async () => {
    await drawn("pt-task");
    expect(screen.getByText("Escrever", said)).toBeTruthy();
    expect(screen.getByText("Sim", said)).toBeTruthy();
    expect(screen.queryByText("Yes", said)).toBeNull();
  });

  test("a note with nothing in it is titled by its identifier, and a false is the server's No", async () => {
    await drawn("null-and-false");
    expect(screen.getByText("r1", said)).toBeTruthy();
    expect(screen.getByText("No", said)).toBeTruthy();
    expect(screen.getByText("Yes", said)).toBeTruthy();
    expect(screen.getByText("x", said)).toBeTruthy();
  });

  test("the sort sheet offers the orders the policy lists, and not an identifier", async () => {
    await drawn("absent-hints", "sort");
    // The words after the comma are the phone's; the words before it are the case's own:
    // this fixture states each sort as a query only, and its block completes the label
    // with the field's name, so the sheet says the field's name in the phone's sentence.
    expect(screen.getByText("title, A–Z", said)).toBeTruthy();
    expect(screen.getByText("Newest first", said)).toBeTruthy();
    expect(screen.queryByText("id, A–Z", said)).toBeNull();
  });
});
