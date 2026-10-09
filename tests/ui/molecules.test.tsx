import { feedback } from "../fakes/presentation";
import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { StyleSheet } from "react-native";
import { display, presentedInstant, timeValue } from "../../src/core/derive";
import { DetailRow } from "../../src/ui/molecules/DetailRow";
import { FormField } from "../../src/ui/molecules/FormField";
import { LoadMore } from "../../src/ui/molecules/LoadMore";
import { Row } from "../../src/ui/molecules/Row";
import { Section } from "../../src/ui/molecules/Section";
import { ServerField } from "../../src/ui/molecules/ServerField";
import { TagsField } from "../../src/ui/molecules/TagsField";
import { Value } from "../../src/ui/molecules/Value";
import { ThemeProvider } from "../../src/ui/theme";
import { palette } from "../../src/ui/tokens";

const inTheme = (el: React.ReactElement, mode: "light" | "dark" = "light") =>
  render(<ThemeProvider mode={mode}>{el}</ThemeProvider>);
const none = () => undefined;

describe("FormField", () => {
  test("the refusal sits under the field it is about", async () => {
    await inTheme(
      <FormField label="Title" required error="is required">
        <></>
      </FormField>,
    );
    expect(screen.getByText("Title *")).toBeOnTheScreen();
    expect(screen.getByText("is required")).toBeOnTheScreen();
  });
});

describe("Row", () => {
  test("a list row is announced with its cells and opens on press", async () => {
    const open = jest.fn();
    await inTheme(
      <Section title="Notes">
        <Row
          title="Buy milk"
          cells={[
            { label: "Status", value: "Open" },
            { label: "Rank", value: "2" },
          ]}
          onPress={open}
        />
      </Section>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Buy milk, Status: Open, Rank: 2" }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("header", { name: "Notes" })).toBeOnTheScreen();
  });

  test("a row's time cell is announced as the instant it stands for", async () => {
    // The pair a detail row already carries: the eye reads the distance, the reader
    // says the whole date-time, so a row never claims a record is newer than its
    // own accessibility label proves it is not.
    const said = presentedInstant(timeValue("2026-07-18T08:55:00Z")!, feedback);
    expect(said.shown).toBe("5 minutes ago");
    await inTheme(
      <Row
        title="Buy milk"
        cells={[{ label: "Created", value: said.shown, spoken: said.exact }]}
      />,
    );
    expect(screen.getByText("Created: 5 minutes ago")).toBeOnTheScreen();
    expect(screen.getByRole("button").props.accessibilityLabel).toBe(
      `Buy milk, Created: ${said.exact}`,
    );
  });

  /** every style drawn under here, so a test can count the lines a group draws. */
  const drawn = (node: ReturnType<typeof screen.getByTestId>): readonly object[] => [
    ...(node.props.style === undefined ? [] : [StyleSheet.flatten(node.props.style)]),
    ...node.children
      .filter((child): child is ReturnType<typeof screen.getByTestId> => typeof child !== "string")
      .flatMap(drawn),
  ];

  test("a row draws no separator; the section it sits in separates its rows once", async () => {
    await inTheme(
      <Section testID="group">
        <Row title="First" testID="row-one" />
        <Row title="Second" testID="row-two" />
      </Section>,
    );
    // The line between two rows belongs to the group: two rows, one line, and the
    // row itself carries none — otherwise a row outside a group is a fragment of a
    // table and every card of rows is drawn twice.
    for (const id of ["row-one", "row-two"]) {
      const style = StyleSheet.flatten(screen.getByTestId(id).props.style) as {
        borderBottomWidth?: number;
      };
      expect(style.borderBottomWidth).toBeUndefined();
    }
    // The group wraps each row in its own line: two rows, one line between them, and
    // no line the row itself drew.
    expect(
      drawn(screen.getByTestId("group")).filter(
        (style) => (style as { borderBottomWidth?: number }).borderBottomWidth !== undefined,
      ).length,
    ).toBe(1);
  });
});

describe("Value", () => {
  const status = { name: "status", type: "string" as const, enum: ["open", "done"] };
  const pinned = { name: "pinned", type: "bool" as const };

  test("a value of a closed set is a neutral pill: position in the list picks no colour", async () => {
    await inTheme(
      <>
        <Value presentation={feedback} field={status} value="open" testID="status-open" />
        <Value presentation={feedback} field={status} value="done" testID="status-done" />
      </>,
      "light",
    );
    // The first value and the second both: the catalogue names no tone for any of
    // them, so neither may borrow one from where it sits in the list.
    for (const id of ["status-open", "status-done"])
      expect(StyleSheet.flatten(screen.getByTestId(id).props.style)).toMatchObject({
        backgroundColor: palette.light.surfaceMuted,
      });
  });

  test("a switch with no answer says there is none; one answered off says No", async () => {
    await inTheme(
      <>
        <DetailRow
          term="Pinned"
          value="Not set"
          shown={<Value presentation={feedback} field={pinned} value={undefined} />}
          testID="unset"
        />
        <DetailRow
          term="Pinned"
          value="No"
          shown={<Value presentation={feedback} field={pinned} value={false} />}
          testID="answered-off"
        />
      </>,
    );
    expect(screen.getByText("Not set")).toBeOnTheScreen();
    // A pill would claim a state, and "off" is one: it keeps its badge.
    expect(screen.getByText("No")).toBeOnTheScreen();
  });

  test("an instant is shown as a distance and announced as the whole date-time", async () => {
    const createdAt = { name: "createdAt", type: "time" as const };
    // One call, both spellings: what the eye reads comes from the same instant the
    // row announces, and the row is the accessible element.
    const said = presentedInstant(timeValue("2026-01-31T09:00:00Z")!, feedback);
    expect(said.shown).toBe("Jan 31, 09:00 AM");
    expect(said.exact).toBe("Jan 31, 2026, 09:00 AM");
    await inTheme(
      <DetailRow
        term="Created"
        value={display(createdAt, "2026-01-31T09:00:00Z", feedback)}
        spoken={said.exact}
        shown={<Value presentation={feedback} field={createdAt} value="2026-01-31T09:00:00Z" />}
        testID="field-createdAt"
      />,
    );
    expect(screen.getByText(said.shown)).toBeOnTheScreen();
    expect(screen.getByTestId("field-createdAt").props.accessibilityLabel).toBe(
      `Created, ${said.exact}`,
    );
  });
});

describe("TagsField", () => {
  test("what is typed is part of the value, so a save that never blurred it carries it", async () => {
    const onChange = jest.fn();
    await inTheme(<TagsField label="Tags" value="alpha, beta, " onChange={onChange} />);
    // A value this control wrote reads back as its chips and what is being typed.
    expect(screen.getByRole("button", { name: "Remove alpha" })).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("tags-tags"), "gam");
    expect(onChange).toHaveBeenCalledWith("alpha, beta, gam");
  });

  test("a record's own list is all chips, none of it half-typed", async () => {
    const onChange = jest.fn();
    await inTheme(<TagsField label="Tags" value="alpha, beta" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "Remove beta" })).toBeOnTheScreen();
    expect(screen.getByTestId("tags-tags")).toHaveDisplayValue("");
    await fireEvent.press(screen.getByRole("button", { name: "Remove alpha" }));
    expect(onChange).toHaveBeenCalledWith("beta, ");
  });
});

describe("testID", () => {
  test("every molecule takes a testID a device flow can look up", async () => {
    await inTheme(
      <>
        <DetailRow term="Title" value="A note" testID="t-detail" />
        <LoadMore feedback={feedback} remaining={3} busy={false} onPress={none} testID="t-more" />
        <ServerField
          caption="Workspace address"
          value="https://acme.test"
          onChange={none}
          testID="t-server"
        />
        <Section testID="t-section">
          <Row title="A row" testID="t-row" />
        </Section>
        <FormField label="Words" testID="t-field">
          <TagsField label="Tags" value="" onChange={none} testID="t-tags" />
        </FormField>
      </>,
    );
    for (const id of ["t-detail", "t-more", "t-server", "t-section", "t-row", "t-field", "t-tags"])
      expect(screen.getByTestId(id)).toBeOnTheScreen();
    // The server's own input keeps the id the sign-in flow types into.
    expect(screen.getByTestId("server")).toBeOnTheScreen();
  });

  test("a value carries its testID whatever shape its type gives it", async () => {
    const shapes = [
      ["empty", { name: "body", type: "text" as const }, ""],
      ["enum", { name: "status", type: "string" as const, enum: ["open", "done"] }, "open"],
      ["bool", { name: "pinned", type: "bool" as const }, true],
      ["list", { name: "tags", type: "list" as const, elem: "string" as const }, ["a", "b"]],
      ["time", { name: "dueAt", type: "time" as const }, "2026-01-31T09:00:00Z"],
      ["uuid", { name: "id", type: "uuid" as const }, "3f2a9c1e-1b2c-4d5e-8f90-123456789abc"],
      ["int", { name: "rank", type: "int" as const }, 2],
      ["text", { name: "title", type: "string" as const }, "Buy milk"],
    ] as const;
    await inTheme(
      <>
        {shapes.map(([id, field, value]) => (
          <Value presentation={feedback} key={id} field={field} value={value} testID={`t-${id}`} />
        ))}
      </>,
    );
    for (const [id] of shapes) expect(screen.getByTestId(`t-${id}`)).toBeOnTheScreen();
  });
});
