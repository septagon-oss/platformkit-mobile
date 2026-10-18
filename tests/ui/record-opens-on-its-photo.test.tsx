// A record's picture is drawn where the record begins, and the facts it draws there are not
// drawn again below it. These are the record screen's two picture surfaces read off the
// rendered tree: the cover carries the record's name and no row prints its identifier, and the
// gallery offers a press only on a picture this phone can name.
import React from "react";
import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import { View } from "react-native";
import { parseCatalog, type Entry } from "../../src/core/catalog";
import { deriveDisclosure, fileMeta, type ImageSlotProps } from "../../src/core/derive";
import { ResourceDetail } from "../../src/ui/organisms/ResourceDetail";
import { ThemeProvider } from "../../src/ui/theme";
import { feedback, presentation } from "../fakes/presentation";

const catalog = parseCatalog(JSON.parse(readFileSync("testdata/catalog.pictures.json", "utf8")));
const content = catalog.resources.find((r) => r.entity === "content")!;
const COVER = "03fcde99-d7e5-456e-ab15-8680a4450b13";
const FIRST = "11111111-1111-4111-8111-111111111111";
const SECOND = "22222222-2222-4222-8222-222222222222";
const ORNAMENT = "44444444-4444-4444-8444-444444444444";

const entry: Entry = {
  ...content,
  fields: [
    ...content.fields,
    { name: "shots", type: "list", elem: "uuid", present: "images" },
    { name: "notes", type: "text", hints: { visibility: "detail" } },
  ],
};
const row = {
  id: "record-1",
  slug: "field-notes",
  title: "Field notes",
  body: "Two paragraphs",
  coverImageId: COVER,
  status: "published",
  kind: "post",
  shots: [FIRST, SECOND, ORNAMENT],
  notes: "Kept for this screen",
};
const files = {
  [COVER]: fileMeta({ width: 1600, height: 900, alt: "A notebook on grass" }),
  [FIRST]: fileMeta({ width: 800, height: 600, alt: "The first morning" }),
  [SECOND]: fileMeta({ width: 800, height: 600, alt: "The second" }),
  [ORNAMENT]: fileMeta({ width: 800, height: 600, alt: "A border", decorative: true }),
};
const ready = Object.fromEntries(
  [COVER, FIRST, SECOND, ORNAMENT].map((id) => [id, "ready" as const]),
);
const slot = (props: ImageSlotProps) => <View testID={`slot-${props.id}`} />;
const information = (open: boolean) => {
  const model = deriveDisclosure(
    {
      id: "record-information",
      title: feedback.copy.kit.recordInformation,
      summary: feedback.copy.kit.recordInformationHolds,
      reveals: feedback.copy.kit.recordInformationContent,
      expanded: open,
      depth: 1,
      enabled: true,
    },
    presentation,
  );
  if (!model.ok) throw new Error(JSON.stringify(model.issues));
  return { model: model.value, onExpanded: () => undefined };
};

const view = (node: React.ReactNode) => <ThemeProvider mode="light">{node}</ThemeProvider>;
const none = () => undefined;

describe("a record that opens on its picture", () => {
  const shown = async (over: Partial<React.ComponentProps<typeof ResourceDetail>> = {}) =>
    await render(
      view(
        <ResourceDetail
          feedback={feedback}
          entry={entry}
          row={row}
          error=""
          onRetry={none}
          files={files}
          pictureStates={ready}
          renderImage={slot}
          information={information(false)}
          {...over}
        />,
      ),
    );

  test("the photo carries the record's name and no row prints its identifier", async () => {
    await shown();
    expect(screen.getByTestId("record-cover")).toBeTruthy();
    expect(screen.getByTestId("record-title").props.children).toBe("Field notes");
    expect(screen.queryByTestId("field-coverImageId")).toBeNull();
    expect(screen.queryByTestId("field-shots")).toBeNull();
    // The page is still the page: the id every journey looks the screen up by.
    expect(screen.getByTestId("resource-detail")).toBeTruthy();
  });

  test("the gallery holds one tile per picture and opens only the ones it can name", async () => {
    const opened = jest.fn();
    await shown({ onOpenPhoto: opened });
    expect(screen.getAllByTestId(/^photo-\d$/).length).toBe(3);
    expect(screen.getByText("3 photos")).toBeTruthy();
    fireEvent.press(screen.getByTestId("photo-1"));
    expect(opened).toHaveBeenCalledWith("shots", SECOND);
    // A decorative picture is drawn and not offered: there is nothing to open it into.
    fireEvent.press(screen.getByTestId("photo-2"));
    expect(opened).toHaveBeenCalledTimes(1);
  });

  test("the record's own information asks for no row the header or a gallery drew", async () => {
    await shown({ information: information(true) });
    expect(screen.getByTestId("field-notes")).toBeTruthy();
    expect(screen.queryByTestId("field-coverImageId")).toBeNull();
    expect(screen.queryByTestId("field-shots")).toBeNull();
  });

  test("the band that names the record waits until the photo is scrolled away", async () => {
    await shown();
    expect(screen.queryByTestId("record-title-bar")).toBeNull();
  });
});

describe("a record with no picture of its own", () => {
  test("the header block stays exactly the block it was", async () => {
    await render(
      view(
        <ResourceDetail
          feedback={feedback}
          entry={entry}
          row={{ ...row, coverImageId: "", shots: [] }}
          error=""
          onRetry={none}
          files={files}
          pictureStates={ready}
          renderImage={slot}
        />,
      ),
    );
    expect(screen.queryByTestId("record-cover")).toBeNull();
    expect(screen.queryByTestId("photo-strip")).toBeNull();
    expect(screen.queryByTestId("record-title")).toBeNull();
    expect(screen.getByTestId("field-slug")).toBeTruthy();
  });
});
