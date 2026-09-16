import { describe, expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { DetailRow } from "../../src/ui/molecules/DetailRow";
import { FormField } from "../../src/ui/molecules/FormField";
import { LoadMore } from "../../src/ui/molecules/LoadMore";
import { Row } from "../../src/ui/molecules/Row";
import { Section } from "../../src/ui/molecules/Section";
import { ServerField } from "../../src/ui/molecules/ServerField";
import { TagsField } from "../../src/ui/molecules/TagsField";
import { Value } from "../../src/ui/molecules/Value";
import { ThemeProvider } from "../../src/ui/theme";

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
        <Row title="Buy milk" cells={["Status: Open", "Rank: 2"]} onPress={open} />
      </Section>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Buy milk, Status: Open, Rank: 2" }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("header", { name: "Notes" })).toBeOnTheScreen();
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
        <LoadMore remaining={3} busy={false} onPress={none} testID="t-more" />
        <ServerField value="https://acme.test" onChange={none} testID="t-server" />
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
          <Value key={id} field={field} value={value} testID={`t-${id}`} />
        ))}
      </>,
    );
    for (const [id] of shapes) expect(screen.getByTestId(`t-${id}`)).toBeOnTheScreen();
  });
});
