// A record page handed no picture door is today's record page: no cover, no gallery, no name
// standing on a photo and no scroll stream asked for. The shared component setup mounts the
// reference catalogue's note in exactly this shape before every suite, so this also holds the
// precondition that hook leans on: the note is a resource the reference catalogue declares.
import React from "react";
import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import { parseCatalog } from "../../src/core/catalog";
import { ResourceDetail } from "../../src/ui/organisms/ResourceDetail";
import { ThemeProvider } from "../../src/ui/theme";
import { feedback } from "../fakes/presentation";
import { unresolved } from "../fakes/unresolved";

const catalog = parseCatalog(unresolved(JSON.parse(readFileSync("testdata/catalog.json", "utf8"))));
const none = () => undefined;

test("a record page given no picture door draws its header block and no cover", async () => {
  const note = catalog.resources.find((r) => r.entity === "note");
  expect(note).toBeDefined();
  const row = { id: "n-7", title: "Harbour log", status: "open", rank: 2, pinned: false, tags: [] };
  await render(
    <ThemeProvider mode="light">
      <ResourceDetail feedback={feedback} entry={note!} row={row} error="" onRetry={none} />
    </ThemeProvider>,
  );
  const page = screen.getByTestId("resource-detail") as unknown as {
    props: { onScroll?: unknown };
  };
  expect(page.props.onScroll).toBeUndefined();
  expect(screen.queryByTestId("record-cover")).toBeNull();
  expect(screen.queryByTestId("record-title")).toBeNull();
  expect(screen.queryByTestId("record-title-bar")).toBeNull();
  expect(screen.queryByTestId("photo-strip")).toBeNull();
});
